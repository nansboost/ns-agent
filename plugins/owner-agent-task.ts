// @ts-nocheck
import fs from 'fs/promises'
import path from 'path'
import {
  getActiveProvider,
  parseProviderPrefix,
  runUnifiedAgent
} from '../lib/agent/router.ts'
import { resolveProjectFile } from '../lib/agent/data-paths.ts'

const timers = new Map()
const PROJECT_ROOT = path.resolve(process.cwd())

function cfg () {
  const c = global.agentRouter || {}
  const workspace = c.workspace || './'
  return {
    file: resolveProjectFile(c.taskFile, './lib/agent-data/agent-tasks.json'),
    defaultIntervalMs: Number(c.taskDefaultIntervalMs || 120000),
    defaultMaxRounds: Number(c.taskDefaultMaxRounds || 6),
    maxRounds: Number(c.taskMaxRounds || 20),
    minIntervalMs: Number(c.taskMinIntervalMs || 60000),
    logMaxChars: Number(c.taskLogMaxChars || 6000)
  }
}

function safeTaskFile () {
  const c = cfg()
  return c.file
}

async function readStore () {
  const file = safeTaskFile()
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return { _info: 'AI Agent periodic tasks', _version: '1.0', tasks: {} }
  }
}

async function writeStore (store) {
  const file = safeTaskFile()
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf8')
  await fs.rename(tmp, file)
}

function taskFileRel () {
  return path.relative(PROJECT_ROOT, safeTaskFile()).replaceAll(path.sep, '/') || '.'
}

function makeId () {
  return 'agt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)
}

function parseDurationMs (value = '') {
  const raw = String(value || '').trim().toLowerCase()
  const m = raw.match(/^(\d+)(s|sec|detik|m|min|menit|h|jam)?$/i)
  if (!m) return 0
  const n = Number(m[1])
  const unit = m[2] || 'm'
  if (unit === 's' || unit === 'sec' || unit === 'detik') return n * 1000
  if (unit === 'h' || unit === 'jam') return n * 60 * 60 * 1000
  return n * 60 * 1000
}

function formatDuration (ms) {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} detik`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} menit`
  return `${Math.round(m / 60)} jam`
}

function splitMessage (text, max = 3500) {
  const value = String(text || '')
  const chunks = []
  for (let i = 0; i < value.length; i += max) chunks.push(value.slice(i, i + max))
  return chunks.length ? chunks : ['']
}

async function sendText (conn, chatId, text) {
  if (!conn || !chatId) return
  for (const chunk of splitMessage(text)) {
    await conn.reply(chatId, chunk, null).catch(async () => {
      await conn.sendMessage(chatId, { text: chunk }).catch(() => {})
    })
  }
}

function compactLog (task) {
  const max = cfg().logMaxChars
  const log = Array.isArray(task.log) ? task.log : []
  const text = log.slice(-6).map(item => `#${item.round} [${item.at}]\n${item.output}`).join('\n\n---\n\n')
  return text.length > max ? text.slice(-max) : text
}

function detectDone (answer = '') {
  const text = String(answer || '').toLowerCase()
  return /status\s*:\s*(selesai|done|finish|finished)/i.test(text) || /tugas\s+(sudah\s+)?selesai/i.test(text)
}

async function saveTaskUpdate (task) {
  const store = await readStore()
  store.tasks = store.tasks || {}
  store.tasks[task.id] = task
  await writeStore(store)
}

async function runOneRound (conn, taskId) {
  const store = await readStore()
  const task = store.tasks?.[taskId]
  if (!task || task.status !== 'active') return

  const c = cfg()
  task.round = Number(task.round || 0) + 1
  task.started_current_round_at = new Date().toISOString()
  task.updated_at = task.started_current_round_at
  task.status = 'running'
  await saveTaskUpdate(task)

  const progress = compactLog(task) || '- belum ada progress sebelumnya'
  const prompt = `Kamu menjalankan TASK BERKALA agent WhatsApp.\n\nTUJUAN UTAMA:\n${task.goal}\n\nPROGRESS SEBELUMNYA:\n${progress}\n\nATURAN ROUND INI:\n- Ini round ${task.round}/${task.maxRounds}.\n- Kerjakan SATU TAHAP KECIL yang paling penting saja.\n- Jangan ulang pekerjaan dari awal.\n- Jika perlu edit kode bot, tulis langsung ke root project memakai tool agent.
- Jika membuat plugin baru, taruh di ws/plugins/.
- Jika membuat project/website/tool baru, taruh di ws/projects/.\n- Kalau ada error limit/rate limit, berhenti dengan status lanjut dan jelaskan singkat.\n- Di akhir jawaban wajib tulis salah satu baris ini:\n  STATUS: lanjut\n  STATUS: selesai\n- Lalu tulis NEXT: langkah berikutnya.`

  try {
    await sendText(conn, task.chatId, `⏳ *Agent task jalan*\nID: ${task.id}\nRound: ${task.round}/${task.maxRounds}\nProvider: ${task.providerId || 'aktif'}${task.model ? ':' + task.model : ''}`)

    const output = await runUnifiedAgent({
      prompt,
      userName: task.userName || 'owner',
      userId: task.userId || '',
      chatId: task.chatId,
      mode: 'write',
      providerId: task.providerId || '',
      model: task.model || ''
    })

    task.log = Array.isArray(task.log) ? task.log : []
    task.log.push({ round: task.round, at: new Date().toISOString(), output: String(output || '').slice(0, c.logMaxChars) })
    task.updated_at = new Date().toISOString()

    const done = detectDone(output)
    if (done || task.round >= task.maxRounds) {
      task.status = 'done'
      task.finished_at = new Date().toISOString()
      await saveTaskUpdate(task)
      timers.delete(task.id)
      await sendText(conn, task.chatId, `✅ *Agent task selesai*\nID: ${task.id}\nRound: ${task.round}/${task.maxRounds}\n\n${output}`)
      return
    }

    task.status = 'active'
    task.next_run_at = new Date(Date.now() + task.intervalMs).toISOString()
    await saveTaskUpdate(task)
    await sendText(conn, task.chatId, `✅ *Round ${task.round} selesai*\nID: ${task.id}\nNext: ${formatDuration(task.intervalMs)} lagi\n\n${output}`)
    scheduleTask(conn, task.id, task.intervalMs)
  } catch (e) {
    task.status = 'active'
    task.error = e.message || String(e)
    task.updated_at = new Date().toISOString()
    task.next_run_at = new Date(Date.now() + task.intervalMs).toISOString()
    task.log = Array.isArray(task.log) ? task.log : []
    task.log.push({ round: task.round, at: new Date().toISOString(), error: task.error })
    await saveTaskUpdate(task)
    await sendText(conn, task.chatId, `⚠️ *Agent task error*\nID: ${task.id}\nRound: ${task.round}/${task.maxRounds}\nError: ${task.error}\n\nAkan coba lagi ${formatDuration(task.intervalMs)} lagi. Stop: .agenttask stop ${task.id}`)
    scheduleTask(conn, task.id, task.intervalMs)
  }
}

function scheduleTask (conn, taskId, delayMs) {
  if (timers.has(taskId)) clearTimeout(timers.get(taskId))
  const timer = setTimeout(() => {
    timers.delete(taskId)
    runOneRound(conn, taskId).catch(() => {})
  }, Math.max(Number(delayMs || cfg().defaultIntervalMs), 1000))
  timers.set(taskId, timer)
}

async function resumeTasks (conn, chatId = '') {
  const store = await readStore()
  const tasks = Object.values(store.tasks || {}).filter(t => (t.status === 'active' || t.status === 'running') && (!chatId || t.chatId === chatId))
  for (const task of tasks) {
    if (task.status === 'running') {
      task.status = 'active'
      task.updated_at = new Date().toISOString()
    }
    const next = task.next_run_at ? new Date(task.next_run_at).getTime() : Date.now() + 3000
    scheduleTask(conn, task.id, Math.max(next - Date.now(), 3000))
  }
  if (tasks.length) await writeStore(store)
  return tasks.length
}

function usage (p) {
  return `*Agent Task Berkala*\n\nMulai task besar bertahap:\n${p}agenttask start 2m 6 nvidia perbaiki session agent dan buat dokumentasi\n\nFormat:\n${p}agenttask start <interval> <jumlah_round> <instruksi>\n\nContoh:\n${p}agenttask start 3m 8 nvidia audit dan rapikan plugin owner-agent\n${p}agenttask next <id>\n${p}agenttask status\n${p}agenttask stop <id>\n${p}agenttask resume\n\nSaran NVIDIA free API: interval 2m-5m agar tidak gampang 429.`
}

let handler = async (m, { conn, text, usedPrefix }) => {
  const p = usedPrefix || '.'
  const input = String(text || '').trim()
  if (!input || /^(help|menu)$/i.test(input)) return m.reply(usage(p))

  const [cmdRaw, ...restParts] = input.split(/\s+/)
  const cmd = (cmdRaw || '').toLowerCase()

  if (/^(status|list|daftar)$/i.test(cmd)) {
    const store = await readStore()
    const tasks = Object.values(store.tasks || {}).filter(t => t.chatId === m.chat || !t.chatId)
    if (!tasks.length) return m.reply(`Belum ada agent task.\n\n${usage(p)}`)
    const lines = tasks.slice(-12).map(t => {
      return `• ${t.id}\n  status: ${t.status}\n  round: ${t.round || 0}/${t.maxRounds}\n  interval: ${formatDuration(t.intervalMs)}\n  provider: ${t.providerId || 'aktif'}${t.model ? ':' + t.model : ''}\n  goal: ${String(t.goal || '').slice(0, 120)}`
    })
    return m.reply(`*Agent Task Status*\nFile: ${taskFileRel()}\n\n${lines.join('\n\n')}`)
  }

  if (/^(resume|lanjutkan)$/i.test(cmd)) {
    const count = await resumeTasks(conn, m.chat)
    return m.reply(`Resume task aktif: ${count}`)
  }

  if (/^(stop|cancel|batal)$/i.test(cmd)) {
    const id = restParts[0]
    if (!id) return m.reply(`ID task belum diisi. Contoh: ${p}agenttask stop agt_xxx`)
    const store = await readStore()
    const task = store.tasks?.[id]
    if (!task) return m.reply('Task tidak ditemukan.')
    task.status = 'stopped'
    task.updated_at = new Date().toISOString()
    if (timers.has(id)) clearTimeout(timers.get(id))
    timers.delete(id)
    await writeStore(store)
    return m.reply(`Task dihentikan: ${id}`)
  }

  if (/^(next|run|jalan)$/i.test(cmd)) {
    const id = restParts[0]
    if (!id) return m.reply(`ID task belum diisi. Contoh: ${p}agenttask next agt_xxx`)
    const store = await readStore()
    const task = store.tasks?.[id]
    if (!task) return m.reply('Task tidak ditemukan.')
    if (task.status !== 'active') return m.reply(`Task tidak aktif. Status sekarang: ${task.status}`)
    if (timers.has(id)) clearTimeout(timers.get(id))
    timers.delete(id)
    runOneRound(conn, id).catch(() => {})
    return m.reply(`Task dijalankan sekarang: ${id}`)
  }

  if (/^(start|mulai|buat)$/i.test(cmd)) {
    let rest = restParts.join(' ').trim()
    const c = cfg()
    let intervalMs = c.defaultIntervalMs
    let maxRounds = c.defaultMaxRounds

    const intervalMatch = rest.match(/^(\d+(?:s|sec|detik|m|min|menit|h|jam)?)\s+([\s\S]+)$/i)
    if (intervalMatch) {
      const parsed = parseDurationMs(intervalMatch[1])
      if (parsed) {
        intervalMs = Math.max(parsed, c.minIntervalMs)
        rest = intervalMatch[2].trim()
      }
    }

    const roundMatch = rest.match(/^(\d+)\s+([\s\S]+)$/)
    if (roundMatch) {
      maxRounds = Math.min(Math.max(Number(roundMatch[1]), 1), c.maxRounds)
      rest = roundMatch[2].trim()
    }

    const parsed = parseProviderPrefix(rest)
    const goal = parsed.input || rest
    if (!goal) return m.reply(usage(p))

    const active = parsed.providerId ? { id: parsed.providerId, provider: { model: parsed.model || '' } } : await getActiveProvider()
    const id = makeId()
    const task = {
      id,
      status: 'active',
      goal,
      providerId: parsed.providerId || '',
      model: parsed.model || '',
      activeProviderAtCreate: active.id,
      activeModelAtCreate: active.provider?.model || '',
      chatId: m.chat,
      userId: m.sender,
      userName: m.name,
      intervalMs,
      maxRounds,
      round: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      next_run_at: new Date(Date.now() + 3000).toISOString(),
      log: []
    }

    const store = await readStore()
    store.tasks = store.tasks || {}
    store.tasks[id] = task
    await writeStore(store)
    scheduleTask(conn, id, 3000)

    return m.reply(`✅ *Agent task dibuat*\nID: ${id}\nInterval: ${formatDuration(intervalMs)}\nRound: 0/${maxRounds}\nProvider: ${parsed.providerId || active.id}${parsed.model ? ':' + parsed.model : ''}\nFile: ${taskFileRel()}\n\nTask akan mulai beberapa detik lagi. Stop:\n${p}agenttask stop ${id}`)
  }

  return m.reply(usage(p))
}

handler.help = ['agenttask start <interval> <round> <instruksi>', 'agenttask status', 'agenttask stop <id>', 'agenttask next <id>', 'agenttask resume']
handler.tags = ['owner']
handler.command = /^(agenttask|aitask|agentjob)$/i
handler.rowner = true
handler.owner = true

export default handler

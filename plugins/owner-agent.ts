// @ts-nocheck
import {
  agentRouterStatus,
  agentSessionInfo,
  agentWorkspaceInfo,
  formatModelList,
  formatProviders,
  clearAgentSessionForChat,
  getActiveProvider,
  getProviderModels,
  listAgentProviders,
  parseProviderPrefix,
  runUnifiedAgent,
  setActiveProvider,
  setProviderModel,
  testProviderModel
} from '../lib/agent/router.ts'
import { braveSearch } from '../lib/brave-search.ts'


function splitLongText (text, max = 3500) {
  const value = String(text || '')
  const chunks = []
  for (let i = 0; i < value.length; i += max) chunks.push(value.slice(i, i + max))
  return chunks.length ? chunks : ['']
}

function formatAgentWebSearch (data) {
  const web = Array.isArray(data.web) ? data.web : []
  const faq = Array.isArray(data.faq) ? data.faq : []
  if (!web.length && !faq.length) return `Tidak ada hasil web untuk: ${data.query}`

  const lines = []
  lines.push('*Agent Web Search*')
  lines.push(`Query: ${data.query}`)
  lines.push('Catatan: ini hasil langsung dari Brave Search scraper, jadi tidak memakai model AI/NVIDIA.')

  if (web.length) {
    lines.push('\n*Hasil Web:*')
    for (const [index, item] of web.entries()) {
      lines.push(`${index + 1}. ${item.title || '(Tanpa judul)'}\n${item.url || item.displayUrl || '-'}\n${item.description || '-'}${item.age ? `\n${item.age}` : ''}`)
    }
  }

  if (faq.length) {
    lines.push('\n*FAQ:*')
    for (const [index, item] of faq.entries()) {
      lines.push(`${index + 1}. ${item.question}\n${item.answer}`)
    }
  }

  return lines.join('\n\n')
}

function parseForcedWebSearch (command, input) {
  if (/^(agentsearch|agentweb)$/i.test(command || '')) return input.trim()

  const patterns = [
    /^(?:web|search|brave|internet)\s+(.+)$/i,
    /^(?:cariweb|searchweb)\s+(.+)$/i,
    /^(?:cari|search)\s+(?:di\s+)?(?:internet|web|google|brave)\s+(.+)$/i,
    /^(?:tolong\s+)?(?:cari|search)\s+(?:info\s+)?(?:terbaru\s+)?(?:di\s+)?(?:internet|web)\s+(?:tentang\s+)?(.+)$/i
  ]

  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

const showHelp = (p, c) => `*AI Agent Router*

Provider:
${p + c} provider
${p + c} use nvidia
${p + c} use dashscope

Model:
${p + c} models
${p + c} models nvidia
${p + c} models dashscope
${p + c} model qwen/qwen3.5-122b-a10b
${p + c} model deepseek-ai/deepseek-v3.2
${p + c} model dashscope qwen3.6-plus
${p + c} testmodel qwen/qwen3.5-122b-a10b

Workspace, session & limit:
${p + c} workspace
${p + c} limits
${p + c} session
${p + c} session clear
${p + c} lanjut
${p}agentwrite buat plugin ping sederhana
${p}agentwrite buat plugin ping sederhana di ws/plugins/main-ping-test.ts

Sekali jalan tanpa ubah default:
${p + c} nvidia:deepseek-ai/deepseek-v3.2 jelaskan repo ini
${p + c} dashscope:qwen3.6-plus jelaskan repo ini

Tanya:
${p + c} jelaskan struktur project
${p + c} cari bug di handler.ts
${p + c} cari di internet dokumentasi terbaru Baileys
${p + c} web dokumentasi terbaru Baileys
${p}agentsearch NVIDIA NIM 429 status code

Catatan:
- Codex/OAuth sudah dihapus.
- Provider tersedia: nvidia dan dashscope.
- Agent sekarang masuk queue per chat+mode agar request tidak saling tabrakan.
- Runtime provider menyimpan cooldown/key cursor agar NVIDIA 429 lebih stabil.
- Setiap run menyimpan report di lib/agent-data/reports/.
- Agent bisa baca/tulis seluruh root project jika owner meminta, termasuk mengubah kode bot.
- Plugin baru default masuk ke ws/plugins/.
- Project/website/tool baru default masuk ke ws/projects/.
- ws bukan pembatas akses; ws hanya tempat output agar struktur bot utama tetap rapi.`

let handler = async (m, { text, usedPrefix, command }) => {
  const p = usedPrefix || '.'
  const c = command || 'agent'
  let input = (text || '').trim()

  if (!input || /^(help|menu|bantuan)$/i.test(input)) return m.reply(showHelp(p, c))

  const forcedWebQuery = parseForcedWebSearch(c, input)
  if (forcedWebQuery) {
    try {
      if (m.react) await m.react('🔎')
      const data = await braveSearch(forcedWebQuery, { count: 8 })
      for (const chunk of splitLongText(formatAgentWebSearch(data))) await m.reply(chunk)
      if (m.react) await m.react('✅')
      return
    } catch (e) {
      if (m.react) await m.react('❌')
      return m.reply(`Web search error: ${e.message || e}\n\nCoba test langsung: ${p}brave ${forcedWebQuery}`)
    }
  }

  if (/^(workspace|workdir|folder|root)$/i.test(input)) {
    const w = agentWorkspaceInfo()
    return m.reply(`*Agent Workspace*

Project root:
${w.projectRoot}

Root akses tulis/baca agent:
${w.workspace}

Path relatif:
${w.workspaceRel}

Write aktif: ${w.writeEnabled ? 'ya' : 'belum'}
Max write per file: ${w.maxWriteBytes} bytes

Cara pakai:
.agentwrite buat plugin baru bernama main-ping-test.ts
.agentwrite perbaiki bug di handler.ts

Default plugin baru dibuat di ws/plugins/. Default project/website baru dibuat di ws/projects/. Agent tetap bisa mengubah file root project jika owner meminta.`)
  }

  if (/^(limits?|batas|limit)$/i.test(input)) {
    const w = agentWorkspaceInfo()
    const l = w.limits || {}
    return m.reply(`*Agent Limits*

Diatur di: *config.ts → global.agentRouter*

maxWriteBytes: ${w.maxWriteBytes}
maxAgentSteps: ${l.maxAgentSteps || '-'}
maxToolOutputChars: ${l.maxToolOutputChars || '-'}
maxFileBytes: ${l.maxFileBytes || '-'}
maxReadLines: ${l.maxReadLines || '-'}
maxSearchResults: ${l.maxSearchResults || '-'}
maxWorkspaceFilesPerBatch: ${l.maxWorkspaceFilesPerBatch || '-'}
maxWorkspaceBatchBytes: ${l.maxWorkspaceBatchBytes || '-'}
maxReplyChars: ${l.maxReplyChars || '-'}
webSearch: ${w.webSearch?.enabled === false ? 'off' : 'on'} / max ${w.webSearch?.maxResults || 8} hasil

Output jawaban WhatsApp tetap bisa kepotong oleh limit WhatsApp/model, tapi file panjang ditulis langsung ke root project/ws lewat tool write_workspace_files/append_workspace_file.`)
  }

  const sessionCmd = input.match(/^(?:session|sesi|memoryagent)(?:\s+(clear|hapus))?$/i)
  if (sessionCmd) {
    try {
      if (sessionCmd[1]) {
        const r = await clearAgentSessionForChat(m.chat)
        return m.reply(`*Session agent dihapus*\nChat: ${r.chatId}\nFile: ${r.file}\nSebelumnya ada: ${r.existed ? 'ya' : 'tidak'}`)
      }

      const s = await agentSessionInfo(m.chat)
      const preview = s.preview.length
        ? s.preview.map((x, i) => `${i + 1}. ${x.role}: ${x.text.replace(/\n/g, ' ').slice(0, 160)}`).join('\n')
        : '- belum ada isi session untuk chat ini'

      return m.reply(`*Agent Session*\n\nAktif: ${s.enabled ? 'ya' : 'tidak'}\nFile: ${s.file}\nChat ini: ${s.exists ? 'ada' : 'belum ada'}\nTotal sesi: ${s.totalSessions}\nPesan session chat ini: ${s.messages}\nProvider terakhir: ${s.providerId || '-'}\nModel terakhir: ${s.model || '-'}\nTerakhir aktif: ${s.lastActive || '-'}\n\n*Preview:*\n${preview}\n\nHapus session chat ini:\n${p + c} session clear`)
    } catch (e) {
      return m.reply(`Gagal baca session agent: ${e.message || e}`)
    }
  }

  if (/^(?:continue|lanjut|next)$/i.test(input)) {
    input = 'Lanjutkan pekerjaan sebelumnya berdasarkan session agent chat ini. Kerjakan satu tahap kecil saja, jangan ulang dari awal, dan jelaskan hasilnya singkat.'
  }

  if (/^(provider|providers|status|cek)$/i.test(input)) {
    try {
      const s = await agentRouterStatus()
      const active = s.active?.id || '-'
      const activeProvider = s.active?.provider || {}
      const runtimeLines = Object.entries(s.runtime || {}).map(([id, rt]) => {
        const cool = rt.cooldownActive ? `cooldown ${Math.ceil((rt.cooldownRemainingMs || 0) / 1000)}s` : 'ready'
        return `• ${id}: ${cool}, fail:${rt.failureCount || 0}, cursor:${rt.keyCursor || 0}`
      }).join('\n') || '- belum ada runtime state'
      const queueLines = (s.queue || []).map(q => `• ${q.scope}: running:${q.running ? 'ya' : 'tidak'}, pending:${q.pending || 0}`).join('\n') || '- kosong'
      const reportLines = (s.reports || []).map(r => `• ${r.reportFile || r.id} — ${r.mode}/${r.providerId || '-'}`).join('\n') || '- belum ada report'
      return m.reply(`*Agent Router Status*

Aktif: *${active}*
Tipe: *${activeProvider.type || '-'}*
Model: *${activeProvider.model || '-'}*
Workspace: *${s.workspace?.workspaceRel || '.'}*
Limit steps: *${s.workspace?.limits?.maxAgentSteps || '-'}*
Batch files: *${s.workspace?.limits?.maxWorkspaceFilesPerBatch || '-'}*
Web search: *${s.workspace?.webSearch?.enabled === false ? 'off' : 'on'}*

*Provider:*
${formatProviders(s.providers, active)}

*Runtime Provider:*
${runtimeLines}

*Queue:*
${queueLines}

*Report Terakhir:*
${reportLines}`)
    } catch (e) { return m.reply(`Gagal cek provider: ${e.message || e}`) }
  }

  const modelsCmd = input.match(/^(?:models|modelist|listmodels)(?:\s+([a-z0-9_-]+))?$/i)
  if (modelsCmd) {
    try {
      if (m.react) await m.react('📚')
      const data = await getProviderModels(modelsCmd[1] || '')
      return m.reply(formatModelList(data))
    } catch (e) { return m.reply(`Gagal ambil daftar model: ${e.message || e}`) }
  }

  const testModel = input.match(/^(?:testmodel|cekmodel)\s+(.+)$/i)
  if (testModel) {
    try {
      if (m.react) await m.react('🧪')
      const r = await testProviderModel(testModel[1])
      return m.reply(`*Test model berhasil*
Provider: ${r.providerId}
Model: ${r.model}

Output:
${r.output}`)
    } catch (e) {
      if (m.react) await m.react('❌')
      return m.reply(`Test model gagal: ${e.message || e}`)
    }
  }

  const use = input.match(/^(?:use|pakai|provider)\s+([a-z0-9_-]+)$/i)
  if (use) {
    try {
      const r = await setActiveProvider(use[1])
      return m.reply(`Provider aktif: *${r.id}*\nModel: *${r.provider.model || '-'}*`)
    } catch (e) { return m.reply(`Gagal ganti provider: ${e.message || e}\n\n${formatProviders(listAgentProviders())}`) }
  }

  const modelFor = input.match(/^model\s+([a-z0-9_-]+)\s+(.+)$/i)
  if (modelFor) {
    try {
      const r = await setProviderModel(modelFor[2], modelFor[1])
      return m.reply(`Model provider *${r.id}* diganti ke:\n*${r.model}*`)
    } catch (e) { return m.reply(`Gagal ganti model: ${e.message || e}`) }
  }

  const model = input.match(/^model\s+(.+)$/i)
  if (model) {
    try {
      const a = await getActiveProvider()
      const r = await setProviderModel(model[1], a.id)
      return m.reply(`Model provider *${r.id}* diganti ke:\n*${r.model}*`)
    } catch (e) { return m.reply(`Gagal ganti model: ${e.message || e}`) }
  }

  const writeMode = /^(agentwrite|agentedit|agentfix)$/i.test(c)
  const parsed = parseProviderPrefix(input)
  input = parsed.input || input

  try {
    const active = parsed.providerId ? `${parsed.providerId}${parsed.model ? ':' + parsed.model : ''}` : (await getActiveProvider()).id
    if (m.react) await m.react(writeMode ? '🛠️' : '🧠')
    await m.reply(writeMode ? `Agent write via *${active}* ke *root proyek*...` : `Agent jalan via *${active}*...`)
    const answer = await runUnifiedAgent({
      prompt: input,
      userName: m.name,
      userId: m.sender,
      chatId: m.chat,
      mode: writeMode ? 'write' : 'read',
      providerId: parsed.providerId || '',
      model: parsed.model || ''
    })
    await m.reply(answer)
    if (m.react) await m.react('✅')
  } catch (e) {
    console.error('AI Agent Router Error:', e)
    if (m.react) await m.react('❌')
    await m.reply(`Agent error: ${e.message || e}\n\nCek: ${p}agent provider\nModel: ${p}agent models`)
  }
}

handler.help = ['agent <pertanyaan>', 'agent provider', 'agent models', 'agent web <query>', 'agentsearch <query>', 'agentwrite <instruksi>']
handler.tags = ['owner']
handler.command = /^(agent|codeagent|repoai|agentwrite|agentedit|agentfix|agentsearch|agentweb)$/i
handler.rowner = true
handler.owner = true

export default handler

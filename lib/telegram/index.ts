// @ts-nocheck
import fetch from 'node-fetch'
import {
  agentRouterStatus,
  formatModelList,
  formatProviders,
  getActiveProvider,
  getProviderModels,
  listAgentProviders,
  parseProviderPrefix,
  runUnifiedAgent,
  setActiveProvider,
  setProviderModel
} from '../agent/router.ts'

let stopped = false
let offset = 0
let startedAt = Date.now()
let status = {
  service: 'telegram',
  ok: false,
  enabled: false,
  polling: false,
  lastUpdateId: 0,
  handled: 0,
  errors: 0,
  lastError: '',
  startedAt: new Date(startedAt).toISOString(),
  updatedAt: new Date().toISOString()
}

function telegramConfig () {
  const cfg = global.telegramBot || {}
  return {
    enabled: cfg.enabled === true,
    token: String(cfg.token || '').trim(),
    prefix: cfg.prefix || '/',
    allowAllUsers: cfg.allowAllUsers === true,
    ownerIds: (cfg.ownerIds || cfg.owners || []).map(x => String(x)),
    ownerUsernames: (cfg.ownerUsernames || []).map(x => String(x).replace(/^@/, '').toLowerCase()),
    privateOnly: cfg.privateOnly !== false,
    pollingTimeoutSeconds: Number(cfg.pollingTimeoutSeconds || 25),
    requestTimeoutMs: Number(cfg.requestTimeoutMs || 35000),
    retryDelayMs: Number(cfg.retryDelayMs || 3000),
    maxMessageChars: Number(cfg.maxMessageChars || 3900),
    agentEnabled: cfg.agent?.enabled !== false,
    agentWriteEnabled: cfg.agent?.writeEnabled === true,
    agentStatusEnabled: cfg.agent?.statusEnabled !== false,
    agentPrefix: cfg.agent?.commandPrefix || 'telegram',
    notifyOnStart: cfg.notifyOnStart === true
  }
}

function setStatus (patch = {}) {
  status = {
    ...status,
    ...patch,
    updatedAt: new Date().toISOString()
  }
  try { process.send?.({ type: 'runtime-status', status }) } catch {}
}

function redactToken (text = '') {
  const token = telegramConfig().token
  if (!token) return String(text || '')
  return String(text || '').replaceAll(token, '[TELEGRAM_TOKEN]')
}

function splitLongText (text, max = telegramConfig().maxMessageChars) {
  const value = String(text || '')
  const safeMax = Math.max(1000, Math.min(Number(max || 3900), 3900))
  const chunks = []
  for (let i = 0; i < value.length; i += safeMax) chunks.push(value.slice(i, i + safeMax))
  return chunks.length ? chunks : ['']
}

function userLabel (from = {}) {
  return from.username ? `@${from.username}` : [from.first_name, from.last_name].filter(Boolean).join(' ') || String(from.id || '')
}

function isTokenEmpty (token = '') {
  return !token || /^(YOUR_TELEGRAM_BOT_TOKEN|ISI_TOKEN_TELEGRAM|BOT_TOKEN_HERE)$/i.test(token)
}

function isAuthorized (msg) {
  const cfg = telegramConfig()
  const from = msg?.from || {}
  if (cfg.allowAllUsers) return true
  if (cfg.ownerIds.includes(String(from.id || ''))) return true
  const username = String(from.username || '').toLowerCase()
  if (username && cfg.ownerUsernames.includes(username)) return true
  return false
}

function helpText (authorized = false) {
  return `Telegram Bridge aktif.

Command umum:
/start - info bridge
/id - lihat Telegram user ID
/ping - cek bot Telegram
/status - status Telegram + agent
/provider - provider AI aktif
/models [provider] - daftar model provider

AI Agent:
/agent <prompt>
/agentwrite <instruksi>  ${authorized ? '' : '(butuh owner)'}

Provider:
/use <provider>
/model <model>
/model <provider> <model>

Catatan:
- Telegram berjalan di proses terpisah dari WhatsApp lewat index.ts.
- Kalau Telegram error, WhatsApp tidak ikut crash.
- Kalau WhatsApp error/restart, Telegram tetap polling selama wrapper hidup.
- Semua konfigurasi ada di config.ts → global.telegramBot.`
}

async function tgApi (method, body = {}, options = {}) {
  const cfg = telegramConfig()
  if (isTokenEmpty(cfg.token)) throw new Error('Token Telegram kosong. Isi global.telegramBot.token di config.ts')
  const url = `https://api.telegram.org/bot${cfg.token}/${method}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
    timeout: Number(options.timeoutMs || cfg.requestTimeoutMs || 35000)
  })
  const json = await res.json().catch(async () => ({ ok: false, description: await res.text().catch(() => '') }))
  if (!res.ok || json.ok === false) {
    throw new Error(`Telegram API ${method} failed: ${res.status} ${json.description || res.statusText}`)
  }
  return json.result
}

async function sendMessage (chatId, text, extra = {}) {
  const chunks = splitLongText(text)
  let last = null
  for (const chunk of chunks) {
    last = await tgApi('sendMessage', {
      chat_id: chatId,
      text: chunk || ' ',
      disable_web_page_preview: true,
      ...extra
    })
  }
  return last
}

async function sendTyping (chatId) {
  return tgApi('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => null)
}

function parseCommand (text = '') {
  const raw = String(text || '').trim()
  if (!raw.startsWith('/')) return { command: '', args: raw }
  const [head, ...rest] = raw.split(/\s+/)
  const command = head.replace(/^\//, '').split('@')[0].toLowerCase()
  return { command, args: rest.join(' ').trim(), raw }
}

async function formatStatus () {
  const agent = await agentRouterStatus().catch(e => ({ error: e.message || String(e) }))
  const active = agent.active?.id || '-'
  const provider = agent.active?.provider || {}
  const queueLines = (agent.queue || []).map(q => `• ${q.scope}: running:${q.running ? 'ya' : 'tidak'}, pending:${q.pending || 0}`).join('\n') || '- kosong'
  const runtimeLines = Object.entries(agent.runtime || {}).map(([id, rt]) => {
    const cool = rt.cooldownActive ? `cooldown ${Math.ceil((rt.cooldownRemainingMs || 0) / 1000)}s` : 'ready'
    return `• ${id}: ${cool}, fail:${rt.failureCount || 0}, cursor:${rt.keyCursor || 0}`
  }).join('\n') || '- belum ada runtime'

  return `Telegram Bridge Status

Telegram:
OK: ${status.ok ? 'ya' : 'tidak'}
Polling: ${status.polling ? 'jalan' : 'mati'}
Handled: ${status.handled}
Errors: ${status.errors}
Last error: ${status.lastError || '-'}
Uptime: ${Math.floor((Date.now() - startedAt) / 1000)}s

Agent:
Aktif: ${active}
Model: ${provider.model || '-'}
Workspace: ${agent.workspace?.workspaceRel || '.'}

Runtime Provider:
${runtimeLines}

Queue:
${queueLines}`
}

async function handleAuthorizedCommand (msg, command, args) {
  const chatId = msg.chat.id
  const from = msg.from || {}

  if (command === 'status') return sendMessage(chatId, await formatStatus())

  if (command === 'provider' || command === 'providers') {
    const active = await getActiveProvider()
    return sendMessage(chatId, `Provider aktif: ${active.id}\nModel: ${active.provider?.model || '-'}\n\n${formatProviders(listAgentProviders(), active.id)}`)
  }

  if (command === 'models') {
    const data = await getProviderModels(args || '')
    return sendMessage(chatId, formatModelList(data).replace(/\*/g, ''))
  }

  if (command === 'use') {
    if (!args) return sendMessage(chatId, 'Format: /use nvidia')
    const r = await setActiveProvider(args)
    return sendMessage(chatId, `Provider aktif: ${r.id}\nModel: ${r.provider?.model || '-'}`)
  }

  if (command === 'model') {
    if (!args) return sendMessage(chatId, 'Format: /model qwen/qwen3.5-122b-a10b\nAtau: /model nvidia qwen/qwen3.5-122b-a10b')
    const match = args.match(/^([a-z0-9_-]+)\s+(.+)$/i)
    if (match && global.agentRouter?.providers?.[match[1]]) {
      const r = await setProviderModel(match[2], match[1])
      return sendMessage(chatId, `Model provider ${r.id} diganti ke:\n${r.model}`)
    }
    const active = await getActiveProvider()
    const r = await setProviderModel(args, active.id)
    return sendMessage(chatId, `Model provider ${r.id} diganti ke:\n${r.model}`)
  }

  if (command === 'agent' || command === 'agentwrite') {
    const cfg = telegramConfig()
    if (!cfg.agentEnabled) return sendMessage(chatId, 'Telegram AI agent disabled di config.ts')
    const writeMode = command === 'agentwrite'
    if (writeMode && !cfg.agentWriteEnabled) return sendMessage(chatId, 'Telegram agentwrite masih disabled. Aktifkan global.telegramBot.agent.writeEnabled di config.ts')
    if (!args) return sendMessage(chatId, `Format: /${command} <prompt>`)

    const parsed = parseProviderPrefix(args)
    const prompt = parsed.input || args
    const active = parsed.providerId ? `${parsed.providerId}${parsed.model ? ':' + parsed.model : ''}` : (await getActiveProvider()).id

    await sendMessage(chatId, writeMode ? `Agent write via ${active} berjalan...` : `Agent via ${active} berjalan...`)
    await sendTyping(chatId)

    const answer = await runUnifiedAgent({
      prompt,
      userName: userLabel(from),
      userId: `telegram:${from.id}`,
      chatId: `telegram:${chatId}`,
      mode: writeMode ? 'write' : 'read',
      providerId: parsed.providerId || '',
      model: parsed.model || ''
    })

    return sendMessage(chatId, answer)
  }

  return sendMessage(chatId, helpText(true))
}

async function handleMessage (msg) {
  const chatId = msg?.chat?.id
  if (!chatId) return

  const cfg = telegramConfig()
  const text = msg.text || msg.caption || ''
  const { command, args } = parseCommand(text)
  const authorized = isAuthorized(msg)

  if (cfg.privateOnly && msg.chat?.type !== 'private') {
    if (command === 'id') {
      return sendMessage(chatId, `Chat ID: ${msg.chat.id}\nChat type: ${msg.chat.type}\nUser ID: ${msg.from?.id}\nUsername: ${msg.from?.username ? '@' + msg.from.username : '-'}`)
    }
    return
  }

  if (!command) return

  if (command === 'start' || command === 'help') return sendMessage(chatId, helpText(authorized))
  if (command === 'id') return sendMessage(chatId, `Telegram User ID: ${msg.from?.id}\nUsername: ${msg.from?.username ? '@' + msg.from.username : '-'}\nChat ID: ${chatId}\nAuthorized: ${authorized ? 'ya' : 'tidak'}\n
Masukkan ID ini ke config.ts → global.telegramBot.ownerIds agar bisa pakai /agent.`)
  if (command === 'ping') return sendMessage(chatId, `pong ${Date.now()}`)

  if (!authorized) {
    return sendMessage(chatId, `Akses Telegram bridge ditolak.\n\nUser ID kamu: ${msg.from?.id}\nUsername: ${msg.from?.username ? '@' + msg.from.username : '-'}\n\nTambahkan ID kamu ke config.ts → global.telegramBot.ownerIds.`)
  }

  return handleAuthorizedCommand(msg, command, args)
}

async function handleUpdate (update) {
  status.lastUpdateId = update.update_id || status.lastUpdateId
  if (update.message) await handleMessage(update.message)
  status.handled++
  setStatus({ ok: true, lastUpdateId: status.lastUpdateId, handled: status.handled })
}

async function pollingLoop () {
  const cfg = telegramConfig()
  setStatus({ enabled: cfg.enabled, ok: true, polling: true, startedAt: new Date(startedAt).toISOString() })

  while (!stopped) {
    try {
      const updates = await tgApi('getUpdates', {
        offset,
        timeout: cfg.pollingTimeoutSeconds,
        allowed_updates: ['message']
      }, { timeoutMs: (cfg.pollingTimeoutSeconds + 10) * 1000 })

      for (const update of updates || []) {
        offset = Math.max(offset, Number(update.update_id || 0) + 1)
        try {
          await handleUpdate(update)
        } catch (e) {
          status.errors++
          setStatus({ ok: false, lastError: redactToken(e.message || e), errors: status.errors })
          const chatId = update.message?.chat?.id
          if (chatId) await sendMessage(chatId, `Telegram bridge error:\n${redactToken(e.message || e)}`).catch(() => null)
        }
      }
    } catch (e) {
      status.errors++
      setStatus({ ok: false, polling: true, lastError: redactToken(e.message || e), errors: status.errors })
      console.error('[telegram] polling error:', redactToken(e.message || e))
      await new Promise(resolve => setTimeout(resolve, cfg.retryDelayMs))
    }
  }

  setStatus({ polling: false })
}

export async function startTelegramBot () {
  const cfg = telegramConfig()
  startedAt = Date.now()

  process.on('SIGINT', () => { stopped = true })
  process.on('SIGTERM', () => { stopped = true })
  process.on('uncaughtException', err => {
    status.errors++
    setStatus({ ok: false, lastError: redactToken(err.message || err), errors: status.errors })
    console.error('[telegram] uncaughtException:', redactToken(err.stack || err.message || err))
  })
  process.on('unhandledRejection', reason => {
    status.errors++
    setStatus({ ok: false, lastError: redactToken(reason?.message || reason), errors: status.errors })
    console.error('[telegram] unhandledRejection:', redactToken(reason?.stack || reason?.message || reason))
  })

  if (!cfg.enabled) {
    setStatus({ enabled: false, ok: true, polling: false, lastError: '' })
    console.log('[telegram] disabled di config.ts')
    return
  }

  if (isTokenEmpty(cfg.token)) {
    setStatus({ enabled: true, ok: false, polling: false, lastError: 'Token Telegram kosong di config.ts' })
    console.error('[telegram] token kosong. Isi global.telegramBot.token di config.ts')
    return
  }

  console.log('[telegram] bridge starting...')
  const me = await tgApi('getMe', {}).catch(e => {
    setStatus({ enabled: true, ok: false, polling: false, lastError: redactToken(e.message || e) })
    throw e
  })

  setStatus({ enabled: true, ok: true, bot: me, polling: true })
  console.log(`[telegram] login sebagai @${me.username || me.first_name}`)

  if (cfg.notifyOnStart && cfg.ownerIds.length) {
    for (const id of cfg.ownerIds) {
      await sendMessage(id, `Telegram bridge aktif sebagai @${me.username || me.first_name}`).catch(() => null)
    }
  }

  await pollingLoop()
}

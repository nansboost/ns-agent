// @ts-nocheck
import fs from 'fs/promises'
import path from 'path'
import { resolveProjectFile, AGENT_PROVIDER_FILE, AGENT_SESSIONS_FILE } from './data-paths.ts'
import { listApiProviderModels, runApiCodeAgent } from './code-agent.ts'
import { appendAgentSession, clearAgentSession, getAgentSessionSummary, loadAgentHistory } from './session.ts'
import { getProviderKeyCursor, getProviderRuntimeSummary, isProviderCoolingDown, markProviderFailure, markProviderSuccess } from './provider-state.ts'
import { listAgentReports, saveAgentReport } from './reports.ts'
import { getAgentQueueStatus, withAgentQueue } from './queue.ts'

const DEFAULT_STATE_FILE = './lib/agent-data/agent-provider.json'

function routerConfig () {
  const cfg = global.agentRouter || {}
  return {
    enabled: cfg.enabled !== false,
    defaultProvider: cfg.defaultProvider || cfg.default || 'nvidia',
    stateFile: cfg.stateFile || DEFAULT_STATE_FILE,
    workspace: cfg.workspace || './',
    writeEnabled: cfg.writeEnabled !== false,
    maxWriteBytes: Number(cfg.maxWriteBytes || 200000),
    limits: cfg.limits || {},
    workspacePluginsDir: cfg.workspacePluginsDir || 'ws/plugins',
    workspaceProjectsDir: cfg.workspaceProjectsDir || 'ws/projects',
    workspaceSitesDir: cfg.workspaceSitesDir || cfg.workspaceProjectsDir || 'ws/projects',
    workspaceTmpDir: cfg.workspaceTmpDir || 'ws/tmp',
    webSearch: { enabled: true, maxResults: 8, minDelayMs: 1200, timeoutMs: 15000, ...(cfg.webSearch || {}) },
    sessionEnabled: cfg.sessionEnabled !== false,
    sessionFile: cfg.sessionFile || './lib/agent-data/agent-sessions.json',
    sessionMaxMessages: Number(cfg.sessionMaxMessages || 16),
    sessionMaxCharsPerMessage: Number(cfg.sessionMaxCharsPerMessage || 4000),
    providers: cfg.providers || {}
  }
}

function statePath () {
  const cfg = routerConfig()
  return resolveProjectFile(cfg.stateFile, DEFAULT_STATE_FILE)
}

async function readState () {
  try { return JSON.parse(await fs.readFile(statePath(), 'utf8')) } catch { return {} }
}

async function writeState (state) {
  const file = statePath()
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8')
  await fs.rename(tmp, file)
}

function normalizeProvider (name = '') {
  return String(name || '').trim().toLowerCase()
}

function providerKeys (provider = {}) {
  const items = [provider.apiKey, provider.key, provider.apiKeys, provider.keys].flat(Infinity)
  return [...new Set(items.map(x => String(x || '').trim()).filter(Boolean))]
}

function hasUsableProviderKey (provider = {}) {
  return providerKeys(provider).some(key => !/^(ISI_|YOUR_|PASTE_|xxxx|sk-xxx|ksk_xxxxx|nvapi-xxx)/i.test(key))
}

function keyCount (provider = {}) {
  return providerKeys(provider).filter(key => !/^(ISI_|YOUR_|PASTE_|xxxx|sk-xxx|ksk_xxxxx|nvapi-xxx)/i.test(key)).length
}

function isRetryableAgentError (error = {}) {
  if (error.retryable === true) return true
  const status = Number(error.status || error.response?.status || 0)
  if ([408, 409, 425, 429, 500, 502, 503, 504].includes(status)) return true
  const msg = String(error.message || error || '').toLowerCase()
  return /429|rate.?limit|too many requests|timeout|timed out|overload|temporar|unavailable|econnreset|etimedout|socket hang up|no body/.test(msg)
}

export function agentWorkspaceInfo () {
  const cfg = routerConfig()
  const root = path.resolve(process.cwd())
  const ws = path.resolve(root, cfg.workspace)
  return {
    projectRoot: root,
    workspace: ws,
    workspaceRel: path.relative(root, ws).replaceAll(path.sep, '/') || '.',
    writeEnabled: cfg.writeEnabled,
    maxWriteBytes: cfg.maxWriteBytes,
    limits: cfg.limits,
    workspacePluginsDir: cfg.workspacePluginsDir,
    workspaceProjectsDir: cfg.workspaceProjectsDir,
    workspaceSitesDir: cfg.workspaceSitesDir,
    workspaceTmpDir: cfg.workspaceTmpDir,
    webSearch: cfg.webSearch,
    sessionEnabled: cfg.sessionEnabled,
    sessionFile: cfg.sessionFile,
    sessionMaxMessages: cfg.sessionMaxMessages,
    sessionMaxCharsPerMessage: cfg.sessionMaxCharsPerMessage
  }
}

export function listAgentProviders () {
  const cfg = routerConfig()
  return Object.entries(cfg.providers).map(([id, p]) => ({
    id,
    name: p.name || id,
    type: p.type || 'openai-compatible',
    enabled: p.enabled !== false,
    model: p.model || '',
    hasKey: hasUsableProviderKey(p),
    keyCount: keyCount(p),
    baseURL: p.baseURL || p.baseUrl || '',
    retryAttempts: p.retryAttempts || p.maxRetryAttempts || p.maxRetries || '',
    fallbackModels: Array.isArray(p.fallbackModels) ? p.fallbackModels : [],
    note: p.note || '',
    models: Array.isArray(p.models) ? p.models : []
  }))
}

export async function getActiveProviderId () {
  const cfg = routerConfig()
  const state = await readState()
  const wanted = normalizeProvider(state.provider || cfg.defaultProvider || 'nvidia')
  if (cfg.providers[wanted]) return wanted

  const fallback = normalizeProvider(cfg.defaultProvider || 'nvidia')
  if (cfg.providers[fallback]) {
    state.provider = fallback
    await writeState(state).catch(() => {})
    return fallback
  }

  const first = Object.keys(cfg.providers)[0]
  if (first) {
    state.provider = first
    await writeState(state).catch(() => {})
    return first
  }

  return fallback
}

async function providerWithState (id, provider) {
  const state = await readState()
  const modelOverride = state.models?.[id]
  const keyCursor = await getProviderKeyCursor(id).catch(() => 0)
  return {
    ...provider,
    id,
    model: modelOverride || provider.model || '',
    _keyCursor: keyCursor
  }
}

export async function getActiveProvider () {
  const cfg = routerConfig()
  const id = await getActiveProviderId()
  const provider = cfg.providers[id]
  if (!provider) throw new Error(`Provider aktif '${id}' tidak ada di global.agentRouter.providers.`)
  if (provider.enabled === false) throw new Error(`Provider '${id}' masih disabled di config.ts.`)
  return { id, provider: await providerWithState(id, provider) }
}

export async function setActiveProvider (id) {
  const providerId = normalizeProvider(id)
  const cfg = routerConfig()
  if (!cfg.providers[providerId]) throw new Error(`Provider '${providerId}' tidak ditemukan di config.ts.`)
  if (cfg.providers[providerId].enabled === false) throw new Error(`Provider '${providerId}' masih disabled di config.ts.`)
  const state = await readState()
  state.provider = providerId
  await writeState(state)
  return { id: providerId, provider: await providerWithState(providerId, cfg.providers[providerId]) }
}

export async function setProviderModel (model, providerId = '') {
  const targetProviderId = normalizeProvider(providerId) || await getActiveProviderId()
  const cfg = routerConfig()
  if (!cfg.providers[targetProviderId]) throw new Error(`Provider '${targetProviderId}' tidak ditemukan di config.ts.`)
  const selected = String(model || '').trim()
  if (!selected) throw new Error('Nama model kosong.')
  const state = await readState()
  state.models = state.models || {}
  state.models[targetProviderId] = selected
  await writeState(state)
  return { id: targetProviderId, model: selected }
}

export function parseProviderPrefix (input = '') {
  const text = String(input || '').trim()
  const match = text.match(/^([a-z0-9_-]+)(?::([^\s]+))?\s+([\s\S]+)$/i)
  if (!match) return { input: text }

  const cfg = routerConfig()
  const providerId = normalizeProvider(match[1])
  if (!cfg.providers[providerId]) return { input: text }

  return {
    providerId,
    model: match[2] || '',
    input: match[3].trim()
  }
}


export async function agentSessionInfo (chatId = '') {
  return getAgentSessionSummary(chatId)
}

export async function clearAgentSessionForChat (chatId = '') {
  return clearAgentSession(chatId)
}

export async function agentRouterStatus () {
  const active = await getActiveProvider().catch(e => ({ error: e.message }))
  const providers = listAgentProviders()
  const runtime = await getProviderRuntimeSummary().catch(() => ({}))
  const reports = await listAgentReports(5).catch(() => [])
  return { active, providers, workspace: agentWorkspaceInfo(), runtime, reports, queue: getAgentQueueStatus() }
}

function configuredModelsForProvider (provider = {}) {
  const list = [provider.model, provider.models, provider.fallbackModels, provider.modelFallbacks].flat(Infinity)
  return [...new Set(list.map(x => String(x || '').trim()).filter(Boolean))]
}

export async function getProviderModels (providerId = '') {
  const cfg = routerConfig()
  const id = normalizeProvider(providerId) || await getActiveProviderId()
  const baseProvider = cfg.providers[id]
  if (!baseProvider) throw new Error(`Provider '${id}' tidak ditemukan di config.ts.`)

  const provider = await providerWithState(id, baseProvider)
  const type = provider.type || 'openai-compatible'
  const configured = configuredModelsForProvider(provider)

  if (baseProvider.enabled === false) {
    return {
      id,
      type,
      source: 'config/manual fallback',
      activeModel: provider.model || '',
      models: configured,
      note: `Provider '${id}' masih disabled di config.ts. Aktifkan enabled: true dan isi API key untuk ambil daftar live dari /v1/models.`
    }
  }

  try {
    const models = await listApiProviderModels({ ...provider, id }, { limit: Number(provider.modelListLimit || 120) })
    return {
      id,
      type,
      source: 'provider /v1/models',
      activeModel: provider.model || '',
      models: models.length ? models : configured,
      note: models.length ? '' : 'Endpoint /models kosong, fallback ke models di config.ts.'
    }
  } catch (e) {
    return {
      id,
      type,
      source: 'config/manual fallback',
      activeModel: provider.model || '',
      models: configured,
      error: e.message || String(e),
      note: 'Provider ini tidak mengizinkan list model, API key belum diisi, atau endpoint /models tidak kompatibel. Isi daftar manual di config.ts -> provider.models.'
    }
  }
}

export async function testProviderModel (providerIdOrModel = '', maybeModel = '') {
  const cfg = routerConfig()
  let providerId = ''
  let model = ''

  const raw = String(providerIdOrModel || '').trim()
  if (maybeModel) {
    providerId = normalizeProvider(raw)
    model = String(maybeModel).trim()
  } else if (raw.includes(':')) {
    const idx = raw.indexOf(':')
    providerId = normalizeProvider(raw.slice(0, idx))
    model = raw.slice(idx + 1).trim()
  } else {
    providerId = await getActiveProviderId()
    model = raw
  }

  if (!model) throw new Error('Model kosong.')
  const baseProvider = cfg.providers[providerId]
  if (!baseProvider) throw new Error(`Provider '${providerId}' tidak ditemukan.`)
  if (baseProvider.enabled === false) throw new Error(`Provider '${providerId}' masih disabled di config.ts.`)
  const provider = await providerWithState(providerId, baseProvider)
  provider.model = model
  const answer = await runApiCodeAgent({
        message: `Jangan pakai tool. Jawab persis satu baris saja: OK MODEL ${model}`,
        provider,
        providerName: providerId,
        mode: 'read'
      })

  return { providerId, model, ok: true, output: answer }
}

async function runUnifiedAgentNow ({ prompt, userName, userId, chatId, mode = 'read', providerId = '', model = '' }) {
  if (!prompt?.trim()) throw new Error('Prompt kosong.')
  const cfg = routerConfig()
  if (!cfg.enabled) throw new Error('global.agentRouter.enabled masih false di config.ts')

  const requestedProviderId = normalizeProvider(providerId)
  const primaryId = requestedProviderId || await getActiveProviderId()
  const fallbackIds = requestedProviderId || cfg.autoProviderFallback === false
    ? []
    : (Array.isArray(cfg.fallbackProviders) ? cfg.fallbackProviders : Object.keys(cfg.providers))
        .map(normalizeProvider)
        .filter(id => id && id !== primaryId && cfg.providers[id]?.enabled !== false && hasUsableProviderKey(cfg.providers[id]))

  const candidates = [primaryId, ...fallbackIds]
  let answer = ''
  let usedProviderId = primaryId
  let usedModel = model || ''
  const errors = []
  const skipped = []

  for (const id of candidates) {
    const baseProvider = cfg.providers[id]
    if (!baseProvider) {
      errors.push(`${id}: provider tidak ditemukan`)
      continue
    }
    if (baseProvider.enabled === false) {
      errors.push(`${id}: provider disabled`)
      continue
    }

    const cooldown = await isProviderCoolingDown(id).catch(() => ({ active: false }))
    if (cooldown.active && candidates.length > 1) {
      skipped.push(`${id}: cooldown sampai ${cooldown.untilIso || '-'}`)
      continue
    }

    const provider = await providerWithState(id, baseProvider)
    if (model && id === primaryId) provider.model = model

    const sessionHistory = cfg.sessionEnabled
      ? await loadAgentHistory(chatId, {
          maxMessages: cfg.sessionMaxMessages,
          maxCharsPerMessage: cfg.sessionMaxCharsPerMessage
        })
      : []

    try {
      answer = await runApiCodeAgent({
        message: prompt,
        provider,
        providerName: id,
        history: sessionHistory,
        userName,
        userId,
        chatId,
        mode,
        workspace: cfg.workspace,
        writeEnabled: cfg.writeEnabled,
        maxWriteBytes: cfg.maxWriteBytes,
        limits: cfg.limits,
        workspacePluginsDir: cfg.workspacePluginsDir,
        workspaceProjectsDir: cfg.workspaceProjectsDir,
        workspaceSitesDir: cfg.workspaceSitesDir,
        workspaceTmpDir: cfg.workspaceTmpDir,
        webSearch: cfg.webSearch
      })
      usedProviderId = id
      usedModel = provider.model || model || ''
      await markProviderSuccess(id).catch(() => {})
      if (id !== primaryId) {
        answer = `⚠️ Provider utama *${primaryId}* kena limit/error sementara, otomatis fallback ke *${id}*.

${answer}`
      }
      break
    } catch (e) {
      await markProviderFailure(id, e, provider).catch(() => {})
      errors.push(`${id}: ${e.message || e}`)
      const retryable = isRetryableAgentError(e)
      if (!retryable || id === candidates[candidates.length - 1]) {
        const err = new Error([...errors, ...skipped].join('\n'))
        err.retryable = retryable
        err.providerErrors = errors
        throw err
      }
    }
  }

  if (!answer) {
    const err = new Error([...errors, ...skipped].join('\n') || 'Tidak ada provider agent yang bisa dipakai.')
    err.providerErrors = errors
    throw err
  }

  await appendAgentSession({
    chatId,
    userId,
    userName,
    providerId: usedProviderId,
    model: usedModel,
    mode,
    userText: prompt,
    assistantText: answer
  }).catch(() => {})

  const report = await saveAgentReport({
    prompt,
    output: answer,
    providerId: usedProviderId,
    model: usedModel,
    mode,
    chatId,
    userId,
    userName,
    errors
  }).catch(() => null)

  if (report?.fileRel && answer.length < 23000) {
    answer += `\n\n📄 Report: ${report.fileRel}`
  }

  return answer
}


export async function runUnifiedAgent (args = {}) {
  const chatId = args.chatId || 'default-chat'
  const mode = args.mode || 'read'
  return withAgentQueue(`${chatId}:${mode}`, () => runUnifiedAgentNow(args))
}

export function formatProviders (providers = [], activeId = '') {
  return providers.map(p => {
    const mark = p.id === activeId ? '✅' : '•'
    const key = p.hasKey ? `key:${p.keyCount || 1}` : 'key:belum'
    const enabled = p.enabled ? 'on' : 'off'
    const retry = p.retryAttempts ? `, retry:${p.retryAttempts}` : ''
    return `${mark} ${p.id} (${p.type}) — ${enabled}, model: ${p.model || '-'}, ${key}${retry}`
  }).join('\n')
}

export function formatModelList ({ id, type, source, activeModel, models, error, note }) {
  const list = (models || []).length
    ? models.map((x, i) => `${i + 1}. ${x}${x === activeModel ? '  ✅ aktif' : ''}`).join('\n')
    : '- belum ada daftar model'

  return `*Models: ${id}*\nTipe: ${type}\nSumber: ${source}\nAktif: ${activeModel || '-'}\n\n${list}${error ? `\n\nError ambil model: ${error}` : ''}${note ? `\n\nCatatan: ${note}` : ''}`
}

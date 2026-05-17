// @ts-nocheck
import OpenAI from 'openai'
import fs from 'fs/promises'
import path from 'path'
import { braveSearch } from '../brave-search.ts'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import { buildAgentIndex, loadAgentContextBundle, readAgentIndexFile } from './indexer.ts'
import { backupFiles, listAgentBackups, readBackupManifest, rollbackAgentBackup } from './safety.ts'

const execAsync = promisify(execCb)

const PROJECT_ROOT = path.resolve(process.cwd())
const DEFAULT_LIMITS = {
  maxFileBytes: 1_000_000,
  maxToolOutputChars: 60_000,
  maxSearchResults: 120,
  maxAgentSteps: 30,
  maxReadLines: 500,
  maxWorkspaceFilesPerBatch: 40,
  maxWorkspaceBatchBytes: 20_000_000,
  maxReplyChars: 24_000
}

function limitsFromCtx (ctx = {}) {
  return { ...DEFAULT_LIMITS, ...(ctx.limits || {}) }
}

function limitNumber (ctx, key, fallback) {
  const n = Number(limitsFromCtx(ctx)[key])
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.ns-agent', 'sessions', 'session', 'tmp', 'temp', 'logs', '.cache', '.npm', '.pnpm-store', '.codex'
])

const BINARY_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp3', '.mp4', '.webm', '.ogg', '.wav', '.ttf', '.otf', '.zip', '.gz', '.tar', '.7z', '.rar', '.sqlite', '.db'
])

const SENSITIVE_PATTERNS = [
  /(^|[/\\])\.env(\..*)?$/i,
  /(^|[/\\])sessions?([/\\]|$)/i,
  /(^|[/\\])creds\.json$/i,
  /(^|[/\\])auth\.json$/i,
  /(^|[/\\])auth_info/i,
  /(^|[/\\])database\.json$/i,
  /(^|[/\\])config\.ts$/i,
  /(^|[/\\])lib[/\\]agent-data([/\\]|$)/i,
  /(^|[/\\])agent-(provider|sessions|tasks)\.json$/i,
  /(^|[/\\])ai-memory\.json$/i,
  /(^|[/\\])auto-heal-state\.json$/i,
  /(^|[/\\])\.owner-memory\.md$/i,
  /(^|[/\\])\.ns-agent([/\\]|$)/i,
  /(^|[/\\]).*\.(pem|key|p12|pfx)$/i,
  /(token|secret|apikey|api_key|credential|cookie|session)/i
]

const TEXT_EXTS = new Set([
  '.js', '.ts', '.mjs', '.cjs', '.json', '.md', '.txt', '.py', '.sh', '.bashrc', '.gitignore', '.env.example', '.yml', '.yaml', '.jsx', '.ts', '.tsx', '.css', '.html'
])

const providerQueues = new Map()
const providerCooldownUntil = new Map()

function sleep (ms = 0) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)))
}

function uniqueStrings (items = []) {
  const seen = new Set()
  const out = []
  for (const item of items.flat(Infinity)) {
    const value = String(item || '').trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

function isPlaceholderKey (value = '') {
  return !value || /^(ISI_|YOUR_|PASTE_|xxxx|sk-xxx|ksk_xxxxx|nvapi-xxx)/i.test(String(value).trim())
}

function providerApiKeys (provider = {}) {
  return uniqueStrings([provider.apiKey, provider.key, provider.apiKeys, provider.keys]).filter(key => !isPlaceholderKey(key))
}

function providerModels (provider = {}) {
  return uniqueStrings([
    provider.model,
    provider.fallbackModels,
    provider.modelFallbacks,
    provider.models
  ])
}

function providerQueueKey (provider = {}) {
  const baseURL = provider.baseURL || provider.baseUrl || 'default'
  return `${provider.id || provider.name || 'provider'}::${baseURL}`
}

function headerValue (headers, name) {
  if (!headers) return ''
  const key = String(name || '').toLowerCase()
  try {
    if (typeof headers.get === 'function') return headers.get(name) || headers.get(key) || ''
  } catch {}
  try {
    const raw = headers[name] ?? headers[key]
    return Array.isArray(raw) ? raw[0] : raw
  } catch {}
  return ''
}

function retryAfterMsFromError (error) {
  const raw = headerValue(error?.headers, 'retry-after') || headerValue(error?.response?.headers, 'retry-after')
  if (!raw) return 0
  const seconds = Number(raw)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const dateMs = Date.parse(raw)
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : 0
}

function statusFromError (error) {
  return Number(error?.status || error?.response?.status || error?.code || 0)
}

function isRetryableProviderError (error) {
  const status = statusFromError(error)
  if ([408, 409, 425, 429, 500, 502, 503, 504].includes(status)) return true
  const code = String(error?.code || error?.type || '').toLowerCase()
  if (/rate|timeout|temporar|overload|unavailable|econnreset|etimedout|socket|network/.test(code)) return true
  const msg = String(error?.message || error || '').toLowerCase()
  return /429|rate.?limit|too many requests|timeout|timed out|overload|temporar|unavailable|econnreset|etimedout|socket hang up|no body/.test(msg)
}

function retryDelayMs (error, attemptIndex, provider = {}) {
  const retryAfter = retryAfterMsFromError(error)
  if (retryAfter > 0) return Math.min(retryAfter, Number(provider.maxRetryAfterMs || 120000))
  const base = Number(provider.retryBaseDelayMs || 1500)
  const max = Number(provider.retryMaxDelayMs || 45000)
  const jitter = Math.floor(Math.random() * Number(provider.retryJitterMs || 750))
  return Math.min(max, base * Math.pow(2, Math.max(0, attemptIndex)) + jitter)
}

function makeProviderError (error, provider = {}, operation = 'request', attempts = 1) {
  const status = statusFromError(error)
  const retryable = isRetryableProviderError(error)
  const providerName = provider.name || provider.id || 'AI'
  const msg = String(error?.message || error || 'unknown error').replace(/(sk-|nvapi-)[A-Za-z0-9_\-]{12,}/g, '$1***')
  const label = status ? `${status} status code` : 'request error'
  const out = new Error(`${providerName} ${operation} gagal setelah ${attempts} percobaan: ${label}${msg ? ` (${msg})` : ''}`)
  out.status = status
  out.retryable = retryable
  out.providerName = providerName
  out.cause = error
  return out
}

function buildProviderAttempts (provider = {}) {
  const keys = providerApiKeys(provider)
  const models = providerModels(provider)
  if (!keys.length) throw new Error(`API key provider ${provider.name || provider.id || 'AI'} belum diisi di config.ts.`)
  if (!models.length) throw new Error(`Model provider ${provider.name || provider.id || 'AI'} belum diisi di config.ts.`)

  const combos = []
  const startKey = Math.max(0, Number(provider._keyCursor || 0))
  for (let i = 0; i < Math.max(keys.length, models.length); i++) {
    for (let j = 0; j < keys.length; j++) {
      const key = keys[(startKey + i + j) % keys.length]
      const model = models[i % models.length]
      combos.push({ apiKey: key, model })
    }
  }

  const unique = []
  const seen = new Set()
  for (const combo of combos) {
    const marker = `${combo.apiKey}::${combo.model}`
    if (seen.has(marker)) continue
    seen.add(marker)
    unique.push(combo)
  }

  const wanted = Number(provider.retryAttempts || provider.maxRetryAttempts || provider.maxRetries || 0)
  const limit = Number.isFinite(wanted) && wanted > 0 ? wanted : Math.min(6, Math.max(3, unique.length))
  return unique.slice(0, Math.max(1, Math.min(limit, unique.length)))
}

function providerClient (provider = {}) {
  const apiKey = provider.apiKey || provider.key
  const baseURL = provider.baseURL || provider.baseUrl
  const timeout = Number(provider.timeoutMs || provider.timeout || 0)
  const maxRetries = Number(provider.sdkMaxRetries ?? provider.openaiMaxRetries ?? 0)

  if (isPlaceholderKey(apiKey)) {
    throw new Error(`API key provider ${provider.name || provider.id || 'AI'} belum diisi di config.ts.`)
  }

  return new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    ...(timeout > 0 ? { timeout } : {}),
    maxRetries: Number.isFinite(maxRetries) && maxRetries >= 0 ? maxRetries : 0,
    ...(provider.defaultHeaders ? { defaultHeaders: provider.defaultHeaders } : {})
  })
}

async function withProviderQueue (provider = {}, fn) {
  const key = providerQueueKey(provider)
  const previous = providerQueues.get(key) || Promise.resolve()
  const run = previous.catch(() => {}).then(async () => {
    const until = Number(providerCooldownUntil.get(key) || 0)
    if (until > Date.now()) await sleep(until - Date.now())
    return fn(key)
  })
  providerQueues.set(key, run.catch(() => {}))
  return run
}

async function runProviderRequest (provider = {}, operation = 'request', action) {
  const attempts = buildProviderAttempts(provider)
  let lastError = null

  return withProviderQueue(provider, async (queueKey) => {
    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i]
      const attemptProvider = { ...provider, apiKey: attempt.apiKey, key: attempt.apiKey, model: attempt.model }
      try {
        const client = providerClient(attemptProvider)
        return await action(client, attemptProvider, i)
      } catch (error) {
        lastError = error
        const retryable = isRetryableProviderError(error)
        if (!retryable || i >= attempts.length - 1) break
        const delay = retryDelayMs(error, i, provider)
        providerCooldownUntil.set(queueKey, Date.now() + delay)
        await sleep(delay)
      }
    }

    throw makeProviderError(lastError, provider, operation, attempts.length)
  })
}

function cleanJson (value, maxChars = DEFAULT_LIMITS.maxToolOutputChars) {
  return JSON.stringify(value, null, 2).slice(0, maxChars)
}

function normalizeRel (input = '.') {
  let rel = String(input || '.').replace(/^[/\\]+/, '')
  rel = rel.replace(/\0/g, '')
  return rel || '.'
}

function isPathInside (parent, child) {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function resolveSafe (input = '.') {
  const rel = normalizeRel(input)
  const full = path.resolve(PROJECT_ROOT, rel)
  if (!isPathInside(PROJECT_ROOT, full)) {
    throw new Error('Path keluar dari root project tidak diizinkan.')
  }
  return { rel, full }
}

function workspaceRoot (workspace = './') {
  const full = path.resolve(PROJECT_ROOT, workspace || './')
  if (!isPathInside(PROJECT_ROOT, full)) throw new Error('Root tulis keluar dari root project tidak diizinkan.')
  return full
}

function resolveWorkspaceSafe (input = '.', workspace = './') {
  const wsRoot = workspaceRoot(workspace)
  const wsName = path.basename(wsRoot)
  let rel = normalizeRel(input).replaceAll('\\', '/')
  if (rel === wsName) rel = '.'
  if (rel.startsWith(wsName + '/')) rel = rel.slice(wsName.length + 1)
  const full = path.resolve(wsRoot, rel)
  if (!isPathInside(wsRoot, full)) throw new Error('Path keluar dari root tulis tidak diizinkan.')
  return { rel: rel || '.', full, wsRoot, wsName }
}

function toProjectRel (full) {
  return path.relative(PROJECT_ROOT, full).replaceAll(path.sep, '/') || '.'
}

function isSensitive (relPath) {
  return SENSITIVE_PATTERNS.some(re => re.test(relPath))
}

function isProbablyText (relPath) {
  const ext = path.extname(relPath).toLowerCase()
  if (BINARY_EXTS.has(ext)) return false
  if (TEXT_EXTS.has(ext)) return true
  if (!ext) return true
  return false
}

async function safeStat (full) {
  try { return await fs.stat(full) } catch { return null }
}

async function ensureWorkspace (workspace = './', ctx = {}) {
  const wsRoot = workspaceRoot(workspace)
  const dirs = [
    ctx.workspacePluginsDir || 'ws/plugins',
    ctx.workspaceProjectsDir || 'ws/projects',
    ctx.workspaceSitesDir || ctx.workspaceProjectsDir || 'ws/projects',
    ctx.workspaceTmpDir || 'ws/tmp'
  ].filter(Boolean)

  for (const dir of dirs) {
    const { full } = resolveWorkspaceSafe(dir, workspace)
    await fs.mkdir(full, { recursive: true })
  }

  return wsRoot
}

async function walk (dirFull, dirRel, options, out) {
  const depth = options.depth ?? 3
  if (dirRel !== '.' && dirRel.split(path.sep).length > depth) return

  let entries = []
  try {
    entries = await fs.readdir(dirFull, { withFileTypes: true })
  } catch (e) {
    out.push(`${dirRel}/  [tidak bisa dibaca: ${e.message}]`)
    return
  }

  entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))

  for (const ent of entries) {
    const childRel = dirRel === '.' ? ent.name : path.join(dirRel, ent.name)
    const normalized = childRel.replaceAll(path.sep, '/')
    if (normalized.startsWith('.ns-agent/backups')) {
      out.push(`${normalized}/  [diabaikan]`)
      continue
    }

    if (ent.isDirectory()) {
      if (IGNORED_DIRS.has(ent.name)) {
        out.push(`${normalized}/  [diabaikan]`)
        continue
      }
      out.push(`${normalized}/`)
      await walk(path.join(dirFull, ent.name), childRel, options, out)
    } else {
      const stat = await safeStat(path.join(dirFull, ent.name))
      const size = stat ? ` ${stat.size}B` : ''
      const note = isSensitive(normalized) ? ' [sensitif: raw diblokir]' : (!isProbablyText(normalized) ? ' [binary/media]' : '')
      out.push(`${normalized}${size}${note}`)
    }
  }
}

async function toolTree (args = {}) {
  const { rel, full } = resolveSafe(args.dir || '.')
  const stat = await safeStat(full)
  if (!stat) throw new Error('Folder/file tidak ditemukan.')
  const out = [`. project root: ${PROJECT_ROOT}`]

  if (stat.isFile()) return { path: rel, type: 'file' }
  await walk(full, rel, { depth: Math.min(Number(args.depth || 3), 6) }, out)
  return { tree: out.slice(0, 500).join('\n') }
}

async function toolReadFile (args = {}, ctx = {}) {
  const filePath = args.path || args.file
  if (!filePath) throw new Error('Parameter path wajib diisi.')
  const { rel, full } = resolveSafe(filePath)
  const normalized = rel.replaceAll(path.sep, '/')

  if (isSensitive(normalized)) {
    throw new Error('File ini diblokir karena berpotensi berisi session/API key/database privat. Pakai tool database_summary untuk database.json.')
  }
  if (!isProbablyText(normalized)) throw new Error('File terlihat binary/media, tidak dibaca sebagai teks.')

  const stat = await safeStat(full)
  if (!stat || !stat.isFile()) throw new Error('File tidak ditemukan atau bukan file.')
  if (stat.size > limitNumber(ctx, 'maxFileBytes', DEFAULT_LIMITS.maxFileBytes)) throw new Error(`File terlalu besar (${stat.size} bytes). Pakai search_code atau baca bagian tertentu setelah file diperkecil.`)

  const raw = await fs.readFile(full, 'utf8')
  const lines = raw.split(/\r?\n/)
  const start = Math.max(Number(args.start || 1), 1)
  const limit = Math.min(Number(args.lines || 200), limitNumber(ctx, 'maxReadLines', DEFAULT_LIMITS.maxReadLines))
  const selected = lines.slice(start - 1, start - 1 + limit)

  return {
    path: normalized,
    total_lines: lines.length,
    shown: `${start}-${start + selected.length - 1}`,
    content: selected.map((line, i) => `${start + i}: ${line}`).join('\n')
  }
}

async function collectFiles (dirFull, dirRel, files, maxFiles = 1000) {
  if (files.length >= maxFiles) return
  let entries = []
  try { entries = await fs.readdir(dirFull, { withFileTypes: true }) } catch { return }

  for (const ent of entries) {
    if (files.length >= maxFiles) return
    const rel = dirRel === '.' ? ent.name : path.join(dirRel, ent.name)
    const normalized = rel.replaceAll(path.sep, '/')
    const full = path.join(dirFull, ent.name)

    if (ent.isDirectory()) {
      if (!IGNORED_DIRS.has(ent.name)) await collectFiles(full, rel, files, maxFiles)
    } else if (!isSensitive(normalized) && isProbablyText(normalized)) {
      files.push({ rel: normalized, full })
    }
  }
}

async function toolSearchCode (args = {}, ctx = {}) {
  const query = String(args.query || '').trim()
  if (!query) throw new Error('Parameter query wajib diisi.')
  const { full } = resolveSafe(args.dir || '.')
  const maxLimit = limitNumber(ctx, 'maxSearchResults', DEFAULT_LIMITS.maxSearchResults)
  const max = Math.min(Number(args.max || maxLimit), maxLimit)
  const files = []
  await collectFiles(full, args.dir || '.', files)

  const results = []
  const q = query.toLowerCase()

  for (const file of files) {
    if (results.length >= max) break
    const stat = await safeStat(file.full)
    if (!stat || stat.size > limitNumber(ctx, 'maxFileBytes', DEFAULT_LIMITS.maxFileBytes)) continue
    let raw = ''
    try { raw = await fs.readFile(file.full, 'utf8') } catch { continue }
    const lines = raw.split(/\r?\n/)

    lines.forEach((line, idx) => {
      if (results.length >= max) return
      if (line.toLowerCase().includes(q)) {
        results.push({ path: file.rel, line: idx + 1, text: line.slice(0, 240) })
      }
    })
  }

  return { query, count: results.length, results }
}

async function toolWebSearch (args = {}, ctx = {}) {
  const cfg = ctx.webSearch || {}
  if (cfg.enabled === false) throw new Error('Web search agent masih disabled di config.ts.')

  const query = String(args.query || args.q || '').trim()
  if (!query) throw new Error('Parameter query wajib diisi.')

  const maxCfg = Number(cfg.maxResults || 8)
  const count = Math.max(1, Math.min(Number(args.count || args.limit || maxCfg), Math.min(maxCfg || 8, 20)))
  const offset = Math.max(0, Math.min(Number(args.offset || 0), 100))
  const minDelayMs = Number(cfg.minDelayMs || 1200)
  const timeoutMs = Number(cfg.timeoutMs || 15000)

  const result = await braveSearch(query, { count, offset, minDelayMs, timeoutMs })
  return {
    ...result,
    note: 'Hasil berasal dari scraping HTML Brave Search. Bisa kosong/terbatas jika Brave mengubah HTML atau membatasi request.'
  }
}

async function toolProjectInfo () {
  const pkgPath = path.join(PROJECT_ROOT, 'package.json')
  const pkgRaw = await fs.readFile(pkgPath, 'utf8')
  const pkg = JSON.parse(pkgRaw)
  return {
    name: pkg.name,
    version: pkg.version,
    type: pkg.type,
    main: pkg.main,
    scripts: pkg.scripts,
    dependencies: Object.keys(pkg.dependencies || {}).sort(),
    optionalDependencies: Object.keys(pkg.optionalDependencies || {}).sort(),
    plugin_count: global.plugins ? Object.keys(global.plugins).length : null
  }
}

async function toolListPlugins (args = {}) {
  const names = Object.keys(global.plugins || {}).sort()
  const filter = String(args.filter || '').toLowerCase()
  const selected = filter ? names.filter(n => n.toLowerCase().includes(filter)) : names
  return { count: selected.length, plugins: selected.slice(0, 180) }
}

async function toolDatabaseSummary () {
  const dbPath = path.join(PROJECT_ROOT, 'database.json')
  const raw = await fs.readFile(dbPath, 'utf8')
  const db = JSON.parse(raw || '{}')
  const summary = {}

  for (const [key, value] of Object.entries(db)) {
    if (Array.isArray(value)) summary[key] = { type: 'array', count: value.length }
    else if (value && typeof value === 'object') summary[key] = { type: 'object', count: Object.keys(value).length }
    else summary[key] = { type: typeof value }
  }

  return summary
}

async function toolWorkspaceInfo (args = {}, ctx = {}) {
  const wsRoot = await ensureWorkspace(ctx.workspace, ctx)
  return {
    projectRoot: PROJECT_ROOT,
    workspace: toProjectRel(wsRoot),
    writeEnabled: Boolean(ctx.writeEnabled),
    maxWriteBytes: ctx.maxWriteBytes,
    rules: [
      'Baca file project utama boleh lewat read_file/search_code/tree.',
      'Agent boleh menulis di seluruh root project jika owner meminta.',
      `Default plugin baru: ${ctx.workspacePluginsDir || 'ws/plugins'}/`,
      `Default project/website baru: ${ctx.workspaceProjectsDir || 'ws/projects'}/`,
      'Untuk tugas besar, agent bisa menulis banyak file sekaligus memakai write_workspace_files.'
    ],
    limits: limitsFromCtx(ctx)
  }
}


async function toolReadProjectContext (args = {}, ctx = {}) {
  const content = await loadAgentContextBundle({ maxChars: Number(args.maxChars || 30000) })
  return { content }
}

async function toolBuildAgentIndex (args = {}, ctx = {}) {
  return buildAgentIndex()
}

async function toolPluginIndex (args = {}, ctx = {}) {
  let data
  try { data = await readAgentIndexFile('plugin-index.json') } catch { data = await buildAgentIndex().then(() => readAgentIndexFile('plugin-index.json')) }
  const filter = String(args.filter || '').toLowerCase()
  const plugins = Array.isArray(data.plugins) ? data.plugins : []
  const selected = filter
    ? plugins.filter(p => JSON.stringify(p).toLowerCase().includes(filter))
    : plugins
  return { generatedAt: data.generatedAt, count: selected.length, plugins: selected.slice(0, Number(args.limit || 120)) }
}

async function toolProjectIndex (args = {}, ctx = {}) {
  try { return await readAgentIndexFile('project-index.json') } catch { await buildAgentIndex(); return readAgentIndexFile('project-index.json') }
}

async function toolListBackups (args = {}, ctx = {}) {
  return { backups: await listAgentBackups(Number(args.limit || 20)) }
}

async function toolReadBackup (args = {}, ctx = {}) {
  const id = args.id || args.backupId
  if (!id) throw new Error('Parameter id wajib diisi.')
  return readBackupManifest(id)
}

async function toolRollbackBackup (args = {}, ctx = {}) {
  requireWrite(ctx)
  const id = args.id || args.backupId
  if (!id) throw new Error('Parameter id wajib diisi.')
  return rollbackAgentBackup(id)
}

function commandAllowed (cmd = '') {
  const value = String(cmd || '').trim()
  const allowed = [
    /^npm run (check|agent:index)$/,
    /^npx tsc --noEmit$/,
    /^npx tsx scripts\/build-agent-index\.ts$/,
    /^git status --short$/,
    /^git diff( -- [A-Za-z0-9_./@+-]+)?$/,
    /^node --check [A-Za-z0-9_./@+-]+\.(js|mjs|cjs)$/,
    /^ls( -la|-l|-a)?( [A-Za-z0-9_./@+-]+)?$/
  ]
  return allowed.some(re => re.test(value))
}

async function toolRunCommand (args = {}, ctx = {}) {
  const command = String(args.command || args.cmd || '').trim()
  if (!command) throw new Error('Parameter command wajib diisi.')
  if (!commandAllowed(command)) {
    throw new Error('Command tidak ada di allowlist. Command aman: npm run check, npm run agent:index, npx tsc --noEmit, npx tsx scripts/build-agent-index.ts, git status --short, git diff, node --check <file.js>, ls.')
  }
  const timeout = Math.min(Math.max(Number(args.timeoutMs || 30000), 1000), 60000)
  const { stdout, stderr } = await execAsync(command, {
    cwd: PROJECT_ROOT,
    timeout,
    maxBuffer: 1024 * 1024 * 3,
    shell: '/bin/bash'
  })
  const max = limitNumber(ctx, 'maxToolOutputChars', DEFAULT_LIMITS.maxToolOutputChars)
  return {
    command,
    stdout: String(stdout || '').slice(0, max),
    stderr: String(stderr || '').slice(0, max)
  }
}

async function toolListWorkspace (args = {}, ctx = {}) {
  const wsRoot = await ensureWorkspace(ctx.workspace, ctx)
  const out = [`workspace: ${toProjectRel(wsRoot)}/`]
  await walk(wsRoot, '.', { depth: Math.min(Number(args.depth || 4), 6) }, out)
  return { tree: out.slice(0, 500).join('\n') }
}

async function toolReadWorkspaceFile (args = {}, ctx = {}) {
  const filePath = args.path || args.file
  if (!filePath) throw new Error('Parameter path wajib diisi.')
  await ensureWorkspace(ctx.workspace, ctx)
  const { rel, full } = resolveWorkspaceSafe(filePath, ctx.workspace)
  const projectRel = toProjectRel(full)

  if (isSensitive(projectRel)) throw new Error('File workspace ini diblokir karena namanya sensitif.')
  if (!isProbablyText(projectRel)) throw new Error('File terlihat binary/media, tidak dibaca sebagai teks.')

  const stat = await safeStat(full)
  if (!stat || !stat.isFile()) throw new Error('File tidak ditemukan atau bukan file.')
  if (stat.size > limitNumber(ctx, 'maxFileBytes', DEFAULT_LIMITS.maxFileBytes)) throw new Error(`File terlalu besar (${stat.size} bytes).`)

  const raw = await fs.readFile(full, 'utf8')
  const lines = raw.split(/\r?\n/)
  const start = Math.max(Number(args.start || 1), 1)
  const limit = Math.min(Number(args.lines || 250), limitNumber(ctx, 'maxReadLines', DEFAULT_LIMITS.maxReadLines))
  const selected = lines.slice(start - 1, start - 1 + limit)
  return { path: toProjectRel(full), rel, total_lines: lines.length, shown: `${start}-${start + selected.length - 1}`, content: selected.map((line, i) => `${start + i}: ${line}`).join('\n') }
}

function requireWrite (ctx = {}) {
  if (!ctx.writeEnabled) throw new Error('Write mode belum diaktifkan di config.ts.')
}

function validateWorkspaceTextPath (full, projectRel) {
  if (isSensitive(projectRel)) throw new Error(`Nama file terlihat sensitif, write diblokir: ${projectRel}`)
  if (!isProbablyText(projectRel)) throw new Error(`Write hanya untuk file teks/kode: ${projectRel}`)
}

async function toolMakeWorkspaceDirs (args = {}, ctx = {}) {
  requireWrite(ctx)
  await ensureWorkspace(ctx.workspace, ctx)
  const dirs = Array.isArray(args.dirs) ? args.dirs : [args.dir || args.path].filter(Boolean)
  if (!dirs.length) throw new Error('Parameter dirs/dir wajib diisi.')
  const made = []
  for (const dir of dirs.slice(0, 80)) {
    const { full } = resolveWorkspaceSafe(String(dir || '.'), ctx.workspace)
    await fs.mkdir(full, { recursive: true })
    made.push(toProjectRel(full))
  }
  return { ok: true, count: made.length, dirs: made }
}

async function toolWriteWorkspaceFiles (args = {}, ctx = {}) {
  requireWrite(ctx)
  await ensureWorkspace(ctx.workspace, ctx)
  const files = Array.isArray(args.files) ? args.files : []
  if (!files.length) throw new Error('Parameter files wajib berisi array file.')

  const maxFiles = limitNumber(ctx, 'maxWorkspaceFilesPerBatch', DEFAULT_LIMITS.maxWorkspaceFilesPerBatch)
  const maxBatchBytes = limitNumber(ctx, 'maxWorkspaceBatchBytes', ctx.maxWriteBytes || DEFAULT_LIMITS.maxWorkspaceBatchBytes)
  if (files.length > maxFiles) throw new Error(`Terlalu banyak file dalam satu batch (${files.length}/${maxFiles}). Pecah jadi beberapa batch.`)

  let totalBytes = 0
  const normalized = []
  for (const file of files) {
    const filePath = file?.path || file?.file
    const content = String(file?.content ?? '')
    if (!filePath) throw new Error('Setiap file wajib punya path.')
    const { full } = resolveWorkspaceSafe(filePath, ctx.workspace)
    const projectRel = toProjectRel(full)
    validateWorkspaceTextPath(full, projectRel)
    const bytes = Buffer.byteLength(content, 'utf8')
    totalBytes += bytes
    if (bytes > Number(ctx.maxWriteBytes || DEFAULT_LIMITS.maxWorkspaceBatchBytes)) throw new Error(`File terlalu besar: ${projectRel}`)
    normalized.push({ full, projectRel, content, bytes, overwrite: file.overwrite })
  }

  if (totalBytes > maxBatchBytes) throw new Error(`Total batch terlalu besar (${totalBytes}/${maxBatchBytes} bytes). Pecah jadi beberapa batch atau append per file.`)

  const backup = await backupFiles(normalized.map(file => file.projectRel), { reason: 'write_workspace_files', actor: 'api-code-agent' })

  const written = []
  for (const file of normalized) {
    const exists = await safeStat(file.full)
    if (exists && file.overwrite === false) throw new Error(`File sudah ada dan overwrite=false: ${file.projectRel}`)
    await fs.mkdir(path.dirname(file.full), { recursive: true })
    await fs.writeFile(file.full, file.content, 'utf8')
    written.push({ path: file.projectRel, bytes: file.bytes })
  }

  return { ok: true, backup, count: written.length, total_bytes: totalBytes, files: written }
}

async function toolWriteWorkspaceFile (args = {}, ctx = {}) {
  requireWrite(ctx)
  const filePath = args.path || args.file
  const content = String(args.content ?? '')
  if (!filePath) throw new Error('Parameter path wajib diisi.')
  if (Buffer.byteLength(content, 'utf8') > Number(ctx.maxWriteBytes || 200000)) throw new Error('Content terlalu besar untuk ditulis.')
  await ensureWorkspace(ctx.workspace, ctx)
  const { full } = resolveWorkspaceSafe(filePath, ctx.workspace)
  const projectRel = toProjectRel(full)

  validateWorkspaceTextPath(full, projectRel)

  const exists = await safeStat(full)
  if (exists && args.overwrite === false) throw new Error('File sudah ada dan overwrite=false.')
  const backup = await backupFiles([projectRel], { reason: 'write_workspace_file', actor: 'api-code-agent' })
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, content, 'utf8')
  return { ok: true, backup, path: projectRel, bytes: Buffer.byteLength(content, 'utf8') }
}

async function toolAppendWorkspaceFile (args = {}, ctx = {}) {
  requireWrite(ctx)
  const filePath = args.path || args.file
  const content = String(args.content ?? '')
  if (!filePath) throw new Error('Parameter path wajib diisi.')
  if (Buffer.byteLength(content, 'utf8') > Number(ctx.maxWriteBytes || 200000)) throw new Error('Content terlalu besar untuk append.')
  await ensureWorkspace(ctx.workspace, ctx)
  const { full } = resolveWorkspaceSafe(filePath, ctx.workspace)
  const projectRel = toProjectRel(full)

  validateWorkspaceTextPath(full, projectRel)

  const backup = await backupFiles([projectRel], { reason: 'append_workspace_file', actor: 'api-code-agent' })
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.appendFile(full, content, 'utf8')
  return { ok: true, backup, path: projectRel, appended_bytes: Buffer.byteLength(content, 'utf8') }
}

async function toolReplaceWorkspaceFile (args = {}, ctx = {}) {
  requireWrite(ctx)
  const filePath = args.path || args.file
  const search = String(args.search ?? '')
  const replacement = String(args.replace ?? args.replacement ?? '')
  if (!filePath) throw new Error('Parameter path wajib diisi.')
  if (!search) throw new Error('Parameter search wajib diisi.')
  await ensureWorkspace(ctx.workspace, ctx)
  const { full } = resolveWorkspaceSafe(filePath, ctx.workspace)
  const projectRel = toProjectRel(full)

  validateWorkspaceTextPath(full, projectRel)

  const stat = await safeStat(full)
  if (!stat || !stat.isFile()) throw new Error('File tidak ditemukan atau bukan file.')
  if (stat.size > limitNumber(ctx, 'maxFileBytes', DEFAULT_LIMITS.maxFileBytes)) throw new Error('File terlalu besar untuk replace.')
  let raw = await fs.readFile(full, 'utf8')
  const before = raw
  raw = args.all === true || args.replaceAll === true ? raw.split(search).join(replacement) : raw.replace(search, replacement)
  if (raw === before) throw new Error('Teks search tidak ditemukan.')
  if (Buffer.byteLength(raw, 'utf8') > Number(ctx.maxWriteBytes || 200000)) throw new Error('Hasil replace terlalu besar.')
  const backup = await backupFiles([projectRel], { reason: 'replace_workspace_file', actor: 'api-code-agent' })
  await fs.writeFile(full, raw, 'utf8')
  return { ok: true, backup, path: projectRel, changed: true }
}


async function toolPatchWorkspaceFile (args = {}, ctx = {}) {
  requireWrite(ctx)
  const filePath = args.path || args.file
  if (!filePath) throw new Error('Parameter path wajib diisi.')
  await ensureWorkspace(ctx.workspace, ctx)
  const { full } = resolveWorkspaceSafe(filePath, ctx.workspace)
  const projectRel = toProjectRel(full)
  validateWorkspaceTextPath(full, projectRel)

  const stat = await safeStat(full)
  if (!stat || !stat.isFile()) throw new Error('File tidak ditemukan atau bukan file.')
  if (stat.size > limitNumber(ctx, 'maxFileBytes', DEFAULT_LIMITS.maxFileBytes)) throw new Error('File terlalu besar untuk patch.')

  let raw = await fs.readFile(full, 'utf8')
  const before = raw
  const patches = Array.isArray(args.patches) ? args.patches : [{ search: args.search, replace: args.replace ?? args.replacement, replaceAll: args.replaceAll ?? args.all }]
  const applied = []

  for (const item of patches) {
    const search = String(item?.search ?? '')
    const replacement = String(item?.replace ?? item?.replacement ?? '')
    if (!search) throw new Error('Setiap patch wajib punya search.')
    const old = raw
    raw = item?.all === true || item?.replaceAll === true ? raw.split(search).join(replacement) : raw.replace(search, replacement)
    if (raw === old) throw new Error(`Patch gagal, teks tidak ditemukan: ${search.slice(0, 120)}`)
    applied.push({ searchPreview: search.slice(0, 80), replaceBytes: Buffer.byteLength(replacement, 'utf8') })
  }

  if (raw === before) throw new Error('Tidak ada perubahan patch.')
  if (Buffer.byteLength(raw, 'utf8') > Number(ctx.maxWriteBytes || 200000)) throw new Error('Hasil patch terlalu besar.')
  const backup = await backupFiles([projectRel], { reason: 'patch_workspace_file', actor: 'api-code-agent' })
  await fs.writeFile(full, raw, 'utf8')
  return { ok: true, backup, path: projectRel, patches: applied.length, applied }
}

const readToolMap = {
  project_info: toolProjectInfo,
  tree: toolTree,
  read_file: toolReadFile,
  search_code: toolSearchCode,
  list_plugins: toolListPlugins,
  database_summary: toolDatabaseSummary,
  workspace_info: toolWorkspaceInfo,
  list_workspace: toolListWorkspace,
  read_workspace_file: toolReadWorkspaceFile,
  read_project_context: toolReadProjectContext,
  build_agent_index: toolBuildAgentIndex,
  plugin_index: toolPluginIndex,
  project_index: toolProjectIndex,
  list_backups: toolListBackups,
  read_backup: toolReadBackup,
  run_command: toolRunCommand,
  web_search: toolWebSearch
}

const writeToolMap = {
  make_workspace_dirs: toolMakeWorkspaceDirs,
  write_workspace_file: toolWriteWorkspaceFile,
  write_workspace_files: toolWriteWorkspaceFiles,
  append_workspace_file: toolAppendWorkspaceFile,
  replace_workspace_file: toolReplaceWorkspaceFile,
  patch_workspace_file: toolPatchWorkspaceFile,
  rollback_backup: toolRollbackBackup
}

const baseTools = [
  { type: 'function', function: { name: 'project_info', description: 'Baca ringkasan package.json, dependency, dan jumlah plugin bot.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'tree', description: 'Lihat struktur file/folder project. Aman: melewati session, node_modules, dan file sensitif.', parameters: { type: 'object', properties: { dir: { type: 'string', description: 'Folder relatif dari root project, contoh: ., plugins, lib' }, depth: { type: 'number', description: 'Kedalaman tree, maksimal 6' } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'read_file', description: 'Baca isi file teks/kode tertentu dengan nomor baris. File sensitif dan media diblokir.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Path file relatif dari root project' }, start: { type: 'number', description: 'Baris awal, default 1' }, lines: { type: 'number', description: 'Jumlah baris, default 200, maksimal sesuai config maxReadLines' } }, required: ['path'], additionalProperties: false } } },
  { type: 'function', function: { name: 'search_code', description: 'Cari teks di semua file kode/text project, seperti grep sederhana.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Teks yang dicari' }, dir: { type: 'string', description: 'Folder relatif, default .' }, max: { type: 'number', description: 'Maksimum hasil, default sesuai config maxSearchResults' } }, required: ['query'], additionalProperties: false } } },
  { type: 'function', function: { name: 'web_search', description: 'Cari informasi di internet memakai Brave Search HTML scraper. Pakai saat user meminta info terbaru, dokumentasi, error dari internet, berita teknis, atau referensi eksternal. Bukan API resmi Brave dan hasil bisa terbatas.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Query pencarian web' }, count: { type: 'number', description: 'Jumlah hasil, default 8, maksimal sesuai config webSearch.maxResults' }, offset: { type: 'number', description: 'Offset hasil Brave, opsional' } }, required: ['query'], additionalProperties: false } } },
  { type: 'function', function: { name: 'list_plugins', description: 'Lihat daftar plugin yang sedang dimuat global.plugins.', parameters: { type: 'object', properties: { filter: { type: 'string', description: 'Filter nama plugin, opsional' } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'database_summary', description: 'Baca ringkasan aman database.json tanpa membocorkan data user mentah.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'workspace_info', description: 'Lihat info root project dan folder ws default untuk output agent.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'list_workspace', description: 'Lihat isi root project yang bisa dibaca/ditulis agent.', parameters: { type: 'object', properties: { depth: { type: 'number', description: 'Kedalaman tree, maksimal 6' } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'read_workspace_file', description: 'Baca file teks/kode di root project/ws.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Path relatif di root proyek, contoh plugins/foo.ts' }, start: { type: 'number' }, lines: { type: 'number' } }, required: ['path'], additionalProperties: false } } },
  { type: 'function', function: { name: 'read_project_context', description: 'Baca gabungan AGENTS.md, NS_AGENT.md, owner memory, AGENTS folder, dan index project/plugin agar agent memahami struktur dan preferensi owner.', parameters: { type: 'object', properties: { maxChars: { type: 'number' } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'build_agent_index', description: 'Bangun ulang .ns-agent/context/project-index dan plugin-index setelah struktur/plugin berubah.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'plugin_index', description: 'Lihat index plugin hasil scan, termasuk path, command, tags, owner/group/private flags. Bisa difilter.', parameters: { type: 'object', properties: { filter: { type: 'string' }, limit: { type: 'number' } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'project_index', description: 'Lihat index struktur project, konvensi folder, dan file penting.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'list_backups', description: 'Lihat backup otomatis yang dibuat sebelum agent mengubah file.', parameters: { type: 'object', properties: { limit: { type: 'number' } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'read_backup', description: 'Baca manifest backup otomatis berdasarkan id.', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false } } },
  { type: 'function', function: { name: 'run_command', description: 'Jalankan command validasi yang aman dan terbatas, seperti npm run check atau npm run agent:index.', parameters: { type: 'object', properties: { command: { type: 'string' }, timeoutMs: { type: 'number' } }, required: ['command'], additionalProperties: false } } }
]

const writeTools = [
  { type: 'function', function: { name: 'make_workspace_dirs', description: 'Buat satu atau banyak folder di root project/ws sesuai instruksi owner.', parameters: { type: 'object', properties: { dirs: { type: 'array', items: { type: 'string' }, description: 'Daftar folder relatif di root proyek, contoh ["ws/plugins/helpers", "ws/tmp/build"]' }, dir: { type: 'string' } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'write_workspace_files', description: 'Tulis banyak file sekaligus di root project/ws sesuai instruksi owner.', parameters: { type: 'object', properties: { files: { type: 'array', items: { type: 'object', properties: { path: { type: 'string', description: 'Path relatif di root proyek, contoh ws/plugins/main-ping.ts atau lib/helper.ts' }, content: { type: 'string', description: 'Isi lengkap file' }, overwrite: { type: 'boolean' } }, required: ['path', 'content'], additionalProperties: false } } }, required: ['files'], additionalProperties: false } } },
  { type: 'function', function: { name: 'write_workspace_file', description: 'Tulis/buat satu file teks/kode di root project/ws. Untuk plugin baru, default ke ws/plugins/nama-plugin.ts.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Path relatif di root proyek, contoh ws/plugins/main-ping-test.ts atau lib/helper.ts' }, content: { type: 'string', description: 'Isi lengkap file' }, overwrite: { type: 'boolean', description: 'false untuk menolak menimpa file yang sudah ada' } }, required: ['path', 'content'], additionalProperties: false } } },
  { type: 'function', function: { name: 'append_workspace_file', description: 'Tambahkan teks ke file di root project/ws. Pakai ini kalau file terlalu panjang untuk sekali tulis.', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'], additionalProperties: false } } },
  { type: 'function', function: { name: 'replace_workspace_file', description: 'Replace teks sederhana di file root project/ws. ', parameters: { type: 'object', properties: { path: { type: 'string' }, search: { type: 'string' }, replace: { type: 'string' }, replaceAll: { type: 'boolean' } }, required: ['path', 'search', 'replace'], additionalProperties: false } } },
  { type: 'function', function: { name: 'patch_workspace_file', description: 'Patch file dengan satu/banyak search-replace dan membuat backup otomatis sebelum menulis.', parameters: { type: 'object', properties: { path: { type: 'string' }, search: { type: 'string' }, replace: { type: 'string' }, replaceAll: { type: 'boolean' }, patches: { type: 'array', items: { type: 'object', properties: { search: { type: 'string' }, replace: { type: 'string' }, replaceAll: { type: 'boolean' } }, required: ['search', 'replace'], additionalProperties: false } } }, required: ['path'], additionalProperties: false } } },
  { type: 'function', function: { name: 'rollback_backup', description: 'Rollback file ke backup otomatis tertentu. Gunakan jika owner meminta revert/rollback.', parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false } } }
]

function toolsForMode (mode) {
  return mode === 'write' ? [...baseTools, ...writeTools] : baseTools
}

function toolMapForMode (mode) {
  return mode === 'write' ? { ...readToolMap, ...writeToolMap } : readToolMap
}

function completionParams ({ provider, messages, tools }) {
  const params = {
    model: provider.model,
    messages,
    tools,
    tool_choice: 'auto',
    temperature: Number.isFinite(Number(provider.temperature)) ? Number(provider.temperature) : 0.2,
    max_tokens: Number.isFinite(Number(provider.maxTokens)) ? Number(provider.maxTokens) : 4096
  }

  if (provider.extraBody && typeof provider.extraBody === 'object') Object.assign(params, provider.extraBody)
  return params
}

export async function runApiCodeAgent ({ message, provider, providerName = '', history = [], userId = '', chatId = '', userName = '', mode = 'read', workspace = './', writeEnabled = true, maxWriteBytes = 200000, limits = {}, workspacePluginsDir = 'ws/plugins', workspaceProjectsDir = 'ws/projects', workspaceSitesDir = 'ws/projects', workspaceTmpDir = 'ws/tmp', webSearch = {} }) {
  if (!provider?.model) throw new Error(`Model provider ${providerName || provider?.name || 'AI'} belum diisi di config.ts.`)
  const writeMode = mode === 'write'
  const activeTools = toolsForMode(writeMode ? 'write' : 'read')
  const activeToolMap = toolMapForMode(writeMode ? 'write' : 'read')
  const ctx = { workspace, writeEnabled, maxWriteBytes, limits, workspacePluginsDir, workspaceProjectsDir, workspaceSitesDir, workspaceTmpDir, webSearch }

  await ensureWorkspace(workspace, { workspacePluginsDir, workspaceProjectsDir, workspaceSitesDir, workspaceTmpDir: 'ws/tmp' })
  const projectContext = await loadAgentContextBundle({ maxChars: 22000 }).catch(() => '')

  const messages = [
    {
      role: 'system',
      content: [
        'Kamu adalah AI code agent untuk bot WhatsApp Node.js milik owner.',
        'Jawab dalam bahasa Indonesia yang jelas, santai, dan praktis.',
        'Kamu boleh memakai tools untuk memahami struktur project, membaca kode, mencari fungsi, dan web_search untuk mencari informasi internet jika diperlukan.',
        'Jangan mengarang isi file. Kalau perlu info dari project, panggil tool file. Kalau perlu info terbaru dari internet, panggil web_search.',
        'Jangan meminta API key/session/token. Jangan membocorkan data rahasia.',
        'File session, .env, credentials, database mentah, key, token, dan cookie tidak boleh dibaca mentah.',
        'Untuk database, pakai ringkasan saja.',
        writeMode
          ? 'MODE WRITE AKTIF: kalau diminta membuat/mengubah plugin/file, gunakan tool write_workspace_file/write_workspace_files/append_workspace_file/replace_workspace_file. Kamu boleh mengubah file di seluruh root project sesuai instruksi owner, tapi jangan keluar dari root project/container kerja.'
          : 'MODE READ AKTIF: kamu hanya boleh membaca/analis, tidak menulis file.',
        `Untuk plugin baru, gunakan path ${workspacePluginsDir}/nama-plugin.ts agar plugin buatan agent rapi di ws.`,
        `Untuk tugas besar/multi-file, jangan cuma memberi rencana. Buat folder di ${workspaceProjectsDir}/nama-project dan tulis semua file lengkap memakai make_workspace_dirs/write_workspace_files. Jika terlalu panjang, pecah dengan write_workspace_file lalu append_workspace_file.`,
        `Untuk website/proyek baru, buat di ${workspaceProjectsDir}/nama-project/ berisi minimal index.html atau file utama, assets jika dibutuhkan, dan README.md jika diminta.`,
        'Sebelum mengubah file penting, pahami konteks project lewat context/index yang tersedia. Semua write tools membuat backup otomatis. Untuk edit kecil/aman, lebih baik pakai patch_workspace_file daripada rewrite file penuh.',
        'Setelah menulis file, jalankan build_agent_index jika struktur/plugin berubah, lalu laporkan path file, backup id, dan cara menjalankan atau mereview perubahan.',
        'Provider aktif: ' + (providerName || provider.name || '-'),
        'Model aktif: ' + provider.model,
        `Web search: ${ctx.webSearch?.enabled === false ? 'nonaktif' : 'aktif'} via Brave Search HTML scraper`,
        `Root project: ${PROJECT_ROOT}`,
        `Root tulis: ${path.relative(PROJECT_ROOT, workspaceRoot(workspace)).replaceAll(path.sep, '/') || '.'}`,
        `User: ${userName || userId}`,
        `Chat: ${chatId}`,
        projectContext ? `\nKONTEKS PROJECT OTOMATIS:\n${projectContext}` : ''
      ].join('\n')
    },
    ...history.slice(-10),
    { role: 'user', content: message }
  ]

  const maxAgentSteps = limitNumber(ctx, 'maxAgentSteps', DEFAULT_LIMITS.maxAgentSteps)
  const maxToolOutputChars = limitNumber(ctx, 'maxToolOutputChars', DEFAULT_LIMITS.maxToolOutputChars)

  for (let step = 0; step < maxAgentSteps; step++) {
    const completion = await runProviderRequest({ ...provider, id: providerName }, 'chat.completions', (openai, attemptProvider) => openai.chat.completions.create(completionParams({ provider: attemptProvider, messages, tools: activeTools })))
    const msg = completion.choices?.[0]?.message
    if (!msg) throw new Error('Model tidak mengembalikan response.')

    if (!msg.tool_calls?.length) {
      const finalText = (msg.content || '').trim() || 'Model tidak mengembalikan jawaban teks.'
      const maxReplyChars = limitNumber(ctx, 'maxReplyChars', DEFAULT_LIMITS.maxReplyChars)
      return finalText.length > maxReplyChars ? finalText.slice(0, maxReplyChars) + '\n\n[Jawaban dipotong. File lengkap tetap ada di root project/ws kalau agent menulis file.]' : finalText
    }
    messages.push(msg)

    for (const call of msg.tool_calls) {
      const name = call.function?.name
      const rawArgs = call.function?.arguments || '{}'
      let args = {}
      try { args = JSON.parse(rawArgs) } catch { args = {} }

      try {
        if (!activeToolMap[name]) throw new Error(`Tool ${name} tidak tersedia di mode ${mode}.`)
        const result = await activeToolMap[name](args, ctx)
        messages.push({ role: 'tool', tool_call_id: call.id, content: cleanJson(result, maxToolOutputChars) })
      } catch (e) {
        messages.push({ role: 'tool', tool_call_id: call.id, content: cleanJson({ error: e.message }, maxToolOutputChars) })
      }
    }
  }

  return 'Agent sudah mencapai batas langkah tool. Coba pecah pertanyaannya jadi lebih spesifik.'
}

export async function listApiProviderModels (provider, { limit = 120 } = {}) {
  const models = await runProviderRequest(provider, 'models.list', async (openai) => {
    if (!openai.models?.list) throw new Error('Client provider ini tidak punya endpoint models.list().')
    return openai.models.list()
  })
  const data = Array.isArray(models?.data) ? models.data : []
  const ids = data.map(m => m?.id).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)))
  return ids.slice(0, limit)
}

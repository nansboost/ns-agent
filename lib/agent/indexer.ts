// @ts-nocheck
import fs from 'fs/promises'
import path from 'path'

const PROJECT_ROOT = path.resolve(process.cwd())
const CONTEXT_DIR = path.join(PROJECT_ROOT, '.ns-agent', 'context')

const IGNORED = new Set(['node_modules', '.git', 'sessions', 'session', 'tmp', 'temp', '.cache', '.npm', '.pnpm-store', '.codex', 'logs'])
const TEXT_EXTS = new Set(['.ts', '.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.html', '.css', '.yml', '.yaml', '.sh', '.py'])
const PLUGIN_DIRS = ['plugins', 'ws/plugins']
const CONTEXT_FILES = ['AGENTS.md', 'NS_AGENT.md', 'plugins/AGENTS.md', 'ws/AGENTS.md']

function isPathInside (parent, child) {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function relPath (full) {
  return path.relative(PROJECT_ROOT, full).replaceAll(path.sep, '/') || '.'
}

async function statOrNull (full) {
  try { return await fs.stat(full) } catch { return null }
}

async function readTextSafe (full, maxBytes = 350000) {
  const st = await statOrNull(full)
  if (!st || !st.isFile() || st.size > maxBytes) return ''
  return fs.readFile(full, 'utf8').catch(() => '')
}

async function walkFiles (dirFull, out = [], options = {}) {
  const st = await statOrNull(dirFull)
  if (!st || !st.isDirectory()) return out
  const entries = await fs.readdir(dirFull, { withFileTypes: true }).catch(() => [])
  for (const ent of entries) {
    const full = path.join(dirFull, ent.name)
    const rel = relPath(full)
    if (ent.isDirectory()) {
      if (IGNORED.has(ent.name)) continue
      if (rel.startsWith('.ns-agent/backups')) continue
      await walkFiles(full, out, options)
    } else {
      const ext = path.extname(ent.name).toLowerCase()
      if (!TEXT_EXTS.has(ext)) continue
      out.push(full)
    }
  }
  return out
}

function parseArrayLike (raw = '') {
  const values = []
  const re = /['"`]([^'"`]+)['"`]/g
  let m
  while ((m = re.exec(raw))) values.push(m[1])
  return values
}

function parsePluginMeta (source = '') {
  const meta = { commands: [], help: [], tags: [], rowner: false, owner: false, group: false, private: false, disabled: false }
  const commandMatch = source.match(/handler\.command\s*=\s*([^\n]+)/)
  if (commandMatch) {
    const raw = commandMatch[1].trim()
    if (raw.startsWith('[')) meta.commands = parseArrayLike(raw)
    else if (raw.startsWith('/')) meta.commands = [raw.replace(/\s*$/g, '').slice(0, 120)]
    else meta.commands = parseArrayLike(raw)
  }
  const helpMatch = source.match(/handler\.help\s*=\s*([^\n]+)/)
  if (helpMatch) meta.help = parseArrayLike(helpMatch[1]).slice(0, 20)
  const tagsMatch = source.match(/handler\.tags\s*=\s*([^\n]+)/)
  if (tagsMatch) meta.tags = parseArrayLike(tagsMatch[1]).slice(0, 12)
  meta.rowner = /handler\.rowner\s*=\s*true/.test(source)
  meta.owner = /handler\.owner\s*=\s*true/.test(source)
  meta.group = /handler\.group\s*=\s*true/.test(source)
  meta.private = /handler\.private\s*=\s*true/.test(source)
  meta.disabled = /handler\.disabled\s*=\s*true/.test(source)
  return meta
}

async function collectPluginIndex () {
  const plugins = []
  for (const dir of PLUGIN_DIRS) {
    const fullDir = path.join(PROJECT_ROOT, dir)
    const files = await walkFiles(fullDir, [])
    for (const full of files) {
      const ext = path.extname(full).toLowerCase()
      if (!['.ts', '.js', '.mjs', '.cjs'].includes(ext)) continue
      const source = await readTextSafe(full)
      if (!source.includes('handler')) continue
      const meta = parsePluginMeta(source)
      plugins.push({
        path: relPath(full),
        name: path.basename(full).replace(/\.(ts|js|mjs|cjs)$/i, ''),
        sourceDir: relPath(path.dirname(full)).startsWith('ws/plugins') ? 'ws/plugins' : 'plugins',
        ...meta
      })
    }
  }
  plugins.sort((a, b) => a.path.localeCompare(b.path))
  return plugins
}

async function collectProjectIndex () {
  const files = await walkFiles(PROJECT_ROOT, [])
  const top = {}
  const important = []
  for (const full of files) {
    const rel = relPath(full)
    if (rel.startsWith('.ns-agent/backups')) continue
    const first = rel.split('/')[0]
    top[first] = (top[first] || 0) + 1
    if (/^(main|handler|config|index)\.ts$/.test(rel) || /^(lib|plugins|ws|scripts|skills|docs)\//.test(rel)) important.push(rel)
  }
  return {
    root: PROJECT_ROOT,
    generatedAt: new Date().toISOString(),
    topLevelFileCounts: Object.fromEntries(Object.entries(top).sort((a, b) => a[0].localeCompare(b[0]))),
    importantFiles: important.sort().slice(0, 1000),
    conventions: {
      stablePlugins: 'plugins/',
      agentPlugins: 'ws/plugins/',
      agentProjects: 'ws/projects/',
      agentTmp: 'ws/tmp/',
      context: ['AGENTS.md', 'NS_AGENT.md', 'plugins/AGENTS.md', 'ws/AGENTS.md'],
      generatedIndex: '.ns-agent/context/'
    }
  }
}

function pluginIndexToMarkdown (plugins = []) {
  const lines = ['# Plugin Index', '', `Generated: ${new Date().toISOString()}`, '', `Total plugins: ${plugins.length}`, '']
  const byTag = new Map()
  for (const plugin of plugins) {
    const tags = plugin.tags?.length ? plugin.tags : ['uncategorized']
    for (const tag of tags) {
      if (!byTag.has(tag)) byTag.set(tag, [])
      byTag.get(tag).push(plugin)
    }
  }
  for (const [tag, items] of [...byTag.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`## ${tag}`)
    for (const p of items.sort((a, b) => a.name.localeCompare(b.name))) {
      const cmds = p.commands?.length ? p.commands.join(', ') : '-'
      lines.push(`- ${p.path} — command: ${cmds}${p.rowner || p.owner ? ' — owner' : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function projectIndexToMarkdown (idx) {
  const lines = ['# Project Map', '', `Generated: ${idx.generatedAt}`, '', '## Folder/File counts', '']
  for (const [name, count] of Object.entries(idx.topLevelFileCounts || {})) lines.push(`- ${name}: ${count}`)
  lines.push('', '## Important paths', '')
  for (const file of idx.importantFiles || []) lines.push(`- ${file}`)
  lines.push('', '## Conventions', '')
  for (const [key, value] of Object.entries(idx.conventions || {})) lines.push(`- ${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
  return lines.join('\n')
}

export async function buildAgentIndex () {
  await fs.mkdir(CONTEXT_DIR, { recursive: true })
  const plugins = await collectPluginIndex()
  const project = await collectProjectIndex()
  await fs.writeFile(path.join(CONTEXT_DIR, 'plugin-index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), count: plugins.length, plugins }, null, 2), 'utf8')
  await fs.writeFile(path.join(CONTEXT_DIR, 'plugin-index.md'), pluginIndexToMarkdown(plugins), 'utf8')
  await fs.writeFile(path.join(CONTEXT_DIR, 'project-index.json'), JSON.stringify(project, null, 2), 'utf8')
  await fs.writeFile(path.join(CONTEXT_DIR, 'project-map.md'), projectIndexToMarkdown(project), 'utf8')
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    pluginCount: plugins.length,
    importantFileCount: project.importantFiles.length,
    outputs: ['.ns-agent/context/plugin-index.json', '.ns-agent/context/plugin-index.md', '.ns-agent/context/project-index.json', '.ns-agent/context/project-map.md']
  }
}

export async function readAgentIndexFile (name = 'project-index.json') {
  const clean = path.basename(String(name || 'project-index.json'))
  const full = path.join(CONTEXT_DIR, clean)
  if (!isPathInside(CONTEXT_DIR, full)) throw new Error('Index path tidak valid.')
  const raw = await fs.readFile(full, 'utf8')
  if (clean.endsWith('.json')) return JSON.parse(raw)
  return raw
}

export async function loadAgentContextBundle (options = {}) {
  const maxChars = Number(options.maxChars || 20000)
  const chunks = []
  for (const rel of CONTEXT_FILES) {
    const full = path.resolve(PROJECT_ROOT, rel)
    if (!isPathInside(PROJECT_ROOT, full)) continue
    const raw = await readTextSafe(full, 80000)
    if (raw) chunks.push(`--- ${rel} ---\n${raw.trim()}`)
  }

  const projectMap = await readTextSafe(path.join(CONTEXT_DIR, 'project-map.md'), 80000)
  const pluginMd = await readTextSafe(path.join(CONTEXT_DIR, 'plugin-index.md'), 120000)
  if (projectMap) chunks.push(`--- .ns-agent/context/project-map.md ---\n${projectMap.trim()}`)
  if (pluginMd) chunks.push(`--- .ns-agent/context/plugin-index.md ---\n${pluginMd.slice(0, 10000).trim()}`)

  const out = chunks.join('\n\n')
  return out.length > maxChars ? out.slice(0, maxChars) + '\n\n[Project context dipotong karena terlalu panjang.]' : out
}

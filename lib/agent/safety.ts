// @ts-nocheck
import fs from 'fs/promises'
import path from 'path'

const PROJECT_ROOT = path.resolve(process.cwd())
const BACKUP_ROOT = path.join(PROJECT_ROOT, '.ns-agent', 'backups')

const SENSITIVE_BACKUP_PATTERNS = [
  /(^|[/\\])\.env(\..*)?$/i,
  /(^|[/\\])config\.ts$/i,
  /(^|[/\\])database\.json$/i,
  /(^|[/\\])agent-(provider|sessions|tasks)\.json$/i,
  /(^|[/\\])ai-memory\.json$/i,
  /(^|[/\\])auto-heal-state\.json$/i,
  /(^|[/\\])sessions?([/\\]|$)/i,
  /(^|[/\\])creds\.json$/i,
  /(^|[/\\])\.owner-memory\.md$/i,
  /(^|[/\\])\.ns-agent([/\\]|$)/i,
  /(^|[/\\])lib[/\\]agent-data([/\\]|$)/i,
  /(^|[/\\])lib[/\\]jid-data([/\\]|$)/i,
  /(^|[/\\]).*\.(pem|key|p12|pfx)$/i,
  /(token|secret|apikey|api_key|credential|cookie|session)/i
]

function isSensitiveBackupPath(relPath = '') {
  return SENSITIVE_BACKUP_PATTERNS.some(re => re.test(String(relPath).replaceAll('\\', '/')))
}

function isPathInside (parent, child) {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function normalizeRel (input = '.') {
  let rel = String(input || '.').replace(/^[/\\]+/, '').replace(/\0/g, '')
  rel = rel.replaceAll('\\', '/')
  return rel || '.'
}

function safeProjectPath (input = '.') {
  const rel = normalizeRel(input)
  const full = path.resolve(PROJECT_ROOT, rel)
  if (!isPathInside(PROJECT_ROOT, full)) throw new Error('Path keluar dari root project tidak diizinkan.')
  return { rel: path.relative(PROJECT_ROOT, full).replaceAll(path.sep, '/') || '.', full }
}

async function statOrNull (full) {
  try { return await fs.stat(full) } catch { return null }
}

function makeBackupId () {
  const now = new Date()
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const rand = Math.random().toString(36).slice(2, 8)
  return `${stamp}-${rand}`
}

async function copyIfExists (src, dest) {
  const st = await statOrNull(src)
  if (!st || !st.isFile()) return { existed: false, bytes: 0 }
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.copyFile(src, dest)
  return { existed: true, bytes: st.size }
}

export async function backupFiles (paths = [], options = {}) {
  const unique = [...new Set((paths || []).filter(Boolean).map(normalizeRel))]
  if (!unique.length) return null

  const id = makeBackupId()
  const backupDir = path.join(BACKUP_ROOT, id)
  const filesDir = path.join(backupDir, 'files')
  const manifest = {
    id,
    createdAt: new Date().toISOString(),
    reason: String(options.reason || 'agent write'),
    actor: String(options.actor || 'ns-agent'),
    projectRoot: PROJECT_ROOT,
    files: []
  }

  for (const requested of unique) {
    const { rel, full } = safeProjectPath(requested)
    if (isSensitiveBackupPath(rel)) {
      const st = await statOrNull(full)
      manifest.files.push({ path: rel, existed: Boolean(st && st.isFile()), bytes: st?.size || 0, redacted: true })
      continue
    }
    const backupFull = path.join(filesDir, rel)
    const copied = await copyIfExists(full, backupFull)
    manifest.files.push({ path: rel, existed: copied.existed, bytes: copied.bytes, redacted: false })
  }

  await fs.mkdir(backupDir, { recursive: true })
  await fs.writeFile(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  return { id, dir: path.relative(PROJECT_ROOT, backupDir).replaceAll(path.sep, '/'), files: manifest.files }
}

export async function listAgentBackups (limit = 20) {
  await fs.mkdir(BACKUP_ROOT, { recursive: true })
  const entries = await fs.readdir(BACKUP_ROOT, { withFileTypes: true }).catch(() => [])
  const out = []
  for (const ent of entries) {
    if (!ent.isDirectory()) continue
    const manifestPath = path.join(BACKUP_ROOT, ent.name, 'manifest.json')
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
      out.push({
        id: manifest.id || ent.name,
        createdAt: manifest.createdAt || '',
        reason: manifest.reason || '',
        actor: manifest.actor || '',
        files: Array.isArray(manifest.files) ? manifest.files.length : 0
      })
    } catch {
      out.push({ id: ent.name, createdAt: '', reason: 'manifest rusak/tidak ada', files: 0 })
    }
  }
  out.sort((a, b) => String(b.createdAt || b.id).localeCompare(String(a.createdAt || a.id)))
  return out.slice(0, Math.max(1, Number(limit || 20)))
}

export async function readBackupManifest (id) {
  const clean = path.basename(String(id || '').trim())
  if (!clean) throw new Error('ID backup kosong.')
  const manifestPath = path.join(BACKUP_ROOT, clean, 'manifest.json')
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  return manifest
}

export async function rollbackAgentBackup (id, options = {}) {
  const clean = path.basename(String(id || '').trim())
  if (!clean) throw new Error('ID backup kosong.')
  const backupDir = path.join(BACKUP_ROOT, clean)
  const manifest = await readBackupManifest(clean)
  const affected = []

  if (options.createRollbackBackup !== false) {
    await backupFiles((manifest.files || []).map(f => f.path), {
      reason: `pre-rollback ${clean}`,
      actor: 'rollback'
    }).catch(() => null)
  }

  for (const file of manifest.files || []) {
    const { rel, full } = safeProjectPath(file.path)
    const backupFull = path.join(backupDir, 'files', rel)
    if (file.redacted) {
      affected.push({ path: rel, skipped: true, reason: 'backup redacted karena file sensitif' })
      continue
    }
    if (file.existed) {
      await fs.mkdir(path.dirname(full), { recursive: true })
      await fs.copyFile(backupFull, full)
      affected.push({ path: rel, restored: true })
    } else {
      await fs.rm(full, { force: true, recursive: false }).catch(() => {})
      affected.push({ path: rel, removed: true })
    }
  }

  return { ok: true, id: clean, files: affected }
}

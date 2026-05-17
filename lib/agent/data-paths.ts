// @ts-nocheck
import fs from 'fs'
import path from 'path'

export const PROJECT_ROOT = path.resolve(process.cwd())
export const AGENT_DATA_DIR = path.join(PROJECT_ROOT, 'lib', 'agent-data')

export function ensureAgentDataDirSync () {
  if (!fs.existsSync(AGENT_DATA_DIR)) fs.mkdirSync(AGENT_DATA_DIR, { recursive: true })
}

function migrateLegacyRootJson (name = '', target = '') {
  const legacy = path.join(PROJECT_ROOT, name)
  if (!fs.existsSync(legacy) || fs.existsSync(target)) return
  try {
    fs.renameSync(legacy, target)
  } catch {
    try {
      fs.copyFileSync(legacy, target)
      fs.unlinkSync(legacy)
    } catch {}
  }
}

export function agentDataFile (name = '') {
  const raw = String(name || '').trim()
  const safe = path.basename(raw)
  if (!safe || safe !== raw) throw new Error('Nama file agent-data tidak valid.')
  ensureAgentDataDirSync()
  const full = path.join(AGENT_DATA_DIR, safe)
  migrateLegacyRootJson(safe, full)
  return full
}

export function agentDataRel (name = '') {
  return path.relative(PROJECT_ROOT, agentDataFile(name)).replaceAll(path.sep, '/')
}

export function resolveProjectFile (input = '', fallback = '') {
  const selected = String(input || fallback || '').trim()
  const full = path.resolve(PROJECT_ROOT, selected)
  const rel = path.relative(PROJECT_ROOT, full)
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Path keluar dari root project tidak diizinkan.')
  return full
}

export const AGENT_PROVIDER_FILE = agentDataFile('agent-provider.json')
export const AGENT_SESSIONS_FILE = agentDataFile('agent-sessions.json')
export const AGENT_TASKS_FILE = agentDataFile('agent-tasks.json')
export const AI_MEMORY_FILE = agentDataFile('ai-memory.json')
export const AUTO_HEAL_STATE_FILE = agentDataFile('auto-heal-state.json')
export const AGENT_HISTORY_FILE = agentDataFile('agent-history.json')

// @ts-nocheck
import fs from 'fs/promises'
import path from 'path'
import { agentDataFile, AGENT_DATA_DIR, PROJECT_ROOT } from './data-paths.ts'

export const AGENT_REPORTS_DIR = path.join(AGENT_DATA_DIR, 'reports')
export const AGENT_HISTORY_FILE = agentDataFile('agent-history.json')

function nowIso () { return new Date().toISOString() }
function idPart () { return new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + '-' + Math.random().toString(36).slice(2, 7) }
function rel (full = '') { return path.relative(PROJECT_ROOT, full).replaceAll(path.sep, '/') || '.' }
function trim (text = '', max = 20000) {
  const value = String(text || '')
  return value.length > max ? value.slice(0, max) + '\n...[dipotong]' : value
}

async function readHistory () {
  try { return JSON.parse(await fs.readFile(AGENT_HISTORY_FILE, 'utf8')) } catch { return { _info: 'AI Agent execution history', _version: '1.0', items: [] } }
}

async function writeHistory (store = {}) {
  await fs.mkdir(path.dirname(AGENT_HISTORY_FILE), { recursive: true })
  const tmp = `${AGENT_HISTORY_FILE}.tmp`
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf8')
  await fs.rename(tmp, AGENT_HISTORY_FILE)
}

export async function saveAgentReport ({ prompt = '', output = '', providerId = '', model = '', mode = 'read', chatId = '', userId = '', userName = '', errors = [] } = {}) {
  await fs.mkdir(AGENT_REPORTS_DIR, { recursive: true })
  const id = 'report-' + idPart()
  const file = path.join(AGENT_REPORTS_DIR, `${id}.md`)
  const body = [
    `# AI Agent Report ${id}`,
    '',
    `- Time: ${nowIso()}`,
    `- Mode: ${mode}`,
    `- Provider: ${providerId || '-'}`,
    `- Model: ${model || '-'}`,
    `- Chat: ${chatId || '-'}`,
    `- User: ${userName || userId || '-'}`,
    '',
    '## Prompt',
    '',
    '```text',
    trim(prompt, 12000),
    '```',
    '',
    errors.length ? '## Provider Errors\n\n```text\n' + trim(errors.join('\n'), 8000) + '\n```\n' : '',
    '## Output',
    '',
    '```text',
    trim(output, 30000),
    '```',
    ''
  ].join('\n')
  await fs.writeFile(file, body, 'utf8')

  const history = await readHistory()
  history.items = Array.isArray(history.items) ? history.items : []
  history.items.push({ id, at: nowIso(), mode, providerId, model, chatId, userId, userName, prompt: trim(prompt, 500), outputPreview: trim(output, 1200), reportFile: rel(file), errors })
  history.items = history.items.slice(-100)
  await writeHistory(history)

  return { id, file, fileRel: rel(file), historyFile: rel(AGENT_HISTORY_FILE) }
}

export async function listAgentReports (limit = 10) {
  const history = await readHistory()
  const items = Array.isArray(history.items) ? history.items : []
  return items.slice(-Math.max(1, Number(limit) || 10)).reverse()
}

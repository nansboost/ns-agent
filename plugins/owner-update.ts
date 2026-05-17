// @ts-nocheck
import { execFile } from 'child_process'
import util from 'util'

const execFilePromise = util.promisify(execFile)

function parseSafeGitPullArgs(text = '') {
  const raw = String(text || '').trim()
  if (!raw) return []
  const allowed = new Set(['--rebase', '--ff-only', '--no-rebase'])
  const args = raw.split(/\s+/).filter(Boolean)
  for (const arg of args) {
    if (!allowed.has(arg)) {
      throw new Error(`Argumen git pull tidak diizinkan: ${arg}`)
    }
  }
  return args
}

let handler = async (m, { conn, text }) => {
  try {
    m.react('⏳')
    const args = ['pull', ...parseSafeGitPullArgs(text)]
    const { stdout, stderr } = await execFilePromise('git', args, {
      cwd: process.cwd(),
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 2
    })

    let result = stdout || '✅ Repo berhasil di-update.'
    if (stderr) result += '\n⚠️ ' + stderr

    await conn.reply(m.chat, `📦 *Git Update*\n\n${result.slice(0, 60000)}`, m)

    if (global.reload) await global.reload().catch(() => {})
    m.react('✅')
  } catch (err) {
    await conn.reply(m.chat, `❌ *Gagal melakukan update*\n\n${err.message}`, m)
    m.react('❌')
  }
}

handler.help = ['update']
handler.tags = ['owner']
handler.command = ['update', 'actualizar', 'fix', 'fixed']
handler.rowner = true

export default handler

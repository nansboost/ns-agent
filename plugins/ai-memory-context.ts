// @ts-nocheck
/**
 * AI MEMORY CONTEXT - Baca konteks percakapan terakhir
 * 
 * Commands:
 * - .context         → Baca 10 pesan terakhir dari chat ini
 * - .context <jumlah> → Baca N pesan terakhir (max 50)
 * 
 * Berguna untuk AI agent agar tahu konteks percakapan sebelumnya.
 * 
 * Copy ke plugins/ utama setelah review.
 */

import fs from 'fs'
import { AI_MEMORY_FILE } from '../lib/agent/data-paths.ts'

const MEMORY_PATH = AI_MEMORY_FILE

function readMemory() {
  try {
    if (!fs.existsSync(MEMORY_PATH)) return { sessions: {} }
    return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf-8'))
  } catch {
    return { sessions: {} }
  }
}

let handler = async (m, { conn, usedPrefix, command, text }) => {
  const memory = readMemory()
  const chatId = m.chat
  const session = memory.sessions?.[chatId]

  if (!session || !session.messages || session.messages.length === 0) {
    return m.reply('📭 Belum ada riwayat percakapan di chat ini.')
  }

  // Default 10 pesan, bisa custom
  let count = 10
  if (text && !isNaN(text)) {
    count = Math.min(parseInt(text), 50)
  }

  const recent = session.messages.slice(-count)

  let result = `🧠 *Konteks Percakapan Terakhir*\n`
  result += `📊 Menampilkan ${recent.length} pesan terakhir\n`
  result += `──────────────\n\n`

  for (const msg of recent) {
    const senderShort = msg.sender ? msg.sender.split('@')[0] : 'unknown'
    const shortText = msg.text.length > 100 ? msg.text.substring(0, 97) + '...' : msg.text
    result += `👤 ${senderShort} [${msg.time}]\n${shortText}\n\n`
  }

  result += `──────────────\n`
  result += `💡 AI agent bisa pakai ini untuk lanjutkan percakapan.`

  return m.reply(result)
}

handler.help = ['context', 'context <jumlah>']
handler.tags = ['ai', 'tools']
handler.command = /^(context|konteks)$/i

export default handler

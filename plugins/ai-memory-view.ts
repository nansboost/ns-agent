// @ts-nocheck
/**
 * AI MEMORY VIEW - Lihat & Kelola Memori Percakapan
 * 
 * Commands:
 * - .memory          → Lihat ringkasan semua sesi
 * - .memory <chatId> → Lihat riwayat percakapan chat tertentu
 * - .memory clear    → Hapus semua memori
 * - .memory clear <chatId> → Hapus memori chat tertentu
 * - .memory stats    → Statistik memori
 * 
 * Copy ke plugins/ utama setelah review.
 */

import fs from 'fs'
import { AI_MEMORY_FILE } from '../lib/agent/data-paths.ts'

const MEMORY_PATH = AI_MEMORY_FILE

function readMemory() {
  try {
    if (!fs.existsSync(MEMORY_PATH)) {
      return { sessions: {} }
    }
    return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf-8'))
  } catch {
    return { sessions: {} }
  }
}

function writeMemory(data) {
  try {
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (e) {
    console.error('[AI-Memory] Gagal tulis:', e.message)
    return false
  }
}

let handler = async (m, { conn, usedPrefix, command, text }) => {
  const memory = readMemory()
  const sessions = memory.sessions || {}

  // === .memory (ringkasan) ===
  if (!text || text.trim() === '') {
    const sessionKeys = Object.keys(sessions)
    if (sessionKeys.length === 0) {
      return m.reply('📭 *Memori AI kosong.*\nBelum ada percakapan yang tersimpan.')
    }

    let result = `🧠 *AI MEMORY - Ringkasan*\n\n`
    result += `📊 Total sesi: ${sessionKeys.length}\n\n`

    for (const chatId of sessionKeys) {
      const session = sessions[chatId]
      const msgCount = session.messages ? session.messages.length : 0
      const shortId = chatId.length > 20 ? chatId.substring(0, 17) + '...' : chatId
      result += `💬 *${shortId}*\n`
      result += `   📝 ${msgCount} pesan | Terakhir: ${session.last_active || '-'}\n\n`
    }

    result += `──────────────\n`
    result += `💡 Lihat detail: ${usedPrefix}memory <chatId>\n`
    result += `🗑 Hapus: ${usedPrefix}memory clear <chatId>`

    return m.reply(result)
  }

  // === .memory clear ===
  if (text.trim().toLowerCase() === 'clear') {
    memory.sessions = {}
    writeMemory(memory)
    return m.reply('🗑 *Semua memori AI berhasil dihapus.*')
  }

  // === .memory clear <chatId> ===
  if (text.trim().toLowerCase().startsWith('clear ')) {
    const targetChat = text.trim().substring(6).trim()
    if (sessions[targetChat]) {
      delete memory.sessions[targetChat]
      writeMemory(memory)
      return m.reply(`🗑 Memori chat *${targetChat}* berhasil dihapus.`)
    }
    return m.reply(`❌ Chat *${targetChat}* tidak ditemukan di memori.`)
  }

  // === .memory stats ===
  if (text.trim().toLowerCase() === 'stats') {
    const sessionKeys = Object.keys(sessions)
    let totalMessages = 0
    let groups = 0
    let privates = 0

    for (const chatId of sessionKeys) {
      const msgs = sessions[chatId].messages || []
      totalMessages += msgs.length
      if (msgs.length > 0 && msgs[0].type === 'group') groups++
      else privates++
    }

    return m.reply(
      `📊 *AI Memory Statistics*\n\n` +
      `📁 Total sesi: ${sessionKeys.length}\n` +
      `💬 Total pesan tersimpan: ${totalMessages}\n` +
      `👥 Grup: ${groups} | 👤 Private: ${privates}\n` +
      `📏 Max pesan/chat: 50\n` +
      `📄 File: lib/agent-data/ai-memory.json`
    )
  }

  // === .memory <chatId> ===
  const targetChat = text.trim()
  if (sessions[targetChat]) {
    const session = sessions[targetChat]
    const msgs = session.messages || []

    let result = `🧠 *Memori: ${targetChat}*\n`
    result += `📅 Dibuat: ${session.created_at || '-'}\n`
    result += `🕐 Terakhir: ${session.last_active || '-'}\n`
    result += `📝 Total pesan: ${msgs.length}\n`
    result += `──────────────\n\n`

    // Tampilkan 20 pesan terakhir
    const recentMsgs = msgs.slice(-20)
    for (const msg of recentMsgs) {
      const shortText = msg.text.length > 80 ? msg.text.substring(0, 77) + '...' : msg.text
      result += `[${msg.time}] ${shortText}\n`
    }

    if (msgs.length > 20) {
      result += `\n... dan ${msgs.length - 20} pesan lainnya`
    }

    return m.reply(result)
  }

  return m.reply(`❌ Chat *${targetChat}* tidak ditemukan di memori.\n\nGunakan ${usedPrefix}memory untuk lihat daftar sesi.`)
}

handler.help = ['memory', 'memory <chatId>', 'memory clear', 'memory clear <chatId>', 'memory stats']
handler.tags = ['ai', 'tools']
handler.command = /^(memory|memori)$/i

export default handler

// @ts-nocheck
/**
 * AI MEMORY - Auto Capture Plugin
 * Menyimpan riwayat percakapan ke lib/agent-data/ai-memory.json
 * Terpisah dari database.json utama.
 * 
 * Cara kerja:
 * - Setiap pesan yang masuk otomatis disimpan ke memori
 * - Maksimal 50 pesan terakhir per chat (auto-trim)
 * - Data tersimpan: sender, text, timestamp, chat_id
 * 
 * Copy ke plugins/ utama setelah review.
 */

import fs from 'fs'
import { AI_MEMORY_FILE } from '../lib/agent/data-paths.ts'

// Path memori agent di lib/agent-data agar root project tetap rapi
const MEMORY_PATH = AI_MEMORY_FILE
const MAX_MESSAGES_PER_CHAT = 50

/**
 * Baca file memori, return object parsed
 */
function readMemory() {
  try {
    if (!fs.existsSync(MEMORY_PATH)) {
      return { _info: 'AI Agent Memory', _version: '1.0', sessions: {} }
    }
    const raw = fs.readFileSync(MEMORY_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('[AI-Memory] Gagal baca memori:', e.message)
    return { _info: 'AI Agent Memory', _version: '1.0', sessions: {} }
  }
}

/**
 * Tulis object ke file memori
 */
function writeMemory(data) {
  try {
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (e) {
    console.error('[AI-Memory] Gagal tulis memori:', e.message)
    return false
  }
}

/**
 * Format timestamp ke string yang readable
 */
function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Handler utama - auto capture setiap pesan
let handler = async (m, { conn }) => {
  try {
    // Skip pesan dari bot sendiri
    if (m.isBot) return

    const chatId = m.chat
    const sender = m.sender || 'unknown'
    const text = m.text || m.body || ''
    const timestamp = Date.now()

    // Skip pesan kosong atau hanya whitespace
    if (!text || text.trim().length === 0) return

    // Baca memori existing
    const memory = readMemory()

    // Inisialisasi session jika belum ada
    if (!memory.sessions[chatId]) {
      memory.sessions[chatId] = {
        chat_id: chatId,
        created_at: formatTime(timestamp),
        last_active: formatTime(timestamp),
        messages: []
      }
    }

    // Tambah pesan baru
    memory.sessions[chatId].messages.push({
      sender: sender,
      text: text,
      timestamp: timestamp,
      time: formatTime(timestamp),
      type: m.isGroup ? 'group' : 'private'
    })

    // Trim ke MAX_MESSAGES_PER_CHAT terakhir
    if (memory.sessions[chatId].messages.length > MAX_MESSAGES_PER_CHAT) {
      memory.sessions[chatId].messages = memory.sessions[chatId].messages.slice(-MAX_MESSAGES_PER_CHAT)
    }

    // Update last active
    memory.sessions[chatId].last_active = formatTime(timestamp)

    // Tulis ke file
    writeMemory(memory)

  } catch (e) {
    console.error('[AI-Memory] Error saat capture:', e.message)
  }
}

// Plugin ini jalan di semua pesan (tanpa command)
handler.custom = true
handler.all = true

export default handler

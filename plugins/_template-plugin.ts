// @ts-nocheck
// Template plugin hasil kerja AI agent.
// Copy ke folder plugins/ utama setelah kamu review.

let handler = async (m, { conn, usedPrefix, command, text }) => {
  await m.reply('Plugin root aktif.')
}

handler.help = ['contoh']
handler.tags = ['tools']
handler.command = /^(contoh)$/i

export default handler

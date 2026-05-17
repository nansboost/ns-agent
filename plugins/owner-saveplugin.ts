// @ts-nocheck
import fs from 'fs'
import path from 'path'

let handler = async (m, { text, usedPrefix, command }) => {
  if (!text) return m.reply(`Silakan masukkan nama plugin.\nContoh: ${usedPrefix + command} tools/ping-test`)
  if (!m.quoted || !m.quoted.text) return m.reply(`Balas pesan dengan konten plugin.`)

  const safeName = String(text)
    .trim()
    .replace(/^\/+/, '')
    .replace(/\.ts$/i, '')
    .replace(/\.js$/i, '')
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9_\-\/]/g, '-')

  const ruta = path.join('ws', 'plugins', `${safeName}.ts`)

  try {
    fs.mkdirSync(path.dirname(ruta), { recursive: true })
    fs.writeFileSync(ruta, m.quoted.text)

    if (global.reload) {
      await global.reload('add', path.resolve(ruta)).catch(() => {})
    }

    m.reply(`✅ Plugin disimpan dan dicoba load ulang:\n${ruta}`)
  } catch (error) {
    m.reply(`Terjadi kesalahan saat menyimpan plugin: ${error.message}`)
  }
}

handler.help = ['saveplugin']
handler.tags = ['owner']
handler.command = ['saveplugin', 'sp']
handler.owner = true

export default handler

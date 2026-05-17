// @ts-nocheck
import fs from 'fs'
import path from 'path'

function normalizeName(name = '') {
  return String(name || '').trim().replace(/^plugins\//, '').replace(/\.ts$/i, '').replace(/\.js$/i, '')
}

let handler = async (m, { conn, usedPrefix, command, text }) => {
  const pluginMap = global.pluginFiles || {}
  const pluginNames = Object.keys(global.plugins || {})
  const displayNames = pluginNames.map(name => normalizeName(name))

  if (!text) {
    return m.reply(`
✳️ Penggunaan perintah:
${usedPrefix + command} <nama>

📌 Contoh:
${usedPrefix + command} main-menu
${usedPrefix + command} ws/plugins/contoh
`.trim())
  }

  const requested = normalizeName(text)
  const candidates = pluginNames.filter(name => {
    const clean = normalizeName(name)
    return clean === requested || name === text || name === `${text}.ts` || name === `${text}.js`
  })

  if (!candidates.length) {
    return m.reply(`
📌 Contoh:
${usedPrefix + command} main-menu

≡ Daftar Plugin
┌─⊷
${displayNames.slice(0, 150).map(name => `▢ ${name}`).join('\n')}
${displayNames.length > 150 ? `\n... dan ${displayNames.length - 150} plugin lain` : ''}
└───────────
`.trim())
  }

  try {
    const key = candidates[0]
    const pluginPath = pluginMap[key] || path.resolve(process.cwd(), key.startsWith('ws/plugins/') ? key : path.join('plugins', key))

    if (!fs.existsSync(pluginPath)) {
      return m.reply(`❎ File plugin terdaftar, tapi file fisiknya tidak ditemukan:\n${key}`)
    }

    const fileBuffer = fs.readFileSync(pluginPath)
    await conn.sendMessage(m.chat, {
      document: fileBuffer,
      mimetype: 'application/javascript',
      fileName: path.basename(pluginPath)
    }, { quoted: m })

  } catch (err) {
    console.error(err)
    m.reply('❎ Error saat mengirim plugin')
  }
}

handler.help = ['getfile', 'sendfile', 'downloadfile'].map(v => v + ' <nama>')
handler.tags = ['owner']
handler.command = /^(getfile|sendfile|downloadfile)$/i
handler.rowner = true

export default handler

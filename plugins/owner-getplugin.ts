// @ts-nocheck
import fs from 'fs'
import path from 'path'

function normalizeName(name = '') {
  return String(name || '').trim().replace(/^plugins\//, '').replace(/\.ts$/i, '').replace(/\.js$/i, '')
}

let handler = async (m, { usedPrefix, command, text }) => {
  if (!text) throw `di mana teksnya?\n\ncontoh: ${usedPrefix + command} menu`

  const pluginMap = global.pluginFiles || {}
  const pluginNames = Object.keys(global.plugins || {})
  const requested = normalizeName(text)
  const candidates = pluginNames.filter(name => {
    const clean = normalizeName(name)
    return clean === requested || name === text || name === `${text}.ts` || name === `${text}.js`
  })

  const listPlugins = pluginNames.map(name => {
    if (String(name).startsWith('ws/plugins/')) return name.replace(/\.(ts|js)$/i, '')
    return `plugins/${name.replace(/\.(ts|js)$/i, '')}`
  })

  if (!candidates.length) return m.reply(`
'${text}' tidak ditemukan!
${listPlugins.slice(0, 180).join('\n').trim()}
${listPlugins.length > 180 ? `\n... dan ${listPlugins.length - 180} plugin lain` : ''}
`.trim())

  const key = candidates[0]
  const filename = pluginMap[key] || path.resolve(process.cwd(), key.startsWith('ws/plugins/') ? key : path.join('plugins', key))
  if (!fs.existsSync(filename)) return m.reply(`File plugin terdaftar, tapi file fisiknya tidak ditemukan:\n${key}`)

  const code = fs.readFileSync(filename, 'utf8')
  const maxLength = 4000
  const plain = code.length > maxLength ? code.slice(0, maxLength) + '\n... (terpotong)' : code
  await m.reply('```' + plain + '```\nKode ditampilkan sebagai text biasa.')
}

handler.help = ['getplugin'].map(v => v + ' [filename]')
handler.tags = ['owner']
handler.command = /^(getplugin|get ?plugin|gp)$/i
handler.rowner = true

export default handler

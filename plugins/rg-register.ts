// @ts-nocheck
import { createHash } from 'crypto'

let handler = async function (m, { conn, text, usedPrefix, command }) {

  text = text || m.text || ''
  text = text.trim()

  let user = global.db.data.users[m.sender]

  if (user.registered)
    return m.reply(`✳️ Kamu sudah terdaftar.\nGunakan ${usedPrefix}unreg <sn> untuk menghapus registrasi.`)

  let contoh = `✳️ Cara pakai yang benar:
${usedPrefix + command} Nama+Umur+Gender

Contoh:
${usedPrefix + command} FG+20+M

M = Laki-laki
F = Perempuan
N = Lainnya`

  // 🔥 Pisah manual (tanpa regex ribet)
  let parts = text.split('+')

  if (parts.length !== 3) return m.reply(contoh)

  let name = parts[0].trim()
  let age = parseInt(parts[1])
  let gen = parts[2].trim().toUpperCase()

  if (!name || !age || !gen) return m.reply(contoh)

  if (name.length > 30)
    return m.reply('✳️ Namanya kepanjangan.')

  if (age < 10)
    return m.reply('🚼 Kamu masih terlalu kecil.')

  if (age > 60)
    return m.reply('👴🏻 Wah kakek/nenek masih mau main juga.')

  if (!['M','F','N'].includes(gen))
    return m.reply('✳️ Gender tidak valid. Gunakan M, F atau N.')

  let genero =
    gen === 'M' ? '🙆🏻‍♂️ Laki-laki' :
    gen === 'F' ? '🤵🏻‍♀️ Perempuan' :
    '⚧ Lainnya'

  user.name = name
  user.age = age
  user.genero = genero
  user.regTime = Date.now()
  user.registered = true

  let sn = createHash('md5').update(m.sender).digest('hex')

  let msg = `
┌─「 TERDAFTAR 」─
▢ Nama: ${name}
▢ Umur: ${age}
▢ Gender: ${genero}
▢ Serial:
${sn}
└──────────────`

  await conn.reply(m.chat, msg.trim(), m)
}

handler.help = ['reg Nama+Umur+Gender']
handler.tags = ['rg']
handler.command = ['reg','register','registrar','verify']

export default handler
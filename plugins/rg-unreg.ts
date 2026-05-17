// @ts-nocheck
import { createHash } from 'crypto'
let handler = async function (m, { conn, args, usedPrefix}) {
  if (!args[0]) throw `✳️ Cek nomor seri kamu dengan perintah\n\n${usedPrefix}nserie`
  let user = global.db.data.users[m.sender]
  let sn = createHash('md5').update(m.sender).digest('hex')
  if (args[0] !== sn) throw `⚠️ *Nomor seri salah*`
  user.registered = false
  user.rgenero = false
  m.reply(`✅ Registrasi dihapus`, null, fwc)
}
handler.help = ['unreg <Nomor Seri>'] 
handler.tags = ['rg']
handler.command = ['unreg'] 
handler.register = true

export default handler

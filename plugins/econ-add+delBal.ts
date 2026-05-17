// @ts-nocheck
let handler = async (m, { conn, text, args, usedPrefix, command }) => {
  let who
  if (m.isGroup) who = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : false
  else who = m.chat

    let user = global.db.data.users[who]
    if (!who) throw `✳️ Tag salah satu pengguna`
    if (!(who in global.db.data.users)) throw `✳️ Pengguna belum terdaftar di DB`
  let txt = text.replace('@' + who.split`@`[0], '').trim()
  if (!txt) return m.reply(`✳️ Cara pakai:\n\n📌Contoh : *${usedPrefix + command}* @${m.sender.split`@`[0]} 20`, null, { mentions: [m.sender] }) 
  if (isNaN(txt)) throw `🔢 Masukkan hanya angka`
  
  let adx = parseInt(txt)
  if (adx < 1) throw '✳️ Minimal *1*'
  let users = global.db.data.users 
  
 let type = (command).toLowerCase()
 
switch (type) {
	case 'addxp':
	case 'add-xp':
  users[who].exp += adx
  await m.reply(`≡ *XP Ditambahkan* 🆙
┌──────────────
▢ *Total:* +${adx}
└──────────────`)
 conn.fakeReply(m.chat, `▢ Kamu menerima \n\n *+${adx} XP*`, who, m.text)
 break
 case 'addcoin':
  users[who].bank += adx
  await m.reply(`≡ *COINS DITAMBAHKAN* 🪙
┌──────────────
▢ *Total:* +${adx}
└──────────────`)
 conn.fakeReply(m.chat, `▢ Kamu menerima \n\n *+${adx} Coins*`, who, m.text)
 break 
 case 'adddi':
 case 'add-di':
 case 'adddiamond':
  users[who].diamond += adx
  await m.reply(`≡ *Diamond Ditambahkan* 💎
┌──────────────
▢ *Total:* +${adx}
└──────────────`)
 conn.fakeReply(m.chat, `▢ Kamu menerima \n\n *+${adx} Diamond*`, who, m.text)
 break
 case 'delxp':
 case 'removexp':
 case 'del-xp':
  if (user.exp < adx) return m.reply(`❇️ @${who.split`@`[0]} tidak punya *${adx} XP*`, null, { mentions: [who] })
   users[who].exp -= adx 
  await m.reply(`≡ *XP Dikurangi* 🆙
┌──────────────
▢ *Total:* -${adx}
└──────────────`)
 break 
 case 'delcoin':
   users[who].bank -= adx 
  await m.reply(`≡ *COINS DIKURANGI* 🪙
┌──────────────
▢ *Total:* -${adx}
└──────────────`)
 break
 case 'deldi':
 case 'removedi':
 case 'del-di':
  if (user.diamond < adx) return m.reply(`❇️ @${who.split`@`[0]} tidak punya *${adx} Diamond*`, null, { mentions: [who] })
  users[who].diamond -= adx 
  await m.reply(`≡ *Diamond Dikurangi* 💎
┌──────────────
▢ *Total:* -${adx}
└──────────────`)
 break 
 case 'addlvl':
  users[who].level += adx 
  await m.reply(`≡ *LEVEL DITAMBAHKAN* ⬆️
┌──────────────
▢ *Total:* +${adx}
└──────────────`)
 break 

 case 'removelvl':
  if (user.level < adx) return m.reply(`❇️ @${who.split`@`[0]} tidak punya *${adx} Level*`, null, { mentions: [who] })
  users[who].level -= adx 
  await m.reply(`≡ *LEVEL DIKURANGI* 
┌──────────────
▢ *Total:* -${adx}
└──────────────`)
 break 
 
 default:
 }
 
}
handler.command = /^(delcoin|addcoin|addxp|add-xp|adddi|add-di|adddiamond|delxp|del-xp|del-di|deldi|removexp|removedi|addlvl|removelvl)$/i
handler.rowner = true

export default handler
// @ts-nocheck
let handler = async (m, { conn, usedPrefix, command, args }) => {
  
  m.reply(`
┌───⊷ *SHOP* ⊶
▢ _01_ - Diamond = 200🪙
▢ _02_ - Premium =  1h 50💎  (1d 800💎)
└────────────── 

Kamu bisa membeli dengan *${usedPrefix}buy* <ID> <jumlah>

📌 Contoh:
*${usedPrefix}buy* 01 20
*${usedPrefix}buy* 02 1h
  `, null, fwc)
}
handler.help = ['shop']
handler.tags = ['econ']
handler.command = ['shop', 'tienda'] 

export default handler
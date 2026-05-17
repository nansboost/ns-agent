// @ts-nocheck
let handler = async function (m, { conn, text, usedPrefix }) {
	
	let chat = global.db.data.chats[m.chat]
    if (chat.rules === '') throw `✳️ Grup ini belum memiliki rules`
     m.reply(`📜 *Peraturan Grup*\n\n${chat.rules}`, null, fwc)
     
}
handler.help = ['rules']
handler.tags = ['group']
handler.command = ['rules', 'reglas'] 

export default handler
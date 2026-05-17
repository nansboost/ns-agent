// @ts-nocheck
let handler = async (m, { conn, text, isROwner, isOwner }) => {
  if (text) {
    global.db.data.chats[m.chat].sBye = text
    m.reply(`✅ Pesan goodbye berhasil diset`)
  } else throw `✳️ Masukkan pesan goodbye\n\n@user (mention)`
}
handler.help = ['setbye <text>']
handler.tags = ['group']
handler.command = ['setbye'] 
handler.admin = true
handler.owner = false

export default handler
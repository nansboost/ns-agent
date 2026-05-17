// @ts-nocheck
let handler = async (m, {conn, usedPrefix}) => {	
    let who = m.quoted ? m.quoted.sender : m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.fromMe ? conn.user.jid : m.sender
    let user = global.db.data.users[who]
    if (!(who in global.db.data.users)) throw `✳️ Pengguna belum terdaftar`
    conn.reply(m.chat, `
 ≡ *Nama:* @${who.split('@')[0]}

 💰 *DOMPET*
┌───⊷
▢ *💎Diamantes:* _${user.diamond.toLocaleString()}_
▢ *🪙Coins:* _${user.coin.toLocaleString()}_
└──────────────

🏦 *BANK*
┌───⊷
▢ *🪙Coins:* _${user.bank.toLocaleString()}_
└──────────────
`, m, { mentions: [who] })
}
handler.help = ['balance']
handler.tags = ['econ']
handler.command = ['bal', 'diamantes', 'diamond', 'balance'] 

export default handler

// @ts-nocheck

let handler = async (m, { conn, args, usedPrefix, command }) => {
   
let exa = `✳️ Penggunaan perintah
*${usedPrefix + command}*  [Tipe] [Jumlah] [@user]

📌 Contoh : 
*${usedPrefix + command}* coin 65 @${m.sender.split('@')[0]}

📍 Item yang dapat ditransfer
┌──────────────
▢ *diamond* = Diamante} 💎
▢ *coin* = Coins 🪙
└──────────────`

 if (!args[0] || !args[1] ) return m.reply(exa, null, { mentions: [m.sender] })
    
    let type = args[0].toLowerCase()
    let amount = parseInt(args[1])
    let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : args[2] ? (args[2].replace(/[@ .+-]/g, '') + '@s.whatsapp.net') : ''
    if (!who) return m.reply(`✳️ Sebutkan seseorang`)
    
    if (!['coin', 'diamond'].includes(type)) return m.reply(exa, null, { mentions: [m.sender] })
    
    if (isNaN(amount) || amount <= 1) throw `✳️ Harus berupa nomor valid`
    
    let user = global.db.data.users[m.sender]
    let whoData = global.db.data.users[who]
    
    if (!whoData) return m.reply(`✳️ Pengguna tidak ada di database saya`)
    
    let currencyName = type === 'coin' ? `Coin` : `Diamante`
    
    if (user[type] < amount) throw `✳️ *${currencyName}* Tidak cukup untuk transfer`
    
    user[type] -= amount;
    whoData[type] += amount;
    
    m.reply(`✅ Transfer berhasil dilakukan untuk \n\n*${amount}* *${currencyName}* ke @${who.split('@')[0]}.`, null, { mentions: [who] })
}
handler.help = ['transfer'].map(v => v + ' [Tipe] [Jumlah] [@tag]')
handler.tags = ['econ']
handler.command = ['payxp','paydi', 'transfer', 'darxp','dardi', 'pay']
handler.disabled = false

export default handler


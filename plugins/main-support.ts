// @ts-nocheck
let handler = async (m, { conn }) => {

m.reply(`
≡  *${botName}ᴮᴼᵀ ┃ SUPPORT*

◈ ━━━━━━━━━━━━━━━━━━━━ ◈
▢ Channel
${fg_canal}

▢ Channel Log
${canal_log}

▢ Grup *1*
${fg_group}

▢ Grup *NSFW* 🔞 
${fg_gpnsfw}

◈ ━━━━━━━━━━━━━━━━━━━━ ◈
▢ Semua grup
 https://instabio.cc/fg98ff

▢ *Telegram*
• https://t.me/fg_userss
▢ *PayPal*
• https://paypal.me/fg98f
▢ *YouTube*
• https://www.youtube.com/fg98f`)

}
handler.help = ['support']
handler.tags = ['main']
handler.command = ['grupos', 'groups', 'support'] 

export default handler

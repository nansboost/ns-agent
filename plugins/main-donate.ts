// @ts-nocheck
let handler = async(m, { conn, usedPrefix, command }) => {

    let don = `
≡ *DONASI*\nKamu bisa donasi jika ingin membantu agar bot tetap aktif

▢ *PayPal*
• *Link :* https://paypal.me/fg98f

▢ *Uala Arg*
• *Alias :* fg.error
`
let img = 'https://i.ibb.co/37FP2bk/donate.jpg'
conn.sendFile(m.chat, img, 'img.jpg', don, m, null, fwc)
//conn.sendPayment(m.chat, '2000', 'USD', don, m.sender, m)
}

handler.help = ['donate']
handler.tags = ['main']
handler.command = ['apoyar', 'donate', 'donar'] 

export default handler


// @ts-nocheck
let handler = async (m, { conn, usedPrefix }) => {

let text = `🎰 *ROULETTE CASINO*

Kamu bisa bertaruh di berbagai posisi di roulette.

📌 *Cara pakai*
${usedPrefix}roulette <jumlah> <space>

💰 *Multiplier pembayaran*

🎯 *x36* → Angka tepat  
• Contoh: 7, 12, 30

📦 *x3* → Dozen  
• 1-12  
• 13-24  
• 25-36  

📊 *x3* → Kolom  
• 1st  
• 2nd  
• 3rd  

🔢 *x2* → Paruh  
• 1-18  
• 19-36  

⚖️ *x2* → Ganjil / Genap  
• odd  
• even  

🎨 *x2* → Warna  
• red  
• black  

🧪 *Contoh*
${usedPrefix}roulette 200 odd
${usedPrefix}roulette 600 2nd
${usedPrefix}roulette 500 17
`

let img = "https://i.ibb.co/YjsxJwR/ruleta.png"

await conn.sendFile(m.chat, img, "ruleta.jpg", text, m)
}

handler.help = ["roulette-info"]
handler.tags = ["game"]
handler.command = ['roulette-info','ruleta-info','info-ruleta']

export default handler
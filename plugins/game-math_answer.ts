// @ts-nocheck
let handler = m => m

handler.before = async function (m) {

if (!m.text) return !0
if (isNaN(m.text)) return !0

this.math = this.math ? this.math : {}
let id = m.chat

// tidak ada game aktif
if (!(id in this.math)) return !0

let mathData = this.math[id]
let math = mathData[1]

// 🔒 Hanya terima jawaban yang reply pesan soal
if (!m.quoted) return !0
if (m.quoted.id !== mathData[0].id) return !0

// pastikan user ada
if (!global.db.data.users[m.sender])
global.db.data.users[m.sender] = { coin: 0 }

let user = global.db.data.users[m.sender]
if (!user.coin) user.coin = 0

// jawaban benar
if (Number(m.text) === Number(math.result)) {

user.coin += math.bonus

clearTimeout(mathData[3])
delete this.math[id]

m.reply(`✅ *Jawaban benar!*\n\n🎁 Kamu mendapat *+${math.bonus} 🪙*`)

} else {

mathData[2]--

if (mathData[2] <= 0) {

clearTimeout(mathData[3])
delete this.math[id]

m.reply(`❌ *Kesempatan habis*\n\n📌 Jawaban: *${math.result}*`)

} else {

m.reply(`❎ *Salah*\n\n🔄 Sisa kesempatan *${mathData[2]}*`)
}

}

return !0
}

export default handler
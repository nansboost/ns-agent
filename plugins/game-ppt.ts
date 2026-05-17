// @ts-nocheck
let poin = 200
let cooldown = 15000

let handler = async (m, { args, usedPrefix, command }) => {

  if (!args[0]) {
    throw `✳️ Gunakan command seperti ini:\n\n${usedPrefix + command} batu\n${usedPrefix + command} kertas\n${usedPrefix + command} gunting`
  }

  let text = args[0].toLowerCase()
  let user = global.db.data.users[m.sender]

  if (!user) global.db.data.users[m.sender] = { coin: 0, lastppt: 0 }
  if (!user.coin) user.coin = 0
  if (!user.lastppt) user.lastppt = 0

  if (new Date - user.lastppt < cooldown) {
    let waktu = msToTime((user.lastppt + cooldown) - new Date())
    throw `⏳ Tunggu ${waktu} untuk bermain lagi`
  }

  if (user.coin < poin) {
    return m.reply(`❌ Kamu butuh minimal ${poin} 🪙 untuk bermain`)
  }

  let pilihan = ['batu', 'kertas', 'gunting']
  if (!pilihan.includes(text)) {
    throw `✳️ Pilihan yang valid:\n- batu\n- kertas\n- gunting`
  }

  let bot = pilihan[Math.floor(Math.random() * pilihan.length)]
  user.lastppt = new Date * 1

  let hasil = ''
  let perubahan = 0

  if (text === bot) {
    hasil = '🤝 Seri'
    perubahan = 10
  } else if (
    (text === 'batu' && bot === 'gunting') ||
    (text === 'gunting' && bot === 'kertas') ||
    (text === 'kertas' && bot === 'batu')
  ) {
    hasil = '🎉 Kamu menang'
    perubahan = poin
  } else {
    hasil = '😔 Kamu kalah'
    perubahan = -poin
  }

  user.coin += perubahan

  m.reply(
`🎮 Batu, Kertas, Gunting

👤 Kamu: ${text}
🤖 Bot: ${bot}

${hasil}
${perubahan > 0 ? `+${perubahan}` : perubahan} 🪙`
  )
}

handler.help = ['ppt <batu|kertas|gunting>']
handler.tags = ['game']
handler.command = ['ppt']

export default handler

function msToTime(duration) {
  let seconds = Math.floor((duration / 1000) % 60)
  if (seconds < 10) seconds = "0" + seconds
  return seconds + " detik"
}
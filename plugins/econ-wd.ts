// @ts-nocheck
let handler = async (m, { conn, text, usedPrefix, command, args }) => {
 
  if (!text) throw `✳️ Berapa *Coins* yang mau kamu tarik?`

  let user = global.db.data.users[m.sender]
  
  if (args[0].toLowerCase() !== 'all' && !/^[1-9]\d*$/.test(args[0])) throw `✳️ Harus berupa angka yang valid`
  let all =  Math.floor(global.db.data.users[m.sender].bank)
  let count = args[0].replace('all', all)
   count = Math.max(1, count)

  if (isNaN(count)) throw `✳️ Harus berupa angka yang valid`
  if (count > user.bank) throw `✳️ Kamu tidak bisa menarik lebih banyak dari saldo bank`

    user.bank -= count
    user.coin += count

    m.reply(`✅ Kamu menarik *${count.toLocaleString()}🪙*`, null, fwc)
  
}
handler.help = ['wd']
handler.tags = ['econ']
handler.command = ['withdraw','wd', 'retirar']

export default handler
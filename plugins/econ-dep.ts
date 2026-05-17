// @ts-nocheck
let handler = async (m, { conn, text, usedPrefix, command, args }) => {
 
    if (!text) throw `✳️ Cara pakai:\n\n*${usedPrefix + command}* <jumlah atau all>`
  
   if (args[0].toLowerCase() !== 'all' && !/^[1-9]\d*$/.test(args[0])) throw `✳️ Jumlah harus berupa angka yang valid`
    let all =  Math.floor(global.db.data.users[m.sender].coin)
    let count = args[0].replace('all', all)
     count = Math.max(1, count)
     
    if (global.db.data.users[m.sender].coin >= count) {
      global.db.data.users[m.sender].coin -= count
      global.db.data.users[m.sender].bank += count
  
      m.reply(`✅ Kamu menyimpan *${count}🪙* ke Bank`, null, fwc)
    } else m.reply(`❎ Coin kamu tidak cukup untuk deposit`, null, fwc)
  
  }
  handler.help = ['dep']
  handler.tags = ['econ']
  handler.command = ['dep','depositar'] 
  
  export default handler
  
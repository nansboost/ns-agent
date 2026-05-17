// @ts-nocheck
function handler(m) {
   let data = global.owner.filter(([id, isCreator]) => id && isCreator);

    let numberowner = data[0]?.[0] || ''
    let gmail = "nansboost@gmail.com"
    let instagram = fg_ig
    let onum = 'Nomor owner'

    const contacts = data.map(([id, name]) => [id, name, numberowner, gmail, instagram, onum])

    this.sendContact(m.chat, contacts, m)
    
}
handler.help = ['owner']
handler.tags = ['main']
handler.command = ['owner', 'creator', 'pemilik', 'ownerbot', 'fgowner'] 

export default handler

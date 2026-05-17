// @ts-nocheck

let handler = async (m, { conn, isAdmin, isBotAdmin, args, participants, groupMetadata }) => {
	
    if (!args[0] || isNaN(args[0])) return m.reply(`✳️ Masukkan awalan nomor yang valid`)
    let prefix = args[0].replace(/[+]/g, '')
    let groupAdmins = participants.filter(p => p.admin)
    let ownergp = groupMetadata.owner || groupAdmins.find(p => p.admin === 'superadmin')?.id || m.chat.split`-`[0] + '@s.whatsapp.net'

    const delay = (time) => new Promise((res)=>setTimeout(res, time));

    let gpUser = participants.map(u => u.id).filter(v => v !== conn.user.jid && v.startsWith(prefix) && v !== ownergp)
    if (gpUser.length === 0) return m.reply(`✳️ Grup tidak memiliki anggota dengan awalan +${prefix}`)

    m.reply(`✅ Menghapus *${gpUser.length}* pengguna dari grup`)

    for (const users of gpUser) {
        try {
                await delay(1000)
                await conn.groupParticipantsUpdate(m.chat, [users], 'remove')
                await delay(10000)
           
        } catch (error) {
            console.log(error)
        }
    }
    m.reply(`✅ Penghapusan Selesai`)
}
handler.help = ['kickpre <54>']
handler.tags = ['group']
handler.command = ['kickpre', 'kickprefix']
handler.admin = true
handler.group = true
handler.owner = false
handler.botAdmin = true

export default handler
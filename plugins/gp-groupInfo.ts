// @ts-nocheck
let handler = async (m, { conn, participants, groupMetadata }) => {
    const pp = await conn.profilePictureUrl(m.chat, 'image').catch(_ => null) || './src/avatar_contact.png'
    const { isBanned, welcome, detect, sWelcome, sBye, sPromote, sDemote, antiLink, nsfw, captcha, useDocument } = global.db.data.chats[m.chat]
    const groupAdmins = participants.filter(p => p.admin)
    const listAdmin = groupAdmins.map((v, i) => `${i + 1}. @${v.id.split('@')[0]}`).join('\n')
    const owner = groupMetadata.owner || groupAdmins.find(p => p.admin === 'superadmin')?.id || m.chat.split`-`[0] + '@s.whatsapp.net'
    let text = `
┌──「 *INFO GRUP* 」
▢ *♻️ID:*
   • ${groupMetadata.id} 
▢ *🔖Nama:* 
• ${groupMetadata.subject}
▢ *👥Member:* ${participants.length}
▢ *🤿Owner grup:*
• wa.me/${owner.split('@')[0]}
▢ *🕵🏻‍♂️Jumlah admin:* ${groupAdmins.length}

▢ *🪢 Pengaturan grup:*
• 📮 *Welcome:* ${welcome ? '✅' : '❎'}
• ❕ *Detect:* ${detect ? '✅' : '❎'}
• 🔞 *Nsfw:* ${nsfw ? '✅' : '❎'}
• 🚨 *Anti Link Wha:* ${antiLink ? '✅' : '❎'}
• 🧬 *Captcha:* ${captcha ? '✅' : '❎'}
• 📑 *Document:* ${useDocument ? '✅' : '❎'}

*▢  📬 Pengaturan Pesan:*
• *Welcome:* ${sWelcome}
• *Bye:* ${sBye}

▢ *📌Deskripsi* :
   • ${groupMetadata.desc?.toString() || 'Tidak diketahui'}
`.trim()
    conn.sendFile(m.chat, pp, 'pp.jpg', text, m, null, fwc)
}

handler.help = ['infogp']
handler.tags = ['group']
handler.command = ['infogrupo', 'groupinfo', 'infogp'] 
handler.group = true

export default handler
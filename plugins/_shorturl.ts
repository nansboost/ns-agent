// @ts-nocheck
import fetch from 'node-fetch'

let handler = async (m, { conn, args, usedPrefix, command }) => {
    // 1. Validasi Input: Master harus kasih link!
    if (!args[0]) throw `📌 *Contoh:* ${usedPrefix + command} https://google.com [alias]`
    
    // Kasih reaksi biar Master tahu aku sedang bekerja (terpaksa!)
    if (global.rwait) m.react(global.rwait)

    let longUrl = args[0]
    let alias = args[1] || '' // Alias bersifat opsional

    try {
        // 2. Panggil API xnsz.tech milik Master
        let res = await fetch(`https://xnsz.tech/api/shorten`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: longUrl,
                custom_alias: alias
            })
        })

        let json = await res.json()

        // 3. Penanganan jika API memberi respon gagal
        if (!json.status) {
            return m.reply(`❎ *Gagal:* ${json.error}\n\n_Hmph! Mungkin alias sudah dipakai atau URL-mu aneh!_`)
        }

        // 4. Susun Pesan Berhasil
        let { short_url } = json.result
        let qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${short_url}&color=000000`

        let caption = `

*XNSZ SHORTENER*

*Status:* Berhasil!
*Short URL:* ${short_url}
*Original:* ${longUrl}

_Scan QR di atas untuk membuka link!_
`.trim()

        // 5. Kirim QR Code sebagai gambar dengan caption link pendek
        await conn.sendFile(m.chat, qrUrl, 'qrcode.png', caption, m)
        
        if (global.done) m.react(global.done)

    } catch (e) {
        console.error(e)
        m.reply('❎ *Error:* Terjadi kesalahan internal pada server xnsz.tech!')
    }
}

handler.help = ['shorten <url> <alias>']
handler.tags = ['tools']
handler.command = /^(shorten|short|slink|xnsz)$/i

export default handler
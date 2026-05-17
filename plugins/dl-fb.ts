// @ts-nocheck
import fetch from 'node-fetch'

let handler = async (m, { conn, args, usedPrefix, command }) => {
    if (!args[0]) throw `*Contoh:* ${usedPrefix}${command} https://www.facebook.com/watch/?v=1393572814172251`

    if (!args[0].match(/facebook|fb.watch/gi)) {
        throw `Cih, itu bukan URL Facebook yang valid! Masukkan link yang benar!`
    }

    await m.reply('_Sedang aku proses videonya... Tunggu sebentar, bukan berarti aku peduli ya!_')

    try {
        let success = false
        let videoUrl = null
        let usedServer = 'Betabotz'

        // --- TRY SERVER 1: BETABOTZ ---
        try {
            const api = await fetch(`https://api.betabotz.eu.org/api/download/fbdown?url=${args[0]}&apikey=${global.lann || 'isi_apikey_lann'}`)
            const res = await api.json()
            
            // Betabotz biasanya pakai result[0]._url
            if (res.result && res.result[0] && res.result[0]._url) {
                videoUrl = res.result[0]._url
                success = true
            }
        } catch (e) {
            console.log("Betabotz FB Error, mencoba server Botcahx...")
        }

        // --- TRY SERVER 2: BOTCAHX ---
        if (!success) {
            usedServer = 'Botcahx'
            try {
                const api = await fetch(`https://api.botcahx.eu.org/api/dowloader/fbdown3?url=${args[0]}&apikey=${global.btc || 'isi_apikey_btc'}`)
                const res = await api.json()
                
                // Botcahx strukturnya result.url.urls (Array of SD/HD)
                if (res.result && res.result.url && res.result.url.urls) {
                    let urls = res.result.url.urls
                    // Cari yang HD dulu, kalau tidak ada baru SD
                    let findUrl = urls.find(u => u.hd) || urls.find(u => u.sd)
                    if (findUrl) {
                        videoUrl = findUrl.hd || findUrl.sd
                        success = true
                    }
                }
            } catch (e) {
                throw 'Cih! Semua server API Facebook sedang mogok kerja! Coba lagi nanti!'
            }
        }

        if (!videoUrl) throw 'Gagal mendapatkan URL video dari tautan tersebut.'

        const caption = `*Facebook Downloader*\nServer: ${usedServer}\n\n_Nih videonya, tonton saja sendiri, jangan ajak aku!_`

        // Kirim Video
        await conn.sendFile(m.chat, videoUrl, 'fb.mp4', caption, m)

    } catch (e) {
        console.error(e)
        conn.reply(m.chat, `*Error:* ${e.message || 'Terjadi kesalahan teknis!'}`, m)
    }
}

handler.help = ['facebook'].map(v => v + ' <url>')
handler.tags = ['downloader']
handler.command = /^(fb|facebook|facebookdl|fbdl|fbdown|dlfb)$/i
handler.limit = true

export default handler
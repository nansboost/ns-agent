// @ts-nocheck
import fetch from 'node-fetch'

let handler = async (m, { conn, args, usedPrefix, command }) => {
    if (!args[0]) throw `*Hmph!* Masukkan URL atau judul lagu Spotify!\n\n*Contoh Link:* ${usedPrefix + command} https://open.spotify.com/track/xxxx\n*Contoh Cari:* ${usedPrefix + command} Lathi`

    const isUrl = args[0].match(/spotify.com/gi)
    await m.reply('_Tunggu sebentar... Sedang aku proses, jangan bawel ya!_')

    try {
        if (isUrl) {
            // --- MODE DOWNLOAD (Jika input adalah Link) ---
            let success = false
            let resData = null
            let usedServer = 'Betabotz'

            // Try Betabotz First
            try {
                const api = await fetch(`https://api.betabotz.eu.org/api/download/spotify?url=${args[0]}&apikey=${global.lann || 'isi_apikey_lann'}`)
                const json = await api.json()
                if (json.result && json.result.data) {
                    resData = json.result.data
                    success = true
                }
            } catch (e) {
                console.log("Betabotz Spotify Error, mencoba Botcahx...")
            }

            // Fallback to Botcahx
            if (!success) {
                usedServer = 'Botcahx'
                try {
                    const api = await fetch(`https://api.botcahx.eu.org/api/download/spotify?url=${args[0]}&apikey=${global.btc || 'isi_apikey_btc'}`)
                    const json = await api.json()
                    if (json.result && json.result.data) {
                        resData = json.result.data
                        success = true
                    }
                } catch (e) {
                    throw 'Cih! Semua server Spotify sedang mogok kerja!'
                }
            }

            const { thumbnail, title, duration, url, artist } = resData
            let capt = `∘ *Title* : ${title}\n` +
                       `∘ *Artist* : ${artist?.name || 'Unknown'}\n` +
                       `∘ *Duration* : ${duration}\n` +
                       `∘ *Server* : ${usedServer}\n\n` +
                       `_Sedang mengirim audio..._`

            // Kirim info dengan thumbnail besar
            await conn.sendMessage(m.chat, {
                text: capt
            }, { quoted: m })

            // Kirim Audio secara Normal (Sesuai permintaanmu sebelumnya)
            await conn.sendMessage(m.chat, {
                audio: { url: url },
                mimetype: 'audio/mpeg'
            }, { quoted: m })

        } else {
            // --- MODE SEARCH (Jika input adalah Judul) ---
            const text = args.join(" ")
            const api = await fetch(`https://api.botcahx.eu.org/api/search/spotify?query=${encodeURIComponent(text)}&apikey=${global.btc || 'isi_apikey_btc'}`)
            const json = await api.json()
            
            if (!json.result || !json.result.data) throw 'Lagu tidak ditemukan!'
            let res = json.result.data
            let teks = `*SPOTIFY SEARCH*\n\n`
            
            for (let i in res) {
                teks += `*${parseInt(i) + 1}.* ${res[i].title}\n`
                teks += `◦ Durasi: ${res[i].duration}\n`
                teks += `◦ Link: ${res[i].url}\n\n`
            }

            await conn.sendMessage(m.chat, {
                text: teks,
                mentions: [m.sender]
            }, { quoted: m })
        }
    } catch (e) {
        console.error(e)
        conn.reply(m.chat, `*Error:* ${e.message || 'Terjadi kesalahan teknis!'}`, m)
    }
}

handler.help = ['spotify']
handler.tags = ['downloader']
handler.command = /^(spotify)$/i
handler.limit = true

export default handler
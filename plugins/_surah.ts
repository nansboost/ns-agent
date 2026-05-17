// @ts-nocheck
// Hmph! Perhatikan baris di bawah ini, jangan sampai salah lagi!
import * as cheerio from 'cheerio'
import axios from 'axios'

const SCRAPE_URL = "https://www.mp3quran.net/eng/afs/downloads"
const daftarSurah = ["Al-Fatihah","Al-Baqarah","Ali 'Imran","An-Nisa","Al-Ma'idah","Al-An'am","Al-A'raf","Al-Anfal","At-Tawbah","Yunus","Hud","Yusuf","Ar-Ra'd","Ibrahim","Al-Hijr","An-Nahl","Al-Isra","Al-Kahf","Maryam","Ta-Ha","Al-Anbiya","Al-Hajj","Al-Mu'minun","An-Nur","Al-Furqan","Ash-Shu'ara","An-Naml","Al-Qasas","Al-Ankabut","Ar-Rum","Luqman","As-Sajdah","Al-Ahzab","Saba","Fatir","Ya-Sin","As-Saffat","Sad","Az-Zumar","Ghafir","Fussilat","Ash-Shura","Az-Zukhruf","Ad-Dukhan","Al-Jathiyah","Al-Ahqaf","Muhammad","Al-Fath","Al-Hujurat","Qaf","Adh-Dhariyat","At-Tur","An-Najm","Al-Qamar","Ar-Rahman","Al-Waqi'ah","Al-Hadid","Al-Mujadila","Al-Hashr","Al-Mumtahanah","As-Saff","Al-Jumu'ch","Al-Munafiqun","At-Taghabun","At-Talaq","At-Tahrim","Al-Mulk","Al-Qalam","Al-Haqqah","Al-Ma'arij","Nuh","Al-Jinn","Al-Muzzammil","Al-Muddaththir","Al-Qiyamah","Al-Insan","Al-Mursalat","An-Naba","An-Nazi'at","Abasa","At-Takwir","Al-Infitar","Al-Mutaffifin","Al-Inshiqaq","Al-Buruj","At-Tariq","Al-A'la","Al-Ghashiyah","Al-Fajr","Al-Balad","Ash-Shams","Al-Lail","Ad-Duha","Ash-Sharh","At-Tin","Al-'Alaq","Al-Qadr","Al-Bayyinah","Az-Zalzalah","Al-Adiyat","Al-Qari'ah","At-Takathur","Al-Asr","Al-Humazah","Al-Fil","Quraysh","Al-Ma'un","Al-Kawthar","Al-Kafirun","An-Nasr","Al-Masad","Al-Ikhlas","Al-Falaq","An-Nas"]

let handler = async (m, { conn, args, usedPrefix, command }) => {
    if (!args[0]) {
        let caption = `*≡ DAFTAR SURAH AL-QUR'AN*\n\n`
        daftarSurah.forEach((v, i) => {
            caption += `*${i + 1}.* ${v}\n`
        })
        caption += `\n_Ketik *${usedPrefix + command} <nomor>* untuk mendownload audio._`
        return m.reply(caption)
    }

    let n = parseInt(args[0])
    if (isNaN(n) || n < 1 || n > 114) throw `*Hiiih!* Masukkan nomor 1-114 saja, jangan ngaco!`

    if (m.react) m.react('⏳')

    try {
        const { data } = await axios.get(SCRAPE_URL)
        // Pakai cheerio.load() karena kita import * as cheerio
        const $ = cheerio.load(data)
        const audioList = []

        $("a[href$='.mp3']").each((_, el) => {
            const href = $(el).attr("href")
            if (href) audioList.push(new URL(href, SCRAPE_URL).href)
        })

        const kode = String(n).padStart(3, "0")
        const audioUrl = audioList.find(url => url.includes(`/${kode}.mp3`))

        if (!audioUrl) throw 'Audionya tidak ketemu, mungkin servernya lagi maintenance!'

        let name = daftarSurah[n - 1]
        
        await conn.sendMessage(m.chat, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            ptt: false
        }, { quoted: m })

        if (m.react) m.react('✅')

    } catch (e) {
        console.error(e)
        m.reply(`*Error!* Masalahnya: ${e.message}`)
        if (m.react) m.react('✖️')
    }
}

handler.help = ['surah', 'quran']
handler.tags = ['islamic']
handler.command = /^(surah|quran|listsurah)$/i

export default handler
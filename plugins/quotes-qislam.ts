// @ts-nocheck
import fs from 'fs'

/**
 * Handler ini berfungsi untuk mengambil kutipan dari qislam.json.
 * Jika tanpa argumen, akan menampilkan daftar tokoh.
 * Jika dengan angka, akan mengambil kutipan acak dari tokoh tersebut.
 */
let handler = async (m, { conn, text }) => {
    try {
        // Membaca data dari qislam.json
        if (!fs.existsSync('./lib/qislam.json')) {
            return m.reply("Hmph, file 'qislam.json' tidak ada. Kamu taruh di mana sih?")
        }
        
        let data = JSON.parse(fs.readFileSync('./lib//qislam.json'))
        
        // Cek apakah data dalam format array author
        if (!Array.isArray(data) || !data[0].author) {
            return m.reply("Format JSON kamu salah! Harus ada array dengan properti 'author' dan 'quotes'.")
        }

        // Jika user hanya mengetik command tanpa argumen
        if (!text) {
            let listAuthor = data.map((item, index) => `${index + 1}. ${item.author}`).join('\n')
            let menu = `*─── [ DAFTAR TOKOH ] ───*\n\n`
            menu += listAuthor
            menu += `\n\nContoh penggunaan: *.qislam 1* untuk mengambil kutipan tokoh pertama.`
            return m.reply(menu)
        }

        // Jika input adalah angka
        if (!isNaN(text)) {
            let index = parseInt(text) - 1
            
            if (data[index]) {
                let selected = data[index]
                let result = pickRandom(selected.quotes)
                
                let caption = `"${result.quote}"\n\n`
                caption += `— *${selected.author}*`
                if (result.category) caption += ` (${result.category})`
                if (result.id) caption += ` [ID: ${result.id}]`
                
                return m.reply(caption.trim())
            } else {
                return m.reply(`Hmph, nomor ${text} tidak ada dalam daftar! Lihat lagi daftarnya dengan mengetik *.qislam*`)
            }
        }

        // Opsi tambahan: Jika input bukan angka, cari berdasarkan nama
        let search = text.toLowerCase()
        let foundAuthor = data.find(item => item.author.toLowerCase().includes(search))

        if (foundAuthor) {
            let result = pickRandom(foundAuthor.quotes)
            let caption = `"${result.quote}"\n\n`
            caption += `— *${foundAuthor.author}*`
            return m.reply(caption.trim())
        } else {
            m.reply(`Kutipan untuk "${text}" tidak ditemukan. Gunakan angka saja kalau kamu bingung!`)
        }

    } catch (e) {
        console.error(e)
        m.reply("Terjadi kesalahan teknis. Jangan salahkan aku, periksa lagi file JSON kamu!")
    }
}

// Perintah yang digunakan
// Khusus quotes dari lib/qislam.json. Command motivasi/quotes dipakai plugins/quotes.ts.
handler.command = /^(qislam|qislamquotes)$/i
handler.help = ['qislam <nomor>']
handler.tags = ['islamic']

export default handler

/**
 * Fungsi untuk mengambil item secara acak dari array
 */
function pickRandom(list) {
    return list[Math.floor(list.length * Math.random())]
}
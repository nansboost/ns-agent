// @ts-nocheck
import fetch from 'node-fetch'
const regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i

let handler = async (m, { conn, args, usedPrefix, command }) => {

    if (!args[0])
        throw `Masukkan link GitHub\n\n📌 Contoh : ${usedPrefix + command} https://github.com/FG98F/dylux-bot`

    if (!regex.test(args[0]))
        throw `Masukkan link GitHub yang valid`

    let [, user, repo] = args[0].match(regex)
    repo = repo.replace(/\.git$/, '')

    // 🔎 Dapatkan info repo
    let api = `https://api.github.com/repos/${user}/${repo}`
    let res = await fetch(api)
    if (!res.ok) throw 'Repositori tidak ditemukan'
    let json = await res.json()

    // 📊 Data yang diminta
    let caption = `
⭐Bintang: ${json.stargazers_count}
🍴 Fork: ${json.forks_count}

📅 Dibuat: ${json.created_at.slice(0,10)}
🔄 Diperbarui: ${json.updated_at.slice(0,10)}

👤 Pemilik: ${json.owner.login}
🔗 Profil: ${json.owner.html_url}
`.trim()

    // 📥 Link langsung yang benar
    let url = `https://codeload.github.com/${user}/${repo}/zip/refs/heads/${json.default_branch}`
    let filename = `${user}-${repo}.zip`

    await conn.sendFile(m.chat, url, filename, caption, m, false, { mimetype: 'application/zip', asDocument: true })
}
handler.help = ['gitclone <url>']
handler.tags = ['downloader']
handler.command = ['gitclone']
handler.diamond = true

export default handler
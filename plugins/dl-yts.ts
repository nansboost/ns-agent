// @ts-nocheck

import yts from 'yt-search'
let handler = async (m, {conn, text }) => {
  if (!text) throw `✳️ Masukkan yang ingin dicari di YT`
  let results = await yts(text)
	let tes = results.videos
let teks = tes.map(v => `
📌 ${v.title}
*⌚Durasi:* ${v.timestamp}
*📆Diunggah:* ${v.ago}
*👀Dilihat:* ${v.views.toLocaleString()}
*🔗Link:* ${v.url}
`.trim()).join('\n________________________\n\n')
	conn.sendFile(m.chat, tes[0].image, 'yts.jpeg', teks, m, null, fwc)
}
handler.help = ['ytsearch'] 
handler.tags = ['downloader']
handler.command = ['ytsearch', 'yts'] 

export default handler

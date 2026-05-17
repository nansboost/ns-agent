// @ts-nocheck
import sharp from 'sharp'
let handler = async (m, { conn }) => {
if (!m.quoted) throw '✳️ Balas sticker'
let q = m.quoted
if (!/sticker/.test(q.mediaType)) throw '✳️ Balas sticker'
let media = await q.download()
if (!media) throw 'Gagal mengunduh sticker'
let img = await sharp(media)
.png()
.toBuffer()
await conn.sendFile(
m.chat,
img,
'imagen.png',
'✅ Sticker diubah menjadi gambar',
m)
}
handler.help = ['toimg']
handler.tags = ['sticker']
handler.command = ['toimg','jpg','aimg']
export default handler
// @ts-nocheck
import fs from 'fs'
import { promises as fsp } from 'fs'
import archiver from 'archiver'
import path from 'path'

const formatSize = (bytes) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024
    i++
  }
  return `${bytes.toFixed(2)} ${units[i]}`
}

let handler = async (m, { conn }) => {
  const filePath = path.resolve('./database.json')
  const zipPath = path.resolve(`./database-${Date.now()}.zip`)

  try {

    // cek file
    await fsp.access(filePath)

    // ukuran file
    const stats = await fsp.stat(filePath)
    const size = formatSize(stats.size)

    // buat zip
    await new Promise((resolve, reject) => {

      const output = fs.createWriteStream(zipPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', resolve)
      archive.on('error', reject)

      archive.pipe(output)
      archive.file(filePath, { name: 'database.json' })
      archive.finalize()

    })

    await conn.sendFile(m.chat, zipPath, 'database.zip', `📦 *Backup Database*
📂 Ukuran: ${size}`, m, null, { mimetype: 'application/zip', asDocument: true })

    // hapus zip
    await fsp.unlink(zipPath)

  } catch (err) {

    try {

      // fallback kirim json langsung
      const buffer = await fsp.readFile(filePath)

      await conn.sendFile(m.chat, buffer, 'database.json', '⚠️ Gagal kompres, kirim database langsung.', m, null, { mimetype: 'application/json', asDocument: true })

    } catch (e) {
      await conn.reply(m.chat, '❌ Error saat mengambil database.', m)
    }

  }
}

handler.command = ['getdb']
handler.rowner = true

export default handler
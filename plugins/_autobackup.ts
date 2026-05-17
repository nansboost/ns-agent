// @ts-nocheck
import fs from 'fs'
import archiver from 'archiver'
import path from 'path'
import { fileURLToPath } from 'url'

// Mendefinisikan __dirname untuk modul ES6
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Mendefinisikan direktori parent dari Jarsekai
const parentDir = path.resolve(__dirname, '../')

let lastSentTime = 0

export async function before(m, { conn }) {
  const now = Date.now()
  const timeDiff = now - lastSentTime

  if (timeDiff >= 180 * 60 * 1000) { // 3 jam
    lastSentTime = now

    try {
      // Mengambil tanggal sekarang
      const d = new Date()
      const dateStr = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`
      const fileName = `NeroMD_${dateStr}.zip`
      
      const backupPath = path.join(parentDir, fileName)
      const output = fs.createWriteStream(backupPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', async () => {
        console.log('File zip berhasil dibuat')

        try {
          const finale = fs.readFileSync(backupPath)
          await conn.sendFile(global.backupsc + `@s.whatsapp.net`, finale, fileName, `*System Notification*\n\nHalo Owner, bot telah berhasil melakukan pencadangan.`, null)
          console.log('File zip berhasil dikirim')

          fs.unlink(backupPath, (err) => {
            if (err) {
              console.error('Error deleting file:', err)
              return
            }
            console.log('File zip berhasil dihapus')
          })
        } catch (err) {
          console.error('Error sending file:', err)
        }
      })

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn(err)
        } else {
          throw err
        }
      })

      archive.on('error', (err) => {
        throw err
      })

      archive.pipe(output)

      // Tambahkan file project dengan filter rekursif agar runtime/session/secret tidak ikut ter-zip.
      const ignore = [
        fileName,
        'node_modules/**', '.git/**', '.ns-agent/**', 'lib/agent-data/**', 'lib/jid-data/**',
        'tmp/**', 'temp/**', 'logs/**', 'sessions/**', 'session/**',
        '.config/**', '.npm/**', '.brainlyscraper2/**', '.cache/**',
        'config.ts', 'database.json', 'agent-provider.json', 'agent-sessions.json',
        'agent-tasks.json', 'ai-memory.json', 'auto-heal-state.json', '.owner-memory.md',
        'package-lock.json', '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx',
        '**/*token*', '**/*secret*', '**/*credential*', '**/*cookie*', '**/*session*'
      ]

      archive.glob('**/*', {
        cwd: parentDir,
        dot: true,
        ignore
      })

      await archive.finalize()
    } catch (err) {
      console.error('Error creating zip file:', err)
    }
  }
}

export const disabled = false
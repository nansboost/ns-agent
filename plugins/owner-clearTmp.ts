// @ts-nocheck
import { tmpdir } from 'os'
import path, { join } from 'path'
import fs from 'fs'
import { readdirSync, unlinkSync, rmSync } from 'fs'
let handler = async (m, { conn, __dirname, args }) => {
m.reply(`✅ Folder *tmp + sessions* sudah dibersihkan`)
m.react(done)
// -- menghapus file temporary ---
const tmpDirs = [tmpdir(), join(__dirname, '../tmp')]
const tmpFiles = []
tmpDirs.forEach((dir) => readdirSync(dir).forEach((file) => tmpFiles.push(join(dir, file))))
tmpFiles.forEach((file) => {
const filePath = file
if (fs.lstatSync(filePath).isDirectory()) {
rmSync(filePath, { recursive: true, force: true })
} else {
unlinkSync(filePath)
}
})
// -- menghapus sesi bot ---
const Sessions = "./sessions"
readdirSync(Sessions).forEach((file) => {
const filePath = `${Sessions}/${file}`
if (file !== 'creds.json') {
if (fs.lstatSync(filePath).isDirectory()) {
rmSync(filePath, { recursive: true, force: true })
} else {
unlinkSync(filePath)
}
}
})
// -- fitur jadibot/bebot sudah dihapus, jadi tidak ada folder sub-bot yang dibersihkan lagi
}
handler.help = ['cleartmp']
handler.tags = ['owner']
handler.command = /^(cleartmp)$/i
handler.rowner = true
export default handler
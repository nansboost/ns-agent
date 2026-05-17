// @ts-nocheck
import { spawn } from 'child_process'
let handler = async (m, { conn, isROwner, text }) => {
if (!process.send) throw 'Dont: tsx main.ts\nDo: tsx index.ts'
if (conn.user.jid == conn.user.jid) {
await m.reply(`🔄 Merestart Bot`)
process.send('reset')
} else throw 'eh'
}
handler.help = ['restart']
handler.tags = ['owner']
handler.command = ['restart','reiniciar']
handler.rowner = true
export default handler
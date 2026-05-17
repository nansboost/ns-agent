// @ts-nocheck
import { performance } from 'perf_hooks'
let handler = async (m, { conn, usedPrefix, command }) => {
    let start = performance.now()
    let uptime = await getUptime()
    let end = performance.now()
    let latency = (end - start).toFixed(4)

    let cmds = Object.values(global.plugins).filter((v) => v.help && v.tags).length
    let totalreg = Object.keys(global.db.data.users)
    let rtotalreg = Object.values(global.db.data.users).filter(user => user.registered == true)

    let message = `
 ≡ *STATUS BOT*
- *Ping:* ${latency} _ms_
- *Uptime:* ${uptime}
- *Jumlah command:* ${cmds} 

*≡ PENGGUNA BOT*
- *Total:* ${totalreg.length.toLocaleString()}
- *Terdaftar:* ${rtotalreg.length.toLocaleString()} 

*≡ OWNER*
  *nansoffc*`

    m.reply(message, null, fwc)
}
handler.help = ['info']
handler.tags = ['main']
handler.command = ['info', 'infobot', 'botinfo']

export default handler

// - - 
async function getUptime() {
    if (process.send) {
        process.send('uptime')
        let _muptime = await new Promise(resolve => {
            process.once('message', resolve)
            setTimeout(() => resolve(0), 1000)
        });
        return formatUptime(_muptime * 1000)
    }
    return formatUptime(0)
}

// - - 
function formatUptime(ms) {
    let d = Math.floor(ms / 86400000)
    let h = Math.floor(ms / 3600000) % 24
    let m = Math.floor(ms / 60000) % 60
    let s = Math.floor(ms / 1000) % 60
    return `${d}d ${h}h ${m}m ${s}s`
}

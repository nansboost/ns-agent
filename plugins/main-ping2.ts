// @ts-nocheck
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

let handler = async (m, { conn }) => {
    m.react('⚡')

    // Hitung latency
    const start = Date.now()
    await conn.sendMessage(m.chat, { text: '🔄 _Mengukur kecepatan..._' }, { quoted: m })
    const latency = Date.now() - start

    // Ambil uptime proses
    const uptimeSec = process.uptime()
    const days = Math.floor(uptimeSec / 86400)
    const hours = Math.floor((uptimeSec % 86400) / 3600)
    const minutes = Math.floor((uptimeSec % 3600) / 60)
    const seconds = Math.floor(uptimeSec % 60)
    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`

    // Ambil info server (CPU & RAM)
    let cpuInfo = '-'
    let ramInfo = '-'
    let osInfo = '-'

    try {
        const { stdout } = await execAsync('uname -a')
        osInfo = stdout.trim().split(' ').slice(0, 3).join(' ') || '-'
    } catch {
        osInfo = 'N/A'
    }

    try {
        const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'")
        cpuInfo = stdout.trim() ? `${stdout.trim()}%` : '-'
    } catch {
        cpuInfo = '-'
    }

    try {
        const { stdout } = await execAsync("free | grep Mem | awk '{printf \"%.1f/%.1f MB (%.1f%%)\", $3/1024, $2/1024, ($3/$2)*100}'")
        ramInfo = stdout.trim() || '-'
    } catch {
        ramInfo = '-'
    }

    // Tentukan status ping
    let pingStatus, pingEmoji
    if (latency < 100) {
        pingStatus = '🟢 Sangat Cepat'
        pingEmoji = '⚡'
    } else if (latency < 300) {
        pingStatus = '🟡 Cepat'
        pingEmoji = '🏃'
    } else if (latency < 600) {
        pingStatus = '🟠 Sedang'
        pingEmoji = '🚶'
    } else {
        pingStatus = '🔴 Lambat'
        pingEmoji = '🐌'
    }

    const text = `
╭─── ${pingEmoji} *PING TEST* ${pingEmoji}
│
│ 📡 *Latency:* ${latency} ms
│ 📊 *Status:* ${pingStatus}
│
│ ⏱ *Uptime Bot:* ${uptimeStr}
│ 💻 *OS:* ${osInfo}
│ 🧠 *CPU Usage:* ${cpuInfo}
│ 🗄 *RAM Usage:* ${ramInfo}
│
╰─── 🤖 *Nero Bot* ───
    `.trim()

    await conn.sendMessage(m.chat, { text }, { quoted: m })
    m.react('✅')
}

handler.help = ['ping2']
handler.tags = ['main', 'info']
handler.command = /^(ping2|pingtest|cekping)$/i

export default handler

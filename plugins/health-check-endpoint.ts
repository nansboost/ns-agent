// @ts-nocheck
// HEALTH CHECK COMMAND - HTTP endpoint aktif di index.ts (/health, /status, /metrics)
import os from 'os'

function formatBytes(bytes = 0) {
  const mb = Number(bytes || 0) / 1024 / 1024
  return `${mb.toFixed(2)} MB`
}

let handler = async (m) => {
  const mem = process.memoryUsage()
  const total = os.totalmem()
  const usedPercent = total ? ((mem.rss / total) * 100).toFixed(2) : '0.00'
  const uptime = process.uptime()
  const d = Math.floor(uptime / 86400)
  const h = Math.floor(uptime / 3600) % 24
  const min = Math.floor(uptime / 60) % 60
  const s = Math.floor(uptime) % 60

  await m.reply(`🟢 *Health Check*\n\nStatus: healthy\nUptime: ${d}d ${h}h ${min}m ${s}s\nRAM RSS: ${formatBytes(mem.rss)} / ${formatBytes(total)} (${usedPercent}%)\nHeap: ${formatBytes(mem.heapUsed)} / ${formatBytes(mem.heapTotal)}\nNode: ${process.version}\nPID: ${process.pid}`)
}

handler.help = ['health', 'statusbot']
handler.tags = ['main']
handler.command = /^(health|statusbot)$/i

export default handler

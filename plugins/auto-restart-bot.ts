// @ts-nocheck
// AUTO-RESTART PLUGIN - Bot akan restart otomatis jika error
// Command: /restart, /status, /health

export default {
  name: 'auto-restart',
  version: '1.0.0',
  commands: ['restart', 'status', 'health'],
  
  async handler(bot, message) {
    const cmd = message.body.split(' ')[0].toLowerCase();
    
    if (cmd === '/restart') {
      // Restart bot secara manual
      console.log('[AUTO-RESTART] Manual restart requested');
      
      await bot.sendMessage(message.from, {
        text: '🔄 *Bot Restarting...*\n\nMohon tunggu sebentar...',
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        }
      });
      
      setTimeout(() => {
        process.exit(0);
      }, 2000);
      
      return null;
    }
    
    if (cmd === '/status' || cmd === '/health') {
      // Tampilkan status bot
      const uptime = process.uptime();
      const uptimeHours = (uptime / 3600).toFixed(2);
      const uptimeMinutes = ((uptime % 3600) / 60).toFixed(0);
      const uptimeSeconds = (uptime % 60).toFixed(0);
      
      const memUsage = process.memoryUsage();
      const ramUsed = ((memUsage.rss / 1024 / 1024)).toFixed(2);
      
      const status = {
        command: cmd,
        uptime: `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`,
        ram: `${ramUsed} MB`,
        pid: process.pid,
        node_version: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString()
      };
      
      const statusText = `
🤖 *BOT STATUS*
━━━━━━━━━━━━━━━━━━━━
⏱️ Uptime: ${status.uptime}
💾 RAM: ${status.ram}
🔢 PID: ${status.pid}
📦 Node: ${status.node_version}
🖥️ Platform: ${status.platform}
🕐 Time: ${new Date().toLocaleString('id-ID')}
━━━━━━━━━━━━━━━━━━━━
✅ Status: ONLINE
      `.trim();
      
      await bot.sendMessage(message.from, {
        text: statusText
      });
      
      return null;
    }
    
    return null;
  }
};

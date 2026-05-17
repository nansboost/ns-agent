// @ts-nocheck
import './config.ts'
import { startTelegramBot } from './lib/telegram/index.ts'

startTelegramBot().catch(err => {
  console.error('[telegram] fatal boot error:', err)
  process.send?.({
    type: 'runtime-status',
    status: {
      service: 'telegram',
      ok: false,
      enabled: global.telegramBot?.enabled === true,
      error: err?.message || String(err),
      updatedAt: new Date().toISOString()
    }
  })
})

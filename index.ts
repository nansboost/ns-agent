// @ts-nocheck
// console.log('Memulai...')

import { join, dirname } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { setupMaster, fork } from 'cluster'
import cfonts from 'cfonts'
import { createInterface } from 'readline'
import yargs from 'yargs'
import express from 'express'
import chalk from 'chalk'
import os from 'os'
import { promises as fsPromises } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(__dirname)
const { say } = cfonts
const rl = createInterface(process.stdin, process.stdout)

const app = express()
const port = process.env.PORT || 8080

const startedAt = Date.now()
let healthRequestCount = 0
let healthErrorCount = 0
let lastHealthError = null
const managedProcesses = new Map()
const childRuntimeStatus = {}

function processSummary () {
  const out = {}
  for (const [name, state] of managedProcesses.entries()) {
    out[name] = {
      file: state.file,
      running: !!state.running,
      restarting: !!state.restarting,
      pid: state.worker?.process?.pid || null,
      exits: state.exits || 0,
      last_exit_code: state.lastExitCode ?? null,
      last_exit_at: state.lastExitAt || null,
      last_start_at: state.lastStartAt || null,
      status: childRuntimeStatus[name] || null
    }
  }
  return out
}

function healthPayload () {
  const mem = process.memoryUsage()
  const total = os.totalmem()
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Number(process.uptime().toFixed(2)),
      hours: Number((process.uptime() / 3600).toFixed(2))
    },
    memory: {
      rss_mb: Number((mem.rss / 1024 / 1024).toFixed(2)),
      heap_used_mb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
      heap_total_mb: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
      total_mb: Number((total / 1024 / 1024).toFixed(2)),
      percent: Number(((mem.rss / total) * 100).toFixed(2))
    },
    requests: {
      total: healthRequestCount,
      errors: healthErrorCount,
      last_error_at: lastHealthError
    },
    node: {
      version: process.version,
      platform: process.platform,
      pid: process.pid
    },
    bot: {
      name: 'nero-md',
      version: '1.0.0',
      author: '@nansoffc & @fg.error'
    },
    processes: processSummary()
  }
}

app.get('/health', (_req, res) => {
  healthRequestCount++
  res.json(healthPayload())
})

app.get('/status', (_req, res) => {
  healthRequestCount++
  res.json({
    running: true,
    healthy: true,
    started_at: new Date(startedAt).toISOString(),
    current_time: new Date().toISOString(),
    uptime_seconds: Number(process.uptime().toFixed(2)),
    processes: processSummary()
  })
})

app.get('/metrics', (_req, res) => {
  healthRequestCount++
  const mem = process.memoryUsage()
  res.json({
    timestamp: new Date().toISOString(),
    process: {
      uptime_seconds: Number(process.uptime().toFixed(2)),
      pid: process.pid,
      argv: process.argv.slice(0, 3).join(' ')
    },
    memory: {
      heap_total_mb: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
      heap_used_mb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
      external_mb: Number((mem.external / 1024 / 1024).toFixed(2)),
      rss_mb: Number((mem.rss / 1024 / 1024).toFixed(2))
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'production',
      PORT: String(port)
    },
    processes: processSummary()
  })
})

process.on('uncaughtException', err => {
  healthErrorCount++
  lastHealthError = new Date().toISOString()
  console.error('[WRAPPER] Uncaught Exception:', err)
})

process.on('unhandledRejection', reason => {
  healthErrorCount++
  lastHealthError = new Date().toISOString()
  console.error('[WRAPPER] Unhandled Rejection:', reason)
})

say(`\n`, {
  font: 'console',
  align: 'center',
  colors: ['magenta']
})

say('nero-md', {
  font: 'block',
  align: 'center',
  colors: ['white']
})

say(`\nscript by @nansoffc & @fg.error`, {
  font: 'console',
  align: 'center',
  colors: ['magenta']
})

app.listen(port, () => {
  console.log(chalk.green(`Port ${port} terbuka`))
})

function restartDelayMs (state, code) {
  const exits = Number(state.exits || 0)
  if (code === 0) return 1000
  return Math.min(30000, 2000 + exits * 3000)
}

function killProcess (name) {
  const state = managedProcesses.get(name)
  if (!state?.worker) return false
  state.restarting = true
  state.worker.process.kill()
  return true
}

async function startProcess (name, file, options = {}) {
  const current = managedProcesses.get(name)
  if (current?.running) return current.worker

  const args = [join(__dirname, file), ...process.argv.slice(2)]
  const state = current || {
    name,
    file,
    exits: 0,
    running: false,
    restarting: false,
    worker: null,
    autoRestart: options.autoRestart !== false
  }

  state.file = file
  state.autoRestart = options.autoRestart !== false
  state.lastStartAt = new Date().toISOString()
  state.running = true
  state.restarting = false
  managedProcesses.set(name, state)

  say(`${name}: ${[process.argv[0], ...args].join(' ')}`, {
    font: 'console',
    align: 'center',
    colors: [name === 'telegram' ? 'cyan' : 'red']
  })

  setupMaster({
    exec: args[0],
    args: args.slice(1),
    silent: false
  })

  const p = fork({ NS_PROCESS_NAME: name })
  state.worker = p

  p.on('message', data => {
    if (data && typeof data === 'object') {
      if (data.type === 'runtime-status') {
        childRuntimeStatus[name] = data.status || data
        return
      }
      if (data.type === 'log') {
        console.log(`[${name}]`, data.message || '')
        return
      }
    }

    console.log(`[${name} RECEIVED]`, data)

    switch (data) {
      case 'reset':
      case 'auto-restart':
        state.restarting = true
        p.process.kill()
        break

      case 'uptime':
        p.send?.(process.uptime())
        break
    }
  })

  p.on('exit', (code, signal) => {
    state.running = false
    state.worker = null
    state.exits = Number(state.exits || 0) + 1
    state.lastExitCode = code
    state.lastExitSignal = signal
    state.lastExitAt = new Date().toISOString()

    const manualRestart = state.restarting
    state.restarting = false

    console.error(chalk.yellow(`[${name}] proses keluar. code=${code} signal=${signal || '-'}`))

    if (!state.autoRestart) return

    const delay = manualRestart ? 800 : restartDelayMs(state, code)
    console.log(chalk.blue(`[${name}] restart dalam ${Math.ceil(delay / 1000)} detik...`))
    setTimeout(() => startProcess(name, file, options).catch(err => {
      healthErrorCount++
      lastHealthError = new Date().toISOString()
      console.error(chalk.red(`[${name}] gagal restart:`), err)
    }), delay)
  })

  return p
}

async function telegramEnabledFromConfig () {
  try {
    await import(`./config.ts?wrapper=${Date.now()}`)
    const cfg = global.telegramBot || {}
    const token = String(cfg.token || '').trim()
    const tokenLooksEmpty = !token || /^(YOUR_TELEGRAM_BOT_TOKEN|ISI_TOKEN_TELEGRAM|BOT_TOKEN_HERE)$/i.test(token)
    return cfg.enabled === true && !tokenLooksEmpty
  } catch (e) {
    console.error(chalk.red('[telegram] gagal membaca config.ts:'), e.message || e)
    return false
  }
}

async function boot () {
  console.log(chalk.yellow(`\n${os.type()}, ${os.release()} - ${os.arch()}`))
  console.log(chalk.yellow(`RAM Total: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`))
  console.log(chalk.yellow(`RAM Libre: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`))

  try {
    const packageJsonData = await fsPromises.readFile('./package.json', 'utf-8')
    const packageJsonObj = JSON.parse(packageJsonData)

    console.log(chalk.blue.bold('\nInformasi Paket'))
    console.log(chalk.cyan(`Nama: ${packageJsonObj.name}`))
    console.log(chalk.cyan(`Versi: ${packageJsonObj.version}`))
    console.log(chalk.cyan(`Pembuat: ${packageJsonObj.author?.name || 'Tidak didefinisikan'}`))
  } catch (err) {
    console.error(chalk.red('Tidak bisa membaca package.json'))
  }

  console.log(chalk.blue.bold('\nWaktu Saat Ini'))
  console.log(
    chalk.cyan(
      new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta'
      })
    )
  )

  await startProcess('whatsapp', 'main.ts', { autoRestart: true })

  if (await telegramEnabledFromConfig()) {
    await startProcess('telegram', 'telegram.ts', { autoRestart: true })
  } else {
    console.log(chalk.gray('[telegram] disabled atau token belum diisi di config.ts'))
  }

  setInterval(() => {}, 1000)

  const opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
  if (!opts['test'] && !rl.listenerCount()) {
    rl.on('line', line => {
      const input = line.trim()
      if (['rs', 'reset', 'restart'].includes(input)) {
        killProcess('whatsapp')
        return
      }
      if (['rt', 'restart-telegram', 'telegram-restart'].includes(input)) {
        killProcess('telegram')
        return
      }
      if (['ra', 'restart-all'].includes(input)) {
        killProcess('whatsapp')
        killProcess('telegram')
        return
      }

      const wa = managedProcesses.get('whatsapp')?.worker
      wa?.send?.(input)
    })
  }
}

boot().catch(err => {
  healthErrorCount++
  lastHealthError = new Date().toISOString()
  console.error(chalk.red('[WRAPPER] Boot error:'), err)
})

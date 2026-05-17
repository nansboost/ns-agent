// @ts-nocheck
//-- process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
import './config.ts'; 
import { createRequire } from "module"; // Bring in the ability to create the 'require' method
import path, { join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { platform } from 'process'
import * as ws from 'ws';
import chalk from 'chalk'
import { readdirSync, statSync, unlinkSync, existsSync, readFileSync, watch, rmSync } from 'fs';
import yargs from 'yargs';
import { spawn } from 'child_process';
import lodash from 'lodash';
import syntaxerror from 'syntax-error'
import chokidar from 'chokidar'
import { tmpdir } from 'os';
import { format } from 'util';

//import makeWASocket from '@whiskeysockets/baileys'
import { makeWASocket } from './lib/simple.ts'
import { protoType, serialize } from './lib/simple.ts'

import { Low, JSONFile } from 'lowdb';
import pino from 'pino';
import { mongoDB, mongoDBV2 } from './lib/mongoDB.ts';
import store from './lib/store.ts'
import { forceTextOnlyMessages } from './lib/text-only-mode.ts'
import readline from 'readline'




const {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore, 
    jidNormalizedUser
   } = await import('@whiskeysockets/baileys')
import moment from 'moment-timezone'
import NodeCache from 'node-cache'
import fs from 'fs'
import fetch from 'node-fetch'
const { chain } = lodash

protoType()
serialize()

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') { return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString() }; global.__dirname = function dirname(pathURL) { return path.dirname(global.__filename(pathURL, true)) }; global.__require = function require(dir = import.meta.url) { return createRequire(dir) } 

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({ ...query, ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}) })) : '')
// global.Fn = function functionCallBack(fn, ...args) { return fn.call(global.conn, ...args) }
global.timestamp = {
  start: new Date
}

const __dirname = global.__dirname(import.meta.url)

class cloudDBAdapter {
  constructor(url) {
    this.url = String(url || '')
  }

  async read() {
    if (!this.url) return null
    const res = await fetch(this.url, { method: 'GET', headers: { accept: 'application/json' } })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Cloud DB read failed: ${res.status} ${res.statusText}`)
    const text = await res.text()
    if (!text.trim()) return null
    try { return JSON.parse(text) } catch (e) { throw new Error(`Cloud DB returned invalid JSON: ${e.message}`) }
  }

  async write(data) {
    if (!this.url) return
    const body = JSON.stringify(data ?? {})
    let res = await fetch(this.url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body
    })
    if ([404, 405, 501].includes(res.status)) {
      res = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body
      })
    }
    if (!res.ok) throw new Error(`Cloud DB write failed: ${res.status} ${res.statusText}`)
  }
}


global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
global.prefix = new RegExp('^[' + (opts['prefix'] || '‎z/i!#$%+£¢€¥^°=¶∆×÷π√✓©®:;?&.,\\-').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']')

//global.opts['db'] = "mongodb+srv://dbdyluxbot:password@cluster0.xwbxda5.mongodb.net/?retryWrites=true&w=majority"

global.db = new Low(
  /https?:\/\//.test(opts['db'] || '') ?
    new cloudDBAdapter(opts['db']) : /mongodb(\+srv)?:\/\//i.test(opts['db']) ?
      (opts['mongodbv2'] ? new mongoDBV2(opts['db']) : new mongoDB(opts['db'])) :
      new JSONFile(`${opts._[0] ? opts._[0] + '_' : ''}database.json`)
)


global.DATABASE = global.db 
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) return new Promise((resolve) => setInterval(async function () {
    if (!global.db.READ) {
      clearInterval(this)
      resolve(global.db.data == null ? global.loadDatabase() : global.db.data)
    }
  }, 1 * 1000))
  if (global.db.data !== null) return
  global.db.READ = true
  await global.db.read().catch(console.error)
  global.db.READ = null
  global.db.data = {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {},
    ...(global.db.data || {})
  }
  global.db.chain = chain(global.db.data)
}
loadDatabase()

//-- RUNTIME FOLDERS & TMP CLEANUP
const runtimeFolders = ['tmp', 'tmp/session', 'tmp/logs', 'tmp/cache', 'tmp/temp', 'sessions', 'logs', 'ws', 'ws/plugins', 'ws/projects', 'ws/tmp']

function ensureRuntimeFolders() {
  let created = 0
  for (const folder of runtimeFolders) {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
      created++
    }
  }
  console.log(chalk.gray(`Runtime folders OK (${runtimeFolders.length} folder, baru: ${created})`))
}

ensureRuntimeFolders()

//-- SESSION
global.authFile = `sessions`
const {state, saveState, saveCreds} = await useMultiFileAuthState(global.authFile)
const msgRetryCounterMap = new Map()
const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 })
const userDevicesCache = new NodeCache({ stdTTL: 0, checkperiod: 0 })
//const msgRetryCounterCache = new NodeCache()
const {version} = await fetchLatestBaileysVersion()

const connectionOptions = {
    logger: pino({ level: 'silent' }),
    version,
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: 'fatal' })
        ),
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    msgRetryCounterCache,
    userDevicesCache,
    getMessage: async (key) => {
        let jid = jidNormalizedUser(key.remoteJid);
        let msg = await store.loadMessage(jid, key.id);
        return msg?.message || "";
    }    
};

global.conn = forceTextOnlyMessages(makeWASocket(connectionOptions))

store.bind(conn)
conn.store = store

conn.ev.on('creds.update', saveCreds)

//--  
let phoneNumber = global.botNumber[0]

if (!fs.existsSync(`./${authFile}/creds.json`)) {

  const askNumber = () => {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })

      rl.question('Masukkan nomor kamu dengan kode negara (cth: 628xxxxx): ', (num) => {
        rl.close()
        resolve(num.trim())
      })
    })
  }

  setTimeout(async () => {

    if (!phoneNumber) {
      phoneNumber = await askNumber()
    }

    // Validasi sederhana
    if (!/^\d+$/.test(phoneNumber)) {
      console.log('Nomor tidak valid. Gunakan hanya angka dengan kode negara.')
      process.exit(1)
    }

    let code = await conn.requestPairingCode(phoneNumber)

    code = code?.match(/.{1,4}/g)?.join('-') || code

console.log('\n')
 console.log(chalk.bold.cyan('╔══════════════════════════════════════╗'))
 console.log(chalk.bold.cyan('║         KODE TAUTAN (PAIRING)        ║'))
 console.log(chalk.bold.cyan('╚══════════════════════════════════════╝'))
 
 console.log('\n')
 
 // Bingkai kode
 console.log(chalk.bold.red('        ╔════════════════════╗'))
 console.log(chalk.bold.red('║') + chalk.bold.yellow(`     ${code}      `) + chalk.bold.red('║'))
 console.log(chalk.bold.red('        ╚════════════════════╝'))
 
 console.log('\n')
 
 console.log(chalk.bold.hex('#FFD700')('LANGKAH UNTUK MENAUTKAN:\n'))
 
 console.log(chalk.hex('#00BFFF')('   1) ') + chalk.bold.green('Buka WhatsApp'))
 console.log(chalk.hex('#00BFFF')('   2) ') + chalk.bold.cyan('Ke Perangkat Tertaut'))
 console.log(chalk.hex('#00BFFF')('   3) ') + chalk.bold.magenta('Ketuk "Tautkan dengan nomor telepon"'))
 
 console.log('\n')
    
  }, 3000)
}
//--

conn.isInit = false



/* Clear temporary files older than 1 minute. Folder creation is handled in main.ts, no extra root checker needed. */
async function clearTmp() {
  const tmpFolders = [tmpdir(), join(__dirname, './tmp')]
  const deleted = []

  for (const dirname of tmpFolders) {
    if (!existsSync(dirname)) continue
    for (const file of readdirSync(dirname)) {
      const full = join(dirname, file)
      try {
        const stats = statSync(full)
        if (stats.isFile() && (Date.now() - stats.mtimeMs >= 1000 * 60)) {
          unlinkSync(full)
          deleted.push(full)
        }
      } catch (e) {
        console.error(`Gagal clear tmp ${full}:`, e.message || e)
      }
    }
  }

  return deleted
}

if (!opts['test']) {
  setInterval(async () => {
    if (global.db.data) await global.db.write().catch(console.error)
    if (opts['autocleartmp'] !== false) await clearTmp().catch(console.error)
  }, 60 * 1000)
}

async function connectionUpdate(update) {
  const { connection, lastDisconnect } = update

  if (connection === 'close') {
    const shouldReconnect =
      lastDisconnect?.error?.output?.statusCode !==
      DisconnectReason.loggedOut

    if (shouldReconnect) {
      console.log('Menghubungkan ulang...')
      global.reloadHandler(true)
    } else {
      console.log('Sesi ditutup. Hapus folder sessions.')
    }
  }

  if (connection === 'open') {
    console.log('BOT TERHUBUNG')
  }
} //-- cu 

process.on('uncaughtException', console.error)
// let strQuot = /(["'])(?:(?=(\\?))\\2.)*?\1/

let isInit = true;
let handler = await import('./handler.ts')
global.reloadHandler = async function (restatConn) {
  try {
    const Handler = await import(`./handler.ts?update=${Date.now()}`).catch(console.error)
    if (Object.keys(Handler || {}).length) handler = Handler
  } catch (e) {
    console.error(e)
  }

 if (restatConn) {
  try { global.conn.ws.close() } catch {}
  conn.ev.removeAllListeners()

  global.conn = forceTextOnlyMessages(makeWASocket(connectionOptions))

store.bind(global.conn)
global.conn.store = store

  global.conn.ev.on('creds.update', saveCreds)

  isInit = true
}

  if (!isInit) {
    conn.ev.off('messages.upsert', conn.handler)
    conn.ev.off('group-participants.update', conn.participantsUpdate)
    conn.ev.off('groups.update', conn.groupsUpdate)
    conn.ev.off('message.delete', conn.onDelete)
    conn.ev.off('connection.update', conn.connectionUpdate)
    conn.ev.off('creds.update', conn.credsUpdate)
  }

  conn.welcome = 'Hai, @user\nSelamat datang di @group'
  conn.bye = 'selamat tinggal @user'
  conn.spromote = '@user dipromosikan jadi admin'
  conn.sdemote = '@user diturunkan'
  conn.sDesc = 'Deskripsi telah diubah ke \n@desc'
  conn.sSubject = 'Nama grup telah diubah ke \n@group'
  conn.sIcon = 'Ikon grup telah diubah'
  conn.sRevoke = 'Link grup telah diubah ke \n@revoke'
  conn.handler = handler.handler.bind(global.conn)
  conn.participantsUpdate = handler.participantsUpdate.bind(global.conn)
  conn.groupsUpdate = handler.groupsUpdate.bind(global.conn)
  conn.connectionUpdate = connectionUpdate.bind(global.conn)
  conn.credsUpdate = saveCreds.bind(global.conn, true)

  conn.ev.on('messages.upsert', conn.handler)
  conn.ev.on('group-participants.update', conn.participantsUpdate)
  conn.ev.on('groups.update', conn.groupsUpdate)
  conn.ev.on('connection.update', conn.connectionUpdate)
  conn.ev.on('creds.update', conn.credsUpdate)
  isInit = false
  return true
}


// Root plugin utama tetap di plugins/.
// Plugin baru/eksperimen buatan agent ditempatkan di ws/plugins/.
// Loader ini sengaja dibuat rekursif agar plugin di subfolder seperti
// plugins/admin/, plugins/downloader/, ws/plugins/tools/, dll tetap terdeteksi.
const rootPluginFolder = path.resolve(__dirname, 'plugins')
const wsPluginFolder = path.resolve(__dirname, 'ws', 'plugins')
fs.mkdirSync(rootPluginFolder, { recursive: true })
fs.mkdirSync(wsPluginFolder, { recursive: true })

const pluginRoots = [
  { type: 'root', folder: rootPluginFolder },
  { type: 'ws', folder: wsPluginFolder }
].filter((item, index, arr) => existsSync(item.folder) && arr.findIndex(v => v.folder === item.folder) === index)

const pluginFilter = filename => /\.(ts|js)$/i.test(filename) && !/\.d\.ts$/i.test(filename)
const pluginSkipDirs = new Set(['node_modules', 'sessions', '.git', 'tmp', 'logs', '.trash', '__pycache__'])
global.plugins = {}
global.pluginFiles = {}
global.pluginCommands = {}

function pathInside(parent, child) {
  const rel = path.relative(parent, child)
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel))
}

function normalizeSlash(value = '') {
  return String(value).replace(/\\/g, '/')
}

function findPluginRoot(filePath) {
  const abs = path.resolve(filePath)
  return pluginRoots.find(root => pathInside(root.folder, abs)) || null
}

function pluginKeyFromPath(filePath) {
  const abs = path.resolve(filePath)
  const root = findPluginRoot(abs)
  if (!root) return normalizeSlash(path.relative(__dirname, abs))

  const rel = normalizeSlash(path.relative(root.folder, abs))
  if (root.type === 'ws') return `ws/plugins/${rel}`

  // Kompatibilitas lama: plugin langsung di plugins/ tetap pakai key nama-file.ts.
  // Plugin dalam subfolder pakai key relatif, contoh admin/owner-agent.ts.
  return rel
}

function pluginPathFromArgs(filename, folder = null) {
  if (!filename) return null
  const raw = String(filename)
  if (path.isAbsolute(raw)) return path.resolve(raw)
  if (folder) return path.resolve(folder, raw)
  return path.resolve(rootPluginFolder, raw)
}

function commandNameFromRaw(value) {
  const command = String(value || '').trim().toLowerCase()
  return /^[a-z0-9_:-]+$/i.test(command) ? command : null
}

function simpleCommandsFromRegExp(regex) {
  if (!(regex instanceof RegExp)) return []
  let source = regex.source
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replace(/^\(\?:?/, '')
    .replace(/\)$/, '')

  if (!source || /[\[\]{}+*?\\.]/.test(source)) return []
  return source.split('|').map(commandNameFromRaw).filter(Boolean)
}

function extractPluginCommands(plugin) {
  const raw = plugin?.command
  if (!raw) return []
  if (Array.isArray(raw)) return [...new Set(raw.map(commandNameFromRaw).filter(Boolean))]
  if (typeof raw === 'string') return [commandNameFromRaw(raw)].filter(Boolean)
  if (raw instanceof RegExp) return [...new Set(simpleCommandsFromRegExp(raw))]
  return []
}

function unregisterPluginCommands(key) {
  for (const [command, owner] of Object.entries(global.pluginCommands || {})) {
    if (owner === key) delete global.pluginCommands[command]
  }
}

function registerPluginCommands(key, plugin) {
  const commands = extractPluginCommands(plugin)
  const conflicts = commands
    .map(command => ({ command, owner: global.pluginCommands?.[command] }))
    .filter(item => item.owner && item.owner !== key)

  if (conflicts.length) {
    const detail = conflicts.map(item => `${item.command} -> ${item.owner}`).join(', ')
    throw new Error(`Plugin command collision: ${key} bentrok dengan ${detail}`)
  }

  unregisterPluginCommands(key)
  for (const command of commands) global.pluginCommands[command] = key
  return commands
}

function scanPluginFiles(folder, { recursive = true } = {}) {
  const results = []
  if (!existsSync(folder)) return results

  const walk = (dir) => {
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch (e) {
      console.log(chalk.yellow(`Tidak bisa scan folder plugin: ${dir} (${e.message})`))
      return
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (pluginSkipDirs.has(entry.name)) continue
        if (recursive) walk(full)
        continue
      }
      if (!entry.isFile()) continue
      if (!pluginFilter(entry.name)) continue
      if (/\.(bak|tmp|old|swp|log)$/i.test(entry.name)) continue
      results.push(full)
    }
  }

  walk(folder)
  return results.sort((a, b) => pluginKeyFromPath(a).localeCompare(pluginKeyFromPath(b)))
}

async function importPluginFile(filePath, silent = false) {
  const abs = path.resolve(filePath)
  const key = pluginKeyFromPath(abs)

  try {
    if (!existsSync(abs)) {
      unregisterPluginCommands(key)
      if (key in global.plugins) delete global.plugins[key]
      if (global.pluginFiles && key in global.pluginFiles) delete global.pluginFiles[key]
      return false
    }

    // Jangan pakai syntax-error untuk file .ts, karena syntax-error hanya paham JS
    // dan bisa salah menolak plugin TypeScript yang valid. Biarkan tsx/esbuild
    // yang melakukan compile + validasi saat import.
    const moduleUrl = `${pathToFileURL(abs).href}?update=${Date.now()}_${Math.random().toString(36).slice(2)}`
    const module = await import(moduleUrl)
    const plugin = module.default || module

    unregisterPluginCommands(key)
    const commands = registerPluginCommands(key, plugin)
    global.plugins[key] = plugin
    global.pluginFiles[key] = abs
    if (!silent) {
      const suffix = commands.length ? ` [${commands.join(', ')}]` : ''
      console.log(chalk.green(`Plugin dimuat -> ${key}${suffix}`))
    }
    return true
  } catch (e) {
    console.log(chalk.red.bold(`Gagal memuat ${key}`) + '\n' + chalk.gray(e?.stack || e?.message || e))
    unregisterPluginCommands(key)
    delete global.plugins[key]
    if (global.pluginFiles) delete global.pluginFiles[key]
    return false
  } finally {
    global.plugins = Object.fromEntries(
      Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b))
    )
    global.pluginFiles = Object.fromEntries(
      Object.entries(global.pluginFiles || {}).sort(([a], [b]) => a.localeCompare(b))
    )
    global.pluginCommands = Object.fromEntries(
      Object.entries(global.pluginCommands || {}).sort(([a], [b]) => a.localeCompare(b))
    )
  }
}

async function filesInit({ reset = true } = {}) {
  const start = Date.now()
  let ok = 0
  let fail = 0
  let total = 0

  if (reset) {
    global.plugins = {}
    global.pluginFiles = {}
    global.pluginCommands = {}
  }

  for (const root of pluginRoots) {
    const label = normalizeSlash(path.relative(__dirname, root.folder)) || 'plugins'
    const files = scanPluginFiles(root.folder, { recursive: root.type === 'ws' || process.env.LOAD_NESTED_ROOT_PLUGINS === '1' })
    total += files.length
    for (const file of files) {
      const loaded = await importPluginFile(file, true)
      loaded ? ok++ : fail++
    }
    console.log(chalk.gray(`Scan plugin folder: ${label} (${files.length} file)`))
  }

  const end = Date.now()
  console.log(
    chalk.white('Plugin terdeteksi: ') + chalk.bold(total) + '\n' +
    chalk.green('Berhasil: ') + chalk.bold.green(ok) + '\n' +
    chalk.red('Error: ') + chalk.bold.red(fail) + '\n' +
    chalk.magenta('Waktu: ') + chalk.bold.magenta(`${end - start}ms`)
  )
  return { total, ok, fail }
}

await filesInit()

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED:', err)
})

global.reload = async (_ev, filename, folder = null) => {
  // Support pemanggilan lama: global.reload() untuk rescan penuh.
  if (!filename) return filesInit({ reset: true })

  const filePath = pluginPathFromArgs(filename, folder)
  if (!filePath || !pluginFilter(path.basename(filePath))) return false

  const key = pluginKeyFromPath(filePath)
  const exists = existsSync(filePath)
  const isExisting = key in global.plugins

  if (!exists) {
    if (isExisting) {
      unregisterPluginCommands(key)
      delete global.plugins[key]
      delete global.pluginFiles[key]
      console.log(chalk.red(`Plugin dihapus -> ${key}`))
    }
    return true
  }

  const start = Date.now()
  const loaded = await importPluginFile(filePath, true)
  const end = Date.now()
  if (loaded) {
    console.log(
      (isExisting ? chalk.cyan(`Plugin dimuat ulang -> ${key}`) : chalk.green(`Plugin baru -> ${key}`)) +
      chalk.gray(` (${end - start}ms)`)
    )
  }
  return loaded
}

Object.freeze(global.reload)

const pluginWatcher = chokidar.watch(pluginRoots.map(v => v.folder), {
  ignoreInitial: true,
  persistent: true,
  awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
  ignored: (filePath) => {
    const abs = path.resolve(filePath)
    const base = path.basename(abs)
    if (!base) return false
    if (base.startsWith('.')) return true
    if (pluginSkipDirs.has(base)) return true
    if (pathInside(rootPluginFolder, abs) && process.env.LOAD_NESTED_ROOT_PLUGINS !== '1') {
      const rel = path.relative(rootPluginFolder, abs)
      if (rel && rel.split(path.sep).length > 1) return true
    }
    return /\.(bak|tmp|old|swp|log)$/i.test(base)
  }
})

pluginWatcher.on('add', file => global.reload('add', file))
pluginWatcher.on('change', file => global.reload('change', file))
pluginWatcher.on('unlink', file => global.reload('unlink', file))
pluginWatcher.on('error', err => console.log(chalk.red(`Plugin watcher error: ${err.message}`)))

await global.reloadHandler()

// Quick Test
async function _quickTest() {
  const start = Date.now()

  const check = (cmd, args = []) => {
    return new Promise(resolve => {
      const p = spawn(cmd, args)
      p.on('close', code => resolve(code !== 127))
      p.on('error', () => resolve(false))
    })
  }

  const [ffmpeg, ffmpegWebp, convert, magick, gm] = await Promise.all([
    check('ffmpeg'),
    check('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
    check('convert'),
    check('magick'),
    check('gm')
  ])

  const imageMagick = convert || magick || gm

  global.support = Object.freeze({
    ffmpeg,
    ffprobe: ffmpeg,
    ffmpegWebp,
    convert,
    magick,
    gm,
    imageMagick
  })

  const end = Date.now()

  console.log(
    chalk.yellow.bold('\nPENGECEKAN SISTEM') + '\n' +
    `FFmpeg         : ${ffmpeg ? chalk.green('OK') : chalk.red('GAGAL')}\n` +
    `WebP Support   : ${ffmpegWebp ? chalk.green('OK') : chalk.red('GAGAL')}\n` +
    `ImageMagick    : ${imageMagick ? chalk.green('OK') : chalk.red('GAGAL')}\n` +
    chalk.magenta(`Waktu: ${end - start}ms\n`)
  )

  // Peringatan hanya jika ada yang gagal
  if (!ffmpeg)
    conn.logger.warn('Instal FFmpeg untuk mengirim video.')

  if (ffmpeg && !ffmpegWebp)
    conn.logger.warn('FFmpeg tidak mendukung WebP (sticker animasi mungkin gagal).')

  if (!imageMagick)
    conn.logger.warn('Instal ImageMagick atau GraphicsMagick untuk sticker.')
}
//--

_quickTest()
  .then(() => console.log('Uji coba cepat selesai!'))
  .catch(console.error)

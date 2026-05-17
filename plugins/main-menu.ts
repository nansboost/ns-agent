// @ts-nocheck
import { promises } from 'fs'
import { join } from 'path'
import fetch from 'node-fetch'
import moment from 'moment-timezone'
import { xpRange } from '../lib/levelling.ts'

// Pengaturan Tag & Nama Kategori
let tags = {
  'main': 'MAIN',  'game': 'GAME',
  'econ': 'ECON',
  'rg': 'REGISTER',
  'sticker': 'STICKER',
  'prem': 'PREMIUM',
  'group': 'GRUP',
  'nable': 'EN/DISABLE',
  'downloader': 'DOWNLOADER',
  'tools': 'TOOLS',
  'fun': 'FUN',
  'cmd': 'DATABASE',
  'owner': 'OWNER', 
  'advanced': 'ADVANCED',
  'info': 'INFO'
}

let handler = async (m, { conn, usedPrefix: _p, text, __dirname }) => {
  try {
    // 1. Data User & Sistem
    let _package = JSON.parse(await promises.readFile(join(__dirname, '../package.json')).catch(_ => ({}))) || {}
    
    // Hmph! Ini bagian yang kutambahkan: 'streak = 0' agar tidak undefined!
    let { exp, diamond, level, role, streak = 0 } = global.db.data.users[m.sender] || {}
    
    let { min, xp, max } = xpRange(level, global.multiplier)
    let name = await conn.getName(m.sender)
    
    // Waktu & Tanggal (WIB)
    const wib = moment.tz('Asia/Jakarta').format("HH:mm:ss")
    const hour_now = moment.tz('Asia/Jakarta').format('HH')
    const date = new Date().toLocaleDateString('id', { day: 'numeric', month: 'long', year: 'numeric' })
    
    let ucapanWaktu = 'Selamat malam'
    if (hour_now >= 3 && hour_now <= 10) ucapanWaktu = 'Selamat pagi'
    else if (hour_now > 10 && hour_now <= 15) ucapanWaktu = 'Selamat siang'
    else if (hour_now > 15 && hour_now <= 18) ucapanWaktu = 'Selamat sore'

    let _uptime = process.uptime() * 1000
    let uptime = clockString(_uptime)
    let totalreg = Object.keys(global.db.data.users).length

    // 2. Filter Plugins & Mapping Tag
    let help = Object.values(global.plugins).filter(plugin => !plugin.disabled).map(plugin => {
      return {
        help: Array.isArray(plugin.tags) ? plugin.help : [plugin.help],
        tags: Array.isArray(plugin.tags) ? plugin.tags : [plugin.tags],
        prefix: 'customPrefix' in plugin,
        diamond: plugin.diamond,
        premium: plugin.premium,
      }
    })

    // Otomatis tambah tag baru yang belum terdaftar di 'let tags'
    for (let plugin of help) {
      if (plugin && 'tags' in plugin) {
        for (let tag of plugin.tags) {
          if (!(tag in tags) && tag) tags[tag] = tag.toUpperCase()
        }
      }
    }

    const inputTag = text.trim().toLowerCase()

    // ==========================================
    // TAMPILAN 1: LIST KATEGORI (Ketik .menu)
    // ==========================================
    if (!inputTag) {
      let menuUtama = `
${ucapanWaktu}, *${name}*!

- User : ${totalreg}
- Level : ${level}
- Role : ${role}
- Streak : ${streak} Hari
- Runtime : ${uptime}
${conn.user.jid == global.conn.user.jid ? '' : `\n▢ ✨ *Sub-Bot:*\nwa.me/${global.conn.user.jid.split`@`[0]}`}
%readmore
*DAFTAR KATEGORI*

${Object.keys(tags).map(t => `∞ ${_p}menu ${t}`).join('\n')}

Ketik *${_p}allmenu* untuk melihat semua fitur.
`.trim()

      return await conn.sendMessage(m.chat, {
        text: menuUtama.replace('%readmore', readMore),
        mentions: [m.sender]
      }, { quoted: m })
    }

    // ==========================================
    // TAMPILAN 2: ISI KATEGORI (Ketik .menu game)
    // ==========================================
    if (!(inputTag in tags)) {
        return m.reply(`Hmph! Kategori *${inputTag}* tidak ditemukan. Jangan asal ngetik deh!`)
    }

    const prettyTag = tags[inputTag]
    let filteredHelp = help.filter(menu => menu.tags && menu.tags.includes(inputTag))

    let categoryMenu = `
${ucapanWaktu}, *${name}*

- *Uptime:* ${uptime}
- *Tanggal:* ${date}
- *Waktu:* ${wib}
- *Prefix:* [ *${_p}* ]

*Menu Kategori: ${prettyTag}*

${filteredHelp.map(menu => {
    return menu.help.map(h => {
        return `∞ ${_p}${h} ${menu.diamond ? '(ⓓ)' : ''}${menu.premium ? '(Ⓟ)' : ''}`.trim()
    }).join('\n')
}).join('\n')}

_Ketik ${_p}menu untuk kembali ke daftar kategori._
`.trim()

    await conn.sendMessage(m.chat, {
      text: categoryMenu,
      mentions: [m.sender]
    }, { quoted: m })
    
    m.react('📚')

  } catch (e) {
    conn.reply(m.chat, '❎ Maaf, ada kesalahan pada menu. Bukan salahku ya, pasti servermu yang bermasalah!', m)
    throw e
  }
}

handler.help = ['menu', 'help']
handler.tags = ['main']
handler.command = /^(menu|help|\?)$/i
handler.register = false

export default handler

// --- HELPER FUNCTIONS ---
const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)

function clockString(ms) {
  let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000)
  let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60
  let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60
  return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')
}
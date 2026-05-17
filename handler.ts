// @ts-nocheck
 import { smsg } from './lib/simple.ts'
import { format } from 'util' 
import { fileURLToPath } from 'url'
import path, { join } from 'path'
import { unwatchFile, watchFile } from 'fs'
import chalk from 'chalk'
import fetch from 'node-fetch'
import {
  collectJidMapFromGroupMetadata,
  getCachedLidFromPn,
  isLidJid,
  isPnJid,
  normalizeJid,
  normalizeJidForCompare,
  numberToPnJid,
  patchMessageSenderJid
} from './lib/jid-resolver.ts'



/**
 * @type {import('@whiskeysockets/baileys')}
 */
const { proto } = (await import('@whiskeysockets/baileys')).default
const isNumber = x => typeof x === 'number' && !isNaN(x)
const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const delay = ms => isNumber(ms) && new Promise(resolve => setTimeout(function () {
    clearTimeout(this)
    resolve()
}, ms))

function prefixToRegExp(prefix) {
    if (prefix instanceof RegExp) {
        const flags = prefix.flags ? prefix.flags.replace(/g/g, '') : ''
        return new RegExp(prefix.source, flags)
    }
    if (typeof prefix === 'string') {
        return new RegExp('^' + escapeRegExp(prefix))
    }
    return null
}

function textUsesBotPrefix(text = '', prefix = global.prefix) {
    if (!text || typeof text !== 'string') return false

    if (Array.isArray(prefix)) {
        return prefix.some(p => textUsesBotPrefix(text, p))
    }

    const re = prefixToRegExp(prefix)
    if (re) return re.test(text)

    return false
}

function isPrivateUnmappedLid(m = {}) {
    const raw = normalizeJid(m.rawSender || m.sender || '')
    const resolved = normalizeJid(m.senderPn || m.realSender || m.sender || '')

    return !m.fromMe &&
        !m.isGroup &&
        isLidJid(raw) &&
        !isPnJid(resolved)
}

function buildLidMappingRequiredText(m = {}) {
    const groupLink = global.ns_group ? `\n\nGrup bot untuk mapping:\n${global.ns_group}` : ''
    const raw = normalizeJid(m.rawSender || m.sender || '-')

    return [
        '⚠️ *JID belum terdeteksi*',
        '',
        `Chat kamu masih terbaca sebagai LID:`,
        raw,
        '',
        'Untuk menjalankan command private, kamu wajib masuk/kirim pesan dulu di grup yang ada bot ini.',
        'Setelah kamu muncul di grup, bot akan mengambil mapping dari groupMetadata peserta lalu m.sender bisa menjadi JID nomor asli.',
        '',
        'Langkah:',
        '1. Masuk ke grup bot.',
        '2. Kirim pesan apa saja di grup.',
        '3. Kembali ke private chat dan ketik command lagi.',
        groupLink
    ].filter(Boolean).join('\n')
}
 
/**
 * Handle messages upsert
 * @param {import('@whiskeysockets/baileys').BaileysEventMap<unknown>['messages.upsert']} groupsUpdate 
 */
export async function handler(chatUpdate) {

     let settings = {}

    this.msgqueque = this.msgqueque || []


    if (!chatUpdate)
        return
    //this.pushMessage(chatUpdate.messages).catch(console.error)

    let m = chatUpdate.messages[chatUpdate.messages.length - 1]
    if (!m)
        return
    if (global.db.data == null)
        await global.loadDatabase()

//--
global.db.data ||= {}
global.db.data.users ||= {}
global.db.data.chats ||= {}
global.db.data.stats ||= {}
global.db.data.settings ||= {}
    

    
    try {
        m = smsg(this, m) || m
        if (!m)
            return
        m.exp = 0
        m.coin = 0
        m.diamond = false

        // Patch m.sender seawal mungkin: jika raw sender berupa @lid dan mapping
        // sudah pernah didapat dari kontak/grup/signal repository, m.sender akan
        // menjadi JID nomor asli (@s.whatsapp.net). Kalau mapping belum ada,
        // m.sender tetap @lid agar tidak membuat JID palsu.
        await patchMessageSenderJid(this, m).catch(() => m)

        // Tandai private chat LID yang belum punya mapping sebelum user init.
        // Ini dipakai untuk memberi instruksi pada chat pertama tanpa membuat JID palsu.
        m.firstPrivateUnmappedLidChat = isPrivateUnmappedLid(m) &&
            !global.db.data.users?.[m.sender] &&
            !global.db.data.users?.[m.rawSender]

        try {
    // =============================
    // USER INIT
    // =============================

    const userDefaults = {
        exp: 0,
        coin: 0,
        diamond: 20,
        bank: 0,
        registered: false,
        name: m.name,
        age: -1,
        regTime: -1,
        afk: -1,
        afkReason: '',
        banned: false,

        level: 0,
        role: 'Pemula',
        autolevelup: false,
    }

    if (m.rawSender && m.sender && m.rawSender !== m.sender && global.db.data.users[m.rawSender] && !global.db.data.users[m.sender]) {
        global.db.data.users[m.sender] = {
            ...global.db.data.users[m.rawSender],
            lastRawJid: m.rawSender,
            jidMigratedAt: new Date().toISOString()
        }
    }

    if (!global.db.data.users[m.sender])
        global.db.data.users[m.sender] = {}

    let user = global.db.data.users[m.sender]

    for (let key in userDefaults) {
        if (!(key in user) || user[key] === undefined || user[key] === null) {
            user[key] = userDefaults[key]
        }
    }

    // =============================
    // CHAT INIT
    // =============================

    const chatDefaults = {
        isBanned: false,
        welcome: false,
        detect: false,
        sWelcome: '',
        sBye: '',
        sPromote: '',
        sDemote: '',
        antiLink: false,
        nsfw: false,
        rules: '',
        antiBotClone: false
    }

    if (!global.db.data.chats[m.chat])
        global.db.data.chats[m.chat] = {}

    let chat = global.db.data.chats[m.chat]

    for (let key in chatDefaults) {
        if (!(key in chat) || chat[key] === undefined || chat[key] === null) {
            chat[key] = chatDefaults[key]
        }
    }

    // =============================
    // SETTINGS INIT
    // =============================

    if (!global.db.data.settings)
        global.db.data.settings = {}

    if (this.user?.jid) {

        const settingDefaults = {
            self: false,
            autoread: false,
            restrict: false,
            status: 0,
            solopv: false,
            sologp: false
        }

        if (!global.db.data.settings[this.user.jid])
            global.db.data.settings[this.user.jid] = {}

        settings = global.db.data.settings[this.user.jid]

        for (let key in settingDefaults) {
            if (!(key in settings)) {
                settings[key] = settingDefaults[key]
            }
        }
    }

} catch (e) {
    console.error('Error initializing data:', e)
}

//---- AA  

// =============================
// BASIC MESSAGE GUARDS
// =============================

const opts = global.opts || {}
const isGroup = m.chat?.endsWith('g.us')
const text = typeof m.text === 'string' ? m.text : ''

m.text = text

// Mode mendengarkan (tidak merespons apa pun)
if (opts.nyimak) return
// Mode self (hanya merespons ke diri sendiri)
if (opts.self && !m.fromMe) return
// Hanya privat
if (settings.solopv && isGroup) return
// Hanya grup (dengan pengecualian yang diizinkan di privat)
if (settings.sologp && !isGroup) {

    const allowedPrivateCmd = [
        'support','donate','off','on','s',
        'tiktok','join'
    ]

    const firstWord = text.trim().split(' ')[0]
    const command = firstWord.replace(/^[!./#?]/, '').toLowerCase()

    if (!allowedPrivateCmd.includes(command)) return
}
// Hanya status
if (opts.swonly && m.chat !== 'status@broadcast') return

const hasCommandPrefix = textUsesBotPrefix(text, this.prefix || global.prefix)
const mustMapViaGroup = isPrivateUnmappedLid(m)

// Private chat yang masih berupa @lid tidak boleh dipaksa menjadi JID palsu.
// Jika user pertama kali chat atau mulai memakai prefix/command, bot wajib
// meminta user masuk/kirim pesan di grup yang ada bot agar mapping LID -> PN
// bisa diambil dari groupMetadata peserta.
if (mustMapViaGroup && (hasCommandPrefix || m.firstPrivateUnmappedLidChat)) {
    try {
        await this.reply(m.chat, buildLidMappingRequiredText(m), m)
    } catch {
        try { await m.reply?.(buildLidMappingRequiredText(m)) } catch {}
    }
    return
}


// =============================
// SAFE USER INIT (Minimal Fallback)
// =============================

if (m.rawSender && m.sender && m.rawSender !== m.sender && global.db.data.users[m.rawSender] && !global.db.data.users[m.sender]) {
    global.db.data.users[m.sender] = {
        ...global.db.data.users[m.rawSender],
        lastRawJid: m.rawSender,
        jidMigratedAt: new Date().toISOString()
    }
}

if (!global.db.data.users[m.sender]) {
    global.db.data.users[m.sender] = {
        exp: 0,
        diamond: 20,
        level: 0,
        prem: false
    }
}


let _user = global.db.data && global.db.data.users && global.db.data.users[m.sender]

const rawSender = normalizeJid(m.rawSender || m.sender)
const sender = normalizeJidForCompare(m.realSender || m.sender || rawSender)
const senderLid = m.senderLid || (isLidJid(rawSender) ? rawSender : isPnJid(sender) ? getCachedLidFromPn(sender) : null)
const botNumber = normalizeJidForCompare(this.user?.jid || this.user?.id || '')
const normalize = v => numberToPnJid(Array.isArray(v) ? v[0] : v)

m.rawSender = rawSender
m.realSender = sender
m.senderPn = isPnJid(sender) ? sender : null
m.senderLid = senderLid

const isROwner = sender === botNumber || global.owner.some(v => sender === normalize(v))
const isOwner = isROwner || m.fromMe
const isMods = isOwner || global.mods.map(v => normalize(v)).includes(sender)
const isPrems = isROwner || global.prems.map(v => normalize(v)).includes(sender) || (_user?.prem === true)


        if (opts['queque'] && m.text && !(isMods || isPrems)) {
            const queque = this.msgqueque
            const messageId = m.id || m.key.id
            const previousID = queque[queque.length - 1]
            queque.push(messageId)

            while (previousID && queque.includes(previousID)) {
                await delay(5000)
            }
        }

        if (m.isBaileys)
            return
        m.exp += Math.ceil(Math.random() * 10)

        let usedPrefix
        //let _user = global.db.data && global.db.data.users && global.db.data.users[m.sender]
        
           const groupMetadata = m.isGroup? conn.chats[m.chat]?.metadata || await this.groupMetadata(m.chat).catch(() => null) : null
           if (groupMetadata) collectJidMapFromGroupMetadata(groupMetadata, `handler:${m.chat}`)
           const participants = groupMetadata?.participants || []


            const senderJid = normalizeJidForCompare(sender)
            const rawSenderJid = normalizeJidForCompare(rawSender)
            const botJid = normalizeJidForCompare(this.user?.jid || this.user?.id || '')
            const participantIds = (u = {}) => [u.id, u.jid, u.lid, u.phoneNumber, u.pn]
                .filter(Boolean)
                .map(v => normalizeJidForCompare(v))

              const user = m.isGroup ? participants.find(u => {
                const ids = participantIds(u)
                return ids.includes(senderJid) || ids.includes(rawSenderJid) || (senderLid && ids.includes(senderLid))
              }) || {} : {}
           // const user = participants.find((u) => (u.jid || u.phoneNumber || u.id) === m.sender) || {};
              const bot  = participants.find(u => participantIds(u).includes(botJid)) || {};


const isRAdmin = user.admin === 'superadmin'
const isAdmin = user?.admin === 'admin' || user?.admin === 'superadmin'
const isBotAdmin  = bot?.admin === 'admin' || bot?.admin === 'superadmin' || false;

        const projectRoot = path.dirname(fileURLToPath(import.meta.url))
        const rootPluginDir = path.join(projectRoot, './plugins')
        
        for (let name in global.plugins) {
            let plugin = global.plugins[name]
            if (!plugin)
                continue
            if (plugin.disabled)
                continue
            const __filename = global.pluginFiles?.[name] || (String(name).startsWith('ws/plugins/') ? path.join(projectRoot, name) : path.join(rootPluginDir, name))
            const ___dirname = path.dirname(__filename)

            if (typeof plugin.all === 'function') {
                try {
                    await plugin.all.call(this, m, {
                        chatUpdate,
                        __dirname: ___dirname,
                        __filename
                    })
                } catch (e) {
                    // if (typeof e === 'string') continue
                    console.error(e)
                }
            }
            if (!opts['restrict'])
                if (plugin.tags && plugin.tags.includes('admin')) {
                    // global.dfail('restrict', m, this)
                    continue
                }
                
            const str2Regex = str => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
            let _prefix = plugin.customPrefix ? plugin.customPrefix : conn.prefix ? conn.prefix : global.prefix
            
            let match = (_prefix instanceof RegExp ? // RegExp Mode?
                [[_prefix.exec(m.text), _prefix]] :
                Array.isArray(_prefix) ? // Array?
                    _prefix.map(p => {
                        let re = p instanceof RegExp ? // RegExp in Array?
                            p :
                            new RegExp(str2Regex(p))
                        return [re.exec(m.text), re]
                    }) :
                    typeof _prefix === 'string' ? // String?
                        [[new RegExp(str2Regex(_prefix)).exec(m.text), new RegExp(str2Regex(_prefix))]] :
                        [[[], new RegExp]]
            ).find(p => p[1])
//--
            if (typeof plugin.before === 'function') {
                if (await plugin.before.call(this, m, {
                    match,
                    conn: this,
                    participants,
                    groupMetadata,
                    user,
                    bot,
                    isROwner,
                    isOwner,
                    isRAdmin,
                    isAdmin,
                    isBotAdmin,
                    isPrems,
                    chatUpdate,
                    __dirname: ___dirname,
                    __filename
                }))
                    continue
            }

            if (typeof plugin !== 'function')
                continue

            
            if ((usedPrefix = (match[0] || '')[0])) {
                let noPrefix = m.text.replace(usedPrefix, '')
                let [command, ...args] = noPrefix.trim().split` `.filter(v => v)
                args = args || []
                let _args = noPrefix.trim().split` `.slice(1)
                let text = _args.join` `
                command = (command || '').toLowerCase()
                let fail = plugin.fail || global.dfail // When failed
                let isAccept = plugin.command instanceof RegExp ? // RegExp Mode?
                    plugin.command.test(command) :
                    Array.isArray(plugin.command) ? // Array?
                        plugin.command.some(cmd => cmd instanceof RegExp ? // RegExp in Array?
                            cmd.test(command) :
                            cmd === command
                        ) :
                        typeof plugin.command === 'string' ? // String?
                            plugin.command === command :
                            false

                if (!isAccept)
                    continue
                m.plugin = name
                if (m.chat in global.db.data.chats || m.sender in global.db.data.users) {
                    let chat = global.db.data.chats[m.chat]
                    let user = global.db.data.users[m.sender]
                    if (name != 'owner-unbanchat.ts' && chat?.isBanned)
                        return // Except this
                    if (name != 'owner-unbanuser.ts' && user?.banned)
                        return
                }
                if (plugin.rowner && plugin.owner && !(isROwner || isOwner)) { // Both Owner
                    fail('owner', m, this)
                    continue
                }
                if (plugin.rowner && !isROwner) { // Real Owner
                    fail('rowner', m, this)
                    continue
                }
                if (plugin.owner && !isOwner) { // Number Owner
                    fail('owner', m, this)
                    continue
                }
                if (plugin.mods && !isMods) { // Moderator
                    fail('mods', m, this)
                    continue
                }
                if (plugin.premium && !isPrems) { // Usuarios Premium
                    fail('premium', m, this)
                    continue
                }
                if (plugin.group && !m.isGroup) { // Group Only
                    fail('group', m, this)
                    continue
                } else if (plugin.botAdmin && !isBotAdmin) { // You Admin
                    fail('botAdmin', m, this)
                    continue
                } else if (plugin.admin && !isAdmin) { // User Admin
                    fail('admin', m, this)
                    continue
                }
                if (plugin.private && m.isGroup) { // Private Chat Only
                    fail('private', m, this)
                    continue
                }
                if (plugin.register == true && _user.registered == false) { // Butuh daftar?
                    fail('unreg', m, this)
                    continue
                }
                m.isCommand = true
                let xp = 'exp' in plugin ? parseInt(plugin.exp) : 17 // XP yang didapat dari command
                if (xp > 200)
                    m.reply('chirrido -_-') // Hehehe
                else
                    m.exp += xp
                if (!isPrems && plugin.diamond && global.db.data.users[m.sender].diamond < plugin.diamond * 1) {
                    this.reply(m.chat, `âœ³ï¸ Diamond kamu habis\nGunakan perintah berikut untuk membeli lebih banyak diamond\n\n*${usedPrefix}buy*`, m)
                    continue // Limit habis
                }
                if (plugin.level > _user.level) {
                    this.reply(m.chat, `âœ³ï¸ Level ${plugin.level} diperlukan untuk menggunakan perintah ini. \nLevel kamu ${_user.level}`, m)
                    continue // If the level has not been reached
                }
                let extra = {
                    match,
                    usedPrefix,
                    noPrefix,
                    _args,
                    args,
                    command,
                    text,
                    conn: this,
                    participants,
                    groupMetadata,
                    user,
                    bot,
                    isROwner,
                    isOwner,
                    isRAdmin,
                    isAdmin,
                    isBotAdmin,
                    isPrems,
                    chatUpdate,
                    __dirname: ___dirname,
                    __filename
                }
                try {
                    await plugin.call(this, m, extra)
                    if (!isPrems)
                        m.diamond = m.diamond || plugin.diamond || false
                } catch (e) {
                    // Error occured
                    m.error = e
                    console.error(e)
                    if (e) {
                        // Helper escapeRegExp sudah didefinisikan di atas file
                        // Log stacktrace lengkap ke console (hanya owner yang bisa lihat)
                        let fullText = format(e)
                        const apiKeys = global.APIKeys && typeof global.APIKeys === 'object' ? Object.values(global.APIKeys) : []
                        for (let key of apiKeys)
                            fullText = fullText.replace(new RegExp(escapeRegExp(key), 'g'), '#HIDDEN#')
                        const providers = global.agentRouter?.providers
                        if (providers && typeof providers === 'object') {
                            for (let prov of Object.values(providers)) {
                                if (prov && typeof prov === 'object' && prov.apiKey)
                                    fullText = fullText.replace(new RegExp(escapeRegExp(prov.apiKey), 'g'), '#HIDDEN#')
                            }
                        }
                        console.error('[HANDLER FULL ERROR]', fullText)
                        // Pesan singkat aman untuk user
                        let safeMsg = '⚠️ Terjadi kesalahan saat menjalankan perintah.'
                        if (e && typeof e === 'object') {
                            let raw = String(e.message || e.toString()).trim()
                            let short = raw.split('\n')[0].substring(0, 120)
                            if (short) safeMsg = `⚠️ Error: ${short}`
                        }
                        const sensitivePatterns = [
                            /nvapi-[A-Za-z0-9_\-]+/g, /sk-[A-Za-z0-9]+/g,
                            /628[0-9]{8,12}/g, /1852[0-9]{12,16}/g,
                            /sessions?\/[A-Za-z0-9_.-]+/gi, /creds\.json/gi, /database\.json/gi,
                            /agent-sessions\.json/gi, /agent-provider\.json/gi,
                            /home\/container[A-Za-z0-9_./-]*/gi, /[A-Za-z]:\\[A-Za-z0-9_./\\-]*/gi,
                        ]
                        for (let pat of sensitivePatterns) safeMsg = safeMsg.replace(pat, '[REDACTED]')
                        m.reply(safeMsg)
                    }
                } finally {
                    // m.reply(util.format(_user))
                    if (typeof plugin.after === 'function') {
                        try {
                            await plugin.after.call(this, m, extra)
                        } catch (e) {
                            console.error(e)
                        }
                    }
                    if (m.diamond)
                        m.reply(`Kamu menggunakan *${+m.diamond}* ðŸ'Ž`)
                }
                break
            }
            //
        }
    } catch (e) {
        console.error(e)
    } finally {
        if (opts['queque'] && m.text) {
            const quequeIndex = this.msgqueque.indexOf(m.id || m.key.id)
            if (quequeIndex !== -1)
                this.msgqueque.splice(quequeIndex, 1)
        }
        //console.log(global.db.data.users[m.sender])
        let user, stats = global.db.data.stats
        if (m) {
            if (m.sender && (user = global.db.data.users[m.sender])) {
                user.exp += m.exp
                user.diamond -= m.diamond * 1
            }

            let stat
            if (m.plugin) {
                let now = +new Date
                if (m.plugin in stats) {
                    stat = stats[m.plugin]
                    if (!isNumber(stat.total))
                        stat.total = 0
                    if (!isNumber(stat.success))
                        stat.success = 0
                    if (!isNumber(stat.last))
                        stat.last = now
                    if (!isNumber(stat.lastSuccess))
                        stat.lastSuccess = m.error != null ? 0 : now
                } else
                    stat = stats[m.plugin] = {
                        total: 0,
                        success: 0,
                        last: now,
                        lastSuccess: m.error != null ? 0 : now
                    }
                stat.total += 1
                stat.last = now
                if (m.error == null) {
                    stat.success += 1
                    stat.lastSuccess = now
                }
            }
        }

        try {
            if (!opts['noprint']) await (await import(`./lib/print.ts`)).default(m, this)
        } catch (e) {
            console.log(m, m.quoted, e)
        }
        if (opts['autoread'])
            await this.chatRead(m.chat, m.isGroup ? m.sender : undefined, m.id || m.key.id).catch(() => { })
    }
}
//--
export async function participantsUpdate({ id, participants, action }) {
    if (opts['self']) return
    if (global.db.data == null) await loadDatabase()

    let chat = global.db.data.chats[id] || {}
    let text = ''

    // ðŸ"¥ Normalizador para v7
    const normalize = (p) =>
        typeof p === 'string' ? p : p?.id

    switch (action) {

        case 'add':
        case 'remove':
            if (!chat.welcome) break

            let groupMetadata =
                await this.groupMetadata(id).catch(_ => null) ||
                (conn.chats[id] || {}).metadata

            if (!groupMetadata) return

            for (let participant of participants) {

                const user = normalize(participant)
                if (!user) continue

                let pp = 'https://i.ibb.co/1ZxrXKJ/avatar-contact.jpg'
                let ppgp = 'https://i.ibb.co/1ZxrXKJ/avatar-contact.jpg'

                try { pp = await this.profilePictureUrl(user, 'image') } catch {}
                try { ppgp = await this.profilePictureUrl(id, 'image') } catch {}

                text = (action === 'add'
                    ? (chat.sWelcome || this.welcome || conn.welcome || 'Selamat datang, @user')
                        .replace('@group', await this.getName(id))
                        .replace('@desc', groupMetadata.desc?.toString() || 'Tidak diketahui')
                    : (chat.sBye || this.bye || conn.bye || 'Selamat tinggal, @user')
                ).replace('@user', '@' + user.split('@')[0])

                try {
                    let imageUrl = action === 'add'
                        ? API('fgmods', '/api/welcome', {
                            username: await this.getName(user),
                            groupname: await this.getName(id),
                            groupicon: ppgp,
                            membercount: groupMetadata.participants?.length || 0,
                            profile: pp,
                            background: 'https://i.ibb.co/fkFmQC2/eve.jpg'
                        }, 'apikey')
                        : API('fgmods', '/api/goodbye2', {
                            username: await this.getName(user),
                            groupname: await this.getName(id),
                            groupicon: ppgp,
                            membercount: groupMetadata.participants?.length || 0,
                            profile: pp,
                            background: 'https://i.ibb.co/jh9367t/akali.jpg'
                        }, 'apikey')

                    await this.sendFile(id, imageUrl, 'welcome.jpg', text, null, false, {
                        mentions: [user]
                    })

                } catch {
                    await this.sendFile(id, pp, 'profile.jpg', text, null, false, {
                        mentions: [user]
                    })
                }
            }
            break


        case 'promote':
        case 'demote':
            if (!chat.detect) break

            for (let participant of participants) {

                const user = normalize(participant)
                if (!user) continue

                let pp = await this.profilePictureUrl(user, 'image')
                    .catch(_ => 'https://i.ibb.co/1ZxrXKJ/avatar-contact.jpg')

                text = action === 'promote'
                    ? (chat.sPromote || this.spromote || conn.spromote || '@user sekarang menjadi admin')
                    : (chat.sDemote || this.sdemote || conn.sdemote || '@user bukan admin lagi')

                text = text.replace('@user', '@' + user.split('@')[0])

                await this.sendFile(id, pp, 'pp.jpg', text, null, false, {
                    mentions: [user]
                })
            }
            break
    }
}

/**
 * Handle groups update
 * @param {import('@whiskeysockets/baileys').BaileysEventMap<unknown>['groups.update']} groupsUpdate 
 */
export async function groupsUpdate(groupsUpdate) {
    if (opts['self'])
        return
    for (const groupUpdate of groupsUpdate) {
        const id = groupUpdate.id
        if (!id) continue
        let chats = global.db.data.chats[id], text = ''
        if (!chats?.detect) continue
        if (groupUpdate.desc) text = (chats.sDesc || this.sDesc || conn.sDesc || 'Deskripsi diubah menjadi \n@desc').replace('@desc', groupUpdate.desc)
        if (groupUpdate.subject) text = (chats.sSubject || this.sSubject || conn.sSubject || 'Nama grup diubah menjadi \n@group').replace('@group', groupUpdate.subject)
        if (groupUpdate.icon) text = (chats.sIcon || this.sIcon || conn.sIcon || 'Icon grup diubah').replace('@icon', groupUpdate.icon)
        if (groupUpdate.revoke) text = (chats.sRevoke || this.sRevoke || conn.sRevoke || 'Link grup diubah menjadi\n@revoke').replace('@revoke', groupUpdate.revoke)
        if (!text) continue
        await this.sendMessage(id, { text, mentions: this.parseMention(text) })
    }
}


global.dfail = (type, m, conn) => {
let msg = {
rowner: `👑 Perintah ini hanya bisa digunakan oleh *Creator bot*`,
owner: `🔱 Perintah ini hanya bisa digunakan oleh *Owner dan Sub Bot*`,
mods: `🔰 Fitur ini hanya untuk *Moderator Bot*`,
premium: `💠 Perintah ini hanya untuk member *Premium*\n\nKetik */premium* untuk info lebih lanjut`,
group: `⚙️ Perintah ini hanya bisa digunakan di grup`,
private: `📮 Perintah ini hanya bisa digunakan di *chat pribadi Bot*`,
admin: `🛡️ Perintah ini hanya untuk *Admin* grup`,
botAdmin: `💥 *Untuk menggunakan perintah ini, aku harus jadi Admin!*`,
unreg: `📇 Daftar terlebih dahulu untuk menggunakan fitur ini dengan mengetik:\n\n*/reg*`,
restrict: '🔐 Fitur ini *dinonaktifkan*'
}[type]
//if (msg) return conn.sendButton(m.chat, msg, mssg.ig, null, [['🔖 OK', 'khajs'], ['⦙☰ MENU', '/menu'] ], m)
if (msg) return m.reply(msg)
}

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
    unwatchFile(file)
    console.log(chalk.magenta("✅  Update 'handler.ts'"))
    if (global.reloadHandler) console.log(await global.reloadHandler())
}) 



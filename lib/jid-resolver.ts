// @ts-nocheck
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const baileys = await import('@whiskeysockets/baileys')
const { jidDecode, jidNormalizedUser } = baileys

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const JID_DATA_DIR = path.join(__dirname, 'jid-data')
const JID_MAP_FILE = path.join(JID_DATA_DIR, 'jid-map.json')

const DEFAULT_STATE = {
  version: 1,
  updatedAt: null,
  lidToPn: {},
  pnToLid: {},
  sources: {}
}

let stateCache = null
let saveTimer = null
let lastAllGroupSyncAt = 0
let allGroupSyncPromise = null
const ALL_GROUP_SYNC_INTERVAL_MS = 10 * 60 * 1000

function ensureDataDir() {
  fs.mkdirSync(JID_DATA_DIR, { recursive: true })
  if (!fs.existsSync(JID_MAP_FILE)) {
    fs.writeFileSync(JID_MAP_FILE, JSON.stringify(DEFAULT_STATE, null, 2))
  }
}

function safeReadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback
    const raw = fs.readFileSync(file, 'utf8')
    if (!raw.trim()) return fallback
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

function writeJsonAtomic(file, data) {
  ensureDataDir()
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, file)
}

export function loadJidMap() {
  ensureDataDir()
  if (!stateCache) {
    const loaded = safeReadJson(JID_MAP_FILE, DEFAULT_STATE)
    stateCache = {
      ...DEFAULT_STATE,
      ...loaded,
      lidToPn: loaded?.lidToPn && typeof loaded.lidToPn === 'object' ? loaded.lidToPn : {},
      pnToLid: loaded?.pnToLid && typeof loaded.pnToLid === 'object' ? loaded.pnToLid : {},
      sources: loaded?.sources && typeof loaded.sources === 'object' ? loaded.sources : {}
    }
  }
  return stateCache
}

export function saveJidMap() {
  const state = loadJidMap()
  state.updatedAt = new Date().toISOString()
  writeJsonAtomic(JID_MAP_FILE, state)
}

function scheduleSave() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try { saveJidMap() } catch {}
  }, 1000)
}

export function normalizeJid(jid = '') {
  if (!jid || typeof jid !== 'string') return jid
  let value = jid.trim()
  if (!value) return value

  // Jangan pernah bikin jid baru dari string yang sudah punya server lain.
  if (/:\d+@/i.test(value)) {
    try {
      const decoded = jidDecode(value) || {}
      if (decoded.user && decoded.server) value = `${decoded.user}@${decoded.server}`
    } catch {}
  }

  try {
    if (value.includes('@')) value = jidNormalizedUser(value)
  } catch {}

  return String(value).replace(/:\d+@/i, '@').trim()
}

export function isLidJid(jid = '') {
  return normalizeJid(jid).endsWith('@lid')
}

export function isPnJid(jid = '') {
  return normalizeJid(jid).endsWith('@s.whatsapp.net')
}

export function isGroupJid(jid = '') {
  return normalizeJid(jid).endsWith('@g.us')
}

export function numberToPnJid(value = '') {
  if (!value) return ''
  const jid = normalizeJid(String(value))
  if (isPnJid(jid)) return jid
  if (jid.includes('@')) return jid
  const digits = jid.replace(/[^0-9]/g, '')
  return digits ? `${digits}@s.whatsapp.net` : ''
}

function rememberSource(lid, pn, source) {
  const state = loadJidMap()
  const key = `${lid}|${pn}`
  state.sources[key] = {
    source: source || 'unknown',
    updatedAt: new Date().toISOString()
  }
}

export function rememberJidPair(lid, pn, source = 'unknown') {
  lid = normalizeJid(lid)
  pn = normalizeJid(pn)

  if (!isLidJid(lid) || !isPnJid(pn)) return false

  const state = loadJidMap()
  const changed = state.lidToPn[lid] !== pn || state.pnToLid[pn] !== lid

  state.lidToPn[lid] = pn
  state.pnToLid[pn] = lid
  rememberSource(lid, pn, source)

  if (changed) scheduleSave()
  return true
}

export function rememberJidObject(obj = {}, source = 'object') {
  if (!obj || typeof obj !== 'object') return false

  const candidates = [
    obj.id,
    obj.jid,
    obj.lid,
    obj.phoneNumber,
    obj.phoneNumber ? numberToPnJid(obj.phoneNumber) : null,
    obj.pn,
    obj.pn ? numberToPnJid(obj.pn) : null,
    obj.participant,
    obj.sender,
    obj.remoteJid
  ].filter(Boolean).map(normalizeJid)

  const lids = candidates.filter(isLidJid)
  const pns = candidates.filter(isPnJid)

  let changed = false
  for (const lid of lids) {
    for (const pn of pns) {
      changed = rememberJidPair(lid, pn, source) || changed
    }
  }

  return changed
}

export function collectJidMapFromContacts(contacts, source = 'contacts') {
  const list = Array.isArray(contacts)
    ? contacts
    : Array.isArray(contacts?.contacts)
      ? contacts.contacts
      : []

  let changed = false
  for (const contact of list) {
    changed = rememberJidObject(contact, source) || changed
  }
  return changed
}

export function collectJidMapFromGroupMetadata(metadata, source = 'groupMetadata') {
  if (!metadata) return false
  let changed = rememberJidObject(metadata, source)
  for (const participant of metadata.participants || []) {
    changed = rememberJidObject(participant, source) || changed
  }
  return changed
}

export function collectJidMapFromMessage(message, source = 'message') {
  if (!message) return false
  let changed = false
  changed = rememberJidObject(message.key || {}, source) || changed
  changed = rememberJidObject(message, source) || changed
  if (message.participant) changed = rememberJidObject({ participant: message.participant }, source) || changed
  return changed
}

async function resolveViaSignalRepository(conn, jid) {
  try {
    const mapping = conn?.signalRepository?.lidMapping
    if (!mapping) return null

    const candidates = [
      mapping.getPNForLID?.bind(mapping),
      mapping.getPNForLid?.bind(mapping),
      mapping.getPNForLIDJid?.bind(mapping)
    ].filter(Boolean)

    for (const fn of candidates) {
      const pn = normalizeJid(await fn(jid))
      if (isPnJid(pn)) return pn
    }
  } catch {}
  return null
}


export async function collectJidMapFromAllGroups(conn, force = false) {
  if (!conn) return false

  const now = Date.now()
  if (!force && lastAllGroupSyncAt && now - lastAllGroupSyncAt < ALL_GROUP_SYNC_INTERVAL_MS) {
    return false
  }

  if (allGroupSyncPromise) return allGroupSyncPromise

  allGroupSyncPromise = (async () => {
    let changed = false
    try {
      if (typeof conn.insertAllGroup === 'function') {
        const chats = await conn.insertAllGroup().catch(() => null)
        for (const chat of Object.values(chats || {})) {
          if (chat?.metadata) changed = collectJidMapFromGroupMetadata(chat.metadata, `allGroups:${chat.id || chat.metadata.id}`) || changed
        }
      }

      if (typeof conn.groupFetchAllParticipating === 'function') {
        const groups = await conn.groupFetchAllParticipating().catch(() => null) || {}
        conn.chats ||= {}
        for (const [groupJid, metadata] of Object.entries(groups)) {
          const id = normalizeJid(groupJid || metadata?.id)
          if (!isGroupJid(id)) continue
          conn.chats[id] = { ...(conn.chats[id] || {}), id, subject: metadata?.subject, isChats: true, metadata }
          changed = collectJidMapFromGroupMetadata(metadata, `allGroups:${id}`) || changed
        }
      }
    } finally {
      lastAllGroupSyncAt = Date.now()
      allGroupSyncPromise = null
    }
    return changed
  })()

  return allGroupSyncPromise
}

function findMappedPnInCachedGroups(conn, jid) {
  for (const [groupJid, chat] of Object.entries(conn?.chats || {})) {
    if (!isGroupJid(groupJid)) continue
    const metadata = chat?.metadata
    if (!metadata) continue

    for (const p of metadata.participants || []) {
      rememberJidObject(p, `cachedGroup:${groupJid}`)
      const ids = [p.id, p.jid, p.lid, p.phoneNumber, p.pn]
        .filter(Boolean)
        .map(normalizeJid)
      if (!ids.includes(jid)) continue
      const pn = ids.find(isPnJid)
      if (pn) return pn
    }
  }
  return null
}

async function resolveViaGroupMetadata(conn, jid, chatId) {
  const groups = []

  if (chatId && isGroupJid(chatId)) groups.push(chatId)

  for (const [id, chat] of Object.entries(conn?.chats || {})) {
    if (isGroupJid(id)) groups.push(id)
    if (chat?.metadata?.id && isGroupJid(chat.metadata.id)) groups.push(chat.metadata.id)
  }

  const uniqueGroups = [...new Set(groups.map(normalizeJid))]

  for (const groupJid of uniqueGroups) {
    let metadata = conn?.chats?.[groupJid]?.metadata
    if (!metadata && typeof conn?.groupMetadata === 'function') {
      metadata = await conn.groupMetadata(groupJid).catch(() => null)
      if (metadata) collectJidMapFromGroupMetadata(metadata, `group:${groupJid}`)
    }

    for (const p of metadata?.participants || []) {
      rememberJidObject(p, `group:${groupJid}`)
      const ids = [p.id, p.jid, p.lid, p.phoneNumber, p.pn].filter(Boolean).map(normalizeJid)
      if (!ids.includes(jid)) continue

      const pn = ids.find(isPnJid)
      if (pn) return pn
    }
  }

  const cachedGroupPn = findMappedPnInCachedGroups(conn, jid)
  if (cachedGroupPn) return cachedGroupPn

  // Private chat sering hanya membawa @lid. Kalau cache belum punya mapping,
  // scan seluruh grup yang bot ikuti untuk mencari pasangan LID -> PN.
  await collectJidMapFromAllGroups(conn, false).catch(() => false)
  return findMappedPnInCachedGroups(conn, jid)
}

export async function resolveJid(conn, jid, options = {}) {
  jid = normalizeJid(jid)
  if (!jid) return jid
  if (isPnJid(jid) || isGroupJid(jid) || jid === 'status@broadcast') return jid

  const state = loadJidMap()

  if (isLidJid(jid)) {
    const cached = state.lidToPn[jid]
    if (isPnJid(cached)) return cached

    const signalPn = await resolveViaSignalRepository(conn, jid)
    if (signalPn) {
      rememberJidPair(jid, signalPn, 'signalRepository')
      return signalPn
    }

    const groupPn = await resolveViaGroupMetadata(conn, jid, options.chatId || options.groupJid)
    if (groupPn) {
      rememberJidPair(jid, groupPn, 'groupMetadata')
      return groupPn
    }
  }

  return jid
}

export function getCachedPnFromLid(lid) {
  lid = normalizeJid(lid)
  const pn = loadJidMap().lidToPn[lid]
  return isPnJid(pn) ? pn : null
}

export function getCachedLidFromPn(pn) {
  pn = normalizeJid(pn)
  const lid = loadJidMap().pnToLid[pn]
  return isLidJid(lid) ? lid : null
}

export function getSenderJid(message = {}) {
  const chat = normalizeJid(message?.key?.remoteJid || message?.chat || '')
  if (isGroupJid(chat)) {
    return normalizeJid(message?.key?.participant || message?.participant || message?.sender || '')
  }
  return chat
}

export async function resolveSenderJid(conn, message = {}) {
  const sender = getSenderJid(message)
  const chat = normalizeJid(message?.key?.remoteJid || message?.chat || '')
  return resolveJid(conn, sender, { chatId: chat })
}


function defineMessageValue(message, key, value) {
  try {
    Object.defineProperty(message, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    })
  } catch {
    try { message[key] = value } catch {}
  }
}

export async function patchMessageSenderJid(conn, message = {}) {
  if (!message) return message

  const rawSender = normalizeJid(message.rawSender || getSenderJid(message) || message.sender || '')
  const chat = normalizeJid(message?.key?.remoteJid || message?.chat || '')
  const resolved = normalizeJid(await resolveJid(conn, rawSender, { chatId: chat }).catch(() => rawSender))
  const finalSender = isPnJid(resolved) ? resolved : rawSender
  const senderLid = isLidJid(rawSender)
    ? rawSender
    : isPnJid(finalSender)
      ? getCachedLidFromPn(finalSender)
      : null

  defineMessageValue(message, 'rawSender', rawSender)
  defineMessageValue(message, 'realSender', finalSender)
  defineMessageValue(message, 'senderPn', isPnJid(finalSender) ? finalSender : null)
  defineMessageValue(message, 'senderLid', senderLid)
  defineMessageValue(message, 'sender', finalSender)

  return message
}

export function normalizeJidForCompare(value = '') {
  value = normalizeJid(value)
  if (!value) return value
  if (isPnJid(value) || isLidJid(value) || isGroupJid(value)) return value
  const pn = numberToPnJid(value)
  return pn || value
}

export function getJidMapStats() {
  const state = loadJidMap()
  return {
    file: JID_MAP_FILE,
    lidToPn: Object.keys(state.lidToPn || {}).length,
    pnToLid: Object.keys(state.pnToLid || {}).length,
    updatedAt: state.updatedAt
  }
}

export function installJidResolver(conn) {
  if (!conn || conn.__jidResolverInstalled) return conn
  conn.__jidResolverInstalled = true

  loadJidMap()

  conn.ev?.on?.('contacts.upsert', contacts => collectJidMapFromContacts(contacts, 'contacts.upsert'))
  conn.ev?.on?.('contacts.update', contacts => collectJidMapFromContacts(contacts, 'contacts.update'))
  conn.ev?.on?.('contacts.set', contacts => collectJidMapFromContacts(contacts, 'contacts.set'))

  conn.ev?.on?.('messages.upsert', ({ messages }) => {
    for (const msg of messages || []) collectJidMapFromMessage(msg, 'messages.upsert')
  })

  conn.ev?.on?.('groups.update', async updates => {
    for (const update of updates || []) {
      const id = normalizeJid(update?.id)
      if (!isGroupJid(id)) continue
      let metadata = conn.chats?.[id]?.metadata
      if (!metadata && typeof conn.groupMetadata === 'function') {
        metadata = await conn.groupMetadata(id).catch(() => null)
      }
      if (metadata) collectJidMapFromGroupMetadata(metadata, `groups.update:${id}`)
    }
  })

  conn.ev?.on?.('group-participants.update', async ({ id }) => {
    id = normalizeJid(id)
    if (!isGroupJid(id) || typeof conn.groupMetadata !== 'function') return
    const metadata = await conn.groupMetadata(id).catch(() => null)
    if (metadata) collectJidMapFromGroupMetadata(metadata, `group-participants.update:${id}`)
  })

  return conn
}

export { JID_DATA_DIR, JID_MAP_FILE }

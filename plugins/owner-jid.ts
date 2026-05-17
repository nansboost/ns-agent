// @ts-nocheck
import {
  collectJidMapFromAllGroups,
  collectJidMapFromGroupMetadata,
  getCachedLidFromPn,
  getCachedPnFromLid,
  getJidMapStats,
  isLidJid,
  isPnJid,
  normalizeJid,
  numberToPnJid
} from '../lib/jid-resolver.ts'

function pickTarget(m, args = []) {
  const mentioned = m.mentionedJid?.[0]
  const quoted = m.quoted?.sender
  const arg = args?.[0]
  const raw = mentioned || quoted || arg || m.sender
  if (!raw) return m.sender
  if (String(raw).includes('@')) return normalizeJid(raw)
  return numberToPnJid(raw)
}

let handler = async (m, { conn, args, command, groupMetadata }) => {
  if (/^jidmap$/i.test(command)) {
    if (args?.[0]?.toLowerCase() === 'refresh' || args?.[0]?.toLowerCase() === 'scan') {
      await collectJidMapFromAllGroups(conn, true).catch(() => false)
    } else if (m.isGroup) {
      const metadata = groupMetadata || await conn.groupMetadata(m.chat).catch(() => null)
      if (metadata) collectJidMapFromGroupMetadata(metadata, `jidmap-command:${m.chat}`)
    }

    const stats = getJidMapStats()
    return m.reply(`*JID Map Cache*\n\n` +
      `File: ${stats.file}\n` +
      `LID → PN: ${stats.lidToPn}\n` +
      `PN → LID: ${stats.pnToLid}\n` +
      `Updated: ${stats.updatedAt || '-'}\n\n` +
      `Command:\n` +
      `• .jid = cek JID kamu / target reply / mention\n` +
      `• .jidmap = statistik cache mapping\n` +
      `• .jidmap refresh = scan semua grup yang bot ikuti untuk mapping LID → PN`)
  }

  const rawTarget = pickTarget(m, args)
  const resolved = normalizeJid(await conn.getJid(rawTarget, m.chat).catch(() => rawTarget))
  const number = await conn.getNum(rawTarget, m.chat).catch(() => null)
  const cachedPn = isLidJid(rawTarget) ? getCachedPnFromLid(rawTarget) : null
  const cachedLid = isPnJid(resolved) ? getCachedLidFromPn(resolved) : null

  return m.reply(`*JID Resolver*\n\n` +
    `Chat: ${m.chat}\n` +
    `Sender raw: ${m.rawSender || m.sender}\n` +
    `Sender real: ${m.realSender || '-'}\n` +
    `Target raw: ${rawTarget}\n` +
    `Resolved: ${resolved}\n` +
    `Number: ${number || '-'}\n` +
    `Cached PN: ${cachedPn || '-'}\n` +
    `Cached LID: ${cachedLid || '-'}\n\n` +
    `Catatan: m.sender sekarang akan menjadi @s.whatsapp.net kalau mapping LID → PN sudah pernah didapat dari grup/kontak/signalRepository. Kalau belum ada mapping, m.sender tetap @lid.`)
}

handler.help = ['jid', 'cekjid', 'getjid', 'jidmap', 'jidmap refresh']
handler.tags = ['owner']
handler.command = /^(jid|cekjid|getjid|jidmap)$/i
handler.owner = true

export default handler

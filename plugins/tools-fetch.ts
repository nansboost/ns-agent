// @ts-nocheck
import fetch from 'node-fetch'
import { format } from 'util'
import dns from 'dns/promises'
import net from 'net'

const MAX_FETCH_BYTES = 50 * 1024 * 1024
const FETCH_TIMEOUT_MS = 30000

function ipToLong(ip) {
  return ip.split('.').reduce((acc, n) => ((acc << 8) + Number(n)) >>> 0, 0)
}

function isPrivateIPv4(ip) {
  const n = ipToLong(ip)
  const ranges = [
    ['10.0.0.0', '10.255.255.255'],
    ['127.0.0.0', '127.255.255.255'],
    ['169.254.0.0', '169.254.255.255'],
    ['172.16.0.0', '172.31.255.255'],
    ['192.168.0.0', '192.168.255.255'],
    ['0.0.0.0', '0.255.255.255']
  ]
  return ranges.some(([a, b]) => n >= ipToLong(a) && n <= ipToLong(b))
}

function isPrivateIPv6(ip) {
  const v = ip.toLowerCase()
  return v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80:') || v === '::'
}

function isBlockedAddress(address) {
  const version = net.isIP(address)
  if (version === 4) return isPrivateIPv4(address)
  if (version === 6) return isPrivateIPv6(address)
  return false
}


async function safeFetch(url, options = {}, depth = 0) {
  if (depth > 3) throw new Error('Redirect terlalu banyak.')
  const parsed = new URL(url)
  await assertPublicUrl(parsed)
  const res = await fetch(parsed.href, { ...options, redirect: 'manual' })
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const location = res.headers.get('location')
    if (!location) throw new Error(`Redirect tanpa location: HTTP ${res.status}`)
    const next = new URL(location, parsed.href)
    return safeFetch(next.href, options, depth + 1)
  }
  return res
}

async function assertPublicUrl(url) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Protocol tidak didukung.')
  const hostname = url.hostname
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local')) throw new Error('Host lokal diblokir.')
  if (isBlockedAddress(hostname)) throw new Error('IP private/lokal diblokir.')
  const records = await dns.lookup(hostname, { all: true }).catch(() => [])
  if (records.some(r => isBlockedAddress(r.address))) throw new Error('Domain mengarah ke IP private/lokal, fetch diblokir.')
}

let handler = async (m, { text, conn }) => {
  if (!/^https?:\/\//i.test(text || '')) throw `✳️ Harus berupa link http:// atau https://`
  const _url = new URL(text.trim())
  await assertPublicUrl(_url)

  const url = global.API(_url.origin, _url.pathname, Object.fromEntries(_url.searchParams.entries()), 'APIKEY')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let res
  try {
    res = await safeFetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }

  const length = Number(res.headers.get('content-length') || 0)
  if (length > MAX_FETCH_BYTES) throw `Content-Length terlalu besar: ${length}`
  if (!res.ok) throw `HTTP ${res.status} ${res.statusText}`

  const contentType = res.headers.get('content-type') || ''
  if (!/text|json|xml|javascript|html/i.test(contentType)) {
    if (length && length > MAX_FETCH_BYTES) throw `File terlalu besar: ${length}`
    return conn.sendFile(m.chat, url, 'file', text, m)
  }

  let txt = await res.text()
  if (Buffer.byteLength(txt, 'utf8') > MAX_FETCH_BYTES) throw `Response terlalu besar.`
  try {
    txt = format(JSON.parse(txt))
  } catch {}
  m.reply(String(txt).slice(0, 65536))
}
handler.help = ['get']
handler.tags = ['tools']
handler.command = /^(fetch|get)$/i
export default handler

// @ts-nocheck
import https from 'node:https'
import { URLSearchParams } from 'node:url'
import zlib from 'node:zlib'
import { promisify } from 'node:util'

const gunzip = promisify(zlib.gunzip)
const inflate = promisify(zlib.inflate)
const brotliDecompress = promisify(zlib.brotliDecompress)

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
]

function clampNumber (value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

export class BraveSearch {
  constructor (options = {}) {
    this.uaIndex = 0
    this.lastRequest = 0
    this.minDelayMs = clampNumber(options.minDelayMs, 1200, 0, 30000)
    this.timeoutMs = clampNumber(options.timeoutMs, 15000, 3000, 60000)
  }

  async _fetch (url) {
    const wait = this.minDelayMs - (Date.now() - this.lastRequest)
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
    this.lastRequest = Date.now()

    const userAgent = USER_AGENTS[this.uaIndex % USER_AGENTS.length]
    this.uaIndex++

    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          DNT: '1',
          'Cache-Control': 'max-age=0'
        },
        timeout: this.timeoutMs
      }, res => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', async () => {
          try {
            const raw = Buffer.concat(chunks)
            const enc = String(res.headers['content-encoding'] || '').toLowerCase()
            let body
            if (enc.includes('br')) body = await brotliDecompress(raw)
            else if (enc.includes('gzip')) body = await gunzip(raw)
            else if (enc.includes('deflate')) body = await inflate(raw)
            else body = raw

            const text = body.toString('utf8')
            if (res.statusCode >= 400) {
              const err = new Error(`Brave Search HTTP ${res.statusCode}`)
              err.statusCode = res.statusCode
              err.bodyPreview = text.slice(0, 500)
              reject(err)
              return
            }
            resolve(text)
          } catch (e) {
            reject(e)
          }
        })
      })

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Brave Search timeout'))
      })
      req.end()
    })
  }

  _strip (str) {
    if (!str) return ''
    return String(str)
      .replace(/<!--([\s\S]*?)-->/g, '')
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  _decodeUrl (url) {
    if (!url) return ''
    return this._strip(url).replace(/&amp;/g, '&')
  }

  _parseWeb (html) {
    const results = []
    const tagRe = /<div[^>]*\bdata-pos="(\d+)"[^>]*\bdata-type="web"[^>]*>/gi
    const positions = []
    let match

    while ((match = tagRe.exec(html)) !== null) {
      positions.push({ index: match.index, pos: parseInt(match[1], 10) })
    }

    for (let i = 0; i < positions.length; i++) {
      const chunk = html.slice(positions[i].index, positions[i + 1]?.index ?? html.length)
      const url = this._decodeUrl((
        chunk.match(/class="[^"]*\bl1\b[^"]*"[^>]*\bhref="(https?:\/\/[^"]+)"/i) ||
        chunk.match(/\bhref="(https?:\/\/[^"]+)"[^>]*class="[^"]*\bl1\b[^"]*"/i) ||
        chunk.match(/<a[^>]+href="(https?:\/\/[^"]+)"/i)
      )?.[1] ?? '')

      const title = this._strip((
        chunk.match(/class="[^"]*search-snippet-title[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
        chunk.match(/class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
        chunk.match(/<a[^>]+href="https?:\/\/[^"]+"[^>]*>([\s\S]*?)<\/a>/i)
      )?.[1] ?? '')

      const displayUrl = this._strip(
        chunk.match(/<cite[^>]*class="[^"]*snippet-url[^"]*"[^>]*>([\s\S]*?)<\/cite>/i)?.[1] ?? ''
      )

      const description = this._strip((
        chunk.match(/class="[^"]*\bcontent\b[^"]*line-clamp-dynamic[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
        chunk.match(/class="[^"]*generic-snippet[^"]*"[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i) ||
        chunk.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
      )?.[1] ?? '')

      const ageMatch = chunk.match(/<span[^>]*class="[^"]*\bt-secondary\b[^"]*"[^>]*>([^<]*(?:ago|yesterday|hour|min|sec|hari|jam|menit)[^<]*)<\/span>/i)
      const age = ageMatch ? this._strip(ageMatch[1]).replace(/-$/, '').trim() : null

      if (title || url || description) {
        results.push({ title, url, displayUrl, description, age, position: positions[i].pos })
      }
    }

    return results
  }

  _parseFaq (html) {
    const results = []
    const re = /<details[^>]*>[\s\S]*?<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi
    let match

    while ((match = re.exec(html)) !== null) {
      const question = this._strip(match[1])
      const answer = this._strip(match[2])
      if (question && answer && question.length < 300) results.push({ question, answer })
    }

    return results
  }

  async search (query, opts = {}) {
    const q = String(query || '').trim()
    if (!q) throw new Error('Query Brave Search kosong.')

    const count = clampNumber(opts.count, 8, 1, 20)
    const offset = clampNumber(opts.offset, 0, 0, 100)
    const params = new URLSearchParams({ q, source: 'web' })
    if (offset) params.set('offset', String(offset))
    if (count) params.set('count', String(count))

    const html = await this._fetch(`https://search.brave.com/search?${params.toString()}`)
    const web = this._parseWeb(html).slice(0, count)
    const faq = this._parseFaq(html).slice(0, 5)

    return {
      query: q,
      source: 'Brave Search HTML scraper, bukan API resmi',
      count: web.length,
      web,
      faq
    }
  }
}

const defaultClient = new BraveSearch()

export async function braveSearch (query, opts = {}) {
  return defaultClient.search(query, opts)
}

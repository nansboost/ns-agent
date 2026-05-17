// @ts-nocheck
import { braveSearch } from '../lib/brave-search.ts'

function splitMessage (text, max = 3500) {
  const value = String(text || '')
  const chunks = []
  for (let i = 0; i < value.length; i += max) chunks.push(value.slice(i, i + max))
  return chunks.length ? chunks : ['']
}

function formatResult (data) {
  const web = Array.isArray(data.web) ? data.web : []
  if (!web.length) return `Tidak ada hasil web untuk: ${data.query}`

  const lines = web.map((item, index) => {
    return `${index + 1}. ${item.title || '(Tanpa judul)'}
${item.url || item.displayUrl || '-'}
${item.description || '-'}${item.age ? `
${item.age}` : ''}`
  })

  return `*Brave Search*
Query: ${data.query}
Catatan: scraper HTML, bukan API resmi.

${lines.join('\n\n')}`
}

let handler = async (m, { text, usedPrefix, command }) => {
  const q = String(text || '').trim()
  if (!q) throw `Contoh:\n${usedPrefix + command} nodejs tutorial terbaru`

  if (m.react) await m.react('🔎')
  try {
    const data = await braveSearch(q, { count: 8 })
    for (const chunk of splitMessage(formatResult(data))) await m.reply(chunk)
    if (m.react) await m.react('✅')
  } catch (e) {
    if (m.react) await m.react('❌')
    throw `Brave Search error: ${e.message || e}`
  }
}

handler.help = ['brave <query>', 'searchweb <query>']
handler.tags = ['tools']
handler.command = /^(brave|bravesearch|searchweb|websearch)$/i
handler.limit = true

export default handler

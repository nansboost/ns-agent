// @ts-nocheck
// Text-only outbound sanitizer for WhatsApp messages.
// Tujuan: pesan plugin tidak lagi bergantung ke externalAdReply / thumbnail preview
// yang sering tidak muncul di WhatsApp biasa.

function cleanContextInfo(contextInfo = {}) {
  if (!contextInfo || typeof contextInfo !== 'object') return undefined

  const cleaned = { ...contextInfo }

  // Hapus tampilan rich preview/ad/newsletter/AI-forward yang sering tidak kompatibel.
  delete cleaned.externalAdReply
  delete cleaned.forwardedNewsletterMessageInfo
  delete cleaned.forwardedAiBotMessageInfo
  delete cleaned.statusAttributions
  delete cleaned.businessMessageForwardInfo
  delete cleaned.adReplyInfo

  // Hilangkan tanda forward palsu agar pesan terlihat normal.
  delete cleaned.isForwarded
  delete cleaned.forwardingScore
  delete cleaned.forwardOrigin

  // Buang key kosong supaya tidak mengirim contextInfo tidak perlu.
  for (const key of Object.keys(cleaned)) {
    const value = cleaned[key]
    if (
      value == null ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)
    ) {
      delete cleaned[key]
    }
  }

  return Object.keys(cleaned).length ? cleaned : undefined
}

function sanitizeContent(content = {}) {
  if (!content || typeof content !== 'object') return content

  // Kalau pesan text, kirim text biasa saja.
  // Mention dipindah ke property mentions agar tidak perlu contextInfo manual.
  if (typeof content.text === 'string') {
    const mentions = content.mentions || content.contextInfo?.mentionedJid
    const out = { ...content }
    delete out.contextInfo
    delete out.jpegThumbnail
    delete out.thumbnail
    delete out.thumbnailUrl

    if (mentions?.length) out.mentions = mentions
    return out
  }

  // Kalau media/audio/file, tetap kirim medianya, tapi hapus rich preview.
  const out = { ...content }
  if (out.contextInfo) {
    const contextInfo = cleanContextInfo(out.contextInfo)
    if (contextInfo) out.contextInfo = contextInfo
    else delete out.contextInfo
  }
  return out
}

function relayTextToSendMessage(message = {}) {
  const ext = message?.extendedTextMessage
  if (!ext || typeof ext.text !== 'string') return null

  const mentions = ext.mentions || ext.contextInfo?.mentionedJid
  return {
    text: ext.text,
    ...(mentions?.length ? { mentions } : {})
  }
}

function sanitizeRelayMessage(message = {}) {
  if (!message || typeof message !== 'object') return message

  const out = { ...message }
  if (out.extendedTextMessage?.contextInfo) {
    const ext = { ...out.extendedTextMessage }
    const contextInfo = cleanContextInfo(ext.contextInfo)
    if (contextInfo) ext.contextInfo = contextInfo
    else delete ext.contextInfo
    out.extendedTextMessage = ext
  }
  return out
}

export function forceTextOnlyMessages(conn) {
  if (!conn || conn.__textOnlyModePatched) return conn

  const originalSendMessage = conn.sendMessage?.bind(conn)
  const originalRelayMessage = conn.relayMessage?.bind(conn)

  if (originalSendMessage) {
    conn.sendMessage = async function sendMessageTextOnly(jid, content, options = {}) {
      return originalSendMessage(jid, sanitizeContent(content), options)
    }
  }

  if (originalRelayMessage) {
    conn.relayMessage = async function relayMessageTextOnly(jid, message, options = {}) {
      const textContent = relayTextToSendMessage(message)
      if (textContent && originalSendMessage) {
        return originalSendMessage(jid, textContent, options)
      }
      return originalRelayMessage(jid, sanitizeRelayMessage(message), options)
    }
  }

  Object.defineProperty(conn, '__textOnlyModePatched', {
    value: true,
    enumerable: false,
    configurable: false
  })

  return conn
}

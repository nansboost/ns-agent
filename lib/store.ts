// @ts-nocheck
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { 
    jidNormalizedUser,
    initAuthCreds,
    BufferJSON,
    proto
} from '@whiskeysockets/baileys'
import {
    collectJidMapFromContacts,
    collectJidMapFromGroupMetadata,
    normalizeJid
} from './jid-resolver.ts'

/* ============================
   CHAT STORE
============================ */

function bind(conn) {
    if (!conn.chats) conn.chats = {}

    const upsertChat = (id, data = {}) => {
        id = jidNormalizedUser(id)
        if (!id || id === 'status@broadcast') return
        conn.chats[id] = {
            ...(conn.chats[id] || {}),
            id,
            ...data
        }
    }

    /* ============================
       CONTACTS
    ============================ */

    const updateContacts = (contacts) => {
        const list = contacts?.contacts || contacts
        if (!list) return

        collectJidMapFromContacts(list, 'store.contacts')

        for (const contact of list) {
            const id = normalizeJid(contact.id || contact.jid || contact.phoneNumber || contact.lid)
            if (!id || id === 'status@broadcast') continue

            const isGroup = id.endsWith('@g.us')

            upsertChat(id, {
                lid: normalizeJid(contact.lid || ''),
                phoneNumber: normalizeJid(contact.phoneNumber || contact.jid || ''),
                ...(isGroup
                    ? { subject: contact.subject || contact.name }
                    : { name: contact.notify || contact.name }
                )
            })
        }
    }

    conn.ev.on('contacts.upsert', updateContacts)
    conn.ev.on('contacts.update', updateContacts)
    conn.ev.on('contacts.set', updateContacts)

    /* ============================
       CHATS
    ============================ */

    conn.ev.on('chats.set', async ({ chats }) => {
        for (let { id, name, readOnly } of chats) {
            id = jidNormalizedUser(id)
            if (!id || id === 'status@broadcast') continue

            const isGroup = id.endsWith('@g.us')

            upsertChat(id, {
                isChats: !readOnly,
                ...(name && (isGroup ? { subject: name } : { name }))
            })

            if (isGroup) {
                const metadata = await conn.groupMetadata(id).catch(() => null)
                if (metadata) {
                    collectJidMapFromGroupMetadata(metadata, `store.chats.set:${id}`)
                    upsertChat(id, {
                        subject: metadata.subject,
                        metadata
                    })
                }
            }
        }
    })

    conn.ev.on('chats.upsert', (chats) => {
    if (!Array.isArray(chats)) return

    for (const chat of chats) {
        if (!chat?.id) continue
        const id = jidNormalizedUser(chat.id)
        upsertChat(id, { ...chat, isChats: true })
    }
})

    /* ============================
       GROUPS - GENERAL CHANGES
    ============================ */

    conn.ev.on('groups.update', async (updates) => {
        for (const update of updates) {
            const id = jidNormalizedUser(update.id)
            if (!id?.endsWith('@g.us')) continue

            let metadata = conn.chats[id]?.metadata

if (!metadata) {
    try {
        metadata = await conn.groupMetadata(id)
    } catch (e) {
        if (e?.data === 403) continue
        console.error(e)
        continue
    }
}

            collectJidMapFromGroupMetadata(metadata, `store.groups.update:${id}`)

            upsertChat(id, {
                subject: update.subject || metadata.subject,
                metadata,
                isChats: true
            })
        }
    })

    /* ============================
       GROUPS - PARTICIPANTS
    ============================ */

    conn.ev.on('group-participants.update', async ({ id, participants, action }) => {
        try {
            id = jidNormalizedUser(id)
            if (!id?.endsWith('@g.us')) return

            let metadata = conn.chats[id]?.metadata

         if (!metadata) {
         try {
            metadata = await conn.groupMetadata(id)
        } catch (e) {
        if (e?.data === 403) {
            console.log('⚠️ 403 - No access to metadata:', id)
            return
        }
        console.error(e)
        return
    }
}

            collectJidMapFromGroupMetadata(metadata, `store.group-participants.update:${id}`)

            upsertChat(id, {
                subject: metadata.subject,
                metadata,
                isChats: true
            })

            console.log(`📢 Group ${metadata.subject} → ${action}`, participants)

        } catch (err) {
            console.error('group-participants.update error:', err)
        }
    })

    /* ============================
       PRESENCE
    ============================ */

    conn.ev.on('presence.update', ({ id, presences }) => {
        const sender = Object.keys(presences || {})[0]
        if (!sender) return

        const normalized = jidNormalizedUser(sender)
        const presence = presences[sender]?.lastKnownPresence || 'available'

        upsertChat(normalized, {
            presence
        })
    })

    /* ============================
       SYSTEM MESSAGES (STUBS)
    ============================ */

    conn.ev.on('messages.upsert', ({ messages }) => {
        for (const msg of messages) {
            if (!msg.messageStubType) continue

            const chatId = jidNormalizedUser(msg.key.remoteJid)
            const user = msg.messageStubParameters?.[0]

            // console.log('📝 Evento sistema:', {
            //     chatId,
            //     type: msg.messageStubType,
            //     user
            // })
        }
    })
}

/* ============================
   AUTH SINGLE FILE
============================ */

const KEY_MAP = {
    'pre-key': 'preKeys',
    'session': 'sessions',
    'sender-key': 'senderKeys',
    'app-state-sync-key': 'appStateSyncKeys',
    'app-state-sync-version': 'appStateVersions',
    'sender-key-memory': 'senderKeyMemory'
}

function useSingleFileAuthState(filename, logger) {
    let creds
    let keys = {}
    let saveCount = 0

    const saveState = (forceSave = false) => {
        saveCount++
        if (forceSave || saveCount > 5) {
            writeFileSync(
                filename,
                JSON.stringify({ creds, keys }, BufferJSON.replacer, 2)
            )
            saveCount = 0
        }
    }

    if (existsSync(filename)) {
        const result = JSON.parse(
            readFileSync(filename, 'utf-8'),
            BufferJSON.reviver
        )
        creds = result.creds
        keys = result.keys
    } else {
        creds = initAuthCreds()
        keys = {}
    }

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const key = KEY_MAP[type]
                    return ids.reduce((dict, id) => {
                        let value = keys[key]?.[id]
                        if (value && type === 'app-state-sync-key') {
                            value = proto.AppStateSyncKeyData.fromObject(value)
                        }
                        if (value) dict[id] = value
                        return dict
                    }, {})
                },
                set: (data) => {
                    for (const type in data) {
                        const key = KEY_MAP[type]
                        keys[key] = keys[key] || {}
                        Object.assign(keys[key], data[type])
                    }
                    saveState()
                }
            }
        },
        saveState
    }
}

export default {
    bind,
    useSingleFileAuthState
}
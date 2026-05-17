// @ts-nocheck
import crypto from "crypto";

// --- INTERNAL BAILEYS LOADER ---
// Disatukan di sini supaya kamu tidak perlu file .mjs tambahan!
let baileysData = null;
const loadBaileysInternal = async () => {
    if (!baileysData) {
        try {
            const baileys = await import('@whiskeysockets/baileys');
            baileysData = {
                generateWAMessageContent: baileys.generateWAMessageContent,
                generateWAMessageFromContent: baileys.generateWAMessageFromContent,
                proto: baileys.proto,
                // Tambahkan fungsi lain di sini jika kamu membutuhkannya nanti
            };
        } catch (e) {
            console.error("Gagal memuat modul Baileys:", e);
            throw "Library @adiwajshing/baileys tidak ditemukan!";
        }
    }
    return baileysData;
};

let handler = async (m, { conn, text, command, prefix, isOwner }) => {
    // 1. Validasi: Hanya untuk Grup
    if (!m.isGroup) throw "*Hmph!* Perintah ini cuma untuk di dalam GRUP! Apa otakmu sudah tumpul?! 😤";

    // Muat fungsi internal Baileys
    const { generateWAMessageContent, generateWAMessageFromContent } = await loadBaileysInternal();

    // 2. Tentukan sumber media (Quoted message atau pesan saat ini)
    let q = m.quoted ? m.quoted : m;
    let mime = (q.msg || q).mimetype || q.mediaType || "";
    let caption = text ? text.trim() : "";

    await m.reply(`_Sedang mengirim Status Grup... Jangan berisik!_`);

    try {
        let content = {};
        let isMedia = /image|video|audio/.test(mime);

        // 3. Logika Penentuan Konten
        if (isMedia) {
            const media = await q.download?.();
            if (!media) throw "Gagal mendownload media! Server WhatsApp sedang pelit akses.";

            if (/image/.test(mime)) {
                content = { image: media, caption };
            } else if (/video/.test(mime)) {
                content = { video: media, caption };
            } else if (/audio/.test(mime)) {
                content = { audio: media, mimetype: "audio/mpeg", ptt: false };
            }
        } else if (caption) {
            content = { text: caption };
        } else {
            throw `*Cara Pakai:* \nReply foto/video atau ketik teks dengan perintah *${prefix + command}*`;
        }

        // 4. Penentuan Target Grup (Fitur khusus Owner)
        let targetGc = m.chat;
        if (isOwner && caption.includes("|")) {
            const [idgc, ...rest] = caption.split("|");
            targetGc = idgc.trim();
            const cleanText = rest.join("|").trim();
            if (content.caption !== undefined) content.caption = cleanText;
            if (content.text !== undefined) content.text = cleanText;
        }

        // 5. Konstruksi Group Status Message V2
        // Proses upload media ke server WhatsApp secara internal
        const inside = await generateWAMessageContent(content, {
            upload: conn.waUploadToServer,
        });

        const messageSecret = crypto.randomBytes(32);
        const message = generateWAMessageFromContent(
            targetGc,
            {
                messageContextInfo: { messageSecret },
                groupStatusMessageV2: {
                    message: {
                        ...inside,
                        messageContextInfo: { messageSecret },
                    },
                },
            },
            {}
        );

        // 6. Pengiriman menggunakan RelayMessage (Protokol Baileys)
        await conn.relayMessage(targetGc, message.message, {
            messageId: message.key.id,
        });

        // Beri reaksi sukses
        await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } });

    } catch (e) {
        console.error(e);
        m.reply(`❌ *Gagal:* ${e.message || e}`);
    }
};

handler.help = ["swgc", "upswgc"];
handler.tags = ["owner", "group"];
handler.command = /^(swgc|upswgc)$/i;
handler.admin = true;
handler.group = true;

export default handler;
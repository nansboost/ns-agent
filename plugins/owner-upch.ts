// @ts-nocheck
import { proto } from '@whiskeysockets/baileys';

let handler = async (m, { conn, text }) => {
    try {
        // Logika pengambilan teks (Sudah aku rapikan sedikit biar tidak berantakan!)
        let teks = text 
            ? text 
            : m.quoted && (m.quoted.text || m.quoted.caption || m.quoted.description) 
            ? (m.quoted.text || m.quoted.caption || m.quoted.description) 
            : '';

        if (!teks) {
            return m.reply('Hmph! Masukkan teksnya atau reply pesan, jangan malas!');
        }

        // Tampilkan status biar kamu tidak panik
        console.log('Sedang mencoba mengirim ke channel...');
        
        await sendMessage(conn, teks);
        
        m.reply('Puas? Pesan sudah sukses terkirim ke channel.');
    } catch (e) {
        console.error('ERROR CH:', e);
        m.reply(`Gagal total! Pesan error: ${e.message}`);
    }
};

handler.command = /^(ch)$/i; 
handler.owner = true; 

export default handler; 

/**
 * Fungsi kirim pesan ke Channel (Newsletter)
 * Bukan berarti aku peduli pesannya sampai atau tidak!
 */
async function sendMessage(conn, teks) {
    const channelJid = String(global.id_canal || '').trim()
    if (!channelJid.endsWith('@newsletter')) {
        throw new Error('global.id_canal belum diisi di config.ts')
    }

    if (!proto || !proto.Message) {
        throw new Error('Gagal memuat Proto Baileys! Cek instalasi modulmu, Baka!');
    }

    const msg = {
        conversation: teks,
    };
    
    // Proses Encoding
    const plaintext = proto.Message.encode(msg).finish();
    
    const plaintextNode = {
        tag: 'plaintext',
        attrs: {},
        content: plaintext,
    };

    const node = {
        tag: 'message',
        attrs: {
            to: channelJid,
            type: 'text',
        },
        content: [plaintextNode],
    };

    // Eksekusi Query
    return conn.query(node); 
}
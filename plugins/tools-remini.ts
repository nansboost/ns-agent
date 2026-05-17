// @ts-nocheck
import fetch from 'node-fetch';
import uploadImage from '../lib/uploadImage.ts';

let handler = async (m, { conn, usedPrefix, command }) => {
    const q = m.quoted ? m.quoted : m;
    const mime = (q.msg || q).mimetype || q.mediaType || '';

    // Validasi apakah yang dikirim/tag adalah gambar (bukan sticker/video)
    if (/^image/.test(mime) && !/webp/.test(mime)) {
        await m.reply('_Sedang menjernihkan fotomu... Sabar sedikit, jangan bawel!_');

        try {
            const img = await q.download();
            const out = await uploadImage(img);
            
            let imageUrl = null;
            let success = false;

            // --- TRY SERVER 1: BETABOTZ ---
            try {
                const api = await fetch(`https://api.betabotz.eu.org/api/tools/remini?url=${out}&apikey=${global.lann || 'isi_apikey_lann'}`);
                const res = await api.json();
                if (res.url || (res.result && res.result.url)) {
                    imageUrl = res.url || res.result.url;
                    success = true;
                }
            } catch (e) {
                console.log("Betabotz Remini Error, mencoba server Botcahx...");
            }

            // --- TRY SERVER 2: BOTCAHX (Fallback) ---
            if (!success) {
                try {
                    const api = await fetch(`https://api.botcahx.eu.org/api/tools/remini?url=${out}&apikey=${global.btc || 'isi_apikey_btc'}`);
                    const res = await api.json();
                    if (res.url || (res.result && res.result.url)) {
                        imageUrl = res.url || res.result.url;
                        success = true;
                    }
                } catch (e) {
                    throw 'Cih! Semua server penjernih foto sedang mogok kerja! Coba lagi nanti!';
                }
            }

            if (!imageUrl) throw 'Gagal mendapatkan hasil foto dari server.';

            // Kirim hasil gambar
            await conn.sendFile(m.chat, imageUrl, 'remini.jpg', `*R E M I N I* - _Success_\n\n_Nih fotonya sudah bening, jangan lupa cuci muka juga!_`, m);

        } catch (e) {
            console.error(e);
            m.reply(`*Error:* ${e.message || 'Gagal memproses gambar. Jangan tanya aku kenapa!'}`);
        }
    } else {
        m.reply(`*Hmph!* Kirim gambar dengan caption *${usedPrefix + command}* atau tag gambar yang sudah dikirim!`);
    }
};

handler.help = ['remini'];
handler.tags = ['tools'];
handler.command = /^(remini|hdr|hd)$/i;
handler.limit = true; // Aku kasih limit biar servermu tidak nangis

export default handler;
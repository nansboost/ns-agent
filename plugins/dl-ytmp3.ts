// @ts-nocheck
import axios from 'axios';
import fetch from 'node-fetch';

let handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) throw `*Hmph!* Masukan URL YouTube yang benar!\n\nContoh:\n${usedPrefix + command} https://www.youtube.com/watch?v=Z28dtg_QmFw`;

    try {
        await m.reply('_Tunggu sebentar... Sedang aku usahakan, jangan bawel ya!_');

        let audioUrl = null;
        let title = 'YouTube Audio';
        let success = false;

        // --- TRY SERVER 1: BETABOTZ ---
        try {
            const response = await axios.get(`https://api.betabotz.eu.org/api/download/ytmp3?url=${encodeURIComponent(text)}&apikey=${global.lann || 'isi_apikey_lann'}`);
            if (response.data && response.data.result && response.data.result.mp3) {
                audioUrl = response.data.result.mp3;
                title = response.data.result.title || 'YouTube Audio';
                success = true;
            }
        } catch (e) {
            console.log("Betabotz YT Error, mencoba server Botcahx...");
        }

        // --- TRY SERVER 2: BOTCAHX (Jika Betabotz Gagal) ---
        if (!success) {
            try {
                const response = await fetch(`https://api.botcahx.eu.org/api/dowloader/yt?url=${encodeURIComponent(text)}&apikey=${global.btc || 'isi_apikey_btc'}`);
                const result = await response.json();
                if (result.status && result.result && result.result.mp3) {
                    audioUrl = result.result.mp3;
                    title = result.result.title || 'YouTube Audio';
                    success = true;
                }
            } catch (e) {
                throw 'Cih! Semua server API YouTube sedang mogok kerja! Coba lagi nanti!';
            }
        }

        if (!audioUrl) throw 'Gagal mendapatkan link audio.';

        // Pengiriman Audio secara Normal sesuai permintaanmu sebelumnya
        // Kalau kamu mau kirim sebagai Document (biar tidak kompres), gunakan 'document' bukannya 'audio'
        if (command === 'yta' || command === 'ytmp3') {
            await conn.sendMessage(m.chat, { 
                audio: { url: audioUrl }, 
                mimetype: 'audio/mpeg' 
            }, { quoted: m });
        } else if (command === 'ytdoc') {
            // Opsi tambahan kalau mau kirim sebagai file/dokumen
            await conn.sendMessage(m.chat, { 
                document: { url: audioUrl }, 
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`
            }, { quoted: m });
        }

    } catch (e) {
        console.error(e);
        conn.reply(m.chat, `*Error:* ${e.message || 'Terjadi kesalahan teknis, jangan salahkan aku!'}`, m);
    }
};

handler.help = ['ytmp3', 'yta'];
handler.tags = ['downloader'];
handler.command = /^(ytmp3|yta|ytdoc)$/i;
handler.limit = true;

export default handler;
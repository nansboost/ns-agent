// @ts-nocheck
import axios from 'axios';
import fetch from 'node-fetch';

let handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) throw `*Hmph!* Masukan URL YouTube yang benar!\n\nContoh:\n${usedPrefix + command} https://www.youtube.com/watch?v=Z28dtg_QmFw`;

    try {
        await m.reply('_Tunggu sebentar... Sedang aku ambilkan videonya, jangan bawel ya!_');

        let videoUrl = null;
        let title = 'YouTube Video';
        let metadata = {};
        let success = false;
        let usedServer = 'Betabotz';

        // --- TRY SERVER 1: BETABOTZ ---
        try {
            const response = await axios.get(`https://api.betabotz.eu.org/api/download/ytmp4?url=${encodeURIComponent(text)}&apikey=${global.lann || 'isi_apikey_lann'}`);
            if (response.data && response.data.result && response.data.result.mp4) {
                videoUrl = response.data.result.mp4;
                metadata = response.data.result;
                success = true;
            }
        } catch (e) {
            console.log("Betabotz YT MP4 Error, mencoba server Botcahx...");
        }

        // --- TRY SERVER 2: BOTCAHX (Jika Betabotz Gagal) ---
        if (!success) {
            usedServer = 'Botcahx';
            try {
                const response = await fetch(`https://api.botcahx.eu.org/api/dowloader/yt?url=${encodeURIComponent(text)}&apikey=${global.btc || 'isi_apikey_btc'}`);
                const result = await response.json();
                if (result.status && result.result && result.result.mp4) {
                    videoUrl = result.result.mp4;
                    metadata = result.result;
                    success = true;
                }
            } catch (e) {
                throw 'Cih! Semua server API YouTube Video sedang mogok kerja! Coba lagi nanti!';
            }
        }

        if (!videoUrl) throw 'Gagal mendapatkan link video.';

        let capt = `乂 *Y T - M P 4*\n\n`;
        capt += `◦ *ID* : ${metadata.id || '-'}\n`;
        capt += `◦ *Title* : ${metadata.title || 'YouTube Video'}\n`;
        capt += `◦ *Duration* : ${metadata.duration || '-'}\n`;
        capt += `◦ *Server* : ${usedServer}\n\n`;
        capt += `_Nih videonya, jangan lupa ditonton, bukan berarti aku peduli ya!_`;

        // Pengiriman Video (Style MP4 Normal)
        if (command === 'ytv' || command === 'ytmp4') {
            await conn.sendMessage(m.chat, { 
                video: { url: videoUrl }, 
                caption: capt,
                mimetype: 'video/mp4' 
            }, { quoted: m });
        } 
        // Pengiriman sebagai Dokumen (Sesuai kode aslimu yang satu lagi)
        else if (command === 'ytvdoc') {
            await conn.sendMessage(m.chat, { 
                document: { url: videoUrl }, 
                mimetype: 'video/mp4',
                fileName: `${metadata.title || 'video'}.mp4`,
                caption: capt
            }, { quoted: m });
        }

    } catch (e) {
        console.error(e);
        conn.reply(m.chat, `*Error:* ${e.message || 'Terjadi kesalahan teknis!'}`, m);
    }
};

handler.help = ['ytmp4', 'ytv'];
handler.tags = ['downloader'];
handler.command = /^(ytmp4|ytv|ytvdoc)$/i;
handler.limit = true;

export default handler;
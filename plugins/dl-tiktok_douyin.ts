// @ts-nocheck
import axios from 'axios';

let handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) throw `*Hmph!* Masukan URL!\n\nContoh:\n${usedPrefix + command} https://v.douyin.com/ikq8axJ/`;
    
    // Validasi URL (TikTok atau Douyin)
    const isDouyin = /douyin/gi.test(text);
    const isTikTok = /tiktok/gi.test(text);

    if (!isDouyin && !isTikTok) {
        throw `Cih, itu bukan URL TikTok atau Douyin yang valid! Masukkan link yang benar dong!`;
    }

    try {
        await m.reply('_Tunggu sebentar... Sedang aku usahakan, jangan bawel ya!_');

        let res = null;
        let success = false;
        let usedServer = '';

        // --- TRY SERVER 1: BETABOTZ ---
        try {
            usedServer = 'Betabotz';
            let apiType = isDouyin ? 'douyin' : 'tiktok';
            let response = await axios.get(`https://api.betabotz.eu.org/api/download/${apiType}?url=${encodeURIComponent(text)}&apikey=${global.lann || 'isi_apikey_lann'}`);
            
            if (response.data && response.data.result) {
                res = response.data.result;
                // Pastikan ada video/audio yang dihasilkan
                if (res.video || res.audio) success = true;
            }
        } catch (e) {
            console.log("Betabotz Error, mencoba server Botcahx...");
        }

        // --- TRY SERVER 2: BOTCAHX (Jika Betabotz Gagal) ---
        if (!success) {
            try {
                usedServer = 'Botcahx';
                let apiPath = isDouyin ? 'douyin' : 'tiktok';
                let response = await axios.get(`https://api.botcahx.eu.org/api/dowloader/${apiPath}?url=${encodeURIComponent(text)}&apikey=${global.btc || 'isi_apikey_btc'}`);
                
                if (response.data && response.data.result) {
                    res = response.data.result;
                    success = true;
                }
            } catch (e) {
                throw 'Cih! Semua server API (Betabotz & Botcahx) sedang mogok kerja! Coba lagi nanti!';
            }
        }

        // Ambil data dari hasil yang sukses
        let { video, title, title_audio, audio } = res;
        
        let capt = `乂 *${isDouyin ? 'D O U Y I N' : 'T I K T O K'}*\n\n`;
        capt += `◦ *Title* : ${title || 'Tidak ada judul'}\n`;
        capt += `◦ *Audio* : ${title_audio || 'Original Audio'}\n`;
        capt += `◦ *Server* : ${usedServer}\n\n`;
        capt += `_Nih videonya, puas? Jangan tanya-tanya lagi ya!_`;

        // Kirim Video / Slide Foto
        if (Array.isArray(video)) {
            if (video.length > 1) {
                // Untuk postingan foto/slide
                for (let v of video) {
                    await conn.sendFile(m.chat, v, '', capt, m);
                }
            } else {
                await conn.sendFile(m.chat, video[0], '', capt, m);
            }
        } else if (video) {
            await conn.sendFile(m.chat, video, '', capt, m);
        }

        // Kirim Audio secara Normal (Sesuai permintaanmu)
        let audioUrl = Array.isArray(audio) ? audio[0] : audio;
        if (audioUrl) {
            await conn.sendMessage(m.chat, { 
                audio: { url: audioUrl }, 
                mimetype: 'audio/mpeg' 
            }, { quoted: m });
        }

    } catch (e) {
        console.error(e);
        conn.reply(m.chat, `*Error:* ${e.message || 'Terjadi kesalahan teknis, jangan salahkan aku!'}`, m);
    }
};

handler.help = ['tiktok', 'douyin'];
handler.tags = ['downloader'];
handler.command = /^(tiktok|tt|ttdl|tiktokdl|douyin|douyindl)$/i;
handler.limit = true;

export default handler;
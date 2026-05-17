// @ts-nocheck
import fetch from 'node-fetch'

let handler = async (m, { text, conn, usedPrefix, command }) => {
    if (!text) throw `*🚩 Contoh:* ${usedPrefix + command} Lathi`;
    
    await m.reply('_Sedang mencari daftar lagu... Jangan bawel ya!_');

    try {
        let success = false;
        let resData = [];
        let usedServer = 'Betabotz';

        // --- TRY SERVER 1: BETABOTZ ---
        try {
            const api = await fetch(`https://api.betabotz.eu.org/api/search/spotify?query=${encodeURIComponent(text)}&apikey=${global.lann || 'isi_apikey_lann'}`);
            const json = await api.json();
            if (json.result && json.result.data && json.result.data.length > 0) {
                resData = json.result.data;
                success = true;
            }
        } catch (e) {
            console.log("Betabotz Spotify Search Error, mencoba server Botcahx...");
        }

        // --- TRY SERVER 2: BOTCAHX (Jika Betabotz Gagal) ---
        if (!success) {
            usedServer = 'Botcahx';
            try {
                const api = await fetch(`https://api.botcahx.eu.org/api/search/spotify?query=${encodeURIComponent(text)}&apikey=${global.btc || 'isi_apikey_btc'}`);
                const json = await api.json();
                if (json.result && json.result.data) {
                    resData = json.result.data;
                    success = true;
                }
            } catch (e) {
                throw 'Cih! Semua server pencarian Spotify sedang mogok kerja!';
            }
        }

        if (resData.length === 0) throw 'Lagu tidak ditemukan!';

        let teks = `*SPOTIFY SEARCH*\n`;
        teks += `Server: ${usedServer}\n\n`;

        for (let i in resData) {
            teks += `*${parseInt(i) + 1}.* *Title:* ${resData[i].title}\n`;
            teks += `*Duration:* ${resData[i].duration}\n`;
            teks += `*Popularity:* ${resData[i].popularity || 'N/A'}\n`;
            teks += `*Link:* ${resData[i].url}\n\n`;
        }

        await conn.sendMessage(m.chat, {
            text: teks,
            mentions: [m.sender]
        }, { quoted: m });

    } catch (e) {
        console.error(e);
        conn.reply(m.chat, `🚩 *Gagal Memuat Data:* ${e.message || 'Error Unknown'}`, m);
    }
};

handler.help = ['spotifysearch'];
handler.tags = ['downloader'];
handler.command = /^(spotifysearch|sfsearch)$/i;
handler.limit = true;

export default handler;
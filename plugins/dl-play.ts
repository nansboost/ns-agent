// @ts-nocheck
import search from "yt-search";
import axios from "axios";
import fetch from "node-fetch";

let handler = async (m, { conn, text, usedPrefix }) => {
    if (!text) throw 'Enter Title / Link From YouTube!';
    
    try {
        await m.reply('_Please wait..._');
        
        const look = await search(text);
        const convert = look.videos[0];
        
        if (!convert) throw 'Video/Audio Tidak Ditemukan';
        if (convert.seconds >= 3600) {
            return conn.reply(m.chat, 'Video is longer than 1 hour!', m);
        }

        let audioUrl;
        let success = false;

        try {
            let res = await axios.get(`https://api.betabotz.eu.org/api/download/yt?url=${convert.url}&apikey=${global.lann || 'isi_apikey_lann'}`);
            if (res.data && res.data.result && res.data.result.mp3) {
                audioUrl = res.data.result.mp3;
                success = true;
            }
        } catch (e) {
            console.log("Betabotz Error, switching to Botcahx...");
        }

        if (!success) {
            try {
                const res = await fetch(`https://api.botcahx.eu.org/api/dowloader/yt?url=${convert.url}&apikey=${global.btc || 'isi_apikey_btc'}`);
                let json = await res.json();
                if (json && json.result && json.result.mp3) {
                    audioUrl = json.result.mp3;
                } else {
                    throw 'Error from Botcahx';
                }
            } catch (e) {
                return conn.reply(m.chat, '*Error:* Semua server sedang bermasalah!', m);
            }
        }

        let caption = '';
        caption += `∘ Title : ${convert.title}\n`;
        caption += `∘ Ext : Search\n`;
        caption += `∘ ID : ${convert.videoId}\n`;
        caption += `∘ Duration : ${convert.timestamp}\n`;
        caption += `∘ Viewers : ${convert.views}\n`;
        caption += `∘ Upload At : ${convert.ago}\n`;
        caption += `∘ Author : ${convert.author.name}\n`;
        caption += `∘ Channel : ${convert.author.url}\n`;
        caption += `∘ Url : ${convert.url}\n`;
        caption += `∘ Description : ${convert.description}\n`;
        caption += `∘ Thumbnail : ${convert.image}`;

        await conn.sendMessage(m.chat, {
            text: caption,
            mentions: [m.sender]
        }, { quoted: m });

        await conn.sendMessage(m.chat, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg'
        }, { 
            quoted: m 
        });

    } catch (e) {
        console.error(e);
        conn.reply(m.chat, `*Error:* ` + (e.message || 'Unknown Error'), m);
    }
};

handler.help = handler.command = ["play", "song", "ds"];
handler.tags = ["internet", "downloader"];
handler.limit = true;

export default handler;

/* 

KALO MAU PAKE CTXDL BISA GANTI INI AJA 

import ytdl from 'cdxdl'
import search from 'yt-search'

// Hmph, ekstraksi fungsi dari bungkusan CommonJS library-nya
const { validateURL, Spodl, getInfo } = ytdl

let handler = async (m, { conn, text, usedPrefix, command }) => {
    // 1. Validasi Input
    if (!text) throw `*Hmph!* Masukkan judul lagu atau link YouTube!\nContoh: ${usedPrefix + command} After Dark`
    
    if (m.react) m.react('⏳')

    try {
        let url = text
        let vid = {}

        // 2. Logika Pencarian atau Validasi Link
        if (validateURL(text)) {
            const info = await getInfo(text)
            vid = {
                url: text,
                title: info.videoDetails.title,
                timestamp: `${info.videoDetails.lengthSeconds}s`,
                image: info.videoDetails.thumbnails[0].url,
                author: { name: info.videoDetails.author.name }
            }
        } else {
            const look = await search(text)
            vid = look.videos[0]
            if (!vid) throw 'Video tidak ditemukan! Kamu ngetik pakai mata atau pakai jempol sih? 🙄'
            url = vid.url
        }

        // 3. Kirim Info Awal dengan AdReply (Bukan berarti aku ingin pamer ya!)
        let caption = `🎬 *${vid.title}*\n⏱️ Durasi: ${vid.timestamp}\n👤 Author: ${vid.author.name}\n\n_Sedang mengirim audio, tunggu sebentar..._`
        
        await conn.sendMessage(m.chat, {
            text: caption
        }, { quoted: m })

        // 4. Eksekusi Engine cdxdl (Metode Spodl)
        const stream = await Spodl(url)

        // 5. Kirim Audio Secara Bersih
        await conn.sendMessage(m.chat, {
            audio: { stream: stream },
            mimetype: 'audio/mp4',
            fileName: `${vid.title}.mp3`
        }, { quoted: m })

        if (m.react) m.react('✅')

    } catch (e) {
        console.error(e)
        // Kalau error, jangan salahkan aku! Cek IP VPS-mu sana!
        m.reply(`*Cih, Error:* ${e.message || e}`)
    }
}

handler.help = ['play', 'song']
handler.tags = ['downloader']
handler.command = /^(play|song|ds)$/i
handler.limit = true

export default handler

*/
// @ts-nocheck
import axios from 'axios';
import * as cheerio from 'cheerio';

let handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) throw `*Hmph!* Masukan URL TikTok!\n\nContoh:\n${usedPrefix + command} https://www.tiktok.com/@user/video/1234567890`;

    // Validasi URL TikTok
    const isTikTok = /tiktok\.com|tiktok/i.test(text);
    if (!isTikTok) {
        throw `Cih, itu bukan URL TikTok yang valid! Masukkan link yang benar dong!`;
    }

    try {
        await m.reply('_Tunggu sebentar... Sedang aku scrape dari seekin.ai, jangan bawel ya!_');

        let success = false;
        let result = null;
        let usedServer = '';

        // --- SERVER 1: SEEKIN.AI (Scrape langsung) ---
        try {
            usedServer = 'Seekin.ai';
            const response = await axios.post('https://www.seekin.ai/api/tiktok', {
                url: text
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Origin': 'https://www.seekin.ai',
                    'Referer': 'https://www.seekin.ai/'
                },
                timeout: 20000
            });

            if (response.data) {
                const data = response.data;
                // Cek berbagai kemungkinan struktur response
                if (data.data || data.result || data.video || data.url) {
                    result = data.data || data.result || data;
                    success = true;
                }
            }
        } catch (e) {
            console.log(`Seekin.ai Server 1 Error: ${e.message}`);
        }

        // --- SERVER 2: SEEKIN.AI (Alternative endpoint) ---
        if (!success) {
            try {
                usedServer = 'Seekin.ai Alt';
                const response = await axios.get('https://www.seekin.ai/download', {
                    params: { url: text },
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 20000
                });

                if (response.data && response.data.download_url) {
                    result = response.data;
                    success = true;
                }
            } catch (e) {
                console.log(`Seekin.ai Alt Error: ${e.message}`);
            }
        }

        // --- SERVER 3: Scraping HTML dengan Cheerio ---
        if (!success) {
            try {
                usedServer = 'HTML Scrape';
                const response = await axios.get('https://www.seekin.ai/', {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 20000
                });

                const $ = cheerio.load(response.data);
                // Extract video info dari HTML
                const videoUrl = $('a[href*="download"]').first().attr('href');
                
                if (videoUrl) {
                    result = { download_url: videoUrl };
                    success = true;
                }
            } catch (e) {
                console.log(`HTML Scrape Error: ${e.message}`);
            }
        }

        if (success && result) {
            // Kirim hasil ke user
            if (result.download_url || result.url) {
                await conn.sendMessage(m.chat, {
                    video: { url: result.download_url || result.url },
                    caption: `✅ *TikTok Downloaded*\n📊 Server: ${usedServer}\n⏱️ Waktu: ${new Date().toLocaleTimeString()}`
                }, { quoted: m });
            } else {
                await m.reply(`❌ Gagal download TikTok.\nServer yang digunakan: ${usedServer}\n\nError: ${JSON.stringify(result)}`);
            }
        } else {
            throw `❌ Gagal mengambil data TikTok dari semua server.\nSilakan coba lagi nanti.`;
        }

    } catch (error) {
        console.error('TikTok DL Error:', error);
        await m.reply(`❌ Error: ${error.message}\n\nPastikan URL TikTok valid dan coba lagi.`);
    }
};

handler.help = ['tiktok2 <url>', 'ttseekin <url>'];
handler.tags = ['downloader'];
// Fallback Seekin khusus, agar tidak bentrok dengan dl-tiktok_douyin.ts yang menjadi handler utama tiktok/tt.
handler.command = /^(tiktok2|tt2|ttseekin|seekintt)$/i;

export default handler;

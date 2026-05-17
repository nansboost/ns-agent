// @ts-nocheck
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Fungsi Format Size (Biar kamu tidak pusing baca angka)
 */
function formatSize(bytes) {
    if (!bytes) return 'Unknown';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    return mb >= 1 ? `${mb.toFixed(2)} MB` : `${kb.toFixed(2)} KB`;
}

/**
 * Scrapper Mediafire (Jangan sampai salah ambil link!)
 */
async function mediafireDownloader(url) {
    if (!url.includes('mediafire.com')) throw new Error('Cih, itu bukan URL Mediafire!');

    const { data } = await axios.get(url, {
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
        }
    });

    const $ = cheerio.load(data);
    const dl = $('#downloadButton').attr('href');
    if (!dl) throw new Error('Gagal mengambil link download. Mungkin filenya sudah dihapus?');

    let title = $('div.download_file_title > h1').text().trim() || 
                $('div.dl-btn-label').attr('title') ||
                decodeURIComponent(url.split('/').slice(-2, -1)[0]);
    
    title = title.replace(/\+/g, ' ');
    const type = title.split('.').pop();

    let size = '';
    try {
        const head = await axios.head(dl);
        const length = parseInt(head.headers['content-length']);
        size = formatSize(length);
    } catch {
        size = 'Unknown';
    }

    return { title, size, type, downloadLink: dl };
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) throw `*Hmph!* Masukan URL Mediafire!\nContoh: ${usedPrefix + command} https://www.mediafire.com/file/xxxx/file.zip`;

    try {
        await m.reply('_Sedang mengambil info file... Jangan bawel ya!_');
        
        const result = await mediafireDownloader(text);
        const cleanTitle = result.title.replace(/[\\*_\`\[\]]/g, '');
        
        // Info awal ke user
        let info = `📦 *M E D I A F I R E*\n\n` +
                   `◦ *Nama* : ${cleanTitle}\n` +
                   `◦ *Ukuran* : ${result.size}\n` +
                   `◦ *Tipe* : ${result.type}\n\n` +
                   `_Sedang mengirim file... Tunggu saja, bukan berarti aku peduli!_`;
        
        await m.reply(info);

        // Download dan Kirim sebagai Dokumen
        const response = await axios.get(result.downloadLink, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        // Tentukan ekstensi akhir
        const contentType = response.headers['content-type'] || 'application/octet-stream';
        let actualExt = contentType.split('/')[1] || result.type || 'dat';
        if (actualExt.includes('zip')) actualExt = 'zip'; // Cleanup if needed

        let finalFilename = cleanTitle.includes('.') ? cleanTitle : `${cleanTitle}.${actualExt}`;

        await conn.sendMessage(m.chat, {
            document: Buffer.from(response.data),
            mimetype: contentType,
            fileName: finalFilename,
            caption: `✅ *Success Downloaded:* ${finalFilename}`
        }, { quoted: m });

    } catch (e) {
        console.error('Mediafire error:', e);
        conn.reply(m.chat, `*Error:* ${e.message || 'Ada masalah saat mendownload!'}`, m);
    }
};

handler.help = ['mediafire'];
handler.tags = ['downloader'];
handler.command = /^(mediafire|mf)$/i;
handler.limit = true; // Wajib limit karena ini boros bandwidth!

export default handler;
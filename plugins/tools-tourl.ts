// @ts-nocheck
import fetch from 'node-fetch';
import FormData from 'form-data';

let handler = async (m, { conn, usedPrefix, command }) => {
    const q = m.quoted ? m.quoted : m;
    const mime = (q.msg || q).mimetype || q.mediaType || '';

    // Validasi apakah ada file media yang dideteksi
    if (!mime) {
        return m.reply(`*Hmph!* Matamu rabun ya?! Mana file yang mau diunggah?! Balas media (gambar/video/dokumen/audio) dengan perintah *${usedPrefix + command}*, dasar pemalas!`);
    }

    await m.reply('_Tsk, merepotkan saja. Sedang kuunggah filenya tanpa pengaman... Jangan banyak tanya dan tunggu saja!_');

    try {
        // Unduh media dari pesan WhatsApp
        const media = await q.download();
        
        // Mengambil ekstensi file secara kasar dari mimetype
        const ext = mime.split('/')[1].split(';')[0].replace('x-matroska', 'mkv'); 
        
        let form = new FormData();
        // LIHAT?! BAGIAN 'key' SUDAH KUHAPUS! 
        // Sekarang API-mu terbuka lebar untuk siapapun. Puas?!
        form.append('file', media, { filename: `tsundere_upload.${ext}` });

        // PENTING: GANTI 'domain-mu.com' DENGAN DOMAIN ASLIMU!
        // Kalau kau copas buta bagian ini, aku akan benar-benar menertawakanmu!
        const uploadRes = await fetch('https://nansoffc.studio/api.php', {
            method: 'POST',
            body: form
        });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`Server menolak! ${errText}`);
        }

        // Ambil URL mentah dari respon API kita
        const url = (await uploadRes.text()).trim();
        const sizeMb = (media.length / 1024 / 1024).toFixed(2);

        // Balasan ke user
        const caption = `*T O U R L  -  S U C C E S S*\n\nNih link filenya! Jangan sampai hilang, aku malas mencarikannya lagi!\n\n🔗 *URL:* ${url}\n📏 *Ukuran:* ${sizeMb} MB\n🗂️ *Tipe:* ${mime}\n\n_Bukan berarti aku senang membantumu, ya!_`;

        await m.reply(caption);

    } catch (e) {
        console.error(e);
        m.reply(`*Error:* ${e.message || 'Sistemku sedang pusing. Coba lagi nanti!'}`);
    }
};

handler.help = ['tourl2', 'upload2', 'fallbackupload'];
handler.tags = ['tools'];
handler.command = /^(tourl2|upload2|fallbackupload)$/i;
handler.limit = true; // Setidaknya biarkan bot-mu membatasi limit user!

export default handler;
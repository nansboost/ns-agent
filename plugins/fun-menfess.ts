// @ts-nocheck
/**
 * Menfess Plugin (ESM Version)
 * Mengirim pesan rahasia ke nomor tertentu melalui bot.
 */

let handler = async (m, { conn, text, usedPrefix, command }) => {
    // Inisialisasi object menfess di koneksi bot
    conn.menfess = conn.menfess ? conn.menfess : {}
    
    // Validasi input teks
    if (!text) throw `*Hmph! Cara penggunaan :*\n\n${usedPrefix + command} nomor|nama pengirim|pesan\n\n*Note:* Nama boleh samaran.\n*Contoh:* ${usedPrefix + command} 62812xxx|Anonymous|Hai.`;
    
    let [jid, name, pesan] = text.split('|');
    if (!jid || !name || !pesan) throw `*Format salah!* Gunakan tanda pemisah | (pipa).\nContoh: ${usedPrefix + command} nomor|nama|pesan`;

    // Membersihkan nomor telepon
    jid = jid.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    
    // Cek apakah nomor terdaftar di WhatsApp
    let data = (await conn.onWhatsApp(jid))[0] || {};
    if (!data.exists) throw 'Nomor tidak terdaftar di WhatsApp! Cek lagi nomornya, jangan ceroboh!';
    
    // Larangan mengirim ke diri sendiri
    if (jid === m.sender) throw 'Cih, tidak punya teman ya? Masa kirim menfess ke diri sendiri...';

    // Buat ID unik untuk sesi menfess
    let id = + new Date();
    let teks = `Hai @${data.jid.split("@")[0]}, kamu menerima pesan *Menfess* nih!\n\n` +
               `◦ Dari: *${name}*\n` +
               `◦ Pesan: \n${pesan}\n\n` +
               `_Mau balas pesan ini? Tinggal ketik saja lalu kirim, nanti aku sampaikan ke *${name}*._`.trim();

    // Kirim pesan ke penerima pakai relayMessage (Biar terlihat keren)
    await conn.sendMessage(data.jid, {
        text: teks,
        mentions: [data.jid]
    }, {}).then(() => {
        // Balas ke pengirim
        m.reply('Berhasil mengirim pesan menfess. Semoga dibalas ya, hmph!')
        
        // Simpan ke database sementara
        conn.menfess[id] = {
            id,
            dari: m.sender,
            nama: name,
            penerima: data.jid,
            pesan: pesan,
            status: false // Status false berarti belum ada balasan
        }
    });
}

handler.help = ['menfess']
handler.tags = ['fun']
handler.command = /^(menfess|menfes)$/i
handler.private = true // Hanya bisa di privat chat biar rahasia!

export default handler
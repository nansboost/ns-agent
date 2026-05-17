// @ts-nocheck
/**
 * Push Kontak Plugin (Safety ESM Version)
 * Mode: Phone Number Filter
 * Jeda: 10 detik/pesan & Istirahat 1 menit tiap 10 pesan.
 */

let handler = async (m, { conn, groupMetadata, text, usedPrefix, command }) => {
    // Validasi Input
    if (!text && !m.quoted) {
        throw `*Hmph!* Masukkan teks atau reply pesan!\n\nContoh: ${usedPrefix + command} Halo kak`;
    }

    // Mengikuti kemauanmu: Pakai 'phoneNumber' bukan 'id'
    // Pastikan library Baileys kamu memang menyimpan properti phoneNumber di metadata group
    let participants = groupMetadata.participants
        .filter(v => v.phoneNumber && v.phoneNumber.endsWith('.net'))
        .map(v => v.phoneNumber);
        
    let total = participants.length;
    
    if (total === 0) throw 'Cih, tidak ada peserta dengan properti phoneNumber yang ditemukan!';

    await m.reply(`_Memproses *${total}* kontak via Phone Number._\n_Jeda: 10 detik/pesan._\n_Istirahat: 1 menit tiap 10 pesan._\n\n*Jangan bawel, aku sudah ikuti maumu!*`);

    let sentCount = 0;
    
    for (let i = 0; i < total; i++) {
        // --- JEDA ANTAR PESAN (10 DETIK) ---
        await sleep(10000); 

        try {
            let target = participants[i];
            
            if (text && !m.quoted) {
                await conn.sendMessage(target, { text: text });
            } else if (m.quoted && !text) {
                await conn.copyNForward(target, m.getQuotedObj(), false);
            } else if (text && m.quoted) {
                await conn.sendMessage(target, { text: text });
                await conn.copyNForward(target, m.getQuotedObj(), false);
            }
            
            sentCount++;
            console.log(`[Push Kontak] Berhasil: ${sentCount}/${total}`);
        } catch (e) {
            console.error(`Gagal mengirim ke ${participants[i]}:`, e.message);
            // Proteksi kalau koneksi ditutup paksa oleh WhatsApp
            if (e.message.includes('Closed') || e.message.includes('428')) {
                await m.reply('⚠️ Koneksi terputus! WhatsApp mendeteksi aktivitas mencurigakan. Proses dihentikan!');
                return;
            }
        }

        // --- JEDA ISTIRAHAT (1 MENIT TIAP 10 PESAN) ---
        if (sentCount % 10 === 0 && sentCount !== total) {
            console.log(`[Push Kontak] Istirahat 1 menit dimulal...`);
            await m.reply(`_Sudah mengirim 10 pesan. Istirahat 1 menit dulu biar tidak Banned!_`);
            await sleep(60000); // 1 Menit
        }
    }

    // Laporan Akhir
    await m.reply(`✅ *Push Kontak Selesai!*\n\n◦ Berhasil Terkirim: ${sentCount}\n\n_Sudah ya, jangan suruh aku ganti-ganti lagi!_`);
};

handler.help = ['pushkontak'];
handler.tags = ['owner'];
handler.command = /^(pushkontak|pk)$/i;
handler.owner = true;
handler.group = true;

export default handler;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
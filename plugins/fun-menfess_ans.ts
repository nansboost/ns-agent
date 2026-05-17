// @ts-nocheck
/**
 * Menfess Reply Handler (ESM Version)
 * Otomatis meneruskan balasan dari penerima menfess ke pengirim asli.
 */

const delay = time => new Promise(res => setTimeout(res, time));

let handler = m => m;

handler.before = async function (m) {
    // Hanya proses di Chat Pribadi (Private Chat)
    if (!m.chat.endsWith('@s.whatsapp.net')) return !0;

    // Pastikan object menfess sudah terinisialisasi
    this.menfess = this.menfess ? this.menfess : {};
    
    // Cari sesi menfess yang aktif di mana si pengirim pesan (m.sender) adalah si penerima menfess
    let mf = Object.values(this.anonymous || {}).find(room => [room.a, room.b].includes(m.sender) && room.state === 'CHATTING') 
             ? !0 : Object.values(this.menfess).find(v => v.status === false && v.penerima === m.sender);

    // Jika tidak ada sesi menfess yang cocok, abaikan
    if (!mf || typeof mf === 'boolean') return !0;

    // Abaikan jika pesan berupa command (biar tidak bentrok sama fitur lain)
    if (m.text.startsWith('.') || m.text.startsWith('#') || m.text.startsWith('!')) return !0;

    // Logika balasan
    console.log(`[Menfess Reply] From: ${m.sender} to: ${mf.dari}`);

    let txt = `Hai kak @${mf.dari.split('@')[0]}, kamu menerima pesan balasan nih!\n\n` +
              `◦ *Pesan Kamu:* \n${mf.pesan}\n\n` +
              `◦ *Pesan Balasannya:* \n${m.text}\n`.trim();

    // Kirim balasan ke pengirim asli
    await this.reply(mf.dari, txt, null, { mentions: [mf.dari] }).then(async () => {
        await m.reply('Berhasil mengirim balasan ke pengirim, hmph!');
        
        // Kasih jeda sedikit sebelum menghapus sesi biar database tidak kaget
        await delay(2000);
        
        // Hapus sesi menfess karena sudah selesai (case closed)
        delete this.menfess[mf.id];
    });

    return !0;
};

export default handler;
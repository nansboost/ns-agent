// @ts-nocheck
/**
 * Anonymous Chat Forwarder (ESM Version)
 * Mengirim pesan ke partner chat anonim secara otomatis.
 */

let handler = m => m;

handler.before = async function (m, { match }) {
    // Jika pesan mengandung match command utama, biarkan ditangani oleh handler utama
    // if (match) return !1
    
    // Pastikan hanya menangani Chat Pribadi (Private Chat)
    if (!m.chat.endsWith('@s.whatsapp.net')) return !0;

    // Inisialisasi object anonymous jika belum ada
    this.anonymous = this.anonymous ? this.anonymous : {};
    
    // Cari room yang sedang dalam status 'CHATTING' dan melibatkan pengirim
    let room = Object.values(this.anonymous).find(room => 
        [room.a, room.b].includes(m.sender) && room.state === 'CHATTING'
    );

    if (room) {
        // Abaikan jika pesan adalah command untuk mengakhiri atau mengganti partner
        if (/^.*(next|leave|start)/.test(m.text)) return !0;
        if (['.next', '.leave', '.start', 'Cari Partner', 'Keluar', 'Next'].includes(m.text)) return !0;

        // Cari ID partner (siapa yang bukan pengirim pesan ini)
        let other = [room.a, room.b].find(user => user !== m.sender);
        
        // Kirim pesan ke partner (Forward)
        await this.copyNForward(other, m, true, m.quoted && m.quoted.fromMe ? {
            contextInfo: {
                ...m.msg.contextInfo,
                forwardingScore: 1,
                isForwarded: true,
                participant: other
            }
        } : {});
    }
    
    return !0;
};

export default handler;
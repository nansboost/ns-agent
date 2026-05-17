// @ts-nocheck
/**
 * Anonymous Chat Logic (ESM Version)
 * Handle Start, Leave, and Next Partner.
 */

async function handler(m, { command, conn }) {
    command = command.toLowerCase()
    this.anonymous = this.anonymous ? this.anonymous : {}

    switch (command) {
        case 'next':
        case 'leave': {
            // Cari room berdasarkan pengirim
            let room = Object.values(this.anonymous).find(room => room.check(m.sender))
            if (!room) throw `*Hmph!* Kamu tidak sedang berada di anonymous chat. Ketik .start untuk mencari partner!`
            
            m.reply('Cih, meninggalkan partner ya? Baiklah.')
            
            let other = room.other(m.sender)
            if (other) {
                // Beritahu partner bahwa chat berakhir
                await conn.sendMessage(other, { text: 'Partner telah meninggalkan chat. Ketik .start untuk mencari lagi.' })
            }
            
            // Hapus room
            delete this.anonymous[room.id]
            
            // Jika cuma leave, berhenti di sini. Jika next, lanjut ke case start.
            if (command === 'leave') break
        }
        
        case 'start': {
            // Cek apakah user sudah ada di dalam room
            if (Object.values(this.anonymous).find(room => room.check(m.sender))) {
                throw 'Kamu masih berada di dalam anonymous chat! Ketik .leave dulu kalau mau ganti.'
            }
            
            // Cari room yang sedang WAITING (menunggu partner)
            let room = Object.values(this.anonymous).find(room => room.state === 'WAITING' && !room.check(m.sender))
            
            if (room) {
                // Menemukan partner!
                room.b = m.sender
                room.state = 'CHATTING'
                
                let findMsg = 'Partner ditemukan! Silakan mulai mengobrol.\n\n_Ketik .leave untuk keluar atau .next untuk ganti partner._'
                
                await conn.sendMessage(room.a, { text: findMsg })
                await conn.sendMessage(room.b, { text: findMsg })
                
            } else {
                // Tidak ada room kosong, buat room baru (WAITING)
                let id = + new Date()
                this.anonymous[id] = {
                    id,
                    a: m.sender,
                    b: '',
                    state: 'WAITING',
                    check: function (who = '') {
                        return [this.a, this.b].includes(who)
                    },
                    other: function (who = '') {
                        return who === this.a ? this.b : who === this.b ? this.a : ''
                    },
                }
                m.reply('Sedang mencari partner anonymous chat... Sabar sedikit, jangan bawel!')
            }
            break
        }
    }
}

handler.help = ['start', 'leave', 'next']
handler.tags = ['anonymous']
handler.command = ['start', 'leave', 'next']
handler.private = true

export default handler
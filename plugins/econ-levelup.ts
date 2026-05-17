// @ts-nocheck
import { canLevelUp, xpRange } from '../lib/levelling.ts'
import fetch from 'node-fetch'

let handler = async (m, { conn }) => {

  let name = conn.getName(m.sender)
  let pp = await conn.profilePictureUrl(m.sender, 'image')
    .catch(_ => 'https://i.ibb.co/1ZxrXKJ/avatar-contact.jpg')

  let user = global.db.data.users[m.sender]

  // ───── JIKA TIDAK BISA NAIK LEVEL ─────
  if (!canLevelUp(user.level, user.exp, global.multiplier)) {

    let { min, xp, max } = xpRange(user.level, global.multiplier)

    let txt = `
┌───⊷ *LEVEL*
▢ Nama: *${name}*
▢ Level: *${user.level}*
▢ XP: *${user.exp - min}/${xp}*
▢ Rank: *${user.role}*
└──────────────

*${max - user.exp} XP* dibutuhkan untuk naik level
`.trim()

    try {

      let imgg = API('fgmods', '/api/maker/rank', {
        username: name,
        xp: user.exp - min,
        exp: xp,
        avatar: pp,
        level: user.level,
        ranklog: 'https://i.ibb.co/7gfnyMw/gold.png',
        background: 'https://i.ibb.co/CsNgBYw/qiyana.jpg'
      }, 'apikey')

      // Cek apakah API masih aktif
      let check = await fetch(imgg)
      if (!check.ok) throw "API tidak aktif"

      await conn.sendFile(m.chat, imgg, 'level.jpg', txt, m)

    } catch (e) {
     // await m.reply(txt) 
      await conn.sendFile(m.chat, pp, 'level.jpg', txt, m)
    }
  }

  // ───── JIKA BISA NAIK LEVEL ─────
  let before = user.level * 1

  while (canLevelUp(user.level, user.exp, global.multiplier))
    user.level++

  if (before !== user.level) {

    user.role = global.rpg.role(user.level).name

    let str = `
┌─⊷ *LEVEL UP*
▢ Level sebelumnya: *${before}*
▢ Level sekarang: *${user.level}*
▢ Rank: *${user.role}*
└──────────────
`.trim()

    try {

      let img = API('fgmods', '/api/maker/levelup', { 
        avatar: pp 
      }, 'apikey')

      let check = await fetch(img)
      if (!check.ok) throw "API tidak aktif"

      await conn.sendFile(m.chat, img, 'levelup.jpg', str, m)

    } catch (e) {
      await m.reply(str)
    }
  }
}

handler.help = ['levelup', 'lvl', 'level']
handler.tags = ['econ']
handler.command = ['levelup', 'lvl', 'level']

export default handler
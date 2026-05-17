// @ts-nocheck
import fetch from 'node-fetch'

let handler = async (m, { conn, args, usedPrefix, command }) => {
   if (!args[0]) throw `*Contoh:* ${usedPrefix}${command} https://www.instagram.com/p/ByxKbUSnubS/`
   
   if (!args[0].match(/instagram/gi)) {
       throw `Cih, masukkan URL Instagram yang benar dong!`
   }

   await m.reply(global.wait || '_Sedang aku ambilkan medianya... Tunggu saja!_')

   try {
       let mediaData = []
       let usedServer = 'Betabotz'

       // --- COBA SERVER 1: BETABOTZ ---
       try {
           const api = await fetch(`https://api.betabotz.eu.org/api/download/igdownloader?url=${args[0]}&apikey=${global.lann}`)
           const res = await api.json()
           
           if (res.status && res.message) {
               const data = res.message
               mediaData = Array.isArray(data) ? data : [data]
           }
       } catch (e) {
           console.log("Betabotz Error, mencoba server Botcahx...")
       }

       // --- COBA SERVER 2: BOTCAHX (Jika Betabotz Gagal) ---
       if (mediaData.length === 0) {
           usedServer = 'Botcahx'
           try {
               const api = await fetch(`https://api.botcahx.eu.org/api/dowloader/igdownloader?url=${args[0]}&apikey=${global.btc}`)
               const res = await api.json()
               
               if (res.status && res.result) {
                   const data = res.result
                   mediaData = Array.isArray(data) ? data : [data]
               }
           } catch (e) {
               throw 'Cih! Semua server API sedang mogok kerja!'
           }
       }

       if (mediaData.length === 0) throw 'Gagal mendapatkan media. Mungkin akunnya privat atau link salah.'

       const limitnya = 3
       for (let i = 0; i < Math.min(limitnya, mediaData.length); i++) {
           await sleep(2000) 
           let downloadUrl = mediaData[i]._url || mediaData[i].url || mediaData[i]
           
           if (downloadUrl) {
               await conn.sendFile(m.chat, downloadUrl, 'ig.mp4', `*Instagram Downloader*\nServer: ${usedServer}`, m)
           }
       }

   } catch (e) {
       console.error(e)
       throw `*Error:* ${e.message || e}`
   }
}

handler.help = ['instagram <url>']
handler.tags = ['downloader']
handler.command = /^(ig|instagram|igdl|instagramdl|igstory)$/i
handler.limit = true

export default handler // Di ESM pakai export default, bukan module.exports!

function sleep(ms) {
   return new Promise(resolve => setTimeout(resolve, ms));
}
// @ts-nocheck
let handler = async (m, { conn, text }) => {
    if (!text) throw `✳️ Masukkan link channel.`;

    try {
        let id = text
            .replace(/https:\/\/(www\.)?whatsapp\.com\/channel\//, "")
            .split("/")[0]
            .trim();

        let metadata = await conn.newsletterMetadata("invite", id);

        let thread = metadata.thread_metadata;

        let name = thread?.name?.text || "Tidak tersedia";
        let subscribers = thread?.subscribers_count || "0";

        let created = thread?.creation_time? new Date(Number(thread.creation_time) * 1000).toLocaleString("id-ID") : "Tidak tersedia";

        let img = thread?.preview?.direct_path? `https://pps.whatsapp.net${thread.preview.direct_path}` : null;

        let info = `
*📢 INFO CHANNEL*\n
📌 *ID:* ${metadata.id}
🫧 *Nama:* ${name}
👥 *Subscriber:* ${subscribers}
⏳ *Dibuat pada:* ${created}
`.trim();

        if (img) {
            await conn.sendFile(m.chat, img, 'channel.jpg', info, m);
        } else {
            await conn.reply(m.chat, info, m);
        }

    } catch (e) {
        throw "❌ Gagal mengambil informasi channel.";
    }
};

handler.help = ['ci <link>'];
handler.tags = ['tools'];
handler.command = ['ci', 'channelinfo', 'cinfo'];

export default handler;
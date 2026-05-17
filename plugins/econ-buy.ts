// @ts-nocheck
let hargaDiamond = 200;
let hargaPremiumJam = 50;
let hargaPremiumHari = 800;

let handler = async (m, { conn, text, usedPrefix, command, args }) => {
if (!args[1]) throw `📌 Contoh: *${usedPrefix + command}* <ID> <jumlah>\nContoh: *${usedPrefix + command}* _01_ 5\n\n*${usedPrefix}shop* untuk melihat semua *Item*`;
let option = args[0];
let input = args[1];
let user = global.db.data.users[m.sender];

if (option === '01') {
let sca = args[1];
if (sca.toLowerCase() !== 'all' && !/^[1-9]\d*$/.test(sca)) throw `✳️ Harus berupa angka yang valid`;
let all = Math.floor(user.coin / hargaDiamond)
let count = sca.replace('all', all)
count = Math.max(1, count)
let totalCost = hargaDiamond * count;
if (user.coin >= totalCost) {
user.coin -= totalCost;
user.diamond += count;
m.reply(`
┌─「 *BUKTI PEMBELIAN* 」
‣ *Item:* Diamond
‣ *Jumlah dibeli:* ${count.toLocaleString()} 💎
‣ *Dihabiskan:* -${totalCost.toLocaleString()} 🪙
└──────────────`, null, fwc);
} else {
m.reply(`❎ Coin kamu tidak cukup untuk membeli *${count}* 💎`, null, fwc);
}
} else if (option === '02') {
let count = 0;
let unit = '';
if (input.endsWith('h')) {
count = parseInt(input.slice(0, -1));
unit = 'jam';
} else if (input.endsWith('d')) {
count = parseInt(input.slice(0, -1));
unit = 'hari';
} else {
throw `✳️ Format waktu tidak valid.
*Contoh:* ${usedPrefix + command} <ID> <jumlah>
${usedPrefix + command} 02 4d
h = Jam
d = Hari
`;
}
if (!/^[1-9]\d*$/.test(count)) throw `✳️ Jumlah harus berupa angka yang valid`;
let hargaPremium = 0;
if (unit === 'jam') {
hargaPremium = hargaPremiumJam * count;
} else if (unit === 'hari') {
hargaPremium = hargaPremiumHari * count;
}
if (user.diamond >= hargaPremium) {
user.diamond -= hargaPremium;
let jam = 0;
if (unit === 'jam') {
jam = count * 3600000;
} else if (unit === 'hari') {
jam = count * 86400000;
}
const now = new Date() * 1;
if (now < user.premiumTime) {
user.premiumTime += jam;
} else {
user.premiumTime = now + jam;
}
user.prem = true;
m.reply(`
┌─「 *BUKTI PEMBELIAN* 」
‣ *Item:* Premium
‣ *Durasi:* ${count} ${unit}
‣ *Dihabiskan:* -${hargaPremium} 💎
└──────────────`, null, fwc);
} else {
m.reply(`❎ Diamond kamu tidak cukup untuk membeli Premium ${count} ${unit}`, null, fwc);
}
} else {
throw `✳️ Item tersebut tidak ada:\n\n*${usedPrefix}shop* untuk melihat item yang tersedia`;
}
};

handler.help = ['buy <item>'];
handler.tags = ['econ'];
handler.command = ['buy'];
export default handler;
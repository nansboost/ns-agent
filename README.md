# NS Agent

NS Agent adalah bot WhatsApp berbasis **TypeScript** yang dikembangkan dari base **SENNA BOT**. Project ini sudah ditambahkan sistem **AI agent**, **Telegram bridge opsional**, **plugin system**, dan **JID/LID resolver**.

SENNA BOT dibuat oleh **FG98 / Dylux** menggunakan JavaScript ESM. NS Agent dimodifikasi dan dikembangkan ulang oleh **nansoffc** menggunakan TypeScript. Versi ini dipublikasikan dengan izin dari pemilik script asli.

## Fitur Utama

- WhatsApp bot menggunakan Baileys.
- Sistem plugin command.
- AI agent untuk membaca, menganalisis, dan membantu mengedit project.
- Provider AI OpenAI-compatible, seperti NVIDIA NIM dan DashScope/Qwen.
- Provider router, fallback provider, retry, cooldown, dan queue agent.
- Telegram bridge opsional yang berjalan terpisah dari WhatsApp.
- JID/LID resolver untuk membantu mapping `@lid` ke `@s.whatsapp.net` jika data tersedia.
- Konfigurasi utama terpusat di `config.ts`.
- Runtime data, session, token, API key, dan database tidak disertakan pada versi publik.

## Struktur Project

```txt
main.ts                 Proses utama WhatsApp/Baileys
index.ts                Wrapper proses WhatsApp + Telegram
telegram.ts             Entry Telegram bridge
handler.ts              Dispatcher command WhatsApp
config.ts               Semua konfigurasi utama
plugins/                Plugin bawaan bot
ws/plugins/             Plugin tambahan dari workspace agent
ws/projects/            Project/tool/website buatan agent
lib/                    Helper utama bot non-agent
lib/agent/              Core AI agent
lib/agent-data/         Data runtime AI agent, tidak untuk commit
lib/jid-data/           Cache mapping JID/LID, tidak untuk commit
```

## Persyaratan

- Node.js 20+ disarankan.
- npm.
- Server/VPS/Pterodactyl/Termux yang mendukung Node.js.
- Akun WhatsApp untuk pairing bot.
- Token Telegram hanya jika ingin memakai Telegram bridge.
- API key provider AI hanya jika ingin memakai fitur `.agent`.

## Instalasi

```bash
git clone https://github.com/nansboost/ns-agent.git
cd ns-agent
npm install
```

Lalu buka `config.ts` dan isi konfigurasi yang diperlukan.

## Konfigurasi

Semua konfigurasi utama berada di:

```txt
config.ts
```

Project ini sengaja tidak memakai `.env` bawaan. Jangan commit API key, token, session, atau database pribadi ke GitHub.

Bagian yang biasanya perlu diubah:

```ts
global.owner
```

Isi nomor owner WhatsApp kamu.

```ts
global.botName
global.packname
global.author
```

Isi identitas bot.

```ts
global.agentRouter.providers.nvidia.apiKey
global.agentRouter.providers.nvidia.apiKeys
global.agentRouter.providers.dashscope.apiKey
```

Isi API key provider AI jika ingin memakai AI agent.

```ts
global.telegramBot.enabled
global.telegramBot.token
global.telegramBot.ownerIds
```

Isi hanya jika ingin mengaktifkan Telegram bridge.

## Menjalankan Bot

Menjalankan wrapper WhatsApp + Telegram:

```bash
npm start
```

Menjalankan WhatsApp saja:

```bash
npm run start:wa
```

Menjalankan Telegram saja:

```bash
npm run start:telegram
```

Cek TypeScript:

```bash
npm run check
```

Rebuild index agent:

```bash
npm run agent:index
```

## Telegram Bridge

Telegram bridge bersifat opsional. Jika `global.telegramBot.enabled` bernilai `false`, Telegram tidak akan aktif.

Telegram berjalan sebagai proses terpisah dari WhatsApp melalui `index.ts`. Jika Telegram error, WhatsApp tetap berjalan. Jika WhatsApp restart, Telegram tidak ikut mati selama wrapper masih hidup.

Command Telegram utama:

```txt
/start
/help
/id
/ping
/status
/provider
/models
/use <provider>
/model <model>
/agent <prompt>
/agentwrite <instruksi>
```

Secara default, `/agentwrite` dari Telegram dibuat nonaktif demi keamanan. Aktifkan hanya jika benar-benar diperlukan.

## AI Agent

Command AI agent di WhatsApp:

```txt
.agent <prompt>
.agentwrite <instruksi>
.agent status
.agent models
.agent provider
```

Mode `.agent` digunakan untuk membaca dan menganalisis. Mode `.agentwrite` digunakan untuk perubahan file dan sebaiknya hanya dipakai oleh owner yang paham risikonya.

Data runtime agent disimpan di:

```txt
lib/agent-data/
```

Folder tersebut tidak perlu di-commit.

## JID/LID Resolver

Command JID/LID:

```txt
.jid
.cekjid
.getjid
.jidmap
.jidmap refresh
```

Resolver akan mencoba membaca mapping dari cache, contact, signal repository, dan metadata grup. Jika private chat masih berbentuk `@lid` dan mapping belum tersedia, user perlu muncul di grup yang ada bot agar mapping bisa dikumpulkan dari metadata grup.

Cache mapping disimpan di:

```txt
lib/jid-data/jid-map.json
```

File tersebut tidak perlu di-commit.

## File Runtime yang Tidak Perlu Commit

File dan folder berikut dibuat otomatis saat bot berjalan:

```txt
database.json
sessions/
tmp/
logs/
lib/agent-data/*.json
lib/agent-data/reports/
lib/jid-data/*.json
.ns-agent/
```

Pastikan file tersebut tetap masuk `.gitignore`.

## Catatan Keamanan

- Jangan commit API key, token Telegram, session WhatsApp, database, atau cache JID/LID.
- Fitur owner seperti eval, shell, file tools, dan agent write memiliki risiko tinggi.
- Gunakan `.agentwrite` hanya jika kamu yakin dengan instruksi yang diberikan.
- Jangan menjalankan bot untuk spam, penipuan, pencurian data, malware, atau aktivitas ilegal.

## Kredit

Original Project:

```txt
SENNA BOT
```

Original Author:

```txt
FG98 / Dylux
```

Modified Project:

```txt
NS Agent
```

Modified by:

```txt
nansoffc
```

Terima kasih kepada **FG98 / Dylux** yang telah mengizinkan versi modifikasi ini untuk dipublikasikan.

## Lisensi

Project ini mengikuti lisensi SENNA BOT yang merujuk pada GNU General Public License v3.0 dengan ketentuan tambahan dari pemilik asli.

Lihat file `LICENSE` untuk detail lisensi.

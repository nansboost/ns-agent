# ns-agent

Bot WhatsApp berbasis TypeScript/Baileys dengan sistem plugin, AI code agent, JID/LID resolver, dan bridge Telegram opsional.

## Struktur utama

```txt
main.ts                 # proses utama WhatsApp/Baileys
index.ts                # process wrapper: WhatsApp + Telegram terpisah
telegram.ts             # entry Telegram bridge
handler.ts              # command dispatcher WhatsApp
config.ts               # semua konfigurasi utama
plugins/                # plugin bawaan/stabil
ws/plugins/             # plugin baru/eksperimen dari AI agent
ws/projects/            # project/website/tool buatan AI agent
lib/                    # core/helper bot non-agent
lib/agent/              # seluruh core AI agent
lib/agent-data/         # runtime data agent, diabaikan Git
lib/jid-data/           # runtime cache LID/JID, diabaikan Git
```

## Jalankan

```bash
npm install
npm start
```

`npm start` menjalankan `index.ts`, lalu wrapper memulai WhatsApp dan Telegram sebagai proses terpisah. Jika Telegram error, WhatsApp tetap berjalan. Jika WhatsApp restart, Telegram tidak ikut mati selama wrapper masih hidup.

Untuk hanya WhatsApp:

```bash
npm run start:wa
```

Untuk hanya Telegram:

```bash
npm run start:telegram
```

## Konfigurasi

Semua konfigurasi utama berada di:

```txt
config.ts
```

Tidak ada `.env` bawaan. Sebelum menjalankan bot, isi bagian berikut di `config.ts`:

- `global.owner`
- `global.backupsc`
- `global.agentRouter.providers.*.apiKey` atau `apiKeys`
- `global.telegramBot.token` jika Telegram dipakai
- `global.telegramBot.ownerIds` jika Telegram dipakai

Versi GitHub ini sengaja tidak membawa API key/token asli.

## Command penting

```txt
.agent <prompt>          # AI agent read/analysis mode
.agentwrite <instruksi>  # AI agent write/edit mode
.agent status            # status provider/queue agent
.agent models            # daftar model provider aktif
.jid                     # cek JID/LID sender/reply
.jidmap                  # ringkasan mapping LID ↔ JID
.jidmap refresh          # scan ulang grup untuk mapping
```

## Runtime data

File berikut dibuat otomatis saat bot berjalan dan tidak perlu di-commit:

```txt
database.json
sessions/
tmp/
logs/
lib/agent-data/*.json
lib/jid-data/*.json
.ns-agent/
```

## Lisensi

Project ini mengikuti file `LICENSE` yang sudah ada di repository. Ringkasnya, lisensi project merujuk ke GPL-3.0 dengan kewajiban menjaga kredit author asli dan modifier. Jangan menghapus credit `FG98` dan `nansoffc` dari file lisensi atau dokumentasi project.

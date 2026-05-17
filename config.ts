// @ts-nocheck

import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

// =====================================================
// NS Agent / WhatsApp Bot Configuration
// Semua konfigurasi utama ada di file ini saja.
// Untuk upload GitHub publik: jangan isi API key/token asli sebelum commit.
// =====================================================

// ================= OWNER & ACCESS =================
// Format owner: [nomor, nama, isMainOwner]
// Ganti 628xxxxxxxxxx dengan nomor WhatsApp kamu tanpa tanda +.
global.owner = [
  ['628xxxxxxxxxx', 'Owner', true]
]

global.backupsc = '628xxxxxxxxxx'
global.mods = []
global.prems = []
global.botNumber = ['']

global.packname = 'Made With'
global.author = '@nansoffc'
global.botName = 'NS Agent Bot'

global.multiplier = 69

// ================= PREFIX & DISPLAY =================
global.rwait = '⌛'
global.dmoji = '🤭'
global.done = '✅'
global.error = '❌'
global.xmoji = '🔥'

// ================= PUBLIC LINKS =================
// Kosongkan jika belum dipakai.
global.ns_ig = ''
global.ns_sc = ''
global.ns_yt = ''
global.ns_pyp = ''
global.ns_logo = ''

global.id_canal = ''
global.canal_log = ''
global.canal_logid = ''
global.ns_canal = ''
global.ns_group = ''
global.ns_gpnsfw = ''

// ================= EXTERNAL API PLUGINS =================
// Isi hanya kalau plugin yang kamu pakai membutuhkan API eksternal.
// Biarkan kosong untuk versi GitHub publik.
global.APIs = {
  lann: 'https://api.betabotz.eu.org',
  btc: 'https://api.botcahx.eu.org'
}

global.APIKeys = {
  'https://api.betabotz.eu.org': '',
  'https://api.botcahx.eu.org': ''
}


// ================= TELEGRAM BOT BRIDGE =================
// Telegram berjalan sebagai proses terpisah dari WhatsApp lewat index.ts.
// Jika Telegram error, WhatsApp tidak ikut crash.
global.telegramBot = {
  enabled: false,
  token: '',

  allowAllUsers: false,
  ownerIds: [
    // '123456789'
  ],
  ownerUsernames: [
    // 'username_telegram_tanpa_at'
  ],
  privateOnly: true,

  pollingTimeoutSeconds: 25,
  requestTimeoutMs: 35000,
  retryDelayMs: 3000,
  maxMessageChars: 3900,
  notifyOnStart: false,

  agent: {
    enabled: true,
    writeEnabled: false,
    statusEnabled: true,
    commandPrefix: 'telegram'
  }
}

// ================= AI AGENT ROUTER =================
// Semua provider OpenAI-compatible dikonfigurasi di sini.
// Jangan isi API key asli jika project akan di-upload ke GitHub publik.
global.agentRouter = {
  enabled: true,
  defaultProvider: 'nvidia',
  stateFile: './lib/agent-data/agent-provider.json',

  // Agent boleh membaca root project saat owner memakai .agent.
  // Output baru tetap diarahkan ke ws/ agar project utama rapi.
  workspace: './',
  workspacePluginsDir: 'ws/plugins',
  workspaceProjectsDir: 'ws/projects',
  workspaceSitesDir: 'ws/projects',
  workspaceTmpDir: 'ws/tmp',

  autoProviderFallback: true,
  fallbackProviders: ['dashscope'],

  webSearch: {
    enabled: true,
    maxResults: 8,
    minDelayMs: 1200,
    timeoutMs: 15000
  },

  sessionEnabled: true,
  sessionFile: './lib/agent-data/agent-sessions.json',
  sessionMaxMessages: 16,
  sessionMaxCharsPerMessage: 4000,

  taskFile: './lib/agent-data/agent-tasks.json',
  taskDefaultIntervalMs: 120000,
  taskMinIntervalMs: 60000,
  taskDefaultMaxRounds: 6,
  taskMaxRounds: 20,
  taskLogMaxChars: 6000,

  writeEnabled: true,
  maxWriteBytes: 5000000,
  limits: {
    maxAgentSteps: 100,
    maxFileBytes: 1000000,
    maxToolOutputChars: 60000,
    maxSearchResults: 120,
    maxReadLines: 500,
    maxWorkspaceFilesPerBatch: 80,
    maxWorkspaceBatchBytes: 20000000,
    maxReplyChars: 24000
  },

  providers: {
    nvidia: {
      enabled: true,
      type: 'openai-compatible',
      name: 'NVIDIA NIM / NVIDIA API',
      apiKey: '',
      apiKeys: [],
      baseURL: 'https://integrate.api.nvidia.com/v1',
      timeoutMs: 120000,
      sdkMaxRetries: 0,
      retryAttempts: 8,
      retryBaseDelayMs: 2000,
      retryMaxDelayMs: 45000,
      retryJitterMs: 1000,
      model: 'moonshotai/kimi-k2.6',
      fallbackModels: [
        'moonshotai/kimi-k2.6',
        'qwen/qwen3-coder-480b-a35b-instruct',
        'deepseek-ai/deepseek-v3.1'
      ],
      models: [
        'qwen/qwen3.5-122b-a10b',
        'moonshotai/kimi-k2.6',
        'qwen/qwen3-coder-480b-a35b-instruct',
        'deepseek-ai/deepseek-v3.1'
      ],
      temperature: 0.2,
      maxTokens: 8192,
      modelListLimit: 120
    },

    dashscope: {
      enabled: true,
      type: 'openai-compatible',
      name: 'Alibaba Cloud DashScope / Qwen',
      apiKey: '',
      apiKeys: [],
      baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      timeoutMs: 120000,
      sdkMaxRetries: 0,
      retryAttempts: 3,
      retryBaseDelayMs: 2000,
      retryMaxDelayMs: 30000,
      model: 'qwen3.6-plus',
      models: [
        'qwen3.6-plus'
      ],
      temperature: 0.2,
      maxTokens: 65536,
      modelListLimit: 120,
      regions: {
        singapore: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        usVirginia: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1',
        chinaBeijing: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        chinaHongKong: 'https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1',
        germanyFrankfurt: 'https://{WorkspaceId}.eu-central-1.maas.aliyuncs.com/compatible-mode/v1'
      }
    }
  }
}

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update 'config.ts'"))
  import(`${file}?update=${Date.now()}`)
})

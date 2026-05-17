/**
 * Script untuk merapikan struktur plugin ns-agent
 * Jalankan: npx tsx scripts/reorganize-plugins.ts
 */

import fs from 'fs';
import path from 'path';

const PLUGINS_DIR = path.resolve('plugins');

// Mapping file ke folder tujuan
const FILE_MAPPING: Record<string, string> = {
  // ADMIN / OWNER TOOLS
  '_aaa-addstok.ts': 'admin',
  '_aaa-aicode.ts': 'admin',
  '_aaa-model.js.ts': 'admin',
  '_aaa-nokos.js.ts': 'admin',
  '_aaa-order.ts': 'admin',
  '_aaa-owner-saveplugin.ts': 'admin',
  '_aaa-qislam.ts': 'admin',
  '_aaa-reals.js.ts': 'admin',
  '_aaa-reminder-ans.ts': 'admin',
  '_aaa-reminder.ts': 'admin',
  '_aaa-saveplugin.ts': 'admin',
  '_aaa-streak.ts': 'admin',
  '_aaa-tourl.ts': 'admin',
  '_aaa-upch.ts': 'admin',
  '_aaa-uploader.ts': 'admin',
  '_aaa-upsw.ts': 'admin',
  '_aaaa-aai.ts': 'admin',
  '_pushkontak.ts': 'admin',
  'owner-agent-task.ts': 'admin',
  'owner-agent.ts': 'admin',
  'owner-banchat.ts': 'admin',
  'owner-banUser.ts': 'admin',
  'owner-broadcast.ts': 'admin',
  'owner-clearTmp.ts': 'admin',
  'owner-exec.ts': 'admin',
  'owner-exec2.ts': 'admin',
  'owner-getdb.ts': 'admin',
  'owner-getfile.ts': 'admin',
  'owner-resetUser.ts': 'admin',
  'owner-restart.ts': 'admin',
  'owner-unbanchat.ts': 'admin',
  'owner-unbanUser.ts': 'admin',
  'owner-update.ts': 'admin',
  '_shorturl.ts': 'admin',

  // DOWNLOADER
  'dl-fb.ts': 'downloader',
  'dl-gitclone.ts': 'downloader',
  'dl-ig.ts': 'downloader',
  'dl-mediafire.ts': 'downloader',
  'dl-mega.ts': 'downloader',
  'dl-play.ts': 'downloader',
  'dl-spotify_search.ts': 'downloader',
  'dl-spotify.ts': 'downloader',
  'dl-tiktok_douyin.ts': 'downloader',
  'dl-tiktok-seekin.ts': 'downloader',
  'dl-ytmp3.ts': 'downloader',
  'dl-ytmp4.ts': 'downloader',
  'dl-yts.ts': 'downloader',

  // ECONOMY
  'econ-add+delBal.ts': 'economy',
  'econ-balance.ts': 'economy',
  'econ-buy.ts': 'economy',
  'econ-crime.ts': 'economy',
  'econ-daily.ts': 'economy',
  'econ-dep.ts': 'economy',
  'econ-leaderboard.ts': 'economy',
  'econ-levelup.ts': 'economy',
  'econ-mine.ts': 'economy',
  'econ-resetBalance.ts': 'economy',
  'econ-resetCoin.ts': 'economy',
  'econ-resetDi.ts': 'economy',
  'econ-shop.ts': 'economy',
  'econ-transfer.ts': 'economy',
  'econ-wd.ts': 'economy',
  'econ-weekly.ts': 'economy',
  'econ-work.ts': 'economy',

  // GAME
  'game-dado.ts': 'game',
  'game-math_answer.ts': 'game',
  'game-math.ts': 'game',
  'game-ppt.ts': 'game',
  'game-roulette-info.ts': 'game',
  'game-roulette.ts': 'game',
  'game-slot.ts': 'game',

  // GROUP
  'gp-delete.ts': 'group',
  'gp-groupInfo.ts': 'group',
  'gp-hidetag.ts': 'group',
  'gp-kick.ts': 'group',
  'gp-kickprefix.ts': 'group',
  'gp-link.ts': 'group',
  'gp-num.ts': 'group',
  'gp-profile.ts': 'group',
  'gp-rules.ts': 'group',
  'gp-setbye.ts': 'group',
  'gp-setrules.ts': 'group',
  'gp-settings.ts': 'group',
  'gp-setwelcome.ts': 'group',
  'gp-simulate.ts': 'group',
  'gp-staff.ts': 'group',
  'gp-totag.ts': 'group',
  '_antilink.ts': 'group',
  'enable.ts': 'group',

  // FUN
  'fun-anonymous_chat.ts': 'fun',
  'fun-anonymous.ts': 'fun',
  'fun-menfess_ans.ts': 'fun',
  'fun-menfess.ts': 'fun',
  'fun-shipping.ts': 'fun',
  'fun-toptt.ts': 'fun',
  'quotes.ts': 'fun',

  // AI
  'ai-memory-context.ts': 'ai',
  'ai-memory-view.ts': 'ai',
  'ai-memory.ts': 'ai',
  'tools-brave-search.ts': 'ai',

  // STICKER
  'sticker-sticker.ts': 'sticker',
  'sticker-toimg.ts': 'sticker',
  'sticker-wm.ts': 'sticker',

  // TOOLS
  'tools-calculator.ts': 'tools',
  'tools-fakeReply.ts': 'tools',
  'tools-fetch.ts': 'tools',
  'tools-infoChannel.ts': 'tools',
  'tools-readviewonce.ts': 'tools',
  'tools-remini.ts': 'tools',
  'tools-script.ts': 'tools',
  'tools-ssweb.ts': 'tools',
  'tools-tts.ts': 'tools',
  '_surah.ts': 'tools',

  // MAIN
  '_menu.ts': 'main',
  'main-blocklist.ts': 'main',
  'main-botInfo.ts': 'main',
  'main-creator.ts': 'main',
  'main-donate.ts': 'main',
  'Main-menu-fix.ts': 'main',
  'main-ping.ts': 'main',
  'main-ping2.ts': 'main',
  'main-runtime.ts': 'main',
  'main-speedtest.ts': 'main',
  'main-support.ts': 'main',
  '_ranks.ts': 'main',
  '_idch.ts': 'main',

  // ABSEN
  'absen-absen.ts': 'absen',
  'absen-cek.ts': 'absen',
  'absen-hapus.ts': 'absen',
  'absen-start.ts': 'absen',

  // REGISTER
  'rg-register.ts': 'rg',
  'rg-sn.ts': 'rg',
  'rg-unreg.ts': 'rg',

  // SYSTEM
  '_antiBotClone.ts': 'system',
  '_autobackup.ts': 'system',
  '_autolevelup.ts': 'system',
  '_cmdWithMedia.ts': 'system',
  '_fakeReply.ts': 'system',
  '_getmsg.ts': 'system',
  '_template-plugin.ts': 'system',
  '_templateResponse.ts': 'system',
  'auto-heal-system.ts': 'system',
  'auto-restart-bot.ts': 'system',
  'cmd-del.ts': 'system',
  'cmd-list.ts': 'system',
  'cmd-set.ts': 'system',
  'health-check-endpoint.ts': 'system',
  'master-orchestrator.ts': 'system',
  'parallel-processor.ts': 'system',
  'rate-limit-protector.ts': 'system',
  'smart-cache-manager.ts': 'system',
};

function renameFile(oldPath: string, newPath: string): void {
  try {
    fs.renameSync(oldPath, newPath);
    console.log(`[OK] ${path.basename(oldPath)} -> ${path.relative(PLUGINS_DIR, newPath)}`);
  } catch (err) {
    console.error(`[FAIL] ${path.basename(oldPath)}: ${err}`);
  }
}

function main(): void {
  console.log('=== Reorganisasi Plugin ns-agent ===\n');

  let moved = 0;
  let skipped = 0;

  for (const [filename, category] of Object.entries(FILE_MAPPING)) {
    const oldPath = path.join(PLUGINS_DIR, filename);
    
    if (!fs.existsSync(oldPath)) {
      console.log(`[SKIP] ${filename} (tidak ditemukan)`);
      skipped++;
      continue;
    }

    // Handle file .js.ts -> rename jadi .ts
    let targetFilename = filename;
    if (filename.endsWith('.js.ts')) {
      targetFilename = filename.replace('.js.ts', '.ts');
    }

    const newPath = path.join(PLUGINS_DIR, category, targetFilename);
    
    // Pastikan folder tujuan ada
    const targetDir = path.dirname(newPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    renameFile(oldPath, newPath);
    moved++;
  }

  console.log(`\n=== Selesai ===`);
  console.log(`Dipindahkan: ${moved} file`);
  console.log(`Dilewati: ${skipped} file`);
  console.log('\nCatatan: File .js.ts sudah otomatis direname jadi .ts');
  console.log('Pastikan untuk mengecek import path di handler jika ada yang hardcoded.');
}

main();

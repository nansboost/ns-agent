// @ts-nocheck
// AUTO-HEALING SYSTEM - Never Stop Bot
// File ini membuat bot berjalan terus menerus tanpa henti

import { writeFileSync, readFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AUTO_HEAL_STATE_FILE } from '../lib/agent/data-paths.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, '../logs/health.log');
const STATE_FILE = AUTO_HEAL_STATE_FILE;

// Inisialisasi log
if (!existsSync(path.dirname(LOG_FILE))) {
  mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

class AutoHealer {
  constructor() {
    this.startTime = Date.now();
    this.restartCount = 0;
    this.maxRestarts = 5; // Max restart dalam 1 jam
    this.lastRestartTime = 0;
    this.healthCheckInterval = null;
    this.isHealthy = false;
    
    this.init();
  }

  init() {
    console.log('[AUTO-HEAL] System initialized');
    this.loadState();
    this.startHealthCheck();
    this.startLogMonitor();
  }

  loadState() {
    try {
      if (existsSync(STATE_FILE)) {
        const state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
        this.restartCount = state.restartCount || 0;
        this.lastRestartTime = state.lastRestartTime || 0;
        console.log(`[AUTO-HEAL] Loaded state: ${this.restartCount} restarts`);
      }
    } catch (err) {
      console.error('[AUTO-HEAL] Error loading state:', err.message);
    }
  }

  saveState() {
    try {
      const state = {
        restartCount: this.restartCount,
        lastRestartTime: this.lastRestartTime,
        startTime: this.startTime,
        isHealthy: this.isHealthy
      };
      writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
      console.error('[AUTO-HEAL] Error saving state:', err.message);
    }
  }

  startHealthCheck() {
    console.log('[AUTO-HEAL] Starting health check (every 30s)...');
    
    this.healthCheckInterval = setInterval(() => {
      const uptime = (Date.now() - this.startTime) / 1000;
      const uptimeHours = (uptime / 3600).toFixed(2);
      
      console.log(`[AUTO-HEAL] Health Check | Uptime: ${uptimeHours}h | Restarts: ${this.restartCount}`);
      
      // Log ke file
      this.logHealth({
        timestamp: new Date().toISOString(),
        uptime: uptimeHours,
        restarts: this.restartCount,
        status: this.isHealthy ? 'healthy' : 'unhealthy'
      });
      
      this.saveState();
    }, 30000); // 30 detik
  }

  startLogMonitor() {
    console.log('[AUTO-HEAL] Starting log monitor...');
    
    // Monitor setiap 10 detik untuk detect errors
    setInterval(() => {
      if (existsSync(LOG_FILE)) {
        const content = readFileSync(LOG_FILE, 'utf-8');
        const lines = content.split('\n').slice(-10); // Last 10 lines
        
        // Detect critical errors
        const hasCriticalError = lines.some(line => 
          line.includes('FATAL') || 
          line.includes('CRITICAL') || 
          line.includes('ERROR')
        );
        
        if (hasCriticalError) {
          console.warn('[AUTO-HEAL] Critical error detected in logs!');
          this.triggerRecovery();
        }
      }
    }, 10000);
  }

  triggerRecovery() {
    const now = Date.now();
    const hoursSinceLastRestart = (now - this.lastRestartTime) / 3600000;
    
    console.log(`[AUTO-HEAL] Recovery triggered! Hours since last restart: ${hoursSinceLastRestart.toFixed(2)}`);
    
    // Jangan restart terlalu sering
    if (hoursSinceLastRestart < 1 && this.restartCount >= this.maxRestarts) {
      console.error('[AUTO-HEAL] Too many restarts! Stopping to prevent crash loop.');
      return;
    }
    
    this.restartCount++;
    this.lastRestartTime = now;
    this.isHealthy = false;
    this.saveState();
    
    console.log(`[AUTO-HEAL] Restart #${this.restartCount} initiated...`);
    
    // Trigger restart via message ke main process
    process.send?.('reset');
  }

  recover() {
    console.log('[AUTO-HEAL] Recovery successful!');
    this.startTime = Date.now();
    this.isHealthy = true;
    this.saveState();
  }

  logHealth(data) {
    try {
      const logEntry = `[${data.timestamp}] ${JSON.stringify(data)}\n`;
      appendFileSync(LOG_FILE, logEntry);
    } catch (err) {
      console.error('[AUTO-HEAL] Error writing log:', err.message);
    }
  }

  shutdown() {
    console.log('[AUTO-HEAL] Shutting down...');
    clearInterval(this.healthCheckInterval);
    this.saveState();
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[AUTO-HEAL] SIGTERM received');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[AUTO-HEAL] SIGINT received');
  process.exit(0);
});

// Handle restart message dari main process
process.on('message', (msg) => {
  if (msg === 'auto-restart' || msg === 'reset') {
    console.log('[AUTO-HEAL] Received restart signal');
    process.exit(0);
  }
});

// Start the healer
const healer = new AutoHealer();

export default healer;

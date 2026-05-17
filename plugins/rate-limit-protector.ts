// @ts-nocheck
/**
 * RATE LIMIT PROTECTOR
 * Mencegah terlalu banyak request dalam waktu singkat
 */

class RateLimitProtector {
  constructor(windowMs = 60000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = [];
  }

  async checkAndAllow(actionName) {
    const now = Date.now();
    
    // Clean old requests outside window
    this.requests = this.requests.filter(
      time => now - time < this.windowMs
    );

    if (this.requests.length >= this.maxRequests) {
      const waitTime = this.windowMs - (now - this.requests[0]);
      console.warn(`⏳ Rate limit reached. Wait ${Math.ceil(waitTime/1000)}s`);
      await this._delay(waitTime);
    }

    this.requests.push(now);
    console.log(`✅ ${actionName} allowed (${this.requests.length}/${this.maxRequests})`);
    return true;
  }

  async _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getRemaining() {
    const now = Date.now();
    const recent = this.requests.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - recent.length);
  }

  reset() {
    this.requests = [];
    console.log('🔄 Rate limit reset');
  }
}

export default RateLimitProtector;

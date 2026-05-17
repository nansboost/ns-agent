// @ts-nocheck
/**
 * PARALLEL PROCESSOR
 * Jalankan multiple operations secara bersamaan
 */

class ParallelProcessor {
  constructor(maxConcurrency = 5) {
    this.maxConcurrency = maxConcurrency;
    this.activeTasks = 0;
    this.queue = [];
  }

  async process(tasks) {
    // Split tasks into batches
    const batches = this._chunkArray(tasks, this.maxConcurrency);
    const results = [];

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(task => this._executeTask(task))
      );
      
      results.push(...batchResults);
      this.activeTasks = 0;
      
      // Small delay between batches
      await this._delay(100);
    }

    return results;
  }

  async _executeTask(task) {
    this.activeTasks++;
    try {
      const result = await task.fn(task.params);
      return { success: true, result, task: task.name };
    } catch (error) {
      return { success: false, error: error.message, task: task.name };
    } finally {
      this.activeTasks--;
    }
  }

  _chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getActiveCount() {
    return this.activeTasks;
  }

  getQueueSize() {
    return this.queue.length;
  }

  clear() {
    this.queue = [];
    this.activeTasks = 0;
    console.log('🗑️ Parallel processor cleared');
  }
}

export default ParallelProcessor;

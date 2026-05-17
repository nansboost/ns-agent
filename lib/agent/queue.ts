// @ts-nocheck
const queues = new Map()
const stats = new Map()

function keyOf (scope = '') { return String(scope || 'global') }

export async function withAgentQueue (scope = 'global', fn) {
  const key = keyOf(scope)
  const current = stats.get(key) || { running: false, pending: 0, lastRunAt: '', lastDoneAt: '' }
  current.pending += 1
  stats.set(key, current)

  const previous = queues.get(key) || Promise.resolve()
  const run = previous.catch(() => {}).then(async () => {
    const info = stats.get(key) || current
    info.pending = Math.max(0, Number(info.pending || 1) - 1)
    info.running = true
    info.lastRunAt = new Date().toISOString()
    stats.set(key, info)
    try {
      return await fn()
    } finally {
      const done = stats.get(key) || info
      done.running = false
      done.lastDoneAt = new Date().toISOString()
      stats.set(key, done)
    }
  })
  queues.set(key, run.catch(() => {}))
  return run
}

export function getAgentQueueStatus () {
  return [...stats.entries()].map(([scope, item]) => ({ scope, ...item }))
}

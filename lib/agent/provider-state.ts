// @ts-nocheck
import fs from 'fs/promises'
import path from 'path'
import { AGENT_PROVIDER_FILE } from './data-paths.ts'

function nowIso () { return new Date().toISOString() }
function nowMs () { return Date.now() }
function statusFromError (error = {}) { return Number(error.status || error.response?.status || error.code || 0) }
function errorMessage (error = {}) {
  return String(error.message || error || 'unknown error').replace(/(sk-|nvapi-)[A-Za-z0-9_\-]{8,}/g, '$1***')
}
function retryAfterMsFromError (error = {}) {
  const headers = error.headers || error.response?.headers
  let raw = ''
  try {
    if (headers?.get) raw = headers.get('retry-after') || headers.get('Retry-After') || ''
    else raw = headers?.['retry-after'] || headers?.['Retry-After'] || ''
  } catch {}
  if (!raw) return 0
  const sec = Number(raw)
  if (Number.isFinite(sec)) return Math.max(0, sec * 1000)
  const ts = Date.parse(raw)
  return Number.isFinite(ts) ? Math.max(0, ts - nowMs()) : 0
}

async function readState () {
  try { return JSON.parse(await fs.readFile(AGENT_PROVIDER_FILE, 'utf8')) } catch { return {} }
}

async function writeState (state = {}) {
  await fs.mkdir(path.dirname(AGENT_PROVIDER_FILE), { recursive: true })
  const tmp = `${AGENT_PROVIDER_FILE}.tmp`
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8')
  await fs.rename(tmp, AGENT_PROVIDER_FILE)
}

function runtimeRoot (state = {}) {
  state.runtime = state.runtime && typeof state.runtime === 'object' ? state.runtime : {}
  state.runtime.providers = state.runtime.providers && typeof state.runtime.providers === 'object' ? state.runtime.providers : {}
  return state.runtime.providers
}

export async function getProviderRuntime (providerId = '') {
  const state = await readState()
  return runtimeRoot(state)[providerId] || {}
}

export async function getProviderKeyCursor (providerId = '') {
  const rt = await getProviderRuntime(providerId)
  return Math.max(0, Number(rt.keyCursor || 0))
}

export async function isProviderCoolingDown (providerId = '') {
  const rt = await getProviderRuntime(providerId)
  const until = Number(rt.cooldownUntil || 0)
  return {
    active: until > nowMs(),
    until,
    untilIso: until ? new Date(until).toISOString() : '',
    remainingMs: Math.max(0, until - nowMs()),
    reason: rt.cooldownReason || ''
  }
}

export async function markProviderSuccess (providerId = '') {
  const state = await readState()
  const providers = runtimeRoot(state)
  const rt = providers[providerId] || {}
  rt.lastSuccessAt = nowIso()
  rt.failureCount = 0
  rt.cooldownUntil = 0
  rt.cooldownReason = ''
  providers[providerId] = rt
  await writeState(state)
  return rt
}

export async function markProviderFailure (providerId = '', error = {}, provider = {}) {
  const state = await readState()
  const providers = runtimeRoot(state)
  const rt = providers[providerId] || {}
  const count = Number(rt.failureCount || 0) + 1
  const status = statusFromError(error)
  const retryAfter = retryAfterMsFromError(error)
  const base = Number(provider.providerCooldownBaseMs || provider.retryBaseDelayMs || 2000)
  const max = Number(provider.providerCooldownMaxMs || provider.retryMaxDelayMs || 120000)
  const fromCount = Math.min(max, base * Math.pow(2, Math.max(0, count - 1)))
  const cooldownMs = Math.max(retryAfter, status === 429 ? fromCount : Math.min(fromCount, 30000))
  const keyCount = [provider.apiKey, provider.key, provider.apiKeys, provider.keys].flat(Infinity).filter(Boolean).length || 1

  rt.failureCount = count
  rt.lastFailureAt = nowIso()
  rt.lastError = errorMessage(error)
  rt.lastStatus = status || ''
  rt.keyCursor = (Number(rt.keyCursor || 0) + 1) % Math.max(1, keyCount)
  rt.cooldownUntil = cooldownMs > 0 ? nowMs() + cooldownMs : 0
  rt.cooldownReason = status === 429 ? 'rate-limit/429' : 'temporary provider error'
  providers[providerId] = rt
  await writeState(state)
  return rt
}

export async function getProviderRuntimeSummary () {
  const state = await readState()
  const providers = runtimeRoot(state)
  const out = {}
  for (const [id, rt] of Object.entries(providers)) {
    const until = Number(rt.cooldownUntil || 0)
    out[id] = {
      ...rt,
      cooldownActive: until > nowMs(),
      cooldownRemainingMs: Math.max(0, until - nowMs()),
      cooldownUntilIso: until ? new Date(until).toISOString() : ''
    }
  }
  return out
}

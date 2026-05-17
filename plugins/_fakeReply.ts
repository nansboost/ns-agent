// @ts-nocheck
export async function before(m, { conn }) {
  // Text-only mode: nonaktifkan fake forwarded/ad reply global.
  global.fwc = {}
}

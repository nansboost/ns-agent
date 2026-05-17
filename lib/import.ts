// @ts-nocheck
import { pathToFileURL } from 'url'

export default async function importFile (file) {
  const url = String(file).startsWith('file:') ? String(file) : pathToFileURL(file).toString()
  const mod = await import(`${url}?update=${Date.now()}`)
  return mod?.default || mod
}

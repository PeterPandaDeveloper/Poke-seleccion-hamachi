import { CONFIG } from './config'

const store = new Map<string, number[]>()

export function checkRL(ip: string, accion: string, max: number): boolean {
  const clave = `${ip}:${accion}`
  const ahora = Date.now()
  const hits   = (store.get(clave) ?? []).filter(t => ahora - t < CONFIG.RATE_VENTANA_MS)
  if (hits.length >= max) return false
  hits.push(ahora)
  store.set(clave, hits)
  return true
}

setInterval(() => {
  const ahora = Date.now()
  for (const [k, ts] of store) {
    const vivos = ts.filter(t => ahora - t < CONFIG.RATE_VENTANA_MS)
    if (!vivos.length) store.delete(k); else store.set(k, vivos)
  }
}, CONFIG.RATE_VENTANA_MS)

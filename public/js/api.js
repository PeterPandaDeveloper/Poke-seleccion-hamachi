// Estado de conexión del cliente
export const estado = {
  miRol:   localStorage.getItem('rol') || '',
  miToken: localStorage.getItem('tok') || '',
  miNombre: localStorage.getItem('nombre') || '',
  salaId:  new URLSearchParams(location.search).get('sala') || localStorage.getItem('sala') || '',
}

export const API = () => estado.salaId ? `/api/sala/${estado.salaId}` : '/api'

export async function fetchEstado() {
  if (!estado.salaId) throw new Error('Sin salaId')
  const r = await fetch(`${API()}/estado`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export async function post(endpoint, body) {
  const r = await fetch(`${API()}${endpoint}`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({...body, token: estado.miToken})
  })
  const d = await r.json()
  if (!r.ok) throw Object.assign(new Error(d.error||'Error'), {status:r.status, data:d})
  return d
}

export async function get(endpoint) {
  const sep = endpoint.includes('?') ? '&' : '?'
  const r = await fetch(`${API()}${endpoint}${sep}token=${encodeURIComponent(estado.miToken)}`)
  const d = await r.json()
  if (!r.ok) throw Object.assign(new Error(d.error||'Error'), {status:r.status, data:d})
  return d
}

export function guardarSesion() {
  localStorage.setItem('rol',  estado.miRol)
  localStorage.setItem('tok',  estado.miToken)
  localStorage.setItem('sala', estado.salaId)
  // Actualizar URL con salaId sin recargar
  if (estado.salaId) {
    const u = new URL(location.href)
    u.searchParams.set('sala', estado.salaId)
    history.replaceState(null,'', u.toString())
  }
}

export function limpiarSesion() {
  estado.miRol = ''; estado.miToken = ''; estado.salaId = ''
  localStorage.removeItem('rol'); localStorage.removeItem('tok'); localStorage.removeItem('sala')
}

// ─── HEARTBEAT ────────────────────────────────────────────────────────────────
// Notifica al servidor cada 8s que el jugador sigue conectado.
// Si el jugador cierra la pestaña, el servidor lo marca como desconectado a los 20s.
let _heartbeatHandle = null

export function iniciarHeartbeat() {
  if (_heartbeatHandle) return
  _heartbeatHandle = setInterval(async () => {
    if (!estado.miToken || !estado.salaId || estado.miRol === 'espectador') return
    try {
      await fetch(`${API()}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: estado.miToken })
      })
    } catch {}
  }, 8_000)
}

export function detenerHeartbeat() {
  if (_heartbeatHandle) { clearInterval(_heartbeatHandle); _heartbeatHandle = null }
}

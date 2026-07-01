import { estado, fetchEstado, guardarSesion, limpiarSesion, iniciarHeartbeat, detenerHeartbeat } from './api.js'
import { Sonido }        from './sonido.js'
import { mostrarToast, mostrarInfo, cerrarInfo, mostrarTutorial, cerrarTutorial } from './modal.js'
import {
  construirTipos, onRolChange, toggleRegion, toggleTipo, syncRestr,
  leerVoto, etiquetaVoto, unirseAlLobby, votarConfig, votarConfigDelOtro, marcarListo,
  limpiarSala, copiarEnlace, crearNuevaSala, actualizarDisplaySala,
  actualizarLobbyUI, mostrarPasoLobby,
} from './lobby.js'
import {
  syncDraft, flashBatalla, resetarEstadoRender, resetear,
  enviarChat, enviarBuzz, copiarCodigo, copiarAmbos, abrirShowdown, renderChat,
} from './draft.js'

// ─── ESTADO GLOBAL DE PANTALLA ────────────────────────────────────────────────
let enDraft = false
let prevEstadoG = null

// ─── EXPONER AL HTML (onclick=) ───────────────────────────────────────────────
window.onRolChange     = onRolChange
window.toggleRegion    = toggleRegion
window.toggleTipo      = toggleTipo
window.syncRestr       = syncRestr
window.unirseAlLobby   = async (...args) => {
  await unirseAlLobby(...args)
  // Iniciar heartbeat tras unirse exitosamente
  if (estado.miToken && estado.miRol !== 'espectador') iniciarHeartbeat()
}
window.votarConfig     = votarConfig
window.votarConfigOtro = votarConfigDelOtro
window.marcarListo     = marcarListo
window.limpiarSala     = limpiarSala
window.copiarEnlace    = copiarEnlace
window.crearNuevaSala  = crearNuevaSala
window.mostrarInfo     = mostrarInfo
window.cerrarInfo      = cerrarInfo
window.mostrarTutorial = mostrarTutorial
window.cerrarTutorial  = cerrarTutorial
window.resetear        = async () => {
  detenerHeartbeat()
  await resetear()
  enDraft = false
  document.getElementById('pantalla-draft').style.display = 'none'
  document.getElementById('pantalla-lobby').style.display = 'block'
  mostrarPasoLobby()
  if (estado.miToken && estado.miRol !== 'espectador') iniciarHeartbeat()
}
window.copiarCodigo    = copiarCodigo
window.copiarAmbos     = copiarAmbos
window.abrirShowdown   = abrirShowdown
window.enviarChat      = enviarChat
window.enviarBuzz      = enviarBuzz
window.mantenerViva    = async () => {
  try {
    await fetch(`/api/sala/${estado.salaId}/keepalive`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({token:estado.miToken})
    })
    Sonido.click()
    mostrarToast('⏱ ¡Sala extendida por 5 minutos!', 'ok')
  } catch {}
}
window.liberarSlot     = async () => {
  if (!estado.miToken || estado.miRol === 'espectador') return
  if (!confirm('¿Dejar tu slot como jugador y pasar a espectador?')) return
  try {
    const r = await fetch(`/api/sala/${estado.salaId}/intercambiar`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({accion:'liberar', token: estado.miToken})
    })
    const d = await r.json()
    if (!r.ok) { mostrarToast('⚠️ '+d.error,'err'); return }
    estado.miToken = ''
    estado.miRol = 'espectador'
    mostrarToast('🚪 Slot liberado, ahora eres espectador','ok')
    Sonido.click()
  } catch(e) { mostrarToast('⚠️ Error al liberar slot','err') }
}
window.tomarSlot       = async (rol) => {
  if (!confirm(`¿Tomar el slot de ${rol==='jugador1'?'Jugador 1':'Jugador 2'}?`)) return
  try {
    const r = await fetch(`/api/sala/${estado.salaId}/intercambiar`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({accion:'tomar', rol, nombreEspectador: estado.miNombre || 'Espectador'})
    })
    const d = await r.json()
    if (!r.ok) { mostrarToast('⚠️ '+d.error,'err'); return }
    estado.miToken = d.token
    estado.miRol = d.rol
    localStorage.setItem('tok', d.token)
    localStorage.setItem('rol', d.rol)
    mostrarToast(`✅ Ahora eres ${d.rol==='jugador1'?'Jugador 1':'Jugador 2'}!`, 'ok')
    Sonido.seleccionar()
    // Iniciar heartbeat
    import('./api.js').then(m => m.iniciarHeartbeat())
  } catch(e) { mostrarToast('⚠️ Error al tomar slot','err') }
}
window.togglePrivada   = async () => {
  const priv = document.getElementById('chk-privada')?.checked
  try {
    await fetch(`/api/sala/${estado.salaId}/privada`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({token:estado.miToken, privada:priv})
    })
    Sonido.click()
    mostrarToast(priv ? '🔒 Sala privada' : '🌐 Sala pública', 'info')
  } catch {}
}

// ─── SELECTOR DE SALAS PÚBLICAS ───────────────────────────────────────────────
async function cargarSalasPublicas() {
  try {
    const r = await fetch('/api/salas')
    const lista = await r.json()
    const box = document.getElementById('salas-publicas')
    if (!box) return
    if (!lista.length) {
      box.innerHTML = '<p class="sin-salas">No hay salas públicas activas. ¡Crea una nueva!</p>'
      return
    }
    box.innerHTML = lista.map(s => `
      <button class="sala-item" onclick="window.unirseASala('${s.id}')">
        <span class="sala-item-id">${s.id}</span>
        <span class="sala-item-info">
          ${s.j1 ? `🔴 ${s.j1}` : '🔴 Libre'} · ${s.j2 ? `🟢 ${s.j2}` : '🟢 Libre'}
        </span>
        <span class="sala-fase fase-${s.fase}">${s.fase === 'lobby' ? 'En lobby' : s.fase === 'draft' ? 'Jugando' : 'Finalizada'}</span>
      </button>
    `).join('')
  } catch {}
}

window.unirseASala = (id) => {
  estado.salaId = id
  guardarSesion()
  actualizarDisplaySala()
  Sonido.click()
  mostrarToast(`Sala ${id} seleccionada. ¡Elige tu rol!`, 'ok')
}

// ─── MAIN LOOP ────────────────────────────────────────────────────────────────
async function actualizar() {
  try {
    if (!estado.salaId) return
    const est = await fetchEstado()
    prevEstadoG = est

    // Detectar notificaciones del otro jugador
    detectarCambios(est)

    if (est.fase === 'lobby') {
      if (enDraft) {
        // Volvimos al lobby (reset)
        enDraft = false
        document.getElementById('pantalla-draft').style.display = 'none'
        document.getElementById('pantalla-lobby').style.display = 'block'
        resetarEstadoRender()
        mostrarPasoLobby()
      }
      if (document.getElementById('paso-lobby').style.display !== 'none') {
        actualizarLobbyUI(est)
      }
      await renderChat(est)
    } else {
      if (!enDraft) {
        enDraft = true
        flashBatalla(() => {
          document.getElementById('pantalla-lobby').style.display = 'none'
          document.getElementById('pantalla-draft').style.display = 'block'
        })
      }
      await syncDraft(est)
    }

    // Indicador de conexión
    setConexion(true)
  } catch {
    setConexion(false)
  }
}

let _prevLobby = null
function detectarCambios(est) {
  if (!_prevLobby) { _prevLobby = JSON.stringify(est.lobby); return }
  const nuevo = JSON.stringify(est.lobby)
  if (nuevo === _prevLobby) return
  const prev = JSON.parse(_prevLobby)
  _prevLobby = nuevo

  // Otro jugador votó
  const otroRol = estado.miRol === 'jugador1' ? 'jugador2' : 'jugador1'
  const lOtro   = est.lobby[otroRol], pOtro = prev[otroRol]
  if (lOtro?.voto && !pOtro?.voto && otroRol !== estado.miRol) {
    Sonido.votoOtro()
    mostrarToast(`🗳 ${lOtro.nombre||otroRol} eligió su configuración`, 'info')
  }
  if (lOtro?.listo && !pOtro?.listo) {
    Sonido.listo()
    mostrarToast(`✅ ${lOtro.nombre||otroRol} está listo`, 'ok')
  }
}

function setConexion(ok) {
  const p = document.getElementById('conn-pill')
  if (!p) return
  p.textContent  = ok ? '🟢 Conectado' : '🔴 Sin conexión'
  p.className    = `conn-pill ${ok ? 'conn-ok' : 'conn-err'}`
}

// ─── INICIO ───────────────────────────────────────────────────────────────────
async function iniciar() {
  construirTipos()
  actualizarDisplaySala()

  // Mostrar tutorial si es la primera vez
  if (!localStorage.getItem('tutorial-visto')) {
    setTimeout(mostrarTutorial, 600)
  }

  // Cargar salas públicas mientras no hay salaId
  if (!estado.salaId) {
    await cargarSalasPublicas()
  }

  // Reconexión automática si hay token guardado
  if (estado.miToken && estado.salaId) {
    try {
      const r = await fetch(`/api/sala/${estado.salaId}/lobby/verificar`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({token: estado.miToken})
      })
      const d = await r.json()
      if (d.rol) {
        estado.miRol = d.rol
        guardarSesion()
        if (d.estado?.fase === 'lobby') {
          mostrarPasoLobby()
        } else {
          enDraft = true
          document.getElementById('pantalla-lobby').style.display = 'none'
          document.getElementById('pantalla-draft').style.display = 'block'
        }
      }
    } catch {}
  }

  // Iniciar heartbeat si ya tenemos sesión activa
  if (estado.miToken && estado.salaId && estado.miRol !== 'espectador') iniciarHeartbeat()

  // Loop principal: setTimeout recursivo (no setInterval)
  ;(async function loop() {
    try { await actualizar() } catch {}
    finally { setTimeout(loop, 1000) }
  })()

  // Enter en input de nombre
  document.getElementById('input-nombre')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') unirseAlLobby()
  })

  // Enter en chat (ambos inputs)
  ;['chat-input','chat-input-lobby'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarChat() }
    })
  })
}

window.onload = iniciar

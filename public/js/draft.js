import { resetLobbyEstado } from './lobby.js'
import { Sonido }   from './sonido.js'
import { estado, API, get, post, fetchEstado } from './api.js'
import { mostrarToast } from './modal.js'
import { fetchNombre, imgUrl, imgSprite } from './pokeapi.js'
import { TIMER_SEG } from './constantes.js'

// ─── ESTADO DE RENDER ────────────────────────────────────────────────────────
export let prevOps = [], prevTurno = '', prevRonda = -1, exportGen = false
export const rendJ1 = new Set(), rendJ2 = new Set()
let timerHandle = null, timerExpira = null, ultimoSeg = -1

// ─── TRANSICIÓN DE BATALLA ───────────────────────────────────────────────────
export function flashBatalla(cb) {
  const fl = document.getElementById('battle-flash')
  fl.classList.add('activo')
  Sonido.draftInicia()
  setTimeout(() => { cb(); setTimeout(() => fl.classList.remove('activo'), 80) }, 350)
}

// ─── SINCRONIZACIÓN PRINCIPAL ────────────────────────────────────────────────
export async function syncDraft(est) {
  // Nombres
  document.getElementById('nom-j1-draft').textContent = est.jugador1.nombre || 'Jugador 1'
  document.getElementById('nom-j2-draft').textContent = est.jugador2.nombre || 'Jugador 2'

  // Reglas activas en el encabezado
  const reglasPill = document.getElementById('reglas-pill')
  if (reglasPill && est.reglas) reglasPill.textContent = est.reglas

  // Espectadores
  const espN = est.lobby.espectadores || 0
  const ep   = document.getElementById('esp-pill')
  if (ep) { ep.style.display = espN > 0 ? 'inline-block' : 'none'; document.getElementById('esp-count-draft').textContent = espN }

  // Ronda
  if (est.rondaActual !== prevRonda) {
    document.getElementById('ronda-txt').textContent = `Ronda ${est.rondaActual} / 6`
    prevRonda = est.rondaActual
  }

  // Tag de asignación aleatoria
  const rtag = document.getElementById('random-tag')
  const yaRandom = rtag.style.display === 'block'
  rtag.style.display = est.ultimaEleccionRandom ? 'block' : 'none'
  if (est.ultimaEleccionRandom && !yaRandom) Sonido.timeout()

  // ── FIN ──────────────────────────────────────────────────────────────────
  if (est.turnoDe === 'FIN') {
    detenerTimer()
    document.getElementById('turno-alert').textContent = '¡Duelo finalizado!'
    document.getElementById('turno-alert').style.color = 'var(--text)'
    document.getElementById('timer-wrap').style.display = 'none'
    document.getElementById('opciones-render').innerHTML = ''
    if (!exportGen) {
      Sonido.finDraft()
      await generarExport(est)
      document.getElementById('sd-title-j1').textContent = est.jugador1.nombre || 'Jugador 1'
      document.getElementById('sd-title-j2').textContent = est.jugador2.nombre || 'Jugador 2'
      document.getElementById('showdown-box').style.display = 'block'
      exportGen = true
    }
    await renderEquipos(est)
    return
  }

  document.getElementById('showdown-box').style.display = 'none'
  exportGen = false

  if (est.rondaActual > 0) {
    // ── TURNO ──────────────────────────────────────────────────────────────
    if (est.turnoDe !== prevTurno || !arrEq(est.opcionesActuales, prevOps)) {
      const cambio = est.turnoDe !== prevTurno
      prevTurno = est.turnoDe
      const esYo   = est.turnoDe === estado.miRol
      const nomT   = est[est.turnoDe]?.nombre || (est.turnoDe === 'jugador1' ? 'Jugador 1' : 'Jugador 2')
      const ta     = document.getElementById('turno-alert')
      ta.textContent = esYo ? `¡Tu turno, ${nomT}!` : `Turno de ${nomT}...`
      ta.style.color = esYo ? 'var(--yellow-lt)' : 'var(--green-lt)'
      ta.classList.remove('pulso'); void ta.offsetWidth; ta.classList.add('pulso')
      if (cambio) esYo ? Sonido.miTurno() : Sonido.esperando()
    }

    // Timer
    if (est.timerExpira) sincronizarTimer(est.timerExpira)

    // Cartas
    if (!arrEq(est.opcionesActuales, prevOps)) {
      await renderCartas(est)
      prevOps = [...est.opcionesActuales]
    }
  }

  await renderEquipos(est)
  await renderChat(est)
}

// ─── TIMER ───────────────────────────────────────────────────────────────────
function sincronizarTimer(exp) {
  if (timerExpira !== exp) ultimoSeg = -1
  timerExpira = exp
  document.getElementById('timer-wrap').style.display = 'flex'
  actualizarTimer()
  if (!timerHandle) timerHandle = setInterval(actualizarTimer, 100)
}

function detenerTimer() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null }
  document.getElementById('timer-wrap').style.display = 'none'
}

function actualizarTimer() {
  if (!timerExpira) return
  const ms  = timerExpira - Date.now()
  const seg = Math.max(0, ms / TIMER_SEG / 100)  // fracción 0-1
  const ring = document.getElementById('ring-fg')
  if (ring) ring.style.strokeDashoffset = 213.6 * (1 - Math.max(0, ms / (TIMER_SEG * 1000)))
  const s   = Math.ceil(Math.max(0, ms / 1000))
  const num = document.getElementById('timer-num')
  if (num) {
    if (s !== ultimoSeg && s <= 5 && s >= 1) { Sonido.timerTick(s <= 3); ultimoSeg = s }
    else if (s > 5) ultimoSeg = s
    num.textContent = s
    num.style.color = s <= 3 ? 'var(--red-lt)' : s <= 6 ? 'var(--yellow-lt)' : 'var(--text)'
    if (ring) ring.style.stroke = s <= 3 ? '#e84040' : s <= 6 ? '#d4a017' : '#3cb878'
  }
  if (ms <= 0) detenerTimer()
}

// ─── CARTAS ───────────────────────────────────────────────────────────────────
async function renderCartas(est) {
  const esYo = est.turnoDe === estado.miRol
  const c    = document.getElementById('opciones-render')
  c.innerHTML = ''
  for (const id of est.opcionesActuales) {
    const nom = await fetchNombre(id)
    const div = document.createElement('div')
    div.className = 'poke-card' + (!esYo ? ' card-disabled' : '')
    div.onclick   = () => intentarElegir(id)
    if (esYo) div.addEventListener('mouseenter', () => Sonido.hover())
    // Imagen oficial con fallback a sprite
    const artwork = imgUrl(id)
    const sprite  = imgSprite(id)
    div.innerHTML = `
      <img src="${artwork}" alt="${nom}" loading="eager"
           onerror="this.src='${sprite}'"
           style="width:118px;height:118px;object-fit:contain;display:block;margin:0 auto;transition:transform .22s">
      <div class="poke-name">${nom}</div>`
    c.appendChild(div)
    // Precargar
    const img = new Image(); img.src = artwork
  }
}

// ─── EQUIPOS ─────────────────────────────────────────────────────────────────
async function renderEquipos(est) {
  const g1 = document.getElementById('equipo-j1')
  const g2 = document.getElementById('equipo-j2')
  for (const id of est.jugador1.equipo) {
    if (!rendJ1.has(id)) { g1.appendChild(await crearMini(id,'slide-in-right')); rendJ1.add(id) }
  }
  for (const id of est.jugador2.equipo) {
    if (!rendJ2.has(id)) { g2.appendChild(await crearMini(id,'slide-in-left'));  rendJ2.add(id) }
  }
}

async function crearMini(id, anim) {
  const nom  = await fetchNombre(id)
  const div  = document.createElement('div')
  div.className = 'mini-poke ' + anim
  const artwork = imgUrl(id)
  const sprite  = imgSprite(id)
  div.innerHTML = `<img src="${artwork}" alt="${nom}" loading="lazy"
    onerror="this.src='${sprite}'" style="width:52px;height:52px;object-fit:contain">
    <p>${nom}</p>`
  return div
}

// ─── CHAT ────────────────────────────────────────────────────────────────────
let ultimoChatSig = ''

export async function renderChat(est) {
  const chat = est.chat || []
  const sig = chat.map(m => m.id).join(',')
  if (sig === ultimoChatSig) return
  ultimoChatSig = sig

  const boxes = [
    document.getElementById('chat-mensajes'),
    document.getElementById('chat-mensajes-lobby'),
  ].filter(Boolean)
  if (!boxes.length) return

  const html = chat.length ? chat.map(m => {
    const cls = m.rol === 'sistema' ? 'chat-sistema' : m.rol === 'jugador1' ? 'chat-j1' : 'chat-j2'
    const ts  = new Date(m.ts).toLocaleTimeString('es', {hour:'2-digit',minute:'2-digit'})
    return `<div class="chat-msg ${cls}">
      <span class="chat-autor">${m.rol==='sistema'?'':'['+m.autor+'] '}</span>
      <span class="chat-texto">${escHTML(m.texto)}</span>
      <span class="chat-ts">${ts}</span>
    </div>`
  }).join('') : ''

  boxes.forEach(box => { box.innerHTML = html; box.scrollTop = box.scrollHeight })

  const ultimo = chat[chat.length - 1]
  if (ultimo && ultimo.rol !== estado.miRol && ultimo.rol !== 'sistema') Sonido.chat()
  if (ultimo?.rol === 'sistema' && ultimo.texto.includes('🔔')) Sonido.buzz()
}

function escHTML(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

export async function enviarChat() {
  // Leer del input activo (lobby o draft, el que tenga foco o valor)
  const inputDraft = document.getElementById('chat-input')
  const inputLobby = document.getElementById('chat-input-lobby')
  const input = (document.activeElement === inputLobby ? inputLobby : null)
             || (document.activeElement === inputDraft ? inputDraft : null)
             || inputDraft || inputLobby
  const texto = input?.value.trim()
  if (!texto) return
  if (input) input.value = ''
  try {
    await post('/chat', {texto})
    ultimoChatSig = ''
    const est = await fetchEstado()
    await renderChat(est)
  } catch(e) { mostrarToast('⚠️ '+e.message,'err') }
}

export async function enviarBuzz() {
  try {
    await post('/buzz', {})
    mostrarToast('🔔 Aviso enviado','ok')
    Sonido.buzz()
    // Deshabilitar todos los botones de buzz 8s
    const btn = document.getElementById('btn-buzz')
    const btnL = document.getElementById('btn-buzz-lobby')
    if (btn)  btn.disabled = true
    if (btnL) btnL.disabled = true
    if (btn) {
      btn.disabled = true
      let s = 8
      const iv = setInterval(() => {
        s--
        if (btn)  btn.textContent  = `🔔 ${s}s`
        if (btnL) btnL.textContent = `🔔 ${s}s`
        if (s <= 0) {
          clearInterval(iv)
          if (btn)  { btn.disabled=false;  btn.textContent='🔔 Avisar' }
          if (btnL) { btnL.disabled=false; btnL.textContent='🔔 Avisar' }
        }
      }, 1000)
    }
  } catch(e) { mostrarToast('⚠️ '+e.message,'err') }
}

// ─── ELECCIÓN ────────────────────────────────────────────────────────────────
export async function intentarElegir(id) {
  if (!estado.miRol || estado.miRol === 'espectador') return
  Sonido.seleccionar()
  try {
    await get(`/elegir/${estado.miRol}/${id}`)
    prevOps = []
  } catch(e) { Sonido.error(); mostrarToast('⚠️ '+e.message,'err') }
}

// ─── EXPORTAR ────────────────────────────────────────────────────────────────
async function generarExport(est) {
  document.getElementById('sd-j1').value = await fmtEquipo(est.jugador1.equipo)
  document.getElementById('sd-j2').value = await fmtEquipo(est.jugador2.equipo)
}

async function fmtEquipo(equipo) {
  const lines = await Promise.all(equipo.map(async id => {
    const nom = await fetchNombre(id)
    const cap = nom.charAt(0).toUpperCase() + nom.slice(1)
    return `${cap}\nAbility: No Guard\nEVs: 252 HP / 252 Atk / 4 SpD\n- Tackle\n`
  }))
  return lines.join('\n')
}

export function copiarCodigo(idEl, btn) {
  const v = document.getElementById(idEl)?.value
  if (!v?.trim()) return
  navigator.clipboard.writeText(v).then(() => {
    Sonido.copiar()
    const orig = btn.innerHTML; btn.innerHTML='✅ Copiado'; btn.classList.add('copy-ok')
    setTimeout(()=>{ btn.innerHTML=orig; btn.classList.remove('copy-ok') },2000)
  })
}

export async function copiarAmbos(btn) {
  const j1 = document.getElementById('sd-j1')?.value
  const j2 = document.getElementById('sd-j2')?.value
  if (!j1||!j2) return
  await navigator.clipboard.writeText(`=== J1 ===\n\n${j1}\n=== J2 ===\n\n${j2}`)
  Sonido.copiar()
  btn.textContent='✅ Copiados'; btn.classList.add('copy-ok')
  setTimeout(()=>{ btn.textContent='📋 Copiar ambos equipos'; btn.classList.remove('copy-ok') },2000)
}

export function abrirShowdown(idEl) {
  const txt = document.getElementById(idEl)?.value?.trim()
  if (!txt) return
  window.open(`https://play.pokemonshowdown.com/teambuilder#${encodeURIComponent(txt)}`, '_blank','noopener,noreferrer')
  Sonido.copiar()
  mostrarToast('🎮 Showdown abierto en nueva pestaña','ok')
}

export async function resetear() {
  if (!confirm('¿Reiniciar el duelo completo?')) return
  Sonido.limpiar()
  try { await get('/reset') } catch {}
  resetarEstadoRender()
}

export function resetarEstadoRender() {
  prevOps=[]; prevTurno=''; prevRonda=-1; exportGen=false
  rendJ1.clear(); rendJ2.clear(); ultimoChatSig=''
  detenerTimer()
  resetLobbyEstado()
  document.getElementById('equipo-j1').innerHTML=''
  document.getElementById('equipo-j2').innerHTML=''
  document.getElementById('opciones-render').innerHTML=''
  document.getElementById('showdown-box').style.display='none'
  document.getElementById('chat-mensajes').innerHTML=''
  document.getElementById('chat-mensajes-lobby').innerHTML=''
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
export function arrEq(a,b){ return a.length===b.length&&a.every((v,i)=>v===b[i]) }

import { TIPOS, TIPO_COLOR, TIPO_EN, RANGOS, FORMAS_REGIONALES, LEGENDARIOS } from './constantes.js'
import { Sonido }  from './sonido.js'
import { estado, API, post, guardarSesion, fetchEstado } from './api.js'
import { mostrarInfo, mostrarToast } from './modal.js'
import { precargaBatch, evoCache, typeCache, bstCache } from './pokeapi.js'
import { renderChat } from './draft.js'

// ─── ESTADO LOCAL DE CONFIG ───────────────────────────────────────────────────
export let regionesSel  = new Set(['todas'])
export let tiposSel     = new Set()
export let yaVote       = false
export let yaListo      = false
export let cooldownLimpiar = false

// ─── BUILD UI ─────────────────────────────────────────────────────────────────
export function construirTipos() {
  document.getElementById('tipo-grid').innerHTML = TIPOS.map(t =>
    `<button class="tbtn" data-t="${t}" style="--tc:${TIPO_COLOR[t]}" onclick="window.toggleTipo(this)">${t}</button>`
  ).join('')
}

export function onRolChange() {
  const r = document.getElementById('rol-selector').value
  document.getElementById('fila-nombre').style.display = r==='espectador'?'none':'flex'
  document.getElementById('fila-nombre-esp').style.display = r==='espectador'?'flex':'none'
  document.getElementById('paso-titulo').textContent   = r==='espectador'?'Entrar como espectador':'¿Quién eres?'
  document.getElementById('btn-unirse').textContent    = r==='espectador'?'Entrar a mirar':'Entrar'
}

export function toggleRegion(btn) {
  const r = btn.dataset.r; Sonido.click()
  if (r==='todas') {
    regionesSel.clear(); regionesSel.add('todas')
    document.querySelectorAll('.rbtn').forEach(b=>b.classList.toggle('active',b.dataset.r==='todas'))
  } else {
    if (regionesSel.has(r)) {
      regionesSel.delete(r); btn.classList.remove('active')
      if (!regionesSel.size) { regionesSel.add('todas'); document.querySelector('.rbtn[data-r="todas"]').classList.add('active') }
    } else {
      regionesSel.add(r); btn.classList.add('active')
      if (regionesSel.has('todas')) { regionesSel.delete('todas'); document.querySelector('.rbtn[data-r="todas"]').classList.remove('active') }
    }
  }
  document.getElementById('hint-regiones').textContent =
    regionesSel.has('todas') ? 'Selección: todas' : 'Selección: '+[...regionesSel].join(', ')
}

export function toggleTipo(btn) {
  const t=btn.dataset.t
  tiposSel.has(t)?(tiposSel.delete(t),btn.classList.remove('active')):(tiposSel.add(t),btn.classList.add('active'))
  document.getElementById('modo-tipos-row').style.display = tiposSel.size>1?'flex':'none'
  Sonido.click()
}

export function syncRestr(el) {
  const ids=['chk-finales','chk-sinevo','chk-base','chk-copabebe']
  const activos = ids.filter(id=>document.getElementById(id)?.checked)
  if (activos.length>1) {
    ids.forEach(id=>{ if (id!==el.id) { const x=document.getElementById(id); if(x) x.checked=false } })
    document.getElementById('warn-evolucion').style.display='block'
    setTimeout(()=>document.getElementById('warn-evolucion').style.display='none',3000)
  } else {
    document.getElementById('warn-evolucion').style.display='none'
  }
  Sonido.click()
}

export function leerVoto() {
  const modoEl = document.querySelector('input[name="modoTipos"]:checked')
  return {
    regiones: [...regionesSel], tipos: [...tiposSel],
    modoTipos: modoEl?.value||'OR',
    sinLegendarios:   !!document.getElementById('chk-sin-leg')?.checked,
    soloFinales:      !!document.getElementById('chk-finales')?.checked,
    soloSinEvolucion: !!document.getElementById('chk-sinevo')?.checked,
    soloBase:         !!document.getElementById('chk-base')?.checked,
    copaBebe:         !!document.getElementById('chk-copabebe')?.checked,
    noDuplicadosTipo: !!document.getElementById('chk-nodup')?.checked,
    maxBST: document.getElementById('bst-max')?.value ? parseInt(document.getElementById('bst-max').value) : null,
    minBST: document.getElementById('bst-min')?.value ? parseInt(document.getElementById('bst-min').value) : null,
  }
}

export function etiquetaVoto(v) {
  if (!v) return 'Sin voto'
  const p=[]
  if (v.regiones&&!v.regiones.includes('todas')) p.push('📍 Regiones: '+v.regiones.join(', '))
  if (v.tipos?.length) {
    const modo = v.modoTipos==='AND' ? 'todos estos tipos' : 'cualquiera de estos tipos'
    p.push('⚔️ Tipos: '+v.tipos.join(', ')+' ('+modo+')')
  }
  if (v.sinLegendarios)   p.push('🚫 Sin legendarios')
  if (v.soloFinales)      p.push('⬆️ Solo evolucionados al máximo')
  if (v.soloSinEvolucion) p.push('⛔ Sin evolución posible')
  if (v.soloBase)         p.push('🐣 Solo primera etapa')
  if (v.copaBebe)         p.push('🍼 Copa Bebé (bebés con futuro)')
  if (v.noDuplicadosTipo) p.push('🔄 Tipos únicos en equipo')
  if (v.minBST) p.push('📊 BST mínimo: '+v.minBST)
  if (v.maxBST) p.push('📊 BST máximo: '+v.maxBST)
  return p.length ? p.join(' · ') : '🎯 Sin restricciones'
}

const CONFIG_CTRLS = '.config-panel input, .config-panel select, .rbtn, .tbtn, .tog input, .bst-input, .btn-votar, .btn-votar-j2'

/** Aplica un voto del servidor a los botones/checkboxes de la UI. */
export function aplicarVotoEnUI(v) {
  if (!v) return

  regionesSel = new Set(v.regiones?.length ? v.regiones : ['todas'])
  document.querySelectorAll('.rbtn').forEach(b => {
    b.classList.toggle('active', regionesSel.has(b.dataset.r))
  })
  document.getElementById('hint-regiones').textContent =
    regionesSel.has('todas') ? 'Selección: todas' : 'Selección: '+[...regionesSel].join(', ')

  tiposSel = new Set(v.tipos || [])
  document.querySelectorAll('.tbtn').forEach(b => {
    b.classList.toggle('active', tiposSel.has(b.dataset.t))
  })
  document.getElementById('modo-tipos-row').style.display = tiposSel.size > 1 ? 'flex' : 'none'

  const modo = v.modoTipos || 'OR'
  document.querySelectorAll('input[name="modoTipos"]').forEach(r => { r.checked = r.value === modo })

  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val }
  setChk('chk-sin-leg', v.sinLegendarios)
  setChk('chk-finales', v.soloFinales)
  setChk('chk-sinevo', v.soloSinEvolucion)
  setChk('chk-base', v.soloBase)
  setChk('chk-copabebe', v.copaBebe)
  setChk('chk-nodup', v.noDuplicadosTipo)

  const bstMin = document.getElementById('bst-min')
  const bstMax = document.getElementById('bst-max')
  if (bstMin) bstMin.value = v.minBST ?? ''
  if (bstMax) bstMax.value = v.maxBST ?? ''
}

function bloquearConfig() {
  document.querySelectorAll(CONFIG_CTRLS).forEach(el => {
    el.disabled = true
    el.style.opacity = '0.5'
    el.style.cursor = 'not-allowed'
  })
  const btnVotar = document.getElementById('cfg-acciones')?.querySelector('.btn-votar')
  if (btnVotar) btnVotar.textContent = '🔒 Config. bloqueada'
}

export function desbloquearConfig() {
  document.querySelectorAll(CONFIG_CTRLS).forEach(el => {
    el.disabled = false
    el.removeAttribute('disabled')
    el.style.opacity = ''
    el.style.cursor = ''
  })
  const btnVotar = document.querySelector('.btn-votar')
  if (btnVotar) btnVotar.textContent = '🗳 Votar mi configuración'
  const btnListo = document.getElementById('btn-listo')
  if (btnListo) { btnListo.style.display = 'none'; btnListo.textContent = '¡Listo para el duelo!'; btnListo.disabled = false }
}

// ─── ACCIONES ─────────────────────────────────────────────────────────────────
export async function unirseAlLobby() {
  const rol    = document.getElementById('rol-selector').value
  const nombre = document.getElementById('input-nombre')?.value.trim()
  if (rol==='espectador') {
    const nomEsp = document.getElementById('input-nombre-esp')?.value.trim() || 'Espectador'
    estado.miRol='espectador'; estado.miToken=''; estado.miNombre=nomEsp
    try {
      await fetch(`${API()}/espectador/unirse`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:nomEsp})})
    } catch {}
    window.addEventListener('beforeunload',()=>navigator.sendBeacon(`${API()}/espectador/salir`,JSON.stringify({nombre:nomEsp})))
    Sonido.click(); mostrarPasoLobby(); return
  }
  if (!nombre) { Sonido.error(); mostrarToast('⚠️ Escribe tu nombre.','err'); return }
  try {
    const d = await post('/lobby/unirse',{rol,nombre,token:estado.miToken||''})
    estado.miRol=rol; estado.miToken=d.token; estado.salaId=d.salaId||estado.salaId
    guardarSesion(); Sonido.seleccionar(); mostrarPasoLobby()
  } catch(e) { Sonido.error(); mostrarToast('⚠️ '+e.message,'err') }
}

export async function votarConfig() {
  if (yaListo) { mostrarToast('Ya confirmaste tu configuración.','err'); return }
  const voto = leerVoto()
  try {
    await post('/lobby/votar', { voto })
    Sonido.votar(); yaVote = true
    document.querySelector('.btn-votar').textContent = '✏️ Cambiar mi voto'
    document.getElementById('btn-listo').style.display = 'inline-block'
    mostrarToast('✅ Voto registrado','ok')
  } catch(e) { Sonido.error(); mostrarToast('⚠️ '+e.message,'err') }
}

export async function votarConfigDelOtro() {
  if (yaListo) { mostrarToast('Ya confirmaste tu configuración.','err'); return }
  const otroRol = estado.miRol === 'jugador1' ? 'jugador2' : 'jugador1'
  try {
    const est = await fetchEstado()
    const votoOtro = est.lobby?.[otroRol]?.voto
    if (!votoOtro) {
      Sonido.error()
      mostrarToast('⚠️ El otro jugador aún no ha votado.','err')
      return
    }
    aplicarVotoEnUI(votoOtro)
    const voto = leerVoto()
    await post('/lobby/votar', { voto })
    Sonido.votar(); yaVote = true
    document.querySelector('.btn-votar').textContent = '✏️ Cambiar mi voto'
    document.getElementById('btn-listo').style.display = 'inline-block'
    mostrarToast('✅ Configuración del rival copiada y votada','ok')
  } catch(e) { Sonido.error(); mostrarToast('⚠️ '+e.message,'err') }
}

export async function marcarListo() {
  if (!yaVote) { Sonido.error(); mostrarToast('Primero elige una configuración.','err'); return }
  if (yaListo) return
  document.getElementById('msg-pool').style.display='flex'
  document.getElementById('btn-listo').disabled=true
  try {
    const ids = await construirPool(leerVoto())
    document.getElementById('msg-pool').style.display='none'
    if (ids.length<12) {
      Sonido.error(); mostrarToast(`Solo ${ids.length} Pokémon disponibles. Ajusta los filtros.`,'err')
      document.getElementById('btn-listo').disabled=false; return
    }
    await post('/lobby/listo',{idsValidos:ids})
    Sonido.listo(); yaListo=true
    document.getElementById('btn-listo').textContent='⌛ Esperando al otro jugador...'
    // Bloquear controles de config
    bloquearConfig()
    mostrarToast('✅ ¡Listo! Esperando al otro jugador.','ok')
  } catch(e) {
    document.getElementById('msg-pool').style.display='none'
    Sonido.error(); mostrarToast('⚠️ '+e.message,'err')
    document.getElementById('btn-listo').disabled=false
  }
}

export async function limpiarSala() {
  if (cooldownLimpiar) return
  if (!confirm('¿Borrar todas las selecciones y empezar de nuevo?')) return
  try {
    await post('/lobby/limpiar',{})
    Sonido.limpiar(); cooldownLimpiar=true
    resetLobbyEstado()
    const btn = document.querySelector('.btn-limpiar')
    if (btn) { btn.disabled=true }
    let seg=12
    const iv=setInterval(()=>{
      seg--
      const msg=document.getElementById('cooldown-msg')
      if (seg<=0) {
        clearInterval(iv); cooldownLimpiar=false
        if (btn) { btn.disabled=false; btn.textContent='🧹 Borrar selecciones' }
        if (msg) msg.style.display='none'
      } else {
        if (msg) { msg.style.display='block'; msg.textContent=`Puedes limpiar en ${seg}s` }
        if (btn) btn.textContent=`⌛ ${seg}s...`
      }
    },1000)
    mostrarToast('🧹 Sala limpiada','ok')
  } catch(e) { Sonido.error(); mostrarToast('⚠️ '+e.message,'err') }
}

export async function copiarEnlace() {
  // Leer salaId ACTUAL del estado (no del localStorage anterior)
  const enlace = `${location.origin}${location.pathname}?sala=${estado.salaId}`
  try {
    await navigator.clipboard.writeText(enlace)
    Sonido.copiar(); mostrarToast('🔗 Enlace copiado: '+enlace,'ok',4000)
  } catch {
    mostrarToast('Enlace: '+enlace,'info',7000)
  }
}

export async function crearNuevaSala() {
  try {
    const r   = await fetch('/api/sala/crear',{method:'POST'})
    const d   = await r.json()
    if (!r.ok) { mostrarToast('⚠️ '+d.error,'err'); return }
    estado.salaId = d.salaId
    guardarSesion()
    // Resetear estado local del lobby
    yaVote=false; yaListo=false
    actualizarDisplaySala()
    Sonido.seleccionar()
    // Copiar nuevo enlace al portapapeles inmediatamente
    await copiarEnlace()
  } catch(e) { Sonido.error(); mostrarToast('⚠️ Error creando sala','err') }
}

export function actualizarDisplaySala() {
  const el=document.getElementById('sala-id-display')
  if (el) el.textContent=estado.salaId||'—'
}

// ─── POOL DE POKÉMON ─────────────────────────────────────────────────────────
export async function construirPool(v) {
  const idSet=new Set()
  for (const reg of v.regiones) {
    const [mn,mx]=RANGOS[reg]||[1,1025]
    for (let i=mn;i<=mx;i++) idSet.add(i);
    (FORMAS_REGIONALES[reg]||[]).forEach(id=>idSet.add(id))
  }
  let ids=[...idSet].sort((a,b)=>a-b)
  if (v.sinLegendarios) ids=ids.filter(id=>!LEGENDARIOS.has(id))
  
  // Si solo hay filtros básicos (sin evolución), no necesitamos API
  const necesitaAPI=v.soloFinales||v.soloSinEvolucion||v.soloBase||v.copaBebe||v.tipos.length>0||v.maxBST||v.minBST
  
  if (necesitaAPI) {
    // Para Copa Bebé, limitar a 200 Pokémon aleatorios del pool para evitar timeouts
    if (v.copaBebe && ids.length > 200) {
      // Mezclar y tomar 200 aleatorios
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]]
      }
      ids = ids.slice(0, 200)
    }
    
    await precargaBatch(ids)
    if (v.soloFinales)      ids=ids.filter(id=>evoCache.get(id)?.esFinal===true)
    if (v.soloSinEvolucion) ids=ids.filter(id=>evoCache.get(id)?.sinEvo===true)
    if (v.soloBase)         ids=ids.filter(id=>evoCache.get(id)?.esBase===true)
    // Copa Bebé: primera etapa + cadena de 2+ evoluciones + no legendario
    if (v.copaBebe)         ids=ids.filter(id=>evoCache.get(id)?.esBase===true&&evoCache.get(id)?.copaBebe===true&&!LEGENDARIOS.has(id))
    if (v.tipos.length) {
      const te=v.tipos.map(t=>TIPO_EN[t]).filter(Boolean)
      ids=v.modoTipos==='AND'?ids.filter(id=>te.every(t=>typeCache.get(id)?.includes(t))):ids.filter(id=>te.some(t=>typeCache.get(id)?.includes(t)))
    }
    if (v.minBST) ids=ids.filter(id=>(bstCache.get(id)||0)>=v.minBST)
    if (v.maxBST) ids=ids.filter(id=>(bstCache.get(id)||9999)<=v.maxBST)
  }
  return ids
}

export function mostrarPasoLobby() {
  document.getElementById('paso-nombre').style.display='none'
  document.getElementById('paso-lobby').style.display='block'
  const esJugador=estado.miRol==='jugador1'||estado.miRol==='jugador2'
  document.getElementById('panel-limpiar').style.display=esJugador?'block':'none'
  document.getElementById('btn-votar-j2').style.display=esJugador?'inline-block':'none'
  if (estado.miRol==='espectador') {
    document.getElementById('cfg-acciones').style.display='none'
    const cp=document.getElementById('config-panel-wrap')
    if (cp) { cp.style.opacity='0.55'; cp.style.pointerEvents='none' }
  }
}

export function actualizarLobbyUI(est) {
  const lj1=est.lobby.jugador1, lj2=est.lobby.jugador2

  // Sincronizar estado local con el servidor (desbloquear tras reset/limpiar)
  if (estado.miRol === 'jugador1' || estado.miRol === 'jugador2') {
    const mi = est.lobby[estado.miRol]
    yaVote = !!mi.voto
    yaListo = !!mi.listo
    if (mi.bloqueado) bloquearConfig()
    else desbloquearConfig()
    if (yaVote && !mi.bloqueado) {
      const btnVotar = document.querySelector('.btn-votar')
      if (btnVotar) btnVotar.textContent = '✏️ Cambiar mi voto'
      const btnListo = document.getElementById('btn-listo')
      if (btnListo) btnListo.style.display = 'inline-block'
    }
    if (yaListo && mi.bloqueado) {
      const btnListo = document.getElementById('btn-listo')
      if (btnListo) { btnListo.textContent = '⌛ Esperando al otro jugador...'; btnListo.disabled = true }
    }
  }

  document.getElementById('nom-j1-lobby').textContent=lj1.nombre||'Esperando...'
  document.getElementById('nom-j2-lobby').textContent=lj2.nombre||'Esperando...'
  const ico=lj=>(lj.listo?'✅ Listo':lj.voto?'🗳 Votó':lj.nombre?'🟡 En sala':'—')
  document.getElementById('est-j1-lobby').textContent=ico(lj1)
  document.getElementById('est-j2-lobby').textContent=ico(lj2)
  const espN=est.lobby.espectadores||0
  const eb=document.getElementById('esp-badge')
  if (eb) { eb.style.display=espN>0?'block':'none'; document.getElementById('esp-count').textContent=espN }
  if (lj1.voto||lj2.voto) {
    document.getElementById('votos-display').style.display='block'
    document.getElementById('voto-j1-disp').innerHTML=`<span class="vn j1-color">🔴 ${lj1.nombre||'J1'}:</span> <span class="vt">${etiquetaVoto(lj1.voto)}</span>`
    document.getElementById('voto-j2-disp').innerHTML=`<span class="vn j2-color">🟢 ${lj2.nombre||'J2'}:</span> <span class="vt">${etiquetaVoto(lj2.voto)}</span>`
  }
  if (lj1.voto&&lj2.voto) {
    const b=document.getElementById('cfg-acordado')
    if (b) { b.style.display='block'; b.innerHTML=`<strong>Configuración acordada:</strong> ${etiquetaVoto(resolverLocal(lj1.voto,lj2.voto))}` }
  }
}

function resolverLocal(v1,v2) {
  const regiones=[...new Set([...(v1.regiones||['todas']),...(v2.regiones||['todas'])])]
  const tipos=[...new Set([...(v1.tipos||[]),...(v2.tipos||[])])]
  const modoTipos=(v1.modoTipos==='AND'&&v2.modoTipos==='AND')?'AND':'OR'
  const sf=v1.soloFinales||v2.soloFinales
  return {
    regiones,tipos,modoTipos,
    sinLegendarios:v1.sinLegendarios||v2.sinLegendarios,
    soloFinales:sf,soloSinEvolucion:!sf&&(v1.soloSinEvolucion||v2.soloSinEvolucion),
    soloBase:!sf&&!(v1.soloSinEvolucion||v2.soloSinEvolucion)&&(v1.soloBase||v2.soloBase),
    copaBebe:!sf&&!(v1.soloSinEvolucion||v2.soloSinEvolucion)&&!(v1.soloBase||v2.soloBase)&&(v1.copaBebe||v2.copaBebe),
    noDuplicadosTipo:v1.noDuplicadosTipo||v2.noDuplicadosTipo,
    maxBST:v1.maxBST&&v2.maxBST?Math.min(v1.maxBST,v2.maxBST):v1.maxBST??v2.maxBST??null,
    minBST:v1.minBST&&v2.minBST?Math.max(v1.minBST,v2.minBST):v1.minBST??v2.minBST??null,
  }
}

// Resetear estado del lobby (llamado desde draft.js al reiniciar)
export function resetLobbyEstado() {
  yaVote = false
  yaListo = false
  cooldownLimpiar = false
  desbloquearConfig()
  const cp = document.getElementById('config-panel-wrap')
  if (cp) { cp.style.opacity = ''; cp.style.pointerEvents = '' }
  document.getElementById('cfg-acciones').style.display = ''
  document.getElementById('votos-display').style.display = 'none'
  document.getElementById('cfg-acordado').style.display = 'none'
}

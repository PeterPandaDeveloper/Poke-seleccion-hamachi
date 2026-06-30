import { CONFIG }        from './config'
import { Sala, EstadoSala, VotoConfig, agregarMensajeSistema } from './sala'

const LEGENDARIOS = new Set<number>([
  144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,
  480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,638,639,640,641,642,643,
  644,645,646,647,648,649,716,717,718,719,720,721,772,773,785,786,787,788,789,790,791,
  792,800,801,802,888,889,890,891,892,893,894,895,896,897,898,
  905,1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1017,1020,1024,1025,
])

export const FORMAS_REGIONALES: Record<string, number[]> = {
  kanto:[10033,10034,10035,10036,10037,10038,10039,10040],
  johto:[],
  hoenn:[10033,10034,10035,10036,10037,10038,10039,10040,10041,10042,
         10043,10044,10045,10046,10047,10048,10049,10050,10051,10052,
         10053,10054,10055,10056,10057,10058,10059,10060,10061,10062,10063,10064,10065],
  sinnoh:[],unova:[],kalos:[],
  alola:[10091,10092,10093,10094,10095,10096,10097,10098,10099,10100,
         10101,10102,10103,10104,10105,10106,10107,10108,10109,10110,
         10111,10112,10113,10114,10115,10116,10117,10118],
  galar:[10158,10159,10160,10161,10162,10163,10164,10165,10166,10167,
         10168,10169,10170,10171,10172,10173,10174,10175,10176,10177,
         10178,10179,10180,10181,10182,10183,10184,10185],
  hisui:[10186,10187,10188,10189,10190,10191,10192,10193,10194,10195,
         10196,10197,10198,10199,10200,10201,10202,10203,10204],
  paldea:[10250,10251,10252],
  todas:[],
}

export function resolverConfig(v1: VotoConfig, v2: VotoConfig): VotoConfig {
  const regiones = [...new Set([...v1.regiones,...v2.regiones])]
  const tipos    = [...new Set([...v1.tipos,...v2.tipos])]
  const modoTipos = (v1.modoTipos==='AND'&&v2.modoTipos==='AND') ? 'AND' : 'OR'
  const sinLegendarios   = v1.sinLegendarios   || v2.sinLegendarios
  const soloFinales      = v1.soloFinales      || v2.soloFinales
  const soloSinEvolucion = !soloFinales && (v1.soloSinEvolucion || v2.soloSinEvolucion)
  const soloBase  = !soloFinales && !soloSinEvolucion && (v1.soloBase  || v2.soloBase)
  // Copa Bebé: primera etapa de cadenas con 2+ evoluciones. Excluye legendarios y mono-etapa.
  const copaBebe  = !soloFinales && !soloSinEvolucion && !soloBase && (v1.copaBebe || v2.copaBebe)
  const noDuplicadosTipo = v1.noDuplicadosTipo || v2.noDuplicadosTipo
  const maxBST = v1.maxBST!==null&&v2.maxBST!==null ? Math.min(v1.maxBST,v2.maxBST) : v1.maxBST??v2.maxBST??null
  const minBST = v1.minBST!==null&&v2.minBST!==null ? Math.max(v1.minBST,v2.minBST) : v1.minBST??v2.minBST??null
  return { regiones, tipos, modoTipos, sinLegendarios, soloFinales, soloSinEvolucion, soloBase, copaBebe, noDuplicadosTipo, maxBST, minBST }
}

export function etiquetaConfig(c: VotoConfig): string {
  const p: string[] = []
  if (!c.regiones.includes('todas')) p.push('📍 '+c.regiones.join('+'))
  if (c.tipos.length) p.push((c.modoTipos==='AND'?'AND ':'OR ')+c.tipos.join('+'))
  if (c.sinLegendarios)   p.push('Sin leg.')
  if (c.soloFinales)      p.push('Evol. final')
  if (c.soloSinEvolucion) p.push('Sin evo.')
  if (c.soloBase)         p.push('1.ª etapa')
  if (c.copaBebe)         p.push('🍼 Copa Bebé')
  if (c.noDuplicadosTipo) p.push('Sin tipos dup.')
  if (c.minBST) p.push(`BST≥${c.minBST}`)
  if (c.maxBST) p.push(`BST≤${c.maxBST}`)
  return p.length ? p.join(' · ') : 'Sin restricciones'
}

function pool2pokemon(sala: Sala): void {
  if (sala.pool.length < 2) {
    const ya = new Set([...sala.estado.jugador1.equipo,...sala.estado.jugador2.equipo])
    sala.pool = Array.from({length:1025},(_,i)=>i+1).filter(id=>!ya.has(id))
  }
}

export function limpiarTimer(sala: Sala): void {
  if (sala.timer) { clearTimeout(sala.timer); sala.timer=null }
  sala.estado.timerExpira = null
}

export function generarRonda(salaId: string, sala: Sala): void {
  limpiarTimer(sala)
  const { estado } = sala
  estado.ultimaEleccionRandom = false
  if (estado.rondaActual >= CONFIG.MAX_RONDAS) {
    estado.turnoDe='FIN'; estado.fase='fin'
    const j1 = estado.jugador1.nombre||'J1'
    const j2 = estado.jugador2.nombre||'J2'
    agregarMensajeSistema(sala,`🏁 ¡Draft terminado! ${j1} y ${j2} tienen sus equipos.`)
    return
  }
  pool2pokemon(sala)
  const i1=Math.floor(Math.random()*sala.pool.length); const id1=sala.pool.splice(i1,1)[0]
  const i2=Math.floor(Math.random()*sala.pool.length); const id2=sala.pool.splice(i2,1)[0]
  estado.opcionesActuales=[id1,id2]; estado.historial.push(id1,id2)
  estado.rondaActual++
  estado.turnoDe = estado.rondaActual%2===1 ? 'jugador1' : 'jugador2'
  // Timer
  estado.timerExpira = Date.now() + CONFIG.TIMER_SEG*1000
  sala.timer = setTimeout(()=>{
    if (estado.fase!=='draft'||estado.turnoDe==='FIN') return
    const elegido = estado.opcionesActuales[Math.floor(Math.random()*estado.opcionesActuales.length)]
    console.log(`⏰  [${salaId}] Timeout → #${elegido}`)
    estado.ultimaEleccionRandom = true
    aplicarEleccion(salaId, sala, estado.turnoDe as 'jugador1'|'jugador2', elegido)
  }, CONFIG.TIMER_SEG*1000)
}

export function aplicarEleccion(salaId: string, sala: Sala, jugador: 'jugador1'|'jugador2', elegido: number): void {
  const rival    = jugador==='jugador1'?'jugador2':'jugador1'
  const noElegido = sala.estado.opcionesActuales.find(id=>id!==elegido)!
  sala.estado[jugador].equipo.push(elegido)
  sala.estado[rival].equipo.push(noElegido)
  generarRonda(salaId, sala)
}

export function iniciarDraft(salaId: string, sala: Sala, idsValidos: number[]): void {
  const { estado } = sala
  estado.config  = resolverConfig(estado.lobby.jugador1.voto!, estado.lobby.jugador2.voto!)
  sala.pool      = idsValidos.slice()
  estado.poolSize = sala.pool.length
  estado.jugador1.nombre = estado.lobby.jugador1.nombre
  estado.jugador2.nombre = estado.lobby.jugador2.nombre
  estado.fase = 'draft'
  const etiqueta = etiquetaConfig(estado.config)
  agregarMensajeSistema(sala, `🎮 ¡Draft iniciado! Reglas: ${etiqueta}`)
  console.log(`🎮  [${salaId}] Draft iniciado — pool: ${sala.pool.length}`)
  generarRonda(salaId, sala)
}

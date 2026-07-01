import * as crypto from 'crypto'
import { CONFIG }  from './config'

// ─── TIPOS ───────────────────────────────────────────────────────────────────
export interface VotoConfig {
  regiones: string[]; tipos: string[]; modoTipos: 'OR'|'AND'
  sinLegendarios: boolean; soloFinales: boolean; soloSinEvolucion: boolean
  soloBase: boolean; copaBebe: boolean; noDuplicadosTipo: boolean
  maxBST: number|null; minBST: number|null
}

export interface LobbyJugador { nombre: string; listo: boolean; voto: VotoConfig|null; bloqueado: boolean }
export interface Jugador       { equipo: number[]; conectado: boolean; token: string|null; nombre: string; lastSeen: number }

export interface MensajeChat {
  id: string; autor: string; rol: 'jugador1'|'jugador2'|'sistema'|'espectador'
  texto: string; ts: number
}

export interface EstadoSala {
  fase: 'lobby'|'draft'|'fin'
  lobby: {
    jugador1: LobbyJugador; jugador2: LobbyJugador
    espectadores: number; ultimaLimpieza: number
    // ts del último buzz para anti-spam
    ultimoBuzzJ1: number; ultimoBuzzJ2: number
  }
  config: VotoConfig|null
  jugador1: Jugador; jugador2: Jugador
  rondaActual: number; opcionesActuales: number[]; turnoDe: 'jugador1'|'jugador2'|'FIN'
  historial: number[]; poolSize: number
  timerExpira: number|null; ultimaEleccionRandom: boolean
  chat: MensajeChat[]
}

export interface Sala {
  id: string
  estado: EstadoSala
  pool: number[]
  timer: ReturnType<typeof setTimeout>|null
  creadaEn: number
  // TTL: expira si no hay jugadores conectados por X ms
  sinJugadoresDesde: number|null
  privada: boolean
}

// ─── MAPA GLOBAL ─────────────────────────────────────────────────────────────
export const salas = new Map<string, Sala>()

export function crearEstado(): EstadoSala {
  return {
    fase: 'lobby',
    lobby: {
      jugador1: { nombre:'', listo:false, voto:null, bloqueado:false },
      jugador2: { nombre:'', listo:false, voto:null, bloqueado:false },
      espectadores: 0, ultimaLimpieza: 0,
      ultimoBuzzJ1: 0, ultimoBuzzJ2: 0,
    },
    config: null,
    jugador1: { equipo:[], conectado:false, token:null, nombre:'', lastSeen:0 },
    jugador2: { equipo:[], conectado:false, token:null, nombre:'', lastSeen:0 },
    rondaActual:0, opcionesActuales:[], turnoDe:'jugador1',
    historial:[], poolSize:0, timerExpira:null, ultimaEleccionRandom:false,
    chat:[],
  }
}

export function obtenerSala(id: string): Sala {
  if (!salas.has(id)) {
    if (salas.size >= CONFIG.MAX_SALAS) {
      // Eliminar la sala sin jugadores más antigua
      let target = ''; let tsMin = Infinity
      for (const [sid, s] of salas) {
        if (!s.estado.jugador1.conectado && !s.estado.jugador2.conectado && s.creadaEn < tsMin) {
          tsMin = s.creadaEn; target = sid
        }
      }
      // Si todas tienen jugadores, eliminar la más inactiva
      if (!target) {
        for (const [sid, s] of salas) {
          if (s.creadaEn < tsMin) { tsMin = s.creadaEn; target = sid }
        }
      }
      const old = salas.get(target)!
      if (old.timer) clearTimeout(old.timer)
      salas.delete(target)
      console.log(`♻️  Sala eliminada: ${target}`)
    }
    const ahora = Date.now()
    salas.set(id, {
      id, estado: crearEstado(), pool:[], timer:null,
      creadaEn: ahora, sinJugadoresDesde: ahora, privada: false,
    })
    console.log(`🏠  Sala creada: ${id} (total: ${salas.size})`)
  }
  return salas.get(id)!
}

/** Borra votos, draft y equipos pero conserva jugadores, tokens y chat. */
export function limpiarSelecciones(sala: Sala): void {
  if (sala.timer) { clearTimeout(sala.timer); sala.timer = null }

  const { estado } = sala
  const j1 = estado.jugador1, j2 = estado.jugador2
  const esp       = estado.lobby.espectadores
  const lj1Nom    = estado.lobby.jugador1.nombre
  const lj2Nom    = estado.lobby.jugador2.nombre
  const chat      = estado.chat
  const ts        = estado.lobby.ultimaLimpieza

  sala.pool = []
  estado.fase = 'lobby'
  estado.config = null
  estado.lobby = {
    jugador1: { nombre: lj1Nom, listo: false, voto: null, bloqueado: false },
    jugador2: { nombre: lj2Nom, listo: false, voto: null, bloqueado: false },
    espectadores: esp,
    ultimaLimpieza: Math.max(ts, Date.now()),
    ultimoBuzzJ1: 0, ultimoBuzzJ2: 0,
  }
  estado.jugador1 = { equipo: [], conectado: j1.conectado, token: j1.token, nombre: j1.nombre, lastSeen: j1.lastSeen }
  estado.jugador2 = { equipo: [], conectado: j2.conectado, token: j2.token, nombre: j2.nombre, lastSeen: j2.lastSeen }
  estado.rondaActual = 0
  estado.opcionesActuales = []
  estado.turnoDe = 'jugador1'
  estado.historial = []
  estado.poolSize = 0
  estado.timerExpira = null
  estado.ultimaEleccionRandom = false
  estado.chat = chat

  agregarMensajeSistema(sala, '🧹 Selecciones borradas. Podéis votar de nuevo.')
}

/** Reset completo (solo uso interno / expiración). */
export function resetSala(sala: Sala): void {
  if (sala.timer) clearTimeout(sala.timer)
  const esp = sala.estado.lobby.espectadores
  const ts  = sala.estado.lobby.ultimaLimpieza
  sala.pool  = []
  sala.estado = crearEstado()
  sala.estado.lobby.espectadores   = esp
  sala.estado.lobby.ultimaLimpieza = Math.max(ts, Date.now())
  sala.sinJugadoresDesde = Date.now()
  agregarMensajeSistema(sala, '🧹 La sala fue limpiada. ¡A empezar de nuevo!')
}

export function actualizarPresenciaJugadores(sala: Sala): void {
  const { jugador1, jugador2 } = sala.estado
  const hayJugador = jugador1.conectado || jugador2.conectado
  if (!hayJugador) {
    if (sala.sinJugadoresDesde === null) sala.sinJugadoresDesde = Date.now()
  } else {
    sala.sinJugadoresDesde = null
  }
}

export function agregarMensajeSistema(sala: Sala, texto: string): void {
  const msg: MensajeChat = {
    id: crypto.randomBytes(4).toString('hex'),
    autor: 'Sistema', rol: 'sistema', texto, ts: Date.now(),
  }
  sala.estado.chat.push(msg)
  if (sala.estado.chat.length > CONFIG.MAX_CHAT_HISTORIAL)
    sala.estado.chat.shift()
}

// ─── HEARTBEAT: marcar jugadores como desconectados si no dan señales ───────────
const HEARTBEAT_TIMEOUT_MS = 20_000  // 20s sin heartbeat → desconectado

export function actualizarHeartbeat(sala: Sala, rol: 'jugador1'|'jugador2'): void {
    sala.estado[rol].lastSeen = Date.now()
    sala.estado[rol].conectado = true
    actualizarPresenciaJugadores(sala)
}

// ─── TTL: purgar salas sin jugadores ─────────────────────────────────────────
setInterval(() => {
  const ahora = Date.now()
  for (const [id, sala] of salas) {
    // Marcar jugadores como desconectados si no han dado heartbeat en 20s
    for (const rol of ['jugador1','jugador2'] as const) {
      const j = sala.estado[rol]
      if (j.conectado && j.lastSeen > 0 && ahora - j.lastSeen > HEARTBEAT_TIMEOUT_MS) {
        j.conectado = false
        console.log(`💔  [${id}] ${rol} desconectado (sin heartbeat)`)
      }
    }
    actualizarPresenciaJugadores(sala)
    if (sala.sinJugadoresDesde !== null &&
        ahora - sala.sinJugadoresDesde > CONFIG.TTL_SIN_JUGADORES) {
      if (sala.timer) clearTimeout(sala.timer)
      salas.delete(id)
      console.log(`🗑️  Sala expirada (sin jugadores 7 min): ${id}`)
    }
  }
}, CONFIG.TTL_CHECK_MS)

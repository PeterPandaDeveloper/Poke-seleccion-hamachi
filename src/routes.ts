import * as http   from 'http'
import * as crypto from 'crypto'
import { CONFIG }      from './config'
import { checkRL }     from './rateLimiter'
import { generarToken, validarToken } from './tokens'
import { validarVoto, validarIds }    from './validators'
import { salas, obtenerSala, limpiarSelecciones, actualizarPresenciaJugadores, agregarMensajeSistema, actualizarHeartbeat } from './sala'
import { iniciarDraft, aplicarEleccion, limpiarTimer, etiquetaConfig } from './draft'

// ─── HELPERS HTTP ─────────────────────────────────────────────────────────────
export function json(res: http.ServerResponse, code: number, data: unknown): void {
  res.writeHead(code, {'Content-Type':'application/json'})
  res.end(JSON.stringify(data))
}

export function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((ok,fail) => {
    let buf='', size=0
    req.on('data',(chunk:Buffer)=>{
      size+=chunk.length
      if (size>CONFIG.MAX_BODY_BYTES) { req.destroy(); fail(new Error('Payload demasiado grande.')); return }
      buf+=chunk
    })
    req.on('end',()=>ok(buf))
    req.on('error',fail)
  })
}

export function getIP(req: http.IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for']
  if (fwd) return (Array.isArray(fwd)?fwd[0]:fwd.split(',')[0]).trim()
  return req.socket.remoteAddress ?? '0.0.0.0'
}

export function parseReq(req: http.IncomingMessage) {
  const url      = new URL(req.url??'/', `http://${req.headers.host??'localhost'}`)
  const base     = url.pathname
  const token    = url.searchParams.get('token')??''
  const partes   = base.split('/').filter(Boolean)
  // rutas: /api/sala/:salaId/:endpoint...  o  /api/:global
  const salaId   = partes[1]==='sala' ? (partes[2]??'default') : null
  const endpoint = salaId ? ('/'+partes.slice(3).join('/')) : base
  return { base, endpoint, token, salaId }
}

// ─── HANDLER PRINCIPAL ───────────────────────────────────────────────────────
export async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin','*')
  const { base, endpoint, token, salaId } = parseReq(req)
  const m  = req.method??'GET'
  const ip = getIP(req)

  // Rutas globales (sin sala)
  if (base==='/api/salas' && m==='GET') {
    return json(res,200,[...salas.entries()]
      .filter(([,s])=>!s.privada)
      .map(([id,s])=>({
        id, fase:s.estado.fase,
        j1:s.estado.lobby.jugador1.nombre||null,
        j2:s.estado.lobby.jugador2.nombre||null,
        hayEspacio: !s.estado.jugador1.conectado || !s.estado.jugador2.conectado,
      })))
  }

  if (base==='/api/sala/crear' && m==='POST') {
    if (!checkRL(ip,'crear',CONFIG.RATE_CREAR_SALA))
      return json(res,429,{error:'Demasiadas salas creadas. Espera un momento.'})
    if (salas.size>=CONFIG.MAX_SALAS)
      return json(res,503,{error:'Servidor lleno (máx. 20 salas activas).'})
    // NO crear sala aquí — solo reservar ID y devolver al cliente.
    // La sala se crea realmente cuando alguien se une.
    const nuevoId = crypto.randomBytes(3).toString('hex').toUpperCase()
    return json(res,200,{salaId:nuevoId})
  }

  if (!salaId) { res.writeHead(404); res.end('404'); return }

  if (endpoint!=='/estado') console.log(`${m} [${salaId}] ${endpoint} — ${ip}`)

  try {
    const sala = salas.get(salaId) ?? obtenerSala(salaId)
    if (!sala || sala.eliminada) {
      return json(res,410,{error:'Sala eliminada', eliminado:true})
    }
    if (sala.eliminacionPendiente && (Date.now() - sala.eliminacionPendiente.creadoEn) > 60000) {
      sala.eliminacionPendiente = null
    }
    const { estado } = sala

    if (endpoint==='/estado') {
      actualizarPresenciaJugadores(sala)
      return json(res,200,{...estado,salaId,reglas:estado.config?etiquetaConfig(estado.config):null})
    }

    // Espectadores (con nombre opcional)
    if (endpoint==='/espectador/unirse'&&m==='POST') {
      const bodyEsp = JSON.parse(await readBody(req)) as Record<string,unknown>
      estado.lobby.espectadores = Math.max(0, estado.lobby.espectadores + 1)
      const nombre = String(bodyEsp.nombre??'espectador').trim().slice(0,20)
      agregarMensajeSistema(sala,`👁 ${nombre} se unió como espectador`)
      return json(res,200,{ok:true,nombre})
    }
    if (endpoint=='/espectador/salir' &&m==='POST') {
      const bodyEsp = JSON.parse(await readBody(req)) as Record<string,unknown>
      estado.lobby.espectadores = Math.max(0, estado.lobby.espectadores - 1)
      const nombre = String(bodyEsp.nombre??'espectador').trim().slice(0,20)
      agregarMensajeSistema(sala,`👁 ${nombre} dejó de mirar`)
      return json(res,200,{ok:true})
    }

    // Verificar reconexión
    if (endpoint==='/lobby/verificar'&&m==='POST') {
      const b = JSON.parse(await readBody(req))
      const tk = String((b as Record<string,unknown>).token??'')
      if (!validarToken(tk)) return json(res,200,{rol:null,estado})
      if (estado.jugador1.token===tk) return json(res,200,{rol:'jugador1',estado,salaId})
      if (estado.jugador2.token===tk) return json(res,200,{rol:'jugador2',estado,salaId})
      return json(res,200,{rol:null,estado})
    }

    // Unirse
    if (endpoint==='/lobby/unirse'&&m==='POST') {
      if (!checkRL(ip,'unirse',CONFIG.RATE_UNIRSE))
        return json(res,429,{error:'Demasiados intentos. Espera un momento.'})
      const b = JSON.parse(await readBody(req)) as Record<string,unknown>
      const rol    = String(b.rol??'')
      const nombre = String(b.nombre??'').trim().slice(0,20)
      const tkCliente = String(b.token??'')
      if (rol!=='jugador1'&&rol!=='jugador2') return json(res,400,{error:'Rol no válido.'})
      if (!nombre) return json(res,400,{error:'Se requiere un nombre.'})
      if (estado.fase!=='lobby') return json(res,409,{error:'La partida ya inició.'})
      const j = estado[rol as 'jugador1'|'jugador2']
      // Reconexión: token válido y coincide
      if (j.conectado&&j.token) {
        if (!validarToken(tkCliente)||j.token!==tkCliente) return json(res,409,{error:'Ese lugar ya está ocupado.'})
        return json(res,200,{estado,token:tkCliente,salaId})
      }
      const nuevoToken = generarToken()
      j.conectado=true; j.token=nuevoToken; j.nombre=nombre
      estado.lobby[rol as 'jugador1'|'jugador2'].nombre=nombre
      actualizarPresenciaJugadores(sala)
      const otro = rol==='jugador1'?'jugador2':'jugador1'
      if (estado[otro].conectado) {
        agregarMensajeSistema(sala,`✅ ${nombre} se unió como ${rol==='jugador1'?'Jugador 1':'Jugador 2'}. ¡Ya están ambos!`)
      } else {
        agregarMensajeSistema(sala,`🎮 ${nombre} se unió como ${rol==='jugador1'?'Jugador 1':'Jugador 2'}. Esperando al otro jugador...`)
      }
      console.log(`✅  [${salaId}] ${rol} se unió como "${nombre}"`)
      return json(res,200,{estado,token:nuevoToken,salaId})
    }

    // Chat (jugadores y espectadores) — ANTES de la validación de token
    if (endpoint==='/chat'&&m==='POST') {
      const bodyChat = JSON.parse(await readBody(req)) as Record<string,unknown>
      const texto = String(bodyChat.texto??'').trim().slice(0,CONFIG.MAX_CHAT_MSG)
      if (!texto) return json(res,400,{error:'Mensaje vacío.'})
      const tkBodyChat = String(bodyChat.token??'')
      let nombre: string, rol: string
      if (validarToken(tkBodyChat) && (estado.jugador1.token===tkBodyChat || estado.jugador2.token===tkBodyChat)) {
        const rolChat = estado.jugador1.token===tkBodyChat ? 'jugador1' : 'jugador2'
        nombre = estado[rolChat].nombre || rolChat
        rol = rolChat
      } else {
        // Espectador sin token
        nombre = String(bodyChat.nombreEspectador??'Espectador').trim().slice(0,20)
        rol = 'espectador'
      }
      const msg = {
        id: crypto.randomBytes(4).toString('hex'),
        autor:nombre, rol: rol as 'jugador1'|'jugador2'|'espectador', texto, ts:Date.now(),
      }
      estado.chat.push(msg)
      if (estado.chat.length>CONFIG.MAX_CHAT_HISTORIAL) estado.chat.shift()
      return json(res,200,{ok:true})
    }

    // ── /intercambiar — jugador deja slot libre, espectador toma slot vacío ──
    // COLOCADO ANTES de la validación de token para que espectadores puedan tomar slots
    if (endpoint==='/intercambiar'&&m==='POST') {
      const bodyInt = JSON.parse(await readBody(req)) as Record<string,unknown>
      const accion  = String(bodyInt.accion??'')
      if (accion === 'liberar') {
        const tkLibera = String(bodyInt.token??'')
        if (validarToken(tkLibera) && estado.jugador1.token===tkLibera) {
          const nom = estado.jugador1.nombre || estado.lobby.jugador1.nombre || 'J1'
          estado.jugador1.conectado = false; estado.jugador1.token = null
          estado.jugador1.nombre = nom
          estado.lobby.jugador1 = { nombre:'', listo:false, voto:null, bloqueado:false }
          estado.lobby.espectadores = Math.max(0, estado.lobby.espectadores + 1)
          actualizarPresenciaJugadores(sala)
          agregarMensajeSistema(sala,`🔴 ${nom} dejó de ser Jugador 1 (ahora es espectador)`)
          return json(res,200,{ok:true,rolLiberado:'jugador1'})
        }
        if (validarToken(tkLibera) && estado.jugador2.token===tkLibera) {
          const nom = estado.jugador2.nombre || estado.lobby.jugador2.nombre || 'J2'
          estado.jugador2.conectado = false; estado.jugador2.token = null
          estado.jugador2.nombre = nom
          estado.lobby.jugador2 = { nombre:'', listo:false, voto:null, bloqueado:false }
          estado.lobby.espectadores = Math.max(0, estado.lobby.espectadores + 1)
          actualizarPresenciaJugadores(sala)
          agregarMensajeSistema(sala,`🟢 ${nom} dejó de ser Jugador 2 (ahora es espectador)`)
          return json(res,200,{ok:true,rolLiberado:'jugador2'})
        }
        return json(res,403,{error:'Token no válido para liberar slot.'})
      }
      if (accion === 'tomar') {
        const rolTomar = String(bodyInt.rol??'')
        if (rolTomar!=='jugador1'&&rolTomar!=='jugador2') return json(res,400,{error:'Rol no válido.'})
        const j = estado[rolTomar]
        if (j.conectado) return json(res,409,{error:'Ese slot ya está ocupado.'})
        const nombreEsp = String(bodyInt.nombreEspectador??'Espectador').trim().slice(0,20)
        const nuevoToken = generarToken()
        j.conectado = true; j.token = nuevoToken; j.nombre = nombreEsp || j.nombre
        estado.lobby[rolTomar].nombre = nombreEsp
        estado.lobby.espectadores = Math.max(0, estado.lobby.espectadores - 1)
        actualizarPresenciaJugadores(sala)
        agregarMensajeSistema(sala,`👁 ${nombreEsp} pasó de espectador a ${rolTomar==='jugador1'?'Jugador 1':'Jugador 2'}`)
        return json(res,200,{ok:true,token:nuevoToken,rol:rolTomar})
      }
      return json(res,400,{error:'Acción no válida. Usar "liberar" o "tomar".'})
    }

    if (endpoint==='/eliminar'&&m==='POST') {
      const b = JSON.parse(await readBody(req)) as Record<string,unknown>
      const tk = String(b.token??'')
      if (!validarToken(tk)) return json(res,403,{error:'Token no válido.'})
      const rolPropio = estado.jugador1.token===tk ? 'jugador1' : estado.jugador2.token===tk ? 'jugador2' : null
      if (!rolPropio) return json(res,403,{error:'Solo los jugadores pueden eliminar la sala.'})
      if (!sala.eliminacionPendiente) {
        sala.eliminacionPendiente = { solicitante: rolPropio, creadoEn: Date.now() }
        const nombre = estado[rolPropio].nombre || (rolPropio==='jugador1'?'Jugador 1':'Jugador 2')
        agregarMensajeSistema(sala, `🗑️ ${nombre} quiere eliminar la sala. Espera a que el otro jugador confirme.`)
        return json(res,200,{ok:true, pending:true, solicitante:rolPropio})
      }
      if (sala.eliminacionPendiente.solicitante === rolPropio) {
        return json(res,200,{ok:true, pending:true, solicitante:rolPropio})
      }
      const nombre = estado[rolPropio].nombre || (rolPropio==='jugador1'?'Jugador 1':'Jugador 2')
      agregarMensajeSistema(sala, `🗑️ ${nombre} confirmó la eliminación de la sala.`)
      if (sala.timer) clearTimeout(sala.timer)
      salas.delete(salaId)
      return json(res,200,{ok:true, eliminado:true})
    }

    // ── A partir de aquí se requiere token válido ────────────────────────────
    const b      = m!=='GET' ? JSON.parse(await readBody(req)) as Record<string,unknown> : {}
    const tkBody = String(b.token??token)
    if (!validarToken(tkBody)) return json(res,403,{error:'Token no válido o manipulado.'})
    const rolPropio = estado.jugador1.token===tkBody ? 'jugador1'
                    : estado.jugador2.token===tkBody ? 'jugador2' : null

    // Votar
    if (endpoint==='/lobby/votar'&&m==='POST') {
      if (estado.fase!=='lobby') return json(res,409,{error:'No estamos en el lobby.'})
      if (!rolPropio) return json(res,403,{error:'Token no válido.'})
      const err = validarVoto(b.voto)
      if (err) return json(res,400,{error:err})
      const ro = String(b.rolObjetivo??'')
      const rolFinal = (ro==='jugador1'||ro==='jugador2') ? ro : rolPropio
      const lj = estado.lobby[rolFinal as 'jugador1'|'jugador2']
      // BLOQUEAR edición si ya está marcado como listo
      if (lj.bloqueado) return json(res,409,{error:'Ya confirmaste tu configuración. No puedes cambiarla.'})
      lj.voto = b.voto as any
      return json(res,200,estado)
    }

    // Listo (bloquea el voto)
    if (endpoint==='/lobby/listo'&&m==='POST') {
      if (estado.fase!=='lobby') return json(res,409,{error:'No estamos en el lobby.'})
      if (!rolPropio) return json(res,403,{error:'Token no válido.'})
      if (!estado.lobby[rolPropio].voto) return json(res,400,{error:'Primero hay que elegir configuración.'})
      const errIds = validarIds(b.idsValidos)
      if (errIds) return json(res,400,{error:errIds})
      estado.lobby[rolPropio].listo    = true
      estado.lobby[rolPropio].bloqueado = true   // BLOQUEAR voto al confirmar
      const nombre = estado[rolPropio].nombre||rolPropio
      agregarMensajeSistema(sala,`✅ ${nombre} está listo.`)
      if (estado.lobby.jugador1.listo&&estado.lobby.jugador2.listo)
        iniciarDraft(salaId,sala,b.idsValidos as number[])
      return json(res,200,estado)
    }

    // Limpiar sala (= "Borrar todas las selecciones")
    if (endpoint==='/lobby/limpiar'&&m==='POST') {
      if (!rolPropio) return json(res,403,{error:'Solo jugadores pueden limpiar.'})
      const ahora = Date.now()
      if (ahora-estado.lobby.ultimaLimpieza<CONFIG.COOLDOWN_LIMPIAR)
        return json(res,429,{error:`Espera ${Math.ceil((CONFIG.COOLDOWN_LIMPIAR-(ahora-estado.lobby.ultimaLimpieza))/1000)}s.`})
      limpiarSelecciones(sala)
      return json(res,200,estado)
    }

    // Elegir Pokémon
    if (endpoint.startsWith('/elegir/')) {
      const pts     = endpoint.split('/').filter(Boolean)
      const jugador = pts[1] as 'jugador1'|'jugador2'
      const elegido = parseInt(pts[2],10)
      if (!rolPropio||rolPropio!==jugador) return json(res,403,{error:'Token no válido para este jugador.'})
      if (estado.turnoDe==='FIN')          return json(res,400,{error:'La partida ya terminó.'})
      if (estado.turnoDe!==jugador)        return json(res,400,{error:'No es tu turno.'})
      if (!Number.isInteger(elegido)||!estado.opcionesActuales.includes(elegido))
        return json(res,400,{error:'Opción no válida.'})
      aplicarEleccion(salaId,sala,jugador,elegido)
      return json(res,200,estado)
    }

    // Buzz (notificar al otro jugador — anti-spam)
    if (endpoint==='/buzz'&&m==='POST') {
      if (!rolPropio) return json(res,403,{error:'Token no válido.'})
      const ahora = Date.now()
      const campoBuzz = rolPropio==='jugador1' ? 'ultimoBuzzJ1' : 'ultimoBuzzJ2'
      if (ahora-estado.lobby[campoBuzz]<CONFIG.BUZZ_COOLDOWN_MS)
        return json(res,429,{error:'Espera antes de volver a avisar.'})
      estado.lobby[campoBuzz] = ahora
      const nombre = estado[rolPropio].nombre||rolPropio
      agregarMensajeSistema(sala,`🔔 ${nombre} te avisa: ¡ey, sigue!`)
      return json(res,200,{ok:true})
    }

    // ── /heartbeat — mantener jugador marcado como conectado ─────────────────
        if (endpoint==='/heartbeat'&&m==='POST') {
            if (!rolPropio) return json(res,200,{ok:true})
            actualizarHeartbeat(sala, rolPropio as 'jugador1'|'jugador2')
            return json(res,200,{ok:true})
        }

    // ── /keepalive — extender vida de la sala por 5 minutos ────────────────
    if (endpoint==='/keepalive'&&m==='POST') {
      sala.sinJugadoresDesde = null
      agregarMensajeSistema(sala, `⏱ Sala mantenida viva por 5 minutos más`)
      console.log(`⏱  [${salaId}] Keepalive recibido`)
      return json(res,200,{ok:true})
    }

    // Sala privada
    if (endpoint==='/privada'&&m==='POST') {
      if (!rolPropio) return json(res,403,{error:'Solo jugadores pueden cambiar privacidad.'})
      sala.privada = Boolean(b.privada)
      console.log(`🔒  [${salaId}] Sala ${sala.privada?'privada':'pública'}`)
      return json(res,200,{ok:true,privada:sala.privada})
    }

    // Reset
    if (endpoint==='/reset'&&m==='GET') {
      if (!rolPropio) return json(res,403,{error:'Solo jugadores pueden reiniciar.'})
      limpiarSelecciones(sala); return json(res,200,estado)
    }

    res.writeHead(404); res.end('404')
  } catch(e) {
    console.error('Error interno:',e)
    res.writeHead(500); res.end(JSON.stringify({error:'Error interno del servidor.'}))
  }
}

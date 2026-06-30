import * as http from 'http'
import * as fs   from 'fs'
import * as path from 'path'
import { CONFIG }        from './config'
import { handleRequest, json } from './routes'

const DIR_PUBLIC = path.join(process.cwd(), 'public')
const MIME: Record<string,string> = {
  '.html':'text/html', '.css':'text/css', '.js':'application/javascript',
  '.png':'image/png',  '.svg':'image/svg+xml', '.ico':'image/x-icon',
}

function servirArchivo(res: http.ServerResponse, rel: string): void {
  const abs = path.resolve(DIR_PUBLIC, rel)
  if (!abs.startsWith(DIR_PUBLIC)) { res.writeHead(403); res.end(); return }
  const tipo = MIME[path.extname(rel)] ?? 'application/octet-stream'
  fs.readFile(abs, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return }
    res.writeHead(200, {'Content-Type':tipo})
    res.end(data)
  })
}

http.createServer(async (req, res) => {
  const url = new URL(req.url??'/', `http://${req.headers.host??'localhost'}`)
  const base = url.pathname

  // Archivos estáticos
  if (req.method==='GET') {
    if (base==='/'||base==='/index.html') return servirArchivo(res,'index.html')
    if (base==='/style.css')              return servirArchivo(res,'style.css')
    const rel = base.slice(1)
    // Servir archivos de /js/ y otros assets
    if (!rel.startsWith('api')) return servirArchivo(res, rel)
  }

  if (!base.startsWith('/api')) { res.writeHead(404); res.end(); return }

  try {
    await handleRequest(req, res)
  } catch(e) {
    console.error('Unhandled:', e)
    json(res, 500, {error:'Error interno.'})
  }
}).listen(CONFIG.PUERTO, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════')
  console.log('🚀  Desafío de Pokélección')
  console.log(`    Puerto : ${CONFIG.PUERTO}`)
  console.log(`    Salas  : máx. ${CONFIG.MAX_SALAS} · TTL ${CONFIG.TTL_SIN_JUGADORES/60000} min sin jugadores`)
  console.log(`    Tokens : HMAC-SHA256 firmados`)
  console.log('═══════════════════════════════════════')
})

import * as crypto from 'crypto'

const SECRETO = process.env.TOKEN_SECRET ?? crypto.randomBytes(32).toString('hex')

export function generarToken(): string {
  const rand  = crypto.randomBytes(16).toString('hex')
  const firma = crypto.createHmac('sha256', SECRETO).update(rand).digest('hex').slice(0, 16)
  return `${rand}.${firma}`
}

export function validarToken(token: string): boolean {
  const partes = (token ?? '').split('.')
  if (partes.length !== 2) return false
  const [rand, firma] = partes
  const esperada = crypto.createHmac('sha256', SECRETO).update(rand).digest('hex').slice(0, 16)
  try { return crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada)) }
  catch { return false }
}

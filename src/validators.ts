import { VotoConfig } from './sala'

const REGIONES = new Set(['todas','kanto','johto','hoenn','sinnoh','unova','kalos','alola','galar','paldea','hisui'])
const TIPOS    = new Set(['normal','fuego','agua','planta','eléctrico','hielo','lucha','veneno',
                          'tierra','volador','psíquico','bicho','roca','fantasma','dragón','siniestro','acero','hada'])
const COLORES  = new Set(['negro','azul','marron','gris','verde','rosa','morado','rojo','blanco','amarillo'])

export function validarVoto(v: unknown): string | null {
  if (!v || typeof v !== 'object') return 'Voto inválido.'
  const x = v as Record<string, unknown>
  if (!Array.isArray(x.regiones) || !x.regiones.length || x.regiones.length > 10) return 'Regiones inválidas.'
  if (x.regiones.some((r: unknown) => typeof r !== 'string' || !REGIONES.has(r))) return 'Región no reconocida.'
  if (!Array.isArray(x.tipos) || x.tipos.length > 18) return 'Tipos inválidos.'
  if (x.tipos.some((t: unknown) => typeof t !== 'string' || !TIPOS.has(t))) return 'Tipo no reconocido.'
  if (!Array.isArray(x.colores) || x.colores.length > 10) return 'Colores inválidos.'
  if (x.colores.some((c: unknown) => typeof c !== 'string' || !COLORES.has(c))) return 'Color no reconocido.'
  if (x.colores.length && x.tipos.length) return 'No puedes combinar colores y tipos.'
  if (x.modoTipos !== 'OR' && x.modoTipos !== 'AND') return 'modoTipos inválido.'
  for (const f of ['sinLegendarios','soloFinales','soloSinEvolucion','soloBase','copaBebe','noDuplicadosTipo','sinGimmicks','sinFormasRegionales'])
    if (typeof x[f] !== 'boolean') return `${f} debe ser booleano.`
  if (x.maxBST !== null && (typeof x.maxBST !== 'number' || x.maxBST < 0 || x.maxBST > 1200)) return 'maxBST fuera de rango.'
  if (x.minBST !== null && (typeof x.minBST !== 'number' || x.minBST < 0 || x.minBST > 1200)) return 'minBST fuera de rango.'
  if (x.minBST !== null && x.maxBST !== null && (x.minBST as number) > (x.maxBST as number))
    return 'El BST mínimo no puede ser mayor que el máximo.'
  return null
}

export function validarIds(ids: unknown): string | null {
  if (!Array.isArray(ids)) return 'idsValidos debe ser un arreglo.'
  if ((ids as number[]).length < 12)    return 'El grupo tiene menos de 12 Pokémon.'
  if ((ids as number[]).length > 3000)  return 'El grupo excede el máximo permitido.'
  if ((ids as unknown[]).some((id) => typeof id !== 'number' || !Number.isInteger(id) || id < 1 || id > 99999))
    return 'El arreglo contiene IDs no válidos.'
  return null
}

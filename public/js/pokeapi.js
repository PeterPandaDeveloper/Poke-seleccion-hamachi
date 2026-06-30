export const nameCache = new Map()
export const typeCache = new Map()
export const bstCache  = new Map()
export const evoCache  = new Map()

export const imgUrl    = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
export const imgSprite = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`

export async function fetchNombre(id) {
  if (nameCache.has(id)) return nameCache.get(id)
  try {
    const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
    const d = await r.json()
    nameCache.set(id, d.name)
    typeCache.set(id, d.types.map(t=>t.type.name))
    bstCache.set(id, d.stats.reduce((s,x)=>s+x.base_stat,0))
    return d.name
  } catch { return `#${id}` }
}

function analizarCadena(nodo, nombre) {
  function profundidad(n) {
    // Cuenta la profundidad máxima de la cadena desde este nodo
    if (!n.evolves_to.length) return 0
    return 1 + Math.max(...n.evolves_to.map(profundidad))
  }
  function buscar(n) {
    if (n.species.name === nombre) return { esFinal: n.evolves_to.length === 0 }
    for (const h of n.evolves_to) { const r = buscar(h); if (r) return r }
    return null
  }
  const esRaiz      = nodo.species.name === nombre
  const res         = buscar(nodo)
  const profTotal   = profundidad(nodo)  // 0=mono, 1=2 etapas, 2=3 etapas
  // Copa Bebé: es raíz Y la cadena tiene al menos 2 evoluciones (profTotal >= 2)
  const copaBebe    = esRaiz && profTotal >= 2
  return {
    esFinal:  res?.esFinal ?? false,
    sinEvo:   esRaiz && nodo.evolves_to.length === 0,
    esBase:   esRaiz,
    copaBebe,
  }
}

export async function precargaBatch(ids) {
  const pendientes = ids.filter(id => !typeCache.has(id))
  // Limitar a 150 Pokémon máximo para evitar timeouts extremos
  const limite = pendientes.slice(0, 150)
  const BATCH = 50
  for (let i = 0; i < limite.length; i += BATCH) {
    await Promise.all(limite.slice(i, i+BATCH).map(async id => {
      try {
        const [pkR, spR] = await Promise.all([
          fetch(`https://pokeapi.co/api/v2/pokemon/${id}`),
          fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`)
        ])
        if (!pkR.ok || !spR.ok) return
        const [pk, sp] = await Promise.all([pkR.json(), spR.json()])
        nameCache.set(id, pk.name)
        typeCache.set(id, pk.types.map(t => t.type.name))
        bstCache.set(id, pk.stats.reduce((s,x) => s+x.base_stat, 0))
        // Solo fetch evolution chain si es necesario (Copa Bebé)
        if (sp.evolution_chain?.url) {
          const cR = await fetch(sp.evolution_chain.url)
          if (cR.ok) evoCache.set(id, analizarCadena((await cR.json()).chain, sp.name))
        } else {
          evoCache.set(id, { esFinal:true, sinEvo:true, esBase:true, copaBebe:false })
        }
      } catch {}
    }))
  }
}

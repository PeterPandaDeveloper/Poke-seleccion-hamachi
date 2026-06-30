import { Sonido } from './sonido.js'

const INFO = {
  region: {
    titulo: 'Filtro de región',
    cuerpo: `<p>Filtra los Pokémon disponibles por su Pokédex Nacional. Puedes elegir varias regiones a la vez.</p>
      <ul><li><b>Kanto</b> #1–151 · <b>Johto</b> #152–251 · <b>Hoenn</b> #252–386</li>
      <li><b>Sinnoh</b> #387–493 · <b>Unova</b> #494–649 · <b>Kalos</b> #650–721</li>
      <li><b>Alola</b> #722–809 (incluye formas regionales) · <b>Galar</b> #810–905</li>
      <li><b>Paldea</b> #906–1025 · <b>Hisui</b> formas de Hisui</li></ul>
      <p>Si ambos votan regiones distintas, se combinan.</p>`
  },
  evolucion: {
    titulo: 'Etapa evolutiva',
    cuerpo: `<ul>
      <li><b>Solo completamente evolucionados</b> — <em>Fully Evolved</em> en Smogon. No pueden evolucionar más.</li>
      <li><b>Sin ninguna evolución posible</b> — cadena de un solo Pokémon (Tauros, Lapras, Heracross).</li>
      <li><b>Solo primera etapa</b> — <em>NFE</em> en Smogon. Incluyen Pokémon que aún pueden evolucionar.</li>
      <li><b>🍼 Copa Bebé</b> — primera etapa de cadenas con <em>dos o más</em> evoluciones (Bulbasaur sí, Pikachu sí, Tauros no). Ideal para estrategia sin Legendarios ni Ultra Bestias.</li></ul>
      <p>⚠️ Estas opciones son mutuamente excluyentes.</p>`
  },
  bst: {
    titulo: 'BST — Base Stat Total',
    cuerpo: `<p>Suma de las 6 estadísticas base (PS, Atk, Def, SpAtk, SpDef, Vel).</p>
      <table style="width:100%;border-collapse:collapse;font-size:.92em">
        <tr style="background:#e8f5ee"><th style="padding:4px 8px;text-align:left">Pokémon</th><th style="padding:4px 8px;text-align:right">BST</th></tr>
        <tr><td style="padding:4px 8px">Caterpie</td><td style="text-align:right;padding:4px 8px">195</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:4px 8px">Pikachu</td><td style="text-align:right;padding:4px 8px">320</td></tr>
        <tr><td style="padding:4px 8px">Charizard</td><td style="text-align:right;padding:4px 8px">534</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:4px 8px">Mewtwo</td><td style="text-align:right;padding:4px 8px">680</td></tr>
      </table>
      <p>Rango 400–550 es popular para drafts equilibrados.</p>`
  },
  nodup: {
    titulo: 'Sin tipos duplicados',
    cuerpo: `<p>El sistema intenta no ofrecer Pokémon de tipos que ya tienes en tu equipo. Promueve cobertura amplia.</p>
      <p>Si el pool es muy pequeño, se ignora esta restricción para evitar bloqueos.</p>`
  },
  copabebe: {
    titulo: '🍼 Copa Bebé',
    cuerpo: `<p>Solo aparecen Pokémon que:</p>
      <ul><li>Son la <b>primera etapa</b> de una cadena evolutiva</li>
      <li>La cadena tiene <b>al menos 2 evoluciones</b> (ej: Bulbasaur → Ivysaur → Venusaur)</li>
      <li><b>No son Legendarios</b> ni Ultra Bestias ni Paradojas</li></ul>
      <p>Ejemplo: Bulbasaur ✅, Pikachu ✅ (por Raichu), Tauros ❌ (sin evolución), Moltres ❌ (legendario).</p>
      <p>Perfecto para partidas con Pokémon de bajo nivel y mucho potencial estratégico.</p>`
  }
}

export function mostrarInfo(clave) {
  const d = INFO[clave]; if (!d) return
  document.getElementById('info-titulo').textContent = d.titulo
  document.getElementById('info-cuerpo').innerHTML  = d.cuerpo
  document.getElementById('modal-info').style.display = 'flex'
  Sonido.click()
}

export function cerrarInfo(e) {
  if (!e || e.target===document.getElementById('modal-info'))
    document.getElementById('modal-info').style.display = 'none'
}

export function mostrarToast(msg, tipo='ok', dur=3000) {
  const el = document.getElementById('toast')
  el.textContent = msg; el.className = `toast toast-${tipo}`; el.style.display='block'; el.style.opacity='1'
  clearTimeout(el._t)
  el._t = setTimeout(()=>{
    el.style.opacity='0'
    setTimeout(()=>el.style.display='none',400)
  }, dur)
}

export function mostrarTutorial() {
  document.getElementById('modal-tutorial').style.display='flex'
}
export function cerrarTutorial() {
  document.getElementById('modal-tutorial').style.display='none'
  localStorage.setItem('tutorial-visto','1')
}

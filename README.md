# Desafío de Pokélección

Sistema de selección de Pokémon por turnos para duelos amistosos, con configuración
votada democráticamente entre los dos jugadores y exportación directa a Pokémon Showdown.

## Instalación

```bash
npm install
npm run build
node dist/server.js
```

El servidor arranca en `http://localhost:3000` (o el puerto definido en la variable
de entorno `PORT`).

## Estructura del proyecto

```
src/                  Servidor Node.js (TypeScript)
  config.ts           Constantes globales (timers, límites, TTL)
  tokens.ts           Generación y validación de tokens firmados (HMAC-SHA256)
  rateLimiter.ts      Limitador de peticiones por IP
  validators.ts       Validación estricta de todos los inputs del cliente
  sala.ts             Estado de las salas, TTL automático, chat, sistema de aviso (buzz)
  draft.ts            Lógica de juego: rondas, timers, Copa Bebé, configuración democrática
  routes.ts           Todos los endpoints HTTP
  server.ts           Arranque del servidor y archivos estáticos

public/               Cliente (HTML + ES Modules nativos, sin build step)
  index.html
  style.css
  js/
    constantes.js     Tipos, regiones, IDs de formas regionales, legendarios
    sonido.js         Efectos de sonido sintetizados (Web Audio API)
    api.js            Comunicación con el servidor, sesión, heartbeat
    modal.js          Modales de información, tutorial y notificaciones
    pokeapi.js        Caché y consultas a PokeAPI (nombres, tipos, evoluciones)
    lobby.js          Lógica del lobby: votación, configuración, sala
    draft.js          Lógica del draft: turnos, timer, chat, exportación
    main.js           Punto de entrada, conecta todo y expone funciones al HTML
```

## Variables de entorno opcionales

- `PORT` — puerto del servidor (por defecto 3000)
- `TOKEN_SECRET` — secreto para firmar tokens HMAC (si no se define, se genera
  uno aleatorio al arrancar; en producción con múltiples instancias conviene
  fijarlo para que los tokens sigan siendo válidos entre reinicios)

## Características

- Lobby con votación democrática de configuración (región múltiple, tipos,
  restricciones de evolución, Copa Bebé, BST, legendarios)
- Sistema de salas independientes con enlace compartible
- Selector de salas públicas activas
- Draft por turnos con cronómetro de 10 segundos y asignación aleatoria si se agota
- Chat en vivo y sistema de aviso (buzz) con cooldown anti-spam
- Tutorial guiado en la primera visita
- Exportación directa a formato Pokémon Showdown, con apertura en una pestaña nueva
- Reconexión automática tras recargar la página
- TTL automático: las salas sin jugadores conectados caducan a los 7 minutos
- Heartbeat: detecta jugadores que cerraron la pestaña sin avisar
- Tokens firmados con HMAC-SHA256, rate limiting por IP, validación estricta de inputs

# DumbJack21 — Documento de traspaso

Estado del código y todo lo que necesita otra persona o agente de IA para continuar.
Actualizado: 2026-11-10 · último commit publicado: `53e8eae`.

---

## 1. Qué es

Blackjack multijugador en línea (2 a 4 jugadores + dealer) con **cartas de acción para sabotear** a los
rivales. Estética **pixel art de saloon del viejo oeste**, todo dibujado y sonorizado con código (no hay
imágenes ni audios). Corre en el navegador; el servidor es Node con WebSockets.

- **En línea:** https://dumbjack21.onrender.com (Render, plan Free).
- **Repositorio:** https://github.com/AlexKiller19/dumbjack21 (público, rama `main`).
- **Idioma:** toda la interfaz, los textos del juego, los comentarios y los commits están en **español**.

### Reglas en una frase
Cada mano: apuestas → reparto → turnos (pedir, plantarse, doblar, dividir) → el dealer pide hasta 17 → se
paga. Cada vez que alguien **pide carta** se abre una **ventana de CAOS** (2/3/5 s) en la que cualquiera
juega una carta de acción. Al terminar el último turno hay un **CAOS FINAL** donde se encadenan cartas sin
límite (cada carta reinicia el reloj). Gana quien tenga más fichas al final; con 0 fichas quedas eliminado.
El manual completo para jugadores está dentro del juego (botón MANUAL, en `public/index.html`).

---

## 2. Cómo trabajar con el proyecto

```bash
cd dumbjack21
npm install
npm start            # http://localhost:8767
npm run lint         # ESLint (debe quedar sin errores)
npm test             # 37 pruebas de reglas (node:test), ~0.2 s
npm run test:e2e     # partida completa en Chrome con clics reales contra 2 bots, ~1 min
npm run check        # todo lo anterior: correrlo SIEMPRE antes de publicar
```

- `test:e2e` usa **playwright-core** con el **Google Chrome instalado** (`channel: 'chrome'`); no descarga
  navegadores. El servidor de la prueba arranca con `DJ21_FAST=1`, que acorta las pausas entre fases.
- **Bots de prueba:** crea una sala en el navegador y luego `node tools/bots.js CODIGO 2` (o con
  `wss://dumbjack21.onrender.com` como tercer argumento para probar en línea).
- **Gancho de depuración en el navegador:** `window.__dj` → `state`, `me`, `anim` (estado de animación),
  `send(msg)`, `playCard(carta)`, `musicMood()`.
- En la app de escritorio de Claude Code existe la config `dumbjack21` en `../.claude/launch.json`
  (`node dumbjack21/server.js`, puerto 8767).

### Particularidades de esta Mac
- `/usr/bin/git` falla porque no se aceptó la licencia de Xcode. Usar
  `/Library/Developer/CommandLineTools/usr/bin/git` (por ejemplo `export PATH=/Library/Developer/CommandLineTools/usr/bin:$PATH`).
- `swift` y `ffmpeg` no están disponibles.
- `gh` está autenticado como `AlexKiller19` con permiso `workflow` (puede subir cambios a `.github/workflows`).

---

## 3. Publicar

Render **no** publica solo (el servicio se creó desde un repo público sin conexión a GitHub):

1. `npm run check` en verde.
2. `git push` a `main`.
3. Panel de Render → servicio `dumbjack21` (`srv-dbp7v4rrjlhs73f4k6s0`) → **Manual Deploy → Deploy latest
   commit** → esperar *Deploy succeeded* (1-2 min).
4. Verificar en https://dumbjack21.onrender.com.

**Importante:**
- Cada publicación **reinicia el servidor y borra todas las salas en curso** (las partidas viven solo en
  memoria). Avisar al usuario antes de publicar si están jugando.
- El plan Free se duerme tras 15 min sin uso; la primera visita tarda ~30-50 s.
- Si alguna vez se edita el plan en Render, confirmar que siga en **$0/month** (al crear el servicio venía
  preseleccionado el de $7).
- Los errores del navegador de los jugadores llegan a los **logs de Render** como `[cliente SALA/pid] ...`;
  los del servidor como `[error en sala ...]` o `[error en mensaje]`.

---

## 4. Arquitectura

```
dumbjack21/
├── game.js            Reglas puras (clase Game). Sin red ni tiempo real: recibe `now` en cada método.
├── server.js          HTTP estático + WebSocket + salas con código, reconexión y tick cada 100 ms.
├── public/            Cliente (módulos ES, sin compilación ni dependencias)
│   ├── index.html     Estructura: lienzo, HUD, lobby, fin de partida, manual, historial.
│   ├── style.css      Estilos. Fuente "Press Start 2P" SOLO en múltiplos de 8 px (si no, se ve borrosa).
│   ├── main.js        Red, lobby, HUD, controles, toques en celular, historial, escalado del lienzo.
│   ├── render.js      Orquestador del dibujo: setState, animación de cartas por id, eventos, frame().
│   ├── scene.js       Saloon estático/animado: fondo, mesa, ventana día→noche, lámparas, barra, piano.
│   ├── npcs.js        Parroquianos de la barra, sus manías, peleas, enterrador, puertas batientes.
│   ├── characters.js  SKINS (12 personajes), drawChar, drawDealer, drawTomb, portrait().
│   ├── dialogue.js    Globos de texto: say() del dealer, patron() del público, charla de fondo.
│   ├── pixel.js       Fuente bitmap 3x5, iconos de cartas, drawCard, px().
│   ├── audio.js       Efectos (sfx.*) y música dinámica sintetizada con WebAudio.
│   ├── consts.js      W=480, H=256, SEATS, SHOE, DEALER_Y, CARD_W/H, paleta C.
│   ├── anim.js        `S`: estado de animación compartido por todos los módulos de dibujo.
│   └── favicon.svg
├── test/game.test.js        37 pruebas de reglas.
├── test/e2e/partida.test.js Partida completa en Chrome.
├── tools/bots.js            Bots de prueba por WebSocket.
├── eslint.config.js         ESLint 9 (flat config).
└── .github/workflows/ci.yml GitHub Actions: revisor + pruebas + partida en Chrome en cada push.
```

### Grafo de módulos del cliente (sin ciclos)
`consts` ← `pixel` ← `characters` ← `scene` ← `npcs` ← `render` ← `main`
`anim` y `dialogue` los usan `scene`, `npcs` y `render`; `audio` lo usan `npcs`, `render` y `main`.
`npcs` importa `say/patron` de `dialogue`; `dialogue` **no** debe importar `npcs` (se comunican por
`S.npcAnchors`).

### Flujo de datos
1. El cliente manda acciones por WebSocket (`send({ t: 'hit' })`, etc.).
2. `server.js` llama al método de `Game`; si devuelve un texto, es un error que se le reenvía al jugador.
3. `Game` emite **eventos** (`this.ev(tipo, datos)`) y marca `dirty`. Cada 100 ms el servidor hace
   `game.tick(now)` y, si hay cambios, **broadcast**: a cada jugador le manda `{ t: 'state', state:
   game.view(pid), events }`. Los eventos con campo `to` son privados (solo los recibe ese jugador).
4. El cliente: `setState(state, me, events)` en `render.js` → primero calcula pistas a partir de los eventos,
   luego `layout()` (posición destino de cada carta, animada por **id de carta**), luego `handleEvent()` para
   efectos, sonidos y diálogos. `main.js` actualiza el HUD (`updateUI`) y la música (`updateMusic`).
5. `frame(g, dt)` se llama en cada `requestAnimationFrame`. El bucle está protegido: un error se reporta
   al servidor (`clientError`) y el siguiente cuadro sigue.

---

## 5. Servidor y protocolo

### Fases (`game.phase`)
```
lobby → betting → dealing → turn ⇄ window → … → final → (rescue) → dealer → results ─┐
  ↑                                                                    └── betting (siguiente mano)
  └──────────────────── again ←──────────────── gameover ←── (última mano o ≤1 vivo)
```
- `window`: ventana de caos tras pedir (o doblar); al vencer se reparte la carta.
- `final`: caos final; se salta si nadie tiene cartas jugables.
- `rescue`: 5 s si alguien se pasó y tiene Arrepentimiento.
- Tiempos en `CFG` (`game.js`): apuestas 15 s, turno 20 s, caos `opts.chaos` s, resultados 6.5 s.

### Mensajes cliente → servidor
| `t` | Datos | Notas |
|---|---|---|
| `create` | `name, skin` | Crea sala de 4 letras; el creador es anfitrión. |
| `join` | `code, name, skin, token?` | Con `token` reconecta a su lugar. |
| `start` / `again` | — | Solo el anfitrión. `start` sortea los bancos. |
| `opt` | `key: hands\|chips\|chaos, value` | Solo anfitrión, en el lobby (`OPTIONS`). |
| `skin` | `skin` (0-11) | Personajes únicos por sala, solo en el lobby. |
| `bet` | `amount` | Se acota entre la apuesta mínima y tus fichas. |
| `hit` / `stand` / `double` / `split` | — | Solo en tu turno. |
| `play` | `uid, target (pid), th (mano), card (id propio)` | Carta de acción. |
| `emote` | `e` | Frases rápidas (1 cada 1.2 s). |
| `sync` | — | Pide el estado completo (el cliente lo manda solo si se queda sin noticias). |
| `clientError` | `where, msg, phase` | Se escribe en el log del servidor. |

### Mensajes servidor → cliente
`joined { code, you, token, host }` · `state { code, host, you, state, events }` · `error { msg }`.
El cliente guarda `{ code, token, name }` en `sessionStorage` para reconectarse.

### Salas y conexiones
- Salas en memoria (`rooms` en `server.js`); se borran 10 min después de quedar vacías.
- Al desconectarse hay **15 s de gracia** antes de sacar al jugador del lobby o pasar el rol de anfitrión.
  En plena partida el jugador no se elimina: se le auto-apuesta el mínimo y se planta solo.
- Cada mensaje y cada `tick` de sala van en `try/catch`: un error no tumba otras salas.

### Vista que recibe cada jugador (`game.view(pid)`)
`phase, handNo, maxHands, opts, turnId, turnHand, butter, msLeft, turnTime, windowPlayed, rescuers,
dealer { hand (la oculta como {hidden:true}), value }, players[] { id, name, seat, skin, chips, bet, status,
inHand, hands[] { cards, bet, status, value, limit, doubled }, canSplit, cards }, results, ranking, awards,
log` (últimas 50 líneas del historial). `cards` es la lista completa **solo para ti**; de los demás llega
solo cuántas tienen.

### Eventos (para animaciones, sonido, diálogos e historial)
`start hand bet deal natural turn window double split hit stand play boom shield fizzle abogado amnesia
butter lasso push steal stolen* mirror vidente peek* comunismo carousel giveback revive bust reward chain
finalChaos rescue reveal dealerHit settle eliminated gameover join leave skin seats option shuffle lobby`
(* privados). Cada evento público genera una línea de historial en `Game.addLog`.

---

## 6. Reglas implementadas (detalles que no son obvios)

- **Cartas de acción:** se empieza con 2, **+1 para todos cada mano**, +1 por Blackjack natural, +1 si tu
  sabotaje hace que otro se pase (no si te pasas tú solo). Tope 5. Pesos al robar en `ACTIONS`.
- **14 cartas:** Granada +5, Granada +10, Amnesia, Mano de Mantequilla, Lazo, Empujón, Espejo Cuántico,
  Vidente, Comunismo, Carterista, Carrusel, Arrepentimiento (`devolver`), y las pasivas Escudo de Goma y
  Abogado del Diablo (se activan solas).
- **Objetivos:** se apunta a una **mano** `{ pid, h }` (por las manos divididas). Granada, Amnesia y Empujón
  también se pueden usar **en tu propia mano** (`SELF_OK`, en `game.js` y en `main.js`).
- **Amnesia** quita la carta **más alta** (el As cuenta 11; las granadas solo si no hay otra).
- **Carrusel, Comunismo y Espejo** afectan **todas** las manos, también plantadas y pasadas. Una mano pasada
  que vuelve a valer ≤ su límite **revive** (`recheck`): queda `playing` si su turno aún no llega, si no
  `stood`.
- **Escudo** rebota Granada/Amnesia a otra mano al azar (puede ser la del atacante) y no se re-rebota; no
  rebota tus propias cartas. **Abogado** sube el límite a 25 si te pasas (hasta 25), pero pierde contra un
  21 exacto del dealer.
- **Dividir:** solo una vez, dos cartas del mismo valor; una mano dividida que llega a 21 no es Blackjack
  natural.
- **Caos final:** sin límite de cartas por jugador; cada carta reinicia el reloj (800 ms si ya nadie tiene
  cartas).
- **Bancos al azar** en cada `start()`; el turno sigue el orden de los bancos.
- **Premios** al final (`endGame`): el más traicionero, dinamitero, imán de granadas, etc.
- **La carta "Soborno" se eliminó a pedido del usuario. No volver a proponerla.**

---

## 7. Cliente: lo que hay que saber antes de tocarlo

- **Resolución interna 480×256** (`consts.js`), escalada con `image-rendering: pixelated` a múltiplos
  enteros de pixel físico (`fit()` en `main.js`; si eso deja la mesa muy chica usa pasos de 0.5x).
- **Fuente bitmap del lienzo** (`pixel.js`): solo MAYÚSCULAS, números y algunos signos (`¡¿!?.,:+-/$%#*=()<>'`).
  `drawText` quita acentos y convierte Ñ→N. Glifos que no existen salen como `?`.
- **Fuente del HTML:** "Press Start 2P" de Google Fonts; usar solo tamaños múltiplos de 8 px.
- **Asientos:** `SEATS[seat]` da `x` (centro), `cy` (arriba de las cartas) y `ay` (arriba del avatar).
- **Orden de dibujo** en `frame()`: fondo → ventana, letrero, WANTED → parroquianos (`drawNPCs`, incluye
  puertas y barra) → pianista → dealer (recortado detrás de la mesa) → lámparas, ratón → asientos → cartas
  → etiquetas de mano → cartas que salen → proyectiles, partículas → globos → banner de caos → textos.
- **Personajes:** `SKINS` en `characters.js`; el color del jugador es el de su personaje (`skinColor(p)`).
- **Diálogos:** `say(lineas, duración, vars, prioridad)` (0 charla, 1 normal, 2 momentos grandes; una frase
  de menor prioridad no pisa a otra reciente). `patron(lineas, dur, vars, lugar?)` habla desde la barra.
- **Parroquianos (`npcs.js`):** `S.npcs[5]` (lugares x = 70, 94, 120, 146, 170), `S.walkers` (enterrador y
  recién llegados), `S.fight` (`argue → brawl → ko → collect → newcomer`), `S.fightNext` (40-75 s).
  Para fotografiar un estado: modificar `__dj.anim.fight/walkers/npcs` y llamar `frame` de `render.js`.
- **Música (`audio.js`):** ánimos `lobby, play, last, chaos, final, dealer`; `setMusicMood(m, urgente)` cambia
  al siguiente compás o de inmediato. `updateMusic()` en `main.js` decide según la fase. Al usuario le gusta
  la melodía base: conservarla.
- **Celular:** `html.touch` cuando no hay mouse; primer toque en una carta la explica y el segundo la juega
  (`armedUid`). Vibración (`buzz`), pantalla encendida (Wake Lock) y botón de pantalla completa.
- **Historial:** lo arma el servidor (`addLog`) y llega en `state.log`; el panel `#log-panel` se acopla a la
  derecha en pantallas ≥1300 px y es una hoja inferior en celular.
- **Pruebas en el panel del navegador de Claude:** si el panel está oculto, `requestAnimationFrame` se pausa
  y las capturas llegan atrasadas; usar `read_page`/`javascript_tool` o llamar `frame` a mano.

---

## 8. Pendientes conocidos

1. ~~Subir el workflow de GitHub Actions~~: hecho el 2026-11-10; la primera corrida pasó (revisor, 37
   pruebas y partida en Chrome).
2. **Publicación automática:** requiere que el usuario agregue el secreto `RENDER_DEPLOY_HOOK` en GitHub
   (Settings → Secrets → Actions) con el Deploy Hook de Render. Es un secreto: lo hace el usuario, no un
   agente.
3. **Congelamiento reportado** (video del 2026-11-10, pantalla congelada en la fase de apuestas): no se pudo
   reproducir. Se agregaron recuperación de errores, `sync`, aviso de sala cerrada y reporte a logs. Si el
   usuario lo vuelve a ver, revisar los logs de Render buscando `[cliente`.
4. **Sin probar en teléfono real:** vibración, Wake Lock, pantalla completa y modo horizontal solo se
   probaron emulando.
5. **Las partidas no sobreviven a un reinicio** del servidor (todo en memoria).
6. **Servidor público sin límites:** no hay tope de salas por IP, ni `maxPayload` en `WebSocketServer` (por
   defecto 100 MB), ni límite de `clientError` en el servidor.
7. **Balance de cartas sin medir:** los pesos de `ACTIONS` se pusieron a ojo; sospecha de que Carrusel y
   Comunismo son muy fuertes.

---

## 9. Siguiente paso acordado: jugar solo

El usuario preguntó cómo jugar de uno. Ideas propuestas, en este orden de recomendación:

1. **Bots en la mesa** (siguiente tarea): botón "AGREGAR BOT" del anfitrión para llenar sillas; bots con
   personalidad (El Novato, La Tramposa, El Calculador) que viven en el servidor. Base sugerida: la lógica
   de `tools/bots.js`, movida a un módulo del servidor que reciba `game.view(botId)` y llame a los métodos de
   `Game` directamente (sin WebSocket). Deben ocupar un lugar en `players` con `connected: true` y una marca
   `bot: true`; cuidar `alive()`, la gracia de reconexión y el rol de anfitrión.
2. **Campaña "La Ruta del Forajido":** pueblos con dificultad creciente, dealer tramposo al final, desbloqueo
   de personajes, progreso en `localStorage`.
3. **Desafío diario:** baraja con semilla fija del día (`Game` ya acepta `rng`) y ranking.
4. **Acertijos:** situaciones armadas que enseñan combos.

---

## 10. Cómo trabaja el usuario (importante para cualquier agente)

- Escribe en **español**; todo lo visible en el juego va en español.
- **Prefiere que se le pregunte antes de asumir reglas o decisiones de diseño.** Ofrecer 2-4 opciones con una
  recomendada.
- Al terminar un cambio: probarlo (pruebas + navegador), contar qué cambió y **preguntar antes de publicar**.
- En cada respuesta incluir **dónde abrir el juego**: en línea y `http://localhost:8767`.
- Le gusta el juego "lleno de vida": animaciones, diálogos, reacciones del público.

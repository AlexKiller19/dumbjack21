# DumbJack21

Blackjack de sabotaje multijugador (2 a 4 jugadores) en un saloon del viejo oeste en pixel art. Corre en el navegador.

**Jugar en línea:** https://dumbjack21.onrender.com

## Jugar en tu Mac

```bash
cd dumbjack21
npm install
npm start
```

Abre http://localhost:8767, crea una sala y comparte el código de 4 letras (o el botón COPIAR LINK).
Quien esté en tu mismo WiFi puede entrar con `http://<IP-de-tu-Mac>:8767`.

## Publicarlo en internet (gratis) con Render

1. Sube la carpeta `dumbjack21` a un repositorio de GitHub.
2. En https://render.com → **New → Web Service** → conecta el repositorio.
3. Build command: `npm install` · Start command: `npm start` · Plan: Free.
4. Render asigna el puerto con la variable `PORT` (el servidor ya la usa) y te da una URL `https://….onrender.com`. Los WebSockets funcionan sin configurar nada.

> Como el servicio se creó desde un repo público, Render **no** redespliega solo: después de un `git push`, usa **Manual Deploy → Deploy latest commit** en el panel.
>
> En el plan gratis el servidor se duerme tras 15 min sin uso; la primera visita tarda ~30 s en despertarlo.

## Comandos

```bash
npm start          # servidor en http://localhost:8767
npm run lint       # revisor de código (ESLint)
npm test           # pruebas de reglas
npm run test:e2e   # partida completa en Chrome contra 2 bots (necesita Google Chrome instalado)
npm run check      # todo lo anterior
```

## Publicación automática

GitHub Actions (`.github/workflows/ci.yml`) corre el revisor, las pruebas y la partida en Chrome en cada push.
En `main`, si todo pasa, avisa a Render para publicar. Para activarlo, copia el **Deploy Hook** de Render
(Settings → Deploy Hook) en un secreto del repositorio llamado `RENDER_DEPLOY_HOOK`
(GitHub → Settings → Secrets and variables → Actions). Sin ese secreto, solo corren las pruebas.

> Cada publicación reinicia el servidor y termina las partidas en curso.

## Estructura

- `game.js`: reglas (autoritativas en el servidor, sin red). Los parámetros están en `CFG` y los pesos de las cartas en `ACTIONS`.
- `server.js`: archivos estáticos + WebSocket + salas con código y reconexión.
- `public/render.js`: orquestador del dibujo (estado de la mesa, animación de cartas, efectos y eventos).
- `public/scene.js`: el saloon (fondo, mesa, ventana, lámparas, barra, pianista).
- `public/npcs.js`: parroquianos de la barra, sus manías, peleas, enterrador y puertas batientes.
- `public/characters.js`: los 12 personajes y el dealer.
- `public/dialogue.js`: globos de texto del dealer y el público.
- `public/pixel.js`: fuente bitmap, iconos y cartas. `public/consts.js` y `public/anim.js`: constantes y estado compartido.
- `public/audio.js`: efectos y música honky-tonk sintetizados.
- `public/main.js`: lobby, HUD, controles.
- `test/`: pruebas de reglas; `test/e2e/`: partida completa en Chrome.
- `tools/bots.js`: bots de prueba por WebSocket (`node tools/bots.js CODIGO [cantidad] [url]`).
- `HANDOFF.md`: documentación técnica completa para continuar el proyecto.

## Atajos

`H`/espacio pedir · `S` plantarse · `D` doblar · `V` dividir · `1`-`5` jugar carta · `Esc` cancelar objetivo.

El manual completo está dentro del juego (botón MANUAL).

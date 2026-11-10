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

## Estructura

- `game.js`: reglas (autoritativas en el servidor, sin red). Los parámetros están en `CFG` y los pesos de las cartas en `ACTIONS`.
- `server.js`: archivos estáticos + WebSocket + salas con código y reconexión.
- `public/render.js`: saloon, personajes, cartas y efectos (todo dibujado con código, sin imágenes).
- `public/audio.js`: efectos y música honky-tonk sintetizados.
- `public/main.js`: lobby, HUD, controles.
- `test/`: `npm test` prueba las reglas.

## Atajos

`H`/espacio pedir · `S` plantarse · `D` doblar · `V` dividir · `1`-`5` jugar carta · `Esc` cancelar objetivo.

El manual completo está dentro del juego (botón MANUAL).

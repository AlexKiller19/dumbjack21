'use strict';
// Prueba de punta a punta: levanta el servidor, abre el juego en Chrome y juega una
// partida completa haciendo clic en los botones reales contra 2 bots por WebSocket.
// Falla si aparece cualquier error en el navegador o en el servidor.
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const WebSocket = require('ws');
const { chromium } = require('playwright-core');

const PORT = 18767 + Math.floor(Math.random() * 1000);
const URL = `http://localhost:${PORT}`;

function startServer() {
  const proc = spawn(process.execPath, [path.join(__dirname, '..', '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), DJ21_FAST: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  proc.stdout.on('data', d => logs.push(String(d)));
  proc.stderr.on('data', d => logs.push(String(d)));
  const ready = new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('el servidor no arrancó')), 8000);
    proc.stdout.on('data', d => { if (String(d).includes('escuchando')) { clearTimeout(t); res(); } });
  });
  return { proc, logs, ready };
}

// Bot sencillo: apuesta, pide hasta 15, a veces lanza cartas en la ventana de caos.
function bot(code, name) {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
  let busy = false;
  ws.on('open', () => send({ t: 'join', code, name }));
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.t !== 'state' || busy) return;
    const st = m.state, p = st.players.find(q => q.id === m.you); if (!p) return;
    const later = (fn) => { busy = true; setTimeout(() => { busy = false; fn(); }, 150); };
    if (st.phase === 'betting' && p.status === 'betting') later(() => send({ t: 'bet', amount: 100 }));
    else if (st.phase === 'turn' && st.turnId === m.you) {
      const hd = p.hands[st.turnHand];
      later(() => send({ t: hd && hd.value < 15 ? 'hit' : 'stand' }));
    } else if ((st.phase === 'window' || st.phase === 'final') && !st.windowPlayed.includes(m.you) && Math.random() < 0.4) {
      const a = p.cards.find(c => ['granada5', 'granada10', 'amnesia'].includes(c.type));
      const rival = st.players.find(q => q.id !== m.you && q.inHand && q.hands[0] && q.hands[0].status !== 'bust');
      if (a && rival) later(() => send({ t: 'play', uid: a.uid, target: rival.id, th: 0 }));
    }
  });
  return ws;
}

test('partida completa en el navegador sin errores', { timeout: 240000 }, async () => {
  const server = startServer();
  await server.ready;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const bots = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/WebSocket connection|Failed to load resource/.test(m.text())) pageErrors.push(m.text()); });
    // archivos que no existen: se reporta cuál (más útil que el mensaje genérico de la consola)
    page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(URL)) pageErrors.push(`${r.status()} ${r.url().slice(URL.length)}`); });

    await page.goto(URL);
    await page.fill('#name', 'Prueba');
    await page.click('#btn-create');
    await page.waitForFunction(() => window.__dj && window.__dj.state && window.__dj.state.phase === 'lobby');
    const code = await page.evaluate(() => new URLSearchParams(location.search).get('sala'));
    bots.push(bot(code, 'Bot A'), bot(code, 'Bot B'));
    await page.waitForFunction(() => window.__dj.state.players.length === 3);

    // opciones de sala desde los botones del anfitrión: 5 manos y caos de 2 s
    await page.click('#options button[data-k="hands"][data-v="5"]');
    await page.click('#options button[data-k="chaos"][data-v="2"]');
    await page.waitForFunction(() => window.__dj.state.opts.hands === 5 && window.__dj.state.opts.chaos === 2);
    await page.click('#btn-start');

    // jugar con clics reales hasta que termine la partida
    const deadline = Date.now() + 200000;
    let played = 0;
    while (Date.now() < deadline) {
      const st = await page.evaluate(() => {
        const s = window.__dj.state, me = s.players.find(p => p.id === window.__dj.me);
        return { phase: s.phase, myTurn: s.turnId === window.__dj.me, betting: me.status === 'betting', value: me.hands[s.turnHand] ? me.hands[s.turnHand].value : 0 };
      });
      if (st.phase === 'gameover') break;
      try {
        if (st.phase === 'betting' && st.betting) await page.click('#controls [data-bet="100"]', { timeout: 1000 });
        else if (st.phase === 'turn' && st.myTurn) {
          // a veces juega una carta de acción con clic (y elige objetivo si hace falta)
          const card = await page.$('#hand .acard.playable');
          if (card && played < 6 && Math.random() < 0.5) {
            await card.click(); played++;
            const target = await page.$('#controls [data-target], #controls [data-own]');
            if (target) await target.click();
          } else await page.click(`#controls [data-act="${st.value < 15 ? 'hit' : 'stand'}"]`, { timeout: 1000 });
        }
      } catch { /* el botón cambió mientras se hacía clic: se reintenta en la siguiente vuelta */ }
      await page.waitForTimeout(250);
    }

    const final = await page.evaluate(() => ({
      phase: window.__dj.state.phase,
      rankingVisible: !document.getElementById('gameover').classList.contains('hidden'),
      rows: document.querySelectorAll('#ranking li').length,
      logLines: document.querySelectorAll('#log li').length,
      logText: document.getElementById('log').innerText,
    }));
    assert.equal(final.phase, 'gameover', 'la partida debe terminar');
    assert.ok(final.rankingVisible && final.rows === 3, 'se muestra la tabla final con 3 jugadores');
    assert.ok(final.logLines >= 20, 'el historial registra las jugadas');
    assert.match(final.logText, /MANO 5/, 'el historial llega hasta la última mano');
    assert.match(final.logText, /Fin de la partida/);

    // la animación sigue viva al final
    const t1 = await page.evaluate(() => window.__dj.anim.time);
    await page.waitForTimeout(500);
    const t2 = await page.evaluate(() => window.__dj.anim.time);
    assert.ok(t2 > t1, 'la animación sigue corriendo');

    // "Otra partida" regresa a la sala
    await page.click('#btn-again');
    await page.waitForFunction(() => window.__dj.state.phase === 'lobby');

    assert.deepEqual(pageErrors, [], 'sin errores en el navegador');
    const serverErrors = server.logs.join('').split('\n').filter(l => /\[error|\[cliente/.test(l));
    assert.deepEqual(serverErrors, [], 'sin errores en el servidor');
  } finally {
    for (const b of bots) b.close();
    await browser.close();
    server.proc.kill();
  }
});

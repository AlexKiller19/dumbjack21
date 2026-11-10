import { initAudio, sfx, toggleMusic, toggleSfx } from './audio.js';
import { W, H, frame, setState, anim, iconCanvas, seatAt, SEAT_COLORS, SEAT_CHARS } from './render.js';

const $ = (id) => document.getElementById(id);
const cv = $('cv'), g = cv.getContext('2d');
g.imageSmoothingEnabled = false;

const CARDS = {
  granada5:    { name: 'Granada +5', cat: 'agresion', desc: 'Suma +5 a la mano de un rival. Letal si ya va en 17 o más.' },
  granada10:   { name: 'Granada +10', cat: 'agresion', desc: 'Suma +10 a la mano de un rival. Rara y devastadora.' },
  amnesia:     { name: 'Amnesia', cat: 'agresion', desc: 'Un rival descarta la última carta que pidió.' },
  mantequilla: { name: 'Mano de Mantequilla', cat: 'agresion', desc: 'El siguiente jugador que pida carta recibe DOS a la vez.' },
  espejo:      { name: 'Espejo Cuántico', cat: 'control', desc: 'Intercambias tu mano con un rival que todavía no se ha plantado.' },
  vidente:     { name: 'Vidente', cat: 'control', desc: 'Ves la carta oculta del dealer y la siguiente del mazo (solo tú).' },
  comunismo:   { name: 'Comunismo', cat: 'control', desc: 'Todas las manos vivas pasan a valer el promedio (redondeado hacia abajo).' },
  escudo:      { name: 'Escudo de Goma', cat: 'defensa', passive: true, desc: 'PASIVA: rebota la próxima Granada o Amnesia que te lancen a un jugador al azar (puede ser el atacante).' },
  abogado:     { name: 'Abogado del Diablo', cat: 'defensa', passive: true, desc: 'PASIVA: si te pasas de 21 (hasta 25), tu límite sube a 25 esta mano. Pierde contra un 21 exacto.' },
};
const CAT_NAME = { agresion: 'AGRESIÓN', control: 'MANIPULACIÓN', defensa: 'DEFENSA' };
const EMOTES = ['YEEHAW!', 'JA JA JA', 'NOOO!', 'TRAMPA!', 'GG', 'TE VOY A...'];

let ws = null, me = null, host = null, code = null, state = null, stateAt = 0;
let selected = null; // { uid, type, targets }
let lastHudKey = '';

// ---------------- red ----------------
function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  ws.onopen = () => {
    const sess = JSON.parse(sessionStorage.getItem('dj21') || 'null');
    if (sess && sess.code && sess.token) ws.send(JSON.stringify({ t: 'join', code: sess.code, token: sess.token, name: sess.name }));
  };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'joined') {
      me = m.you; code = m.code; host = m.host;
      const name = $('name').value || 'Forastero';
      sessionStorage.setItem('dj21', JSON.stringify({ code: m.code, token: m.token, name }));
      history.replaceState(null, '', '?sala=' + m.code);
    } else if (m.t === 'state') {
      me = m.you; code = m.code; host = m.host;
      state = m.state; stateAt = performance.now();
      setState(state, me, m.events);
      onEvents(m.events);
      updateUI();
    } else if (m.t === 'error') {
      toast(m.msg); sfx.error();
      if (!state && /No existe/.test(m.msg)) sessionStorage.removeItem('dj21');
    }
  };
  ws.onclose = () => { setTimeout(connect, 1200); if (state) toast('Conexión perdida, reconectando…'); };
}
const send = (o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function onEvents(events) {
  for (const e of events) {
    if (e.type === 'start') { selected = null; }
    if (e.type === 'turn' || e.type === 'window' || e.type === 'hand') { if (selected && !canPlayNow()) cancelTarget(); }
  }
}

let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }

// ---------------- helpers ----------------
const myP = () => state && state.players.find(p => p.id === me);
function canPlayNow() {
  const p = myP(); if (!p || !p.inHand || p.status === 'out') return false;
  if (state.phase === 'turn') return state.turnId === me;
  if (state.phase === 'window') return !state.windowPlayed.includes(me);
  return false;
}
function validTargets(type) {
  const p = myP();
  return state.players.filter(q => {
    if (q.id === me || !q.inHand) return false;
    if (type === 'espejo') return q.status === 'playing' && p.status !== 'bust';
    if (!(q.status === 'playing' || q.status === 'stood')) return false;
    if (type === 'amnesia') return q.hand.length > 2;
    return true;
  }).map(q => q.id);
}

function playCard(a) {
  initAudio();
  const def = CARDS[a.type];
  if (def.passive) { toast('Es pasiva: se activa sola cuando la necesites'); return; }
  if (!canPlayNow()) { toast(state.phase === 'turn' ? 'Espera la ventana de CAOS (cuando alguien pida carta)' : 'Ahora no se pueden jugar cartas'); sfx.error(); return; }
  if (['granada5', 'granada10', 'amnesia', 'espejo'].includes(a.type)) {
    const targets = validTargets(a.type);
    if (!targets.length) { toast('No hay objetivos válidos para esta carta'); sfx.error(); return; }
    selected = { uid: a.uid, type: a.type, targets };
    anim.targeting = targets; cv.classList.add('targeting');
    sfx.click(); lastHudKey = ''; updateUI();
    return;
  }
  send({ t: 'play', uid: a.uid });
}
function fireAt(pid) {
  if (!selected) return;
  send({ t: 'play', uid: selected.uid, target: pid });
  cancelTarget();
}
function cancelTarget() { selected = null; anim.targeting = null; cv.classList.remove('targeting'); lastHudKey = ''; updateUI(); }

// ---------------- UI ----------------
function updateUI() {
  const inLobby = !state || state.phase === 'lobby';
  $('lobby').classList.toggle('hidden', !inLobby);
  $('hud').classList.toggle('hidden', inLobby);
  $('gameover').classList.toggle('hidden', !state || state.phase !== 'gameover');
  $('roomtag').textContent = code ? `SALA ${code}` : '';
  if (inLobby) return renderLobby();
  if (state.phase === 'gameover') renderGameOver();
  renderHUD();
}

function renderLobby() {
  $('home').classList.toggle('hidden', !!state);
  $('room').classList.toggle('hidden', !state);
  if (!state) return;
  $('room-code').textContent = code;
  $('players').innerHTML = state.players.sort((a, b) => a.seat - b.seat).map(p => `
    <li style="border-color:${SEAT_COLORS[p.seat]}">
      <span class="who">${esc(p.name)}${p.id === me ? ' (TÚ)' : ''}${p.id === host ? ' 👑' : ''}</span>
      <span class="char">${SEAT_CHARS[p.seat]}</span>
    </li>`).join('') + Array.from({ length: 4 - state.players.length }, () => `<li style="border-color:#555"><span class="who muted">Silla vacía…</span></li>`).join('');
  const isHost = me === host;
  const n = state.players.length;
  $('btn-start').classList.toggle('hidden', !isHost);
  $('btn-start').disabled = n < 2;
  $('wait-msg').textContent = isHost ? (n < 2 ? 'Comparte el código: se necesitan al menos 2 jugadores.' : '¡Listos! Empieza cuando quieras.') : 'Esperando a que el anfitrión (👑) empiece…';
}

function renderGameOver() {
  const r = state.ranking || [];
  $('ranking').innerHTML = r.map((x, i) => {
    const p = state.players.find(q => q.id === x.pid); if (!p) return '';
    return `<li class="${i === 0 ? 'first' : ''}" style="border-color:${SEAT_COLORS[p.seat]}"><span>${i === 0 ? '👑' : (i + 1) + '.'}</span><span class="n">${esc(p.name)}${p.id === me ? ' (TÚ)' : ''}</span><span>$${x.chips}</span></li>`;
  }).join('');
  $('btn-again').classList.toggle('hidden', me !== host);
  $('again-msg').textContent = me === host ? '' : 'Esperando a que el anfitrión inicie otra partida…';
}

function renderHUD() {
  const p = myP(); if (!p) return;
  const turnP = state.players.find(q => q.id === state.turnId);
  const key = JSON.stringify([state.phase, state.turnId, p.status, p.cards, p.chips, p.bet, p.hand.length, state.windowPlayed, selected && selected.uid, state.handNo, p.value]);
  // info (siempre)
  $('me-info').innerHTML = `<div style="color:${SEAT_COLORS[p.seat]}">${esc(p.name)} · ${SEAT_CHARS[p.seat]}</div>
    <div class="big">$${p.chips}</div>
    <div>APUESTA: $${p.bet}${p.doubled ? ' (x2)' : ''}</div>
    <div>MANO ${state.handNo}/${state.maxHands}</div>`;
  if (key === lastHudKey) return updateTimers();
  lastHudKey = key;

  // cartas de acción
  const hand = $('hand');
  const playable = canPlayNow();
  hand.innerHTML = '';
  if (!p.cards.length) hand.innerHTML = '<div class="empty-hand">Sin cartas. Gana con Blackjack o sabotea a alguien para conseguir más.</div>';
  p.cards.forEach((a, i) => {
    const d = CARDS[a.type];
    const el = document.createElement('div');
    el.className = `acard ${d.cat}` + (d.passive ? ' passive' : playable ? ' playable' : ' disabled') + (selected && selected.uid === a.uid ? ' selected' : '');
    el.innerHTML = `<div class="stripe"></div><div class="cat">${d.passive ? 'PASIVA' : CAT_NAME[d.cat]}</div>`;
    const ic = document.createElement('canvas'); ic.width = 8; ic.height = 8;
    ic.getContext('2d').drawImage(iconCanvas(a.type), 0, 0);
    el.appendChild(ic);
    const nm = document.createElement('div'); nm.textContent = d.name; el.appendChild(nm);
    const k = document.createElement('div'); k.className = 'key'; k.textContent = `[${i + 1}]`; el.appendChild(k);
    el.onmouseenter = () => { $('cardinfo').innerHTML = `<b style="color:#f2c14e">${d.name}:</b> ${d.desc}`; sfx.hover(); };
    el.onclick = () => playCard(a);
    hand.appendChild(el);
  });

  // controles
  const c = $('controls');
  let html = '';
  if (selected) {
    html = `<div class="status">ELIGE A TU VÍCTIMA<br><small>(o haz clic en su asiento)</small></div><div class="row">` +
      selected.targets.map(id => { const q = state.players.find(x => x.id === id); return `<button class="target" data-target="${id}">${esc(q.name)} (${q.value})</button>`; }).join('') +
      `</div><div class="row"><button class="mini" data-act="cancel">CANCELAR [ESC]</button></div>`;
  } else if (state.phase === 'betting') {
    if (p.status === 'betting') {
      const opts = [50, 100, 250, 500].filter(v => v < p.chips);
      html = `<div class="status">¿CUÁNTO APUESTAS? <span class="timer"></span></div><div class="row">` +
        opts.map(v => `<button data-bet="${v}">$${v}</button>`).join('') +
        `<button class="danger" data-bet="${p.chips}">TODO $${p.chips}</button></div>`;
    } else html = `<div class="status">Apuesta lista.<br>Esperando a los demás… <span class="timer"></span></div>`;
  } else if (state.phase === 'turn' && state.turnId === me) {
    const canDouble = p.hand.length === 2 && p.chips >= p.bet;
    html = `<div class="status">¡TU TURNO! TIENES ${p.value}${p.limit > 21 ? '/' + p.limit : ''} <span class="timer"></span></div>
      <div class="row"><button class="hit" data-act="hit">PEDIR [H]</button><button class="stand" data-act="stand">PLANTARSE [S]</button></div>
      <div class="row"><button class="double" data-act="double" ${canDouble ? '' : 'disabled'}>DOBLAR [D]</button></div>`;
  } else if (state.phase === 'window') {
    const who = state.turnId === me ? 'TÚ PIDES CARTA' : `${esc(turnP ? turnP.name : '?')} PIDE CARTA`;
    const can = playable && p.cards.some(a => !CARDS[a.type].passive);
    html = `<div class="status" style="color:#ff5a4a">¡CAOS! ${who}<br>${can ? '¡Juega una carta YA!' : state.windowPlayed.includes(me) ? 'Ya jugaste tu carta.' : 'Nada que jugar…'}</div>`;
  } else if (state.phase === 'turn') {
    html = `<div class="status">Turno de <b style="color:${SEAT_COLORS[turnP ? turnP.seat : 0]}">${esc(turnP ? turnP.name : '?')}</b><br><small>Cuando pida carta podrás sabotearlo</small></div>`;
  } else if (state.phase === 'dealing') html = `<div class="status">Repartiendo…</div>`;
  else if (state.phase === 'dealer') html = `<div class="status">El dealer juega…</div>`;
  else if (state.phase === 'results') {
    const r = state.results && state.results.list.find(x => x.pid === me);
    const txt = !r ? 'Resultados' : r.res === 'win' ? `¡GANASTE +$${r.net}!` : r.res === 'blackjack' ? `¡BLACKJACK! +$${r.net}` : r.res === 'push' ? 'EMPATE' : `PERDISTE $${-r.net}`;
    html = `<div class="status">${txt}<br><small>Siguiente mano en <span class="timer"></span></small></div>`;
  }
  if (p.status === 'out' && state.phase !== 'gameover') html = `<div class="status" style="color:#ff5a4a">ELIMINADO<br><small>Te quedaste sin fichas. Mira el caos desde la tumba.</small></div>`;
  c.innerHTML = html;
  c.querySelectorAll('[data-bet]').forEach(b => b.onclick = () => { initAudio(); send({ t: 'bet', amount: +b.dataset.bet }); });
  c.querySelectorAll('[data-act]').forEach(b => b.onclick = () => act(b.dataset.act));
  c.querySelectorAll('[data-target]').forEach(b => b.onclick = () => fireAt(b.dataset.target));
  updateTimers();
}

function updateTimers() {
  if (!state) return;
  const left = Math.max(0, state.msLeft - (performance.now() - stateAt));
  state._msLeftLocal = left;
  document.querySelectorAll('#controls .timer').forEach(el => el.textContent = Math.ceil(left / 1000) + 's');
}

function act(a) {
  initAudio();
  if (a === 'cancel') return cancelTarget();
  send({ t: a });
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------------- lobby / botones ----------------
$('name').value = (JSON.parse(sessionStorage.getItem('dj21') || 'null') || {}).name || localStorage.getItem('dj21name') || '';
const qs = new URLSearchParams(location.search).get('sala');
if (qs) $('code').value = qs.toUpperCase();
function nameVal() { const n = $('name').value.trim() || 'Forastero'; localStorage.setItem('dj21name', n); return n; }
$('btn-create').onclick = () => { initAudio(); sessionStorage.removeItem('dj21'); send({ t: 'create', name: nameVal() }); };
$('btn-join').onclick = () => {
  initAudio();
  const c = $('code').value.trim().toUpperCase();
  if (c.length !== 4) return toast('El código tiene 4 letras');
  sessionStorage.removeItem('dj21');
  send({ t: 'join', code: c, name: nameVal() });
};
$('code').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join').click(); });
$('name').addEventListener('keydown', e => { if (e.key === 'Enter') ($('code').value ? $('btn-join') : $('btn-create')).click(); });
$('btn-start').onclick = () => { initAudio(); send({ t: 'start' }); };
$('btn-again').onclick = () => send({ t: 'again' });
$('btn-copy').onclick = async () => {
  const url = `${location.origin}${location.pathname}?sala=${code}`;
  try { await navigator.clipboard.writeText(url); toast('¡Link copiado! Mándalo a tus amigos'); } catch { toast(url); }
};
$('btn-music').onclick = (e) => { initAudio(); e.target.textContent = 'MUSICA: ' + (toggleMusic() ? 'SI' : 'NO'); };
$('btn-sfx').onclick = (e) => { initAudio(); e.target.textContent = 'SFX: ' + (toggleSfx() ? 'SI' : 'NO'); };
$('btn-rules').onclick = () => $('rules').classList.remove('hidden');
$('btn-close-rules').onclick = () => $('rules').classList.add('hidden');
$('rules-cards').innerHTML = Object.entries(CARDS).map(([k, d]) => `<div class="rc" data-ic="${k}"><span></span><div><b>${d.name}</b> <small>(${d.passive ? 'PASIVA' : CAT_NAME[d.cat]})</small><br>${d.desc}</div></div>`).join('');
document.querySelectorAll('.rc').forEach(el => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; c.getContext('2d').drawImage(iconCanvas(el.dataset.ic), 0, 0); el.querySelector('span').replaceWith(c); });
$('emotes').innerHTML = EMOTES.map(e => `<button class="mini" data-e="${e}">${e}</button>`).join('');
$('emotes').querySelectorAll('button').forEach(b => b.onclick = () => send({ t: 'emote', e: b.dataset.e }));

// clic en asientos (para elegir objetivo)
cv.addEventListener('click', (ev) => {
  if (!selected) return;
  const r = cv.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width * W, y = (ev.clientY - r.top) / r.height * H;
  const pid = seatAt(x, y);
  if (pid && selected.targets.includes(pid)) fireAt(pid);
});

// atajos de teclado
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || !state) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { cancelTarget(); $('rules').classList.add('hidden'); return; }
  if (state.phase === 'turn' && state.turnId === me && !selected) {
    if (k === 'h' || k === ' ') { e.preventDefault(); act('hit'); }
    if (k === 's') act('stand');
    if (k === 'd') act('double');
  }
  if (/^[1-4]$/.test(k)) { const p = myP(); const a = p && p.cards[+k - 1]; if (a) playCard(a); }
});

// ---------------- bucle ----------------
function fit() {
  const st = $('stage');
  const narrow = window.innerWidth < 900;
  const maxW = (narrow ? window.innerWidth : st.clientWidth) - 24, maxH = st.clientHeight - 24;
  let s = narrow ? maxW / W : Math.min(maxW / W, maxH / H);
  if (s >= 2) s = Math.floor(s * 2) / 2; // escalado limpio
  cv.style.width = Math.floor(W * s) + 'px';
  cv.style.height = Math.floor(H * s) + 'px';
}
window.addEventListener('resize', fit);
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state) updateTimers();
  frame(g, dt);
  requestAnimationFrame(loop);
}
fit(); setTimeout(fit, 50);
requestAnimationFrame(loop);
connect();

// gancho de depuración
window.__dj = { get state() { return state; }, get me() { return me; }, anim, send };

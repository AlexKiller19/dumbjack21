import { initAudio, sfx, toggleMusic, toggleSfx } from './audio.js';
import { W, H, frame, setState, anim, iconCanvas, seatAt, cardAt, SEAT_COLORS, SEAT_CHARS } from './render.js';

const $ = (id) => document.getElementById(id);
const cv = $('cv'), g = cv.getContext('2d');
g.imageSmoothingEnabled = false;

// target: 'hand' = mano de un rival, 'player' = un rival, 'own' = una carta tuya
const CARDS = {
  granada5:    { name: 'Granada +5', cat: 'agresion', target: 'hand', desc: 'Suma +5 a la mano de un rival. Letal si ya va en 17 o más.' },
  granada10:   { name: 'Granada +10', cat: 'agresion', target: 'hand', desc: 'Suma +10 a la mano de un rival. Rara y devastadora.' },
  amnesia:     { name: 'Amnesia', cat: 'agresion', target: 'hand', desc: 'Un rival pierde la carta MÁS ALTA de su mano (el As cuenta como 11).' },
  mantequilla: { name: 'Mano de Mantequilla', cat: 'agresion', desc: 'El siguiente jugador que pida carta recibe DOS a la vez.' },
  lazo:        { name: 'Lazo', cat: 'agresion', target: 'hand', desc: 'Obligas a un rival a plantarse YA con lo que tenga. Si estaba pidiendo, se queda sin su carta.' },
  empujon:     { name: 'Empujón', cat: 'agresion', target: 'hand', desc: 'Obligas a un rival que ya se plantó a recibir una carta más.' },
  espejo:      { name: 'Espejo Cuántico', cat: 'control', target: 'hand', desc: 'Intercambias tu mano con la de un rival que todavía no se ha plantado.' },
  vidente:     { name: 'Vidente', cat: 'control', desc: 'Ves la carta oculta del dealer y la siguiente del mazo (solo tú, 5 segundos).' },
  comunismo:   { name: 'Comunismo', cat: 'control', desc: 'Todas las manos vivas pasan a valer el promedio (redondeado hacia abajo).' },
  carterista:  { name: 'Carterista', cat: 'control', target: 'player', desc: 'Le robas una carta de acción al azar a un rival.' },
  soborno:     { name: 'Soborno', cat: 'control', desc: 'El dealer cambia su carta oculta por la siguiente del mazo. Combina con Vidente.' },
  carrusel:    { name: 'Carrusel', cat: 'control', desc: 'Todas las manos vivas rotan un lugar a la izquierda, ¡incluida la del dealer!' },
  devolver:    { name: 'Arrepentimiento', cat: 'defensa', target: 'own', desc: 'Devuelves una carta de tu mano, aunque ya te hayas pasado. Se puede usar en cualquier momento de la ronda.' },
  escudo:      { name: 'Escudo de Goma', cat: 'defensa', passive: true, desc: 'PASIVA: rebota la próxima Granada o Amnesia que te lancen a otra mano al azar (puede ser la del atacante).' },
  abogado:     { name: 'Abogado del Diablo', cat: 'defensa', passive: true, desc: 'PASIVA: si te pasas de 21 (hasta 25), tu límite sube a 25 esa mano. Pierde contra un 21 exacto.' },
};
const CAT_NAME = { agresion: 'AGRESION', control: 'CONTROL', defensa: 'DEFENSA' };
const EMOTES = ['YEEHAW!', 'JA JA JA', 'NOOO!', 'TRAMPA!', 'GG', 'TE VOY A...'];
const OPTS = [
  { key: 'hands', label: 'MANOS', values: [5, 8, 12], fmt: v => v },
  { key: 'chips', label: 'FICHAS', values: [500, 1000, 2000], fmt: v => '$' + v },
  { key: 'chaos', label: 'CAOS', values: [2, 3, 5], fmt: v => v + 's' },
];
const SUIT_CH = { h: '♥', d: '♦', c: '♣', s: '♠' };
const cardLabel = (c) => c.k === 'b' ? `Granada +${c.v}` : c.k === 'v' ? `Comunismo ${c.v}` : `${c.r}${SUIT_CH[c.s]}`;

let ws = null, me = null, host = null, code = null, state = null, stateAt = 0;
let selected = null; // { uid, type, targets:[{pid,h}], own:bool }
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
      if (!state && /No existe/.test(m.msg)) { sessionStorage.removeItem('dj21'); setInvite(null); $('code').value = ''; history.replaceState(null, '', location.pathname); }
    }
  };
  ws.onclose = () => { setTimeout(connect, 1200); if (state) toast('Conexión perdida, reconectando…'); };
}
const send = (o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function onEvents(events) {
  for (const e of events) {
    if (e.type === 'stolen') toast(e.by ? `¡${nameOf(e.by)} te robó ${CARDS[e.card].name}!` : `Le robaste ${CARDS[e.card].name} a ${nameOf(e.from)}`);
    if (['start', 'turn', 'window', 'hand', 'reveal', 'settle'].includes(e.type) && selected && !canPlayNow(selected.type)) cancelTarget();
  }
}

let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

// ---------------- helpers ----------------
const myP = () => state && state.players.find(p => p.id === me);
const nameOf = (pid) => { const p = state && state.players.find(q => q.id === pid); return p ? p.name : '?'; };
function canPlayNow(type) {
  const p = myP(); if (!p || !p.inHand || p.status === 'out') return false;
  if (state.phase === 'turn') return state.turnId === me || type === 'devolver';
  if (state.phase === 'window') return !state.windowPlayed.includes(me);
  if (state.phase === 'rescue') return type === 'devolver';
  return false;
}
function validTargets(type) {
  const p = myP(), out = [];
  for (const q of state.players) {
    if (q.id === me) continue;
    if (type === 'carterista') { if (q.status !== 'out' && q.cards > 0) out.push({ pid: q.id, h: null }); continue; }
    if (!q.inHand) continue;
    q.hands.forEach((hd, h) => {
      if (hd.status === 'bust') return;
      if (type === 'amnesia' && hd.cards.length < 2) return;
      if (type === 'lazo' && hd.status !== 'playing') return;
      if (type === 'empujon' && hd.status !== 'stood') return;
      if (type === 'espejo' && (hd.status !== 'playing' || !p.hands.some(x => x.status !== 'bust'))) return;
      out.push({ pid: q.id, h });
    });
  }
  return out;
}

function playCard(a) {
  initAudio();
  const def = CARDS[a.type];
  if (def.passive) { toast('Es pasiva: se activa sola cuando la necesites'); return; }
  if (!canPlayNow(a.type)) {
    toast(state.phase === 'turn' ? 'Espera la ventana de CAOS (cuando alguien pida carta)' : state.phase === 'rescue' ? 'Ahora solo sirve Arrepentimiento' : 'Ahora no se pueden jugar cartas');
    sfx.error(); return;
  }
  if (def.target === 'own') {
    const p = myP();
    if (!p.hands.some(h => h.cards.length >= 2)) { toast('No tienes cartas que devolver'); sfx.error(); return; }
    selected = { uid: a.uid, type: a.type, own: true, targets: [] };
    anim.pickOwn = true; cv.classList.add('targeting');
    sfx.click(); lastHudKey = ''; updateUI();
    return;
  }
  if (def.target) {
    const targets = validTargets(a.type);
    if (!targets.length) { toast('No hay objetivos válidos para esta carta'); sfx.error(); return; }
    selected = { uid: a.uid, type: a.type, targets };
    anim.targeting = targets; cv.classList.add('targeting');
    sfx.click(); lastHudKey = ''; updateUI();
    return;
  }
  send({ t: 'play', uid: a.uid });
}
function fireAt(pid, h) {
  if (!selected) return;
  send({ t: 'play', uid: selected.uid, target: pid, th: h == null ? 0 : h });
  cancelTarget();
}
function fireOwn(h, card) {
  if (!selected) return;
  send({ t: 'play', uid: selected.uid, th: h, card });
  cancelTarget();
}
function cancelTarget() { selected = null; anim.targeting = null; anim.pickOwn = false; cv.classList.remove('targeting'); lastHudKey = ''; updateUI(); }

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
  $('players').innerHTML = state.players.slice().sort((a, b) => a.seat - b.seat).map(p => `
    <li style="border-color:${SEAT_COLORS[p.seat]}">
      <span class="who">${esc(p.name)}${p.id === me ? ' (TU)' : ''}${p.id === host ? ' 👑' : ''}</span>
      <span class="char">${SEAT_CHARS[p.seat]}</span>
    </li>`).join('') + Array.from({ length: 4 - state.players.length }, () => `<li style="border-color:#555"><span class="who muted">Silla vacía…</span></li>`).join('');
  const isHost = me === host;
  const n = state.players.length;
  $('options').innerHTML = OPTS.map(o => `<div class="opt"><span>${o.label}</span>${o.values.map(v =>
    `<button class="mini${state.opts[o.key] === v ? ' on' : ''}" data-k="${o.key}" data-v="${v}" ${isHost ? '' : 'disabled'}>${o.fmt(v)}</button>`).join('')}</div>`).join('');
  $('options').querySelectorAll('button').forEach(b => b.onclick = () => { sfx.click(); send({ t: 'opt', key: b.dataset.k, value: +b.dataset.v }); });
  $('btn-start').classList.toggle('hidden', !isHost);
  $('btn-start').disabled = n < 2;
  $('wait-msg').textContent = isHost ? (n < 2 ? 'Comparte el link: se necesitan al menos 2 jugadores.' : '¡Listos! Empieza cuando quieras.') : 'Esperando a que el anfitrión (👑) empiece…';
}

function renderGameOver() {
  const r = state.ranking || [];
  $('ranking').innerHTML = r.map((x, i) => {
    const p = state.players.find(q => q.id === x.pid); if (!p) return '';
    return `<li class="${i === 0 ? 'first' : ''}" style="border-color:${SEAT_COLORS[p.seat]}"><span>${i === 0 ? '👑' : (i + 1) + '.'}</span><span class="n">${esc(p.name)}${p.id === me ? ' (TU)' : ''}</span><span>$${x.chips}</span></li>`;
  }).join('');
  $('awards').innerHTML = (state.awards || []).map(a => {
    const p = state.players.find(q => q.id === a.pid); if (!p) return '';
    return `<li><b>${a.title}</b><span style="color:${SEAT_COLORS[p.seat]}">${esc(p.name)}</span><small>${a.detail}</small></li>`;
  }).join('');
  $('awards-title').classList.toggle('hidden', !(state.awards || []).length);
  $('btn-again').classList.toggle('hidden', me !== host);
  $('again-msg').textContent = me === host ? '' : 'Esperando a que el anfitrión inicie otra partida…';
}

function renderHUD() {
  const p = myP(); if (!p) return;
  const turnP = state.players.find(q => q.id === state.turnId);
  const myTurn = state.phase === 'turn' && state.turnId === me;
  const cur = myTurn ? p.hands[state.turnHand] : null;
  const betTotal = p.hands.length ? p.hands.reduce((a, h) => a + h.bet, 0) : p.bet;
  const key = JSON.stringify([state.phase, state.turnId, state.turnHand, p.status, p.cards, p.chips, betTotal, p.hands.map(h => [h.cards.length, h.status, h.value]), p.canSplit, state.windowPlayed, selected && selected.uid, state.handNo, state.rescuers]);
  $('me-info').innerHTML = `<div style="color:${SEAT_COLORS[p.seat]}">${esc(p.name)} · ${SEAT_CHARS[p.seat]}</div>
    <div class="big">$${p.chips}</div>
    <div>APUESTA: $${betTotal}</div>
    <div>MANO ${state.handNo}/${state.maxHands}</div>`;
  if (key === lastHudKey) return updateTimers();
  lastHudKey = key;

  // cartas de acción
  const hand = $('hand');
  hand.innerHTML = '';
  if (!p.cards.length) hand.innerHTML = '<div class="empty-hand">Sin cartas. Recibes una nueva cada mano.</div>';
  p.cards.forEach((a, i) => {
    const d = CARDS[a.type];
    const playable = !d.passive && canPlayNow(a.type);
    const el = document.createElement('div');
    el.className = `acard ${d.cat}` + (d.passive ? ' passive' : playable ? ' playable' : ' disabled') + (selected && selected.uid === a.uid ? ' selected' : '');
    el.innerHTML = `<div class="stripe"></div><div class="cat">${d.passive ? 'PASIVA' : CAT_NAME[d.cat]}</div>`;
    const ic = document.createElement('canvas'); ic.width = 8; ic.height = 8;
    ic.getContext('2d').drawImage(iconCanvas(a.type), 0, 0);
    el.appendChild(ic);
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = d.name; el.appendChild(nm);
    const k = document.createElement('div'); k.className = 'key'; k.textContent = `[${i + 1}]`; el.appendChild(k);
    const info = () => { $('cardinfo').innerHTML = `<b>${d.name}:</b> ${d.desc}`; };
    el.onmouseenter = () => { info(); sfx.hover(); };
    el.onclick = () => { info(); playCard(a); };
    hand.appendChild(el);
  });

  // controles
  const c = $('controls');
  let html = '';
  const multi = (q) => q.hands.length > 1;
  if (selected && selected.own) {
    html = `<div class="status">ELIGE QUE CARTA DEVOLVER<br><small>(o toca la carta en la mesa)</small></div><div class="row">` +
      p.hands.map((hd, h) => hd.cards.length < 2 ? '' : hd.cards.map(cd => `<button class="target own" data-own="${h}" data-card="${cd.id}">${multi(p) ? 'M' + (h + 1) + ' ' : ''}${cardLabel(cd)}</button>`).join('')).join('') +
      `</div><div class="row"><button class="mini" data-act="cancel">CANCELAR [ESC]</button></div>`;
  } else if (selected) {
    html = `<div class="status">ELIGE A TU VICTIMA<br><small>(o toca su mano en la mesa)</small></div><div class="row">` +
      selected.targets.map(tg => {
        const q = state.players.find(x => x.id === tg.pid);
        const lbl = tg.h == null ? `${esc(q.name)} (${q.cards} cartas)` : `${esc(q.name)}${multi(q) ? ' M' + (tg.h + 1) : ''} (${q.hands[tg.h].value})`;
        return `<button class="target" data-target="${tg.pid}" data-h="${tg.h == null ? '' : tg.h}">${lbl}</button>`;
      }).join('') + `</div><div class="row"><button class="mini" data-act="cancel">CANCELAR [ESC]</button></div>`;
  } else if (state.phase === 'betting') {
    if (p.status === 'betting') {
      const opts = [50, 100, 250, 500].filter(v => v < p.chips);
      html = `<div class="status">¿CUANTO APUESTAS? <span class="timer"></span></div><div class="row">` +
        opts.map(v => `<button data-bet="${v}">$${v}</button>`).join('') +
        `<button class="danger" data-bet="${p.chips}">TODO $${p.chips}</button></div>`;
    } else html = `<div class="status">Apuesta lista.<br>Esperando a los demás… <span class="timer"></span></div>`;
  } else if (myTurn && cur) {
    const canDouble = cur.cards.length === 2 && p.chips >= cur.bet;
    html = `<div class="status">¡TU TURNO!${multi(p) ? ' MANO ' + (state.turnHand + 1) + ':' : ''} TIENES ${cur.value}${cur.limit > 21 ? '/' + cur.limit : ''} <span class="timer"></span></div>
      <div class="row"><button class="hit" data-act="hit">PEDIR [H]</button><button class="stand" data-act="stand">PLANTARSE [S]</button></div>
      <div class="row"><button class="double" data-act="double" ${canDouble ? '' : 'disabled'}>DOBLAR [D]</button>${p.canSplit ? '<button class="split" data-act="split">DIVIDIR [V]</button>' : ''}</div>`;
  } else if (state.phase === 'window') {
    const who = state.turnId === me ? 'TU PIDES CARTA' : `${esc(turnP ? turnP.name : '?')} PIDE CARTA`;
    const can = canPlayNow() && p.cards.some(a => !CARDS[a.type].passive);
    html = `<div class="status chaos">¡CAOS! ${who}<br>${can ? '¡Juega una carta YA!' : state.windowPlayed.includes(me) ? 'Ya jugaste tu carta.' : 'Nada que jugar…'}</div>`;
  } else if (state.phase === 'rescue') {
    html = state.rescuers.includes(me)
      ? `<div class="status rescue">¡ULTIMA OPORTUNIDAD!<br>Usa ARREPENTIMIENTO para salvarte <span class="timer"></span></div>`
      : `<div class="status">Ultima oportunidad para los que se pasaron… <span class="timer"></span></div>`;
  } else if (state.phase === 'turn') {
    html = `<div class="status">Turno de <b style="color:${SEAT_COLORS[turnP ? turnP.seat : 0]}">${esc(turnP ? turnP.name : '?')}</b><br><small>Cuando pida carta podrás sabotearlo</small></div>`;
  } else if (state.phase === 'dealing') html = `<div class="status">Repartiendo…</div>`;
  else if (state.phase === 'dealer') html = `<div class="status">El dealer juega…</div>`;
  else if (state.phase === 'results') {
    const mine = state.results ? state.results.list.filter(x => x.pid === me) : [];
    const net = mine.reduce((a, r) => a + r.net, 0);
    const txt = !mine.length ? 'Resultados' : mine.some(r => r.res === 'blackjack') ? `¡BLACKJACK! +$${net}` : net > 0 ? `¡GANASTE +$${net}!` : net === 0 ? 'EMPATE' : `PERDISTE $${-net}`;
    html = `<div class="status">${txt}<br><small>Siguiente mano en <span class="timer"></span></small></div>`;
  }
  if (p.status === 'out' && state.phase !== 'gameover') html = `<div class="status chaos">ELIMINADO<br><small>Te quedaste sin fichas. Mira el caos desde la tumba.</small></div>`;
  c.innerHTML = html;
  c.querySelectorAll('[data-bet]').forEach(b => b.onclick = () => { initAudio(); send({ t: 'bet', amount: +b.dataset.bet }); });
  c.querySelectorAll('[data-act]').forEach(b => b.onclick = () => act(b.dataset.act));
  c.querySelectorAll('[data-target]').forEach(b => b.onclick = () => fireAt(b.dataset.target, b.dataset.h === '' ? null : +b.dataset.h));
  c.querySelectorAll('[data-own]').forEach(b => b.onclick = () => fireOwn(+b.dataset.own, +b.dataset.card));
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
function setInvite(c) {
  const on = !!c;
  $('home').classList.toggle('invited', on);
  $('invite').classList.toggle('hidden', !on);
  if (on) {
    $('code').value = c;
    $('invite').innerHTML = `¡TE INVITARON A JUGAR!<br>SALA <b>${esc(c)}</b>`;
    $('btn-join').textContent = 'UNIRSE A LA SALA';
    $('or-text').textContent = '— o mejor —';
    $('btn-create').textContent = 'CREAR MI PROPIA SALA';
  } else {
    $('btn-join').textContent = 'UNIRSE';
    $('or-text').textContent = '— o únete con un código —';
    $('btn-create').textContent = 'CREAR SALA';
  }
}
const invited = qs && /^[A-Za-z]{4}$/.test(qs) && !sessionStorage.getItem('dj21');
if (qs) $('code').value = qs.toUpperCase();
setInvite(invited ? qs.toUpperCase() : null);
if (invited) setTimeout(() => $('name').focus(), 100);
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
$('name').addEventListener('keydown', e => { if (e.key === 'Enter') ($('code').value.trim().length === 4 ? $('btn-join') : $('btn-create')).click(); });
$('btn-start').onclick = () => { initAudio(); send({ t: 'start' }); };
$('btn-again').onclick = () => send({ t: 'again' });
$('btn-copy').onclick = async () => {
  const url = `${location.origin}${location.pathname}?sala=${code}`;
  try { await navigator.clipboard.writeText(url); toast('¡Link copiado! Mándalo a tus amigos'); } catch { toast(url); }
};
$('btn-music').onclick = (e) => { initAudio(); e.target.textContent = 'MUSICA: ' + (toggleMusic() ? 'SI' : 'NO'); };
$('btn-sfx').onclick = (e) => { initAudio(); e.target.textContent = 'SFX: ' + (toggleSfx() ? 'SI' : 'NO'); };
$('emotes').innerHTML = EMOTES.map(e => `<button class="mini" data-e="${e}">${e}</button>`).join('');
$('emotes').querySelectorAll('button').forEach(b => b.onclick = () => send({ t: 'emote', e: b.dataset.e }));

// ---------------- manual ----------------
function openManual(tab) { $('manual').classList.remove('hidden'); showTab(tab || 'basico'); }
function showTab(tab) {
  document.querySelectorAll('#manual .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('#manual .page').forEach(pg => pg.classList.toggle('hidden', pg.dataset.page !== tab));
  $('manual').scrollTop = 0;
}
document.querySelectorAll('#manual .tab').forEach(b => b.onclick = () => { sfx.click(); showTab(b.dataset.tab); });
$('btn-manual').onclick = () => openManual();
$('btn-manual2').onclick = () => openManual();
$('btn-close-manual').onclick = () => $('manual').classList.add('hidden');
for (const cat of ['agresion', 'control', 'defensa']) {
  $('cards-' + cat).innerHTML = Object.entries(CARDS).filter(([, d]) => d.cat === cat).map(([k, d]) =>
    `<div class="rc ${cat}" data-ic="${k}"><span></span><div><b>${d.name}</b>${d.passive ? ' <small>(PASIVA)</small>' : ''}<br>${d.desc.replace(/^PASIVA: /, '')}</div></div>`).join('');
}
document.querySelectorAll('.rc').forEach(el => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; c.getContext('2d').drawImage(iconCanvas(el.dataset.ic), 0, 0); el.querySelector('span').replaceWith(c); });

// clic en la mesa (para elegir objetivo o carta propia)
cv.addEventListener('click', (ev) => {
  if (!selected) return;
  const r = cv.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width * W, y = (ev.clientY - r.top) / r.height * H;
  if (selected.own) { const c = cardAt(x, y); if (c) fireOwn(c.h, c.id); return; }
  const hit = seatAt(x, y); if (!hit) return;
  const tg = selected.targets.find(t => t.pid === hit.pid && (t.h == null || hit.h == null || t.h === hit.h));
  if (tg) fireAt(tg.pid, tg.h);
});

// atajos de teclado
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || !state) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { cancelTarget(); $('manual').classList.add('hidden'); return; }
  if (state.phase === 'turn' && state.turnId === me && !selected) {
    if (k === 'h' || k === ' ') { e.preventDefault(); act('hit'); }
    if (k === 's') act('stand');
    if (k === 'd') act('double');
    if (k === 'v') act('split');
  }
  if (/^[1-5]$/.test(k)) { const p = myP(); const a = p && p.cards[+k - 1]; if (a) playCard(a); }
});

// ---------------- escalado nítido ----------------
// El lienzo siempre se muestra a un múltiplo entero de píxeles físicos: cada píxel del
// juego ocupa exactamente k×k píxeles de pantalla, sin bordes borrosos.
function fit() {
  const st = $('stage');
  const dpr = window.devicePixelRatio || 1;
  const phoneLandscape = matchMedia('(orientation: landscape) and (max-height: 520px)').matches;
  const narrow = window.innerWidth < 900 && !phoneLandscape;
  const maxW = (narrow ? window.innerWidth : st.clientWidth) - (phoneLandscape ? 8 : 24);
  const maxH = st.clientHeight - (phoneLandscape ? 8 : 24);
  const s = narrow ? maxW / W : Math.min(maxW / W, maxH / H);
  const k = Math.max(1, Math.floor(s * dpr));
  cv.style.width = (W * k / dpr) + 'px';
  cv.style.height = (H * k / dpr) + 'px';
}
window.addEventListener('resize', fit);
new ResizeObserver(fit).observe($('stage'));
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
window.__dj = { get state() { return state; }, get me() { return me; }, anim, send, playCard };

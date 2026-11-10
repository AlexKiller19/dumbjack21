// Orquestador: recibe el estado del servidor, anima cartas y efectos y dibuja cada cuadro.
import { C, CARD_H, CARD_W, DEALER_Y, H, SEATS, SHOE, W } from './consts.js';
import { CARD_LINES, drawDealerSay, drawPatronSay, idleChatter, patron, say } from './dialogue.js';
import { S } from './anim.js';
import { TABLE, bgCanvas, buildBackground, drawButter, drawLamps, drawMouse, drawPianist, drawSign, drawWanted, drawWindow } from './scene.js';
import { updateNPCs, drawNPCs } from './npcs.js';
import { drawCard, drawText, textWidth } from './pixel.js';
import { drawChar, drawDealer, drawTomb, skinColor } from './characters.js';
import { sfx } from './audio.js';
const key = (pid, h) => pid + ':' + (h || 0);

function playerOf(pid) { return S.state && S.state.players.find(q => q.id === pid); }

function seatOf(pid) { const p = playerOf(pid); return p ? p.seat : -1; }

function handX(p, h) { const n = p.hands.length; return SEATS[p.seat].x + (n > 1 ? (h === 0 ? -26 : 26) : 0); }

function handLayout(n, cx, maxW = 92) {
  const gap = n > 1 ? Math.min(10, (maxW - CARD_W) / (n - 1)) : 0;
  const total = CARD_W + gap * (n - 1);
  return i => cx - total / 2 + i * gap;
}

function handPt(pid, h) {
  const p = playerOf(pid); if (!p) return { x: 240, y: 110 };
  const hh = Math.min(h || 0, Math.max(0, p.hands.length - 1));
  return { x: p.hands.length ? handX(p, hh) : SEATS[p.seat].x, y: SEATS[p.seat].cy + 8 };
}

function avatarPt(pid) { const s = seatOf(pid); return s < 0 ? { x: 240, y: 60 } : { x: SEATS[s].x - 22, y: SEATS[s].ay + 8 }; }

function nameOf(pid) { const p = playerOf(pid); return p ? p.name : '?'; }

export function resetScene() {
  S.state = null; S.prev = null; S.sprites.clear(); S.ghosts.length = 0; S.texts.length = 0;
  S.projectiles.length = 0; S.particles.length = 0; S.bubbles.length = 0; S.targeting = null; S.pickOwn = false;
}

export function setState(state, you, events) {
  S.prev = S.state; S.state = state; S.you = you;
  // pistas desde eventos para animar altas/bajas de cartas
  S.hints = { spawn: {}, remove: {} };
  for (const e of events) {
    if (e.type === 'shield' && e.to) S.hints.spawn[key(e.to, e.toH)] = { delay: 820, from: 'boom' };
    if (e.type === 'boom' && !S.hints.spawn[key(e.pid, e.h)]) S.hints.spawn[key(e.pid, e.h)] = { delay: 420, from: 'boom' };
    if (e.type === 'amnesia') S.hints.remove[key(e.pid, e.h)] = 'amnesia';
    if (e.type === 'giveback') S.hints.remove[key(e.pid, e.h)] = 'giveback';
    if (e.type === 'comunismo') S.hints.all = 'center';
  }
  layout();
  for (const e of events) { try { handleEvent(e); } catch (err) { reportError(err, 'evento ' + e.type); } }
}

export let reportError = (err) => console.error(err);

export function onRenderError(fn) { reportError = fn; }

function layout() {
  const st = S.state; if (!st) return;
  const seen = new Set();
  let stagger = 0;
  const place = (card, tx, ty, ownerKey) => {
    seen.add(card.id);
    let s = S.sprites.get(card.id);
    if (!s) {
      const hint = S.hints.spawn[ownerKey];
      let x = SHOE.x + 1, y = SHOE.y - 8, delay = stagger;
      if (card.k === 'v') { x = 232; y = 180; delay = 700; }
      else if (hint && card.k === 'b') { x = tx; y = ty - 30; delay = hint.delay; }
      else stagger += 110;
      s = { x, y, tx, ty, card, delay, shown: false, pop: 0, owner: ownerKey };
      S.sprites.set(card.id, s);
    }
    if (!!s.card.hidden !== !!card.hidden) s.flipT = 0; // voltear
    s.card = card; s.tx = tx; s.ty = ty; s.owner = ownerKey;
  };
  // orden de reparto: ronda 1, ronda 2, luego el resto
  const hands = [];
  for (const p of st.players.slice().sort((a, b) => a.seat - b.seat))
    p.hands.forEach((hd, h) => hands.push({ p, h, hd, lay: handLayout(hd.cards.length, handX(p, h), p.hands.length > 1 ? 44 : 92) }));
  const maxLen = Math.max(st.dealer.hand.length, ...hands.map(x => x.hd.cards.length), 0);
  const dl = handLayout(st.dealer.hand.length, 240, 120);
  for (let i = 0; i < maxLen; i++) {
    for (const x of hands) if (x.hd.cards[i]) place(x.hd.cards[i], x.lay(i), SEATS[x.p.seat].cy - (i % 2), key(x.p.id, x.h));
    if (st.dealer.hand[i]) place(st.dealer.hand[i], dl(i), DEALER_Y, 'dealer');
  }
  for (const [id, s] of S.sprites) {
    if (seen.has(id)) continue;
    S.sprites.delete(id);
    if (!s.shown) continue;
    const mode = S.hints.remove[s.owner] || S.hints.all || 'sweep';
    S.ghosts.push({ x: s.x, y: s.y, card: s.card, life: 0, mode, vx: mode === 'amnesia' ? (Math.random() - 0.5) * 40 : 0, vy: mode === 'amnesia' ? -50 : 0 });
  }
}

function burst(x, y, n, colors, speed = 60, opts = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    S.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opts.up || 0), life: 0, max: (opts.life || 0.8) * (0.5 + Math.random()),
      color: colors[i % colors.length], size: opts.size || 1, grav: opts.grav ?? 80, hat: opts.hat,
    });
  }
}

function smoke(x, y, n = 8) {
  for (let i = 0; i < n; i++) S.particles.push({ x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.5) * 15, vy: -10 - Math.random() * 20, life: 0, max: 1.2 + Math.random(), color: '#9a9a9a', size: 2, grav: -5, smoke: true });
}

function float(text, x, y, color = C.white, scale = 1, life = 1.6, vy = -14) { S.texts.push({ text, x, y, color, scale, life: 0, max: life, vy }); }

function banner(text, color, scale = 3, life = 1.4) { S.texts.push({ text, x: 240, y: 48, color, scale, life: 0, max: life, vy: 0, banner: true }); }

function mood(pid, m, dur = 1.6) { S.moods[pid] = { m, until: S.time + dur }; }

function dealerMood(m, dur = 1.5) { S.dealerMood = m; S.dealerMoodUntil = S.time + dur; }

function later(ms, fn) { setTimeout(fn, ms); }

const CARD_NAMES = {
  granada5: 'GRANADA +5', granada10: 'GRANADA +10', amnesia: 'AMNESIA', mantequilla: 'MANO DE MANTEQUILLA',
  espejo: 'ESPEJO CUANTICO', vidente: 'VIDENTE', comunismo: 'COMUNISMO', escudo: 'ESCUDO DE GOMA', abogado: 'ABOGADO DEL DIABLO',
  carterista: 'CARTERISTA', lazo: 'LAZO', empujon: 'EMPUJON', carrusel: 'CARRUSEL', devolver: 'ARREPENTIMIENTO',
};

function handleEvent(e) {
  const t = S.time;
  switch (e.type) {
    case 'join': sfx.door(); say(['BIENVENIDO, {n}', 'PASE, {n}, PASE', 'SIENTATE, {n}. SIN ARMAS'], 2.8, { n: nameOf(e.pid) }, 0); break;
    case 'shuffle': sfx.shuffle(); say(['BARAJANDO...', 'MAZO NUEVO, SUERTE NUEVA'], 2, {}, 0); break;
    case 'hand':
      if (S.state && e.n >= S.state.maxHands) {
        banner('ULTIMA MANO!', '#ff5a4a', 3, 2.2); S.shake = Math.max(S.shake, 3); S.flash = { color: '#d6403a', a: 0.3 };
        say(['ULTIMA MANO, FORASTEROS. TODO O NADA', 'SE ACABA LA NOCHE... APUESTEN FUERTE'], 3.5, {}, 2);
        patron(['¡ESTA ES LA BUENA!', '¡TODO O NADA!']);
      } else { banner('MANO ' + e.n, C.gold, 3, 1.3); say(['HAGAN SUS APUESTAS', 'A VER ESE DINERO', 'APUESTEN, FORASTEROS']); }
      break;
    case 'bet': { const p = avatarPt(e.pid); float('$' + e.amount, p.x + 20, p.y - 20, C.gold); sfx.chip(); if (e.amount >= 500) { say(['¡UY! {n} VA CON TODO', 'ESO SI ES APOSTAR, {n}'], 2.6, { n: nameOf(e.pid) }, 1); patron(['¡ESE TIENE AGALLAS!', 'UUUH!']); } break; }
    case 'deal': S.dealerReachUntil = t + 1.4; break;
    case 'natural': { later(900, () => { const p = handPt(e.pid, e.h); burst(p.x, p.y, 30, ['#ffd23f', '#fff2a8', '#ff7b2e'], 70, { up: 30 }); float('BLACKJACK!', p.x, p.y - 14, '#ffd23f', 2, 2); sfx.blackjack(); mood(e.pid, 'happy', 2); dealerMood('shock'); say(['SUERTE DE PRINCIPIANTE', 'TRAMPOSO...', 'NO PUEDE SER'], 3, {}, 2); patron(['¡SUERTUDO!', '¡BLACKJACK!']); S.cheerUntil = S.time + 1.5; for (let i = 0; i < 5; i++) burst(70 + i * 22, 62, 1, ['#8a5a2b', '#2a2228'], 30, { up: 90, life: 1.6, grav: 160, hat: true }); }); break; }
    case 'turn': {
      const p = handPt(e.pid, e.h);
      if (e.pid === S.you && !e.again) { sfx.turn(); float('TU TURNO!', p.x, p.y - 28, C.gold, 2, 1.2); }
      if (!e.again) say(['TE TOCA, {n}', '{n}, ¿PIDES O TE PLANTAS?', 'ADELANTE, {n}', 'TU TURNO, {n}. SIN TRAMPAS'], 2.6, { n: nameOf(e.pid) }, 0);
      S.dealerLook = Math.sign(p.x - 240);
      break;
    }
    case 'chain': {
      S.chain = (S.chain || 1) + 1; S.chainAt = S.time;
      if (S.chain === 3) say(['¿MAS? ¿TODAVIA MAS?', 'ESTO SE SALIO DE CONTROL'], 2.4, {}, 1);
      if (Math.random() < 0.5) patron(['¡MAS CAOS!', '¡OTRA, OTRA!', 'JAJAJA']);
      sfx.chaos(); S.shake = Math.max(S.shake, 2);
      break;
    }
    case 'revive': {
      say(['¿RESUCITO? ¡IMPOSIBLE!', 'ESE ESTABA MUERTO...', 'BRUJERIA, LES DIGO'], 3, {}, 2); patron(['¡MILAGRO!', '¡VOLVIO DE LA TUMBA!']);
      const p = handPt(e.pid, e.h);
      later(450, () => {
        float('REVIVE! ' + e.v, p.x, p.y - 26, '#7ee08a', 2, 2);
        burst(p.x, p.y, 24, ['#7ee08a', '#fff2a8', '#ffffff'], 50, { up: 30 });
        S.particles.push({ ring: true, x: p.x, y: p.y, life: 0, max: 0.6, color: '#7ee08a' });
        mood(e.pid, 'happy', 2); sfx.magic();
      });
      break;
    }
    case 'finalChaos': {
      S.chain = 1;
      S.chaosStart = S.time; S.chaosDur = e.dur / 1000;
      banner('CAOS FINAL!', '#ff5a4a', 3, 1.2); sfx.chaos(); S.shake = Math.max(S.shake, 3);
      say(['ULTIMA RONDA DE TRAMPAS', 'NADIE TOQUE MIS CARTAS', 'APURENSE, FORASTEROS']);
      break;
    }
    case 'window': {
      S.chaosStart = S.time; S.chaosDur = e.dur / 1000;
      if (e.dur > 1000) { sfx.chaos(); say(['¿OTRA CARTA, {n}?', 'A VER QUE SALE...', 'ATENTOS, QUE {n} PIDE'], 2.4, { n: nameOf(e.pid) }, 0); }
      if (e.double) float('DOBLA!', handPt(e.pid, e.h).x, handPt(e.pid, e.h).y - 24, '#9fd4ff', 2);
      break;
    }
    case 'double': sfx.chip(); say(['DOBLE O NADA, ¡VALIENTE!', 'ESO ES TENER AGALLAS, {n}'], 2.6, { n: nameOf(e.pid) }, 1); break;
    case 'split': { const p = handPt(e.pid, 0); float('DIVIDE!', SEATS[seatOf(e.pid)].x, p.y - 26, '#9fd4ff', 2, 1.4); sfx.chip(); sfx.card(); say(['DOS MANOS, DOBLE PROBLEMA', 'PARTIR LA MANO, ¿EH, {n}?'], 2.6, { n: nameOf(e.pid) }, 1); break; }
    case 'hit': S.dealerReachUntil = t + 0.5; if (e.butter) { const p = handPt(e.pid, e.h); float('RESBALON! 2 CARTAS', p.x, p.y - 22, '#ffd23f', 1, 2); sfx.slip(); } break;
    case 'stand': if (!e.auto) { const p = handPt(e.pid, e.h); float('ME PLANTO', p.x, p.y - 22, '#9fd8b4'); say(['{n} SE PLANTA', 'PRUDENTE, {n}', '¿YA? ¿TAN RAPIDO, {n}?'], 2.2, { n: nameOf(e.pid) }, 0); } sfx.click(); break;
    case 'play': {
      const from = avatarPt(e.pid);
      float(CARD_NAMES[e.card] + '!', from.x + 20, from.y - 26, skinColor(playerOf(e.pid)), 1, 1.8, -10);
      banner(CARD_NAMES[e.card], '#ffd23f', 2, 1.2);
      if (e.target === e.pid && e.card.startsWith('granada')) say(['¿DINAMITA A TI MISMO? ¡ESTAS LOCO!', 'NUNCA HABIA VISTO ESO'], 2.8, {}, 1);
      else if (CARD_LINES[e.card]) say(CARD_LINES[e.card], 2.8, { n: nameOf(e.pid), t: e.target ? nameOf(e.target) : '' }, 1);
      const to = e.target ? handPt(e.target, e.th) : null;
      if ((e.card === 'granada5' || e.card === 'granada10') && to) { S.projectiles.push({ type: 'dynamite', x0: from.x, y0: from.y - 10, x1: to.x, y1: to.y, t: 0, dur: 0.42, big: e.card === 'granada10' }); sfx.fuse(); }
      else if (e.card === 'amnesia' && to) { S.projectiles.push({ type: 'question', x0: from.x, y0: from.y - 10, x1: to.x, y1: to.y, t: 0, dur: 0.4 }); sfx.whoosh(); }
      else if (e.card === 'lazo' && to) { S.projectiles.push({ type: 'lasso', x0: from.x, y0: from.y - 10, x1: to.x, y1: to.y, t: 0, dur: 0.4 }); sfx.whoosh(); }
      else if (e.card === 'empujon' && to) { S.projectiles.push({ type: 'boot', x0: from.x, y0: from.y - 10, x1: to.x, y1: to.y + 14, t: 0, dur: 0.3 }); sfx.whoosh(); }
      else if (e.card === 'espejo') sfx.mirror();
      else if (e.card === 'vidente') sfx.magic();
      break;
    }
    case 'boom': {
      const rebound = S.lastShieldAt === S.time;
      later(rebound ? 800 : 400, () => {
        const p = handPt(e.pid, e.h);
        burst(p.x, p.y, 40, ['#ffd23f', '#ff7b2e', '#d6403a', '#fff2a8'], 90, { life: 0.7 });
        burst(p.x, p.y, 12, ['#5a3a1a', '#3a2418'], 60, { size: 2, grav: 120 });
        smoke(p.x, p.y, 10);
        S.shake = e.v >= 10 ? 7 : 4; S.flash = { color: '#fff2a8', a: 0.5 };
        float('+' + e.v, p.x, p.y - 26, '#ff7b2e', 2, 1.4);
        sfx.boom(); S.cheerUntil = S.time + 1.2; mood(e.pid, 'sad', 1.5); patron(['UUUUH!', '¡EN LA CARA!', '¡BOOM!'], 1.8);
        say(['SIN PELEAS EN MI MESA!', 'ESO SE PAGA APARTE', 'MI MESA NUEVA...']);
        // una botella del estante revienta
        const bi = Math.floor(Math.random() * 11); S.brokenBottle = { x: 84 + bi * 7, until: S.time + 3 };
        burst(84 + bi * 7, 32, 10, ['#cfefff', '#ffffff', '#7ee08a'], 40, { life: 0.6 });
      });
      break;
    }
    case 'shield': {
      const a = handPt(e.pid, e.h);
      S.lastShieldAt = S.time;
      later(380, () => {
        sfx.boing(); float('BOING! REBOTE', a.x, a.y - 22, '#7ee08a', 1, 1.6);
        S.particles.push({ ring: true, x: a.x, y: a.y, life: 0, max: 0.5, color: '#7ee08a' });
        if (e.to) { const b = handPt(e.to, e.toH); S.projectiles.push({ type: e.card === 'amnesia' ? 'question' : 'dynamite', x0: a.x, y0: a.y, x1: b.x, y1: b.y, t: 0, dur: 0.4, bounce: true }); }
      });
      break;
    }
    case 'abogado': { later(500, () => { const p = handPt(e.pid, e.h); sfx.devil(); float('ABOGADO! LIMITE 25', p.x, p.y - 26, '#ff5a4a', 1, 2.2); burst(p.x, p.y, 20, ['#d6403a', '#7a0a0a', '#ff7b2e'], 40, { up: 20 }); S.flash = { color: '#7a0a0a', a: 0.35 }; }); break; }
    case 'amnesia': { later(380, () => { const p = handPt(e.pid, e.h); float(e.self ? 'SE QUITA SU CARTA ALTA' : 'OLVIDO SU MEJOR CARTA', p.x, p.y - 24, C.white, 1, 2); if (!e.self) mood(e.pid, 'sad'); }); break; }
    case 'fizzle': float('NADA QUE OLVIDAR', handPt(e.pid, 0).x, handPt(e.pid, 0).y - 22, '#aaa'); break;
    case 'butter': sfx.slip(); float('EL SIGUIENTE QUE PIDA RECIBE 2!', 240, 186, '#ffd23f', 1, 2.2); break;
    case 'lasso': { later(380, () => { const p = handPt(e.pid, e.h); float('LAZADO! SE PLANTA', p.x, p.y - 24, '#e8b46a', 1, 2); S.particles.push({ ring: true, x: p.x, y: p.y, life: 0, max: 0.5, color: '#e8b46a' }); mood(e.pid, 'sad'); sfx.boing(); }); break; }
    case 'push': { later(280, () => { const p = handPt(e.pid, e.h); float('EMPUJON! UNA MAS', p.x, p.y - 24, '#ffb0a0', 1, 2); S.shake = Math.max(S.shake, 2); sfx.lose(); }); S.dealerReachUntil = t + 0.5; break; }
    case 'steal': {
      const a = avatarPt(e.target), b = avatarPt(e.pid);
      S.projectiles.push({ type: 'loot', x0: a.x, y0: a.y, x1: b.x, y1: b.y, t: 0, dur: 0.5 });
      float('LE ROBARON!', a.x + 20, a.y - 24, '#b57bff', 1, 2); sfx.reward(); mood(e.target, 'sad'); mood(e.pid, 'happy');
      break;
    }
    case 'carousel': { S.spin = 1; sfx.comunismo(); sfx.whoosh(); S.flash = { color: '#9fd4ff', a: 0.35 }; say(['QUE MAREO...', 'OIGAN, ESA ERA MIA!']); dealerMood('shock', 1.5); break; }
    case 'giveback': { const p = handPt(e.pid, e.h); float(e.saved ? 'SE SALVA!' : 'DEVUELVE UNA CARTA', p.x, p.y - 24, '#7ee08a', e.saved ? 2 : 1, 2); sfx.magic(); if (e.saved) { mood(e.pid, 'happy', 2); burst(p.x, p.y, 16, ['#7ee08a', '#fff'], 40, { grav: 0 }); } break; }
    case 'rescue': banner('ULTIMA OPORTUNIDAD', '#7ee08a', 2, 2); sfx.chaos(); break;
    case 'mirror': {
      const a = handPt(e.pid, e.h), b = handPt(e.target, e.th);
      S.flash = { color: '#cfefff', a: 0.5 };
      for (let i = 0; i < 16; i++) { const k = i / 15; burst(a.x + (b.x - a.x) * k, a.y - Math.sin(k * Math.PI) * 30, 2, ['#9fd4ff', '#ffffff'], 20, { life: 0.6, grav: 0 }); }
      break;
    }
    case 'vidente': { const p = avatarPt(e.pid); burst(p.x, p.y - 10, 16, ['#b57bff', '#e0c8ff'], 30, { grav: -10 }); break; }
    case 'peek': S.peek = { hidden: e.hidden, top: e.top, until: S.time + 5 }; float('SOLO TU LO VES (5S)', 240, 190, '#b57bff', 1, 2.5); break;
    case 'comunismo': {
      sfx.comunismo(); S.flash = { color: '#d6403a', a: 0.45 }; banner('TODOS A ' + e.avg, '#ffd23f', 3, 2);
      burst(232, 180, 40, ['#d6403a', '#ffd23f'], 80, { life: 0.9 }); say(['CAMARADAS...', 'AQUI TODOS IGUALES']);
      break;
    }
    case 'bust': {
      later(e.by ? (S.lastShieldAt === S.time ? 900 : 500) : 250, () => {
        const p = handPt(e.pid, e.h);
        smoke(p.x, p.y, 14);
        float('SE PASO! ' + e.v, p.x, p.y - 22, '#ff5a4a', 2, 1.8);
        sfx.bust(); mood(e.pid, 'bust', 3); dealerMood('laugh', 1.6); S.shake = Math.max(S.shake, 2); if (Math.random() < 0.6) patron(['¡AL HOYO!', 'JAJAJA', '¡PASADO!'], 1.8);
        if (e.by && e.by !== e.pid) { float('SABOTAJE DE ' + nameOf(e.by), p.x, p.y - 10, '#ffb0a0', 1, 2); S.booUntil = S.time + 1.6; }
        else say(['LA CASA GANA', 'JA! PASADO', 'OTRO MAS AL HOYO', 'GRACIAS POR SU DINERO']);
      });
      break;
    }
    case 'reward': {
      later(e.reason === 'sabotaje' ? 900 : 300, () => {
        const p = avatarPt(e.pid);
        if (e.full) { if (e.pid === S.you) float('MANO LLENA', p.x + 20, p.y - 24, '#aaa'); }
        else { float('+1 CARTA', p.x + 20, p.y - 24, '#7ee08a', 1, 1.6); if (e.pid === S.you) sfx.reward(); burst(p.x, p.y - 12, 10, ['#7ee08a', '#fff'], 30, { grav: 0 }); }
      });
      break;
    }
    case 'reveal': S.dealerReachUntil = S.time + 0.4; sfx.card(); say(['VEAMOS MI CARTA...', 'LA HORA DE LA VERDAD', 'REZEN, FORASTEROS'], 2.2, {}, 0); break;
    case 'dealerHit': S.dealerReachUntil = S.time + 0.5; break;
    case 'settle': {
      if (e.dealerBust) { float('EL DEALER SE PASO!', 240, 104, '#ffd23f', 1, 2.5); dealerMood('sweat', 2.5); say(['ESTO NO ES JUSTO', 'MALDICION!', 'ME DESCUENTAN ESTO']); S.cheerUntil = S.time + 1.5; }
      const mine = [];
      if (!e.dealerBust) {
        const won = e.list.filter(r => r.res === 'win' || r.res === 'blackjack').length, lost = e.list.filter(r => r.res === 'lose').length;
        if (lost > won) say(['LA CASA SIEMPRE GANA', 'GRACIAS POR SU DINERO', 'OTRA VEZ SERA, AMIGOS'], 3, {}, 1);
        else if (won) { say(['HOY ESTAN DE SUERTE...', 'TOMEN, TOMEN... Y LARGUENSE', 'ME VAN A DEJAR EN LA RUINA'], 3, {}, 1); patron(['¡PAGALE, PAGALE!', '¡ESO!']); }
      }
      for (const r of e.list) {
        const p = handPt(r.pid, r.h);
        const lbl = r.res === 'win' ? 'GANA +' + r.net : r.res === 'blackjack' ? 'BLACKJACK +' + r.net : r.res === 'push' ? 'EMPATE' : 'PIERDE ' + r.net;
        const col = r.res === 'lose' ? '#ff5a4a' : r.res === 'push' ? '#cccccc' : '#7ee08a';
        float(lbl, p.x, p.y - 34 - (r.h ? 8 : 0), col, 1, 3.5, -3);
        if (r.res === 'win' || r.res === 'blackjack') { burst(p.x, p.y, 16, ['#ffd23f', '#f2c14e'], 50, { up: 40 }); mood(r.pid, 'happy', 2.5); }
        if (r.res === 'lose') mood(r.pid, 'sad', 2.5);
        if (r.pid === S.you) mine.push(r.res);
      }
      if (mine.some(r => r === 'win' || r === 'blackjack')) sfx.win(); else if (mine.includes('lose')) sfx.lose(); else sfx.coins();
      break;
    }
    case 'eliminated': { const p = avatarPt(e.pid); smoke(p.x, p.y, 20); float(nameOf(e.pid) + ' ELIMINADO', p.x + 20, p.y - 30, '#ff5a4a', 1, 3); sfx.gun(); say(['QUE PASE EL SIGUIENTE', 'SAQUENLO DE AQUI']); break; }
    case 'gameover': S.fireworksUntil = S.time + 6; sfx.yeehaw(); say(['GRACIAS POR JUGAR, FORASTEROS', 'VUELVAN PRONTO... CON MAS DINERO'], 5, {}, 2); patron(['¡QUE PARTIDA!', '¡YEEHAW!']); break;
    case 'emote': S.bubbles.push({ pid: e.pid, text: e.e, life: 0, max: 2.4 }); sfx.hover(); break;
  }
}

export function frame(g, dt) {
  S.time += dt;
  const t = S.time, st = S.state;
  if (!bgCanvas) buildBackground();
  if (S.dealerMood && t > S.dealerMoodUntil) S.dealerMood = null;
  S.dealerReach += ((t < S.dealerReachUntil ? 1 : 0) - S.dealerReach) * Math.min(1, dt * 10);
  const night = st && st.maxHands ? Math.min(1, Math.max(0, (st.handNo - 1) / Math.max(1, st.maxHands - 1))) : 0;

  g.save();
  if (S.shake > 0.1) { g.translate(Math.round((Math.random() - 0.5) * S.shake), Math.round((Math.random() - 0.5) * S.shake)); S.shake *= Math.pow(0.02, dt); }
  g.drawImage(bgCanvas, 0, 0);
  drawWindow(g, t, night);
  drawSign(g, st);
  drawWanted(g, st);
  if (S.brokenBottle && t < S.brokenBottle.until) { g.fillStyle = '#2b1709'; g.fillRect(S.brokenBottle.x - 2, 24, 7, 16); g.fillStyle = '#9fd4ff'; g.fillRect(S.brokenBottle.x, 38, 3, 2); }
  updateNPCs(dt);
  drawNPCs(g, t);
  drawPianist(g, t);
  idleChatter(t);
  // el dealer queda detrás del borde de la mesa
  g.save(); g.beginPath(); g.rect(0, 0, W, TABLE.top + 2); g.clip();
  drawDealer(g, t, S);
  g.restore();
  // la noche oscurece el salón; las lámparas resaltan más
  if (night > 0.05) { g.globalAlpha = night * 0.3; g.fillStyle = '#0a0a2a'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  drawLamps(g, t, night);
  drawMouse(g, t, dt);

  // foco sobre la mano en turno
  if (st && st.turnId && (st.phase === 'turn' || st.phase === 'window')) {
    const p = handPt(st.turnId, st.turnHand);
    g.globalAlpha = 0.16 + Math.sin(t * 5) * 0.05; g.fillStyle = '#fff2a8';
    for (let r = 0; r < 3; r++) { g.beginPath(); g.ellipse(p.x, p.y + 6, 40 - r * 8, 26 - r * 5, 0, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  }
  if (st && st.butter) drawButter(g, t);

  // asientos
  if (st) for (const p of st.players) drawSeat(g, p, st, t);

  // objetivos resaltados
  if (S.targeting && st) {
    const a = 0.5 + Math.sin(t * 10) * 0.3;
    for (const tg of S.targeting) {
      const p = playerOf(tg.pid); if (!p) continue;
      g.globalAlpha = a; g.strokeStyle = '#ff5a4a'; g.lineWidth = 2;
      if (tg.h == null) g.strokeRect(SEATS[p.seat].x - 34, SEATS[p.seat].ay - 5, 76, 30);
      else { const hp = handPt(p.id, tg.h); const w = p.hands.length > 1 ? 50 : 96; g.strokeRect(hp.x - w / 2, SEATS[p.seat].cy - 14, w, 42); }
      g.globalAlpha = 1;
    }
  }

  // cartas
  if (S.spin > 0) S.spin = Math.max(0, S.spin - dt * 1.2);
  for (const s of S.sprites.values()) {
    if (s.delay > 0) { s.delay -= dt * 1000; if (s.delay > 0) continue; }
    if (!s.shown) { s.shown = true; s.pop = 1; sfx.card(); }
    const k = Math.min(1, dt * (S.spin > 0 ? 5 : 11));
    s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k;
    let sx = 1;
    if (s.flipT !== undefined) { s.flipT += dt * 4; sx = Math.abs(Math.cos(Math.min(1, s.flipT) * Math.PI)); if (s.flipT >= 1) s.flipT = undefined; }
    let card = s.card;
    if (card.hidden && S.peek && S.peek.hidden && t < S.peek.until && s.owner === 'dealer') {
      card = S.peek.hidden;
      g.fillStyle = 'rgba(181,123,255,0.5)'; g.fillRect(Math.round(s.x) - 2, Math.round(s.y) - 2, CARD_W + 4, CARD_H + 4);
    }
    const mineOwn = S.pickOwn && s.owner.startsWith(S.you + ':');
    if (mineOwn) { g.fillStyle = `rgba(126,224,138,${0.5 + Math.sin(t * 10) * 0.3})`; g.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 3, CARD_W + 2, CARD_H + 4); }
    const lift = (s.pop > 0 ? -s.pop * 3 : 0) + (mineOwn ? -2 : 0); s.pop = Math.max(0, s.pop - dt * 4);
    drawCard(g, card, s.x, s.y + lift, Math.max(0.05, sx));
  }
  // carta siguiente (vidente)
  if (S.peek && S.peek.top && t < S.peek.until) {
    g.fillStyle = 'rgba(181,123,255,0.5)'; g.fillRect(SHOE.x + 24, SHOE.y - 4, CARD_W + 4, CARD_H + 4);
    drawCard(g, S.peek.top, SHOE.x + 26, SHOE.y - 2);
    drawText(g, 'SIGUIENTE', SHOE.x + 34, SHOE.y + 23, '#e0c8ff', { align: 'center' });
  }
  if (st && st.dealer.value != null && st.dealer.hand.length) drawPill(g, 240, DEALER_Y + 25, String(st.dealer.value), st.dealer.value > 21 ? '#ff5a4a' : C.white);

  // etiquetas de cada mano (por encima de las cartas)
  if (st) for (const p of st.players) drawHandLabels(g, p, st, t);

  // fantasmas (cartas que salen)
  for (let i = S.ghosts.length - 1; i >= 0; i--) {
    const gh = S.ghosts[i]; gh.life += dt;
    if (gh.mode === 'amnesia') { gh.x += gh.vx * dt; gh.y += gh.vy * dt; gh.vy -= 20 * dt; }
    else if (gh.mode === 'center') { gh.x += (232 - gh.x) * Math.min(1, dt * 6); gh.y += (180 - gh.y) * Math.min(1, dt * 6); }
    else if (gh.mode === 'giveback') { gh.x += (SHOE.x - gh.x) * Math.min(1, dt * 5); gh.y += (SHOE.y - 8 - gh.y) * Math.min(1, dt * 5); }
    else { gh.x += (164 - gh.x) * Math.min(1, dt * 5); gh.y += (100 - gh.y) * Math.min(1, dt * 5); }
    const max = gh.mode === 'amnesia' ? 1.4 : 0.6;
    if (gh.life > max) { S.ghosts.splice(i, 1); continue; }
    g.globalAlpha = 1 - gh.life / max;
    drawCard(g, gh.card, gh.x, gh.y, gh.mode === 'amnesia' ? Math.max(0.05, Math.abs(Math.cos(gh.life * 8))) : 1);
    if (gh.mode === 'amnesia') drawText(g, '?', gh.x + 8 + Math.sin(gh.life * 9) * 6, gh.y - 6, C.white, { align: 'center', scale: 2 });
    g.globalAlpha = 1;
  }

  drawProjectiles(g, dt);
  drawParticles(g, dt);
  drawDealerSay(g, t);
  drawPatronSay(g, t);
  drawBubbles(g, dt);
  drawChaos(g, st, t);
  drawFloats(g, dt);
  if (t < S.fireworksUntil && Math.random() < dt * 4) {
    const x = 40 + Math.random() * 400, y = 20 + Math.random() * 80;
    burst(x, y, 30, ['#ffd23f', '#d6403a', '#5aa9e6', '#7ee08a', '#b57bff'], 60, { life: 1.2, grav: 30 });
    if (Math.random() < 0.4) sfx.gun();
  }
  g.restore();
  if (S.flash) { g.globalAlpha = S.flash.a; g.fillStyle = S.flash.color; g.fillRect(0, 0, W, H); g.globalAlpha = 1; S.flash.a -= dt * 1.5; if (S.flash.a <= 0) S.flash = null; }
}

function drawPill(g, x, y, text, col = C.white, bg = 'rgba(20,10,5,0.8)') {
  const w = textWidth(text) + 6; x = Math.round(x);
  g.fillStyle = bg; g.fillRect(Math.round(x - w / 2), y, w, 9); g.fillRect(Math.round(x - w / 2) - 1, y + 1, w + 2, 7);
  drawText(g, text, x, y + 2, col, { align: 'center', outline: false });
}

function drawSeat(g, p, st, t) {
  const seat = SEATS[p.seat], x = seat.x, top = seat.ay;
  const col = skinColor(p);
  const md = S.moods[p.id] && t < S.moods[p.id].until ? S.moods[p.id].m : null;
  const allBust = p.hands.length && p.hands.every(h => h.status === 'bust');
  const m = md || (allBust ? 'bust' : (st.turnId === p.id ? 'turn' : 'idle'));
  if (p.status === 'out') drawTomb(g, x - 22, top - 2);
  else drawChar(g, p.skin, x - 22, top - 2, t, m, !p.connected);
  const isMe = p.id === S.you;
  // placa con nombre y fichas
  const nw = Math.max(textWidth((isMe ? '>' : '') + p.name), textWidth('$' + p.chips)) + 5;
  g.fillStyle = 'rgba(20,10,5,0.6)'; g.fillRect(x - 13, top - 1, nw, 17);
  drawText(g, (isMe ? '>' : '') + p.name, x - 11, top + 1, col, { outline: false });
  drawText(g, '$' + p.chips, x - 11, top + 9, '#ffd23f', { outline: false });
  // cartas de acción (dorsos pequeños)
  const n = Array.isArray(p.cards) ? p.cards.length : p.cards;
  for (let i = 0; i < n; i++) {
    const cx = x - 11 + i * 7, cy = top + 18;
    g.fillStyle = '#1a1014'; g.fillRect(cx - 1, cy - 1, 6, 8);
    g.fillStyle = '#7a3fa0'; g.fillRect(cx, cy, 4, 6); g.fillStyle = '#ffd23f'; g.fillRect(cx + 1, cy + 2, 2, 2);
  }
  if (!p.connected && p.status !== 'out') drawText(g, 'ZZZ', x - 22, top - 8 - (t * 4 % 4), '#aaa', { align: 'center' });
  // apuesta total
  const bet = p.hands.length ? p.hands.reduce((a, h) => a + h.bet, 0) : p.bet;
  if (bet > 0) {
    const bx = x + (p.seat < 2 ? -1 : 1) * (p.hands.length > 1 ? 0 : 44), by = seat.cy + (p.hands.length > 1 ? 36 : 14);
    const chips = Math.min(6, Math.ceil(bet / 100));
    for (let i = 0; i < chips; i++) {
      g.fillStyle = '#1a1014'; g.fillRect(bx - 4, by - i * 2, 9, 3);
      g.fillStyle = p.hands.some(h => h.doubled) ? '#3a7bd6' : C.red; g.fillRect(bx - 3, by - i * 2, 7, 2);
      g.fillStyle = C.white; g.fillRect(bx, by - i * 2, 1, 1);
    }
    drawText(g, String(bet), bx, by + 4, C.white, { align: 'center' });
  }
  // estado general (sin manos todavía)
  let tag = null, tcol = C.white;
  if (p.status === 'betting') { tag = 'APOSTANDO' + '...'.slice(0, 1 + Math.floor(t * 3) % 3); tcol = '#ffd23f'; }
  else if (p.status === 'ready' && st.phase === 'betting') { tag = 'LISTO'; tcol = '#7ee08a'; }
  else if (p.status === 'out') { tag = 'ELIMINADO'; tcol = '#ff5a4a'; }
  if (tag) drawText(g, tag, x, seat.cy + 8, tcol, { align: 'center' });
}

function drawHandLabels(g, p, st, t) {
  const seat = SEATS[p.seat];
  p.hands.forEach((hd, h) => {
    const x = handX(p, h), split = p.hands.length > 1;
    const v = hd.value;
    const vcol = hd.status === 'bust' ? '#ff5a4a' : v === 21 ? '#ffd23f' : C.white;
    drawPill(g, x, seat.cy - 11, hd.limit > 21 ? v + '/' + hd.limit : String(v), vcol, hd.limit > 21 ? 'rgba(122,10,10,0.9)' : undefined);
    let tag = null, tcol = C.white;
    if (hd.status === 'stood') { tag = split ? 'PLANT.' : 'PLANTADO'; tcol = '#9fd8b4'; }
    else if (hd.status === 'bust') { tag = 'SE PASO'; tcol = '#ff5a4a'; }
    if (tag) drawText(g, tag, x, seat.cy + 25, tcol, { align: 'center' });
    const isTurn = st.turnId === p.id && st.turnHand === h && (st.phase === 'turn' || st.phase === 'window');
    if (isTurn) {
      const ay = seat.cy - 24 + Math.round(Math.sin(t * 8) * 2);
      g.fillStyle = C.black; for (let i = 0; i < 4; i++) g.fillRect(x - 4 + i, ay + i, 9 - i * 2, 2); g.fillRect(x - 2, ay - 4, 5, 4);
      g.fillStyle = C.gold; for (let i = 0; i < 4; i++) g.fillRect(x - 3 + i, ay + i, 7 - i * 2, 1); g.fillRect(x - 1, ay - 3, 3, 3);
      if (st.phase === 'turn') {
        const frac = Math.max(0, Math.min(1, (st._msLeftLocal || 0) / (st.turnTime || 20000)));
        g.fillStyle = '#1a1014'; g.fillRect(x - 20, seat.cy + 32, 40, 3);
        g.fillStyle = frac < 0.25 ? '#ff5a4a' : '#ffd23f'; g.fillRect(x - 19, seat.cy + 33, Math.round(38 * frac), 1);
      }
    }
  });
}

function drawChaos(g, st, t) {
  if (!st) return;
  if (st.phase === 'rescue') {
    const left = (st._msLeftLocal || 0) / 1000;
    drawText(g, 'ULTIMA OPORTUNIDAD ' + left.toFixed(1), 240, 44, '#7ee08a', { align: 'center', scale: 1, shadow: true });
    return;
  }
  if ((st.phase !== 'window' && st.phase !== 'final') || S.chaosDur < 1) return;
  // en el caos final el reloj se reinicia con cada carta: se toma del servidor
  const total = st.phase === 'final' ? (st.opts ? st.opts.chaos : S.chaosDur) : S.chaosDur;
  const left = st.phase === 'final' ? (st._msLeftLocal || 0) / 1000 : Math.max(0, S.chaosDur - (t - S.chaosStart));
  const frac = Math.min(1, left / total);
  const pulse = Math.sin(t * 20) * 0.5 + 0.5;
  g.globalAlpha = 0.2 + pulse * 0.15; g.fillStyle = '#d6403a';
  g.fillRect(0, 0, W, 3); g.fillRect(0, H - 3, W, 3); g.fillRect(0, 0, 3, H); g.fillRect(W - 3, 0, 3, H);
  g.globalAlpha = 1;
  const jx = Math.round((Math.random() - 0.5) * 2);
  drawText(g, (st.phase === 'final' ? 'CAOS FINAL! ' : 'CAOS! ') + left.toFixed(1), 240 + jx, 38, '#ff5a4a', { align: 'center', scale: 2, shadow: true });
  g.fillStyle = '#1a1014'; g.fillRect(190, 50, 100, 4);
  g.fillStyle = frac < 0.35 ? '#ff5a4a' : '#ffd23f'; g.fillRect(191, 51, Math.round(98 * frac), 2);
  if (st.phase === 'final' && S.chain > 1) {
    const pop = Math.max(0, 1 - (t - S.chainAt) * 4);
    drawText(g, 'CADENA X' + (S.chain - 1), 316, 40 - Math.round(pop * 3), '#ffd23f', { align: 'center', scale: pop > 0.5 ? 2 : 1, shadow: true });
  }
  if (Math.floor(left * 2) !== S._lastTick) { S._lastTick = Math.floor(left * 2); if (left > 0.1) sfx.tick(); }
}

function drawProjectiles(g, dt) {
  for (let i = S.projectiles.length - 1; i >= 0; i--) {
    const p = S.projectiles[i]; p.t += dt;
    const k = Math.min(1, p.t / p.dur);
    const x = Math.round(p.x0 + (p.x1 - p.x0) * k), y = Math.round(p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * (p.bounce ? 40 : 30));
    if (p.type === 'dynamite') {
      const vert = Math.floor(p.t * 16) % 2;
      const L = p.big ? 10 : 8;
      g.fillStyle = '#d6403a'; if (vert) g.fillRect(x - 2, y - L / 2, 4, L); else g.fillRect(x - L / 2, y - 2, L, 4);
      g.fillStyle = '#c9a26b'; g.fillRect(x - 1, y - 1, 2, 2);
      S.particles.push({ x, y, vx: (Math.random() - 0.5) * 20, vy: -10, life: 0, max: 0.3, color: Math.random() < 0.5 ? '#ffd23f' : '#ff7b2e', size: 1, grav: 0 });
    } else if (p.type === 'lasso') {
      g.fillStyle = '#e8b46a';
      for (let j = 0; j < 8; j++) { const kk = k * j / 8; g.fillRect(Math.round(p.x0 + (p.x1 - p.x0) * kk), Math.round(p.y0 + (p.y1 - p.y0) * kk - Math.sin(kk * Math.PI) * 30), 1, 1); }
      g.fillRect(x - 5, y - 4, 10, 1); g.fillRect(x - 5, y + 3, 10, 1); g.fillRect(x - 6, y - 3, 1, 6); g.fillRect(x + 5, y - 3, 1, 6);
    } else if (p.type === 'boot') {
      g.fillStyle = '#6a4a2a'; g.fillRect(x - 3, y - 6, 4, 8); g.fillRect(x - 3, y, 8, 3); g.fillStyle = '#3a2418'; g.fillRect(x - 3, y + 3, 8, 1);
    } else if (p.type === 'loot') {
      g.fillStyle = '#1a1014'; g.fillRect(x - 3, y - 4, 7, 9); g.fillStyle = '#7a3fa0'; g.fillRect(x - 2, y - 3, 5, 7); g.fillStyle = '#ffd23f'; g.fillRect(x - 1, y - 1, 3, 3);
    } else if (p.type === 'coin') {
      g.fillStyle = '#8a6a1a'; g.fillRect(x - 3, y - 2, 7, 6); g.fillStyle = '#ffd23f'; g.fillRect(x - 2, y - 3, 5, 6); g.fillStyle = '#8a6a1a'; g.fillRect(x, y - 2, 1, 4);
    } else drawText(g, '?', x, y - 4, C.white, { align: 'center', scale: 2 });
    if (k >= 1) S.projectiles.splice(i, 1);
  }
}

function drawParticles(g, dt) {
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const p = S.particles[i]; p.life += dt;
    if (p.life > p.max) { S.particles.splice(i, 1); continue; }
    const k = p.life / p.max;
    if (p.ring) { // anillo cuadrado que crece
      const r = Math.round(4 + k * 24);
      g.globalAlpha = 1 - k; g.fillStyle = p.color;
      g.fillRect(p.x - r, p.y - r, r * 2, 2); g.fillRect(p.x - r, p.y + r - 2, r * 2, 2); g.fillRect(p.x - r, p.y - r, 2, r * 2); g.fillRect(p.x + r - 2, p.y - r, 2, r * 2);
      g.globalAlpha = 1;
      continue;
    }
    p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    g.globalAlpha = p.smoke ? (1 - k) * 0.6 : 1 - k * 0.5;
    g.fillStyle = p.color;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.hat) { g.fillRect(x - 4, y, 9, 2); g.fillRect(x - 2, y - 3, 5, 3); }
    else { const s = p.smoke ? p.size + Math.floor(k * 4) : p.size; g.fillRect(x, y, s, s); }
  }
  g.globalAlpha = 1;
}

function drawFloats(g, dt) {
  for (let i = S.texts.length - 1; i >= 0; i--) {
    const f = S.texts[i]; f.life += dt;
    if (f.life > f.max) { S.texts.splice(i, 1); continue; }
    const k = f.life / f.max;
    f.y += f.vy * dt;
    if (f.banner) {
      const pop = f.life < 0.15 ? f.life / 0.15 : 1;
      g.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      const wob = Math.round(Math.sin(f.life * 30) * (1 - Math.min(1, f.life * 3)) * 3);
      const sc = Math.max(1, Math.round(f.scale * pop));
      drawText(g, f.text, f.x, f.y + wob - 2 * sc, f.color, { align: 'center', scale: sc, shadow: true });
    } else {
      g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      const hw = textWidth(f.text, f.scale) / 2 + 3;
      drawText(g, f.text, Math.max(hw, Math.min(W - hw, f.x)), Math.max(8, f.y), f.color, { align: 'center', scale: f.scale, shadow: f.scale > 1 });
    }
    g.globalAlpha = 1;
  }
}

function drawBubbles(g, dt) {
  for (let i = S.bubbles.length - 1; i >= 0; i--) {
    const b = S.bubbles[i]; b.life += dt;
    if (b.life > b.max) { S.bubbles.splice(i, 1); continue; }
    const s = seatOf(b.pid); if (s < 0) continue;
    const x = SEATS[s].x - 22, y = Math.round(SEATS[s].ay - 16 - Math.min(1, b.life * 8) * 2);
    const w = textWidth(b.text) + 8;
    const bx = Math.round(Math.max(2, Math.min(W - w - 2, x - w / 2)));
    g.fillStyle = C.black; g.fillRect(bx - 1, y - 1, w + 2, 11);
    g.fillStyle = C.white; g.fillRect(bx, y, w, 9);
    g.fillRect(x - 1, y + 9, 3, 2); g.fillStyle = C.black; g.fillRect(x, y + 11, 1, 2);
    drawText(g, b.text, bx + w / 2, y + 2, C.black, { align: 'center', outline: false });
  }
}

export function seatAt(x, y) {
  if (!S.state) return null;
  for (const p of S.state.players) {
    const seat = SEATS[p.seat];
    for (let h = 0; h < p.hands.length; h++) {
      const hx = handX(p, h), w = p.hands.length > 1 ? 50 : 96;
      if (Math.abs(x - hx) < w / 2 && y > seat.cy - 16 && y < seat.cy + 30) return { pid: p.id, h };
    }
    if (x > seat.x - 36 && x < seat.x + 44 && y > seat.ay - 6 && y < seat.ay + 28) return { pid: p.id, h: null };
  }
  return null;
}

export function cardAt(x, y) {
  let best = null;
  for (const [id, s] of S.sprites) {
    if (!s.shown || !s.owner.startsWith(S.you + ':')) continue;
    if (x >= s.x && x < s.x + CARD_W && y >= s.y - 3 && y < s.y + CARD_H) best = { id, h: +s.owner.split(':')[1] }; // la última dibujada queda encima
  }
  return best;
}

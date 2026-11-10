// Parroquianos de la barra: cada uno con su estilo y sus manías. De vez en cuando dos se
// pelean, uno queda KO, el enterrador entra por las puertas batientes y se lo lleva, y entra
// un parroquiano nuevo a ocupar su lugar.
import { C } from './consts.js';
import { S } from './anim.js';
import { drawText } from './pixel.js';
import { drawBar } from './scene.js';
import { say, patron } from './dialogue.js';
import { sfx } from './audio.js';

const SLOTS = [70, 94, 120, 146, 170];   // lugares en la barra (x)
const BASE_Y = 72;                       // y de la cabeza de alguien de pie en la barra
const DOOR = { x: 310, top: 60, bottom: 112 };
const WALK_SPEED = 40;                   // pixeles por segundo

const SKIN = ['#e8b48a', '#d49a70', '#c48a5c', '#a86b45', '#7a4a2a', '#f0c39a'];
const SHIRT = ['#6a3a3a', '#3a5a6a', '#5a6a3a', '#6a5a3a', '#4a3a5a', '#7a6a5a', '#2a3a4a', '#7a4a2a'];
const VEST = ['#2a1a12', '#3a2a3a', '#4a3a1a', '#1a2a2a', '#5a2a1a'];
const HAT_COL = ['#3a2418', '#5a3a1a', '#1a1418', '#7a6a5a', '#8a5a2b', '#4a4a52'];
const HAIR = ['#2a1a12', '#5a3a1a', '#8a6a3a', '#c9c0b0', '#1a1418', '#a33a1a'];
const HATS = ['cowboy', 'cowboy', 'bowler', 'top', 'sombrero', 'bandana', 'feather', 'cap', 'none'];
const FACES = ['beard', 'mustache', 'mustache', 'stubble', 'none', 'none'];
const ACCS = ['none', 'none', 'cigar', 'eyepatch', 'scarf', 'bandolier'];
const HABITS = ['drink', 'talk', 'laugh', 'doze', 'look', 'smoke'];
const NAMES = ['GUS', 'LOLA', 'TEX', 'PACO', 'DOC', 'RUTH', 'CHENTE', 'MAE', 'JOE', 'PANCHA', 'TOBY', 'NENA', 'BILL', 'LUPITA', 'KID', 'CHUY', 'SAM', 'ROSA'];

const rand = (a) => a[Math.floor(Math.random() * a.length)];
function px(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); }

function newLook() {
  const acc = rand(ACCS);
  return {
    skin: rand(SKIN), shirt: rand(SHIRT), vest: Math.random() < 0.5 ? rand(VEST) : null,
    hat: rand(HATS), hatCol: rand(HAT_COL), hair: rand(HAIR), face: rand(FACES), acc,
    scarf: rand(['#a33a3a', '#3a6a9a', '#c9a227', '#6a3a8a']), name: rand(NAMES),
    habit: acc === 'cigar' ? 'smoke' : rand(HABITS),
  };
}
function newNpc(slot) {
  return { slot, x: SLOTS[slot], look: newLook(), state: 'idle', act: 'idle', actT: 1 + Math.random() * 4, phase: Math.random() * 6, actStart: 0 };
}
function ensure() {
  if (S.npcs) return;
  S.npcs = SLOTS.map((_, i) => newNpc(i));
  S.walkers = [];
  S.fight = null;
  S.fightNext = 30 + Math.random() * 25;
  S.doorSwing = 0;
  S.npcAnchors = SLOTS.map(x => ({ x, y: BASE_Y }));
  S.smokes = [];
}

// ---------------- lógica ----------------
export function updateNPCs(dt) {
  ensure();
  const t = S.time;
  S.doorSwing = Math.max(0, S.doorSwing - dt * 0.6);
  // manías de cada quien
  for (const n of S.npcs) {
    if (!n || n.state !== 'idle') continue;
    n.actT -= dt;
    if (n.actT <= 0) {
      n.act = Math.random() < 0.55 ? n.look.habit : rand([...HABITS, 'idle', 'idle']);
      n.actT = 2.5 + Math.random() * 4; n.actStart = t;
    }
    if (n.look.acc === 'cigar' && Math.random() < dt * 1.5) S.smokes.push({ x: n.x + 6, y: BASE_Y + 7, life: 0 });
  }
  for (let i = S.smokes.length - 1; i >= 0; i--) { const s = S.smokes[i]; s.life += dt; s.y -= dt * 6; s.x += Math.sin(s.life * 3) * dt * 3; if (s.life > 2) S.smokes.splice(i, 1); }
  updateFight(dt, t);
  updateWalkers(dt);
  // dónde aparece el globo de texto de cada lugar (null si está vacío o peleando)
  S.npcAnchors = S.npcs.map(n => (n && (n.state === 'idle' || n.state === 'win')) ? { x: n.x, y: BASE_Y } : null);
}

function updateFight(dt, t) {
  const F = S.fight;
  if (!F) {
    S.fightNext -= dt;
    if (S.fightNext > 0) return;
    // dos vecinos que estén tranquilos
    const pairs = [];
    for (let i = 0; i < SLOTS.length - 1; i++) if (S.npcs[i] && S.npcs[i + 1] && S.npcs[i].state === 'idle' && S.npcs[i + 1].state === 'idle') pairs.push(i);
    if (!pairs.length) { S.fightNext = 5; return; }
    const i = rand(pairs);
    const a = S.npcs[i], b = S.npcs[i + 1];
    a.state = b.state = 'argue';
    S.fight = { a: i, b: i + 1, stage: 'argue', t: 0, loser: Math.random() < 0.5 ? i : i + 1 };
    patron(['¿QUÉ ME VES?', '¡TRAMPOSO!', '¡ESE ERA MI WHISKY!', '¡REPÍTELO!'], 1.6, {}, i);
    return;
  }
  F.t += dt;
  const a = S.npcs[F.a], b = S.npcs[F.b];
  if (F.stage === 'argue' && F.t > 1.6) {
    F.stage = 'brawl'; F.t = 0;
    if (a) a.state = 'brawl'; if (b) b.state = 'brawl';
    sfx.whoosh(); S.cheerUntil = S.time + 2.5;
  } else if (F.stage === 'brawl') {
    if (Math.random() < dt * 5) sfx.click();
    if (F.t > 2.8) {
      F.stage = 'ko'; F.t = 0;
      const loser = S.npcs[F.loser], winner = S.npcs[F.loser === F.a ? F.b : F.a];
      if (loser) { loser.state = 'dead'; loser.deadAt = t; }
      if (winner) { winner.state = 'win'; winner.actStart = t; }
      sfx.lose(); S.shake = Math.max(S.shake, 2);
      say(['¡SÁQUENLO DE AQUÍ!', 'OTRO PARA EL ENTERRADOR', '¡EN MI SALOON NO SE PELEA!'], 3, {}, 1);
      if (loser) S.pendingRIP = { name: loser.look.name, at: t + 1.2 };
    }
  } else if (F.stage === 'ko') {
    if (S.pendingRIP && t > S.pendingRIP.at) { patron(['DESCANSE EN PAZ, {n}', '¡KO!', 'PERO SI ERA BUENA GENTE...'], 2.2, { n: S.pendingRIP.name }); S.pendingRIP = null; }
    const winner = S.npcs[F.loser === F.a ? F.b : F.a];
    if (winner && winner.state === 'win' && F.t > 2) { winner.state = 'idle'; winner.act = 'drink'; winner.actT = 3; }
    if (F.t > 2.6) {
      // entra el enterrador por las puertas
      F.stage = 'collect'; F.t = 0;
      S.walkers.push({ kind: 'undertaker', x: DOOR.x, tx: SLOTS[F.loser], carry: null, slot: F.loser });
      S.doorSwing = 1; sfx.door();
    }
  } else if (F.stage === 'newcomer' && F.t > 1.5 && !F.spawned) {
    F.spawned = true;
    const n = newNpc(F.loser); n.state = 'walk'; n.x = DOOR.x;
    S.walkers.push({ kind: 'npc', npc: n, x: DOOR.x, tx: SLOTS[F.loser], slot: F.loser });
    S.doorSwing = 1; sfx.door();
  }
}

function updateWalkers(dt) {
  for (let i = S.walkers.length - 1; i >= 0; i--) {
    const w = S.walkers[i];
    const d = w.tx - w.x, step = WALK_SPEED * dt;
    w.moving = Math.abs(d) > 0.5;
    if (w.moving) { w.x += Math.sign(d) * Math.min(step, Math.abs(d)); w.dir = Math.sign(d); w.walkT = (w.walkT || 0) + dt; continue; }
    if (w.kind === 'undertaker' && !w.carry) {
      // recoge el cuerpo y se lo lleva al hombro
      const body = S.npcs[w.slot];
      w.carry = body ? body.look : newLook();
      S.npcs[w.slot] = null;
      w.tx = DOOR.x;
    } else if (w.kind === 'undertaker' && w.carry) {
      S.walkers.splice(i, 1); S.doorSwing = 1; sfx.door();
      if (S.fight) { S.fight.stage = 'newcomer'; S.fight.t = 0; }
    } else if (w.kind === 'npc') {
      w.npc.x = w.tx; w.npc.state = 'idle'; w.npc.act = 'look'; w.npc.actT = 2;
      S.npcs[w.slot] = w.npc;
      S.walkers.splice(i, 1);
      patron(['¡BIENVENIDO, FORASTERO!', '¡OTRO VALIENTE!'], 2, {});
      say(['PASA, {n}. SIN PELEAS', 'BIENVENIDO, {n}'], 2.6, { n: w.npc.look.name }, 0);
      S.fight = null; S.fightNext = 40 + Math.random() * 35;
    }
  }
}

// ---------------- dibujo ----------------
// pose: { hx, hy, eyes, look, mouth, armL, armR, mug, legs, walkT, hatOff }
function drawPerson(g, x, y, L, pose, t) {
  const hx = x + (pose.hx || 0), hy = y + (pose.hy || 0);
  const shirt = L.shirt;
  // piernas (solo quien camina; en la barra las tapa el mostrador)
  if (pose.legs) {
    const k = Math.sin((pose.walkT || 0) * 10) * 2;
    px(g, x - 5, y + 28 + Math.max(0, k), 4, 12 - Math.max(0, k), '#2a1a12');
    px(g, x + 1, y + 28 + Math.max(0, -k), 4, 12 - Math.max(0, -k), '#2a1a12');
    px(g, x - 6, y + 39, 5, 1, C.black); px(g, x + 1, y + 39, 5, 1, C.black);
  }
  // torso y chaleco
  px(g, x - 7, y + 10, 14, pose.legs ? 18 : 30, shirt);
  if (L.vest) { px(g, x - 7, y + 10, 4, pose.legs ? 18 : 30, L.vest); px(g, x + 3, y + 10, 4, pose.legs ? 18 : 30, L.vest); }
  if (L.acc === 'scarf') px(g, x - 5, y + 10, 10, 2, L.scarf);
  if (L.acc === 'bandolier') for (let k = 0; k < 6; k++) px(g, x - 6 + k * 2, y + 11 + k * 2, 2, 2, '#c9a227');
  // brazos (armL/armR: 0 = abajo, 1 = a media altura, 2 = arriba)
  const arm = (side, lvl) => {
    const ax = side < 0 ? x - 9 : x + 7;
    if (lvl >= 2) { px(g, ax, y + 2, 2, 10, shirt); px(g, ax, y + 1, 2, 2, L.skin); }
    else if (lvl === 1) { px(g, ax, y + 10, 2, 6, shirt); px(g, ax + (side < 0 ? 2 : -2), y + 14, 3, 2, shirt); px(g, ax + (side < 0 ? 4 : -3), y + 13, 2, 2, L.skin); }
    else { px(g, ax, y + 11, 2, 12, shirt); px(g, ax, y + 22, 2, 2, L.skin); }
  };
  arm(-1, pose.armL || 0); arm(1, pose.armR || 0);
  if (pose.mug) { // tarro en la mano derecha, a la altura de la boca
    const mx = x + 3, my = y + 5;
    px(g, mx, my, 4, 5, 'rgba(230,240,255,0.85)'); px(g, mx + 1, my + 1, 2, 4, '#ffd23f'); px(g, mx, my - 1, 4, 1, C.white);
  }
  // cabeza
  px(g, hx - 4, hy + 2, 8, 8, L.skin);
  if (L.hat === 'none') { px(g, hx - 4, hy + 1, 8, 2, L.hair); px(g, hx - 4, hy + 2, 1, 4, L.hair); px(g, hx + 3, hy + 2, 1, 4, L.hair); }
  else if (L.hat !== 'bandana') { px(g, hx - 4, hy + 3, 1, 3, L.hair); px(g, hx + 3, hy + 3, 1, 3, L.hair); }
  // ojos
  const lk = pose.look || 0, ey = hy + 5;
  if (pose.eyes === 'x') {
    for (const ex of [hx - 3, hx + 1]) { px(g, ex, ey - 1, 1, 1, C.black); px(g, ex + 2, ey - 1, 1, 1, C.black); px(g, ex + 1, ey, 1, 1, C.black); px(g, ex, ey + 1, 1, 1, C.black); px(g, ex + 2, ey + 1, 1, 1, C.black); }
  } else if (pose.eyes === 'closed') { px(g, hx - 3, ey + 1, 2, 1, C.black); px(g, hx + 1, ey + 1, 2, 1, C.black); }
  else {
    px(g, hx - 3 + lk, ey, 1, 2, C.black); px(g, hx + 1 + lk, ey, 1, 2, C.black);
    if (pose.eyes === 'angry') { px(g, hx - 4, ey - 2, 3, 1, C.black); px(g, hx + 1, ey - 2, 3, 1, C.black); px(g, hx - 2, ey - 1, 1, 1, C.black); px(g, hx + 1, ey - 1, 1, 1, C.black); }
  }
  if (L.acc === 'eyepatch') { px(g, hx - 4, ey - 1, 3, 3, C.black); px(g, hx - 4, ey - 2, 8, 1, C.black); }
  // vello facial y boca
  if (L.face === 'beard') px(g, hx - 4, hy + 7, 8, 4, L.hair);
  if (L.face === 'mustache') px(g, hx - 3, hy + 7, 6, 1, L.hair);
  if (L.face === 'stubble') { g.globalAlpha = 0.4; px(g, hx - 3, hy + 7, 6, 2, L.hair); g.globalAlpha = 1; }
  const mo = pose.mouth;
  if (mo === 'open' || mo === 'laugh') px(g, hx - 1, hy + 8, 3, 2, '#3a1010');
  else if (mo === 'talk') px(g, hx - 1, hy + 8, 2, Math.floor(t * 8) % 2 + 1, '#3a1010');
  else if (L.face !== 'beard') px(g, hx - 1, hy + 8, 2, 1, '#5a2a1a');
  if (L.acc === 'cigar') { px(g, hx + 2, hy + 8, 4, 1, '#6a4a2a'); px(g, hx + 6, hy + 8, 1, 1, Math.sin(t * 6) > 0 ? '#ff7b2e' : '#d6403a'); }
  // sombrero
  if (!pose.hatOff) drawHat(g, hx, hy + 2, L, t);
}

function drawHat(g, x, top, L, t) {
  const c = L.hatCol, dark = 'rgba(0,0,0,0.35)';
  switch (L.hat) {
    case 'cowboy': case 'feather':
      px(g, x - 7, top - 1, 14, 2, c); px(g, x - 4, top - 5, 8, 4, c); px(g, x - 1, top - 5, 2, 1, dark); px(g, x - 4, top - 2, 8, 1, dark);
      if (L.hat === 'feather') { px(g, x + 3, top - 9, 1, 5, '#e8e0d0'); px(g, x + 4, top - 10, 1, 2, '#d6403a'); }
      break;
    case 'bowler': px(g, x - 5, top - 1, 10, 1, c); px(g, x - 4, top - 4, 8, 3, c); px(g, x - 3, top - 5, 6, 1, c); break;
    case 'top': px(g, x - 5, top - 1, 10, 1, c); px(g, x - 3, top - 9, 6, 8, c); px(g, x - 3, top - 3, 6, 1, '#8f2f2f'); break;
    case 'sombrero':
      px(g, x - 10, top - 1, 20, 2, c); px(g, x - 3, top - 6, 6, 5, c);
      for (let k = -9; k < 10; k += 3) px(g, x + k, top, 1, 1, '#ffd23f');
      break;
    case 'bandana': px(g, x - 4, top, 8, 2, '#a33a3a'); px(g, x + 4, top + 1, 2, 2, '#a33a3a'); px(g, x - 3, top, 1, 1, '#ffd890'); break;
    case 'cap': px(g, x - 4, top - 2, 8, 3, c); px(g, x - 7, top, 4, 1, c); break;
  }
}

function idlePose(n, t) {
  const p = { armL: 0, armR: 0 };
  const since = t - n.actStart;
  const cheer = t < S.cheerUntil, boo = t < S.booUntil;
  if (n.state === 'win') return { armL: 2, armR: 2, mouth: 'laugh', hy: -Math.abs(Math.sin(t * 12)) * 3 };
  if (cheer) return { armL: 2, armR: 2, mouth: 'open', hy: -Math.abs(Math.sin(t * 14 + n.phase)) * 4 };
  if (boo) return { armR: 1, mouth: 'open', eyes: 'angry', look: 1 };
  switch (n.act) {
    case 'drink': { const k = (since % 2.6); if (k < 0.8) { p.armR = 2; p.mug = true; p.hy = -1; p.eyes = 'closed'; } else p.armR = 1; break; }
    case 'talk': p.look = n.slot < 2 ? 1 : -1; p.hx = p.look; p.mouth = 'talk'; p.armL = Math.floor(t * 3 + n.phase) % 2; break;
    case 'laugh': p.mouth = 'laugh'; p.eyes = 'closed'; p.hy = Math.round(Math.sin(t * 16) * 1); p.armL = 1; break;
    case 'doze': p.eyes = 'closed'; p.hy = 2; p.hx = 1; break;
    case 'look': p.look = n.x < 240 ? 1 : -1; if (Math.floor(t + n.phase) % 4 === 0) p.armR = 1; break;
    case 'smoke': p.armR = (since % 3) < 0.8 ? 1 : 0; break;
  }
  if (!p.hy) p.hy = Math.round(Math.abs(Math.sin(t * 1.4 + n.phase)) * 1) * 0;
  return p;
}

export function drawNPCs(g, t) {
  ensure();
  drawDoors(g, t);
  const F = S.fight;
  // quien camina detrás de la barra va antes del mostrador
  for (const w of S.walkers) drawWalker(g, w, t);
  for (const n of S.npcs) {
    if (!n) continue;
    if (n.state === 'brawl') continue; // están dentro de la nube de polvo
    if (n.state === 'dead') { drawDead(g, n, t); continue; }
    let pose = idlePose(n, t);
    if (n.state === 'argue') {
      const other = S.npcs[n.slot === F.a ? F.b : F.a];
      const dir = other ? Math.sign(other.x - n.x) : 1;
      pose = { eyes: 'angry', look: dir, hx: dir, mouth: 'talk', armL: dir < 0 ? 1 : 0, armR: dir > 0 ? 1 : 0 };
    }
    drawPerson(g, n.x, BASE_Y + (pose.hy || 0) * 0, n.look, pose, t);
  }
  drawBar(g);
  // encima del mostrador: humo, zetas, nube de pelea y almas que suben
  for (const s of S.smokes) { g.globalAlpha = Math.max(0, 0.5 - s.life * 0.25); px(g, s.x, s.y, 2, 2, '#bbbbbb'); }
  g.globalAlpha = 1;
  for (const n of S.npcs) {
    if (!n) continue;
    if (n.state === 'idle' && n.act === 'doze' && !(t < S.cheerUntil)) {
      const k = ((t - n.actStart) * 0.6) % 1;
      g.globalAlpha = 1 - k; drawText(g, 'Z', n.x + 5 + k * 4, BASE_Y - 2 - k * 10, '#cfefff', { outline: false }); g.globalAlpha = 1;
    }
    if (n.state === 'argue') drawText(g, Math.floor(t * 4) % 2 ? '#!' : '!', n.x, BASE_Y - 12, '#ff5a4a', { align: 'center' });
  }
  if (F && F.stage === 'brawl') drawBrawlCloud(g, (SLOTS[F.a] + SLOTS[F.b]) / 2, BASE_Y + 12, t);
}

function drawDead(g, n, t) {
  // desplomado sobre la barra: cabeza apoyada en el mostrador, ojos tachados, sombrero caído
  const since = t - (n.deadAt || t);
  const drop = Math.min(1, since * 4);
  const L = n.look;
  drawPerson(g, n.x, BASE_Y + Math.round(drop * 16), L, { eyes: 'x', mouth: 'open', armL: 0, armR: 0, hatOff: true, hx: 1 }, t);
  // el sombrero queda sobre la barra
  drawHat(g, n.x + 10, 98, L, t);
  // alma de caricatura que sube
  if (since > 0.4 && since < 3) {
    const k = (since - 0.4) / 2.6;
    const gx = n.x + Math.sin(since * 4) * 3, gy = BASE_Y + 8 - k * 40;
    g.globalAlpha = 0.85 * (1 - k);
    px(g, gx - 3, gy, 6, 6, '#f4f8ff'); px(g, gx - 2, gy - 1, 4, 1, '#f4f8ff');
    px(g, gx - 3 + (Math.floor(since * 6) % 2), gy + 6, 2, 1, '#f4f8ff'); px(g, gx + 1, gy + 6, 2, 1, '#f4f8ff');
    px(g, gx - 2, gy + 2, 1, 1, C.black); px(g, gx + 1, gy + 2, 1, 1, C.black);
    g.globalAlpha = 1;
  }
}

function drawWalker(g, w, t) {
  const pose = { legs: true, walkT: w.moving ? w.walkT : 0, look: w.dir || 0, hx: w.dir || 0 };
  if (w.kind === 'undertaker') {
    const L = { skin: '#c8c0b8', shirt: '#1a1418', vest: '#2a2228', hat: 'top', hatCol: '#0a0a0e', hair: '#5a5a62', face: 'none', acc: 'none' };
    const y = BASE_Y - 4; // más alto que los demás
    if (w.carry) {
      // el cuerpo va al hombro, de lado
      const dir = w.dir || 1, bx = w.x - dir * 2, by = y + 6;
      px(g, bx - 9, by, 18, 5, w.carry.shirt);
      px(g, bx + dir * 9 - (dir > 0 ? 0 : 6), by - 1, 6, 6, w.carry.skin);
      const ex = bx + dir * 9 + (dir > 0 ? 2 : -4);
      px(g, ex, by + 1, 1, 1, C.black); px(g, ex + 2, by + 1, 1, 1, C.black);
      px(g, bx - dir * 9 - (dir > 0 ? 3 : 0), by + 1, 3, 3, '#2a1a12');
      drawPerson(g, w.x, y, L, { ...pose, armL: 2, armR: 2, mouth: 'closed' }, t);
    } else drawPerson(g, w.x, y, L, pose, t);
  } else drawPerson(g, w.x, BASE_Y, w.npc.look, pose, t);
}

function drawBrawlCloud(g, cx, cy, t) {
  for (let i = 0; i < 10; i++) {
    const a = t * 9 + i * 0.7, r = 6 + (i % 3) * 4;
    px(g, Math.round(cx + Math.cos(a) * r) - 5, Math.round(cy + Math.sin(a * 1.3) * r * 0.6) - 5, 10, 10, i % 2 ? '#d8cbb0' : '#b8a888');
  }
  const k = Math.floor(t * 8) % 4;
  px(g, cx - 14 + k * 2, cy - 12, 4, 3, '#e8b48a'); px(g, cx + 10 - k * 2, cy + 4, 3, 5, '#2a1a12'); px(g, cx + 4, cy - 14 + k, 4, 3, '#e8b48a');
  drawText(g, k % 2 ? '*' : '!', cx + (k % 2 ? -12 + k * 6 : 10), cy - 16, k % 2 ? '#ffd23f' : '#ff5a4a');
  if (k === 0) drawText(g, 'POW', cx, cy - 22, '#ffd23f', { align: 'center' });
}

// puertas batientes del saloon (entre el dealer y el cartel de WANTED)
function drawDoors(g, t) {
  const x = DOOR.x;
  px(g, x - 20, DOOR.top - 2, 40, 3, '#2a160c');
  px(g, x - 20, DOOR.top, 3, DOOR.bottom - DOOR.top, '#3a200f'); px(g, x + 17, DOOR.top, 3, DOOR.bottom - DOOR.top, '#3a200f');
  // la calle se ve por la puerta
  px(g, x - 17, DOOR.top + 1, 34, DOOR.bottom - DOOR.top - 1, '#d08a5a');
  px(g, x - 17, DOOR.top + 30, 34, DOOR.bottom - DOOR.top - 30, '#a8603a');
  // hojas batientes
  const sw = Math.sin(t * 12) * S.doorSwing;
  const wL = Math.max(3, Math.round(17 * (1 - Math.abs(sw) * 0.7)));
  for (const [hinge, sgn] of [[x - 17, 1], [x + 17, -1]]) {
    const left = sgn > 0 ? hinge : hinge - wL;
    px(g, left, DOOR.top + 14, wL, 22, '#8a5a2b');
    px(g, left, DOOR.top + 14, wL, 2, '#a06a35');
    for (let k = 3; k < wL - 1; k += 3) px(g, left + k, DOOR.top + 17, 1, 17, '#5b3216');
  }
}

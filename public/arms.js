// Brazos de los jugadores: reposo sobre la mesa, abanico de cartas de acción en la mano izquierda,
// gestos por jugada (pedir, plantarse, doblar, apostar, dividir, lanzar carta) y gestos de espera.
// Coordenadas relativas al sprite de drawChar: x = esquina izquierda (16 px de ancho), y = arriba con el
// balanceo del cuerpo (los hombros se mueven con él) e y0 = arriba sin balanceo (las manos se quedan
// apoyadas en la mesa).
import { C } from './consts.js';
import { px } from './pixel.js';
import { SKINS, charBob } from './characters.js';
import { S } from './anim.js';
import { sfx } from './audio.js';

const DUR = { knock: 0.75, stand: 0.7, double: 0.8, bet: 0.6, split: 0.7, throw: 0.55, show: 0.9, drum: 2.2, coin: 2.6, scratch: 1.4, cross: 3.2 };
const IDLE = ['drum', 'coin', 'scratch', 'cross'];

// Lanza un gesto (reemplaza al que esté en curso).
export function gesture(pid, type) { S.gestures[pid] = { type, start: S.time, dur: DUR[type], hits: 0 }; }

const ease = (a, b, k) => a + (b - a) * k;
const lerpPt = (a, b, k) => [ease(a[0], b[0], k), ease(a[1], b[1], k)];
// 0 → 1 → 0 en los bordes del gesto, para salir y volver al reposo sin saltos.
const ramp = (p, w = 0.15) => Math.max(0, Math.min(1, p / w, (1 - p) / w));

function thud(x, y) {
  sfx.knock();
  for (let i = 0; i < 4; i++) S.particles.push({ x: x + 1, y: y + 2, vx: (i - 1.5) * 14, vy: -12 - Math.random() * 10, life: 0, max: 0.3, color: '#9fd8b4', size: 1, grav: 120 });
}

// Calcula manos (y codos) según el gesto actual.
function pose(gs, p, k, x, y, y0) {
  const restL = [x - 3, y0 + 19], restR = [x + 17, y0 + 20];
  const o = { L: restL, R: restR, Le: null, Re: null, chip: null, card: null, fingers: null, crossed: false };
  if (!gs) return o;
  const r = ramp(p);
  switch (gs.type) {
    case 'knock': { // dos golpes en la mesa: "otra carta"
      const q = p < 0.47 ? p / 0.47 : Math.min(1, (p - 0.47) / 0.47);
      o.R = [restR[0] - 2 * r, restR[1] - Math.round(Math.sin(Math.PI * q) * 8)];
      const due = (p >= 0.47 ? 1 : 0) + (p >= 0.94 ? 1 : 0);
      if (due > gs.hits) { gs.hits = due; thud(o.R[0], restR[1]); }
      break;
    }
    case 'stand': // mano plana que barre de lado: "me planto"
      o.R = [restR[0] - 3 + Math.round(Math.sin(p * Math.PI * 4) * 4) * r, restR[1] - 3 * r];
      break;
    case 'double': { // empuja la pila de fichas con las dos manos
      const off = -Math.round(Math.sin(Math.PI * p) * 6);
      o.L = lerpPt(restL, [x + 2, y0 + 21 + off], r); o.R = lerpPt(restR, [x + 12, y0 + 21 + off], r);
      o.chip = [x + 6, y0 + 19 + off, 3];
      break;
    }
    case 'bet': { // desliza una ficha hacia adelante
      const off = -Math.round(Math.sin(Math.PI * p) * 5);
      o.R = [restR[0], restR[1] + off];
      if (p < 0.55) o.chip = [o.R[0] - 1, o.R[1] - 2, 1];
      break;
    }
    case 'split': { // separa las manos
      const s = Math.round(Math.sin(Math.PI * p) * 5);
      o.L = [restL[0] - s, restL[1]]; o.R = [restR[0] + s, restR[1] - 1];
      break;
    }
    case 'throw': { // sube el brazo de golpe y lanza
      const up = [x + 15, y - 2];
      const k1 = p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.3) / 0.7);
      o.R = lerpPt(restR, up, Math.max(0, Math.min(1, k1)));
      o.Re = [x + 19, ease(y0 + 16, y + 8, k1)];
      if (p < 0.15) o.card = [o.R[0] - 1, o.R[1] - 6];
      break;
    }
    case 'show': { // alza la carta para que todos la vean
      const up = [x + 15, y - 1];
      o.R = lerpPt(restR, up, ramp(p, 0.2)); o.Re = [x + 19, ease(y0 + 16, y + 8, ramp(p, 0.2))];
      o.card = [o.R[0] - 1, o.R[1] - 6];
      break;
    }
    case 'drum': // tamborilea los dedos
      o.fingers = Math.floor(k * 14) % 4;
      break;
    case 'coin': { // gira una ficha sobre los nudillos
      o.R = lerpPt(restR, [x + 17, y0 + 19], r);
      const c = (k * 1.6) % 1;
      o.chip = [o.R[0] - 1 + Math.round(c * 3), o.R[1] - 2 - Math.round(Math.sin(Math.PI * c) * 2), [3, 2, 1, 2][Math.floor(k * 12) % 4], true];
      break;
    }
    case 'scratch': { // se rasca la cabeza
      const j = Math.floor(k * 14) % 2;
      o.R = lerpPt(restR, [x + 13 + j, y + 5], ramp(p, 0.25)); o.Re = [x + 18, ease(y0 + 17, y + 13, ramp(p, 0.25))];
      break;
    }
    case 'cross': // brazos cruzados
      o.L = lerpPt(restL, [x + 10, y + 18], r); o.R = lerpPt(restR, [x + 4, y + 19], r);
      o.crossed = r > 0.5;
      break;
  }
  return o;
}

// Línea gruesa de 2 px entre dos puntos.
function limb(g, a, b, col) {
  const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let i = 0; i <= n; i++) px(g, Math.round(a[0] + dx * i / n), Math.round(a[1] + dy * i / n), 2, 2, col);
}

function arm(g, sh, el, hand, sleeve, skinTone) {
  if (el) { limb(g, sh, el, sleeve); limb(g, el, hand, sleeve); } else limb(g, sh, hand, sleeve);
  const hx = Math.round(hand[0]), hy = Math.round(hand[1]);
  px(g, hx - 1, hy, 3, 2, skinTone); px(g, hx - 1, hy + 2, 3, 1, 'rgba(0,0,0,0.25)');
}

function miniCard(g, cx, cy) {
  px(g, cx - 1, cy - 1, 5, 7, C.black); px(g, cx, cy, 3, 5, '#7a3fa0'); px(g, cx + 1, cy + 2, 1, 1, '#ffd23f');
}

// Abanico de cartas de acción (dorsos) que sale de la mano.
function fan(g, hand, n) {
  if (n <= 0) return;
  const hx = Math.round(hand[0]), hy = Math.round(hand[1]);
  const start = hx - 3 - (n - 1) * 2;
  for (let i = 0; i < n; i++) {
    const mid = Math.abs(i - (n - 1) / 2);
    miniCard(g, start + i * 2, hy - 6 + Math.round(mid * 0.6));
  }
}

function chip(g, cx, cy, w = 3) {
  px(g, cx, cy, w, 2, C.black); px(g, cx, cy, w, 1, C.red); if (w > 1) px(g, cx + Math.floor(w / 2), cy, 1, 1, C.white);
}

// Dibuja los brazos del jugador. `nCards`: cuántas cartas de acción tiene (se ven en abanico).
export function drawArms(g, pid, skin, cx, top, t, mood, dim, nCards, canIdle) {
  const S0 = SKINS[skin] || SKINS[0];
  const ghost = skin === 8;
  const x = cx - 8, y0 = Math.round(top), y = Math.round(top + charBob(skin, mood, t));
  let gs = S.gestures[pid];
  if (gs && t - gs.start >= gs.dur) { gs = null; delete S.gestures[pid]; }
  // gestos de espera al azar
  if (!S.idleNext[pid]) S.idleNext[pid] = t + 2 + Math.random() * 6;
  if (!gs && canIdle && t > S.idleNext[pid]) {
    const opts = IDLE.filter(k => k !== S.idleLast[pid]);
    const type = opts[Math.floor(Math.random() * opts.length)];
    S.idleLast[pid] = type; gesture(pid, type); gs = S.gestures[pid];
  }
  if (gs) S.idleNext[pid] = Math.max(S.idleNext[pid], gs.start + gs.dur + 3 + Math.random() * 6);
  const k = gs ? t - gs.start : 0, p = gs ? Math.min(1, k / gs.dur) : 0;
  const o = pose(gs, p, k, x, y, y0);

  const sleeve = S0.body, tone = skin === 11 ? '#3a3a4a' : ghost ? S0.body : S0.tone;
  const shL = [x - 1, y + 16], shR = [x + 15, y + 16];
  g.globalAlpha = dim ? 0.45 : ghost ? 0.85 : 1;
  if (o.crossed) { // el derecho va abajo, el izquierdo encima con las cartas
    arm(g, shR, null, o.R, sleeve, tone);
    fan(g, o.L, nCards);
    arm(g, shL, null, o.L, sleeve, tone);
  } else {
    fan(g, o.L, nCards);
    arm(g, shL, o.Le, o.L, sleeve, tone);
    arm(g, shR, o.Re, o.R, sleeve, tone);
  }
  if (o.card) miniCard(g, Math.round(o.card[0]), Math.round(o.card[1]));
  if (o.chip) chip(g, Math.round(o.chip[0]), Math.round(o.chip[1]), o.chip[2]);
  if (o.fingers != null) { // dedos que tamborilean
    const hx = Math.round(o.R[0]), hy = Math.round(o.R[1]);
    for (let i = 0; i < 3; i++) px(g, hx - 2 + i, hy - (i === o.fingers ? 2 : 1), 1, 1, tone);
  }
  g.globalAlpha = 1;
}

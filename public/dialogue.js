// Globos de texto del dealer y del público, con charla de fondo.
import { C, W } from './consts.js';
import { S } from './anim.js';
import { drawText, textWidth } from './pixel.js';
export const rnd = (a) => a[Math.floor(Math.random() * a.length)];

export function fill(text, vars) { for (const k in vars) text = text.split('{' + k + '}').join(vars[k]); return text; }

export function say(lines, dur = 2.8, vars = {}, pri = 1) {
  const d = S.dealerSay, now = S.time;
  if (d && now < d.until && pri < d.pri && now - d.start < 1.5) return;
  S.dealerSay = { text: fill(rnd(lines), vars), start: now, until: now + dur, pri };
  S.lastSay = now;
}

export function patron(lines, dur = 2.4, vars = {}) {
  S.patronSay = { i: Math.floor(Math.random() * 5), text: fill(rnd(lines), vars), start: S.time, until: S.time + dur };
  S.lastPatron = S.time;
}

export const IDLE_DEALER = [
  '¿ALGUIEN QUIERE UN TRAGO?', 'ESTA MESA HUELE A TRAMPA', 'EN MIS TIEMPOS SE JUGABA LIMPIO',
  'NO TOQUEN EL ZAPATO DE CARTAS', 'EL PIANISTA SOLO SABE UNA CANCION', 'SIN ARMAS EN LA MESA, CABALLEROS',
  '¿QUIEN DEJO ENTRAR A ESE RATON?', 'LA CASA SIEMPRE GANA... CASI SIEMPRE', 'MI BIGOTE PRESIENTE UN BLACKJACK',
  'SIGAN JUGANDO, QUE YO COBRO', 'OIGAN, ¿Y LA PROPINA?',
];

export const IDLE_PATRON = [
  '¡APUESTALO TODO!', 'YO ME PLANTABA...', 'ESE SE VA A PASAR', '¡OTRA RONDA!', '¿QUIEN HIZO TRAMPA?',
  'MI CABALLO JUEGA MEJOR', '¡DINAMITA! ¡DINAMITA!', 'HIC!', 'TOCA OTRA, PIANISTA', 'APUESTO 5 PESOS AL DEALER',
];

export const CARD_LINES = {
  amnesia: ['¿SE TE OLVIDO ALGO, {t}?', 'MALA MEMORIA, ¿EH?'],
  mantequilla: ['CUIDADO, LA MESA RESBALA', '¿QUIEN UNTO MANTEQUILLA AQUI?'],
  espejo: ['¡ESO ES MAGIA NEGRA!', 'YO NO VI NADA RARO... CREO'],
  vidente: ['¡DEJA DE MIRAR MIS CARTAS, {n}!', 'ESOS OJOS, {n}...'],
  carterista: ['¡MANOS ARRIBA, LADRON!', 'CUIDA TU BOLSILLO, {t}'],
  lazo: ['¡LAZADO COMO BECERRO!', 'YIIIHA! QUIETO, {t}'],
  empujon: ['¡NADA DE EMPUJONES!', 'UNA CARTA MAS PARA {t}'],
  devolver: ['AQUI NO HAY DEVOLUCIONES... BUENO', 'ARREPENTIDO, ¿EH, {n}?'],
};

export function idleChatter(t) {
  if (S.lastSay === undefined) { S.lastSay = t; S.lastPatron = t; }
  if (!S.idleGap) S.idleGap = 10 + Math.random() * 8;
  if (t - S.lastSay > S.idleGap) { say(IDLE_DEALER, 3.2, {}, 0); S.idleGap = 10 + Math.random() * 8; }
  if (!S.patronGap) S.patronGap = 7 + Math.random() * 7;
  if (t - (S.lastPatron || 0) > S.patronGap) { patron(IDLE_PATRON); S.patronGap = 7 + Math.random() * 7; }
}

export function wrapText(text, max) {
  const out = []; let line = '';
  for (const w of text.split(' ')) {
    if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; }
    else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out;
}

export function bubble(g, text, start, t, x, y, tx, ty, opt = {}) {
  const lines = wrapText(text, opt.max || 22);
  const w = Math.max(...lines.map(l => textWidth(l))) + 8, h = lines.length * 7 + 4;
  x = Math.round(Math.max(2, Math.min(W - w - 2, x))); y = Math.round(y - h);
  const pop = Math.min(1, (t - start) * 8);
  if (pop < 1) { g.globalAlpha = pop; }
  g.fillStyle = C.black; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = opt.bg || C.white; g.fillRect(x, y, w, h);
  // colita
  const cx = Math.max(x + 3, Math.min(x + w - 4, tx));
  for (let i = 0; i < 4; i++) { g.fillStyle = C.black; g.fillRect(cx - 2 + Math.round((tx - cx) * i / 4) - (i ? 0 : 0), y + h + i, 4 - i, 1); }
  g.fillStyle = opt.bg || C.white; g.fillRect(cx - 1, y + h, 2, 1);
  let left = Math.floor((t - start) * 45);
  lines.forEach((l, i) => {
    if (left <= 0) return;
    drawText(g, l.slice(0, left), x + 4, y + 3 + i * 7, opt.color || C.black, { outline: false });
    left -= l.length;
  });
  g.globalAlpha = 1;
}

export function drawDealerSay(g, t) {
  const d = S.dealerSay; if (!d || t > d.until) return;
  bubble(g, d.text, d.start, t, 262, 74, 254, 82, { max: 24 });
}

export function drawPatronSay(g, t) {
  const p = S.patronSay; if (!p || t > p.until) return;
  const gx = [70, 94, 120, 146, 170][p.i];
  if (S.brawl >= 0 && (p.i === 1 || p.i === 2)) return;
  bubble(g, p.text, p.start, t, gx - 20, 66, gx, 70, { max: 16, bg: '#f4ecd8' });
}

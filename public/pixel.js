// Dibujo pixel: fuente bitmap 3x5, iconos de cartas de acción y cartas de la baraja.
import { C, CARD_H, CARD_W } from './consts.js';
export const G = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  '!': ['#', '#', '#', '.', '#'], '?': ['##.', '..#', '.#.', '...', '.#.'], '.': ['.', '.', '.', '.', '#'],
  ':': ['.', '#', '.', '#', '.'], '+': ['...', '.#.', '###', '.#.', '...'], '-': ['...', '...', '###', '...', '...'],
  '/': ['..#', '..#', '.#.', '#..', '#..'], '$': ['.##', '##.', '.#.', '.##', '##.'], '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  "'": ['#', '#', '.', '.', '.'], ',': ['.', '.', '.', '#', '#'], '(': ['.#', '#.', '#.', '#.', '.#'], ')': ['#.', '.#', '.#', '.#', '#.'],
  '=': ['...', '###', '...', '###', '...'], '¡': ['#', '.', '#', '#', '#'], '¿': ['.#.', '...', '.#.', '#..', '.##'],
  '*': ['...', '#.#', '.#.', '#.#', '...'], '>': ['#..', '.#.', '..#', '.#.', '#..'], '<': ['..#', '.#.', '#..', '.#.', '..#'],
  '#': ['#.#', '###', '#.#', '###', '#.#'], '♥': ['#.#', '###', '###', '.#.', '...'],
};

export function norm(s) { return String(s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ñ/g, 'N'); }

export function textWidth(s, scale = 1) {
  s = norm(s); let w = 0;
  for (const ch of s) w += (ch === ' ' ? 2 : (G[ch] ? G[ch][0].length : 3)) + 1;
  return Math.max(0, w - 1) * scale;
}

export function drawText(ctx, s, x, y, color = C.white, opt = {}) {
  const scale = opt.scale || 1, align = opt.align || 'left';
  s = norm(s);
  const w = textWidth(s, scale);
  let cx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  y = Math.round(y);
  const pass = (col, ox, oy) => {
    let px = cx;
    ctx.fillStyle = col;
    for (const ch of s) {
      if (ch === ' ') { px += 3 * scale; continue; }
      const g = G[ch] || G['?'];
      for (let r = 0; r < 5; r++) for (let c = 0; c < g[r].length; c++)
        if (g[r][c] === '#') ctx.fillRect(px + c * scale + ox, y + r * scale + oy, scale, scale);
      px += (g[0].length + 1) * scale;
    }
  };
  if (opt.outline !== false) {
    const oc = opt.outlineColor || C.black;
    pass(oc, -1, 0); pass(oc, 1, 0); pass(oc, 0, -1); pass(oc, 0, 1);
    if (opt.shadow) pass(oc, 1, 2);
  }
  pass(color, 0, 0);
  return w;
}

export function grid(rows, pal) {
  const c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  return c;
}

export const SUIT = {
  h: grid(['.#.#.', '#####', '#####', '.###.', '..#..'], { '#': C.red }),
  d: grid(['..#..', '.###.', '#####', '.###.', '..#..'], { '#': C.red }),
  c: grid(['..#..', '.###.', '#.#.#', '#####', '..#..'], { '#': C.black }),
  s: grid(['..#..', '.###.', '#####', '#####', '.#.#.'], { '#': C.black }),
};

export const ICONS = {
  granada5: ['....yo..', '...o....', '..#.....', '.rrrr...', 'rrrrr...', 'rkkrr...', 'rrrrr...', '.rrr....'],
  granada10: ['...y.o..', '..o.o...', '.#.#....', 'rrrrrr..', 'rkrrkr..', 'rrrrrr..', 'rrrrrr..', '.rrrr...'],
  amnesia: ['.wwww...', 'w....w..', '....w...', '...w....', '...w....', '........', '...w....', '........'],
  mantequilla: ['........', '..yyyy..', '.yYYYYy.', 'yYYYYYy.', 'yyyyyyy.', '.y..y...', '....y...', '........'],
  espejo: ['.bbbbb..', 'b.ccc.b.', 'b.c.c.b.', 'b.ccc.b.', 'b.c...b.', 'b.....b.', '.bbbbb..', '...b....'],
  vidente: ['........', '..pppp..', '.p.ww.p.', 'p.wkkw.p', '.p.ww.p.', '..pppp..', '........', '........'],
  comunismo: ['...y....', '...y....', 'yyyyyyy.', '.yyyyy..', '..yyy...', '.yy.yy..', 'y.....y.', '........'],
  escudo: ['.gggggg.', 'gGGGGGGg', 'gGggggGg', 'gGgGGgGg', '.gGggGg.', '.gGGGGg.', '..gGGg..', '...gg...'],
  carterista: ['..kkkk..', '.kwkkwk.', '.kkkkkk.', '..kkkk..', '...yy...', '..yyyy..', '.yyyyyy.', '..yyyy..'],
  lazo: ['.oooo...', 'o....o..', 'o....o..', '.oooo...', '....o...', '.....o..', '......o.', '.......o'],
  empujon: ['........', '...w....', '...ww...', 'wwwwwww.', 'wwwwwww.', '...ww...', '...w....', '........'],
  carrusel: ['.cccc...', 'c....c.c', 'c.....cc', '.....ccc', 'ccc.....', 'cc.....c', 'c.c....c', '...cccc.'],
  devolver: ['..G.....', '.GG.....', 'GGGGGG..', '.GG...G.', '..G...G.', '......G.', '..GGGG..', '........'],
  abogado: ['r......r', 'rr....rr', '.rrrrrr.', '.r.rr.r.', '.rrrrrr.', '..r..r..', '..rrrr..', '........'],
};

export const ICON_PAL = { y: '#ffd23f', o: '#ff7b2e', '#': '#8a6b4a', r: '#d6403a', k: '#2a1a14', w: '#f4ecd8', Y: '#fff2a8', b: '#9fd4ff', c: '#e8f6ff', p: '#b57bff', g: '#3fa34d', G: '#7ee08a' };

export const ICON_CACHE = {};

export function iconCanvas(type) {
  if (!ICON_CACHE[type]) ICON_CACHE[type] = grid(ICONS[type] || ICONS.amnesia, ICON_PAL);
  return ICON_CACHE[type];
}

export function px(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); }

export function drawCard(g, card, x, y, sx = 1) {
  x = Math.round(x); y = Math.round(y);
  const w = Math.max(1, Math.round(CARD_W * Math.abs(sx)));
  const ox = x + Math.round((CARD_W - w) / 2);
  const back = card.hidden || sx < 0;
  // sombra
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(ox + 1, y + 2, w, CARD_H);
  let bg = C.cream, border = '#5a4a3a';
  if (back) { bg = '#8f2f2f'; border = '#3a1010'; }
  else if (card.k === 'b') { bg = '#ff8a3d'; border = '#7a2a0a'; }
  else if (card.k === 'v') { bg = '#b8282a'; border = '#4a0a0a'; }
  g.fillStyle = border; g.fillRect(ox + 1, y, w - 2, CARD_H); g.fillRect(ox, y + 1, w, CARD_H - 2);
  g.fillStyle = bg; g.fillRect(ox + 1, y + 1, w - 2, CARD_H - 2);
  if (w < 8) return;
  if (back) {
    g.fillStyle = '#b84a3a';
    for (let yy = 3; yy < CARD_H - 3; yy++) for (let xx = 3; xx < w - 3; xx++) if ((xx + yy) % 4 === 0) g.fillRect(ox + xx, y + yy, 1, 1);
    g.fillStyle = C.gold; g.fillRect(ox + w / 2 - 1, y + CARD_H / 2 - 1, 2, 2);
    return;
  }
  if (card.k === 'c') {
    const red = card.s === 'h' || card.s === 'd';
    const col = red ? C.red : C.black;
    drawText(g, card.r === '10' ? '10' : card.r, ox + 2, y + 2, col, { outline: false });
    g.drawImage(SUIT[card.s], ox + Math.round(w / 2) - 2, y + 11);
    if (['J', 'Q', 'K'].includes(card.r)) { g.fillStyle = C.gold; g.fillRect(ox + w - 4, y + 2, 2, 2); }
  } else if (card.k === 'b') {
    g.drawImage(iconCanvas(card.v >= 10 ? 'granada10' : 'granada5'), ox + 4, y + 2);
    drawText(g, '+' + card.v, ox + w / 2, y + 13, C.white, { align: 'center' });
  } else if (card.k === 'v') {
    g.drawImage(iconCanvas('comunismo'), ox + 4, y + 2);
    drawText(g, String(card.v), ox + w / 2, y + 13, '#ffd23f', { align: 'center', outlineColor: '#4a0a0a' });
  }
}

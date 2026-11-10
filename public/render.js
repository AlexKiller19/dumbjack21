// Render pixel art del saloon. Resolución interna baja, escalada con CSS pixelated.
import { sfx } from './audio.js';

export const W = 480, H = 232;
export const SEAT_COLORS = ['#f2c14e', '#e8505b', '#4fbf73', '#5aa9e6'];
export const SEAT_CHARS = ['Sheriff', 'Bandida', 'Tahúr', 'Minero'];
// x = centro del asiento, cy = borde superior de sus cartas, ay = borde superior del avatar.
// Los asientos siguen la curva de la mesa: los de las orillas quedan más arriba.
const SEATS = [{ x: 76, cy: 124, ay: 164 }, { x: 186, cy: 146, ay: 188 }, { x: 294, cy: 146, ay: 188 }, { x: 404, cy: 124, ay: 164 }];
const CARD_W = 16, CARD_H = 22;
const SHOE = { x: 322, y: 94 };
const DEALER_Y = 100;

const C = {
  wallA: '#6b4226', wallB: '#5d381f', wallC: '#7d4f2d', dark: '#2a160c', beam: '#3d2212',
  felt: '#1f6e47', feltD: '#185a3a', feltL: '#2d8a5a', rim: '#5b3216', rimL: '#8f5a2c', rimD: '#3a1f0d',
  gold: '#f2c14e', cream: '#f4ecd8', red: '#d6403a', black: '#1a1014', white: '#fff8e8',
  skin: ['#f0c39a', '#d99a6c', '#c48a5c', '#a86b45'],
};

// ---------------- fuente bitmap 3x5 ----------------
const G = {
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
function norm(s) { return String(s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/Ñ/g, 'N'); }
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

// ---------------- sprites desde texto ----------------
function grid(rows, pal) {
  const c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  return c;
}
const SUIT = {
  h: grid(['.#.#.', '#####', '#####', '.###.', '..#..'], { '#': C.red }),
  d: grid(['..#..', '.###.', '#####', '.###.', '..#..'], { '#': C.red }),
  c: grid(['..#..', '.###.', '#.#.#', '#####', '..#..'], { '#': C.black }),
  s: grid(['..#..', '.###.', '#####', '#####', '.#.#.'], { '#': C.black }),
};
const ICONS = {
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
  soborno: ['..y.y...', '...y....', '..yyy...', '.yyyyy..', 'yykyyyy.', 'yykkyyy.', '.yyyyy..', '........'],
  carrusel: ['.cccc...', 'c....c.c', 'c.....cc', '.....ccc', 'ccc.....', 'cc.....c', 'c.c....c', '...cccc.'],
  devolver: ['..G.....', '.GG.....', 'GGGGGG..', '.GG...G.', '..G...G.', '......G.', '..GGGG..', '........'],
  abogado: ['r......r', 'rr....rr', '.rrrrrr.', '.r.rr.r.', '.rrrrrr.', '..r..r..', '..rrrr..', '........'],
};
const ICON_PAL = { y: '#ffd23f', o: '#ff7b2e', '#': '#8a6b4a', r: '#d6403a', k: '#2a1a14', w: '#f4ecd8', Y: '#fff2a8', b: '#9fd4ff', c: '#e8f6ff', p: '#b57bff', g: '#3fa34d', G: '#7ee08a' };
const ICON_CACHE = {};
export function iconCanvas(type) {
  if (!ICON_CACHE[type]) ICON_CACHE[type] = grid(ICONS[type] || ICONS.amnesia, ICON_PAL);
  return ICON_CACHE[type];
}

// ---------------- escena estática ----------------
// Mesa de blackjack: lado recto con el dealer arriba, curva hacia el jugador.
const TABLE = { cx: 240, top: 90, flat: 118, bottom: 212, hw: 236 };
function tableHalf(y, inset = 0) {
  const hw = TABLE.hw - inset;
  if (y < TABLE.top + inset || y > TABLE.bottom - inset) return 0;
  if (y <= TABLE.flat) return hw;
  const k = (y - TABLE.flat) / (TABLE.bottom - inset - TABLE.flat);
  return hw * Math.sqrt(Math.max(0, 1 - k * k));
}
let bgCanvas = null;
function buildBackground() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // pared de tablones
  for (let x = 0; x < W; x += 12) {
    g.fillStyle = (x / 12) % 3 === 0 ? C.wallA : (x / 12) % 3 === 1 ? C.wallB : C.wallC;
    g.fillRect(x, 0, 12, 100);
    g.fillStyle = C.dark; g.fillRect(x, 0, 1, 100);
    g.fillStyle = 'rgba(255,220,170,0.08)'; g.fillRect(x + 1, 0, 1, 100);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let k = 0; k < 4; k++) g.fillRect(x + 3 + ((x * 7 + k * 13) % 7), (x * 3 + k * 29) % 90, 1, 6 + (k * 5) % 9);
    g.fillStyle = '#c9a26b'; g.fillRect(x + 6, 9, 1, 1); g.fillRect(x + 6, 74, 1, 1);
  }
  g.fillStyle = C.beam; g.fillRect(0, 0, W, 6);
  g.fillStyle = '#4e2c17'; g.fillRect(0, 6, W, 1);
  g.fillStyle = C.beam; g.fillRect(0, 78, W, 4); g.fillStyle = C.rimL; g.fillRect(0, 78, W, 1);
  for (let x = 0; x < W; x += 24) { g.fillStyle = '#4a2a15'; g.fillRect(x, 82, 24, 18); g.fillStyle = '#3a200f'; g.fillRect(x, 82, 1, 18); g.fillRect(x + 3, 85, 18, 1); g.fillRect(x + 3, 96, 18, 1); }
  // piso de madera
  for (let y = 100; y < H; y += 8) {
    g.fillStyle = (y / 8) % 2 ? '#3b2110' : '#44260f'; g.fillRect(0, y, W, 8);
    g.fillStyle = '#2a160c'; g.fillRect(0, y, W, 1);
    for (let x = ((y * 5) % 60); x < W; x += 60) g.fillRect(x, y, 1, 8);
  }
  // ventana (marco)
  g.fillStyle = C.rimD; g.fillRect(12, 16, 52, 48);
  // estante de botellas
  g.fillStyle = C.rimD; g.fillRect(78, 20, 84, 44);
  g.fillStyle = '#2b1709'; g.fillRect(80, 22, 80, 40);
  g.fillStyle = C.rimL; g.fillRect(78, 40, 84, 3); g.fillRect(78, 61, 84, 3);
  const bottleCols = ['#3e8e4f', '#a3542a', '#6b3fa0', '#c9a227', '#2f6f8f', '#8f2f2f', '#5f8f2f'];
  for (let i = 0; i < 11; i++) {
    const bx = 82 + i * 7, h = 9 + (i * 5) % 6;
    g.fillStyle = bottleCols[i % bottleCols.length];
    g.fillRect(bx, 40 - h, 5, h); g.fillRect(bx + 1, 40 - h - 4, 3, 4);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(bx + 1, 40 - h + 1, 1, h - 3);
  }
  for (let i = 0; i < 9; i++) {
    const bx = 84 + i * 8, h = 8 + (i * 3) % 7;
    g.fillStyle = bottleCols[(i + 3) % bottleCols.length];
    g.fillRect(bx, 61 - h, 6, h); g.fillRect(bx + 2, 61 - h - 3, 2, 3);
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(bx + 1, 61 - h + 1, 1, h - 2);
  }
  // cartel central
  g.fillStyle = C.rimD; g.fillRect(176, 8, 128, 22);
  g.fillStyle = '#8a5a2b'; g.fillRect(178, 10, 124, 18);
  g.fillStyle = '#a06a35'; g.fillRect(178, 10, 124, 2);
  g.fillStyle = '#c9a26b'; g.fillRect(180, 12, 1, 1); g.fillRect(299, 12, 1, 1); g.fillRect(180, 25, 1, 1); g.fillRect(299, 25, 1, 1);
  // cartel WANTED
  g.fillStyle = '#e8d5a8'; g.fillRect(340, 14, 36, 46);
  g.fillStyle = '#cdb88a'; g.fillRect(340, 58, 36, 2); g.fillRect(374, 14, 2, 46);
  // piano
  g.fillStyle = '#2b1709'; g.fillRect(388, 52, 84, 46);
  g.fillStyle = '#4a2a15'; g.fillRect(390, 54, 80, 30);
  g.fillStyle = '#3a200f'; g.fillRect(394, 58, 72, 2);
  g.fillStyle = C.cream; g.fillRect(392, 84, 76, 6);
  g.fillStyle = C.black; for (let k = 0; k < 15; k++) if (k % 7 !== 2 && k % 7 !== 6) g.fillRect(395 + k * 5, 84, 2, 3);
  g.fillStyle = '#2b1709'; g.fillRect(392, 90, 76, 8);

  // mesa: sombra, borde de madera y paño
  for (let y = TABLE.top; y <= TABLE.bottom + 5; y++) {
    const sh = tableHalf(y - 5); if (sh) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(TABLE.cx - sh, y, sh * 2, 1); }
  }
  for (let y = TABLE.top; y <= TABLE.bottom; y++) {
    const hw = Math.round(tableHalf(y)), hin = Math.round(tableHalf(y, 6));
    g.fillStyle = C.rim; g.fillRect(TABLE.cx - hw, y, hw * 2, 1);
    g.fillStyle = C.rimL; g.fillRect(TABLE.cx - hw, y, 2, 1); if (y < TABLE.top + 2) g.fillRect(TABLE.cx - hw, y, hw * 2, 1);
    g.fillStyle = C.rimD; g.fillRect(TABLE.cx + hw - 2, y, 2, 1);
    if (hin > 0) {
      g.fillStyle = C.felt; g.fillRect(TABLE.cx - hin, y, hin * 2, 1);
      g.fillStyle = C.rimD; g.fillRect(TABLE.cx - hin - 1, y, 1, 1); g.fillRect(TABLE.cx + hin, y, 1, 1);
    }
  }
  // borde inferior con relieve y textura del paño
  for (let x = TABLE.cx - TABLE.hw; x < TABLE.cx + TABLE.hw; x++) {
    const k = (x - TABLE.cx) / TABLE.hw;
    const yb = Math.round(TABLE.flat + (TABLE.bottom - TABLE.flat) * Math.sqrt(Math.max(0, 1 - k * k)));
    g.fillStyle = C.rimD; g.fillRect(x, yb - 1, 1, 2);
  }
  g.fillStyle = C.feltD;
  for (let y = TABLE.top + 8; y < TABLE.bottom - 6; y += 2) {
    const hin = tableHalf(y, 8);
    for (let x = (y % 4); x < W; x += 4) if (Math.abs(x - TABLE.cx) < hin) g.fillRect(x, y, 1, 1);
  }
  // arco dorado y letreros del paño
  g.fillStyle = 'rgba(242,193,78,0.35)';
  for (let x = 60; x < 420; x++) {
    const k = (x - 240) / 190;
    g.fillRect(x, Math.round(100 + 34 * Math.sqrt(Math.max(0, 1 - k * k))), 1, 1);
  }
  const old = g.globalAlpha; g.globalAlpha = 0.45;
  drawText(g, 'BLACKJACK PAGA 3 A 2', 240, 126, '#f2c14e', { align: 'center', outline: false });
  g.globalAlpha = old;
  // zapato de cartas
  g.fillStyle = '#2b1709'; g.fillRect(SHOE.x - 2, SHOE.y - 2, 22, 18);
  g.fillStyle = '#5b3216'; g.fillRect(SHOE.x, SHOE.y, 18, 14);
  g.fillStyle = '#7a2a2a'; g.fillRect(SHOE.x + 2, SHOE.y - 4, 14, 6);
  g.fillStyle = '#a33a3a'; g.fillRect(SHOE.x + 3, SHOE.y - 4, 12, 1);
  // bandeja de fichas
  g.fillStyle = '#2b1709'; g.fillRect(150, 93, 44, 8);
  const chipCols = ['#d6403a', '#3a7bd6', '#2a2a2a', '#3fa34d', '#f4ecd8', '#b57bff'];
  for (let i = 0; i < 6; i++) { g.fillStyle = chipCols[i]; g.fillRect(152 + i * 7, 94, 6, 6); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(152 + i * 7, 94, 6, 1); }
  bgCanvas = c;
}

// ---------------- personajes ----------------
function px(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); }

function drawChar(g, seat, cx, top, t, mood, dim) {
  const bob = mood === 'happy' ? -Math.abs(Math.sin(t * 12)) * 3 : mood === 'turn' ? Math.round(Math.sin(t * 6)) : Math.round(Math.sin(t * 2 + seat) * 0.6);
  const y = top + bob;
  const x = cx - 8;
  const skin = C.skin[seat % 4];
  const col = SEAT_COLORS[seat];
  if (dim) g.globalAlpha = 0.45;
  // cuerpo
  const body = ['#8a5a2b', '#3a2a3a', '#2f6a3f', '#2f4f8f'][seat];
  px(g, x + 1, y + 15, 14, 7, body);
  px(g, x + 6, y + 15, 4, 7, seat === 2 ? C.white : seat === 3 ? '#4a6fb0' : body);
  // cabeza
  px(g, x + 3, y + 5, 10, 10, skin);
  px(g, x + 3, y + 14, 10, 1, 'rgba(0,0,0,0.2)');
  // ojos (parpadeo)
  const blink = ((t + seat * 1.7) % 4) < 0.12;
  const eyeY = y + 9;
  if (mood === 'bust') {
    px(g, x + 5, eyeY - 1, 1, 1, C.black); px(g, x + 7, eyeY + 1, 1, 1, C.black); px(g, x + 6, eyeY, 1, 1, C.black); px(g, x + 5, eyeY + 1, 1, 1, C.black); px(g, x + 7, eyeY - 1, 1, 1, C.black);
    px(g, x + 9, eyeY - 1, 1, 1, C.black); px(g, x + 11, eyeY + 1, 1, 1, C.black); px(g, x + 10, eyeY, 1, 1, C.black); px(g, x + 9, eyeY + 1, 1, 1, C.black); px(g, x + 11, eyeY - 1, 1, 1, C.black);
  } else if (!blink) {
    px(g, x + 5, eyeY, 2, 2, C.white); px(g, x + 9, eyeY, 2, 2, C.white);
    px(g, x + 6, eyeY, 1, 2, C.black); px(g, x + 10, eyeY, 1, 2, C.black);
  } else { px(g, x + 5, eyeY + 1, 2, 1, C.black); px(g, x + 9, eyeY + 1, 2, 1, C.black); }
  // boca
  if (mood === 'happy') { px(g, x + 6, y + 12, 4, 1, C.black); px(g, x + 7, y + 13, 2, 1, '#c0392b'); }
  else if (mood === 'sad' || mood === 'bust') { px(g, x + 6, y + 13, 4, 1, C.black); px(g, x + 5, y + 14, 1, 1, C.black); px(g, x + 10, y + 14, 1, 1, C.black); }
  else px(g, x + 7, y + 13, 3, 1, '#7a3b2a');

  if (seat === 0) { // Sheriff: sombrero café, bigote, estrella
    px(g, x + 6, y + 12, 5, 1, '#5a3a1a');
    px(g, x, y + 4, 16, 2, '#8a5a2b'); px(g, x + 3, y, 10, 5, '#a0703a'); px(g, x + 7, y, 2, 1, '#6a4a2a'); px(g, x + 3, y + 3, 10, 1, '#5a3a1a');
    px(g, x + 3, y + 17, 3, 3, C.gold); px(g, x + 4, y + 16, 1, 1, C.gold); px(g, x + 4, y + 20, 1, 1, C.gold);
  } else if (seat === 1) { // Bandida: sombrero negro, pañuelo rojo, cabello
    px(g, x + 2, y + 6, 2, 10, '#6a3a1a'); px(g, x + 12, y + 6, 2, 10, '#6a3a1a');
    px(g, x + 3, y + 11, 10, 4, C.red); px(g, x + 6, y + 15, 4, 2, C.red); px(g, x + 4, y + 12, 1, 1, '#ff8a80');
    px(g, x, y + 4, 16, 2, '#1a1418'); px(g, x + 3, y, 10, 5, '#2a2228'); px(g, x + 3, y + 3, 10, 1, '#a33');
  } else if (seat === 2) { // Tahúr: chistera, bigote fino, chaleco verde
    px(g, x + 5, y + 12, 6, 1, '#1a1014'); px(g, x + 4, y + 13, 1, 1, '#1a1014'); px(g, x + 11, y + 13, 1, 1, '#1a1014');
    px(g, x + 1, y + 4, 14, 2, '#1a1014'); px(g, x + 4, y - 4, 8, 9, '#221a22'); px(g, x + 4, y + 1, 8, 2, '#3fa34d');
    px(g, x + 1, y + 15, 4, 7, '#3fa34d'); px(g, x + 11, y + 15, 4, 7, '#3fa34d'); px(g, x + 7, y + 16, 2, 1, C.red);
  } else { // Minero: casco con lámpara, barba
    px(g, x + 3, y + 11, 10, 5, '#d8d8d8'); px(g, x + 4, y + 16, 8, 2, '#d8d8d8'); px(g, x + 6, y + 12, 4, 1, '#7a3b2a');
    px(g, x + 2, y + 4, 12, 2, '#d4a017'); px(g, x + 3, y + 1, 10, 4, '#f2c14e'); px(g, x + 6, y + 1, 4, 3, '#fff2a8');
    px(g, x + 3, y + 17, 2, 5, '#6a4a2a'); px(g, x + 11, y + 17, 2, 5, '#6a4a2a');
    if (Math.sin(t * 3) > 0) { g.globalAlpha = (dim ? 0.45 : 1) * 0.25; px(g, x + 4, y - 2, 8, 3, '#fff2a8'); g.globalAlpha = dim ? 0.45 : 1; }
  }
  g.globalAlpha = 1;
  // collar de color del jugador
  px(g, x + 1, y + 21, 14, 1, col);
}

function drawTomb(g, cx, top) {
  px(g, cx - 7, top + 4, 14, 18, '#7a7a8a'); px(g, cx - 5, top + 2, 10, 2, '#7a7a8a');
  px(g, cx - 7, top + 4, 1, 18, '#9a9aaa'); px(g, cx - 5, top + 2, 10, 1, '#9a9aaa');
  drawText(g, 'RIP', cx, top + 9, '#2a2a3a', { align: 'center', outline: false });
  px(g, cx - 9, top + 21, 18, 2, '#3a5a2a');
}

function drawDealer(g, t, st) {
  const cx = 240, top = 40;
  const shake = st.dealerMood === 'laugh' ? Math.round(Math.sin(t * 40)) : 0;
  const bob = Math.round(Math.sin(t * 1.5));
  const x = cx - 18 + shake, y = top + bob;
  // cuerpo
  px(g, x + 2, y + 30, 32, 24, C.white);
  px(g, x + 2, y + 30, 9, 24, '#8f2f2f'); px(g, x + 25, y + 30, 9, 24, '#8f2f2f'); // chaleco
  px(g, x + 14, y + 31, 8, 3, C.black); px(g, x + 17, y + 31, 2, 3, '#444'); // moño
  px(g, x + 6, y + 36, 2, 1, C.gold); px(g, x + 6, y + 40, 2, 1, C.gold); // botones
  px(g, x + 28, y + 36, 2, 1, C.gold); px(g, x + 28, y + 40, 2, 1, C.gold);
  // ligas en brazos
  px(g, x - 2, y + 32, 6, 14, C.white); px(g, x + 32, y + 32, 6, 14, C.white);
  px(g, x - 2, y + 36, 6, 2, C.red); px(g, x + 32, y + 36, 6, 2, C.red);
  // manos (la derecha va al zapato al repartir)
  const reach = st.dealerReach || 0;
  px(g, x - 1, y + 46, 5, 4, '#e8b48a');
  px(g, x + 33 + reach * 40, y + 46 - reach * 4, 5, 4, '#e8b48a');
  // cabeza
  px(g, x + 9, y + 8, 18, 20, '#e8b48a');
  px(g, x + 9, y + 26, 18, 2, '#c8946a');
  px(g, x + 7, y + 14, 2, 5, '#e8b48a'); px(g, x + 27, y + 14, 2, 5, '#e8b48a');
  // pelo engominado
  px(g, x + 9, y + 6, 18, 5, '#1a1014'); px(g, x + 17, y + 6, 1, 4, '#3a3040');
  // visera verde
  px(g, x + 6, y + 9, 24, 3, '#2d9a5a'); px(g, x + 6, y + 11, 24, 1, '#1f6e47');
  g.globalAlpha = 0.25; px(g, x + 9, y + 12, 18, 3, '#2d9a5a'); g.globalAlpha = 1;
  // ojos
  const blink = (t % 3.3) < 0.12;
  const look = st.dealerLook || 0;
  if (st.dealerMood === 'laugh') {
    px(g, x + 12, y + 16, 4, 1, C.black); px(g, x + 20, y + 16, 4, 1, C.black);
  } else if (!blink) {
    px(g, x + 12, y + 15, 4, 3, C.white); px(g, x + 20, y + 15, 4, 3, C.white);
    px(g, x + 13 + look, y + 15, 2, 3, C.black); px(g, x + 21 + look, y + 15, 2, 3, C.black);
  } else { px(g, x + 12, y + 17, 4, 1, C.black); px(g, x + 20, y + 17, 4, 1, C.black); }
  if (st.dealerMood === 'shock') { px(g, x + 11, y + 13, 5, 1, C.black); px(g, x + 20, y + 13, 5, 1, C.black); }
  // nariz
  px(g, x + 17, y + 18, 2, 3, '#d49a70');
  // bigote enorme (se mueve)
  const tw = Math.sin(t * 3) > 0.92 ? -1 : 0;
  px(g, x + 10, y + 21, 16, 2, '#3a2418');
  px(g, x + 7, y + 20 + tw, 4, 2, '#3a2418'); px(g, x + 25, y + 20 + tw, 4, 2, '#3a2418');
  px(g, x + 6, y + 19 + tw, 2, 1, '#3a2418'); px(g, x + 28, y + 19 + tw, 2, 1, '#3a2418');
  // boca
  if (st.dealerMood === 'laugh') { px(g, x + 14, y + 23, 8, 3, '#5a1a1a'); px(g, x + 15, y + 23, 6, 1, C.white); }
  else if (st.dealerMood === 'shock') px(g, x + 16, y + 23, 4, 3, '#5a1a1a');
  else px(g, x + 15, y + 24, 6, 1, '#7a3b2a');
  if (st.dealerMood === 'sweat') { px(g, x + 26, y + 12 + ((t * 20) % 8), 1, 2, '#9fd4ff'); }
}

// ---------------- cartas ----------------
function drawCard(g, card, x, y, sx = 1) {
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

// ---------------- estado de animación ----------------
const S = {
  state: null, you: null, prev: null,
  sprites: new Map(), ghosts: [], particles: [], texts: [], projectiles: [], bubbles: [],
  shake: 0, flash: null, dealerMood: null, dealerMoodUntil: 0, dealerReach: 0, dealerReachUntil: 0, dealerLook: 0,
  dealerSay: null, cheerUntil: 0, booUntil: 0, moods: {}, peek: null, chaosStart: 0, chaosDur: 0, fireworksUntil: 0,
  tumble: -1, hints: { spawn: {}, remove: {} }, time: 0,
  targeting: null,   // [{ pid, h }] manos (h=null: jugador completo)
  pickOwn: false,    // eligiendo una carta propia (Arrepentimiento)
  brawl: -1, brawlNext: 25, mouse: -1, mouseNext: 12, brokenBottle: null, spin: 0, lastShieldAt: -1,
};
export const anim = S;

const key = (pid, h) => pid + ':' + (h || 0);
function playerOf(pid) { return S.state && S.state.players.find(q => q.id === pid); }
function seatOf(pid) { const p = playerOf(pid); return p ? p.seat : -1; }
// centro X de una mano (las manos divididas van lado a lado)
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
  for (const e of events) handleEvent(e);
}

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
      if (card.k === 'v') { x = 232; y = 150; delay = 700; }
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

// ---------------- efectos ----------------
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
function banner(text, color, scale = 3, life = 1.4) { S.texts.push({ text, x: 240, y: 60, color, scale, life: 0, max: life, vy: 0, banner: true }); }
function mood(pid, m, dur = 1.6) { S.moods[pid] = { m, until: S.time + dur }; }
function dealerMood(m, dur = 1.5) { S.dealerMood = m; S.dealerMoodUntil = S.time + dur; }
function say(lines, dur = 2.4) { S.dealerSay = { text: lines[Math.floor(Math.random() * lines.length)], until: S.time + dur }; }
function later(ms, fn) { setTimeout(fn, ms); }

const CARD_NAMES = {
  granada5: 'GRANADA +5', granada10: 'GRANADA +10', amnesia: 'AMNESIA', mantequilla: 'MANO DE MANTEQUILLA',
  espejo: 'ESPEJO CUANTICO', vidente: 'VIDENTE', comunismo: 'COMUNISMO', escudo: 'ESCUDO DE GOMA', abogado: 'ABOGADO DEL DIABLO',
  carterista: 'CARTERISTA', lazo: 'LAZO', empujon: 'EMPUJON', soborno: 'SOBORNO', carrusel: 'CARRUSEL', devolver: 'ARREPENTIMIENTO',
};

function handleEvent(e) {
  const t = S.time;
  switch (e.type) {
    case 'join': sfx.door(); break;
    case 'shuffle': sfx.shuffle(); break;
    case 'hand': banner('MANO ' + e.n, C.gold, 3, 1.3); say(['HAGAN SUS APUESTAS', 'A VER ESE DINERO', 'APUESTEN, FORASTEROS']); break;
    case 'bet': { const p = avatarPt(e.pid); float('$' + e.amount, p.x + 20, p.y - 20, C.gold); sfx.chip(); break; }
    case 'deal': S.dealerReachUntil = t + 1.4; break;
    case 'natural': { later(900, () => { const p = handPt(e.pid, e.h); burst(p.x, p.y, 30, ['#ffd23f', '#fff2a8', '#ff7b2e'], 70, { up: 30 }); float('BLACKJACK!', p.x, p.y - 14, '#ffd23f', 2, 2); sfx.blackjack(); mood(e.pid, 'happy', 2); dealerMood('shock'); say(['SUERTE DE PRINCIPIANTE', 'TRAMPOSO...', 'NO PUEDE SER']); S.cheerUntil = S.time + 1.5; for (let i = 0; i < 5; i++) burst(70 + i * 22, 62, 1, ['#8a5a2b', '#2a2228'], 30, { up: 90, life: 1.6, grav: 160, hat: true }); }); break; }
    case 'turn': {
      const p = handPt(e.pid, e.h);
      if (e.pid === S.you && !e.again) { sfx.turn(); float('TU TURNO!', p.x, p.y - 28, C.gold, 2, 1.2); }
      S.dealerLook = Math.sign(p.x - 240);
      break;
    }
    case 'chain': {
      S.chain = (S.chain || 1) + 1; S.chainAt = S.time;
      sfx.chaos(); S.shake = Math.max(S.shake, 2);
      break;
    }
    case 'revive': {
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
      if (e.dur > 1000) sfx.chaos();
      if (e.double) float('DOBLA!', handPt(e.pid, e.h).x, handPt(e.pid, e.h).y - 24, '#9fd4ff', 2);
      break;
    }
    case 'double': sfx.chip(); break;
    case 'split': { const p = handPt(e.pid, 0); float('DIVIDE!', SEATS[seatOf(e.pid)].x, p.y - 26, '#9fd4ff', 2, 1.4); sfx.chip(); sfx.card(); break; }
    case 'hit': S.dealerReachUntil = t + 0.5; if (e.butter) { const p = handPt(e.pid, e.h); float('RESBALON! 2 CARTAS', p.x, p.y - 22, '#ffd23f', 1, 2); sfx.slip(); } break;
    case 'stand': if (!e.auto) { const p = handPt(e.pid, e.h); float('ME PLANTO', p.x, p.y - 22, '#9fd8b4'); } sfx.click(); break;
    case 'play': {
      const from = avatarPt(e.pid);
      float(CARD_NAMES[e.card] + '!', from.x + 20, from.y - 26, SEAT_COLORS[seatOf(e.pid)], 1, 1.8, -10);
      banner(CARD_NAMES[e.card], '#ffd23f', 2, 1.2);
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
        sfx.boom(); S.cheerUntil = S.time + 1.2; mood(e.pid, 'sad', 1.5);
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
    case 'butter': sfx.slip(); float('EL SIGUIENTE QUE PIDA RECIBE 2!', 240, 160, '#ffd23f', 1, 2.2); break;
    case 'lasso': { later(380, () => { const p = handPt(e.pid, e.h); float('LAZADO! SE PLANTA', p.x, p.y - 24, '#e8b46a', 1, 2); S.particles.push({ ring: true, x: p.x, y: p.y, life: 0, max: 0.5, color: '#e8b46a' }); mood(e.pid, 'sad'); sfx.boing(); }); break; }
    case 'push': { later(280, () => { const p = handPt(e.pid, e.h); float('EMPUJON! UNA MAS', p.x, p.y - 24, '#ffb0a0', 1, 2); S.shake = Math.max(S.shake, 2); sfx.lose(); }); S.dealerReachUntil = t + 0.5; break; }
    case 'steal': {
      const a = avatarPt(e.target), b = avatarPt(e.pid);
      S.projectiles.push({ type: 'loot', x0: a.x, y0: a.y, x1: b.x, y1: b.y, t: 0, dur: 0.5 });
      float('LE ROBARON!', a.x + 20, a.y - 24, '#b57bff', 1, 2); sfx.reward(); mood(e.target, 'sad'); mood(e.pid, 'happy');
      break;
    }
    case 'bribe': { const a = avatarPt(e.pid); S.projectiles.push({ type: 'coin', x0: a.x, y0: a.y, x1: 240, y1: 70, t: 0, dur: 0.5 }); sfx.coins(); later(500, () => { dealerMood('laugh', 1.2); say(['NO VI NADA...', 'QUE CARTA? CUAL CARTA?', 'GRACIAS, CABALLERO']); }); break; }
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
    case 'peek': S.peek = { hidden: e.hidden, top: e.top, until: S.time + 5 }; float('SOLO TU LO VES (5S)', 240, 150, '#b57bff', 1, 2.5); break;
    case 'comunismo': {
      sfx.comunismo(); S.flash = { color: '#d6403a', a: 0.45 }; banner('TODOS A ' + e.avg, '#ffd23f', 3, 2);
      burst(232, 150, 40, ['#d6403a', '#ffd23f'], 80, { life: 0.9 }); say(['CAMARADAS...', 'AQUI TODOS IGUALES']);
      break;
    }
    case 'bust': {
      later(e.by ? (S.lastShieldAt === S.time ? 900 : 500) : 250, () => {
        const p = handPt(e.pid, e.h);
        smoke(p.x, p.y, 14);
        float('SE PASO! ' + e.v, p.x, p.y - 22, '#ff5a4a', 2, 1.8);
        sfx.bust(); mood(e.pid, 'bust', 3); dealerMood('laugh', 1.6); S.shake = Math.max(S.shake, 2);
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
    case 'reveal': S.dealerReachUntil = S.time + 0.4; sfx.card(); break;
    case 'dealerHit': S.dealerReachUntil = S.time + 0.5; break;
    case 'settle': {
      if (e.dealerBust) { float('EL DEALER SE PASO!', 240, 86, '#ffd23f', 1, 2.5); dealerMood('sweat', 2.5); say(['ESTO NO ES JUSTO', 'MALDICION!', 'ME DESCUENTAN ESTO']); S.cheerUntil = S.time + 1.5; }
      const mine = [];
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
    case 'gameover': S.fireworksUntil = S.time + 6; sfx.yeehaw(); break;
    case 'emote': S.bubbles.push({ pid: e.pid, text: e.e, life: 0, max: 2.4 }); sfx.hover(); break;
  }
}

// ---------------- dibujo por cuadro ----------------
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
  drawCrowd(g, t);
  drawPianist(g, t);
  drawBrawl(g, t, dt);
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
    else if (gh.mode === 'center') { gh.x += (232 - gh.x) * Math.min(1, dt * 6); gh.y += (150 - gh.y) * Math.min(1, dt * 6); }
    else if (gh.mode === 'giveback') { gh.x += (SHOE.x - gh.x) * Math.min(1, dt * 5); gh.y += (SHOE.y - 8 - gh.y) * Math.min(1, dt * 5); }
    else { gh.x += (150 - gh.x) * Math.min(1, dt * 5); gh.y += (70 - gh.y) * Math.min(1, dt * 5); }
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
  const col = SEAT_COLORS[p.seat];
  const md = S.moods[p.id] && t < S.moods[p.id].until ? S.moods[p.id].m : null;
  const allBust = p.hands.length && p.hands.every(h => h.status === 'bust');
  const m = md || (allBust ? 'bust' : (st.turnId === p.id ? 'turn' : 'idle'));
  if (p.status === 'out') drawTomb(g, x - 22, top - 2);
  else drawChar(g, p.seat, x - 22, top - 2, t, m, !p.connected);
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
    drawText(g, 'ULTIMA OPORTUNIDAD ' + left.toFixed(1), 240, 66, '#7ee08a', { align: 'center', scale: 1, shadow: true });
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
  drawText(g, (st.phase === 'final' ? 'CAOS FINAL! ' : 'CAOS! ') + left.toFixed(1), 240 + jx, 66, '#ff5a4a', { align: 'center', scale: 2, shadow: true });
  g.fillStyle = '#1a1014'; g.fillRect(190, 79, 100, 4);
  g.fillStyle = frac < 0.35 ? '#ff5a4a' : '#ffd23f'; g.fillRect(191, 80, Math.round(98 * frac), 2);
  if (st.phase === 'final' && S.chain > 1) {
    const pop = Math.max(0, 1 - (t - S.chainAt) * 4);
    drawText(g, 'CADENA X' + (S.chain - 1), 240, 86 - Math.round(pop * 3), '#ffd23f', { align: 'center', scale: pop > 0.5 ? 2 : 1, shadow: true });
  }
  if (Math.floor(left * 2) !== S._lastTick) { S._lastTick = Math.floor(left * 2); if (left > 0.1) sfx.tick(); }
}

function drawButter(g, t) {
  const x = SHOE.x - 18, y = SHOE.y + 4;
  g.fillStyle = '#c9a227'; g.fillRect(x, y + 2, 12, 6);
  g.fillStyle = '#ffe680'; g.fillRect(x, y, 12, 4);
  g.fillStyle = '#fff2a8'; g.fillRect(x + 1, y, 4, 1);
  g.fillStyle = '#ffd23f'; g.fillRect(x + 3, y + 8, 1, 1 + Math.floor((t * 6) % 6));
}

// cielo: del atardecer a la noche según avanza la partida
const SKIES = [
  ['#ffb347', '#ff8a5c', '#e8606a', '#b5507a', '#6a3a7a'],
  ['#e8606a', '#b5507a', '#6a3a7a', '#3a2a5a', '#1a1a3a'],
  ['#2a2a5a', '#1e1e48', '#161638', '#10102a', '#0a0a1e'],
];
function drawWindow(g, t, night) {
  const x = 14, y = 18, w = 48, h = 44;
  const bands = SKIES[night < 0.34 ? 0 : night < 0.67 ? 1 : 2];
  for (let i = 0; i < h; i++) {
    const k = i / h * (bands.length - 1);
    const a = Math.floor(k), f = k - a;
    g.fillStyle = (f > 0.5 && i % 2 === 0) ? bands[Math.min(bands.length - 1, a + 1)] : bands[a];
    g.fillRect(x, y + h - 1 - i, w, 1);
  }
  if (night >= 0.67) { // luna y estrellas
    g.fillStyle = '#f4ecd8'; g.fillRect(x + 32, y + 6, 6, 6); g.fillRect(x + 31, y + 7, 8, 4); g.fillStyle = bands[4]; g.fillRect(x + 35, y + 6, 3, 3);
    g.fillStyle = '#fff';
    for (let i = 0; i < 9; i++) if (Math.sin(t * 2 + i * 1.7) > -0.6) g.fillRect(x + 3 + (i * 17) % 44, y + 3 + (i * 11) % 20, 1, 1);
  } else { // sol poniéndose
    const sy = y + 26 + Math.round(night * 22);
    g.fillStyle = '#fff2a8'; g.fillRect(x + 25, sy - 6, 10, 12); g.fillRect(x + 23, sy - 4, 14, 8);
  }
  g.fillStyle = night >= 0.67 ? '#1a1024' : '#5a2a3a'; g.fillRect(x, y + 30, 18, 14); g.fillRect(x + 4, y + 26, 10, 4);
  g.fillStyle = night >= 0.67 ? '#100a18' : '#3a1a2a'; g.fillRect(x, y + 36, w, 8);
  g.fillStyle = night >= 0.67 ? '#12241a' : '#2a4a2a'; g.fillRect(x + 36, y + 24, 3, 14); g.fillRect(x + 33, y + 28, 2, 5); g.fillRect(x + 33, y + 28, 3, 1); g.fillRect(x + 40, y + 26, 2, 5); g.fillRect(x + 39, y + 30, 3, 1);
  // planta rodadora
  if (S.tumble < 0 && Math.random() < 0.002) S.tumble = 0;
  if (S.tumble >= 0) {
    S.tumble += 0.35;
    const tx = Math.round(x - 6 + S.tumble), ty = Math.round(y + 34 - Math.abs(Math.sin(S.tumble / 5)) * 6);
    if (tx > x + 2 && tx < x + w - 3) { g.fillStyle = '#8a6a3a'; g.fillRect(tx - 2, ty - 3, 5, 6); g.fillRect(tx - 3, ty - 2, 7, 4); g.fillStyle = '#5a4a2a'; g.fillRect(tx - 2, ty - 1, 4, 1); g.fillRect(tx - 1, ty - 2, 1, 4); }
    if (S.tumble > w + 12) S.tumble = -1;
  }
  g.fillStyle = C.rimD; g.fillRect(x + 23, y, 2, h); g.fillRect(x, y + 21, w, 2);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 2, y + 2, 2, 16);
}

function drawSign(g, st) {
  const flick = Math.random() < 0.02 ? 0.5 : 1;
  g.globalAlpha = flick;
  drawText(g, 'DUMBJACK21', 240, 12, '#ffb347', { align: 'center', scale: 2, outlineColor: '#3a1a0a' });
  g.globalAlpha = 1;
  if (st && st.phase !== 'lobby') drawText(g, `MANO ${st.handNo}/${st.maxHands}`, 240, 32, C.cream, { align: 'center' });
}

function drawWanted(g, st) {
  drawText(g, 'WANTED', 358, 17, '#5a2a1a', { align: 'center', outline: false });
  let leader = null;
  if (st && st.players.length) leader = st.players.filter(p => p.status !== 'out').sort((a, b) => b.chips - a.chips)[0];
  g.fillStyle = '#cdb88a'; g.fillRect(346, 24, 24, 22);
  if (leader) {
    drawChar(g, leader.seat, 358, 25, S.time, 'idle');
    drawText(g, '$' + leader.chips, 358, 50, '#5a2a1a', { align: 'center', outline: false });
  } else drawText(g, '???', 358, 32, '#5a2a1a', { align: 'center', outline: false });
}

function drawLamps(g, t, night) {
  for (const [lx, ph] of [[150, 0], [330, 1.3]]) {
    g.fillStyle = '#2a1a0a'; g.fillRect(lx, 0, 1, 14);
    g.fillStyle = '#3a2a1a'; g.fillRect(lx - 3, 14, 7, 2);
    g.fillStyle = '#ffd890'; g.fillRect(lx - 2, 16, 5, 6);
    g.fillStyle = '#3a2a1a'; g.fillRect(lx - 3, 22, 7, 2);
    // halo cuadriculado (pixel art), más fuerte de noche
    const r = Math.round(20 + night * 8 + Math.sin(t * 9 + ph) * 1.5 + Math.random());
    g.fillStyle = '#ffcc66';
    for (let i = 0; i < 4; i++) {
      const rr = r - i * 5; g.globalAlpha = 0.045 + night * 0.03;
      g.fillRect(lx - rr, 19 - rr + 4, rr * 2, rr * 2 - 8); g.fillRect(lx - rr + 4, 19 - rr, rr * 2 - 8, rr * 2);
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const dx = Math.sin(t * 0.3 + i * 2.1 + ph) * 16, dy = ((t * 3 + i * 7) % 40);
      g.fillStyle = 'rgba(255,240,200,0.5)'; g.fillRect(Math.round(lx + dx), Math.round(26 + dy), 1, 1);
    }
  }
}

function drawCrowd(g, t) {
  const cheer = t < S.cheerUntil, boo = t < S.booUntil;
  const guys = [[72, 0, '#2a1a12'], [96, 1, '#24160f'], [122, 2, '#2e1c14'], [148, 3, '#22140c'], [440, 4, '#2a1a12']];
  for (const [gx, i, col] of guys) {
    if (S.brawl >= 0 && (i === 1 || i === 2)) continue; // están en la pelea
    const jump = Math.round(cheer ? Math.abs(Math.sin(t * 14 + i)) * 5 : Math.abs(Math.sin(t * 1.5 + i)) * 1);
    const y = 66 - jump;
    g.fillStyle = col;
    g.fillRect(gx - 7, y + 10, 14, 30);
    g.fillRect(gx - 4, y + 2, 8, 8);
    if (i % 2 === 0) { g.fillRect(gx - 7, y + 1, 14, 2); g.fillRect(gx - 4, y - 3, 8, 4); }
    else g.fillRect(gx - 5, y, 10, 3);
    if (cheer) { g.fillRect(gx - 10, y + 2 - Math.round(Math.abs(Math.sin(t * 14 + i)) * 4), 3, 10); g.fillRect(gx + 7, y + 2 - Math.round(Math.abs(Math.cos(t * 14 + i)) * 4), 3, 10); }
    if (boo) g.fillRect(gx + 7, y + 12, 3, 8 + Math.round(Math.sin(t * 20 + i)));
    g.fillStyle = 'rgba(255,230,180,0.6)'; if ((t + i) % 5 > 0.15) { g.fillRect(gx - 2, y + 5, 1, 1); g.fillRect(gx + 1, y + 5, 1, 1); }
  }
  if (boo) drawText(g, 'BUUU!', 110 + Math.round(Math.sin(t * 30)), 52, '#ff8a80', { align: 'center' });
  else if (cheer) drawText(g, 'YEEHAW!', 110, 50 - Math.round(Math.abs(Math.sin(t * 10)) * 2), '#ffd23f', { align: 'center' });
}

// pelea de cantina: de vez en cuando dos parroquianos desaparecen en una nube de polvo
function drawBrawl(g, t, dt) {
  if (S.brawl < 0) { S.brawlNext -= dt; if (S.brawlNext <= 0) { S.brawl = 0; S.brawlNext = 45 + Math.random() * 40; } return; }
  S.brawl += dt;
  const cx = 109, cy = 84;
  for (let i = 0; i < 9; i++) {
    const a = t * 9 + i * 0.7, r = 6 + (i % 3) * 4;
    g.fillStyle = i % 2 ? '#d8cbb0' : '#b8a888';
    g.fillRect(Math.round(cx + Math.cos(a) * r) - 4, Math.round(cy + Math.sin(a * 1.3) * r * 0.6) - 4, 8, 8);
  }
  g.fillStyle = '#24160f';
  const k = Math.floor(t * 8) % 4;
  g.fillRect(cx - 14 + k * 2, cy - 12, 4, 3); g.fillRect(cx + 10 - k * 2, cy + 4, 3, 5); g.fillRect(cx + 4, cy - 14 + k, 3, 4);
  if (k % 2) drawText(g, '*', cx - 12 + k * 6, cy - 16, '#ffd23f'); else drawText(g, '!', cx + 10, cy - 14, '#ff5a4a');
  if (S.brawl > 3.2) S.brawl = -1;
}

function drawMouse(g, t, dt) {
  if (S.mouse < 0) { S.mouseNext -= dt; if (S.mouseNext <= 0) { S.mouse = 0; S.mouseNext = 18 + Math.random() * 25; S.mouseDir = Math.random() < 0.5 ? 1 : -1; } return; }
  S.mouse += dt * 70;
  const x = Math.round(S.mouseDir > 0 ? S.mouse - 8 : W + 8 - S.mouse), y = H - 6;
  g.fillStyle = '#8a8a8a'; g.fillRect(x - 3, y, 6, 3); g.fillRect(x + S.mouseDir * 3, y + 1, 2, 2);
  g.fillStyle = '#c9a0a0'; g.fillRect(x - S.mouseDir * 5, y + 2, 3, 1);
  g.fillStyle = C.black; g.fillRect(x + S.mouseDir * 3, y + 1, 1, 1);
  if (S.mouse > W + 16) S.mouse = -1;
}

function drawPianist(g, t) {
  const b = Math.round(Math.abs(Math.sin(t * 7)) * 2);
  const x = 410, y = 62 - b;
  g.fillStyle = '#1a1014'; g.fillRect(x, y + 10, 14, 18);
  g.fillStyle = '#e8b48a'; g.fillRect(x + 3, y + 2, 8, 8);
  g.fillStyle = '#1a1014'; g.fillRect(x + 1, y, 12, 3); g.fillRect(x + 3, y - 3, 8, 3);
  g.fillStyle = '#e8b48a'; g.fillRect(x + 14 + (Math.sin(t * 14) > 0 ? 2 : 0), y + 20, 3, 2); g.fillRect(x + 20 + (Math.cos(t * 14) > 0 ? 2 : 0), y + 20, 3, 2);
  for (let i = 0; i < 3; i++) {
    const k = ((t * 0.5 + i / 3) % 1);
    const nx = Math.round(430 + Math.sin(k * 6 + i) * 8 + i * 8), ny = Math.round(50 - k * 40);
    g.globalAlpha = 1 - k; g.fillStyle = '#ffd23f';
    g.fillRect(nx, ny, 2, 2); g.fillRect(nx + 1, ny - 4, 1, 4); g.fillRect(nx + 2, ny - 4, 2, 1);
  }
  g.globalAlpha = 1;
}

function drawDealerSay(g, t) {
  const d = S.dealerSay; if (!d || t > d.until) return;
  const w = textWidth(d.text) + 8, x = 266, y = 40;
  g.fillStyle = C.black; g.fillRect(x - 1, y - 1, w + 2, 11); g.fillRect(x - 4, y + 3, 4, 3);
  g.fillStyle = C.white; g.fillRect(x, y, w, 9); g.fillRect(x - 3, y + 4, 3, 1);
  drawText(g, d.text, x + 4, y + 2, C.black, { outline: false });
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

// ---------------- clics sobre la mesa (coords internas) ----------------
// Devuelve la mano o el jugador bajo el cursor: { pid, h } (h=null si es la zona del avatar)
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
// Carta propia bajo el cursor (para Arrepentimiento)
export function cardAt(x, y) {
  let best = null;
  for (const [id, s] of S.sprites) {
    if (!s.shown || !s.owner.startsWith(S.you + ':')) continue;
    if (x >= s.x && x < s.x + CARD_W && y >= s.y - 3 && y < s.y + CARD_H) best = { id, h: +s.owner.split(':')[1] }; // la última dibujada queda encima
  }
  return best;
}

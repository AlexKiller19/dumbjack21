// El saloon: fondo, mesa, ventana, lámparas, público, barra, pianista y detalles vivos.
import { C, H, SHOE, W } from './consts.js';
import { S } from './anim.js';
import { drawChar } from './characters.js';
import { drawText } from './pixel.js';
export const TABLE = { cx: 240, top: 112, flat: 140, bottom: 250, hw: 216 };

export function tableHalf(y, inset = 0) {
  const hw = TABLE.hw - inset;
  if (y < TABLE.top + inset || y > TABLE.bottom - inset) return 0;
  if (y <= TABLE.flat) return hw;
  const k = (y - TABLE.flat) / (TABLE.bottom - inset - TABLE.flat);
  return hw * Math.sqrt(Math.max(0, 1 - k * k));
}

export let bgCanvas = null;

export function buildBackground() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // pared de tablones
  for (let x = 0; x < W; x += 12) {
    g.fillStyle = (x / 12) % 3 === 0 ? C.wallA : (x / 12) % 3 === 1 ? C.wallB : C.wallC;
    g.fillRect(x, 0, 12, 114);
    g.fillStyle = C.dark; g.fillRect(x, 0, 1, 114);
    g.fillStyle = 'rgba(255,220,170,0.08)'; g.fillRect(x + 1, 0, 1, 114);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let k = 0; k < 4; k++) g.fillRect(x + 3 + ((x * 7 + k * 13) % 7), (x * 3 + k * 29) % 90, 1, 6 + (k * 5) % 9);
    g.fillStyle = '#c9a26b'; g.fillRect(x + 6, 9, 1, 1); g.fillRect(x + 6, 74, 1, 1);
  }
  g.fillStyle = C.beam; g.fillRect(0, 0, W, 6);
  g.fillStyle = '#4e2c17'; g.fillRect(0, 6, W, 1);
  g.fillStyle = C.beam; g.fillRect(0, 92, W, 4); g.fillStyle = C.rimL; g.fillRect(0, 92, W, 1);
  for (let x = 0; x < W; x += 24) { g.fillStyle = '#4a2a15'; g.fillRect(x, 96, 24, 18); g.fillStyle = '#3a200f'; g.fillRect(x, 96, 1, 18); g.fillRect(x + 3, 99, 18, 1); g.fillRect(x + 3, 110, 18, 1); }
  // piso de madera
  for (let y = 114; y < H; y += 8) {
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
  g.fillStyle = '#2b1709'; g.fillRect(388, 62, 84, 52);
  g.fillStyle = '#4a2a15'; g.fillRect(390, 64, 80, 30);
  g.fillStyle = '#3a200f'; g.fillRect(394, 68, 72, 2);
  g.fillStyle = C.cream; g.fillRect(392, 94, 76, 6);
  g.fillStyle = C.black; for (let k = 0; k < 15; k++) if (k % 7 !== 2 && k % 7 !== 6) g.fillRect(395 + k * 5, 94, 2, 3);
  g.fillStyle = '#2b1709'; g.fillRect(392, 100, 76, 14);
  g.fillStyle = '#4a2a15'; g.fillRect(396, 103, 68, 1);

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
    g.fillRect(x, Math.round(120 + 34 * Math.sqrt(Math.max(0, 1 - k * k))), 1, 1);
  }
  const old = g.globalAlpha; g.globalAlpha = 0.45;
  drawText(g, 'BLACKJACK PAGA 3 A 2', 240, 146, '#f2c14e', { align: 'center', outline: false });
  g.globalAlpha = old;
  // zapato de cartas
  g.fillStyle = '#2b1709'; g.fillRect(SHOE.x - 2, SHOE.y - 2, 22, 18);
  g.fillStyle = '#5b3216'; g.fillRect(SHOE.x, SHOE.y, 18, 14);
  g.fillStyle = '#7a2a2a'; g.fillRect(SHOE.x + 2, SHOE.y - 4, 14, 6);
  g.fillStyle = '#a33a3a'; g.fillRect(SHOE.x + 3, SHOE.y - 4, 12, 1);
  // bandeja de fichas
  g.fillStyle = '#2b1709'; g.fillRect(150, 113, 44, 8);
  const chipCols = ['#d6403a', '#3a7bd6', '#2a2a2a', '#3fa34d', '#f4ecd8', '#b57bff'];
  for (let i = 0; i < 6; i++) { g.fillStyle = chipCols[i]; g.fillRect(152 + i * 7, 114, 6, 6); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(152 + i * 7, 114, 6, 1); }
  bgCanvas = c;
}

export function drawButter(g, t) {
  const x = SHOE.x - 18, y = SHOE.y + 4;
  g.fillStyle = '#c9a227'; g.fillRect(x, y + 2, 12, 6);
  g.fillStyle = '#ffe680'; g.fillRect(x, y, 12, 4);
  g.fillStyle = '#fff2a8'; g.fillRect(x + 1, y, 4, 1);
  g.fillStyle = '#ffd23f'; g.fillRect(x + 3, y + 8, 1, 1 + Math.floor((t * 6) % 6));
}

export const SKIES = [
  ['#ffb347', '#ff8a5c', '#e8606a', '#b5507a', '#6a3a7a'],
  ['#e8606a', '#b5507a', '#6a3a7a', '#3a2a5a', '#1a1a3a'],
  ['#2a2a5a', '#1e1e48', '#161638', '#10102a', '#0a0a1e'],
];

export function drawWindow(g, t, night) {
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

export function drawSign(g, st) {
  const flick = Math.random() < 0.02 ? 0.5 : 1;
  g.globalAlpha = flick;
  drawText(g, 'DUMBJACK21', 240, 12, '#ffb347', { align: 'center', scale: 2, outlineColor: '#3a1a0a' });
  g.globalAlpha = 1;
  if (st && st.phase !== 'lobby') drawText(g, `MANO ${st.handNo}/${st.maxHands}`, 240, 32, C.cream, { align: 'center' });
}

export function drawWanted(g, st) {
  drawText(g, 'WANTED', 358, 17, '#5a2a1a', { align: 'center', outline: false });
  let leader = null;
  if (st && st.players.length) leader = st.players.filter(p => p.status !== 'out').sort((a, b) => b.chips - a.chips)[0];
  g.fillStyle = '#cdb88a'; g.fillRect(346, 24, 24, 22);
  if (leader) {
    drawChar(g, leader.skin, 358, 25, S.time, 'idle');
    drawText(g, '$' + leader.chips, 358, 50, '#5a2a1a', { align: 'center', outline: false });
  } else drawText(g, '???', 358, 32, '#5a2a1a', { align: 'center', outline: false });
}

export function drawLamps(g, t, night) {
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


export function drawBar(g) {
  const x0 = 54, x1 = 186, top = 98;
  g.fillStyle = C.rimD; g.fillRect(x0, top, x1 - x0, 16);
  g.fillStyle = C.rimL; g.fillRect(x0 - 2, top, x1 - x0 + 4, 3);
  g.fillStyle = '#a06a35'; g.fillRect(x0 - 2, top, x1 - x0 + 4, 1);
  g.fillStyle = '#4a2a15'; for (let x = x0 + 4; x < x1 - 8; x += 22) g.fillRect(x, top + 5, 18, 8);
  g.fillStyle = '#c9a26b'; g.fillRect(x0, top + 14, x1 - x0, 2);
  // tarros y vasos sobre la barra
  for (const [mx, col] of [[78, '#ffd23f'], [112, '#c9a227'], [158, '#ffd23f']]) {
    g.fillStyle = 'rgba(230,240,255,0.7)'; g.fillRect(mx, top - 6, 5, 6); g.fillRect(mx + 5, top - 5, 2, 3);
    g.fillStyle = col; g.fillRect(mx + 1, top - 4, 3, 4); g.fillStyle = C.white; g.fillRect(mx, top - 7, 5, 1);
  }
  g.fillStyle = '#8f2f2f'; g.fillRect(132, top - 8, 3, 8); g.fillRect(133, top - 11, 1, 3);
}


export function drawMouse(g, t, dt) {
  if (S.mouse < 0) { S.mouseNext -= dt; if (S.mouseNext <= 0) { S.mouse = 0; S.mouseNext = 18 + Math.random() * 25; S.mouseDir = Math.random() < 0.5 ? 1 : -1; } return; }
  S.mouse += dt * 70;
  const x = Math.round(S.mouseDir > 0 ? S.mouse - 8 : W + 8 - S.mouse), y = H - 6;
  g.fillStyle = '#8a8a8a'; g.fillRect(x - 3, y, 6, 3); g.fillRect(x + S.mouseDir * 3, y + 1, 2, 2);
  g.fillStyle = '#c9a0a0'; g.fillRect(x - S.mouseDir * 5, y + 2, 3, 1);
  g.fillStyle = C.black; g.fillRect(x + S.mouseDir * 3, y + 1, 1, 1);
  if (S.mouse > W + 16) S.mouse = -1;
}

export function drawPianist(g, t) {
  const b = Math.round(Math.abs(Math.sin(t * 7)) * 2);
  const x = 410, y = 72 - b;
  g.fillStyle = '#1a1014'; g.fillRect(x, y + 10, 14, 18);
  g.fillStyle = '#e8b48a'; g.fillRect(x + 3, y + 2, 8, 8);
  g.fillStyle = '#1a1014'; g.fillRect(x + 1, y, 12, 3); g.fillRect(x + 3, y - 3, 8, 3);
  g.fillStyle = '#e8b48a'; g.fillRect(x + 14 + (Math.sin(t * 14) > 0 ? 2 : 0), y + 20, 3, 2); g.fillRect(x + 20 + (Math.cos(t * 14) > 0 ? 2 : 0), y + 20, 3, 2);
  for (let i = 0; i < 3; i++) {
    const k = ((t * 0.5 + i / 3) % 1);
    const nx = Math.round(430 + Math.sin(k * 6 + i) * 8 + i * 8), ny = Math.round(60 - k * 40);
    g.globalAlpha = 1 - k; g.fillStyle = '#ffd23f';
    g.fillRect(nx, ny, 2, 2); g.fillRect(nx + 1, ny - 4, 1, 4); g.fillRect(nx + 2, ny - 4, 2, 1);
  }
  g.globalAlpha = 1;
}

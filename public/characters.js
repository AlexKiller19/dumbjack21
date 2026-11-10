// Personajes elegibles y el dealer, dibujados con rectángulos.
import { C } from './consts.js';
import { drawText, px } from './pixel.js';
export const SKINS = [
  { name: 'Sheriff',          color: '#f2c14e', tone: '#f0c39a', body: '#8a5a2b' },
  { name: 'Bandida',          color: '#e8505b', tone: '#d99a6c', body: '#3a2a3a' },
  { name: 'Tahúr',            color: '#4fbf73', tone: '#c48a5c', body: '#2f6a3f', shirt: '#fff8e8' },
  { name: 'Minero',           color: '#5aa9e6', tone: '#a86b45', body: '#2f4f8f', shirt: '#4a6fb0' },
  { name: 'Novato',           color: '#ff9a3c', tone: '#f6d0a8', body: '#3a6fb0', shirt: '#5a8fd0' },
  { name: 'Cantante',         color: '#ff6fae', tone: '#f5d5c0', body: '#7a2a7a', shirt: '#b04ab0' },
  { name: 'Doctor Charlatán', color: '#c9a0ff', tone: '#e8c0a0', body: '#5a3a2a', shirt: '#fff8e8' },
  { name: 'Cazarrecompensas', color: '#c98a4a', tone: '#b07a50', body: '#8a3a1a' },
  { name: 'Fantasma',         color: '#cfefff', tone: '#e8f6ff', body: '#e8f6ff' },
  { name: 'Esqueleto',        color: '#e0e0e0', tone: '#ecebe0', body: '#2a2a32' },
  { name: 'Cactus',           color: '#8fd14f', tone: '#4f9a3a', body: '#3f8a2f' },
  { name: 'Burro',            color: '#a8a8bc', tone: '#8a8a9a', body: '#6a4a2a' },
];

export const skinColor = (p) => (SKINS[p && p.skin] || SKINS[0]).color;

export const skinName = (p) => (SKINS[p && p.skin] || SKINS[0]).name;

export function drawChar(g, skin, cx, top, t, mood, dim) {
  const S0 = SKINS[skin] || SKINS[0];
  const ghost = skin === 8;
  const bob = ghost ? Math.round(Math.sin(t * 3 + skin) * 2) - 1
    : mood === 'happy' ? -Math.abs(Math.sin(t * 12)) * 3 : mood === 'turn' ? Math.round(Math.sin(t * 6)) : Math.round(Math.sin(t * 2 + skin) * 0.6);
  const y = Math.round(top + bob);
  const x = cx - 8;
  const base = dim ? 0.45 : ghost ? 0.85 : 1;
  g.globalAlpha = base;
  // cuerpo
  if (ghost) {
    px(g, x + 2, y + 5, 12, 15, S0.body); px(g, x + 3, y + 3, 10, 2, S0.body);
    const w = Math.floor(t * 6) % 2;
    for (let k = 0; k < 4; k++) px(g, x + 2 + k * 3 + w, y + 20, 2, 2, S0.body);
  } else {
    px(g, x + 1, y + 15, 14, 7, S0.body);
    if (S0.shirt) px(g, x + 6, y + 15, 4, 7, S0.shirt);
    // cabeza
    px(g, x + 3, y + 5, 10, 10, S0.tone);
    px(g, x + 3, y + 14, 10, 1, 'rgba(0,0,0,0.2)');
  }
  // ojos (parpadeo)
  const blink = ((t + skin * 1.7) % 4) < 0.12;
  const eyeY = y + 9;
  if (skin === 9) { // calavera: cuencas negras siempre
    px(g, x + 4, eyeY - 1, 3, 3, C.black); px(g, x + 9, eyeY - 1, 3, 3, C.black);
    if (mood !== 'bust') { px(g, x + 5, eyeY, 1, 1, '#ff5a4a'); px(g, x + 10, eyeY, 1, 1, '#ff5a4a'); }
  } else if (mood === 'bust') {
    for (const ex of [5, 9]) { px(g, x + ex, eyeY - 1, 1, 1, C.black); px(g, x + ex + 2, eyeY + 1, 1, 1, C.black); px(g, x + ex + 1, eyeY, 1, 1, C.black); px(g, x + ex, eyeY + 1, 1, 1, C.black); px(g, x + ex + 2, eyeY - 1, 1, 1, C.black); }
  } else if (ghost) {
    px(g, x + 5, eyeY - 1, 2, 3, C.black); px(g, x + 9, eyeY - 1, 2, 3, C.black);
  } else if (!blink) {
    px(g, x + 5, eyeY, 2, 2, C.white); px(g, x + 9, eyeY, 2, 2, C.white);
    px(g, x + 6, eyeY, 1, 2, C.black); px(g, x + 10, eyeY, 1, 2, C.black);
  } else { px(g, x + 5, eyeY + 1, 2, 1, C.black); px(g, x + 9, eyeY + 1, 2, 1, C.black); }
  // boca
  if (skin === 9) { px(g, x + 5, y + 12, 6, 2, C.black); for (let k = 0; k < 3; k++) px(g, x + 5 + k * 2, y + 12, 1, 1, S0.tone); }
  else if (ghost) { if (mood === 'happy') px(g, x + 6, y + 13, 4, 2, C.black); else px(g, x + 7, y + 13, 2, 2, C.black); }
  else if (mood === 'happy') { px(g, x + 6, y + 12, 4, 1, C.black); px(g, x + 7, y + 13, 2, 1, '#c0392b'); }
  else if (mood === 'sad' || mood === 'bust') { px(g, x + 6, y + 13, 4, 1, C.black); px(g, x + 5, y + 14, 1, 1, C.black); px(g, x + 10, y + 14, 1, 1, C.black); }
  else px(g, x + 7, y + 13, 3, 1, '#7a3b2a');

  switch (skin) {
    case 0: // Sheriff: sombrero café, bigote, estrella
      px(g, x + 6, y + 12, 5, 1, '#5a3a1a');
      px(g, x, y + 4, 16, 2, '#8a5a2b'); px(g, x + 3, y, 10, 5, '#a0703a'); px(g, x + 7, y, 2, 1, '#6a4a2a'); px(g, x + 3, y + 3, 10, 1, '#5a3a1a');
      px(g, x + 3, y + 17, 3, 3, C.gold); px(g, x + 4, y + 16, 1, 1, C.gold); px(g, x + 4, y + 20, 1, 1, C.gold);
      break;
    case 1: // Bandida: sombrero negro, pañuelo rojo, cabello
      px(g, x + 2, y + 6, 2, 10, '#6a3a1a'); px(g, x + 12, y + 6, 2, 10, '#6a3a1a');
      px(g, x + 3, y + 11, 10, 4, C.red); px(g, x + 6, y + 15, 4, 2, C.red); px(g, x + 4, y + 12, 1, 1, '#ff8a80');
      px(g, x, y + 4, 16, 2, '#1a1418'); px(g, x + 3, y, 10, 5, '#2a2228'); px(g, x + 3, y + 3, 10, 1, '#a33');
      break;
    case 2: // Tahúr: chistera, bigote fino, chaleco verde
      px(g, x + 5, y + 12, 6, 1, '#1a1014'); px(g, x + 4, y + 13, 1, 1, '#1a1014'); px(g, x + 11, y + 13, 1, 1, '#1a1014');
      px(g, x + 1, y + 4, 14, 2, '#1a1014'); px(g, x + 4, y - 4, 8, 9, '#221a22'); px(g, x + 4, y + 1, 8, 2, '#3fa34d');
      px(g, x + 1, y + 15, 4, 7, '#3fa34d'); px(g, x + 11, y + 15, 4, 7, '#3fa34d'); px(g, x + 7, y + 16, 2, 1, C.red);
      break;
    case 3: // Minero: casco con lámpara, barba
      px(g, x + 3, y + 11, 10, 5, '#d8d8d8'); px(g, x + 4, y + 16, 8, 2, '#d8d8d8'); px(g, x + 6, y + 12, 4, 1, '#7a3b2a');
      px(g, x + 2, y + 4, 12, 2, '#d4a017'); px(g, x + 3, y + 1, 10, 4, '#f2c14e'); px(g, x + 6, y + 1, 4, 3, '#fff2a8');
      px(g, x + 3, y + 17, 2, 5, '#6a4a2a'); px(g, x + 11, y + 17, 2, 5, '#6a4a2a');
      if (Math.sin(t * 3) > 0) { g.globalAlpha = base * 0.25; px(g, x + 4, y - 2, 8, 3, '#fff2a8'); g.globalAlpha = base; }
      break;
    case 4: // Novato: sombrero de paja, pecas, paliacate
      px(g, x + 5, y + 11, 1, 1, '#d08060'); px(g, x + 10, y + 11, 1, 1, '#d08060'); px(g, x + 6, y + 12, 1, 1, '#d08060');
      px(g, x - 1, y + 4, 18, 2, '#e8c870'); px(g, x + 4, y + 1, 8, 4, '#f0d890'); px(g, x + 4, y + 3, 8, 1, '#c0392b');
      px(g, x + 5, y + 15, 6, 2, '#c0392b'); px(g, x + 7, y + 17, 2, 2, '#c0392b');
      break;
    case 5: // Cantante: cabello rizado, pluma, labios rojos, vestido
      px(g, x + 1, y + 4, 3, 13, '#8a2a2a'); px(g, x + 12, y + 4, 3, 13, '#8a2a2a'); px(g, x + 3, y + 3, 10, 3, '#8a2a2a');
      px(g, x + 11, y - 3, 2, 7, '#ff6fae'); px(g, x + 12, y - 4, 2, 2, '#ffb0d8'); px(g, x + 4, y + 4, 8, 1, '#ffd23f');
      px(g, x + 7, y + 13, 3, 1, '#d6403a');
      px(g, x + 3, y + 16, 1, 1, '#fff'); px(g, x + 5, y + 17, 1, 1, '#fff'); px(g, x + 10, y + 17, 1, 1, '#fff'); px(g, x + 12, y + 16, 1, 1, '#fff');
      break;
    case 6: // Doctor charlatán: bombín, lentes redondos, bigote, botella
      px(g, x + 3, eyeY - 1, 4, 4, '#c9a0ff'); px(g, x + 9, eyeY - 1, 4, 4, '#c9a0ff'); px(g, x + 7, eyeY, 2, 1, '#c9a0ff');
      px(g, x + 4, eyeY, 2, 2, C.white); px(g, x + 10, eyeY, 2, 2, C.white); px(g, x + 5, eyeY, 1, 1, C.black); px(g, x + 11, eyeY, 1, 1, C.black);
      px(g, x + 5, y + 12, 6, 1, '#4a2a1a');
      px(g, x + 1, y + 4, 14, 1, '#1a1014'); px(g, x + 4, y, 8, 5, '#2a2228'); px(g, x + 5, y - 1, 6, 1, '#2a2228');
      px(g, x + 12, y + 14, 3, 6, '#3fa34d'); px(g, x + 13, y + 12, 1, 2, '#3fa34d'); px(g, x + 12, y + 16, 3, 2, '#fff2a8');
      break;
    case 7: // Cazarrecompensas: sombrero plano, barba de días, poncho a rayas, puro
      px(g, x + 4, y + 12, 8, 3, 'rgba(40,20,10,0.35)');
      px(g, x - 1, y + 4, 18, 2, '#2a1a12'); px(g, x + 3, y + 1, 10, 4, '#3a2418');
      px(g, x + 1, y + 17, 14, 1, '#ffd23f'); px(g, x + 1, y + 19, 14, 1, '#2a1a12');
      px(g, x + 10, y + 13, 4, 1, '#6a4a2a'); px(g, x + 14, y + 13, 1, 1, '#ff7b2e');
      if (Math.sin(t * 2) > 0.3) { g.globalAlpha = base * 0.5; px(g, x + 15, y + 10 - Math.floor(t * 4) % 3, 1, 2, '#bbb'); g.globalAlpha = base; }
      break;
    case 8: // Fantasma: sábana flotante con sombrero viejo
      px(g, x + 2, y + 1, 12, 2, '#5a5a6a'); px(g, x + 4, y - 2, 8, 3, '#6a6a7a');
      break;
    case 9: // Esqueleto: calavera, sombrero negro, costillas
      px(g, x + 7, y + 11, 2, 1, C.black);
      px(g, x, y + 4, 16, 2, '#1a1014'); px(g, x + 3, y, 10, 5, '#2a2228'); px(g, x + 3, y + 3, 10, 1, '#8f2f2f');
      for (let k = 0; k < 3; k++) px(g, x + 4, y + 16 + k * 2, 8, 1, S0.tone);
      px(g, x + 7, y + 15, 2, 7, S0.tone);
      break;
    case 10: // Cactus: espinas, flor y sombrero de ala ancha
      for (const [sx, sy] of [[2, 8], [13, 7], [2, 12], [13, 12], [5, 15], [10, 15]]) px(g, x + sx, y + sy, 1, 1, '#f4ecd8');
      px(g, x - 2, y + 4, 20, 2, '#d4a017'); px(g, x + 4, y, 8, 5, '#e8c03a'); px(g, x + 4, y + 3, 8, 1, '#c0392b');
      px(g, x + 12, y + 6, 3, 3, '#ff6fae'); px(g, x + 13, y + 7, 1, 1, '#ffd23f');
      px(g, x - 1, y + 15, 3, 5, S0.body); px(g, x + 14, y + 13, 3, 5, S0.body);
      break;
    case 11: // Burro: orejas largas, hocico claro, mechón
      px(g, x + 3, y - 4, 3, 10, S0.tone); px(g, x + 10, y - 4, 3, 10, S0.tone);
      px(g, x + 4, y - 3, 1, 7, '#d8b8c8'); px(g, x + 11, y - 3, 1, 7, '#d8b8c8');
      px(g, x + 6, y + 4, 4, 2, '#3a3a4a');
      px(g, x + 4, y + 11, 8, 4, '#d8d8e0'); px(g, x + 5, y + 12, 1, 1, C.black); px(g, x + 10, y + 12, 1, 1, C.black);
      break;
  }
  g.globalAlpha = 1;
  // collar de color del jugador
  if (!ghost) px(g, x + 1, y + 21, 14, 1, S0.color);
}

export function portrait(skin, t = 0) {
  const c = document.createElement('canvas'); c.width = 20; c.height = 28;
  const g = c.getContext('2d');
  drawChar(g, skin, 10, 5, t, 'idle', false);
  return c;
}

export function drawTomb(g, cx, top) {
  px(g, cx - 7, top + 4, 14, 18, '#7a7a8a'); px(g, cx - 5, top + 2, 10, 2, '#7a7a8a');
  px(g, cx - 7, top + 4, 1, 18, '#9a9aaa'); px(g, cx - 5, top + 2, 10, 1, '#9a9aaa');
  drawText(g, 'RIP', cx, top + 9, '#2a2a3a', { align: 'center', outline: false });
  px(g, cx - 9, top + 21, 18, 2, '#3a5a2a');
}

export function drawDealer(g, t, st) {
  const cx = 240, top = 60;
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

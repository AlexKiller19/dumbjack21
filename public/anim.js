// Estado de animación compartido por todos los módulos de dibujo.
export const S = {
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

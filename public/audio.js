// Sonido 100% sintetizado con WebAudio (sin archivos).
let ctx = null, master = null, musicGain = null, sfxGain = null;
let musicOn = true, sfxOn = true, musicTimer = null, step = 0;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
  startMusic();
}

export function toggleMusic() { musicOn = !musicOn; if (musicGain) musicGain.gain.value = musicOn ? 0.22 : 0; return musicOn; }
export function toggleSfx() { sfxOn = !sfxOn; if (sfxGain) sfxGain.gain.value = sfxOn ? 0.8 : 0; return sfxOn; }

function tone(freq, dur, type = 'square', vol = 0.3, when = 0, dest = sfxGain, slide = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

let noiseBuf = null;
function noise(dur, vol = 0.4, when = 0, filterFreq = 2000, type = 'lowpass', sweepTo = 0, dest = sfxGain) {
  if (!ctx) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + when;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(filterFreq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t); s.stop(t + dur + 0.02);
}

export const sfx = {
  card() { noise(0.06, 0.25, 0, 3500, 'highpass'); },
  chip() { tone(1800, 0.05, 'square', 0.12); tone(2400, 0.06, 'square', 0.1, 0.04); },
  coins() { for (let i = 0; i < 6; i++) tone(1500 + Math.random() * 1500, 0.06, 'square', 0.08, i * 0.05); },
  click() { tone(900, 0.04, 'square', 0.12); },
  hover() { tone(1300, 0.02, 'square', 0.04); },
  tick() { tone(1200, 0.03, 'square', 0.1); },
  turn() { tone(660, 0.1, 'square', 0.2); tone(880, 0.15, 'square', 0.2, 0.1); },
  boom() { noise(0.9, 0.9, 0, 1200, 'lowpass', 60); tone(90, 0.6, 'sine', 0.7, 0, sfxGain, 0.3); },
  fuse() { noise(0.35, 0.15, 0, 5000, 'highpass'); },
  gun() { noise(0.25, 0.8, 0, 3000, 'lowpass', 200); tone(180, 0.15, 'square', 0.3, 0, sfxGain, 0.3); },
  boing() { tone(200, 0.4, 'sine', 0.5, 0, sfxGain, 3); tone(300, 0.3, 'triangle', 0.3, 0.05, sfxGain, 2.5); },
  whoosh() { noise(0.35, 0.3, 0, 400, 'bandpass', 3000); },
  magic() { [880, 1108, 1318, 1760].forEach((f, i) => tone(f, 0.18, 'triangle', 0.15, i * 0.06)); },
  mirror() { [1318, 988, 1318, 988, 1568].forEach((f, i) => tone(f, 0.1, 'square', 0.1, i * 0.05)); },
  devil() { tone(110, 0.5, 'sawtooth', 0.25, 0, sfxGain, 0.7); tone(116, 0.5, 'sawtooth', 0.2, 0, sfxGain, 0.7); },
  slip() { tone(600, 0.3, 'sine', 0.3, 0, sfxGain, 0.3); },
  comunismo() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.25, 'square', 0.14, i * 0.12)); },
  bust() { [440, 370, 311, 220].forEach((f, i) => tone(f, 0.18, 'square', 0.18, i * 0.13)); },
  blackjack() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.18, i * 0.08)); },
  win() { [659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.16, i * 0.09)); },
  lose() { tone(220, 0.35, 'triangle', 0.25, 0, sfxGain, 0.6); },
  reward() { [988, 1318].forEach((f, i) => tone(f, 0.1, 'square', 0.14, i * 0.07)); },
  chaos() { tone(220, 0.12, 'sawtooth', 0.15); tone(233, 0.12, 'sawtooth', 0.15, 0.13); },
  yeehaw() { tone(500, 0.35, 'sawtooth', 0.12, 0, sfxGain, 2.2); this.gun(); },
  shuffle() { for (let i = 0; i < 10; i++) noise(0.03, 0.15, i * 0.035, 4000, 'highpass'); },
  door() { tone(140, 0.25, 'triangle', 0.2, 0, sfxGain, 1.4); tone(160, 0.25, 'triangle', 0.15, 0.25, sfxGain, 0.8); },
  error() { tone(150, 0.15, 'square', 0.15); },
};

// ---- música honky-tonk dinámica ----
// La música cambia de "ánimo" según lo que pasa en la mesa. Cada ánimo define tempo,
// armonía e instrumentos; el cambio entra en el siguiente compás (o de inmediato si es urgente).
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
const PROG = {
  // I - IV - I - V en Sol mayor (alegre)
  major:   { chords: [[55, 59, 62], [60, 64, 67], [55, 59, 62], [62, 66, 69]], roots: [43, 48, 43, 50] },
  // i - VI - VII - V en Mi menor (duelo / caos)
  minor:   { chords: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 51, 54]], roots: [40, 36, 38, 35] },
  // acordes disminuidos sobre un bajo fijo (suspenso con el dealer)
  tension: { chords: [[52, 55, 58], [53, 56, 59], [52, 55, 58], [51, 54, 57]], roots: [40, 40, 40, 39] },
};
const MEL = {
  major: [71, 0, 74, 71, 69, 67, 69, 0, 72, 0, 76, 72, 71, 69, 67, 0, 71, 74, 79, 78, 76, 74, 71, 0, 69, 71, 72, 74, 72, 69, 66, 0],
  minor: [76, 0, 79, 76, 74, 71, 74, 0, 72, 0, 76, 72, 71, 69, 67, 0, 76, 79, 83, 81, 79, 76, 74, 0, 75, 0, 78, 75, 71, 0, 66, 0],
};
// bass: 'oompah' (raíz-quinta), 'walk' (caminando), 'gallop' (galope), 'pedal' (nota fija)
// drums: 0 nada, 1 bombo+caja, 2 todo al doble
const MOODS = {
  lobby:  { bpm: 104, prog: 'major', bass: 'oompah', chords: 0.045, mel: 0.06, melEvery: 2, drums: 0, hat: 0 },
  play:   { bpm: 128, prog: 'major', bass: 'oompah', chords: 0.06, mel: 0.085, melEvery: 2, drums: 0, hat: 0.025 },
  last:   { bpm: 146, prog: 'major', bass: 'walk', chords: 0.07, mel: 0.1, melEvery: 1, octave: 12, drums: 1, hat: 0.045 },
  chaos:  { bpm: 156, prog: 'minor', bass: 'gallop', chords: 0.07, mel: 0, ost: 0.07, drums: 1, hat: 0.055 },
  final:  { bpm: 174, prog: 'minor', bass: 'gallop', chords: 0.08, mel: 0.1, melEvery: 1, octave: 12, ost: 0.06, drums: 2, hat: 0.065 },
  dealer: { bpm: 108, prog: 'tension', bass: 'pedal', chords: 0.03, mel: 0, drums: 0, hat: 0.035, tick: true },
};
let mood = 'lobby', pending = null;

// Cambia el ánimo. urgent = entra ya; si no, al empezar el siguiente compás.
export function setMusicMood(m, urgent = false) {
  if (!MOODS[m] || (m === mood && !pending) || m === pending) return;
  if (urgent) { if (m !== mood) stinger(m); mood = m; pending = null; }
  else pending = m;
}
export function musicMood() { return mood; }

// golpe de platillo + barrido al subir de intensidad
function stinger(m) {
  if (!ctx || !musicOn) return;
  if (m === 'final' || m === 'chaos' || m === 'last') {
    noise(0.9, 0.35, 0, 7000, 'highpass', 0, musicGain);
    tone(N(m === 'final' ? 40 : 43), 0.5, 'triangle', 0.6, 0, musicGain, 0.5);
  }
}

function drums(d, s, when, beat) {
  const kick = (w) => { tone(110, 0.18, 'sine', 0.9, w, musicGain, 0.35); };
  const snare = (w) => { noise(0.12, 0.35, w, 1800, 'bandpass', 0, musicGain); tone(220, 0.06, 'triangle', 0.15, w, musicGain); };
  if (s === 0 || s === 4) kick(when);
  if (d >= 2 && (s === 3 || s === 7)) kick(when);
  if (s === 2 || s === 6) snare(when);
  if (d >= 2 && s === 7) snare(when + beat / 2);
}

function startMusic() {
  let next = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    // si la pestaña estuvo en pausa, se saltan las notas perdidas en vez de tocarlas todas de golpe
    if (next < ctx.currentTime - 0.25) next = ctx.currentTime + 0.05;
    let guard = 0;
    while (next < ctx.currentTime + 0.3 && guard++ < 16) {
      const s = step % 8;
      if (s === 0 && pending) { const m = pending; pending = null; if (m !== mood) { stinger(m); mood = m; } }
      const M = MOODS[mood], P = PROG[M.prog];
      const beat = 60 / M.bpm / 2; // corcheas
      const bar = Math.floor(step / 8) % 4;
      const when = next - ctx.currentTime;
      const root = P.roots[bar], chord = P.chords[bar];
      // bajo
      if (M.bass === 'oompah') { if (s % 2 === 0) tone(N(root + ((s / 2) % 2 ? 7 : 0)), beat * 1.6, 'triangle', 0.5, when, musicGain); }
      else if (M.bass === 'walk') { if (s % 2 === 0) tone(N(root + [0, 4, 7, 9][s / 2]), beat * 1.7, 'triangle', 0.55, when, musicGain); }
      else if (M.bass === 'gallop') { if (s % 2 === 0 || s % 4 === 1) tone(N(root + (s >= 4 ? 7 : 0)), beat * 0.8, 'triangle', 0.55, when, musicGain); }
      else if (M.bass === 'pedal') { if (s === 0 || s === 5) tone(N(root), beat * 3, 'triangle', 0.5, when, musicGain); }
      // acordes a contratiempo (el "chun" del honky-tonk)
      if (s % 2 === 1 && M.chords) for (const c of chord) tone(N(c), beat * 0.6, 'square', M.chords, when, musicGain);
      // ostinato agudo en el caos
      if (M.ost) tone(N(chord[s % 3] + 24), beat * 0.45, 'square', M.ost * (s % 2 ? 0.7 : 1), when, musicGain);
      // melodía
      const mel = MEL[M.prog === 'minor' ? 'minor' : 'major'];
      const n = mel[step % mel.length];
      if (M.mel && n && Math.floor(step / 32) % (M.melEvery || 1) === 0) tone(N(n + (M.octave || 0)), beat * 0.9, 'square', M.mel, when, musicGain);
      // batería y platillos
      if (M.drums) drums(M.drums, s, when, beat);
      if (M.hat) noise(0.03, M.hat * (s % 2 ? 1 : 1.6), when, 8000, 'highpass', 0, musicGain);
      if (M.tick && s % 2 === 0) tone(1800, 0.02, 'square', 0.05, when, musicGain);
      step++; next += beat;
    }
  }, 40);
}

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
function noise(dur, vol = 0.4, when = 0, filterFreq = 2000, type = 'lowpass', sweepTo = 0) {
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
  s.connect(f); f.connect(g); g.connect(sfxGain);
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

// ---- música honky-tonk sencilla ----
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
// progresión I - IV - I - V en Sol
const CHORDS = [[55, 59, 62], [60, 64, 67], [55, 59, 62], [62, 66, 69]];
const BASS = [[43, 50], [48, 55], [43, 50], [50, 57]];
const MEL = [
  71, 0, 74, 71, 69, 67, 69, 0,  72, 0, 76, 72, 71, 69, 67, 0,
  71, 74, 79, 78, 76, 74, 71, 0,  69, 71, 72, 74, 72, 69, 66, 0,
];
function startMusic() {
  const beat = 60 / 132 / 2; // corcheas
  let next = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    while (next < ctx.currentTime + 0.3) {
      const bar = Math.floor(step / 8) % 4, s = step % 8;
      const when = next - ctx.currentTime;
      if (s % 2 === 0) {
        const b = BASS[bar][(s / 2) % 2];
        tone(N(b), beat * 1.6, 'triangle', 0.5, when, musicGain);
      } else {
        for (const c of CHORDS[bar]) tone(N(c), beat * 0.6, 'square', 0.06, when, musicGain);
      }
      const m = MEL[step % MEL.length];
      if (m && (Math.floor(step / 32) % 2 === 0)) tone(N(m), beat * 0.9, 'square', 0.09, when, musicGain);
      step++; next += beat;
    }
  }, 50);
}

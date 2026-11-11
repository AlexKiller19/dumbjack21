'use strict';
// Bots de prueba por WebSocket (herramienta de desarrollo, no forman parte del juego).
// Uso:  node tools/bots.js CODIGO_SALA [cantidad=2] [url=ws://localhost:8767]
// Ejemplo en línea:  node tools/bots.js ABCD 2 wss://dumbjack21.onrender.com
// Se unen a una sala ya creada, apuestan, piden hasta 15, dividen si pueden y juegan
// cartas al azar (también en la ventana de caos, el caos final y la última oportunidad).
// El primer bot imprime los eventos importantes para seguir la partida desde la terminal.
const WebSocket = require('ws');

const code = process.argv[2];
const n = Number(process.argv[3] || 2);
const url = process.argv[4] || 'ws://localhost:8767';
if (!code) { console.error('Uso: node tools/bots.js CODIGO_SALA [cantidad] [url]'); process.exit(1); }
const NAMES = ['Bot Pancho', 'Bot Lupe', 'Bot Chuy'];
const QUIET = ['emote', 'turn', 'window', 'bet', 'hit', 'stand', 'reward', 'deal', 'dealerHit'];

for (let i = 0; i < n; i++) {
  const ws = new WebSocket(url);
  let busy = false;
  const S = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
  ws.on('open', () => S({ t: 'join', code, name: NAMES[i % NAMES.length] }));
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.t === 'error') console.log(NAMES[i], 'ERR', m.msg);
    if (m.t !== 'state') return;
    const me = m.you, st = m.state, p = st.players.find(q => q.id === me);
    if (i === 0) for (const e of m.events) if (!QUIET.includes(e.type)) console.log(e.type, JSON.stringify(e).slice(0, 130));
    if (busy || !p) return;
    const later = (fn, ms) => { busy = true; setTimeout(() => { busy = false; fn(); }, ms); };
    const rivals = () => {
      const out = [];
      for (const q of st.players) if (q.id !== me && q.inHand) q.hands.forEach((hd, h) => { if (hd.status !== 'bust') out.push({ q, h, hd }); });
      return out;
    };
    const tryPlay = () => {
      const act = p.cards.find(a => !['escudo', 'abogado'].includes(a.type));
      if (!act) return false;
      const ts = rivals();
      const pick = (f) => { const c = ts.filter(f); return c[Math.floor(Math.random() * c.length)]; };
      let t = null;
      if (act.type === 'lazo' || act.type === 'espejo') t = pick(x => x.hd.status === 'playing');
      else if (act.type === 'empujon') t = pick(x => x.hd.status === 'stood');
      else if (act.type === 'carterista') { const q = st.players.find(q => q.id !== me && q.cards > 0); t = q && { q, h: 0 }; }
      else if (act.type === 'devolver') {
        const h = p.hands.findIndex(hd => hd.cards.length >= 2); if (h < 0) return false;
        const hd = p.hands[h]; S({ t: 'play', uid: act.uid, th: h, card: hd.cards[hd.cards.length - 1].id }); return true;
      } else t = pick(() => true);
      S({ t: 'play', uid: act.uid, target: t && t.q.id, th: t ? t.h : 0 });
      return true;
    };
    if (st.phase === 'betting' && p.status === 'betting') later(() => S({ t: 'bet', amount: [50, 100, 250][Math.floor(Math.random() * 3)] }), 600 + Math.random() * 900);
    else if (st.phase === 'turn' && st.turnId === me) {
      later(() => {
        const hd = p.hands[st.turnHand]; if (!hd) return;
        if (Math.random() < 0.35 && tryPlay()) return;
        if (p.canSplit) return S({ t: 'split' });
        if (hd.value < 16) S({ t: hd.cards.length === 2 && hd.value >= 10 && hd.value <= 11 ? 'double' : 'hit' });
        else S({ t: 'stand' });
      }, 900 + Math.random() * 900);
    } else if (((st.phase === 'window' || st.phase === 'final') && !st.windowPlayed.includes(me) && Math.random() < 0.5) || (st.phase === 'rescue' && st.rescuers.includes(me))) {
      later(() => {
        if (st.phase === 'rescue') {
          const a = p.cards.find(c => c.type === 'devolver'), h = p.hands.findIndex(hd => hd.status === 'bust');
          if (a && h >= 0) S({ t: 'play', uid: a.uid, th: h, card: p.hands[h].cards[p.hands[h].cards.length - 1].id });
        } else tryPlay();
      }, 600);
    }
  });
}

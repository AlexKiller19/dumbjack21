'use strict';
// Lógica autoritativa de DumbJack21. No depende de la red: el servidor llama
// a los métodos con `now` (ms) y a tick(now) periódicamente.

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['h', 'd', 'c', 's'];

// w = peso al robar. target: 'hand' (mano rival), 'player' (rival), 'own' (carta propia).
// passive = se activa sola. anytime = se puede jugar aunque no sea tu turno.
const ACTIONS = {
  granada5:    { w: 5,   target: 'hand' },
  granada10:   { w: 1.5, target: 'hand' },
  amnesia:     { w: 3,   target: 'hand' },
  mantequilla: { w: 3 },
  lazo:        { w: 2.5, target: 'hand' },
  empujon:     { w: 2.5, target: 'hand' },
  espejo:      { w: 2,   target: 'hand' },
  vidente:     { w: 2.5 },
  comunismo:   { w: 1.5 },
  carterista:  { w: 2.5, target: 'player' },
  carrusel:    { w: 1.5 },
  devolver:    { w: 2,   target: 'own', anytime: true },
  escudo:      { w: 3,   passive: true },
  abogado:     { w: 2,   passive: true },
};

const CFG = {
  startChips: 1000,
  maxHands: 8,
  startCards: 2,
  maxCards: 5,
  bonusEvery: 1,       // +1 carta para todos cada mano
  minBet: 50,
  minPlayers: 2,
  maxPlayers: 4,
  decks: 4,
  betTime: 15000,
  turnTime: 20000,
  windowTime: 3000,
  quickWindow: 500,
  dealTime: 1600,
  dealerStep: 900,
  resultsTime: 6500,
  rescueTime: 5000,
  abogadoLimit: 25,
};
// Opciones que el anfitrión puede cambiar en el lobby
const SKIN_COUNT = 12; // personajes elegibles (ver SKINS en public/render.js)
const OPTIONS = { hands: [5, 8, 12], chips: [500, 1000, 2000], chaos: [2, 3, 5] };

function cardValue(c) {
  if (c.k === 'b' || c.k === 'v') return c.v;
  if (c.r === 'A') return 1;
  if (c.r === 'J' || c.r === 'Q' || c.r === 'K') return 10;
  return parseInt(c.r, 10);
}
function handValue(cards) {
  let v = 0, aces = 0;
  for (const c of cards) { v += cardValue(c); if (c.k === 'c' && c.r === 'A') aces++; }
  let soft = false;
  if (aces && v + 10 <= 21) { v += 10; soft = true; }
  return { v, soft };
}
// Cartas que también puedes usar en tu propia mano
const SELF_OK = new Set(['granada5', 'granada10', 'amnesia', 'empujon']);
const newHand = (bet) => ({ cards: [], bet, status: 'playing', doubled: false, limit: 21, natIds: null, split: false });
const newStats = () => ({ played: 0, caused: 0, bombs: 0, busts: 0, bj: 0, shields: 0, best: 0 });

class Game {
  constructor(opts = {}) {
    this.rng = opts.rng || Math.random;
    this.cfg = Object.assign({}, CFG, opts.cfg || {});
    this.opts = { hands: this.cfg.maxHands, chips: this.cfg.startChips, chaos: this.cfg.windowTime / 1000 };
    this.players = [];
    this.phase = 'lobby';
    this.events = [];
    this.uid = 1;
    this.dealer = { hand: [], hidden: true };
    this.shoe = [];
    this.handNo = 0;
    this.deadline = 0;
    this.turn = null;        // { pid, h }
    this.pending = null;
    this.butter = null;
    this.windowPlayed = new Set();
    this.results = null;
    this.ranking = null;
    this.awards = null;
    this.log = [];
    this.dirty = true;
  }

  // ---------- utilidades ----------
  ev(type, data = {}) {
    this.events.push(Object.assign({ type }, data)); this.dirty = true;
    if (!data.to) { try { this.addLog(type, data); } catch {} } // los eventos privados no van al historial
  }

  // ---------- historial de jugadas (texto para todos) ----------
  addLog(type, e) {
    const n = (pid) => { const p = this.get(pid); return p ? p.name : '?'; };
    const hv = (pid, h) => { const p = this.get(pid); const hd = p && p.hands[h || 0]; return hd ? handValue(hd.cards).v : 0; };
    const mano = (pid, h) => { const p = this.get(pid); return p && p.hands.length > 1 ? ` (mano ${(h || 0) + 1})` : ''; };
    const SUIT = { h: '♥', d: '♦', c: '♣', s: '♠' };
    const lbl = (c) => !c ? '?' : c.k === 'b' ? `granada +${c.v}` : c.k === 'v' ? `${c.v}` : `${c.r}${SUIT[c.s] || ''}`;
    const NAMES = {
      granada5: 'Granada +5', granada10: 'Granada +10', amnesia: 'Amnesia', mantequilla: 'Mano de Mantequilla', lazo: 'Lazo',
      empujon: 'Empujón', espejo: 'Espejo Cuántico', vidente: 'Vidente', comunismo: 'Comunismo', carterista: 'Carterista',
      carrusel: 'Carrusel', devolver: 'Arrepentimiento', escudo: 'Escudo de Goma', abogado: 'Abogado del Diablo',
    };
    const money = (v) => '$' + v;
    let t = null, k = 'info';
    switch (type) {
      case 'start': t = 'Empieza la partida'; k = 'hand'; break;
      case 'hand': t = `MANO ${e.n}${e.n >= this.opts.hands ? ' (¡LA ÚLTIMA!)' : ''}`; k = 'hand'; break;
      case 'bet': t = `${n(e.pid)} apuesta ${money(e.amount)}${e.auto ? ' (automática)' : ''}`; break;
      case 'natural': t = `${n(e.pid)} saca ¡BLACKJACK natural!`; k = 'good'; break;
      case 'double': t = `${n(e.pid)} dobla la apuesta`; break;
      case 'split': t = `${n(e.pid)} divide su mano`; break;
      case 'hit': {
        const p = this.get(e.pid), hd = p && p.hands[e.h || 0];
        const got = hd ? hd.cards.slice(-e.n).map(lbl).join(' y ') : '?';
        t = `${n(e.pid)}${mano(e.pid, e.h)} recibe ${got} y queda en ${hv(e.pid, e.h)}${e.butter ? ` (mantequilla de ${n(e.by)})` : ''}`;
        break;
      }
      case 'stand': if (!e.auto) t = `${n(e.pid)}${mano(e.pid, e.h)} se planta con ${hv(e.pid, e.h)}`; break;
      case 'play': {
        const who = e.target === e.pid ? 'sobre sí mismo' : e.target ? `contra ${n(e.target)}` : '';
        t = `${n(e.pid)} juega ${NAMES[e.card] || e.card} ${who}`.trim(); k = 'card'; break;
      }
      case 'boom': t = `${n(e.pid)}${mano(e.pid, e.h)} recibe +${e.v} y queda en ${hv(e.pid, e.h)}`; k = 'bad'; break;
      case 'shield': t = e.to ? `${n(e.pid)} rebota la carta con su Escudo hacia ${n(e.to)}` : `${n(e.pid)} rebota la carta con su Escudo`; k = 'card'; break;
      case 'fizzle': t = `La carta rebotada no tuvo efecto en ${n(e.pid)}`; break;
      case 'abogado': t = `${n(e.pid)} llama al Abogado del Diablo: su límite sube a 25`; k = 'good'; break;
      case 'amnesia': t = `${n(e.pid)}${mano(e.pid, e.h)} olvida su ${lbl(e.card)} y queda en ${hv(e.pid, e.h)}`; k = 'bad'; break;
      case 'butter': t = 'El siguiente que pida recibirá 2 cartas'; break;
      case 'lasso': t = `${n(e.pid)}${mano(e.pid, e.h)} queda lazado y se planta con ${hv(e.pid, e.h)}`; k = 'bad'; break;
      case 'push': t = `${n(e.pid)}${mano(e.pid, e.h)} recibe una carta a la fuerza y queda en ${hv(e.pid, e.h)}`; k = 'bad'; break;
      case 'steal': t = `${n(e.pid)} le roba una carta de acción a ${n(e.target)}`; k = 'card'; break;
      case 'mirror': t = `${n(e.pid)} intercambia su mano con ${n(e.target)}`; k = 'card'; break;
      case 'vidente': t = `${n(e.pid)} espía la carta del dealer`; break;
      case 'comunismo': t = `Todas las manos pasan a valer ${e.avg}`; k = 'card'; break;
      case 'carousel': t = 'Todas las manos rotan a la izquierda (también la del dealer)'; k = 'card'; break;
      case 'giveback': t = `${n(e.pid)} devuelve su ${lbl(e.card)} y queda en ${hv(e.pid, e.h)}${e.saved ? ' ¡y se salva!' : ''}`; k = e.saved ? 'good' : 'info'; break;
      case 'revive': t = `${n(e.pid)}${mano(e.pid, e.h)} ¡revive con ${e.v}!`; k = 'good'; break;
      case 'bust': t = `${n(e.pid)}${mano(e.pid, e.h)} se pasa con ${e.v}${e.by && e.by !== e.pid ? ` (sabotaje de ${n(e.by)})` : ''}`; k = 'bad'; break;
      case 'reward':
        if (e.reason !== 'bonus' && !e.full) { t = `${n(e.pid)} gana una carta de acción (${e.reason === 'sabotaje' ? 'por sabotaje' : 'por blackjack'})`; k = 'good'; }
        break;
      case 'finalChaos': t = '¡CAOS FINAL! Todos pueden encadenar cartas'; k = 'card'; break;
      case 'rescue': t = 'Última oportunidad para los que se pasaron'; break;
      case 'reveal': t = `El dealer muestra su carta: ${handValue(this.dealer.hand).v}`; k = 'dealer'; break;
      case 'settle': {
        this.pushLog(`Dealer termina con ${e.dealer}${e.dealerBust ? ' y se pasa' : ''}`, 'dealer');
        const R = { win: 'gana', blackjack: 'gana con blackjack', push: 'empata', lose: 'pierde' };
        for (const r of e.list) {
          const amt = r.net > 0 ? '+' + money(r.net) : r.net < 0 ? '-' + money(-r.net) : '';
          this.pushLog(`${n(r.pid)}${mano(r.pid, r.h)} ${R[r.res]} ${amt}`.trim(), r.res === 'lose' ? 'bad' : r.res === 'push' ? 'info' : 'good');
        }
        return;
      }
      case 'eliminated': t = `${n(e.pid)} se queda sin fichas y queda eliminado`; k = 'bad'; break;
      case 'gameover': { const w = e.ranking && e.ranking[0]; t = `Fin de la partida${w ? `: gana ${n(w.pid)} con ${money(w.chips)}` : ''}`; k = 'hand'; break; }
      case 'away': if (this.phase !== 'lobby') t = `${n(e.pid)} se desconectó`; break;
      case 'back': if (this.phase !== 'lobby') t = `${n(e.pid)} volvió`; break;
    }
    if (t) this.pushLog(t, k);
  }
  pushLog(t, k) {
    this.logSeq = (this.logSeq || 0) + 1;
    this.log.push({ i: this.logSeq, t, k });
    if (this.log.length > 80) this.log.shift();
  }
  drain() { const e = this.events; this.events = []; this.dirty = false; return e; }
  get(id) { return this.players.find(p => p.id === id); }
  get turnId() { return this.turn ? this.turn.pid : null; }
  inHand() { return this.players.filter(p => p.inHand); }
  alive() { return this.players.filter(p => p.status !== 'out' && p.connected); }
  pick(arr) { return arr[Math.floor(this.rng() * arr.length)]; }
  handOf(pid, h) { const p = this.get(pid); return p && p.inHand ? p.hands[h] || null : null; }
  // Todas las manos en orden de asiento. live = solo las que siguen en juego.
  allHands(live) {
    const out = [];
    for (const p of this.inHand().sort((a, b) => a.seat - b.seat))
      p.hands.forEach((hand, h) => { if (!live || hand.status === 'playing' || hand.status === 'stood') out.push({ p, h, hand }); });
    return out;
  }
  curHand() { return this.turn ? this.handOf(this.turn.pid, this.turn.h) : null; }

  buildShoe() {
    const s = [];
    for (let d = 0; d < this.cfg.decks; d++)
      for (const su of SUITS) for (const r of RANKS) s.push({ k: 'c', r, s: su });
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    this.shoe = s;
    this.ev('shuffle');
  }
  draw() {
    if (!this.shoe.length) this.buildShoe();
    return Object.assign({ id: this.uid++ }, this.shoe.pop());
  }
  drawAction() {
    const keys = Object.keys(ACTIONS);
    const total = keys.reduce((a, k) => a + ACTIONS[k].w, 0);
    let r = this.rng() * total;
    for (const k of keys) { r -= ACTIONS[k].w; if (r <= 0) return { uid: this.uid++, type: k }; }
    return { uid: this.uid++, type: keys[0] };
  }
  giveAction(p, reason) {
    if (p.actions.length >= this.cfg.maxCards) { this.ev('reward', { pid: p.id, reason, full: true }); return false; }
    p.actions.push(this.drawAction());
    this.ev('reward', { pid: p.id, reason });
    return true;
  }
  takePassive(p, type) {
    const i = p.actions.findIndex(a => a.type === type);
    if (i < 0) return false;
    p.actions.splice(i, 1);
    return true;
  }

  // ---------- lobby ----------
  skinFree(skin, exceptId) {
    return Number.isInteger(skin) && skin >= 0 && skin < SKIN_COUNT && !this.players.some(p => p.skin === skin && p.id !== exceptId);
  }
  addPlayer(id, name, skin) {
    if (this.phase !== 'lobby') return 'La partida ya empezó';
    if (this.players.length >= this.cfg.maxPlayers) return 'La mesa está llena';
    const used = new Set(this.players.map(p => p.seat));
    let seat = 0; while (used.has(seat)) seat++;
    // personaje elegido; si ya está ocupado, el primero libre
    skin = Number(skin);
    if (!this.skinFree(skin)) { skin = 0; while (!this.skinFree(skin)) skin++; }
    this.players.push({
      id, name: String(name || 'Forastero').slice(0, 12), seat, skin, connected: true,
      chips: this.opts.chips, bet: 0, hands: [], status: 'idle', inHand: false,
      actions: [], stats: newStats(),
    });
    this.ev('join', { pid: id });
    return null;
  }
  setSkin(id, skin) {
    const p = this.get(id);
    if (!p || this.phase !== 'lobby') return 'Solo puedes cambiar de personaje en la sala, antes de empezar';
    if (!this.skinFree(Number(skin), id)) return 'Ese personaje ya lo eligió alguien más';
    p.skin = Number(skin);
    this.ev('skin', { pid: id, skin: p.skin });
    return null;
  }
  setOption(key, value) {
    if (this.phase !== 'lobby') return 'Solo se puede cambiar en el lobby';
    if (!OPTIONS[key] || !OPTIONS[key].includes(value)) return 'Opción inválida';
    this.opts[key] = value;
    if (key === 'chips') for (const p of this.players) p.chips = value;
    this.ev('option', { key, value });
    return null;
  }
  setConnected(id, on, now) {
    const p = this.get(id); if (!p) return;
    p.connected = on;
    this.ev(on ? 'back' : 'away', { pid: id });
    if (!on && this.turnId === id && this.phase === 'turn') this.deadline = now; // se planta solo
    if (!on && this.phase === 'betting') this.maybeAllBet(now);
    if (this.phase !== 'lobby' && this.phase !== 'gameover' && this.alive().length < 1) this.endGame();
  }
  removePlayer(id) {
    if (this.phase !== 'lobby') return;
    this.players = this.players.filter(x => x.id !== id);
    this.ev('leave', { pid: id });
  }

  start(now) {
    if (this.phase !== 'lobby') return 'Ya empezó';
    this.players = this.players.filter(p => p.connected);
    if (this.players.length < this.cfg.minPlayers) return `Se necesitan al menos ${this.cfg.minPlayers} jugadores`;
    // bancos al azar en cada partida, sin importar el orden en que entraron
    const seats = [0, 1, 2, 3];
    for (let i = seats.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [seats[i], seats[j]] = [seats[j], seats[i]]; }
    this.players.forEach((p, i) => { p.seat = seats[i]; });
    this.ev('seats');
    for (const p of this.players) {
      p.chips = this.opts.chips;
      p.status = 'idle';
      p.stats = newStats();
      p.actions = [];
      for (let i = 0; i < this.cfg.startCards; i++) p.actions.push(this.drawAction());
    }
    this.handNo = 0;
    this.log = [];
    this.buildShoe();
    this.ev('start');
    this.beginHand(now);
    return null;
  }

  backToLobby() {
    if (this.phase !== 'gameover') return 'La partida no ha terminado';
    this.players = this.players.filter(p => p.connected);
    for (const p of this.players) Object.assign(p, { chips: this.opts.chips, bet: 0, hands: [], status: 'idle', inHand: false, actions: [] });
    this.dealer = { hand: [], hidden: true };
    this.results = null; this.ranking = null; this.awards = null;
    this.phase = 'lobby';
    this.ev('lobby');
    return null;
  }

  // ---------- flujo de una mano ----------
  beginHand(now) {
    this.handNo++;
    if (this.shoe.length < 60) this.buildShoe();
    this.dealer = { hand: [], hidden: true };
    this.butter = null; this.pending = null; this.turn = null; this.results = null;
    const bonus = this.handNo > 1 && (this.handNo - 1) % this.cfg.bonusEvery === 0;
    for (const p of this.players) {
      p.hands = []; p.bet = 0;
      if (p.status === 'out') { p.inHand = false; continue; }
      p.inHand = true;
      p.status = 'betting';
      if (bonus) this.giveAction(p, 'bonus');
    }
    this.phase = 'betting';
    this.deadline = now + this.cfg.betTime;
    this.ev('hand', { n: this.handNo });
    this.maybeAllBet(now);
  }

  bet(id, amount, now) {
    const p = this.get(id);
    if (!p || this.phase !== 'betting' || p.status !== 'betting') return 'No puedes apostar ahora';
    amount = Math.floor(Number(amount));
    if (!Number.isFinite(amount) || amount <= 0) return 'Apuesta inválida';
    const min = Math.min(this.cfg.minBet, p.chips);
    amount = Math.max(min, Math.min(amount, p.chips));
    p.bet = amount; p.chips -= amount; p.status = 'ready';
    this.ev('bet', { pid: id, amount });
    this.maybeAllBet(now);
    return null;
  }
  maybeAllBet(now) {
    if (this.phase !== 'betting') return;
    const waiting = this.inHand().filter(p => p.status === 'betting' && p.connected);
    if (!waiting.length) this.deadline = Math.min(this.deadline, now + 400);
  }

  deal(now) {
    for (const p of this.inHand()) {
      if (p.status === 'betting') { // no apostó a tiempo
        const amt = Math.min(this.cfg.minBet, p.chips);
        p.bet = amt; p.chips -= amt;
        this.ev('bet', { pid: p.id, amount: amt, auto: true });
      }
      p.status = 'in';
      p.hands = [newHand(p.bet)];
    }
    const order = this.inHand().sort((a, b) => a.seat - b.seat);
    for (let r = 0; r < 2; r++) {
      for (const p of order) p.hands[0].cards.push(this.draw());
      this.dealer.hand.push(this.draw());
    }
    for (const p of order) {
      const hand = p.hands[0];
      if (handValue(hand.cards).v === 21) {
        hand.status = 'stood';
        hand.natIds = hand.cards.map(c => c.id);
        this.ev('natural', { pid: p.id, h: 0 });
      }
    }
    this.ev('deal');
    this.phase = 'dealing';
    this.turn = null;
    this.deadline = now + this.cfg.dealTime;
  }

  nextTurn(now) {
    this.pending = null;
    this.windowPlayed.clear();
    const list = this.allHands(false);
    const cur = this.turn ? list.findIndex(x => x.p.id === this.turn.pid && x.h === this.turn.h) : -1;
    for (let i = cur + 1; i < list.length; i++) {
      const { p, h, hand } = list[i];
      if (hand.status !== 'playing') continue;
      if (handValue(hand.cards).v === 21) { hand.status = 'stood'; this.ev('stand', { pid: p.id, h, auto: true }); continue; }
      this.turn = { pid: p.id, h };
      this.phase = 'turn';
      this.deadline = now + (p.connected ? this.cfg.turnTime : 300);
      this.ev('turn', { pid: p.id, h });
      return;
    }
    this.turn = null;
    this.finalChaos(now);
  }

  // Caos final: al terminar el último turno (aunque nadie haya pedido) todos tienen
  // una última ventana para jugar UNA carta antes de que juegue el dealer.
  finalChaos(now) {
    const someoneCan = this.inHand().some(q => q.status !== 'out' && q.connected && q.actions.some(a => !ACTIONS[a.type].passive));
    if (!someoneCan) return this.beforeDealer(now);
    this.windowPlayed.clear();
    this.phase = 'final';
    const dur = this.opts.chaos * 1000;
    this.deadline = now + dur;
    this.ev('finalChaos', { dur });
  }

  myTurn(id) { return this.phase === 'turn' && this.turn && this.turn.pid === id && this.curHand() && this.curHand().status === 'playing'; }

  hit(id, now, isDouble = false) {
    if (!this.myTurn(id)) return 'No es tu turno';
    this.pending = { pid: id, h: this.turn.h, type: isDouble ? 'double' : 'hit' };
    this.windowPlayed.clear();
    const someoneCan = this.inHand().some(q => q.status !== 'out' && q.actions.some(a => !ACTIONS[a.type].passive));
    this.phase = 'window';
    const dur = someoneCan ? this.opts.chaos * 1000 : this.cfg.quickWindow;
    this.deadline = now + dur;
    this.ev('window', { pid: id, h: this.turn.h, double: isDouble, dur });
    return null;
  }
  double(id, now) {
    if (!this.myTurn(id)) return 'No es tu turno';
    const p = this.get(id), hand = this.curHand();
    if (hand.cards.length !== 2) return 'Solo puedes doblar con 2 cartas';
    if (p.chips < hand.bet) return 'No tienes fichas suficientes para doblar';
    p.chips -= hand.bet; hand.bet *= 2; hand.doubled = true;
    this.ev('double', { pid: id, h: this.turn.h });
    return this.hit(id, now, true);
  }
  canSplit(p, hand) {
    return p.hands.length === 1 && hand.cards.length === 2 && hand.cards.every(c => c.k === 'c') &&
      cardValue(hand.cards[0]) === cardValue(hand.cards[1]) && p.chips >= hand.bet;
  }
  split(id, now) {
    if (!this.myTurn(id)) return 'No es tu turno';
    const p = this.get(id), hand = this.curHand();
    if (!this.canSplit(p, hand)) return 'Solo puedes dividir dos cartas del mismo valor (y con fichas para la segunda apuesta)';
    p.chips -= hand.bet;
    const second = newHand(hand.bet);
    second.cards = [hand.cards.pop()];
    hand.cards.push(this.draw());
    second.cards.push(this.draw());
    hand.split = second.split = true; hand.natIds = null;
    p.hands.push(second);
    this.ev('split', { pid: id });
    // si la primera mano quedó en 21 se planta sola
    if (handValue(hand.cards).v === 21) { hand.status = 'stood'; this.ev('stand', { pid: id, h: 0, auto: true }); this.nextTurn(now); }
    else this.deadline = now + this.cfg.turnTime;
    return null;
  }
  stand(id, now) {
    if (!this.myTurn(id)) return 'No es tu turno';
    this.curHand().status = 'stood';
    this.ev('stand', { pid: id, h: this.turn.h });
    this.nextTurn(now);
    return null;
  }

  resolveDeal(now) {
    const pend = this.pending; this.pending = null;
    const p = this.get(pend.pid), hand = this.handOf(pend.pid, pend.h);
    if (!hand || hand.status !== 'playing') { this.nextTurn(now); return; }
    const n = this.butter ? 2 : 1;
    const caster = this.butter; this.butter = null;
    for (let i = 0; i < n; i++) hand.cards.push(this.draw());
    this.ev('hit', { pid: p.id, h: pend.h, n, butter: !!caster, by: caster });
    this.checkBust(p, hand, caster);
    if (hand.status === 'bust') { this.nextTurn(now); return; }
    if (pend.type === 'double' || handValue(hand.cards).v === 21) {
      hand.status = 'stood';
      this.ev('stand', { pid: p.id, h: pend.h, auto: true });
      this.nextTurn(now);
      return;
    }
    this.phase = 'turn';
    this.deadline = now + (p.connected ? this.cfg.turnTime : 300);
    this.ev('turn', { pid: p.id, h: pend.h, again: true });
  }

  // Tras cambiarle las cartas a una mano (Espejo, Carrusel, Comunismo): si quedó por encima
  // de su límite revienta; si estaba pasada y ahora vale, revive.
  recheck(p, hand, creditId) {
    const { v } = handValue(hand.cards);
    if (hand.status === 'bust') {
      if (v > hand.limit) return;
      const list = this.allHands(false);
      const me = list.findIndex(x => x.hand === hand);
      const cur = this.turn ? list.findIndex(x => x.p.id === this.turn.pid && x.h === this.turn.h) : list.length;
      hand.status = me > cur ? 'playing' : 'stood'; // si su turno aún no llega, lo juega
      this.ev('revive', { pid: p.id, h: p.hands.indexOf(hand), v });
      return;
    }
    this.checkBust(p, hand, creditId);
  }

  // Revisa si la mano se pasó. creditId = quien lo provocó con una carta de acción.
  checkBust(p, hand, creditId) {
    if (hand.status === 'bust') return;
    const { v } = handValue(hand.cards);
    if (v <= hand.limit) return;
    const h = p.hands.indexOf(hand);
    if (v <= this.cfg.abogadoLimit && hand.limit < this.cfg.abogadoLimit && this.takePassive(p, 'abogado')) {
      hand.limit = this.cfg.abogadoLimit;
      this.ev('abogado', { pid: p.id, h });
      return;
    }
    hand.status = 'bust';
    p.stats.busts++;
    this.ev('bust', { pid: p.id, h, v, by: creditId || null });
    if (creditId && creditId !== p.id) {
      const c = this.get(creditId);
      if (c && c.status !== 'out') { c.stats.caused++; this.giveAction(c, 'sabotaje'); }
    }
  }

  // ---------- cartas de acción ----------
  // t = { pid, h, card }: jugador objetivo, índice de mano y (para Devolver) id de carta propia
  play(id, uid, t, now) {
    t = t || {};
    const p = this.get(id);
    if (!p || !p.inHand || p.status === 'out') return 'No estás en esta mano';
    const idx = p.actions.findIndex(a => a.uid === uid);
    if (idx < 0) return 'No tienes esa carta';
    const type = p.actions[idx].type;
    const def = ACTIONS[type];
    if (def.passive) return 'Esta carta es pasiva: se activa sola';
    if (this.phase === 'turn') {
      if (this.turnId !== id && !def.anytime) return 'Solo puedes jugar en tu turno o en la ventana de caos';
    } else if (this.phase === 'window') {
      if (this.windowPlayed.has(id)) return 'Ya jugaste una carta en esta ventana';
    } else if (this.phase === 'final') {
      // sin límite: se pueden encadenar cartas mientras corra el reloj
    } else if (this.phase === 'rescue') {
      if (type !== 'devolver') return 'Ahora solo se puede usar Arrepentimiento';
    } else return 'Ahora no se pueden jugar cartas';

    // --- validar objetivo ---
    let tp = null, th = null;
    if (def.target === 'hand') {
      tp = this.get(t.pid); th = this.handOf(t.pid, t.h | 0);
      const self = tp && tp.id === id;
      if (!tp || !th || (self && !SELF_OK.has(type))) return 'Objetivo inválido';
      // Amnesia en tu propia mano pasada sirve para revivir
      if (th.status === 'bust' && type !== 'espejo' && !(self && type === 'amnesia')) return 'Esa mano ya se pasó';
      if (type === 'amnesia' && th.cards.length < 2) return 'Esa mano solo tiene una carta';
      if (type === 'lazo' && th.status !== 'playing') return 'Esa mano ya está plantada';
      if (type === 'empujon' && th.status !== 'stood') return 'Solo puedes empujar a alguien que ya se plantó';
    } else if (def.target === 'player') {
      tp = this.get(t.pid);
      if (!tp || tp.id === id || tp.status === 'out') return 'Objetivo inválido';
      if (!tp.actions.length) return 'Ese jugador no tiene cartas que robar';
    } else if (def.target === 'own') {
      th = p.hands[t.h | 0];
      if (!th) return 'Mano inválida';
      if (th.cards.length < 2) return 'Esa mano solo tiene una carta';
      if (!th.cards.some(c => c.id === t.card)) return 'Elige una carta de tu mano';
    }
    let mine = null; // mano propia para Espejo
    if (type === 'espejo') {
      // en tu turno, la mano que estás jugando; si no, la que se pasó (para rescatarla) o la primera
      mine = this.turnId === id ? this.curHand() : null;
      if (!mine) mine = p.hands.find(x => x.status === 'bust') || p.hands[0];
      if (!mine) return 'No tienes mano que cambiar';
    }
    if (type === 'comunismo' && this.allHands(false).length < 2) return 'Se necesitan al menos 2 manos';
    if (type === 'carrusel' && this.allHands(false).length < 1) return 'No hay manos que rotar';

    p.actions.splice(idx, 1);
    p.stats.played++;
    if (this.phase === 'window') this.windowPlayed.add(id);
    this.ev('play', { pid: id, card: type, target: tp ? tp.id : null, th: def.target === 'hand' ? (t.h | 0) : null });

    switch (type) {
      case 'granada5':
      case 'granada10':
      case 'amnesia': {
        let vp = tp, vh = th, credit = id;
        if (vp.id !== id && this.takePassive(vp, 'escudo')) { // tu escudo no rebota tus propias cartas
          vp.stats.shields++;
          const pool = this.allHands(true).filter(x => x.p.id !== vp.id);
          const nv = pool.length ? this.pick(pool) : null;
          this.ev('shield', { pid: vp.id, h: vp.hands.indexOf(vh), to: nv ? nv.p.id : null, toH: nv ? nv.h : null, card: type });
          credit = vp.id;
          if (!nv) break;
          vp = nv.p; vh = nv.hand;
          if (type === 'amnesia' && vh.cards.length < 2) { this.ev('fizzle', { pid: vp.id }); break; }
        }
        const h = vp.hands.indexOf(vh);
        vh.natIds = null;
        if (type === 'amnesia') {
          // quita la carta más alta (el As cuenta 11; las granadas solo si no hay otra)
          const rank = c => (c.k === 'b' ? -1 : c.k === 'c' && c.r === 'A' ? 11 : cardValue(c));
          let bi = 0;
          vh.cards.forEach((c, i) => { if (rank(c) >= rank(vh.cards[bi])) bi = i; });
          const lost = vh.cards.splice(bi, 1)[0];
          this.ev('amnesia', { pid: vp.id, h, card: lost, self: vp.id === id });
          if (vh.status === 'bust') this.recheck(vp, vh, id);
        } else {
          const v = type === 'granada5' ? 5 : 10;
          vh.cards.push({ id: this.uid++, k: 'b', v });
          vp.stats.bombs++;
          this.ev('boom', { pid: vp.id, h, v, by: id });
          this.checkBust(vp, vh, credit);
        }
        break;
      }
      case 'mantequilla':
        this.butter = id;
        this.ev('butter', { pid: id });
        break;
      case 'lazo':
        th.status = 'stood';
        this.ev('lasso', { pid: tp.id, h: t.h | 0, by: id });
        break;
      case 'empujon':
        th.cards.push(this.draw()); th.natIds = null;
        this.ev('push', { pid: tp.id, h: t.h | 0, by: id });
        this.checkBust(tp, th, id);
        break;
      case 'espejo': {
        const tmp = mine.cards; mine.cards = th.cards; th.cards = tmp;
        mine.natIds = null; th.natIds = null;
        this.ev('mirror', { pid: id, h: p.hands.indexOf(mine), target: tp.id, th: t.h | 0 });
        this.recheck(p, mine, tp.id);
        this.recheck(tp, th, id);
        break;
      }
      case 'vidente': {
        const hidden = this.dealer.hand[1] || null;
        const top = this.shoe.length ? this.shoe[this.shoe.length - 1] : null;
        this.ev('vidente', { pid: id });
        this.ev('peek', { to: id, hidden, top: top ? { k: 'c', r: top.r, s: top.s } : null });
        break;
      }
      case 'comunismo': {
        const part = this.allHands(false);
        const total = part.reduce((a, x) => a + handValue(x.hand.cards).v, 0);
        const avg = Math.floor(total / part.length);
        for (const x of part) { x.hand.cards = [{ id: this.uid++, k: 'v', v: avg }]; x.hand.natIds = null; }
        this.ev('comunismo', { pid: id, avg, total, ids: [...new Set(part.map(x => x.p.id))] });
        for (const x of part) this.recheck(x.p, x.hand, id);
        break;
      }
      case 'carterista': {
        const i = Math.floor(this.rng() * tp.actions.length);
        const stolen = tp.actions.splice(i, 1)[0];
        p.actions.push(stolen);
        this.ev('steal', { pid: id, target: tp.id });
        this.ev('stolen', { to: id, card: stolen.type, from: tp.id });
        this.ev('stolen', { to: tp.id, card: stolen.type, by: id });
        break;
      }
      case 'carrusel': {
        // cada mano pasa a la izquierda; la del dealer entra por la derecha
        const slots = this.allHands(false);
        const packs = slots.map(x => x.hand.cards).concat([this.dealer.hand]);
        slots.forEach((x, i) => { x.hand.cards = packs[i + 1]; x.hand.natIds = null; });
        this.dealer.hand = packs[0];
        this.ev('carousel', { pid: id });
        for (const x of slots) this.recheck(x.p, x.hand, id);
        break;
      }
      case 'devolver': {
        const h = t.h | 0;
        const lost = th.cards.splice(th.cards.findIndex(c => c.id === t.card), 1)[0];
        th.natIds = null;
        const v = handValue(th.cards).v;
        const wasBust = th.status === 'bust';
        if (wasBust && v <= th.limit) th.status = 'stood';
        this.ev('giveback', { pid: id, h, card: lost, saved: wasBust && th.status === 'stood' });
        break;
      }
    }

    if (this.phase === 'rescue') { this.checkRescue(now); return null; }
    if (this.phase === 'final') {
      const more = this.inHand().some(q => q.status !== 'out' && q.connected && q.actions.some(a => !ACTIONS[a.type].passive));
      this.deadline = now + (more ? this.opts.chaos * 1000 : 800);
      this.ev('chain', { dur: this.deadline - now });
      return null;
    }
    // Si la mano en turno ya no está jugando (reventó o la plantaron), se acaba su turno.
    const cur = this.curHand();
    if (cur && cur.status !== 'playing' && (this.phase === 'turn' || this.phase === 'window')) this.nextTurn(now);
    return null;
  }

  // ---------- dealer y liquidación ----------
  rescuers() {
    return this.inHand().filter(p => p.connected && p.actions.some(a => a.type === 'devolver') &&
      p.hands.some(hd => hd.status === 'bust' && hd.cards.length >= 2));
  }
  // Última oportunidad: quien se pasó y tiene Arrepentimiento puede usarla antes del dealer.
  beforeDealer(now) {
    const r = this.rescuers();
    if (!r.length) return this.startDealer(now);
    this.phase = 'rescue';
    this.deadline = now + this.cfg.rescueTime;
    this.ev('rescue', { ids: r.map(p => p.id) });
  }
  checkRescue(now) { if (!this.rescuers().length) this.startDealer(now); }
  startDealer(now) {
    this.phase = 'dealer';
    this.dealer.hidden = false;
    this.ev('reveal');
    this.deadline = now + this.cfg.dealerStep;
  }
  dealerStep(now) {
    const live = this.allHands(true).length > 0;
    const { v } = handValue(this.dealer.hand);
    if (live && v < 17) {
      this.dealer.hand.push(this.draw());
      this.ev('dealerHit');
      this.deadline = now + this.cfg.dealerStep;
      return;
    }
    this.settle(now);
  }
  settle(now) {
    const d = handValue(this.dealer.hand).v;
    const dBust = d > 21;
    const dNat = this.dealer.hand.length === 2 && d === 21;
    const results = [];
    for (const { p, h, hand } of this.allHands(false)) {
      const { v } = handValue(hand.cards);
      const ids = hand.cards.map(c => c.id);
      const natural = !hand.split && hand.natIds && ids.length === 2 && ids.every(x => hand.natIds.includes(x)) && v === 21;
      let res, pay = 0;
      if (hand.status === 'bust') res = 'lose';
      else if (natural) {
        if (dNat) { res = 'push'; pay = hand.bet; }
        else { res = 'blackjack'; pay = Math.floor(hand.bet * 2.5); }
      } else if (v > 21) { // abogado
        if (d === 21) res = 'lose'; else { res = 'win'; pay = hand.bet * 2; }
      } else if (dBust || v > d) { res = 'win'; pay = hand.bet * 2; }
      else if (v === d) { res = 'push'; pay = hand.bet; }
      else res = 'lose';
      p.chips += pay;
      const net = pay - hand.bet;
      p.stats.best = Math.max(p.stats.best, net);
      results.push({ pid: p.id, h, res, net, v });
      if (res === 'blackjack') { p.stats.bj++; this.giveAction(p, 'blackjack'); }
    }
    for (const p of this.inHand()) {
      if (p.chips <= 0) { p.status = 'out'; p.chips = 0; this.ev('eliminated', { pid: p.id }); }
    }
    this.results = { dealer: d, dealerBust: dBust, list: results };
    this.ev('settle', this.results);
    this.phase = 'results';
    this.deadline = now + this.cfg.resultsTime;
  }

  endGame() {
    this.phase = 'gameover';
    this.turn = null; this.pending = null;
    this.ranking = this.players.slice().sort((a, b) => b.chips - a.chips).map(p => ({ pid: p.id, chips: p.chips }));
    // premios graciosos
    const top = (key) => {
      const best = this.players.slice().sort((a, b) => b.stats[key] - a.stats[key])[0];
      return best && best.stats[key] > 0 ? best : null;
    };
    const defs = [
      ['played', 'EL MAS TRAICIONERO', n => `${n} cartas jugadas`],
      ['caused', 'DINAMITERO', n => `hizo reventar ${n} manos`],
      ['bombs', 'IMAN DE GRANADAS', n => `recibio ${n} granadas`],
      ['busts', 'MANOS DE MANTEQUILLA', n => `se paso ${n} veces`],
      ['bj', 'SUERTUDO', n => `${n} blackjack natural`],
      ['shields', 'EL INTOCABLE', n => `${n} rebotes con escudo`],
      ['best', 'GOLPE MAESTRO', n => `gano $${n} en una mano`],
    ];
    this.awards = defs.map(([k, title, txt]) => { const p = top(k); return p ? { title, pid: p.id, detail: txt(p.stats[k]) } : null; }).filter(Boolean);
    this.ev('gameover', { ranking: this.ranking });
  }

  tick(now) {
    if (this.phase === 'lobby' || this.phase === 'gameover') return;
    if (now < this.deadline) return;
    switch (this.phase) {
      case 'betting': this.deal(now); break;
      case 'dealing': this.nextTurn(now); break;
      case 'turn': this.stand(this.turnId, now); break;
      case 'window': this.resolveDeal(now); break;
      case 'final': this.beforeDealer(now); break;
      case 'rescue': this.startDealer(now); break;
      case 'dealer': this.dealerStep(now); break;
      case 'results': {
        const alive = this.players.filter(p => p.status !== 'out' && p.connected);
        if (this.handNo >= this.opts.hands || alive.length <= 1) this.endGame();
        else this.beginHand(now);
        break;
      }
    }
  }

  // ---------- vista para un cliente ----------
  view(viewerId, now) {
    return {
      phase: this.phase,
      handNo: this.handNo,
      maxHands: this.opts.hands,
      opts: this.opts,
      turnId: this.turnId,
      turnHand: this.turn ? this.turn.h : 0,
      pending: this.pending,
      butter: !!this.butter,
      msLeft: Math.max(0, this.deadline - now),
      turnTime: this.cfg.turnTime,
      minBet: this.cfg.minBet,
      maxCards: this.cfg.maxCards,
      windowPlayed: (this.phase === 'window' || this.phase === 'final') ? [...this.windowPlayed] : [],
      rescuers: this.phase === 'rescue' ? this.rescuers().map(p => p.id) : [],
      dealer: {
        hand: this.dealer.hand.map((c, i) => (i === 1 && this.dealer.hidden) ? { id: c.id, hidden: true } : c),
        value: this.dealer.hidden ? null : handValue(this.dealer.hand).v,
      },
      players: this.players.map(p => ({
        id: p.id, name: p.name, seat: p.seat, skin: p.skin, connected: p.connected,
        chips: p.chips, bet: p.bet, status: p.status, inHand: p.inHand,
        hands: p.hands.map(hd => ({ cards: hd.cards, bet: hd.bet, status: hd.status, value: handValue(hd.cards).v, limit: hd.limit, doubled: hd.doubled })),
        canSplit: p.id === viewerId && this.myTurn(p.id) && this.canSplit(p, this.curHand()),
        cards: p.id === viewerId ? p.actions : p.actions.length,
      })),
      results: this.results,
      ranking: this.ranking,
      awards: this.awards,
      log: this.log.slice(-50),
    };
  }
}

module.exports = { Game, ACTIONS, CFG, OPTIONS, handValue };

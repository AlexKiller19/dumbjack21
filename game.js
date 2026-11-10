'use strict';
// Lógica autoritativa de DumbJack21. No depende de la red: el servidor llama
// a los métodos con `now` (ms) y a tick(now) periódicamente.

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['h', 'd', 'c', 's'];

// w = peso de aparición al robar. passive = se activa sola (no se "juega").
const ACTIONS = {
  granada5:    { w: 5,   target: 'enemy' },
  granada10:   { w: 1.5, target: 'enemy' },
  amnesia:     { w: 3,   target: 'enemy' },
  mantequilla: { w: 3,   target: null },
  espejo:      { w: 2,   target: 'enemy' },
  vidente:     { w: 3,   target: null },
  comunismo:   { w: 1.5, target: null },
  escudo:      { w: 3,   passive: true },
  abogado:     { w: 2,   passive: true },
};

const CFG = {
  startChips: 1000,
  maxHands: 8,
  startCards: 2,
  maxCards: 4,
  bonusEvery: 2,       // +1 carta para todos cada 2 manos
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
  abogadoLimit: 25,
};

function cardValue(c) {
  if (c.k === 'b' || c.k === 'v') return c.v;
  if (c.r === 'A') return 1;
  if (c.r === 'J' || c.r === 'Q' || c.r === 'K') return 10;
  return parseInt(c.r, 10);
}

function handValue(hand) {
  let v = 0, aces = 0;
  for (const c of hand) {
    v += cardValue(c);
    if (c.k === 'c' && c.r === 'A') aces++;
  }
  let soft = false;
  if (aces && v + 10 <= 21) { v += 10; soft = true; }
  return { v, soft };
}

class Game {
  constructor(opts = {}) {
    this.rng = opts.rng || Math.random;
    this.cfg = Object.assign({}, CFG, opts.cfg || {});
    this.players = [];
    this.phase = 'lobby';
    this.events = [];
    this.uid = 1;
    this.dealer = { hand: [], hidden: true };
    this.shoe = [];
    this.handNo = 0;
    this.deadline = 0;
    this.turnId = null;
    this.pending = null;
    this.butter = null;
    this.windowPlayed = new Set();
    this.results = null;
    this.ranking = null;
    this.dirty = true;
  }

  // ---------- utilidades ----------
  ev(type, data = {}) { this.events.push(Object.assign({ type }, data)); this.dirty = true; }
  drain() { const e = this.events; this.events = []; this.dirty = false; return e; }
  get(id) { return this.players.find(p => p.id === id); }
  inHand() { return this.players.filter(p => p.inHand); }
  alive() { return this.players.filter(p => p.status !== 'out' && p.connected); }
  pick(arr) { return arr[Math.floor(this.rng() * arr.length)]; }

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
    const c = this.shoe.pop();
    return Object.assign({ id: this.uid++ }, c);
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
    const a = this.drawAction();
    p.actions.push(a);
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
  addPlayer(id, name) {
    if (this.phase !== 'lobby') return 'La partida ya empezó';
    if (this.players.length >= this.cfg.maxPlayers) return 'La mesa está llena';
    const used = new Set(this.players.map(p => p.seat));
    let seat = 0; while (used.has(seat)) seat++;
    this.players.push({
      id, name: String(name || 'Forastero').slice(0, 12), seat, connected: true,
      chips: this.cfg.startChips, bet: 0, hand: [], status: 'idle', inHand: false,
      actions: [], limit: 21, doubled: false, natIds: null, emote: null,
    });
    this.ev('join', { pid: id });
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
    const ready = this.players.filter(p => p.connected);
    if (ready.length < this.cfg.minPlayers) return `Se necesitan al menos ${this.cfg.minPlayers} jugadores`;
    for (const p of this.players) {
      p.chips = this.cfg.startChips;
      p.status = 'idle';
      p.actions = [];
      for (let i = 0; i < this.cfg.startCards; i++) p.actions.push(this.drawAction());
    }
    this.handNo = 0;
    this.buildShoe();
    this.ev('start');
    this.beginHand(now);
    return null;
  }

  backToLobby() {
    if (this.phase !== 'gameover') return 'La partida no ha terminado';
    this.players = this.players.filter(p => p.connected);
    for (const p of this.players) {
      Object.assign(p, { chips: this.cfg.startChips, bet: 0, hand: [], status: 'idle', inHand: false, actions: [], limit: 21 });
    }
    this.dealer = { hand: [], hidden: true };
    this.results = null; this.ranking = null;
    this.phase = 'lobby';
    this.ev('lobby');
    return null;
  }

  // ---------- flujo de una mano ----------
  beginHand(now) {
    this.handNo++;
    if (this.shoe.length < 60) this.buildShoe();
    this.dealer = { hand: [], hidden: true };
    this.butter = null; this.pending = null; this.turnId = null; this.results = null;
    const bonus = this.handNo > 1 && (this.handNo - 1) % this.cfg.bonusEvery === 0;
    for (const p of this.players) {
      p.hand = []; p.bet = 0; p.limit = 21; p.doubled = false; p.natIds = null;
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
      p.status = 'playing';
    }
    const order = this.inHand();
    for (let r = 0; r < 2; r++) {
      for (const p of order) p.hand.push(this.draw());
      this.dealer.hand.push(this.draw());
    }
    for (const p of order) {
      if (handValue(p.hand).v === 21) {
        p.status = 'stood';
        p.natIds = p.hand.map(c => c.id);
        this.ev('natural', { pid: p.id });
      }
    }
    this.ev('deal');
    this.phase = 'dealing';
    this.turnId = null;
    this.deadline = now + this.cfg.dealTime;
  }

  nextTurn(now) {
    this.pending = null;
    this.windowPlayed.clear();
    const order = this.inHand().sort((a, b) => a.seat - b.seat);
    const curSeat = this.turnId ? this.get(this.turnId).seat : -1;
    const next = order.find(p => p.seat > curSeat && p.status === 'playing');
    if (next) {
      this.turnId = next.id;
      this.phase = 'turn';
      this.deadline = now + (next.connected ? this.cfg.turnTime : 300);
      this.ev('turn', { pid: next.id });
    } else {
      this.turnId = null;
      this.startDealer(now);
    }
  }

  hit(id, now, isDouble = false) {
    const p = this.get(id);
    if (this.phase !== 'turn' || this.turnId !== id || p.status !== 'playing') return 'No es tu turno';
    this.pending = { pid: id, type: isDouble ? 'double' : 'hit' };
    this.windowPlayed.clear();
    const someoneCan = this.inHand().some(q => q.status !== 'out' && q.actions.some(a => !ACTIONS[a.type].passive));
    this.phase = 'window';
    const dur = someoneCan ? this.cfg.windowTime : this.cfg.quickWindow;
    this.deadline = now + dur;
    this.ev('window', { pid: id, double: isDouble, dur });
    return null;
  }
  double(id, now) {
    const p = this.get(id);
    if (this.phase !== 'turn' || this.turnId !== id) return 'No es tu turno';
    if (p.hand.length !== 2) return 'Solo puedes doblar con 2 cartas';
    if (p.chips < p.bet) return 'No tienes fichas suficientes para doblar';
    p.chips -= p.bet; p.bet *= 2; p.doubled = true;
    this.ev('double', { pid: id });
    return this.hit(id, now, true);
  }
  stand(id, now) {
    const p = this.get(id);
    if (this.phase !== 'turn' || this.turnId !== id) return 'No es tu turno';
    p.status = 'stood';
    this.ev('stand', { pid: id });
    this.nextTurn(now);
    return null;
  }

  resolveDeal(now) {
    const pend = this.pending; this.pending = null;
    const p = this.get(pend.pid);
    if (!p || p.status !== 'playing') { this.nextTurn(now); return; }
    const n = this.butter ? 2 : 1;
    const caster = this.butter; this.butter = null;
    for (let i = 0; i < n; i++) p.hand.push(this.draw());
    this.ev('hit', { pid: p.id, n, butter: !!caster, by: caster });
    this.checkBust(p, caster);
    if (p.status === 'bust') { this.nextTurn(now); return; }
    if (pend.type === 'double' || handValue(p.hand).v === 21) {
      p.status = 'stood';
      this.ev('stand', { pid: p.id, auto: true });
      this.nextTurn(now);
      return;
    }
    this.phase = 'turn';
    this.deadline = now + (p.connected ? this.cfg.turnTime : 300);
    this.ev('turn', { pid: p.id, again: true });
  }

  // Revisa si p se pasó. creditId = quien lo provocó con una carta de acción.
  checkBust(p, creditId) {
    if (p.status === 'bust' || p.status === 'out') return;
    const { v } = handValue(p.hand);
    if (v <= p.limit) return;
    if (v <= this.cfg.abogadoLimit && p.limit < this.cfg.abogadoLimit && this.takePassive(p, 'abogado')) {
      p.limit = this.cfg.abogadoLimit;
      this.ev('abogado', { pid: p.id });
      return;
    }
    p.status = 'bust';
    this.ev('bust', { pid: p.id, v, by: creditId || null });
    if (creditId && creditId !== p.id) {
      const c = this.get(creditId);
      if (c && c.status !== 'out') this.giveAction(c, 'sabotaje');
    }
  }

  // ---------- cartas de acción ----------
  play(id, uid, targetId, now) {
    const p = this.get(id);
    if (!p || !p.inHand || p.status === 'out') return 'No estás en esta mano';
    const idx = p.actions.findIndex(a => a.uid === uid);
    if (idx < 0) return 'No tienes esa carta';
    const type = p.actions[idx].type;
    const def = ACTIONS[type];
    if (def.passive) return 'Esta carta es pasiva: se activa sola';
    if (this.phase === 'turn') {
      if (this.turnId !== id) return 'Solo puedes jugar en tu turno o en la ventana de caos';
    } else if (this.phase === 'window') {
      if (this.windowPlayed.has(id)) return 'Ya jugaste una carta en esta ventana';
    } else return 'Ahora no se pueden jugar cartas';

    let target = null;
    if (def.target === 'enemy') {
      target = this.get(targetId);
      if (!target || target.id === id || !target.inHand) return 'Objetivo inválido';
      if (target.status === 'bust' || target.status === 'out') return 'Ese jugador ya está fuera de la mano';
    }
    // validaciones específicas
    if (type === 'amnesia' && target.hand.length <= 2) return 'No ha pedido cartas todavía';
    if (type === 'espejo') {
      if (p.status === 'bust') return 'No puedes cambiar una mano pasada';
      if (target.status !== 'playing') return 'Solo puedes cambiar con alguien que no se ha plantado';
    }
    if (type === 'comunismo') {
      const part = this.inHand().filter(q => q.status === 'playing' || q.status === 'stood');
      if (part.length < 2) return 'Se necesitan al menos 2 manos vivas';
    }

    p.actions.splice(idx, 1);
    if (this.phase === 'window') this.windowPlayed.add(id);
    this.ev('play', { pid: id, card: type, target: target ? target.id : null });

    switch (type) {
      case 'granada5':
      case 'granada10':
      case 'amnesia': {
        let victim = target, credit = id;
        if (this.takePassive(victim, 'escudo')) {
          const pool = this.inHand().filter(q => q.id !== victim.id && (q.status === 'playing' || q.status === 'stood'));
          const nv = pool.length ? this.pick(pool) : null;
          this.ev('shield', { pid: victim.id, to: nv ? nv.id : null, card: type });
          credit = victim.id;
          victim = nv;
          if (!victim) break;
          if (type === 'amnesia' && victim.hand.length <= 2) { this.ev('fizzle', { pid: victim.id }); break; }
        }
        if (type === 'amnesia') {
          const lost = victim.hand.pop();
          this.ev('amnesia', { pid: victim.id, card: lost });
          // quitar una carta puede "deshacer" un abogado, pero nunca causa bust
        } else {
          const v = type === 'granada5' ? 5 : 10;
          victim.hand.push({ id: this.uid++, k: 'b', v });
          this.ev('boom', { pid: victim.id, v, by: id });
          this.checkBust(victim, credit);
        }
        break;
      }
      case 'mantequilla':
        this.butter = id;
        this.ev('butter', { pid: id });
        break;
      case 'espejo': {
        const tmp = p.hand; p.hand = target.hand; target.hand = tmp;
        p.natIds = null; target.natIds = null;
        this.ev('mirror', { pid: id, target: target.id });
        this.checkBust(p, target.id);
        this.checkBust(target, id);
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
        const part = this.inHand().filter(q => q.status === 'playing' || q.status === 'stood');
        const total = part.reduce((a, q) => a + handValue(q.hand).v, 0);
        const avg = Math.floor(total / part.length);
        for (const q of part) { q.hand = [{ id: this.uid++, k: 'v', v: avg }]; q.natIds = null; }
        this.ev('comunismo', { pid: id, avg, total, ids: part.map(q => q.id) });
        break;
      }
    }

    // Si el jugador en turno reventó por sabotaje, se acaba su turno.
    const cur = this.turnId && this.get(this.turnId);
    if (cur && cur.status === 'bust' && (this.phase === 'turn' || this.phase === 'window')) {
      this.nextTurn(now);
    }
    return null;
  }

  // ---------- dealer y liquidación ----------
  startDealer(now) {
    this.phase = 'dealer';
    this.dealer.hidden = false;
    this.ev('reveal');
    this.deadline = now + this.cfg.dealerStep;
  }
  dealerStep(now) {
    const live = this.inHand().some(p => p.status === 'stood' || p.status === 'playing');
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
    for (const p of this.inHand()) {
      const { v } = handValue(p.hand);
      const ids = p.hand.map(c => c.id);
      const natural = p.natIds && ids.length === 2 && ids.every(x => p.natIds.includes(x)) && v === 21;
      let res, pay = 0;
      if (p.status === 'bust') res = 'lose';
      else if (natural) {
        if (dNat) { res = 'push'; pay = p.bet; }
        else { res = 'blackjack'; pay = Math.floor(p.bet * 2.5); }
      } else if (v > 21) { // abogado
        if (d === 21) res = 'lose'; else { res = 'win'; pay = p.bet * 2; }
      } else if (dBust || v > d) { res = 'win'; pay = p.bet * 2; }
      else if (v === d) { res = 'push'; pay = p.bet; }
      else res = 'lose';
      p.chips += pay;
      results.push({ pid: p.id, res, net: pay - p.bet, v });
      if (res === 'blackjack') this.giveAction(p, 'blackjack');
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
    this.turnId = null; this.pending = null;
    this.ranking = this.players.slice().sort((a, b) => b.chips - a.chips).map(p => ({ pid: p.id, chips: p.chips }));
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
      case 'dealer': this.dealerStep(now); break;
      case 'results': {
        const alive = this.players.filter(p => p.status !== 'out' && p.connected);
        if (this.handNo >= this.cfg.maxHands || alive.length <= 1) this.endGame();
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
      maxHands: this.cfg.maxHands,
      turnId: this.turnId,
      pending: this.pending,
      butter: !!this.butter,
      msLeft: Math.max(0, this.deadline - now),
      minBet: this.cfg.minBet,
      windowPlayed: this.phase === 'window' ? [...this.windowPlayed] : [],
      dealer: {
        hand: this.dealer.hand.map((c, i) => (i === 1 && this.dealer.hidden) ? { id: c.id, hidden: true } : c),
        value: this.dealer.hidden ? null : handValue(this.dealer.hand).v,
      },
      players: this.players.map(p => ({
        id: p.id, name: p.name, seat: p.seat, connected: p.connected,
        chips: p.chips, bet: p.bet, status: p.status, inHand: p.inHand,
        hand: p.hand, value: handValue(p.hand).v, limit: p.limit, doubled: p.doubled,
        cards: p.id === viewerId ? p.actions : p.actions.length,
      })),
      results: this.results,
      ranking: this.ranking,
    };
  }
}

module.exports = { Game, ACTIONS, CFG, handValue };

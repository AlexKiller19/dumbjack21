'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Game, handValue } = require('../game');

const C = (r, id = Math.random()) => ({ id, k: 'c', r, s: 'h' });

// Monta una partida de 3 jugadores ya en el turno de A, con manos controladas.
function setup(hands, actions = {}) {
  const g = new Game({ rng: () => 0.42 });
  let t = 0;
  for (const id of ['A', 'B', 'X']) g.addPlayer(id, id);
  g.start(t);
  for (const id of ['A', 'B', 'X']) g.bet(id, 100, t);
  t += 1000; g.tick(t); // reparte
  for (const p of g.players) {
    p.hand = (hands[p.id] || ['10', '6']).map(r => C(r));
    p.status = 'playing'; p.natIds = null;
    p.actions = (actions[p.id] || []).map((type, i) => ({ uid: p.id + i, type }));
  }
  g.dealer.hand = [C('10'), C('7')];
  t += 2000; g.tick(t); // primer turno
  return { g, t };
}

test('valor de mano con ases', () => {
  assert.equal(handValue([C('A'), C('K')]).v, 21);
  assert.equal(handValue([C('A'), C('A'), C('9')]).v, 21);
  assert.equal(handValue([C('A'), C('5'), C('K')]).v, 16);
});

test('cada jugador empieza con 2 cartas de acción y 1000 fichas', () => {
  const g = new Game();
  g.addPlayer('A', 'a'); g.addPlayer('B', 'b');
  assert.equal(g.start(0), null);
  for (const p of g.players) { assert.equal(p.actions.length, 2); assert.equal(p.chips, 1000); }
});

test('Granada +5 revienta a quien está en 17 y da carta al atacante', () => {
  const { g, t } = setup({ B: ['10', '7'] }, { A: ['granada5'] });
  assert.equal(g.turnId, 'A');
  assert.equal(g.play('A', 'A0', 'B', t), null);
  assert.equal(g.get('B').status, 'bust');
  assert.equal(g.get('A').actions.length, 1, 'recibe carta por sabotaje');
});

test('Escudo de Goma rebota la granada y no se puede re-rebotar', () => {
  const { g, t } = setup({ B: ['10', '7'], X: ['10', '8'] }, { A: ['granada10'], B: ['escudo'], X: ['escudo'] });
  g.play('A', 'A0', 'B', t);
  assert.equal(g.get('B').status, 'playing');
  const hit = ['A', 'X'].find(id => g.get(id).status === 'bust');
  assert.ok(hit, 'la granada cayó en A o X (ambos revientan con +10)');
  assert.equal(g.get('B').actions.length, 1, 'gastó el escudo y ganó 1 carta por el rebote');
  if (hit === 'X') assert.equal(g.get('X').actions.length, 1, 'el escudo de X no se activa');
});

test('Abogado del Diablo sube el límite a 25 automáticamente', () => {
  const { g, t } = setup({ B: ['10', '8'] }, { A: ['granada5'], B: ['abogado'] });
  g.play('A', 'A0', 'B', t);
  const b = g.get('B');
  assert.equal(b.status, 'playing');
  assert.equal(b.limit, 25);
  assert.equal(handValue(b.hand).v, 23);
});

test('Abogado: 23 gana al dealer con 20 pero pierde contra 21', () => {
  for (const [dealer, expect] of [[['10', 'K'], 'win'], [['10', 'A'], 'lose']]) {
    const { g, t } = setup({}, {});
    const a = g.get('A'); a.hand = [C('10'), C('8'), C('5')]; a.limit = 25; a.status = 'stood';
    for (const id of ['B', 'X']) g.get(id).status = 'bust';
    g.dealer.hand = dealer.map(r => C(r)); g.dealer.hidden = false;
    g.settle(t);
    assert.equal(g.results.list.find(r => r.pid === 'A').res, expect);
  }
});

test('Amnesia quita la última carta pedida', () => {
  const { g, t } = setup({ B: ['10', '2', '9'] }, { A: ['amnesia'] });
  g.play('A', 'A0', 'B', t);
  assert.equal(handValue(g.get('B').hand).v, 12);
});

test('Amnesia no funciona si solo tiene las 2 cartas iniciales', () => {
  const { g, t } = setup({}, { A: ['amnesia'] });
  assert.match(g.play('A', 'A0', 'B', t), /No ha pedido/);
});

test('Espejo solo con quien no se ha plantado', () => {
  const { g, t } = setup({ A: ['10', '4'], B: ['10', 'K'] }, { A: ['espejo', 'espejo'] });
  g.get('B').status = 'stood';
  assert.match(g.play('A', 'A0', 'B', t), /no se ha plantado/);
  assert.equal(g.play('A', 'A1', 'X', t), null);
  assert.equal(handValue(g.get('A').hand).v, 16);
  assert.equal(handValue(g.get('X').hand).v, 14);
});

test('Comunismo promedia hacia abajo', () => {
  const { g, t } = setup({ A: ['10', '2'], B: ['10', '10'], X: ['10', '9'] }, { A: ['comunismo'] });
  g.play('A', 'A0', null, t);
  for (const id of ['A', 'B', 'X']) assert.equal(handValue(g.get(id).hand).v, 17); // 51/3
});

test('Mano de Mantequilla da 2 cartas al siguiente que pide', () => {
  const { g, t } = setup({ A: ['2', '3'] }, { B: ['mantequilla'] });
  g.hit('A', t);
  assert.equal(g.phase, 'window');
  assert.equal(g.play('B', 'B0', null, t + 100), null);
  g.tick(t + 5000);
  assert.equal(g.get('A').hand.length, 4);
});

test('Solo una carta por jugador en cada ventana de caos', () => {
  const { g, t } = setup({ A: ['2', '3'] }, { B: ['mantequilla', 'vidente'] });
  g.hit('A', t);
  g.play('B', 'B0', null, t);
  assert.match(g.play('B', 'B1', null, t), /Ya jugaste/);
});

test('Fuera de tu turno no puedes jugar cartas salvo en la ventana', () => {
  const { g, t } = setup({}, { B: ['vidente'] });
  assert.match(g.play('B', 'B0', null, t), /Solo puedes jugar/);
});

test('+1 carta para todos cada 2 manos y tope de 4', () => {
  const g = new Game({ rng: () => 0.1 });
  g.addPlayer('A', 'a'); g.addPlayer('B', 'b');
  g.start(0);
  g.players[1].actions.push({ uid: 'x', type: 'vidente' }, { uid: 'y', type: 'vidente' });
  g.handNo = 2; g.beginHand(0); // mano 3
  assert.equal(g.players[0].actions.length, 3);
  assert.equal(g.players[1].actions.length, 4);
});

test('Sin fichas quedas eliminado y la partida termina con 1 vivo', () => {
  const { g, t } = setup({}, {});
  const a = g.get('A'); a.chips = 0; a.status = 'bust';
  for (const id of ['B', 'X']) { g.get(id).status = 'bust'; g.get(id).chips = 0; }
  g.get('X').chips = 500;
  g.settle(t);
  assert.equal(g.get('A').status, 'out');
  assert.equal(g.get('B').status, 'out');
  g.tick(t + 10000);
  assert.equal(g.phase, 'gameover');
  assert.equal(g.ranking[0].pid, 'X');
});

test('Partida completa simulada de 8 manos termina', () => {
  let seed = 7; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = new Game({ rng });
  for (const id of ['A', 'B', 'C', 'D']) g.addPlayer(id, id);
  let t = 0; g.start(t);
  for (let i = 0; i < 20000 && g.phase !== 'gameover'; i++) {
    t += 250;
    if (g.phase === 'turn') {
      const p = g.get(g.turnId);
      const playable = p.actions.find(a => !['escudo', 'abogado'].includes(a.type));
      if (playable && rng() < 0.3) {
        const tgt = g.inHand().find(q => q.id !== p.id && q.status === 'playing');
        g.play(p.id, playable.uid, tgt && tgt.id, t);
      } else if (handValue(p.hand).v < 16) g.hit(p.id, t); else g.stand(p.id, t);
    }
    g.tick(t);
  }
  assert.equal(g.phase, 'gameover');
  assert.ok(g.handNo <= 8);
});

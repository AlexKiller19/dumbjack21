'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Game, handValue } = require('../game');

let cid = 1000;
const C = (r) => ({ id: cid++, k: 'c', r, s: 'h' });
const val = (g, id, h = 0) => handValue(g.get(id).hands[h].cards).v;
const H = (g, id, h = 0) => g.get(id).hands[h];

// Partida de 3 jugadores ya en el turno de A, con manos controladas.
function setup(hands = {}, actions = {}) {
  const g = new Game({ rng: () => 0.42 });
  let t = 0;
  for (const id of ['A', 'B', 'X']) g.addPlayer(id, id);
  g.start(t);
  for (const id of ['A', 'B', 'X']) g.bet(id, 100, t);
  t += 1000; g.tick(t); // reparte
  for (const p of g.players) {
    p.hands[0].cards = (hands[p.id] || ['10', '6']).map(r => C(r));
    p.hands[0].status = 'playing'; p.hands[0].natIds = null;
    p.actions = (actions[p.id] || []).map((type, i) => ({ uid: p.id + i, type }));
  }
  g.dealer.hand = [C('10'), C('7')];
  t += 2000; g.tick(t); // primer turno
  return { g, t };
}
const T = (pid, h = 0, card) => ({ pid, h, card });

test('valor de mano con ases', () => {
  assert.equal(handValue([C('A'), C('K')]).v, 21);
  assert.equal(handValue([C('A'), C('A'), C('9')]).v, 21);
  assert.equal(handValue([C('A'), C('5'), C('K')]).v, 16);
});

test('empiezas con 2 cartas y fichas según la opción de sala', () => {
  const g = new Game();
  g.addPlayer('A', 'a'); g.addPlayer('B', 'b');
  assert.equal(g.setOption('chips', 2000), null);
  assert.match(g.setOption('chips', 123), /inválida/);
  assert.equal(g.start(0), null);
  for (const p of g.players) { assert.equal(p.actions.length, 2); assert.equal(p.chips, 2000); }
});

test('opciones: número de manos y duración del caos', () => {
  const g = new Game();
  g.addPlayer('A', 'a'); g.addPlayer('B', 'b');
  g.setOption('hands', 5); g.setOption('chaos', 5);
  g.start(0);
  assert.equal(g.view('A', 0).maxHands, 5);
  g.bet('A', 100, 0); g.bet('B', 100, 0); g.tick(1000); g.tick(3000);
  const cur = g.turnId; g.get(cur).hands[0].cards = [C('2'), C('3')];
  g.get(cur).actions = [{ uid: 'v', type: 'vidente' }];
  g.hit(cur, 3000);
  assert.equal(g.deadline, 3000 + 5000);
});

test('Granada +5 revienta a quien está en 17 y da carta al atacante', () => {
  const { g, t } = setup({ B: ['10', '7'] }, { A: ['granada5'] });
  assert.equal(g.turnId, 'A');
  assert.equal(g.play('A', 'A0', T('B'), t), null);
  assert.equal(H(g, 'B').status, 'bust');
  assert.equal(g.get('A').actions.length, 1, 'recibe carta por sabotaje');
});

test('Escudo de Goma rebota la granada y no se puede re-rebotar', () => {
  const { g, t } = setup({ B: ['10', '7'], X: ['10', '8'] }, { A: ['granada10'], B: ['escudo'], X: ['escudo'] });
  g.play('A', 'A0', T('B'), t);
  assert.equal(H(g, 'B').status, 'playing');
  const hit = ['A', 'X'].find(id => H(g, id).status === 'bust');
  assert.ok(hit, 'la granada cayó en A o X');
  assert.equal(g.get('B').actions.length, 1, 'gastó el escudo y ganó 1 carta por el rebote');
  if (hit === 'X') assert.equal(g.get('X').actions.length, 1, 'el escudo de X no se activa');
});

test('Abogado del Diablo sube el límite a 25 automáticamente', () => {
  const { g, t } = setup({ B: ['10', '8'] }, { A: ['granada5'], B: ['abogado'] });
  g.play('A', 'A0', T('B'), t);
  assert.equal(H(g, 'B').status, 'playing');
  assert.equal(H(g, 'B').limit, 25);
  assert.equal(val(g, 'B'), 23);
});

test('Abogado: 23 gana al dealer con 20 pero pierde contra 21', () => {
  for (const [dealer, expect] of [[['10', 'K'], 'win'], [['10', 'A'], 'lose']]) {
    const { g, t } = setup();
    Object.assign(H(g, 'A'), { cards: [C('10'), C('8'), C('5')], limit: 25, status: 'stood' });
    for (const id of ['B', 'X']) H(g, id).status = 'bust';
    g.dealer.hand = dealer.map(r => C(r)); g.dealer.hidden = false;
    g.settle(t);
    assert.equal(g.results.list.find(r => r.pid === 'A').res, expect);
  }
});

test('Amnesia quita la carta más alta, también de las 2 iniciales', () => {
  const { g, t } = setup({ B: ['9', '2', '10'], X: ['K', '5'] }, { A: ['amnesia', 'amnesia'] });
  g.play('A', 'A0', T('B'), t);
  assert.equal(val(g, 'B'), 11);
  g.play('A', 'A1', T('X'), t);
  assert.equal(val(g, 'X'), 5);
});

test('Espejo solo con quien no se ha plantado', () => {
  const { g, t } = setup({ A: ['10', '4'], B: ['10', 'K'] }, { A: ['espejo', 'espejo'] });
  H(g, 'B').status = 'stood';
  assert.match(g.play('A', 'A0', T('B'), t), /no se ha plantado/);
  assert.equal(g.play('A', 'A1', T('X'), t), null);
  assert.equal(val(g, 'A'), 16);
  assert.equal(val(g, 'X'), 14);
});

test('Comunismo promedia hacia abajo', () => {
  const { g, t } = setup({ A: ['10', '2'], B: ['10', '10'], X: ['10', '9'] }, { A: ['comunismo'] });
  g.play('A', 'A0', null, t);
  for (const id of ['A', 'B', 'X']) assert.equal(val(g, id), 17); // 51/3
});

test('Mano de Mantequilla da 2 cartas al siguiente que pide', () => {
  const { g, t } = setup({ A: ['2', '3'] }, { B: ['mantequilla'] });
  g.hit('A', t);
  assert.equal(g.phase, 'window');
  assert.equal(g.play('B', 'B0', null, t + 100), null);
  g.tick(t + 5000);
  assert.equal(H(g, 'A').cards.length, 4);
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

test('+1 carta para todos cada mano y tope de 5', () => {
  const g = new Game({ rng: () => 0.1 });
  g.addPlayer('A', 'a'); g.addPlayer('B', 'b');
  g.start(0);
  for (let i = 0; i < 3; i++) g.players[1].actions.push({ uid: 'x' + i, type: 'vidente' });
  g.handNo = 1; g.beginHand(0); // mano 2
  assert.equal(g.players[0].actions.length, 3);
  assert.equal(g.players[1].actions.length, 5);
});

test('Lazo planta a la fuerza y termina su turno', () => {
  const { g, t } = setup({ A: ['10', '2'] }, { B: ['lazo'] });
  g.hit('A', t);
  assert.equal(g.play('B', 'B0', T('A'), t), null);
  assert.equal(H(g, 'A').status, 'stood');
  assert.equal(H(g, 'A').cards.length, 2, 'no recibió la carta que pidió');
  assert.equal(g.turnId, 'B');
});

test('Empujón obliga a pedir a quien ya se plantó', () => {
  const { g, t } = setup({ B: ['10', '10'] }, { A: ['empujon'] });
  assert.match(g.play('A', 'A0', T('B'), t), /ya se plantó/);
  H(g, 'B').status = 'stood';
  g.shoe.push({ k: 'c', r: '5', s: 'h' });
  assert.equal(g.play('A', 'A0', T('B'), t), null);
  assert.equal(H(g, 'B').status, 'bust');
});

test('Carterista roba una carta de acción', () => {
  const { g, t } = setup({}, { A: ['carterista'], B: ['escudo'] });
  g.play('A', 'A0', T('B'), t);
  assert.deepEqual(g.get('A').actions.map(a => a.type), ['escudo']);
  assert.equal(g.get('B').actions.length, 0);
});

test('Soborno cambia la carta oculta del dealer', () => {
  const { g, t } = setup({}, { A: ['soborno'] });
  const before = g.dealer.hand[1].id;
  g.play('A', 'A0', null, t);
  assert.notEqual(g.dealer.hand[1].id, before);
  assert.equal(g.view('A', t).dealer.hand[1].hidden, true);
});

test('Carrusel rota las manos a la izquierda incluyendo al dealer', () => {
  const { g, t } = setup({ A: ['2', '3'], B: ['4', '5'], X: ['6', '7'] }, { A: ['carrusel'] });
  g.play('A', 'A0', null, t);
  assert.equal(val(g, 'A'), 9);   // la de B
  assert.equal(val(g, 'B'), 13);  // la de X
  assert.equal(val(g, 'X'), 17);  // la del dealer (10+7)
  assert.equal(handValue(g.dealer.hand).v, 5); // la de A
});

test('Arrepentimiento devuelve una carta aunque ya te hayas pasado', () => {
  const { g, t } = setup({ A: ['10', '6', '9'], B: ['10', '10'], X: ['10', '10'] }, { A: ['devolver'] });
  const a = H(g, 'A'); a.status = 'bust';
  g.turn = { pid: 'B', h: 0 }; // ya no es el turno de A
  assert.equal(g.play('A', 'A0', T(null, 0, a.cards[2].id), t), null);
  assert.equal(a.status, 'stood');
  assert.equal(val(g, 'A'), 16);
});

test('Última oportunidad: pausa antes del dealer si alguien pasado tiene Arrepentimiento', () => {
  const { g, t } = setup({ A: ['10', '6', '9'] }, { A: ['devolver'] });
  H(g, 'A').status = 'bust';
  g.turn = { pid: 'B', h: 0 };
  g.stand('B', t); g.stand('X', t);
  assert.equal(g.phase, 'rescue');
  assert.match(g.play('B', 'nope', null, t) || '', /No tienes/);
  g.play('A', 'A0', T(null, 0, H(g, 'A').cards[2].id), t);
  assert.equal(g.phase, 'dealer');
  assert.equal(H(g, 'A').status, 'stood');
});

test('Dividir crea dos manos con su apuesta y se juegan en orden', () => {
  const { g, t } = setup({ A: ['8', '8'] });
  g.shoe.push({ k: 'c', r: '3', s: 'h' }, { k: 'c', r: '2', s: 'h' });
  const chips = g.get('A').chips;
  assert.equal(g.view('A', t).players[0].canSplit, true);
  assert.equal(g.split('A', t), null);
  const a = g.get('A');
  assert.equal(a.hands.length, 2);
  assert.equal(a.chips, chips - 100);
  assert.equal(val(g, 'A', 0), 10); assert.equal(val(g, 'A', 1), 11);
  assert.match(g.split('A', t), /Solo puedes dividir/);
  g.stand('A', t);
  assert.deepEqual(g.turn, { pid: 'A', h: 1 });
  g.stand('A', t);
  assert.equal(g.turnId, 'B');
});

test('El atacante elige a cuál mano dividida le cae la granada', () => {
  const { g, t } = setup({ A: ['8', '8'] }, { B: ['granada10'] });
  g.shoe.push({ k: 'c', r: '9', s: 'h' }, { k: 'c', r: '9', s: 'h' });
  g.split('A', t); // 17 y 17
  g.hit('A', t);
  g.play('B', 'B0', T('A', 1), t);
  assert.equal(H(g, 'A', 0).status, 'playing');
  assert.equal(H(g, 'A', 1).status, 'bust');
});

test('Sin fichas quedas eliminado, la partida termina con 1 vivo y hay premios', () => {
  const { g, t } = setup({}, { A: ['vidente'] });
  g.play('A', 'A0', null, t);
  for (const id of ['A', 'B', 'X']) { H(g, id).status = 'bust'; g.get(id).chips = 0; }
  g.get('X').chips = 500;
  g.settle(t);
  assert.equal(g.get('A').status, 'out');
  g.tick(t + 10000);
  assert.equal(g.phase, 'gameover');
  assert.equal(g.ranking[0].pid, 'X');
  assert.ok(g.awards.some(a => a.title === 'EL MAS TRAICIONERO' && a.pid === 'A'));
});

test('Partida completa simulada con todas las cartas termina sin errores', () => {
  for (let seed0 = 1; seed0 <= 40; seed0++) {
    let seed = seed0 * 7919; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const g = new Game({ rng });
    for (const id of ['A', 'B', 'C', 'D']) g.addPlayer(id, id);
    let t = 0; g.start(t);
    for (let i = 0; i < 40000 && g.phase !== 'gameover'; i++) {
      t += 250;
      if (g.phase === 'betting') for (const p of g.players) if (p.status === 'betting') g.bet(p.id, 100, t);
      if (g.phase === 'turn' || g.phase === 'window' || g.phase === 'rescue') {
        for (const p of g.inHand()) {
          const a = p.actions.find(x => !['escudo', 'abogado'].includes(x.type));
          if (!a || rng() > 0.25) continue;
          const others = g.allHands(false).filter(x => x.p.id !== p.id);
          const tg = others.length ? others[Math.floor(rng() * others.length)] : null;
          const own = p.hands[0];
          g.play(p.id, a.uid, a.type === 'devolver' ? { h: 0, card: own.cards[own.cards.length - 1].id } : tg ? { pid: tg.p.id, h: tg.h } : null, t);
        }
      }
      if (g.phase === 'turn') {
        const p = g.get(g.turnId), hand = g.curHand();
        if (g.canSplit(p, hand) && rng() < 0.7) g.split(p.id, t);
        else if (handValue(hand.cards).v < 16) g.hit(p.id, t); else g.stand(p.id, t);
      }
      g.tick(t);
    }
    assert.equal(g.phase, 'gameover', 'semilla ' + seed0);
    assert.ok(g.handNo <= 8);
    for (const p of g.players) assert.ok(p.chips >= 0 && p.actions.length <= 5);
  }
});

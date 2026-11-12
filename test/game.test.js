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
  g.players.forEach((p, i) => { p.seat = i; }); // A, B, X en orden para que las pruebas sean predecibles
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
  assert.equal(g.phase, 'final', 'primero el caos final');
  g.tick(t + 10000);
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

test('Sin cartas jugables no hay caos final', () => {
  const { g, t } = setup({}, { A: ['escudo'] });
  g.stand('A', t); g.stand('B', t); g.stand('X', t);
  assert.equal(g.phase, 'dealer');
});

test('Espejo funciona con plantados y te rescata si te pasaste', () => {
  const { g, t } = setup({ A: ['10', '4'], B: ['10', 'K'], X: ['9', '9'] }, { A: ['espejo'], B: ['espejo'] });
  H(g, 'B').status = 'stood';
  assert.equal(g.play('A', 'A0', T('B'), t), null);    // le roba su 20 aunque se plantó
  assert.equal(val(g, 'A'), 20); assert.equal(val(g, 'B'), 14);
  // B se pasa y usa Espejo en el caos para cambiar su mano pasada
  Object.assign(H(g, 'B'), { cards: [C('10'), C('8'), C('7')], status: 'bust' });
  g.hit('A', t);
  assert.equal(g.play('B', 'B0', T('X'), t), null);
  assert.equal(H(g, 'B').status, 'playing', 'B revive con el 18 de X (su turno aún no llega)');
  assert.equal(val(g, 'B'), 18);
  assert.equal(H(g, 'X').status, 'bust', 'X recibe el 25');
});

test('Carrusel incluye manos pasadas y las puede revivir', () => {
  const { g, t } = setup({ A: ['10', '6', '9'], B: ['4', '5'], X: ['6', '7'] }, { B: ['carrusel'] });
  H(g, 'A').status = 'bust';
  g.turn = { pid: 'B', h: 0 };
  g.play('B', 'B0', null, t);
  assert.equal(val(g, 'A'), 9);
  assert.equal(H(g, 'A').status, 'stood', 'A ya jugó su turno: revive plantado');
  assert.equal(handValue(g.dealer.hand).v, 25, 'el dealer se queda con el 25');
});

test('Una mano revivida antes de su turno lo sigue jugando', () => {
  const { g, t } = setup({ A: ['4', '5'], B: ['2', '3'], X: ['10', '10', '5'] }, { A: ['carrusel'] });
  H(g, 'X').status = 'bust'; // reventada por una granada antes de su turno
  g.play('A', 'A0', null, t);
  assert.equal(val(g, 'X'), 17, 'recibe la mano del dealer');
  assert.equal(H(g, 'X').status, 'playing');
});

test('Comunismo promedia también las manos pasadas', () => {
  const { g, t } = setup({ A: ['10', '2'], B: ['10', '10', '5'], X: ['10', '9'] }, { A: ['comunismo'] });
  H(g, 'B').status = 'bust';
  g.play('A', 'A0', null, t);
  for (const id of ['A', 'B', 'X']) assert.equal(val(g, id), 18); // (12+25+19)/3
  assert.equal(H(g, 'B').status, 'playing', 'revive y todavía juega su turno');
});

test('Caos final: ventana antes del dealer y se pueden encadenar cartas', () => {
  const { g, t } = setup({ X: ['10', '7'] }, { A: ['empujon', 'vidente', 'mantequilla'], B: ['vidente'] });
  g.stand('A', t); g.stand('B', t);
  g.stand('X', t + 100); // nadie pidió carta
  assert.equal(g.phase, 'final');
  assert.equal(g.deadline, t + 100 + 3000);
  g.shoe.push({ k: 'c', r: '9', s: 'h' });
  assert.equal(g.play('A', 'A0', T('X'), t + 2000), null);
  assert.equal(H(g, 'X').status, 'bust');
  assert.equal(g.deadline, t + 2000 + 3000, 'el reloj se reinicia');
  assert.equal(g.play('A', 'A1', null, t + 2500), null, 'segunda carta en cadena');
  assert.equal(g.play('B', 'B0', null, t + 2600), null);
  assert.equal(g.play('A', 'A2', null, t + 2700), null, 'tercera carta en cadena');
  // A ganó 1 carta por el sabotaje del Empujón, así que el reloj sigue en 3 s
  g.tick(t + 2700 + 2900);
  assert.equal(g.phase, 'final');
  g.tick(t + 2700 + 3001);
  assert.equal(g.phase, 'dealer');
});

test('Granada en tu propia mano: de 16 a 21, tu escudo no la rebota', () => {
  const { g, t } = setup({ A: ['10', '6'] }, { A: ['granada5', 'escudo'] });
  assert.equal(g.play('A', 'A0', T('A'), t), null);
  assert.equal(val(g, 'A'), 21);
  assert.equal(g.get('A').actions.length, 1, 'el escudo sigue ahí');
});

test('Pasarte con tu propia granada no te da carta de recompensa', () => {
  const { g, t } = setup({ A: ['10', '8'] }, { A: ['granada10'] });
  g.play('A', 'A0', T('A'), t);
  assert.equal(H(g, 'A').status, 'bust');
  assert.equal(g.get('A').actions.length, 0);
  assert.equal(g.turnId, 'B', 'se acaba su turno');
});

test('Amnesia en ti mismo te revive si te pasaste', () => {
  const { g, t } = setup({ A: ['10', '6', '9'] }, { A: ['amnesia'] });
  H(g, 'A').status = 'bust';
  g.turn = { pid: 'B', h: 0 }; g.hit('B', t);
  assert.equal(g.play('A', 'A0', T('A'), t), null);
  assert.equal(val(g, 'A'), 15); // pierde el 10
  assert.equal(H(g, 'A').status, 'stood');
});

test('Empujón en ti mismo: una carta más aunque ya te plantaste', () => {
  const { g, t } = setup({ A: ['10', '2'] }, { A: ['empujon'] });
  H(g, 'A').status = 'stood';
  g.turn = { pid: 'B', h: 0 }; g.hit('B', t);
  g.shoe.push({ k: 'c', r: '8', s: 'h' });
  assert.equal(g.play('A', 'A0', T('A'), t), null);
  assert.equal(val(g, 'A'), 20);
});

test('Lazo, Espejo y Carterista no se pueden usar en ti mismo', () => {
  const { g, t } = setup({}, { A: ['lazo', 'espejo', 'carterista'] });
  for (const uid of ['A0', 'A1', 'A2']) assert.match(g.play('A', uid, T('A'), t), /inválido/);
});

test('Cada quien elige personaje y no se pueden repetir', () => {
  const g = new Game();
  g.addPlayer('A', 'a', 5);
  g.addPlayer('B', 'b', 5); // ocupado: le toca el primero libre
  assert.equal(g.get('A').skin, 5);
  assert.equal(g.get('B').skin, 0);
  assert.match(g.setSkin('B', 5), /ya lo eligió/);
  assert.equal(g.setSkin('B', 11), null);
  assert.match(g.setSkin('B', 12) || '', /ya lo eligió/, 'fuera de rango');
  g.start(0);
  assert.match(g.setSkin('A', 3), /antes de empezar/);
});

test('Los bancos se reparten al azar en cada partida', () => {
  const orders = new Set();
  for (let s = 1; s <= 30; s++) {
    let seed = s * 7919; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const g = new Game({ rng });
    for (const id of ['A', 'B', 'C', 'D']) g.addPlayer(id, id);
    g.start(0);
    const seats = g.players.map(p => p.seat);
    assert.deepEqual([...seats].sort(), [0, 1, 2, 3], 'cada quien en un banco distinto');
    orders.add(seats.join(''));
  }
  assert.ok(orders.size > 5, 'el orden cambia entre partidas');
});

test('El historial narra las jugadas sin revelar secretos', () => {
  const { g, t } = setup({ B: ['10', '7'] }, { A: ['granada5', 'carterista'], X: ['escudo'] });
  g.get('A').name = 'Ana'; g.get('B').name = 'Beto'; g.get('X').name = 'Xime';
  g.play('A', 'A0', T('B'), t);
  g.play('A', 'A1', T('X'), t);
  const lines = g.view('A', t).log.map(l => l.t);
  assert.ok(lines.includes('Ana juega Granada +5 contra Beto'));
  assert.ok(lines.includes('Beto recibe +5 y queda en 22'));
  assert.ok(lines.includes('Beto se pasa con 22 (sabotaje de Ana)'));
  assert.ok(lines.includes('Ana le roba una carta de acción a Xime'));
  assert.ok(!lines.some(l => /Escudo/.test(l) && /roba/.test(l)), 'no dice qué carta robó');
  assert.ok(g.view('A', t).log.every(l => l.i && l.k), 'cada línea tiene número y tipo');
});

test('Hasta 6 jugadores: el séptimo no entra', () => {
  const g = new Game();
  for (let i = 0; i < 6; i++) assert.strictEqual(g.addPlayer('P' + i, 'P' + i, i), null);
  assert.match(g.addPlayer('P6', 'P6', 6), /llena/);
});

test('Con 4 jugadores se usan los asientos 0-3; con 5 o 6, los asientos 0-5 sin repetir', () => {
  for (const n of [4, 5, 6]) {
    const g = new Game();
    for (let i = 0; i < n; i++) g.addPlayer('P' + i, 'P' + i, i);
    assert.strictEqual(g.start(0), null);
    const seats = g.players.map(p => p.seat);
    assert.strictEqual(new Set(seats).size, n);
    assert.ok(seats.every(s => s >= 0 && s < (n > 4 ? 6 : 4)));
  }
});

test('Salir o ser expulsado en el lobby saca al jugador y avisa con el evento leave', () => {
  const g = new Game();
  g.addPlayer('A', 'Ana', 0); g.addPlayer('B', 'Beto', 1);
  g.drain();
  g.removePlayer('B', true);
  assert.strictEqual(g.players.length, 1);
  const ev = g.drain().find(e => e.type === 'leave');
  assert.deepStrictEqual([ev.pid, ev.name, ev.kicked], ['B', 'Beto', true]);
  assert.strictEqual(g.addPlayer('B2', 'Beto', 1), null); // puede volver a entrar
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Rooms } from '../server/rooms.js';

const sample = {
  id: 'sample',
  create: () => ({ moves: [], result: null }),
  act: (g, slot, a) => { if (a?.type === 'boom') { g.result = { winner: slot, message: 'boom' }; return { ok: true }; } if (a?.type === 'move') { g.moves.push(slot); return { ok: true }; } return { ok: false, code: 'MOVE' }; },
  view: g => ({ moves: g.moves, result: g.result }),
};

function setup(countdownMs = 0) {
  let now = 10000;
  const rooms = new Rooms({ engines: { sample }, clock: () => now, countdownMs, onSave: () => {} });
  return { rooms, advance: ms => { now += ms; }, now: () => now };
}

test('create join full and identity resume', () => {
  const { rooms } = setup();
  const a = rooms.handle('a', 'create', { name: '桃', gameId: 'sample' });
  assert.equal(a.ok, true);
  const b = rooms.handle('b', 'join', { name: '荷', code: a.code });
  assert.equal(b.player, 1);
  const c = rooms.handle('c', 'join', { name: '第三人', code: a.code });
  assert.equal(c.code, 'FULL');
  rooms.disconnect('a');
  const resumed = rooms.handle('a2', 'resume', { token: a.token });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.player, 0);
  assert.equal(rooms.handle('x', 'resume', { token: 'nope' }).code, 'SESSION');
});

test('countdown gates actions and duplicate seq is rejected', () => {
  const { rooms, advance } = setup(3000);
  const a = rooms.handle('a', 'create', { name: '桃', gameId: 'sample' });
  rooms.handle('b', 'join', { name: '荷', code: a.code });
  rooms.handle('a', 'ready', {}); rooms.handle('b', 'ready', {});
  assert.equal(rooms.snapshot('a').room.phase, 'countdown');
  assert.equal(rooms.handle('a', 'act', { seq: 1, action: { type: 'move' } }).code, 'COUNTDOWN');
  advance(3000); rooms.tick();
  assert.equal(rooms.snapshot('a').room.phase, 'playing');
  assert.equal(rooms.handle('a', 'act', { seq: 1, action: { type: 'move' } }).ok, true);
  assert.equal(rooms.handle('a', 'act', { seq: 1, action: { type: 'move' } }).code, 'DUPLICATE');
  assert.equal(rooms.handle('b', 'act', { seq: 1, action: { type: 'nope' } }).code, 'MOVE');
});

test('finished match records once, rematch resets and disconnect forfeits', () => {
  const { rooms, advance } = setup();
  const a = rooms.handle('a', 'create', { name: '桃', gameId: 'sample' });
  rooms.handle('b', 'join', { name: '荷', code: a.code });
  rooms.handle('a', 'ready', {}); rooms.handle('b', 'ready', {});
  rooms.tick();
  rooms.handle('a', 'act', { seq: 1, action: { type: 'boom' } });
  assert.equal(rooms.snapshot('b').room.phase, 'finished');
  assert.equal(rooms.snapshot('b').room.result.winner, 0);
  assert.equal(rooms.handle('b', 'rematch', {}).ok, true);
  assert.equal(rooms.handle('a', 'rematch', {}).ok, true);
  assert.equal(rooms.snapshot('b').room.phase, 'waiting');
  rooms.handle('a', 'ready', {}); rooms.handle('b', 'ready', {});
  rooms.tick();
  rooms.disconnect('a');
  advance(61000); rooms.tick();
  assert.equal(rooms.snapshot('b').room.result.winner, 1);
});

test('private views never leak the hidden pick', () => {
  const { rooms } = setup();
  const engines = rooms.engines;
  engines.hidden = {
    id: 'hidden',
    create: () => ({ secret: ['x', 'y'], result: null }),
    act: () => ({ ok: true }),
    view: () => ({ public: 1 }),
    privateView: (g, slot) => ({ mine: g.secret[slot] }),
  };
  const a = rooms.handle('a', 'create', { name: '桃', gameId: 'hidden' });
  rooms.handle('b', 'join', { name: '荷', code: a.code });
  rooms.handle('a', 'ready', {}); rooms.handle('b', 'ready', {});
  rooms.tick();
  const va = rooms.snapshot('a').game, vb = rooms.snapshot('b').game;
  assert.equal(va.mine, 'x');
  assert.equal(vb.mine, 'y');
  assert.equal(JSON.stringify(va).includes('"y"'), false);
});

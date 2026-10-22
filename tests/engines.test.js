import test from 'node:test';
import assert from 'node:assert/strict';
import { gomoku } from '../games/gomoku.js';
import { rps } from '../games/rps.js';
import { reversi } from '../games/reversi.js';

test('gomoku accepts turns, rejects illegal cells and detects a five', () => {
  const g = gomoku.create();
  assert.equal(gomoku.act(g, 1, { i: 0 }).ok, false);
  assert.equal(gomoku.act(g, 0, { i: 999 }).ok, false);
  assert.equal(gomoku.act(g, 0, { i: 0 }).ok, true);
  assert.equal(gomoku.act(g, 0, { i: 1 }).ok, false);
  const line = [15, 16, 17, 18];
  const spread = [100, 116, 132, 148];
  for (let k = 0; k < 4; k++) {
    gomoku.act(g, 1, { i: spread[k] });
    gomoku.act(g, 0, { i: line[k] });
  }
  gomoku.act(g, 1, { i: 200 });
  const win = gomoku.act(g, 0, { i: 19 });
  assert.equal(win.ok, true);
  assert.equal(g.result.winner, 0);
  assert.equal(gomoku.act(g, 1, { i: 200 }).ok, false);
});

test('rps hides the opponent pick until both commit and ends at three', () => {
  let now = 1000;
  const g = rps.create(1, 0, now);
  assert.equal(rps.act(g, 0, { type: 'pick', choice: 0 }, now).ok, true);
  assert.equal(rps.view(g, 1).reveal, null);
  assert.equal(rps.privateView(g, 1).mine, null);
  assert.equal(rps.act(g, 0, { type: 'pick', choice: 1 }, now).code, 'LOCKED');
  assert.equal(rps.act(g, 1, { type: 'pick', choice: 1 }, now).ok, true);
  assert.equal(rps.view(g, 1).reveal.winner, 0);
  assert.deepEqual(rps.view(g, 0).scores, [1, 0]);
  for (let round = 0; round < 2; round++) {
    now += 5000; rps.tick(g, now);
    rps.act(g, 0, { type: 'pick', choice: 0 }, now); rps.act(g, 1, { type: 'pick', choice: 1 }, now);
  }
  assert.equal(g.result.winner, 0);
});

test('reversi flips captured rows and only shows legal cells to the mover', () => {
  const g = reversi.create();
  assert.equal(reversi.act(g, 1, { i: 0 }).ok, false);
  assert.equal(reversi.act(g, 0, { i: 20 }).ok, true);
  assert.equal(g.board[28], 0);
  assert.equal(reversi.view(g, 0).legal.length, 0);
  assert.deepEqual(reversi.view(g, 1).legal, [19, 21, 37]);
  assert.equal(reversi.act(g, 1, { i: 19 }).ok, true);
  assert.equal(g.board[27], 1);
  assert.equal(reversi.view(g, 0).legal.length > 0, true);
});

test('reversi auto-passes a stuck player and scores a constructed endgame', () => {
  const g = reversi.create();
  g.board = new Array(64).fill(0);
  g.board[1] = 1; g.board[10] = 1; g.board[0] = -1; g.board[9] = -1;
  g.turn = 0; g.passes = 0; g.result = null;
  assert.equal(reversi.act(g, 0, { i: 0 }).ok, true);
  assert.equal(g.board[1], 0);
  assert.equal(reversi.view(g, 1).legal.length, 0);
  assert.equal(reversi.view(g, 0).legal.length, 1);
  assert.equal(reversi.act(g, 1, { i: 9 }).code, 'TURN');
  assert.equal(reversi.act(g, 0, { i: 9 }).ok, true);
  assert.equal(g.result.winner, 0);
  assert.equal(g.result.message, '终局 64:0');
  assert.equal(reversi.act(g, 0, { i: 0 }).code, 'OVER');
});

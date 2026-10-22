const SIZE = 8;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export const reversi = {
  id: 'reversi',
  create() {
    const board = new Array(64).fill(-1);
    board[27] = 0; board[36] = 0; board[28] = 1; board[35] = 1;
    return { board, turn: 0, passes: 0, result: null };
  },
  act(g, slot, a) {
    if (g.result) return { ok: false, code: 'OVER' };
    if (slot !== g.turn) return { ok: false, code: 'TURN' };
    const i = a?.i;
    if (!Number.isInteger(i) || i < 0 || i > 63) return { ok: false, code: 'RANGE' };
    const flips = flipsFor(g.board, i, slot);
    if (!flips.length) return { ok: false, code: 'MOVE' };
    g.board[i] = slot;
    for (const f of flips) g.board[f] = slot;
    g.passes = 0;
    advance(g);
    return { ok: true };
  },
  view(g, slot) {
    return { size: SIZE, board: g.board, turn: g.turn, result: g.result, counts: count(g.board), legal: g.turn === slot ? legalMoves(g.board, slot) : [] };
  },
};

function advance(g) {
  g.turn = 1 - g.turn;
  if (legalMoves(g.board, g.turn).length) return;
  if (legalMoves(g.board, 1 - g.turn).length) { g.turn = 1 - g.turn; g.passes = 1; return; }
  const c = count(g.board);
  const winner = c[0] === c[1] ? -1 : (c[0] > c[1] ? 0 : 1);
  g.result = { winner, message: `终局 ${c[0]}:${c[1]}` };
}

function flipsFor(board, i, slot) {
  if (board[i] !== -1) return [];
  const x = i % SIZE, y = (i / SIZE) | 0, out = [];
  for (const [dx, dy] of DIRS) {
    const line = [];
    let px = x + dx, py = y + dy;
    while (px >= 0 && px < SIZE && py >= 0 && py < SIZE && board[py * SIZE + px] === 1 - slot) { line.push(py * SIZE + px); px += dx; py += dy; }
    if (line.length && px >= 0 && px < SIZE && py >= 0 && py < SIZE && board[py * SIZE + px] === slot) out.push(...line);
  }
  return out;
}

function legalMoves(board, slot) {
  const out = [];
  for (let i = 0; i < 64; i++) if (board[i] === -1 && flipsFor(board, i, slot).length) out.push(i);
  return out;
}

function count(board) {
  const c = [0, 0];
  for (const v of board) if (v === 0 || v === 1) c[v]++;
  return c;
}

const SIZE = 15;
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

export const gomoku = {
  id: 'gomoku',
  create() {
    return { board: new Array(SIZE * SIZE).fill(-1), turn: 0, last: -1, moves: 0, result: null };
  },
  act(g, slot, a) {
    if (g.result) return { ok: false, code: 'OVER' };
    if (slot !== g.turn) return { ok: false, code: 'TURN' };
    const i = a?.i;
    if (!Number.isInteger(i) || i < 0 || i >= SIZE * SIZE) return { ok: false, code: 'RANGE' };
    if (g.board[i] !== -1) return { ok: false, code: 'FILLED' };
    g.board[i] = slot; g.last = i; g.moves++; g.turn = 1 - slot;
    if (winLine(g, i, slot)) g.result = { winner: slot, message: '五子连珠达成' };
    else if (g.moves === SIZE * SIZE) g.result = { winner: -1, message: '棋盘下满，和局' };
    return { ok: true };
  },
  view(g, slot) {
    return { size: SIZE, board: g.board, turn: g.turn, last: g.last, result: g.result };
  },
};

function winLine(g, i, slot) {
  const x = i % SIZE, y = (i / SIZE) | 0;
  for (const [dx, dy] of DIRS) {
    let n = 1;
    for (const s of [1, -1]) {
      let px = x + dx * s, py = y + dy * s;
      while (px >= 0 && px < SIZE && py >= 0 && py < SIZE && g.board[py * SIZE + px] === slot) { n++; px += dx * s; py += dy * s; }
    }
    if (n >= 5) return true;
  }
  return false;
}

const TARGET = 3;
const BEAT = [1, 2, 0];

export const rps = {
  id: 'rps',
  create(seed, startAt, clock) {
    return { round: 1, picks: [null, null], scores: [0, 0], reveal: null, nextAt: 0, result: null, clock };
  },
  act(g, slot, a, now) {
    if (g.result) return { ok: false, code: 'OVER' };
    if (a?.type !== 'pick') return { ok: false, code: 'ACTION' };
    const c = a.choice;
    if (!Number.isInteger(c) || c < 0 || c > 2) return { ok: false, code: 'CHOICE' };
    if (g.picks[slot] !== null) return { ok: false, code: 'LOCKED' };
    g.picks[slot] = c;
    if (g.picks[0] !== null && g.picks[1] !== null) settle(g, now);
    return { ok: true };
  },
  tick(g, now) {
    if (!g.result && g.nextAt && now >= g.nextAt) {
      g.round++; g.picks = [null, null]; g.reveal = null; g.nextAt = 0;
    }
  },
  view(g) {
    const both = g.picks[0] !== null && g.picks[1] !== null;
    return { round: g.round, scores: g.scores, reveal: g.reveal, both, result: g.result, target: TARGET };
  },
  privateView(g, slot) {
    return { mine: g.picks[slot] };
  },
};

function settle(g, now) {
  const [a, b] = g.picks;
  let winner = -1;
  if (a !== b) winner = BEAT[a] === b ? 0 : 1;
  g.reveal = { picks: [a, b], winner };
  if (winner >= 0) g.scores[winner]++;
  if (g.scores[0] >= TARGET || g.scores[1] >= TARGET) {
    const w = g.scores[0] >= TARGET ? 0 : 1;
    g.result = { winner: w, message: `先抢三局：${g.scores[0]}:${g.scores[1]}` };
  } else {
    g.nextAt = (now || 0) + 2200;
  }
}

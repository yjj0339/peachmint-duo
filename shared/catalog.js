export const GAMES = [
  { id: 'gomoku', name: '五子连珠', tag: '策略棋盘', blurb: '十五路棋盘，先连成五子的人赢。', minutes: '3-8 分钟', hue: 'peach' },
  { id: 'rps', name: '猜拳抢三', tag: '轻松互动', blurb: '同时出拳，先抢下三局的人赢。', minutes: '1 分钟', hue: 'mint' },
  { id: 'reversi', name: '翻转黑白', tag: '策略棋盘', blurb: '夹住就翻面，终局子多者胜。', minutes: '3-6 分钟', hue: 'lilac' },
];
export const gameById = id => GAMES.find(g => g.id === id) || null;

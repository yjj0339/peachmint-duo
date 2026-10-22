import { connect, resolveServer } from './net.js';
import { VIEWS, ICONS } from './views/games.js';
import { GAMES } from './shared/catalog.js';

const app = document.getElementById('app');
const overlay = document.getElementById('overlay');
const badge = document.getElementById('net-badge');
const badgeText = document.getElementById('net-text');

const state = { net: null, server: resolveServer(), nickname: localStorage.getItem('pm-nick') || '', gameId: 'gomoku', view: null, token: null, phase: 'lobby' };

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function setBadge(kind, text) {
  badge.className = 'net ' + kind;
  badgeText.textContent = text;
}

async function boot() {
  if (!state.server) { askServer(); return; }
  setBadge('', '连接中');
  try {
    state.net = await connect(state.server);
  } catch { setBadge('bad', '服务不可用'); askServer(); return; }
  state.net.on(kind => {
    if (kind === 'connect') { setBadge('ok', '对战服务在线'); if (state.token) state.net.req('resume', { token: state.token }).then(res => { if (res.ok) state.net.seq = res.nextSeq - 1; }); }
    if (kind === 'disconnect') setBadge('bad', '连接断开，重连中');
  });
  state.net.on((kind, snap) => { if (kind === 'snapshot' && snap) renderRoom(snap); });
  setBadge(state.net.connected ? 'ok' : '', state.net.connected ? '对战服务在线' : '连接中');
  renderLobby();
}

function askServer() {
  overlay.hidden = false;
  overlay.innerHTML = '';
  const panel = el('div', 'panel');
  panel.appendChild(el('h2', null, '连接对战服务'));
  panel.appendChild(el('p', 'muted', '本页是纯前端，需要一台运行中的对战服务。输入服务地址（例如 http://127.0.0.1:4412 或房主给的公网地址）。'));
  const input = el('input', 'input');
  input.value = state.server || 'http://127.0.0.1:4412';
  const btn = el('button', 'btn primary', '连接');
  btn.addEventListener('click', () => {
    state.server = input.value.trim().replace(/\/$/, '');
    localStorage.setItem('pm-server', state.server);
    overlay.hidden = true;
    boot();
  });
  panel.append(input, el('div', null, ''), btn);
  overlay.appendChild(panel);
}

function renderLobby() {
  state.phase = 'lobby';
  state.roomKey = null;
  app.innerHTML = '';
  const hero = el('section', 'panel hero');
  const left = el('div');
  const h1 = el('h1');
  h1.append('两个人，', el('em', null, '刚刚好'), '。');
  left.appendChild(h1);
  left.appendChild(el('p', null, '三款双人小游戏，服务端裁判，手机电脑都能玩。创建房间，把房间码或链接发给对方即可开局。'));
  const nickField = el('div', 'field');
  nickField.appendChild(el('label', null, '你的昵称'));
  const nick = el('input', 'input');
  nick.placeholder = '给自己起个名字';
  nick.value = state.nickname;
  nick.addEventListener('input', () => { state.nickname = nick.value.slice(0, 16); localStorage.setItem('pm-nick', state.nickname); });
  nickField.appendChild(nick);
  left.appendChild(nickField);
  const actions = el('div', 'row');
  const createBtn = el('button', 'btn primary', '创建房间');
  createBtn.addEventListener('click', () => startCreate());
  actions.appendChild(createBtn);
  const joinWrap = el('div', 'row');
  const codeInput = el('input', 'input');
  codeInput.placeholder = '六位房间码';
  codeInput.style.width = '150px';
  const joinBtn = el('button', 'btn mint', '加入');
  joinBtn.addEventListener('click', () => startJoin(codeInput.value));
  joinWrap.append(codeInput, joinBtn);
  actions.appendChild(joinWrap);
  left.appendChild(actions);
  hero.appendChild(left);
  const art = el('div', 'hero-art');
  art.innerHTML = '<svg viewBox="0 0 220 140" width="260" aria-hidden="true"><rect x="18" y="18" width="120" height="104" rx="18" fill="#fff" stroke="#F0E7DA"/><g stroke="#EFE3D0"><path d="M42 18v104M66 18v104M90 18v104M114 18v104M18 44h120M18 70h120M18 96h120"/></g><circle cx="66" cy="44" r="10" fill="#FF7A5C"/><circle cx="90" cy="70" r="10" fill="#17B890"/><circle cx="114" cy="96" r="10" fill="#FF7A5C"/><circle cx="176" cy="46" r="26" fill="#FFE7E0"/><circle cx="176" cy="98" r="26" fill="#D8F5EC"/><path d="M166 46l8 8 12-14" stroke="#FF7A5C" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M166 98h20M166 108h14" stroke="#17B890" stroke-width="5" stroke-linecap="round"/></svg>';
  hero.appendChild(art);
  app.appendChild(hero);

  const listHead = el('h2', null, '今天玩什么？');
  app.appendChild(listHead);
  const grid = el('div', 'games');
  for (const game of GAMES) {
    const card = el('div', 'card' + (game.id === state.gameId ? ' sel' : ''));
    card.dataset.game = game.id;
    const icon = el('div');
    icon.innerHTML = ICONS[game.id];
    card.appendChild(icon);
    card.appendChild(el('span', 'tag', game.tag));
    card.appendChild(el('h3', null, game.name));
    card.appendChild(el('p', null, game.blurb));
    card.appendChild(el('span', 'muted', game.minutes));
    card.addEventListener('click', () => { state.gameId = game.id; renderLobby(); });
    grid.appendChild(card);
  }
  app.appendChild(grid);
}

async function startCreate() {
  if (!state.nickname) { state.nickname = '玩家' + Math.floor(Math.random() * 90 + 10); }
  const res = await state.net.req('create', { name: state.nickname, gameId: state.gameId });
  if (!res.ok) return flash(res.message);
  state.token = res.token;
  state.phase = 'room';
}

async function startJoin(code) {
  if (!state.nickname) { state.nickname = '玩家' + Math.floor(Math.random() * 90 + 10); }
  const res = await state.net.req('join', { name: state.nickname, code: code.trim().toUpperCase() });
  if (!res.ok) return flash(res.message);
  state.token = res.token;
  state.phase = 'room';
}

let flashTimer = 0;
function flash(message) {
  const line = app.querySelector('.status-line');
  if (line) line.textContent = message;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { if (state.net?.snapshot) renderRoom(state.net.snapshot); }, 2600);
}

function renderRoom(snap) {
  if (state.phase === 'lobby') state.phase = 'room';
  const room = snap.room;
  const key = `${room.code}|${room.phase}|${room.players.length}|${room.players.map(p => p.ready + (p.connected ? 1 : 0)).join('')}|${snap.you}`;
  if (state.roomKey === key && state.view && app.querySelector('.status-line')) {
    if (snap.game) state.view.handle.update(snap.game, { you: snap.you });
    return;
  }
  state.roomKey = key;
  state.view?.handle?.destroy();
  state.view = null;
  app.innerHTML = '';
  const head = el('div', 'room-head');
  const title = el('h2', null, GAMES.find(g => g.id === room.gameId)?.name || room.gameId);
  head.appendChild(title);
  const chip = el('span', 'code-chip', room.code);
  chip.title = '点击复制邀请链接';
  chip.style.cursor = 'pointer';
  chip.addEventListener('click', () => {
    const link = `${location.origin}${location.pathname}?server=${encodeURIComponent(state.server)}&room=${room.code}`;
    navigator.clipboard?.writeText(link);
    flash('邀请链接已复制');
  });
  head.appendChild(chip);
  app.appendChild(head);

  const seats = el('div', 'seats');
  room.players.forEach((p, i) => {
    const seat = el('div', 'seat ' + (i === snap.you ? 'me' : 'them'));
    seat.appendChild(el('div', 'who', p.name));
    seat.appendChild(el('div', 'st', p.connected ? (p.ready ? '已准备' : '未准备') : '离线'));
    seats.appendChild(seat);
    if (i === 0) seats.appendChild(el('div', 'vs', 'VS'));
  });
  if (room.players.length < 2) seats.appendChild(el('div', 'seat', '等待搭档…'));
  app.appendChild(seats);

  const status = el('div', 'status-line');
  if (room.phase === 'waiting') status.textContent = room.players.length < 2 ? '把房间码或邀请链接发给搭档，两人到齐后各自点准备。' : '双方点击准备后，3 秒同步开局。';
  if (room.phase === 'countdown') status.textContent = '双方就位，马上开局…';
  if (room.phase === 'playing') status.textContent = snap.you === 0 ? '你是蜜桃粉一方。' : '你是薄荷绿一方。';
  if (room.phase === 'finished') status.textContent = room.result?.message || '本局结束';
  app.appendChild(status);

  if (room.phase === 'waiting') {
    const row = el('div', 'row');
    const readyBtn = el('button', 'btn mint', room.players[snap.you]?.ready ? '取消准备' : '准备');
    readyBtn.addEventListener('click', () => state.net.req('ready', { ready: !room.players[snap.you]?.ready }));
    row.appendChild(readyBtn);
    app.appendChild(row);
  }

  const stage = el('div', 'panel');
  stage.style.marginTop = '14px';
  app.appendChild(stage);

  if (snap.game && room.phase !== 'waiting') {
    const viewKey = room.gameId;
    if (!state.view || state.view.key !== viewKey) {
      state.view?.handle?.destroy();
      const built = VIEWS[viewKey].mount(stage, action => state.net.act(action).then(res => { if (!res.ok) flash(res.message); }));
      state.view = { key: viewKey, handle: built };
    }
    state.view.handle.update(snap.game, { you: snap.you });
  } else {
    stage.appendChild(el('p', 'muted', '开局后这里显示棋盘。'));
  }

  if (room.phase === 'finished') showResult(room);
}

function showResult(room) {
  const box = el('div', 'result');
  const panel = el('div', 'panel');
  const win = room.result?.winner;
  panel.appendChild(el('h2', null, win === -1 ? '和局' : (win === state.net.snapshot.you ? '你赢了' : '对方赢了')));
  panel.appendChild(el('p', null, room.result?.message || ''));
  const row = el('div', 'row');
  row.style.justifyContent = 'center';
  const again = el('button', 'btn primary', '再来一局');
  again.addEventListener('click', () => { state.net.req('rematch'); document.querySelector('.result')?.remove(); });
  const lobby = el('button', 'btn ghost', '回大厅');
  lobby.addEventListener('click', () => { state.token = null; state.phase = 'lobby'; document.querySelector('.result')?.remove(); renderLobby(); });
  row.append(again, lobby);
  panel.appendChild(row);
  box.appendChild(panel);
  document.querySelector('.result')?.remove();
  document.body.appendChild(box);
}

boot();

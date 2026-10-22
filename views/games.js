const ICONS = {
  gomoku: '<svg viewBox="0 0 120 60" aria-hidden="true"><rect x="8" y="6" width="104" height="48" rx="10" fill="#FFF7EC" stroke="#EBDCC6"/><g stroke="#E4D2B8"><path d="M20 6v48M40 6v48M60 6v48M80 6v48M100 6v48M8 18h104M8 30h104M8 42h104"/></g><circle cx="40" cy="18" r="7" fill="#FF7A5C"/><circle cx="60" cy="30" r="7" fill="#17B890"/><circle cx="80" cy="42" r="7" fill="#FF7A5C"/></svg>',
  rps: '<svg viewBox="0 0 120 60" aria-hidden="true"><circle cx="34" cy="30" r="20" fill="#FFE7E0"/><circle cx="86" cy="30" r="20" fill="#D8F5EC"/><path d="M27 30l5 5 9-10" stroke="#FF7A5C" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M79 24h14M79 32h10" stroke="#17B890" stroke-width="4" stroke-linecap="round"/></svg>',
  reversi: '<svg viewBox="0 0 120 60" aria-hidden="true"><rect x="18" y="6" width="84" height="48" rx="10" fill="#F0FBF7" stroke="#CFEADF"/><circle cx="42" cy="22" r="8" fill="#2A2F36"/><circle cx="62" cy="22" r="8" fill="#fff" stroke="#D7DDE4"/><circle cx="42" cy="40" r="8" fill="#fff" stroke="#D7DDE4"/><circle cx="62" cy="40" r="8" fill="#2A2F36"/><path d="M84 22a10 10 0 0 1 0 18" stroke="#8F7BD8" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
};

export function gomokuView() {
  let root, send, cells = [];
  function mount(el, sendFn) {
    root = el; send = sendFn;
    root.innerHTML = '<div class="board-wrap"><div class="board" style="grid-template-columns:repeat(15,var(--cs,30px))"></div></div>';
    const board = root.querySelector('.board');
    for (let i = 0; i < 225; i++) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.type = 'button';
      cell.addEventListener('click', () => send({ type: 'place', i }));
      board.appendChild(cell);
      cells.push(cell);
    }
    return { update, destroy };
  }
  function update(view, ctx) {
    for (let i = 0; i < 225; i++) {
      const cell = cells[i];
      const v = view.board[i];
      cell.innerHTML = v >= 0 ? `<span class="stone p${v}"></span>` : '';
      cell.classList.toggle('last', view.last === i);
      cell.setAttribute('aria-label', `第${(i / 15 | 0) + 1}行${(i % 15) + 1}列`);
    }
  }
  function destroy() { cells = []; root = null; }
  return { mount };
}

export function rpsView() {
  let root, send, picked = null;
  const HANDS = ['✊', '️', '✋'];
  function mount(el, sendFn) {
    root = el; send = sendFn;
    root.innerHTML = `
      <div class="score-bar"><span class="score p0" data-s0>0</span><span class="muted" style="align-self:center">抢三</span><span class="score p1" data-s1>0</span></div>
      <div class="rps-stage"><div class="rps-hand p0" data-mine>✊</div><div class="vs">VS</div><div class="rps-hand p1" data-theirs>❔</div></div>
      <div class="rps-pad">${HANDS.map((h, i) => `<button class="rps-btn" type="button" data-c="${i}">${h}</button>`).join('')}</div>
      <p class="muted" style="text-align:center" data-note>双方同时出拳，出拳后不能更改。</p>`;
    root.querySelectorAll('.rps-btn').forEach(btn => btn.addEventListener('click', () => {
      picked = Number(btn.dataset.c);
      send({ type: 'pick', choice: picked });
    }));
    return { update, destroy };
  }
  function update(view) {
    root.querySelector('[data-s0]').textContent = view.scores[0];
    root.querySelector('[data-s1]').textContent = view.scores[1];
    const mine = root.querySelector('[data-mine]');
    const theirs = root.querySelector('[data-theirs]');
    mine.textContent = view.mine != null ? HANDS[view.mine] : '✊';
    if (view.reveal) {
      mine.textContent = HANDS[view.reveal.picks[0]];
      theirs.textContent = HANDS[view.reveal.picks[1]];
      root.querySelector('[data-note]').textContent = view.reveal.winner < 0 ? '平局，再来一拳' : `这一拳：${view.reveal.winner === 0 ? '你赢' : '对方赢'}`;
    } else {
      theirs.textContent = view.both ? '…' : '❔';
      root.querySelector('[data-note]').textContent = view.mine != null ? '已出拳，等对方…' : '双方同时出拳，出拳后不能更改。';
    }
    root.querySelectorAll('.rps-btn').forEach(btn => btn.classList.toggle('picked', view.mine === Number(btn.dataset.c)));
  }
  function destroy() { root = null; picked = null; }
  return { mount };
}

export function reversiView() {
  let root, send, cells = [];
  function mount(el, sendFn) {
    root = el; send = sendFn;
    root.innerHTML = `
      <div class="score-bar"><span class="score p0" data-c0>2</span><span class="muted" style="align-self:center">子数</span><span class="score p1" data-c1>2</span></div>
      <div class="board-wrap"><div class="board" style="grid-template-columns:repeat(8,calc(var(--cs,30px)*1.9))"></div></div>`;
    const board = root.querySelector('.board');
    for (let i = 0; i < 64; i++) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.style.setProperty('--cs', 'calc(var(--cs,30px)*1.9)');
      cell.type = 'button';
      cell.addEventListener('click', () => send({ type: 'place', i }));
      board.appendChild(cell);
      cells.push(cell);
    }
    return { update, destroy };
  }
  function update(view) {
    root.querySelector('[data-c0]').textContent = view.counts[0];
    root.querySelector('[data-c1]').textContent = view.counts[1];
    const legal = new Set(view.legal);
    for (let i = 0; i < 64; i++) {
      const cell = cells[i];
      const v = view.board[i];
      cell.innerHTML = v >= 0 ? `<span class="stone p${v}"></span>` : '';
      cell.classList.toggle('hint', legal.has(i));
    }
  }
  function destroy() { cells = []; root = null; }
  return { mount };
}

export const VIEWS = { gomoku: gomokuView(), rps: rpsView(), reversi: reversiView() };
export { ICONS };

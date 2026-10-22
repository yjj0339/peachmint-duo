import { randomInt } from 'node:crypto';

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export class Rooms {
  constructor({ engines, clock = () => Date.now(), countdownMs = 3000, graceMs = 60000, onSave } = {}) {
    this.engines = engines;
    this.clock = clock;
    this.countdownMs = countdownMs;
    this.graceMs = graceMs;
    this.onSave = onSave || (() => {});
    this.rooms = new Map();
    this.tokens = new Map();
    this.conns = new Map();
  }

  handle(connId, event, payload = {}) {
    const now = this.clock();
    if (event === 'create') return this.create(connId, payload, now);
    if (event === 'join') return this.join(connId, payload, now);
    if (event === 'resume') return this.resume(connId, payload, now);
    const link = this.conns.get(connId);
    if (!link) return fail('请先创建或加入房间', 'SESSION');
    const { room, slot } = link;
    const player = room.players[slot];
    if (event === 'ready') {
      if (room.phase !== 'waiting') return fail('房间不在等待状态', 'PHASE');
      player.ready = payload.ready !== false;
      this.maybeStart(room, now);
      return { ok: true };
    }
    if (event === 'act') {
      const seq = payload.seq;
      if (!Number.isInteger(seq)) return fail('序号无效', 'SEQ');
      if (seq <= player.seq) return fail('重复的操作', 'DUPLICATE');
      if (room.phase === 'countdown') return fail('双方就位，马上开局', 'COUNTDOWN');
      if (room.phase !== 'playing') return fail('对局未在进行中', 'PHASE');
      player.seq = seq;
      const engine = this.engines[room.gameId];
      const res = engine.act(room.state, slot, payload.action, now);
      if (!res.ok) return fail(res.message || '这个操作不被允许', res.code || 'MOVE');
      const over = engine.over ? engine.over(room.state) : room.state.result;
      if (over) this.finish(room, over.winner, over.message, now);
      return { ok: true };
    }
    if (event === 'rematch') {
      if (room.phase === 'waiting' && room.finishedOnce) return { ok: true };
      if (room.phase !== 'finished') return fail('本局尚未结束', 'PHASE');
      room.phase = 'waiting';
      room.state = null;
      room.recorded = false;
      for (const p of room.players) { p.ready = false; p.seq = 0; }
      return { ok: true };
    }
    if (event === 'presence') {
      player.active = payload.active !== false;
      return { ok: true };
    }
    if (event === 'leave') {
      this.removeLink(connId);
      return { ok: true };
    }
    return fail('未知事件', 'EVENT');
  }

  create(connId, payload, now) {
    const name = cleanName(payload.name);
    if (!name) return fail('昵称不能为空', 'NAME');
    const gameId = this.engines[payload.gameId] ? payload.gameId : Object.keys(this.engines)[0];
    const room = {
      code: this.freeCode(), gameId, phase: 'waiting', players: [], state: null,
      startedAt: 0, finishedAt: 0, recorded: false, touchedAt: now,
    };
    this.rooms.set(room.code, room);
    this.attach(room, 0, name, connId, now);
    return { ok: true, code: room.code, token: room.players[0].token, player: 0 };
  }

  join(connId, payload, now) {
    const room = this.rooms.get(String(payload.code || '').toUpperCase());
    if (!room) return fail('房间不存在', 'ROOM');
    if (room.players.length >= 2) return fail('房间已满员', 'FULL');
    const name = cleanName(payload.name);
    if (!name) return fail('昵称不能为空', 'NAME');
    this.attach(room, 1, name, connId, now);
    return { ok: true, code: room.code, token: room.players[1].token, player: 1 };
  }

  resume(connId, payload, now) {
    const link = this.tokens.get(String(payload.token || ''));
    if (!link || !this.rooms.has(link.room.code)) return fail('会话已失效', 'SESSION');
    const old = link.player.conn;
    if (old && old !== connId) this.conns.delete(old);
    link.player.conn = connId;
    link.player.connected = true;
    link.player.disconnectedAt = 0;
    this.conns.set(connId, link);
    link.room.touchedAt = now;
    return { ok: true, code: link.room.code, player: link.slot, nextSeq: link.player.seq + 1 };
  }

  attach(room, slot, name, connId, now) {
    const player = { name, conn: connId, token: token(), seq: 0, connected: true, active: true, ready: false, disconnectedAt: 0 };
    room.players[slot] = player;
    const link = { room, slot, player };
    this.conns.set(connId, link);
    this.tokens.set(player.token, link);
    room.touchedAt = now;
  }

  removeLink(connId) {
    const link = this.conns.get(connId);
    if (!link) return;
    this.conns.delete(connId);
    link.player.connected = false;
    link.player.disconnectedAt = this.clock();
    link.room.touchedAt = this.clock();
  }

  disconnect(connId) { this.removeLink(connId); }

  maybeStart(room, now) {
    if (room.phase !== 'waiting') return;
    if (room.players.length < 2) return;
    if (!room.players.every(p => p.connected && p.ready)) return;
    room.finishedOnce = false;
    room.state = this.engines[room.gameId].create(randomInt(1, 0xffffffff), now + this.countdownMs, now);
    room.phase = 'countdown';
    room.startedAt = now + this.countdownMs;
    room.touchedAt = now;
  }

  finish(room, winner, message, now) {
    room.phase = 'finished';
    room.finishedOnce = true;
    room.finishedAt = now;
    room.result = { winner, message };
    room.touchedAt = now;
    if (!room.recorded) {
      room.recorded = true;
      this.onSave({ code: room.code, gameId: room.gameId, winner, message, at: now, players: room.players.map(p => p.name) });
    }
  }

  tick() {
    const now = this.clock();
    for (const [code, room] of this.rooms) {
      if (room.phase === 'countdown' && now >= room.startedAt) { room.phase = 'playing'; room.touchedAt = now; }
      if (room.phase === 'playing') {
        const engine = this.engines[room.gameId];
        engine.tick?.(room.state, now);
        const over = engine.over ? engine.over(room.state) : room.state.result;
        if (over) this.finish(room, over.winner, over.message, now);
        for (const [slot, p] of room.players.entries()) {
          if (!p.connected && p.disconnectedAt && now - p.disconnectedAt > this.graceMs) {
            this.finish(room, 1 - slot, '对方离开超过时限', now);
          }
        }
      }
      const empty = room.players.every(p => !p.connected);
      if (empty && now - room.touchedAt > 3600000) this.rooms.delete(code);
    }
  }

  snapshot(connId) {
    const link = this.conns.get(connId);
    if (!link) return null;
    const { room, slot } = link;
    const engine = this.engines[room.gameId];
    const game = room.state ? mergeViews(engine, room.state, slot) : null;
    return {
      you: slot,
      serverNow: this.clock(),
      room: {
        code: room.code, gameId: room.gameId, phase: room.phase, startedAt: room.startedAt,
        result: room.result || null,
        players: room.players.map(p => ({ name: p.name, connected: p.connected, ready: p.ready })),
      },
      game,
    };
  }

  freeCode() {
    let code;
    do { code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(''); } while (this.rooms.has(code));
    return code;
  }
}

function mergeViews(engine, state, slot) {
  const base = engine.view(state, slot);
  return engine.privateView ? { ...base, ...engine.privateView(state, slot) } : base;
}

function cleanName(raw) {
  const name = String(raw ?? '').trim().slice(0, 16);
  return name;
}

function token() {
  return Array.from({ length: 24 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

function fail(message, code) { return { ok: false, message, code }; }

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { Server } from 'socket.io';
import { Rooms } from './rooms.js';
import { gomoku } from '../games/gomoku.js';
import { rps } from '../games/rps.js';
import { reversi } from '../games/reversi.js';
import { GAMES } from '../client/shared/catalog.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(root, '..', 'client');
const PORT = Number(process.env.PORT || 4412);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon' };

export function createApp({ persist = true } = {}) {
  const dataDir = path.join(root, '..', 'runtime', 'data');
  if (persist && !existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const db = persist ? new DatabaseSync(path.join(dataDir, 'matches.sqlite')) : null;
  db?.exec('CREATE TABLE IF NOT EXISTS matches(id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, game TEXT, winner INTEGER, message TEXT, players TEXT, at INTEGER)');

  const rooms = new Rooms({
    engines: { gomoku, rps, reversi },
    onSave: record => {
      db?.prepare('INSERT INTO matches(code, game, winner, message, players, at) VALUES (?,?,?,?,?,?)')
        .run(record.code, record.gameId, record.winner, record.message, JSON.stringify(record.players), record.at);
    },
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    if (url.pathname === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, name: 'PEACHMINT', games: GAMES.length, rooms: rooms.rooms.size, now: Date.now() }));
      return;
    }
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!/^[a-z0-9/._-]+$/i.test(file)) { res.statusCode = 404; res.end('nope'); return; }
    const baseDir = clientDir;
    const target = path.join(baseDir, file);
    if (!target.startsWith(baseDir)) { res.statusCode = 404; res.end('nope'); return; }
    try {
      const body = await readFile(target);
      res.setHeader('Content-Type', MIME[path.extname(target)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(body);
    } catch { res.statusCode = 404; res.end('nope'); }
  });

  const io = new Server(server, { cors: { origin: true } });
  io.on('connection', socket => {
    for (const event of ['create', 'join', 'resume', 'ready', 'act', 'rematch', 'presence', 'leave']) {
      socket.on(event, (payload, ack) => {
        let result;
        try { result = rooms.handle(socket.id, event, payload || {}); } catch { result = { ok: false, message: '请求未完成', code: 'INTERNAL' }; }
        if (typeof ack === 'function') ack(result);
        publish(rooms, io, socket.id);
      });
    }
    socket.on('disconnect', () => { rooms.disconnect(socket.id); publish(rooms, io, socket.id); });
  });

  const timer = setInterval(() => { rooms.tick(); broadcastAll(rooms, io); }, 250);
  const close = () => new Promise(resolve => { clearInterval(timer); io.close(); server.close(resolve); });
  return { server, io, rooms, listen: port => new Promise(resolve => server.listen(port, () => resolve({ port: server.address().port }))), close };
}

function publish(rooms, io, connId) {
  const link = rooms.conns.get(connId);
  if (!link) return;
  for (const [slot, player] of link.room.players.entries()) {
    const target = player.conn && io.sockets.sockets.get(player.conn);
    if (target) target.emit('snapshot', rooms.snapshot(player.conn));
  }
}

function broadcastAll(rooms, io) {
  for (const connId of rooms.conns.keys()) {
    const target = io.sockets.sockets.get(connId);
    if (target) target.emit('snapshot', rooms.snapshot(connId));
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const app = createApp();
  app.listen(PORT).then(({ port }) => console.log(`PEACHMINT ready: http://127.0.0.1:${port}`));
}

let loader = null;
function loadIo(server) {
  if (window.io) return Promise.resolve(window.io);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = server.replace(/\/$/, '') + '/socket.io/socket.io.js';
    script.onload = () => resolve(window.io);
    script.onerror = () => reject(new Error('socket.io client load failed'));
    document.head.appendChild(script);
  });
  return loader;
}

export async function connect(url) {
  const io = await loadIo(url);
  const socket = io(url, { transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1200, timeout: 6000 });
  const net = { socket, url, snapshot: null, connected: false, seq: 0, listeners: new Set() };
  socket.on('connect', () => { net.connected = true; net.listeners.forEach(fn => fn('connect')); });
  socket.on('disconnect', () => { net.connected = false; net.listeners.forEach(fn => fn('disconnect')); });
  socket.on('snapshot', snap => { net.snapshot = snap; net.listeners.forEach(fn => fn('snapshot', snap)); });
  net.on = fn => { net.listeners.add(fn); return () => net.listeners.delete(fn); };
  net.req = (event, payload = {}) => new Promise(resolve => {
    socket.timeout(6000).emit(event, payload, (err, res) => resolve(err ? { ok: false, code: 'TIMEOUT', message: '网络超时，请重试' } : res));
  });
  net.act = action => { net.seq += 1; return net.req('act', { seq: net.seq, action }); };
  return net;
}

export function resolveServer() {
  const param = new URLSearchParams(location.search).get('server');
  if (param) { localStorage.setItem('pm-server', param); return param; }
  const saved = localStorage.getItem('pm-server');
  if (saved) return saved;
  if (/^https?:/.test(location.protocol) && !/github\.io$/.test(location.hostname)) return location.origin;
  return '';
}

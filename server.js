'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { Game } = require('./game');

const PORT = Number(process.env.PORT) || 8767;
const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------- salas ----------
const rooms = new Map(); // code -> { code, game, conns: Map<pid, ws>, tokens: Map<token, pid>, empty: ts }
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() {
  let c;
  do { c = Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); } while (rooms.has(c));
  return c;
}
const newId = () => crypto.randomBytes(4).toString('hex');
const newToken = () => crypto.randomBytes(12).toString('hex');

function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

function broadcast(room, extraEvents) {
  const now = Date.now();
  const events = room.game.drain().concat(extraEvents || []);
  for (const [pid, ws] of room.conns) {
    const mine = events.filter(e => !e.to || e.to === pid);
    send(ws, { t: 'state', code: room.code, host: room.host, you: pid, state: room.game.view(pid, now), events: mine });
  }
}

function attach(ws, room, pid) {
  const old = room.conns.get(pid);
  if (old && old !== ws) { try { old.close(4000, 'reemplazada'); } catch {} }
  room.conns.set(pid, ws);
  ws.room = room; ws.pid = pid;
}

const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    const now = Date.now();

    if (m.t === 'create' || m.t === 'join') {
      if (ws.room) return;
      let room;
      if (m.t === 'create') {
        room = { code: newCode(), game: new Game(), conns: new Map(), tokens: new Map(), host: null };
        rooms.set(room.code, room);
      } else {
        room = rooms.get(String(m.code || '').toUpperCase().trim());
        if (!room) return send(ws, { t: 'error', msg: 'No existe una sala con ese código' });
      }
      // reconexión
      if (m.token && room.tokens.has(m.token)) {
        const pid = room.tokens.get(m.token);
        if (room.game.get(pid)) {
          attach(ws, room, pid);
          room.game.setConnected(pid, true, now);
          send(ws, { t: 'joined', code: room.code, you: pid, token: m.token, host: room.host });
          return broadcast(room);
        }
      }
      const pid = newId();
      const err = room.game.addPlayer(pid, m.name);
      if (err) {
        if (!room.conns.size) rooms.delete(room.code);
        return send(ws, { t: 'error', msg: err });
      }
      const token = newToken();
      room.tokens.set(token, pid);
      if (!room.host) room.host = pid;
      attach(ws, room, pid);
      send(ws, { t: 'joined', code: room.code, you: pid, token, host: room.host });
      return broadcast(room);
    }

    const room = ws.room; if (!room) return;
    const g = room.game, pid = ws.pid;
    let err = null;
    switch (m.t) {
      case 'start':
        if (pid !== room.host) err = 'Solo el anfitrión puede empezar';
        else err = g.start(now);
        break;
      case 'again':
        if (pid !== room.host) err = 'Solo el anfitrión puede reiniciar';
        else err = g.backToLobby();
        break;
      case 'bet': err = g.bet(pid, m.amount, now); break;
      case 'hit': err = g.hit(pid, now); break;
      case 'stand': err = g.stand(pid, now); break;
      case 'double': err = g.double(pid, now); break;
      case 'play': err = g.play(pid, m.uid, m.target, now); break;
      case 'emote': {
        const e = String(m.e || '').slice(0, 12);
        if (now - (ws.lastEmote || 0) < 1200) return;
        ws.lastEmote = now;
        return broadcast(room, [{ type: 'emote', pid, e }]);
      }
      default: return;
    }
    if (err) send(ws, { t: 'error', msg: err });
    broadcast(room);
  });

  ws.on('close', () => {
    const room = ws.room; if (!room) return;
    if (room.conns.get(ws.pid) !== ws) return;
    const pid = ws.pid;
    room.conns.delete(pid);
    room.game.setConnected(pid, false, Date.now());
    if (!room.conns.size) room.empty = Date.now();
    broadcast(room);
    // 15 s de gracia para recargar la página o recuperar el WiFi
    setTimeout(() => {
      if (room.conns.has(pid)) return;
      room.game.removePlayer(pid);
      if (room.host === pid) room.host = [...room.conns.keys()][0] || null;
      broadcast(room);
    }, 15000);
  });
});

// tick del juego y limpieza
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (!room.conns.size) {
      if (now - (room.empty || now) > 10 * 60 * 1000) rooms.delete(room.code);
      continue;
    }
    room.game.tick(now);
    if (room.game.dirty) broadcast(room);
  }
}, 100);
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 15000);

server.listen(PORT, () => console.log(`DumbJack21 escuchando en http://localhost:${PORT}`));

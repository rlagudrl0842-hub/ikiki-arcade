// 아이키키 팀 대항 오락실 — HTTP + WebSocket 서버
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import { openDb } from './db.js';
import { Event, Err, sanitizeSettings, TEAM_COLORS, TEAM_ICONS, defaultPlaylist } from './engine.js';
import { GAME_LIST, GAMES } from './games.js';
import { DEFAULT_QUESTIONS } from './c.js';

// 모든 파일이 저장소 최상위에 있는 구조 (Render: node server.js)
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = ROOT;
// 브라우저에 보내도 되는 파일만 공개 (서버 코드·데이터베이스는 절대 안 보냄)
const PUBLIC_FILES = new Set(['index.html', 'admin.html', 'play.html', 'screen.html', 'style.css', 'admin.css', 'play.css', 'screen.css', 'icon.svg', 'logo.png',
  'admin.js', 'play.js', 'play-games.js', 'screen.js', 'screen-games.js', 'client.js', 'gen.js', 'gen2.js', 'play-n.js', 'screen-n.js', 'play-n2.js', 'screen-n2.js', 'play-motion.js', 'card.js', 'screen-n3.js', 'bgm.js', 'play-n3.js', 'screen-n4.js', 'preview.js', 'ai.js', 'timeplan.js', 'scene3d.js', 'fx.js', 'run3d.js', 'g3d.js', 'tuho3d.js', 'fish3d.js', 'curl3d.js', 'pen3d.js', 'flap3d.js', 'stair3d.js', 'bridge3d.js', 'eggs3d.js', 'bask3d.js', 'arena3d.js', 'x3d.js', 'rope3d.js', 'tower3d.js', 'mug3d.js', 'fruit3d.js', 'ball3d.js', 'fire3d.js', 'dalg3d.js', 'zomb3d.js', 'stage3d.js', 'three-0.160.0.min.js', 'home.js', 'play-old.js', 'play-n4.js', 'screen-n5.js', 'bowl.js', 'ghost.js', 'trackgeo.js', 'athdraw.js', 'play-ath.js', 'screen-ath.js', 'pe2data.js', 'pe2draw.js', 'screen-pe2.js', 'solo.html', 'solo.js', 'solo.css',
  'bgm-g7.mp3', 'bgm-g8.mp3', 'bgm-g1.mp3', 'bgm-g12.mp3', 'bgm-fanfare.mp3']);
const GZ = new Map(); // 압축해 둔 큰 파일
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };

export function createServer(opts = {}) {
  const dbFile = opts.dbFile ?? process.env.DB_FILE ?? path.join(ROOT, 'data', 'arcade.db');
  const db = openDb(dbFile);
  const port = opts.port ?? Number(process.env.PORT || 8080);
  const quiet = opts.quiet ?? false;
  const loginLimit = opts.loginLimit ?? 8; // 1분에 로그인 시도 횟수 (테스트에서만 바꿈)
  const log = (...a) => { if (!quiet) console.log(...a); };

  // ---- 관리자 비밀번호 ----
  let adminPassword = opts.adminPassword ?? process.env.ADMIN_PASSWORD;
  if (adminPassword) db.setKV('admin_hash', hashPw(adminPassword));
  else if (!db.getKV('admin_hash')) {
    adminPassword = crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 8);
    db.setKV('admin_hash', hashPw(adminPassword));
    if (dbFile !== ':memory:') fs.writeFileSync(path.join(path.dirname(dbFile), 'ADMIN_PASSWORD.txt'), `관리자 비밀번호: ${adminPassword}\n(관리자 화면에서 바꿀 수 있어요)\n`);
    log(`🔑 처음 생성된 관리자 비밀번호: ${adminPassword}  (data/ADMIN_PASSWORD.txt 에도 저장됨)`);
  }
  // ---- 마스터 계정 (기존 관리자 비밀번호 = 마스터, 아이디 admin) ----
  const masterHash = db.getKV('admin_hash');
  let master = db.get("SELECT id FROM users WHERE role='master' ORDER BY id LIMIT 1");
  if (!master) {
    db.run("INSERT INTO users(username,name,hash,role,active,created_at) VALUES('admin','번개쌤',?,'master',1,?)", masterHash, Date.now());
    master = db.get("SELECT id FROM users WHERE role='master' ORDER BY id LIMIT 1");
  } else db.run('UPDATE users SET hash=?, active=1 WHERE id=?', masterHash, master.id);
  const MASTER_ID = master.id;
  // 계정이 생기기 전에 만든 행사는 마스터 것
  db.run('UPDATE events SET owner_id=? WHERE owner_id IS NULL', MASTER_ID);

  // ---- 기본 OX 문제 ----
  if (!db.get('SELECT 1 FROM questions LIMIT 1')) db.tx(() => { for (const q of DEFAULT_QUESTIONS) db.run('INSERT INTO questions(age,text,emoji,answer) VALUES(?,?,?,?)', ...q); });

  // ---- 허브 ----
  const events = new Map();
  const sockets = new Map(); // eid -> Set(ws)
  const hub = {
    db,
    send(ws, msg) { if (ws.readyState === 1) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); },
    broadcast(eid, msg) { const s = sockets.get(eid); if (!s) return; const str = JSON.stringify(msg); for (const ws of s) if (ws.readyState === 1) ws.send(str); },
    broadcastScreen(eid, msg) { const s = sockets.get(eid); if (!s) return; const str = JSON.stringify(msg); for (const ws of s) if (ws.readyState === 1 && ws.role !== 'player') ws.send(str); },
  };
  const remotes = new Map(); // 리모컨 1회용 코드
  const getEvent = (eid) => {
    if (events.has(eid)) return events.get(eid);
    const row = db.get('SELECT * FROM events WHERE id=? AND deleted=0', eid);
    if (!row) return null;
    const ev = new Event(hub, row); ev.ownerId = row.owner_id ?? MASTER_ID; events.set(eid, ev); return ev;
  };
  // 강사별 음악 설정(게임별 BGM·음량·빵빠레 길이) 기억 → 새 행사에 자동 적용
  const AUDIO_KEYS = ['bgm', 'bgmVol', 'sfxVol', 'fanfareSec', 'winTrack'];
  const audioPref = (uid) => { try { return JSON.parse(db.getKV('audio:' + uid) || '{}'); } catch { return {}; } };
  const saveAudioPref = (uid, st) => { const o = {}; for (const k of AUDIO_KEYS) if (st[k] != null) o[k] = st[k]; db.setKV('audio:' + uid, JSON.stringify(o)); };
  const newEvent = (user, data) => {
    data = { ...data, settings: { ...audioPref(user.id), ...(data.settings || {}) } };
    const id = Event.create(hub, data);
    db.run('UPDATE events SET owner_id=? WHERE id=?', user.id, id);
    const ev = events.get(id); if (ev) ev.ownerId = user.id;
    return id;
  };
  const removeEvent = (id) => {
    const ev = events.get(id); if (ev) { ev.clearTimer(); ev.stopTicker(); }
    db.run('UPDATE events SET deleted=1 WHERE id=?', id); db.run('DELETE FROM players WHERE event_id=?', id);
    events.delete(id);
    for (const ws of sockets.get(id) || []) ws.close(4004, 'deleted');
  };
  const byCode = (code) => { const row = db.get('SELECT id FROM events WHERE code=? AND deleted=0', String(code || '').toUpperCase().slice(0, 8)); return row ? getEvent(row.id) : null; };

  // ---- 인증 ----
  // 로그인한 강사 (막힌 계정·만료된 로그인은 null)
  const userOf = (tok) => {
    if (!tok || typeof tok !== 'string') return null;
    const s = db.get('SELECT expires_at, user_id FROM sessions WHERE token=?', tok);
    if (!s || s.expires_at <= Date.now()) return null;
    const u = db.get('SELECT id, username, name, role, active FROM users WHERE id=?', s.user_id ?? MASTER_ID);
    return u && u.active ? u : null;
  };
  // 마스터는 모든 행사, 강사는 자기 행사만
  const canEv = (u, ev) => !!u && !!ev && (u.role === 'master' || ev.ownerId === u.id);
  const loginTries = new Map();
  const limited = (key, max, winMs) => {
    const now = Date.now(); const a = (loginTries.get(key) || []).filter((t) => t > now - winMs); a.push(now); loginTries.set(key, a); return a.length > max;
  };

  // ---- HTTP ----
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const ip = req.socket.remoteAddress;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url, ip);
      return serveStatic(req, res, url);
    } catch (e) {
      const code = e instanceof Err ? e.code : 500;
      if (code === 500) console.error(e);
      json(res, code, { error: code === 500 ? '서버 오류가 발생했어요' : e.message });
    }
  });

  function serveStatic(req, res, url) {
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
    if (p === '/') p = '/index.html';
    if (/^\/(join|j)\/?$/i.test(p)) p = '/play.html';
    // 짧은 참가 주소 /j/참가코드 (QR용) → 그 행사 참가 화면으로
    const jm = p.match(/^\/j\/([A-Za-z0-9]{4,8})\/?$/i);
    if (jm) { res.writeHead(302, { Location: `/play.html?e=${jm[1].toUpperCase()}`, 'Cache-Control': 'no-store' }); return res.end(); }
    const name = p.replace(/^\/+/, '');
    if (!PUBLIC_FILES.has(name)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('페이지를 찾을 수 없어요'); }
    const file = path.join(PUB, name);
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('페이지를 찾을 수 없어요'); }
      const ext = path.extname(file);
      // 3D 엔진(Three.js, 버전이 이름에 박힌 큰 파일): 압축해서 보내고 폰에 1년 보관 → 와이파이에서 30명이 받아도 가벼움
      if (name.startsWith('three-')) {
        const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
        const body = gz ? (GZ.get(name) || (GZ.set(name, zlib.gzipSync(fs.readFileSync(file), { level: 9 })), GZ.get(name))) : null;
        res.writeHead(200, { 'Content-Type': MIME[ext], 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Length': gz ? body.length : st.size, ...(gz ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}) });
        return gz ? res.end(body) : fs.createReadStream(file).pipe(res);
      }
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : ext === '.mp3' ? 'public, max-age=604800' : 'public, max-age=60', 'Content-Length': st.size,
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:; media-src 'self' data: blob:; frame-ancestors 'self'",
      });
      fs.createReadStream(file).pipe(res);
    });
  }

  async function api(req, res, url, ip) {
    const parts = url.pathname.split('/').filter(Boolean).slice(1); // after 'api'
    const method = req.method;
    const body = method === 'POST' ? await readBody(req) : {};
    const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
    let user = null;
    const needAdmin = () => { user = userOf(tok); if (!user) throw new Err('관리자 로그인이 필요해요', 401); };
    const needMaster = () => { if (user?.role !== 'master') throw new Err('마스터 계정만 할 수 있어요', 403); };
    const evOr404 = (id) => { const ev = getEvent(id); if (!ev || !canEv(user, ev)) throw new Err('행사를 찾을 수 없어요', 404); return ev; };
    const [a, b, c, d] = parts;

    // 공개 API
    if (a === 'games' && method === 'GET') return json(res, 200, { games: GAME_LIST });
    if (a === 'qr' && method === 'GET') {
      const text = String(url.searchParams.get('text') || '').slice(0, 300);
      if (!/^https?:\/\//i.test(text)) throw new Err('주소 오류');
      if (b === 'png') { const buf = await QRCode.toBuffer(text, { width: 1024, margin: 4, errorCorrectionLevel: 'M' }); res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="ikiki-qr.png"' }); return res.end(buf); }
      // 흰 여백 2칸 + 순수 검정/흰색 + 짧은 주소(칸 수↓) → 같은 크기에서 점이 커져 구형 폰·태블릿도 잘 읽음 (전에는 여백 1칸·남색·긴 주소)
      const svg = await QRCode.toString(text, { type: 'svg', width: 600, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' }); return res.end(svg);
    }
    if (a === 'info' && method === 'GET') return json(res, 200, { lan: lanAddrs().map((h) => `http://${h}:${server.address().port}`) });
    if (a === 'public' && method === 'GET') {
      const ev = byCode(b); if (!ev) throw new Err('참가 코드를 확인해 주세요', 404);
      return json(res, 200, { id: ev.id, code: ev.code, name: ev.name, mode: ev.settings.mode, teamAssign: ev.settings.teamAssign, teams: ev.teams, counts: ev.teamCounts(), phase: ev.phase });
    }
    if (a === 'join' && method === 'POST') {
      // 행사장 와이파이는 수백 명이 같은 공인 IP를 쓰므로 넉넉하게 (분당 600회)
      if (limited('join:' + ip, 600, 60000)) throw new Err('잠시 후 다시 시도해 주세요', 429);
      const ev = byCode(body.code); if (!ev) throw new Err('참가 코드를 확인해 주세요', 404);
      const p = ev.join(body);
      return json(res, 200, { eventId: ev.id, pid: p.id, secret: p.secret, name: p.name, team: p.team });
    }
    // ---- 진행자 폰 리모컨: 관리자 화면이 만든 1회용 코드(2분)로 폰 로그인 ----
    if (a === 'remote' && b === 'claim' && method === 'POST') {
      if (limited('remote:' + ip, 20, 60000)) throw new Err('잠시 후 다시 시도해 주세요', 429);
      const r = remotes.get(String(body.code || '')); remotes.delete(String(body.code || ''));
      if (!r || r.exp < Date.now()) throw new Err('리모컨 QR이 만료됐어요. 진행자 화면에서 다시 열어 주세요', 410);
      const t = crypto.randomBytes(24).toString('base64url');
      db.run('INSERT INTO sessions(token,created_at,expires_at,user_id) VALUES(?,?,?,?)', t, Date.now(), Date.now() + 12 * 3600e3, r.uid);
      return json(res, 200, { token: t, eventId: r.eid });
    }
    // ---- 강사 직접 가입 (마스터가 '가입 받기'를 켰을 때) ----
    const signupOpen = () => db.getKV('signup_open') !== '0';
    if (a === 'signup' && method === 'GET') return json(res, 200, { open: signupOpen() });
    if (a === 'signup' && method === 'POST') {
      if (!signupOpen()) throw new Err('지금은 가입을 받지 않아요. 번개쌤에게 문의해 주세요', 403);
      if (limited('signup:' + ip, 5, 10 * 60000)) throw new Err('가입 시도가 너무 많아요. 10분 뒤에 다시 해 주세요', 429);
      const u = addTeacher(body);
      const t = crypto.randomBytes(24).toString('base64url');
      db.run('INSERT INTO sessions(token,created_at,expires_at,user_id) VALUES(?,?,?,?)', t, Date.now(), Date.now() + 7 * 864e5, u.id);
      return json(res, 200, { token: t, user: { username: u.username, name: u.name, role: u.role } });
    }
    // ---- 참가자 기기 오류 기록 (태블릿 빈 화면 원인 찾기용) · 비밀값 없음: 오류 글·게임·기기 종류·화면 크기만 · IP당 1분 20번
    if (a === 'clog' && method === 'POST') {
      if (!limited('clog:' + ip, 20, 60000)) { const c = (k, n) => String(body[k] ?? '').replace(/[\r\n]+/g, ' ').slice(0, n); console.warn(`[기기오류] ${c('where', 40)} | ${c('game', 20)} | ${c('msg', 300)} | ${c('ua', 160)} | ${c('vp', 20)}`); }
      return json(res, 200, { ok: true });
    }
    if (a === 'login' && method === 'POST') {
      if (limited('login:' + ip, loginLimit, 60000)) throw new Err('로그인 시도가 너무 많아요. 1분 뒤에 다시 해 주세요', 429);
      // 아이디를 비우면 마스터(admin) — 예전 로그인 방식 그대로 쓸 수 있게
      const uname = String(body.username || '').trim().toLowerCase() || 'admin';
      const u = db.get('SELECT * FROM users WHERE username=?', uname);
      if (!u || !verifyPw(String(body.password || ''), u.hash)) { await sleep(400); throw new Err('아이디 또는 비밀번호가 틀렸어요', 401); }
      if (!u.active) throw new Err('사용이 중지된 계정이에요. 마스터에게 문의해 주세요', 403);
      const t = crypto.randomBytes(24).toString('base64url');
      db.run('INSERT INTO sessions(token,created_at,expires_at,user_id) VALUES(?,?,?,?)', t, Date.now(), Date.now() + 7 * 864e5, u.id);
      db.run('DELETE FROM sessions WHERE expires_at<?', Date.now());
      return json(res, 200, { token: t, user: { username: u.username, name: u.name, role: u.role } });
    }

    // ---- 관리자 API ----
    needAdmin();
    if (a === 'logout' && method === 'POST') { db.run('DELETE FROM sessions WHERE token=?', tok); return json(res, 200, { ok: true }); }
    if (a === 'me' && method === 'GET') return json(res, 200, { user: { username: user.username, name: user.name, role: user.role } });
    if (a === 'password' && method === 'POST') {
      const np = String(body.password || '');
      if (np.length < 6) throw new Err('비밀번호는 6자 이상으로 해 주세요');
      const hsh = hashPw(np);
      db.run('UPDATE users SET hash=? WHERE id=?', hsh, user.id);
      if (user.id === MASTER_ID) db.setKV('admin_hash', hsh);
      db.run('DELETE FROM sessions WHERE token<>? AND (user_id=? OR (user_id IS NULL AND ?=?))', tok, user.id, user.id, MASTER_ID);
      return json(res, 200, { ok: true });
    }
    // ---- 강사 계정 관리 (마스터 전용) ----
    if (a === 'users') {
      needMaster();
      if (b === 'signup' && method === 'POST') { db.setKV('signup_open', body.open ? '1' : '0'); return json(res, 200, { ok: true }); }
      if (!b && method === 'GET') {
        return json(res, 200, { signupOpen: signupOpen(), users: db.all("SELECT u.id, u.username, u.name, u.role, u.active, u.created_at, (SELECT COUNT(*) FROM events e WHERE e.owner_id=u.id AND e.deleted=0) events FROM users u ORDER BY u.role='master' DESC, u.id") });
      }
      if (b === 'add' && method === 'POST') { addTeacher(body); return json(res, 200, { ok: true }); }
      const target = db.get('SELECT * FROM users WHERE id=?', Number(b));
      if (!target) throw new Err('계정을 찾을 수 없어요', 404);
      if (target.role === 'master') throw new Err('마스터 계정은 여기서 바꿀 수 없어요');
      if (c === 'password' && method === 'POST') {
        const pw = String(body.password || ''); if (pw.length < 6) throw new Err('비밀번호는 6자 이상으로 해 주세요');
        db.run('UPDATE users SET hash=? WHERE id=?', hashPw(pw), target.id); db.run('DELETE FROM sessions WHERE user_id=?', target.id);
        return json(res, 200, { ok: true });
      }
      if (c === 'active' && method === 'POST') {
        db.run('UPDATE users SET active=? WHERE id=?', body.active ? 1 : 0, target.id);
        if (!body.active) db.run('DELETE FROM sessions WHERE user_id=?', target.id);
        return json(res, 200, { ok: true });
      }
      if (c === 'rename' && method === 'POST') {
        const nm = String(body.name || '').trim().slice(0, 20); if (!nm) throw new Err('이름을 넣어 주세요');
        db.run('UPDATE users SET name=? WHERE id=?', nm, target.id); return json(res, 200, { ok: true });
      }
    }
    if (a === 'questions') {
      if (method === 'POST') needMaster(); // OX 문제는 모든 강사가 같이 쓰므로 마스터만 수정
      if (method === 'GET') return json(res, 200, { questions: db.all('SELECT * FROM questions ORDER BY age, id') });
      if (b === 'save' && method === 'POST') {
        const q = body; const age = ['kid', 'elem', 'adult'].includes(q.age) ? q.age : null;
        const text = String(q.text || '').trim().slice(0, 80); if (!age || !text || ![0, 1].includes(q.answer)) throw new Err('문제를 확인해 주세요');
        const emoji = String(q.emoji || '').slice(0, 8);
        if (q.id) db.run('UPDATE questions SET age=?, text=?, emoji=?, answer=?, active=? WHERE id=?', age, text, emoji, q.answer, q.active === 0 ? 0 : 1, q.id);
        else db.run('INSERT INTO questions(age,text,emoji,answer) VALUES(?,?,?,?)', age, text, emoji, q.answer);
        return json(res, 200, { ok: true });
      }
      if (b === 'delete' && method === 'POST') { db.run('DELETE FROM questions WHERE id=?', Number(body.id)); return json(res, 200, { ok: true }); }
    }
    if (a === 'remote' && !b && method === 'POST') {
      const ev = evOr404(String(body.eventId || ''));
      for (const [k, v] of remotes) if (v.exp < Date.now()) remotes.delete(k);
      const code = crypto.randomBytes(18).toString('base64url');
      remotes.set(code, { uid: user.id, eid: ev.id, exp: Date.now() + 120000 });
      return json(res, 200, { code, expiresIn: 120 });
    }
    // ---- 반별 리그: 같은 리그 이름의 내 행사들 팀 점수 누적 (팀 이름 기준) ----
    if (a === 'league' && method === 'GET') {
      const name = String(url.searchParams.get('name') || '').trim(); if (!name) throw new Err('리그 이름이 없어요');
      const master = user.role === 'master';
      const evs = db.all(`SELECT id, name, created_at, settings FROM events WHERE deleted=0 ${master ? '' : 'AND owner_id=?'} ORDER BY created_at`, ...(master ? [] : [user.id])).filter((e) => { try { const st = JSON.parse(e.settings); return !st.test && (st.league || '') === name; } catch { return false; } });
      const T = new Map(); const list = [];
      for (const e of evs) {
        const teams = db.all('SELECT id, name, icon, color FROM teams WHERE event_id=?', e.id);
        const pts = Object.fromEntries(teams.map((t) => [t.id, 0]));
        for (const r of db.all("SELECT tr.team_id, tr.points FROM team_results tr JOIN runs r ON r.id=tr.run_id WHERE r.event_id=? AND r.status='done'", e.id)) if (pts[r.team_id] != null) pts[r.team_id] += r.points;
        for (const r of db.all('SELECT team_id, delta FROM adjustments WHERE event_id=?', e.id)) if (pts[r.team_id] != null) pts[r.team_id] += r.delta;
        const played = db.get("SELECT COUNT(*) c FROM runs WHERE event_id=? AND status='done'", e.id).c; if (!played) continue;
        const best = Math.max(...Object.values(pts));
        list.push({ id: e.id, name: e.name, at: e.created_at, played });
        for (const t of teams) {
          const k = t.name.trim(); const o = T.get(k) || { name: k, icon: t.icon, color: t.color, total: 0, events: 0, wins: 0 };
          o.total = Math.round((o.total + pts[t.id]) * 10) / 10; o.events++; if (pts[t.id] === best && best > 0) o.wins++; T.set(k, o);
        }
      }
      const rows = [...T.values()].sort((x, y) => y.total - x.total || y.wins - x.wins);
      rows.forEach((r, i) => { const p = rows[i - 1]; r.rank = p && p.total === r.total && p.wins === r.wins ? p.rank : i + 1; });
      return json(res, 200, { name, events: list, rows });
    }
    if (a === 'events' && !b && method === 'GET') {
      const master = user.role === 'master';
      const rows = db.all(`SELECT e.id, e.code, e.name, e.created_at, e.ended_at, e.settings, e.owner_id, u.name owner, (SELECT COUNT(*) FROM players p WHERE p.event_id=e.id) players FROM events e LEFT JOIN users u ON u.id=e.owner_id WHERE e.deleted=0 ${master ? "" : "AND e.owner_id=?"} ORDER BY e.created_at DESC LIMIT 300`, ...(master ? [] : [user.id]));
      // 혼자 테스트·미리보기 행사는 목록에서 빼고, 하루 지난 것은 정리
      const isTest = (r) => { try { return !!JSON.parse(r.settings).test; } catch { return false; } };
      for (const r of rows) if (isTest(r) && Date.now() - r.created_at > 86400000) removeEvent(r.id);
      return json(res, 200, { events: rows.filter((r) => !isTest(r)).map((r) => ({ ...r, mode: JSON.parse(r.settings).mode, settings: undefined, phase: events.get(r.id)?.phase ?? null })) });
    }
    // ---- 🎮 혼자 테스트하기 / 게임 미리보기: 홍팀(나) vs 청팀(컴퓨터) 테스트 행사 (실제 행사 기록과 분리)
    // 게임별 최고 기록 보기 · 초기화(마스터만, 명시적으로 고른 것만)
    if (a === 'records' && method === 'GET' && !b) {
      const rows = db.all('SELECT * FROM records ORDER BY game, mode');
      return json(res, 200, { records: rows.map((r) => ({ ...r, name: GAMES[r.game]?.name || r.game, emoji: GAMES[r.game]?.emoji || '🎮' })) });
    }
    if (a === 'records' && b === 'reset' && method === 'POST') {
      needMaster();
      const g = String(body.game || ''), m = String(body.mode || '');
      if (!g || !m) throw new Err('초기화할 기록을 골라 주세요');
      db.run('DELETE FROM records WHERE game=? AND mode=?', g, m); return json(res, 200, { ok: true });
    }
    if (a === 'solo' && method === 'POST') {
      const list = (Array.isArray(body.games) ? body.games : []).filter((g) => typeof g === 'string' && GAME_LIST.some((x) => x.id === g)).slice(0, 40);
      if (!list.length) throw new Err('테스트할 게임을 골라 주세요');
      const mode = ['baby', 'kid', 'elem', 'mid', 'high', 'adult'].includes(body.mode) ? body.mode : 'elem';
      const dur = (g) => (Number.isInteger(body.dur?.[g]) && body.dur[g] >= 5 && body.dur[g] <= 300 ? { dur: body.dur[g] } : {});
      const id = newEvent(user, { name: body.watch ? '👀 게임 미리보기' : '🎮 혼자 테스트', settings: { test: true, mode, teamCount: 2, teamAssign: 'choose', scoring: 'avg', auto: body.auto !== false, introSec: 6, resultSec: 8, previewSec: 5, voice: false, playlist: list.map((g) => ({ game: g, weight: 1, ...dur(g) })), ...(body.bgm && typeof body.bgm === 'object' ? { bgm: body.bgm } : {}) } });
      const ev = getEvent(id);
      ev.teams[0] = { ...ev.teams[0], name: '홍팀', icon: '🔴', color: '#ff4d6d' }; ev.teams[1] = { ...ev.teams[1], name: '청팀', icon: '🔵', color: '#3d8bff' };
      db.tx(() => { for (const t of ev.teams) db.run('UPDATE teams SET name=?, icon=?, color=? WHERE event_id=? AND id=?', t.name, t.icon, t.color, id, t.id); });
      return json(res, 200, { id, code: ev.code, teams: ev.teams });
    }
    if (a === 'events' && !b && method === 'POST') {
      const id = newEvent(user, { name: body.name, settings: body.settings });
      return json(res, 200, { id });
    }
    if (a === 'events' && b) {
      const ev = evOr404(b);
      if (!c && method === 'GET') return json(res, 200, { ...ev.publicState({ full: true }), full: { settings: ev.settings, players: [...ev.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, age: p.age, rep: p.rep, excluded: p.excluded, online: p.online })) } });
      if (c === 'update' && method === 'POST') { updateEvent(ev, body); if (body.settings && AUDIO_KEYS.some((k) => k in body.settings)) saveAudioPref(user.id, ev.settings); return json(res, 200, { ok: true }); }
      if (c === 'clone' && method === 'POST') {
        const id = newEvent(user, { name: `${ev.name} (복사)`, settings: { ...ev.settings, teamCount: ev.teams.length } });
        const ne = getEvent(id);
        db.tx(() => { for (const t of ev.teams) db.run('UPDATE teams SET name=?, color=?, icon=? WHERE event_id=? AND id=?', t.name, t.color, t.icon, id, t.id); });
        ne.teams = ev.teams.map((t) => ({ ...t }));
        return json(res, 200, { id });
      }
      if (c === 'delete' && method === 'POST') { removeEvent(ev.id); return json(res, 200, { ok: true }); }
      if (c === 'player' && d === 'add' && method === 'POST') { const p = ev.hostAdd(body); ev.broadcastState(); return json(res, 200, { id: p.id, name: p.name }); }
      if (c === 'player' && method === 'POST') { playerOp(ev, d, body); return json(res, 200, { ok: true }); }
      if (c === 'autoassign' && method === 'POST') { autoAssign(ev); return json(res, 200, { ok: true }); }
      if (c === 'quick' && method === 'POST') return json(res, 200, ev.quick(Number(body.team), Number(body.delta), body.op ? String(body.op) : null));
      if (c === 'undo' && method === 'POST') { ev.undoQuick(body.id); return json(res, 200, { ok: true }); }
      if (c === 'adjust' && method === 'POST') { ev.adjust(Number(body.team), Number(body.delta), body.reason); return json(res, 200, { ok: true }); }
      if (c === 'log' && method === 'GET') {
        return json(res, 200, {
          runs: db.all('SELECT id, seq, game, label, weight, status, started_at, ended_at FROM runs WHERE event_id=? ORDER BY id', ev.id),
          results: db.all('SELECT tr.* FROM team_results tr JOIN runs r ON r.id=tr.run_id WHERE r.event_id=?', ev.id),
          adjustments: db.all('SELECT * FROM adjustments WHERE event_id=? ORDER BY id', ev.id),
          audit: db.all('SELECT action, detail, at FROM audit WHERE event_id=? ORDER BY id DESC LIMIT 300', ev.id),
        });
      }
      if (c === 'purge' && method === 'POST') {
        let i = 0;
        db.tx(() => { for (const p of ev.players.values()) { i++; p.name = `참가자${i}`; p.device = null; db.run('UPDATE players SET name=?, device=NULL WHERE id=?', p.name, p.id); } });
        ev.audit('purge'); ev.broadcastState();
        return json(res, 200, { ok: true });
      }
      if (c === 'command' && method === 'POST') { ev.command(body.op, body.arg || {}, body.seq); return json(res, 200, { ok: true, seq: ev.state.seq }); }
      if (c === 'export.csv' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ikiki-result-${ev.code}.csv"` });
        return res.end(exportCSV(ev));
      }
    }
    throw new Err('잘못된 요청', 404);
  }

  function addTeacher(body) {
    const uname = String(body.username || '').trim().toLowerCase();
    const nm = String(body.name || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 20);
    const pw = String(body.password || '');
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) throw new Err('아이디는 영어 소문자·숫자 3~20자로 해 주세요');
    if (!nm) throw new Err('강사 이름을 넣어 주세요');
    if (pw.length < 6) throw new Err('비밀번호는 6자 이상으로 해 주세요');
    if (db.get('SELECT 1 FROM users WHERE username=?', uname)) throw new Err('이미 있는 아이디예요. 다른 아이디를 써 주세요');
    db.run("INSERT INTO users(username,name,hash,role,active,created_at) VALUES(?,?,?,'teacher',1,?)", uname, nm, hashPw(pw), Date.now());
    return db.get('SELECT id, username, name, role FROM users WHERE username=?', uname);
  }

  function updateEvent(ev, body) {
    if (typeof body.name === 'string' && body.name.trim()) ev.name = body.name.trim().slice(0, 40);
    if (body.settings) {
      const s = sanitizeSettings(body.settings);
      const busy = ['countdown', 'playing'].includes(ev.phase);
      // 게임 중에는 이미 했거나 지금 하는 게임까지는 못 바꿈 (그 뒤 게임의 시간·판 수 등은 바꿀 수 있음 → 지연 시 다음 게임 단축)
      if (busy && s.playlist) {
        const cur = ev.settings.playlist; const n = ev.state.idx + 1;
        const same = s.playlist.length >= n && cur.slice(0, n).every((p, i) => JSON.stringify(p) === JSON.stringify(s.playlist[i]));
        if (!same) throw new Err('게임 중에는 지금 게임과 이미 한 게임은 바꿀 수 없어요');
      }
      Object.assign(ev.settings, s);
      if (ev.state.idx > ev.settings.playlist.length) ev.state.idx = ev.settings.playlist.length;
      if (s.teamCount && s.teamCount !== ev.teams.length) setTeamCount(ev, s.teamCount);
    }
    if (Array.isArray(body.teams)) {
      for (const t of body.teams) {
        const cur = ev.teams.find((x) => x.id === t.id); if (!cur) continue;
        if (typeof t.name === 'string' && t.name.trim()) cur.name = t.name.trim().slice(0, 10);
        if (typeof t.color === 'string' && /^#[0-9a-f]{6}$/i.test(t.color)) cur.color = t.color;
        if (typeof t.icon === 'string' && t.icon.length <= 8 && t.icon) cur.icon = t.icon;
        db.run('UPDATE teams SET name=?, color=?, icon=? WHERE event_id=? AND id=?', cur.name, cur.color, cur.icon, ev.id, cur.id);
      }
    }
    ev.settings.teamCount = ev.teams.length;
    ev.audit('update', { name: ev.name });
    ev.save(); ev.broadcastState();
  }
  function setTeamCount(ev, n) {
    if (['countdown', 'playing'].includes(ev.phase)) throw new Err('게임 중에는 팀 수를 바꿀 수 없어요');
    if (db.get("SELECT 1 FROM runs WHERE event_id=? AND status='done'", ev.id)) throw new Err('이미 점수가 있는 행사는 팀 수를 바꿀 수 없어요. 행사를 복제해서 새로 만드세요');
    const names = ['호랑이', '돌고래', '병아리', '개구리', '유니콘', '여우', '고래', '꿀꿀이', '거북이', '늑대', '사자', '펭귄', '꿀벌', '용', '나비', '곰'];
    db.tx(() => {
      for (let i = ev.teams.length; i < n; i++) { const t = { id: i + 1, name: names[i] + '팀', color: TEAM_COLORS[i], icon: TEAM_ICONS[i] }; db.run('INSERT INTO teams(event_id,id,name,color,icon) VALUES(?,?,?,?,?)', ev.id, t.id, t.name, t.color, t.icon); ev.teams.push(t); }
      if (n < ev.teams.length) { db.run('DELETE FROM teams WHERE event_id=? AND id>?', ev.id, n); ev.teams = ev.teams.slice(0, n); }
    });
    ev.settings.teamCount = n;
    for (const p of ev.players.values()) if (p.team > n) { p.team = ev.smallestTeam(); db.run('UPDATE players SET team_id=? WHERE id=?', p.team, p.id); }
  }
  function playerOp(ev, pid, body) {
    const p = ev.players.get(pid); if (!p) throw new Err('참가자를 찾을 수 없어요', 404);
    if (body.team != null) {
      const t = Number(body.team); if (!ev.teams.some((x) => x.id === t)) throw new Err('팀 오류');
      p.team = t; p.rep = false;
      if (!ev.activePlayers().some((x) => x.team === t && x.rep && x.id !== p.id)) p.rep = true;
    }
    if (typeof body.excluded === 'boolean') p.excluded = body.excluded;
    if (body.rep === true) { for (const q of ev.players.values()) if (q.team === p.team && q.rep) { q.rep = false; db.run('UPDATE players SET rep=0 WHERE id=?', q.id); } p.rep = true; }
    if (typeof body.name === 'string' && body.name.trim()) p.name = body.name.trim().slice(0, 12);
    db.run('UPDATE players SET team_id=?, excluded=?, rep=?, name=? WHERE id=?', p.team, p.excluded ? 1 : 0, p.rep ? 1 : 0, p.name, p.id);
    ev.audit('player', { pid, ...body });
    ev.sendPlayer(p.id, ev.playerView(p));
    ev.broadcastState();
  }
  function autoAssign(ev) {
    if (['countdown', 'playing'].includes(ev.phase)) throw new Err('게임 중에는 팀을 다시 나눌 수 없어요');
    const ps = shuffleArr(ev.activePlayers());
    const ages = ['kid', 'elem', 'adult'];
    ps.sort((a, b) => ages.indexOf(a.age) - ages.indexOf(b.age)); // 연령이 고르게 섞이도록
    db.tx(() => {
      ps.forEach((p, i) => { p.team = ev.teams[i % ev.teams.length].id; p.rep = false; });
      for (const t of ev.teams) { const f = ps.find((p) => p.team === t.id); if (f) f.rep = true; }
      for (const p of ps) db.run('UPDATE players SET team_id=?, rep=? WHERE id=?', p.team, p.rep ? 1 : 0, p.id);
    });
    ev.audit('autoassign');
    for (const p of ps) ev.sendPlayer(p.id, ev.playerView(p));
    ev.broadcastState();
  }

  // ---- WebSocket ----
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
  wss.on('connection', (ws, req) => {
    ws.isAlive = true; ws.rate = { n: 0, at: Date.now() };
    ws.on('pong', () => (ws.isAlive = true));
    ws.on('message', (data) => {
      const now = Date.now();
      if (now - ws.rate.at > 1000) { ws.rate = { n: 0, at: now }; }
      if (++ws.rate.n > 60) { if (ws.rate.n > 300) ws.close(4008, 'rate'); return; } // 초당 60개 넘는 메시지는 버림
      let m; try { m = JSON.parse(data); } catch { return; }
      if (!m || typeof m !== 'object') return;
      try { onMsg(ws, m); } catch (e) { if (e instanceof Err) hub.send(ws, { t: 'err', msg: e.message, code: e.code, rid: m.rid }); else console.error(e); }
    });
    ws.on('close', () => detach(ws));
  });
  const hb = setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch { /* */ } } }, 20000);

  function attach(ws, ev, role, pid) {
    detach(ws);
    ws.eid = ev.id; ws.role = role; ws.pid = pid;
    if (!sockets.has(ev.id)) sockets.set(ev.id, new Set());
    sockets.get(ev.id).add(ws);
    if (pid) {
      if (!ev.conns.has(pid)) ev.conns.set(pid, new Set());
      ev.conns.get(pid).add(ws);
      const p = ev.players.get(pid); if (p && !p.online) { p.online = true; ev.broadcastSoon(); }
    }
  }
  function detach(ws) {
    if (!ws.eid) return;
    sockets.get(ws.eid)?.delete(ws);
    const ev = events.get(ws.eid);
    if (ev && ws.pid) {
      const s = ev.conns.get(ws.pid); s?.delete(ws);
      if (s && !s.size) { ev.conns.delete(ws.pid); const p = ev.players.get(ws.pid); if (p) { p.online = false; ev.broadcastSoon(); } }
    }
    ws.eid = null;
  }

  function onMsg(ws, m) {
    if (m.t === 'ping') return hub.send(ws, { t: 'pong', c: m.c, s: Date.now() });
    if (m.t === 'hello') {
      if (m.role === 'player') {
        const ev = getEvent(String(m.eid || '')); if (!ev) throw new Err('행사를 찾을 수 없어요', 404);
        const pids = Array.isArray(m.players) ? m.players.slice(0, 30) : [{ pid: m.pid, secret: m.secret }];
        const ok = [];
        for (const x of pids) { const p = ev.players.get(String(x?.pid || '')); if (p && safeEq(p.secret, String(x.secret || ''))) ok.push(p); }
        if (!ok.length) throw new Err('참가 정보가 없어요. 다시 참가해 주세요', 404);
        detach(ws);
        ws.eid = ev.id; ws.role = 'player'; ws.pids = new Set(ok.map((p) => p.id));
        if (!sockets.has(ev.id)) sockets.set(ev.id, new Set());
        sockets.get(ev.id).add(ws);
        for (const p of ok) { if (!ev.conns.has(p.id)) ev.conns.set(p.id, new Set()); ev.conns.get(p.id).add(ws); if (!p.online) { p.online = true; ev.broadcastSoon(); } }
        ws.pid = ok[0].id;
        hub.send(ws, ev.publicState());
        for (const p of ok) hub.send(ws, { ...ev.playerView(p), pid: p.id });
        if (ev.game) for (const p of ok) hub.send(ws, { t: 'g', pid: p.id, run: ev.game.runId, v: ev.game.view(p.id, Date.now()) });
        return;
      }
      if (m.role === 'screen') {
        let ev = byCode(m.code);
        if (!ev) { const u = userOf(m.token); const e2 = u ? getEvent(String(m.eid || '')) : null; ev = canEv(u, e2) ? e2 : null; }
        if (!ev) throw new Err('행사를 찾을 수 없어요', 404);
        attach(ws, ev, 'screen'); hub.send(ws, ev.publicState()); return;
      }
      if (m.role === 'admin') {
        const u = userOf(m.token); if (!u) throw new Err('관리자 로그인이 필요해요', 401);
        const ev = getEvent(String(m.eid || '')); if (!canEv(u, ev)) throw new Err('행사를 찾을 수 없어요', 404);
        attach(ws, ev, 'admin'); ws.token = m.token; hub.send(ws, ev.publicState()); return;
      }
      return;
    }
    const ev = ws.eid ? events.get(ws.eid) : null; if (!ev) return;
    if (ws.role === 'player') {
      const pid = m.pid && ws.pids?.has(m.pid) ? m.pid : ws.pid;
      const p = ev.players.get(pid); if (!p) return;
      if (m.t === 'in') return ev.input(p, m);
      if (m.t === 'cheer') return ev.cheerTap(p, m.n);
      if (m.t === 'team') { ev.renameTeam(p, m.name, m.icon); return hub.send(ws, { t: 'ok', rid: m.rid }); }
      if (m.t === 'me') return hub.send(ws, { ...ev.playerView(p), pid: p.id });
      return;
    }
    if (ws.role === 'admin' && m.t === 'cmd') {
      if (!canEv(userOf(ws.token), ev)) throw new Err('관리자 로그인이 필요해요', 401);
      ev.command(m.op, m.arg || {}, m.seq);
      return hub.send(ws, { t: 'ok', rid: m.rid });
    }
  }

  return {
    server, db, hub, events, getEvent,
    listen(cb) {
      server.listen(port, () => {
        const addrs = lanAddrs(); const pt = server.address().port;
        log(`🎮 아이키키 팀 대항 오락실 실행 중 → http://localhost:${pt}`);
        log(`   진행자 화면: http://localhost:${pt}/admin.html`);
        for (const a of addrs) log(`   같은 와이파이 접속 주소: http://${a}:${pt}`);
        cb?.();
      });
    },
    get port() { return server.address()?.port; },
    async close() {
      hub.closed = true;
      clearInterval(hb);
      for (const ev of events.values()) { ev.clearTimer(); ev.stopTicker(); if (ev._bs) clearTimeout(ev._bs); ev.save(); }
      for (const ws of wss.clients) ws.terminate();
      await new Promise((r) => wss.close(r));
      await new Promise((r) => server.close(r));
      db.close();
    },
  };
}

// ---------- 도우미 ----------
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    let big = false;
    req.on('data', (c) => { if (big) return; size += c.length; if (size > 64 * 1024) { big = true; chunks.length = 0; reject(new Err('요청이 너무 커요', 413)); } else chunks.push(c); });
    req.on('end', () => { if (big) return; try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new Err('잘못된 요청 형식')); } });
    req.on('error', reject);
  });
}
function hashPw(pw) { const salt = crypto.randomBytes(16); return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 32).toString('hex'); }
function verifyPw(pw, stored) {
  if (!stored) return false;
  const [s, h] = stored.split(':');
  const calc = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 32);
  return crypto.timingSafeEqual(calc, Buffer.from(h, 'hex'));
}
function safeEq(a, b) { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function shuffleArr(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function lanAddrs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) out.push(n.address);
  return out;
}
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function exportCSV(ev) {
  const db = ev.db; const L = [];
  const row = (...a) => L.push(a.map(csvCell).join(','));
  const team = Object.fromEntries(ev.teams.map((t) => [t.id, t.name]));
  row('아이키키 팀 대항 오락실', ev.name, ev.code, new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
  row(); row('[종합 순위]'); row('순위', '팀', '게임 포인트', '보너스/조정', '총점', '1위 횟수');
  for (const r of ev.standings().rows) row(r.rank, team[r.id], r.games, r.bonus, r.total, r.wins);
  row(); row('[게임별 결과]'); row('순서', '게임', '배점', '팀', '게임 기록', '게임 순위', '순위 포인트');
  for (const r of db.all("SELECT r.seq, r.label, r.weight, tr.team_id, tr.metric, tr.rank, tr.points FROM runs r JOIN team_results tr ON tr.run_id=r.id WHERE r.event_id=? AND r.status='done' ORDER BY r.id, tr.rank", ev.id)) row(r.seq, r.label, r.weight, team[r.team_id], r.metric, r.rank, r.points);
  row(); row('[보너스·수동 조정 기록]'); row('시각', '팀', '점수', '종류', '사유');
  const kind = { manual: '관리자 수정', luck: '운 보너스', cheer: '응원 이벤트', quick: '퀵 점수(응원·수동)' };
  for (const a of db.all('SELECT * FROM adjustments WHERE event_id=? ORDER BY id', ev.id)) row(new Date(a.at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), team[a.team_id], a.delta, kind[a.kind] || a.kind, a.reason);
  row(); row('[개인 기록]'); row('게임', '이름', '팀', '기록', '환산점수(0~100)');
  for (const r of db.all("SELECT r.label, p.name, p.team_id, ps.raw, ps.norm FROM player_scores ps JOIN runs r ON r.id=ps.run_id JOIN players p ON p.id=ps.player_id WHERE r.event_id=? AND r.status='done' ORDER BY r.id, ps.norm DESC", ev.id)) row(r.label, r.name, team[r.team_id], r.raw, r.norm);
  return '﻿' + L.join('\r\n');
}

void defaultPlaylist;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createServer();
  app.listen();
  const bye = async () => { await app.close(); process.exit(0); };
  process.on('SIGINT', bye); process.on('SIGTERM', bye);
}

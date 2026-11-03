// 단위·통합 테스트: 점수 계산, 진행 상태, 보안, 데이터 복구
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { createServer } from '../../server/server.js';
import { api, Bot } from '../lib/bots.js';
import { numHuntLayout, colorRound, rng } from '../../public/shared/gen.js';
import { TapLimiter, norm, normLow } from '../../server/games/common.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let app, base, token;
before(async () => {
  app = createServer({ dbFile: ':memory:', port: 0, adminPassword: 'pw-123456', quiet: true });
  await new Promise((r) => app.listen(r));
  base = `http://localhost:${app.port}`;
  token = (await api(base, '/api/login', { password: 'pw-123456' })).token;
});
after(async () => { await app.close(); });

async function newEvent(settings = {}) {
  const { id } = await api(base, '/api/events', { name: '테스트', settings: { auto: false, teamCount: 3, ...settings } }, token);
  const ev = await api(base, `/api/events/${id}`, null, token);
  return { id, code: ev.event.code };
}
const cmd = (id, op, arg, seq) => api(base, `/api/events/${id}/command`, { op, arg, seq }, token);
const state = (id) => api(base, `/api/events/${id}`, null, token);
async function waitPhase(id, ph, ms = 15000) { const t = Date.now(); for (;;) { const s = await state(id); if (s.phase === ph) return s; if (Date.now() - t > ms) throw new Error(`phase ${s.phase} != ${ph}`); await sleep(150); } }

// ---------------- 순수 함수 ----------------
test('시드 생성기: 같은 seed → 같은 배치 (서버·폰 재계산 일치)', () => {
  assert.deepEqual(numHuntLayout(42, 16), numHuntLayout(42, 16));
  assert.notDeepEqual(numHuntLayout(42, 16).pos, numHuntLayout(43, 16).pos);
  const r = colorRound(7, 3, 9, 5, true);
  assert.equal(r.grid.filter((c) => c === r.target).length, r.nTarget);
  assert.ok(r.words.every((w, i) => w !== r.grid[i]), '함정 글자는 실제 색과 달라야 함');
  const a = rng(1); const b = rng(1); assert.equal(a(), b());
});
test('연타 속도 제한: 초당 최대치 이상은 인정 안 됨', () => {
  const l = new TapLimiter(10); let ok = 0; const t0 = 1_000_000;
  for (let i = 0; i < 50; i++) ok += l.take('a', 5, t0 + i * 100); // 5초 동안 초당 50회 주장
  assert.ok(ok <= 10 * 5 + 12, `인정 ${ok}`);
});
test('점수 환산 0~100 범위', () => {
  assert.equal(norm(300, 200), 100); assert.equal(norm(-5, 200), 0); assert.equal(norm(100, 200), 50);
  assert.equal(normLow(10, 30, 400), 100); assert.equal(normLow(500, 30, 400), 0);
});

// ---------------- 팀 점수 ----------------
test('팀 평균 점수: 인원이 다른 팀도 평균으로 공정하게, 동점은 같은 순위', async () => {
  const { id } = await newEvent({ scoring: 'avg' });
  const ev = app.getEvent(id);
  const ids = [];
  for (const [team, n] of [[1, 3], [2, 1], [3, 2]]) for (let i = 0; i < n; i++) ids.push(ev.join({ name: `p${team}${i}`, team, age: 'elem' }));
  const g = { runId: 0, def: {} };
  const res = { players: {} };
  ids.forEach((p) => (res.players[p.id] = { raw: 0, norm: p.team === 1 ? 50 : p.team === 2 ? 50 : 80 }));
  const out = ev.scoreRun(g, res, 1);
  const by = Object.fromEntries(out.teams.map((t) => [t.id, t]));
  assert.equal(by[3].rank, 1); assert.equal(by[1].rank, 2); assert.equal(by[2].rank, 2, '평균이 같으면 공동 순위');
  assert.equal(by[3].points, 30); assert.equal(by[1].points, 20); assert.equal(by[2].points, 20);
  ev.settings.scoring = 'sum';
  const out2 = ev.scoreRun(g, res, 2);
  assert.equal(out2.teams[0].id, 3); assert.equal(Object.fromEntries(out2.teams.map((t) => [t.id, t]))[1].metric, 150);
  assert.equal(out2.teams[0].points, 60, '배점 2배');
});
test('참여자 없는 팀은 0점', async () => {
  const { id } = await newEvent();
  const ev = app.getEvent(id);
  const p = ev.join({ name: 'a', team: 1, age: 'elem' });
  const out = ev.scoreRun({}, { players: { [p.id]: { raw: 1, norm: 10 } } }, 1);
  const by = Object.fromEntries(out.teams.map((t) => [t.id, t]));
  assert.equal(by[1].points, 30); assert.equal(by[2].points, 0); assert.equal(by[3].points, 0);
});

// ---------------- 참가 ----------------
test('같은 기기·같은 이름 재참가 → 같은 참가자 (중복 참가 방지), 같은 팀 이름 중복 → 번호 붙임', async () => {
  const { code } = await newEvent();
  const a = await api(base, '/api/join', { code, name: '지우', team: 1, device: 'devA' });
  const b = await api(base, '/api/join', { code, name: '지우', team: 1, device: 'devA' });
  assert.equal(a.pid, b.pid);
  const c = await api(base, '/api/join', { code, name: '지우', team: 1, device: 'devB' });
  assert.notEqual(c.pid, a.pid); assert.equal(c.name, '지우2');
  await assert.rejects(api(base, '/api/join', { code, name: '   ', team: 1 }), /이름/);
  await assert.rejects(api(base, '/api/join', { code: 'XXXXXX', name: 'a' }), /코드/);
});
test('자동 배정: 인원 균등', async () => {
  const { code } = await newEvent({ teamAssign: 'auto' });
  const teams = [];
  for (let i = 0; i < 9; i++) teams.push((await api(base, '/api/join', { code, name: 'n' + i, team: 1, device: 'd' + i })).team);
  for (const t of [1, 2, 3]) assert.equal(teams.filter((x) => x === t).length, 3);
});

// ---------------- 보안 ----------------
test('관리자 권한: 토큰 없이 명령·설정·점수 수정 불가', async () => {
  const { id } = await newEvent();
  for (const [p, b] of [[`/api/events/${id}/command`, { op: 'end' }], [`/api/events/${id}/update`, { name: 'x' }], [`/api/events/${id}/adjust`, { team: 1, delta: 100 }], ['/api/events', { name: 'x' }]]) {
    await assert.rejects(api(base, p, b), (e) => e.status === 401);
    await assert.rejects(api(base, p, b, 'fake-token'), (e) => e.status === 401);
  }
  await assert.rejects(api(base, '/api/events'), (e) => e.status === 401);
});
test('로그인: 틀린 비밀번호 거부 + 반복 시도 제한', async () => {
  let blocked = false;
  for (let i = 0; i < 12; i++) { try { await api(base, '/api/login', { password: 'wrong' + i }); } catch (e) { if (e.status === 429) { blocked = true; break; } assert.equal(e.status, 401); } }
  assert.ok(blocked, '로그인 시도 제한');
});
test('참가자 WebSocket: 비밀키 틀리면 거부, 관리자 명령 불가, 점수 숫자 직접 전송 무시', async () => {
  const { id, code } = await newEvent();
  const info = await api(base, '/api/join', { code, name: 'h', team: 1, device: 'x' });
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws');
  const msgs = []; ws.on('message', (d) => msgs.push(JSON.parse(d)));
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'hello', role: 'player', eid: id, pid: info.pid, secret: 'wrong' }));
  await sleep(200);
  assert.ok(msgs.some((m) => m.t === 'err' && m.code === 404));
  ws.send(JSON.stringify({ t: 'hello', role: 'player', eid: id, pid: info.pid, secret: info.secret }));
  await sleep(200);
  assert.ok(msgs.some((m) => m.t === 'state'));
  ws.send(JSON.stringify({ t: 'cmd', op: 'end' }));
  ws.send(JSON.stringify({ t: 'hello', role: 'admin', token: 'nope', eid: id }));
  await sleep(200);
  assert.notEqual((await state(id)).phase, 'ended');
  // 진행 중 게임에 점수 숫자를 보내도 반영 안 됨
  await cmd(id, 'intro'); await cmd(id, 'start'); await waitPhase(id, 'playing');
  ws.send(JSON.stringify({ t: 'in', run: (await state(id)).run.id, a: 'tap', n: 99999 }));
  ws.send(JSON.stringify({ t: 'in', run: (await state(id)).run.id, score: 100000, raw: 100000 }));
  await sleep(300);
  await cmd(id, 'endNow');
  const s = await state(id);
  const my = s.lastResult.players[info.pid];
  assert.ok(!my || my.raw <= 30, `조작된 점수 반영 안 됨 (raw=${my?.raw})`);
  ws.close();
});
test('메시지 폭주: 초당 60개 넘게 보내면 버리고 300개 넘으면 연결 끊음', async () => {
  const { id, code } = await newEvent();
  const info = await api(base, '/api/join', { code, name: 'spam', team: 1, device: 's' });
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws');
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'hello', role: 'player', eid: id, pid: info.pid, secret: info.secret }));
  let closed = false; ws.on('close', (c) => (closed = c));
  for (let i = 0; i < 400; i++) ws.send(JSON.stringify({ t: 'cheer', n: 5 }));
  await sleep(400);
  assert.equal(closed, 4008);
  assert.ok(app.getEvent(id).cheer.get(1) <= 60 * 5, '버린 응원은 반영 안 됨');
});
test('경로 조작·큰 요청·잘못된 설정값 차단', async () => {
  const r = await new Promise((res) => (globalThis.__http ||= null, import('node:http').then((http) => http.get({ host: 'localhost', port: app.port, path: '/..%2f..%2fpackage.json' }, (x) => { x.resume(); res(x); }))));
  assert.ok([403, 404].includes(r.statusCode));
  const r2 = await fetch(base + '/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 'a'.repeat(100000) }) });
  assert.ok([413, 400].includes(r2.status) || r2.status >= 400);
  const { id } = await newEvent();
  await api(base, `/api/events/${id}/update`, { settings: { teamCount: 99, mode: 'hack', joinUrl: 'javascript:alert(1)', playlist: [{ game: 'nope' }, { game: 'mash', weight: 1000, dur: 1 }] } }, token);
  const s = await state(id);
  assert.equal(s.teams.length, 3); assert.equal(s.settings.mode, 'elem'); assert.equal(s.settings.joinUrl, '');
  assert.deepEqual(s.playlist, [{ game: 'mash', weight: 1 }]);
});

// ---------------- 진행 ----------------
test('다른 화면에서 이미 진행된 명령(오래된 seq)은 거부 → 관리자 중복 조작 방지', async () => {
  const { id, code } = await newEvent();
  await api(base, '/api/join', { code, name: 'a', team: 1 });
  const s = await state(id);
  await cmd(id, 'intro', {}, s.seq);
  await assert.rejects(cmd(id, 'intro', {}, s.seq), (e) => e.status === 409);
});
test('일시정지하면 남은 시간이 유지되고, 재개하면 그만큼 늘어남', async () => {
  const { id, code } = await newEvent({ playlist: [{ game: 'mash', dur: 10 }] });
  await api(base, '/api/join', { code, name: 'a', team: 1 });
  await cmd(id, 'intro'); await cmd(id, 'start'); const s1 = await waitPhase(id, 'playing');
  await cmd(id, 'pause'); await sleep(1200); await cmd(id, 'resume');
  const s2 = await state(id);
  assert.ok(s2.run.endAt - s1.run.endAt >= 1100, `endAt 연장 ${s2.run.endAt - s1.run.endAt}`);
  await cmd(id, 'abort');
});
test('재경기: 이전 결과 취소 후 같은 게임 다시', async () => {
  const { id, code } = await newEvent({ playlist: [{ game: 'mash', dur: 5 }, { game: 'race', dur: 5 }] });
  const info = await api(base, '/api/join', { code, name: 'a', team: 1 });
  const bot = new Bot(base, info); await bot.connect();
  await cmd(id, 'intro'); await cmd(id, 'start'); await waitPhase(id, 'playing'); await sleep(1500); await cmd(id, 'endNow');
  const before = (await state(id)).standings;
  assert.equal(before.played, 1);
  await cmd(id, 'replay');
  const s = await state(id);
  assert.equal(s.phase, 'intro'); assert.equal(s.idx, 0); assert.equal(s.standings.played, 0, '이전 결과 취소');
  await cmd(id, 'start'); await waitPhase(id, 'playing'); await sleep(1000); await cmd(id, 'endNow');
  assert.equal((await state(id)).standings.played, 1);
  bot.close();
});
test('수동 점수 수정 + 이력 + CSV', async () => {
  const { id } = await newEvent();
  await api(base, `/api/events/${id}/adjust`, { team: 2, delta: 15, reason: '정리정돈' }, token);
  await assert.rejects(api(base, `/api/events/${id}/adjust`, { team: 2, delta: 1e9 }, token));
  const s = await state(id);
  assert.equal(s.standings.rows[0].id, 2); assert.equal(s.standings.rows[0].total, 15);
  const log = await api(base, `/api/events/${id}/log`, null, token);
  assert.equal(log.adjustments[0].reason, '정리정돈');
  const csv = await (await fetch(`${base}/api/events/${id}/export.csv`, { headers: { Authorization: 'Bearer ' + token } })).text();
  assert.ok(csv.includes('정리정돈'));
});
test('응원 이벤트: 1인당 응원 1위 팀만 보너스', async () => {
  const { id, code } = await newEvent();
  const a = await api(base, '/api/join', { code, name: 'a', team: 1 });
  const b = await api(base, '/api/join', { code, name: 'b', team: 2 });
  const ev = app.getEvent(id);
  ev.startCheerEvent({ sec: 5, bonus: 7 });
  ev.cheerTap(ev.players.get(a.pid), 5); ev.cheerTap(ev.players.get(b.pid), 2);
  ev.endCheerEvent();
  const s = await state(id);
  assert.equal(s.standings.rows.find((r) => r.id === 1).bonus, 7);
  assert.equal(s.standings.rows.find((r) => r.id === 2).bonus, 0);
});

// ---------------- 복구 ----------------
test('서버 재시작: 행사·참가자·점수 유지, 진행 중 게임은 중단 표시, 참가자 재접속 가능', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikiki-'));
  const file = path.join(dir, 't.db');
  let a2 = createServer({ dbFile: file, port: 0, adminPassword: 'pw-123456', quiet: true });
  await new Promise((r) => a2.listen(r));
  let b2 = `http://localhost:${a2.port}`;
  const tk = (await api(b2, '/api/login', { password: 'pw-123456' })).token;
  const { id } = await api(b2, '/api/events', { name: '복구', settings: { auto: false, teamCount: 2, playlist: [{ game: 'mash', dur: 5 }, { game: 'mash', dur: 30 }] } }, tk);
  const code = (await api(b2, `/api/events/${id}`, null, tk)).event.code;
  const info = await api(b2, '/api/join', { code, name: '복구왕', team: 1 });
  const bot = new Bot(b2, info); await bot.connect();
  const c2 = (op) => api(b2, `/api/events/${id}/command`, { op }, tk);
  await c2('intro'); await c2('start'); await sleep(4500); await c2('endNow');
  await c2('next'); await c2('intro'); await c2('start'); await sleep(3500); // 두 번째 게임 진행 중에 서버 종료
  bot.close();
  await a2.close();
  a2 = createServer({ dbFile: file, port: 0, quiet: true });
  await new Promise((r) => a2.listen(r));
  b2 = `http://localhost:${a2.port}`;
  const tk2 = (await api(b2, '/api/login', { password: 'pw-123456' })).token; // 비밀번호 유지
  const s = await api(b2, `/api/events/${id}`, null, tk2);
  assert.equal(s.phase, 'lobby');
  assert.match(s.notice, /중단/);
  assert.equal(s.standings.played, 1, '끝난 게임 점수 유지');
  assert.equal(s.full.players.length, 1);
  const log = await api(b2, `/api/events/${id}/log`, null, tk2);
  assert.equal(log.runs.at(-1).status, 'interrupted');
  const bot2 = new Bot(b2, info); await bot2.connect(); await sleep(300);
  assert.ok(bot2.state, '같은 비밀키로 재접속');
  bot2.close();
  await a2.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
test('연결이 끊겼다가 다시 붙어도 게임 화면과 점수 이어짐', async () => {
  const { id, code } = await newEvent({ playlist: [{ game: 'mash', dur: 8 }] });
  const info = await api(base, '/api/join', { code, name: 're', team: 1 });
  let bot = new Bot(base, info); await bot.connect();
  await cmd(id, 'intro'); await cmd(id, 'start'); await waitPhase(id, 'playing'); await sleep(1500);
  bot.close(); await sleep(300);
  assert.equal(app.getEvent(id).players.get(info.pid).online, false);
  bot = new Bot(base, info); await bot.connect(); await sleep(1500);
  assert.equal(app.getEvent(id).players.get(info.pid).online, true);
  await cmd(id, 'endNow');
  const s = await state(id);
  assert.ok(s.lastResult.players[info.pid].raw > 10, `끊기기 전 + 후 연타 합산 (${s.lastResult.players[info.pid].raw})`);
  bot.close();
});

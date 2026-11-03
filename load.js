// 부하 테스트: 서버를 별도 프로세스로 띄우고 가상 참가자 N명이 동시에 게임
// 사용: node --no-warnings test/load.js --bots 300 --teams 12 --games mash,tug,mole,ox
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import WebSocket from 'ws';
import { api, Bot } from './lib/bots.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1]]] : a), []));
const N = +(args.bots || 300), T = +(args.teams || 12);
const games = (args.games || 'mash,race,tug,mole,nunchi,ox').split(',');
const port = 18000 + Math.floor(Math.random() * 1000);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikiki-load-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn(process.execPath, ['--no-warnings', 'server/server.js'], { env: { ...process.env, PORT: port, ADMIN_PASSWORD: 'load1234', DB_FILE: path.join(dir, 'l.db') }, stdio: 'ignore' });
const base = `http://localhost:${port}`;
const out = { bots: N, teams: T, games: [], problems: [] };
const mem = () => { try { const s = execSync(`ps -o rss=,pcpu= -p ${srv.pid}`).toString().trim().split(/\s+/); return { rssMB: Math.round(+s[0] / 1024), cpu: +s[1] }; } catch { return null; } };
try {
  for (let i = 0; i < 50; i++) { try { await api(base, '/api/games'); break; } catch { await sleep(100); } }
  const { token } = await api(base, '/api/login', { password: 'load1234' });
  const { id } = await api(base, '/api/events', { name: '부하', settings: { mode: 'elem', teamCount: T, auto: false, teamAssign: 'auto', playlist: games.map((g) => ({ game: g, dur: 20 })) } }, token);
  const code = (await api(base, `/api/events/${id}`, null, token)).event.code;
  // 300명 동시 참가 (QR 찍고 몰려드는 상황)
  const t0 = Date.now();
  const infos = await Promise.all(Array.from({ length: N }, (_, i) => api(base, '/api/join', { code, name: `p${i}`, device: `d${i}` }).catch((e) => ({ err: e.message }))));
  const failed = infos.filter((x) => x.err);
  out.joinMs = Date.now() - t0; out.joinFailed = failed.length;
  if (failed.length) out.problems.push(`참가 실패 ${failed.length}명: ${failed[0].err}`);
  const bots = [];
  await Promise.all(infos.filter((x) => !x.err).map(async (info) => { const b = new Bot(base, info); await b.connect(); bots.push(b); }));
  out.connectMs = Date.now() - t0;
  await sleep(1000);
  // 응답 지연 측정용 프로브
  const probe = new WebSocket(base.replace('http', 'ws') + '/ws');
  await new Promise((r) => probe.on('open', r));
  const lat = [];
  probe.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'pong') lat.push(Date.now() - m.c); });
  const pinger = setInterval(() => probe.send(JSON.stringify({ t: 'ping', c: Date.now() })), 200);
  const cmd = (op, arg) => api(base, `/api/events/${id}/command`, { op, arg }, token);
  for (const [i, g] of games.entries()) {
    lat.length = 0;
    const msgs0 = bots.reduce((s, b) => s + b.stats.msgs, 0);
    const s0 = Date.now();
    await cmd('intro', { idx: i }); await cmd('start');
    let st;
    for (;;) { await sleep(500); st = await api(base, `/api/events/${id}`, null, token); if (st.phase === 'results') break; if (Date.now() - s0 > 180000) { await cmd('endNow'); await sleep(500); st = await api(base, `/api/events/${id}`, null, token); out.problems.push(`${g} 시간 초과`); break; } }
    const scored = Object.keys(st.lastResult?.players || {}).length;
    lat.sort((a, b) => a - b);
    const rec = { game: g, sec: Math.round((Date.now() - s0) / 1000), scored, pingP50: lat[Math.floor(lat.length / 2)], pingP95: lat[Math.floor(lat.length * 0.95)], pingMax: lat.at(-1), msgsToBots: bots.reduce((s, b) => s + b.stats.msgs, 0) - msgs0, server: mem() };
    out.games.push(rec); console.log(JSON.stringify(rec));
    if (scored < bots.length * 0.9 && !['tug'].includes(g)) out.problems.push(`${g}: 점수 받은 인원 ${scored}/${bots.length}`);
    if (rec.pingP95 > 300) out.problems.push(`${g}: 응답 지연 p95 ${rec.pingP95}ms`);
    await cmd('next');
  }
  clearInterval(pinger); probe.close();
  out.botErrs = bots.reduce((s, b) => s + b.stats.errs, 0);
  out.disconnected = bots.filter((b) => b.closed).length;
  if (out.disconnected) out.problems.push(`연결 끊긴 봇 ${out.disconnected}`);
  for (const b of bots) b.close();
} catch (e) { out.problems.push('예외 ' + e.stack); }
srv.kill(); fs.rmSync(dir, { recursive: true, force: true });
console.log('RESULT', JSON.stringify({ ...out, games: undefined }, null, 1));
process.exit(out.problems.length ? 1 : 0);

// 20종 게임 전체를 봇 참가자로 실제 진행해 보는 통합 테스트
// 사용: node --no-warnings test/fullrun.js --mode elem --bots 40 --teams 4 [--games mash,race] [--dur 8]
import { createServer } from '../server/server.js';
import { api, Bot } from './lib/bots.js';
import { GAME_LIST } from '../server/games/index.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1]]] : a), []));
const mode = args.mode || 'elem';
const nBots = +(args.bots || 40);
const nTeams = +(args.teams || 4);
const dur = +(args.dur || 8);
const games = args.games ? args.games.split(',') : GAME_LIST.map((g) => g.id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const app = createServer({ dbFile: ':memory:', port: 0, adminPassword: 'test1234', quiet: true });
await new Promise((r) => app.listen(r));
const base = `http://localhost:${app.port}`;
const out = { mode, bots: nBots, teams: nTeams, games: [], problems: [] };
const t0 = Date.now();
try {
  const { token } = await api(base, '/api/login', { password: 'test1234' });
  const playlist = games.map((g) => ({ game: g, weight: g === 'throne' ? 2 : 1, ...(GAME_LIST.find((x) => x.id === g).untimed ? {} : { dur }) }));
  const { id } = await api(base, '/api/events', { name: '테스트', settings: { mode, teamCount: nTeams, auto: false, playlist, teamAssign: 'auto' } }, token);
  const ev = await api(base, `/api/events/${id}`, null, token);
  const hintBoard = {};
  const bots = [];
  for (let i = 0; i < nBots; i++) {
    const age = mode === 'mixed' ? ['kid', 'elem', 'adult'][i % 3] : mode;
    const info = await api(base, '/api/join', { code: ev.event.code, name: `봇${i}`, age, device: `dev${i}` });
    const b = new Bot(base, info, { hintBoard }); await b.connect(); bots.push(b);
  }
  await sleep(500);
  const cmd = (op, arg) => api(base, `/api/events/${id}/command`, { op, arg }, token);
  const getState = () => api(base, `/api/events/${id}`, null, token);
  for (const [i, g] of games.entries()) {
    const s0 = Date.now();
    await cmd('intro', { idx: i });
    await sleep(300);
    await cmd('start');
    const info = GAME_LIST.find((x) => x.id === g);
    const limit = (info.untimed ? 240 : dur + 20) * 1000;
    let st;
    for (;;) {
      await sleep(400);
      st = await getState();
      if (st.phase === 'results') break;
      if (Date.now() - s0 > limit) { out.problems.push(`${g}: 제한시간 안에 끝나지 않음 (phase=${st.phase})`); await cmd('endNow'); await sleep(400); st = await getState(); break; }
    }
    const lr = st.lastResult;
    const scored = lr ? Object.keys(lr.players || {}).length : 0;
    const rec = { game: g, sec: Math.round((Date.now() - s0) / 100) / 10, reason: lr?.reason, scored, teams: lr?.teams?.map((t) => `${t.id}:${t.metric}/${t.rank}위/${t.points}p`).join(' '), bonus: lr?.bonus?.map((b) => `${b.team}:+${b.delta}`).join(' ') };
    out.games.push(rec);
    if (!lr) out.problems.push(`${g}: 결과 없음`);
    else {
      if (!info.bonusOnly && lr.teams.length !== nTeams) out.problems.push(`${g}: 팀 결과 수 ${lr.teams.length}`);
      if (!info.bonusOnly && !info.team && scored < nBots * 0.5) out.problems.push(`${g}: 점수 받은 참가자가 적음 (${scored}/${nBots})`);
      if (JSON.stringify(lr).includes('NaN') || JSON.stringify(lr).includes('null,"rank"')) out.problems.push(`${g}: 잘못된 숫자`);
      const nz = lr.teams.filter((t) => t.metric > 0).length;
      if (!info.bonusOnly && nz === 0) out.problems.push(`${g}: 모든 팀 0점`);
    }
    console.log(JSON.stringify(rec));
    await cmd('next'); await sleep(200);
  }
  await cmd('ceremony');
  for (let i = 0; i < 5; i++) { await sleep(100); await cmd('ceremonyNext'); }
  const fin = await getState();
  out.final = fin.standings.rows.map((r) => `${r.rank}위 팀${r.id} ${r.total}`);
  const csv = await (await fetch(`${base}/api/events/${id}/export.csv`, { headers: { Authorization: 'Bearer ' + token } })).text();
  if (!csv.includes('[종합 순위]')) out.problems.push('CSV 내보내기 실패');
  out.botErrs = bots.reduce((s, b) => s + b.stats.errs, 0);
  if (out.botErrs) out.problems.push(`봇 메시지 처리 오류 ${out.botErrs}건`);
  for (const b of bots) b.close();
} catch (e) { out.problems.push('예외: ' + e.stack); }
out.totalSec = Math.round((Date.now() - t0) / 1000);
console.log('RESULT', JSON.stringify({ ...out, games: undefined }, null, 1));
await app.close();
process.exit(out.problems.length ? 1 : 0);

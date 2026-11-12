// 새 경쟁 게임 3종: 줄다리기(팀) · 멀리뛰기(개인) · 볼링(개인)
// 기존 참가·점수·순위·게임 전환 구조를 그대로 씀 (create → input/tick/view/screen/finish)
import { clamp, round1, numIn, intIn, TapLimiter } from './common.js';
import { bowlRoll } from './bowl.js';

function clock() { const c = { T: 0, last: null }; c.dt = (now) => { const d = c.last == null ? 0.1 : clamp((now - c.last) / 1000, 0, 0.25); c.last = now; c.T += d; return d; }; c.shift = (ms) => { if (c.last != null) c.last += ms; }; return c; }
const lvOf = (ctx) => ctx.settings.lv ?? 2;
const avgBy = (P, val, teams) => { const s = {}, n = {}; for (const p of P.values()) { const v = val(p); if (v == null) continue; s[p.team] = (s[p.team] || 0) + v; n[p.team] = (n[p.team] || 0) + 1; } const o = {}; for (const t of teams) o[t] = n[t] ? round1(s[t] / n[t]) : 0; return o; };

// ---------------- 줄다리기: 팀원이 함께 연타 → 매듭이 우리 쪽으로. 팀이 2개면 1:1, 3팀 이상이면 사방 줄다리기
// 공정하게: 팀 인원수로 나눈 '1인당 연타 속도'가 힘 (인원이 많아도 유리하지 않음) · 1인당 초당 12번까지만 인정
export const tug = {
  id: 'tug', no: 103, name: '줄다리기', emoji: '🪢', teamGame: true,
  dur: { kid: 40, elem: 45, adult: 45 },
  rule: { all: '"영차!" 버튼을 팀원 모두 함께 연타! 매듭을 우리 팀 쪽 선까지 끌어오면 1승. 팀 인원이 달라도 1인당 속도로 겨뤄요', baby: '영차 버튼을 콕콕콕! 친구들이랑 같이 당겨요', kid: '영차 버튼을 콕콕콕! 우리 쪽으로 끌어오면 이겨요' },
  howto: '이긴 판 수 → 매듭 위치 순으로 순위 · 한 판 끝나면 매듭이 가운데로 돌아가요',
  lateJoin: true,
  create(ctx) {
    const C = clock(); const lim = new TapLimiter(12); const teams = ctx.teams.slice();
    const k = teams.length; const dir = {}; teams.forEach((t, i) => { const a = k === 2 ? (i ? Math.PI : 0) : -Math.PI / 2 + (i * 2 * Math.PI) / k; dir[t] = [Math.cos(a), Math.sin(a)]; });
    const P = new Map(); const T = {}; for (const t of teams) T[t] = { wins: 0, acc: 0, rate: 0, taps: 0 };
    const add = (p) => { if (!P.has(p.id)) P.set(p.id, { id: p.id, team: p.team, taps: 0 }); };
    ctx.players.forEach(add);
    let x = 0, y = 0, pauseUntil = 0, lastWin = null, round = 1; const WIN = 1;
    const members = (t) => { let n = 0; for (const p of P.values()) if (p.team === t) n++; return n; };
    const proj = (t) => (dir[t] ? x * dir[t][0] + y * dir[t][1] : 0);
    return {
      addPlayer(p) { add(p); }, shift: C.shift,
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'pull' || !intIn(m.n, 1, 8) || !T[p.team]) return;
        const n = lim.take(pid, m.n, now ?? Date.now()); if (!n) return; p.taps += n; T[p.team].acc += n; T[p.team].taps += n;
      },
      tick(now) {
        const dt = C.dt(now); if (!dt) return;
        // 1인당 연타 속도 (지난 약 1초 평균)
        for (const t of teams) { const tm = T[t]; const m = Math.max(1, members(t)); const inst = tm.acc / m / dt; tm.acc = 0; tm.rate += (inst - tm.rate) * Math.min(1, dt * 2.5); }
        if (C.T < pauseUntil) return;
        let fx = 0, fy = 0; for (const t of teams) { if (!members(t)) continue; fx += dir[t][0] * T[t].rate; fy += dir[t][1] * T[t].rate; }
        x += fx * 0.055 * dt; y += fy * 0.055 * dt;
        const r = Math.hypot(x, y); if (r > WIN * 1.05) { x *= (WIN * 1.05) / r; y *= (WIN * 1.05) / r; }
        for (const t of teams) if (members(t) && proj(t) >= WIN) { T[t].wins++; lastWin = { t, at: C.T, round }; round++; x = 0; y = 0; pauseUntil = C.T + 2; ctx.dirtyAll(); break; }
        if (now - (this._v || 0) > 250) { this._v = now; ctx.dirtyAll(); }
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'tug', spectator: true };
        const order = teams.filter((t) => members(t)).sort((a, b) => T[b].wins - T[a].wins || proj(b) - proj(a));
        return { g: 'tug', k: round1(proj(p.team) * 100) / 100, wins: T[p.team].wins, rank: order.indexOf(p.team) + 1, n: order.length, mine: p.taps, rate: round1(T[p.team].rate), pause: C.T < pauseUntil ? (lastWin?.t === p.team ? 'win' : 'lose') : null, round };
      },
      screen() {
        const o = {}; for (const t of teams) o[t] = { w: T[t].wins, r: round1(T[t].rate), p: round1(proj(t) * 100) / 100, n: members(t) };
        return { x: round1(x * 100) / 100, y: round1(y * 100) / 100, t: o, k, dirs: dir, win: lastWin && C.T - lastWin.at < 2 ? lastWin.t : null, round, team: Object.fromEntries(teams.map((t) => [t, round1(T[t].wins + Math.max(0, proj(t)) * 0.9)])) };
      },
      finish() {
        const players = {}; const teamsOut = {}; const teamLabel = {};
        for (const t of teams) { if (!members(t)) continue; teamsOut[t] = round1(T[t].wins * 10 + Math.max(0, proj(t)) * 9); teamLabel[t] = `${T[t].wins}승`; }
        const mx = Math.max(1, ...[...P.values()].map((p) => p.taps));
        for (const p of P.values()) if (p.taps) players[p.id] = { raw: p.taps, norm: round1((p.taps / mx) * 100), show: `영차 ${p.taps}번` };
        return { players, teams: teamsOut, teamLabel };
      },
    };
  },
};

// ---------------- 멀리뛰기: ① 연타로 달리기 속도 ② 발구르기 선 바로 앞에서 콕 ③ 45°쯤에서 콕 → 기록(m) · 3번 뛰어 최고 기록
// 폰이 세 단계 타이밍을 재서 보내고(컬링·투호처럼), 서버가 범위를 확인한 뒤 같은 식으로 거리를 계산
export const LJ_TRIES = 3;
export function ljDist(spd, bd, ang, lv = 2) {
  // spd 0~1 · bd: 선까지 남은 거리(0이 최고, 음수 = 파울) · ang: 도약 각도(도)
  if (bd < 0) return 0;
  const bf = clamp(1 - bd * 2.2, 0.35, 1); const af = Math.max(0.3, Math.sin((2 * clamp(ang, 5, 85) * Math.PI) / 180));
  const top = [4.2, 5.0, 6.2, 7.2, 7.8, 8.4][clamp(lv, 0, 5)];
  return Math.round((0.6 + (top - 0.6) * Math.pow(clamp(spd, 0, 1), 0.85) * bf * af) * 100) / 100;
}
export const ljump = {
  id: 'ljump', no: 104, name: '멀리뛰기', emoji: '🦘',
  dur: { kid: 45, elem: 45, adult: 45 },
  rule: { all: '① 버튼 연타로 빠르게 달려요 ② 발구르기 선 바로 앞에서 "점프" ③ 각도 바늘이 45° 근처일 때 콕! 선을 넘으면 파울 · 3번 중 최고 기록', baby: '콕콕콕 달리다가 선 앞에서 점프!', kid: '콕콕콕 빨리 달리고, 선 앞에서 점프! 바늘이 가운데 오면 콕' },
  howto: '3번 뛰어 가장 멀리 뛴 기록으로 순위 · 선을 넘으면 파울(0m)',
  lateJoin: true,
  create(ctx) {
    const P = new Map(); const add = (p) => { if (!P.has(p.id)) P.set(p.id, { id: p.id, team: p.team, name: p.name, lv: p.lv, tries: [], last: 0 }); };
    ctx.players.forEach(add);
    let fresh = [];
    const best = (p) => (p.tries.length ? Math.max(...p.tries) : null);
    return {
      addPlayer(p) { add(p); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'jump' || p.tries.length >= LJ_TRIES || m.i !== p.tries.length) return;
        if (!numIn(m.spd, 0, 1) || !numIn(m.bd, -1, 1) || !numIn(m.ang, 0, 90)) return;
        const t = now ?? Date.now(); if (t - p.last < 2500) return; p.last = t; // 한 번 뛰는 데 최소 2.5초 (달리기 단계)
        const d = ljDist(m.spd, m.bd, m.ang, p.lv); p.tries.push(d); fresh.push([p.team, p.name, d]);
        ctx.dirty(pid);
        return { d, foul: m.bd < 0, i: p.tries.length, best: best(p) };
      },
      tick(now) { if (now - (this._v || 0) > 1000) { this._v = now; ctx.dirtyAll(); } },
      view(pid) { const p = P.get(pid); if (!p) return { g: 'ljump', spectator: true }; return { g: 'ljump', tries: p.tries, best: best(p), lv: p.lv, max: LJ_TRIES }; },
      screen() {
        const f = fresh; fresh = [];
        const top = [...P.values()].filter((p) => p.tries.length).sort((a, b) => best(b) - best(a)).slice(0, 5).map((p) => [p.name, best(p), p.team]);
        return { add: f, top, avg: avgBy(P, (p) => best(p), ctx.teams) };
      },
      finish() {
        const players = {}; for (const p of P.values()) { const b = best(p); if (b == null) continue; players[p.id] = { raw: b, norm: round1(clamp((b / 8.4) * 100, 0, 100)), show: `${b.toFixed(2)}m${p.tries.includes(0) ? ` (파울 ${p.tries.filter((x) => x === 0).length})` : ''}` }; }
        return { players };
      },
    };
  },
};

// ---------------- 볼링: 레인 아래에서 위로 쓱 밀어 굴리기 (출발 위치·방향·힘) · 한 프레임 2번 · 스트라이크 +10, 스페어 +5 보너스
export const bowl = {
  id: 'bowl', no: 105, name: '볼링', emoji: '🎳',
  dur: { kid: 50, elem: 55, adult: 60 },
  rule: { all: '공을 잡고 위로 쓱 밀어 굴려요. 출발 위치·방향·세기로 핀을 노려요. 맨 앞 핀 바로 옆(포켓)을 세게 맞히면 스트라이크!', baby: '공을 위로 쓱! 핀을 넘어뜨려요', kid: '공을 위로 쓱 밀어요. 가운데 조금 옆을 노려 봐요' },
  howto: '넘어뜨린 핀 수 + 스트라이크 10점·스페어 5점 보너스 · 한 프레임에 2번 굴려요',
  lateJoin: true,
  create(ctx) {
    const P = new Map(); const add = (p) => { if (!P.has(p.id)) P.set(p.id, { id: p.id, team: p.team, name: p.name, f: 1, r: 0, stand: [...Array(10).keys()], total: 0, pins: 0, st: 0, sp: 0, last: 0, rolled: false }); };
    ctx.players.forEach(add);
    let fresh = [];
    return {
      addPlayer(p) { add(p); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'roll' || m.f !== p.f || m.r !== p.r) return;
        if (!numIn(m.x, -1, 1) || !numIn(m.ang, -0.35, 0.35) || !numIn(m.pow, 0.2, 1)) return;
        const t = now ?? Date.now(); if (t - p.last < 1800) return; p.last = t; p.rolled = true; // 굴러가는 동안 다시 못 굴림
        const res = bowlRoll(p.stand, m.x, m.ang, m.pow); const n = res.down.length; p.pins += n; p.total += n;
        let mark = null; const first = p.r === 0;
        if (first && n === 10) { mark = 'X'; p.st++; p.total += 10; }
        else if (!first && p.stand.length - n === 0) { mark = '/'; p.sp++; p.total += 5; }
        if (mark || !first) { p.f++; p.r = 0; p.stand = [...Array(10).keys()]; } else { p.r = 1; p.stand = p.stand.filter((i) => !res.down.includes(i)); }
        fresh.push([p.team, p.name, n, mark, res.down]); ctx.dirty(pid);
        return { down: res.down, mark, n, total: p.total, f: p.f, r: p.r, stand: p.stand };
      },
      tick(now) { if (now - (this._v || 0) > 1000) { this._v = now; ctx.dirtyAll(); } },
      view(pid) { const p = P.get(pid); if (!p) return { g: 'bowl', spectator: true }; return { g: 'bowl', f: p.f, r: p.r, stand: p.stand, total: p.total, st: p.st, sp: p.sp }; },
      screen() {
        const f = fresh; fresh = [];
        const top = [...P.values()].filter((p) => p.rolled).sort((a, b) => b.total - a.total).slice(0, 5).map((p) => [p.name, p.total, p.team, p.st]);
        return { add: f, top, avg: avgBy(P, (p) => (p.rolled ? p.total : null), ctx.teams) };
      },
      finish() {
        const players = {}; const mx = Math.max(30, ...[...P.values()].map((p) => p.total));
        for (const p of P.values()) if (p.rolled) players[p.id] = { raw: p.total, norm: round1((p.total / mx) * 100), show: `${p.total}점${p.st ? ` · 스트라이크 ${p.st}` : ''}${p.sp ? ` · 스페어 ${p.sp}` : ''}` };
        return { players };
      },
    };
  },
};

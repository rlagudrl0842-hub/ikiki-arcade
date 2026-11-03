// GAME 01~05: 미친 연타왕 / 100m 단체 달리기 / 줄다리기 대전 / 폭탄 돌리기 / 눈치게임
import { rng, rint, shuffle } from './gen.js';
import { LV, TapLimiter, norm, round1, clamp, intIn } from './common.js';

const byTeamAvg = (players, val, teams) => {
  const o = Object.fromEntries(teams.map((t) => [t, { s: 0, n: 0 }]));
  for (const p of players.values()) { const v = val(p); if (v == null || !o[p.team]) continue; o[p.team].s += v; o[p.team].n++; }
  return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x.n ? round1(x.s / x.n) : 0]));
};

// ---------------------------------------------------------------- 01 연타왕
export const mash = {
  id: 'mash', no: 1, name: '미친 연타왕', emoji: '👆',
  dur: { kid: 15, elem: 20, adult: 30 },
  rule: { all: '화면을 최대한 빨리 연타! 우리 팀 게이지를 끝까지 올려요', kid: '화면을 콩콩콩 많이 눌러요!' },
  howto: '팀원 평균 터치 수로 경쟁 (인원이 달라도 공정)',
  lateJoin: true,
  create(ctx) {
    const cap = { kid: 10, elem: 13, adult: 15 };
    const lim = new TapLimiter(15);
    const P = new Map(ctx.players.map((p) => [p.id, { ...p, taps: 0, active: false }]));
    const lastLead = { id: null, at: 0 };
    return {
      addPlayer(p) { if (!P.has(p.id)) P.set(p.id, { ...p, taps: 0, active: false }); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'tap') return;
        lim.max = cap[p.age];
        const ok = lim.take(pid, clamp(m.n | 0, 0, 30), now);
        if (ok) { p.taps += ok; p.active = true; }
      },
      teamAvg() { return byTeamAvg(P, (p) => (p.active ? p.taps / ({ kid: 0.75, elem: 0.9, adult: 1 }[p.age]) : null), ctx.teams); },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'mash', spectator: true };
        const avg = this.teamAvg();
        const order = Object.entries(avg).sort((a, b) => b[1] - a[1]).map((x) => +x[0]);
        return { g: 'mash', taps: p.taps, teamAvg: avg[p.team] || 0, rank: order.indexOf(p.team) + 1, n: ctx.teams.length };
      },
      tick(now) {
        // 순위가 바뀌면 모두에게 알려 줌 (추월 표시)
        if (now - (this._v || 0) > 400) { this._v = now; ctx.dirtyAll(); }
      },
      screen(now) {
        const avg = this.teamAvg();
        const lead = Object.entries(avg).sort((a, b) => b[1] - a[1])[0];
        if (lead && lead[1] > 0 && +lead[0] !== lastLead.id) { lastLead.id = +lead[0]; lastLead.at = now; }
        return { avg, lead: lastLead.id, leadAt: lastLead.at };
      },
      finish() {
        const players = {};
        const sec = ctx.durMs / 1000;
        for (const p of P.values()) {
          if (!p.active) continue;
          const ref = { kid: 9, elem: 11.5, adult: 13.5 }[p.age] * sec; // 최대 인정 속도 근처 → 100점 동점이 잘 안 나옴
          players[p.id] = { raw: p.taps, norm: norm(p.taps, ref), show: `${p.taps}회` };
        }
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 02 100m 달리기
export const race = {
  id: 'race', no: 2, name: '100m 단체 달리기', emoji: '🏃',
  dur: { kid: 25, elem: 30, adult: 30 },
  rule: { all: '왼발·오른발 버튼을 번갈아 눌러 달려요! 같은 발 연속은 무효', kid: '버튼을 눌러서 달려요! 결승선까지 가자!' },
  howto: '팀 평균 거리로 경쟁, 결승 통과가 빠를수록 고득점',
  lateJoin: true,
  create(ctx) {
    const steps = { kid: 55, elem: 75, adult: 95 };
    const cap = { kid: 9, elem: 11, adult: 13 };
    const lim = new TapLimiter(12);
    const P = new Map();
    const add = (p) => P.set(p.id, { ...p, step: 0, last: null, finAt: null, bad: 0, active: false });
    ctx.players.forEach(add);
    const finishOrder = [];
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'step' || p.finAt) return;
        const f = m.f === 'L' ? 'L' : m.f === 'R' ? 'R' : null; if (!f) return;
        lim.max = cap[p.age];
        if (!lim.take(pid, 1, now)) return;
        p.active = true;
        if (p.age !== 'kid' && p.last === f) { p.bad++; return { bad: true }; }
        p.last = f; p.step++;
        if (p.step >= steps[p.age]) { p.finAt = now - this.startAt; finishOrder.push(p.id); if ([...P.values()].every((x) => x.finAt || !x.active) && finishOrder.length >= Math.max(1, P.size * 0.8)) ctx.endEarly(); }
      },
      start(now) { this.startAt = now; },
      shift(ms) { this.startAt += ms; },
      dist(p) { return Math.min(100, (p.step / steps[p.age]) * 100); },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'race', spectator: true };
        return { g: 'race', dist: round1(this.dist(p)), fin: p.finAt, place: p.finAt ? finishOrder.indexOf(pid) + 1 : null, kid: p.age === 'kid', last: p.last };
      },
      tick(now) { if (now - (this._v || 0) > 500) { this._v = now; ctx.dirtyAll(); } },
      screen() {
        const avg = byTeamAvg(P, (p) => (p.active ? this.dist(p) : null), ctx.teams);
        const fin = {}; for (const id of finishOrder) { const p = P.get(id); fin[p.team] = (fin[p.team] || 0) + 1; }
        const top = finishOrder.slice(0, 3).map((id) => ({ name: P.get(id).name, team: P.get(id).team }));
        return { avg, fin, top };
      },
      finish() {
        const players = {};
        const dur = ctx.durMs;
        for (const p of P.values()) {
          if (!p.active) continue;
          const d = this.dist(p);
          const n = p.finAt ? 70 + 30 * clamp(1 - p.finAt / dur, 0, 1) : d * 0.7;
          players[p.id] = { raw: p.finAt ? 100 + round1(30 - p.finAt / 1000) : round1(d), norm: round1(n), show: p.finAt ? `${(p.finAt / 1000).toFixed(1)}초 완주` : `${Math.round(d)}m` };
        }
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 03 줄다리기
// 팀을 2팀(홀수면 마지막은 3팀) 경기로 묶고, 매듭이 상대 쪽으로 끝까지 가면 승리.
// 힘 = 팀원 1인당 터치 속도(연령별 최대 속도 대비 비율) → 인원 많은 팀이 무조건 이기지 않음.
export const tug = {
  id: 'tug', no: 3, name: '줄다리기 대전', emoji: '🪢',
  dur: { kid: 25, elem: 30, adult: 40 },
  rule: { all: '모두 함께 화면을 연타! 1인당 힘으로 계산해서 인원이 적어도 이길 수 있어요', kid: '다 같이 콩콩콩! 줄을 우리 쪽으로 당겨요!' },
  howto: '2팀씩 대결 (팀 수가 홀수면 3팀 대결 1경기)',
  lateJoin: true,
  teamGame: true,
  durFor: null,
  create(ctx) {
    const cap = { kid: 8, elem: 10, adult: 12 };
    const lim = new TapLimiter(12);
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, taps: 0, win: [] });
    ctx.players.forEach(add);
    // 대진: 현재 순위가 비슷한 팀끼리
    const st = ctx.events.standings().rows.map((r) => r.id);
    const order = st.length === ctx.teams.length ? st : ctx.teams.slice();
    const matches = [];
    for (let i = 0; i < order.length; i += 2) {
      if (order.length - i === 3) { matches.push(order.slice(i, i + 3)); break; }
      matches.push(order.slice(i, i + 2));
    }
    const M = matches.map((teams, mi) => ({
      mi, teams, x: 0, y: 0, winner: null, winAt: null,
      dirs: teams.length === 2 ? [[-1, 0], [1, 0]] : [[-0.866, 0.5], [0.866, 0.5], [0, -1]],
    }));
    const matchOf = {}; M.forEach((m) => m.teams.forEach((t) => (matchOf[t] = m)));
    const force = {};
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'tap') return;
        const mt = matchOf[p.team]; if (!mt || mt.winner) return;
        lim.max = cap[p.age];
        const ok = lim.take(pid, clamp(m.n | 0, 0, 30), now);
        if (ok) { p.taps += ok; p.win.push([now, ok / cap[p.age]]); }
      },
      tick(now) {
        // 최근 1초 1인당 힘 계산
        const sum = {}; const cnt = {};
        for (const p of P.values()) {
          while (p.win.length && p.win[0][0] < now - 1000) p.win.shift();
          const v = p.win.reduce((s, x) => s + x[1], 0);
          sum[p.team] = (sum[p.team] || 0) + v;
          if (ctx.events.players.get(p.id)?.online || p.taps) cnt[p.team] = (cnt[p.team] || 0) + 1;
        }
        for (const t of ctx.teams) force[t] = clamp((sum[t] || 0) / Math.max(1, cnt[t] || 0), 0, 1.2);
        for (const m of M) {
          if (m.winner) continue;
          let dx = 0, dy = 0;
          m.teams.forEach((t, i) => { dx += m.dirs[i][0] * force[t]; dy += m.dirs[i][1] * force[t]; });
          m.x += dx * 0.012; m.y += dy * 0.012; // 100ms마다
          const r = Math.hypot(m.x, m.y);
          if (r > 1) { m.x /= r; m.y /= r; }
          m.teams.forEach((t, i) => { if (m.x * m.dirs[i][0] + m.y * m.dirs[i][1] >= 0.98) { m.winner = t; m.winAt = now; } });
        }
        if (M.every((m) => m.winner)) ctx.endEarly();
        if (now - (this._v || 0) > 300) { this._v = now; ctx.dirtyAll(); }
      },
      proj(m, t) { const i = m.teams.indexOf(t); return clamp(m.x * m.dirs[i][0] + m.y * m.dirs[i][1], -1, 1); },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'tug', spectator: true };
        const m = matchOf[p.team];
        return { g: 'tug', teams: m.teams, me: p.team, pos: round1(this.proj(m, p.team) * 100), winner: m.winner, taps: p.taps };
      },
      screen() {
        return { matches: M.map((m) => ({ teams: m.teams, x: round1(m.x * 100) / 100, y: round1(m.y * 100) / 100, winner: m.winner })), force: Object.fromEntries(Object.entries(force).map(([k, v]) => [k, round1(v * 100)])) };
      },
      finish() {
        const teams = {}; const teamLabel = {};
        for (const m of M) for (const t of m.teams) {
          const pr = this.proj(m, t);
          teams[t] = m.winner === t ? 100 : m.winner ? round1(Math.max(0, 45 + pr * 45)) : round1(50 + pr * 49);
          teamLabel[t] = m.winner === t ? '승리' : m.winner ? '패배' : pr > 0 ? '우세' : pr < 0 ? '열세' : '무승부';
        }
        const players = {};
        const sec = ctx.durMs / 1000;
        for (const p of P.values()) if (p.taps) players[p.id] = { raw: p.taps, norm: norm(p.taps, cap[p.age] * 0.7 * sec), show: `${p.taps}회` };
        return { players, teams, teamLabel };
      },
    };
  },
};

// ---------------------------------------------------------------- 04 폭탄 돌리기
// 각 팀마다 폭탄 1개. 폭발 시각은 라운드 시작 때 서버가 정하고 비공개.
// 유아: 넘길 때마다 +10 (폭발해도 감점 없음). 초등: 넘기면 +10, 폭발 때 들고 있으면 -20.
// 성인: 들고 있는 동안 초당 +10씩 '쌓이고', 넘겨야 확정. 들고 있다 터지면 쌓인 점수를 잃음 (위험 선택).
export const bomb = {
  id: 'bomb', no: 4, name: '폭탄 돌리기', emoji: '💣',
  dur: { kid: 45, elem: 50, adult: 60 },
  untimed: true,
  rule: {
    kid: '폭탄이 오면 "넘기기"를 눌러 친구에게 휙! 터져도 괜찮아요',
    elem: '폭탄이 오면 빨리 팀원에게 넘겨요! 터질 때 들고 있으면 -20점',
    adult: '들고 있으면 초당 +10점이 쌓이고, 넘겨야 내 점수로 확정! 들고 있다 터지면 다 잃어요',
  },
  howto: '라운드마다 폭발 시각은 서버가 무작위로 미리 정함 (아무도 모름)',
  create(ctx) {
    const age = ctx.events.dominantAge();
    const rounds = { kid: 3, elem: 3, adult: 4 }[age];
    const fuse = { kid: [7, 12], elem: [5, 12], adult: [5, 15] }[age];
    const r = rng(ctx.seed);
    const P = new Map(ctx.players.map((p) => [p.id, { ...p, pts: 0, passes: 0, booms: 0 }]));
    const T = {}; for (const t of ctx.teams) T[t] = { holder: null, since: 0, boomAt: 0, exploded: false, passes: 0, booms: 0, lastBoomBy: null };
    let round = 0, phase = 'wait', phaseUntil = 0;
    const members = (t) => [...P.values()].filter((p) => p.team === t);
    const onlineMembers = (t) => members(t).filter((p) => ctx.events.players.get(p.id)?.online);
    const pickHolder = (t, not) => {
      const on = onlineMembers(t); const pool = on.length ? on : members(t);
      const c = pool.filter((p) => p.id !== not);
      const arr = c.length ? c : pool;
      return arr.length ? arr[rint(r, arr.length)].id : null;
    };
    const startRound = (now) => {
      round++; phase = 'live';
      for (const t of ctx.teams) {
        const b = T[t];
        b.holder = pickHolder(t, b.lastBoomBy); b.since = now; b.exploded = false;
        b.boomAt = now + Math.round((fuse[0] + r() * (fuse[1] - fuse[0])) * 1000);
      }
      ctx.dirtyAll();
    };
    return {
      start(now) { startRound(now); },
      shift(ms) { for (const t of ctx.teams) { T[t].boomAt += ms; T[t].since += ms; } phaseUntil += ms; },
      addPlayer(p) { if (!P.has(p.id)) P.set(p.id, { ...p, pts: 0, passes: 0, booms: 0 }); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'pass' || phase !== 'live') return;
        const b = T[p.team]; if (!b || b.exploded || b.holder !== pid) return;
        if (now - b.since < (age === 'kid' ? 300 : 500)) return { tooFast: true };
        if (age === 'adult') p.pts += Math.floor((now - b.since) / 100); // 초당 10점
        else p.pts += 10;
        p.passes++; b.passes++;
        const next = pickHolder(p.team, pid);
        b.holder = next; b.since = now;
        if (next) ctx.dirty(next);
        return { passed: true };
      },
      tick(now) {
        if (phase === 'live') {
          for (const t of ctx.teams) {
            const b = T[t];
            if (b.exploded || now < b.boomAt) continue;
            b.exploded = true; b.booms++;
            const h = P.get(b.holder);
            if (h) { h.booms++; b.lastBoomBy = h.id; if (age === 'elem') h.pts -= 20; ctx.dirty(h.id); }
            b.boomName = h?.name || '';
          }
          if (ctx.teams.every((t) => T[t].exploded)) { phase = 'break'; phaseUntil = now + 3500; ctx.dirtyAll(); }
          if (now - (this._v || 0) > 500) { this._v = now; ctx.dirtyAll(); }
        } else if (phase === 'break' && now >= phaseUntil) {
          if (round >= rounds) { phase = 'done'; ctx.endEarly(); } else startRound(now);
        }
      },
      view(pid, now) {
        const p = P.get(pid); if (!p) return { g: 'bomb', spectator: true };
        const b = T[p.team];
        const holding = b.holder === pid && !b.exploded && phase === 'live';
        return { g: 'bomb', round, rounds, phase, holding, holder: P.get(b.holder)?.name || '', exploded: b.exploded, boomName: b.boomName, myBoom: b.exploded && b.holder === pid,
          pts: p.pts, pot: holding && age === 'adult' ? Math.floor((now - b.since) / 100) : 0, since: b.since, age };
      },
      screen(now) {
        return { round, rounds, phase, teams: Object.fromEntries(ctx.teams.map((t) => { const b = T[t]; return [t, { holder: P.get(b.holder)?.name || '', exploded: b.exploded, passes: b.passes, booms: b.booms, hold: b.exploded ? 0 : now - b.since }]; })) };
      },
      finish() {
        const players = {};
        const ref = { kid: 60, elem: 60, adult: 180 }[age];
        for (const p of P.values()) {
          if (!p.passes && !p.booms) continue;
          const raw = Math.max(0, p.pts);
          players[p.id] = { raw, norm: norm(raw, ref), show: `${raw}점 (패스 ${p.passes}${p.booms ? `, 펑 ${p.booms}` : ''})` };
        }
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 05 눈치게임
const KID_PICS = ['🍎', '🍌', '🍇', '🍓', '🍉', '🍑', '🍒', '🥝', '🍍', '🥕', '🌽', '🍋'];
export const nunchi = {
  id: 'nunchi', no: 5, name: '눈치게임', emoji: '👀',
  dur: { kid: 50, elem: 50, adult: 60 },
  untimed: true,
  rule: {
    kid: '그림 하나를 골라요! 다른 친구와 안 겹치면 성공!',
    all: '숫자 하나를 고르세요. 나만 고른 숫자면 성공! 겹치면 실패. 결과는 모두 고른 뒤 동시에 공개',
  },
  howto: '라운드마다 나만의 숫자를 고른 사람 수만큼 팀 점수',
  create(ctx) {
    const age = ctx.events.dominantAge();
    const rounds = age === 'adult' ? 4 : 3;
    const pickMs = age === 'kid' ? 12000 : 10000;
    const P = new Map(ctx.players.map((p) => [p.id, { ...p, ok: 0, tried: 0, pick: null }]));
    const n = P.size;
    const K = clamp(Math.round(n * 0.8), 3, age === 'kid' ? 12 : 40);
    let round = 0, phase = 'wait', until = 0, reveal = null;
    const begin = (now) => { round++; phase = 'pick'; until = now + pickMs; reveal = null; for (const p of P.values()) p.pick = null; ctx.dirtyAll(); };
    const doReveal = (now) => {
      const cnt = {};
      for (const p of P.values()) if (p.pick != null) cnt[p.pick] = (cnt[p.pick] || 0) + 1;
      const team = {};
      for (const p of P.values()) {
        if (p.pick == null) continue;
        p.tried++;
        if (cnt[p.pick] === 1) { p.ok++; team[p.team] = (team[p.team] || 0) + 1; }
      }
      reveal = { cnt, team };
      phase = 'reveal'; until = now + 5000; ctx.dirtyAll();
    };
    return {
      start(now) { begin(now); },
      shift(ms) { until += ms; },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'pick' || phase !== 'pick') return;
        if (p.pick != null) return { locked: true };
        if (!intIn(m.v, 1, K)) return;
        p.pick = m.v;
        if ([...P.values()].every((x) => x.pick != null || !ctx.events.players.get(x.id)?.online)) until = Math.min(until, now + 600);
        return { ok: true };
      },
      tick(now) {
        if (now < until) return;
        if (phase === 'pick') doReveal(now);
        else if (phase === 'reveal') { if (round >= rounds) { phase = 'done'; ctx.endEarly(); } else begin(now); }
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'nunchi', spectator: true };
        return { g: 'nunchi', K, kid: age === 'kid', pics: age === 'kid' ? KID_PICS.slice(0, K) : null, round, rounds, phase, until, pick: p.pick,
          result: phase === 'reveal' && p.pick != null ? (reveal.cnt[p.pick] === 1 ? 'ok' : 'dup') : phase === 'reveal' ? 'none' : null,
          dupWith: phase === 'reveal' && p.pick != null ? reveal.cnt[p.pick] : 0, ok: p.ok };
      },
      screen() {
        const picked = [...P.values()].filter((p) => p.pick != null).length;
        return { K, kid: age === 'kid', pics: age === 'kid' ? KID_PICS.slice(0, K) : null, round, rounds, phase, until, picked, total: P.size,
          reveal: phase === 'reveal' ? reveal : null,
          okTeam: Object.fromEntries(ctx.teams.map((t) => [t, [...P.values()].filter((p) => p.team === t).reduce((s, p) => s + p.ok, 0)])) };
      },
      finish() {
        const players = {};
        for (const p of P.values()) if (p.tried) players[p.id] = { raw: p.ok, norm: round1(age === 'kid' ? ((p.tried * 0.4 + p.ok * 0.6) / rounds) * 100 : (p.ok / rounds) * 100), show: `${p.ok}/${rounds} 성공` }; // 유아는 참여만 해도 점수
        return { players };
      },
    };
  },
};

void shuffle;

// 팀 협동 게임: 한마음 박자 · 팀 릴레이 — 혼자 잘해선 못 이기고 팀이 맞춰야 이기는 게임
import { rng, shuffle } from './gen.js';
import { clamp, round1, numIn, intIn } from './common.js';

function clock() { const c = { T: 0, last: null }; c.dt = (now) => { const d = c.last == null ? 0.1 : clamp((now - c.last) / 1000, 0, 0.25); c.last = now; c.T += d; return d; }; c.shift = (ms) => { if (c.last != null) c.last += ms; }; return c; }
const lvOf = (ctx) => ctx.settings.lv ?? 2;

// ---------------- 한마음 박자: 팀원 모두 같은 박자에 탭! 팀원 중 몇 %가 맞췄는지가 점수
export const sync = {
  id: 'sync', no: 34, name: '한마음 박자', emoji: '🥁', teamGame: true,
  dur: { kid: 40, elem: 45, adult: 45 },
  rule: { all: '북이 "쿵!" 울리는 순간 팀원 모두 같이 탭! 다 같이 맞출수록 점수가 커요. ✋ 쉬는 박자엔 누르면 안 돼요', baby: '북이 쿵! 할 때 다 같이 콕!', kid: '북이 쿵! 할 때 친구들이랑 같이 콕! 눌러요' },
  howto: '박자마다 팀원 중 맞춘 비율 → 평균 · 점점 빨라져요',
  lateJoin: true,
  create(ctx) {
    const r = rng(ctx.seed); const lv = lvOf(ctx); const C = clock();
    const base = [1.25, 1.15, 1.0, 0.9, 0.85, 0.8][lv]; const fast = [1.1, 0.95, 0.75, 0.62, 0.58, 0.55][lv];
    const win = [0.3, 0.27, 0.22, 0.19, 0.18, 0.17][lv];
    const total = ctx.durMs / 1000; const beats = [];
    for (let T = 3; T < total - 0.6;) { const k = T / total; const i = beats.length; beats.push({ T, rest: lv >= 1 && i % 8 === 7 && r() < 0.8 }); T += base + (fast - base) * k; }
    const P = new Map(); const add = (p) => P.set(p.id, { id: p.id, team: p.team, name: p.name, hits: 0, perf: 0, bad: 0, act: false, last: -1 });
    ctx.players.forEach(add);
    const per = beats.map(() => new Map()); // beat → Map(pid → dt)
    const teamStat = Object.fromEntries(ctx.teams.map((t) => [t, { sum: 0, n: 0, full: 0, combo: 0, best: 0 }]));
    let judged = 0; let E0 = 0; const recent = [];
    const nearest = (T) => { let lo = 0, hi = beats.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (beats[m].T < T) lo = m + 1; else hi = m; } const a = beats[lo], b = beats[lo - 1]; return b && Math.abs(b.T - T) < Math.abs(a.T - T) ? lo - 1 : lo; };
    const actTeam = (t) => [...P.values()].filter((p) => p.team === t && p.act);
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); }, shift: C.shift,
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'hit' || !numIn(m.ts, now - 3000, now + 3000)) return;
        p.act = true;
        const T = (m.ts - E0) / 1000; const i = nearest(T); const b = beats[i]; if (!b || i < judged - 1) return;
        const dt = T - b.T; if (Math.abs(dt) > win || p.last === i) return;
        p.last = i;
        if (b.rest) { p.bad++; ctx.sendTo(pid, { run: ctx.runId, r: { k: 'rest' } }); return; }
        per[i].set(pid, dt); p.hits++; if (Math.abs(dt) < win * 0.4) p.perf++;
        ctx.sendTo(pid, { run: ctx.runId, r: { k: Math.abs(dt) < win * 0.4 ? 'perfect' : 'good' } });
      },
      tick(now) {
        C.dt(now); E0 = now - C.T * 1000;
        while (judged < beats.length && C.T > beats[judged].T + win + 0.05) {
          const b = beats[judged]; const hit = per[judged];
          if (!b.rest) for (const t of ctx.teams) {
            const act = actTeam(t); if (!act.length) { teamStat[t].n++; teamStat[t].combo = 0; continue; }
            const n = act.filter((p) => hit.has(p.id)).length; const f = n / act.length; const s = teamStat[t];
            s.sum += f; s.n++; if (f >= 0.999 && act.length >= 1) { s.full++; s.combo++; s.best = Math.max(s.best, s.combo); recent.push([t, b.T]); } else s.combo = 0;
          }
          judged++; ctx.dirtyAll();
        }
        while (recent.length > 12) recent.shift();
        if (now - (this._v || 0) > 800) { this._v = now; ctx.dirtyAll(); }
      },
      view(pid, now) {
        const p = P.get(pid); if (!p) return { g: 'sync', spectator: true };
        const nx = beats.slice(Math.max(0, judged - 1), judged + 6).map((b) => ({ at: Math.round(E0 + b.T * 1000), rest: b.rest }));
        const s = teamStat[p.team]; return { g: 'sync', nx, win: Math.round(win * 1000), hits: p.hits, team: s.n ? Math.round((s.sum / s.n) * 100) : 0, combo: s.combo };
      },
      screen() {
        const nx = beats.slice(judged, judged + 8).map((b) => [round1(b.T), b.rest ? 1 : 0]);
        const team = {}; const combo = {}; const live = {};
        for (const t of ctx.teams) { const s = teamStat[t]; team[t] = s.n ? Math.round((s.sum / s.n) * 100) : 0; combo[t] = s.combo; const a = actTeam(t).length; const lastI = judged - 1; live[t] = a && lastI >= 0 ? Math.round(([...per[lastI].keys()].filter((id) => P.get(id)?.team === t).length / a) * 100) : 0; }
        return { T: round1(C.T), nx, team, combo, live, full: recent.filter((x) => C.T - x[1] < 1.2).map((x) => x[0]), idx: judged, n: beats.length };
      },
      finish() {
        const players = {}; const teams = {}; const teamLabel = {}; const nb = beats.filter((b) => !b.rest).length || 1;
        for (const p of P.values()) { if (!p.act) continue; const rate = clamp((p.hits - p.bad) / nb, 0, 1); players[p.id] = { raw: p.hits, norm: round1(rate * 100), show: `${p.hits}번 맞춤${p.perf ? ` (딱 맞춤 ${p.perf})` : ''}` }; }
        for (const t of ctx.teams) { if (!actTeam(t).length) continue; const s = teamStat[t]; teams[t] = s.n ? round1((s.sum / s.n) * 100) : 0; teamLabel[t] = `한마음 ${Math.round(teams[t])}% · 전원 성공 ${s.full}번`; }
        return { players, teams, teamLabel };
      },
    };
  },
};

// ---------------- 팀 릴레이: 바통 받은 사람만 탭! 다 채우면 다음 친구에게 바통
export const relay = {
  id: 'relay', no: 35, name: '팀 릴레이', emoji: '🏃‍♀️', teamGame: true,
  dur: { kid: 50, elem: 50, adult: 50 },
  rule: { all: '바통을 받은 사람만 빠르게 탭! 게이지를 채우면 다음 친구에게 바통이 넘어가요. 내 차례가 오면 바로 달려요!', baby: '내 차례가 오면 콕콕콕! 친구에게 바통 넘기기', kid: '내 차례가 되면 빨리 콕콕콕! 다 채우면 친구 차례예요' },
  howto: '팀이 이어 달린 거리(구간 수)로 순위 · 3초 동안 안 누르면 다음 친구에게 넘어가요',
  lateJoin: true,
  create(ctx) {
    const r = rng(ctx.seed); const lv = lvOf(ctx); const C = clock();
    const NEED = [8, 10, 14, 16, 18, 18][lv]; const IDLE = lv <= 1 ? 5 : 3.5;
    const P = new Map(); const T = {};
    for (const t of ctx.teams) T[t] = { order: [], i: 0, prog: 0, legs: 0, since: 0, passAt: -9, last: null };
    const add = (p) => { if (P.has(p.id)) return; P.set(p.id, { id: p.id, team: p.team, name: p.name, taps: 0, legs: 0, best: 99, start: 0 }); const tm = T[p.team]; if (tm) tm.order.push(p.id); };
    for (const p of shuffle(r, ctx.players)) add(p);
    const holder = (t) => { const tm = T[t]; return tm.order.length ? tm.order[tm.i % tm.order.length] : null; };
    const pass = (t, done) => { const tm = T[t]; const prev = holder(t); tm.i++; tm.prog = 0; tm.since = C.T; tm.passAt = C.T; tm.last = prev; if (done) tm.legs++; const h = holder(t); if (h) { const q = P.get(h); q.start = C.T; ctx.sendTo(h, { run: ctx.runId, r: { baton: 1 } }); } ctx.dirtyAll(); };
    let started = false;
    return {
      addPlayer(p) { add(p); }, shift: C.shift,
      input(pid, m) {
        const p = P.get(pid); if (!p || m.a !== 'tap' || !intIn(m.n, 1, 8)) return; const tm = T[p.team]; if (!tm || holder(p.team) !== pid) return;
        const n = Math.min(m.n, 8); p.taps += n; tm.prog += n; tm.since = C.T;
        if (tm.prog >= NEED) { p.legs++; const sec = C.T - p.start; if (sec < p.best) p.best = sec; pass(p.team, true); } else ctx.dirty(pid);
      },
      tick(now) {
        C.dt(now);
        if (!started) { started = true; for (const t of ctx.teams) { T[t].since = C.T; const h = holder(t); if (h) { P.get(h).start = C.T; ctx.sendTo(h, { run: ctx.runId, r: { baton: 1 } }); } } ctx.dirtyAll(); }
        for (const t of ctx.teams) { const tm = T[t]; if (tm.order.length > 1 && C.T - tm.since > IDLE) pass(t, false); else if (tm.order.length === 1 && C.T - tm.since > IDLE) tm.since = C.T; }
        if (now - (this._v || 0) > 500) { this._v = now; ctx.dirtyAll(); }
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'relay', spectator: true };
        const tm = T[p.team]; const h = holder(p.team); const L = tm.order.length; const pos = tm.order.indexOf(pid);
        const wait = L ? (pos - (tm.i % L) + L) % L : 0;
        return { g: 'relay', me: h === pid, need: NEED, prog: tm.prog, legs: tm.legs, holder: h ? P.get(h).name : '', wait, idle: round1(Math.max(0, IDLE - (C.T - tm.since))) };
      },
      screen() {
        const o = {};
        for (const t of ctx.teams) { const tm = T[t]; const h = holder(t); const nx = tm.order.length > 1 ? P.get(tm.order[(tm.i + 1) % tm.order.length])?.name : ''; o[t] = { legs: tm.legs, prog: round1(tm.prog / NEED), h: h ? P.get(h).name : '', nx, pass: C.T - tm.passAt < 0.9 ? 1 : 0, n: tm.order.length }; }
        return { T: round1(C.T), t: o, need: NEED, team: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.legs + v.prog])) };
      },
      finish() {
        const players = {}; const teams = {}; const teamLabel = {};
        for (const t of ctx.teams) { const tm = T[t]; if (!tm.order.length) continue; teams[t] = round1(tm.legs + tm.prog / NEED); teamLabel[t] = `${tm.legs}구간 달림`; }
        const mx = Math.max(1, ...[...P.values()].map((p) => p.taps));
        for (const p of P.values()) if (p.taps) players[p.id] = { raw: p.taps, norm: round1((p.taps / mx) * 100), show: `${p.legs}구간${p.best < 99 ? ` · 최고 ${round1(p.best)}초` : ''}` };
        return { players, teams, teamLabel };
      },
    };
  },
};

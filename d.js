// GAME 16~20: 타이밍 탑 쌓기 / 운명의 상자 / 팀 빙고 / 역전 룰렛 / 최후의 왕좌
import crypto from 'node:crypto';
import { rng, rint, shuffle, hashSeed, towerX, towerSpeed } from './gen.js';
import { LV, TapLimiter, norm, round1, clamp, intIn, numIn } from './common.js';
import { mash, tug } from './a.js';
import { mole, reaction } from './b.js';
import { memory, colortrap } from './c.js';

// ---------------------------------------------------------------- 16 타이밍 탑 쌓기
export const tower = {
  id: 'tower', no: 16, name: '타이밍 탑 쌓기', emoji: '🧱',
  dur: { kid: 30, elem: 40, adult: 45 },
  rule: { kid: '움직이는 블록을 톡! 눌러서 높이 높이 쌓아요', all: '좌우로 움직이는 블록을 딱 맞게 멈춰서 쌓으세요! 삐져나간 부분은 잘려 나가요' },
  howto: '시간 안에 쌓은 가장 높은 탑. 완벽하게 겹치면 보너스',
  lateJoin: true,
  create(ctx) {
    const w0 = { kid: 0.6, elem: 0.5, adult: 0.42 };
    const P = new Map();
    const add = (p) => P.set(p.id, { ...p, k: 0, left: (1 - w0[p.age]) / 2, w: w0[p.age], best: 0, perfect: 0, towers: 0, lastAt: null, active: false });
    ctx.players.forEach(add);
    const reset = (p) => { p.k = 0; p.left = (1 - w0[p.age]) / 2; p.w = w0[p.age]; p.towers++; };
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'drop' || m.k !== p.k || m.tw !== p.towers) return;
        if (!numIn(m.ms, 150, 60000)) return;
        // 블록이 나온 뒤 서버에서 흐른 시간보다 오래 기다렸다고 주장할 수 없음
        if (p.lastAt != null && m.ms > now - p.lastAt + 400) return { sus: true };
        p.active = true; p.lastAt = now;
        const x = towerX(m.ms, towerSpeed(LV[p.age], p.k), p.w);
        const a = Math.max(x, p.left), b = Math.min(x + p.w, p.left + p.w);
        let ov = b - a;
        let perfect = false;
        if (Math.abs(x - p.left) < (p.age === 'kid' ? 0.03 : 0.015)) { perfect = true; ov = p.w; p.perfect++; }
        if (ov < 0.02) { const h = p.k; reset(p); return { miss: true, height: h, best: p.best, tw: p.towers }; }
        p.k++; p.left = perfect ? p.left : a; p.w = ov;
        p.best = Math.max(p.best, p.k);
        return { ok: true, k: p.k, left: p.left, w: p.w, perfect, best: p.best };
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'tower', spectator: true };
        return { g: 'tower', k: p.k, left: p.left, w: p.w, best: p.best, speed: towerSpeed(LV[p.age], p.k), lv: LV[p.age], tw: p.towers };
      },
      screen() {
        const tm = {}; const c = {};
        for (const p of P.values()) { if (!p.active) continue; tm[p.team] = (tm[p.team] || 0) + Math.max(p.best, p.k); c[p.team] = (c[p.team] || 0) + 1; }
        const top = [...P.values()].filter((p) => p.active).sort((a, b) => b.best - a.best).slice(0, 5).map((p) => ({ name: p.name, team: p.team, best: p.best }));
        return { avg: Object.fromEntries(ctx.teams.map((t) => [t, c[t] ? round1(tm[t] / c[t]) : 0])), top };
      },
      finish() {
        const players = {};
        const ref = { kid: 8, elem: 12, adult: 15 };
        for (const p of P.values()) if (p.active) players[p.id] = { raw: p.best + p.perfect * 0.3, norm: norm(p.best + p.perfect * 0.3, ref[p.age]), show: `${p.best}층` };
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 17 운명의 상자
const BOXSET = {
  kid: [{ v: 100, l: '⭐⭐⭐' }, { v: 60, l: '⭐⭐' }, { v: 60, l: '⭐⭐' }, { v: 30, l: '⭐' }],
  elem: [{ v: 100, l: '보너스 +100' }, { v: 50, l: '+50' }, { v: 50, l: '+50' }, { v: 20, l: '+20' }, { v: -30, l: '위험 -30' }],
  adult: [{ v: 150, l: '대박 +150' }, { v: 80, l: '+80' }, { v: 50, l: '+50' }, { v: 0, l: '꽝 0' }, { v: -60, l: '폭탄 -60' }],
};
export const fatebox = {
  id: 'fatebox', no: 17, name: '운명의 상자', emoji: '🎁',
  dur: { kid: 45, elem: 45, adult: 45 },
  untimed: true,
  rule: { kid: '상자 하나를 골라요! 별이 몇 개 나올까?', all: '상자 하나를 고르세요! 상자 내용과 확률은 미리 공개되고, 시작 전에 서버가 봉인합니다' },
  howto: '3라운드 합계. 1게임 순위 포인트만큼만 반영되어 운으로 전체가 뒤집히지 않아요',
  create(ctx) {
    const age = ctx.events.dominantAge();
    const set = BOXSET[age];
    const rounds = 3;
    const r = rng(ctx.seed);
    const P = new Map(ctx.players.map((p) => [p.id, { ...p, pick: null, pts: 0, got: [] }]));
    let round = 0, phase = 'wait', until = 0, boxes = null, salt = '', seal = '';
    const begin = (now) => {
      round++; phase = 'pick'; until = now + 9000;
      boxes = shuffle(r, set.map((_, i) => i)); salt = crypto.randomBytes(6).toString('hex');
      seal = crypto.createHash('sha256').update(JSON.stringify(boxes) + salt).digest('hex').slice(0, 10);
      for (const p of P.values()) p.pick = null; ctx.dirtyAll();
    };
    const reveal = (now) => {
      for (const p of P.values()) { if (p.pick == null) continue; const v = set[boxes[p.pick]].v; p.pts += v; p.got.push(v); }
      phase = 'reveal'; until = now + 4500; ctx.dirtyAll();
    };
    return {
      start(now) { begin(now); },
      shift(ms) { until += ms; },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'pick' || phase !== 'pick' || p.pick != null) return;
        if (!intIn(m.v, 0, set.length - 1)) return;
        p.pick = m.v;
        if ([...P.values()].every((x) => x.pick != null || !ctx.events.players.get(x.id)?.online)) until = Math.min(until, now + 600);
        return { ok: true };
      },
      tick(now) {
        if (now < until) return;
        if (phase === 'pick') reveal(now);
        else if (phase === 'reveal') { if (round >= rounds) { phase = 'done'; ctx.endEarly(); } else begin(now); }
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'fatebox', spectator: true };
        return { g: 'fatebox', n: set.length, list: set.map((b) => b.l), round, rounds, phase, until, seal, pick: p.pick, pts: p.pts,
          open: phase === 'reveal' ? boxes.map((i) => set[i].l) : null, mine: phase === 'reveal' && p.pick != null ? set[boxes[p.pick]] : null, kid: age === 'kid' };
      },
      screen() {
        const cnt = set.map(() => 0); for (const p of P.values()) if (p.pick != null) cnt[p.pick]++;
        return { n: set.length, list: set.map((b) => b.l), round, rounds, phase, until, seal, cnt, salt: phase === 'reveal' ? salt : null,
          open: phase === 'reveal' ? boxes.map((i) => set[i]) : null,
          team: Object.fromEntries(ctx.teams.map((t) => { const a = [...P.values()].filter((p) => p.team === t && p.got.length); return [t, a.length ? Math.round(a.reduce((s, p) => s + p.pts, 0) / a.length) : 0]; })) };
      },
      finish() {
        const players = {};
        const ref = { kid: 300, elem: 300, adult: 450 }[age];
        for (const p of P.values()) if (p.got.length) players[p.id] = { raw: p.pts, norm: norm(Math.max(0, p.pts), ref), show: `${p.pts}점` };
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 18 팀 빙고
const FIND = ['🐶', '🐱', '🐰', '🐻', '🐼', '🐸', '🐵', '🦁', '🐯', '🐮', '🐷', '🐔'];
const COLORS = [['빨강', '#ff4d4d', '●'], ['파랑', '#3d8bff', '■'], ['노랑', '#ffd43b', '▲'], ['초록', '#2fd27a', '★'], ['보라', '#b06bff', '◆'], ['주황', '#ff922b', '♥']];
function mission(r, age) {
  const t = rint(r, 4);
  if (t === 0) return { type: 'tap', n: { kid: 8, elem: 15, adult: 22 }[age], q: '빠르게 연타!' };
  if (t === 1) {
    if (age === 'kid') { const n = 1 + rint(r, 5); return { type: 'choice', q: `${'🍎'.repeat(n)}\n몇 개일까요?`, opts: [1, 2, 3, 4, 5], ans: n - 1 }; }
    let a, b, ans, q;
    if (age === 'elem') { a = 2 + rint(r, 12); b = 2 + rint(r, 9); ans = a + b; q = `${a} + ${b} = ?`; }
    else { a = 3 + rint(r, 9); b = 3 + rint(r, 7); const c = 1 + rint(r, 9); ans = a * b - c; q = `${a} × ${b} − ${c} = ?`; }
    const opts = shuffle(r, [ans, ans + 1 + rint(r, 3), ans - 1 - rint(r, 3), ans + 10]);
    return { type: 'choice', q, opts, ans: opts.indexOf(ans) };
  }
  if (t === 2) {
    const pool = shuffle(r, FIND).slice(0, age === 'adult' ? 8 : 6);
    const target = pool[rint(r, pool.length)];
    return { type: 'choice', q: `${target} 찾기!`, opts: shuffle(r, pool), ans: null, target };
  }
  const k = rint(r, 6); const opts = shuffle(r, [0, 1, 2, 3, 4, 5]).slice(0, 4); if (!opts.includes(k)) opts[rint(r, 4)] = k;
  return { type: 'color', q: age === 'kid' ? `${COLORS[k][2]} ${COLORS[k][0]} 찾기!` : `${COLORS[k][0]}색 누르기!`, opts: opts.map((i) => ({ hex: COLORS[i][1], sh: COLORS[i][2], name: COLORS[i][0] })), ans: opts.indexOf(k), stroop: age === 'adult' };
}
export const bingo = {
  id: 'bingo', no: 18, name: '팀 빙고', emoji: '🎯',
  dur: { kid: 90, elem: 100, adult: 100 },
  teamGame: true,
  rule: { kid: '친구들과 칸을 하나씩 골라 미션 성공! 한 줄을 먼저 채우면 빙고!', all: '팀원들이 나눠서 칸을 골라 미션을 깨세요. 한 줄(가로·세로·대각선)을 먼저 완성한 팀이 1등! 다른 팀원이 잡은 칸은 15초간 잠겨요' },
  howto: '빙고 순서 + 완성 줄 수 + 연 칸 수로 순위',
  create(ctx) {
    const age = ctx.events.dominantAge();
    const S = age === 'kid' || (age === 'elem' && ctx.settings.elemLevel !== 'high') ? 3 : 4;
    const r = rng(ctx.seed);
    const lim = new TapLimiter(14);
    const P = new Map(ctx.players.map((p) => [p.id, { ...p, cells: 0, cool: 0, tap: null }]));
    const T = {};
    for (const t of ctx.teams) {
      const cells = []; for (let i = 0; i < S * S; i++) { const m = mission(r, age); if (m.target) m.ans = m.opts.indexOf(m.target); cells.push({ m, done: null, lock: null, lockUntil: 0 }); }
      T[t] = { cells, lines: 0, bingoAt: null, order: null };
    }
    const lines = []; for (let i = 0; i < S; i++) { lines.push([...Array(S)].map((_, j) => i * S + j)); lines.push([...Array(S)].map((_, j) => j * S + i)); }
    lines.push([...Array(S)].map((_, j) => j * S + j)); lines.push([...Array(S)].map((_, j) => j * S + (S - 1 - j)));
    let bingoN = 0;
    const complete = (t, c, p, now) => {
      const b = T[t]; b.cells[c].done = p.name; b.cells[c].lock = null; p.cells++;
      b.lines = lines.filter((l) => l.every((i) => b.cells[i].done)).length;
      if (b.lines && b.bingoAt == null) { b.bingoAt = now - inst.t0; b.order = ++bingoN; }
      for (const q of P.values()) if (q.team === t) ctx.dirty(q.id);
      if (ctx.teams.every((x) => T[x].bingoAt != null)) ctx.endEarly();
    };
    const inst = {
      start(now) { inst.t0 = now; },
      shift(ms) { inst.t0 += ms; },
      input(pid, m, now) {
        const p = P.get(pid); if (!p) return;
        const b = T[p.team]; if (!intIn(m.c, 0, S * S - 1)) return;
        const cell = b.cells[m.c]; if (cell.done) return;
        if (m.a === 'open') {
          if (now < p.cool) return { cool: p.cool };
          if (cell.lock && cell.lock !== pid && now < cell.lockUntil) return { taken: true };
          for (const c of b.cells) if (c.lock === pid && c !== cell) c.lock = null; // 한 번에 한 칸
          cell.lock = pid; cell.lockUntil = now + 15000; p.tap = { c: m.c, n: 0 };
          for (const q of P.values()) if (q.team === p.team) ctx.dirty(q.id);
          const mm = cell.m;
          return { mission: { c: m.c, type: mm.type, q: mm.q, opts: mm.opts, n: mm.n, stroop: mm.stroop } };
        }
        if (cell.lock !== pid || now > cell.lockUntil) return { expired: true };
        if (m.a === 'tapm' && cell.m.type === 'tap') {
          const ok = lim.take(pid, clamp(m.n | 0, 0, 30), now); p.tap.n += ok;
          if (p.tap.n >= cell.m.n) { complete(p.team, m.c, p, now); return { done: m.c }; }
          return { prog: p.tap.n };
        }
        if (m.a === 'solve' && cell.m.type !== 'tap') {
          if (m.v === cell.m.ans) { complete(p.team, m.c, p, now); return { done: m.c }; }
          cell.lock = null; p.cool = now + 2000;
          for (const q of P.values()) if (q.team === p.team) ctx.dirty(q.id);
          return { wrong: true, cool: p.cool };
        }
      },
      tick(now) { if (now - (inst._v || 0) > 1000) { inst._v = now; ctx.dirtyAll(); } },
      board(t, pid, now) { return T[t].cells.map((c) => (c.done ? 2 : c.lock && now < c.lockUntil ? (c.lock === pid ? 3 : 1) : 0)); },
      view(pid, now) {
        const p = P.get(pid); if (!p) return { g: 'bingo', spectator: true };
        const b = T[p.team];
        return { g: 'bingo', S, board: inst.board(p.team, pid, now), lines: b.lines, order: b.order, cool: p.cool, kid: age === 'kid' };
      },
      screen(now) {
        return { S, teams: Object.fromEntries(ctx.teams.map((t) => [t, { board: inst.board(t, null, now), lines: T[t].lines, order: T[t].order, at: T[t].bingoAt }])) };
      },
      finish() {
        const teams = {}; const teamLabel = {};
        const bonus = [0, 40, 25, 15, 8];
        for (const t of ctx.teams) {
          const b = T[t]; const cells = b.cells.filter((c) => c.done).length;
          teams[t] = round1(b.lines * 25 + cells * 3 + (b.order ? bonus[b.order] ?? 5 : 0));
          teamLabel[t] = b.order ? `${b.order}번째 빙고 · ${b.lines}줄` : `${cells}칸`;
        }
        const players = {};
        for (const p of P.values()) if (p.cells) players[p.id] = { raw: p.cells, norm: round1(clamp(p.cells * 20, 0, 100)), show: `${p.cells}칸 성공` };
        return { players, teams, teamLabel };
      },
    };
    return inst;
  },
};

// ---------------------------------------------------------------- 19 역전 룰렛
export const roulette = {
  id: 'roulette', no: 19, name: '역전 룰렛', emoji: '🎡',
  dur: { kid: 40, elem: 40, adult: 40 },
  untimed: true,
  bonusOnly: true,
  rule: { all: '팀 대표가 룰렛을 돌려 보너스 점수를 받아요! 순위가 낮은 팀일수록 더 큰 보너스 판을 받아요' },
  howto: '보너스 최대치는 1위 팀 총점의 일정 비율로 제한 (관리자 설정)',
  create(ctx) {
    const r = rng(ctx.seed);
    const st = ctx.events.standings().rows;
    const maxTotal = Math.max(0, ...st.map((x) => x.total));
    const cap = Math.max(10, Math.round((maxTotal * (ctx.settings.rouletteCapPct ?? 10)) / 100));
    const FR = [0, 0.25, 0.5, 0.75, 1, 0.5, 0.25, 0.75];
    const N = st.length;
    const T = {};
    for (const row of st) {
      const m = N > 1 ? 0.5 + 0.5 * ((row.rank - 1) / (N - 1)) : 1;
      const seg = FR.map((f) => Math.round(cap * m * f));
      T[row.id] = { seg, max: Math.round(cap * m), out: rint(r, seg.length), spunAt: null, by: null };
    }
    const P = new Map(ctx.players.map((p) => [p.id, { ...p }]));
    let autoAt = 0;
    const spin = (t, name, now) => { const b = T[t]; if (b.spunAt) return; b.spunAt = now; b.by = name; for (const q of P.values()) if (q.team === t) ctx.dirty(q.id); };
    const canSpin = (p) => { const rep = [...P.values()].find((q) => q.team === p.team && q.rep && ctx.events.players.get(q.id)?.online); return !rep || rep.id === p.id; };
    return {
      start(now) { autoAt = now + 20000; this.t0 = now; },
      shift(ms) { autoAt += ms; },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'spin') return;
        if (!canSpin(p)) return { notRep: true };
        spin(p.team, p.name, now); return { ok: true };
      },
      tick(now) {
        if (now >= autoAt) for (const t of ctx.teams) spin(t, '자동', now);
        const all = ctx.teams.every((t) => T[t].spunAt);
        if (all && !this.doneAt) this.doneAt = Math.max(...ctx.teams.map((t) => T[t].spunAt)) + 6000;
        if (this.doneAt && now >= this.doneAt) ctx.endEarly();
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'roulette', spectator: true };
        const b = T[p.team];
        return { g: 'roulette', seg: b.seg, max: b.max, spunAt: b.spunAt, out: b.spunAt ? b.out : null, can: canSpin(p) && !b.spunAt, by: b.by, autoAt };
      },
      screen() {
        return { cap, autoAt, teams: Object.fromEntries(ctx.teams.map((t) => [t, { seg: T[t].seg, max: T[t].max, spunAt: T[t].spunAt, out: T[t].spunAt ? T[t].out : null, by: T[t].by }])) };
      },
      finish(now) {
        const bonus = [];
        for (const t of ctx.teams) {
          const b = T[t]; if (!b.spunAt) spin(t, '자동', now);
          const v = b.seg[b.out]; if (v > 0) bonus.push({ team: t, delta: v, reason: `역전 룰렛 #${ctx.runId}` });
        }
        return { players: {}, noPoints: true, bonus, extra: { roulette: Object.fromEntries(ctx.teams.map((t) => [t, T[t].seg[T[t].out]])) } };
      },
    };
  },
};

// ---------------------------------------------------------------- 20 최후의 왕좌 (결승전)
export const throne = {
  id: 'throne', no: 20, name: '최후의 왕좌', emoji: '👑',
  dur: { kid: 110, elem: 140, adult: 150 },
  untimed: true,
  teamGame: true,
  rule: { all: '5라운드 결승전! 연타 → 순발력 → 기억력 → 팀 협동 → 최종 결승. 라운드 점수가 쌓이고, 마지막 라운드는 2배!' },
  howto: '라운드마다 팀 순위 포인트 누적 (5라운드 2배)',
  create(ctx) {
    const age = ctx.events.dominantAge();
    const plan = age === 'kid'
      ? [[mash, 10, 1, '연타'], [mole, 15, 1, '두더지'], [colortrap, 15, 1, '색깔'], [tug, 20, 1, '팀 협동'], [mash, 12, 2, '최종 결승']]
      : [[mash, 10, 1, '연타'], [reaction, null, 1, '반응속도'], [memory, 30, 1, '기억력'], [tug, 20, 1, '팀 협동'], [mash, 15, 2, '최종 결승']];
    const N = ctx.teams.length;
    const pts = Object.fromEntries(ctx.teams.map((t) => [t, 0]));
    const pnorm = {};
    const results = [];
    let ri = -1, sub = null, phase = 'wait', until = 0, subEnd = 0;
    const self = {};
    const mkSub = (now) => {
      const [def, dur, , label] = plan[ri];
      const sctx = { ...ctx, seed: hashSeed(ctx.seed, 'throne', ri), durMs: (dur || 30) * 1000, item: { ...ctx.item, rounds: 3 }, runId: ctx.runId,
        endEarly: () => { if (phase === 'play') endSub(Date.now()); } };
      sub = def.create(sctx); sub.def = def; sub.label = label;
      sub.start?.(now);
      subEnd = def.untimed ? now + 60000 : now + sctx.durMs;
      phase = 'play'; ctx.dirtyAll();
    };
    const teamMetric = (res) => {
      if (res.teams) return res.teams;
      const s = {}; const c = {};
      for (const [pid, v] of Object.entries(res.players || {})) { const p = ctx.events.players.get(pid); if (!p) continue; s[p.team] = (s[p.team] || 0) + v.norm; c[p.team] = (c[p.team] || 0) + 1; pnorm[pid] = (pnorm[pid] || []).concat(v.norm); }
      return Object.fromEntries(ctx.teams.map((t) => [t, c[t] ? s[t] / c[t] : 0]));
    };
    const endSub = (now) => {
      if (!sub) return;
      const res = sub.finish(now);
      const m = teamMetric(res);
      const sorted = ctx.teams.slice().sort((a, b) => m[b] - m[a]);
      const rk = {}; sorted.forEach((t, i) => { const prev = sorted[i - 1]; rk[t] = prev != null && m[prev] === m[t] ? rk[prev] : i + 1; });
      const w = plan[ri][2];
      const got = {};
      for (const t of ctx.teams) { got[t] = (N - rk[t] + 1) * w; pts[t] += got[t]; }
      results.push({ label: plan[ri][3], rank: rk, got });
      sub = null; phase = 'inter'; until = now + 5000; ctx.dirtyAll();
    };
    Object.assign(self, {
      start(now) { ri = 0; mkSub(now); },
      shift(ms) { until += ms; subEnd += ms; sub?.shift?.(ms); },
      input(pid, m, now) { if (phase !== 'play' || !sub || m.ri !== ri) return; return sub.input(pid, m, now); },
      tick(now) {
        if (phase === 'play' && sub) { sub.tick?.(now); if (now >= subEnd && phase === 'play') endSub(now); }
        else if (phase === 'inter' && now >= until) { ri++; if (ri >= plan.length) { phase = 'done'; ctx.endEarly(); } else mkSub(now); }
      },
      view(pid, now) {
        const base = { g: 'throne', ri, labels: plan.map((x) => x[3]), weights: plan.map((x) => x[2]), phase, until, subEnd, pts, last: results[results.length - 1] || null };
        if (phase === 'play' && sub) base.sub = sub.view(pid, now);
        return base;
      },
      screen(now) {
        const s = { ri, labels: plan.map((x) => x[3]), weights: plan.map((x) => x[2]), phase, until, subEnd, pts, last: results[results.length - 1] || null };
        if (phase === 'play' && sub) { s.sub = { g: sub.def.id, s: sub.screen(now) }; }
        return s;
      },
      finish(now) {
        if (phase === 'play' && sub) endSub(now);
        const teams = {}; const teamLabel = {};
        const maxPts = plan.reduce((s, x) => s + x[2] * N, 0);
        for (const t of ctx.teams) { teams[t] = round1((pts[t] / maxPts) * 100); teamLabel[t] = `${pts[t]}점`; }
        const players = {};
        for (const [pid, arr] of Object.entries(pnorm)) players[pid] = { raw: round1(arr.reduce((s, x) => s + x, 0) / arr.length), norm: round1(arr.reduce((s, x) => s + x, 0) / arr.length), show: `${arr.length}라운드` };
        return { players, teams, teamLabel, extra: { rounds: results } };
      },
    });
    return self;
  },
};

void TapLimiter;

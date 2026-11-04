// 새 게임 ① 대형 화면 아레나 (폰 = 조이스틱)
// 번개를 피해라 / 좀비 술래잡기 / 땅따먹기 페인트
// 모든 위치·판정은 서버가 계산하고, 폰은 방향만 보낸다.
import { rng } from './gen.js';
import { clamp, round1, numIn, by6 } from './common.js';

export const AW = 1600, AH = 860; // 아레나 크기 (서버 좌표)
const SPEED = 330; // 초당 이동 거리

// 공용 아레나: 위치 이동, 시간 관리(일시정지 안전), 화면용 압축
export function arena(ctx, init) {
  const r = rng(ctx.seed);
  const P = new Map();
  const spawn = (p, T = 0) => {
    const s = { ...p, x: 60 + r() * (AW - 120), y: 60 + r() * (AH - 120), ix: 0, iy: 0, active: false, joinT: T, ...init(p) };
    P.set(p.id, s); return s;
  };
  ctx.players.forEach((p) => spawn(p));
  const A = {
    P, r, T: 0, last: null, spawn,
    move(pid, m) {
      const p = P.get(pid); if (!p || m.a !== 'mv') return false;
      if (!numIn(m.x, -1, 1) || !numIn(m.y, -1, 1)) return false;
      let x = m.x, y = m.y; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      p.ix = x; p.iy = y; if (l > 0.1) p.active = true;
      return true;
    },
    // dt 계산 (일시정지 중에는 ticker가 안 돌고, 재개 시 shift로 보정)
    dt(now) { const d = A.last == null ? 0.1 : clamp((now - A.last) / 1000, 0, 0.25); A.last = now; A.T += d; return d; },
    shift(ms) { if (A.last != null) A.last += ms; },
    step(d, speedOf) {
      for (const p of P.values()) {
        const sp = speedOf ? speedOf(p) : SPEED; if (!sp) continue;
        p.x = clamp(p.x + p.ix * sp * d, 14, AW - 14); p.y = clamp(p.y + p.iy * sp * d, 14, AH - 14);
      }
    },
    // [x, y, 팀, 상태] 반복 배열 (300명 ≈ 5KB)
    nm() { A._nm = (A._nm || 0) + 1; return A._nm % 10 === 1 ? [...P.values()].map((p) => p.name) : undefined; },
    pack(stateOf) { const o = []; for (const p of P.values()) o.push(Math.round(p.x), Math.round(p.y), p.team, stateOf(p)); return o; },
    viewTick(now) { if (now - (A._v || 0) >= 190) { A._v = now; ctx.dirtyAll(); } },
  };
  return A;
}
export const teamCount = (P, pred, teams) => { const o = Object.fromEntries(teams.map((t) => [t, 0])); for (const p of P.values()) if (pred(p) && o[p.team] != null) o[p.team]++; return o; };

// ---------------------------------------------------------------- 번개를 피해라
export const dodge = {
  id: 'dodge', no: 1, name: '번개를 피해라', emoji: '⚡',
  dur: { kid: 40, elem: 50, adult: 60 },
  rule: { all: '조이스틱으로 움직여 노란 경고 원을 피하세요! 번개를 맞으면 하트가 하나씩 줄어요', kid: '노란 동그라미가 나오면 밖으로 도망가요!' },
  howto: '살아남은 시간과 남은 하트로 점수 · 폰 화면의 내 위치(큰 점)를 보고 움직여요',
  lateJoin: true,
  create(ctx) {
    const mode = ctx.settings.mode;
    const warnT = by6(ctx.settings.lv, [2.3, 1.8, 1.35, 1.2, 1.1, 1.1]);
    const A = arena(ctx, () => ({ hp: 3, stun: 0, hits: 0, dead: false, aliveT: 0 }));
    const total = ctx.durMs / 1000;
    let nextWave = 1.0, sid = 0;
    const warns = []; // {id, x, y, r, at}
    const booms = []; // 최근 번개 (화면 연출)
    const canDie = (p) => p.age !== 'kid';
    return {
      addPlayer(p) { if (!A.P.has(p.id)) A.spawn(p, A.T); },
      input(pid, m) { const p = A.P.get(pid); if (p && !p.dead) A.move(pid, m); },
      shift: A.shift,
      tick(now) {
        const d = A.dt(now); const T = A.T;
        A.step(d, (p) => (p.dead || p.stun > T ? 0 : SPEED));
        for (const p of A.P.values()) if (!p.dead && p.active) p.aliveT += d;
        const prog = clamp(T / total, 0, 1);
        if (T >= nextWave) {
          const alive = [...A.P.values()].filter((p) => !p.dead && p.active);
          const k = 1 + Math.floor(prog * 3) + Math.floor(A.P.size / 45);
          for (let i = 0; i < k; i++) {
            const rad = 70 + A.r() * 50 + prog * 70;
            let x, y;
            if (alive.length && A.r() < 0.65) { const t = alive[Math.floor(A.r() * alive.length)]; x = t.x + (A.r() - 0.5) * 120; y = t.y + (A.r() - 0.5) * 120; }
            else { x = rad + A.r() * (AW - 2 * rad); y = rad + A.r() * (AH - 2 * rad); }
            warns.push({ id: ++sid, x: Math.round(clamp(x, 40, AW - 40)), y: Math.round(clamp(y, 40, AH - 40)), r: Math.round(rad), at: T + warnT });
          }
          nextWave = T + (1.7 - prog * 0.95) * (mode === 'kid' ? 1.25 : 1);
        }
        for (let i = warns.length - 1; i >= 0; i--) {
          const w = warns[i]; if (T < w.at) continue;
          warns.splice(i, 1); booms.push({ x: w.x, y: w.y, r: w.r, at: T });
          for (const p of A.P.values()) {
            if (p.dead || !p.active || p.stun > T) continue;
            if (Math.hypot(p.x - w.x, p.y - w.y) <= w.r + 10) {
              p.hits++; p.hp = Math.max(0, p.hp - 1); p.stun = T + (canDie(p) ? 1.0 : 1.6);
              if (p.hp === 0 && canDie(p)) { p.dead = true; }
              ctx.sendTo(p.id, { run: ctx.runId, r: { hit: true, hp: p.hp, dead: p.dead } });
            }
          }
        }
        while (booms.length && T - booms[0].at > 0.6) booms.shift();
        // 어른·초등 전원 탈락하면 일찍 끝
        const act = [...A.P.values()].filter((p) => p.active);
        if (act.length >= 2 && act.every((p) => p.dead)) ctx.endEarly();
        A.viewTick(now);
      },
      view(pid) {
        const p = A.P.get(pid); if (!p) return { g: 'dodge', spectator: true };
        const T = A.T;
        return { g: 'dodge', x: Math.round(p.x), y: Math.round(p.y), hp: p.hp, kid: !canDie(p), dead: p.dead, stun: p.stun > T, warn: warns.map((w) => [w.x, w.y, w.r, round1(w.at - T)]), boom: booms.map((b) => [b.x, b.y, b.r]), alive: [...A.P.values()].filter((q) => !q.dead && q.active).length };
      },
      screen() {
        const T = A.T;
        const alive = teamCount(A.P, (p) => !p.dead && p.active, ctx.teams);
        return { nm: A.nm(), ps: A.pack((p) => (p.dead ? 2 : p.stun > T ? 1 : 0)), warn: warns.map((w) => [w.id, w.x, w.y, w.r, round1(w.at - T), warnT]), boom: booms.map((b) => [b.x, b.y, b.r, round1(T - b.at)]), alive, aliveN: Object.values(alive).reduce((a, b) => a + b, 0) };
      },
      finish() {
        const players = {};
        const T = A.T || 1;
        for (const p of A.P.values()) {
          if (!p.active) continue;
          const span = Math.max(1, T - p.joinT);
          let n;
          if (canDie(p)) n = 75 * clamp(p.aliveT / span, 0, 1) + (p.dead ? 0 : 8 + p.hp * 6);
          else n = clamp(100 - p.hits * 10, 10, 100);
          players[p.id] = { raw: round1(p.dead ? p.aliveT : 100 + p.hp), norm: round1(clamp(n, 0, 100)), show: p.dead ? `${Math.round(p.aliveT)}초 생존` : `생존 ❤️${p.hp}` };
        }
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 좀비 술래잡기
export const zombie = {
  id: 'zombie', no: 2, name: '좀비 술래잡기', emoji: '🧟',
  dur: { kid: 45, elem: 60, adult: 60 },
  rule: { all: '처음 몇 명이 좀비! 좀비에게 닿으면 나도 좀비가 돼서 사람을 쫓아가요', kid: '초록 좀비를 피해서 도망가요! 잡히면 나도 좀비!' },
  howto: '사람: 오래 살아남을수록 · 좀비: 많이 잡을수록 점수',
  lateJoin: true,
  create(ctx) {
    const A = arena(ctx, () => ({ z: false, zT: null, tags: 0, humanT: 0, first: false }));
    const all = [...A.P.values()];
    const nz = Math.max(1, Math.round(all.length * (ctx.settings.mode === 'kid' ? 0.07 : 0.09)));
    // 처음 좀비는 무작위 (팀 상관없이)
    const order = all.map((p) => [A.r(), p]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    for (const p of order.slice(0, nz)) { p.z = true; p.zT = 0; p.first = true; }
    const bites = []; // 화면 연출
    const R = 34;
    return {
      addPlayer(p) { if (!A.P.has(p.id)) A.spawn(p, A.T); },
      input(pid, m) { A.move(pid, m); },
      shift: A.shift,
      tick(now) {
        const d = A.dt(now); const T = A.T;
        A.step(d, (p) => (p.z ? SPEED * 1.06 : SPEED));
        // 격자로 가까운 사람만 검사 (300명도 가볍게)
        const G = new Map(); const key = (x, y) => `${Math.floor(x / 80)},${Math.floor(y / 80)}`;
        for (const p of A.P.values()) if (!p.z && p.active) { const k = key(p.x, p.y); if (!G.has(k)) G.set(k, []); G.get(k).push(p); }
        for (const z of A.P.values()) {
          if (!z.z || !z.active || T - z.zT < 0.8) continue; // 막 좀비가 된 사람은 0.8초 대기
          const cx = Math.floor(z.x / 80), cy = Math.floor(z.y / 80);
          for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            for (const h of G.get(`${cx + dx},${cy + dy}`) || []) {
              if (h.z) continue;
              if (Math.hypot(h.x - z.x, h.y - z.y) <= R) {
                h.z = true; h.zT = T; z.tags++;
                bites.push({ x: Math.round(h.x), y: Math.round(h.y), at: T, name: h.name, by: z.name, team: h.team });
                ctx.sendTo(h.id, { run: ctx.runId, r: { bitten: true, by: z.name } });
                ctx.sendTo(z.id, { run: ctx.runId, r: { tag: true, who: h.name } });
              }
            }
          }
        }
        for (const p of A.P.values()) if (!p.z && p.active) p.humanT += d;
        while (bites.length && T - bites[0].at > 2.5) bites.shift();
        const act = [...A.P.values()].filter((p) => p.active);
        if (act.length >= 3 && act.every((p) => p.z)) ctx.endEarly();
        A.viewTick(now);
      },
      view(pid) {
        const p = A.P.get(pid); if (!p) return { g: 'zombie', spectator: true };
        const near = [];
        for (const q of A.P.values()) { if (q === p || !q.active) continue; const dx = q.x - p.x, dy = q.y - p.y; if (Math.abs(dx) < 420 && Math.abs(dy) < 420) near.push(Math.round(q.x), Math.round(q.y), q.z ? 1 : 0); if (near.length > 120) break; }
        let humans = 0, zs = 0; for (const q of A.P.values()) { if (!q.active && !q.z) continue; if (q.z) zs++; else humans++; }
        return { g: 'zombie', x: Math.round(p.x), y: Math.round(p.y), z: p.z, tags: p.tags, near, humans, zs };
      },
      screen() {
        const humans = teamCount(A.P, (p) => !p.z && p.active, ctx.teams);
        return { nm: A.nm(), ps: A.pack((p) => (p.z ? 1 : 0)), humans, humanN: Object.values(humans).reduce((a, b) => a + b, 0), zN: [...A.P.values()].filter((p) => p.z).length, bites: bites.slice(-8).map((b) => [b.x, b.y, round1(A.T - b.at), b.name, b.by, b.team]) };
      },
      finish() {
        const players = {}; const T = A.T || 1;
        for (const p of A.P.values()) {
          if (!p.active && !p.first) continue;
          const span = Math.max(1, T - p.joinT);
          const surv = clamp(p.humanT / span, 0, 1);
          const n = p.first ? 35 + p.tags * 12 : 80 * surv + (p.z ? 0 : 12) + p.tags * 6;
          players[p.id] = { raw: round1(p.z ? p.tags : 100 + surv * 100), norm: round1(clamp(n, 0, 100)), show: p.z ? `🧟 ${p.tags}명 잡음` : '🙂 끝까지 생존' };
        }
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 땅따먹기 페인트
export const paint = {
  id: 'paint', no: 3, name: '땅따먹기 페인트', emoji: '🎨',
  dur: { kid: 40, elem: 45, adult: 50 },
  rule: { all: '지나가는 바닥이 우리 팀 색으로 칠해져요! 남의 땅도 덮어쓸 수 있어요', kid: '이리저리 돌아다니면 바닥이 우리 팀 색이 돼요!' },
  howto: '끝났을 때 우리 팀 땅 넓이 ÷ 인원 (인원이 달라도 공정)',
  lateJoin: true,
  create(ctx) {
    const A = arena(ctx, () => ({ painted: 0, gridAt: -9 }));
    const n = Math.max(2, A.P.size);
    const GC = clamp(Math.round(Math.sqrt(n) * 7), 24, 48); const GR = Math.round(GC * AH / AW);
    const cw = AW / GC, ch = AH / GR;
    const grid = new Int16Array(GC * GR).fill(-1);
    const brush = 46;
    const enc = () => { let s = ''; for (let i = 0; i < grid.length; i++) s += grid[i] < 0 ? '.' : grid[i].toString(36); return s; };
    const owned = () => { const o = Object.fromEntries(ctx.teams.map((t) => [t, 0])); for (const v of grid) if (v >= 0 && o[v] != null) o[v]++; return o; };
    const perHead = () => {
      const o = owned(); const cnt = teamCount(A.P, (p) => p.active, ctx.teams);
      return Object.fromEntries(Object.entries(o).map(([t, c]) => [t, cnt[t] ? round1(c / cnt[t]) : 0]));
    };
    return {
      addPlayer(p) { if (!A.P.has(p.id)) A.spawn(p, A.T); },
      input(pid, m) { A.move(pid, m); },
      shift: A.shift,
      tick(now) {
        const d = A.dt(now);
        A.step(d);
        for (const p of A.P.values()) {
          if (!p.active) continue;
          const x0 = Math.max(0, Math.floor((p.x - brush) / cw)), x1 = Math.min(GC - 1, Math.floor((p.x + brush) / cw));
          const y0 = Math.max(0, Math.floor((p.y - brush) / ch)), y1 = Math.min(GR - 1, Math.floor((p.y + brush) / ch));
          for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
            const cx = (gx + 0.5) * cw, cy = (gy + 0.5) * ch;
            if (Math.hypot(cx - p.x, cy - p.y) > brush) continue;
            const i = gy * GC + gx; if (grid[i] !== p.team) { grid[i] = p.team; p.painted++; }
          }
        }
        A.viewTick(now);
      },
      view(pid) {
        const p = A.P.get(pid); if (!p) return { g: 'paint', spectator: true };
        const v = { g: 'paint', x: Math.round(p.x), y: Math.round(p.y), painted: p.painted, GC, GR, team: p.team };
        if (A.T - p.gridAt >= 0.9) { p.gridAt = A.T; v.grid = enc(); } // 바닥 그림은 1초에 한 번만
        return v;
      },
      screen() {
        const o = owned();
        return { nm: A.nm(), ps: A.pack(() => 0), GC, GR, grid: enc(), owned: o, per: perHead(), total: GC * GR };
      },
      finish() {
        const players = {};
        const per = perHead();
        const maxPer = Math.max(1, ...Object.values(per));
        for (const p of A.P.values()) {
          if (!p.active) continue;
          const ref = (GC * GR) / Math.max(4, A.P.size) * 2.2;
          players[p.id] = { raw: p.painted, norm: round1(clamp((p.painted / ref) * 100, 0, 100)), show: `${p.painted}칸 칠함` };
        }
        const o = owned(); const cnt = teamCount(A.P, (p) => p.active, ctx.teams);
        for (const t of Object.keys(per)) if (!cnt[t]) delete per[t]; // 참가자 없는 팀은 점수 없음
        return { players, teams: per, teamLabel: Object.fromEntries(Object.entries(per).map(([t, v]) => [t, `1인당 ${v}칸 (총 ${o[t]}칸)`])), extra: { maxPer } };
      },
    };
  },
};

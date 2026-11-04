// 새 게임 ④ 2·3차: 아레나 2종 + 손맛 게임(폰에서 플레이, 서버가 속도 상한 검증) + 서버 판정 게임
import { rng, shuffle } from './gen.js';
import { clamp, round1, numIn, intIn, by6 } from './common.js';
import { arena, teamCount, AW, AH } from './n1.js';
import { rhythmChart, BURGER } from './gen2.js';

const avgBy = (P, val, teams) => {
  const o = Object.fromEntries(teams.map((t) => [t, { s: 0, n: 0 }]));
  for (const p of P.values()) { const v = val(p); if (v == null || !o[p.team]) continue; o[p.team].s += v; o[p.team].n++; }
  return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x.n ? round1(x.s / x.n) : 0]));
};

// ---------------------------------------------------------------- 보석 대작전 (아레나)
export const gems = {
  id: 'gems', no: 4, name: '보석 대작전', emoji: '💎',
  dur: { kid: 40, elem: 45, adult: 50 },
  rule: { all: '경기장에 떨어지는 보석을 먼저 차지하세요. 큰 보석일수록 점수가 높아요', baby: '반짝이는 보석 쪽으로 가 보세요' },
  howto: '모은 보석 점수 (팀 평균) · 가끔 나오는 대형 보석은 5점',
  lateJoin: true,
  create(ctx) {
    const A = arena(ctx, () => ({ got: 0, n: 0 }));
    const G = []; let gid = 0; let next = 0;
    const spawn = (big) => G.push({ id: ++gid, x: Math.round(60 + A.r() * (AW - 120)), y: Math.round(60 + A.r() * (AH - 120)), v: big ? 5 : A.r() < 0.25 ? 2 : 1 });
    const fx = [];
    return {
      addPlayer(p) { if (!A.P.has(p.id)) A.spawn(p, A.T); },
      input(pid, m) { A.move(pid, m); },
      shift: A.shift,
      tick(now) {
        const d = A.dt(now); A.step(d);
        const want = Math.max(10, Math.round(A.P.size * 0.6));
        if (A.T >= next) { while (G.length < want) spawn(false); if (A.r() < 0.18) spawn(true); next = A.T + 0.8; }
        for (let i = G.length - 1; i >= 0; i--) {
          const g = G[i]; let who = null, bd = 1e9;
          for (const p of A.P.values()) { if (!p.active) continue; const dd = Math.hypot(p.x - g.x, p.y - g.y); if (dd < 34 + g.v * 3 && dd < bd) { bd = dd; who = p; } }
          if (who) { who.got += g.v; who.n++; G.splice(i, 1); fx.push([g.x, g.y, g.v, who.team, A.T]); if (g.v >= 5) ctx.sendTo(who.id, { run: ctx.runId, r: { big: true } }); }
        }
        while (fx.length && A.T - fx[0][4] > 1) fx.shift();
        A.viewTick(now);
      },
      view(pid) { const p = A.P.get(pid); if (!p) return { g: 'gems', spectator: true }; return { g: 'gems', x: Math.round(p.x), y: Math.round(p.y), got: p.got, gems: G.map((g) => [g.x, g.y, g.v]) }; },
      screen() { return { nm: A.nm(), ps: A.pack(() => 0), gems: G.map((g) => [g.x, g.y, g.v]), fx: fx.map((f) => [f[0], f[1], f[2], f[3], round1(A.T - f[4])]), avg: avgBy(A.P, (p) => (p.active ? p.got : null), ctx.teams) }; },
      finish() {
        const players = {}; const act = [...A.P.values()].filter((p) => p.active); const avg = act.reduce((s, p) => s + p.got, 0) / Math.max(1, act.length);
        for (const p of act) players[p.id] = { raw: p.got, norm: round1(clamp((p.got / Math.max(4, avg * 1.8)) * 100, 0, 100)), show: `보석 ${p.got}점` };
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 왕관 쟁탈전 (아레나)
export const crown = {
  id: 'crown', no: 5, name: '왕관 쟁탈전', emoji: '👑',
  dur: { kid: 40, elem: 45, adult: 50 },
  rule: { all: '움직이는 황금 원 안에 머무는 동안 점수가 올라가요. 원은 계속 이동합니다', baby: '반짝이는 원 안으로 들어가 보세요' },
  howto: '황금 원 안에 머문 시간 (팀 평균)',
  lateJoin: true,
  create(ctx) {
    const A = arena(ctx, () => ({ inT: 0 }));
    const Z = { x: AW / 2, y: AH / 2, r: 170, tx: AW / 2, ty: AH / 2 };
    let nextMove = 3;
    return {
      addPlayer(p) { if (!A.P.has(p.id)) A.spawn(p, A.T); },
      input(pid, m) { A.move(pid, m); },
      shift: A.shift,
      tick(now) {
        const d = A.dt(now); A.step(d);
        const prog = clamp(A.T / (ctx.durMs / 1000), 0, 1);
        if (A.T >= nextMove) { Z.tx = Z.r + A.r() * (AW - 2 * Z.r); Z.ty = Z.r + A.r() * (AH - 2 * Z.r); nextMove = A.T + 4 - prog * 1.5; }
        Z.r = 170 - prog * 70;
        const sp = 140 + prog * 90; const dx = Z.tx - Z.x, dy = Z.ty - Z.y, l = Math.hypot(dx, dy);
        if (l > 2) { Z.x += (dx / l) * Math.min(l, sp * d); Z.y += (dy / l) * Math.min(l, sp * d); }
        for (const p of A.P.values()) if (p.active && Math.hypot(p.x - Z.x, p.y - Z.y) <= Z.r) p.inT += d;
        A.viewTick(now);
      },
      view(pid) { const p = A.P.get(pid); if (!p) return { g: 'crown', spectator: true }; return { g: 'crown', x: Math.round(p.x), y: Math.round(p.y), inT: round1(p.inT), z: [Math.round(Z.x), Math.round(Z.y), Math.round(Z.r)] }; },
      screen() { return { nm: A.nm(), ps: A.pack((p) => (Math.hypot(p.x - Z.x, p.y - Z.y) <= Z.r ? 1 : 0)), z: [Math.round(Z.x), Math.round(Z.y), Math.round(Z.r), Math.round(Z.tx), Math.round(Z.ty)], inside: teamCount(A.P, (p) => p.active && Math.hypot(p.x - Z.x, p.y - Z.y) <= Z.r, ctx.teams), avg: avgBy(A.P, (p) => (p.active ? p.inT : null), ctx.teams) }; },
      finish() {
        const players = {}; const T = A.T || 1;
        for (const p of A.P.values()) if (p.active) players[p.id] = { raw: round1(p.inT), norm: round1(clamp((p.inT / Math.max(1, (T - p.joinT) * 0.8)) * 100, 0, 100)), show: `${Math.round(p.inT)}초 차지` };
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 손맛 게임 공용 틀
// 폰에서 게임을 하고 누적 점수를 보냄 → 서버는 연령별 '초당 최대 점수'로 상한을 걸어 검증
// x: 하이라이트 번호 (화면에 띄울 문구는 화면 쪽에 고정 → 아무 글자나 못 띄움)
function skill(o) {
  return {
    id: o.id, no: o.no, name: o.name, emoji: o.emoji, dur: o.dur, rule: o.rule, howto: o.howto, lateJoin: true, minDur: o.minDur,
    create(ctx) {
      const P = new Map(); const add = (p) => P.set(p.id, { ...p, v: 0, active: false, hi: 0 });
      ctx.players.forEach(add);
      let t0 = 0; let feed = [];
      return {
        addPlayer(p) { if (!P.has(p.id)) add(p); },
        start(now) { t0 = now; ctx.dirtyAll(); },
        shift(ms) { t0 += ms; },
        input(pid, m, now) {
          const p = P.get(pid); if (!p || m.a !== 'sc' || !t0 || !numIn(m.v, 0, 100000)) return;
          const el = Math.max(0, (now - t0) / 1000);
          const cap = by6(p.lv, o.rate) * el + o.burst;
          const v = Math.min(Math.floor(m.v), Math.floor(cap));
          if (v > p.v) p.v = v; p.active = true;
          if (intIn(m.x, 1, 9)) { p.hi++; feed.push([p.name, p.team, m.x]); }
        },
        tick(now) { if (now - (this._v || 0) > 1000) { this._v = now; ctx.dirtyAll(); } },
        view(pid) {
          const p = P.get(pid); if (!p) return { g: o.id, spectator: true };
          const avg = avgBy(P, (q) => (q.active ? q.v : null), ctx.teams);
          const order = Object.entries(avg).sort((a, b) => b[1] - a[1]).map((x) => +x[0]);
          return { g: o.id, seed: ctx.seed, lv: p.lv, age: p.age, t0, dur: ctx.durMs / 1000, v: p.v, rank: order.indexOf(p.team) + 1, n: ctx.teams.length };
        },
        screen() {
          const f = feed; feed = [];
          const top = [...P.values()].filter((p) => p.active).sort((a, b) => b.v - a.v).slice(0, 5).map((p) => [p.name, p.team, p.v]);
          return { avg: avgBy(P, (q) => (q.active ? q.v : null), ctx.teams), top, feed: f.slice(-6) };
        },
        finish() {
          const players = {};
          for (const p of P.values()) if (p.active) players[p.id] = { raw: p.v, norm: round1(clamp((p.v / by6(p.lv, o.ref)) * 100, 0, 100)), show: `${p.v}${o.unit}` };
          return { players };
        },
      };
    },
  };
}
const D = (a, b, c) => ({ kid: a, elem: b, adult: c });
export const dalgona = skill({ id: 'dalgona', no: 7, name: '달고나 뽑기', emoji: '🍪', dur: D(45, 50, 50), unit: '점', rate: [6, 6, 6, 6, 6, 6], burst: 100, ref: [180, 200, 230, 250, 260, 260],
  rule: { all: '선을 따라 손가락으로 천천히 그려서 모양을 떼어 내세요. 선 밖으로 나가면 금이 가요', baby: '선을 따라 손가락으로 그려 보세요' }, howto: '정확도 × 완성 개수 (모양이 점점 어려워져요)' });
export const tuho = skill({ id: 'tuho', no: 9, name: '투호 던지기', emoji: '🏹', dur: D(35, 40, 40), unit: '점', rate: [4, 4, 4, 4, 4, 4], burst: 10, ref: [40, 50, 60, 66, 70, 70],
  rule: { all: '화살을 위로 휙 밀어 던지세요. 항아리가 좌우로 움직이고 바람이 불어요', baby: '위로 쓱 밀어서 던져요' }, howto: '항아리에 넣으면 10점, 정중앙은 15점' });
export const runner = skill({ id: 'runner', no: 10, name: '점프 러너', emoji: '🦖', dur: D(35, 40, 45), unit: 'm', rate: [14, 16, 18, 19, 20, 20], burst: 20, ref: [260, 340, 420, 470, 500, 520],
  rule: { all: '화면을 눌러 점프! 장애물에 부딪히면 잠깐 멈췄다가 다시 달려요', baby: '화면을 톡 누르면 점프해요' }, howto: '달린 거리 합계 (팀 평균)' });
export const flappy = skill({ id: 'flappy', no: 11, name: '파닥파닥', emoji: '🐤', dur: D(35, 40, 45), unit: '개', rate: [1.2, 1.3, 1.5, 1.6, 1.7, 1.7], burst: 3, ref: [10, 14, 20, 24, 27, 28],
  rule: { all: '톡톡 눌러 날갯짓! 기둥 사이 틈을 통과하세요', baby: '톡톡 눌러서 날아요' }, howto: '통과한 기둥 수 합계' });
export const stairs = skill({ id: 'stairs', no: 13, name: '하늘 계단', emoji: '🪜', dur: D(30, 35, 40), unit: '칸', rate: [4, 5, 6, 6.5, 7, 7], burst: 6, ref: [50, 80, 120, 140, 155, 160],
  rule: { all: '다음 계단이 같은 방향이면 오르기, 반대면 방향 바꾸기! 틀리면 떨어져요', baby: '계단이 있는 쪽 버튼을 눌러요' }, howto: '오른 계단 수 합계' });
export const bridge = skill({ id: 'bridge', no: 14, name: '다리 놓기', emoji: '🌉', dur: D(40, 45, 50), unit: '칸', rate: [0.7, 0.8, 0.9, 1, 1, 1], burst: 3, ref: [8, 11, 15, 17, 18, 18],
  rule: { all: '꾹 누르는 동안 막대가 길어져요. 딱 맞게 떼서 다음 기둥으로 건너가세요', baby: '꾹 누르고 떼면 다리가 생겨요' }, howto: '건넌 기둥 수 (정중앙 착지 보너스)' });
export const fishing = skill({ id: 'fishing', no: 15, name: '낚시왕', emoji: '🎣', dur: D(45, 50, 50), unit: '점', rate: [3, 3, 3, 3, 3, 3], burst: 30, ref: [50, 60, 75, 80, 85, 85],
  rule: { all: '찌가 쑥 들어가면 바로 챔질! 그다음 장력 게이지를 초록색 안에 유지하며 감아요', baby: '물고기가 물면 꾹 눌러요' }, howto: '잡은 물고기 점수 (희귀할수록 높음)' });
export const basket = skill({ id: 'basket', no: 18, name: '버저비터', emoji: '🏀', dur: D(30, 35, 40), unit: '점', rate: [3, 3, 3.5, 3.5, 3.5, 3.5], burst: 6, ref: [30, 40, 55, 60, 65, 66],
  rule: { all: '공을 위로 휙 던지세요. 골대가 움직이니 타이밍이 중요해요', baby: '공을 위로 쓱 밀어요' }, howto: '골 2점, 클린슛 3점' });
export const eggs = skill({ id: 'eggs', no: 21, name: '달걀 받기', emoji: '🥚', dur: D(30, 35, 40), unit: '개', rate: [3, 3.5, 4, 4.5, 5, 5], burst: 4, ref: [35, 50, 70, 80, 88, 90],
  rule: { all: '바구니를 좌우로 움직여 떨어지는 달걀을 받으세요. 돌멩이는 피하세요', baby: '바구니를 움직여 달걀을 받아요' }, howto: '받은 달걀 수 (황금 달걀 +3, 돌 -2)' });

// ---------------------------------------------------------------- 컬링 영미! (서버가 스톤 기록)
export const curling = {
  id: 'curling', no: 16, name: '컬링', emoji: '🥌',
  dur: D(40, 45, 45),
  rule: { all: '스톤을 위로 밀어 던지고, 화면을 문질러 스위핑! 하우스 정중앙에 가까울수록 점수', baby: '돌을 위로 쓱 밀어요' },
  howto: '스톤 3개, 중앙에서 가까울수록 고득점 · 대형 화면에 모든 스톤이 함께 쌓여요',
  lateJoin: true,
  create(ctx) {
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, th: [], active: false });
    ctx.players.forEach(add);
    let fresh = []; const all = [];
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      input(pid, m) {
        const p = P.get(pid); if (!p || m.a !== 'throw' || p.th.length >= 3) return;
        if (!numIn(m.x, -1.5, 1.5) || !numIn(m.y, -1.5, 1.5)) return;
        const d = Math.hypot(m.x, m.y); const s = Math.round(clamp(100 - d * 100, 0, 100));
        p.th.push(s); p.active = true; const st = [round1(m.x * 100) / 100, round1(m.y * 100) / 100, p.team, s]; fresh.push(st); all.push(st);
        return { s, n: p.th.length };
      },
      tick(now) { if (now - (this._v || 0) > 1000) { this._v = now; ctx.dirtyAll(); } },
      view(pid) { const p = P.get(pid); if (!p) return { g: 'curling', spectator: true }; return { g: 'curling', th: p.th, lv: p.lv }; },
      screen() { const f = fresh; fresh = []; return { add: f, n: all.length, all: all.length < 400 && Math.random() < 0.15 ? all : null, avg: avgBy(P, (p) => (p.active ? p.th.reduce((a, b) => a + b, 0) / 3 : null), ctx.teams) }; },
      finish() { const players = {}; for (const p of P.values()) if (p.active) { const s = p.th.reduce((a, b) => a + b, 0) / 3; players[p.id] = { raw: round1(s), norm: round1(s), show: `${p.th.join(' · ')}점` }; } return { players }; },
    };
  },
};

// ---------------------------------------------------------------- 승부차기 (골키퍼는 서버가 결정)
export const penalty = {
  id: 'penalty', no: 17, name: '승부차기', emoji: '⚽',
  dur: D(35, 40, 40),
  rule: { all: '골대의 6칸 중 한 곳으로 공을 밀어 차세요. 골키퍼가 어디로 뛸지는 아무도 몰라요', baby: '골대 쪽으로 공을 쓱 밀어요' },
  howto: '골 수 · 구석(위 모서리)은 골키퍼가 잘 못 막지만 빗나갈 수도 있어요',
  lateJoin: true,
  create(ctx) {
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, goals: 0, shots: 0, at: 0, active: false });
    ctx.players.forEach(add);
    let ev = [];
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'kick' || !intIn(m.z, 0, 5) || now - p.at < 1600) return;
        p.at = now; p.shots++; p.active = true;
        const corner = m.z === 0 || m.z === 2;
        const miss = Math.random() < (corner ? by6(p.lv, [0.02, 0.05, 0.12, 0.16, 0.18, 0.2]) : 0.02);
        const keeper = Math.floor(Math.random() * 6);
        const saveP = keeper === m.z ? by6(p.lv, [0.35, 0.5, 0.75, 0.82, 0.85, 0.88]) : Math.abs(keeper - m.z) === 1 && Math.floor(keeper / 3) === Math.floor(m.z / 3) ? 0.15 : 0;
        const save = !miss && Math.random() < saveP;
        const goal = !miss && !save; if (goal) p.goals++;
        ev.push([p.team, m.z, keeper, goal ? 1 : save ? 2 : 3]);
        return { z: m.z, keeper, res: goal ? 'goal' : save ? 'save' : 'miss', goals: p.goals };
      },
      tick(now) { if (now - (this._v || 0) > 1000) { this._v = now; ctx.dirtyAll(); } },
      view(pid) { const p = P.get(pid); if (!p) return { g: 'penalty', spectator: true }; return { g: 'penalty', goals: p.goals, shots: p.shots }; },
      screen() { const e = ev; ev = []; return { ev: e.slice(-40), avg: avgBy(P, (p) => (p.active ? p.goals : null), ctx.teams) }; },
      finish() { const players = {}; const D2 = ctx.durMs / 1000 / 1.6; for (const p of P.values()) if (p.active) players[p.id] = { raw: p.goals, norm: round1(clamp((p.goals / (D2 * 0.55)) * 100, 0, 100)), show: `${p.goals}골 / ${p.shots}슛` }; return { players }; },
    };
  },
};

// ---------------------------------------------------------------- 리듬 마스터 (서버가 같은 악보로 판정)
export const rhythm = {
  id: 'rhythm', no: 20, name: '리듬 마스터', emoji: '🎵',
  dur: D(35, 40, 40),
  rule: { all: '내려오는 노트가 선에 닿는 순간 같은 줄을 터치하세요. 대형 화면에서 비트가 나와요', baby: '반짝이는 칸이 내려오면 톡!' },
  howto: '정확도 점수 + 콤보 (팀 평균)',
  lateJoin: true,
  create(ctx) {
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, hit: new Map(), combo: 0, best: 0, active: false });
    ctx.players.forEach(add);
    const charts = {}; let t0 = 0;
    const chart = (lv) => (charts[lv] ||= rhythmChart(ctx.seed + lv, t0, ctx.durMs + 1000, lv));
    let evq = {};
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      start(now) { t0 = now + 1500; for (const k of Object.keys(charts)) delete charts[k]; ctx.dirtyAll(); },
      shift(ms) { t0 += ms; for (const k of Object.keys(charts)) delete charts[k]; },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'hit' || !intIn(m.i, 0, 5000) || !intIn(m.l, 0, 2) || !numIn(m.ts, now - 800, now + 800)) return;
        const n = chart(p.lv).notes[m.i]; if (!n || n.l !== m.l || p.hit.has(m.i)) return;
        const err = Math.abs(m.ts - n.t); const win = by6(p.lv, [220, 180, 140, 125, 115, 110]);
        if (err > win) { p.combo = 0; return { i: m.i, j: 'miss' }; }
        const j = err < win * 0.35 ? 'perfect' : 'good'; const s = j === 'perfect' ? 3 : 2;
        p.hit.set(m.i, s); p.combo++; p.best = Math.max(p.best, p.combo); p.active = true;
        evq[p.team] = (evq[p.team] || 0) + 1;
        return { i: m.i, j, combo: p.combo };
      },
      tick(now) { if (now - (this._v || 0) > 1500) { this._v = now; ctx.dirtyAll(); } },
      view(pid) { const p = P.get(pid); if (!p) return { g: 'rhythm', spectator: true }; return { g: 'rhythm', seed: ctx.seed + p.lv, lv: p.lv, t0, dur: ctx.durMs + 1000, best: p.best }; },
      screen() { const e = evq; evq = {}; const c = chart(2); return { t0, bpm: c.bpm, hits: e, avg: avgBy(P, (p) => (p.active ? [...p.hit.values()].reduce((a, b) => a + b, 0) : null), ctx.teams), top: [...P.values()].sort((a, b) => b.best - a.best).slice(0, 3).filter((p) => p.best).map((p) => [p.name, p.team, p.best]) }; },
      finish() {
        const players = {};
        for (const p of P.values()) { if (!p.active) continue; const N = chart(p.lv).notes.length || 1; const pts = [...p.hit.values()].reduce((a, b) => a + b, 0); players[p.id] = { raw: pts, norm: round1(clamp((pts / (N * 3)) * 115, 0, 100)), show: `${p.hit.size}/${N} · 최고 ${p.best}콤보` }; }
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 버거 장인 (주문은 서버가 만들고 확인)
export const burger = {
  id: 'burger', no: 22, name: '버거 장인', emoji: '🍔',
  dur: D(40, 45, 50),
  rule: { all: '주문서와 똑같은 순서로 재료를 쌓아 버거를 완성하세요. 틀리면 처음부터!', baby: '그림과 같은 재료를 눌러요' },
  howto: '완성한 버거 수 (재료가 많을수록 점수 ↑)',
  lateJoin: true,
  create(ctx) {
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, k: 0, pts: 0, r: rng(ctx.seed ^ p.id.length * 7919 ^ p.id.charCodeAt(0) * 131), order: null, active: false });
    const mk = (p) => { const len = Math.min(by6(p.lv, [2, 3, 4, 5, 5, 6]) + Math.floor(p.k / 3), 8); const mid = []; const pool = BURGER.slice(1, p.lv <= 1 ? 5 : 8); for (let i = 0; i < len; i++) mid.push(pool[Math.floor(p.r() * pool.length)]); p.order = ['🍞', ...mid, '🍞']; };
    ctx.players.forEach((p) => { add(p); mk(P.get(p.id)); });
    let done = {};
    return {
      addPlayer(p) { if (!P.has(p.id)) { add(p); mk(P.get(p.id)); } },
      input(pid, m) {
        const p = P.get(pid); if (!p || m.a !== 'serve' || !Array.isArray(m.st) || m.st.length > 12) return;
        p.active = true;
        const ok = m.st.length === p.order.length && m.st.every((x, i) => x === p.order[i]);
        if (!ok) return { ok: false, order: p.order };
        p.k++; p.pts += p.order.length - 1; done[p.team] = (done[p.team] || 0) + 1; mk(p);
        return { ok: true, k: p.k, order: p.order };
      },
      tick(now) { if (now - (this._v || 0) > 1500) { this._v = now; ctx.dirtyAll(); } },
      view(pid) { const p = P.get(pid); if (!p) return { g: 'burger', spectator: true }; return { g: 'burger', order: p.order, k: p.k, lv: p.lv }; },
      screen() { const d = done; done = {}; return { done: d, avg: avgBy(P, (p) => (p.active ? p.k : null), ctx.teams) }; },
      finish() { const players = {}; for (const p of P.values()) if (p.active) players[p.id] = { raw: p.pts, norm: round1(clamp((p.pts / by6(p.lv, [14, 20, 30, 36, 40, 42])) * 100, 0, 100)), show: `버거 ${p.k}개` }; return { players }; },
    };
  },
};

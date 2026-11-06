// 새 게임 ⑤ 함께 · 눈치 · 두뇌 (라운드형, 서버 판정)
// 텔레파시 / 소수가 산다 / 틀린 그림 찾기 / 하이 or 로우 / 손 떼면 탈락
import { rng, shuffle } from './gen.js';
import { clamp, round1, intIn, by6 } from './common.js';
import { spotPuzzle } from './gen2.js';

function clock() { const c = { T: 0, last: null }; c.dt = (now) => { const d = c.last == null ? 0.1 : clamp((now - c.last) / 1000, 0, 0.25); c.last = now; c.T += d; return d; }; c.shift = (ms) => { if (c.last != null) c.last += ms; }; return c; }
const avgBy = (P, val, teams) => { const o = Object.fromEntries(teams.map((t) => [t, { s: 0, n: 0 }])); for (const p of P.values()) { const v = val(p); if (v == null || !o[p.team]) continue; o[p.team].s += v; o[p.team].n++; } return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x.n ? round1(x.s / x.n) : 0])); };
const lvOf = (ctx) => ctx.settings.lv ?? 2;

// 라운드 공용: 문제(ph 'q') → 공개(ph 'rev') 반복
function rounds(ctx, { n, qSec, revSec, onReveal }) {
  const C = clock(); const st = { i: 0, ph: 'q', end: qSec, n };
  return {
    C, st,
    left: () => Math.max(0, st.end - C.T),
    tick(now, allIn) {
      C.dt(now);
      if (st.ph === 'q' && (C.T >= st.end || (allIn() && C.T > st.end - qSec + 2.5))) { onReveal(st.i); st.ph = 'rev'; st.end = C.T + revSec; ctx.dirtyAll(); }
      else if (st.ph === 'rev' && C.T >= st.end) { st.i++; if (st.i >= n) { st.ph = 'end'; ctx.endEarly(); return; } st.ph = 'q'; st.end = C.T + qSec; ctx.dirtyAll(); }
      if (now - (this._v || 0) > 1000) { this._v = now; ctx.dirtyAll(); }
    },
  };
}

// ---------------------------------------------------------------- 텔레파시
const TELE = [
  ['우리 팀이 지금 가장 먹고 싶은 것은?', '🍕 피자', '🍗 치킨', '🍜 라면', '🍣 초밥'],
  ['여행을 간다면?', '🏖️ 바다', '⛰️ 산', '🏙️ 도시', '🏕️ 캠핑'],
  ['가장 좋아하는 계절은?', '🌸 봄', '☀️ 여름', '🍁 가을', '❄️ 겨울'],
  ['초능력 하나를 고른다면?', '🕊️ 하늘 날기', '👻 투명 인간', '⏱️ 시간 멈추기', '🧠 마음 읽기'],
  ['키우고 싶은 동물은?', '🐶 강아지', '🐱 고양이', '🐹 햄스터', '🐢 거북이'],
  ['디저트를 고른다면?', '🍦 아이스크림', '🍰 케이크', '🍩 도넛', '🧁 컵케이크'],
  ['주말에 하고 싶은 것은?', '🛌 늘어지게 쉬기', '⚽ 운동', '🎮 게임', '🎬 영화'],
  ['좋아하는 색은?', '🔴 빨강', '🔵 파랑', '🟢 초록', '🟡 노랑'],
  ['하나만 가져갈 수 있다면?', '📱 휴대폰', '🎧 이어폰', '📚 책', '🧸 인형'],
  ['운동회 종목 하나를 고른다면?', '🏃 달리기', '🪢 줄다리기', '🏐 피구', '🎯 박 터뜨리기'],
];
export const tele = {
  id: 'tele', no: 24, name: '텔레파시', emoji: '🧠', untimed: true,
  dur: { kid: 80, elem: 90, adult: 90 },
  rule: { all: '정답은 없어요! 우리 팀원들이 가장 많이 고를 것 같은 답을 고르세요', baby: '마음에 드는 그림을 골라요' },
  howto: '팀원과 같은 답을 고른 비율이 높을수록 고득점 (팀 마음이 하나!)',
  lateJoin: true,
  qsource(st) { return { items: TELE, n: (st.lv ?? 2) <= 1 ? 4 : 6, key: (q) => q[0] }; },
  create(ctx) {
    const r = rng(ctx.seed);
    const Q = (ctx.qset || shuffle(r, TELE).slice(0, lvOf(ctx) <= 1 ? 4 : 6)).map((q) => ({ text: q[0], opts: q.slice(1) })); const N = Q.length;
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, a: {}, pts: [], active: false }); ctx.players.forEach(add);
    const sync = Object.fromEntries(ctx.teams.map((t) => [t, []])); let dist = null;
    const R = rounds(ctx, { n: N, qSec: lvOf(ctx) <= 1 ? 12 : 9, revSec: 5, onReveal: (i) => {
      dist = {};
      for (const t of ctx.teams) {
        const mem = [...P.values()].filter((p) => p.team === t && p.a[i] != null); const cnt = [0, 0, 0, 0]; for (const p of mem) cnt[p.a[i]]++;
        dist[t] = cnt; if (!mem.length) continue; const mx = Math.max(...cnt); sync[t].push(mx / mem.length);
        for (const p of mem) p.pts.push(Math.round((cnt[p.a[i]] / mem.length) * 100));
      }
    } });
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); }, shift: R.C.shift,
      input(pid, m) { const p = P.get(pid); if (!p || m.a !== 'pick' || R.st.ph !== 'q' || m.q !== R.st.i || !intIn(m.c, 0, 3) || p.a[R.st.i] != null) return; p.a[R.st.i] = m.c; p.active = true; return { c: m.c }; },
      tick(now) { R.tick(now, () => [...P.values()].filter((p) => p.active).every((p) => p.a[R.st.i] != null)); },
      view(pid, now) { const p = P.get(pid); if (!p) return { g: 'tele', spectator: true }; const q = Q[Math.min(R.st.i, N - 1)]; return { g: 'tele', i: R.st.i, N, ph: R.st.ph, until: now + Math.round(R.left() * 1000), text: q.text, opts: q.opts, my: p.a[R.st.i] ?? null, dist: R.st.ph === 'rev' ? dist?.[p.team] : null }; },
      screen() { const q = Q[Math.min(R.st.i, N - 1)]; return { i: R.st.i, N, ph: R.st.ph, left: round1(R.left()), text: q.text, opts: q.opts, dist: R.st.ph === 'rev' ? dist : null, answered: [...P.values()].filter((p) => p.a[R.st.i] != null).length, sync: Object.fromEntries(Object.entries(sync).map(([t, a]) => [t, a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100) : 0])) }; },
      finish() {
        const players = {}; for (const p of P.values()) if (p.active && p.pts.length) { const v = p.pts.reduce((a, b) => a + b, 0) / p.pts.length; players[p.id] = { raw: round1(v), norm: round1(v), show: `팀과 일치 ${Math.round(v)}%` }; }
        const teams = {}; for (const [t, a] of Object.entries(sync)) if (a.length) teams[t] = round1((a.reduce((x, y) => x + y, 0) / a.length) * 100);
        return { players, teams, teamLabel: Object.fromEntries(Object.entries(teams).map(([t, v]) => [t, `팀 일치율 ${v}%`])) };
      },
    };
  },
};

// ---------------------------------------------------------------- 소수가 산다
const MINO = [['짜장면', '짬뽕'], ['부먹', '찍먹'], ['여름', '겨울'], ['바다', '산'], ['아침형', '저녁형'], ['강아지', '고양이'], ['떡볶이', '순대'], ['비빔밥', '김밥'], ['버스', '지하철'], ['영화관', '집에서'], ['딸기', '바나나'], ['수영', '자전거']];
export const mino = {
  id: 'mino', no: 25, name: '소수가 산다', emoji: '🙈', untimed: true,
  dur: { kid: 80, elem: 90, adult: 90 },
  rule: { all: '둘 중 하나를 고르세요. 더 적은 사람이 고른 쪽만 살아남아요! 탈락해도 살아남는 쪽을 맞히면 부활', baby: '둘 중 마음에 드는 쪽을 골라요' },
  howto: '살아남은 라운드 수 · 마지막까지 남으면 보너스 (영아·유아는 탈락 없음)',
  lateJoin: true,
  qsource() { return { items: MINO, n: 7, key: (q) => q.join('/') }; },
  create(ctx) {
    const r = rng(ctx.seed); const Q = ctx.qset || shuffle(r, MINO).slice(0, 7); const N = Q.length;
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, alive: true, a: {}, ok: 0, active: false }); ctx.players.forEach(add);
    const canLose = lvOf(ctx) >= 2; let res = null;
    const R = rounds(ctx, { n: N, qSec: 8, revSec: 5, onReveal: (i) => {
      const cand = [...P.values()].filter((p) => p.alive && (p.active || p.a[i] != null)); const cnt = [0, 0]; for (const p of cand) if (p.a[i] != null) cnt[p.a[i]]++;
      const win = cnt[0] === cnt[1] ? -1 : cnt[0] < cnt[1] ? 0 : 1; const out = [];
      for (const p of cand) { const ok = win === -1 ? p.a[i] != null : p.a[i] === win; if (ok) p.ok++; else if (canLose) { p.alive = false; out.push([p.name, p.team]); } }
      const rev = []; if (win !== -1) for (const p of P.values()) if (!p.alive && !cand.includes(p) && p.a[i] === win) { p.alive = true; rev.push([p.name, p.team]); } // 탈락자가 살아남는 쪽을 맞히면 부활
      res = { cnt, win, out: out.slice(0, 16), outN: out.length, revN: rev.length };
      if (canLose && [...P.values()].filter((p) => p.alive && p.active).length <= 1 && i < N - 1) R.st.n = i + 1;
    } });
    const aliveBy = () => { const o = Object.fromEntries(ctx.teams.map((t) => [t, 0])); for (const p of P.values()) if (p.alive && p.active && o[p.team] != null) o[p.team]++; return o; };
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); }, shift: R.C.shift,
      input(pid, m) { const p = P.get(pid); if (!p || m.a !== 'pick' || R.st.ph !== 'q' || m.q !== R.st.i || !intIn(m.c, 0, 1) || p.a[R.st.i] != null) return; p.a[R.st.i] = m.c; p.active = true; return { c: m.c }; }, // 탈락자도 고를 수 있음 (부활 찬스)
      tick(now) { R.tick(now, () => [...P.values()].filter((p) => p.alive && p.active).every((p) => p.a[R.st.i] != null)); },
      view(pid, now) { const p = P.get(pid); if (!p) return { g: 'mino', spectator: true }; const q = Q[Math.min(R.st.i, N - 1)]; return { g: 'mino', i: R.st.i, N: R.st.n, ph: R.st.ph, until: now + Math.round(R.left() * 1000), opts: q, my: p.a[R.st.i] ?? null, alive: p.alive, res: R.st.ph === 'rev' ? res : null, canLose }; },
      screen() { const q = Q[Math.min(R.st.i, N - 1)]; const al = aliveBy(); return { i: R.st.i, N: R.st.n, ph: R.st.ph, left: round1(R.left()), opts: q, res: R.st.ph === 'rev' ? res : null, alive: al, aliveN: Object.values(al).reduce((a, b) => a + b, 0), answered: [...P.values()].filter((p) => p.a[R.st.i] != null).length, canLose }; },
      finish() { const players = {}; const n = Math.max(1, Math.min(R.st.i + 1, R.st.n)); for (const p of P.values()) if (p.active) players[p.id] = { raw: p.ok, norm: round1(clamp((p.ok / n) * 90 + (p.alive && canLose ? 10 : 0), 0, 100)), show: p.alive && canLose ? `끝까지 생존 (${p.ok}라운드)` : `${p.ok}라운드 생존` }; return { players }; },
    };
  },
};

// ---------------------------------------------------------------- 틀린 그림 찾기
export const spot = {
  id: 'spot', no: 27, name: '틀린 그림 찾기', emoji: '🔍',
  dur: { kid: 45, elem: 50, adult: 50 },
  rule: { all: '두 그림에서 다른 곳을 찾아 오른쪽 그림을 터치하세요. 다 찾으면 다음 판!', baby: '다른 그림을 찾아 콕!' },
  howto: '찾은 개수 (틀리게 누르면 1초 쉬어요)',
  lateJoin: true,
  create(ctx) {
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, k: 0, found: new Set(), total: 0, lock: 0, active: false, pz: null }); ctx.players.forEach(add);
    const pz = (p) => (p.pz && p.pz.k === p.k ? p.pz : (p.pz = { k: p.k, ...spotPuzzle(ctx.seed, p.k, p.lv) }));
    let pops = {};
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'tap' || m.k !== p.k || !intIn(m.c, 0, 35)) return; p.active = true;
        if (now < p.lock) return { wait: true };
        const z = pz(p); if (!z.diff.includes(m.c)) { p.lock = now + 1000; return { wrong: m.c }; }
        if (p.found.has(m.c)) return; p.found.add(m.c); p.total++; pops[p.team] = (pops[p.team] || 0) + 1;
        if (p.found.size >= z.diff.length) { p.k++; p.found = new Set(); return { ok: m.c, next: p.k, total: p.total }; }
        return { ok: m.c, total: p.total };
      },
      tick(now) { if (now - (this._v || 0) > 1500) { this._v = now; ctx.dirtyAll(); } },
      view(pid) { const p = P.get(pid); if (!p) return { g: 'spot', spectator: true }; return { g: 'spot', seed: ctx.seed, lv: p.lv, k: p.k, found: [...p.found], total: p.total }; },
      screen() { const e = pops; pops = {}; const top = [...P.values()].filter((p) => p.active).sort((a, b) => b.total - a.total).slice(0, 5).map((p) => [p.name, p.team, p.total]); return { pops: e, top, avg: avgBy(P, (p) => (p.active ? p.total : null), ctx.teams) }; },
      finish() { const players = {}; for (const p of P.values()) if (p.active) players[p.id] = { raw: p.total, norm: round1(clamp((p.total / by6(p.lv, [8, 10, 14, 16, 18, 20])) * 100, 0, 100)), show: `${p.total}개 찾음` }; return { players }; },
    };
  },
};

// ---------------------------------------------------------------- 하이 or 로우
const CARD = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const hilo = {
  id: 'hilo', no: 28, name: '하이 or 로우', emoji: '🃏', untimed: true,
  dur: { kid: 80, elem: 90, adult: 90 },
  rule: { all: '다음 카드가 지금 카드보다 높을까, 낮을까? 연속으로 맞히면 점수가 커져요', baby: '위 또는 아래 화살표를 골라요' },
  howto: '맞히면 1점 + 연속 보너스 · 같은 숫자면 모두 정답',
  lateJoin: true,
  create(ctx) {
    const r = rng(ctx.seed); const N = lvOf(ctx) <= 1 ? 7 : 10;
    const cards = [2 + Math.floor(r() * 11)]; for (let i = 0; i < N; i++) cards.push(1 + Math.floor(r() * 13));
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, a: {}, pts: 0, st: 0, best: 0, active: false }); ctx.players.forEach(add);
    let res = null;
    const R = rounds(ctx, { n: N, qSec: lvOf(ctx) <= 1 ? 9 : 7, revSec: 4, onReveal: (i) => {
      const a = cards[i], b = cards[i + 1]; const right = b === a ? -1 : b > a ? 1 : 0; let ok = 0, all = 0;
      for (const p of P.values()) { if (!p.active && p.a[i] == null) continue; all++; const good = p.a[i] != null && (right === -1 || p.a[i] === right); if (good) { p.st++; p.best = Math.max(p.best, p.st); p.pts += 1 + Math.min(4, p.st - 1); ok++; } else p.st = 0; }
      res = { next: b, right, ok, all };
    } });
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); }, shift: R.C.shift,
      input(pid, m) { const p = P.get(pid); if (!p || m.a !== 'pick' || R.st.ph !== 'q' || m.q !== R.st.i || !intIn(m.c, 0, 1) || p.a[R.st.i] != null) return; p.a[R.st.i] = m.c; p.active = true; return { c: m.c }; },
      tick(now) { R.tick(now, () => [...P.values()].filter((p) => p.active).every((p) => p.a[R.st.i] != null)); },
      view(pid, now) { const p = P.get(pid); if (!p) return { g: 'hilo', spectator: true }; const i = Math.min(R.st.i, N - 1); return { g: 'hilo', i, N, ph: R.st.ph, until: now + Math.round(R.left() * 1000), card: CARD[cards[i]], next: R.st.ph === 'rev' ? CARD[cards[i + 1]] : null, my: p.a[i] ?? null, st: p.st, pts: p.pts, res: R.st.ph === 'rev' ? res : null }; },
      screen() { const i = Math.min(R.st.i, N - 1); const top = [...P.values()].filter((p) => p.active).sort((a, b) => b.st - a.st).slice(0, 5).map((p) => [p.name, p.team, p.st]); return { i, N, ph: R.st.ph, left: round1(R.left()), card: CARD[cards[i]], next: R.st.ph === 'rev' ? CARD[cards[i + 1]] : null, res: R.st.ph === 'rev' ? res : null, hist: cards.slice(0, i + 1).map((c) => CARD[c]), top, avg: avgBy(P, (p) => (p.active ? p.pts : null), ctx.teams), answered: [...P.values()].filter((p) => p.a[i] != null).length }; },
      finish() { const players = {}; const mx = N * 3; for (const p of P.values()) if (p.active) players[p.id] = { raw: p.pts, norm: round1(clamp((p.pts / mx) * 100, 0, 100)), show: `${p.pts}점 · 최고 ${p.best}연속` }; return { players }; },
    };
  },
};

// ---------------------------------------------------------------- 손 떼면 탈락
export const hold = {
  id: 'hold', no: 30, name: '손 떼면 탈락', emoji: '✋',
  dur: { kid: 40, elem: 50, adult: 60 },
  rule: { all: '시작 신호 전에 버튼을 꾹 누르고, 끝까지 손을 떼지 마세요. 화면에 속임수가 나와요!', baby: '버튼을 꾹 누르고 있어요' },
  howto: '버틴 시간 · 끝까지 버티면 만점 (영아·유아는 떼도 다시 누르면 이어서)',
  lateJoin: false, inputDuringCountdown: true,
  create(ctx) {
    const C = clock(); const r = rng(ctx.seed); const lv = lvOf(ctx);
    const P = new Map(); ctx.players.forEach((p) => P.set(p.id, { ...p, on: false, out: false, outT: null, heldT: 0, joined: false }));
    const soft = (p) => p.lv <= 1;
    let trick = null, nextTrick = 6, outLog = [];
    const TR = lv <= 1 ? ['👏 잘하고 있어요!', '🎵 조금만 더!'] : ['지금 놓으면 보너스!?', '⚠️ 손을 떼세요!', '📞 전화 왔어요', '🎁 선물 받기 → 손 떼기', '❌ 이건 함정!', '3초만 쉬어도 돼요(거짓말)'];
    return {
      addPlayer() {},
      shift: C.shift,
      input(pid, m) {
        const p = P.get(pid); if (!p || m.a !== 'hold') return;
        if (m.on) { if (!p.out) { p.on = true; p.joined = true; } return; }
        p.on = false;
        if (C.T > 0 && p.joined && !p.out && !soft(p)) { p.out = true; p.outT = C.T; outLog.push([p.name, p.team, C.T]); ctx.sendTo(p.id, { run: ctx.runId, r: { out: true, t: round1(C.T) } }); }
      },
      start() { for (const p of P.values()) if (!p.on && !p.joined && !soft(p)) { p.out = true; p.outT = 0; } ctx.dirtyAll(); },
      tick(now) {
        const d = C.dt(now);
        for (const p of P.values()) if (p.on && !p.out) p.heldT += d;
        if (C.T >= nextTrick) { trick = { text: TR[Math.floor(r() * TR.length)], at: C.T }; nextTrick = C.T + 4 + r() * 4; ctx.dirtyAll(); }
        if (trick && C.T - trick.at > 2.5) { trick = null; ctx.dirtyAll(); }
        while (outLog.length && C.T - outLog[0][2] > 4) outLog.shift();
        const live = [...P.values()].filter((p) => p.joined && !p.out && !soft(p));
        if (C.T > 5 && [...P.values()].some((p) => p.joined && !soft(p)) && live.length === 0) ctx.endEarly();
        if (now - (this._v || 0) > 700) { this._v = now; ctx.dirtyAll(); }
      },
      view(pid) { const p = P.get(pid); if (!p) return { g: 'hold', spectator: true }; return { g: 'hold', on: p.on, out: p.out, held: round1(p.heldT), trick: trick?.text || null, alive: [...P.values()].filter((q) => q.joined && !q.out).length, soft: soft(p) }; },
      screen() { const al = Object.fromEntries(ctx.teams.map((t) => [t, 0])); for (const p of P.values()) if (p.joined && !p.out && al[p.team] != null) al[p.team]++; return { T: round1(C.T), alive: al, aliveN: Object.values(al).reduce((a, b) => a + b, 0), out: outLog.slice(-10).map((x) => [x[0], x[1]]), trick: trick?.text || null, holding: [...P.values()].filter((p) => p.on).length }; },
      finish() { const players = {}; const T = Math.max(1, C.T); for (const p of P.values()) { if (!p.joined) continue; const v = soft(p) ? p.heldT / T : (p.out ? p.outT : T) / T; players[p.id] = { raw: round1(soft(p) ? p.heldT : p.out ? p.outT : T), norm: round1(clamp(v * 100, 0, 100)), show: p.out ? `${Math.round(p.outT)}초 버팀` : '끝까지 버팀!' }; } return { players }; },
    };
  },
};

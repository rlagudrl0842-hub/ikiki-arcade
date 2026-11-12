// 새 게임 ③ 두뇌 · 함께 · 분위기
// 골든벨 서바이벌 / 그려라 맞혀라 / 함성 대폭발
import { rng, shuffle } from './gen.js';
import { clamp, round1, numIn, intIn } from './common.js';
import { BELL, WORDS } from './n3data.js';
import { permFor } from './qpool.js';
import { bankFor } from './qbank.js'; // 연령별 추가 문제은행 (분야·난이도별)

function clock() {
  const c = { T: 0, last: null };
  c.dt = (now) => { const d = c.last == null ? 0.1 : clamp((now - c.last) / 1000, 0, 0.25); c.last = now; c.T += d; return d; };
  c.shift = (ms) => { if (c.last != null) c.last += ms; };
  return c;
}
const qAge = (mode) => (mode === 'kid' ? 'kid' : mode === 'adult' ? 'adult' : 'elem');

// ---------------------------------------------------------------- 골든벨 서바이벌
export const bell = {
  id: 'bell', no: 23, name: '골든벨 서바이벌', emoji: '🔔',
  dur: { kid: 120, elem: 150, adult: 150 }, untimed: true,
  rule: { all: '문제를 보고 정답을 골라요! 틀리면 탈락, 탈락해도 다음 문제를 맞히면 바로 부활!', kid: '정답 그림을 콕! 눌러요 (탈락 없어요)' },
  howto: '맞힌 문제 수로 점수 · 끝까지 살아남으면 보너스',
  lateJoin: true,
  quiz: true, board: true, // 휴대폰 없이도(대형 화면 + 종이·보드 + 진행자 점수) 진행 가능
  // 문제 후보: 진행자 문제 + 연령에 맞는 기본 문제 (엔진이 행사 단위로 중복 없이 고름)
  qsource(st) {
    const age = qAge(st.mode);
    const bank = [...(st.mode6 === 'mid' ? [...BELL.elem.slice(8), ...BELL.adult] : BELL[age]), ...bankFor(st.mode6 || st.mode)]; // 기존 문제 + 추가 문제은행 (같은 문제는 자동으로 하나로)
    // 진행자 문제 앞에 [유아]·[초등]·[성인](또는 중등·고등) 표시를 붙이면 그 연령에서만 나옴 · 표시가 없으면 모든 연령
    const TAG = { 유아: 'kid', 초등: 'elem', 중등: 'adult', 고등: 'adult', 성인: 'adult' };
    const own = (st.bellCustom || []).filter((q) => Array.isArray(q) && q.length >= 3 && q.every((x) => typeof x === 'string' && x.trim())).map((q) => {
      const m = q[0].match(/^\s*\[(유아|초등|중등|고등|성인)\]\s*/); const tag = m ? TAG[m[1]] : null;
      return Object.assign([m ? q[0].slice(m[0].length) : q[0], ...q.slice(1)], { own: true, tag });
    }).filter((q) => !q.tag || q.tag === age);
    return { items: [...own, ...bank], n: age === 'kid' ? 7 : 10, key: (q) => q[0], pri: (q) => !!q.own };
  },
  create(ctx) {
    const r = rng(ctx.seed);
    const age = qAge(ctx.settings.mode);
    const revive = -1; // (예전 '6번째 문제 패자부활전' → 이제 매 문제 부활 기회)
    const src = ctx.qset || bell.qsource(ctx.settings).items.slice(0, 10);
    // 한 판의 모든 참가자가 같은 문제 세트 · 보기 순서만 사람마다 다르게(view에서)
    const qs = src.map((q) => { const opts = shuffle(r, q.slice(1)); return { text: q[0], opts, ans: opts.indexOf(q[1]) }; });
    const N = qs.length;
    if (ctx.settings.device === 'nophone') return bellBoard(ctx, qs, age);
    const perm = (pid, i) => permFor(pid, `${ctx.runId}:${i}`, qs[i].opts.length); // perm[보이는 자리] = 원래 보기 번호
    const qSec = age === 'kid' ? 12 : 10;
    const C = clock();
    const P = new Map();
    const add = (p) => P.set(p.id, { ...p, alive: true, ok: 0, ans: {}, active: false, outAt: null });
    ctx.players.forEach(add);
    let qi = 0, ph = 'q', phEnd = qSec, outNow = [], revNow = [], counts = null, rate = null;
    const canLose = age !== 'kid';
    const reveal = () => {
      const q = qs[qi]; counts = q.opts.map(() => 0); outNow = []; revNow = [];
      for (const p of P.values()) {
        const a = p.ans[qi];
        if (a != null) counts[a]++;
        const right = a === q.ans;
        if (right) p.ok++;
        if (!p.alive) { if (right) { p.alive = true; revNow.push([p.name, p.team]); } continue; } // 탈락 중이어도 맞히면 바로 부활
        if (canLose && p.alive && !right && (p.active || a != null)) { p.alive = false; p.outAt = qi; outNow.push([p.name, p.team]); }
      }
      // 팀별 정답률은 공개 순간에만 계산해 보여 줌
      rate = {}; for (const t of ctx.teams) { const m = [...P.values()].filter((p) => p.team === t && p.ans[qi] != null); if (m.length) rate[t] = Math.round((m.filter((p) => p.ans[qi] === q.ans).length / m.length) * 100); }
      ph = 'reveal'; phEnd = C.T + 4.5; ctx.dirtyAll();
    };
    const aliveBy = () => { const o = Object.fromEntries(ctx.teams.map((t) => [t, 0])); for (const p of P.values()) if (p.alive && p.active && o[p.team] != null) o[p.team]++; return o; };
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      shift: C.shift,
      input(pid, m) {
        const p = P.get(pid); if (!p || m.a !== 'ans' || ph !== 'q' || m.q !== qi) return;
        const q = qs[qi]; if (!intIn(m.c, 0, q.opts.length - 1) || p.ans[qi] != null) return; // 한 번 내면 바꿀 수 없음
        p.ans[qi] = perm(pid, qi)[m.c]; p.active = true; // 보이는 자리 → 원래 보기 번호
        return { locked: true };
      },
      tick(now) {
        C.dt(now);
        if (ph === 'q') {
          const can = [...P.values()].filter((p) => p.active);
          if (C.T >= phEnd || (can.length && can.every((p) => p.ans[qi] != null) && C.T > 3)) reveal();
        } else if (C.T >= phEnd) {
          qi++;
          if (qi >= N) { ph = 'end'; ctx.endEarly(); return; }
          ph = 'q'; phEnd = C.T + qSec; counts = null; rate = null; ctx.dirtyAll();
        }
        if (now - (this._v || 0) > 1000) { this._v = now; ctx.dirtyAll(); }
      },
      view(pid, now) {
        const p = P.get(pid); if (!p) return { g: 'bell', spectator: true };
        const i = Math.min(qi, N - 1); const q = qs[i]; const pm = perm(pid, i); const inv = (c) => (c == null ? null : pm.indexOf(c));
        const done = p.ans[i] != null;
        // 컴퓨터 참가자(테스트 전용): 난이도별 확률로 '아는 문제'면 정답 위치를 알려 줌 (모르면 찍음)
        let aiKnow;
        if (p.ai && ph === 'q') { p.know ||= {}; if (p.know[i] == null) p.know[i] = Math.random() < ({ easy: 0.35, normal: 0.6, hard: 0.85 }[p.ai] ?? 0.3 + Math.random() * 0.6); if (p.know[i]) aiKnow = pm.indexOf(q.ans); }
        // 낸 뒤에는 보기를 숨기고 '제출 완료'만 (정답·내 답·정답률은 공개 시간까지 안 보냄)
        return { g: 'bell', qi, N, ph, until: now + Math.round(Math.max(0, phEnd - C.T) * 1000), text: q.text, opts: ph === 'q' && done ? null : pm.map((k) => q.opts[k]), submitted: done, aiKnow, kid: age === 'kid', my: ph === 'reveal' ? inv(p.ans[i]) : done ? -1 : null, ans: ph === 'reveal' ? inv(q.ans) : null, alive: p.alive, revive: qi === revive, ok: p.ok };
      },
      screen() {
        const q = qs[qi] || qs[N - 1];
        const al = aliveBy();
        return { qi, N, ph, left: round1(Math.max(0, phEnd - C.T)), text: q.text, opts: q.opts, ans: ph === 'reveal' ? q.ans : null, counts: ph === 'reveal' ? counts : null, rate: ph === 'reveal' ? rate : null, out: outNow.slice(0, 14), outN: outNow.length, rev: revNow.slice(0, 14), revN: revNow.length, alive: al, aliveN: Object.values(al).reduce((a, b) => a + b, 0), revive: qi === revive, answered: [...P.values()].filter((p) => p.ans[qi] != null).length, kid: age === 'kid' };
      },
      finish() {
        const players = {};
        for (const p of P.values()) {
          if (!p.active) continue;
          const n = (p.ok / N) * 90 + (p.alive && canLose ? 10 : 0);
          players[p.id] = { raw: p.ok, norm: round1(clamp(age === 'kid' ? (p.ok / N) * 100 : n, 0, 100)), show: `${p.ok}/${N} 정답${p.alive && canLose ? ' · 🔔 생존' : ''}` };
        }
        return { players };
      },
    };
  },
};

// 휴대폰 없이 진행하는 골든벨: 대형 화면에 문제·타이머 → 팀마다 종이·보드에 답을 가려 적기
// → "하나 둘 셋, 공개!"에 맞춰 동시에 들기 → 정답 공개 → 맞힌 팀에 진행자가 점수(+1)
function bellBoard(ctx, qs, age) {
  const N = qs.length; const C = clock(); const qSec = age === 'kid' ? 20 : 15;
  const pts = Object.fromEntries(ctx.teams.map((t) => [t, 0])); let flash = null;
  let qi = 0, ph = 'q', phEnd = qSec;
  return {
    addPlayer() {}, shift: C.shift, input() {},
    hostPt(team, d) { if (pts[team] == null || ![-1, 1, 2, 3].includes(d)) return; pts[team] = Math.max(0, pts[team] + d); flash = { team, d, at: C.T }; ctx.dirtyAll(); },
    tick(now) {
      C.dt(now);
      if (C.T >= phEnd) {
        if (ph === 'q') { ph = 'open'; phEnd = C.T + 3.5; } // 하나 둘 셋 → 동시에 공개
        else if (ph === 'open') { ph = 'reveal'; phEnd = C.T + (age === 'kid' ? 12 : 10); } // 정답 보고 진행자가 점수 주는 시간
        else { qi++; if (qi >= N) { ph = 'end'; ctx.endEarly(); return; } ph = 'q'; phEnd = C.T + qSec; }
        ctx.dirtyAll();
      }
      if (now - (this._v || 0) > 1000) { this._v = now; ctx.dirtyAll(); }
    },
    view() { return { g: 'bell', board: true }; },
    screen() { const q = qs[Math.min(qi, N - 1)]; return { board: true, qi, N, ph, left: round1(Math.max(0, phEnd - C.T)), text: q.text, opts: q.opts, ans: ph === 'reveal' ? q.ans : null, pts, flash: flash && C.T - flash.at < 1.5 ? [flash.team, flash.d] : null, kid: age === 'kid', counts: null, rate: null, alive: {}, aliveN: 0, answered: 0, out: [], rev: [] }; },
    finish() { return { players: {}, teams: { ...pts }, teamLabel: Object.fromEntries(Object.entries(pts).map(([t, v]) => [t, `정답 ${v}점`])) }; },
  };
}

// ---------------------------------------------------------------- 그려라 맞혀라
export const draw = {
  id: 'draw', no: 26, name: '그려라 맞혀라', emoji: '🖍',
  dur: { kid: 150, elem: 170, adult: 160 }, untimed: true,
  rule: { all: '팀마다 한 명이 몰래 받은 단어를 그려요! 나머지는 큰 화면을 보고 정답을 골라요', kid: '친구가 그리는 그림을 보고 정답을 골라요!' },
  howto: '빨리 맞힐수록 고득점 · 그린 사람은 팀원들이 맞힌 만큼 점수 · 판마다 그리는 사람이 바뀌어요',
  lateJoin: true,
  // 단어 후보: 진행자 단어(6개 이상이면 그것만) + 연령별 기본 단어 · 판 수 × 팀 수만큼 중복 없이
  qsource(st) {
    const age = qAge(st.mode); const ownW = (st.drawCustom || []).filter((w) => typeof w === 'string' && w.trim());
    const pool = ownW.length >= 6 ? ownW : [...ownW, ...WORDS[age]];
    return { items: pool, n: (age === 'kid' ? 2 : 3) * Math.max(1, st.nTeams || 4), key: (w) => w, pri: (w) => ownW.includes(w) };
  },
  create(ctx) {
    const r = rng(ctx.seed);
    const age = qAge(ctx.settings.mode);
    const R = age === 'kid' ? 2 : 3;
    const rSec = { kid: 60, elem: 50, adult: 45 }[age];
    const ownW = (ctx.settings.drawCustom || []).filter((w) => typeof w === 'string' && w.trim());
    const pool = ownW.length >= 6 ? ownW : [...new Set([...ownW, ...WORDS[age]])];
    const C = clock();
    const P = new Map();
    const add = (p) => P.set(p.id, { ...p, pts: [], got: null, lock: 0, active: false });
    ctx.players.forEach(add);
    const order = Object.fromEntries(ctx.teams.map((t) => [t, shuffle(r, [...P.values()].filter((p) => p.team === t).map((p) => p.id))]));
    let round = -1, ph = 'gap', phEnd = 1.5, roundStart = 0;
    let TM = {}; // 팀별 이번 판 {drawer, word, opts, sk:[], seq, newSk:[]}
    let used = new Set();
    const deck = ctx.qset ? [...ctx.qset] : null; // 엔진이 고른 이번 판 단어(행사 안 중복 없음)
    const pickWord = () => { if (deck && deck.length) { const w = deck.shift(); used.add(w); return w; } const left = pool.filter((w) => !used.has(w)); const w = (left.length ? left : pool)[Math.floor(r() * (left.length || pool.length))]; used.add(w); return w; };
    const startRound = () => {
      round++; ph = 'draw'; roundStart = C.T; phEnd = C.T + rSec; TM = {};
      for (const t of ctx.teams) {
        const ids = [...P.values()].filter((p) => p.team === t).map((p) => p.id);
        if (!ids.length) continue;
        for (const id of ids) if (!order[t].includes(id)) order[t].push(id);
        const live = order[t].filter((id) => P.has(id));
        const drawer = live[round % live.length];
        const word = pickWord();
        const opts = shuffle(r, [word, ...shuffle(r, pool.filter((w) => w !== word)).slice(0, 5)]);
        TM[t] = { drawer, word, opts, sk: [], seq: 0, newSk: [], clr: false };
      }
      for (const p of P.values()) { p.got = null; p.lock = 0; p.syncSeq = -1; }
      ctx.dirtyAll();
    };
    const guessers = (t) => [...P.values()].filter((p) => p.team === +t && TM[t] && TM[t].drawer !== p.id);
    const endRound = () => {
      ph = 'reveal'; phEnd = C.T + 4.5;
      for (const [t, tm] of Object.entries(TM)) {
        const gs = guessers(t); let sum = 0;
        for (const g of gs) { const s = g.got != null ? Math.round(40 + 60 * clamp(1 - g.got / rSec, 0, 1)) : 0; g.pts.push(s); sum += s; }
        const d = P.get(tm.drawer); if (d && gs.length) d.pts.push(Math.round(sum / gs.length));
      }
      ctx.dirtyAll();
    };
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      shift: C.shift,
      input(pid, m) {
        const p = P.get(pid); if (!p || ph !== 'draw') return;
        const tm = TM[p.team]; if (!tm) return;
        if (m.a === 'ln' && tm.drawer === pid) {
          if (!Array.isArray(m.p) || m.p.length < 4 || m.p.length > 120 || m.p.length % 2) return;
          if (!m.p.every((v) => Number.isInteger(v) && v >= 0 && v <= 1000)) return;
          if (tm.sk.length > 2500) return;
          const seg = [intIn(m.c, 0, 7) ? m.c : 0, intIn(m.w, 1, 3) ? m.w : 2, ...m.p];
          tm.sk.push(seg); tm.newSk.push(seg); tm.seq++; p.active = true;
          // 새 획만 보냄 (전체 그림은 처음·재접속 때만) — 300명일 때 메시지 폭주 방지
          for (const g of guessers(p.team)) { ctx.sendTo(g.id, { run: ctx.runId, r: { sk: [seg], seq: tm.seq } }); if (g.syncSeq === tm.seq - 1) g.syncSeq = tm.seq; }
          return;
        }
        if (m.a === 'clr' && tm.drawer === pid) {
          tm.sk = []; tm.newSk = []; tm.clr = true; tm.seq++;
          for (const g of guessers(p.team)) { ctx.sendTo(g.id, { run: ctx.runId, r: { clr: true, seq: tm.seq } }); g.syncSeq = tm.seq; }
          return;
        }
        if (m.a === 'sync') { p.syncSeq = -1; ctx.dirty(pid); return; } // 폰이 그림을 놓쳤을 때 전체 다시 받기
        if (m.a === 'g' && tm.drawer !== pid && p.got == null && intIn(m.w, 0, tm.opts.length - 1)) {
          p.active = true;
          if (C.T < p.lock) return { wait: true };
          if (tm.opts[permFor(pid, `${ctx.runId}:d${round}`, tm.opts.length)[m.w]] === tm.word) { // 보기 순서는 사람마다 다름
            p.got = C.T - roundStart;
            const all = Object.keys(TM).every((t) => guessers(t).every((g) => g.got != null || (!g.active && round > 0)));
            if (all && Object.keys(TM).some((t) => guessers(t).some((g) => g.got != null))) phEnd = Math.min(phEnd, C.T + 1.2);
            return { right: true };
          }
          p.lock = C.T + 2.5; return { right: false, lock: 2.5 };
        }
      },
      tick(now) {
        C.dt(now);
        if (C.T >= phEnd) {
          if (ph === 'gap' || ph === 'reveal') { if (round + 1 >= R) { ph = 'end'; ctx.endEarly(); return; } startRound(); }
          else if (ph === 'draw') endRound();
        }
        if (now - (this._v || 0) > 1000) { this._v = now; for (const p of P.values()) if (!TM[p.team] || TM[p.team].drawer !== p.id) ctx.dirty(p.id); }
      },
      view(pid, now) {
        const p = P.get(pid); if (!p) return { g: 'draw', spectator: true };
        const tm = TM[p.team];
        const base = { g: 'draw', ph, round, R, until: now + Math.round(Math.max(0, phEnd - C.T) * 1000), kid: age === 'kid' };
        if (!tm) return { ...base, wait: true };
        const drawerName = P.get(tm.drawer)?.name || '';
        if (tm.drawer === pid) return { ...base, me: 'draw', word: tm.word, solved: guessers(p.team).filter((g) => g.got != null).length, n: guessers(p.team).length };
        const pm = permFor(pid, `${ctx.runId}:d${round}`, tm.opts.length);
        return { ...base, me: 'guess', drawer: drawerName, opts: pm.map((k) => tm.opts[k]), got: p.got != null, answer: ph === 'reveal' ? tm.word : null, seq: tm.seq, ...(p.syncSeq !== tm.seq ? (p.syncSeq = tm.seq, { sk: tm.sk }) : {}) };
      },
      screen() {
        const teams = {};
        for (const [t, tm] of Object.entries(TM)) {
          const gs = guessers(t);
          teams[t] = { d: P.get(tm.drawer)?.name || '', add: tm.newSk, clr: tm.clr, seq: tm.seq, ok: gs.filter((g) => g.got != null).length, n: gs.length, word: ph === 'reveal' ? tm.word : null };
          if (C.T - (tm.fullAt ?? -9) >= 4 && tm.sk.length < 1500) { tm.fullAt = C.T; teams[t].full = tm.sk; } // 대형 화면 보정용 전체 그림: 4초에 한 번
          tm.newSk = []; tm.clr = false;
        }
        return { ph, round, R, left: round1(Math.max(0, phEnd - C.T)), teams };
      },
      finish() {
        const players = {};
        for (const p of P.values()) {
          if (!p.active || !p.pts.length) continue;
          const avg = p.pts.reduce((a, b) => a + b, 0) / p.pts.length;
          players[p.id] = { raw: round1(avg), norm: round1(avg), show: `${p.pts.filter((x) => x > 0).length}/${p.pts.length}판 성공` };
        }
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 함성 대폭발
export const shout = {
  id: 'shout', no: 29, name: '함성 대폭발', emoji: '📣',
  dur: { kid: 31, elem: 31, adult: 31 }, minDur: { kid: 31, elem: 31, adult: 31 },
  rule: { all: '폰 마이크에 대고 "와아아아!" 소리 지르기! 신호가 나올 때 우리 팀이 제일 크게', kid: '"와~!" 하고 크게 소리 질러요! (마이크 켜기 눌러요)' },
  howto: '3번의 함성 시간 동안 소리 크기 평균 (마지막은 2배) · 마이크가 안 되면 버튼 연타로 응원',
  lateJoin: true,
  create(ctx) {
    // 준비 3초 → 함성 6초 → 쉬기 4초 → 함성 6초 → 쉬기 4초 → 마지막 함성 7초 (×2)
    const SEG = [['prep', 3], ['burst', 6, 1], ['rest', 4], ['burst', 6, 1], ['rest', 4], ['burst', 7, 2]];
    const C = clock();
    const P = new Map();
    const add = (p) => P.set(p.id, { ...p, lv: 0, at: -9, sum: 0, w: 0, peak: 0, mic: false, active: false, taps: 0 });
    ctx.players.forEach(add);
    let peak = null;
    const segAt = (T) => { let t = 0; for (let i = 0; i < SEG.length; i++) { if (T < t + SEG[i][1]) return { i, ph: SEG[i][0], w: SEG[i][2] || 0, left: t + SEG[i][1] - T, n: SEG.filter((s, j) => s[0] === 'burst' && j <= i).length }; t += SEG[i][1]; } return { i: SEG.length, ph: 'end', w: 0, left: 0, n: 3 }; };
    let lastPh = null;
    const cur = (p, T) => (T - p.at < 0.7 ? p.lv : 0);
    const teamNow = () => { const o = Object.fromEntries(ctx.teams.map((t) => [t, { s: 0, n: 0 }])); for (const p of P.values()) { if (!p.active || !o[p.team]) continue; o[p.team].s += cur(p, C.T); o[p.team].n++; } return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x.n ? Math.round(x.s / x.n) : 0])); };
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      shift: C.shift,
      input(pid, m) {
        const p = P.get(pid); if (!p) return;
        if (m.a === 'lv' && numIn(m.v, 0, 100)) { p.lv = m.v; p.at = C.T; p.mic = true; p.active = true; }
        else if (m.a === 'tap' && intIn(m.n, 1, 12)) { p.taps += m.n; p.lv = Math.min(60, (p.at > C.T - 0.7 ? p.lv : 0) * 0.6 + m.n * 9); p.at = C.T; p.active = true; }
      },
      tick(now) {
        const d = C.dt(now); const s = segAt(C.T);
        if (s.ph === 'burst') for (const p of P.values()) { if (!p.active) continue; const v = cur(p, C.T); p.sum += v * d * s.w; p.w += d * s.w; if (v > p.peak) p.peak = v; if (!peak || v > peak.v) peak = { v, name: p.name, team: p.team }; }
        else for (const p of P.values()) if (p.active) p.w += 0; // 쉬는 시간은 기록 안 함
        if (s.ph !== lastPh) { lastPh = s.ph; ctx.dirtyAll(); }
        if (s.ph === 'end') ctx.endEarly();
        if (now - (this._v || 0) > 500) { this._v = now; ctx.dirtyAll(); }
      },
      view(pid, now) {
        const p = P.get(pid); if (!p) return { g: 'shout', spectator: true };
        const s = segAt(C.T);
        return { g: 'shout', ph: s.ph, n: s.n, w: s.w, until: now + Math.round(s.left * 1000), team: teamNow()[p.team] || 0, mic: p.mic };
      },
      screen() {
        const s = segAt(C.T);
        const tot = {}; for (const p of P.values()) { if (!p.active) continue; (tot[p.team] ||= { s: 0, n: 0 }); tot[p.team].s += p.w ? p.sum / p.w : 0; tot[p.team].n++; }
        return { ph: s.ph, n: s.n, w: s.w, left: round1(s.left), now: teamNow(), avg: Object.fromEntries(ctx.teams.map((t) => [t, tot[t] ? Math.round(tot[t].s / tot[t].n) : 0])), peak: peak ? [peak.name, peak.team, Math.round(peak.v)] : null };
      },
      finish() {
        const players = {};
        for (const p of P.values()) {
          if (!p.active) continue;
          const avg = p.w ? p.sum / p.w : 0;
          players[p.id] = { raw: Math.round(avg), norm: round1(clamp(avg * 1.25, 0, 100)), show: `평균 ${Math.round(avg)} · 최고 ${Math.round(p.peak)}${p.mic ? '' : ' (버튼)'}` };
        }
        return { players };
      },
    };
  },
};

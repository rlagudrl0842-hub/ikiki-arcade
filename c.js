// GAME 11~15: 가위바위보 서바이벌 / 숫자 사냥 / 기억력 배틀 / 색깔 함정 / 스피드 OX
import { rng, rint, hashSeed, numHuntLayout, memorySeq, colorRound } from './gen.js';
import { LV, norm, round1, clamp, intIn } from './common.js';

// ---------------------------------------------------------------- 11 가위바위보 서바이벌
// 모두가 대형 화면 속 '번개쌤'과 가위바위보. 서버가 라운드 시작 때 번개쌤의 손을 미리 정함(비공개).
export const rps = {
  id: 'rps', no: 11, name: '가위바위보 서바이벌', emoji: '✌️',
  dur: { kid: 50, elem: 60, adult: 60 },
  untimed: true,
  rule: {
    kid: '번개쌤과 가위바위보! 이기면 별 2개, 비기면 별 1개',
    elem: '번개쌤과 가위바위보! 하트 3개, 지면 하트 -1. 이기면 2점 비기면 1점',
    adult: '번개쌤과 가위바위보 서바이벌! 목숨 2개, 지면 -1. 끝까지 살아남으세요',
  },
  howto: '전원이 동시에 지면 그 라운드는 무효(다시 하기)',
  create(ctx) {
    const age = ctx.events.dominantAge();
    const rounds = age === 'kid' ? 5 : 6;
    const lives = { kid: 99, elem: 3, adult: 2 }[age];
    const r = rng(ctx.seed);
    const P = new Map(ctx.players.map((p) => [p.id, { ...p, pick: null, pts: 0, lives, played: 0 }]));
    let round = 0, phase = 'wait', until = 0, host = null, last = null;
    const alive = () => [...P.values()].filter((p) => p.lives > 0);
    const begin = (now) => { round++; phase = 'pick'; until = now + (age === 'kid' ? 8000 : 6000); host = rint(r, 3); for (const p of P.values()) p.pick = null; ctx.dirtyAll(); };
    const res = (a, b) => (a === b ? 0 : (a - b + 3) % 3 === 1 ? 1 : -1); // 0가위 1바위 2보: 바위>가위
    const reveal = (now) => {
      const al = alive();
      const out = al.map((p) => ({ p, r: p.pick == null ? -1 : res(p.pick, host) }));
      const allLose = age !== 'kid' && out.length > 0 && out.every((o) => o.r < 0);
      if (!allLose) for (const o of out) { o.p.played++; if (o.r > 0) o.p.pts += 2; else if (o.r === 0) o.p.pts += 1; else if (age !== 'kid') o.p.lives--; }
      last = { host, voided: allLose, win: out.filter((o) => o.r > 0).length, draw: out.filter((o) => o.r === 0).length, lose: out.filter((o) => o.r < 0).length };
      phase = 'reveal'; until = now + 4000; ctx.dirtyAll();
    };
    return {
      start(now) { begin(now); },
      shift(ms) { until += ms; },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'pick' || phase !== 'pick' || p.lives <= 0) return;
        if (!intIn(m.v, 0, 2)) return;
        p.pick = m.v;
        if (alive().every((x) => x.pick != null || !ctx.events.players.get(x.id)?.online)) until = Math.min(until, now + 700);
        return { ok: true };
      },
      tick(now) {
        if (now < until) return;
        if (phase === 'pick') reveal(now);
        else if (phase === 'reveal') {
          if (round >= rounds || (age !== 'kid' && alive().length <= 1)) { phase = 'done'; ctx.endEarly(); } else begin(now);
        }
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'rps', spectator: true };
        const myR = phase === 'reveal' && p.pick != null ? res(p.pick, host) : null;
        return { g: 'rps', round, rounds, phase, until, pick: p.pick, lives: p.lives, maxLives: lives, kid: age === 'kid', pts: p.pts, host: phase === 'reveal' ? host : null, myR, voided: last?.voided && phase === 'reveal' };
      },
      screen() {
        const team = Object.fromEntries(ctx.teams.map((t) => { const a = [...P.values()].filter((p) => p.team === t); return [t, { alive: a.filter((p) => p.lives > 0).length, total: a.length, pts: a.reduce((s, p) => s + p.pts, 0) }]; }));
        return { round, rounds, phase, until, host: phase === 'reveal' ? host : null, last: phase === 'reveal' ? last : null, aliveN: alive().length, picked: alive().filter((p) => p.pick != null).length, team, kid: age === 'kid' };
      },
      finish() {
        const players = {};
        for (const p of P.values()) if (p.played) players[p.id] = { raw: p.pts, norm: round1(clamp((p.pts / (2 * round)) * 100 + (p.lives > 0 && age !== 'kid' ? 10 : 0), 0, 100)), show: `${p.pts}점${age !== 'kid' && p.lives > 0 ? ' 생존' : ''}` };
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 12 숫자 사냥
export const numhunt = {
  id: 'numhunt', no: 12, name: '숫자 사냥', emoji: '🔢',
  dur: { kid: 25, elem: 40, adult: 45 },
  rule: { kid: '1, 2, 3, 4, 5! 숫자를 순서대로 눌러요', elem: '흩어진 숫자를 1부터 순서대로 빠르게! 다 누르면 새 판이 나와요', adult: '1~25를 순서대로! 틀리면 감점, 다 누르면 새 판' },
  howto: '시간 안에 순서대로 누른 숫자 개수(틀린 터치는 감점)',
  lateJoin: true,
  create(ctx) {
    const N = (p) => (p.age === 'kid' ? 5 : p.age === 'adult' ? 25 : ctx.settings.elemLevel === 'high' ? 16 : 9);
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, board: 0, next: 1, done: 0, err: 0, active: false }); ctx.players.forEach(add);
    const seedOf = (p) => hashSeed(ctx.seed, 'n', p.board);
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      input(pid, m) {
        const p = P.get(pid); if (!p || m.a !== 'tap' || m.b !== p.board) return;
        const n = N(p); const lay = numHuntLayout(seedOf(p), n);
        if (!intIn(m.k, 0, lay.side * lay.side - 1)) return;
        p.active = true;
        if (lay.pos[p.next - 1] === m.k) {
          p.done++; p.next++;
          if (p.next > n) { p.board++; p.next = 1; return { ok: true, newBoard: p.board }; }
          return { ok: true, next: p.next };
        }
        p.err++; return { wrong: true };
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'numhunt', spectator: true };
        return { g: 'numhunt', n: N(p), board: p.board, seed: seedOf(p), next: p.next, done: p.done, err: p.err };
      },
      score(p) { return Math.max(0, p.done - (p.age === 'kid' ? 0 : p.err * 0.5)); },
      screen() {
        const tm = {}; const c = {};
        for (const p of P.values()) { if (!p.active) continue; tm[p.team] = (tm[p.team] || 0) + this.score(p) / N(p); c[p.team] = (c[p.team] || 0) + 1; }
        const top = [...P.values()].filter((p) => p.active).sort((a, b) => this.score(b) / N(b) - this.score(a) / N(a)).slice(0, 5).map((p) => ({ name: p.name, team: p.team, boards: p.board, next: p.next, n: N(p) }));
        return { boards: Object.fromEntries(ctx.teams.map((t) => [t, c[t] ? round1(tm[t] / c[t]) : 0])), top };
      },
      finish() {
        const players = {};
        const sec = ctx.durMs / 1000;
        const rate = { kid: 0.8, elem: 1.0, adult: 1.1 }; // 100점 = 초당 이만큼 정확히 누름
        for (const p of P.values()) {
          if (!p.active) continue;
          const s = this.score(p);
          players[p.id] = { raw: round1(s), norm: norm(s, rate[p.age] * sec), show: `${p.done}개${p.err ? ` (실수 ${p.err})` : ''}` };
        }
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 13 기억력 배틀
export const memory = {
  id: 'memory', no: 13, name: '기억력 배틀', emoji: '🧠',
  dur: { kid: 45, elem: 60, adult: 75 },
  rule: { kid: '반짝반짝! 빛난 순서대로 똑같이 눌러요', all: '버튼이 반짝이는 순서를 기억했다가 그대로 누르세요! 단계마다 길어져요. 기회 2번' },
  howto: '도달한 단계와 정확도로 점수',
  lateJoin: true,
  create(ctx) {
    const range = { kid: [2, 4], elem: [3, 7], adult: [4, 10] };
    const btns = { kid: 4, elem: 4, adult: 6 };
    const flash = { kid: 800, elem: 600, adult: 480 };
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, lvl: range[p.age][0], cleared: 0, lives: 2, tries: 0, okTries: 0, shownAt: null, att: 0, fin: false }); ctx.players.forEach(add);
    const seq = (p) => memorySeq(hashSeed(ctx.seed, 'm', p.lvl, p.att), p.lvl, btns[p.age]);
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || p.fin) return;
        if (m.a === 'show') { p.shownAt = now; return { seq: seq(p), lvl: p.lvl, att: p.att }; }
        if (m.a !== 'ans' || m.lvl !== p.lvl || m.att !== p.att || !p.shownAt) return;
        // 순서를 다 보여 주기도 전에 답하면 무효
        if (now - p.shownAt < p.lvl * flash[p.age] * 0.6) return { tooFast: true };
        const s = seq(p);
        if (!Array.isArray(m.seq) || m.seq.length !== s.length) return;
        p.tries++; p.shownAt = null;
        const ok = m.seq.every((v, i) => v === s[i]);
        if (ok) {
          p.okTries++; p.cleared = p.lvl;
          if (p.lvl >= range[p.age][1]) { p.fin = true; return { ok: true, fin: true }; }
          p.lvl++; p.att = 0; return { ok: true, lvl: p.lvl };
        }
        p.lives--; p.att++;
        if (p.lives <= 0) { p.fin = true; return { wrong: true, fin: true, answer: s }; }
        return { wrong: true, answer: s, lives: p.lives };
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'memory', spectator: true };
        return { g: 'memory', lvl: p.lvl, att: p.att, lives: p.lives, cleared: p.cleared, fin: p.fin, btns: btns[p.age], flash: flash[p.age], max: range[p.age][1], min: range[p.age][0], kid: p.age === 'kid' };
      },
      screen() {
        const tm = {}; const c = {};
        const pr = (p) => (p.cleared ? (p.cleared - range[p.age][0] + 1) / (range[p.age][1] - range[p.age][0] + 1) : 0);
        for (const p of P.values()) { if (!p.tries) continue; tm[p.team] = (tm[p.team] || 0) + pr(p); c[p.team] = (c[p.team] || 0) + 1; }
        const top = [...P.values()].filter((p) => p.cleared).sort((a, b) => pr(b) - pr(a)).slice(0, 5).map((p) => ({ name: p.name, team: p.team, lvl: p.cleared }));
        return { prog: Object.fromEntries(ctx.teams.map((t) => [t, c[t] ? round1((tm[t] / c[t]) * 100) : 0])), top };
      },
      finish() {
        const players = {};
        for (const p of P.values()) {
          if (!p.tries) continue;
          const [a, b] = range[p.age];
          const pr = p.cleared ? (p.cleared - a + 1) / (b - a + 1) : 0;
          const acc = p.okTries / p.tries;
          players[p.id] = { raw: p.cleared, norm: round1(clamp(pr * 85 + acc * 15, 0, 100)), show: p.cleared ? `${p.cleared}단계` : '0단계' };
        }
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 14 색깔 함정
export const colortrap = {
  id: 'colortrap', no: 14, name: '색깔 함정', emoji: '🎨',
  dur: { kid: 25, elem: 30, adult: 30 },
  rule: { kid: '말한 색깔(모양) 그림만 톡톡! 다 찾으면 다음 판', elem: '지시한 색깔 칸만 빠르게 터치! 가끔 글자가 다른 색으로 속여요', adult: '지시한 색만 터치! 글자에 속지 마세요. 틀리면 감점' },
  howto: '맞힌 개수 - 틀린 개수. 모양 표시가 함께 있어 색 구분이 어려워도 OK',
  lateJoin: true,
  create(ctx) {
    const cfg = { kid: { tiles: 6, colors: 3 }, elem: { tiles: 9, colors: 5 }, adult: { tiles: 12, colors: 6 } };
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, r: 0, found: new Set(), ok: 0, bad: 0, active: false }); ctx.players.forEach(add);
    const roundOf = (p) => { const c = cfg[p.age]; return colorRound(ctx.seed, p.r, c.tiles, c.colors, p.age !== 'kid' && p.r % 3 === 2); };
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      input(pid, m) {
        const p = P.get(pid); if (!p || m.a !== 'tap' || m.r !== p.r) return;
        const R = roundOf(p);
        if (!intIn(m.i, 0, R.grid.length - 1)) return;
        p.active = true;
        if (R.grid[m.i] === R.target) {
          if (p.found.has(m.i)) return;
          p.found.add(m.i); p.ok++;
          if (p.found.size >= R.nTarget) { p.r++; p.found = new Set(); return { ok: true, next: p.r }; }
          return { ok: true };
        }
        p.bad++; return { wrong: true };
      },
      score(p) { return Math.max(0, p.ok - (p.age === 'kid' ? 0 : p.bad)); },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'colortrap', spectator: true };
        const c = cfg[p.age];
        return { g: 'colortrap', seed: ctx.seed, r: p.r, tiles: c.tiles, colors: c.colors, stroop: p.age !== 'kid' && p.r % 3 === 2, found: [...p.found], score: this.score(p), kid: p.age === 'kid' };
      },
      screen() {
        const tm = {}; const c = {};
        for (const p of P.values()) { if (!p.active) continue; tm[p.team] = (tm[p.team] || 0) + this.score(p); c[p.team] = (c[p.team] || 0) + 1; }
        return { avg: Object.fromEntries(ctx.teams.map((t) => [t, c[t] ? round1(tm[t] / c[t]) : 0])) };
      },
      finish() {
        const players = {};
        const sec = ctx.durMs / 1000;
        const rate = { kid: 0.9, elem: 1.3, adult: 1.5 };
        for (const p of P.values()) if (p.active) players[p.id] = { raw: this.score(p), norm: norm(this.score(p), rate[p.age] * sec), show: `${p.ok}개${p.bad ? ` (실수 ${p.bad})` : ''}` };
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 15 스피드 OX
export const ox = {
  id: 'ox', no: 15, name: '스피드 OX', emoji: '⭕',
  dur: { kid: 80, elem: 90, adult: 100 },
  untimed: true,
  rule: { kid: '맞으면 O, 틀리면 X! 그림을 보고 골라요', all: '문제가 나오면 O 또는 X! 맞히면 100점 + 빨리 고를수록 보너스' },
  howto: '문제는 관리자 화면에서 추가·수정할 수 있어요',
  create(ctx) {
    const age = ctx.events.dominantAge();
    const count = { kid: 5, elem: 7, adult: 8 }[age];
    const qMs = age === 'kid' ? 10000 : 8000;
    const r = rng(ctx.seed);
    const bank = ctx.events.db.all('SELECT id, text, emoji, answer FROM questions WHERE age=? AND active=1', age);
    const Q = [];
    const pool = bank.slice();
    while (Q.length < count && pool.length) Q.push(pool.splice(rint(r, pool.length), 1)[0]);
    const P = new Map(ctx.players.map((p) => [p.id, { ...p, ans: {}, pts: 0, right: 0, cnt: 0 }]));
    let qi = -1, phase = 'wait', until = 0, qAt = 0;
    const begin = (now) => { qi++; phase = 'q'; qAt = now; until = now + qMs; ctx.dirtyAll(); };
    const reveal = (now) => {
      const q = Q[qi];
      for (const p of P.values()) {
        const a = p.ans[qi]; if (!a) continue;
        p.cnt++;
        if (a.v === q.answer) { p.right++; p.pts += 100 + Math.round(50 * clamp(1 - a.t / qMs, 0, 1)); }
      }
      phase = 'reveal'; until = now + 3500; ctx.dirtyAll();
    };
    return {
      start(now) { if (!Q.length) { phase = 'done'; ctx.endEarly(); return; } begin(now); },
      shift(ms) { until += ms; qAt += ms; },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'ans' || phase !== 'q' || m.q !== qi || p.ans[qi]) return;
        if (m.v !== 0 && m.v !== 1) return;
        p.ans[qi] = { v: m.v, t: now - qAt };
        if ([...P.values()].every((x) => x.ans[qi] || !ctx.events.players.get(x.id)?.online)) until = Math.min(until, now + 500);
        return { ok: true };
      },
      tick(now) {
        if (now < until) return;
        if (phase === 'q') reveal(now);
        else if (phase === 'reveal') { if (qi + 1 >= Q.length) { phase = 'done'; ctx.endEarly(); } else begin(now); }
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'ox', spectator: true };
        const q = Q[qi];
        return { g: 'ox', qi, n: Q.length, phase, until, text: q?.text, emoji: q?.emoji, my: p.ans[qi]?.v ?? null, answer: phase === 'reveal' ? q.answer : null, pts: p.pts, kid: age === 'kid' };
      },
      screen() {
        const q = Q[qi];
        const cnt = [0, 0]; for (const p of P.values()) { const a = p.ans[qi]; if (a) cnt[a.v]++; }
        return { qi, n: Q.length, phase, until, text: q?.text, emoji: q?.emoji, answer: phase === 'reveal' ? q.answer : null, cnt, total: P.size,
          team: Object.fromEntries(ctx.teams.map((t) => { const a = [...P.values()].filter((p) => p.team === t && p.cnt); return [t, a.length ? Math.round(a.reduce((s, p) => s + p.right / p.cnt, 0) / a.length * 100) : 0]; })) };
      },
      finish() {
        const players = {};
        for (const p of P.values()) if (p.cnt) players[p.id] = { raw: p.pts, norm: round1((p.pts / (150 * Q.length)) * 100), show: `${p.right}/${Q.length} 정답` };
        return { players };
      },
    };
  },
};

export const DEFAULT_QUESTIONS = [
  // 유아 (그림 퀴즈)
  ['kid', '강아지는 "멍멍" 하고 울어요', '🐶', 1], ['kid', '물고기는 하늘을 날아요', '🐟', 0], ['kid', '바나나는 노란색이에요', '🍌', 1],
  ['kid', '눈사람은 여름에 만들어요', '⛄', 0], ['kid', '자동차는 바퀴가 있어요', '🚗', 1], ['kid', '고양이는 알을 낳아요', '🐱', 0],
  ['kid', '해는 밤에 떠요', '🌞', 0], ['kid', '손을 씻을 땐 비누를 써요', '🧼', 1], ['kid', '코끼리는 코가 길어요', '🐘', 1], ['kid', '딸기는 파란색이에요', '🍓', 0],
  // 초등 (상식·학교·체육)
  ['elem', '축구 경기는 한 팀에 11명이 뛰어요', '⚽', 1], ['elem', '농구 골대에 공을 넣으면 항상 3점이에요', '🏀', 0], ['elem', '거미의 다리는 8개예요', '🕷️', 1],
  ['elem', '물은 100도에서 꽁꽁 얼어요', '💧', 0], ['elem', '우리나라의 수도는 서울이에요', '🇰🇷', 1], ['elem', '1년은 12달이에요', '📅', 1],
  ['elem', '줄넘기 2단 뛰기는 한 번 뛸 때 줄이 두 바퀴 돌아요', '🪢', 1], ['elem', '펭귄은 날 수 있는 새예요', '🐧', 0], ['elem', '태양은 지구 주위를 돌아요', '🌍', 0], ['elem', '무지개는 7가지 색으로 표현해요', '🌈', 1],
  // 성인 (상식·넌센스·심리전)
  ['adult', '올림픽 오륜기의 고리는 모두 5개다', '⭕', 1], ['adult', '마라톤 정식 거리는 42.195km다', '🏃', 1], ['adult', '사람의 뼈는 성인 기준 300개가 넘는다', '🦴', 0],
  ['adult', '"세상에서 가장 뜨거운 과일"은 천도복숭아다 (넌센스)', '🍑', 1], ['adult', '탁구공의 공식 지름은 40mm다', '🏓', 1], ['adult', '번개는 같은 곳에 두 번 떨어지지 않는다', '⚡', 0],
  ['adult', '하루는 1,440분이다', '⏰', 1], ['adult', '배구는 한 팀 6명이 경기한다', '🏐', 1], ['adult', '금붕어의 기억력은 3초밖에 안 된다', '🐠', 0], ['adult', '축구공 표면은 흰색 육각형만으로 되어 있다', '⚽', 0],
];

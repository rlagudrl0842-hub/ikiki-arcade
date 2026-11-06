// 폰 없는 체육 60종 — 서버 쪽 진행 엔진 (17가지 진행 방식 × 게임별 규칙)
// 화면은 진행·연출만, 점수는 사회자 입력(hostAct)만으로 바뀜. 학생 움직임 자동 감지 없음
import { PE, MV, mvFor, OX, SHAPES, BAL, GROUP, RPS } from './pe2data.js';
import { rng, shuffle } from './gen.js';
import { clamp, round1 } from './common.js';

const pickR = (r, a) => a[Math.floor(r() * a.length)];
const parseTask = (s, space) => s.split(' + ').map((x) => { const [id, n] = x.split(':'); const m = mvFor(id, space); return { id: m.id, k: m.k, n: m.n, cnt: n || '' }; });
const taskText = (s, space) => parseTask(s, space).map((t) => `${t.n}${t.cnt ? ` ${/초$/.test(t.cnt) ? t.cnt : `${t.cnt}번`}` : ''}`).join(' + ');
const mvOut = (id, space) => { const m = mvFor(id, space); return { id: m.id, k: m.k, n: m.n }; };

// ---------------- 진행 방식별 규칙
const M = {};

// 따라 하기: 장면(동물·숲·로봇·구름다리·레이저)마다 동작 하나. 장애물형은 장애물이 선에 닿는 순간, 로봇형은 '삐빅' 뒤 버티기, 구름다리형은 균형 게이지
M.follow = {
  init(S) { const p = S.p; S.steps = shuffle(S.r, p.steps.map((s) => ({ name: s[0], mv: mvOut(s[1], S.space), desc: s[2] }))); S.i = -1; S.next = 2; S.got = {}; },
  tick(S, T) {
    if (T < S.next) return;
    S.i++; const sec = S.p.sec[S.t]; S.at = T; S.next = T + sec + (S.p.hold ? 3 : 0) + (S.p.balance ? 2 : 0); S.got = {}; S.dirty();
    if (S.i > 0 && S.i % S.steps.length === 0) S.steps = shuffle(S.r, S.steps);
  },
  act(S, a) { if (a.a === 'ok' && S.i >= 0 && !S.got[a.team]) { S.got[a.team] = 1; S.add(a.team, 1, S.lv === 0 ? '참여 ⭐' : '⭐ 성공'); } },
  show(S, T) { const st = S.i >= 0 ? S.steps[S.i % S.steps.length] : null; const sec = S.p.sec[S.t]; return { i: S.i, st, k: st ? clamp((T - S.at) / sec, 0, 1) : 0, sec, hold: !!S.p.hold, obstacle: !!S.p.obstacle, balance: !!S.p.balance, scene: S.p.scene, got: Object.keys(S.got).map(Number) }; },
  ui(S) { return { note: S.lv === 0 ? '참여한 팀에 별을 주세요 (동작마다 한 번)' : '이번 동작을 잘 해낸 팀을 눌러요 (동작마다 한 번)', team: [[S.lv === 0 ? '⭐ 참여' : '⭐ 성공', 'ok', 1, 'green']], once: S.got }; },
};

// 신호 반응: 색·불·신호등·풍선·반대로·색깔 전쟁·무궁화·댄스 스톱·템포·OX
M.signal = {
  init(S) { S.i = -1; S.next = 2.5; S.got = {}; S.cur = null; S.combo = {}; S.oxList = shuffle(S.r, OX); },
  tick(S, T) {
    const p = S.p; if (T < S.next) return;
    S.i++; S.got = {}; S.at = T;
    if (p.style === 'ox') {
      // 문제(카운트다운) → 정답 공개
      if (!S.cur || S.cur.ph === 'ans') { const q = S.oxList[Math.floor(S.i / 2) % S.oxList.length]; S.cur = { ph: 'ask', q: q[0], ans: q[1] }; S.next = T + p.gap[S.t]; }
      else { S.cur = { ...S.cur, ph: 'ans' }; S.next = T + 6; }
      return S.dirty();
    }
    if (p.style === 'mugung' || p.style === 'dance') {
      const go = !S.cur || S.cur.n === 1; const sp = p.speed ? p.speed[S.t] : 1;
      S.cur = { n: go ? 0 : 1, sig: p.sig[go ? 0 : 1], pose: p.pose && !go ? mvOut(pickR(S.r, ['up', 'leg', 'airplane', 'tree', 'wide', 'squat']), S.space) : null, speed: round1(sp * (0.75 + S.r() * 0.6)) };
      S.next = T + (go ? p.gap[S.t] * (0.7 + S.r() * 0.8) : 2.5 + S.r() * 2); return S.dirty();
    }
    let n; do n = Math.floor(S.r() * p.sig.length); while (S.cur && n === S.cur.n && p.sig.length > 1);
    const sig = p.sig[n]; const cur = { n, sig, mv: mvOut(sig[2], S.space) };
    if (p.style === 'colorword') { const st = S.r() < (p.stroop[S.t] || 0); const w = st ? pickR(S.r, p.sig.filter((x) => x !== sig)) : sig; cur.word = w[0]; }
    if (p.style === 'opposite') { cur.flip = S.r() >= (p.flip[S.t] || 0); cur.mv = mvOut(cur.flip ? sig[2] : sig[3], S.space); }
    if (p.style === 'tempo') cur.bpm = Math.round(100 * sig[3]);
    if (p.trick && S.r() < (p.trick[S.t] || 0)) cur.trick = true; // 바뀌는 척만 (영상 효과)
    S.cur = cur; S.next = T + p.gap[S.t] * (0.85 + S.r() * 0.3); S.dirty();
  },
  act(S, a) {
    if (a.a === 'ok' && S.cur && !S.got[a.team]) {
      S.got[a.team] = 1; const v = a.v || 1; S.combo[a.team] = (S.combo[a.team] || 0) + 1; S.add(a.team, v, S.p.style === 'ox' ? (v >= 2 ? '대부분 정답!' : '절반 정답') : '정확!');
      if (S.p.style === 'colorword' && S.combo[a.team] % 3 === 0) S.add(a.team, 1, '연속 3번 보너스');
      if (S.p.style === 'dance' && v >= 2) S.combo[a.team] = 0;
    }
    if (a.a === 'miss') { S.combo[a.team] = 0; S.add(a.team, -1, S.p.style === 'mugung' ? '걸렸다!' : '움직였다!'); }
    if (a.a === 'goal') S.add(a.team, a.v, `도착 ${a.v === 3 ? '1등' : '2등'}!`);
  },
  show(S, T) { return { i: S.i, cur: S.cur, style: S.p.style, legend: S.p.sig?.map((s) => [s[0], s[1], mvOut(s[2], S.space)]), k: S.cur ? clamp((T - S.at) / Math.max(0.5, S.next - S.at), 0, 1) : 0, got: Object.keys(S.got).map(Number) }; },
  ui(S) {
    const st = S.p.style;
    if (st === 'ox') return { note: S.cur?.ph === 'ans' ? '정답 공개! 팀별로 맞힌 인원을 보고 눌러요' : '문제 카운트다운 중', team: [['대부분 정답 +2', 'ok', 2, 'green'], ['절반 +1', 'ok', 1, '']], once: S.got };
    if (st === 'mugung') return { note: '도착 순서와 걸린 팀을 눌러요', team: [['도착 1등 +3', 'goal', 3, 'green'], ['도착 2등 +2', 'goal', 2, ''], ['걸림 −1', 'miss', 0, 'red']] };
    if (st === 'dance') return { note: S.cur?.n === 1 ? 'STOP! 잘 멈춘 팀 (자세까지 정확하면 +2)' : '춤추는 중… STOP이 나오면 판정', team: [['멈춤 +1', 'ok', 1, 'green'], ['자세까지 +2', 'ok', 2, ''], ['움직임 −1', 'miss', 0, 'red']], once: S.got };
    return { note: '신호에 맞게 움직인 팀 (신호마다 한 번)', team: [['정확 +1', 'ok', 1, 'green'], ['틀림/움직임 −1', 'miss', 0, 'red']], once: S.got };
  },
};

// 번개 반응: 대기 → 번개(가짜 섞임) → 먼저 한 팀 순서대로
M.react = {
  init(S) { S.rd = 0; S.ph = 'wait'; S.next = 3 + S.r() * 2; S.order = []; S.go = null; S.fake = false; },
  tick(S, T) {
    if (S.ph === 'wait' && T >= S.next) {
      if (S.r() < (S.p.fake[S.t] || 0) && !S.fake) { S.fake = true; S.go = { ...pickR(S.r, S.p.act), fake: 1 }; S.goAt = T; S.next = T + 1.2 + S.r() * 2; return S.dirty(); }
      S.fake = false; const a = pickR(S.r, S.p.act); S.go = { t: a[0], mv: mvOut(a[1], S.space) }; S.goAt = T; S.ph = 'go'; S.order = []; S.next = T + 7; S.rd++; return S.dirty();
    }
    if (S.ph === 'wait' && S.fake && T >= S.goAt + 1) { S.go = null; S.dirty(); }
    if (S.ph === 'go' && T >= S.next) this.done(S, T);
    if (S.ph === 'done' && T >= S.next) { S.ph = 'wait'; S.go = null; S.next = T + 2 + S.r() * 3.5; S.dirty(); }
  },
  done(S, T) { S.ph = 'done'; S.next = T + 2.5; S.dirty(); },
  act(S, a, T) {
    if (a.a === 'first' && S.ph === 'go' && !S.order.includes(a.team)) { S.order.push(a.team); const v = S.order.length === 1 ? 2 : S.order.length === 2 ? 1 : 0; if (v) S.add(a.team, v, `${S.order.length}등 · ${round1(T - S.goAt)}초`); if (S.order.length >= Math.min(2, S.teams.length)) this.done(S, T); }
    if (a.a === 'miss') S.add(a.team, -1, '부정출발!');
    if (a.a === 'next' && S.ph !== 'go') { S.ph = 'wait'; S.next = T + 1.5; S.go = null; S.dirty(); }
  },
  show(S, T) { return { ph: S.ph, rd: S.rd, go: S.go, el: S.go ? round1(T - S.goAt) : 0, order: S.order }; },
  ui(S) { return { note: S.ph === 'go' ? '먼저 정확하게 한 팀부터 차례로 눌러요' : '번개를 기다리는 중 (가짜 번개에 움직이면 부정출발)', team: [['먼저!', 'first', 0, 'green'], ['부정출발 −1', 'miss', 0, 'red']], glob: [['다음 번개', 'next', 0, '']], once: Object.fromEntries(S.order.map((t) => [t, 1])) }; },
};

// 기억: 순서 보여 주기 → 숨기고 팀이 수행 → 사회자 판정
M.memory = {
  init(S) { S.rd = 0; S.seq = []; this.round(S, 2); },
  round(S, T) {
    const p = S.p; const n = p.len[Math.min(S.rd, p.len.length - 1)] + (S.t >= 2 && p.style !== 'footprint' ? 1 : 0);
    if (p.style === 'mines') { const [w, hgt] = p.grid; let x = Math.floor(S.r() * w); const path = [[x, 0]]; for (let y = 1; y < hgt; y++) { x = clamp(x + Math.floor(S.r() * 3) - 1, 0, w - 1); path.push([x, y]); } S.seq = path; }
    else if (p.style === 'grow' && S.seq.length) { S.seq = [...S.seq, mvOut(pickR(S.r, p.pool), S.space)]; }
    else if (p.style === 'code') { S.table = Array.from({ length: 10 }, (_, i) => mvOut(p.pool[i % p.pool.length], S.space)); S.seq = Array.from({ length: n }, () => Math.floor(S.r() * 10)); }
    else S.seq = Array.from({ length: p.style === 'grow' ? 2 : n }, () => mvOut(pickR(S.r, p.pool), S.space));
    S.rd++; S.ph = 'show'; S.at = T; S.got = {}; S.per = p.show[S.t]; S.next = T + S.seq.length * S.per + 1; S.dirty();
  },
  tick(S, T) { if (S.ph === 'show' && T >= S.next) { S.ph = 'do'; S.at = T; S.next = T + 8 + S.seq.length * 3; S.dirty(); } else if (S.ph === 'do' && T >= S.next) { S.ph = 'judge'; S.dirty(); } },
  pts(S, full) { const n = S.seq.length; const st = S.p.style; if (st === 'code' || st === 'grow') return full ? n : Math.floor(n / 2); if (st === 'footprint') return full ? (n >= 4 ? 2 : 1) : 0; return full ? 2 : 1; },
  act(S, a, T) {
    if ((a.a === 'ok' || a.a === 'half') && !S.got[a.team] && S.ph !== 'show') { S.got[a.team] = 1; const v = this.pts(S, a.a === 'ok'); if (v) S.add(a.team, v, a.a === 'ok' ? '완벽!' : '절반 성공'); }
    if (a.a === 'next') this.round(S, T);
    if (a.a === 'replay') { S.ph = 'show'; S.at = T; S.next = T + S.seq.length * S.per + 1; S.dirty(); }
  },
  show(S, T) { return { ph: S.ph, rd: S.rd, seq: S.seq, table: S.table, el: round1(T - S.at), per: S.per, left: round1(Math.max(0, S.next - T)), style: S.p.style, grid: S.p.grid, got: Object.keys(S.got).map(Number) }; },
  ui(S) { const n = S.seq.length; return { note: S.ph === 'show' ? '순서를 보여 주는 중…' : `팀별 결과를 눌러요 (완벽 +${this.pts(S, true)} / 절반 +${this.pts(S, false)})`, team: [['완벽', 'ok', 0, 'green'], ['절반', 'half', 0, '']], glob: [['다음 라운드 ▶', 'next', 0, 'yellow'], ['다시 보여 주기', 'replay', 0, '']], once: S.got, info: `${n}개` }; },
};

// 전진형: 별 길·보물상자·구조·연료·트랙·로켓
M.race = {
  init(S) { S.prog = Object.fromEntries(S.teams.map((t) => [t, 0])); S.done = []; S.alt = Object.fromEntries(S.teams.map((t) => [t, 0])); S.total = 0; },
  tick() {},
  act(S, a) {
    if (a.a !== 'step' || S.done.includes(a.team) && S.p.style !== 'rocket') return;
    const p = S.p; S.prog[a.team]++; S.total++; S.add(a.team, 1, p.style === 'fuel' ? '연료 +1' : p.style === 'rescue' ? '구조 성공!' : p.style === 'chest' ? '자물쇠 열림!' : p.style === 'track' ? '구간 통과' : p.style === 'rocket' ? '단계 완료' : '⭐ +1');
    if (p.style === 'rocket') { if (S.prog[a.team] >= p.stage) { S.prog[a.team] = 0; S.alt[a.team]++; S.add(a.team, 3, `🚀 발사! 고도 ${S.alt[a.team]}단계`); } return; }
    if (S.prog[a.team] >= p.goal) {
      S.done.push(a.team); const k = S.done.length;
      const bonus = p.style === 'track' ? (p.finishBonus[k - 1] || 0) : p.style === 'fuel' ? 3 : p.style === 'chest' ? 2 : 0;
      if (bonus) S.add(a.team, bonus, p.style === 'fuel' ? '🚀 발사 성공!' : p.style === 'chest' ? '💎 보물 획득!' : `${k}등 완주!`);
      if (S.done.length === S.teams.length) S.endEarly();
    }
  },
  show(S) { const p = S.p; return { style: p.style, prog: S.prog, goal: p.style === 'rocket' ? p.stage : p.goal, done: S.done, alt: S.alt, total: S.total, coopGoal: p.coop ? p.goal * S.teams.length : 0, chapters: p.chapters, moves: p.moves.map((m) => mvOut(m, S.space)) }; },
  ui(S) { const st = S.p.style; return { note: { track: '주자가 들어오면 그 팀 +1구간', fuel: '팀 전원이 세트를 끝내면 연료 +1', rocket: '단계 미션을 끝낸 팀 (4단계마다 발사)', rescue: '구조 미션을 해낸 팀', chest: '자물쇠 미션을 해낸 팀' }[st] || '미션을 해낸 팀', team: [[st === 'track' ? '+1구간' : st === 'fuel' ? '연료 +1' : st === 'rocket' ? '단계 +1' : '성공 +1', 'step', 0, 'green']] }; },
};

// 줄다리기: 두 팀씩 대결, 먼저 끝낸 쪽으로 한 칸
M.tug = {
  init(S) { const ts = S.teams; S.pairs = []; for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) S.pairs.push([ts[i], ts[j]]); S.pairs = shuffle(S.r, S.pairs); S.mi = 0; S.pos = 0; S.ph = 'ready'; S.next = 3; S.mv = mvOut(pickR(S.r, S.p.moves), S.space); S.wins = Object.fromEntries(ts.map((t) => [t, 0])); },
  tick(S, T) {
    if (S.ph === 'ready' && T >= S.next) { S.ph = 'pull'; S.mEnd = T + [45, 35, 30][S.t]; S.dirty(); }
    // 경기 시간이 끝나면 줄이 기운 쪽 승리 (가운데면 둘 다 +1)
    if (S.ph === 'pull' && T >= S.mEnd) { const [A, B] = S.pairs[S.mi]; if (S.pos === 0) { S.add(A, 1, '무승부'); S.add(B, 1, '무승부'); } else { const w = S.pos < 0 ? A : B; S.wins[w]++; S.add(w, 2, '시간 종료 · 판정승'); } S.ph = 'won'; S.next = T + 3.5; S.dirty(); } if (S.ph === 'won' && T >= S.next) { S.mi++; S.pos = 0; S.ph = S.mi < S.pairs.length ? 'ready' : 'end'; S.next = T + 3; S.mv = mvOut(pickR(S.r, S.p.moves), S.space); S.dirty(); if (S.ph === 'end') S.endEarly(); } },
  act(S, a, T) {
    if (a.a !== 'pull' || S.ph !== 'pull') return; const [A, B] = S.pairs[S.mi] || []; if (a.team !== A && a.team !== B) return;
    S.pos += a.team === A ? -1 : 1; S.mv = mvOut(pickR(S.r, S.p.moves), S.space); S.ev.push({ k: 'pull', team: a.team, t: T, id: ++S.eid });
    if (Math.abs(S.pos) >= S.p.goal) { const w = S.pos < 0 ? A : B; S.wins[w]++; S.add(w, 3, '경기 승리!'); S.ph = 'won'; S.next = T + 3.5; }
    S.dirty();
  },
  show(S, T) { return { pair: S.pairs[S.mi] || null, pos: S.pos, goal: S.p.goal, ph: S.ph, left: S.ph === 'pull' ? round1(Math.max(0, S.mEnd - T)) : null, mv: S.mv, mi: S.mi, n: S.pairs.length, wins: S.wins, next: S.pairs[S.mi + 1] || null }; },
  // 게임 시간이 경기 도중에 끝나면: 그 경기도 시간 종료와 같은 규칙으로 판정 (전에는 진행 중이던 경기가 점수 없이 사라졌음)
  final(S) { if (S.ph !== 'pull' || !S.pairs[S.mi]) return; const [A, B] = S.pairs[S.mi]; if (S.pos === 0) { S.add(A, 1, '무승부'); S.add(B, 1, '무승부'); } else { const w = S.pos < 0 ? A : B; S.wins[w]++; S.add(w, 2, '시간 종료 · 판정승'); } S.ph = 'won'; },
  ui(S) { const pr = S.pairs[S.mi]; return { note: pr ? `대결 중: 먼저 끝낸 팀을 눌러요 (${S.p.goal}칸 먼저)` : '모든 경기 끝', team: [['먼저 끝냄!', 'pull', 0, 'green']], only: pr || [] }; },
};

// 공격: 풍선(1등 팀 풍선), 성(가운데 성벽), 해적선(옆 배), 드래곤(공동 보스·브레스)
M.attack = {
  init(S) { const p = S.p; S.hp = Object.fromEntries(S.teams.map((t) => [t, p.hp])); S.boss = p.style === 'dragon' ? p.hp + S.teams.length * 4 : p.style === 'castle' ? p.hp : 0; S.bossMax = S.boss; S.lvl = 1; S.br = null; S.nextBr = 25; S.mv = mvOut(pickR(S.r, p.moves), S.space); },
  tick(S, T) {
    if (S.p.breath && S.boss > 0) {
      if (!S.br && T >= S.nextBr) { S.br = { at: T, end: T + 6 }; S.dirty(); }
      if (S.br && T >= S.br.end) { S.br = null; S.nextBr = T + 22 + S.r() * 10; S.dirty(); }
    }
  },
  target(S, me) {
    const alive = S.teams.filter((t) => t !== me && S.hp[t] > 0); if (!alive.length) return null;
    if (S.p.target === 'next') { const i = S.teams.indexOf(me); for (let k = 1; k < S.teams.length; k++) { const t = S.teams[(i + k) % S.teams.length]; if (S.hp[t] > 0) return t; } return null; }
    const mx = Math.max(...alive.map((t) => S.hp[t])); return pickR(S.r, alive.filter((t) => S.hp[t] === mx));
  },
  act(S, a, T) {
    const p = S.p; if (S.hp[a.team] <= 0 && p.style !== 'dragon' && p.style !== 'castle' && a.a !== 'pt') return;
    if (a.a === 'hit') {
      S.mv = mvOut(pickR(S.r, p.moves), S.space);
      if (p.style === 'dragon' || p.style === 'castle') {
        if (S.boss <= 0) return; const dmg = p.style === 'dragon' && S.r() < 0.25 ? 2 : 1; S.boss = Math.max(0, S.boss - dmg); S.add(a.team, 1, dmg > 1 ? '크리티컬!' : '공격 명중');
        S.ev.push({ k: 'hit', team: a.team, v: dmg, t: T, id: ++S.eid });
        if (S.boss === 0) { S.add(a.team, p.style === 'dragon' ? 5 : 4, p.style === 'dragon' ? '🐉 막타! 드래곤 처치' : '🏰 성 점령!'); S.ev.push({ k: 'down', team: a.team, t: T, id: ++S.eid });
          if (p.style === 'castle') { S.lvl++; S.bossMax = p.hp + S.lvl * 3; S.boss = S.bossMax; S.owner = a.team; } else S.slain = a.team; }
        return;
      }
      const tg = this.target(S, a.team); if (tg == null) return; S.hp[tg]--; S.add(a.team, 1, `공격 → ${S.name(tg)}`); S.ev.push({ k: 'hit', team: a.team, to: tg, t: T, id: ++S.eid });
      if (S.hp[tg] === 0) S.ev.push({ k: 'down', team: tg, t: T, id: ++S.eid });
      if (S.teams.filter((t) => S.hp[t] > 0).length <= 1) S.endEarly();
    }
    if (a.a === 'heal' && p.defend && S.hp[a.team] > 0 && S.hp[a.team] < p.hp) { S.hp[a.team]++; S.add(a.team, 1, '수리 완료'); }
    if (a.a === 'burn' && S.br) S.add(a.team, -1, '브레스에 맞음!');
  },
  final(S) { if (['balloons', 'ships'].includes(S.p.style)) for (const t of S.teams) if (S.hp[t] > 0) S.add(t, 3, '끝까지 생존'); },
  show(S, T) { return { style: S.p.style, hp: S.hp, max: S.p.hp, boss: S.boss, bossMax: S.bossMax, lvl: S.lvl, owner: S.owner, slain: S.slain, br: S.br ? round1(S.br.end - T) : null, mv: S.mv }; },
  ui(S) {
    const st = S.p.style; const team = [['공격 성공', 'hit', 0, 'green']];
    if (st === 'ships') team.push(['방어(수리)', 'heal', 0, '']);
    if (st === 'dragon') team.push(['브레스 맞음 −1', 'burn', 0, 'red']);
    return { note: st === 'dragon' ? (S.br ? '🔥 브레스! 숙이지 못한 팀을 눌러요' : '공격 미션을 해낸 팀') : '미션을 해낸 팀 (공격 대상은 자동)', team, out: st === 'balloons' || st === 'ships' ? S.teams.filter((t) => S.hp[t] <= 0) : [] };
  },
};

// 탑 쌓기
M.tower = {
  init(S) { S.h = Object.fromEntries(S.teams.map((t) => [t, 0])); S.wob = {}; S.mv = Object.fromEntries(S.teams.map((t) => [t, mvOut(pickR(S.r, S.p.moves), S.space)])); },
  tick() {},
  act(S, a, T) {
    if (a.a === 'ok') { S.h[a.team]++; S.add(a.team, 1, `${S.h[a.team]}층!`); S.mv[a.team] = mvOut(pickR(S.r, S.p.moves), S.space); S.wob[a.team] = S.h[a.team] >= 4 && S.r() < (S.p.wobble[S.t] || 0) + S.h[a.team] * 0.02; S.ev.push({ k: 'up', team: a.team, t: T, id: ++S.eid }); }
    if (a.a === 'fall' && S.h[a.team] > 0) { S.h[a.team]--; S.add(a.team, -1, '흔들… 한 층 떨어짐'); S.wob[a.team] = false; S.ev.push({ k: 'fall', team: a.team, t: T, id: ++S.eid }); }
    if (a.a === 'hold') { S.wob[a.team] = false; S.dirty(); }
  },
  show(S) { return { h: S.h, wob: S.wob, mv: S.mv }; },
  ui(S) { return { note: '성공하면 한 층. 흔들림(⚠️) 팀은 균형 미션 결과를 눌러요', team: [['+1층', 'ok', 0, 'green'], ['흔들림 버팀', 'hold', 0, ''], ['떨어짐 −1층', 'fall', 0, 'red']], warn: Object.keys(S.wob).filter((t) => S.wob[t]).map(Number) }; },
};

// 구역 점령: 에너지(시간당 점수)·깃발(연결 보너스)·전략 구역(가치 합)
M.zone = {
  init(S) { const p = S.p; S.z = Array.from({ length: p.zones }, (_, i) => ({ own: null, v: p.values ? p.values[i] : 1, mv: mvOut(pickR(S.r, p.moves), S.space) })); S.open = Math.floor(S.r() * p.zones); S.next = 25; S.inc = 10; },
  tick(S, T) {
    if (S.p.income && T >= S.inc) { S.inc = T + 10; for (const z of S.z) if (z.own != null) S.add(z.own, 1, '⚡ 에너지', true); S.dirty(); }
    if (T >= S.next) this.move(S, T);
  },
  move(S, T) { let n; do n = Math.floor(S.r() * S.z.length); while (n === S.open && S.z.length > 1); S.open = n; S.z[n].mv = mvOut(pickR(S.r, S.p.moves), S.space); S.next = T + (S.p.style === 'strategic' ? 30 : 22); S.dirty(); },
  act(S, a, T) {
    if (a.a === 'cap') { const z = S.z[S.open]; if (z.own === a.team) return; const from = z.own; z.own = a.team; S.ev.push({ k: 'cap', team: a.team, z: S.open, from, t: T, id: ++S.eid }); if (S.p.style === 'flags') S.add(a.team, 1, from != null ? '깃발 빼앗기!' : '깃발 획득'); else S.add(a.team, 0, from != null ? '구역 탈환!' : '점령!'); this.move(S, T); }
    if (a.a === 'next') this.move(S, T);
    if (a.a === 'pick' && Number.isInteger(a.v) && a.v >= 0 && a.v < S.z.length) { S.open = a.v; S.next = T + 30; S.dirty(); }
  },
  lines(S) { const own = S.z.map((z) => z.own); const L = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]; return L.filter((l) => own[l[0]] != null && l.every((i) => own[i] === own[l[0]])); },
  final(S) {
    if (S.p.style === 'flags') for (const l of this.lines(S)) S.add(S.z[l[0]].own, 3, '한 줄 연결 보너스');
    if (S.p.style === 'strategic') for (const z of S.z) if (z.own != null) S.add(z.own, z.v, `구역 가치 ${z.v}`);
  },
  show(S, T) { return { style: S.p.style, z: S.z, open: S.open, left: round1(Math.max(0, S.next - T)), inc: S.p.income ? round1(Math.max(0, S.inc - T)) : null, lines: S.p.style === 'flags' ? this.lines(S) : [] }; },
  ui(S) { const z = S.z[S.open]; return { note: `열린 구역 ${S.open + 1}${S.p.values ? ` (가치 ${z.v})` : ''}: 미션을 먼저 끝낸 팀을 눌러요`, team: [['점령!', 'cap', 0, 'green']], glob: [['다른 구역 열기', 'next', 0, '']], zones: S.z.length }; },
};

// 빙고: 팀마다 칸 위치가 다른 판, 불린 미션 성공하면 칠하기
M.bingo = {
  init(S) { const n = S.p.size[S.t]; S.n = n; const pool = S.p.cells.slice(0, n * n).map((m) => mvOut(m, S.space)); S.boards = Object.fromEntries(S.teams.map((t) => [t, shuffle(S.r, pool.map((m, i) => i))])); S.mark = Object.fromEntries(S.teams.map((t) => [t, []])); S.pool = pool; S.order = shuffle(S.r, pool.map((_, i) => i)); S.ci = -1; S.next = 2; S.got = {}; S.bingos = Object.fromEntries(S.teams.map((t) => [t, 0])); },
  tick(S, T) { if (T >= S.next) this.call(S, T); },
  call(S, T) { S.ci = (S.ci + 1) % S.order.length; S.got = {}; S.at = T; S.next = T + [22, 18, 15][S.t]; S.dirty(); },
  count(S, t) { const n = S.n; const b = S.boards[t]; const m = new Set(S.mark[t]); const has = (r, c) => m.has(b[r * n + c]); let c = 0; for (let i = 0; i < n; i++) { if ([...Array(n)].every((_, j) => has(i, j))) c++; if ([...Array(n)].every((_, j) => has(j, i))) c++; } if ([...Array(n)].every((_, j) => has(j, j))) c++; if ([...Array(n)].every((_, j) => has(j, n - 1 - j))) c++; return c; },
  act(S, a, T) {
    if (a.a === 'ok' && S.ci >= 0 && !S.got[a.team]) { const cell = S.order[S.ci]; S.got[a.team] = 1; if (!S.mark[a.team].includes(cell)) { S.mark[a.team].push(cell); S.add(a.team, 1, '칸 칠하기'); const c = this.count(S, a.team); if (c > S.bingos[a.team]) { S.add(a.team, 3 * (c - S.bingos[a.team]), `빙고 ${c}줄!`); S.bingos[a.team] = c; } } }
    if (a.a === 'next') this.call(S, T);
  },
  show(S, T) { return { n: S.n, pool: S.pool, boards: S.boards, mark: S.mark, cell: S.ci >= 0 ? S.order[S.ci] : null, k: S.ci >= 0 ? clamp((T - S.at) / (S.next - S.at), 0, 1) : 0, bingos: S.bingos, got: Object.keys(S.got).map(Number) }; },
  ui(S) { return { note: '불린 미션을 해낸 팀 (미션마다 한 번)', team: [['성공 · 칸 칠하기', 'ok', 0, 'green']], glob: [['다음 미션 부르기', 'next', 0, 'yellow']], once: S.got }; },
};

// 전략 선택: 고르기 → 공개 → 미션 → 판정 (보물·소수파·블라인드·리스크·경매·카드·역전)
M.choice = {
  init(S) { S.rd = 0; S.cards = Object.fromEntries(S.teams.map((t) => [t, S.p.cards || 0])); this.round(S); },
  round(S) {
    const p = S.p; S.rd++; S.ph = 'pick'; S.pk = {}; S.res = {}; S.claim = {};
    if (p.rule === 'blind') { S.vals = shuffle(S.r, [0, 1, 3, 5]); const h = Math.floor(S.r() * 4); S.hint = `힌트: 카드 ${h + 1}은 ${S.vals[h] >= 3 ? '고득점' : '저득점'}`; S.miss = S.vals.map((v) => mvOut(pickR(S.r, ['squat', 'lunge', 'knee', 'twist']), S.space)); }
    if (p.rule === 'auction') { S.prize = 2 + Math.floor(S.r() * 4); S.amv = mvOut(pickR(S.r, p.moves), S.space); }
    if (['cards', 'reverse'].includes(p.rule)) S.cmv = mvOut(pickR(S.r, p.moves), S.space);
    if (p.rule === 'reverse' && S.rd > 1) { const mn = Math.min(...S.teams.map((t) => S.pts[t])); for (const t of S.teams) if (S.pts[t] === mn) S.add(t, 1, '꼴찌 보너스'); }
    S.dirty();
  },
  tick() {},
  opts(S) { return S.p.opts.map((o) => o[0]); },
  reveal(S) {
    const p = S.p; S.ph = 'do';
    if (p.rule === 'minority') { const cnt = {}; for (const v of Object.values(S.pk)) cnt[v] = (cnt[v] || 0) + 1; const vals = Object.values(cnt); const mn = Math.min(...vals); S.minor = vals.length > 1 ? Object.keys(cnt).filter((k) => cnt[k] === mn).map(Number) : []; for (const [t, v] of Object.entries(S.pk)) if (S.minor.includes(v)) { S.add(+t, 2, '소수파 생존!'); S.res[t] = 'safe'; } }
    if (p.rule === 'auction') { const mx = Math.max(-1, ...Object.values(S.pk)); S.winners = Object.keys(S.pk).filter((t) => S.pk[t] === mx).map(Number); for (const t of S.teams) if (!S.winners.includes(t)) S.res[t] = 'skip'; }
    S.dirty();
  },
  act(S, a) {
    const p = S.p;
    if (a.a === 'pick' && S.ph === 'pick' && Number.isInteger(a.v) && a.v >= 0 && a.v < p.opts.length) { if (p.rule === 'reverse' && a.v === 1 && S.cards[a.team] <= 0) return; S.pk[a.team] = a.v; return S.dirty(); }
    if (a.a === 'reveal' && S.ph === 'pick') return this.reveal(S);
    if (a.a === 'next') return this.round(S);
    if ((a.a === 'ok' || a.a === 'fail') && S.ph === 'do' && !S.res[a.team]) {
      const ok = a.a === 'ok'; const v = S.pk[a.team]; S.res[a.team] = ok ? 'ok' : 'fail';
      switch (p.rule || p.style) {
        case 'chests': { if (v == null) return; const [nm, val] = p.opts[v]; const lim = p.limit[v]; S.claim[v] = S.claim[v] || 0; if (ok && S.claim[v] < lim) { S.claim[v]++; S.add(a.team, val, `${nm} 획득`); } else if (ok) S.add(a.team, 0, `${nm} 품절…`); break; }
        case 'minority': if (ok) S.add(a.team, 1, '미션 성공'); break;
        case 'blind': { if (v == null || !ok) break; const same = Object.values(S.pk).filter((x) => x === v).length; const val = Math.round(S.vals[v] / same); S.add(a.team, val, `카드 ${v + 1}: ${S.vals[v]}점${same > 1 ? ` ÷ ${same}팀` : ''}`); break; }
        case 'risk': { if (v == null) break; const val = p.opts[v][1]; if (ok) S.add(a.team, val, `${p.opts[v][0].split(' ')[0]} 성공`); else if (val > 1) S.add(a.team, val === 3 ? -1 : -3, '실패…'); break; }
        case 'auction': if (S.winners?.includes(a.team)) { if (ok) S.add(a.team, S.prize, `낙찰 성공 +${S.prize}`); else S.add(a.team, -1, '입찰 실패'); } break;
        case 'cards': { if (!ok || v == null) break; const card = ['attack', 'shield', 'double', 'steal'][v]; S.add(a.team, card === 'double' ? 2 : 1, '미션 성공');
          const shield = (t) => S.pk[t] === 1 && S.res[t] !== 'fail';
          if (card === 'attack') { const others = S.teams.filter((t) => t !== a.team); const mx = Math.max(...others.map((t) => S.pts[t])); const tg = others.find((t) => S.pts[t] === mx); if (tg != null) { if (shield(tg)) S.add(tg, 0, '🛡️ 방어 성공'); else S.add(tg, -1, `⚔️ ${S.name(a.team)}의 공격`); } }
          if (card === 'steal') { const others = S.teams.filter((t) => t !== a.team); const mx = Math.max(...others.map((t) => S.pts[t])); const tg = others.find((t) => S.pts[t] === mx); if (tg != null && S.pts[tg] > 0) { if (shield(tg)) S.add(tg, 0, '🛡️ 훔치기 막음'); else { S.add(tg, -1, '🔄 1점 빼앗김'); S.add(a.team, 1, '🔄 훔치기'); } } }
          break; }
        case 'reverse': { const used = v === 1; if (used) S.cards[a.team]--; if (ok) S.add(a.team, used ? 3 : 1, used ? '역전 카드 ×3!' : '성공'); else if (used) S.add(a.team, -2, '역전 카드 실패'); break; }
        default: if (ok) S.add(a.team, 1, '성공');
      }
      S.dirty();
    }
  },
  show(S) { const p = S.p; return { rule: p.rule || p.style, style: p.style, rd: S.rd, ph: S.ph, opts: p.opts.map((o) => ({ n: o[0], v: o[1], task: o[2] ? taskText(o[2], S.space) : '' })), picked: S.ph === 'pick' ? Object.keys(S.pk).map(Number) : S.pk, res: S.res, vals: S.ph === 'do' ? S.vals : null, hint: S.hint, minor: S.minor, prize: S.prize, amv: S.amv, winners: S.winners, cmv: S.cmv, cards: S.cards, claim: S.claim, limit: p.limit, miss: S.miss }; },
  ui(S) {
    if (S.ph === 'pick') return { note: '팀이 고른 것을 눌러 입력 (대형 화면엔 공개 전까지 안 보여요)', pick: { opts: this.opts(S), cur: S.pk, dis: S.p.rule === 'reverse' ? Object.fromEntries(S.teams.filter((t) => S.cards[t] <= 0).map((t) => [t, [1]])) : {} }, glob: [['공개!', 'reveal', 0, 'yellow']] };
    return { note: '미션 결과를 눌러요 (팀마다 한 번)', team: [['성공', 'ok', 0, 'green'], ['실패', 'fail', 0, 'red']], glob: [['다음 라운드 ▶', 'next', 0, 'yellow']], once: S.res };
  },
};

// 폭탄 돌리기
M.bomb = {
  init(S) { S.holder = pickR(S.r, S.teams); this.arm(S, 2); S.passes = 0; },
  arm(S, T) { const [a, b] = S.p.fuse[S.t]; S.boom = T + a + S.r() * (b - a); S.task = pickR(S.r, S.p.tasks); S.ph = 'live'; S.dirty(); },
  tick(S, T) {
    if (S.ph === 'live' && T >= S.boom) { S.add(S.holder, -2, '💥 펑!'); S.ev.push({ k: 'boom', team: S.holder, t: T, id: ++S.eid }); S.ph = 'boom'; S.re = T + 3.5; S.dirty(); }
    if (S.ph === 'boom' && T >= S.re) { S.holder = pickR(S.r, S.teams); this.arm(S, T); }
  },
  act(S, a, T) {
    if (a.a !== 'pass' || S.ph !== 'live' || a.team !== S.holder) return;
    S.add(a.team, 1, '미션 완료 → 넘김'); S.passes++; const others = S.teams.filter((t) => t !== a.team); const to = pickR(S.r, others); S.ev.push({ k: 'pass', team: a.team, to, t: T, id: ++S.eid }); S.holder = to; S.task = pickR(S.r, S.p.tasks); S.dirty();
  },
  show(S, T) { return { holder: S.holder, task: taskText(S.task, S.space), tmv: parseTask(S.task, S.space)[0], ph: S.ph, heat: S.ph === 'live' ? clamp(1 - (S.boom - T) / 30, 0, 1) : 1, passes: S.passes }; },
  ui(S) { return { note: '폭탄을 든 팀이 미션을 끝내면 [넘기기] (언제 터질지는 사회자도 몰라요)', team: [['미션 완료 → 넘기기', 'pass', 0, 'green']], only: S.ph === 'live' ? [S.holder] : [] }; },
};

// 서바이벌: 목숨, 점점 빠르고 길어지는 패턴 (파이널 카운트다운은 라운드 시간이 줄어듦)
M.survive = {
  init(S) { S.lives = Object.fromEntries(S.teams.map((t) => [t, S.p.lives])); S.rd = 0; this.round(S, 2); },
  round(S, T) {
    const p = S.p; S.rd++; S.res = {}; const len = (p.len[S.t] || 2) + Math.floor((S.rd - 1) / 2);
    S.seq = Array.from({ length: Math.min(len, 8) }, () => mvOut(pickR(S.r, p.pool), S.space));
    S.per = p.countdown ? 0 : round1(Math.max(0.6, 1.8 * p.speedUp ** (S.rd - 1)));
    S.lim = p.countdown ? p.countdown[Math.min(S.rd - 1, p.countdown.length - 1)] : S.seq.length * S.per + 6;
    S.ph = 'go'; S.at = T; S.next = T + S.lim; S.dirty();
  },
  tick(S, T) { if (S.ph === 'go' && T >= S.next) { S.ph = 'judge'; S.dirty(); } },
  alive(S) { return S.teams.filter((t) => S.lives[t] > 0); },
  act(S, a, T) {
    if (a.a === 'next') { const al = this.alive(S); if (al.length <= 1 && S.teams.length > 1) { if (al[0] != null && !S.won) { S.won = al[0]; S.add(al[0], 3, '👑 최후의 생존!'); } return S.endEarly(); } return this.round(S, T); }
    if (S.lives[a.team] <= 0 || S.res[a.team]) return;
    if (a.a === 'ok') { S.res[a.team] = 'ok'; S.add(a.team, S.p.scale ? S.rd : 1, S.p.scale ? `라운드 ${S.rd} 통과 +${S.rd}` : '생존!'); }
    if (a.a === 'fail') { S.res[a.team] = 'fail'; S.lives[a.team]--; S.add(a.team, 0, S.lives[a.team] ? `목숨 −1 (남은 ${S.lives[a.team]})` : '탈락… 응원단으로'); S.ev.push({ k: 'life', team: a.team, t: T, id: ++S.eid }); }
    S.dirty();
  },
  final(S) { const al = this.alive(S); if (!S.won && al.length && al.length < S.teams.length) for (const t of al) S.add(t, 3, '끝까지 생존'); },
  show(S, T) { return { rd: S.rd, seq: S.seq, per: S.per, lim: S.lim, left: round1(Math.max(0, S.next - T)), el: round1(T - S.at), ph: S.ph, lives: S.lives, max: S.p.lives, res: S.res, cd: !!S.p.countdown }; },
  ui(S) { return { note: S.ph === 'go' ? '라운드 진행 중… 끝나면 팀별로 판정' : '팀별 결과를 누른 뒤 [다음 라운드]', team: [['통과', 'ok', 0, 'green'], ['실패 (목숨 −1)', 'fail', 0, 'red']], glob: [['다음 라운드 ▶', 'next', 0, 'yellow']], once: S.res, out: S.teams.filter((t) => S.lives[t] <= 0) }; },
};

// 미션형: 암호(기호→동작)·타임어택(연속 단계)·역할 분담·룰렛·10초·스포츠 페스티벌
M.mission = {
  init(S) { S.rd = 0; S.stage = Object.fromEntries(S.teams.map((t) => [t, 0])); S.fin = []; if (S.p.style === 'chain') { S.at = 2; S.next = 2 + S.p.per[S.t]; S.ph = 'go'; } else this.round(S, 1.5); },
  round(S, T) {
    const p = S.p; S.rd++; S.got = {}; S.at = T; S.ph = 'go';
    if (p.style === 'cipher') { const n = p.len[Math.min(S.rd - 1, p.len.length - 1)]; S.code = Array.from({ length: n }, () => Math.floor(S.r() * p.key.length)); }
    if (p.style === 'roles') S.roles = shuffle(S.r, p.roles).slice(0, Math.min(p.roles.length, 3 + Math.floor(S.rd / 3)));
    if (p.style === 'roulette') { S.spin = { i: Math.floor(S.r() * p.wheel.length), x: pickR(S.r, [1, 1, 1, 2, 2, 3]) }; S.ph = 'spin'; }
    if (p.style === 'ten') { const n = 1 + Math.floor((S.rd - 1) / 3); S.tx = p.list[(S.rd - 1) % p.list.length].replace(/(\d+)/, (m) => String(Math.round(+m * (1 + (n - 1) * 0.25)))); }
    if (p.style === 'sports') S.sp = p.list[(S.rd - 1) % p.list.length];
    const per = p.per[S.t]; S.next = T + per + (S.ph === 'spin' ? 4 : 0); S.dirty();
  },
  tick(S, T) {
    if (S.ph === 'spin' && T >= S.at + 4) { S.ph = 'go'; S.dirty(); }
    if (S.p.style === 'chain') { if (S.ph === 'go' && T >= S.next) { S.ph = 'end'; S.dirty(); } return; }
    if (['ten', 'sports', 'roulette'].includes(S.p.style) && T >= S.next + 2) this.round(S, T);
    else if (['cipher', 'roles'].includes(S.p.style) && S.ph === 'go' && T >= S.next) { S.ph = 'judge'; S.dirty(); }
  },
  act(S, a, T) {
    const p = S.p;
    if (a.a === 'next' && p.style !== 'chain') return this.round(S, T);
    if (p.style === 'chain') { if (a.a === 'step' && S.ph === 'go' && S.stage[a.team] < p.chain.length) { S.stage[a.team]++; S.add(a.team, 1, `${S.stage[a.team]}단계`); if (S.stage[a.team] === p.chain.length) { S.fin.push(a.team); const b = [4, 2][S.fin.length - 1] || 0; if (b) S.add(a.team, b, `완주 ${S.fin.length}등!`); if (S.fin.length === S.teams.length) S.endEarly(); } } return; }
    if (a.a === 'ok' && !S.got[a.team]) {
      S.got[a.team] = 1; let v = a.v || 1; let why = '성공';
      if (p.style === 'cipher' && !Object.keys(S.got).filter((t) => +t !== a.team).length) { v += 1; why = '해독 1등!'; }
      if (p.style === 'roles') { v = 2; why = '전원 성공'; }
      if (p.style === 'roulette') { v *= S.spin.x; why = `×${S.spin.x}`; }
      if (p.style === 'sports' && v === 2) why = '최고의 표현!';
      S.add(a.team, v, why);
    }
  },
  show(S, T) { const p = S.p; const per = p.per[S.t]; return { style: p.style, rd: S.rd, ph: S.ph, left: round1(Math.max(0, S.next - T)), per, el: round1(T - S.at), code: S.code, key: p.key?.map((k) => [k[0], mvOut(k[1], S.space)]), stage: S.stage, chain: p.chain?.map((c) => taskText(c, S.space)), fin: S.fin, roles: S.roles, spin: S.spin, wheel: p.wheel?.map((w) => taskText(w, S.space)), tx: S.tx, sp: S.sp ? [S.sp[0], mvOut(S.sp[1], S.space)] : null, got: Object.keys(S.got || {}).map(Number) }; },
  ui(S) {
    const st = S.p.style;
    if (st === 'chain') return { note: '단계를 끝낸 팀을 누를 때마다 다음 단계로', team: [['단계 완료', 'step', 0, 'green']] };
    const team = st === 'sports' ? [['좋음 +1', 'ok', 1, 'green'], ['최고 +2', 'ok', 2, '']] : [['성공', 'ok', 1, 'green']];
    return { note: { cipher: '정확히 해독해 동작한 팀 (먼저 한 팀 보너스)', roles: '모든 역할이 성공한 팀', roulette: '시간 안에 성공한 팀 (배수 자동)', ten: '10초 안에 끝낸 팀', sports: '실감 나게 표현한 팀' }[st], team, glob: [['다음 ▶', 'next', 0, 'yellow']], once: S.got };
  },
};

// 몸 가위바위보
M.rps = {
  init(S) { S.rd = 0; this.round(S, 2); },
  round(S, T) { S.rd++; S.ph = 'ready'; S.at = T; S.th = {}; S.win = null; S.dirty(); },
  tick(S, T) { if (S.ph === 'ready' && T >= S.at + 4) { S.ph = 'go'; S.dirty(); } if (S.ph === 'go' && T >= S.at + 6.5) { S.ph = 'input'; S.dirty(); } },
  act(S, a, T) {
    if (a.a === 'pick' && S.ph !== 'reveal' && Number.isInteger(a.v) && a.v >= -1 && a.v <= 2) { S.th[a.team] = a.v; return S.dirty(); }
    if (a.a === 'reveal' && S.ph !== 'reveal') {
      S.ph = 'reveal'; S.win = {};
      const valid = Object.entries(S.th).filter(([, v]) => v >= 0);
      for (const [t, v] of valid) { const beat = valid.filter(([u, w]) => u !== t && (v + 2) % 3 === w).length; S.win[t] = beat; if (beat) S.add(+t, beat, `${beat}팀 이김`); }
      for (const [t, v] of Object.entries(S.th)) if (v < 0) S.add(+t, 0, '자세가 달라 무효');
      return S.dirty();
    }
    if (a.a === 'next') this.round(S, T);
  },
  show(S, T) { return { rd: S.rd, ph: S.ph, el: round1(T - S.at), th: S.ph === 'reveal' ? S.th : Object.keys(S.th).map(Number), win: S.win, rps: RPS.map((x) => [x[0], mvOut(x[1], S.space)]) }; },
  ui(S) { return { note: S.ph === 'reveal' ? '결과 공개! [다음 판]' : '팀별 자세를 눌러 입력 → [결과 공개] (팀원 자세가 다르면 무효)', pick: S.ph === 'reveal' ? null : { opts: ['✊ 바위', '✌️ 가위', '🖐️ 보'], cur: S.th, extra: ['무효', -1] }, glob: S.ph === 'reveal' ? [['다음 판 ▶', 'next', 0, 'yellow']] : [['결과 공개!', 'reveal', 0, 'yellow']] }; },
};

// 표현·협동 평가: 숫자 모임·몸 모양·균형·응원
M.judge = {
  init(S) { S.rd = 0; S.turn = -1; this.round(S, 2); },
  round(S, T) {
    const p = S.p; S.rd++; S.got = {}; S.at = T; S.next = T + p.per[S.t];
    if (p.style === 'numbers') { S.num = 2 + Math.floor(S.r() * (S.t >= 1 ? 4 : 3)); const g = pickR(S.r, GROUP); S.task = [g[0], mvOut(g[1], S.space)]; }
    if (p.style === 'shapes') S.shape = SHAPES[(S.rd - 1 + Math.floor(S.r() * 3)) % SHAPES.length];
    if (p.style === 'balance') { const b = BAL[Math.min(BAL.length - 1, Math.floor((S.rd - 1) / 1) % BAL.length)]; S.task = [b[0], mvOut(b[1], S.space)]; }
    if (p.style === 'cheer') { S.turn = (S.turn + 1) % S.teams.length; S.stars = 0; }
    S.dirty();
  },
  tick(S, T) { if (S.p.style !== 'cheer' && S.p.style !== 'shapes' && T >= S.next + 4) this.round(S, T); },
  act(S, a, T) {
    const st = S.p.style;
    if (a.a === 'next') return this.round(S, T);
    if (a.a !== 'ok') return;
    if (st === 'cheer') { const tm = S.teams[S.turn]; if (S.stars >= 3) return; S.stars++; S.add(tm, a.v, ['단합', '동작', '창의'][S.stars - 1] + ` ⭐${a.v}`); return; }
    if (S.got[a.team]) return; S.got[a.team] = 1;
    S.add(a.team, a.v, st === 'balance' ? (a.v >= 3 ? '끝까지 버팀!' : '절반 버팀') : st === 'numbers' ? (a.v >= 2 ? '정확히 모임!' : '인원만 맞음') : `⭐${a.v}`);
  },
  show(S, T) { return { style: S.p.style, rd: S.rd, k: clamp((T - S.at) / Math.max(1, S.next - S.at), 0, 1), left: round1(Math.max(0, S.next - T)), num: S.num, task: S.task, shape: S.shape, turn: S.turn >= 0 ? S.teams[S.turn] : null, stars: S.stars, got: Object.keys(S.got).map(Number) }; },
  ui(S) {
    const st = S.p.style;
    if (st === 'cheer') return { note: `지금 차례: 단합·동작·창의를 차례로 별점 (최대 3번)`, glob: [['⭐1', 'ok', 1, ''], ['⭐⭐2', 'ok', 2, ''], ['⭐⭐⭐3', 'ok', 3, 'green'], ['다음 팀 ▶', 'next', 0, 'yellow']], turn: S.teams[S.turn] };
    if (st === 'balance') return { note: '게이지가 끝나면 버틴 정도를 눌러요', team: [['끝까지 +3', 'ok', 3, 'green'], ['절반 +1', 'ok', 1, '']], once: S.got };
    if (st === 'numbers') return { note: '인원·자세가 맞으면 정확 +2, 인원만 +1', team: [['정확 +2', 'ok', 2, 'green'], ['인원만 +1', 'ok', 1, '']], once: S.got };
    return { note: '완성한 모양을 보고 별점', team: [['⭐1', 'ok', 1, ''], ['⭐⭐2', 'ok', 2, ''], ['⭐⭐⭐3', 'ok', 3, 'green']], glob: [['다음 모양 ▶', 'next', 0, 'yellow']], once: S.got };
  },
};

// 토너먼트: 대진표 1:1 (최후의 챔피언은 전 팀 라운드 순위제)
M.tourney = {
  init(S) {
    S.rd = 0; S.di = 0;
    if (S.p.final) { S.ph = 'round'; S.rank = {}; S.duel = S.p.duels[0]; S.at = 2; return; }
    let ts = shuffle(S.r, [...S.teams]); let size = 1; while (size < ts.length) size *= 2; while (ts.length < size) ts.push(null);
    S.br = [ts]; S.ri = 0; S.mi = 0; this.skipByes(S); S.duel = S.p.duels[0];
  },
  skipByes(S) { if (S.champ != null) return; const r = S.br[S.ri]; while (S.mi < r.length / 2 && (r[S.mi * 2] == null || r[S.mi * 2 + 1] == null)) { this.win(S, r[S.mi * 2] ?? r[S.mi * 2 + 1], true); } },
  win(S, w, bye) {
    const r = S.br[S.ri]; const nr = S.br[S.ri + 1] || (S.br[S.ri + 1] = []);
    nr[S.mi] = w; if (!bye && w != null) S.add(w, 2, '경기 승리');
    S.mi++;
    if (S.mi >= r.length / 2) {
      if (r.length === 2) { const champ = nr[0]; const fin = r.filter((t) => t != null && t !== champ); S.add(champ, 5, '🏆 챔피언!'); if (fin[0] != null) S.add(fin[0], 2, '준우승'); S.champ = champ; S.endEarly(); return; }
      S.mi = 0; S.ri++; S.di++; S.duel = S.p.duels[S.di % S.p.duels.length];
    }
    if (S.champ == null) this.skipByes(S);
  },
  tick() {},
  act(S, a) {
    if (S.p.final) {
      if (a.a === 'rank' && !S.rank[a.team] && [1, 2, 3].includes(a.v)) { S.rank[a.team] = a.v; const base = [0, 3, 2, 1][a.v]; const last = S.di === S.p.duels.length - 1; S.add(a.team, base * (last ? 2 : 1), `${S.duel[0]} ${a.v}등${last ? ' (×2)' : ''}`); S.dirty(); }
      if (a.a === 'next') { if (S.di >= S.p.duels.length - 1) return S.endEarly(); S.di++; S.duel = S.p.duels[S.di]; S.rank = {}; S.dirty(); }
      return;
    }
    if (a.a !== 'win' || S.champ != null) return; const r = S.br[S.ri]; const pr = [r[S.mi * 2], r[S.mi * 2 + 1]]; if (!pr.includes(a.team)) return;
    S.ev.push({ k: 'win', team: a.team, t: 0, id: ++S.eid }); this.win(S, a.team); S.dirty();
  },
  show(S) { if (S.p.final) return { final: true, di: S.di, n: S.p.duels.length, duel: S.duel, rank: S.rank, duels: S.p.duels }; const r = S.br[S.ri]; return { br: S.br, ri: S.ri, mi: S.mi, pair: S.champ != null ? null : [r[S.mi * 2], r[S.mi * 2 + 1]], duel: S.duel, champ: S.champ }; },
  ui(S) {
    if (S.p.final) return { note: `${S.duel[0]} — 팀별 순위를 눌러요 (1~3등)`, team: [['1등', 'rank', 1, 'green'], ['2등', 'rank', 2, ''], ['3등', 'rank', 3, '']], glob: [[S.di >= S.p.duels.length - 1 ? '결승 끝 ▶' : '다음 라운드 ▶', 'next', 0, 'yellow']], once: S.rank };
    const r = S.br[S.ri]; const pr = S.champ != null ? [] : [r[S.mi * 2], r[S.mi * 2 + 1]];
    return { note: S.champ != null ? '챔피언 결정!' : `${S.duel[0]}: 이긴 팀을 눌러요`, team: [['승리!', 'win', 0, 'green']], only: pr };
  },
};

// ---------------- 게임 모듈 만들기
function peGame(def) {
  const ages = def.ages;
  const ruleOf = (age) => def.rule;
  return {
    id: def.id, no: def.no, name: def.name, emoji: def.emoji, dur: def.dur, pe: true, pe2: true, hostScore: true, lateJoin: true,
    rule: { all: def.rule, baby: def.rule }, howto: `휴대폰 없이 몸으로 · 판정은 사회자 (${def.score})`,
    meta: { cat: def.cat, ages, space: def.space, ppl: def.ppl, props: def.props, mech: def.mech, type: def.type, inten: def.inten, bgm: def.bgm, say: def.say, act: def.act, score: def.score, win: def.win, tut: def.tut },
    create(ctx) {
      const st = ctx.settings || {}; const lv = st.lv ?? 2;
      const tier = lv <= 1 ? 0 : lv === 2 ? (st.elemLevel === 'high' ? 1 : 0) : lv === 3 ? 1 : 2;
      const space = st.space === 'class' ? 'class' : 'gym';
      const teams = ctx.teams.map(Number);
      const C = { T: 0, last: null };
      const S = {
        def, p: def.p, t: tier, lv, space, r: rng(ctx.seed), teams, pts: Object.fromEntries(teams.map((t) => [t, 0])), ev: [], eid: 0, T: 0,
        name: (t) => ctx.teamName?.(t) || `${t}팀`,
        add(team, v, txt, quiet) { if (S.pts[team] == null) return; S.pts[team] = Math.max(0, S.pts[team] + v); if (!quiet || S.ev.length < 1) S.ev.push({ k: 'pt', team, v, txt, t: S.T, id: ++S.eid }); if (S.ev.length > 30) S.ev.splice(0, S.ev.length - 30); ctx.dirtyAll(); },
        dirty() { ctx.dirtyAll(); }, endEarly() { ctx.endEarly(); },
      };
      const mech = M[def.mech];
      mech.init(S);
      const P = new Map(ctx.players.map((p) => [p.id, p]));
      let lastV = 0;
      return {
        addPlayer(p) { P.set(p.id, p); },
        shift(ms) { if (C.last != null) C.last += ms; },
        input() {},
        hostPt(team, d) { if (S.pts[team] == null || ![-1, 1, 2, 3].includes(d)) return; S.add(team, d, d > 0 ? `+${d}` : `${d}`); },
        hostAct(arg) {
          const a = { a: String(arg.a || ''), team: Number(arg.team), v: Number.isFinite(+arg.v) ? +arg.v : 0 };
          if (a.a === 'pt') { if (S.pts[a.team] != null && [-1, 1, 2, 3].includes(a.v)) S.add(a.team, a.v, a.v > 0 ? `+${a.v}` : `${a.v}`); return; }
          if (a.team && S.pts[a.team] == null && !['next', 'reveal', 'replay', 'pick'].includes(a.a) && !(def.mech === 'judge' && def.p.style === 'cheer')) return;
          mech.act(S, a, S.T); ctx.dirtyAll();
        },
        tick(now) { const d = C.last == null ? 0.1 : clamp((now - C.last) / 1000, 0, 0.25); C.last = now; C.T += d; S.T = C.T; mech.tick(S, C.T); if (now - lastV > 1000) { lastV = now; ctx.dirtyAll(); } },
        view(pid) { const p = P.get(pid); return { g: 'pe', kind: def.id, title: def.name, cur: def.act, pts: p ? S.pts[p.team] : 0 }; },
        screen() { return { g: 'pe2', id: def.id, mech: def.mech, tier, lv, space, T: round1(C.T), pts: S.pts, ev: S.ev.slice(-8), st: mech.show(S, C.T), ui: mech.ui(S) }; },
        finish() {
          mech.final?.(S);
          const pts = S.pts; const mx = Math.max(1, ...Object.values(pts)); const players = {};
          for (const p of P.values()) players[p.id] = { raw: pts[p.team] || 0, norm: round1(((pts[p.team] || 0) / mx) * 100), show: `팀 ${pts[p.team] || 0}점` };
          return { players, teams: { ...pts }, teamLabel: Object.fromEntries(Object.entries(pts).map(([t, v]) => [t, `${v}점`])) };
        },
      };
    },
  };
}

export const PE2 = PE.map(peGame);
export const PE2_BY = Object.fromEntries(PE2.map((g) => [g.id, g]));
export { M as MECH };

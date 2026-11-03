// GAME 06~10: 10초의 신 / 최후의 생존자 / 팀 협동 금고 / 두더지 사냥 / 반응속도 챔피언
import { rng, rint, shuffle, moleSchedule } from '../../public/shared/gen.js';
import { LV, norm, normLow, round1, clamp, intIn, numIn } from './common.js';

// ---------------------------------------------------------------- 06 10초의 신
export const tensec = {
  id: 'tensec', no: 6, name: '10초의 신', emoji: '⏱️',
  dur: { kid: 35, elem: 40, adult: 45 },
  rule: {
    kid: '시작을 누르고, 마음속으로 5초를 세고 멈춰요!',
    elem: '시작을 누르고 정확히 7초에 멈춰요! 숫자는 곧 사라져요',
    adult: '시작을 누르고 정확히 10초에 멈추세요! 타이머는 2초 뒤에 사라집니다',
  },
  howto: '기회 2번 중 더 정확한 기록. 오차가 작을수록 고득점',
  minDur: { kid: 25, elem: 30, adult: 35 },
  lateJoin: true,
  create(ctx) {
    const target = { kid: 5, elem: 7, adult: 10 };
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, tries: [], sAt: null }); ctx.players.forEach(add);
    const hide = ctx.item.hideTimer !== false;
    const best = (p) => (p.tries.length ? Math.min(...p.tries.map((t) => t.err)) : null);
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || p.tries.length >= 2) return;
        if (m.a === 'go') { if (p.sAt) return; p.sAt = now; return { started: true }; }
        if (m.a === 'stop') {
          if (!p.sAt) return;
          const srv = now - p.sAt; p.sAt = null;
          // 폰에서 잰 시간(네트워크 지연 없음)을 쓰되, 서버가 잰 시간과 크게 다르면 서버 기록 사용
          let el = numIn(m.el, 0, 120000) && Math.abs(m.el - srv) <= 700 ? Math.round(m.el) : srv;
          const err = Math.abs(el - target[p.age] * 1000);
          p.tries.push({ el, err });
          if ([...P.values()].every((x) => x.tries.length >= 2 || !ctx.events.players.get(x.id)?.online)) ctx.endEarly();
          return { el, err, target: target[p.age], left: 2 - p.tries.length };
        }
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'tensec', spectator: true };
        return { g: 'tensec', target: target[p.age], hide, hideAfter: p.age === 'kid' ? 2000 : 2000, running: !!p.sAt, tries: p.tries, left: 2 - p.tries.length, best: best(p) };
      },
      screen() {
        const done = []; let running = 0;
        for (const p of P.values()) { if (p.sAt) running++; const b = best(p); if (b != null) done.push({ name: p.name, team: p.team, err: b }); }
        done.sort((a, b) => a.err - b.err);
        return { running, done: done.length, total: P.size, top: done.slice(0, 5) };
      },
      finish() {
        const players = {};
        for (const p of P.values()) {
          const b = best(p); if (b == null) continue;
          const t = target[p.age] * 1000;
          players[p.id] = { raw: b, norm: normLow(b, p.age === 'kid' ? 200 : 30, t * (p.age === 'kid' ? 0.7 : 0.4)), show: `오차 ${(b / 1000).toFixed(2)}초` };
        }
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 07 최후의 생존자
const SURV_OPTS = {
  kid: [{ e: '🐶', n: '강아지' }, { e: '🐱', n: '고양이' }, { e: '🐰', n: '토끼' }, { e: '🐻', n: '곰' }],
  all: [{ e: '🔴', n: '빨강 문' }, { e: '🔵', n: '파랑 문' }, { e: '🟡', n: '노랑 문' }, { e: '🟢', n: '초록 문' }],
};
export const survivor = {
  id: 'survivor', no: 7, name: '최후의 생존자', emoji: '🚪',
  dur: { kid: 60, elem: 70, adult: 80 },
  untimed: true,
  rule: {
    kid: '동물 하나를 골라요! 별이 나오는 동물을 고르면 점수!',
    all: '문 4개 중 하나를 고르세요. 라운드마다 꽝 문 1개가 공개되고, 그 문을 고른 사람은 탈락! 끝까지 살아남으세요',
  },
  howto: '살아남은 라운드 수로 점수 (탈락해도 관전 가능)',
  create(ctx) {
    const age = ctx.events.dominantAge();
    const kid = age === 'kid';
    const maxRounds = kid ? 4 : 6;
    const pickMs = kid ? 10000 : 8000;
    const opts = kid ? SURV_OPTS.kid : SURV_OPTS.all;
    const r = rng(ctx.seed);
    const P = new Map(ctx.players.map((p) => [p.id, { ...p, alive: true, pick: null, rounds: 0, outAt: null, stars: 0 }]));
    let round = 0, phase = 'wait', until = 0, bad = null, last = null, voided = false;
    const alive = () => [...P.values()].filter((p) => p.alive);
    const begin = (now) => { round++; phase = 'pick'; until = now + pickMs; bad = rint(r, opts.length); voided = false; for (const p of P.values()) p.pick = null; ctx.dirtyAll(); };
    const reveal = (now) => {
      const al = alive();
      const dead = al.filter((p) => p.pick == null || p.pick === bad);
      if (!kid && dead.length === al.length && al.length > 0) { voided = true; } // 전원 탈락 → 라운드 무효
      else {
        for (const p of al) {
          if (kid) { if (p.pick != null && p.pick !== bad) { p.rounds++; p.stars++; } }
          else if (dead.includes(p)) { p.alive = false; p.outAt = round; } else p.rounds++;
        }
      }
      last = { bad, counts: opts.map((_, i) => al.filter((p) => p.pick === i).length) };
      phase = 'reveal'; until = now + 4500; ctx.dirtyAll();
    };
    return {
      start(now) { begin(now); },
      shift(ms) { until += ms; },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'pick' || phase !== 'pick' || !p.alive) return;
        if (!intIn(m.v, 0, opts.length - 1)) return;
        p.pick = m.v;
        if (alive().every((x) => x.pick != null || !ctx.events.players.get(x.id)?.online)) until = Math.min(until, now + 800);
        return { ok: true };
      },
      tick(now) {
        if (now < until) return;
        if (phase === 'pick') reveal(now);
        else if (phase === 'reveal') {
          if (round >= maxRounds || (!kid && alive().length <= 1)) { phase = 'done'; ctx.endEarly(); }
          else begin(now);
        }
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'survivor', spectator: true };
        return { g: 'survivor', kid, opts, round, maxRounds, phase, until, alive: p.alive, pick: p.pick, rounds: p.rounds,
          last: phase === 'reveal' ? last : null, voided, aliveN: alive().length };
      },
      screen() {
        const al = alive();
        const team = Object.fromEntries(ctx.teams.map((t) => { const all = [...P.values()].filter((p) => p.team === t); return [t, { alive: all.filter((p) => p.alive).length, total: all.length, stars: all.reduce((s, p) => s + p.stars, 0) }]; }));
        return { kid, opts, round, maxRounds, phase, until, aliveN: al.length, total: P.size, team, last: phase === 'reveal' ? last : null, voided,
          champ: (phase === 'done' || (phase === 'reveal' && al.length === 1)) && al.length === 1 ? { name: al[0].name, team: al[0].team } : null,
          picked: al.filter((p) => p.pick != null).length };
      },
      finish() {
        const players = {};
        const al = alive();
        for (const p of P.values()) {
          if (round === 0) continue;
          const n = kid ? (p.stars / maxRounds) * 100 : (p.rounds / Math.max(1, round)) * 90 + (p.alive && al.length <= 3 ? 10 : 0);
          players[p.id] = { raw: kid ? p.stars : p.rounds, norm: round1(clamp(n, 0, 100)), show: kid ? `별 ${p.stars}개` : p.alive ? '최종 생존!' : `${p.rounds}라운드 생존` };
        }
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 08 팀 협동 금고
const VAULT_PICS = ['🍎', '🐶', '⭐', '🚗', '🎈', '🌈'];
const POS = ['첫째', '둘째', '셋째', '넷째'];
function makeVault(r, age) {
  if (age === 'kid') {
    const code = shuffle(r, [0, 1, 2, 3, 4, 5]).slice(0, 3);
    return { kind: 'pic', len: 3, code, hints: code.map((c, i) => ({ t: `${POS[i]} 그림은`, pic: c })) };
  }
  const d = [1 + rint(r, 9)];
  if (age === 'elem') {
    for (let i = 1; i < 4; i++) d.push(rint(r, 10));
    return { kind: 'num', len: 4, code: d, hints: d.map((v, i) => ({ t: `${POS[i]} 자리 숫자는 ${v}` })) };
  }
  // 성인: 하나만 직접, 나머지는 관계 힌트
  let k1; do { k1 = 1 + rint(r, 5); } while (d[0] - k1 < 0 && d[0] + k1 > 9);
  d[1] = d[0] - k1 >= 0 && (r() < 0.5 || d[0] + k1 > 9) ? d[0] - k1 : d[0] + k1;
  let k2; do { k2 = 1 + rint(r, 4); } while (d[1] + k2 > 9 && d[1] - k2 < 0);
  d[2] = d[1] + k2 <= 9 && (r() < 0.5 || d[1] - k2 < 0) ? d[1] + k2 : d[1] - k2;
  d[3] = (d[0] + d[2]) % 10;
  const hints = [
    { t: `첫째 자리는 ${d[0]}` },
    { t: `둘째 자리는 첫째보다 ${Math.abs(d[1] - d[0])} ${d[1] > d[0] ? '크다' : '작다'}` },
    { t: `셋째 자리는 둘째보다 ${Math.abs(d[2] - d[1])} ${d[2] > d[1] ? '크다' : '작다'}` },
    { t: `넷째 자리는 (첫째 + 셋째)의 일의 자리` },
  ];
  return { kind: 'num', len: 4, code: d, hints };
}
export const vault = {
  id: 'vault', no: 8, name: '팀 협동 금고', emoji: '🔐',
  dur: { kid: 60, elem: 90, adult: 120 },
  teamGame: true,
  rule: {
    kid: '친구들이 받은 그림 힌트를 모아서, 대표가 순서대로 눌러요!',
    elem: '팀원마다 다른 숫자 힌트를 받아요. 서로 말해서 비밀번호 4자리를 맞혀요! 입력은 팀 대표가',
    adult: '팀원마다 다른 추리 힌트! 힌트를 모아 비밀번호를 추리하고 팀 대표가 입력하세요. 틀리면 3초 잠김',
  },
  howto: '빨리 열수록 고득점, 틀리면 감점',
  create(ctx) {
    const age = ctx.events.dominantAge();
    const r = rng(ctx.seed);
    const P = new Map(ctx.players.map((p) => [p.id, { ...p }]));
    const T = {};
    for (const t of ctx.teams) {
      const v = makeVault(r, age);
      const mem = shuffle(r, [...P.values()].filter((p) => p.team === t).map((p) => p.id));
      const hintOf = {}; // 참가자별 힌트 (인원보다 힌트가 많으면 여러 개)
      mem.forEach((pid) => (hintOf[pid] = []));
      v.hints.forEach((h, i) => { if (mem.length) hintOf[mem[i % mem.length]].push(h); });
      T[t] = { v, hintOf, solvedAt: null, wrong: 0, lockUntil: 0, last: null, solver: null };
    }
    const repOf = (t) => {
      const mem = [...P.values()].filter((p) => p.team === t);
      const rep = mem.find((p) => p.rep && ctx.events.players.get(p.id)?.online);
      return rep ? rep.id : null; // 대표가 접속 중이 아니면 누구나 입력 가능
    };
    return {
      start(now) { this.t0 = now; },
      shift(ms) { this.t0 += ms; for (const t of ctx.teams) if (T[t].lockUntil) T[t].lockUntil += ms; },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'try') return;
        const b = T[p.team]; if (b.solvedAt) return;
        const rep = repOf(p.team); if (rep && rep !== pid) return { notRep: true };
        if (now < b.lockUntil) return { locked: b.lockUntil };
        if (!Array.isArray(m.code) || m.code.length !== b.v.len || !m.code.every((x) => intIn(x, 0, b.v.kind === 'pic' ? 5 : 9))) return;
        const right = m.code.filter((x, i) => x === b.v.code[i]).length;
        if (right === b.v.len) { b.solvedAt = now - this.t0; b.solver = p.name; ctx.dirtyAll(); if (ctx.teams.every((t) => T[t].solvedAt != null)) ctx.endEarly(); return { solved: true }; }
        b.wrong++; b.lockUntil = now + 3000; b.last = right;
        for (const q of P.values()) if (q.team === p.team) ctx.dirty(q.id);
        return { wrong: true, right, locked: b.lockUntil };
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'vault', spectator: true };
        const b = T[p.team]; const rep = repOf(p.team);
        return { g: 'vault', kind: b.v.kind, len: b.v.len, pics: VAULT_PICS, hints: b.hintOf[pid] || [], canEnter: !rep || rep === pid,
          repName: rep ? P.get(rep).name : '', solved: b.solvedAt != null, solvedAt: b.solvedAt, wrong: b.wrong, lockUntil: b.lockUntil, last: b.last, solver: b.solver };
      },
      screen(now) {
        return { teams: Object.fromEntries(ctx.teams.map((t) => [t, { solved: T[t].solvedAt, wrong: T[t].wrong, locked: now < T[t].lockUntil, last: T[t].last, len: T[t].v.len }])) };
      },
      finish() {
        const teams = {}; const teamLabel = {};
        const dur = ctx.durMs;
        for (const t of ctx.teams) {
          const b = T[t];
          teams[t] = b.solvedAt != null ? round1(clamp(60 + 40 * (1 - b.solvedAt / dur) - b.wrong * 3, 40, 100)) : round1((b.last || 0) * 5);
          teamLabel[t] = b.solvedAt != null ? `${(b.solvedAt / 1000).toFixed(1)}초 해제` : '실패';
        }
        const players = {};
        for (const p of P.values()) players[p.id] = { raw: teams[p.team], norm: teams[p.team], show: teamLabel[p.team] };
        return { players, teams, teamLabel, extra: { codes: Object.fromEntries(ctx.teams.map((t) => [t, T[t].v.code])) } };
      },
    };
  },
};

// ---------------------------------------------------------------- 09 두더지 사냥
export const mole = {
  id: 'mole', no: 9, name: '두더지 사냥', emoji: '🐹',
  dur: { kid: 25, elem: 30, adult: 30 },
  rule: { kid: '두더지가 쏙! 나오면 톡! 눌러요', elem: '튀어나온 두더지를 빠르게 터치! 갈수록 빨라져요', adult: '두더지만 정확히 터치! 빈 곳을 누르면 -3점. 갈수록 빨라집니다' },
  howto: '모두 같은 순서로 두더지가 나와서 공정. 팀 평균 점수로 경쟁',
  create(ctx) {
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, hits: new Set(), miss: 0, active: false }); ctx.players.forEach(add);
    const holes = { kid: 6, elem: 9, adult: 9 };
    const sched = {}; for (const a of ['kid', 'elem', 'adult']) sched[a] = moleSchedule(ctx.seed, ctx.durMs, holes[a], LV[a]);
    const score = (p) => p.hits.size * 10 - (p.age === 'adult' ? p.miss * 3 : 0);
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      start(now) { this.t0 = now; },
      shift(ms) { this.t0 += ms; },
      input(pid, m, now) {
        const p = P.get(pid); if (!p) return;
        if (m.a === 'miss') { p.miss = Math.min(p.miss + 1, 999); p.active = true; return; }
        if (m.a !== 'hit' || !intIn(m.i, 0, 500)) return;
        const s = sched[p.age][m.i]; if (!s || p.hits.has(m.i)) return;
        const t = now - this.t0;
        // 서버 시각 기준 등장 구간 (네트워크 지연 600ms 허용)
        if (t < s.at - 200 || t > s.at + s.dur + 600) return { late: true };
        p.hits.add(m.i); p.active = true;
        return { hit: m.i };
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'mole', spectator: true };
        return { g: 'mole', holes: holes[p.age], sched: sched[p.age], t0: this.t0, score: score(p), age: p.age };
      },
      screen() {
        const o = {}; const c = {};
        for (const p of P.values()) { if (!p.active) continue; o[p.team] = (o[p.team] || 0) + score(p); c[p.team] = (c[p.team] || 0) + 1; }
        return { avg: Object.fromEntries(ctx.teams.map((t) => [t, c[t] ? round1(o[t] / c[t]) : 0])), sched: sched.elem, t0: this.t0, holes: 9 };
      },
      finish() {
        const players = {};
        for (const p of P.values()) {
          if (!p.active) continue;
          const sc = Math.max(0, score(p));
          players[p.id] = { raw: sc, norm: norm(sc, sched[p.age].length * 10 * 0.8), show: `${p.hits.size}마리` };
        }
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 10 반응속도 챔피언
export const reaction = {
  id: 'reaction', no: 10, name: '반응속도 챔피언', emoji: '⚡',
  dur: { kid: 30, elem: 35, adult: 40 },
  untimed: true,
  rule: {
    kid: '화면이 초록색으로 바뀌면 바로 톡!',
    all: '빨간 화면에서 기다리다 초록색으로 바뀌는 순간 터치! 미리 누르면 반칙',
  },
  howto: '여러 라운드 평균 반응 시간. 시간은 폰에서 직접 재서 인터넷 속도와 무관',
  create(ctx) {
    const age = ctx.events.dominantAge();
    const rounds = ctx.item.rounds || { kid: 3, elem: 4, adult: 5 }[age];
    const r = rng(ctx.seed);
    const P = new Map(ctx.players.map((p) => [p.id, { ...p, rts: [], fouls: 0, cur: null }]));
    let round = 0, phase = 'wait', sentAt = 0, delay = 0, until = 0;
    const penalty = { kid: 1100, elem: 900, adult: 800 };
    const begin = (now) => {
      round++; phase = 'arm'; delay = Math.round(1500 + r() * 2500); sentAt = now; until = now + delay + 2500;
      for (const p of P.values()) p.cur = null;
      ctx.dirtyAll();
    };
    const avg = (p) => (p.rts.length ? p.rts.reduce((s, x) => s + x, 0) / p.rts.length : null);
    return {
      start(now) { begin(now); },
      shift(ms) { sentAt += ms; until += ms; },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'tap' || phase !== 'arm' || m.round !== round || p.cur) return;
        const srvEl = now - sentAt;
        if (m.early) {
          if (p.age === 'kid') return { early: true, retry: true }; // 유아는 반칙 없이 다시
          p.cur = { foul: true }; p.fouls++; return { foul: true };
        }
        if (!numIn(m.rt, 0, 5000)) return;
        // 주장한 반응시간이 실제 흐른 시간보다 짧으면 안 됨 (delay + rt <= 서버가 잰 시간 + 오차)
        const minRt = p.age === 'kid' ? 120 : 100;
        if (m.rt < minRt || delay + m.rt > srvEl + 150) { p.cur = { foul: true }; p.fouls++; return { foul: true, sus: true }; }
        p.cur = { rt: Math.round(m.rt) };
        return { rt: p.cur.rt };
      },
      tick(now) {
        if (phase === 'arm' && now >= until) {
          for (const p of P.values()) {
            if (!p.cur && !ctx.events.players.get(p.id)?.online && !p.rts.length) continue;
            p.rts.push(p.cur?.rt ?? penalty[p.age]);
          }
          phase = 'between'; until = now + 2500; ctx.dirtyAll();
        } else if (phase === 'between' && now >= until) {
          if (round >= rounds) { phase = 'done'; ctx.endEarly(); } else begin(now);
        }
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'reaction', spectator: true };
        return { g: 'reaction', round, rounds, phase, delay: phase === 'arm' ? delay : null, sentAt, cur: p.cur, avg: avg(p), rts: p.rts };
      },
      screen() {
        const lst = [];
        for (const p of P.values()) if (p.cur?.rt) lst.push({ name: p.name, team: p.team, rt: p.cur.rt });
        lst.sort((a, b) => a.rt - b.rt);
        const tm = {};
        for (const t of ctx.teams) { const a = [...P.values()].filter((p) => p.team === t && p.rts.length).map(avg); tm[t] = a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null; }
        return { round, rounds, phase, delay: phase === 'arm' ? delay : null, sentAt, top: lst.slice(0, 5), tapped: lst.length, team: tm };
      },
      finish() {
        const players = {};
        const rng2 = { kid: [350, 1200], elem: [240, 900], adult: [210, 800] };
        for (const p of P.values()) {
          const a = avg(p); if (a == null || p.rts.every((x) => x === penalty[p.age])) continue;
          players[p.id] = { raw: Math.round(a), norm: normLow(a, ...rng2[p.age]), show: `평균 ${Math.round(a)}ms` };
        }
        return { players };
      },
    };
  },
};

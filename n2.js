// 새 게임 ② 우리 놀이 · 타이밍
// 무궁화 꽃이 피었습니다 / 단체 줄넘기 / 불꽃놀이 / 과일 베기
import { rng } from './gen.js';
import { clamp, round1, numIn, intIn, LV, by6 } from './common.js';
import { fruitSchedule, fruitLife, ropeBeats, fireRounds } from './gen2.js';

const avgBy = (P, val, teams) => {
  const o = Object.fromEntries(teams.map((t) => [t, { s: 0, n: 0 }]));
  for (const p of P.values()) { const v = val(p); if (v == null || !o[p.team]) continue; o[p.team].s += v; o[p.team].n++; }
  return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x.n ? round1(x.s / x.n) : 0]));
};
// 일시정지 안전한 게임 시계 (ticker 사이 간격 누적)
function clock() {
  const c = { T: 0, last: null };
  c.dt = (now) => { const d = c.last == null ? 0.1 : clamp((now - c.last) / 1000, 0, 0.25); c.last = now; c.T += d; return d; };
  c.shift = (ms) => { if (c.last != null) c.last += ms; };
  return c;
}

// ---------------------------------------------------------------- 무궁화 꽃이 피었습니다
export const mugung = {
  id: 'mugung', no: 6, name: '무궁화 꽃이 피었습니다', emoji: '🚦',
  dur: { kid: 60, elem: 70, adult: 70 },
  rule: { all: '버튼을 꾹 누르고 있으면 앞으로! 술래가 돌아보면 바로 손을 떼요. 움직이다 걸리면 탈락!', kid: '꾹 누르면 앞으로 가요! 술래가 보면 손을 떼고 멈춰요!' },
  howto: '결승선에 빨리 도착할수록 고득점 · 큰 화면과 소리를 잘 보고 들어요',
  lateJoin: true,
  create(ctx) {
    const r = rng(ctx.seed);
    const C = clock();
    const P = new Map();
    const add = (p) => P.set(p.id, { ...p, pos: 0, on: false, out: false, finT: null, caught: 0, active: false, back: 0 });
    ctx.players.forEach(add);
    const sec = { kid: 9, elem: 11, adult: 12 };
    const fin = [];
    const caughtLog = [];
    let ph = 'sing', phEnd = 2.6 + r() * 1.2, phDur = phEnd, lookAt = null, checked = false, round = 0;
    const kidRule = (p) => p.age === 'kid';
    const catchP = (p, T) => {
      if (kidRule(p)) { p.back++; p.pos = Math.max(0, p.pos - 30); p.on = false; }
      else { p.out = true; p.on = false; }
      p.caught++;
      caughtLog.push({ name: p.name, team: p.team, at: T, kid: kidRule(p) });
      ctx.sendTo(p.id, { run: ctx.runId, r: { caught: true, kid: kidRule(p) } });
    };
    const leftOf = () => Math.max(0, phEnd - C.T);
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      input(pid, m) {
        const p = P.get(pid); if (!p || m.a !== 'go' || p.out || p.finT != null) return;
        const on = !!m.on;
        if (on) p.active = true;
        p.on = on;
        // 술래가 보고 있는데 출발하면 걸림 (돌아본 직후 0.3초는 봐줌)
        if (on && ph === 'look' && C.T - lookAt > 0.3) catchP(p, C.T);
        ctx.dirty(pid);
      },
      shift: C.shift,
      tick(now) {
        const d = C.dt(now); const T = C.T;
        if (ph === 'sing' || ph === 'turn') {
          for (const p of P.values()) {
            if (!p.on || p.out || p.finT != null) continue;
            p.pos = Math.min(100, p.pos + (100 / by6(p.lv, [8, 9, 11, 12, 12, 12])) * d);
            if (p.pos >= 100) { p.finT = T; p.on = false; fin.push(p.id); ctx.sendTo(p.id, { run: ctx.runId, r: { fin: fin.length } }); }
          }
        }
        if (ph === 'look' && !checked && T - lookAt >= 0.3) {
          checked = true;
          for (const p of P.values()) if (p.on && !p.out && p.finT == null) catchP(p, T);
        }
        if (T >= phEnd) {
          const prog = clamp(T / (ctx.durMs / 1000), 0, 1);
          if (ph === 'sing') { ph = 'turn'; phDur = 0.45; }
          else if (ph === 'turn') { ph = 'look'; lookAt = T; checked = false; phDur = 1.8 + r() * 1.4; }
          else { ph = 'sing'; round++; phDur = Math.max(1.1, 1.6 + r() * (2.8 - prog * 1.6)); }
          phEnd = T + phDur;
          ctx.dirtyAll();
        }
        while (caughtLog.length && T - caughtLog[0].at > 3) caughtLog.shift();
        const act = [...P.values()].filter((p) => p.active);
        if (act.length && act.every((p) => p.out || p.finT != null)) ctx.endEarly();
        if (now - (this._v || 0) > 400) { this._v = now; ctx.dirtyAll(); }
      },
      view(pid, now) {
        const p = P.get(pid); if (!p) return { g: 'mugung', spectator: true };
        return { g: 'mugung', ph, until: now + Math.round(leftOf() * 1000), dur: round1(phDur), pos: round1(p.pos), out: p.out, fin: p.finT != null ? fin.indexOf(pid) + 1 : null, kid: kidRule(p), on: p.on };
      },
      screen() {
        const ps = [], nm = []; for (const p of P.values()) if (p.active || p.pos > 0) { ps.push(p.team, Math.round(p.pos), p.out ? 1 : p.finT != null ? 2 : p.on ? 3 : 0); nm.push(p.name); }
        return { ph, left: round1(leftOf()), dur: round1(phDur), round, ps, nm: nm.length <= 60 ? nm : undefined, caught: caughtLog.slice(-10).map((c) => [c.name, c.team, c.kid ? 1 : 0]), top: fin.slice(0, 3).map((id) => [P.get(id).name, P.get(id).team]), finN: fin.length, outN: [...P.values()].filter((p) => p.out).length, avg: avgBy(P, (p) => (p.active ? p.pos : null), ctx.teams) };
      },
      finish() {
        const players = {}; const D = ctx.durMs / 1000;
        for (const p of P.values()) {
          if (!p.active) continue;
          let n, show;
          if (p.finT != null) { n = 62 + 38 * clamp(1 - p.finT / D, 0, 1); show = `${fin.indexOf(p.id) + 1}등 도착`; }
          else if (p.out) { n = p.pos * 0.4; show = `${Math.round(p.pos)}m에서 걸림`; }
          else { n = p.pos * 0.6; show = `${Math.round(p.pos)}m`; }
          players[p.id] = { raw: p.finT != null ? round1(200 - p.finT) : round1(p.pos), norm: round1(clamp(n, 0, 100)), show };
        }
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 단체 줄넘기
export const rope = {
  id: 'rope', no: 8, name: '단체 줄넘기', emoji: '🪢',
  dur: { kid: 45, elem: 50, adult: 55 },
  rule: { all: '줄이 바닥에 닿는 순간 다 같이 점프 버튼! 팀원 대부분이 성공해야 줄이 계속 돌아요', kid: '줄이 바닥에 닿을 때 "점프"를 눌러요! 다 같이!' },
  howto: '우리 팀이 성공한 점프 수로 경쟁 · 줄이 점점 빨라져요',
  lateJoin: true,
  create(ctx) {
    const mode = ctx.settings.mode;
    const lv = mode === 'kid' ? 0 : mode === 'adult' ? 2 : 1;
    const L6 = ctx.settings.lv;
    const win = by6(L6, [330, 260, 205, 180, 170, 165]);
    const thr = by6(L6, [0.4, 0.5, 0.6, 0.62, 0.65, 0.65]);
    const prm = { t0: 0, p0: by6(L6, [1300, 1150, 980, 920, 890, 880]), decay: 0.986, pmin: by6(L6, [880, 760, 620, 570, 545, 540]) };
    let beats = [];
    const P = new Map();
    const add = (p) => P.set(p.id, { ...p, hit: new Set(), press: new Map(), active: false, firstK: null });
    ctx.players.forEach(add);
    const T = Object.fromEntries(ctx.teams.map((t) => [t, { combo: 0, best: 0, tot: 0, restK: -1, last: null, lastK: -1, rate: 0 }]));
    let evalK = 0;
    const nearest = (t) => { let lo = 0, hi = beats.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (beats[m] < t) lo = m + 1; else hi = m; } if (lo > 0 && Math.abs(beats[lo - 1] - t) < Math.abs(beats[lo] - t)) lo--; return lo; };
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      start(now) { prm.t0 = now + 1500; beats = ropeBeats(prm, ctx.durMs + 2000); ctx.dirtyAll(); },
      shift(ms) { prm.t0 += ms; beats = beats.map((b) => b + ms); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'j' || !beats.length) return;
        if (!numIn(m.ts, now - 800, now + 800)) return;
        const k = nearest(m.ts); const diff = m.ts - beats[k];
        const c = (p.press.get(k) || 0) + 1; p.press.set(k, c);
        if (!p.active) { p.active = true; p.firstK = k; }
        if (c > 2) { p.hit.delete(k); return { ok: false, spam: true }; } // 마구 누르면 무효
        if (Math.abs(diff) <= win && !p.hit.has(k)) { p.hit.add(k); return { ok: true, k, d: Math.round(diff) }; }
        return { ok: false, d: Math.round(diff) };
      },
      tick(now) {
        // 박자마다 팀 성공 판정 (지연 고려해 조금 뒤에)
        while (evalK < beats.length && now >= beats[evalK] + win + 280) {
          const k = evalK++;
          for (const tid of ctx.teams) {
            const t = T[tid];
            const mem = [...P.values()].filter((p) => p.team === tid && p.active && p.firstK <= k);
            if (!mem.length) continue;
            if (k <= t.restK) continue; // 걸려서 다시 돌리는 중
            const ok = mem.filter((p) => p.hit.has(k)).length;
            t.rate = ok / mem.length; t.lastK = k;
            if (t.rate >= thr) { t.combo++; t.tot++; t.best = Math.max(t.best, t.combo); t.last = 'ok'; }
            else { t.combo = 0; t.last = 'fail'; t.restK = k + 2; }
          }
          ctx.dirtyAll();
        }
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'rope', spectator: true };
        const t = T[p.team] || {};
        return { g: 'rope', prm, win, hits: p.hit.size, combo: t.combo, best: t.best, last: t.last, lastK: t.lastK, restK: t.restK };
      },
      screen() {
        return { prm, teams: Object.fromEntries(Object.entries(T).map(([k, t]) => [k, [t.combo, t.tot, t.best, t.last === 'ok' ? 1 : t.last === 'fail' ? 2 : 0, t.lastK, t.restK, Math.round(t.rate * 100)]])), tot: Object.fromEntries(Object.entries(T).map(([k, t]) => [k, t.tot])) };
      },
      finish(now) {
        const players = {};
        const done = beats.filter((b) => b < now).length;
        for (const p of P.values()) {
          if (!p.active) continue;
          const span = Math.max(1, done - p.firstK);
          const rate = clamp(p.hit.size / span, 0, 1);
          players[p.id] = { raw: p.hit.size, norm: round1(clamp(rate * 112, 0, 100)), show: `${p.hit.size}번 성공` };
        }
        const teams = {}; const label = {};
        for (const tid of ctx.teams) { if (![...P.values()].some((p) => p.team === tid && p.active)) continue; teams[tid] = T[tid].tot; label[tid] = `${T[tid].tot}번 (최고 ${T[tid].best}연속)`; }
        return { players, teams, teamLabel: label };
      },
    };
  },
};

// ---------------------------------------------------------------- 불꽃놀이
export const fire = {
  id: 'fire', no: 19, name: '불꽃놀이', emoji: '🎆',
  dur: { kid: 26, elem: 30, adult: 29 },
  minDur: { kid: 26, elem: 30, adult: 29 },
  rule: { all: '로켓이 가장 높이 올라간 순간 "펑!" 버튼! 딱 맞출수록 큰 불꽃이 터져요', kid: '로켓이 제일 높이 갔을 때 꾹! 눌러요' },
  howto: '최고점에 가까울수록 고득점 (라운드 평균)',
  lateJoin: true,
  create(ctx) {
    const mode = ctx.settings.mode;
    const n = { kid: 6, elem: 8, adult: 9 }[mode] ?? 8;
    const gap = { kid: 3600, elem: 3200, adult: 2800 }[mode] ?? 3200;
    const div = { kid: 8, elem: 6, adult: 5 };
    let R = [];
    const P = new Map();
    const add = (p) => P.set(p.id, { ...p, sc: {}, active: false, perf: 0 });
    ctx.players.forEach(add);
    let pops = [];
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      start(now) { R = fireRounds(ctx.seed, now + 1000, n, gap); ctx.dirtyAll(); },
      shift(ms) { R = R.map((x) => ({ ...x, L: x.L + ms, A: x.A + ms })); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'pop' || !intIn(m.i, 0, n - 1)) return;
        const rd = R[m.i]; if (!rd || p.sc[m.i] != null) return;
        if (!numIn(m.ts, now - 700, now + 700) || m.ts < rd.L || m.ts > rd.A + 900) return;
        const err = Math.abs(m.ts - rd.A);
        const s = Math.round(clamp(100 - err / by6(p.lv, [10, 8, 6, 5.5, 5, 5]), 0, 100));
        p.sc[m.i] = s; p.active = true; if (err <= 45) p.perf++;
        pops.push([p.team, s, m.i]);
        return { i: m.i, s, err: Math.round(m.ts - rd.A), perfect: err <= 45 };
      },
      tick(now) { if (now - (this._v || 0) > 1000) { this._v = now; ctx.dirtyAll(); } },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'fire', spectator: true };
        return { g: 'fire', R, sc: p.sc };
      },
      screen() {
        const out = pops; pops = [];
        return { R, pops: out, avg: avgBy(P, (p) => (p.active ? Object.values(p.sc).reduce((a, b) => a + b, 0) / n : null), ctx.teams) };
      },
      finish() {
        const players = {};
        for (const p of P.values()) {
          if (!p.active) continue;
          const sum = Object.values(p.sc).reduce((a, b) => a + b, 0);
          players[p.id] = { raw: sum, norm: round1(sum / n), show: `${Math.round(sum / n)}점${p.perf ? ` · PERFECT ${p.perf}번` : ''}` };
        }
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 과일 베기
export const fruit = {
  id: 'fruit', no: 12, name: '과일 베기', emoji: '🍉',
  dur: { kid: 30, elem: 35, adult: 40 },
  rule: { all: '손가락으로 쓱~ 그어서 과일을 잘라요! 💣 폭탄은 자르면 감점', kid: '과일을 손가락으로 쓱쓱 그어서 잘라요!' },
  howto: '자른 과일 점수 (황금 과일 +5, 한 번에 여러 개 콤보 보너스, 폭탄 -5)',
  lateJoin: true,
  create(ctx) {
    let t0 = 0;
    const S = {}; const M = {};
    const sched = (age) => { if (!S[age]) { S[age] = fruitSchedule(ctx.seed + LV[age], ctx.durMs / 1000, LV[age]); M[age] = new Map(S[age].map((f) => [f.id, f])); } return S[age]; };
    const P = new Map();
    const add = (p) => { sched(p.age); P.set(p.id, { ...p, cut: new Set(), score: 0, n: 0, bombs: 0, best: 0, active: false, tok: 14, tAt: 0 }); };
    ctx.players.forEach(add);
    const refOf = (age) => sched(age).reduce((s, f) => s + (f.type === 'g' ? 5 : f.type === 'f' ? 1 : 0), 0) * 0.55;
    let combos = []; let cuts = {};
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      start(now) { t0 = now; ctx.dirtyAll(); },
      shift(ms) { t0 += ms; },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'cut' || !Array.isArray(m.ids) || !t0) return;
        if (!numIn(m.ts, now - 900, now + 300)) return;
        p.tok = Math.min(16, p.tok + ((now - (p.tAt || now)) / 1000) * 12); p.tAt = now;
        const sec = (m.ts - t0) / 1000; const map = M[p.age];
        let got = 0, gold = 0, bomb = 0;
        for (const id of m.ids.slice(0, 8)) {
          const f = map.get(id); if (!f || p.cut.has(id) || p.tok < 1) continue;
          const dt = sec - f.t; if (dt < -0.05 || dt > fruitLife(f) + 0.15) continue;
          p.cut.add(id); p.tok -= 1; p.active = true;
          if (f.type === 'b') { bomb++; p.bombs++; p.score -= 5; }
          else if (f.type === 'g') { gold++; p.score += 5; p.n++; }
          else { got++; p.score += 1; p.n++; }
        }
        const combo = got + gold;
        if (combo >= 3) { p.score += combo - 2; p.best = Math.max(p.best, combo); combos.push([p.name, p.team, combo]); }
        if (combo) cuts[p.team] = (cuts[p.team] || 0) + combo;
        if (got || gold || bomb) return { got, gold, bomb, combo, score: p.score };
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'fruit', spectator: true };
        return { g: 'fruit', seed: ctx.seed + LV[p.age], lv: LV[p.age], dur: ctx.durMs / 1000, t0, score: p.score };
      },
      screen() {
        const c = combos; const k = cuts; combos = []; cuts = {};
        return { avg: avgBy(P, (p) => (p.active ? Math.max(0, p.score) : null), ctx.teams), combos: c.slice(-6), cuts: k };
      },
      finish() {
        const players = {};
        for (const p of P.values()) {
          if (!p.active) continue;
          players[p.id] = { raw: p.score, norm: round1(clamp((Math.max(0, p.score) / refOf(p.age)) * 100, 0, 100)), show: `${p.score}점${p.best >= 3 ? ` · 최고 ${p.best}콤보` : ''}` };
        }
        return { players };
      },
    };
  },
};

// 새 터치게임 4종 (운동회 종목의 재미를 폰 터치로): 풍선 터뜨리기 · 폭탄 패스 · 보스 레이드 · 타워 쌓기
// 기존 게임과 겹치는 '디지털 계주'(= 팀 릴레이)·'터치 줄다리기'(= 한마음 박자·함성 대폭발과 같은 조작)는 넣지 않음
import { rng, shuffle } from './gen.js';
import { clamp, round1, intIn, tsOk } from './common.js';
import { balloonCfg, balloonWave, balloonTarget, bossCfg, bossCell } from './gen2.js';

const lvOf = (ctx) => ctx.settings.lv ?? 2;
const avgBy = (P, f, teams) => { const o = {}; for (const t of teams) { const a = [...P.values()].filter((p) => p.team === t).map(f).filter((v) => v != null); o[t] = a.length ? round1(a.reduce((x, y) => x + y, 0) / a.length) : 0; } return o; };

// ---------------------------------------------------------------- 36. 풍선 터뜨리기
// 위에 나온 '목표 색' 풍선만 터치. 다른 색은 −1점. 우리 팀이 3초 안에 많이 맞힐수록 '팀 콤보'가 올라 한 개당 점수가 커짐
export const balloon = {
  id: 'balloon', no: 36, name: '풍선 터뜨리기', emoji: '🎈',
  dur: { kid: 40, elem: 45, adult: 45 },
  rule: { all: '위에 나온 색깔 풍선만 콕! 다른 색을 누르면 −1점. 우리 팀이 연달아 맞힐수록 팀 콤보로 점수가 커져요', kid: '말한 색깔 풍선만 콕콕! 다른 색은 안 돼요' },
  howto: '맞힌 풍선 +1 (팀 콤보 10↑ +2, 25↑ +3) · 틀린 색 −1 · 목표 색은 7초마다 바뀌어요',
  lateJoin: true,
  create(ctx) {
    const lv = lvOf(ctx); const CF = balloonCfg(lv); const seed = ctx.seed;
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, sc: 0, ok: 0, bad: 0, popped: new Set(), last: 0, active: false });
    ctx.players.forEach(add);
    const hits = Object.fromEntries(ctx.teams.map((t) => [t, []])); // 팀별 최근 정답 시각(초)
    let t0 = null; let fx = [];
    const sec = (ms) => (ms - t0) / 1000;
    const combo = (t, s) => { const a = hits[t] || []; while (a.length && a[0] < s - 3) a.shift(); return a.length; };
    const bonus = (c) => (c >= 25 ? 3 : c >= 10 ? 2 : 1);
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      start(now) { t0 = now; ctx.dirtyAll(); },
      shift(ms) { if (t0 != null) t0 += ms; ctx.dirtyAll(); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || t0 == null || m.a !== 'pop' || !intIn(m.id, 0, 99999)) return;
        if (!tsOk(m.ts, now) || p.popped.has(m.id) || now - p.last < 70) return; // 같은 풍선 두 번 · 너무 빠른 연타(스팸) 무시
        const w = Math.floor(m.id / 10); const b = balloonWave(seed, pid, w, lv).find((x) => x.id === m.id); if (!b) return;
        const s = sec(m.ts); if (s < b.t0 - 0.2 || s > b.t0 + b.life + 0.35) return; // 화면에 없던 풍선
        p.popped.add(m.id); p.last = now; p.active = true;
        const tgt = balloonTarget(seed, Math.floor(s / CF.tSec), CF.nc);
        if (b.c === tgt) { hits[p.team]?.push(s); const c = combo(p.team, s); const g = bonus(c); p.sc += g; p.ok++; fx.push([p.team, 1]); return { id: m.id, ok: true, g, c, sc: p.sc }; }
        p.sc = Math.max(0, p.sc - 1); p.bad++; fx.push([p.team, 0]); return { id: m.id, ok: false, sc: p.sc };
      },
      tick(now) { if (now - (this._v || 0) > 1000) { this._v = now; ctx.dirtyAll(); } },
      view(pid, now) {
        const p = P.get(pid); if (!p) return { g: 'balloon', spectator: true };
        const s = t0 == null ? 0 : sec(now);
        return { g: 'balloon', seed, lv, t0, sc: p.sc, ok: p.ok, bad: p.bad, combo: combo(p.team, s) };
      },
      screen(now) {
        const s = t0 == null ? 0 : sec(now ?? Date.now()); const out = fx; fx = [];
        const tgt = balloonTarget(seed, Math.floor(Math.max(0, s) / CF.tSec), CF.nc);
        const cmb = Object.fromEntries(ctx.teams.map((t) => [t, combo(t, s)]));
        return { tgt, nc: CF.nc, left: round1(CF.tSec - (Math.max(0, s) % CF.tSec)), combo: cmb, fx: out.slice(0, 80), avg: avgBy(P, (p) => (p.active ? p.sc : null), ctx.teams) };
      },
      finish() {
        // 기준: 이 시간 동안 나오는 목표 색 풍선 수 × 1.5 (콤보 포함 잘하면 100)
        const ref = Math.max(10, ((ctx.durMs / 1000 - 1) / CF.gap) * (1 + (CF.per - 1) / CF.nc) * 1.5);
        const players = {};
        for (const p of P.values()) if (p.active) players[p.id] = { raw: p.sc, norm: round1(clamp((p.sc / ref) * 100, 0, 100)), show: `${p.sc}점 · 맞힘 ${p.ok} · 틀림 ${p.bad}` };
        return { players };
      },
    };
  },
};

// ---------------------------------------------------------------- 37. 폭탄 패스
// 폭탄을 받으면 화면에 나온 색 버튼을 눌러 다른 팀에게 넘김(틀리면 1초 멈춤). 심지가 다 타면 들고 있던 팀이 '폭발 1번'
// 폭발이 적은 팀이 이김. 넘길 팀은 공평하게(팀 인원과 상관없이) 고름
const BOMB_C = [['빨강', '#ff4d6d'], ['파랑', '#3d8bff'], ['노랑', '#ffd43b']];
export const bombpass = {
  id: 'bombpass', no: 37, name: '폭탄 패스', emoji: '💣',
  dur: { kid: 50, elem: 55, adult: 55 },
  rule: { all: '폭탄이 오면 나온 색 버튼을 눌러 다른 팀에게 휙! 심지가 다 타면 들고 있던 팀이 폭발 −1. 폭발이 적은 팀이 이겨요', kid: '폭탄이 오면 같은 색 버튼을 콕! 다른 팀에게 넘겨요' },
  howto: '폭발 횟수가 적은 팀이 승리 · 틀린 색은 1초 멈춤 · 대형 화면에 폭탄 위치와 심지 시간이 보여요',
  lateJoin: true,
  create(ctx) {
    const r = rng(ctx.seed); const lv = lvOf(ctx); const C = { T: 0, last: null };
    const fuse = [[10, 15], [9, 14], [7, 12], [6, 11], [6, 10], [6, 10]][lv];
    const P = new Map(); const add = (p) => P.set(p.id, { ...p, got: 0, passes: 0, booms: 0, fast: 0, lockUntil: 0, active: false });
    ctx.players.forEach(add);
    const booms = Object.fromEntries(ctx.teams.map((t) => [t, 0]));
    const B = []; let seq = 0; let started = false; let news = [];
    const online = (t) => [...P.values()].filter((p) => p.team === t && (ctx.events?.players?.get(p.id)?.online ?? true) && !B.some((b) => b.h === p.id));
    const teamsWith = () => ctx.teams.filter((t) => [...P.values()].some((p) => p.team === t));
    const give = (b, notTeam) => {
      let ts = teamsWith().filter((t) => t !== notTeam && online(t).length); if (!ts.length) ts = teamsWith().filter((t) => online(t).length);
      if (!ts.length) { b.h = null; return; }
      const t = ts[Math.floor(r() * ts.length)]; const pool = online(t); const q = pool[Math.floor(r() * pool.length)];
      b.h = q.id; b.t = t; b.since = C.T; b.c = Math.floor(r() * 3); q.got++; ctx.sendTo(q.id, { run: ctx.runId, r: { bomb: b.id } }); ctx.dirty(q.id);
    };
    const spawn = () => { const b = { id: ++seq, h: null, t: null, c: 0, since: C.T, end: C.T + fuse[0] + r() * (fuse[1] - fuse[0]), dead: false }; B.push(b); give(b, null); return b; };
    const nB = () => clamp(Math.max(ctx.teams.length, Math.ceil(P.size / 12)), 2, 30);
    return {
      addPlayer(p) { if (!P.has(p.id)) add(p); },
      shift(ms) { if (C.last != null) C.last += ms; },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'pass' || !intIn(m.c, 0, 2)) return;
        const b = B.find((x) => x.h === pid && !x.dead && x.id === m.b); if (!b) return;
        if (C.T < p.lockUntil) return { lock: true };
        p.active = true;
        if (m.c !== b.c) { p.lockUntil = C.T + 1; return { wrong: true, lock: 1 }; }
        const held = C.T - b.since; if (held < 1.2) p.fast++;
        p.passes++; const from = b.t; give(b, from); news.push([from, b.t]); ctx.dirty(pid);
        return { passed: true };
      },
      tick(now) {
        const d = C.last == null ? 0.1 : clamp((now - C.last) / 1000, 0, 0.25); C.last = now; C.T += d;
        if (!started) { started = true; for (let i = 0; i < nB(); i++) spawn(); ctx.dirtyAll(); }
        for (const b of B) {
          if (b.dead) { if (C.T > b.respawn) { b.dead = false; b.end = C.T + fuse[0] + r() * (fuse[1] - fuse[0]); give(b, b.t); } continue; }
          if (!b.h) { give(b, null); continue; }
          if (!P.has(b.h)) { give(b, b.t); continue; }
          if (C.T >= b.end) { b.dead = true; b.respawn = C.T + 1.5; booms[b.t] = (booms[b.t] || 0) + 1; const q = P.get(b.h); if (q) { q.booms++; q.active = true; ctx.sendTo(q.id, { run: ctx.runId, r: { boom: 1 } }); ctx.dirty(q.id); } b.boomT = b.t; b.boomName = q?.name || ''; b.boomAt = C.T; b.h = null; }
        }
        if (nB() > B.length) spawn();
        if (now - (this._v || 0) > 500) { this._v = now; ctx.dirtyAll(); }
      },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'bombpass', spectator: true };
        const b = B.find((x) => x.h === pid && !x.dead);
        return { g: 'bombpass', my: b ? { id: b.id, c: b.c, left: round1(Math.max(0, b.end - C.T)), tot: round1(b.end - b.since) } : null, lock: round1(Math.max(0, p.lockUntil - C.T)), booms: booms[p.team] || 0, passes: p.passes, myBooms: p.booms };
      },
      screen() {
        const out = news; news = [];
        const bombs = B.map((b) => ({ id: b.id, t: b.dead ? b.boomT : b.t, h: b.dead ? b.boomName : P.get(b.h)?.name || '', left: b.dead ? 0 : round1(Math.max(0, b.end - C.T)), dead: b.dead && C.T - b.boomAt < 1.4 }));
        return { bombs, booms, moves: out.slice(0, 40), team: Object.fromEntries(ctx.teams.map((t) => [t, -(booms[t] || 0)])) };
      },
      finish() {
        const teams = {}; const teamLabel = {};
        // 팀 기록 = 100 − (우리 팀 폭발 ÷ 전체 폭발 × 100): 폭탄 수가 많아도(300명) 비교가 됨
        const all = Math.max(1, Object.values(booms).reduce((a, b) => a + b, 0));
        for (const t of ctx.teams) { if (![...P.values()].some((p) => p.team === t)) continue; teams[t] = round1(100 - ((booms[t] || 0) / all) * 100); teamLabel[t] = `폭발 ${booms[t] || 0}번`; }
        const players = {};
        for (const p of P.values()) if (p.got) players[p.id] = { raw: p.passes, norm: round1(clamp(60 + p.passes * 8 + p.fast * 4 - p.booms * 35, 0, 100)), show: `넘김 ${p.passes}번${p.booms ? ` · 💥${p.booms}` : ''}` };
        return { players, teams, teamLabel };
      },
    };
  },
};

// ---------------------------------------------------------------- 38. 보스 레이드
// 팀마다 보스 1마리. 폰의 칸 중 약점(빛나는 칸)이 나오면 그 칸을 콕! 빨리 누를수록 큰 공격(치명타).
// 보스 체력 = 팀 인원 × 기준 체력 (인원이 많아도 적어도 공평). 먼저 쓰러뜨린 팀이 이김
export const boss = {
  id: 'boss', no: 38, name: '보스 레이드', emoji: '🐉',
  dur: { kid: 50, elem: 55, adult: 55 },
  rule: { all: '빛나는 약점 칸이 나오면 바로 그 칸을 콕! 빨리 누르면 치명타 ×2. 다른 칸을 누르면 잠깐 막혀요. 우리 팀 공격을 모아 보스를 먼저 쓰러뜨려요', kid: '반짝이는 칸을 콕! 다 같이 공격해서 괴물을 물리쳐요' },
  howto: '보스 체력은 팀 인원에 맞춰 정해져요 · 먼저 쓰러뜨린 팀 1위, 못 쓰러뜨리면 깎은 체력 % 순',
  lateJoin: true,
  create(ctx) {
    const lv = lvOf(ctx); const CF = bossCfg(lv); const seed = ctx.seed;
    const P = new Map(); const T = Object.fromEntries(ctx.teams.map((t) => [t, { hp: 0, max: 0, dmg: 0, doneAt: null }]));
    const add = (p) => { if (P.has(p.id)) return; P.set(p.id, { ...p, hit: new Set(), dmg: 0, crit: 0, miss: 0, stun: 0, active: false }); const tm = T[p.team]; if (tm) { tm.max += CF.hp; tm.hp += CF.hp; } };
    ctx.players.forEach(add);
    let t0 = null; let fx = []; let order = 0;
    const sec = (ms) => (ms - t0) / 1000;
    return {
      addPlayer(p) { add(p); },
      start(now) { t0 = now; ctx.dirtyAll(); },
      shift(ms) { if (t0 != null) t0 += ms; ctx.dirtyAll(); },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || t0 == null || m.a !== 'hit' || !intIn(m.k, 0, 99999) || !intIn(m.c, 0, CF.cells - 1)) return;
        const tm = T[p.team]; if (!tm || tm.doneAt != null || !tsOk(m.ts, now)) return;
        const s = sec(m.ts); const k = Math.floor(s / CF.slot); if (k !== m.k || k < 0 || p.hit.has(k)) return; // 칸마다 한 번
        if (s < p.stun) return { stun: true };
        p.active = true; p.hit.add(k); if (p.hit.size > 400) p.hit.delete(p.hit.values().next().value);
        if (bossCell(seed, pid, k, CF.cells) !== m.c) { p.miss++; p.stun = s + 0.6; return { k, ok: false }; }
        const crit = s - k * CF.slot < CF.slot * 0.4; const d = crit ? 2 : 1;
        p.dmg += d; if (crit) p.crit++; tm.dmg += d; tm.hp = Math.max(0, tm.hp - d); fx.push([p.team, d]);
        if (tm.hp <= 0 && tm.doneAt == null) { tm.doneAt = s; tm.order = ++order; ctx.dirtyAll(); if (Object.values(T).every((x) => x.max === 0 || x.doneAt != null)) ctx.endEarly(); }
        return { k, ok: true, d, crit };
      },
      tick(now) { if (now - (this._v || 0) > 800) { this._v = now; ctx.dirtyAll(); } },
      view(pid) {
        const p = P.get(pid); if (!p) return { g: 'boss', spectator: true };
        const tm = T[p.team];
        return { g: 'boss', seed, t0, slot: CF.slot, cells: CF.cells, hp: tm.hp, max: tm.max, done: tm.doneAt != null, rank: tm.order || null, dmg: p.dmg };
      },
      screen() { const out = fx; fx = []; return { T: Object.fromEntries(Object.entries(T).map(([t, v]) => [t, { hp: v.hp, max: v.max, done: v.doneAt != null ? round1(v.doneAt) : null, rank: v.order || null }])), fx: out.slice(0, 120), team: Object.fromEntries(Object.entries(T).map(([t, v]) => [t, v.max ? round1((1 - v.hp / v.max) * 100) : 0])) }; },
      finish() {
        const teams = {}; const teamLabel = {}; const dur = ctx.durMs / 1000;
        for (const [t, v] of Object.entries(T)) { if (!v.max) continue; const pct = (1 - v.hp / v.max) * 100; teams[t] = v.doneAt != null ? round1(100 + Math.max(0, dur - v.doneAt)) : round1(pct); teamLabel[t] = v.doneAt != null ? `보스 처치 ${round1(v.doneAt)}초` : `보스 체력 ${Math.round(pct)}% 깎음`; }
        const players = {}; const slots = Math.max(1, (ctx.durMs / 1000) / CF.slot);
        for (const p of P.values()) if (p.active) players[p.id] = { raw: p.dmg, norm: round1(clamp((p.dmg / (slots * 0.9)) * 100, 0, 100)), show: `공격 ${p.dmg}${p.crit ? ` · 치명타 ${p.crit}` : ''}` };
        return { players, teams, teamLabel };
      },
    };
  },
};

// ---------------------------------------------------------------- 39. 타워 쌓기
// 팀원이 돌아가며 움직이는 블록을 '탭'으로 떨어뜨려 쌓음. 겹친 만큼만 남고, 딱 맞추면 PERFECT(폭 회복)
// 팀은 6명씩 '탑'을 나눠 쌓고, 팀 기록 = 탑 평균 높이 → 인원이 많아도 적어도 공평. 한 사람이 독차지할 수 없음(차례제)
export const towerup = {
  id: 'towerup', no: 39, name: '타워 쌓기', emoji: '🏗️',
  dur: { kid: 55, elem: 60, adult: 60 },
  rule: { all: '내 차례가 오면 좌우로 움직이는 블록을 딱 맞는 순간 탭! 겹친 만큼만 남아요. 팀원들이 번갈아 높이 쌓아요', kid: '내 차례에 블록이 가운데 왔을 때 콕! 높이 높이 쌓아요' },
  howto: '팀 기록 = 탑 평균 높이 (팀이 6명보다 많으면 탑을 나눠 쌓아요) · PERFECT는 폭이 다시 넓어져요 · 차례에 4초 안에 안 누르면 다음 친구 차례',
  lateJoin: true,
  create(ctx) {
    const r = rng(ctx.seed); const lv = lvOf(ctx); const C = { T: 0, last: null };
    const spd0 = [0.35, 0.45, 0.6, 0.7, 0.75, 0.78][lv]; const TURN = lv <= 1 ? 5 : 4; const W0 = 0.42;
    const P = new Map(); const L = []; // 탑(레인)
    const laneOf = (t) => { const ls = L.filter((x) => x.t === t); let l = ls.find((x) => x.m.length < 6); if (!l) { l = { id: L.length, t, m: [], i: 0, h: 0, perfect: 0, stack: [], w: W0, x: 0.5 - W0 / 2, ph: r() * 2, since: 0, last: null, drop: null }; L.push(l); } return l; };
    const add = (p) => { if (P.has(p.id)) return; const l = laneOf(p.team); l.m.push(p.id); P.set(p.id, { ...p, lane: l.id, drops: 0, good: 0, perf: 0, active: false }); };
    for (const p of shuffle(r, ctx.players)) add(p);
    const xAt = (l, T) => { const span = 1 - l.w; const sp = spd0 * (1 + l.h * 0.05); const q = ((T * sp + l.ph) % 2 + 2) % 2; return (q < 1 ? q : 2 - q) * span; };
    const cur = (l) => (l.m.length ? l.m[l.i % l.m.length] : null);
    const next = (l) => { l.i++; l.since = C.T; const h = cur(l); if (h) ctx.sendTo(h, { run: ctx.runId, r: { turn: 1 } }); ctx.dirtyAll(); };
    let t0 = null; let started = false;
    return {
      addPlayer(p) { add(p); },
      start(now) { t0 = now; },
      shift(ms) { if (C.last != null) C.last += ms; if (t0 != null) t0 += ms; },
      input(pid, m, now) {
        const p = P.get(pid); if (!p || m.a !== 'drop' || !tsOk(m.ts, now)) return;
        const l = L[p.lane]; if (!l || cur(l) !== pid) return; // 내 차례만
        const T = clamp(C.T - (now - m.ts) / 1000, l.since, C.T); // 누른 순간 위치로 판정
        const x = xAt(l, T); const lo = Math.max(x, l.x), hi = Math.min(x + l.w, l.x + l.w); const ov = hi - lo;
        p.active = true; p.drops++;
        let res;
        if (ov <= 0.01) { res = { miss: true }; l.drop = { x, w: l.w, ok: false, at: C.T }; }
        else if (Math.abs(x - l.x) < 0.025) { l.h++; l.perfect++; p.good++; p.perf++; l.w = Math.min(W0, l.w + 0.03); l.drop = { x: l.x, w: l.w, ok: true, perfect: true, at: C.T }; res = { perfect: true, h: l.h }; }
        else { l.h++; p.good++; l.x = lo; l.w = ov; l.drop = { x: lo, w: ov, ok: true, at: C.T }; res = { ok: true, h: l.h, w: round1(ov * 100) }; if (l.w < 0.05) { l.w = 0.16; l.x = 0.5 - 0.08; res.reset = true; } }
        if (res.perfect || res.ok) { l.stack.push([round1(l.x * 1000) / 1000, round1(l.w * 1000) / 1000]); if (l.stack.length > 6) l.stack.shift(); }
        next(l); return res;
      },
      tick(now) {
        const d = C.last == null ? 0.1 : clamp((now - C.last) / 1000, 0, 0.25); C.last = now; C.T += d;
        if (!started) { started = true; for (const l of L) { l.since = C.T; const h = cur(l); if (h) ctx.sendTo(h, { run: ctx.runId, r: { turn: 1 } }); } ctx.dirtyAll(); }
        for (const l of L) if (l.m.length && C.T - l.since > TURN) { if (l.m.length > 1) next(l); else l.since = C.T; }
        if (now - (this._v || 0) > 500) { this._v = now; ctx.dirtyAll(); }
      },
      view(pid, now) {
        const p = P.get(pid); if (!p) return { g: 'towerup', spectator: true };
        const l = L[p.lane]; const L2 = l.m.length; const pos = l.m.indexOf(pid); const wait = L2 ? (pos - (l.i % L2) + L2) % L2 : 0;
        return { g: 'towerup', me: cur(l) === pid, wait, h: l.h, stack: l.stack, w: l.w, x: l.x, ph: l.ph, spd: spd0 * (1 + l.h * 0.05), T: round1(C.T), at: now, left: round1(Math.max(0, TURN - (C.T - l.since))), turnSec: TURN, holder: P.get(cur(l))?.name || '', drops: p.drops, good: p.good };
      },
      screen() {
        const lanes = L.filter((l) => l.m.length).map((l) => ({ t: l.t, h: l.h, stack: l.stack, w: round1(l.w * 100) / 100, x: round1(l.x * 100) / 100, who: P.get(cur(l))?.name || '', drop: l.drop && C.T - l.drop.at < 0.8 ? l.drop : null, perf: l.perfect }));
        const team = {}; for (const t of ctx.teams) { const ls = L.filter((l) => l.t === t && l.m.length); team[t] = ls.length ? round1(ls.reduce((a, l) => a + l.h, 0) / ls.length) : 0; }
        return { lanes, team };
      },
      finish() {
        const teams = {}; const teamLabel = {};
        for (const t of ctx.teams) { const ls = L.filter((l) => l.t === t && l.m.length); if (!ls.length) continue; const avg = ls.reduce((a, l) => a + l.h + l.perfect * 0.3, 0) / ls.length; teams[t] = round1(avg); teamLabel[t] = `탑 평균 ${round1(ls.reduce((a, l) => a + l.h, 0) / ls.length)}층${ls.length > 1 ? ` (탑 ${ls.length}개)` : ''}`; }
        const players = {};
        for (const p of P.values()) if (p.drops) players[p.id] = { raw: p.good, norm: round1(clamp((p.good / p.drops) * 85 + p.perf * 5, 0, 100)), show: `${p.good}/${p.drops} 성공${p.perf ? ` · PERFECT ${p.perf}` : ''}` };
        return { players, teams, teamLabel };
      },
    };
  },
};

// 🏟 스포츠 진로 체험 육상 대회 (임시 행사용 게임 · 게임 순서에서 빼면 원래대로)
// 게임 하나 = 종목 하나(예선 여러 조 + 결승). 사회자가 종목·출전 방식·주로 수를 고르고 조를 확정 → 조마다 출발 절차 → 결과 → 결승 → 종목 결과
// 공정성: 위치·속도·순위·기록은 전부 서버가 계산. 폰은 '발 한 걸음(왼·오 번갈아)'만 보냄
//   · 1초에 인정하는 걸음 수 상한(8) · 속도는 최근 1초 걸음 수로 정해지고 7걸음/초에서 최고 속도 → 더 빨리 눌러도 안 빨라짐
//   · 출발 신호 전 입력 = 부정 출발 (서버가 받은 시각 기준)
import { rng, shuffle } from './gen.js';
import { EVENTS, EV_KEYS, ZONES, BREAK, MERGE } from './trackgeo.js';

const CAD = 7, CAP = 8; // 최고 속도 걸음 수 · 1초 인정 상한
const r2 = (x) => Math.round(x * 100) / 100;
const r1 = (x) => Math.round(x * 10) / 10;
const ENTRY = ['전원 출전', '아직 안 뛴 사람만', '자동 나눔(한 사람 한 종목)', '참가자 신청'];
const MEMKEY = (ev) => 'ath:' + ev.id;

function memOf(ev) {
  if (ev.athMem) return ev.athMem;
  let m = null; try { m = JSON.parse(ev.db.getKV?.(MEMKEY(ev)) || 'null'); } catch { /* */ }
  ev.athMem = { raced: {}, choice: {}, assign: {}, done: {}, prog: 0b00111, ...(m || {}) };
  return ev.athMem;
}
const saveMem = (ev) => { try { ev.db.setKV(MEMKEY(ev), JSON.stringify(ev.athMem)); } catch { /* */ } };

export const ath = {
  id: 'ath', no: 106, name: '육상 대회', emoji: '🏟', untimed: true, maxMin: 45, noRecord: true, lateJoin: true,
  dur: { kid: 600, elem: 600, adult: 600 },
  rule: { all: '왼발·오른발 버튼을 번갈아 눌러 달려요! "제자리에 → 차렷 → 탕!" 총소리(출발 신호) 전에 누르면 부정 출발이에요.' },
  howto: '빠르게 번갈아 누르면 빨라져요 (1초에 7번이면 최고 속도 · 더 빨리 눌러도 똑같아요) · 400m·800m는 체력 조절 · 기록은 게임이 계산한 기록이에요',
  create(ctx) {
    const ev = ctx.events; const prac = !!ctx.practice; const mem = prac ? { raced: {}, choice: {}, assign: {}, done: {}, prog: 0b00111 } : memOf(ev);
    const R = rng(ctx.seed);
    const P = new Map(); // pid → { id, name, team }
    const add = (p) => { if (!P.has(p.id)) P.set(p.id, { id: p.id, name: p.name, team: p.team }); };
    for (const p of ctx.players) add(p);
    const online = (pid) => !ev?.conns || ev.conns.has(pid);
    const nextEv = () => EV_KEYS.find((k) => !mem.done[k]) || '100';
    const cfg = { ev: nextEv(), entry: 0, lanes: 8, final: 1, choose: 0 };
    const G = { st: 'setup', heats: [], hi: 0, final: null, inFinal: false, races: [], over: null, sndT: 0, sndK: 0, msg: '' };
    let race = null; // 지금 조
    let seq = 0;
    // 🏃 준비 운동(조 편성 전): 모두 100m 직선에서 자유롭게 달려 봄 · 8명씩 한 무리로 서로 보임 · 기록·점수 없음
    const WU = new Map(); // pid → { d, v, steps, lap }
    const wuOf = (pid) => { let w = WU.get(pid); if (!w) { w = { d: 0, v: 0, steps: [], lap: 0 }; WU.set(pid, w); } return w; };
    function wuGroup(pid) { const ids = [...P.keys()].filter((q) => online(q) || q === pid); const i = Math.max(0, ids.indexOf(pid)); const g = Math.floor(i / 8); return ids.slice(g * 8, g * 8 + 8).map((q, k) => [q, k + 1]); }

    // ---------- 출전 선수 ----------
    const rawCount = (pid) => (mem.raced[pid] || []).length;
    function entrants() {
      const ids = [...P.keys()].filter(online);
      const E = cfg.ev;
      if (E === 'relay') return ids;
      if (cfg.entry === 1) return ids.filter((pid) => !rawCount(pid));
      if (cfg.entry === 2) { autoAssign(ids); return ids.filter((pid) => mem.assign[pid] === E); }
      if (cfg.entry === 3) return ids.filter((pid) => mem.choice[pid] === E);
      return ids;
    }
    const progList = () => ['100', '200', '400', '800'].filter((k, i) => mem.prog & (1 << i));
    function autoAssign(ids) {
      const L = progList(); if (!L.length) return;
      const cnt = Object.fromEntries(L.map((k) => [k, 0])); for (const pid of ids) if (cnt[mem.assign[pid]] != null) cnt[mem.assign[pid]]++;
      for (const pid of interleave(ids.filter((p) => cnt[mem.assign[p]] == null))) { const k = L.reduce((a, b) => (cnt[b] < cnt[a] ? b : a)); mem.assign[pid] = k; cnt[k]++; }
    }
    function fillChoice() { // 신청 안 한 사람 → 신청이 가장 적은 종목으로
      const L = progList(); if (!L.length) return; const ids = [...P.keys()].filter(online);
      const cnt = Object.fromEntries(L.map((k) => [k, 0])); for (const pid of ids) if (cnt[mem.choice[pid]] != null) cnt[mem.choice[pid]]++;
      for (const pid of interleave(ids.filter((p) => cnt[mem.choice[p]] == null))) { const k = L.reduce((a, b) => (cnt[b] < cnt[a] ? b : a)); mem.choice[pid] = k; cnt[k]++; }
    }
    // 팀이 고르게 섞이도록: 팀별로 섞은 뒤 한 명씩 번갈아
    function interleave(ids) {
      const by = {}; for (const pid of shuffle(R, ids)) { const t = P.get(pid)?.team ?? 0; (by[t] ||= []).push(pid); }
      const lists = Object.values(by); const out = []; for (let i = 0; lists.some((l) => l.length > i); i++) for (const l of lists) if (l[i]) out.push(l[i]);
      return out;
    }
    // 계주 팀: 같은 팀끼리 4명씩. 4명이 안 되면 같은 팀 친구가 한 번 더 달림(표시)
    function squads(ids) {
      const by = {}; for (const pid of shuffle(R, ids)) { const t = P.get(pid).team; (by[t] ||= []).push(pid); }
      const out = [];
      for (const [t, list] of Object.entries(by)) {
        const n = Math.ceil(list.length / 4); const sq = Array.from({ length: n }, () => []);
        list.forEach((pid, i) => sq[i % n].push(pid));
        sq.forEach((m, i) => { const base = [...m]; let k = 0; while (m.length < 4) m.push(base[k++ % base.length]); out.push({ id: `${t}-${i + 1}`, team: Number(t), members: m, label: `${ctx.teamName(Number(t))}${n > 1 ? ' ' + 'ABCDEFGH'[i] : ''}` }); });
      }
      return out;
    }
    const units = (ids) => (cfg.ev === 'relay' ? squads(ids) : interleave(ids).map((pid) => ({ id: pid, team: P.get(pid).team, members: [pid], label: P.get(pid).name })));
    function makeHeats() {
      const U = cfg.ev === 'relay' ? interleaveSq(units(entrants())) : units(entrants()); const N = cfg.lanes; const H = Math.max(1, Math.ceil(U.length / N));
      const heats = Array.from({ length: H }, () => []); U.forEach((u, i) => heats[i % H].push(u));
      return heats.filter((h) => h.length);
    }
    function interleaveSq(list) { const by = {}; for (const s of list) (by[s.team] ||= []).push(s); const L = Object.values(by); const out = []; for (let i = 0; L.some((l) => l.length > i); i++) for (const l of L) if (l[i]) out.push(l[i]); return out; }
    const laneSet = (k, N) => { const s = Math.floor((N - k) / 2) + 1; return Array.from({ length: k }, (_, i) => s + i); }; // 인원이 적으면 가운데 주로부터
    const E = () => EVENTS[cfg.ev];
    const raceEst = () => 14 + E().est + 9; // 출발 절차 + 경주 + 결과
    function summary() {
      const ids = entrants(); const U = cfg.ev === 'relay' ? squads(ids) : ids; const H = Math.max(U.length ? 1 : 0, Math.ceil(U.length / cfg.lanes)); const fin = cfg.final && H > 1 ? 1 : 0;
      return { n: ids.length, units: U.length, heats: H, final: fin, estSec: Math.round((H + fin) * raceEst() + 20) };
    }

    // ---------- 경주 ----------
    function newRace(list, final) {
      const N = cfg.lanes; const lanes = final ? seedLanes(list.length, N) : laneSet(list.length, N); const order = final ? list : shuffle(R, list);
      const rs = order.map((u, i) => ({ u, lane: lanes[i], d: 0, v: 0, e: 1, steps: [], last: 0, fs: 0, hold: 0, done: false, t: null, place: 0, leg: 0, od: 0, ov: 0, oSteps: [], oLast: 0, auto: false, turnAt: 0, react: null, moved: new Set() }));
      return { id: ++seq, final, rs, tMarks: 0, tSet: 0, tGo: 0, firstFin: 0, att: 0, recall: null };
    }
    function seedLanes(k, N) { const mid = laneSet(Math.min(4, k), N); const rest = laneSet(N, N).filter((l) => !mid.includes(l)); return [...shuffle(R, mid), ...shuffle(R, rest)].slice(0, k); } // 결승: 기록 좋은 4명(팀)은 가운데 주로 추첨
    function begin() { // 출발 절차 시작
      const now = Date.now(); const r = race; r.att++; r.recall = null; r.firstFin = 0;
      for (const x of r.rs) Object.assign(x, { lat: 0, inPack: 0, bump: 0, out: 0, blk: 0, d: 0, v: 0, e: 1, steps: [], last: 0, done: false, t: null, place: 0, leg: 0, od: 0, ov: 0, oSteps: [], oLast: 0, auto: false, turnAt: 0, react: null });
      r.tMarks = now; if (E().cmd === 'set') { r.tSet = now + 3500; r.tGo = r.tSet + 1200 + Math.floor(R() * 1300); } else { r.tSet = 0; r.tGo = now + 4200 + Math.floor(R() * 1000); } // 차렷 뒤 1.2~2.5초(예측 어렵게) · 800m는 제자리에 뒤 총
      G.st = 'marks'; ctx.dirtyAll();
    }
    const fsWindow = (r, now) => (E().cmd === 'set' ? now >= r.tSet : now >= r.tMarks + 2000);
    function falseStart(x, now) {
      x.fs++;
      if (x.fs >= 2) { x.hold = 1; G.msg = `⚠️ ${x.u.label} 두 번째 부정 출발 → 1초 늦게 출발 (게임 규칙)`; return; }
      race.recall = { lane: x.lane, name: x.u.label, at: now }; G.st = 'recall'; G.msg = `🚩 부정 출발: ${x.lane}주로 ${x.u.label} (경고)`; ctx.dirtyAll();
    }
    // 걸음 받기: 지난 1초 안에 CAP 이하만 인정
    // 걸음마다 최소 간격(1/CAP초)을 두고 시간표에 올림 → 몰아서 눌러도 고르게 1초 CAP걸음까지만 · 남는 연타는 버림
    function takeSteps(arr, n, now) { while (arr.length && now - arr[0] > 1000) arr.shift(); let k = 0; const gap = 1000 / CAP; while (k < n) { const t = Math.max(now, (arr[arr.length - 1] ?? -1e9) + gap); if (t > now + 150) break; arr.push(t); k++; } return k; }
    const cadence = (arr, now) => { while (arr.length && now - arr[0] > 1000) arr.shift(); let c = 0; for (const t of arr) if (t <= now) c++; return c; };
    function runnerOf(pid) { if (!race) return null; for (const x of race.rs) { const i = x.u.members.indexOf(pid); if (i >= 0) { if (cfg.ev !== 'relay') return { x, role: 'run' }; if (x.done) return { x, role: 'done' }; if (x.u.members[x.leg] === pid && i === x.leg) return { x, role: 'run' }; const nx = x.leg + 1; if (nx < 4 && x.u.members[nx] === pid && x.d >= ZONES[x.leg][0] - 25) return { x, role: 'out' }; return { x, role: 'wait', i }; } } return null; }
    function finishRace(now, why) {
      const r = race; const D = E().D;
      const fin = r.rs.filter((x) => x.done).sort((a, b) => a.t - b.t); fin.forEach((x, i) => { x.place = i + 1; });
      for (const x of r.rs) if (!x.done) { x.place = 0; }
      const res = { id: r.id, final: r.final, heat: r.final ? 0 : G.hi + 1, ev: cfg.ev, rows: r.rs.map((x) => ({ uid: x.u.id, label: x.u.label, team: x.u.team, members: x.u.members, lane: x.lane, t: x.done ? r2(x.t) : null, place: x.place, react: x.react != null ? r2(x.react) : null, fs: x.fs, d: r1(Math.min(D, x.d)) })), why };
      G.races.push(res);
      if (!prac) { for (const x of r.rs) for (const pid of new Set(x.u.members)) if (x.moved.has(pid)) { const L = (mem.raced[pid] ||= []); if (!L.includes(cfg.ev)) L.push(cfg.ev); } saveMem(ev); }
      race = null; G.st = 'done'; G.msg = ''; ctx.dirtyAll();
    }
    function nextAfterDone() {
      if (G.inFinal || (!G.final && G.hi >= G.heats.length - 1)) return endEvent();
      if (G.hi < G.heats.length - 1) { G.hi++; race = newRace(G.heats[G.hi], false); G.st = 'ready'; ctx.dirtyAll(); return; }
      // 예선 끝 → 결승 진출자: 모든 조 기록을 합쳐 빠른 순서
      const all = G.races.filter((x) => !x.final).flatMap((x) => x.rows).filter((x) => x.t != null).sort((a, b) => a.t - b.t).slice(0, cfg.lanes);
      if (all.length < 2) return endEvent();
      const U = all.map((row) => G.heats.flat().find((u) => u.id === row.uid)).filter(Boolean);
      G.finalists = all.map((x) => ({ label: x.label, team: x.team, t: x.t })); G.inFinal = true; race = newRace(U, true); G.st = 'ready'; ctx.dirtyAll();
    }
    function standingsRows() { // 종목 순위: 결승 순위 먼저, 나머지는 예선 기록 순 (결승이 없으면 예선 기록 순)
      const fin = G.races.find((x) => x.final); const heatRows = G.races.filter((x) => !x.final).flatMap((x) => x.rows.map((r) => ({ ...r, heat: x.heat })));
      const seen = new Set(); const out = [];
      if (fin) for (const r of fin.rows.filter((r) => r.place).sort((a, b) => a.place - b.place)) { out.push({ ...r, fin: 1 }); seen.add(r.uid); }
      const best = new Map(); for (const r of heatRows) { const b = best.get(r.uid); if (!b || (r.t != null && (b.t == null || r.t < b.t))) best.set(r.uid, r); }
      if (fin) for (const r of fin.rows.filter((r) => !r.place)) if (!seen.has(r.uid)) { const h = best.get(r.uid); out.push({ ...(h || r), fin: 1, finDnf: 1 }); seen.add(r.uid); }
      for (const r of [...best.values()].filter((r) => !seen.has(r.uid)).sort((a, b) => (a.t ?? 1e9) - (b.t ?? 1e9))) out.push(r);
      return out;
    }
    function endEvent() {
      if (G.st === 'over') return;
      race = null; G.st = 'over'; const rows = standingsRows();
      G.over = { podium: rows.filter((r) => r.t != null).slice(0, 3).map((r) => ({ label: r.label, team: r.team, t: r.t, fin: r.fin || 0 })) };
      if (!prac && G.races.length) { mem.done[cfg.ev] = 1; saveMem(ev); }
      ctx.dirtyAll();
    }

    // ---------- 사회자 버튼 ----------
    function hostAct(a, v) {
      const now = Date.now(); v = Number(v) || 0;
      if (a === 'snd') { G.sndT = now; G.sndK++; return; } // 대형 화면에서 음향 테스트
      if (G.st === 'setup') {
        if (a === 'ev' && EV_KEYS[v]) cfg.ev = EV_KEYS[v];
        else if (a === 'entry' && v >= 0 && v < ENTRY.length) cfg.entry = v;
        else if (a === 'lanes' && v >= 4 && v <= 9) cfg.lanes = v;
        else if (a === 'final') cfg.final = v ? 1 : 0;
        else if (a === 'prog') mem.prog = v & 15;
        else if (a === 'choose') cfg.choose = v ? 1 : 0;
        else if (a === 'fill') fillChoice();
        else if (a === 'reassign') { mem.assign = {}; }
        else if (a === 'confirm') { G.heats = makeHeats(); if (!G.heats.length || !G.heats[0].length) { G.msg = '출전할 사람이 없어요 (출전 방식을 바꿔 보세요)'; G.heats = []; return; } G.final = cfg.ev !== 'relay' || G.heats.length > 1 ? !!(cfg.final && G.heats.length > 1) : false; G.hi = 0; G.inFinal = false; G.races = []; G.msg = ''; race = newRace(G.heats[0], false); G.st = 'ready'; cfg.choose = 0; }
        if (!prac) saveMem(ev); ctx.dirtyAll(); return;
      }
      if (a === 'go' && (G.st === 'ready' || G.st === 'recall') && race) return begin();
      if (a === 'recall' && ['marks', 'set'].includes(G.st) && race) { race.recall = { lane: 0, name: '', at: now, host: 1 }; G.st = 'recall'; G.msg = '⛔ 사회자가 출발을 멈췄어요 — 다시 출발해요'; ctx.dirtyAll(); return; }
      if (a === 'stop' && ['marks', 'set', 'go'].includes(G.st) && race) { G.st = 'ready'; G.msg = '⏹ 경주를 멈췄어요 — 이 조를 처음부터 다시 해요'; race = newRace(race.rs.map((x) => x.u), race.final); ctx.dirtyAll(); return; }
      if (a === 'end' && G.st === 'go' && race) return finishRace(now, 'host');
      if (a === 'rerun' && G.st === 'done') { const last = G.races.pop(); if (!last) return; const U = last.rows.map((row) => G.heats.flat().find((u) => u.id === row.uid)).filter(Boolean); race = newRace(U, last.final); G.st = 'ready'; G.msg = '🔁 이 조를 다시 해요 (앞 기록은 지웠어요)'; ctx.dirtyAll(); return; }
      if (a === 'next' && G.st === 'done') return nextAfterDone();
      if (a === 'skip' && G.st === 'ready' && race) { if (race.final) return endEvent(); race = null; G.st = 'done'; G.races.push({ id: ++seq, heat: G.hi + 1, final: false, ev: cfg.ev, rows: [], skipped: 1 }); return nextAfterDone(); }
      if (a === 'nofinal' && !G.inFinal && G.st !== 'over') { G.final = false; ctx.dirtyAll(); return; }
      if (a === 'over' && G.st !== 'over' && !['marks', 'set', 'go'].includes(G.st)) return endEvent();
      if (a === 'finish' && G.st === 'over') return ctx.endEarly();
    }

    // ---------- 매 0.1초 ----------
    // 💥 800m 무리 달리기 (브레이크라인 합류 뒤): 앞사람을 뚫고 지나갈 수 없음
    //  · 앞이 막혔는데 내가 더 빠르면 → 바깥 칸이 비었으면 자동으로 바깥으로 빠져 추월(조금 먼 길)
    //  · 바깥 칸에 다른 선수가 있으면 → 몸싸움: 둘 다 잠깐 느려지고 나는 앞사람 뒤에 막힘
    //  · 안쪽이 비면 다시 안쪽으로 (짧은 길)
    const GAP = 1.3, SL = 0.9; // 앞뒤 간격(m) · 옆 칸 폭(m)
    function pack(r, now) {
      const L = r.rs.filter((x) => !x.done && x.d > BREAK + MERGE).sort((a, b) => b.d - a.d);
      const busy = (me, lat, back = GAP, fwd = GAP) => L.some((o) => o !== me && o.inPack && Math.abs(o.lat - lat) < SL * 0.6 && o.d - me.d < fwd && me.d - o.d < back);
      for (const x of L) {
        if (!x.inPack) { x.inPack = 1; x.lat = 0; while (x.lat < SL * 4 && busy(x, x.lat)) x.lat += SL; } // 합류: 비어 있는 가장 안쪽 칸
        const ahead = (o) => o.d > x.d || (o.d === x.d && L.indexOf(o) < L.indexOf(x));
        const a = L.find((o) => o !== x && o.inPack && ahead(o) && o.d - x.d < GAP && Math.abs(o.lat - x.lat) < SL * 0.6); // 바로 앞 같은 칸
        if (a) {
          if (x.v > a.v + 0.15 && now - (x.out || 0) > 700) {
            if (x.lat < SL * 4 - 0.01 && !busy(x, x.lat + SL)) { x.lat += SL; x.out = now; x.v *= 0.97; continue; } // 바깥으로 빠져 추월
            if (now - (x.bump || 0) > 1500) { const s = L.find((o) => o !== x && Math.abs(o.lat - (x.lat + SL)) < SL * 0.6 && Math.abs(o.d - x.d) < GAP); x.bump = now; x.v *= 0.92; if (s) { s.bump = now; s.v *= 0.95; } } // 몸싸움
          }
          x.d = Math.min(x.d, a.d - GAP * 0.8); x.v = Math.min(x.v, a.v + 0.1); x.blk = now; // 뚫고 못 지나감
        } else if (x.lat > 0 && now - (x.out || 0) > 1500 && !busy(x, x.lat - SL, GAP * 1.5, GAP * 1.5)) { x.lat = Math.max(0, x.lat - SL); x.out = now - 1000; } // 안쪽이 비면 들어옴
      }
    }
    function tick(now) {
      if (G.st === 'setup') { let mv = false; for (const w of WU.values()) { const c = cadence(w.steps, now); const vt = 9 * Math.min(1, c / CAD); w.v += (vt - w.v) * (vt > w.v ? 0.13 : 0.2); if (w.v > 0.05) { mv = true; w.d += w.v * 0.1; if (w.d >= 100) { w.d -= 100; w.lap++; } } else w.v = 0; } if (mv && now - (G._w || 0) >= 250) { G._w = now; ctx.dirtyAll(); } return; }
      if (!race) return;
      const r = race; const ev2 = E();
      if (G.st === 'marks' && r.tSet && now >= r.tSet) { G.st = 'set'; ctx.dirtyAll(); }
      if ((G.st === 'marks' || G.st === 'set') && now >= r.tGo) { G.st = 'go'; for (const x of r.rs) x.turnAt = r.tGo; ctx.dirtyAll(); }
      if (G.st !== 'go') return;
      const dt = 0.1; const D = ev2.D;
      for (const x of r.rs) {
        if (x.done) continue;
        const relay = cfg.ev === 'relay';
        // 주자 속도: 최근 1초 걸음 수 → 목표 속도 (7걸음/초에서 최고) · 체력(400·800)
        let c = cadence(x.steps, now);
        if (relay && !x.auto && now - Math.max(x.turnAt, x.last) > 3000) x.auto = true; // 계주: 3초 동안 안 누르면 자동으로 천천히 달림(팀이 멈추지 않게)
        if (relay && x.auto) c = Math.max(c, CAD * 0.5);
        if (x.hold && now < r.tGo + 1000) c = 0;
        const k = Math.min(1, c / CAD);
        if (ev2.energy) { if (k > 0.72) x.e = Math.max(0, x.e - ((k - 0.72) / 0.28) * ev2.energy * dt * 1.6); else if (k < 0.6) x.e = Math.min(1, x.e + 0.05 * dt); }
        const f = ev2.energy ? 0.7 + 0.3 * Math.min(1, x.e / 0.35) : 1;
        const wide = cfg.ev === '800' && x.lat ? 1 - 0.016 * (x.lat / 0.9) : 1; // 바깥으로 돌면 더 먼 길(속도 조금 손해)
        const vt = ev2.vmax * f * k * wide;
        x.v += (vt - x.v) * (vt > x.v ? 1 - Math.exp(-dt / 0.7) : 1 - Math.exp(-dt / 0.45));
        const d0 = x.d; x.d += x.v * dt;
        if (relay && x.leg < 3) {
          const [z0, z1] = ZONES[x.leg];
          // 다음 주자: 구역 시작점에서 출발 · 구역 끝을 넘지 못함(간략: 공식은 구역 밖 교대 = 실격)
          const oc = cadence(x.oSteps, now); const ok = Math.min(1, oc / CAD); const ovt = ev2.vmax * ok;
          if (x.od < z0) x.od = z0;
          x.ov += (ovt - x.ov) * (ovt > x.ov ? 1 - Math.exp(-dt / 0.7) : 1 - Math.exp(-dt / 0.45)); x.od = Math.min(z1, x.od + x.ov * dt); if (x.od >= z1) x.ov = 0;
          if (x.d >= x.od && x.d >= z0) { // 따라잡음 = 배턴 터치 (구역 안)
            x.leg++; x.d = x.od; x.v = x.ov; x.steps = x.oSteps; x.last = x.oLast; x.oSteps = []; x.oLast = 0; x.od = 0; x.ov = 0; x.auto = false; x.turnAt = now; x.pass = now; ctx.dirtyAll();
          }
          if (x.d > z1) x.d = z1; // 안전장치
        }
        if (x.d >= D) { const over = x.v > 0 ? (x.d - D) / x.v : 0; x.t = (now - r.tGo) / 1000 - over; x.d = D; x.done = true; x.v = 0; if (!r.firstFin) r.firstFin = now; void d0; ctx.dirtyAll(); }
      }
      if (cfg.ev === '800') pack(r, now);
      const allDone = r.rs.every((x) => x.done);
      const capMs = (ev2.est * 3 + 20) * 1000;
      if (allDone || (r.firstFin && now - r.firstFin > (cfg.ev === 'relay' ? 15000 : 12000)) || now - r.tGo > capMs) finishRace(now, allDone ? 'all' : 'time');
      else if (now - (G._v || 0) >= 250) { G._v = now; ctx.dirtyAll(); } // 폰에 1초 4번 위치
    }

    function input(pid, m, now) {
      if (!m || typeof m !== 'object') return null;
      if (m.a === 'pick' && G.st === 'setup' && cfg.choose && P.has(pid)) { const k = String(m.v); if (progList().includes(k)) { mem.choice[pid] = k; if (!prac) saveMem(ev); ctx.dirtyAll(); } return null; }
      if (m.a !== 'st') return null;
      const n = Number.isInteger(m.n) ? Math.max(0, Math.min(4, m.n)) : 0; if (!n) return null;
      if (G.st === 'setup') { if (P.has(pid)) takeSteps(wuOf(pid).steps, n, now); return null; } // 준비 운동
      if (!race) return null;
      const who = runnerOf(pid); if (!who) return null; const { x, role } = who;
      if (G.st === 'marks' || G.st === 'set') {
        if (role !== 'run' || (cfg.ev === 'relay' && x.leg > 0)) return null;
        if (fsWindow(race, now) && !x.hold) { falseStart(x, now); return { fs: x.fs }; }
        return { early: 1 }; // 제자리에 직후: 아직 기다려요 (부정 출발 아님)
      }
      if (G.st !== 'go') return null;
      if (role === 'run') { const k = takeSteps(x.steps, n, now); if (k) { x.last = now; x.auto = false; x.moved.add(pid); if (x.react == null && (cfg.ev !== 'relay' || x.leg === 0)) x.react = (now - race.tGo) / 1000; } }
      else if (role === 'out') { const k = takeSteps(x.oSteps, n, now); if (k) { x.oLast = now; x.moved.add(pid); } }
      return null;
    }

    // ---------- 화면에 보낼 것 ----------
    const rsOut = () => (race ? race.rs.map((x) => [x.lane, x.u.label, x.u.team, r1(x.d), r1(x.v), x.place, x.t != null ? r2(x.t) : null, x.fs, cfg.ev === 'relay' ? x.leg : 0, cfg.ev === 'relay' && x.leg < 3 && x.d >= ZONES[x.leg][0] - 25 ? r1(x.od) : 0, r2(x.e), x.auto ? 1 : 0, x.hold ? 1 : 0, cfg.ev === 'relay' ? (P.get(x.u.members[x.leg])?.name || '') : '', r1(x.lat || 0), x.bump && Date.now() - x.bump < 1200 ? 1 : x.out && Date.now() - x.out < 1000 ? 2 : x.blk && Date.now() - x.blk < 600 ? 3 : 0]) : []);
    const liveRank = () => { if (!race) return []; return [...race.rs].sort((a, b) => (a.done && b.done ? a.t - b.t : a.done ? -1 : b.done ? 1 : b.d - a.d)).map((x) => x.lane); };
    const heatTag = () => (G.inFinal ? '결승' : G.heats.length ? `예선 ${G.hi + 1}조 / ${G.heats.length}조` : '');
    const boardTop = () => standingsRows().filter((r) => r.t != null).slice(0, 8).map((r) => [r.label, r.team, r.t, r.fin ? 1 : 0]);
    function common(now) {
      return { g: 'ath', st: G.st, ev: cfg.ev, evName: E().name, D: E().D, cmd: E().cmd, lanes: cfg.lanes, heat: heatTag(), final: G.inFinal ? 1 : 0, T: now, tMarks: race?.tMarks || 0, tSet: race?.tSet || 0, tGo: race && (G.st === 'set' || G.st === 'go' || (E().cmd === 'marks' && G.st === 'marks')) ? race.tGo : 0, att: race?.att || 0, rid: race?.id || 0, rs: rsOut(), rank: liveRank(), msg: G.msg, recall: race?.recall ? { lane: race.recall.lane, name: race.recall.name, host: race.recall.host || 0 } : null, prac: prac ? 1 : 0 };
    }
    function lastRes() { const x = G.races[G.races.length - 1]; return x ? { heat: x.final ? '결승' : `예선 ${x.heat}조`, rows: [...x.rows].sort((a, b) => (a.place || 99) - (b.place || 99)).map((r) => [r.lane, r.label, r.team, r.t, r.place, r.react, r.fs]), skipped: x.skipped || 0 } : null; }
    function myQueue(pid) {
      if (!G.heats.length) return null; const idx = G.heats.findIndex((h) => h.some((u) => u.members.includes(pid)));
      if (idx < 0) return { none: 1 };
      const doneHere = G.races.some((x) => !x.final && x.heat === idx + 1);
      return { heat: idx + 1, ahead: G.inFinal ? 0 : Math.max(0, idx - G.hi), done: doneHere ? 1 : 0, fin: G.finalists ? (G.finalists.some((f) => G.heats.flat().find((u) => u.label === f.label && u.members.includes(pid))) ? 1 : 0) : null };
    }
    return {
      addPlayer(p) { add(p); ctx.dirtyAll(); },
      shift(ms) { if (race) { for (const k of ['tMarks', 'tSet', 'tGo', 'firstFin']) if (race[k]) race[k] += ms; for (const x of race.rs) { x.steps = x.steps.map((t) => t + ms); x.oSteps = x.oSteps.map((t) => t + ms); if (x.last) x.last += ms; if (x.turnAt) x.turnAt += ms; } } },
      hostAct(arg) { hostAct(String(arg?.a || ''), arg?.v); G._h = 0; },
      hostPt() {}, // 사회자 버튼 통로(hostPt 명령)만 씀 · 팀 점수 직접 입력은 없음
      input, tick,
      view(pid, now) {
        const o = common(now); const p = P.get(pid);
        if (!p) return { ...o, spect: 1 };
        const who = runnerOf(pid);
        o.me = who ? { lane: who.x.lane, role: who.role, i: who.i ?? null, leg: who.x.leg, sq: cfg.ev === 'relay' ? who.x.u.label : '', mem: cfg.ev === 'relay' ? who.x.u.members.map((q) => P.get(q)?.name || '') : null, myLeg: cfg.ev === 'relay' ? who.x.u.members.indexOf(pid) : 0 } : null;
        o.q = myQueue(pid);
        if (G.st === 'setup') { o.rs = wuGroup(pid).map(([q, lane]) => { const w = WU.get(q) || { d: 0, v: 0, lap: 0 }; return [lane, P.get(q)?.name || '', P.get(q)?.team ?? 0, r1(w.d), r1(w.v), 0, null, 0, 0, 0, 1, 0, 0, '', w.lap]; }); o.wu = 1; o.me = null; o.wuLane = (wuGroup(pid).find(([q]) => q === pid) || [])[1] || 0; }
        if (G.st === 'setup') { const s = summary(); o.setup = { n: s.n, heats: s.heats, est: s.estSec, inEv: entrants().includes(pid) ? 1 : 0, choose: cfg.choose ? progList() : null, mine: mem.choice[pid] || null }; }
        if (G.st === 'done') o.res = lastRes();
        if (G.st === 'over' || G.st === 'done') o.board = boardTop();
        if (G.st === 'over') { o.over = G.over; const row = standingsRows().findIndex((r) => r.members?.includes(pid)); o.myRank = row >= 0 ? row + 1 : 0; }
        if (G.finalists) o.finalists = G.finalists.map((f) => [f.label, f.team, f.t]);
        o.raced = (mem.raced[pid] || []).length;
        return o;
      },
      screen(now) {
        const o = common(now); o.sndT = G.sndT; o.sndK = G.sndK;
        if (G.st === 'setup') o.setup = { ...summary(), entry: cfg.entry, entryName: ENTRY[cfg.entry], choose: cfg.choose };
        if (G.st === 'done') o.res = lastRes();
        if (G.st === 'done' || G.st === 'over') o.board = boardTop();
        if (G.st === 'over') o.over = G.over;
        if (G.finalists) o.finalists = G.finalists.map((f) => [f.label, f.team, f.t]);
        if (G.st === 'ready' && race) o.lineup = race.rs.map((x) => [x.lane, x.u.label, x.u.team, cfg.ev === 'relay' ? x.u.members.map((q) => P.get(q)?.name || '') : null]);
        // 사회자 패드용 (1초에 한 번만 무거운 표)
        if (!G._h || now - G._h > 900 || G._hst !== G.st) { G._h = now; G._hst = G.st; o.host = hostInfo(); }
        o.team = teamPts();
        return o;
      },
      finish() { return result(); },
    };
    function hostInfo() {
      const ids = [...P.keys()]; const s = summary();
      const ppl = ids.map((pid) => { const p = P.get(pid); return [p.name, p.team, (mem.raced[pid] || []).join(','), online(pid) ? 1 : 0]; });
      const choice = {}; if (cfg.entry === 3 || cfg.choose) for (const k of progList()) choice[k] = ids.filter((pid) => mem.choice[pid] === k && online(pid)).length;
      const assign = {}; if (cfg.entry === 2) { autoAssign(ids.filter(online)); for (const k of progList()) assign[k] = ids.filter((pid) => mem.assign[pid] === k && online(pid)).length; }
      return { cfg: { ...cfg, prog: mem.prog }, sum: s, entryNames: ENTRY, ppl, choice, assign, unchosen: (cfg.entry === 3 || cfg.choose) ? ids.filter((pid) => online(pid) && !progList().includes(mem.choice[pid])).length : 0, heats: G.heats.map((h, i) => ({ no: i + 1, n: h.length, names: h.map((u) => u.label), done: G.races.some((x) => !x.final && x.heat === i + 1) ? 1 : 0 })), hi: G.hi, inFinal: G.inFinal ? 1 : 0, hasFinal: G.final ? 1 : 0, done: { ...mem.done }, raceEst: raceEst() };
    }
    function teamPts() {
      const pts = {}; const cnt = {}; const mult = (x) => (x.final ? 2 : 1) * (cfg.ev === 'relay' ? 2 : 1);
      const seen = {}; for (const x of G.races) for (const r of x.rows) { if (!seen[r.uid]) { seen[r.uid] = 1; cnt[r.team] = (cnt[r.team] || 0) + 1; } if (r.place) pts[r.team] = (pts[r.team] || 0) + (x.rows.length - r.place + 1) * mult(x); }
      const out = {}; for (const t of Object.keys(cnt)) out[t] = r1((pts[t] || 0) / cnt[t]); return out;
    }
    function result() {
      const players = {}; const rows = standingsRows(); const n = rows.length;
      rows.forEach((r, i) => { const norm = r.t != null ? Math.round((100 * (n - i)) / n) : 0; const show = r.t != null ? `${r.t.toFixed(2)}초 (게임 기록)${r.fin && !r.finDnf ? ` · 결승 ${r.place}위` : ''}` : '기록 없음'; for (const pid of new Set(r.members || [])) if (P.has(pid)) players[pid] = { raw: r.t ?? 0, norm, show: `${E().name} ${show}` }; });
      const tp = teamPts(); const teams = {}; const teamLabel = {};
      for (const [t, v] of Object.entries(tp)) { teams[t] = v; teamLabel[t] = `${E().name} ${v}점(1인 평균)`; }
      if (!Object.keys(teams).length) return { players, noPoints: true };
      return { players, teams, teamLabel };
    }
  },
};

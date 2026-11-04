// 스크린 체육 모드: 폰 없이 대형 화면을 보고 몸으로! 진행자가 팀 점수를 줌 (참가자 폰 없어도 진행)
import { rng, shuffle } from './gen.js';
import { clamp, round1, intIn } from './common.js';

export const MOVES = [
  ['손 머리 위로!', 'up'], ['양팔 옆으로 쫙!', 'wide'], ['한 발로 서기!', 'leg'], ['앉았다 일어나기!', 'squat'], ['제자리 뛰기!', 'jog'],
  ['팔 빙글빙글!', 'spin'], ['무릎 터치!', 'knee'], ['별 모양 점프!', 'star'], ['박수 세 번!', 'clap'], ['몸 흔들흔들!', 'wiggle'],
];
const MISSIONS = [
  '팀원 모두 손잡고 동그라미 만들기', '키 순서대로 한 줄 서기', '팀 이름 크게 세 번 외치기', '모두 한 발로 5초 버티기', '팀 구호 만들어 외치기',
  '생일 빠른 순서대로 서기', '모두 앉았다 일어나기 10번', '팀원끼리 하이파이브 한 바퀴', '가장 긴 기차 만들기', '팀 전원 박수 맞추기 10번',
];
function clock() { const c = { T: 0, last: null }; c.dt = (now) => { const d = c.last == null ? 0.1 : clamp((now - c.last) / 1000, 0, 0.25); c.last = now; c.T += d; return d; }; c.shift = (ms) => { if (c.last != null) c.last += ms; }; return c; }

function peGame(o) {
  return {
    id: o.id, no: o.no, name: o.name, emoji: o.emoji, dur: o.dur, rule: o.rule, howto: o.howto, hostScore: true, lateJoin: true, pe: true,
    create(ctx) {
      const r = rng(ctx.seed); const C = clock(); const lv = ctx.settings.lv ?? 2;
      const pts = Object.fromEntries(ctx.teams.map((t) => [t, 0]));
      const P = new Map(ctx.players.map((p) => [p.id, p]));
      const st = o.init(r, lv); let flash = null;
      return {
        addPlayer(p) { P.set(p.id, p); }, shift: C.shift,
        hostPt(team, d) { if (pts[team] == null || ![-1, 1, 2, 3].includes(d)) return; pts[team] = Math.max(0, pts[team] + d); flash = { team, d, at: C.T }; ctx.dirtyAll(); },
        input() {},
        tick(now) { C.dt(now); o.tick(st, C.T, r, lv, ctx); if (now - (this._v || 0) > 1000) { this._v = now; ctx.dirtyAll(); } },
        view(pid) { const p = P.get(pid); return { g: 'pe', kind: o.id, title: o.name, cur: o.label(st, C.T), pts: p ? pts[p.team] : 0 }; },
        screen() { return { kind: o.id, T: round1(C.T), ...o.show(st, C.T), pts, flash: flash && C.T - flash.at < 1.5 ? [flash.team, flash.d] : null }; },
        finish() {
          const mx = Math.max(1, ...Object.values(pts)); const players = {};
          for (const p of P.values()) players[p.id] = { raw: pts[p.team] || 0, norm: round1(((pts[p.team] || 0) / mx) * 100), show: `팀 ${pts[p.team] || 0}점` };
          return { players, teams: { ...pts }, teamLabel: Object.fromEntries(Object.entries(pts).map(([t, v]) => [t, `진행자 판정 ${v}점`])) };
        },
      };
    },
  };
}

// 댄스 얼음땡: 음악에 맞춰 동작 따라 하다가 "얼음!" 하면 멈추기
export const pe_freeze = peGame({
  id: 'pe_freeze', no: 31, name: '댄스 얼음땡', emoji: '🕺',
  dur: { kid: 60, elem: 70, adult: 70 },
  rule: { all: '화면 속 동작을 음악에 맞춰 따라 하다가 "얼음!" 하면 그대로 멈춰요. 잘 멈춘 팀에 진행자가 점수를 줘요', baby: '음악에 맞춰 춤추다가 얼음! 하면 멈춰요' },
  howto: '폰 없이 몸으로 · 진행자가 팀 점수 버튼으로 판정',
  init: (r) => ({ ph: 'dance', end: 4, move: 0, n: 0 }),
  tick(st, T, r, lv) {
    if (T < st.end) return;
    if (st.ph === 'dance') { st.ph = 'freeze'; st.end = T + 3 + r() * 2; }
    else { st.ph = 'dance'; st.move = Math.floor(r() * MOVES.length); st.n++; st.end = T + 4 + r() * (lv <= 1 ? 4 : 3); }
  },
  label: (st) => (st.ph === 'freeze' ? '얼음! 그대로 멈춰요' : MOVES[st.move][0]),
  show: (st, T) => ({ ph: st.ph, move: st.move, left: round1(st.end - T), n: st.n }),
});

// 가라사대: "가라사대"가 붙었을 때만 따라 하기
export const pe_simon = peGame({
  id: 'pe_simon', no: 32, name: '가라사대', emoji: '🗣️',
  dur: { kid: 60, elem: 70, adult: 70 },
  rule: { all: '"가라사대"라고 말할 때만 동작을 따라 해요. 그냥 말하면 따라 하면 안 돼요!', baby: '화면 속 동작을 따라 해요' },
  howto: '폰 없이 몸으로 · 속지 않은 팀에 진행자가 점수',
  init: () => ({ i: -1, end: 2, cmd: null }),
  tick(st, T, r, lv) {
    if (T < st.end) return;
    const trick = lv >= 2 && r() < 0.35;
    st.i++; st.cmd = { move: Math.floor(r() * MOVES.length), say: !trick }; st.end = T + (lv <= 1 ? 6 : 4.5);
  },
  label: (st) => (st.cmd ? `${st.cmd.say ? '가라사대 ' : ''}${MOVES[st.cmd.move][0]}` : '준비!'),
  show: (st, T) => ({ i: st.i, cmd: st.cmd, left: round1(st.end - T) }),
});

// 팀 미션: 진행자가 먼저 끝낸 팀 순서대로 점수
export const pe_mission = peGame({
  id: 'pe_mission', no: 33, name: '팀 미션 대결', emoji: '🚩',
  dur: { kid: 90, elem: 100, adult: 100 },
  rule: { all: '화면에 나오는 미션을 팀이 함께 해내요! 먼저 끝낸 팀부터 진행자가 점수를 줘요', baby: '선생님과 같이 미션을 해 봐요' },
  howto: '폰 없이 몸으로 · 1등 3점, 2등 2점, 나머지 1점 (진행자 버튼)',
  init: (r) => ({ list: shuffle(r, MISSIONS), i: -1, end: 1.5 }),
  tick(st, T, r, lv) { if (T >= st.end) { st.i = (st.i + 1) % st.list.length; st.end = T + (lv <= 1 ? 25 : 20); } },
  label: (st) => (st.i >= 0 ? st.list[st.i] : '첫 미션 준비!'),
  show: (st, T) => ({ i: st.i, text: st.i >= 0 ? st.list[st.i] : '첫 미션 준비!', left: round1(st.end - T) }),
});

// ⏱ 행사 전체 시간 계산 · 목표 시간 맞춤 추천 (사회자 화면용, 서버 없이 계산만)
// 실제 설정값: 게임 시간·반복 판 수·설명 화면 시간(introSec/미리보기)·카운트다운 3초·결과 발표(resultSec)
// 추정값(사회자가 고칠 수 있음): 사회자 설명·참가자 준비·게임 사이 전환·시작 인사·최종 시상·여유(%)
export const EST_DEF = { explain: 40, ready: 15, trans: 20, opening: 180, ceremony: 240, buffer: 0 };
export const EST_LABEL = { explain: '사회자 게임 설명 (게임마다)', ready: '참가자 준비 (게임마다·반복 판마다)', trans: '게임 사이 전환 (게임마다)', opening: '시작 인사', ceremony: '최종 시상', buffer: '여유 시간 (%)' };
export const TARGETS = [20, 30, 40, 60, 90, 120];
const CD = 3; // 카운트다운(초) — 엔진 고정값
const AGE = { baby: 'kid', mid: 'adult', high: 'adult', mixed: 'elem' };

export function estOf(timing) { const t = timing || {}; const o = {}; for (const k of Object.keys(EST_DEF)) o[k] = Number.isFinite(t[k]) ? t[k] : EST_DEF[k]; return o; }
// 한 판 플레이 시간(초): 사회자가 정한 시간 → 없으면 게임 기본 시간(연령별). 라운드제 게임은 기본 시간이 '보통 걸리는 시간' 추정
export function playSec(p, g, mode) { if (!g) return 0; if (!g.untimed && Number.isFinite(p.dur)) return p.dur; const k = AGE[mode] || mode; return g.dur?.[k] ?? g.dur?.elem ?? 60; }
export function defSec(g, mode) { const k = AGE[mode] || mode; return g?.dur?.[k] ?? g?.dur?.elem ?? 60; }

// 게임 한 줄의 시간 내역
export function rowOf(p, g, ctx) {
  const est = ctx.est; const r = Math.max(1, p.rep || 1);
  const screen = Math.max(ctx.introSec ?? 10, ctx.preview !== false ? ctx.previewSec || 6 : 0);
  const play = playSec(p, g, ctx.mode) * r;
  const explain = Math.max(screen, est.explain); // 설명 화면이 떠 있는 동안 사회자가 설명 → 둘 중 긴 쪽
  const ready = est.ready * r;
  const cd = CD * r;
  const results = (ctx.resultSec ?? 12) * r;
  const trans = est.trans;
  return { game: p.game, name: g?.name || p.game, emoji: g?.emoji || '', rep: r, untimed: !!g?.untimed, play, explain, ready, cd, results, trans, total: play + explain + ready + cd + results + trans };
}

// 전체 계획: rows(게임별) + parts(항목별 합) + total(여유 포함)
export function plan(pl, ctx) {
  const rows = pl.map((p) => rowOf(p, ctx.games[p.game], ctx));
  const parts = { play: 0, explain: 0, ready: 0, cd: 0, results: 0, trans: 0 };
  for (const r of rows) for (const k of Object.keys(parts)) parts[k] += r[k];
  if (rows.length) parts.trans -= ctx.est.trans; // 마지막 게임 뒤에는 전환 대신 시상
  parts.opening = rows.length ? ctx.est.opening : 0; parts.ceremony = rows.length ? ctx.est.ceremony : 0;
  const sub = Object.values(parts).reduce((a, b) => a + b, 0);
  parts.buffer = Math.round((sub * (ctx.est.buffer || 0)) / 100);
  return { rows, parts, total: sub + parts.buffer, games: rows.length };
}

// 시간 글자: "약 1시간 10분" / "약 45분" / "40초"
export function fmt(sec, approx = true) {
  sec = Math.round(Math.abs(sec)); if (sec < 60) return `${sec}초`;
  const m = Math.round(sec / 60); const hh = Math.floor(m / 60), mm = m % 60;
  return `${approx ? '약 ' : ''}${hh ? `${hh}시간${mm ? ` ${mm}분` : ''}` : `${mm}분`}`;
}
export const clock = (ms) => { const d = new Date(ms); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };

// 목표 시간에 맞추기: 바꿀 수 있는 게임(아직 안 한 게임, from 이후)만 손댐. 기존 목록은 바꾸지 않고 새 목록을 돌려줌
// 넘치면: ① 반복 판 수 줄이기 → ② 진행 시간 25% 줄이기(최소 20초) → ③ 게임 빼기
// 남으면: ① 게임 넣기 → ② 반복 판 수 늘리기
export function fit(pl, ctx, targetSec, opt = {}) {
  const from = opt.from || 0; const pool = opt.pool || [];
  const tol = Math.max(60, Math.round(targetSec * 0.03)); // 이 정도 차이는 '딱 맞음'
  const total = (x) => plan(x, ctx).total;
  const cur = total(pl); const diff = cur - targetSec;
  const out = { cur, target: targetSec, diff, state: Math.abs(diff) <= tol ? 'ok' : diff > 0 ? 'over' : 'under', ideas: [], rec: null };
  if (out.state === 'ok') return out;
  const G = (p) => ctx.games[p.game];
  const editable = (i) => i >= from;
  if (out.state === 'over') {
    // 따로 고를 수 있는 제안
    const repIdx = pl.map((p, i) => i).filter((i) => editable(i) && (pl[i].rep || 1) > 1);
    if (repIdx.length) { const nx = pl.map((p, i) => (repIdx.includes(i) ? { ...p, rep: undefined } : p)); out.ideas.push({ kind: 'rep', text: `반복 게임 ${repIdx.length}개를 1판씩으로 줄이기`, save: cur - total(nx), pl: nx }); }
    const shortIdx = pl.map((p, i) => i).filter((i) => editable(i) && !G(pl[i])?.untimed && playSec(pl[i], G(pl[i]), ctx.mode) > 25);
    if (shortIdx.length) { const nx = pl.map((p, i) => (shortIdx.includes(i) ? { ...p, dur: Math.max(20, Math.round(playSec(p, G(p), ctx.mode) * 0.75)) } : p)); out.ideas.push({ kind: 'short', text: `게임 ${shortIdx.length}개 진행 시간을 25%씩 줄이기`, save: cur - total(nx), pl: nx }); }
    const rows = plan(pl, ctx).rows;
    const cand = rows.map((r, i) => ({ i, r })).filter((x) => editable(x.i)).sort((a, b) => b.r.total - a.r.total).slice(0, 3);
    for (const { i, r } of cand) if (pl.length > 1) out.ideas.push({ kind: 'drop', text: `'${r.emoji} ${r.name}' 빼기`, save: r.total, pl: pl.filter((_, j) => j !== i) });
    // 추천안: 위 순서대로 목표에 닿을 때까지
    let x = pl.map((p) => ({ ...p })); const steps = [];
    for (let i = from; i < x.length && total(x) > targetSec + tol; i++) if ((x[i].rep || 1) > 1) { steps.push(`${G(x[i])?.name} 반복 ${x[i].rep}판 → 1판`); delete x[i].rep; }
    const order = x.map((p, i) => i).filter((i) => editable(i) && !G(x[i])?.untimed).sort((a, b) => playSec(x[b], G(x[b]), ctx.mode) - playSec(x[a], G(x[a]), ctx.mode));
    for (const i of order) { if (total(x) <= targetSec + tol) break; const before = playSec(x[i], G(x[i]), ctx.mode); const nd = Math.max(20, Math.round(before * 0.75)); if (nd < before) { x[i].dur = nd; steps.push(`${G(x[i])?.name} ${before}초 → ${nd}초`); } }
    while (total(x) > targetSec + tol && x.length > 1) {
      const need = total(x) - targetSec; const rs = plan(x, ctx).rows.map((r, i) => ({ i, r })).filter((o) => editable(o.i));
      if (!rs.length) break;
      // 빼면 딱 맞는 것 중 가장 짧은 게임, 없으면 가장 긴 게임
      const fitOne = rs.filter((o) => o.r.total >= need).sort((a, b) => a.r.total - b.r.total)[0] || rs.sort((a, b) => b.r.total - a.r.total)[0];
      steps.push(`'${fitOne.r.name}' 빼기`); x = x.filter((_, j) => j !== fitOne.i);
    }
    out.rec = { pl: x, steps, total: total(x) };
  } else {
    const slack = -diff;
    const have = new Set(pl.map((p) => p.game));
    // 줄여 두었던 게임 시간을 기본으로 되돌리기 (먼저 제안)
    const backIdx = pl.map((p, i) => i).filter((i) => editable(i) && !G(pl[i])?.untimed && Number.isFinite(pl[i].dur) && pl[i].dur < defSec(G(pl[i]), ctx.mode));
    if (backIdx.length) { const nx = pl.map((p, i) => { if (!backIdx.includes(i)) return p; const q = { ...p }; delete q.dur; return q; }); out.ideas.push({ kind: 'restore', text: `줄여 둔 게임 ${backIdx.length}개 시간을 기본으로 되돌리기`, save: cur - total(nx), pl: nx }); }
    const adds = pool.filter((g) => !have.has(g.id)).map((g) => ({ g, sec: rowOf({ game: g.id, weight: 1 }, g, ctx).total })).filter((o) => o.sec <= slack + tol).sort((a, b) => b.sec - a.sec);
    for (const o of adds.slice(0, 3)) out.ideas.push({ kind: 'add', text: `'${o.g.emoji} ${o.g.name}' 넣기`, save: -o.sec, pl: [...pl, { game: o.g.id, weight: 1 }] });
    const repIdx = pl.map((p, i) => i).filter((i) => editable(i) && (pl[i].rep || 1) < 2 && !G(pl[i])?.untimed);
    if (repIdx.length) { const best = repIdx.map((i) => ({ i, add: rowOf({ ...pl[i], rep: 2 }, G(pl[i]), ctx).total - rowOf(pl[i], G(pl[i]), ctx).total })).filter((o) => o.add <= slack + tol).sort((a, b) => b.add - a.add)[0];
      if (best) out.ideas.push({ kind: 'rep', text: `'${G(pl[best.i]).name}' 2판으로 늘리기`, save: -best.add, pl: pl.map((p, j) => (j === best.i ? { ...p, rep: 2 } : p)) }); }
    let x = pl.map((p) => ({ ...p })); const steps = []; const used = new Set(have);
    for (const i of backIdx) { const q = { ...x[i] }; delete q.dur; const nx = x.map((p, j) => (j === i ? q : p)); if (total(nx) <= targetSec + tol) { steps.push(`${G(x[i])?.name} ${x[i].dur}초 → 기본 ${defSec(G(x[i]), ctx.mode)}초`); x = nx; } }
    for (const o of adds) { if (targetSec - total(x) <= tol) break; if (used.has(o.g.id)) continue; const nx = [...x, { game: o.g.id, weight: 1 }]; if (total(nx) <= targetSec + tol) { x = nx; used.add(o.g.id); steps.push(`'${o.g.name}' 넣기`); } }
    for (let i = from; i < x.length && targetSec - total(x) > tol; i++) { if ((x[i].rep || 1) >= 2 || G(x[i])?.untimed) continue; const nx = x.map((p, j) => (j === i ? { ...p, rep: 2 } : p)); if (total(nx) <= targetSec + tol) { x = nx; steps.push(`${G(x[i])?.name} 2판`); } }
    out.rec = steps.length ? { pl: x, steps, total: total(x) } : null;
  }
  out.ideas = out.ideas.filter((o) => Math.abs(o.save) >= 1);
  return out;
}

// 행사 진행 중: 남은 시간 추정 (지금 게임의 남은 부분 + 남은 게임 + 시상)
export function remainSec(S, ctx, now) {
  const pl = S.playlist; const idx = S.idx; const ph = S.phase;
  if (['ceremony', 'ended'].includes(ph)) return ph === 'ended' ? 0 : ctx.est.ceremony / 2;
  let sec = 0;
  const cur = pl[idx];
  if (cur && ['intro', 'countdown', 'playing'].includes(ph)) {
    const r = rowOf(cur, ctx.games[cur.game], ctx); const per = playSec(cur, ctx.games[cur.game], ctx.mode); const left = Math.max(0, r.rep - (S.rep || 1)); // 이번 판 뒤에 남은 판
    if (ph === 'intro') sec += Math.max(0, r.explain - (now - (S.phaseAt || now)) / 1000) + ctx.est.ready + CD + per + (ctx.resultSec ?? 12);
    else if (ph === 'countdown') sec += CD + per + (ctx.resultSec ?? 12);
    else sec += Math.max(0, ((S.run?.endAt || now) - now) / 1000) + (ctx.resultSec ?? 12);
    sec += left * (ctx.est.ready + CD + per + (ctx.resultSec ?? 12)) + ctx.est.trans;
    for (const p of pl.slice(idx + 1)) sec += rowOf(p, ctx.games[p.game], ctx).total;
  } else {
    // 대기·결과: idx는 이미 다음 게임(또는 같은 게임 다음 판)을 가리킴
    if (ph === 'results') sec += Math.max(0, (ctx.resultSec ?? 12) - (now - (S.phaseAt || now)) / 1000);
    const midRep = cur && (S.rep || 1) > 1;
    if (midRep) { const per = playSec(cur, ctx.games[cur.game], ctx.mode); sec += (cur.rep - S.rep + 1) * (ctx.est.ready + CD + per + (ctx.resultSec ?? 12)) + ctx.est.trans; }
    for (const p of pl.slice(idx + (midRep ? 1 : 0))) sec += rowOf(p, ctx.games[p.game], ctx).total;
  }
  if (idx < pl.length || ['intro', 'countdown', 'playing', 'results'].includes(ph)) sec += ctx.est.ceremony;
  return Math.max(0, sec);
}

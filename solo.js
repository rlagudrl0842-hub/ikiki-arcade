// 🎮 혼자 테스트하기 (나 = 홍팀 vs 컴퓨터 = 청팀) · 👀 게임 미리보기 (컴퓨터 vs 컴퓨터)
// 실제 대형 화면(screen.html)·실제 참가자 화면(play.html)을 그대로 띄워 실제 게임 엔진·타이머·음악·점수로 진행
// 테스트용 행사라 실제 행사 목록·리그·기록과 섞이지 않음. 끝내면 테스트 행사를 지움
import { $, h, Live, api, store } from './client.js';
import { LEVELS } from './ai.js';

const P = new URLSearchParams(location.search);
const eid = P.get('e'); const code = P.get('c'); const mode = P.get('mode') === 'watch' ? 'watch' : 'vs'; let lv = LEVELS[P.get('lv')] ? P.get('lv') : 'normal';
const back = P.get('back') || '/admin.html';
const token = store('ikiki:admin');
const app = $('#app');
let S = null; let live = null; let mute = false; let GAMES = []; api('/api/games').then((r) => { GAMES = r.games; }).catch(() => {});
const A = (path, body) => api(path, body, token);
const cmd = async (op, arg) => { try { await A(`/api/events/${eid}/command`, { op, arg, seq: S?.seq }); } catch (e) { toast(e.message); } };
function toast(msg) { const t = h('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), 2400); }

if (!eid || !code || !token) { app.append(h('div', { class: 'center' }, h('h2', {}, '사회자 화면에서 [🎮 혼자 테스트하기]로 열어 주세요'), h('a', { class: 'btn', href: '/admin.html' }, '사회자 화면으로'))); }
else build();

function frame(src, cls, title) { return h('iframe', { class: cls, src, title, allow: 'autoplay; fullscreen' }); }
function build() {
  const red = mode === 'watch' ? `/play.html?e=${code}&ai=${lv}&team=1&join=${encodeURIComponent('컴퓨터 홍')}` : `/play.html?e=${code}&embed=1&team=1&join=${encodeURIComponent('나')}`;
  const blue = `/play.html?e=${code}&ai=${lv}&team=2&join=${encodeURIComponent(mode === 'watch' ? '컴퓨터 청' : '컴퓨터')}`;
  const head = h('header', { class: 'sh' },
    h('div', { class: 'vs' }, h('span', { class: 'tr' }, '🔴 홍팀', h('small', {}, mode === 'watch' ? ' 컴퓨터' : ' 나')), h('b', { class: 'sr' }, '0'), h('i', {}, ':'), h('b', { class: 'sb' }, '0'), h('span', { class: 'tb' }, h('small', {}, '컴퓨터 '), '청팀 🔵')),
    h('div', { class: 'gi' }, h('span', { class: 'gn' }, '대기 중'), h('span', { class: 'gt' }), h('span', { class: 'glive' })),
    h('span', { class: 'chip lvchip' }, LEVELS[lv].label), h('span', { class: 'chip test' }, mode === 'watch' ? '👀 미리보기 · 기록 안 남음' : '🧪 테스트 · 실제 행사 점수와 따로'));
  const lvSel = h('select', { class: 'inp sm', title: 'AI 난이도' }, ...Object.entries(LEVELS).map(([k, x]) => h('option', { value: k, selected: k === lv }, x.label)));
  lvSel.onchange = () => { lv = lvSel.value; $('.lvchip').textContent = LEVELS[lv].label; for (const f of document.querySelectorAll('iframe.aif')) { const u = new URL(f.src); u.searchParams.set('ai', lv); f.src = u.toString(); } toast(`컴퓨터 난이도: ${LEVELS[lv].label}`); };
  const ctrl = h('nav', { class: 'sc' },
    h('button', { class: 'btn green big go' }, '▶ 게임 시작'),
    h('button', { class: 'btn ghost pz', onclick: () => cmd(S?.paused ? 'resume' : 'pause') }, '⏸ 일시정지'),
    h('button', { class: 'btn ghost', onclick: () => restart() }, '↻ 다시 시작'),
    mode === 'watch' ? h('button', { class: 'btn ghost', onclick: () => vsAI() }, '🤖 AI와 대결') : null,
    h('label', { class: 'lvl' }, '🤖', lvSel),
    h('button', { class: 'btn ghost mu', onclick: () => toggleMute() }, '🔊 음악 켜짐'),
    h('button', { class: 'btn ghost danger', onclick: () => quit() }, '✕ 종료'));
  const screen = frame(`/screen.html?e=${code}&embed=1`, 'scf', '대형 화면');
  const meBox = h('div', { class: `pbox me ${mode === 'watch' ? 'ai' : ''}` }, h('div', { class: 'pl' }, mode === 'watch' ? `🤖 홍팀 컴퓨터 폰` : '🙋 내 폰 (홍팀) — 여기서 직접 조작'), frame(red, `pf ${mode === 'watch' ? 'aif' : ''}`, '홍팀 폰'));
  const pad = h('div', { class: 'pbox pepad hidden' }, h('div', { class: 'pl' }, mode === 'watch' ? '🤖 컴퓨터 사회자 판정 (시뮬레이션)' : '🎯 우리 팀(홍팀) 판정 — 내가 직접 입력'), h('div', { class: 'padb' }), h('p', { class: 'muted small aino' }, '컴퓨터(청팀)는 학생 움직임을 감지하지 않아요. 난이도별 확률로 성공·실패를 정하는 시뮬레이션이에요.'));
  const aiBox = h('div', { class: 'pbox ai' }, h('div', { class: 'pl' }, `🤖 청팀 컴퓨터 폰`), frame(blue, 'pf aif', '청팀 컴퓨터 폰'));
  const over = h('div', { class: 'sover' }, h('div', { class: 'svs' }, h('b', { class: 'r' }, '🔴 홍팀'), h('span', {}, 'VS'), h('b', { class: 'b' }, '청팀 🔵')), h('div', { class: 'muted' }, mode === 'watch' ? '컴퓨터끼리 실제 규칙으로 대결해요' : `나 vs 컴퓨터 (${LEVELS[lv].label}) · 실제 게임 규칙·점수 그대로`), h('div', { class: 'row' }, h('button', { class: 'btn green big', onclick: () => { over.remove(); unlock(); start(); } }, '▶ 시작'), h('button', { class: 'btn ghost', onclick: () => quit() }, '✕ 닫기')));
  app.append(head, h('main', { class: `sm ${mode}` }, h('div', { class: 'stage' }, screen, h('div', { class: 'airow' }, mode === 'watch' ? meBox : null, aiBox)), mode === 'watch' ? pad : h('div', { class: 'side' }, meBox, pad)), ctrl, over);
  $('.go').onclick = () => next();
  live = new Live({ t: 'hello', role: 'screen', code }, onMsg);
  setInterval(tick, 250);
}
function unlock() { for (const f of document.querySelectorAll('iframe')) try { f.contentWindow.postMessage('unlock', location.origin); } catch { /* */ } }
document.addEventListener('pointerdown', unlock, { once: true });
function start() { if (S?.phase === 'lobby') cmd('intro'); }
function next() { const ph = S?.phase; if (ph === 'lobby' && S.idx >= S.total) return cmd('ceremony'); cmd('next'); }
async function restart() {
  // 지금 게임을 처음부터 (테스트라 방금 판 점수는 지우고 다시)
  if (['playing', 'countdown', 'results', 'lobby'].includes(S?.phase)) { try { await A(`/api/events/${eid}/command`, { op: 'replay', arg: { keep: false }, seq: S.seq }); } catch (e) { toast(e.message); } }
}
async function toggleMute() { mute = !mute; try { await A(`/api/events/${eid}/update`, { settings: { bgmVol: mute ? 0 : 70, sfx: !mute } }); } catch (e) { toast(e.message); } $('.mu').textContent = mute ? '🔇 음악 꺼짐' : '🔊 음악 켜짐'; }
async function vsAI() {
  // 미리보기 → 같은 게임으로 바로 AI와 대결 (새 테스트 행사)
  const games = S.playlist.map((p) => p.game);
  try { const r = await A('/api/solo', { games, mode: S.settings.mode }); await A(`/api/events/${eid}/delete`, {}); location.replace(`/solo.html?e=${r.id}&c=${r.code}&mode=vs&lv=${lv}&back=${encodeURIComponent(back)}`); } catch (e) { toast(e.message); }
}
async function quit() {
  if (S && ['playing', 'countdown'].includes(S.phase) && !confirm('테스트를 끝낼까요? (실제 행사 기록에는 남지 않아요)')) return;
  try { await A(`/api/events/${eid}/delete`, {}); } catch { /* 이미 지움 */ }
  if (window.opener && !window.opener.closed) window.close();
  location.href = back;
}
function onMsg(m) { if (m.t === 'state') { S = m; paint(); peMode(); } if (m.t === 'live' && S?.phase === 'playing') { live.lastLive = m; liveLine(m); if (m.s?.g === 'pe2') { peUI = m.s; padPaint(); aiTick(); } } }
// ---------------- 폰 없는 체육: 내 팀은 직접 판정 입력, 컴퓨터 팀은 난이도별 확률 시뮬레이션
let peUI = null; let padKey = ''; const aiT = {};
const isPe = () => !!GAMES.find((g) => g.id === S?.playlist?.[S.idx]?.game && g.pe2) || (S?.phase === 'playing' && peUI && S.run?.game && GAMES.find((g) => g.id === S.run.game)?.pe2);
function peMode() { const on = !!(S && (['intro', 'countdown', 'playing'].includes(S.phase)) && GAMES.find((g) => g.id === (S.run?.game || S.playlist?.[S.idx]?.game))?.pe2); document.querySelector('.pepad')?.classList.toggle('hidden', !on); document.querySelector('.pbox.me')?.classList.toggle('hidden', on && mode !== 'watch'); document.querySelector('.airow')?.classList.toggle('hidden', on); if (!on) { peUI = null; padKey = ''; } }
const send = (a, team, v) => A(`/api/events/${eid}/command`, { op: 'hostPt', arg: { a, team, v } }).catch((e) => toast(e.message));
function padPaint() {
  const box = document.querySelector('.pepad .padb'); if (!box || !peUI) return; const ui = peUI.ui; const key = JSON.stringify(ui) + mode; if (key === padKey) return; padKey = key; box.innerHTML = '';
  const t1 = S.teams[0]; const myTeams = mode === 'watch' ? [] : [t1];
  box.append(h('div', { class: 'pnote' }, ui.note || ''));
  for (const t of myTeams) {
    if (ui.only?.length && !ui.only.includes(t.id)) { box.append(h('div', { class: 'muted small' }, '지금은 우리 팀 차례가 아니에요')); continue; }
    const once = ui.once?.[t.id]; const row = h('div', { class: 'prow' });
    if (ui.pick) ui.pick.opts.forEach((o, i) => row.append(h('button', { class: `btn ${ui.pick.cur?.[t.id] === i ? 'yellow' : 'ghost'}`, onclick: () => send('pick', t.id, i) }, o)));
    if (ui.team) for (const b of ui.team) row.append(h('button', { class: `btn ${b[3] === 'green' ? 'green' : b[3] === 'red' ? 'red' : 'ghost'}`, disabled: !!once && ['ok', 'half', 'fail', 'first', 'rank'].includes(b[1]), onclick: () => send(b[1], t.id, b[2]) }, b[0]));
    box.append(row); if (once) box.append(h('div', { class: 'muted small' }, '✓ 입력됨'));
  }
  if (ui.glob?.length && mode !== 'watch') box.append(h('div', { class: 'prow glob' }, ...ui.glob.map((b) => h('button', { class: `btn ${b[3] === 'yellow' ? 'yellow' : 'ghost'}`, onclick: () => send(b[1], 0, b[2]) }, b[0]))));
}
function skill() { return LEVELS[lv].skill ?? (0.3 + Math.random() * 0.65); }
function aiTick() {
  const ui = peUI?.ui; if (!ui || S?.paused) return; const now = performance.now();
  const aiTeams = mode === 'watch' ? S.teams.map((t) => t.id) : [S.teams[1].id];
  for (const tm of aiTeams) {
    if ((aiT[tm] || 0) > now) continue; const sk = skill(); const later = (ms) => { aiT[tm] = now + ms; };
    if (ui.only?.length && !ui.only.includes(tm)) continue; if ((ui.out || []).includes(tm)) continue;
    if (ui.pick && ui.pick.cur?.[tm] == null) { send('pick', tm, Math.floor(Math.random() * ui.pick.opts.length)); later(1500); continue; }
    if (!ui.team) continue; const acts = ui.team.map((b) => b[1]); const good = ui.team[0]; const bad = ui.team.find((b) => b[3] === 'red');
    if (acts.includes('first')) { if (/먼저/.test(ui.note) && !ui.once?.[tm]) { const delay = 500 + (1 - sk) * 2500 + Math.random() * 600; aiT[tm] = now + delay; setTimeout(() => send('first', tm, 0), delay); } else later(800); continue; }
    if (['pull', 'step', 'hit', 'cap', 'pass', 'win'].includes(good[1])) { if (Math.random() < 0.35 + sk * 0.5) send(good[1], tm, good[2]); later(({ pull: 2600, step: 7000, hit: 6000, cap: 7000, pass: 5000, win: 6000 }[good[1]] || 5000) * (1.4 - sk * 0.8) * (0.7 + Math.random() * 0.6)); continue; }
    if (ui.once && !ui.once[tm] && !/보여 주는 중|진행 중|기다리는/.test(ui.note || '')) { const ok = Math.random() < sk; if (ok) { const pickB = ui.team.filter((b) => b[3] === 'green')[0] || good; send(pickB[1], tm, pickB[2]); } else if (bad) send(bad[1], tm, bad[2]); else if (ui.team[1] && Math.random() < 0.5) send(ui.team[1][1], tm, ui.team[1][2]); later(2500); continue; }
    if (good[1] === 'ok' && !ui.once) { if (Math.random() < sk * 0.5) send(good[1], tm, good[2]); later(6000); continue; }
    later(1500);
  }
  // 미리보기(컴퓨터끼리)는 사회자 역할도 컴퓨터가: 모두 판정했으면 다음으로
  if (mode === 'watch' && ui.glob?.length && (aiT.glob || 0) < now) { const all = !ui.once || S.teams.every((t) => ui.once[t.id] || (ui.out || []).includes(t.id)); const pk = ui.pick ? S.teams.every((t) => ui.pick.cur?.[t.id] != null) : true; const k2 = JSON.stringify(ui); if (k2 !== aiT.gk) { aiT.gk = k2; aiT.gAt = now; } const stuck = now - (aiT.gAt || now) > 20000 && !/보여 주는 중/.test(ui.note || ''); if ((all && pk) || stuck) { send(ui.glob[0][1], 0, ui.glob[0][2]); aiT.glob = now + 3500; aiT.gAt = now; } }
}
// 게임 중 실시간 팀 기록 (게임이 끝나면 순위 점수로 바뀜)
function liveLine(m) {
  const el = $('.glive'); if (!el || !S) return; const s = m.s || {};
  const v = s.avg || s.boards || s.prog || s.pts || (s.team && typeof Object.values(s.team)[0] === 'number' ? s.team : null);
  el.textContent = v ? `실시간 🔴 ${Math.round(v[S.teams[0].id] ?? 0)} : ${Math.round(v[S.teams[1].id] ?? 0)} 🔵` : '';
}
function teamTot(id) { return S.standings.rows.find((r) => r.id === id)?.total ?? 0; }
function paint() {
  if (!S) return; const [t1, t2] = S.teams;
  $('.sr').textContent = teamTot(t1.id); $('.sb').textContent = teamTot(t2.id);
  const it = S.item; const ph = S.phase; if (ph !== 'playing') { const gl = $('.glive'); if (gl) gl.textContent = ''; }
  $('.gn').textContent = ph === 'ended' || ph === 'ceremony' ? '🏆 최종 결과' : it ? `${it.emoji} ${S.idx + 1}/${S.total} ${it.name}` : S.idx >= S.total ? '모든 게임 끝' : '대기 중';
  const go = $('.go');
  go.textContent = { lobby: S.idx >= S.total ? '🏆 최종 우승 발표' : '▶ 게임 시작', intro: '▶ 바로 시작', countdown: '⏳ 곧 시작', playing: '🏁 지금 끝내기', results: S.idx + 1 >= S.total ? '🏆 최종 결과' : '⏭ 다음 게임', ceremony: '▶ 다음 발표', ended: '✔ 끝' }[ph] || '▶';
  go.disabled = ph === 'countdown' || ph === 'ended';
  $('.pz').textContent = S.paused ? '▶ 재개' : '⏸ 일시정지'; $('.pz').disabled = !['intro', 'countdown', 'playing', 'results'].includes(ph);
  // 승리팀 발표
  let ban = $('.sban');
  const lr = S.lastResult;
  const msg = ph === 'results' && lr?.teams?.length ? (() => { const w = lr.teams[0], l = lr.teams[1]; const tm = S.teams.find((t) => t.id === w.id); return w.metric === l?.metric ? '🤝 이번 게임 무승부' : `🏆 ${tm.icon} ${tm.name} 승리! (${w.label || w.metric})`; })()
    : (ph === 'ended' || ph === 'ceremony' || (ph === 'lobby' && S.idx >= S.total && S.standings.played)) ? (() => { const a = teamTot(t1.id), b = teamTot(t2.id); return a === b ? `🤝 최종 무승부 ${a} : ${b}` : `🏆 최종 우승 ${a > b ? '🔴 홍팀' : '🔵 청팀'} (${a} : ${b})`; })() : '';
  if (msg) { if (!ban) { ban = h('div', { class: 'sban' }); document.body.append(ban); } if (ban.textContent !== msg) { ban.textContent = msg; ban.classList.remove('pop'); void ban.offsetWidth; ban.classList.add('pop'); } } else ban?.remove();
}
function tick() {
  if (!S || !live) return; const now = live.now(); const el = $('.gt'); if (!el) return;
  el.textContent = S.paused ? '⏸ 멈춤' : S.phase === 'playing' && S.run?.endAt ? `⏱ ${Math.max(0, Math.ceil((S.run.endAt - now) / 1000))}초` : S.phaseEnd ? `${Math.max(0, Math.ceil((S.phaseEnd - now) / 1000))}초 뒤` : '';
}

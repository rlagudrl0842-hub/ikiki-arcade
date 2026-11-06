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
let S = null; let live = null; let mute = false;
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
  const aiBox = h('div', { class: 'pbox ai' }, h('div', { class: 'pl' }, `🤖 청팀 컴퓨터 폰`), frame(blue, 'pf aif', '청팀 컴퓨터 폰'));
  const over = h('div', { class: 'sover' }, h('div', { class: 'svs' }, h('b', { class: 'r' }, '🔴 홍팀'), h('span', {}, 'VS'), h('b', { class: 'b' }, '청팀 🔵')), h('div', { class: 'muted' }, mode === 'watch' ? '컴퓨터끼리 실제 규칙으로 대결해요' : `나 vs 컴퓨터 (${LEVELS[lv].label}) · 실제 게임 규칙·점수 그대로`), h('div', { class: 'row' }, h('button', { class: 'btn green big', onclick: () => { over.remove(); unlock(); start(); } }, '▶ 시작'), h('button', { class: 'btn ghost', onclick: () => quit() }, '✕ 닫기')));
  app.append(head, h('main', { class: `sm ${mode}` }, h('div', { class: 'stage' }, screen, h('div', { class: 'airow' }, mode === 'watch' ? meBox : null, aiBox)), mode === 'watch' ? null : h('div', { class: 'side' }, meBox)), ctrl, over);
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
function onMsg(m) { if (m.t === 'state') { S = m; paint(); } if (m.t === 'live' && S?.phase === 'playing') { live.lastLive = m; liveLine(m); } }
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

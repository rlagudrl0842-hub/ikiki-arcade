// 참가자 폰 화면
import { $, h, Live, api, store, sfx, sfxHooks, say, vibrate, audioUnlock, AGE, teamOf, confetti } from './client.js';
import * as FX from './fx.js';
import { G } from './play-games.js';
import './play-n.js';
import { saveCard } from './card.js';
import './play-n2.js';
import './play-n3.js';
import './play-n4.js'; // 줄다리기·멀리뛰기·볼링
import './play-ath.js'; // 🏟 육상 대회
import { mountDemo, demoText, howTo } from './preview.js';
import * as S3 from './scene3d.js';

const app = $('#app'); window.__appOk = true; // 이 줄까지 실행되면 최신 문법을 아는 브라우저 (play.html의 안내 숨김)
const params = new URLSearchParams(location.search);
const code = (params.get('e') || params.get('code') || '').toUpperCase();
// 혼자 테스트하기: ?join=이름&team=1 → 바로 참가 / ?ai=난이도 → 컴퓨터 참가자 (같은 브라우저 안에서도 저장 칸을 따로 씀)
const aiLv = params.get('ai'); const autoName = params.get('join'); const autoTeam = Number(params.get('team')) || 0; const embed = params.has('embed');
const KEY = 'ikiki:' + code + (aiLv ? ':ai' + (autoTeam || 2) : embed ? ':me' : '');
let dev = store('ikiki:dev'); if (!dev) { dev = Math.random().toString(36).slice(2) + Date.now().toString(36); store('ikiki:dev', dev); }
if (aiLv) dev = `ai:${aiLv}:${dev}`.slice(0, 40); else if (embed) dev = `me:${dev}`.slice(0, 40);
if (embed || aiLv) document.body.classList.add('embed');

let sess = code ? store(KEY) : null;        // {eventId, players:[{pid,secret,name,team,age}], active}
let live = null, S = null;                   // S = 서버 공개 상태
const ME = {}; const VIEW = {}; const RUN = {};
const HOST = { ok: false, tok: null };
const PRAC = {}; const SKIPPRAC = new Set(); // 내 연습 결과 · 연습을 건너뛴 판 번호 // 같은 폰에 이 행사 관리자 로그인이 있으면 진행 메뉴(🎮)를 보여 줌
let mounted = null;                           // {key, inst, pid}
let lastPhaseKey = '';
let sfxOn = true;

document.addEventListener('pointerdown', () => audioUnlock(), { capture: true });

function toast(msg, ms = 2200) { const t = h('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), ms); }
const active = () => sess?.players?.find((p) => p.pid === sess.active) || sess?.players?.[0];

// ---------------- 시작 ----------------
if (!code) renderCodeEntry();
else if (sess?.players?.length) connect();
else if (autoName != null || aiLv) autoJoin();
else renderJoin();
async function autoJoin() {
  try {
    const info = await api('/api/public/' + encodeURIComponent(code));
    const t = info.teams[(autoTeam || (aiLv ? 2 : 1)) - 1] || info.teams[0];
    const r = await api('/api/join', { code, name: autoName || (aiLv ? '컴퓨터' : '나'), team: t.id, device: dev });
    sess = { eventId: r.eventId, players: [{ pid: r.pid, secret: r.secret, name: r.name, team: r.team }], active: r.pid }; store(KEY, sess); connect();
  } catch (e) { app.innerHTML = ''; app.append(h('main', { class: 'join' }, logo(), h('p', {}, e.message))); }
}
// 컴퓨터 참가자: 이 화면의 게임을 실제 입력으로 조작
let aiBot = null;
if (aiLv) import('./ai.js').then(({ AI }) => { aiBot = new AI({ level: aiLv, send: (m) => { const p = active(); if (p && live) live.send({ t: 'in', pid: p.pid, run: RUN[p.pid], ...m }); }, now: () => (live ? live.now() : Date.now()), get pid() { return active()?.pid; } }); Object.defineProperty(aiBot, 'pid', { get: () => active()?.pid }); window.__ai = aiBot; });

function renderCodeEntry() {
  app.innerHTML = '';
  const inp = h('input', { class: 'inp code', maxlength: 80, placeholder: '참가 코드 6자리', autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false' });
  const msg = h('div', { class: 'err' }); const btn = h('button', { class: 'btn wide' }, '입장하기');
  // 코드를 넣으면 먼저 서버에 확인 → 맞으면 그 행사로, 없거나 끝난 행사면 바로 이 자리에서 안내 (주소를 붙여 넣어도 코드만 뽑아 씀)
  const go = async () => {
    let v = inp.value.trim().toUpperCase(); const m = v.match(/[?&]E=([A-Z0-9]+)/) || v.match(/\/J\/([A-Z0-9]+)/); if (m) v = m[1]; v = v.replace(/[^A-Z0-9]/g, '');
    msg.textContent = '';
    if (v.length < 4) { msg.textContent = '참가 코드 6자리를 넣어 주세요'; return; }
    btn.disabled = true;
    try { const r = await api('/api/public/' + encodeURIComponent(v)); if (r.phase === 'ended') { msg.textContent = `이미 끝난 행사예요 (${r.name})`; btn.disabled = false; return; } location.href = '/play.html?e=' + encodeURIComponent(v); }
    catch (e) { btn.disabled = false; msg.textContent = e.status === 404 ? `없는 참가 코드예요. 큰 화면의 코드를 다시 확인해 주세요${/[01OI]/.test(inp.value.toUpperCase()) ? ' (코드에는 숫자 0·1, 영어 O·I가 없어요)' : ''}` : '인터넷 연결을 확인하고 다시 눌러 주세요'; }
  };
  inp.addEventListener('keydown', (e) => e.key === 'Enter' && go()); btn.onclick = go;
  app.append(h('main', { class: 'join' }, logo(), h('p', { class: 'muted' }, 'QR을 찍거나 큰 화면의 참가 코드를 입력하세요'), inp, msg, btn));
}
function logo() { return h('div', { class: 'brand big' }, h('span', { class: 'ikl' }, h('img', { src: '/logo.png', alt: '아이키키' })), h('div', {}, h('b', {}, '팀 대항 오락실'))); }

async function renderJoin(addMode = false) {
  unmount(); // 게임 중에 '아이 추가'로 와도 이전 게임 화면의 반복 그리기·타이머를 정리
  app.innerHTML = '';
  const wrap = h('main', { class: 'join' }, logo(), h('p', { class: 'muted' }, '불러오는 중…'));
  app.append(wrap);
  let info;
  try { info = await api('/api/public/' + encodeURIComponent(code)); } catch (e) { wrap.innerHTML = ''; wrap.append(logo(), h('p', {}, e.message), h('button', { class: 'btn', onclick: () => (location.href = '/play.html') }, '코드 다시 입력')); return; }
  if (info.phase === 'ended') { wrap.innerHTML = ''; wrap.append(logo(), h('h2', {}, info.name), h('p', {}, '행사가 끝났어요. 참가해 주셔서 고마워요!')); return; }
  document.body.classList.toggle('kid', info.mode === 'kid');
  let team = null, age = info.mode === 'mixed' ? null : info.mode;
  const name = h('input', { class: 'inp', maxlength: 12, placeholder: info.mode === 'kid' ? '아이 이름 (비워도 돼요)' : '이름·닉네임 (비우면 참가 번호)', autocomplete: 'off' });
  const teams = h('div', { class: 'teampick' });
  info.teams.forEach((t) => {
    const b = h('button', { class: 'tp', style: { '--tc': t.color } }, h('span', { class: 'ti' }, t.icon), h('b', {}, t.name), h('small', {}, `${info.counts[t.id]?.total || 0}명`));
    b.onclick = () => { team = t.id; teams.querySelectorAll('.tp').forEach((x) => x.classList.toggle('sel', x === b)); };
    teams.append(b);
  });
  const ages = h('div', { class: 'agepick' });
  if (info.mode === 'mixed') [['baby', '영아', '보호자와'], ['kid', '유아', '만 3~7세'], ['elem', '초등', '8~13세'], ['mid', '중등', '14~16세'], ['high', '고등', '17~19세'], ['adult', '성인', '20세 이상']].forEach(([k, e, l]) => {
    const b = h('button', { class: 'ap' }, h('span', {}, e), l); b.onclick = () => { age = k; ages.querySelectorAll('.ap').forEach((x) => x.classList.toggle('sel', x === b)); }; ages.append(b);
  });
  const err = h('div', { class: 'err' });
  const btn = h('button', { class: 'btn wide' }, addMode ? '이 아이도 참가 ➕' : '참가하기 🎮');
  btn.onclick = async () => {
    err.textContent = '';
    if (info.teamAssign === 'choose' && !team) { err.textContent = '팀을 골라 주세요'; return; }
    if (info.mode === 'mixed' && !age) { err.textContent = '나이를 골라 주세요'; return; }
    btn.disabled = true;
    try {
      const r = await api('/api/join', { code, name: name.value.trim(), team, age, device: dev });
      sess = sess && sess.eventId === r.eventId ? sess : { eventId: r.eventId, players: [] };
      if (!sess.players.some((p) => p.pid === r.pid)) sess.players.push({ pid: r.pid, secret: r.secret, name: r.name, team: r.team, age: age || info.mode });
      sess.active = r.pid; store(KEY, sess);
      vibrate(30);
      if (live) { live.ws?.close(); live.stop(); live = null; }
      connect();
    } catch (e) { err.textContent = e.message; btn.disabled = false; }
  };
  wrap.innerHTML = '';
  wrap.append(logo(), h('h2', { class: 'evname' }, info.name),
    addMode ? h('div', { class: 'assist' }, '👩‍🏫 보조 모드: 이 폰으로 아이를 한 명 더 등록해요') : null,
    h('label', {}, info.mode === 'kid' ? '아이 이름' : '이름'), name,
    info.mode === 'mixed' ? [h('label', {}, '누가 참가하나요?'), ages] : null,
    info.teamAssign === 'choose' ? [h('label', {}, '팀 고르기'), teams] : h('p', { class: 'muted' }, '팀은 자동으로 정해져요'),
    err, btn,
    addMode ? h('button', { class: 'btn ghost wide', onclick: () => connect() }, '취소') : h('p', { class: 'muted small' }, '이름을 비우면 "참가 7번"처럼 번호로 참가해요. 전화번호·계정은 필요 없어요. 이름은 행사 진행에만 쓰여요'));
  name.focus();
}

// ---------------- 연결 ----------------
function connect() {
  unmount(); // 화면을 새로 만들면 이전 게임 인스턴스도 정리 (안 그러면 떨어진 화면에 계속 그리고 새 화면엔 게임이 안 뜸)
  app.innerHTML = '';
  app.append(h('div', { class: 'top' }), h('div', { id: 'rk' }), h('main', { id: 'main' }), h('div', { id: 'bar' }));
  if (live) live.stop();
  checkHost();
  live = new Live(() => ({ t: 'hello', role: 'player', eid: sess.eventId, players: sess.players.map((p) => ({ pid: p.pid, secret: p.secret })) }), onMsg, onStatus);
  clearInterval(connect.clock); connect.clock = setInterval(tickClock, 200); // 참가자 추가·취소로 다시 연결해도 시계 타이머가 겹겹이 쌓이지 않게
}
function onStatus(st, code) {
  if (st === 'online') setTimeout(() => mounted?.inst?.resync?.(), 600); // 다시 연결됨: 끊긴 동안 보낸 방향을 다시 보냄
  document.body.classList.toggle('offline', st === 'offline');
  if (st === 'offline' && code === 4004) { store(KEY, null); toast('행사가 삭제되었어요'); }
}
function onMsg(m) {
  try { aiBot?.onMsg(m); } catch (e) { console.error('ai', e); }
  if (m.t === 'err') {
    if (m.code === 404) { // 참가 정보 없음 → 다시 참가
      store(KEY, null); sess = null; live?.stop(); live = null; toast(m.msg); renderJoin(); return;
    }
    toast(m.msg); return;
  }
  if (m.t === 'ok' && m.rid === 'team') { toast('✅ 팀 이름을 바꿨어요'); return; }
  if (m.t === 'state') { const prev = S; S = m; onState(prev); return; }
  if (m.t === 'me') { ME[m.pid] = m; const sp = sess.players.find((p) => p.pid === m.pid); if (sp) { sp.team = m.me.team; sp.name = m.me.name; store(KEY, sess); } if (m.game) { VIEW[m.pid] = m.game; if (m.run != null) RUN[m.pid] = m.run; } render(); return; }
  if (m.t === 'prac') { PRAC[m.pid || active()?.pid] = m; if (S?.phase === 'intro') render(); return; }
  if (m.t === 'lb') { LB[m.pid] = m; if (m.pid === active()?.pid) liveBar(); return; }
  if (m.t === 'g') {
    if (m.v) { VIEW[m.pid] = m.v; RUN[m.pid] = m.run; }
    if (m.pid === active()?.pid) {
      if (m.v) renderGame();
      if (m.r && mounted?.inst?.reply) mounted.inst.reply(m.r);
    }
  }
}

function onState(prev) {
  window.__paused = !!S.paused;
  if (HOST.ok && $('.hostsheet') && (prev?.phase !== S.phase || prev?.paused !== S.paused || prev?.idx !== S.idx)) setTimeout(hostSheet, 0); // 진행 메뉴가 열려 있으면 지금 단계 버튼으로 바꿈
  if (prev?.paused && !S.paused) setTimeout(() => mounted?.inst?.resync?.(), 50); // 재개: 멈춘 동안 바뀐 조이스틱 방향을 다시 보냄
  sfxOn = S.settings.sfx && !aiLv; // 컴퓨터 폰은 소리 없음
  const me = ME[active()?.pid]?.me;
  document.body.classList.toggle('kid', ['kid', 'baby'].includes(S.settings.mode) || ['kid', 'baby'].includes(me?.age));
  const key = S.phase + ':' + S.seq;
  if (key !== lastPhaseKey) {
    const was = lastPhaseKey.split(':')[0]; lastPhaseKey = key;
    if (S.phase === 'countdown') { vibrate(30); }
    if (S.phase === 'playing' && was === 'countdown') { sfx('go', sfxOn); vibrate(100); }
    if (S.phase === 'results' && was === 'playing') { sfx('end', sfxOn); vibrate([80, 60, 80]); }
    if (S.phase !== 'playing' && S.phase !== 'countdown') { for (const k of Object.keys(VIEW)) delete VIEW[k]; }
  }
  render();
}

// ---------------- 화면 ----------------
function header() {
  const top = $('.top'); if (!top || !S) return;
  const p = active(); const me = ME[p?.pid]?.me; const t = teamOf(S, me?.team ?? p?.team);
  top.innerHTML = '';
  top.style.setProperty('--tc', t.color);
  top.append(h('div', { class: 'tm' }, h('span', { class: 'ti' }, t.icon), h('b', {}, t.name)), h('div', { class: 'nm' }, h('div', {}, me?.name || p?.name || '', me?.rep ? h('span', { class: 'rep' }, '👑대표') : null), h('div', { class: 'hrk' })), /* 이름 아래 작은 줄: 게임 중에도 팀·내 순위 (조작 칸을 밀지 않게 머리줄 안에) */
    (['playing', 'countdown'].includes(S.phase) && DEMO_OK(VIEW[p?.pid]?.g)) ? h('button', { class: 'helpbtn', 'aria-label': '하는 방법 다시 보기', onclick: () => helpSheet(VIEW[active().pid]?.g, t.color) }, '❓') : null,
    HOST.ok ? h('button', { class: 'hostbtn', 'aria-label': '진행 메뉴', onclick: hostSheet }, '🎮') : null,
    h('button', { class: 'menu', onclick: openMenu }, '☰'));
  rankStrip();
  const bar = $('#bar'); bar.innerHTML = '';
  if (sess.players.length > 1) {
    bar.append(...sess.players.map((x) => h('button', { class: `pch ${x.pid === p.pid ? 'on' : ''}`, style: { '--tc': teamOf(S, ME[x.pid]?.me?.team ?? x.team).color }, onclick: () => { sess.active = x.pid; store(KEY, sess); unmount(); render(); } }, x.name)));
  }
}
// 🎮 진행자 겸 참가자: 같은 폰에 이 행사 관리자 로그인이 있으면 오른쪽 위에 🎮 버튼 → 진행 메뉴(시작·종료·다음·일시정지·점수)
// 메뉴는 화면 아래에서 올라오는 판이라 게임 버튼과 겹치지 않음 · 열려 있는 동안 게임 입력은 가려짐 · 닫으면 바로 게임으로
async function checkHost() { // 참가 정보(행사 번호)가 생긴 뒤에 확인 — 처음 열 때·참가한 직후
  if (HOST.ok || HOST.busy) return; HOST.busy = true;
  try { const t = JSON.parse(localStorage.getItem('ikiki:admin') || 'null'); if (!t || !sess?.eventId) return; await api(`/api/events/${sess.eventId}`, undefined, t); HOST.ok = true; HOST.tok = t; header();
    if (/[?&]host=1/.test(location.search)) toast('🎮 진행자로 참가했어요 · 오른쪽 위 🎮로 게임을 진행해요', 4000); } catch { /* 관리자 아님 */ } finally { HOST.busy = false; }
}
function hostSheet() {
  $('.sheet')?.remove(); if (!S) return;
  const cmd = async (op, ask) => { if (ask && !confirm(ask)) return; m.remove(); /* 누르자마자 닫음 → 게임 버튼을 가리지 않음 */ try { await api(`/api/events/${sess.eventId}/command`, { op }, HOST.tok); vibrate(15); } catch (e) { toast(e.message || '진행하지 못했어요'); } };
  const ph = S.phase; const it = S.item; const B = (l, op, cls, ask) => h('button', { class: `btn wide ${cls || ''}`, onclick: () => cmd(op, ask) }, l);
  const main = ph === 'lobby' ? (it ? B(S.idx === 0 && !S.standings?.played ? '▶ 첫 게임 시작' : `▶ 다음 게임 시작 (${it.emoji} ${it.name})`, 'intro', 'green') : B('🏆 시상식 시작', 'ceremony'))
    : ph === 'intro' ? B(S.practice?.max ? '🚀 본 경기 시작!' : '🚀 게임 시작!', 'start', 'green')
    : ph === 'countdown' || ph === 'playing' ? (S.practice?.on ? B('🏁 연습 끝내기', 'endNow') : B('🏁 지금 종료 (점수 반영)', 'endNow', '', '지금 게임을 끝내고 점수를 반영할까요?'))
    : ph === 'results' ? B(S.idx < S.total ? '⏭ 다음 게임 준비' : '🏆 마무리', 'next', 'green')
    : ph === 'ceremony' ? B('▶ 다음 발표', 'ceremonyNext', 'green') : null;
  const prac = ph === 'intro' && S.practice?.max && (S.practice.done || 0) < S.practice.max ? B(`🧪 연습 시작 (${(S.practice.done || 0) + 1}/${S.practice.max}) · 점수 없음`, 'practice', 'blue') : null;
  const pause = ['intro', 'countdown', 'playing', 'results'].includes(ph) ? (S.paused ? B('▶ 다시 진행', 'resume', 'blue') : B('⏸ 일시정지', 'pause', 'yellow')) : null;
  const skip = ['lobby', 'intro'].includes(ph) && it ? B(`⏭ 이 게임 건너뛰기`, 'skip', 'ghost', `${it.name} 게임을 건너뛸까요?`) : null;
  const rows = [...(S.standings?.rows || [])].sort((a, b) => a.rank - b.rank);
  const board = rows.length ? h('div', { class: 'hsboard' }, h('div', { class: 'muted small' }, '📊 종합 점수'), ...rows.map((r) => { const t = teamOf(S, r.id); return h('span', { style: { '--tc': t.color } }, `${r.rank}. ${t.icon} ${t.name} `, h('b', {}, `${r.total}점`)); })) : null;
  const m = h('div', { class: 'sheet hostsheet' },
    h('div', { class: 'hsh' }, h('b', {}, '🎮 진행 메뉴'), h('span', { class: 'muted small' }, `${it ? `${it.emoji} ${S.idx + 1}/${S.total} ${it.name}` : '게임 없음'} · ${({ lobby: '대기', intro: '소개', countdown: '카운트다운', playing: '게임 중', results: '결과', ceremony: '시상식', ended: '종료' })[ph] || ph}${S.paused ? ' · 일시정지' : ''}`)),
    prac, main, pause, skip, board,
    h('a', { class: 'btn ghost wide', href: `/admin.html#e=${sess.eventId}`, target: 'ikiki-admin' }, '🎛 전체 리모컨 화면 열기'),
    h('div', { class: 'muted small' }, '이 메뉴가 열려 있는 동안은 게임 버튼이 가려져요. 닫으면 바로 게임으로 돌아가요.'),
    h('button', { class: 'btn wide', onclick: () => m.remove() }, '닫기'));
  document.body.append(m);
}
function openMenu() {
  const m = h('div', { class: 'sheet' },
    h('button', { class: 'btn ghost wide', onclick: () => { m.remove(); renderJoin(true); } }, '👩‍🏫 아이 추가 (보조 모드)'),
    h('button', { class: 'btn ghost wide', onclick: () => { sfxOn = !sfxOn; m.remove(); toast(sfxOn ? '효과음 켬' : '효과음 끔'); } }, '🔊 효과음 켜기/끄기'),
    h('button', { class: 'btn ghost wide', onclick: () => { if (confirm('이 폰에서 참가 정보를 지울까요? (점수는 남아요)')) { store(KEY, null); location.reload(); } } }, '🚪 이 폰에서 나가기'),
    h('button', { class: 'btn wide', onclick: () => m.remove() }, '닫기'));
  document.body.append(m);
}

// 화면 뒤 3D 배경: 지금(또는 다음) 게임 주제에 맞춘 장면 · 글자가 잘 보이게 위에 어두운 막 (게임 화면이 직접 그리면 그게 위에 보임)
// 게임 중 성공·실패 순간: 화면 가장자리 빛 + (큰 성공이면) 빛 고리 — 모든 게임 공통 (효과음 신호를 받아서)
if (!aiLv) sfxHooks.add((n) => {
  if (!S || !['playing', 'countdown'].includes(S.phase)) return;
  try { stageNow?.r?.react?.(n); } catch { /* */ } // 3D 무대 조명·관중 반응
  if (n === 'good' || n === 'pass') FX.flash('ok'); else if (n === 'win') { FX.flash('gold'); FX.burst({ color: '#ffd43b' }); } else if (n === 'bad' || n === 'boom') FX.flash('bad');
});
let bgNow = null;
function backdrop() {
  const g = (['playing', 'countdown'].includes(S.phase) ? VIEW[active()?.pid]?.g : null) || S.run?.game || S.item?.game || 'arcade';
  const tone = S3.toneOf(S.settings.mode); const still = ['playing', 'countdown'].includes(S.phase); const key = `${g}|${tone}|${still}`;
  document.body.dataset.tone = tone;
  if (bgNow?.key === key) return;
  bgNow?.ctl.stop(); let cv = document.getElementById('bg3d'); if (!cv) { cv = h('canvas', { id: 'bg3d', 'aria-hidden': 'true' }); document.body.prepend(cv, h('div', { id: 'bg3dshade' })); }
  bgNow = { key, ctl: S3.backdrop(cv, g, { tone, still }) }; // 게임 중엔 배경을 멈춘 그림으로 (폰 부담 줄임)
}
// 버튼·문제 위주 게임 14개: 게임 중 화면 뒤에 3D 무대 (버튼 화면은 그대로 · 안 되거나 느리면 원래 배경)
const STAGE = ['bell', 'tele', 'mino', 'hilo', 'draw', 'spot', 'shout', 'hold', 'rhythm', 'sync', 'burger', 'relay', 'bombpass', 'boss'];
let stageNow = null, stageNo = new Set();
function stageBackdrop() {
  const g = ['playing', 'countdown'].includes(S.phase) ? VIEW[active()?.pid]?.g : null;
  const want = g && STAGE.includes(g) && !stageNo.has(g) && !aiLv && S3.quality() !== 'low' && !/[?&]r3d=0/.test(location.search) ? g : null;
  if (stageNow?.g === want) return;
  if (stageNow) { stageNow.dead = true; cancelAnimationFrame(stageNow.raf); try { stageNow.r?.dispose(); } catch { /* */ } stageNow.cv.remove(); stageNow = null; window.__stage3d = false; document.body.classList.remove('stage3d'); }
  if (!want) return;
  const cv = h('canvas', { id: 'stage3d', 'aria-hidden': 'true' }); const bg = document.getElementById('bg3d'); if (bg) bg.after(cv); else document.body.prepend(cv);
  const st = stageNow = { g: want, cv, dead: false };
  import('./stage3d.js').then((m) => {
    if (st.dead) return;
    const drop = (why) => { stageNo.add(want); window.__r3d = `2d:${why}`; S3.mark3dFail(why); if (stageNow === st) { st.dead = true; cancelAnimationFrame(st.raf); try { st.r?.dispose(); } catch { /* */ } cv.remove(); stageNow = null; window.__stage3d = false; document.body.classList.remove('stage3d'); } };
    st.r = m.createStage3D(cv, { game: want, quality: S3.quality(), onSlow: drop }); if (!st.r) return drop('nogl');
    window.__stage3d = true; window.__r3d = '3d'; document.body.classList.add('stage3d');
    // 배경이라 초당 30번까지만 · 한 번 그리는 데 걸리는 시간을 재서 폰이 버거우면 원래 배경으로 (박자·연타 게임은 더 엄격하게: 버튼 반응이 늦어지지 않게)
    const limit = ['rhythm', 'sync', 'shout', 'hold'].includes(want) ? 5 : 9; const costs = []; const force = /[?&]r3d=force/.test(location.search);
    let last = 0; const loop = (now) => { if (st.dead) return; st.raf = requestAnimationFrame(loop); if (now - last < 30) return; last = now; const t0 = performance.now(); try { st.r.render({ t: now / 1000 }); } catch (e) { console.error(e); return drop('err'); } if (!force && costs.length < 40) { costs.push(performance.now() - t0); if (costs.length === 40) { const m = [...costs].sort((a, b) => a - b)[20]; if (m > limit) drop('cost'); } } };
    st.raf = requestAnimationFrame(loop);
  }).catch(() => { stageNo.add(want); if (stageNow === st) { cv.remove(); stageNow = null; } });
}
function render() {
  if (!S) return;
  try { backdrop(); stageBackdrop(); } catch (e) { console.error(e); }
  document.body.dataset.ph = S.phase;
  header();
  const main = $('#main'); if (!main) return;
  const p = active(); const me = ME[p.pid]?.me;
  if (me?.excluded) { unmount(); main.innerHTML = ''; main.append(center('🙏', '진행자가 참가를 잠시 제외했어요', '진행자에게 말해 주세요')); return; }
  const ph = S.phase;
  pauseOverlay();
  if (ph === 'playing' || ph === 'countdown') return renderGame();
  unmount();
  main.innerHTML = '';
  if (ph === 'lobby') return main.append(lobby());
  if (ph === 'intro') return main.append(intro());
  if (ph === 'results') return main.append(results());
  if (ph === 'ceremony') return main.append(ceremony());
  if (ph === 'ended') return main.append(ended());
}
function pauseOverlay() {
  let o = $('#pause');
  if (S.paused && !o) document.body.append(h('div', { id: 'pause' }, h('div', { class: 'cic' }, '⏸️'), h('div', { class: 'ct' }, '잠시 멈춤'), h('div', { class: 'muted' }, '진행자가 곧 다시 시작해요')));
  if (!S.paused && o) o.remove();
}
function center(icon, title, sub) { return h('div', { class: 'center' }, h('div', { class: 'cic' }, icon), h('div', { class: 'ct' }, title), sub ? h('div', { class: 'muted' }, sub) : null); }

function lobby() {
  const me = ME[active().pid]?.me;
  const t = teamOf(S, me?.team);
  const el = h('div', { class: 'lobby' },
    h('div', { class: 'badge', style: { '--tc': t.color } }, h('div', { class: 'bi' }, t.icon), h('div', { class: 'bt' }, t.name), h('div', { class: 'muted' }, `우리 팀 ${S.counts[t.id]?.total || 0}명`)),
    h('div', { class: 'ct' }, S.notice && /시상식/.test(S.notice) ? '🏆 곧 시상식이에요!' : '게임을 기다리는 중…'),
    S.item ? h('div', { class: 'muted' }, `다음 게임: ${S.item.emoji} ${S.item.name}`) : null,
    rankCard(), renameBtn(me, t), cheerBtn(t), mini());
  return el;
}
// ---- 우리 팀 이름 바꾸기 (진행자가 허용했을 때) ----
const TEAM_EMOJI = ['🐯', '🐬', '🐥', '🐸', '🦄', '🦊', '🐳', '🐷', '🐢', '🐺', '🦁', '🐧', '🐝', '🐲', '🦋', '🐻', '⚡', '🔥', '⭐', '🚀', '⚽', '🏀', '🌈', '👑', '💎', '🍀', '🌊', '🍓', '🦖', '🤖', '👻', '🎯'];
function renameBtn(me, t) {
  const mode = S.settings?.teamRename || 'rep';
  if (!me?.team || mode === 'off') return null;
  if (mode === 'rep' && !me.rep) return h('div', { class: 'muted small' }, '✏️ 팀 이름은 👑 팀 대표가 바꿀 수 있어요');
  return h('button', { class: 'btn ghost', onclick: () => renameSheet(t) }, '✏️ 우리 팀 이름 바꾸기');
}
function renameSheet(t) {
  $('.sheet')?.remove();
  let icon = t.icon;
  const inp = h('input', { class: 'inp', value: t.name, maxlength: 10, placeholder: '팀 이름 (10자까지)', enterkeyhint: 'done' });
  const grid = h('div', { class: 'emgrid' });
  for (const e of TEAM_EMOJI) {
    const b = h('button', { class: `em ${e === icon ? 'sel' : ''}`, onclick: () => { icon = e; grid.querySelectorAll('.em').forEach((x) => x.classList.toggle('sel', x === b)); } }, e);
    grid.append(b);
  }
  const save = () => { const name = inp.value.trim(); if (!name) return toast('팀 이름을 써 주세요'); live.send({ t: 'team', name, icon, pid: active().pid, rid: 'team' }); m.remove(); };
  inp.addEventListener('keydown', (e) => e.key === 'Enter' && save());
  const m = h('div', { class: 'sheet' }, h('b', {}, '✏️ 우리 팀 이름 바꾸기'), inp, h('div', { class: 'muted small' }, '아이콘 고르기'), grid,
    h('button', { class: 'btn wide', onclick: save }, '바꾸기'), h('button', { class: 'btn ghost wide', onclick: () => m.remove() }, '취소'));
  document.body.append(m);
  inp.focus();
}
function cheerBtn(t) {
  let n = 0;
  const cnt = h('span', { class: 'cc' }, String(S.cheer?.[t.id] || 0));
  const b = h('button', { class: 'cheer', style: { '--tc': t.color } }, '📣 응원하기 ', cnt);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); n++; cnt.textContent = String(+cnt.textContent + 1); vibrate(6); b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); });
  const iv = setInterval(() => { if (!b.isConnected) return clearInterval(iv); if (n) { live.send({ t: 'cheer', n: Math.min(n, 5), pid: active().pid }); n = 0; } }, 300);
  const wrap = h('div', { class: 'cheerwrap' }, b);
  if (S.cheerEvent && !S.cheerEvent.done) wrap.prepend(h('div', { class: 'ce' }, `🔥 응원 이벤트! 1인당 응원 1위 팀 +${S.cheerEvent.bonus}점`));
  return wrap;
}
// ---------------- 팀·개인 순위 (큰 화면 순위 발표와 같은 점수·같은 계산) ----------------
// 팀: 종합 점수(standings) · 개인: 개인 점수가 실제로 기록되는 게임의 점수 합 (서버 계산) · 점수가 정말 같을 때만 공동 순위
function teamRank(tid) {
  const rows = S?.standings?.rows || []; const r = rows.find((x) => x.id === tid); if (!r) return null;
  const top = rows[0]?.total ?? 0; const tie = rows.filter((x) => x.rank === r.rank).length > 1;
  const above = rows.filter((x) => x.total > r.total).reduce((m, x) => Math.min(m, x.total), Infinity); // 바로 앞 팀 점수
  return { rank: r.rank, total: r.total, gap: Math.round((top - r.total) * 10) / 10, ahead: Number.isFinite(above) ? Math.round((above - r.total) * 10) / 10 : 0, n: rows.length, tie, started: S.standings.played > 0 || rows.some((x) => x.total !== 0) };
}
const gapTxt = (x) => (x.rank === 1 ? (x.tie ? '1위와 동점' : '1위!') : `1위와 ${x.gap}점 차`);
function rankTexts() {
  const p = active(); const me = ME[p?.pid]; const tr = teamRank(me?.me?.team ?? p?.team); const pr = me?.prank;
  const short = (x) => (x.rank === 1 ? (x.tie ? '동점' : '선두') : `1위와 −${x.gap}`); // 폰 위 줄은 짧게 (카드에는 자세히)
  const team = !tr ? null : !tr.started ? '아직 점수 없음' : `${tr.tie ? '공동 ' : ''}${tr.rank}위/${tr.n}팀 · ${short(tr)}${tr.rank > 2 && tr.ahead ? ` · 앞 팀과 −${tr.ahead}` : ''}`; // 3위 이하면 바로 앞 팀과의 차이도
  const mine = !pr ? null : pr.none ? '개인 점수 게임 전' : pr.few ? `${pr.games}/${pr.need}판 · 순위 전` : pr.rank == null ? '아직 개인 기록 없음' : `${pr.tie ? '공동 ' : ''}${pr.rank}위/${pr.n}명 · ${short(pr)}`;
  return { tr, pr, team, mine };
}
function rankStrip() {
  const el = $('#rk'); if (!el || !S) return;
  const rt = rankTexts(); const { team, mine } = rt;
  const hk = $('.top .hrk'); if (hk) { const { tr, pr } = rt; const t2 = [tr?.started ? `종합 ${tr.tie ? '공동 ' : ''}${tr.rank}위 ${tr.rank === 1 ? (tr.tie ? '동점' : '선두') : `−${tr.gap}`}` : null, pr && !pr.none ? (pr.few ? `나 ${pr.games}/${pr.need}판` : pr.rank != null ? `나 ${pr.tie ? '공동 ' : ''}${pr.rank}위` : null) : null].filter(Boolean).join(' · '); /* 짧게: 팀 2위 −30 · 나 3위 */ if (hk.textContent !== t2) hk.textContent = t2; } const key = `${team}|${mine}`; if (el.dataset.k === key) return; el.dataset.k = key; el.innerHTML = '';
  // 우리 팀 순위가 바뀌면 크게 알림 (처음 그릴 때는 빼고)
  const nr = rt.tr?.started ? rt.tr.rank : null; if (nr && rankStrip.prev && nr !== rankStrip.prev && !aiLv) FX.banner(nr < rankStrip.prev ? `▲ 우리 팀 ${nr}위로 올라감!` : `▼ 우리 팀 ${nr}위`, nr < rankStrip.prev ? 'up' : 'down'); if (nr) rankStrip.prev = nr;
  if (team) el.append(h('span', {}, h('i', {}, '팀'), team));
  if (mine) el.append(h('span', {}, h('i', {}, '나'), mine));
}
function rankCard() {
  const { tr, pr } = rankTexts(); const p = active(); const t = teamOf(S, ME[p?.pid]?.me?.team ?? p?.team);
  const box = (label, x, unit, empty) => h('div', { class: `rkbox ${x?.rank === 1 ? 'first' : ''}` }, h('div', { class: 'rkl' }, label),
    x && x.rank != null && !empty ? [h('div', { class: 'rkn' }, x.tie ? h('small', {}, '공동 ') : null, `${x.rank}`, h('small', {}, `위 / ${x.n}${unit}`)), h('div', { class: 'rkg' }, `${x.games != null ? `평균 ${x.total}점 · ${x.games}판` : `${x.total}점`} · ${gapTxt(x)}`)] : h('div', { class: 'rke' }, empty || '아직 기록 없음'));
  return h('div', { class: 'rkcard', style: { '--tc': t.color } },
    box(`${t.icon} 우리 팀 순위`, tr, '팀', tr && !tr.started ? '아직 점수 없음' : null),
    box('🙋 내 개인 순위 (게임 평균)', pr, '명', !pr ? null : pr.none ? '개인 점수가 집계되는 게임 전이에요' : pr.few ? `${pr.need}판 이상 하면 순위에 들어가요 (지금 ${pr.games}판)` : pr.rank == null ? '아직 개인 기록이 없어요' : null));
}
const recTxt = (r) => (r ? `${r.label} · ${r.holder}${r.kind === 'player' && r.team ? ` (${r.team})` : ''} · ${new Date(r.at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}` : null);
function mini() {
  const rows = S.standings.rows;
  const me = ME[active().pid]?.me;
  return h('div', { class: 'mini' }, h('div', { class: 'mh' }, `종합 순위 · ${S.standings.played}게임 진행`),
    rows.map((r) => { const t = teamOf(S, r.id); return h('div', { class: `mr ${r.id === me?.team ? 'mine' : ''}`, style: { '--tc': t.color } }, h('b', {}, `${r.rank}`), h('span', {}, `${t.icon} ${t.name}`), h('em', {}, `${r.total}점`)); }));
}
// 시범 미리보기: 설명 화면에서 자동으로, 게임 중에는 ❓ 버튼으로 다시 보기
let introDemo = null; const demoT0 = {};
function intro() {
  const it = S.item; if (!it) return center('🎮', '곧 시작해요');
  const me = ME[active().pid]?.me;
  introDemo?.stop?.();
  const dbox = h('div', { class: 'introdemo' });
  const tx = demoText(it.game, S.settings.mode);
  if (S.settings.preview !== false && tx) introDemo = mountDemo(dbox, it.game, { mode: S.settings.mode, color: teamOf(S, me?.team).color, sec: S.settings.previewSec || 6, h, t0: (demoT0[S.seq] = demoT0[S.seq] || performance.now()) });
  return h('div', { class: 'intro' }, h('div', { class: 'ie' }, it.emoji), h('div', { class: 'in' }, `GAME ${String(it.no).padStart(2, '0')}`), h('div', { class: 'it' }, it.name),
    tx?.goal ? h('div', { class: 'igoal' }, `🏆 ${tx.goal}`) : null, pracInfo(), howBox(it.game, tx), dbox,
    S.record ? h('div', { class: 'irec' }, '🏅 이 게임 최고 기록 ', h('b', {}, recTxt(S.record))) : h('div', { class: 'irec' }, '🏅 아직 최고 기록이 없어요 — 첫 기록에 도전!'),
    h('div', { class: 'ir' }, it.rule), it.weight > 1 ? h('div', { class: 'chip big' }, `🔥 점수 ${it.weight}배!`) : null, it.durSec ? h('div', { class: 'muted' }, `⏱ ${it.durSec}초`) : null,
    h('div', { class: 'ready' }, me?.rep && it.team ? '👑 당신은 팀 대표예요!' : '준비하세요! 곧 시작합니다'), cheerBtn(teamOf(S, me?.team)));
}
// 게임 방법 상자 (설명 화면): 폰 드는 법·조작 / 점수·순위 / 실수·시간 초과 / 팀 점수 / 게임 중 볼 곳 — 아래 움직이는 시범과 함께
function howBox(game, tx) {
  const it = S.item; const k = howTo(game, { team: !!it?.team, scoring: S.settings.scoring, race: RACE.has(game) });
  const row = (ic, t) => h('div', { class: 'hrow' }, h('span', { class: 'hic' }, ic), h('span', {}, t));
  return h('div', { class: 'howbox' }, row('👆', k.hold.replace(/^📱 |^🙌 /, '')), row('🏅', it?.howto || tx?.score || '많이 할수록 점수가 올라가요'), row('⚠️', k.miss), row('🤝', k.team.replace(/^🤝 /, '')), row('👀', k.watch.replace(/^👀 /, '')));
}
// 연습 안내 (설명 화면): 몇 번 연습했는지 · 내 연습 결과 (기록에 안 들어감)
function pracInfo() {
  const P = S.practice; if (!P?.max) return null; const mine = PRAC[active()?.pid];
  return h('div', { class: 'pracinfo' }, h('b', {}, `🧪 연습 ${P.done}/${P.max}회`), h('span', {}, P.done >= P.max ? ' · 이제 본 경기예요!' : ' · 본 경기 전에 연습해요 (점수에 안 들어가요)'),
    mine && P.done ? h('div', { class: 'small' }, `내 연습 결과: ${mine.show || '기록 없음'}${mine.rank ? ` (${mine.rank}/${mine.total}등)` : ''}`) : null);
}
function results() {
  const lr = S.lastResult; if (!lr) return center('📊', '결과 집계 중…');
  const me = ME[active().pid]; const my = me?.my;
  const t = teamOf(S, me?.me?.team);
  const tr = lr.teams?.find((x) => x.id === t.id);
  const el = h('div', { class: 'results' }, h('div', { class: 'rt' }, `${lr.label} 결과`));
  if (lr.bonus) {
    const b = lr.bonus.find((x) => x.team === t.id);
    el.append(h('div', { class: 'big' }, b ? `🎡 +${b.delta}점 보너스!` : '🎡 보너스 없음'));
  } else if (tr) {
    el.append(h('div', { class: `rank r${tr.rank}`, style: { '--tc': t.color } }, h('div', { class: 'rn' }, `${tr.rank}위`), h('div', {}, `${t.icon} ${t.name} · +${tr.points}점`)));
    if (tr.rank === 1) { sfx('win', sfxOn); setTimeout(() => { const c = h('canvas', { class: 'fx' }); document.body.append(c); confetti(c, [t.color, '#ffd43b', '#fff'], 120); setTimeout(() => c.remove(), 5000); }, 50); }
  }
  if (my && lr.personal !== false) el.append(h('div', { class: 'mine' }, '내 기록: ', h('b', {}, my.show ?? my.raw)));
  if (lr.record?.isNew) { el.append(h('div', { class: 'newrec' }, '🎉 신기록! ', h('b', {}, recTxt(lr.record.rec)))); if (results.recRun !== lr.runId) { results.recRun = lr.runId; setTimeout(() => { FX.banner('NEW RECORD · 신기록!', 'gold', 2600); FX.burst({ color: '#ffd43b' }); }, 600); } }
  else if (lr.record?.rec) el.append(h('div', { class: 'irec' }, '🏅 최고 기록 ', h('b', {}, recTxt(lr.record.rec))));
  el.append(rankCard());
  const ace = lr.aces?.[t.id];
  if (ace) el.append(h('div', { class: 'mvp' }, `🏅 우리 팀 에이스 ${ace.name}${ace.show ? ` (${ace.show})` : ''}${ace.id === active().pid ? ' · 바로 나!' : ''}`));
  if (lr.mvp) { const mt = teamOf(S, lr.mvp.team); el.append(h('div', { class: 'mvp' }, `⭐ MVP ${mt.icon} ${lr.mvp.name}${lr.mvp.show ? ` (${lr.mvp.show})` : ''}`)); }
  el.append(mini());
  return el;
}
function ceremony() {
  const me = ME[active().pid]?.me;
  const r = S.standings.rows.find((x) => x.id === me?.team);
  if (S.ceremonyStep >= 4 && r) {
    const t = teamOf(S, r.id);
    if (r.rank === 1 && !ceremony.done) { ceremony.done = true; sfx('fanfare', sfxOn); const c = h('canvas', { class: 'fx' }); document.body.append(c); confetti(c, [t.color, '#ffd43b', '#fff']); setTimeout(() => c.remove(), 6000); }
    return h('div', { class: 'center' }, h('div', { class: 'cic' }, r.rank === 1 ? '🏆' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '🎖️'), h('div', { class: 'ct' }, `${t.name} 최종 ${r.rank}위!`), h('div', { class: 'muted' }, `${r.total}점`), mini());
  }
  return center('🏆', '시상식!', '큰 화면을 봐 주세요 두구두구…');
}
function ended() {
  const me = ME[active().pid]?.me;
  const r = S.standings.rows.find((x) => x.id === me?.team);
  const t = teamOf(S, me?.team);
  const tm = S.teamMvp?.[me?.team];
  return h('div', { class: 'center' }, h('div', { class: 'cic' }, '🎉'), h('div', { class: 'ct' }, '참가해 줘서 고마워요!'), r ? h('div', { class: 'muted' }, `${t.icon} ${t.name} 최종 ${r.rank}위 · ${r.total}점`) : null, tm ? h('div', { class: 'mvp' }, `🏅 우리 팀 MVP ${tm.name}`) : null, h('button', { class: 'btn wide', onclick: () => saveCard(S, { myTeam: me?.team }).catch(() => toast('저장하지 못했어요')) }, '🖼 결과 카드 저장·공유'), mini());
}

// ---------------- 게임 ----------------
// 게임 화면을 못 그리면 빈 화면 대신 안내 + 다시 시도 + 서버에 오류 기록 (기기별 원인 확인용)
function gameFail(main, g, e) {
  console.error(e); unmount(); window.__clog?.('game', g, e);
  main.innerHTML = ''; main.append(h('div', { class: 'center' }, h('div', { class: 'cic' }, '⚠️'), h('div', { class: 'ct' }, '이 기기에서 게임 화면을 그리지 못했어요'),
    h('div', { class: 'muted small' }, String(e?.message || e).slice(0, 80)),
    h('button', { class: 'btn wide', onclick: () => { try { localStorage.setItem('ikiki:no3d', String(Date.now())); } catch { /* */ } location.reload(); } }, '🔄 다시 시도 (간단한 화면으로)')));
}
function unmount() { document.body.classList.remove('ingame'); if (mounted) { try { mounted.inst.unmount?.(); } catch { /* */ } mounted = null; } }
// 카운트다운 중 미리 누르는 게임: 위에 '3·2·1 지금 꾹!' 표시
function preBadge(main, on) {
  let b = document.getElementById('precd');
  if (!on) { b?.remove(); clearInterval(preBadge.t); return; }
  if (!b) { b = h('div', { id: 'precd' }); document.body.append(b); }
  const upd = () => { if (S?.phase !== 'countdown') { b.remove(); clearInterval(preBadge.t); return; } b.textContent = `${Math.max(1, Math.ceil((S.phaseEnd - live.now()) / 1000))} · 시작 전에 지금 꾹 눌러요!`; };
  upd(); clearInterval(preBadge.t); preBadge.t = setInterval(upd, 200);
}
function renderGame() {
  const main = $('#main'); if (!main || !S) return;
  const p = active(); const v = VIEW[p.pid];
  // 시작 전에 미리 눌러야 하는 게임(손 떼면 탈락)은 카운트다운 동안에도 게임 화면을 띄움
  const preOk = S.phase === 'countdown' && S.item?.pre && v && !v.spectator;
  if ((S.phase === 'countdown' && !preOk) || !v) {
    if (S.phase === 'countdown') { unmount(); if (!main.querySelector('.cd')) { main.innerHTML = ''; main.append(h('div', { class: 'cd' }, h('div', { class: 'cdn' }, '3'), h('div', { class: 'muted' }, S.item ? `${S.item.emoji} ${S.item.name}` : ''))); } }
    else if (!mounted) { main.innerHTML = ''; main.append(center('⏳', '게임 화면을 불러오는 중…')); }
    return;
  }
  if (v.spectator) { unmount(); main.innerHTML = ''; main.append(center('👀', '이번 게임은 관전해요', '게임 중간에 들어와서 다음 게임부터 참여해요')); return; }
  // 🧪 연습을 건너뛴 사람: 본 경기가 시작되면 바로 참여 (연습 화면 대신 대기 안내)
  if (S.practice?.on && SKIPPRAC.has(RUN[p.pid])) { if (main.querySelector('.pracskip')) return; unmount(); main.innerHTML = ''; main.append(h('div', { class: 'pracskip' }, center('⏭', '연습을 건너뛰었어요', '본 경기가 시작되면 바로 참여해요 · 연습 점수는 원래 기록에 안 들어가요'), h('button', { class: 'btn ghost wide', onclick: () => { SKIPPRAC.delete(RUN[p.pid]); unmount(); main.innerHTML = ''; renderGame(); } }, '🔁 다시 연습하기'))); return; }
  const key = `${RUN[p.pid]}:${v.g}:${p.pid}`;
  preBadge(main, preOk);
  if (mounted?.key === key) { try { mounted.inst.update?.(v); } catch (e) { gameFail(main, v.g, e); } return; }
  unmount();
  main.innerHTML = '';
  const def = G[v.g]; if (!def) { main.append(center('❔', '알 수 없는 게임')); return; }
  const inst = Object.create(def);
  const t = teamOf(S, ME[p.pid]?.me?.team ?? p.team);
  const gapi = {
    send: (m) => live.send({ t: 'in', pid: p.pid, run: RUN[p.pid], ...m }),
    now: () => live.now(), pid: p.pid, team: t, age: ME[p.pid]?.me?.age, get sfxOn() { return sfxOn; }, toast,
    teamName: (id) => { const x = teamOf(S, id); return `${x.icon}${x.name}`; },
    teamColor: (id) => teamOf(S, id).color,
    motion: S.settings.motion || 'auto',
    ghosts: () => { const m = LB[p.pid]; return m && m.run === RUN[p.pid] ? m : null; }, // 같은 게임 다른 참가자(내 앞뒤) — 게임 화면 안 고스트용
  };
  const box = h('div', { class: 'game', style: { '--tc': t.color } });
  const prac = S.practice?.on ? h('div', { class: 'pracbar' }, h('b', {}, `🧪 연습 ${(S.practice.done || 0) + 1}/${S.practice.max}`), h('span', {}, '점수·순위에 안 들어가요'), h('button', { class: 'pracskipbtn', onclick: () => { SKIPPRAC.add(RUN[p.pid]); unmount(); main.innerHTML = ''; renderGame(); } }, '건너뛰기 ⏭')) : null;
  main.append(...(prac ? [prac] : []), timerBar(), h('div', { class: `lbar ${RACE.has(v.g) ? 'race' : ''}` }), box); header(); liveBar(); // 순위 줄 자리는 처음부터 잡아 둠 → 1초 뒤 순위가 와도 게임 화면이 밀리지 않음 // ❓ 도움 버튼은 맨 위 줄(☰ 옆)에 — 게임 화면 높이를 줄이지 않음
  try { inst.mount(box, v, gapi); } catch (e) { try { inst.unmount?.(); } catch { /* */ } return gameFail(main, v.g, e); }
  mounted = { key, inst, pid: p.pid }; window.__game = inst; // 점검용
  document.body.classList.add('ingame'); // 게임 중: 폰을 가로로 돌리면 '세로로 돌려 주세요' 안내
}
const DEMO_OK = (g) => !!demoText(g, 'elem');
// 게임 중 도움말: 게임은 계속 진행 (멈추지 않음) · 닫기 버튼 또는 바깥을 누르면 닫힘
function helpSheet(g, color) {
  if (document.querySelector('.helpsheet')) return;
  const tx = demoText(g, S.settings.mode); const body = h('div', {});
  const m = h('div', { class: 'helpsheet', onclick: (e) => { if (e.target === m) close(); } }, h('div', { class: 'hsbox' }, h('b', {}, `❓ ${S.item?.name || ''} 하는 방법`), h('div', { class: 'muted small' }, `🏆 ${tx.goal} · ${tx.score}`), body, h('button', { class: 'btn wide', onclick: () => close() }, '알겠어요! 계속하기')));
  const d = mountDemo(body, g, { mode: S.settings.mode, color, sec: S.settings.previewSec || 6, h });
  const close = () => { d.stop(); m.remove(); };
  document.body.append(m);
}
// 이번 게임 실시간 순위 (서버가 1초마다 보냄): 우리 팀 순위·1위와 차이 · 내 순위·앞사람과 차이 · 1~3등 (🤖 = 컴퓨터 상대)
const LB = {};
// 달리기·오르기·계주처럼 '얼마나 앞서 있나'가 중요한 게임: 작은 트랙에 앞선 사람(또는 팀)과 나의 위치를 점으로 (1등 = 오른쪽 끝)
const RACE = new Set(['runner', 'stairs', 'flappy', 'bridge', 'towerup', 'relay', 'rope', 'tug', 'ljump', 'sync', 'balloon', 'curling', 'basket', 'penalty', 'tuho', 'bowl', 'fishing']);
function lanes(m, p, g, myT) {
  const box = h('div', { class: 'lanes' });
  const teamRace = !m.top.length || ['relay', 'rope', 'tug', 'sync'].includes(g);
  if (teamRace) { const mx = Math.max(1e-9, ...m.tm.map((x) => x[1])); for (const [id, v] of m.tm.slice(0, 6)) { const t = teamOf(S, id); box.append(lane(`${t.icon} ${t.name}`, mx ? v / mx : 0, t.color, id === myT, `${v}`)); } return box; }
  const span = Math.max(1e-9, m.hi - m.lo); const pos = (raw) => (m.asc ? (m.hi - raw) / span : (raw - m.lo) / span); // 낮을수록 좋은 기록이면 거꾸로
  const rows = m.top.map(([n, sc, ai, t], i) => ({ n: (ai ? '🤖' : '') + n, sc, t, me: !!m.me && i === m.me.i }));
  if (m.me && !rows.some((r) => r.me)) rows.push({ n: '나', sc: m.me.raw, t: myT, me: true, rank: m.me.rank });
  for (const r of rows.slice(0, 5)) box.append(lane(r.me ? `나${r.rank ? ` ${r.rank}위` : ''}` : r.n, Math.max(0.03, pos(r.sc)), teamOf(S, r.t).color, r.me, `${r.sc}`));
  return box;
}
const lane = (label, k, col, me, val) => h('div', { class: `lane ${me ? 'me' : ''}` }, h('span', { class: 'ln' }, label), h('span', { class: 'lt' }, h('i', { style: { left: `${Math.round(Math.min(1, Math.max(0, k)) * 100)}%`, background: col } })), h('b', {}, val));
function liveBar() {
  const el = $('.lbar'); if (!el) return; const p = active(); const m = LB[p?.pid];
  if (!m || m.run !== RUN[p.pid] || !S || S.phase !== 'playing') { el.style.visibility = 'hidden'; return; }
  const myT = ME[p.pid]?.me?.team ?? p.team; const ti = m.tm.findIndex((x) => x[0] === myT); const parts = [];
  if (ti >= 0 && m.tm.length > 1) { const sc = m.tm[ti][1]; const rank = 1 + m.tm.filter((x) => x[1] > sc).length; const g = Math.round((m.tm[0][1] - sc) * 10) / 10; parts.push(h('span', { class: 'lbt' }, h('i', {}, '팀'), `${rank}위/${m.tm.length}`, h('small', {}, rank === 1 ? (m.tm.length > 1 && m.tm[1][1] === sc ? ' 동점' : ' 선두') : ` 1위와 −${g}`))); }
  if (m.me && m.me.n > 1) parts.push(h('span', { class: 'lbm' }, h('i', {}, '나'), `${m.me.rank}위/${m.me.n}`, h('small', {}, m.me.rank === 1 ? ' 1등!' : ` 앞 ${m.me.ai ? '🤖' : ''}${m.me.ahn}와 ${m.me.ah}`)));
  const g = VIEW[p.pid]?.g; let top = null; el.classList.toggle('race', RACE.has(g));
  if (RACE.has(g) && (m.top.length || m.tm.length > 1)) top = lanes(m, p, g, myT);
  else if (m.top.length) top = h('div', { class: 'lbtop' }, ...m.top.slice(0, 3).map(([n, sc, ai, t], i) => h('span', { style: { '--c': teamOf(S, t).color } }, ['🥇', '🥈', '🥉'][i], ai ? '🤖' : '', n, h('b', {}, ` ${sc}`))));
  el.style.visibility = parts.length ? '' : 'hidden'; el.innerHTML = ''; el.append(h('div', { class: 'lbrow' }, ...parts), top);
}
function timerBar() { return h('div', { class: `gtimer ${S.run?.endAt ? '' : 'hidden'}` }, h('div', { class: 'gbar' }), h('span', { class: 'gsec' })); }

function tickClock() {
  if (!S || !live) return;
  const now = live.now();
  if (S.phase === 'countdown') {
    const n = Math.ceil((S.phaseEnd - now) / 1000);
    const el = $('.cdn'); if (el && el.textContent !== String(Math.max(1, n))) { el.textContent = String(Math.max(1, n)); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); sfx('count', sfxOn); vibrate(20); }
  }
  if (S.phase === 'playing' && S.run?.endAt && !S.paused) {
    const left = S.run.endAt - now; const total = S.run.endAt - S.run.startAt;
    const bar = $('.gbar'); const sec = $('.gsec');
    if (bar) { bar.style.width = `${Math.max(0, Math.min(100, (left / total) * 100))}%`; bar.classList.toggle('hurry', left < 5000); }
    if (sec) sec.textContent = `${Math.max(0, Math.ceil(left / 1000))}초`;
    const s = Math.ceil(left / 1000);
    if (s <= 5 && s > 0 && tickClock.last !== s) { tickClock.last = s; sfx('hurry', sfxOn); }
  }
}
void say;

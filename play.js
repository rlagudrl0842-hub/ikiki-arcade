// 참가자 폰 화면
import { $, h, Live, api, store, sfx, say, vibrate, audioUnlock, AGE, teamOf, confetti } from './client.js';
import { G } from './play-games.js';

const app = $('#app');
const params = new URLSearchParams(location.search);
const code = (params.get('e') || params.get('code') || '').toUpperCase();
const KEY = 'ikiki:' + code;
let dev = store('ikiki:dev'); if (!dev) { dev = Math.random().toString(36).slice(2) + Date.now().toString(36); store('ikiki:dev', dev); }

let sess = code ? store(KEY) : null;        // {eventId, players:[{pid,secret,name,team,age}], active}
let live = null, S = null;                   // S = 서버 공개 상태
const ME = {}; const VIEW = {}; const RUN = {};
let mounted = null;                           // {key, inst, pid}
let lastPhaseKey = '';
let sfxOn = true;

document.addEventListener('pointerdown', () => audioUnlock(), { capture: true });

function toast(msg, ms = 2200) { const t = h('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), ms); }
const active = () => sess?.players?.find((p) => p.pid === sess.active) || sess?.players?.[0];

// ---------------- 시작 ----------------
if (!code) renderCodeEntry();
else if (sess?.players?.length) connect();
else renderJoin();

function renderCodeEntry() {
  app.innerHTML = '';
  const inp = h('input', { class: 'inp code', maxlength: 6, placeholder: '참가 코드 6자리', autocapitalize: 'characters', autocomplete: 'off' });
  const go = () => { const v = inp.value.trim().toUpperCase(); if (v.length >= 4) location.href = '/play.html?e=' + encodeURIComponent(v); };
  inp.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  app.append(h('main', { class: 'join' }, logo(), h('p', { class: 'muted' }, 'QR을 찍거나 큰 화면의 참가 코드를 입력하세요'), inp, h('button', { class: 'btn wide', onclick: go }, '입장하기')));
}
function logo() { return h('div', { class: 'brand big' }, '⚡ 아이키키 ', h('b', {}, '팀 대항 오락실')); }

async function renderJoin(addMode = false) {
  app.innerHTML = '';
  const wrap = h('main', { class: 'join' }, logo(), h('p', { class: 'muted' }, '불러오는 중…'));
  app.append(wrap);
  let info;
  try { info = await api('/api/public/' + encodeURIComponent(code)); } catch (e) { wrap.innerHTML = ''; wrap.append(logo(), h('p', {}, e.message), h('button', { class: 'btn', onclick: () => (location.href = '/play.html') }, '코드 다시 입력')); return; }
  if (info.phase === 'ended') { wrap.innerHTML = ''; wrap.append(logo(), h('h2', {}, info.name), h('p', {}, '행사가 끝났어요. 참가해 주셔서 고마워요!')); return; }
  document.body.classList.toggle('kid', info.mode === 'kid');
  let team = null, age = info.mode === 'mixed' ? null : info.mode;
  const name = h('input', { class: 'inp', maxlength: 12, placeholder: info.mode === 'kid' ? '아이 이름' : '이름 (닉네임)', autocomplete: 'off' });
  const teams = h('div', { class: 'teampick' });
  info.teams.forEach((t) => {
    const b = h('button', { class: 'tp', style: { '--tc': t.color } }, h('span', { class: 'ti' }, t.icon), h('b', {}, t.name), h('small', {}, `${info.counts[t.id]?.total || 0}명`));
    b.onclick = () => { team = t.id; teams.querySelectorAll('.tp').forEach((x) => x.classList.toggle('sel', x === b)); };
    teams.append(b);
  });
  const ages = h('div', { class: 'agepick' });
  if (info.mode === 'mixed') [['kid', '🧸', '유아'], ['elem', '🎒', '초등'], ['adult', '🧑', '어른']].forEach(([k, e, l]) => {
    const b = h('button', { class: 'ap' }, h('span', {}, e), l); b.onclick = () => { age = k; ages.querySelectorAll('.ap').forEach((x) => x.classList.toggle('sel', x === b)); }; ages.append(b);
  });
  const err = h('div', { class: 'err' });
  const btn = h('button', { class: 'btn wide' }, addMode ? '이 아이도 참가 ➕' : '참가하기 🎮');
  btn.onclick = async () => {
    err.textContent = '';
    if (!name.value.trim()) { err.textContent = '이름을 입력해 주세요'; name.focus(); return; }
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
    addMode ? h('button', { class: 'btn ghost wide', onclick: () => connect() }, '취소') : h('p', { class: 'muted small' }, '이름은 행사 진행에만 쓰이고, 행사가 끝나면 지울 수 있어요'));
  name.focus();
}

// ---------------- 연결 ----------------
function connect() {
  app.innerHTML = '';
  app.append(h('div', { class: 'top' }), h('main', { id: 'main' }), h('div', { id: 'bar' }));
  if (live) live.stop();
  live = new Live(() => ({ t: 'hello', role: 'player', eid: sess.eventId, players: sess.players.map((p) => ({ pid: p.pid, secret: p.secret })) }), onMsg, onStatus);
  setInterval(tickClock, 200);
}
function onStatus(st, code) {
  document.body.classList.toggle('offline', st === 'offline');
  if (st === 'offline' && code === 4004) { store(KEY, null); toast('행사가 삭제되었어요'); }
}
function onMsg(m) {
  if (m.t === 'err') {
    if (m.code === 404) { // 참가 정보 없음 → 다시 참가
      store(KEY, null); sess = null; live?.stop(); live = null; toast(m.msg); renderJoin(); return;
    }
    toast(m.msg); return;
  }
  if (m.t === 'state') { const prev = S; S = m; onState(prev); return; }
  if (m.t === 'me') { ME[m.pid] = m; const sp = sess.players.find((p) => p.pid === m.pid); if (sp) { sp.team = m.me.team; sp.name = m.me.name; store(KEY, sess); } if (m.game) VIEW[m.pid] = m.game; render(); return; }
  if (m.t === 'g') {
    if (m.v) { VIEW[m.pid] = m.v; RUN[m.pid] = m.run; }
    if (m.pid === active()?.pid) {
      if (m.v) renderGame();
      if (m.r && mounted?.inst?.reply) mounted.inst.reply(m.r);
    }
  }
}

function onState(prev) {
  sfxOn = S.settings.sfx;
  const me = ME[active()?.pid]?.me;
  document.body.classList.toggle('kid', S.settings.mode === 'kid' || me?.age === 'kid');
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
  top.append(h('div', { class: 'tm' }, h('span', { class: 'ti' }, t.icon), h('b', {}, t.name)), h('div', { class: 'nm' }, me?.name || p?.name || '', me?.rep ? h('span', { class: 'rep' }, '👑대표') : null),
    h('button', { class: 'menu', onclick: openMenu }, '☰'));
  const bar = $('#bar'); bar.innerHTML = '';
  if (sess.players.length > 1) {
    bar.append(...sess.players.map((x) => h('button', { class: `pch ${x.pid === p.pid ? 'on' : ''}`, style: { '--tc': teamOf(S, ME[x.pid]?.me?.team ?? x.team).color }, onclick: () => { sess.active = x.pid; store(KEY, sess); unmount(); render(); } }, x.name)));
  }
}
function openMenu() {
  const m = h('div', { class: 'sheet' },
    h('button', { class: 'btn ghost wide', onclick: () => { m.remove(); renderJoin(true); } }, '👩‍🏫 아이 추가 (보조 모드)'),
    h('button', { class: 'btn ghost wide', onclick: () => { sfxOn = !sfxOn; m.remove(); toast(sfxOn ? '효과음 켬' : '효과음 끔'); } }, '🔊 효과음 켜기/끄기'),
    h('button', { class: 'btn ghost wide', onclick: () => { if (confirm('이 폰에서 참가 정보를 지울까요? (점수는 남아요)')) { store(KEY, null); location.reload(); } } }, '🚪 이 폰에서 나가기'),
    h('button', { class: 'btn wide', onclick: () => m.remove() }, '닫기'));
  document.body.append(m);
}

function render() {
  if (!S) return;
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
    cheerBtn(t), mini());
  return el;
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
function mini() {
  const rows = S.standings.rows;
  const me = ME[active().pid]?.me;
  return h('div', { class: 'mini' }, h('div', { class: 'mh' }, `종합 순위 · ${S.standings.played}게임 진행`),
    rows.map((r) => { const t = teamOf(S, r.id); return h('div', { class: `mr ${r.id === me?.team ? 'mine' : ''}`, style: { '--tc': t.color } }, h('b', {}, `${r.rank}`), h('span', {}, `${t.icon} ${t.name}`), h('em', {}, `${r.total}점`)); }));
}
function intro() {
  const it = S.item; if (!it) return center('🎮', '곧 시작해요');
  const me = ME[active().pid]?.me;
  return h('div', { class: 'intro' }, h('div', { class: 'ie' }, it.emoji), h('div', { class: 'in' }, `GAME ${String(it.no).padStart(2, '0')}`), h('div', { class: 'it' }, it.name),
    h('div', { class: 'ir' }, it.rule), it.weight > 1 ? h('div', { class: 'chip big' }, `🔥 점수 ${it.weight}배!`) : null, it.durSec ? h('div', { class: 'muted' }, `⏱ ${it.durSec}초`) : null,
    h('div', { class: 'ready' }, me?.rep && it.team ? '👑 당신은 팀 대표예요!' : '준비하세요! 곧 시작합니다'), cheerBtn(teamOf(S, me?.team)));
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
  if (my) el.append(h('div', { class: 'mine' }, '내 기록: ', h('b', {}, my.show ?? my.raw)));
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
  return h('div', { class: 'center' }, h('div', { class: 'cic' }, '🎉'), h('div', { class: 'ct' }, '참가해 줘서 고마워요!'), r ? h('div', { class: 'muted' }, `${t.icon} ${t.name} 최종 ${r.rank}위 · ${r.total}점`) : null, mini());
}

// ---------------- 게임 ----------------
function unmount() { if (mounted) { try { mounted.inst.unmount?.(); } catch { /* */ } mounted = null; } }
function renderGame() {
  const main = $('#main'); if (!main || !S) return;
  const p = active(); const v = VIEW[p.pid];
  if (S.phase === 'countdown' || !v) {
    if (S.phase === 'countdown') { unmount(); if (!main.querySelector('.cd')) { main.innerHTML = ''; main.append(h('div', { class: 'cd' }, h('div', { class: 'cdn' }, '3'), h('div', { class: 'muted' }, S.item ? `${S.item.emoji} ${S.item.name}` : ''))); } }
    else if (!mounted) { main.innerHTML = ''; main.append(center('⏳', '게임 화면을 불러오는 중…')); }
    return;
  }
  if (v.spectator) { unmount(); main.innerHTML = ''; main.append(center('👀', '이번 게임은 관전해요', '게임 중간에 들어와서 다음 게임부터 참여해요')); return; }
  const key = `${RUN[p.pid]}:${v.g}:${p.pid}`;
  if (mounted?.key === key) { mounted.inst.update?.(v); return; }
  unmount();
  main.innerHTML = '';
  const def = G[v.g]; if (!def) { main.append(center('❔', '알 수 없는 게임')); return; }
  const inst = Object.create(def);
  const t = teamOf(S, ME[p.pid]?.me?.team ?? p.team);
  const gapi = {
    send: (m) => live.send({ t: 'in', pid: p.pid, run: RUN[p.pid], ...m }),
    now: () => live.now(), team: t, age: ME[p.pid]?.me?.age, get sfxOn() { return sfxOn; }, toast,
    teamName: (id) => { const x = teamOf(S, id); return `${x.icon}${x.name}`; },
  };
  const box = h('div', { class: 'game', style: { '--tc': t.color } });
  main.append(timerBar(), box);
  inst.mount(box, v, gapi);
  mounted = { key, inst, pid: p.pid };
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

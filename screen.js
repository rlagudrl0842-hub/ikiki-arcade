// 대형 화면 (프로젝터·TV)
import { $, h, Live, api, store, sfx, say, audioUnlock, audioReady, teamOf, confetti, MODE, qrImg, setSfxVolume, quickKey } from './client.js';
import * as BGM from './bgm.js';
import { V, leaderOf } from './screen-games.js';
import './screen-n.js';
import './screen-n2.js';
import './screen-n3.js';
import './screen-n4.js';
import { mountPeTutorial } from './screen-pe2.js';
import { PE_BY, AGE_NAME } from './pe2data.js';
import { mountDemo, demoText } from './preview.js';
// 노트북에서 직접 실행(localhost)하면 폰은 localhost로 못 들어오므로, 참가 QR에는 이 노트북의 같은 와이파이 주소를 씀
let localBase = '';
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) fetch('/api/info').then((r) => r.json()).then((r) => { if (r.lan?.[0]) localBase = r.lan[0]; }).catch(() => {});

const params = new URLSearchParams(location.search);
const code = (params.get('e') || '').toUpperCase();
const stage = $('#stage');
let S = null, live = null, cur = null, lastKey = '', lastLeader = null, lastLeadAt = 0, joinUrl = '';
const fit = () => { const s = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = `translate(-50%, -50%) scale(${s})`; };
addEventListener('resize', fit); fit();

const sfxOn = () => S?.settings?.sfx !== false;
const voiceOn = () => S?.settings?.voice !== false;
const team = (id) => teamOf(S, id);
const sayV = (t, r) => { if (voiceOn() && t) BGM.voice(Math.min(6, 0.9 + String(t).length * 0.13)); say(t, voiceOn(), r); };
// 게임 화면에서 쓰는 음악 조작: hold(true) = 얼음!처럼 음악 뚝 멈춤, active() = 배경음악이 나오는 중인지
const bgmApi = { hold: (on) => BGM.hold(on), active: () => !!(BGM.status().playing || BGM.status().held) };
const ctx = { now: () => live.now(), get teams() { return S.teams; }, team, sfx: (n) => sfx(n, sfxOn()), say: sayV, bgm: bgmApi };

// 소리 켜기 (브라우저 자동재생 제한 때문에 한 번 클릭 필요)
const gate = $('#gate');
// 혼자 테스트·미리보기 안에 넣은 화면: 안내 덮개 없이, 바깥 화면에서 '시작'을 누르면 소리 켜기 (iframe allow=autoplay)
if (new URLSearchParams(location.search).has('embed')) {
  gate.classList.add('hidden'); document.body.classList.add('embed');
  addEventListener('message', (e) => { if (e.origin === location.origin && e.data === 'unlock') { audioUnlock(); BGM.preloadAll(nextIds()); setTimeout(audioSync, 50); } });
}
gate.addEventListener('click', () => { audioUnlock(); BGM.preloadAll(nextIds()); setTimeout(audioSync, 50); gate.classList.add('hidden'); try { document.documentElement.requestFullscreen?.(); } catch { /* */ } say('아이키키 팀 대항 오락실을 시작합니다', voiceOn()); });
addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }
  if (!gate.classList.contains('hidden')) { audioUnlock(); BGM.preloadAll(nextIds()); setTimeout(audioSync, 50); gate.classList.add('hidden'); }
  // 진행자 단축키 (관리자 로그인 상태에서만)
  const tok = store('ikiki:admin');
  if (!tok || !S) return;
  if (quickKey(e, S, tok)) return; // 프로젝터 전체 화면 그대로 퀵 점수 (화면에 조작 버튼은 안 보임)
  if (e.key === 'm' || e.key === 'M') { e.preventDefault(); api(`/api/events/${S.event.id}/update`, { settings: { duck: !S.settings.duck } }, tok).catch((err) => flash(err.message)); return; }
  const op = { ' ': 'next', p: 'pause', P: 'pause', e: 'endNow', E: 'endNow' }[e.key];
  if (!op) return;
  e.preventDefault();
  if (e.repeat || (window.__lastKey && window.__lastKey.op === op && Date.now() - window.__lastKey.at < 700)) return; // 연타·누르고 있기 = 한 번
  window.__lastKey = { op, at: Date.now() };
  const real = op === 'pause' && S.paused ? 'resume' : op;
  // 게임 중 끝내기는 실수 방지: 2초 안에 한 번 더 눌러야 끝남 (빔 화면이라 확인 창 대신 안내 글)
  if ((real === 'endNow' || (real === 'next' && S.phase === 'playing')) && ['playing', 'countdown'].includes(S.phase)) {
    if (!window.__endArm || Date.now() - window.__endArm > 2000) { window.__endArm = Date.now(); window.__lastKey = null; flash('한 번 더 누르면 게임을 끝내요'); return; }
    window.__endArm = 0;
  }
  api(`/api/events/${S.event.id}/command`, { op: real, seq: S.seq }, tok).catch((err) => flash(err.message));
});

if (!code) { stage.innerHTML = ''; stage.append(h('div', { class: 'center' }, h('h1', {}, '행사 코드가 필요해요'), h('p', {}, '진행자 화면의 [대형 화면 열기] 버튼으로 열어 주세요'))); }
else live = new Live({ t: 'hello', role: 'screen', code }, onMsg, (st) => document.body.classList.toggle('offline', st === 'offline'));

// 지금·다음 게임 곡만 미리 받기
const nextIds = () => (S ? [S.playlist?.[S.idx], S.playlist?.[S.idx + 1]].filter(Boolean).map((p) => BGM.pick(S.settings, p.game, customList)?.id) : []);
function onMsg(m) {
  if (m.t === 'state') { const prev = S; S = m; if (prev && prev.idx !== S.idx && gate.classList.contains('hidden')) BGM.preloadAll(nextIds()); joinUrl = (S.settings.joinUrl || localBase || location.origin) + '/play.html?e=' + S.event.code; render(prev); quickFx(prev); return; }
  if (m.t === 'live' && cur?.inst && S?.phase === 'playing' && m.run === S.run?.id) {
    const vals = cur.inst.update(m.s);
    if (vals) overtake(vals);
    cheerGauge(m.cheer);
  }
  if (m.t === 'err') flash(m.msg);
}

// 진행자 퀵 점수: 프로젝터에는 조작 버튼 없이 '팀 +3' 알림과 팀 점수판만 잠깐 보여 줌
let qfxSeen = null;
function quickFx(prev) {
  const f = S.quickFx;
  if (qfxSeen == null) { qfxSeen = f ? f.id : 0; return; } // 처음 연 화면에서는 예전 알림을 다시 띄우지 않음
  if (!f) return;
  if (f.id === qfxSeen || Date.now() - f.at > 6000) return; qfxSeen = f.id;
  const t = teamOf(S, f.team); sfx(f.delta > 0 ? 'good' : 'bad', S.settings.sfx);
  let box = document.querySelector('.qfx'); if (!box) { box = h('div', { class: 'qfx' }); document.body.append(box); }
  const tot = Object.fromEntries((S.standings.rows || []).map((r) => [r.id, r]));
  box.innerHTML = '';
  box.append(h('div', { class: 'qfxbig', style: { '--tc': t.color } }, h('span', {}, `${t.icon} ${t.name}`), h('b', {}, `${f.delta > 0 ? '+' : ''}${f.delta}`), f.undo ? h('small', {}, '정정') : null),
    h('div', { class: 'qfxrank' }, ...S.teams.slice().sort((a, b) => (tot[a.id]?.rank ?? 99) - (tot[b.id]?.rank ?? 99)).map((tm) => h('div', { class: `qfxr ${tm.id === f.team ? 'on' : ''}`, style: { '--tc': tm.color } }, h('i', {}, `${tot[tm.id]?.rank ?? '-'}위`), h('span', {}, `${tm.icon} ${tm.name}`), h('b', {}, `${tot[tm.id]?.total ?? 0}`)))));
  box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
  clearTimeout(quickFx.t); quickFx.t = setTimeout(() => box.classList.remove('show'), 3200);
}
function flash(msg) { const t = h('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), 3000); }

function overtake(vals) {
  const l = leaderOf(vals);
  if (l == null || l === lastLeader) return;
  const was = lastLeader; lastLeader = l;
  if (was == null || Date.now() - lastLeadAt < 1500) { lastLeadAt = Date.now(); return; }
  lastLeadAt = Date.now();
  const t = team(l);
  const b = h('div', { class: 'overtake', style: { '--tc': t.color } }, `🔥 ${t.icon} ${t.name} 역전!`);
  stage.append(b); setTimeout(() => b.remove(), 1800);
  sfx('lead', sfxOn());
}

function render(prev) {
  // 일시정지·재개는 화면을 새로 만들지 않음 (게임 화면이 깜빡이며 처음부터 다시 그려지던 문제)
  const key = `${S.phase}:${S.idx}:${S.ceremonyStep}:${S.run?.id ?? ''}:${S.phaseAt ?? ''}`;
  const phaseChanged = key !== lastKey; lastKey = key;
  const pauseChanged = !!S.paused !== render.wasPaused; render.wasPaused = !!S.paused;
  audioLevels();
  if (phaseChanged) {
    unmount();
    stage.innerHTML = '';
    ({ lobby, intro, countdown, playing, results, ceremony, ended })[S.phase]?.(prev);
  } else if (S.phase === 'lobby') {
    // 대기 화면에서 설정(연령 모드·행사 이름·참가 주소)이 바뀌면 바로 다시 그림
    const lk = `${S.settings.mode}|${S.event.name}|${joinUrl}|${S.settings.device}`;
    if (lk !== render.lobbyKey) { stage.innerHTML = ''; lobby(); } else updateLobby();
  }
  // 화면을 새로 그린 뒤에 덮개를 올려야 지워지지 않음 (전에는 일시정지 표시가 바로 지워졌음)
  pauseLayer();
  cheerEventLayer();
  if (phaseChanged || pauseChanged) audioSync();
}

// ---------------- 배경음악 ----------------
let customList = [];
BGM.listCustom().then((l) => { customList = l; });
// 사회자 화면(같은 브라우저)에서 곡을 넣거나 지우거나 이름·음량을 바꾸면 바로 반영
try { new BroadcastChannel('ikiki-music').onmessage = () => BGM.listCustom().then((l) => { customList = l; if (S) audioSync(); }); } catch { /* */ }
const trackNow = () => { const g = S.run?.game || S.item?.game; return g ? BGM.pick(S.settings, g, customList) : null; };
function audioLevels() {
  BGM.setVolume((S.settings.bgmVol ?? 70) / 100); setSfxVolume((S.settings.sfxVol ?? 80) / 100);
  BGM.duck(!!S.settings.duck);
  let b = $('#duckb'); if (S.settings.duck && !b) document.body.append(h('div', { id: 'duckb' }, '🎤 선생님 말씀 중 · 음악 작게')); else if (!S.settings.duck && b) b.remove();
}
// 지금 단계에 맞는 음악 상태로 맞춤 (한 곳에서만 결정 → 겹침·누락 없음)
function audioSync() {
  if (!S || !audioReady()) return;
  const ph = S.phase; const tr = trackNow();
  stage.dataset.mood = ['intro', 'countdown', 'playing'].includes(ph) ? tr?.mood || 'none' : '';
  if (ph === 'countdown') {
    BGM.stopFanfare(0.4);
    if (S.paused || !tr) { BGM.stop(0.3); return; }
    // GO! 순간에 곡의 첫 박이 딱 떨어지도록 예약
    const a = BGM.status(); const lead = Math.max(0, (S.phaseEnd - live.now()) / 1000);
    if (a.track !== tr.id) BGM.play(tr, { at: (a.now ?? 0) + lead, offset: tr.cue || 0, fadeIn: 0.02, restart: true });
    return;
  }
  if (ph === 'playing') {
    BGM.stopFanfare(0.4);
    if (S.paused) { BGM.pause(); return; }
    if (!tr) { BGM.stop(0.5); return; }
    const st = BGM.status();
    if (st.track === tr.id || st.held) return;
    if (st.paused?.id === tr.id && BGM.resume()) return;
    const el = Math.max(0, (live.now() - (S.run?.startAt || live.now())) / 1000);
    BGM.play(tr, { offset: (tr.cue || 0) + el, fadeIn: 0.6, restart: true }); // 화면을 새로 열었을 때: 진행 시간에 맞춰 이어서
    return;
  }
  if (ph === 'results') { if (!S.paused) BGM.stop(1.4); return; }
  if (ph === 'ceremony') { BGM.stop(0.8); return; }
  BGM.stop(1.0); BGM.stopFanfare(1.0); // 대기·설명·종료
}
// 음악 박자에 맞춰 화면 테두리·배경이 번쩍
// (성능) 테두리 빛은 opacity만 바꿈 + 값이 거의 같으면 건드리지 않음 + 초당 30번까지
const beatEl = document.createElement('div'); beatEl.id = 'beatfx'; stage.append(beatEl);
let beatLast = -1, beatAt = 0;
(function beatLoop(t) {
  if (t - beatAt >= 33) { beatAt = t; const v = Math.round(BGM.level() * 20) / 20; if (v !== beatLast) { beatLast = v; beatEl.style.opacity = String(v * 0.9); } if (!beatEl.isConnected) stage.append(beatEl); }
  requestAnimationFrame(beatLoop);
})(0);
function trophy(color) {
  const t = h('div', { class: 'trophy', style: { '--tc': color } }, h('div', { class: 'tray' }), h('div', { class: 'tcup' }, '🏆'));
  document.body.append(t); setTimeout(() => t.remove(), 4200);
}
function unmount() { if (cur?.inst?.unmount) cur.inst.unmount(); cur = null; clearInterval(render.t); render.demo?.stop?.(); render.demo = null; }

function topbar(extra) {
  return h('div', { class: 'topbar' }, h('div', { class: 'logo' }, h('span', { class: 'ikl' }, h('img', { src: '/logo.png', alt: '아이키키' })), h('b', {}, '팀 대항 오락실')), h('div', { class: 'evn' }, S.event.name), extra || null,
    h('div', { class: 'joinmini' }, `참가 코드 `, h('b', {}, S.event.code)));
}

// ---------------- 대기 ----------------
function lobby() {
  render.lobbyKey = `${S.settings.mode}|${S.event.name}|${joinUrl}|${S.settings.device}`;
  const qr = qrImg(joinUrl, 'qr');
  if (S.settings.device === 'nophone') {
    // 휴대폰 없이 진행: QR 대신 팀 소개·진행 방법
    const left2 = h('div', { class: 'lleft nophone' }, h('div', { class: 'lt' }, '📋 휴대폰 없이 진행해요'), h('div', { class: 'npbig' }, '🙌'), h('div', { class: 'npnote' }, '큰 화면을 보고 팀끼리 함께! 점수는 진행자 선생님이 넣어요'), h('div', { class: 'npnote small' }, '골든벨: 팀마다 종이·보드에 답을 가려 적고 "공개!"에 맞춰 동시에 들어요'));
    stage.append(topbar(h('div', { class: 'mode' }, MODE[S.settings.mode])), h('div', { class: 'lobbyv' }, left2, h('div', { class: 'lright' }, h('div', { id: 'lteams' }), h('div', { id: 'lnext' }), h('div', { id: 'lnote' }))));
    return updateLobby();
  }
  const left = h('div', { class: 'lleft' }, h('div', { class: 'lt' }, '📱 QR을 찍고 참가하세요!'), qr, h('div', { class: 'lurl' }, joinUrl.replace(/^https?:\/\//, '')), h('div', { class: 'lcode' }, '참가 코드 ', h('b', {}, S.event.code)));
  const right = h('div', { class: 'lright' }, h('div', { id: 'lteams' }), h('div', { id: 'lnext' }), h('div', { id: 'lnote' }));
  stage.append(topbar(h('div', { class: 'mode' }, MODE[S.settings.mode])), h('div', { class: 'lobbyv' }, left, right));
  updateLobby();
}
function updateLobby() {
  const box = $('#lteams'); if (!box) return;
  const rows = S.standings.rows;
  const played = S.standings.played;
  const total = Object.values(S.counts).reduce((s, c) => s + c.total, 0);
  box.innerHTML = '';
  box.append(h('div', { class: 'lh' }, played ? `🏆 종합 순위 · ${played}게임 진행` : `👥 참가 ${total}명`));
  const maxCheer = Math.max(1, ...Object.values(S.cheer || {}));
  for (const r of played ? rows : S.teams.map((t) => ({ id: t.id }))) {
    const t = team(r.id); const c = S.counts[t.id] || { total: 0, online: 0 };
    box.append(h('div', { class: 'lteam', style: { '--tc': t.color } }, played ? h('div', { class: 'lrk' }, `${r.rank}`) : null, h('div', { class: 'lic' }, t.icon), h('div', { class: 'lnm' }, t.name, h('small', {}, `${c.total}명`)),
      h('div', { class: 'lcheer' }, h('div', { style: { width: `${((S.cheer?.[t.id] || 0) / maxCheer) * 100}%` } }), h('span', {}, `📣 ${S.cheer?.[t.id] || 0}`)), played ? h('div', { class: 'lsc' }, `${r.total}점`) : null));
  }
  const nx = $('#lnext'); nx.innerHTML = '';
  if (S.item) nx.append(h('div', { class: 'nextg' }, '다음 게임 ', h('b', {}, `${S.item.emoji} ${S.item.name}`), h('small', {}, ` (${S.idx + 1}/${S.total})`)));
  const nt = $('#lnote'); nt.textContent = S.notice || '';
}

// ---------------- 게임 설명 ----------------
function intro() {
  const it = S.item; if (!it) return;
  const cnt = h('div', { class: 'icount' });
  const tx = demoText(it.game, S.settings.mode);
  const chips = h('div', { class: 'ichips' }, it.durSec ? h('span', { class: 'chip' }, `⏱ ${it.durSec}초`) : h('span', { class: 'chip' }, '🔁 라운드제'), it.weight !== 1 ? h('span', { class: 'chip hot' }, `🔥 점수 ${it.weight}배`) : null, it.team ? h('span', { class: 'chip' }, '🤝 팀 협동') : null, it.host ? h('span', { class: 'chip' }, '🎯 진행자 점수') : null, nowPlaying());
  const pe = PE_BY[it.game];
  if (pe && S.settings.preview !== false) {
    // 폰 없는 체육: 10~20초 시각 튜토리얼 (동작·성공·점수·안전) — 사회자가 [게임 시작]을 누르면 건너뜀
    const lv = { baby: 0, kid: 1, elem: 2, mid: 3, high: 4, adult: 5 }[S.settings.mode] ?? 2;
    const demo = h('div', { class: 'idemo pe' });
    stage.append(topbar(h('div', { class: 'mode' }, `GAME ${S.idx + 1} / ${S.total}`)), h('div', { class: 'introv2' }, demo,
      h('div', { class: 'iinfo' }, h('div', { class: 'in' }, `${it.emoji} ${pe.type} · ${S.settings.space === 'class' ? '🏫 교실' : '🏟️ 체육관'}`), h('div', { class: 'it' }, it.name),
        h('div', { class: 'igoal' }, h('b', {}, '🎤 '), pe.say), h('div', { class: 'iscore' }, h('b', {}, '🏆 이기는 팀 '), pe.win), h('div', { class: 'iscore' }, h('b', {}, '📊 점수 '), pe.score), chips,
        h('div', { class: 'ipv' }, '👀 설명 중 — 아직 시작 전이에요'), cnt)));
    render.demo = mountPeTutorial(demo, it.game, { lv, space: S.settings.space || 'gym' });
    sayV(`${it.name}! ${pe.say}`);
  } else if (S.settings.preview !== false && tx) {
    // 시범 미리보기 (점수·게임 시간은 아직 시작 안 함) + 팀 목표·이기는 방법·점수 기준
    const demo = h('div', { class: 'idemo' });
    stage.append(topbar(h('div', { class: 'mode' }, `GAME ${S.idx + 1} / ${S.total}`)), h('div', { class: 'introv2' },
      demo,
      h('div', { class: 'iinfo' }, h('div', { class: 'in' }, `${it.emoji} GAME ${String(it.no).padStart(2, '0')}`), h('div', { class: 'it' }, it.name),
        h('div', { class: 'igoal' }, h('b', {}, '🏆 팀 목표 '), tx.goal), h('div', { class: 'iscore' }, h('b', {}, '📊 점수 '), tx.score), chips, h('div', { class: 'ipv' }, '👀 시범 보기 — 아직 점수와 시간은 시작 안 했어요'), cnt)));
    render.demo = mountDemo(demo, it.game, { mode: S.settings.mode, sec: S.settings.previewSec || 6, big: true, h });
    sayV(`${it.name}! ${tx.goal}`);
  } else {
    stage.append(topbar(h('div', { class: 'mode' }, `GAME ${S.idx + 1} / ${S.total}`)), h('div', { class: 'introv' },
      h('div', { class: 'ie' }, it.emoji), h('div', { class: 'in' }, `GAME ${String(it.no).padStart(2, '0')}`), h('div', { class: 'it' }, it.name), h('div', { class: 'ir' }, it.rule),
      tx ? h('div', { class: 'igoal' }, h('b', {}, '🏆 '), tx.goal) : h('div', { class: 'ih' }, it.howto), chips, cnt));
    sayV(`${it.name}! ${it.rule}`);
  }
  render.t = setInterval(() => { cnt.textContent = S.phaseEnd && !S.paused ? `${Math.max(0, Math.ceil((S.phaseEnd - live.now()) / 1000))}초 뒤 시작` : '진행자가 시작 버튼을 누르면 시작해요'; }, 250);
}

function nowPlaying() {
  const tr = trackNow(); const m = BGM.MOODS[tr?.mood || 'none'];
  return h('span', { class: 'chip np', style: { '--mc': m.color } }, h('i', { class: 'eq' }, h('b'), h('b'), h('b')), tr ? `${tr.name} · ${m.label}` : m.label);
}
// ---------------- 카운트다운 ----------------
function countdown() {
  const n = h('div', { class: 'bigcd' }, '3');
  stage.append(h('div', { class: 'cdv' }, h('div', { class: 'cdg' }, `${S.item?.emoji || ''} ${S.item?.name || ''}`), n));
  let last = null;
  render.t = setInterval(() => {
    const s = Math.ceil((S.phaseEnd - live.now()) / 1000);
    const v = s > 0 ? String(s) : 'GO!';
    if (v !== last) { last = v; n.textContent = v; n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop'); sfx(s > 0 ? 'count' : 'go', sfxOn()); if (s > 0) say(['', '하나', '둘', '셋'][s] || '', voiceOn(), 1.3); }
  }, 80);
}

// ---------------- 게임 중 ----------------
function playing() {
  const g = S.run?.game; const def = V[g];
  const hud = h('div', { class: 'hud' }, h('span', { class: 'ikl' }, h('img', { src: '/logo.png', alt: '아이키키' })), h('div', { class: 'hg' }, `${S.item?.emoji || ''} ${S.item?.name || ''}`), nowPlaying(), h('div', { class: 'htime' }), h('div', { class: 'hbar' }, h('div', {})));
  const body = h('div', { class: 'gbody' });
  const cheer = h('div', { class: 'cheerbar' });
  stage.append(hud, body, cheer);
  lastLeader = null;
  if (def) { const inst = Object.create(def); inst.mount(body, ctx); cur = { inst, g }; }
  let lastS = null;
  render.t = setInterval(() => {
    if (!S.run?.endAt || S.paused) { hud.querySelector('.htime').textContent = S.paused ? '⏸' : ''; return; }
    const left = S.run.endAt - live.now(); const total = S.run.endAt - S.run.startAt;
    const s = Math.max(0, Math.ceil(left / 1000));
    hud.querySelector('.htime').textContent = `${s}`;
    hud.classList.toggle('hurry', s <= 10);
    stage.classList.toggle('last10', s <= 10 && s > 0);
    hud.querySelector('.hbar div').style.width = `${Math.max(0, (left / total) * 100)}%`;
    // 마지막 10초 경고: 10~4초 째깍, 3·2·1은 강하게 + 음성
    if (s <= 10 && s > 0 && s !== lastS) { lastS = s; sfx(s <= 3 ? 'tock' : 'tick', sfxOn()); stage.classList.remove('tickp'); void stage.offsetWidth; stage.classList.add('tickp'); if (s === 10) sayV('10초 남았어요!', 1.2); if (s <= 3) say(String(s), voiceOn(), 1.4); }
  }, 100);
}
function cheerGauge(c) {
  const el = $('.cheerbar'); if (!el || !c) return;
  const tot = Object.values(c).reduce((s, x) => s + x, 0); if (!tot) return;
  el.innerHTML = '';
  for (const t of S.teams) el.append(h('div', { style: { background: t.color, flex: String(c[t.id] || 0.0001) } }, (c[t.id] || 0) / tot > 0.08 ? `${t.icon} ${c[t.id]}` : ''));
}

// ---------------- 결과 ----------------
function results(prev) {
  const lr = S.lastResult; if (!lr) return;
  sfx('end', sfxOn()); stage.classList.remove('last10');
  const wrap = h('div', { class: 'resv' });
  stage.append(topbar(h('div', { class: 'mode' }, `${lr.label} 결과`)), wrap);
  if (lr.bonus) {
    wrap.append(h('div', { class: 'rt' }, '🎡 역전 룰렛 보너스'));
    const list = h('div', { class: 'rlist' });
    for (const t of S.teams) { const b = lr.bonus.find((x) => x.team === t.id); list.append(h('div', { class: 'ritem', style: { '--tc': t.color } }, h('span', { class: 'ric' }, t.icon), h('b', {}, t.name), h('em', {}, b ? `+${b.delta}` : '0'))); }
    wrap.append(list);
  } else {
    wrap.append(h('div', { class: 'rt' }, `🏁 ${lr.label} 결과`));
    const list = h('div', { class: 'rlist' });
    const max = Math.max(1, ...lr.teams.map((x) => x.metric));
    lr.teams.slice().reverse().forEach((r, i) => {
      const t = team(r.id);
      const row = h('div', { class: `ritem r${r.rank}`, style: { '--tc': t.color, animationDelay: `${i * 0.25}s` } }, h('div', { class: 'rrk' }, `${r.rank}위`), h('span', { class: 'ric' }, t.icon), h('div', { class: 'rnm' }, h('b', {}, t.name), lr.aces?.[r.id] ? h('small', {}, `🏅 ${lr.aces[r.id].name}${lr.aces[r.id].show ? ` · ${lr.aces[r.id].show}` : ''}`) : null),
        h('div', { class: 'rbar' }, h('div', { style: { width: `${(r.metric / max) * 100}%` } })), h('span', { class: 'rm' }, r.label || `${r.metric}`), h('em', {}, `+${r.points}`));
      list.prepend(row);
    });
    wrap.append(list);
    const w = lr.teams[0];
    // 이긴 이유: 1위 기록과 2위와의 차이 (팀이 무엇으로 이겼는지 한 줄로)
    if (w && lr.teams[1]) { const t1 = team(w.id), w2 = lr.teams[1]; const gap = Math.round((w.metric - w2.metric) * 10) / 10; wrap.append(h('div', { class: 'rwhy', style: { '--tc': t1.color } }, `🏆 ${t1.icon} ${t1.name} 승리 — ${w.label || `기록 ${w.metric}`}${gap > 0 ? ` · 2위와 ${gap} 차이` : ' · 동점 (먼저 앞선 순서)'}`)); }
    if (w) { const t = team(w.id); const run = S.run?.id ?? lr.runId; setTimeout(() => {
      if (S.phase !== 'results' || (S.lastResult?.runId ?? run) !== lr.runId) return;
      // 빵빠레 첫 타격 순간에 트로피·꽃가루가 함께 터짐
      const boom = () => { trophy(t.color); fx([t.color, '#ffd43b', '#fff'], 200); };
      if (audioReady()) BGM.fanfare(S.settings.fanfareSec ?? 12, boom, BGM.winTrack(S.settings, customList)); else { sfx('win', sfxOn()); boom(); }
      sayV(`${lr.label}, 1위는 ${t.name}!`);
    }, lr.teams.length * 250 + 900); }
  }
  if (lr.mvp) { const t = team(lr.mvp.team); wrap.append(h('div', { class: 'mvp' }, `⭐ MVP ${t.icon} ${lr.mvp.name}${lr.mvp.show ? ` · ${lr.mvp.show}` : ''}`)); }
  // 종합 순위 + 순위 변동
  const st = h('div', { class: 'stand' }, h('div', { class: 'sth' }, '🏆 종합 순위'));
  for (const r of S.standings.rows) {
    const t = team(r.id); const was = S.prevRanks?.[r.id]; const d = was ? was - r.rank : 0;
    st.append(h('div', { class: 'srow', style: { '--tc': t.color } }, h('b', {}, r.rank), h('span', {}, `${t.icon} ${t.name}`), h('i', { class: d > 0 ? 'up' : d < 0 ? 'down' : '' }, d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : '-'), h('em', {}, `${r.total}`)));
  }
  wrap.append(st);
  const cnt = h('div', { class: 'icount' }); wrap.append(cnt);
  render.t = setInterval(() => { cnt.textContent = S.phaseEnd && !S.paused ? `다음 게임까지 ${Math.max(0, Math.ceil((S.phaseEnd - live.now()) / 1000))}초` : ''; }, 300);
  void prev;
}
function fx(colors, n) { const c = h('canvas', { class: 'fx' }); document.body.append(c); confetti(c, colors, n); setTimeout(() => c.remove(), 7000); }

// ---------------- 시상식 ----------------
function ceremony() {
  const rows = S.standings.rows;
  const step = S.ceremonyStep;
  const byRank = (k) => rows.filter((r) => r.rank === k);
  const podium = h('div', { class: 'podium' });
  const slot = (k, cls) => {
    const rs = byRank(k);
    const show = (k === 3 && step >= 1) || (k === 2 && step >= 2) || (k === 1 && step >= 3);
    const inner = rs.length && show ? rs.map((r) => { const t = team(r.id); return h('div', { class: 'pt', style: { '--tc': t.color } }, h('div', { class: 'pi' }, t.icon), h('div', { class: 'pn' }, t.name), h('div', { class: 'ps' }, `${r.total}점`)); }) : h('div', { class: 'pq' }, rs.length ? '?' : '');
    return h('div', { class: `pod ${cls} ${show ? 'show' : ''}` }, h('div', { class: 'ptop' }, inner), h('div', { class: 'pstand' }, `${k}위`));
  };
  podium.append(slot(2, 'p2'), slot(1, 'p1'), slot(3, 'p3'));
  stage.append(h('div', { class: 'cerv' }, h('div', { class: 'ct' }, step >= 4 ? '🏆 우승을 축하합니다! 🏆' : '🏆 시상식'), podium));
  if (step === 0) { BGM.stopFanfare(0.5); sfx('drum', sfxOn()); sayV('지금부터 시상식을 시작합니다!'); }
  if (step >= 1 && step <= 2) { const k = 4 - step; const rs = byRank(k); sfx('win', sfxOn()); if (rs.length) sayV(`${k}위는 ${rs.map((r) => team(r.id).name).join(', ')}!`); }
  if (step === 3) { const w = byRank(1)[0]; const col = w ? team(w.id).color : '#ffd43b'; const boom = () => { trophy(col); fx([col, '#ffd43b', '#fff', '#ff4d6d'], 300); };
    if (audioReady()) BGM.fanfare(Math.max(S.settings.fanfareSec ?? 12, 15), boom, BGM.winTrack(S.settings, customList)); else { sfx('fanfare', sfxOn()); boom(); }
    const rs = byRank(1); if (rs.length) sayV(`1위는 ${rs.map((r) => team(r.id).name).join(', ')}!`); }
  if (step === 4) { const w = byRank(1)[0]; if (w) fx([team(w.id).color, '#ffd43b', '#fff', '#ff4d6d'], 300); if (audioReady() && !BGM.status().fanfare) BGM.fanfare(S.settings.fanfareSec ?? 12, null, BGM.winTrack(S.settings, customList)); }
  if (step >= 5) BGM.stopFanfare(1.5);
  if (step === 4) { const w = byRank(1)[0]; if (w) { const t = team(w.id); stage.append(h('div', { class: 'winner', style: { '--tc': t.color } }, h('div', { class: 'wi' }, t.icon), h('div', { class: 'wn' }, t.name), h('div', { class: 'ws' }, '최종 우승!'))); } }
  if (step >= 5) { stage.innerHTML = ''; ended(); }
}
function ended() {
  const tbl = h('div', { class: 'final' });
  for (const r of S.standings.rows) { const t = team(r.id); tbl.append(h('div', { class: 'frow', style: { '--tc': t.color } }, h('b', {}, `${r.rank}위`), h('div', { class: 'fnm' }, h('span', {}, `${t.icon} ${t.name}`), S.teamMvp?.[r.id] ? h('small', { class: 'fmvp' }, `🏅 팀 MVP ${S.teamMvp[r.id].name}`) : null), h('small', {}, `게임 ${r.games} · 보너스 ${r.bonus} · 1위 ${r.wins}회`), h('em', {}, `${r.total}점`))); }
  stage.append(topbar(), h('div', { class: 'endv' }, h('div', { class: 'ct' }, '🎉 최종 순위 🎉'), tbl, h('div', { class: 'thanks' }, '모두 수고했어요! 아이키키 팀 대항 오락실')));
}

// ---------------- 오버레이 ----------------
function pauseLayer() {
  let o = $('#pz');
  if (S.paused && !o) stage.append(h('div', { id: 'pz' }, '⏸ 잠시 멈춤'));
  if (!S.paused && o) o.remove();
}
function cheerEventLayer() {
  let o = $('#cev');
  const ce = S.cheerEvent;
  if (!ce) { o?.remove(); clearInterval(cheerEventLayer.t); return; }
  if (!o) { o = h('div', { id: 'cev' }); stage.append(o); sfx('drum', sfxOn()); say('응원 이벤트! 지금 응원 버튼을 마구 누르세요!', voiceOn()); }
  const draw = () => {
    o.innerHTML = '';
    const per = S.teams.map((t) => ({ t, v: (ce.counts?.[t.id] || 0) / Math.max(1, S.counts[t.id]?.total || 1) }));
    const max = Math.max(1, ...per.map((x) => x.v));
    o.append(h('div', { class: 'cet' }, ce.done ? `📣 응원 이벤트 결과! ${ce.winners ? ce.winners.map((id) => team(id).name).join(', ') + ` +${ce.bonus}점` : ''}` : `📣 응원 이벤트! ${Math.max(0, Math.ceil((ce.endAt - live.now()) / 1000))}초 · 1인당 응원 1위 팀 +${ce.bonus}점`));
    for (const x of per) o.append(h('div', { class: 'cer' }, h('span', {}, `${x.t.icon} ${x.t.name}`), h('div', { class: 'cef' }, h('div', { style: { width: `${(x.v / max) * 100}%`, background: x.t.color } }))));
  };
  draw(); clearInterval(cheerEventLayer.t); cheerEventLayer.t = setInterval(draw, 300);
}
void audioReady;
// 점검용 (테스트에서 상태 확인)
window.__screen = () => ({ phase: S?.phase, paused: !!S?.paused, game: S?.run?.game || S?.item?.game || null, phaseEnd: S?.phaseEnd, now: live?.now(), mood: stage.dataset.mood || '', step: S?.ceremonyStep });

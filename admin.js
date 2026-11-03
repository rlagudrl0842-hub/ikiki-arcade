// 진행자(관리자) 화면
import { $, h, Live, api, store, AGE, MODE, teamOf } from './shared/client.js';

const app = $('#app');
let token = store('ikiki:admin');
let games = [];
let S = null, live = null, eid = null, tab = 'run', full = null, busy = false;

const toast = (msg, ms = 2600) => { const t = h('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), ms); };
const A = (path, body) => api(path, body, token).catch((e) => { if (e.status === 401) { store('ikiki:admin', null); token = null; route(); } throw e; });
const SCORING = { avg: '팀 평균 (추천·인원 달라도 공정)', sum: '개인 점수 합산', rep: '팀 대표자 점수', top: '팀 상위 N명 평균' };
const PHASE = { lobby: '대기', intro: '게임 설명', countdown: '카운트다운', playing: '게임 중', results: '결과 발표', ceremony: '시상식', ended: '행사 종료' };
const fmtDate = (t) => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

addEventListener('hashchange', route);
init();
async function init() { games = (await api('/api/games')).games; route(); }

function route() {
  live?.stop(); live = null; S = null;
  if (!token) return login();
  const m = location.hash.match(/e=([\w-]+)/);
  if (m) { eid = m[1]; return consoleView(); }
  eid = null; home();
}

// ---------------- 로그인 ----------------
function login() {
  app.innerHTML = '';
  const pw = h('input', { class: 'inp', type: 'password', placeholder: '관리자 비밀번호', autocomplete: 'current-password' });
  const err = h('div', { class: 'err' });
  const go = async () => {
    try { const r = await api('/api/login', { password: pw.value }); token = r.token; store('ikiki:admin', token); route(); } catch (e) { err.textContent = e.message; }
  };
  pw.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  app.append(h('main', { class: 'login card' }, h('div', { class: 'brand big' }, '⚡ 아이키키 ', h('b', {}, '팀 대항 오락실')), h('h2', {}, '진행자 로그인'), pw, err, h('button', { class: 'btn', onclick: go }, '로그인'),
    h('p', { class: 'muted small' }, '처음 실행했다면 비밀번호는 서버 실행 창 또는 data/ADMIN_PASSWORD.txt 에 있어요')));
  pw.focus();
}

// ---------------- 홈: 행사 목록 ----------------
async function home() {
  app.innerHTML = '';
  const list = h('div', { class: 'evlist' }, h('p', { class: 'muted' }, '불러오는 중…'));
  app.append(h('header', { class: 'ah' }, h('div', { class: 'brand' }, '⚡ 아이키키 ', h('b', {}, '팀 대항 오락실'), h('span', { class: 'muted' }, ' 진행자')),
    h('button', { class: 'btn small ghost', onclick: settingsModal }, '⚙️ 설정'), h('button', { class: 'btn small ghost', onclick: questionsModal }, '⭕ OX 문제'),
    h('button', { class: 'btn small ghost', onclick: async () => { await A('/api/logout', {}).catch(() => {}); store('ikiki:admin', null); token = null; route(); } }, '로그아웃')),
  h('main', { class: 'amain' }, newEventCard(), h('h2', {}, '행사 목록'), list));
  try {
    const { events } = await A('/api/events');
    list.innerHTML = '';
    if (!events.length) list.append(h('p', { class: 'muted' }, '아직 행사가 없어요. 위에서 새 행사를 만들어 보세요!'));
    for (const e of events) {
      list.append(h('div', { class: 'evrow card' }, h('div', { class: 'evi' }, h('b', {}, e.name), h('div', { class: 'muted' }, `${MODE[e.mode]} · 코드 ${e.code} · 참가 ${e.players}명 · ${fmtDate(e.created_at)}${e.ended_at ? ' · 종료됨' : ''}`)),
        h('div', { class: 'evb' }, h('a', { class: 'btn small', href: `#e=${e.id}` }, '열기'),
          h('button', { class: 'btn small ghost', onclick: async () => { const r = await A(`/api/events/${e.id}/clone`, {}); toast('복제했어요'); location.hash = `e=${r.id}`; } }, '복제'),
          h('button', { class: 'btn small red', onclick: async () => { if (!confirm(`"${e.name}" 행사를 삭제할까요? 참가자 정보와 점수가 모두 지워져요.`)) return; await A(`/api/events/${e.id}/delete`, {}); toast('삭제했어요'); home(); } }, '삭제'))));
    }
  } catch (e) { list.innerHTML = ''; list.append(h('p', { class: 'err' }, e.message)); }
}

function newEventCard() {
  const name = h('input', { class: 'inp', placeholder: '행사 이름 (예: 별빛어린이집 가을 운동회)', maxlength: 40 });
  const mode = select({ kid: '🧸 유아 모드 (만 3~7세)', elem: '🎒 초등 모드', adult: '🧑 성인 모드', mixed: '👨‍👩‍👧 전 연령 혼합' }, 'elem');
  const teams = select(Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 2, `${i + 2}팀`])), '4');
  const assign = select({ choose: '참가자가 팀 고르기', auto: '자동 배정 (인원 균등)' }, 'choose');
  const scoring = select(SCORING, 'avg');
  const autoRun = h('input', { type: 'checkbox', checked: true });
  const btn = h('button', { class: 'btn' }, '＋ 행사 만들기');
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const r = await A('/api/events', { name: name.value.trim() || '아이키키 오락실', settings: { mode: mode.value, teamCount: +teams.value, teamAssign: assign.value, scoring: scoring.value, auto: autoRun.checked } });
      location.hash = `e=${r.id}`;
    } catch (e) { toast(e.message); btn.disabled = false; }
  };
  return h('div', { class: 'card newev' }, h('h2', {}, '🎉 새 행사'), name,
    h('div', { class: 'grid2' }, field('연령 모드', mode), field('팀 수', teams), field('팀 정하기', assign), field('점수 방식', scoring)),
    h('label', { class: 'chk' }, autoRun, ' 자동 진행 (설명 → 카운트다운 → 게임 → 결과 → 다음 게임이 자동으로 넘어가요)'),
    h('p', { class: 'muted small' }, '게임 순서는 연령 모드에 맞게 추천 목록이 들어가요. 만든 뒤 자유롭게 바꿀 수 있어요.'), btn);
}
function select(opts, val) { const s = h('select', { class: 'inp' }); for (const [k, v] of Object.entries(opts)) s.append(h('option', { value: k, selected: String(k) === String(val) }, v)); return s; }
function field(label, el, help) { return h('label', { class: 'fld' }, h('span', {}, label), el, help ? h('small', { class: 'muted' }, help) : null); }

function modal(title, body, onClose) {
  const m = h('div', { class: 'amodal' }, h('div', { class: 'abox card' }, h('div', { class: 'mh' }, h('h2', {}, title), h('button', { class: 'btn small ghost', onclick: () => { m.remove(); onClose?.(); } }, '닫기')), body));
  document.body.append(m); return m;
}
async function settingsModal() {
  const pw = h('input', { class: 'inp', type: 'password', placeholder: '새 비밀번호 (6자 이상)' });
  const info = await api('/api/info').catch(() => ({ lan: [] }));
  modal('⚙️ 설정', h('div', { class: 'stack' },
    h('h3', {}, '관리자 비밀번호 바꾸기'), pw, h('button', { class: 'btn', onclick: async () => { try { await A('/api/password', { password: pw.value }); toast('비밀번호를 바꿨어요'); pw.value = ''; } catch (e) { toast(e.message); } } }, '바꾸기'),
    h('h3', {}, '이 컴퓨터의 와이파이 주소'), info.lan.length ? info.lan.map((u) => h('code', {}, u)) : h('p', { class: 'muted' }, '찾을 수 없어요'),
    h('p', { class: 'muted small' }, '노트북에서 직접 서버를 켰다면, 행사의 "참가 주소"에 위 주소를 넣어야 폰에서 QR로 들어올 수 있어요 (폰과 노트북이 같은 와이파이).')));
}
async function questionsModal() {
  const box = h('div', { class: 'stack' });
  const m = modal('⭕ 스피드 OX 문제 관리', box);
  const load = async () => {
    const { questions } = await A('/api/questions');
    box.innerHTML = '';
    const age = select({ kid: '유아', elem: '초등', adult: '성인' }, 'elem'); const text = h('input', { class: 'inp', placeholder: '문제 (예: 축구는 11명이 한 팀이에요)', maxlength: 80 }); const emoji = h('input', { class: 'inp', placeholder: '그림 이모지 (선택)', maxlength: 4 }); const ans = select({ 1: '정답 ⭕', 0: '정답 ❌' }, '1');
    box.append(h('div', { class: 'qadd' }, age, text, emoji, ans, h('button', { class: 'btn', onclick: async () => { try { await A('/api/questions/save', { age: age.value, text: text.value, emoji: emoji.value, answer: +ans.value }); load(); } catch (e) { toast(e.message); } } }, '추가')));
    for (const k of ['kid', 'elem', 'adult']) {
      box.append(h('h3', {}, `${AGE[k]} 문제 (${questions.filter((q) => q.age === k && q.active).length}개 사용 중)`));
      for (const q of questions.filter((x) => x.age === k)) {
        box.append(h('div', { class: `qrow ${q.active ? '' : 'off'}` }, h('span', {}, q.emoji || ''), h('span', { class: 'qt' }, q.text), h('b', {}, q.answer ? '⭕' : '❌'),
          h('button', { class: 'btn small ghost', onclick: async () => { await A('/api/questions/save', { ...q, active: q.active ? 0 : 1 }); load(); } }, q.active ? '끄기' : '켜기'),
          h('button', { class: 'btn small red', onclick: async () => { if (confirm('이 문제를 지울까요?')) { await A('/api/questions/delete', { id: q.id }); load(); } } }, '삭제')));
      }
    }
  };
  load().catch((e) => toast(e.message));
  return m;
}

// ---------------- 진행 콘솔 ----------------
async function consoleView() {
  app.innerHTML = '';
  app.append(h('div', { class: 'muted pad' }, '불러오는 중…'));
  try { full = (await A(`/api/events/${eid}`)).full; } catch (e) { app.innerHTML = ''; app.append(h('p', { class: 'err pad' }, e.message), h('a', { class: 'btn', href: '#' }, '← 목록')); return; }
  live = new Live({ t: 'hello', role: 'admin', token, eid }, (m) => {
    if (m.t === 'state') { S = m; draw(); refreshFull(); }
    if (m.t === 'live') { liveMini(m); }
    if (m.t === 'err') { toast(m.msg); if (m.code === 401) { store('ikiki:admin', null); token = null; route(); } }
  }, (st) => document.body.classList.toggle('offline', st === 'offline'));
  setInterval(clock, 250);
  addEventListener('keydown', hotkeys);
}
let rfT = null;
function refreshFull() { clearTimeout(rfT); rfT = setTimeout(async () => { try { full = (await A(`/api/events/${eid}`)).full; if (tab === 'people' || tab === 'settings' || tab === 'playlist') drawTab(); } catch { /* */ } }, 600); }

function hotkeys(e) {
  if (!S || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.key === ' ') { e.preventDefault(); cmd('next'); }
  if (e.key === 'p' || e.key === 'P') cmd(S.paused ? 'resume' : 'pause');
  if (e.key === 'e' || e.key === 'E') cmd('endNow');
}
async function cmd(op, arg, confirmMsg) {
  if (confirmMsg && !confirm(confirmMsg)) return;
  if (busy) return; busy = true;
  try { await A(`/api/events/${eid}/command`, { op, arg, seq: S.seq }); } catch (e) { toast(e.message); } finally { busy = false; }
}
const joinUrl = () => (S.settings.joinUrl || location.origin) + '/play.html?e=' + S.event.code;

function draw() {
  if (!S) return;
  if (!$('.con')) {
    app.innerHTML = '';
    app.append(h('header', { class: 'ah' }, h('a', { class: 'btn small ghost', href: '#' }, '← 목록'), h('div', { class: 'evname' }), h('span', { class: 'phase' })),
      h('div', { class: 'con' }, h('section', { class: 'ctrl card' }), h('nav', { class: 'tabs' },
        ...[['run', '🎮 진행'], ['playlist', '📋 게임 순서'], ['people', '👥 참가자·팀'], ['score', '🏆 점수'], ['settings', '⚙️ 설정']].map(([k, l]) => h('button', { 'data-t': k, onclick: () => { tab = k; drawTab(); } }, l))),
      h('section', { class: 'tabbody' })));
  }
  $('.evname').textContent = `${S.event.name} · 코드 ${S.event.code}`;
  $('.phase').textContent = `${S.paused ? '⏸ 일시정지 · ' : ''}${PHASE[S.phase]}`;
  $('.phase').className = `phase p-${S.phase}`;
  drawCtrl();
  if (tab === 'run') drawTab();
  else document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
}

function drawCtrl() {
  const c = $('.ctrl'); c.innerHTML = '';
  const ph = S.phase; const it = S.item;
  const total = Object.values(S.counts).reduce((s, x) => s + x.total, 0); const online = Object.values(S.counts).reduce((s, x) => s + x.online, 0);
  const B = (label, op, cls = '', arg, cm) => h('button', { class: `btn ${cls}`, onclick: () => cmd(op, arg, cm) }, label);
  const now = h('div', { class: 'nowline' }, h('b', {}, it ? `${it.emoji} ${S.idx + 1}/${S.total} ${it.name}` : S.idx >= S.total ? '모든 게임 완료' : '게임 없음'), h('span', { class: 'ctime' }), h('span', { class: 'muted' }, `참가 ${total}명 (접속 ${online})`));
  const main = h('div', { class: 'bigbtns' });
  if (ph === 'lobby') { main.append(it ? B('▶ 게임 설명 시작', 'intro', 'green big') : B('🏆 시상식 시작', 'ceremony', 'big')); if (it) main.append(B('⏭ 이 게임 건너뛰기', 'skip', 'ghost')); if (S.standings.played) main.append(B('🔁 방금 게임 재경기', 'replay', 'ghost', null, '방금 끝난 게임의 점수를 취소하고 다시 할까요?')); }
  if (ph === 'intro') main.append(B('🚀 게임 시작!', 'start', 'green big'), B('⏭ 건너뛰기', 'skip', 'ghost'));
  if (ph === 'countdown' || ph === 'playing') main.append(B('🏁 지금 종료 (점수 반영)', 'endNow', 'big'), B('🛑 긴급 정지 (점수 취소)', 'abort', 'red', null, '게임을 중단하고 이번 게임 점수를 반영하지 않을까요?'), B('🔁 다시 시작', 'replay', 'ghost', null, '이번 게임을 처음부터 다시 할까요?'));
  if (ph === 'results') main.append(B(S.idx < S.total ? '▶ 다음 게임' : '🏆 마무리', 'next', 'green big'), B('🔁 재경기', 'replay', 'ghost', null, '방금 게임의 점수를 취소하고 다시 할까요?'));
  if (ph === 'ceremony') main.append(B(S.ceremonyStep >= 5 ? '✅ 행사 마치기' : `▶ 다음 발표 (${S.ceremonyStep}/5)`, 'ceremonyNext', 'green big'));
  if (ph === 'ended') main.append(B('↩ 행사 다시 열기', 'reopen', 'ghost'));
  if (['intro', 'countdown', 'playing', 'results'].includes(ph)) main.append(S.paused ? B('▶ 다시 진행', 'resume', 'blue') : B('⏸ 일시정지', 'pause', 'ghost'));
  if (!['ceremony', 'ended', 'playing', 'countdown'].includes(ph) && S.standings.played) main.append(B('🏆 시상식', 'ceremony', 'ghost', null, '지금 시상식을 시작할까요?'));
  if (!['ended'].includes(ph)) main.append(B('⏹ 행사 종료', 'end', 'ghost danger', null, '행사를 종료할까요? (다시 열 수 있어요)'));
  const tools = h('div', { class: 'tools' },
    h('button', { class: 'btn blue', onclick: () => window.open(`/screen.html?e=${S.event.code}`, 'ikiki-screen', 'width=1280,height=720') }, '🖥 대형 화면 열기'),
    h('button', { class: 'btn ghost', onclick: () => qrModal() }, '📱 참가 QR'),
    h('button', { class: 'btn ghost', onclick: () => cheerModal() }, '📣 응원 이벤트'),
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: S.settings.auto, onchange: (e) => save({ settings: { auto: e.target.checked } }) }), ' 자동 진행'));
  c.append(now, S.notice ? h('div', { class: 'notice' }, S.notice) : null, main, h('div', { class: 'livemini' }), tools, h('div', { class: 'muted small' }, '단축키: Space 다음 · P 일시정지 · E 지금 종료 (대형 화면 창에서도 동작)'));
}
function clock() {
  const el = $('.ctime'); if (!el || !S || !live) return;
  const now = live.now();
  if (S.paused) el.textContent = '⏸';
  else if (S.phase === 'playing' && S.run?.endAt) el.textContent = `⏱ ${Math.max(0, Math.ceil((S.run.endAt - now) / 1000))}초`;
  else if (S.phaseEnd) el.textContent = `⏱ ${Math.max(0, Math.ceil((S.phaseEnd - now) / 1000))}초 후 자동`;
  else el.textContent = '';
}
function liveMini(m) {
  const el = $('.livemini'); if (!el || !S) return;
  const s = m.s || {};
  const vals = s.avg || s.boards || s.prog || s.pts || (s.team && typeof Object.values(s.team)[0] === 'number' ? s.team : null);
  el.innerHTML = '';
  if (vals) for (const t of S.teams) el.append(h('span', { class: 'lm', style: { borderColor: t.color } }, `${t.icon}${typeof vals[t.id] === 'number' ? Math.round(vals[t.id]) : '-'}`));
  else if (s.picked != null) el.append(h('span', {}, `선택 ${s.picked}명`));
}
async function save(body) { try { await A(`/api/events/${eid}/update`, body); } catch (e) { toast(e.message); } }

function qrModal() {
  const url = joinUrl();
  modal('📱 참가 QR', h('div', { class: 'stack center' }, h('img', { class: 'qrimg', src: `/api/qr?text=${encodeURIComponent(url)}` }), h('code', {}, url), h('div', { class: 'big' }, `참가 코드 ${S.event.code}`),
    h('div', { class: 'row' }, h('a', { class: 'btn', href: `/api/qr/png?text=${encodeURIComponent(url)}`, download: 'ikiki-qr.png' }, '⬇ QR 이미지 저장'), h('button', { class: 'btn ghost', onclick: () => navigator.clipboard?.writeText(url).then(() => toast('링크 복사됨')) }, '🔗 링크 복사')),
    /localhost|127\.0\.0\.1/.test(url) ? h('p', { class: 'err' }, '⚠️ 참가 주소가 localhost예요. 폰에서는 열리지 않아요! [설정] 탭의 "참가 주소"를 와이파이 주소나 배포 주소로 바꿔 주세요.') : null));
}
function cheerModal() {
  const sec = h('input', { class: 'inp', type: 'number', value: 20, min: 5, max: 60 }); const bonus = h('input', { class: 'inp', type: 'number', value: 10, min: 1, max: 50 });
  const m = modal('📣 응원 이벤트', h('div', { class: 'stack' }, h('p', {}, '정해진 시간 동안 응원 버튼을 많이 누른 팀(1인당 기준)에게 보너스 점수를 줘요. 평소 응원은 점수에 영향이 없어요.'),
    field('시간(초)', sec), field('1위 팀 보너스 점수', bonus), h('button', { class: 'btn', onclick: () => { cmd('cheerEvent', { sec: +sec.value, bonus: +bonus.value }); m.remove(); } }, '🔥 응원 이벤트 시작')));
}

// ---------------- 탭 ----------------
function drawTab() {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
  const body = $('.tabbody'); if (!body || !S) return;
  if (document.activeElement && body.contains(document.activeElement) && ['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return; // 입력 중엔 다시 그리지 않음
  body.innerHTML = '';
  ({ run: tabRun, playlist: tabPlaylist, people: tabPeople, score: tabScore, settings: tabSettings })[tab](body);
}
function tabRun(body) {
  const list = h('div', { class: 'plist' });
  S.playlist.forEach((p, i) => {
    const g = games.find((x) => x.id === p.game);
    const st = i < S.idx ? 'done' : i === S.idx ? 'cur' : '';
    list.append(h('div', { class: `pitem ${st}` }, h('b', {}, i + 1), h('span', {}, `${g.emoji} ${g.name}`), p.weight !== 1 ? h('span', { class: 'chip' }, `×${p.weight}`) : null,
      ['lobby', 'results'].includes(S.phase) ? h('button', { class: 'btn small ghost', onclick: () => cmd('intro', { idx: i }) }, i === S.idx ? '시작' : '이 게임으로') : null));
  });
  body.append(h('div', { class: 'cols' }, h('div', {}, h('h3', {}, '게임 순서'), list), h('div', {}, h('h3', {}, '종합 순위'), standingsTable())));
}
function standingsTable() {
  const t = h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, '순위'), h('th', {}, '팀'), h('th', {}, '게임'), h('th', {}, '보너스'), h('th', {}, '총점'), h('th', {}, '1위')));
  for (const r of S.standings.rows) { const tm = teamOf(S, r.id); t.append(h('tr', {}, h('td', {}, r.rank), h('td', { style: { color: tm.color } }, `${tm.icon} ${tm.name}`), h('td', {}, r.games), h('td', {}, r.bonus), h('td', {}, h('b', {}, r.total)), h('td', {}, r.wins))); }
  return t;
}
function tabPlaylist(body) {
  const pl = S.playlist.map((p) => ({ ...p }));
  const locked = ['countdown', 'playing'].includes(S.phase);
  const list = h('div', { class: 'plist edit' });
  const draw = () => {
    list.innerHTML = '';
    pl.forEach((p, i) => {
      const g = games.find((x) => x.id === p.game);
      const w = select({ 0.5: '×0.5', 1: '×1', 1.5: '×1.5', 2: '×2', 3: '×3' }, p.weight); w.onchange = () => (p.weight = +w.value);
      const d = h('input', { class: 'inp sm', type: 'number', min: 5, max: 300, placeholder: g.untimed ? '라운드제' : `기본 ${g.dur[S.settings.mode === 'mixed' ? 'elem' : S.settings.mode]}초`, value: p.dur ?? '', disabled: g.untimed }); d.onchange = () => (p.dur = d.value ? +d.value : undefined);
      list.append(h('div', { class: `pitem ${i < S.idx ? 'done' : ''}` }, h('b', {}, i + 1), h('span', { class: 'gn' }, `${g.emoji} ${g.name}`), field('배점', w), field('시간(초)', d),
        h('button', { class: 'btn small ghost', onclick: () => { if (i > 0) { [pl[i - 1], pl[i]] = [pl[i], pl[i - 1]]; draw(); } } }, '▲'),
        h('button', { class: 'btn small ghost', onclick: () => { if (i < pl.length - 1) { [pl[i + 1], pl[i]] = [pl[i], pl[i + 1]]; draw(); } } }, '▼'),
        h('button', { class: 'btn small red', onclick: () => { pl.splice(i, 1); draw(); } }, '✕')));
    });
  };
  draw();
  const add = select(Object.fromEntries(games.map((g) => [g.id, `${String(g.no).padStart(2, '0')}. ${g.emoji} ${g.name}${g.team ? ' (팀 협동)' : ''}${g.bonusOnly ? ' (보너스)' : ''}`])), 'mash');
  body.append(h('h3', {}, '게임 순서 편집'), locked ? h('p', { class: 'err' }, '게임 중에는 순서를 바꿀 수 없어요') : null, list,
    h('div', { class: 'row' }, add, h('button', { class: 'btn ghost', onclick: () => { pl.push({ game: add.value, weight: add.value === 'throne' ? 2 : 1 }); draw(); } }, '＋ 추가')),
    h('div', { class: 'row' }, h('button', { class: 'btn', disabled: locked, onclick: async () => { await save({ settings: { playlist: pl } }); toast('게임 순서를 저장했어요'); } }, '💾 저장'),
      h('button', { class: 'btn ghost', onclick: () => { pl.splice(0, pl.length, ...games.map((g) => ({ game: g.id, weight: g.id === 'throne' ? 2 : 1 }))); draw(); } }, '20종 전체 넣기')),
    h('p', { class: 'muted small' }, '배점은 순위 포인트에 곱해져요 (1위 = 팀 수 × 10점 × 배점). 역전 룰렛은 순위 포인트 대신 보너스 점수를 줘요.'));
}
function tabPeople(body) {
  const ps = full?.players || [];
  const byTeam = {};
  for (const p of ps) (byTeam[p.team] ||= []).push(p);
  const teamsBox = h('div', { class: 'teamgrid' });
  for (const t of S.teams) {
    const name = h('input', { class: 'inp sm', value: t.name, maxlength: 10 }); const icon = h('input', { class: 'inp sm icon', value: t.icon, maxlength: 4 }); const color = h('input', { type: 'color', value: t.color });
    const saveT = () => save({ teams: [{ id: t.id, name: name.value, icon: icon.value, color: color.value }] });
    name.onchange = saveT; icon.onchange = saveT; color.onchange = saveT;
    const members = h('div', { class: 'members' });
    for (const p of byTeam[t.id] || []) {
      const mv = select(Object.fromEntries(S.teams.map((x) => [x.id, `${x.icon} ${x.name}`])), p.team);
      mv.onchange = () => A(`/api/events/${eid}/player/${p.id}`, { team: +mv.value }).then(refreshFull).catch((e) => toast(e.message));
      members.append(h('div', { class: `mem ${p.excluded ? 'ex' : ''}` }, h('span', { class: `on ${p.online ? 'y' : ''}` }), h('b', {}, p.name), h('small', {}, AGE[p.age]), p.rep ? h('span', { class: 'rep' }, '👑') : h('button', { class: 'lnk', onclick: () => A(`/api/events/${eid}/player/${p.id}`, { rep: true }).then(refreshFull) }, '대표로'),
        mv, h('button', { class: 'lnk', onclick: () => A(`/api/events/${eid}/player/${p.id}`, { excluded: !p.excluded }).then(refreshFull) }, p.excluded ? '복구' : '제외')));
    }
    teamsBox.append(h('div', { class: 'tcard card', style: { borderTopColor: t.color } }, h('div', { class: 'row' }, icon, name, color), h('div', { class: 'muted small' }, `${(byTeam[t.id] || []).filter((p) => !p.excluded).length}명 · 접속 ${S.counts[t.id]?.online || 0}`), members));
  }
  body.append(h('div', { class: 'row' }, h('h3', {}, `참가자 ${ps.length}명`), h('button', { class: 'btn small ghost', onclick: () => { if (confirm('모든 참가자를 팀에 골고루 다시 나눌까요?')) A(`/api/events/${eid}/autoassign`, {}).then(refreshFull).catch((e) => toast(e.message)); } }, '🔀 팀 자동 배정')), teamsBox);
}
async function tabScore(body) {
  const team = select(Object.fromEntries(S.teams.map((t) => [t.id, `${t.icon} ${t.name}`])), S.teams[0]?.id);
  const delta = h('input', { class: 'inp sm', type: 'number', placeholder: '점수 (예: 10, -5)' }); const reason = h('input', { class: 'inp', placeholder: '사유 (예: 정리정돈 보너스)', maxlength: 60 });
  body.append(h('div', { class: 'cols' }, h('div', {}, h('h3', {}, '종합 순위'), standingsTable(),
    h('h3', {}, '점수 수동 수정'), h('div', { class: 'row' }, team, delta), reason, h('button', { class: 'btn', onclick: async () => { if (!delta.value) return; try { await A(`/api/events/${eid}/adjust`, { team: +team.value, delta: +delta.value, reason: reason.value }); toast('반영했어요'); } catch (e) { toast(e.message); } } }, '반영'),
    h('h3', {}, '결과 내보내기'), h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: download }, '⬇ 결과 CSV (엑셀)'), h('button', { class: 'btn ghost', onclick: printResult }, '🖨 결과표 인쇄/PDF'))),
  h('div', { class: 'logbox' }, h('h3', {}, '기록'), h('p', { class: 'muted' }, '불러오는 중…'))));
  try {
    const log = await A(`/api/events/${eid}/log`);
    const lb = $('.logbox'); if (!lb) return; lb.innerHTML = ''; lb.append(h('h3', {}, '게임 기록'));
    const ST = { done: '완료', aborted: '중단', interrupted: '서버 재시작으로 중단', replaced: '재경기로 취소', running: '진행 중' };
    for (const r of log.runs) lb.append(h('div', { class: 'logi' }, `${r.seq}. ${r.label} — ${ST[r.status] || r.status} ${r.ended_at ? fmtDate(r.ended_at) : ''}`));
    lb.append(h('h3', {}, '점수 수정·보너스 이력'));
    const K = { manual: '수동', luck: '운 보너스', cheer: '응원' };
    for (const a of log.adjustments) { const t = teamOf(S, a.team_id); lb.append(h('div', { class: 'logi' }, `${fmtDate(a.at)} ${t.icon}${t.name} ${a.delta > 0 ? '+' : ''}${a.delta} (${K[a.kind] || a.kind}) ${a.reason || ''}`)); }
    if (!log.adjustments.length) lb.append(h('div', { class: 'muted' }, '없음'));
    lb.append(h('h3', {}, '관리자 조작 기록'));
    for (const a of log.audit.slice(0, 40)) lb.append(h('div', { class: 'logi muted' }, `${fmtDate(a.at)} ${a.action}`));
  } catch { /* */ }
}
async function download() {
  const r = await fetch(`/api/events/${eid}/export.csv`, { headers: { Authorization: 'Bearer ' + token } });
  const b = await r.blob(); const a = h('a', { href: URL.createObjectURL(b), download: `아이키키_결과_${S.event.code}.csv` }); document.body.append(a); a.click(); a.remove();
}
function printResult() {
  const w = window.open('', '_blank');
  const rows = S.standings.rows.map((r) => { const t = teamOf(S, r.id); return `<tr><td>${r.rank}</td><td>${esc(t.icon)} ${esc(t.name)}</td><td>${r.games}</td><td>${r.bonus}</td><td><b>${r.total}</b></td><td>${r.wins}</td></tr>`; }).join('');
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(S.event.name)} 결과</title><style>body{font-family:sans-serif;padding:30px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:8px;text-align:center}h1{margin:0 0 6px}</style><h1>🏆 ${esc(S.event.name)}</h1><p>아이키키 팀 대항 오락실 · ${new Date().toLocaleString('ko-KR')} · ${S.standings.played}게임</p><table><tr><th>순위</th><th>팀</th><th>게임 포인트</th><th>보너스</th><th>총점</th><th>1위 횟수</th></tr>${rows}</table>`);
  w.document.close(); setTimeout(() => w.print(), 300);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function tabSettings(body) {
  const s = full?.settings || S.settings;
  const name = h('input', { class: 'inp', value: S.event.name, maxlength: 40 });
  const mode = select({ kid: '🧸 유아', elem: '🎒 초등', adult: '🧑 성인', mixed: '👨‍👩‍👧 전 연령 혼합' }, s.mode);
  const lvl = select({ low: '저학년 (1~3학년)', high: '고학년 (4~6학년)' }, s.elemLevel);
  const scoring = select(SCORING, s.scoring);
  const topN = h('input', { class: 'inp sm', type: 'number', min: 1, max: 50, value: s.topN });
  const teamCount = select(Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 2, `${i + 2}팀`])), S.teams.length);
  const assign = select({ choose: '참가자가 팀 고르기', auto: '자동 배정' }, s.teamAssign);
  const intro = h('input', { class: 'inp sm', type: 'number', min: 3, max: 60, value: s.introSec });
  const res = h('input', { class: 'inp sm', type: 'number', min: 3, max: 60, value: s.resultSec });
  const voice = h('input', { type: 'checkbox', checked: s.voice }); const sfxc = h('input', { type: 'checkbox', checked: s.sfx });
  const cap = h('input', { class: 'inp sm', type: 'number', min: 0, max: 30, value: s.rouletteCapPct });
  const url = h('input', { class: 'inp', value: s.joinUrl || '', placeholder: location.origin });
  body.append(h('div', { class: 'stack' },
    field('행사 이름', name),
    h('div', { class: 'grid2' }, field('연령 모드', mode, '혼합 모드: 참가할 때 유아/초등/어른을 고르고, 같은 게임도 연령별 난이도로 진행 + 점수는 0~100으로 환산해 공정하게 비교'), field('초등 난이도', lvl), field('점수 방식', scoring), field('상위 N명 (상위 N명 평균일 때)', topN),
      field('팀 수', teamCount, '점수가 생긴 뒤에는 바꿀 수 없어요'), field('팀 정하기', assign), field('게임 설명 시간(초)', intro), field('결과 발표 시간(초)', res), field('역전 룰렛 보너스 상한 (1위 총점의 %)', cap)),
    h('label', { class: 'chk' }, voice, ' 🗣 음성 안내 (대형 화면)'), h('label', { class: 'chk' }, sfxc, ' 🔊 효과음'),
    field('참가 주소 (QR에 들어갈 주소)', url, '배포 주소(예: https://ikiki-arcade.onrender.com) 또는 노트북 와이파이 주소(예: http://192.168.0.15:8080). 비우면 지금 접속한 주소'),
    h('button', { class: 'btn', onclick: async () => {
      await save({ name: name.value, settings: { mode: mode.value, elemLevel: lvl.value, scoring: scoring.value, topN: +topN.value, teamCount: +teamCount.value, teamAssign: assign.value, introSec: +intro.value, resultSec: +res.value, voice: voice.checked, sfx: sfxc.checked, rouletteCapPct: +cap.value, joinUrl: url.value.trim() } });
      toast('설정을 저장했어요');
    } }, '💾 설정 저장'),
    h('h3', {}, '개인정보'), h('p', { class: 'muted small' }, '행사가 끝나면 참가자 이름을 "참가자1, 2…"로 바꿔 개인정보를 지울 수 있어요. 점수 기록은 남아요.'),
    h('button', { class: 'btn ghost', onclick: async () => { if (confirm('참가자 이름을 모두 지울까요? 되돌릴 수 없어요.')) { await A(`/api/events/${eid}/purge`, {}); toast('지웠어요'); refreshFull(); } } }, '🧹 참가자 이름 지우기')));
}

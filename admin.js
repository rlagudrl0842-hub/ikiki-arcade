// 진행자(관리자) 화면
import { $, h, Live, api, store, AGE, MODE, teamOf, qrImg } from './client.js';
import { saveCard } from './card.js';
import * as BGM from './bgm.js';

const app = $('#app');
let token = store('ikiki:admin');
let me = null; // { username, name, role }
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
const isMaster = () => me?.role === 'master';
async function loadMe() { if (!me) me = (await A('/api/me')).user; return me; }

function route() {
  live?.stop(); live = null; S = null;
  document.body.classList.remove('offline');
  const rc = location.hash.match(/r=([\w-]+)/);
  if (rc) { api('/api/remote/claim', { code: rc[1] }).then((r) => { token = r.token; store('ikiki:admin', token); me = null; try { sessionStorage.setItem('ikiki:remote', '1'); } catch {} location.hash = `e=${r.eventId}`; }).catch((e) => { app.innerHTML = ''; app.append(h('div', { class: 'card stack center', style: { margin: '40px 16px' } }, h('div', { style: { fontSize: '48px' } }, '⌛'), h('b', {}, e.message), h('a', { class: 'btn', href: '/admin.html' }, '로그인 화면으로'))); location.hash = ''; }); return; }
  try { document.body.classList.toggle('remote', sessionStorage.getItem('ikiki:remote') === '1'); } catch {}
  if (!token) { me = null; return login(); }
  const m = location.hash.match(/e=([\w-]+)/);
  if (m) { eid = m[1]; return consoleView(); }
  eid = null; home();
}

// ---------------- 로그인 ----------------
function login() {
  app.innerHTML = '';
  const un = h('input', { class: 'inp', placeholder: '아이디', autocomplete: 'username', autocapitalize: 'off', value: store('ikiki:lastuser') || '' });
  const pw = h('input', { class: 'inp', type: 'password', placeholder: '비밀번호', autocomplete: 'current-password' });
  const err = h('div', { class: 'err' });
  const go = async () => {
    try {
      const r = await api('/api/login', { username: un.value.trim(), password: pw.value });
      token = r.token; me = r.user; store('ikiki:admin', token); store('ikiki:lastuser', un.value.trim() || null); route();
    } catch (e) { err.textContent = e.message; }
  };
  un.addEventListener('keydown', (e) => e.key === 'Enter' && pw.focus());
  pw.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  app.append(h('main', { class: 'login card' }, h('div', { class: 'brand big' }, h('span', { class: 'ikl' }, h('img', { src: '/logo.png', alt: '아이키키' })), h('div', {}, h('b', {}, '팀 대항 오락실'))), h('h2', {}, '진행자 로그인'), un, pw, err, h('button', { class: 'btn', onclick: go }, '로그인'),
    h('p', { class: 'muted small' }, '마스터 아이디는 admin')));
  (un.value ? pw : un).focus();
  api('/api/signup').then((r) => { if (r.open) $('.login').append(h('button', { class: 'btn ghost', onclick: signup }, '🙋 처음이세요? 강사 가입하기')); }).catch(() => {});
}

function signup() {
  app.innerHTML = '';
  const un = h('input', { class: 'inp', placeholder: '아이디 (영어 소문자·숫자 3~20자, 예: kim01)', autocomplete: 'username', autocapitalize: 'off', maxlength: 20 });
  const nm = h('input', { class: 'inp', placeholder: '이름 (예: 김민수 쌤)', maxlength: 20 });
  const pw = h('input', { class: 'inp', type: 'password', placeholder: '비밀번호 (6자 이상)', autocomplete: 'new-password' });
  const pw2 = h('input', { class: 'inp', type: 'password', placeholder: '비밀번호 한 번 더', autocomplete: 'new-password' });
  const err = h('div', { class: 'err' });
  const btn = h('button', { class: 'btn' }, '가입하고 시작하기');
  btn.onclick = async () => {
    err.textContent = '';
    if (pw.value !== pw2.value) { err.textContent = '비밀번호 두 개가 달라요'; return; }
    btn.disabled = true;
    try {
      const r = await api('/api/signup', { username: un.value.trim(), name: nm.value.trim(), password: pw.value });
      token = r.token; me = r.user; store('ikiki:admin', token); store('ikiki:lastuser', r.user.username); toast(`환영해요, ${r.user.name}!`); route();
    } catch (e) { err.textContent = e.message; btn.disabled = false; }
  };
  pw2.addEventListener('keydown', (e) => e.key === 'Enter' && btn.click());
  app.append(h('main', { class: 'login card' }, h('div', { class: 'brand big' }, h('span', { class: 'ikl' }, h('img', { src: '/logo.png', alt: '아이키키' })), h('div', {}, h('b', {}, '팀 대항 오락실'))), h('h2', {}, '🙋 강사 가입'), un, nm, pw, pw2, err, btn,
    h('button', { class: 'btn ghost', onclick: login }, '← 로그인으로'),
    h('p', { class: 'muted small' }, '아이디와 비밀번호는 꼭 기억해 두세요. 내 행사는 나만 볼 수 있어요.')));
  un.focus();
}

// ---------------- 홈: 행사 목록 ----------------
async function home() {
  app.innerHTML = '';
  try { await loadMe(); } catch { return; }
  const list = h('div', { class: 'evlist' }, h('p', { class: 'muted' }, '불러오는 중…'));
  app.append(h('header', { class: 'ah' }, h('div', { class: 'brand' }, h('span', { class: 'ikl' }, h('img', { src: '/logo.png', alt: '아이키키' })), ' ', h('b', {}, '팀 대항 오락실'), h('span', { class: 'muted' }, ` 👤 ${me.name}${isMaster() ? ' (마스터)' : ''}`)),
    isMaster() ? h('button', { class: 'btn small blue', onclick: usersModal }, '👥 강사 계정') : null,
    h('button', { class: 'btn small ghost', onclick: settingsModal }, '⚙️ 설정'), isMaster() ? h('button', { class: 'btn small ghost', onclick: questionsModal }, '⭕ OX 문제') : null,
    h('button', { class: 'btn small ghost', onclick: async () => { await A('/api/logout', {}).catch(() => {}); store('ikiki:admin', null); token = null; route(); } }, '로그아웃')),
  h('main', { class: 'amain' }, newEventCard(), h('h2', {}, '행사 목록'), list));
  try {
    const { events } = await A('/api/events');
    list.innerHTML = '';
    if (!events.length) list.append(h('p', { class: 'muted' }, '아직 행사가 없어요. 위에서 새 행사를 만들어 보세요!'));
    for (const e of events) {
      list.append(h('div', { class: 'evrow card' }, h('div', { class: 'evi' }, h('b', {}, e.name), h('div', { class: 'muted' }, `${isMaster() && e.owner ? `👤 ${e.owner} · ` : ''}${MODE[e.mode]} · 코드 ${e.code} · 참가 ${e.players}명 · ${fmtDate(e.created_at)}${e.ended_at ? ' · 종료됨' : ''}`)),
        h('div', { class: 'evb' }, h('a', { class: 'btn small', href: `#e=${e.id}` }, '열기'),
          h('button', { class: 'btn small ghost', onclick: async () => { const r = await A(`/api/events/${e.id}/clone`, {}); toast('복제했어요'); location.hash = `e=${r.id}`; } }, '복제'),
          h('button', { class: 'btn small red', onclick: async () => { if (!confirm(`"${e.name}" 행사를 삭제할까요? 참가자 정보와 점수가 모두 지워져요.`)) return; await A(`/api/events/${e.id}/delete`, {}); toast('삭제했어요'); home(); } }, '삭제'))));
    }
  } catch (e) { list.innerHTML = ''; list.append(h('p', { class: 'err' }, e.message)); }
}

function newEventCard() {
  const name = h('input', { class: 'inp', placeholder: '행사 이름 (예: 별빛어린이집 가을 운동회)', maxlength: 40 });
  const mode = select({ baby: '영아 (보호자와 함께)', kid: '유아 (만 3~7세)', elem: '초등', mid: '중등', high: '고등', adult: '성인', mixed: '전 연령 혼합' }, 'elem');
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
    h('p', {}, `로그인: ${me?.name} (아이디 ${me?.username})`),
    h('h3', {}, '내 비밀번호 바꾸기'), pw,
    isMaster() ? h('p', { class: 'muted small' }, 'Render에 ADMIN_PASSWORD를 넣어 두었다면, 서버가 다시 켜질 때 마스터 비밀번호는 그 값으로 돌아가요.') : null, h('button', { class: 'btn', onclick: async () => { try { await A('/api/password', { password: pw.value }); toast('비밀번호를 바꿨어요'); pw.value = ''; } catch (e) { toast(e.message); } } }, '바꾸기'),
    h('h3', {}, '이 컴퓨터의 와이파이 주소'), info.lan.length ? info.lan.map((u) => h('code', {}, u)) : h('p', { class: 'muted' }, '찾을 수 없어요'),
    h('p', { class: 'muted small' }, '노트북에서 직접 서버를 켰다면, 행사의 "참가 주소"에 위 주소를 넣어야 폰에서 QR로 들어올 수 있어요 (폰과 노트북이 같은 와이파이).')));
}
// ---------------- 강사 계정 관리 (마스터 전용) ----------------
function usersModal() {
  const box = h('div', { class: 'stack' });
  modal('👥 강사 계정', box);
  const load = async () => {
    const { users, signupOpen } = await A('/api/users');
    box.innerHTML = '';
    const sw = h('input', { type: 'checkbox', checked: signupOpen, onchange: async (e) => { await A('/api/users/signup', { open: e.target.checked }).catch((er) => toast(er.message)); toast(e.target.checked ? '선생님들이 직접 가입할 수 있어요' : '가입을 닫았어요'); } });
    const link = `${location.origin}/admin.html`;
    box.append(h('div', { class: 'card stack' }, h('label', { class: 'chk' }, sw, ' 🙋 선생님들이 직접 가입할 수 있게 하기'),
      h('p', { class: 'muted small' }, '켜 두면 아래 주소만 보내면 돼요. 선생님이 [강사 가입하기]로 직접 계정을 만들어요. 다 가입했으면 꺼 두는 게 안전해요.'),
      h('code', {}, link), h('button', { class: 'btn ghost', onclick: () => navigator.clipboard?.writeText(`⚡ 아이키키 팀 대항 오락실\n${link}\n들어가서 [🙋 처음이세요? 강사 가입하기] 눌러서 가입하세요!`).then(() => toast('복사했어요. 카톡에 붙여 넣으세요')) }, '📋 가입 안내 문구 복사')));
    const un = h('input', { class: 'inp', placeholder: '아이디 (영어 소문자·숫자, 예: kim01)', maxlength: 20, autocapitalize: 'off' });
    const nm = h('input', { class: 'inp', placeholder: '강사 이름 (예: 김민수 쌤)', maxlength: 20 });
    const pw = h('input', { class: 'inp', placeholder: '처음 비밀번호 (6자 이상)', maxlength: 40 });
    const out = h('div', {});
    const add = async () => {
      try {
        await A('/api/users/add', { username: un.value.trim(), name: nm.value.trim(), password: pw.value });
        const msg = `⚡ 아이키키 팀 대항 오락실\n진행자 화면: ${location.origin}/admin.html\n아이디: ${un.value.trim().toLowerCase()}\n비밀번호: ${pw.value}\n(로그인 후 ⚙️ 설정에서 비밀번호를 바꿔 주세요)`;
        await load();
        box.prepend(h('div', { class: 'card stack' }, h('b', {}, '✅ 계정을 만들었어요. 아래 내용을 강사에게 보내 주세요'), h('pre', { class: 'sendmsg' }, msg),
          h('button', { class: 'btn', onclick: () => navigator.clipboard?.writeText(msg).then(() => toast('복사했어요. 카톡에 붙여 넣으세요')) }, '📋 안내 문구 복사')));
      } catch (e) { out.textContent = e.message; out.className = 'err'; }
    };
    box.append(h('h3', {}, '＋ 새 강사 추가'), un, nm, pw, out, h('button', { class: 'btn', onclick: add }, '계정 만들기'),
      h('p', { class: 'muted small' }, '강사는 자기가 만든 행사만 보여요. 마스터(나)는 모든 행사를 볼 수 있어요.'),
      h('h3', {}, `계정 ${users.length}개`));
    for (const u of users) {
      const isM = u.role === 'master';
      box.append(h('div', { class: `qrow ${u.active ? '' : 'off'}` }, h('span', {}, isM ? '👑' : '👤'), h('span', { class: 'qt' }, h('b', {}, u.name), ` · ${u.username} · 행사 ${u.events}개${u.active ? '' : ' · 사용 중지'}`),
        isM ? h('span', { class: 'muted small' }, '마스터') : null,
        isM ? null : h('button', { class: 'btn small ghost', onclick: async () => { const np = prompt(`${u.name}의 새 비밀번호 (6자 이상)`); if (!np) return; try { await A(`/api/users/${u.id}/password`, { password: np }); toast('비밀번호를 바꿨어요. 강사에게 알려 주세요'); } catch (e) { toast(e.message); } } }, '비번 초기화'),
        isM ? null : h('button', { class: `btn small ${u.active ? 'red' : 'ghost'}`, onclick: async () => { if (u.active && !confirm(`${u.name} 계정을 사용 중지할까요? 바로 로그아웃되고 로그인할 수 없어요. (행사 기록은 남아요)`)) return; await A(`/api/users/${u.id}/active`, { active: !u.active }); load(); } }, u.active ? '사용 중지' : '다시 허용')));
    }
  };
  load().catch((e) => toast(e.message));
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
  try { full = (await A(`/api/events/${eid}`)).full; fullKey = JSON.stringify(full.players); fullSKey = JSON.stringify(full.settings); } catch (e) { app.innerHTML = ''; app.append(h('p', { class: 'err pad' }, e.message), h('a', { class: 'btn', href: '#' }, '← 목록')); return; }
  let lv = null;
  lv = new Live({ t: 'hello', role: 'admin', token, eid }, (m) => {
    if (m.t === 'state') { S = m; draw(); refreshFull(); }
    if (m.t === 'live') { liveMini(m); }
    if (m.t === 'err') { toast(m.msg); if (m.code === 401) { store('ikiki:admin', null); token = null; route(); } }
  }, (st) => { if (!lv || live === lv) document.body.classList.toggle('offline', st === 'offline'); }); // 목록으로 나간 뒤엔 '연결 끊김' 표시 안 함
  live = lv;
  // 행사를 여러 번 열고 닫아도 타이머·단축키가 겹쳐 등록되지 않게 한 번만
  if (!consoleView.once) { consoleView.once = true; setInterval(clock, 250); addEventListener('keydown', hotkeys); }
}
let rfT = null;
let fullKey = '', fullSKey = '', formDirty = false;
// 설정·게임 순서 탭에서 고치는 중이면(저장 전) 다른 사람이 들어와도 화면을 다시 그리지 않음 → 고친 내용이 사라지지 않음
document.addEventListener('input', (e) => { if (e.target.closest?.('.tabbody')) formDirty = true; }, true);
document.addEventListener('change', (e) => { if (e.target.closest?.('.tabbody')) formDirty = true; }, true);
// 참가자 목록은 바뀌었을 때만 다시 그림 (300명일 때 화면 버벅임 방지)
function refreshFull() { clearTimeout(rfT); const at = eid; rfT = setTimeout(async () => { try { const f = (await A(`/api/events/${at}`)).full; if (at !== eid) return; const kp = JSON.stringify(f.players), ks = JSON.stringify(f.settings); const chP = kp !== fullKey, chS = ks !== fullSKey; fullKey = kp; fullSKey = ks; full = f; if ((chP && tab === 'people') || (chS && !formDirty && (tab === 'settings' || tab === 'playlist'))) drawTab(); } catch { /* */ } }, 800); }

function hotkeys(e) {
  if (e.repeat) return; // 키를 누르고 있으면 자동 반복되는 것 무시
  if (!S || !eid || !live || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.key === ' ') { e.preventDefault(); cmd('next'); }
  if (e.key === 'p' || e.key === 'P') cmd(S.paused ? 'resume' : 'pause');
  if (e.key === 'e' || e.key === 'E') cmd('endNow');
}
async function cmd(op, arg, confirmMsg) {
  if (confirmMsg && !confirm(confirmMsg)) return;
  if (busy) return;
  // 같은 버튼·단축키를 0.7초 안에 또 누르면 한 번으로 침 (결과에서 Space 두 번 → 다음 게임 설명까지 넘어가던 문제)
  if (cmd.last && cmd.last.op === op && Date.now() - cmd.last.at < 700) return;
  busy = true; cmd.last = { op, at: Date.now() };
  try { await A(`/api/events/${eid}/command`, { op, arg, seq: S.seq }); } catch (e) { toast(e.message); } finally { busy = false; }
}
const joinUrl = () => (S.settings.joinUrl || location.origin) + '/play.html?e=' + S.event.code;

function draw() {
  if (!S) return;
  if (!$('.con')) {
    app.innerHTML = '';
    app.append(h('header', { class: 'ah' }, h('a', { class: 'btn small ghost', href: '#' }, '← 목록'), h('div', { class: 'evname' }), h('span', { class: 'phase' })),
      h('div', { class: 'con' }, h('section', { class: 'ctrl card' }), h('nav', { class: 'tabs' },
        ...[['run', '🎮 진행'], ['playlist', '📋 게임 순서'], ['people', '👥 참가자·팀'], ['score', '🏆 점수'], ['quiz', '✏️ 문제·단어'], ['music', '🎵 음악'], ['settings', '⚙️ 설정']].map(([k, l]) => h('button', { 'data-t': k, onclick: () => { tab = k; drawTab(); } }, l))),
      h('section', { class: 'tabbody' })));
  }
  $('.evname').textContent = `${S.event.name} · 코드 ${S.event.code}`;
  $('.phase').textContent = `${S.paused ? '⏸ 일시정지 · ' : ''}${PHASE[S.phase]}`;
  $('.phase').className = `phase p-${S.phase}`;
  // 참가자가 들어오고 나갈 때마다 오는 상태 메시지로 버튼을 다시 만들면 누르던 버튼이 사라져 클릭이 씹힘
  // → 진행에 영향 있는 값이 바뀔 때만 다시 그리고, 인원수는 글자만 바꿈
  const ck = ctrlKey();
  if (ck !== draw.ck || !$('.ctrl .bigbtns')) { draw.ck = ck; drawCtrl(); } else updateCounts();
  if (tab === 'run') { const rk = runKey(); if (rk !== draw.rk || !$('.tabbody .plist')) { draw.rk = rk; drawTab(); } }
  else { draw.rk = null; document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab)); }
}
const ctrlKey = () => JSON.stringify([S.phase, S.seq, S.paused, S.idx, S.total, S.item?.game, S.item?.host, S.notice, S.settings.duck, S.settings.auto, S.ceremonyStep, S.standings.played, S.teams.map((t) => [t.id, t.name, t.icon, t.color]), S.settings.league]);
const runKey = () => JSON.stringify([S.phase, S.idx, S.playlist, S.standings.rows, S.teams.map((t) => [t.id, t.name, t.icon, t.color])]);
function updateCounts() {
  const el = $('.ctrl .nowline .muted'); if (!el) return;
  const total = Object.values(S.counts).reduce((s, x) => s + x.total, 0); const online = Object.values(S.counts).reduce((s, x) => s + x.online, 0);
  el.textContent = `참가 ${total}명 (접속 ${online})`;
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
  if (ph === 'playing' && it?.host) {
    const hp = (team, d) => A(`/api/events/${eid}/command`, { op: 'hostPt', arg: { team, d } }).catch((e) => toast(e.message));
    main.append(h('div', { class: 'hostpad' }, h('div', { class: 'muted small' }, '🎯 진행자 판정: 잘한 팀에 점수를 눌러 주세요'), ...S.teams.map((t) => h('div', { class: 'hprow', style: { '--tc': t.color } }, h('b', {}, `${t.icon} ${t.name}`),
      ...[[1, '+1'], [2, '+2'], [3, '+3'], [-1, '−1']].map(([d, l]) => h('button', { class: `btn ${d < 0 ? 'ghost' : 'green'}`, onclick: (e) => { e.currentTarget.animate([{ transform: 'scale(.88)' }, { transform: 'scale(1)' }], 180); hp(t.id, d); } }, l))))));
  }
  if (ph === 'results') main.append(B(S.idx < S.total ? '▶ 다음 게임' : '🏆 마무리', 'next', 'green big'), B('🔁 재경기', 'replay', 'ghost', null, '방금 게임의 점수를 취소하고 다시 할까요?'));
  if (ph === 'ceremony') main.append(B(S.ceremonyStep >= 5 ? '✅ 행사 마치기' : `▶ 다음 발표 (${S.ceremonyStep}/5)`, 'ceremonyNext', 'green big'));
  if (ph === 'ended') main.append(h('button', { class: 'btn green big', onclick: () => saveCard(S, { share: false }).then(() => toast('결과 카드를 저장했어요')) }, '🖼 결과 공유 카드 저장'), B('↩ 행사 다시 열기', 'reopen', 'ghost'));
  if (['intro', 'countdown', 'playing', 'results'].includes(ph)) main.append(S.paused ? B('▶ 다시 진행', 'resume', 'blue') : B('⏸ 일시정지', 'pause', 'ghost'));
  if (!['ceremony', 'ended', 'playing', 'countdown'].includes(ph) && S.standings.played) main.append(B('🏆 시상식', 'ceremony', 'ghost', null, '지금 시상식을 시작할까요?'));
  if (!['ended'].includes(ph)) main.append(B('⏹ 행사 종료', 'end', 'ghost danger', null, '행사를 종료할까요? (다시 열 수 있어요)'));
  const tools = h('div', { class: 'tools' },
    h('button', { class: 'btn blue', onclick: () => window.open(`/screen.html?e=${S.event.code}`, 'ikiki-screen', 'width=1280,height=720') }, '🖥 대형 화면 열기'),
    h('button', { class: 'btn ghost', onclick: () => qrModal() }, '📱 참가 QR'),
    document.body.classList.contains('remote') ? null : h('button', { class: 'btn ghost', onclick: () => remoteModal() }, '🎮 폰 리모컨'),
    h('button', { class: `btn ${S.settings.duck ? 'yellow' : 'ghost'}`, onclick: () => save({ settings: { duck: !S.settings.duck } }) }, S.settings.duck ? '🎤 말씀 끝 · 음악 다시 크게' : '🎤 말할 때 음악 줄이기'),
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
  modal('📱 참가 QR', h('div', { class: 'stack center' }, qrImg(url, 'qrimg'), h('code', {}, url), h('div', { class: 'big' }, `참가 코드 ${S.event.code}`),
    h('div', { class: 'row' }, h('a', { class: 'btn', href: `/api/qr/png?text=${encodeURIComponent(url)}`, download: 'ikiki-qr.png' }, '⬇ QR 이미지 저장'), h('button', { class: 'btn ghost', onclick: () => navigator.clipboard?.writeText(url).then(() => toast('링크 복사됨')) }, '🔗 링크 복사')),
    /localhost|127\.0\.0\.1/.test(url) ? h('p', { class: 'err' }, '⚠️ 참가 주소가 localhost예요. 폰에서는 열리지 않아요! [설정] 탭의 "참가 주소"를 와이파이 주소나 배포 주소로 바꿔 주세요.') : null));
}
async function remoteModal() {
  let r; try { r = await A('/api/remote', { eventId: eid }); } catch (e) { return toast(e.message); }
  const url = `${location.origin}/admin.html#r=${r.code}`; const left = h('b', {}, '120');
  const m = modal('🎮 진행자 폰 리모컨', h('div', { class: 'stack center' }, h('p', {}, '내 폰 카메라로 찍으면 이 행사 진행 버튼이 폰에 떠요. 걸어 다니면서 시작·종료·점수 주기를 할 수 있어요.'), qrImg(url, 'qrimg'),
    h('div', { class: 'muted' }, '보안을 위해 ', left, '초 안에 한 번만 쓸 수 있어요. 참가자에게 보여 주지 마세요.')));
  let n = 120; const iv = setInterval(() => { n--; left.textContent = n; if (n <= 0 || !m.isConnected) { clearInterval(iv); if (m.isConnected) { m.remove(); toast('리모컨 QR이 만료됐어요. 필요하면 다시 열어 주세요'); } } }, 1000);
}
async function leagueModal(name) {
  let r; try { r = await A(`/api/league?name=${encodeURIComponent(name)}`); } catch (e) { return toast(e.message); }
  const tb = h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, '순위'), h('th', {}, '팀'), h('th', {}, '누적 점수'), h('th', {}, '행사 우승'), h('th', {}, '참가 행사')),
    ...r.rows.map((x) => h('tr', {}, h('td', {}, `${x.rank}위`), h('td', {}, h('span', { style: { color: x.color } }, '■ '), `${x.icon} ${x.name}`), h('td', {}, h('b', {}, x.total)), h('td', {}, `${x.wins}회`), h('td', {}, `${x.events}번`))));
  modal(`🏅 ${r.name} 리그 순위`, h('div', { class: 'stack' }, r.rows.length ? tb : h('p', { class: 'muted' }, '아직 끝난 게임이 없어요'),
    h('div', { class: 'muted small' }, `같은 리그 이름으로 진행한 행사 ${r.events.length}개 · 팀 이름이 같으면 같은 팀으로 합쳐요`),
    h('div', { class: 'muted small' }, r.events.map((e) => `${fmtDate(e.at)} ${e.name}`).join(' · '))));
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
  if (document.activeElement && body.contains(document.activeElement) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return; // 입력 중엔 다시 그리지 않음
  formDirty = false;
  body.innerHTML = '';
  ({ run: tabRun, playlist: tabPlaylist, people: tabPeople, score: tabScore, quiz: tabQuiz, music: tabMusic, settings: tabSettings })[tab](body);
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
// 게임 순서 프리셋 (만든 뒤에도 자유롭게 바꿀 수 있음)
const PRESETS = [
  ['유아 30분', ['gems', 'mugung', 'eggs', 'fishing', 'crown', 'shout']],
  ['초등 수업 40분', ['mugung', 'dodge', 'rope', 'sync', 'fruit', 'penalty', 'bell', 'paint', 'relay', 'shout']],
  ['운동회 1시간', ['mugung', 'dodge', 'rope', 'runner', 'fruit', 'zombie', 'penalty', 'bell', 'fire', 'paint', 'tuho', 'sync', 'hold', 'relay', 'shout']],
  ['중·고등 레크 40분', ['zombie', 'dodge', 'rhythm', 'basket', 'mino', 'draw', 'hilo', 'paint', 'shout']],
  ['회사 송년회', ['mugung', 'tele', 'mino', 'draw', 'fishing', 'curling', 'sync', 'bell', 'hilo', 'relay', 'hold', 'shout']],
  ['폰 없는 체육', ['pe_freeze', 'pe_simon', 'pe_mission']],
  ['체육 + 협동', ['pe_freeze', 'mugung', 'relay', 'pe_simon', 'sync', 'pe_mission', 'shout']],
];
function tabPlaylist(body) {
  const pl = S.playlist.map((p) => ({ ...p }));
  const locked = ['countdown', 'playing'].includes(S.phase);
  const list = h('div', { class: 'plist edit' });
  const draw = () => {
    list.innerHTML = '';
    pl.forEach((p, i) => {
      const g = games.find((x) => x.id === p.game);
      const w = select({ 0.5: '×0.5', 1: '×1', 1.5: '×1.5', 2: '×2', 3: '×3' }, p.weight); w.onchange = () => (p.weight = +w.value);
      const d = h('input', { class: 'inp sm', type: 'number', min: 5, max: 300, placeholder: g.untimed ? '라운드제' : `기본 ${g.dur[({ baby: 'kid', mid: 'adult', high: 'adult', mixed: 'elem' })[S.settings.mode] || S.settings.mode] ?? g.dur.elem}초`, value: p.dur ?? '', disabled: g.untimed }); d.onchange = () => (p.dur = d.value ? +d.value : undefined);
      list.append(h('div', { class: `pitem ${i < S.idx ? 'done' : ''}` }, h('b', {}, i + 1), h('span', { class: 'gn' }, `${g.emoji} ${g.name}`), field('배점', w), field('시간(초)', d), field('🎵 BGM', bgmSelect(p.game)),
        h('button', { class: 'btn small ghost', onclick: () => { if (i > 0) { [pl[i - 1], pl[i]] = [pl[i], pl[i - 1]]; draw(); } } }, '▲'),
        h('button', { class: 'btn small ghost', onclick: () => { if (i < pl.length - 1) { [pl[i + 1], pl[i]] = [pl[i], pl[i + 1]]; draw(); } } }, '▼'),
        h('button', { class: 'btn small red', onclick: () => { pl.splice(i, 1); draw(); } }, '✕')));
    });
  };
  draw();
  const add = select(Object.fromEntries(games.map((g) => [g.id, `${String(g.no).padStart(2, '0')}. ${g.emoji} ${g.name}${g.team ? ' (팀 협동)' : ''}${g.bonusOnly ? ' (보너스)' : ''}`])), 'dodge');
  const presets = h('div', { class: 'row wrap' }, h('b', {}, '빠른 구성:'), ...PRESETS.map(([n, ids]) => h('button', { class: 'btn small ghost', onclick: () => { const ok = ids.filter((id) => games.some((g) => g.id === id)); if (!ok.length) return toast('이 구성은 아직 없어요'); pl.splice(0, pl.length, ...ok.map((g) => ({ game: g, weight: g === 'shout' ? 2 : 1 }))); draw(); toast(`${n} 구성을 넣었어요. 💾 저장을 눌러 주세요`); } }, n)));
  body.append(h('h3', {}, '게임 순서 편집'), presets, locked ? h('p', { class: 'err' }, '게임 중에는 순서를 바꿀 수 없어요') : null, list,
    h('div', { class: 'row' }, add, h('button', { class: 'btn ghost', onclick: () => { pl.push({ game: add.value, weight: add.value === 'throne' ? 2 : 1 }); draw(); } }, '＋ 추가')),
    h('div', { class: 'row' }, h('button', { class: 'btn', disabled: locked, onclick: async () => { await save({ settings: { playlist: pl } }); toast('게임 순서를 저장했어요'); } }, '💾 저장'),
      h('button', { class: 'btn ghost', onclick: () => { pl.splice(0, pl.length, ...games.map((g) => ({ game: g.id, weight: g.id === 'throne' ? 2 : 1 }))); draw(); } }, '전체 게임 넣기')),
    h('p', { class: 'muted small' }, '배점은 순위 포인트에 곱해져요 (1위 = 팀 수 × 10점 × 배점). 역전 룰렛은 순위 포인트 대신 보너스 점수를 줘요.'));
}
// ---------------- 🎵 음악 ----------------
let myMusic = []; const loadMyMusic = () => BGM.listCustom().then((l) => { myMusic = l; });
loadMyMusic();
const prevAudio = new Audio(); let prevId = null;
async function preview(id, btn) {
  if (prevId === id && !prevAudio.paused) { prevAudio.pause(); prevId = null; btn.textContent = '▶ 미리듣기'; return; }
  document.querySelectorAll('.pvbtn').forEach((b) => { b.textContent = '▶ 미리듣기'; });
  const t = BGM.TRACKS.find((x) => x.id === id); const src = id === 'fanfare' ? BGM.FANFARE.file : t ? t.file : await BGM.customURL(id);
  if (!src) return toast('이 컴퓨터에 없는 곡이에요');
  prevAudio.src = src; prevAudio.volume = (S?.settings?.bgmVol ?? 70) / 100; prevId = id; btn.textContent = '⏸ 멈춤';
  prevAudio.play().catch(() => toast('재생하지 못했어요'));
  prevAudio.onended = () => { btn.textContent = '▶ 미리듣기'; prevId = null; };
}
function bgmOptions(gid) {
  const rec = BGM.REC[gid] || 'g7'; const rn = rec === 'none' ? '음악 없음' : BGM.TRACKS.find((t) => t.id === rec).name;
  return { auto: `⭐ 추천 (${rn})`, ...Object.fromEntries(BGM.TRACKS.map((t) => [t.id, `🎵 ${t.name}`])), ...Object.fromEntries(myMusic.map((t) => [t.id, `💾 ${t.name}`])), none: '🔇 음악 없음' };
}
function bgmSelect(gid) { const sel = select(bgmOptions(gid), S.settings.bgm?.[gid] || 'auto'); sel.classList.add('bgmsel'); sel.onchange = () => setBgm(gid, sel.value); return sel; }
async function setBgm(gid, v) { const m = { ...(S.settings.bgm || {}) }; if (v === 'auto') delete m[gid]; else m[gid] = v; S.settings.bgm = m; await save({ settings: { bgm: m } }); toast('음악을 바꿨어요 · 다음 행사에도 이 설정을 기억해요'); }
const mb = (n) => (n / 1048576).toFixed(1) + 'MB';
async function tabMusic(body) {
  const st = S.settings;
  const vol = (k, label) => { const v = h('b', {}, `${st[k] ?? (k === 'bgmVol' ? 70 : 80)}`); const r = h('input', { type: 'range', min: 0, max: 100, step: 5, value: st[k] ?? (k === 'bgmVol' ? 70 : 80), class: 'rng' }); r.oninput = () => (v.textContent = r.value); r.onchange = () => save({ settings: { [k]: +r.value } }); return h('div', { class: 'volrow' }, h('span', {}, label), r, v); };
  const fan = h('input', { class: 'inp sm', type: 'number', min: 3, max: 60, value: st.fanfareSec ?? 12 }); fan.onchange = () => { const v = Math.max(3, Math.min(60, Math.round(+fan.value || 12))); fan.value = v; save({ settings: { fanfareSec: v } }); };
  body.append(h('h3', {}, '🔊 음량'), h('div', { class: 'card stack' }, vol('bgmVol', '🎵 배경음악'), vol('sfxVol', '🔔 효과음'),
    h('div', { class: 'row wrap' }, field('🎺 승리 빵빠레 길이(초)', fan, '결과 발표·시상식 1위 때 나와요. 끝날 때 자연스럽게 작아져요'),
      h('button', { class: `btn ${st.duck ? 'yellow' : 'ghost'}`, onclick: () => save({ settings: { duck: !st.duck } }).then(() => setTimeout(drawTab, 250)) }, st.duck ? '🎤 말씀 끝 · 음악 다시 크게' : '🎤 말할 때 음악 줄이기')),
    h('p', { class: 'muted small' }, '대형 화면 창에서 M 키를 눌러도 음악을 바로 줄였다 키울 수 있어요. 음량은 대형 화면에 바로 적용돼요.')));
  // 곡 목록
  const list = h('div', { class: 'mlist' });
  for (const t of BGM.TRACKS) { const m = BGM.MOODS[t.mood]; const b = h('button', { class: 'btn small ghost pvbtn', onclick: (e) => preview(t.id, e.currentTarget) }, '▶ 미리듣기'); list.append(h('div', { class: 'mrow', style: { '--mc': m.color } }, h('b', {}, `🎵 ${t.name}`), h('span', { class: 'mood' }, m.label), h('small', { class: 'muted' }, t.desc), b)); }
  { const b = h('button', { class: 'btn small ghost pvbtn', onclick: (e) => preview('fanfare', e.currentTarget) }, '▶ 미리듣기'); list.append(h('div', { class: 'mrow', style: { '--mc': '#ffd43b' } }, h('b', {}, '🎺 빵빠레 (승리 발표 전용)'), h('span', { class: 'mood' }, '🏆 승리'), h('small', { class: 'muted' }, '첫 타격에 맞춰 트로피가 떨어져요'), b)); }
  await loadMyMusic();
  for (const t of myMusic) {
    const m = BGM.MOODS[t.mood] || BGM.MOODS.battle; const b = h('button', { class: 'btn small ghost pvbtn', onclick: (e) => preview(t.id, e.currentTarget) }, '▶ 미리듣기');
    list.append(h('div', { class: 'mrow', style: { '--mc': m.color } }, h('b', {}, `💾 ${t.name}`), h('span', { class: 'mood' }, m.label), h('small', { class: 'muted' }, `${Math.floor(t.dur / 60)}분 ${t.dur % 60}초 · ${mb(t.size)} · 이 컴퓨터에만 저장`), b,
      h('button', { class: 'btn small red', onclick: async () => { if (!confirm(`'${t.name}' 곡을 이 컴퓨터에서 지울까요?`)) return; await BGM.removeCustom(t.id); const m2 = { ...(S.settings.bgm || {}) }; for (const [g, v] of Object.entries(m2)) if (v === t.id) delete m2[g]; await save({ settings: { bgm: m2 } }); toast('지웠어요'); drawTab(); } }, '삭제')));
  }
  // 곡 추가
  const file = h('input', { type: 'file', accept: 'audio/*,.mp3', class: 'inp' }); const nm = h('input', { class: 'inp', placeholder: '곡 이름 (비우면 파일 이름)', maxlength: 30 });
  const mood = select(Object.fromEntries(Object.entries(BGM.MOODS).filter(([k]) => k !== 'none').map(([k, v]) => [k, `${v.label} 분위기`])), 'battle');
  const info = await BGM.storageInfo();
  const addBtn = h('button', { class: 'btn', onclick: async () => { addBtn.disabled = true; addBtn.textContent = '넣는 중…'; try { const r = await BGM.addCustom(file.files[0], nm.value.trim(), mood.value); toast(`'${r.name}' 곡을 넣었어요`); drawTab(); } catch (e) { toast(e.message, 4000); addBtn.disabled = false; addBtn.textContent = '＋ 곡 넣기'; } } }, '＋ 곡 넣기');
  body.append(h('h3', {}, '🎶 곡 목록'), list,
    h('h3', {}, '＋ 내 MP3 넣기'), h('div', { class: 'card stack' }, h('div', { class: 'row wrap' }, file, nm, mood, addBtn),
      h('div', { class: 'notice2' }, h('b', {}, '꼭 읽어 주세요'), h('ul', {},
        h('li', {}, `넣은 곡은 서버가 아니라 '지금 이 컴퓨터의 이 브라우저'에 저장돼요 (곡당 ${BGM.MAX_MB}MB까지). 인터넷이 끊겨도 이 컴퓨터에서는 계속 나와요.`),
        h('li', {}, '대형 화면도 같은 컴퓨터·같은 브라우저(예: 크롬)로 열어야 이 곡이 나와요. 다른 컴퓨터에서는 추천곡이 대신 나와요.'),
        h('li', {}, "브라우저의 '인터넷 사용 기록·쿠키 및 사이트 데이터 삭제', 시크릿 창, 저장 공간 부족이면 넣은 곡이 사라질 수 있어요. 원본 MP3는 꼭 따로 보관하세요."),
        h('li', {}, `지금 이 브라우저 사용량 ${mb(info.usage)}${info.quota ? ` / 사용 가능 약 ${mb(info.quota)}` : ''} · 자동 삭제 방지 ${info.persisted ? '✅ 켜짐' : '⚠️ 브라우저가 허용 안 함 (공간이 부족하면 지워질 수 있어요)'}`)))));
  // 게임별 음악
  const tbl = h('div', { class: 'gmlist' });
  for (const g of games) {
    const sel = bgmSelect(g.id); const tr = BGM.pick(S.settings, g.id, myMusic); const m = BGM.MOODS[tr?.mood || 'none'];
    // 연령별로 다른 곡 (예: 초등·중등 댄스는 다른 노래)
    const ages = Object.keys(BGM.AGE_LABEL); const has = ages.some((a) => S.settings.bgm?.[`${g.id}@${a}`]);
    const box = h('div', { class: 'agebox', style: { display: has ? '' : 'none' } }, ...ages.map((a) => { const k = `${g.id}@${a}`; const o = bgmOptions(g.id); delete o.auto; const sa = select({ same: '기본과 같게', ...o }, S.settings.bgm?.[k] || 'same'); sa.classList.add('bgmsel'); sa.onchange = () => setBgm(k, sa.value === 'same' ? 'auto' : sa.value); return h('label', { class: `agesel ${S.settings.bgm?.[k] ? 'on' : ''}` }, h('span', {}, BGM.AGE_LABEL[a]), sa); }));
    const tg = h('button', { class: 'btn small ghost', onclick: () => { box.style.display = box.style.display ? '' : 'none'; } }, has ? '👶🧑 연령별 ✓' : '👶🧑 연령별');
    tbl.append(h('div', { class: 'gmrow', style: { '--mc': m.color } }, h('span', { class: 'gn' }, `${String(g.no).padStart(2, '0')} ${g.emoji} ${g.name}`), sel, h('span', { class: 'mood' }, m.label), tg, BGM.NO_MUSIC_WHY[g.id] && !tr ? h('small', { class: 'muted' }, `추천이 '없음'인 이유: ${BGM.NO_MUSIC_WHY[g.id]}`) : null, box));
  }
  body.append(h('h3', {}, '🎮 게임별 배경음악'), h('p', { class: 'muted small' }, '게임마다 곡을 고르면 바로 저장되고, 다음에 만드는 행사에도 그대로 적용돼요. 화면 분위기(색·조명 연출)도 곡에 맞춰 바뀌어요.'),
    h('div', { class: 'row' }, h('button', { class: 'btn small ghost', onclick: async () => { if (!confirm('모든 게임을 추천 음악으로 되돌릴까요?')) return; await save({ settings: { bgm: {} } }); toast('추천 음악으로 되돌렸어요'); setTimeout(drawTab, 250); } }, '⭐ 모두 추천 음악으로')), tbl);
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
    h('h3', {}, '결과 내보내기'), h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: download }, '⬇ 결과 CSV (엑셀)'), h('button', { class: 'btn ghost', onclick: printResult }, '🖨 결과표 인쇄/PDF'), h('button', { class: 'btn', onclick: () => saveCard(S, { share: false }).then(() => toast('결과 카드를 저장했어요')) }, '🖼 결과 공유 카드'), S.settings.league ? h('button', { class: 'btn blue', onclick: () => leagueModal(S.settings.league) }, `🏅 ${S.settings.league} 리그 순위`) : null)),
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

function tabQuiz(body) {
  const s = full?.settings || {};
  const bell = h('textarea', { class: 'inp ta', rows: 10, placeholder: '한 줄에 한 문제: 문제 | 정답 | 오답 | 오답 | 오답\n예) 우리 원장님 성함은? | 김민지 | 이수진 | 박지영\n예) 오늘 운동회 장소는? | 별빛체육관 | 달빛강당' });
  bell.value = (s.bellCustom || []).map((q) => q.join(' | ')).join('\n');
  const words = h('textarea', { class: 'inp ta', rows: 5, placeholder: '쉼표나 줄바꿈으로 구분: 원장님, 미끄럼틀, 우리 반 강아지, 축구공 …' });
  words.value = (s.drawCustom || []).join(', ');
  const save2 = async () => {
    const bq = bell.value.split('\n').map((l) => l.split('|').map((x) => x.trim()).filter(Boolean)).filter((q) => q.length);
    const bad = bq.filter((q) => q.length < 3);
    if (bad.length) return toast(`정답과 오답을 | 로 나눠 주세요: "${bad[0][0]}"`);
    const dw = words.value.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
    await save({ settings: { bellCustom: bq, drawCustom: dw } }); toast(`골든벨 ${bq.length}문제 · 그림 단어 ${dw.length}개 저장`);
  };
  body.append(h('div', { class: 'stack' },
    h('h3', {}, '🔔 골든벨 우리 행사 문제'), h('p', { class: 'muted small' }, '넣은 문제가 먼저 나오고, 모자란 만큼 기본 문제로 채워요. 보기 순서는 자동으로 섞여요.'), bell,
    h('h3', {}, '🖍 그려라 맞혀라 단어'), h('p', { class: 'muted small' }, '6개 이상 넣으면 넣은 단어만 써요 (팀마다 다른 단어가 나와요).'), words,
    h('button', { class: 'btn', onclick: save2 }, '💾 문제·단어 저장')));
}

function tabSettings(body) {
  const s = full?.settings || S.settings;
  const name = h('input', { class: 'inp', value: S.event.name, maxlength: 40 });
  const mode = select({ baby: '영아 (보호자와 함께)', kid: '유아 (만 3~7세)', elem: '초등', mid: '중등', high: '고등', adult: '성인', mixed: '전 연령 혼합' }, s.mode);
  const lvl = select({ low: '저학년 (1~3학년)', high: '고학년 (4~6학년)' }, s.elemLevel);
  const scoring = select(SCORING, s.scoring);
  const topN = h('input', { class: 'inp sm', type: 'number', min: 1, max: 50, value: s.topN });
  const teamCount = select(Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 2, `${i + 2}팀`])), S.teams.length);
  const assign = select({ choose: '참가자가 팀 고르기', auto: '자동 배정' }, s.teamAssign);
  const rename = select({ rep: '👑 팀 대표만', all: '팀원 누구나', off: '끄기 (진행자만)' }, s.teamRename || 'rep');
  const motion = select({ auto: '자동 (초등 이상 켜짐 · 영아·유아는 터치)', on: '모두 켜기', off: '끄기 (터치만)' }, s.motion || 'auto');
  const intro = h('input', { class: 'inp sm', type: 'number', min: 3, max: 60, value: s.introSec });
  const res = h('input', { class: 'inp sm', type: 'number', min: 3, max: 60, value: s.resultSec });
  const voice = h('input', { type: 'checkbox', checked: s.voice }); const sfxc = h('input', { type: 'checkbox', checked: s.sfx });
  const cap = h('input', { class: 'inp sm', type: 'number', min: 0, max: 30, value: s.rouletteCapPct });
  const url = h('input', { class: 'inp', value: s.joinUrl || '', placeholder: location.origin });
  const league = h('input', { class: 'inp', value: s.league || '', maxlength: 30, placeholder: '예: 3학년 리그, 11월 늘봄' });
  body.append(h('div', { class: 'stack' },
    field('행사 이름', name),
    h('div', { class: 'grid2' }, field('연령 모드', mode, '혼합 모드: 참가할 때 영아~성인 중 고르고, 같은 게임도 연령별 난이도로 진행 + 점수는 0~100으로 환산해 공정하게 비교'), field('초등 난이도', lvl), field('점수 방식', scoring), field('상위 N명 (상위 N명 평균일 때)', topN),
      field('팀 수', teamCount, '점수가 생긴 뒤에는 바꿀 수 없어요'), field('팀 정하기', assign), field('몸 동작 모드 (폰 휘두르기·기울이기)', motion, '던지기·기울이기 게임을 폰 동작으로 해요. 폰을 꽉 쥐게 안내해 주세요. 터치로도 언제나 할 수 있어요'), field('참가자 팀 이름 바꾸기', rename, '대기 화면에서 폰으로 우리 팀 이름·아이콘을 바꿔요. 이상한 이름은 👥 탭에서 진행자가 고칠 수 있어요'), field('게임 설명 시간(초)', intro), field('결과 발표 시간(초)', res), field('역전 룰렛 보너스 상한 (1위 총점의 %)', cap)),
    h('label', { class: 'chk' }, voice, ' 🗣 음성 안내 (대형 화면)'), h('label', { class: 'chk' }, sfxc, ' 🔊 효과음'),
    field('반별 리그 이름 (선택)', league, '여러 번 하는 수업을 같은 리그 이름으로 묶으면 팀 이름별 누적 순위를 볼 수 있어요 (📊 점수 탭 → 리그 순위)'),
    field('참가 주소 (QR에 들어갈 주소)', url, '배포 주소(예: https://ikiki-arcade.onrender.com) 또는 노트북 와이파이 주소(예: http://192.168.0.15:8080). 비우면 지금 접속한 주소'),
    h('button', { class: 'btn', onclick: async () => {
      await save({ name: name.value, settings: { mode: mode.value, elemLevel: lvl.value, scoring: scoring.value, topN: +topN.value, teamCount: +teamCount.value, teamAssign: assign.value, teamRename: rename.value, motion: motion.value, introSec: +intro.value, resultSec: +res.value, voice: voice.checked, sfx: sfxc.checked, rouletteCapPct: +cap.value, joinUrl: url.value.trim(), league: league.value.trim() } });
      toast('설정을 저장했어요');
    } }, '💾 설정 저장'),
    h('h3', {}, '개인정보'), h('p', { class: 'muted small' }, '행사가 끝나면 참가자 이름을 "참가자1, 2…"로 바꿔 개인정보를 지울 수 있어요. 점수 기록은 남아요.'),
    h('button', { class: 'btn ghost', onclick: async () => { if (confirm('참가자 이름을 모두 지울까요? 되돌릴 수 없어요.')) { await A(`/api/events/${eid}/purge`, {}); toast('지웠어요'); refreshFull(); } } }, '🧹 참가자 이름 지우기')));
}

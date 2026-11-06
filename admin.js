// 진행자(관리자) 화면
import { $, h, Live, api, store, AGE, MODE, teamOf, qrImg, quickKey } from './client.js';
import { saveCard } from './card.js';
import * as BGM from './bgm.js';
import * as TP from './timeplan.js';
import { AGE_NAME as PE_AGE_NAME, TYPE as PE_TYPE, PE_BY } from './pe2data.js';
// 노트북에서 직접 실행(localhost)하면 폰은 localhost로 못 들어오므로, 참가 QR에는 이 노트북의 같은 와이파이 주소를 씀
let localBase = '';
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) fetch('/api/info').then((r) => r.json()).then((r) => { if (r.lan?.[0]) localBase = r.lan[0]; }).catch(() => {});

const app = $('#app');
let token = store('ikiki:admin');
let me = null; // { username, name, role }
let games = [];
let S = null, live = null, eid = null, tab = null, full = null, busy = false;

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
  live?.stop(); live = null; S = null; tab = null; draw.ph = null;
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
  h('main', { class: 'amain' }, newEventCard(), soloCard(), h('h2', {}, '행사 목록'), list));
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

// 🎮 혼자 테스트하기 (행사 없이 바로): 게임 하나 또는 몇 개를 골라 나 vs 컴퓨터
function soloCard() {
  const g = h('select', { class: 'inp' }, h('option', { value: '__3' }, '🎲 아무 게임 3개'), ...games.map((x) => h('option', { value: x.id }, `${String(x.no).padStart(2, '0')}. ${x.emoji} ${x.name}`)));
  const lv = lvSelect();
  const mode = select({ vs: '🎮 내가 직접 (나 vs 컴퓨터)', watch: '👀 구경 (컴퓨터 vs 컴퓨터)' }, 'vs');
  const pickGames = () => { if (g.value !== '__3') return [g.value]; const pool = games.filter((x) => x.dev !== 'none').map((x) => x.id); const out = []; while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); return out; };
  return h('div', { class: 'card solocard' }, h('h2', {}, '🎮 혼자 테스트하기'), h('p', { class: 'muted small' }, '사람 없이 혼자 게임을 해 봐요. 나는 🔴 홍팀, 컴퓨터는 🔵 청팀. 실제 게임 규칙·점수 그대로이고, 행사 목록·기록에는 남지 않아요.'),
    h('div', { class: 'row wrap' }, g, mode, h('label', { class: 'lvl' }, '🤖 ', lv), h('button', { class: 'btn blue', onclick: () => soloStart(pickGames(), mode.value, lv.value) }, '▶ 시작')));
}
function newEventCard() {
  const name = h('input', { class: 'inp', placeholder: '행사 이름 (예: 별빛어린이집 가을 운동회)', maxlength: 40 });
  const mode = select({ baby: '영아 (보호자와 함께)', kid: '유아 (만 3~7세)', elem: '초등', mid: '중등', high: '고등', adult: '성인', mixed: '전 연령 혼합' }, 'elem');
  const teams = select(Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 2, `${i + 2}팀`])), '4');
  const assign = select({ choose: '참가자가 팀 고르기', auto: '자동 배정 (인원 균등)' }, 'choose');
  const scoring = select(SCORING, 'avg');
  const autoRun = h('input', { type: 'checkbox', checked: true });
  const device = select({ phone: '📱 참가자 휴대폰으로 (QR·참가 코드)', nophone: '📋 휴대폰 없이 (노트북 + 빔 화면, 진행자가 점수 입력)' }, 'phone');
  const devHelp = h('small', { class: 'muted' }, '휴대폰: 같은 와이파이·데이터로 이 사이트에 접속 (카메라·마이크·위치 권한 없이, QR 없이 코드 입력도 가능)');
  device.onchange = () => { devHelp.textContent = device.value === 'nophone' ? '휴대폰 없이: 노트북 한 대로 대형 화면에 게임·규칙·타이머를 띄우고, 점수는 진행자가 버튼·키보드로 넣어요. 🙌·🔁 게임만 들어가요' : '휴대폰: 같은 와이파이·데이터로 이 사이트에 접속 (카메라·마이크·위치 권한 없이, QR 없이 코드 입력도 가능)'; };
  const btn = h('button', { class: 'btn' }, '＋ 행사 만들기');
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const r = await A('/api/events', { name: name.value.trim() || '아이키키 오락실', settings: { mode: mode.value, teamCount: +teams.value, teamAssign: assign.value, scoring: scoring.value, auto: autoRun.checked, device: device.value, ...(device.value === 'nophone' ? { playlist: ['pe_freeze', 'bell', 'pe_simon', 'pe_mission'].map((game) => ({ game, weight: 1 })) } : {}) } });
      location.hash = `e=${r.id}`;
    } catch (e) { toast(e.message); btn.disabled = false; }
  };
  return h('div', { class: 'card newev' }, h('h2', {}, '🎉 새 행사'), name,
    h('label', { class: 'fld' }, h('span', {}, '진행 방식'), device, devHelp),
    h('div', { class: 'grid2' }, field('연령 모드', mode), field('팀 수', teams), field('팀 정하기', assign), field('점수 방식', scoring)),
    h('label', { class: 'chk' }, autoRun, ' 자동 진행 (설명 → 카운트다운 → 게임 → 결과 → 다음 게임이 자동으로 넘어가요)'),
    h('p', { class: 'muted small' }, '게임 순서는 연령 모드에 맞게 추천 목록이 들어가요. 만든 뒤 자유롭게 바꿀 수 있어요.'), btn);
}
function select(opts, val) { const s = h('select', { class: 'inp' }); for (const [k, v] of Object.entries(opts)) s.append(h('option', { value: k, selected: String(k) === String(val) }, v)); return s; }
function field(label, el, help) { return h('label', { class: 'fld' }, h('span', {}, label), el, help ? h('small', { class: 'muted' }, help) : null); }

// 재경기: 점수를 어떻게 할지 먼저 고름 (바로 지우거나 다시 시작하지 않음)
function replayModal() {
  if (document.querySelector('.replaym')) return;
  const lr = S.lastResult; const nm = lr?.label || S.item?.name || '방금 게임';
  let done = false;
  const go = async (keep) => {
    if (done) return;
    if (!keep && !confirm(`'${nm}' 점수를 행사 점수에서 지우고 다시 할까요?\n다른 게임 점수와 참가자·팀 설정은 그대로예요.`)) return;
    done = true; m.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try { await A(`/api/events/${eid}/command`, { op: 'replay', arg: { keep }, seq: S.seq }); toast(keep ? '이전 점수 유지 · 새 점수 추가' : '이 게임 점수만 지우고 다시 시작'); m.remove(); } catch (e) { toast(e.message); done = false; m.querySelectorAll('button').forEach((b) => { b.disabled = false; }); }
  };
  const m = modal('어떻게 다시 할까요?', h('div', { class: 'stack replaym' },
    h('p', { class: 'muted' }, `${nm} 재경기`),
    h('button', { class: 'btn green big', onclick: () => go(true) }, h('div', {}, h('b', {}, '점수 유지하고 다시 하기'), h('div', { class: 'small' }, '이전 점수 유지 · 새 점수 추가'))),
    h('button', { class: 'btn yellow big', onclick: () => go(false) }, h('div', {}, h('b', {}, '방금 게임 점수 지우고 다시 하기'), h('div', { class: 'small' }, '이 게임 점수만 지우고 다시 시작'))),
    h('button', { class: 'btn ghost', onclick: () => m.remove() }, '취소')));
}
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
  const myEid = eid;
  app.innerHTML = '';
  app.append(h('div', { class: 'muted pad' }, '불러오는 중…'));
  try { full = (await A(`/api/events/${eid}`)).full; fullKey = JSON.stringify(full.players); fullSKey = JSON.stringify(full.settings); } catch (e) { app.innerHTML = ''; app.append(h('p', { class: 'err pad' }, e.message), h('a', { class: 'btn', href: '#' }, '← 목록')); return; }
  if (eid !== myEid) return; // 불러오는 사이 다른 행사로 옮겼으면 그만
  live?.stop(); // 빠르게 다른 행사로 옮겨도 이전 연결이 남지 않게
  let lv = null;
  lv = new Live({ t: 'hello', role: 'admin', token, eid }, (m) => {
    if (live !== lv || eid !== myEid) return; // 지난 행사 연결에서 온 메시지는 무시 (상태 섞임 방지)
    if (m.t === 'state' && m.event?.id && m.event.id !== myEid) return;
    if (m.t === 'state') { S = m; draw(); refreshFull(); }
    if (m.t === 'live') { liveMini(m); }
    if (m.t === 'err') { toast(m.msg); if (m.code === 401) { store('ikiki:admin', null); token = null; route(); } }
  }, (st) => { if (!lv || live === lv) document.body.classList.toggle('offline', st === 'offline'); }); // 목록으로 나간 뒤엔 '연결 끊김' 표시 안 함
  live = lv;
  // 행사를 여러 번 열고 닫아도 타이머·단축키가 겹쳐 등록되지 않게 한 번만
  if (!consoleView.once) { consoleView.once = true; setInterval(clock, 250); setInterval(() => { if (S && liveMode()) paintTime(); }, 1000); addEventListener('keydown', hotkeys); }
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
  if (quickKey(e, S, token)) return;
  if (e.key === ' ') { e.preventDefault(); cmd('next', null, S.phase === 'playing' ? '지금 게임을 끝내고 점수를 반영할까요?' : null); }
  if (e.key === 'p' || e.key === 'P') cmd(S.paused ? 'resume' : 'pause');
  if ((e.key === 'e' || e.key === 'E') && ['countdown', 'playing'].includes(S.phase)) cmd('endNow', null, '지금 게임을 끝내고 점수를 반영할까요?');
}
async function cmd(op, arg, confirmMsg) {
  if (confirmMsg && !confirm(confirmMsg)) return;
  if (busy) return;
  // 같은 버튼·단축키를 0.7초 안에 또 누르면 한 번으로 침 (결과에서 Space 두 번 → 다음 게임 설명까지 넘어가던 문제)
  if (cmd.last && cmd.last.op === op && Date.now() - cmd.last.at < 700) return;
  busy = true; cmd.last = { op, at: Date.now() };
  try { await A(`/api/events/${eid}/command`, { op, arg, seq: S.seq }); } catch (e) { toast(e.message); } finally { busy = false; }
}
const joinUrl = () => (S.settings.joinUrl || localBase || location.origin) + '/play.html?e=' + S.event.code;

// 사회자 화면 3단계: ① 행사 준비 → ② 게임 순서 → ③ 진행. 나머지(참가자·점수·문제·음악·설정)는 [더보기]
const STEPS = [['prep', '① 행사 준비'], ['playlist', '② 게임 순서'], ['run', '③ 진행']];
const MORE = [['people', '👥 참가자·팀'], ['score', '🏆 점수'], ['quiz', '✏️ 문제·단어'], ['music', '🎵 음악'], ['settings', '⚙️ 설정']];
const busyPh = () => ['countdown', 'playing'].includes(S?.phase);
function goTab(k) { tab = k; drawTab(); syncTabs(); }
function syncTabs() {
  const con = $('.con'); if (!con) return;
  con.className = `con t-${tab} ${busyPh() ? 'busy' : ''}`;
  document.querySelectorAll('.tabs [data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
  const more = MORE.some(([k]) => k === tab); const mb2 = $('.tabs .morebtn'); if (mb2) mb2.classList.toggle('on', more);
  if (more) $('.tabs .morerow')?.classList.add('open');
}
function draw() {
  if (!S) return;
  if (!$('.con')) {
    app.innerHTML = '';
    const moreRow = h('div', { class: 'morerow' }, ...MORE.map(([k, l]) => h('button', { 'data-t': k, onclick: () => goTab(k) }, l)));
    app.append(h('header', { class: 'ah' }, h('a', { class: 'btn small ghost', href: '#' }, '← 목록'), h('div', { class: 'evname' }), h('span', { class: 'phase' })),
      h('div', { class: 'con' }, h('nav', { class: 'tabs steps' },
        h('div', { class: 'steprow' }, ...STEPS.map(([k, l]) => h('button', { 'data-t': k, class: 'step', onclick: () => goTab(k) }, l)),
          h('button', { class: 'morebtn', onclick: () => moreRow.classList.toggle('open') }, '더보기 ▾')), moreRow),
      h('section', { class: 'timebar card' }),
      h('section', { class: 'ctrl card' }), h('section', { class: 'tabbody' })));
  }
  // 처음 열 때: 아직 시작 전이면 ① 준비, 진행 중이면 ③ 진행. 게임이 시작되면 ③으로 자동 이동 (준비 단계는 진행 중 숨김)
  const ph = S.phase;
  if (!tab) tab = document.body.classList.contains('remote') || ph !== 'lobby' || S.idx > 0 || S.standings.played ? 'run' : 'prep';
  if (draw.ph !== ph) { if (draw.ph && ['intro', 'countdown', 'playing'].includes(ph) && ['prep', 'playlist'].includes(tab)) { tab = 'run'; draw.rk = null; drawTab(); } draw.ph = ph; }
  if (busyPh() && tab === 'prep') { tab = 'run'; drawTab(); }
  $('.evname').textContent = `${S.event.name} · 코드 ${S.event.code}`;
  $('.phase').textContent = `${S.paused ? '⏸ 일시정지 · ' : ''}${PHASE[S.phase]}`;
  $('.phase').className = `phase p-${S.phase}`;
  syncTabs();
  // 참가자가 들어오고 나갈 때마다 오는 상태 메시지로 버튼을 다시 만들면 누르던 버튼이 사라져 클릭이 씹힘
  // → 진행에 영향 있는 값이 바뀔 때만 다시 그리고, 인원수는 글자만 바꿈
  const ck = ctrlKey();
  if (ck !== draw.ck || !$('.ctrl .bigbtns')) { draw.ck = ck; drawCtrl(); } else updateCounts();
  drawQuick(); paintTime(); timeModal.paint?.();
  if (tab === 'run') { const rk = runKey(); if (rk !== draw.rk || !$('.tabbody .plist')) { draw.rk = rk; drawTab(); } }
  else if (tab === 'prep' || tab === 'playlist') { const pk = JSON.stringify([S.playlist, S.phase === 'lobby', busyPh(), S.idx, S.teams.length, S.settings.mode, S.settings.device, S.standings.played > 0]); if (pk !== draw.pk) { draw.pk = pk; if (!formDirty) drawTab(); } draw.rk = null; }
  else draw.rk = null;
}
const ctrlKey = () => JSON.stringify([S.phase, S.seq, S.paused, S.idx, S.total, S.item?.game, S.item?.host, S.notice, S.settings.duck, S.settings.auto, S.ceremonyStep, S.standings.played, S.teams.map((t) => [t.id, t.name, t.icon, t.color]), S.settings.league, S.qinfo?.ver, S.lastResult?.runId, S.settings.preview]);
const runKey = () => JSON.stringify([S.phase, S.idx, S.playlist, S.standings.rows, S.replayLog, S.teams.map((t) => [t.id, t.name, t.icon, t.color])]);
// ---------------- ⚡ 퀵 점수판 (응원·수동 점수) ----------------
// 팀별 +단위/−단위 버튼, 단위(1·2·3·5·10) 고르기, 직접 입력, 마지막 되돌리기, 최근 기록. 큰 점수(10점 이상)·기록 삭제는 확인
function quickSend(team, delta) {
  const t = teamOf(S, team);
  if (Math.abs(delta) >= 10 && !confirm(`${t.icon} ${t.name}에 ${delta > 0 ? '+' : ''}${delta}점을 줄까요?`)) return;
  return A(`/api/events/${eid}/quick`, { team, delta, op: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }).catch((e) => toast(e.message));
}
function drawQuick() {
  const box = $('.ctrl .qpad'); if (!box || !S) return;
  const unit = S.settings.quickUnit || 1;
  const key = JSON.stringify([unit, S.teams.map((t) => [t.id, t.name, t.icon, t.color])]);
  if (box.dataset.k !== key) {
    box.dataset.k = key; box.innerHTML = '';
    const units = h('div', { class: 'qunits' }, h('span', { class: 'muted small' }, '단위'), ...[1, 2, 3, 5, 10].map((u) => h('button', { class: `btn small ${u === unit ? 'yellow' : 'ghost'}`, onclick: () => save({ settings: { quickUnit: u } }) }, `${u}`)));
    const custom = h('input', { class: 'inp sm qcustom', type: 'number', placeholder: '직접', min: -100, max: 100 });
    const rows = h('div', { class: 'qrows' }, ...S.teams.map((t, i) => h('div', { class: 'qrow', style: { '--tc': t.color }, 'data-t': t.id },
      h('b', {}, `${i < 9 ? `${i + 1} ` : ''}${t.icon} ${t.name}`), h('span', { class: 'qtot' }),
      h('button', { class: 'btn ghost qm', onclick: () => quickSend(t.id, -unit) }, `−${unit}`),
      h('button', { class: 'btn green qp', onclick: (e) => { e.currentTarget.animate([{ transform: 'scale(.86)' }, { transform: 'scale(1)' }], 160); quickSend(t.id, unit); } }, `+${unit}`),
      h('button', { class: 'btn ghost small', onclick: () => { const v = Number(custom.value); if (!v) return toast('직접 칸에 점수를 넣어 주세요 (예: 7, -2)'); quickSend(t.id, v); } }, '직접'))));
    const undo = h('button', { class: 'btn ghost small qundo', onclick: () => { const last = (S.quickLog || []).find((x) => x.kind === 'quick'); if (!last) return toast('되돌릴 퀵 점수가 없어요'); const tm = teamOf(S, last.team); if (Math.abs(last.delta) >= 10 && !confirm(`${tm.name} ${last.delta}점을 되돌릴까요?`)) return; A(`/api/events/${eid}/undo`, { id: last.id }).catch((e) => toast(e.message)); } }, '↩ 마지막 되돌리기 (U)');
    box.append(h('div', { class: 'qhead' }, h('b', {}, '⚡ 퀵 점수'), units, custom, undo), rows, h('div', { class: 'qlog' }), h('div', { class: 'muted small' }, '단축키: 숫자 1~9 = 그 팀 +단위 · Shift+숫자 = −단위 · U = 되돌리기 (대형 화면 창에서도 돼요. 입력 칸에 글자 쓸 때는 안 눌려요)'));
  }
  const tot = Object.fromEntries((S.standings.rows || []).map((r) => [r.id, r.total]));
  box.querySelectorAll('.qrow').forEach((r) => { const el = r.querySelector('.qtot'); const v = tot[r.dataset.t] ?? 0; if (el.textContent !== `${v}점`) { el.textContent = `${v}점`; el.animate?.([{ color: '#ffd43b' }, { color: '' }], 600); } });
  const lg = box.querySelector('.qlog'); const lk = JSON.stringify(S.quickLog || []);
  if (lg.dataset.k !== lk) {
    lg.dataset.k = lk; lg.innerHTML = '';
    for (const x of S.quickLog || []) { const tm = teamOf(S, x.team); lg.append(h('div', { class: 'qli' }, h('span', { style: { color: tm.color } }, `${tm.icon} ${tm.name}`), h('b', {}, `${x.delta > 0 ? '+' : ''}${x.delta}`), h('small', { class: 'muted' }, `${x.kind === 'quick' ? '퀵' : '수동'} ${new Date(x.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`), h('button', { class: 'lnk', onclick: () => { if (confirm(`${tm.name} ${x.delta > 0 ? '+' : ''}${x.delta}점 기록을 지울까요?`)) A(`/api/events/${eid}/undo`, { id: x.id }).catch((e) => toast(e.message)); } }, '지우기'))); }
  }
}
function updateCounts() {
  const el = $('.ctrl .nowline .muted'); if (!el) return;
  const total = Object.values(S.counts).reduce((s, x) => s + x.total, 0); const online = Object.values(S.counts).reduce((s, x) => s + x.online, 0);
  el.textContent = `참가 ${total}명 (접속 ${online})`;
}

// 게임 한 판 예상 시간(초): 게임 시간 + 설명 + 카운트다운 + 결과 발표
const ageOf = () => ({ baby: 'kid', mid: 'adult', high: 'adult', mixed: 'elem' })[S.settings.mode] || S.settings.mode;
const estSec = (items) => TP.plan(items, ctxT()).total;
const fmtMin = (sec) => TP.fmt(sec);
// ---------------- ⏱ 행사 시간 (전체 예상 · 목표 · 진행 중 추적) ----------------
const ctxT = () => ({ games: Object.fromEntries(games.map((g) => [g.id, g])), mode: S.settings.mode, introSec: S.settings.introSec ?? 10, resultSec: S.settings.resultSec ?? 12, preview: S.settings.preview !== false, previewSec: S.settings.previewSec || 6, est: TP.estOf(S.settings.timing) });
const tgtSec = () => (S.settings.timing?.target ? S.settings.timing.target * 60 : null);
const saveTiming = (patch) => { S.settings.timing = { ...(S.settings.timing || {}), ...patch }; paintTime(); return save({ settings: { timing: S.settings.timing } }); };
const liveMode = () => !!S.startedAt && !['ended'].includes(S.phase) && !(S.phase === 'lobby' && S.idx === 0 && !S.standings.played);
let delayAsk = 0; // 지연 알림을 닫으면, 지연이 3분 더 늘어날 때까지 다시 안 띄움
function targetPicker() {
  const t = S.settings.timing?.target;
  const sel = h('select', { class: 'inp tsel', title: '목표 행사 시간' }, h('option', { value: '' }, '목표 없음'), ...TP.TARGETS.map((m) => h('option', { value: m, selected: t === m }, `${m}분`)), h('option', { value: 'custom', selected: !!t && !TP.TARGETS.includes(t) }, t && !TP.TARGETS.includes(t) ? `${t}분 (직접)` : '직접 입력…'));
  const inp = h('input', { class: 'inp sm tcus', type: 'number', min: 5, max: 480, placeholder: '분', value: t && !TP.TARGETS.includes(t) ? t : '', style: { display: 'none' } });
  const ok = h('button', { class: 'btn small', style: { display: 'none' }, onclick: () => { const v = Math.round(+inp.value); if (!(v >= 5 && v <= 480)) return toast('5~480분으로 넣어 주세요'); saveTiming({ target: v }); } }, '확인');
  sel.onchange = () => { if (sel.value === 'custom') { inp.style.display = ''; ok.style.display = ''; inp.focus(); return; } saveTiming({ target: sel.value ? +sel.value : null }); };
  return h('span', { class: 'tpick' }, '🎯 목표', sel, inp, ok);
}
// 상단 시간 막대: 준비 중엔 [게임 수 · 예상 총 시간 · 목표 · 초과/여유], 행사 중엔 [경과 · 남은 게임 · 예상 종료 · 목표 종료 · 지연/여유]
function paintTime() {
  const bar = $('.timebar'); if (!bar || !S) return;
  const c = ctxT(); const P = TP.plan(S.playlist, c); const tg = tgtSec(); const now = live ? live.now() : Date.now();
  const key = JSON.stringify([liveMode(), S.settings.timing?.target, S.playlist.length]);
  if (bar.dataset.k !== key) { bar.dataset.k = key; bar.innerHTML = ''; bar.append(h('div', { class: 'tmain' }), h('div', { class: 'tside' }, liveMode() ? null : targetPicker(), h('button', { class: 'btn small ghost', onclick: () => timeModal() }, '⏱ 시간 상세보기')), h('div', { class: 'talert' })); }
  const main = bar.querySelector('.tmain'); const al = bar.querySelector('.talert'); al.innerHTML = '';
  if (!liveMode()) {
    const d = tg ? P.total - tg : 0;
    main.innerHTML = '';
    main.append(h('b', { class: 'tbig' }, P.games ? `⏱ ${TP.fmt(P.total)}` : '⏱ -'), tg ? h('b', { class: 'tbig tg' }, `/ 🎯 ${TP.fmt(tg, false)}`) : null,
      h('span', { class: 'tsub' }, `게임 ${P.games}개${tg ? ' · ' : ''}`, tg ? h('b', { class: Math.abs(d) <= 60 ? 'ok' : d > 0 ? 'over' : 'under' }, Math.abs(d) <= 60 ? '딱 맞아요' : d > 0 ? `${TP.fmt(d, false)} 초과` : `${TP.fmt(-d, false)} 여유`) : null));
    bar.className = `timebar card ${tg && d > 60 ? 'isover' : ''}`;
    return;
  }
  // 행사 진행 중
  const el = (now - S.startedAt) / 1000; const rem = TP.remainSec(S, c, now); const endAt = now + rem * 1000;
  const tEnd = tg ? S.startedAt - c.est.opening * 1000 + tg * 1000 : null; const delay = tEnd ? (endAt - tEnd) / 1000 : 0;
  const leftGames = Math.max(0, S.total - S.idx - (['countdown', 'playing'].includes(S.phase) ? 1 : 0)); // 아직 시작 안 한 게임
  main.innerHTML = '';
  main.append(h('b', { class: 'tbig' }, `⏱ 경과 ${TP.fmt(el, false)}`), h('span', { class: 'tsub' }, `남은 게임 ${leftGames}개 · 예상 종료 ${TP.clock(endAt)}${tEnd ? ` · 목표 종료 ${TP.clock(tEnd)}` : ''}`),
    tEnd ? h('b', { class: `tdelay ${delay > 60 ? 'over' : 'ok'}` }, delay > 60 ? `${TP.fmt(delay, false)} 지연` : delay < -60 ? `${TP.fmt(-delay, false)} 여유` : '예정대로') : null);
  bar.className = `timebar card live ${delay > 60 ? 'isover' : ''}`;
  // 늦어지면 알림 + 다음 게임 시간 줄이기 제안 (누르기 전엔 아무것도 안 바뀜)
  const nst = ['countdown', 'playing'].includes(S.phase) ? S.idx + 1 : S.idx; // 아직 시작 안 한 첫 게임부터
  const nextI = S.playlist.findIndex((p, i) => i >= nst && !games.find((g) => g.id === p.game)?.untimed);
  if (tEnd && delay >= 120 && (!delayAsk || delay >= delayAsk + 180) && S.phase !== 'ceremony') {
    const np = S.playlist[nextI]; const ng = np && games.find((g) => g.id === np.game);
    const cur = np ? TP.playSec(np, ng, c.mode) : 0; const nd = Math.max(20, Math.round(cur - Math.min(delay, cur * 0.4)));
    al.append(h('div', { class: 'tnote' }, h('span', {}, `⚠️ 예정보다 ${TP.fmt(delay, false)} 지연 중입니다.${np && nd < cur ? ` 다음 게임 시간을 단축할까요? (${ng.emoji} ${ng.name} ${cur}초 → ${nd}초)` : ''}`),
      np && nd < cur ? h('button', { class: 'btn small yellow', onclick: () => { if (!confirm(`${ng.name} 진행 시간을 ${cur}초 → ${nd}초로 줄일까요?`)) return; const pl = S.playlist.map((p, i) => (i === nextI ? { ...p, dur: nd } : { ...p })); savePlaylist(pl, '다음 게임 시간 단축 저장됨'); delayAsk = delay; toast('다음 게임 시간을 줄였어요'); } }, '⏩ 단축하기') : null,
      h('button', { class: 'btn small ghost', onclick: () => { delayAsk = delay; paintTime(); } }, '괜찮아요')));
  }
}
function timeModal() {
  const box = h('div', { class: 'stack tmodal' });
  const m = modal('⏱ 행사 시간 상세', box, () => { timeModal.paint = null; });
  const opened = new Set(); // 다시 그려도 펼친 칸은 그대로
  const keep = (key, d) => { if (opened.has(key)) d.open = true; d.ontoggle = () => (d.open ? opened.add(key) : opened.delete(key)); return d; };
  const paint = () => {
    if (!m.isConnected) return; box.innerHTML = '';
    const c = ctxT(); const P = TP.plan(S.playlist, c); const tg = tgtSec();
    box.append(h('p', { class: 'tsay' }, P.games ? `이 게임들을 전부 진행하면 ${TP.fmt(P.total)} 걸립니다.` : '게임을 고르면 전체 시간이 나와요.'), h('div', { class: 'row wrap' }, targetPicker()));
    const PL = { play: ['🎮 게임 플레이 (반복 판 포함)', '실제 설정'], explain: ['📖 게임 설명', `설명 화면 ${Math.max(c.introSec, c.preview ? c.previewSec : 0)}초(설정)와 사회자 설명 ${c.est.explain}초(추정) 중 긴 쪽`], ready: ['🙋 참가자 준비', '추정'], cd: ['3·2·1 카운트다운', '실제 3초'], results: ['🏆 점수 발표·승리 연출', `실제 설정 ${c.resultSec}초`], trans: ['🔁 게임 사이 전환', '추정'], opening: ['👋 시작 인사', '추정'], ceremony: ['🥇 최종 시상', '추정'], buffer: ['🧘 여유 시간', `${c.est.buffer}%`] };
    box.append(h('table', { class: 'ttab' }, h('tbody', {}, ...Object.entries(PL).map(([k, [l, why]]) => h('tr', {}, h('td', {}, l), h('td', { class: 'num' }, TP.fmt(P.parts[k] || 0, false)), h('td', { class: 'muted small' }, why))),
      h('tr', { class: 'sum' }, h('td', {}, '합계'), h('td', { class: 'num' }, TP.fmt(P.total)), h('td', {})))));
    box.append(keep('rows', h('details', {}, h('summary', {}, `게임별 시간 (${P.games}개)`), h('table', { class: 'ttab' }, h('tbody', {}, ...P.rows.map((r, i) => h('tr', {}, h('td', {}, `${i + 1}. ${r.emoji} ${r.name}${r.rep > 1 ? ` ×${r.rep}판` : ''}`), h('td', { class: 'num' }, `${TP.fmt(r.play, false)}${r.untimed ? '(추정)' : ''}`), h('td', { class: 'num' }, TP.fmt(r.total, false)))))))));
    // 추정값 고치기
    const est = c.est;
    const num = (k, unit, div = 1) => { const i = h('input', { class: 'inp sm', type: 'number', min: 0, value: Math.round(est[k] / div) }); i.onchange = () => { const v = Math.max(0, Math.round(+i.value || 0)) * div; saveTiming({ [k]: v }).then(() => paint()); }; return h('label', { class: 'testf' }, h('span', {}, TP.EST_LABEL[k]), i, h('small', {}, unit)); };
    const buf = select({ 0: '0%', 5: '5%', 10: '10%', 15: '15%', 20: '20%' }, est.buffer); buf.onchange = () => saveTiming({ buffer: +buf.value }).then(() => paint());
    box.append(keep('est', h('details', {}, h('summary', {}, '✏️ 추정값 고치기 (실제와 다르면 바꿔 주세요)'), h('div', { class: 'testg' }, num('explain', '초'), num('ready', '초'), num('trans', '초'), num('opening', '분', 60), num('ceremony', '분', 60), h('label', { class: 'testf' }, h('span', {}, TP.EST_LABEL.buffer), buf)),
      h('p', { class: 'muted small' }, `실제 설정값: 설명 화면 ${c.introSec}초 · 결과 발표 ${c.resultSec}초 (더보기 → ⚙️ 설정에서 바꿈), 게임 시간·반복 판 수 (② 게임 순서 ⚙에서 바꿈)`))));
    // 목표 시간 맞춤
    if (tg) {
      const from = liveMode() ? S.idx + (['countdown', 'playing'].includes(S.phase) ? 1 : 0) : 0;
      const pool = games.filter((g) => g.dev !== 'none' && (S.settings.device !== 'nophone' || g.dev !== 'phone'));
      const F = TP.fit(S.playlist, c, tg, { from, pool });
      const sec = h('div', { class: 'card tfit' }, h('h3', {}, `🎯 목표 ${TP.fmt(tg, false)}에 맞추기`),
        h('p', {}, F.state === 'ok' ? '✅ 지금 구성이 목표 시간에 딱 맞아요.' : F.state === 'over' ? `지금 구성은 목표보다 ${TP.fmt(F.diff, false)} 길어요.` : `지금 구성은 목표보다 ${TP.fmt(-F.diff, false)} 짧아요.`));
      const apply = (pl, what) => { if (!confirm(`${what}\n게임 순서를 이렇게 바꿀까요? (바꾼 뒤에도 ② 게임 순서에서 다시 고칠 수 있어요)`)) return; savePlaylist(pl, '시간 맞춤 저장됨'); toast('바꿨어요'); setTimeout(paint, 500); if (['playlist', 'prep'].includes(tab)) { formDirty = false; drawTab(); } };
      for (const o of F.ideas) sec.append(h('div', { class: 'tidea' }, h('span', {}, `${o.text} → ${o.save > 0 ? `${TP.fmt(o.save, false)} 줄어요` : `${TP.fmt(-o.save, false)} 늘어요`} (예상 ${TP.fmt(TP.plan(o.pl, c).total)})`), h('button', { class: 'btn small ghost', onclick: () => apply(o.pl, o.text) }, '적용')));
      if (F.rec?.steps.length) sec.append(h('div', { class: 'trec' }, h('b', {}, `⭐ 추천 구성: ${TP.fmt(F.rec.total)} (게임 ${F.rec.pl.length}개)`), h('ul', {}, ...F.rec.steps.slice(0, 12).map((t) => h('li', {}, t)), F.rec.steps.length > 12 ? h('li', {}, `외 ${F.rec.steps.length - 12}가지`) : null), h('button', { class: 'btn green', onclick: () => apply(F.rec.pl, `추천 구성 (${F.rec.steps.length}가지 변경)`) }, '추천 구성으로 바꾸기')));
      if (F.state !== 'ok' && !F.ideas.length && !F.rec?.steps.length) sec.append(h('p', { class: 'muted' }, '바꿀 수 있는 게임이 없어요 (이미 한 게임은 바꾸지 않아요)'));
      sec.append(h('p', { class: 'muted small' }, '제안은 미리 계산만 해요. [적용]을 누르고 확인해야 실제로 바뀌어요.'));
      box.append(sec);
    } else box.append(h('p', { class: 'muted' }, '🎯 목표 시간을 고르면 그 시간에 맞는 게임 구성을 추천해 드려요.'));
  };
  timeModal.paint = paint; paint();
}
function drawCtrl() {
  const c = $('.ctrl'); c.innerHTML = '';
  const ph = S.phase; const it = S.item;
  const total = Object.values(S.counts).reduce((s, x) => s + x.total, 0); const online = Object.values(S.counts).reduce((s, x) => s + x.online, 0);
  const B = (label, op, cls = '', arg, cm) => h('button', { class: `btn ${cls}`, onclick: () => cmd(op, arg, cm) }, label);
  // 진행 상황: 지금 게임 n/전체 · 남은 게임 · 예상 남은 시간
  const left = S.playlist.slice(S.idx + (['playing', 'countdown'].includes(ph) ? 1 : 0)); // 결과 화면에선 idx가 이미 다음 게임
  const prog = S.total ? h('div', { class: 'progline' }, h('span', { class: 'pbar' }, h('i', { style: { width: `${Math.round((Math.min(S.idx + (ph === 'results' ? 1 : 0), S.total) / S.total) * 100)}%` } })),
    h('span', { class: 'muted small' }, S.idx >= S.total ? '모든 게임 끝' : `남은 게임 ${left.length}개 · 예상 남은 시간 ${TP.fmt(TP.remainSec(S, ctxT(), live.now()))} (시상 포함)`)) : null;
  const now = h('div', { class: 'nowline' }, h('b', { class: 'nowg' }, it ? `${it.emoji} ${S.idx + 1}/${S.total} ${it.name}${(S.playlist[S.idx]?.rep || 1) > 1 ? ` (${S.rep || 1}/${S.playlist[S.idx].rep}판)` : ''}` : S.idx >= S.total ? '🏁 모든 게임 완료' : '게임 없음'), h('span', { class: 'ctime' }), h('span', { class: 'muted' }, `참가 ${total}명 (접속 ${online})`));
  // 팀 점수 (크게)
  const tot = Object.fromEntries((S.standings.rows || []).map((r) => [r.id, r]));
  const board = h('div', { class: 'tboard' }, ...S.teams.map((t) => h('div', { class: 'tsc', style: { '--tc': t.color } }, h('span', {}, `${t.icon} ${t.name}`), h('b', {}, tot[t.id]?.total ?? 0), S.standings.played ? h('small', {}, `${tot[t.id]?.rank ?? '-'}위`) : null)));
  const main = h('div', { class: 'bigbtns' });
  const more = h('div', { class: 'morebtns' });
  if (ph === 'lobby') {
    main.append(it ? B(S.idx === 0 && !S.standings.played ? '▶ 첫 게임 시작' : '▶ 다음 게임 시작', 'intro', 'green big') : B('🏆 시상식 시작', 'ceremony', 'big'));
    if (it) more.append(B('⏭ 이 게임 건너뛰기', 'skip', 'ghost', null, `${it.name} 게임을 건너뛸까요?`));
    if (S.standings.played) more.append(h('button', { class: 'btn ghost', onclick: () => replayModal() }, '🔁 방금 게임 재경기'));
  }
  if (ph === 'intro') { main.append(B(S.settings.preview !== false ? '🚀 게임 시작! (미리보기 생략)' : '🚀 게임 시작!', 'start', 'green big')); more.append(B('⏭ 이 게임 건너뛰기', 'skip', 'ghost', null, `${it?.name || '이'} 게임을 건너뛸까요?`)); }
  if (ph === 'intro' && !S.settings.auto) main.append(h('div', { class: 'muted small prepnote' }, '✅ 다음 게임이 준비됐어요. [게임 시작]을 눌러야 시작해요'));
  if (ph === 'intro' && S.qinfo) {
    // 문제 세트 미리보기(사회자만) + 시작 전에 새 세트로 바꾸기
    const qb = h('div', { class: 'qbox' }, h('div', { class: 'row' }, h('b', {}, `📝 이번 판 문제 ${S.qinfo.n}개 준비됨`), B('🔄 문제 바꾸기', 'reroll', 'ghost small')), S.qinfo.notice ? h('div', { class: 'notice' }, S.qinfo.notice) : null, h('details', {}, h('summary', {}, '문제 미리보기 (사회자 화면에만 보임)'), h('ol', { class: 'qprev' })));
    main.append(qb);
    A(`/api/events/${eid}`).then((r) => { const ol = qb.querySelector('.qprev'); if (ol && r.qinfo?.preview) for (const t of r.qinfo.preview) ol.append(h('li', {}, t)); }).catch(() => {});
  }
  if (ph === 'countdown' || ph === 'playing') {
    main.append(B('🏁 지금 종료 (점수 반영)', 'endNow', 'big', null, '지금 게임을 끝내고 점수를 반영할까요?'));
    more.append(B('🛑 게임 중단 (이번 점수 취소)', 'abort', 'red', null, '게임을 중단하고 이번 게임 점수를 반영하지 않을까요?'), B('🔁 다시 시작 (처음부터)', 'replay', 'ghost', null, '이번 게임을 처음부터 다시 할까요?'));
  }
  const isPe2 = !!games.find((g) => g.id === S.playlist[S.idx]?.game)?.pe2;
  if (ph === 'playing' && isPe2) { main.append(h('div', { class: 'hostpad pe2pad' }, h('div', { class: 'muted small' }, '🎯 사회자 판정 패드 준비 중…'))); draw.peKey = null; }
  if (ph === 'playing' && it?.host && !isPe2) {
    const hp = (team, d) => A(`/api/events/${eid}/command`, { op: 'hostPt', arg: { team, d } }).catch((e) => toast(e.message));
    main.append(h('div', { class: 'hostpad' }, h('div', { class: 'muted small' }, '🎯 진행자 판정: 잘한 팀에 점수를 눌러 주세요'), ...S.teams.map((t) => h('div', { class: 'hprow', style: { '--tc': t.color } }, h('b', {}, `${t.icon} ${t.name}`),
      ...[[1, '+1'], [2, '+2'], [3, '+3'], [-1, '−1']].map(([d, l]) => h('button', { class: `btn ${d < 0 ? 'ghost' : 'green'}`, onclick: (e) => { e.currentTarget.animate([{ transform: 'scale(.88)' }, { transform: 'scale(1)' }], 180); hp(t.id, d); } }, l))))));
  }
  if (ph === 'results') { main.append(B(S.idx < S.total ? `⏭ 다음 게임 준비${S.playlist[S.idx] ? ` (${games.find((g) => g.id === S.playlist[S.idx].game)?.name || ''})` : ''}` : '🏆 마무리', 'next', 'green big')); more.append(h('button', { class: 'btn ghost', onclick: () => replayModal() }, '🔁 재경기')); }
  if (ph === 'ceremony') main.append(B(S.ceremonyStep >= 5 ? '✅ 행사 마치기' : `▶ 다음 발표 (${S.ceremonyStep}/5)`, 'ceremonyNext', 'green big'));
  if (ph === 'ended') main.append(h('button', { class: 'btn green big', onclick: () => saveCard(S, { share: false }).then(() => toast('결과 카드를 저장했어요')) }, '🖼 결과 공유 카드 저장'), B('↩ 행사 다시 열기', 'reopen', 'ghost'));
  // 긴급 일시정지는 항상 크게 보이게
  if (['intro', 'countdown', 'playing', 'results'].includes(ph)) main.append(S.paused ? B('▶ 다시 진행', 'resume', 'blue big') : B('⏸ 일시정지', 'pause', 'yellow big'));
  if (!['ceremony', 'ended', 'playing', 'countdown'].includes(ph) && S.standings.played) more.append(B('🏆 시상식', 'ceremony', 'ghost', null, '지금 시상식을 시작할까요?'));
  if (!['ended'].includes(ph)) more.append(B('⏹ 행사 종료', 'end', 'ghost danger', null, '행사를 종료할까요? (다시 열 수 있어요)'));
  const tools = h('div', { class: 'tools' },
    h('button', { class: 'btn blue', onclick: () => window.open(`/screen.html?e=${S.event.code}`, 'ikiki-screen', 'width=1280,height=720') }, '🖥 대형 화면(빔) 열기'),
    h('button', { class: 'btn ghost', onclick: () => qrModal() }, '📱 참가 QR'));
  more.append(
    document.body.classList.contains('remote') ? null : h('button', { class: 'btn ghost', onclick: () => remoteModal() }, '🎮 폰 리모컨'),
    h('button', { class: `btn ${S.settings.duck ? 'yellow' : 'ghost'}`, onclick: () => save({ settings: { duck: !S.settings.duck } }) }, S.settings.duck ? '🎤 말씀 끝 · 음악 다시 크게' : '🎤 말할 때 음악 줄이기'),
    h('button', { class: 'btn ghost', onclick: () => cheerModal() }, '📣 응원 이벤트'),
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: S.settings.auto, onchange: (e) => save({ settings: { auto: e.target.checked } }) }), ' 자동 진행 (설명→게임→결과→다음 게임 자동)'),
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: S.settings.autoPrep !== false, disabled: S.settings.auto, onchange: (e) => save({ settings: { autoPrep: e.target.checked } }) }), ' 다음 게임 자동 준비 (결과 뒤 소개 화면까지만, 시작은 직접)'));
  const moreBox = h('details', { class: 'ctrlmore' }, h('summary', {}, '더보기 (건너뛰기·재경기·시상식·리모컨·자동 진행…)'), more, h('div', { class: 'muted small' }, '단축키: Space 다음 · P 일시정지 · E 지금 종료 (확인 후) — 대형 화면 창에서도 동작'));
  if (draw.moreOpen) moreBox.open = true; moreBox.ontoggle = () => { draw.moreOpen = moreBox.open; };
  c.append(now, prog, board, S.notice ? h('div', { class: 'notice' }, S.notice) : null, main, tools, moreBox, ph === 'ended' ? null : h('div', { class: 'qpad' }), h('div', { class: 'livemini' }));
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
  if (m.s?.g === 'pe2') pePad(m.s);
  const el = $('.livemini'); if (!el || !S) return;
  const s = m.s || {};
  const vals = s.avg || s.boards || s.prog || s.pts || (s.team && typeof Object.values(s.team)[0] === 'number' ? s.team : null);
  // 실시간 메시지(초당 여러 번)마다 같은 내용을 다시 그리지 않도록, 바뀔 때만 다시 그림
  const key = vals ? S.teams.map((t) => `${t.id}:${typeof vals[t.id] === 'number' ? Math.round(vals[t.id]) : '-'}`).join(',') : s.picked != null ? `p${s.picked}` : '';
  if (el.dataset.k === key) return; el.dataset.k = key;
  el.innerHTML = '';
  if (vals) for (const t of S.teams) el.append(h('span', { class: 'lm', style: { borderColor: t.color } }, `${t.icon}${typeof vals[t.id] === 'number' ? Math.round(vals[t.id]) : '-'}`));
  else if (s.picked != null) el.append(h('span', {}, `선택 ${s.picked}명`));
}
// 폰 없는 체육: 게임이 알려 주는 판정 버튼(성공·실패·먼저!·선택·공개·다음 라운드)을 그대로 그림. 상태가 바뀔 때만 다시 그림
function pePad(s) {
  const box = $('.pe2pad'); if (!box || !s.ui) return;
  const ui = s.ui; const key = JSON.stringify([ui, s.pts]); if (draw.peKey === key) return; draw.peKey = key; // 점수가 바뀔 때도 다시 그림
  const send = (a, team, v, btn) => { btn?.animate?.([{ transform: 'scale(.9)' }, { transform: 'scale(1)' }], 160); A(`/api/events/${eid}/command`, { op: 'hostPt', arg: { a, team, v } }).catch((e) => toast(e.message)); };
  const B = (lbl, a, team, v, cls, dis) => h('button', { class: `btn ${cls === 'green' ? 'green' : cls === 'red' ? 'red' : cls === 'yellow' ? 'yellow' : 'ghost'}`, disabled: !!dis, onclick: (e) => send(a, team, v, e.currentTarget) }, lbl);
  const once = ui.once || {}; const out = new Set(ui.out || []); const only = ui.only?.length ? new Set(ui.only) : null; const judged = ['ok', 'half', 'fail', 'first', 'rank'];
  box.innerHTML = '';
  box.append(h('div', { class: 'pnote' }, `🎯 ${ui.note || ''}${ui.info ? ` · ${ui.info}` : ''}`));
  for (const t of S.teams) {
    if (only && !only.has(t.id)) continue;
    const done = once[t.id]; const isOut = out.has(t.id); const turn = ui.turn === t.id;
    const row = h('div', { class: `hprow ${isOut ? 'out' : ''} ${turn ? 'turn' : ''} ${(ui.warn || []).includes(t.id) ? 'warn' : ''}`, style: { '--tc': t.color } }, h('b', {}, `${t.icon} ${t.name}`, h('small', {}, ` ${s.pts?.[t.id] ?? 0}점`)), done ? h('span', { class: 'chip ok' }, '✓ 입력됨') : null, isOut ? h('span', { class: 'chip' }, '탈락') : null);
    if (ui.pick) { const cur = ui.pick.cur?.[t.id]; const dis = ui.pick.dis?.[t.id] || []; ui.pick.opts.forEach((o, i) => row.append(B(o, 'pick', t.id, i, cur === i ? 'yellow' : '', dis.includes(i)))); if (ui.pick.extra) row.append(B(ui.pick.extra[0], 'pick', t.id, ui.pick.extra[1], cur === ui.pick.extra[1] ? 'red' : '')); }
    if (ui.team) for (const b of ui.team) row.append(B(b[0], b[1], t.id, b[2], b[3], isOut || (done && judged.includes(b[1]))));
    if (ui.pick || ui.team) box.append(row);
  }
  if (ui.glob?.length) box.append(h('div', { class: 'pglob' }, ...ui.glob.map((b) => B(b[0], b[1], 0, b[2], b[3]))));
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
  syncTabs();
  const body = $('.tabbody'); if (!body || !S) return;
  if (document.activeElement && body.contains(document.activeElement) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return; // 입력 중엔 다시 그리지 않음
  formDirty = false;
  body.innerHTML = '';
  ({ prep: tabPrep, run: tabRun, playlist: tabPlaylist, people: tabPeople, score: tabScore, quiz: tabQuiz, music: tabMusic, settings: tabSettings })[tab](body);
}
function tabRun(body) {
  const list = h('div', { class: 'plist' });
  S.playlist.forEach((p, i) => {
    const g = games.find((x) => x.id === p.game);
    const st = i < S.idx ? 'done' : i === S.idx ? 'cur' : '';
    list.append(h('div', { class: `pitem ${st}` }, h('b', {}, i + 1), h('span', {}, `${g.emoji} ${g.name}`), p.weight !== 1 ? h('span', { class: 'chip' }, `×${p.weight}`) : null,
      ['lobby', 'results', 'intro'].includes(S.phase) && !(S.phase === 'intro' && i === S.idx) ? h('button', { class: 'btn small ghost', onclick: () => cmd('intro', { idx: i }) }, i === S.idx ? '시작' : '이 게임으로') : null));
  });
  const rl = (S.replayLog || []).slice().reverse();
  const rlog = rl.length ? h('div', { class: 'rlog' }, h('h3', {}, '🔁 재경기 기록'), ...rl.map((x) => h('div', { class: 'muted small' }, `${new Date(x.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} · ${x.name} · ${x.keep ? '점수 유지하고 다시 (이전 점수 유지 · 새 점수 추가)' : '방금 게임 점수 지우고 다시'}`))) : null;
  body.append(h('div', { class: 'cols' }, h('div', {}, h('h3', {}, '게임 순서'), list), h('div', {}, h('h3', {}, '종합 순위'), standingsTable(), rlog)));
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
// 게임 기기 분류 (게임 목록·게임 순서·설정에서 공통)
const LVMAP = { baby: 0, kid: 1, elem: 2, mid: 3, high: 4, adult: 5 }; const PE_AGE = PE_AGE_NAME; const pickF = { age: 'now', space: 'all', type: 'all', time: 'all', q: '', fav: false };
const DEV = { phone: '📱 휴대폰 필요', none: '🙌 휴대폰 없이', both: '🔁 둘 다 가능' };
const devChip = (g) => h('span', { class: `chip dev ${g.dev}` }, DEV[g.dev] || '', g.hostIn ? ' · 🎯 진행자 입력' : '');
const devOk = (g) => S.settings.device !== 'nophone' || g.dev !== 'phone';
// ---------------- ① 행사 준비 ----------------
// 행사 종류(빠른 구성) · 팀 설정 · 게임 선택 · 예상 진행 시간 · 혼자 테스트하기 · 행사 시작. 나머지는 [더보기]
const defItem = (game) => ({ game, weight: game === 'throne' || game === 'shout' ? 2 : 1 }); // 새로 넣는 게임 기본값 (시간·음악은 게임 기본·추천)
let plSaveT = null;
function savePlaylist(pl, msg = '자동 저장됨') {
  // 바꿀 때마다 바로 서버에 저장 → 새로고침·다른 기기에서도 그대로
  S.playlist = pl.map((p) => ({ ...p })); paintTime(); timeModal.paint?.();
  clearTimeout(plSaveT);
  const ind = $('.saveind'); if (ind) { ind.textContent = '저장 중…'; ind.classList.remove('ok'); }
  plSaveT = setTimeout(async () => { try { await A(`/api/events/${eid}/update`, { settings: { playlist: pl } }); formDirty = false; const i2 = $('.saveind'); if (i2) { i2.textContent = `✅ ${msg}`; i2.classList.add('ok'); } } catch (e) { toast(e.message); const i2 = $('.saveind'); if (i2) i2.textContent = '⚠️ 저장 못 함'; } }, 350);
}
async function soloStart(gamesList, mode, lv) {
  // 팝업 차단을 피하려고 창을 먼저 열고 주소를 나중에 넣음
  const w = window.open('about:blank', '_blank');
  try {
    const r = await A('/api/solo', { games: gamesList, mode: S?.settings?.mode || 'elem', bgm: S?.settings?.bgm || {}, dur: Object.fromEntries((S?.playlist || []).filter((p) => p.dur).map((p) => [p.game, p.dur])), watch: mode === 'watch' });
    const url = `/solo.html?e=${r.id}&c=${r.code}&mode=${mode}&lv=${lv}&back=${encodeURIComponent(location.pathname + location.hash)}`;
    if (w && !w.closed) w.location.href = url; else location.href = url;
  } catch (e) { w?.close(); toast(e.message); }
}
const lvSelect = (v = 'normal') => select({ easy: '🟢 쉬움', normal: '🟡 보통', hard: '🔴 어려움', random: '🟣 랜덤' }, v);
function tabPrep(body) {
  const locked = busyPh(); const played = S.standings.played > 0;
  const pl = S.playlist.map((p) => ({ ...p }));
  // 1) 행사 종류
  const mode = select({ baby: '영아 (보호자와 함께)', kid: '유아 (만 3~7세)', elem: '초등', mid: '중등', high: '고등', adult: '성인', mixed: '전 연령 혼합' }, S.settings.mode);
  mode.onchange = () => save({ settings: { mode: mode.value } }).then(() => toast('연령 모드를 바꿨어요'));
  const spaceSel = select({ gym: '🏟️ 체육관 (넓은 공간)', class: '🏫 교실 (제자리 동작)' }, S.settings.space || 'gym'); spaceSel.onchange = () => save({ settings: { space: spaceSel.value } }).then(() => toast(spaceSel.value === 'class' ? '교실 모드: 뛰기·점프 동작을 제자리 동작으로 바꿔요' : '체육관 모드'));
  const elemSel = select({ low: '저학년 (1~3학년)', high: '고학년 (4~6학년)' }, S.settings.elemLevel || 'low'); elemSel.onchange = () => save({ settings: { elemLevel: elemSel.value } });
  const presets = h('div', { class: 'row wrap' }, ...[...PRESETS, ['전체 게임', games.map((g) => g.id)]].map(([n, ids]) => h('button', { class: 'btn small ghost', disabled: locked, onclick: () => {
    const ok = ids.filter((id) => games.some((g) => g.id === id)); if (!ok.length) return toast('이 구성은 아직 없어요');
    if (pl.length && !confirm(`'${n}' 구성으로 바꿀까요? 지금 게임 순서(${pl.length}개)는 덮어써요.`)) return;
    savePlaylist(ok.map(defItem), `${n} 구성 저장됨`); toast(`${n} 구성을 넣었어요`); formDirty = false; drawTab();
  } }, n)));
  // 2) 팀 설정
  const teamCount = select(Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 2, `${i + 2}팀`])), S.teams.length); teamCount.disabled = played;
  teamCount.onchange = () => save({ settings: { teamCount: +teamCount.value } }).then(() => toast(`${teamCount.value}팀으로 바꿨어요`));
  const assign = select({ choose: '참가자가 팀 고르기', auto: '자동 배정 (인원 균등)' }, S.settings.teamAssign); assign.onchange = () => save({ settings: { teamAssign: assign.value } });
  const teamChips = h('div', { class: 'row wrap' }, ...S.teams.map((t) => h('span', { class: 'chip', style: { borderColor: t.color, color: t.color } }, `${t.icon} ${t.name}`)), h('button', { class: 'btn small ghost', onclick: () => goTab('people') }, '팀 이름·참가자 관리 →'));
  // 3) 게임 선택: 카드 + 필터(연령·장소·유형·시간·검색·즐겨찾기) · 누르면 넣고 빼기(자동 저장)
  const inPl = new Set(pl.map((p) => p.game));
  const F = pickF; const lvNow = LVMAP[S.settings.mode] ?? 2;
  const fAge = select({ all: '모든 연령', now: `지금 연령(${PE_AGE[lvNow]})에 맞는 것`, 0: '영아', 1: '유아', 2: '초등', 3: '중등', 4: '고등', 5: '성인' }, F.age);
  const fSpace = select({ all: '교실·체육관', class: '🏫 교실 가능', gym: '🏟️ 체육관' }, F.space);
  const fType = select({ all: '모든 유형', phone: '📱 휴대폰 게임', pe: '🙌 폰 없는 체육 전체', ...Object.fromEntries(Object.entries(PE_TYPE).map(([k, v]) => [k, `🙌 ${v}`])) }, F.type);
  const fTime = select({ all: '모든 시간', s: '2분 이하', m: '2~3분', l: '3분 넘게' }, F.time);
  const fQ = h('input', { class: 'inp sm gsearch', placeholder: '🔍 게임 검색', value: F.q });
  const fFav = h('button', { class: `btn small ${F.fav ? 'yellow' : 'ghost'}`, onclick: () => { F.fav = !F.fav; formDirty = false; drawTab(); } }, F.fav ? '★ 즐겨찾기만' : '☆ 즐겨찾기');
  const favs = new Set(S.settings.favs || []);
  const grid = h('div', { class: 'ggrid cards' });
  const paintGrid = () => {
    grid.innerHTML = ''; const q = F.q.trim().toLowerCase(); let n = 0;
    for (const g of games) {
      const m = g.pe2; const secs = g.dur[ageOf()] ?? g.dur.elem ?? 60;
      if (F.age !== 'all') { const lv = F.age === 'now' ? lvNow : +F.age; if (m && (lv < m.ages[0] || lv > m.ages[1])) continue; }
      if (F.space === 'class' && m && m.space === 'gym') continue; if (F.space === 'gym' && m && m.space === 'class') continue;
      if (F.type === 'phone' && g.dev === 'none') continue; if (F.type === 'pe' && !m) continue; if (PE_TYPE[F.type] && m?.mech !== F.type) continue;
      if (F.time === 's' && secs > 120) continue; if (F.time === 'm' && (secs <= 120 || secs > 180)) continue; if (F.time === 'l' && secs <= 180) continue;
      if (q && !(`${g.name} ${m?.type || ''} ${m?.act || ''}`.toLowerCase().includes(q))) continue;
      if (F.fav && !favs.has(g.id)) continue;
      n++;
      const fav = h('span', { class: `gfav ${favs.has(g.id) ? 'on' : ''}`, title: '즐겨찾기', onclick: (e) => { e.stopPropagation(); const f = new Set(S.settings.favs || []); f.has(g.id) ? f.delete(g.id) : f.add(g.id); S.settings.favs = [...f]; save({ settings: { favs: [...f] } }); paintGrid(); } }, favs.has(g.id) ? '★' : '☆');
      grid.append(h('div', { class: `gpick ${inPl.has(g.id) ? 'on' : ''} ${devOk(g) ? '' : 'nodev'}`, title: m ? `${m.act}\n${g.rule}` : g.rule, onclick: () => {
        if (locked) return; const i = pl.findIndex((p) => p.game === g.id);
        if (i >= 0) { if (i < S.idx) return toast('이미 한 게임은 ② 게임 순서에서 빼 주세요'); pl.splice(i, 1); } else pl.push(defItem(g.id));
        savePlaylist(pl); formDirty = false; drawTab();
      } }, h('span', { class: 'ge' }, g.emoji), h('span', { class: 'gnm' }, g.name),
        h('small', {}, m ? `${m.type} · ${PE_AGE[m.ages[0]]}~${PE_AGE[m.ages[1]]} · ${m.space === 'class' ? '🏫' : m.space === 'gym' ? '🏟️' : '🏫🏟️'} · ${Math.round(secs / 60 * 10) / 10}분` : `${DEV[g.dev]?.split(' ')[0] || ''} · ${Math.round(secs / 60 * 10) / 10}분`),
        fav, h('span', { class: 'gpv', title: '미리보기', onclick: (e) => { e.stopPropagation(); previewModal(g.id); } }, '▶')));
    }
    if (!n) grid.append(h('p', { class: 'muted' }, '조건에 맞는 게임이 없어요'));
    cnt.textContent = `${n}개`;
  };
  const cnt = h('span', { class: 'muted small' });
  for (const [el, k] of [[fAge, 'age'], [fSpace, 'space'], [fType, 'type'], [fTime, 'time']]) el.onchange = () => { F[k] = el.value; paintGrid(); };
  fQ.oninput = () => { F.q = fQ.value; paintGrid(); };
  const filters = h('div', { class: 'row wrap gfilt' }, fAge, fSpace, fType, fTime, fQ, fFav, cnt, h('button', { class: 'btn small blue', onclick: () => recommendModal() }, '🪄 추천 구성'));
  paintGrid();
  // 4) 예상 시간
  const est = estSec(pl);
  // 5) 혼자 테스트하기
  const lv = lvSelect();
  const soloBtn = h('button', { class: 'btn blue', disabled: !pl.length, onclick: () => soloStart(pl.map((p) => p.game), 'vs', lv.value) }, '🎮 혼자 테스트하기');
  body.append(h('div', { class: 'prep' },
    h('div', { class: 'card stack' }, h('h3', {}, '1. 행사 종류'), h('div', { class: 'grid2' }, field('연령 모드', mode), field('장소', spaceSel, '교실은 뛰기·점프를 제자리 동작으로 바꿔요')), S.settings.mode === 'elem' ? field('초등 난이도', elemSel) : null, h('div', { class: 'muted small' }, '빠른 구성 (누르면 게임 순서가 바뀌어요)'), presets),
    h('div', { class: 'card stack' }, h('h3', {}, '2. 팀 설정'), h('div', { class: 'grid2' }, field('팀 수', teamCount, played ? '점수가 생긴 뒤에는 바꿀 수 없어요' : null), field('팀 정하기', assign)), teamChips),
    h('div', { class: 'card stack' }, h('div', { class: 'row' }, h('h3', {}, `3. 게임 선택 (${pl.length}개)`), h('span', { class: 'saveind muted small' }), h('button', { class: 'btn small ghost', onclick: () => goTab('playlist') }, '순서·시간·배점 → ② 게임 순서')),
      locked ? h('p', { class: 'err' }, '게임 중에는 바꿀 수 없어요') : null,
      S.settings.device === 'nophone' ? h('p', { class: 'notice' }, '📋 휴대폰 없이 진행 모드: 📱 게임은 흐리게 보이고 진행할 때 건너뛰어요') : null, filters, grid),
    h('div', { class: 'card prepfoot' },
      h('div', { class: 'est' }, h('span', { class: 'muted' }, '전체 행사 예상 시간'), h('b', {}, pl.length ? fmtMin(est) : '-'), h('small', { class: 'muted' }, pl.length ? `이 게임 ${pl.length}개를 전부 진행하면 ${fmtMin(est)} 걸려요 (인사·설명·준비·발표·시상 포함)` : '게임을 고르면 바로 계산돼요'), h('button', { class: 'btn small ghost', onclick: () => timeModal() }, '⏱ 시간 상세보기')),
      h('div', { class: 'row wrap' }, h('label', { class: 'lvl' }, '🤖 컴퓨터 난이도 ', lv), soloBtn, h('small', { class: 'muted' }, '나(홍팀) vs 컴퓨터(청팀) · 실제 행사 점수와 따로 · 새 창')),
      h('button', { class: 'btn green big', disabled: !pl.length, onclick: () => { goTab('run'); toast('참가자가 QR로 들어오면 [▶ 첫 게임 시작]을 눌러 주세요'); } }, '▶ 행사 시작 (③ 진행으로)'))));
}

// ---------------- ② 게임 순서 ----------------
// 한 줄 목록: 번호 · 게임 · 시간 [▶ 미리보기] [⚙ 설정] [▲▼ / 끌어서 이동]. ⚙는 한 번에 한 게임만 펼침. 바꾸면 자동 저장
let plOpen = null;
function previewModal(gid) {
  const g = games.find((x) => x.id === gid); if (!g) return;
  const lv = lvSelect();
  const demo = h('div', { class: 'pvdemo' });
  const m = modal(`${g.emoji} ${g.name} 미리보기`, h('div', { class: 'stack' }, h('p', { class: 'muted' }, g.rule), demo,
    h('div', { class: 'pvopts' },
      h('button', { class: 'btn big blue', onclick: () => { m.remove(); soloStart([gid], 'watch', lv.value); } }, '👀 화면 미리보기', h('small', {}, '컴퓨터끼리 실제 규칙으로 대결하는 걸 봐요')),
      h('button', { class: 'btn big green', onclick: () => { m.remove(); soloStart([gid], 'vs', lv.value); } }, '🎮 AI와 대결', h('small', {}, '내가 홍팀, 컴퓨터가 청팀'))),
    h('label', { class: 'lvl' }, '🤖 컴퓨터 난이도 ', lv), h('p', { class: 'muted small' }, '새 창(탭)에서 실제 게임 화면으로 열려요. 결과는 실제 행사 점수에 남지 않아요. 창을 닫으면 이 화면으로 돌아와요.')));
  import('./preview.js').then((P) => { if (demo.isConnected && P.mountDemo) P.mountDemo(demo, gid, { mode: S.settings.mode, h, space: S.settings.space || 'gym' }); }).catch(() => {});
}
// 🪄 조건에 맞는 게임 추천 + 행사 시간 맞춤 (확인해야 적용)
const recF = { lv: null, ppl: 30, space: null, min: 60, inten: 'mid', props: 'none', phones: 'no', seed: 1 };
function recommend(F) {
  const rnd = (() => { let x = F.seed * 9301 + 49297; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); })();
  const want = { low: 1, mid: 2, high: 3 }[F.inten];
  const pool = games.filter((g) => {
    const m = g.pe2;
    if (!m) return F.phones === 'yes' && g.dev !== 'none';
    if (F.lv < m.ages[0] || F.lv > m.ages[1]) return false;
    if (F.space === 'class' && m.space === 'gym') return false;
    if (F.props === 'none' && m.props !== '없음' && !/선택|없으면/.test(m.props)) return false;
    if (F.ppl < 8 && /팀 6|팀 8|팀 4~12|6~/.test(m.ppl) && m.mech === 'race') return false;
    return true;
  });
  // 점수: 경쟁 강도에 가까울수록, 유형이 겹치지 않을수록
  const scored = pool.map((g) => ({ g, sc: -Math.abs((g.pe2?.inten ?? 2) - want) + rnd() * 1.2 })).sort((a, b) => b.sc - a.sc);
  const target = F.min * 60; const c = { ...ctxT(), mode: S.settings.mode }; const pl = []; const usedType = {};
  const fin = scored.find((x) => ['p_final', 'p_tourney'].includes(x.g.id) && want >= 2);
  for (const { g } of scored) {
    if (fin && g.id === fin.g.id) continue; const ty = g.pe2?.mech || 'phone';
    if ((usedType[ty] || 0) >= (ty === 'phone' ? 4 : 2)) continue;
    const nx = [...pl, { game: g.id, weight: 1 }]; const tot = TP.plan(fin ? [...nx, { game: fin.g.id, weight: 2 }] : nx, c).total;
    if (tot > target + 60) continue; pl.push({ game: g.id, weight: 1 }); usedType[ty] = (usedType[ty] || 0) + 1;
    if (tot >= target - 90) break;
  }
  // 순서: 가벼운 것 → 강한 것 → 결승
  pl.sort((a, b) => (games.find((g) => g.id === a.game)?.pe2?.inten ?? 2) - (games.find((g) => g.id === b.game)?.pe2?.inten ?? 2));
  if (fin) pl.push({ game: fin.g.id, weight: 2 });
  return { pl, total: TP.plan(pl, c).total, pool: pool.length };
}
function recommendModal() {
  const F = recF; F.lv ??= LVMAP[S.settings.mode] ?? 2; F.space ??= S.settings.space || 'gym'; F.min = S.settings.timing?.target || F.min;
  const box = h('div', { class: 'stack' });
  const m = modal('🪄 조건에 맞는 게임 추천', box);
  const paint = () => {
    box.innerHTML = '';
    const lv = select(Object.fromEntries(PE_AGE.map((n, i) => [i, n])), F.lv); lv.onchange = () => { F.lv = +lv.value; paint(); };
    const ppl = h('input', { class: 'inp sm', type: 'number', min: 2, max: 300, value: F.ppl }); ppl.onchange = () => { F.ppl = Math.max(2, +ppl.value || 30); paint(); };
    const sp = select({ gym: '🏟️ 체육관', class: '🏫 교실' }, F.space); sp.onchange = () => { F.space = sp.value; paint(); };
    const mn = select({ 20: '20분', 30: '30분', 40: '40분', 60: '60분', 90: '90분', 120: '120분' }, F.min); mn.onchange = () => { F.min = +mn.value; paint(); };
    const it = select({ low: '😊 가볍게', mid: '🔥 보통', high: '⚔️ 치열하게' }, F.inten); it.onchange = () => { F.inten = it.value; paint(); };
    const pr = select({ none: '준비물 없이', any: '준비물 있어도 됨' }, F.props); pr.onchange = () => { F.props = pr.value; paint(); };
    const ph = select({ no: '휴대폰 없이만', yes: '휴대폰 게임도 섞기' }, F.phones); ph.onchange = () => { F.phones = ph.value; paint(); };
    box.append(h('div', { class: 'testg' }, field('연령', lv), field('인원', ppl), field('장소', sp), field('행사 시간', mn), field('경쟁 강도', it), field('준비물', pr), field('휴대폰', ph)));
    const R2 = recommend(F);
    box.append(h('p', { class: 'tsay' }, R2.pl.length ? `추천 ${R2.pl.length}개 · 예상 ${TP.fmt(R2.total)} (목표 ${F.min}분)` : '조건에 맞는 게임이 없어요'),
      h('ol', { class: 'reclist' }, ...R2.pl.map((p) => { const g = games.find((x) => x.id === p.game); return h('li', {}, `${g.emoji} ${g.name}`, h('small', { class: 'muted' }, ` · ${g.pe2 ? `${g.pe2.type} · ${g.pe2.space === 'class' ? '교실' : g.pe2.space === 'gym' ? '체육관' : '교실·체육관'}` : '📱 휴대폰'}${p.weight > 1 ? ' · 결승 ×2' : ''}`)); })),
      h('p', { class: 'muted small' }, `조건에 맞는 게임 ${R2.pool}개 중에서 골랐어요. 시간은 게임·설명·준비·전환·발표·인사·시상을 모두 더한 값이에요.`),
      h('div', { class: 'row wrap' }, h('button', { class: 'btn ghost', onclick: () => { F.seed++; paint(); } }, '🔄 다시 추천'),
        h('button', { class: 'btn green', disabled: !R2.pl.length || busyPh(), onclick: async () => {
          if (!confirm(`지금 게임 순서(${S.playlist.length}개)를 추천 ${R2.pl.length}개로 바꿀까요?${F.space !== (S.settings.space || 'gym') ? `\n장소도 ${F.space === 'class' ? '교실' : '체육관'}로 바꿔요.` : ''}`)) return;
          savePlaylist(R2.pl, '추천 구성 저장됨'); await save({ settings: { space: F.space, timing: { ...(S.settings.timing || {}), target: F.min } } }); m.remove(); toast('추천 구성을 넣었어요'); formDirty = false; drawTab();
        } }, '✅ 이 구성으로 바꾸기')));
  };
  paint();
}
function tabPlaylist(body) {
  const pl = S.playlist.map((p) => ({ ...p }));
  const locked = busyPh();
  const list = h('div', { class: 'plist edit compact' });
  const commit = (msg) => { savePlaylist(pl, msg); paint(); };
  let dragFrom = null;
  const paint = () => {
    list.innerHTML = '';
    pl.forEach((p, i) => {
      const g = games.find((x) => x.id === p.game); if (!g) return;
      const open = plOpen === p.game;
      const mv = (d) => { const j = i + d; if (j < 0 || j >= pl.length) return; [pl[i], pl[j]] = [pl[j], pl[i]]; commit('순서 저장됨'); };
      const row = h('div', { class: `pitem ${i < S.idx ? 'done' : ''} ${i === S.idx && S.phase !== 'lobby' ? 'cur' : ''} ${devOk(g) ? '' : 'nodev'} ${open ? 'open' : ''}`, draggable: locked ? 'false' : 'true', 'data-i': i },
        h('span', { class: 'drag', title: '끌어서 순서 바꾸기' }, '⠿'), h('b', { class: 'no' }, `${i + 1}.`), h('span', { class: 'gn' }, `${g.emoji} ${g.name}`),
        h('span', { class: 'gmeta muted small' }, `${g.untimed ? '라운드제' : `${p.dur ?? (g.dur[ageOf()] ?? g.dur.elem)}초`}${(p.rep || 1) > 1 ? ` · ${p.rep}판` : ''}${p.weight !== 1 ? ` · ×${p.weight}` : ''}${S.settings.bgm?.[p.game] ? ` · 🎵${S.settings.bgm[p.game] === 'none' ? '없음' : ''}` : ''}`),
        h('span', { class: 'pbtns' },
          h('button', { class: 'btn small ghost', onclick: () => previewModal(p.game) }, '▶ 미리보기'),
          h('button', { class: `btn small ${open ? 'yellow' : 'ghost'}`, onclick: () => { plOpen = open ? null : p.game; paint(); } }, '⚙ 설정'),
          h('button', { class: 'btn small ghost', disabled: locked || i === 0, title: '위로', onclick: () => mv(-1) }, '▲'),
          h('button', { class: 'btn small ghost', disabled: locked || i === pl.length - 1, title: '아래로', onclick: () => mv(1) }, '▼')));
      row.ondragstart = (e) => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch { /* */ } row.classList.add('dragging'); };
      row.ondragend = () => row.classList.remove('dragging');
      row.ondragover = (e) => { if (dragFrom == null) return; e.preventDefault(); row.classList.add('dropto'); };
      row.ondragleave = () => row.classList.remove('dropto');
      row.ondrop = (e) => { e.preventDefault(); row.classList.remove('dropto'); if (dragFrom == null || dragFrom === i) return; const [x] = pl.splice(dragFrom, 1); pl.splice(i, 0, x); dragFrom = null; commit('순서 저장됨'); };
      list.append(row);
      if (open) {
        const w = select({ 0.5: '×0.5', 1: '×1 (기본)', 1.5: '×1.5', 2: '×2', 3: '×3' }, p.weight); w.onchange = () => { p.weight = +w.value; commit(); };
        const d = h('input', { class: 'inp sm', type: 'number', min: 5, max: 300, placeholder: g.untimed ? '라운드제' : `기본 ${g.dur[ageOf()] ?? g.dur.elem}초`, value: p.dur ?? '', disabled: g.untimed });
        d.onchange = () => { const v = Math.round(+d.value); p.dur = d.value && v >= 5 && v <= 300 ? v : undefined; if (d.value && p.dur === undefined) toast('시간은 5~300초로 넣어 주세요'); d.value = p.dur ?? ''; commit(); };
        const rp = select({ 1: '1판 (기본)', 2: '2판', 3: '3판', 4: '4판', 5: '5판' }, p.rep || 1); rp.onchange = () => { const v = +rp.value; if (v > 1) p.rep = v; else delete p.rep; commit('반복 판 수 저장됨'); };
        const bs = bgmSelect(p.game); bs.addEventListener('change', () => { formDirty = false; });
        const pv = h('button', { class: 'btn small ghost pvbtn', onclick: (e) => { const tr = BGM.pick(S.settings, p.game, myMusic); preview(tr?.id || 'none', e.currentTarget); } }, '▶ 미리듣기');
        list.append(h('div', { class: 'pdetail' }, field('시간(초)', d), field('반복', rp), field('배점', w), field('🎵 배경음악', bs), pv,
          h('button', { class: 'btn small red', disabled: locked, onclick: () => { if (i < S.idx && !confirm('이미 한 게임이에요. 순서에서 뺄까요?')) return; pl.splice(i, 1); plOpen = null; stopPreview(); commit('삭제 저장됨'); } }, '✕ 삭제')));
      }
    });
    if (!pl.length) list.append(h('p', { class: 'muted' }, '게임이 없어요. 아래에서 넣거나 ① 행사 준비에서 빠른 구성을 골라 주세요'));
  };
  paint();
  // 게임 추가 (넣으면 기본 시간·배점·추천 음악이 자동으로 들어가요)
  const FILT = { all: '전체 게임', none: '🙌 휴대폰 없이 가능', phone: '📱 참가자 휴대폰 필요', both: '🔁 둘 다 가능', host: '🎯 진행자 입력' };
  const filt = select(FILT, S.settings.device === 'nophone' ? 'none' : 'all');
  const pass = (g) => ({ all: true, none: g.dev !== 'phone', phone: g.dev === 'phone', both: g.dev === 'both', host: g.hostIn })[filt.value];
  const add = h('select', { class: 'inp' });
  const fillAdd = () => { add.innerHTML = ''; for (const g of games.filter(pass)) add.append(h('option', { value: g.id }, `${String(g.no).padStart(2, '0')}. ${g.emoji} ${g.name} — ${DEV[g.dev]}${g.hostIn ? ' · 진행자 입력' : ''}${g.team ? ' (팀 협동)' : ''}`)); };
  filt.onchange = fillAdd; fillAdd();
  // 일괄 설정 (덮어쓰기 전에 확인)
  const bw = select({ 0.5: '×0.5', 1: '×1', 1.5: '×1.5', 2: '×2', 3: '×3' }, 1);
  const bt = h('input', { class: 'inp sm', type: 'number', min: 5, max: 300, placeholder: '예: 60' });
  const bb = select(Object.fromEntries(Object.entries(bgmOptions('dodge')).map(([k, v]) => [k, k === 'auto' ? '⭐ 게임별 추천곡' : v])), 'auto');
  const ask = (what) => confirm(`게임 ${pl.length}개 전부 ${what}(으)로 바꿀까요? 게임별로 정해 둔 값은 덮어써요.`);
  const bulk = h('details', { class: 'card bulk' }, h('summary', {}, '⚡ 일괄 설정 (모든 게임 한 번에)'),
    h('div', { class: 'row wrap' }, field('모든 배점', bw), h('button', { class: 'btn small', disabled: locked || !pl.length, onclick: () => { if (!ask(`배점 ×${bw.value}`)) return; pl.forEach((p) => { p.weight = +bw.value; }); commit('배점 일괄 저장됨'); } }, '적용')),
    h('div', { class: 'row wrap' }, field('모든 시간(초)', bt), h('button', { class: 'btn small', disabled: locked || !pl.length, onclick: () => { const v = Math.round(+bt.value); if (!(v >= 5 && v <= 300)) return toast('시간은 5~300초로 넣어 주세요'); if (!ask(`${v}초`)) return; pl.forEach((p) => { if (!games.find((g) => g.id === p.game)?.untimed) p.dur = v; }); commit('시간 일괄 저장됨'); } }, '적용'), h('small', { class: 'muted' }, '라운드제 게임은 그대로')),
    h('div', { class: 'row wrap' }, field('기본 배경음악', bb), h('button', { class: 'btn small', disabled: !pl.length, onclick: async () => { if (!ask(bb.value === 'auto' ? '추천곡' : bb.selectedOptions[0].textContent)) return; const m = { ...(S.settings.bgm || {}) }; for (const p of pl) { if (bb.value === 'auto') delete m[p.game]; else m[p.game] = bb.value; } await save({ settings: { bgm: m } }); toast('배경음악을 한 번에 바꿨어요'); } }, '적용')),
    h('div', { class: 'row wrap' }, h('button', { class: 'btn small ghost', disabled: locked || !pl.length, onclick: async () => { if (!confirm('모든 게임의 시간·배점·배경음악을 기본값으로 되돌릴까요?')) return; pl.forEach((p) => { delete p.dur; p.weight = defItem(p.game).weight; }); const m = { ...(S.settings.bgm || {}) }; for (const p of pl) delete m[p.game]; savePlaylist(pl, '기본값으로 저장됨'); await save({ settings: { bgm: m } }); paint(); toast('기본값으로 되돌렸어요'); } }, '↺ 기본값으로 되돌리기')));
  body.append(h('div', { class: 'row' }, h('h3', {}, `게임 순서 (${pl.length}개 · ${fmtMin(estSec(pl))})`), h('span', { class: 'saveind muted small ok' }, '✅ 바꾸면 자동 저장돼요')),
    locked ? h('p', { class: 'err' }, '게임 중에는 순서를 바꿀 수 없어요 (⚙ 설정·미리보기는 볼 수 있어요)') : null, list,
    S.settings.device === 'nophone' ? h('p', { class: 'notice' }, '📋 휴대폰 없이 진행 모드: 📱 표시 게임은 진행할 때 자동으로 건너뛰어요 (흐리게 보임)') : null,
    h('div', { class: 'row wrap addrow' }, filt, add, h('button', { class: 'btn ghost', disabled: locked, onclick: () => { if (!add.value) return; pl.push(defItem(add.value)); plOpen = null; commit('추가 저장됨'); } }, '＋ 추가')),
    bulk,
    h('p', { class: 'muted small' }, '배점은 순위 포인트에 곱해져요 (1위 = 팀 수 × 10점 × 배점). PC는 줄을 끌어서, 휴대폰은 ▲▼로 순서를 바꿔요.'));
}
// ---------------- 🎵 음악 ----------------
let myMusic = []; const loadMyMusic = () => BGM.listCustom().then((l) => { myMusic = l; });
loadMyMusic();
const prevAudio = new Audio(); let prevId = null;
async function preview(id, btn) {
  if (prevId === id && !prevAudio.paused) { prevAudio.pause(); prevId = null; btn.textContent = '▶ 미리듣기'; return; }
  document.querySelectorAll('.pvbtn').forEach((b) => { b.textContent = '▶ 미리듣기'; });
  if (!id || id === 'none') { prevAudio.pause(); prevId = null; return toast('음악 없음으로 정한 게임이에요'); }
  const t = BGM.TRACKS.find((x) => x.id === id); const src = id === 'fanfare' ? BGM.FANFARE.file : t ? t.file : await BGM.customURL(id);
  if (!src) return toast('이 컴퓨터에 없는 곡이에요');
  if (prevAudio.src.startsWith('blob:')) URL.revokeObjectURL(prevAudio.src);
  const tv = id.startsWith('u-') ? myMusic.find((x) => x.id === id)?.vol ?? 100 : BGM.metaAll()[id]?.vol ?? 100;
  prevAudio.src = src; prevAudio.volume = Math.min(1, ((S?.settings?.bgmVol ?? 70) / 100) * (tv / 100)); prevId = id; btn.textContent = '⏸ 멈춤';
  prevAudio.play().catch(() => { toast('재생하지 못했어요'); btn.textContent = '▶ 미리듣기'; prevId = null; });
  prevAudio.onended = () => { btn.textContent = '▶ 미리듣기'; prevId = null; };
}
const stopPreview = () => { prevAudio.pause(); prevId = null; document.querySelectorAll('.pvbtn').forEach((b) => { b.textContent = '▶ 미리듣기'; }); };
function bgmOptions(gid) {
  const rec = BGM.REC[gid] || 'g7'; const rn = rec === 'none' ? '음악 없음' : BGM.TRACKS.find((t) => t.id === rec).name;
  return { auto: `⭐ 추천 (${rn})`, ...Object.fromEntries(BGM.TRACKS.map((t) => [t.id, `🎵 ${t.name}`])), ...Object.fromEntries(myMusic.map((t) => [t.id, `💾 ${t.name}`])), none: '🔇 음악 없음' };
}
function bgmSelect(gid) { const sel = select(bgmOptions(gid), S.settings.bgm?.[gid] || 'auto'); sel.classList.add('bgmsel'); sel.onchange = () => setBgm(gid, sel.value); return sel; }
async function setBgm(gid, v) { const m = { ...(S.settings.bgm || {}) }; if (v === 'auto') delete m[gid]; else m[gid] = v; S.settings.bgm = m; await save({ settings: { bgm: m } }); toast('음악을 바꿨어요 · 다음 행사에도 이 설정을 기억해요'); }
const mb = (n) => (n / 1048576).toFixed(1) + 'MB';
const fmtDur = (d) => { if (!d) return '–:––'; const t = Math.round(d); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const builtinDur = {};
function durOf(t, el) { // 내장 곡 길이 (파일 정보만 읽음)
  if (builtinDur[t.id]) { el.textContent = fmtDur(builtinDur[t.id]); return; }
  const a = new Audio(); a.preload = 'metadata'; a.src = t.file; a.onloadedmetadata = () => { builtinDur[t.id] = a.duration; el.textContent = fmtDur(a.duration); };
}
const musicBus = (() => { try { return new BroadcastChannel('ikiki-music'); } catch { return null; } })();
const musicChanged = () => { try { musicBus?.postMessage('changed'); } catch { /* */ } };
let mQuery = '', mCat = 'all';
async function tabMusic(body) {
  const st = S.settings;
  const vol = (k, label) => { const v = h('b', {}, `${st[k] ?? (k === 'bgmVol' ? 70 : 80)}`); const r = h('input', { type: 'range', min: 0, max: 100, step: 5, value: st[k] ?? (k === 'bgmVol' ? 70 : 80), class: 'rng' }); r.oninput = () => (v.textContent = r.value); r.onchange = () => save({ settings: { [k]: +r.value } }); return h('div', { class: 'volrow' }, h('span', {}, label), r, v); };
  const fan = h('input', { class: 'inp sm', type: 'number', min: 3, max: 60, value: st.fanfareSec ?? 12 }); fan.onchange = () => { const v = Math.max(3, Math.min(60, Math.round(+fan.value || 12))); fan.value = v; save({ settings: { fanfareSec: v } }); };
  await loadMyMusic();
  // 🏆 승리 음악 (결과 발표·시상식)
  const winOpts = { fanfare: '🎺 빵빠레 (기본)', ...Object.fromEntries(BGM.TRACKS.map((t) => [t.id, `🎵 ${t.name}`])), ...Object.fromEntries(myMusic.map((t) => [t.id, `💾 ${t.name}`])) };
  const wt = BGM.winTrack(st, myMusic);
  const winSel = select(winOpts, wt.id); winSel.onchange = async () => { await save({ settings: { winTrack: winSel.value } }); toast('승리 음악을 바꿨어요'); };
  const winPv = h('button', { class: 'btn small ghost pvbtn', onclick: (e) => preview(winSel.value, e.currentTarget) }, '▶ 미리듣기');
  body.append(h('h3', {}, '🔊 음량 · 🏆 승리 음악'), h('div', { class: 'card stack' }, vol('bgmVol', '🎵 배경음악 (전체)'), vol('sfxVol', '🔔 효과음'),
    h('div', { class: 'row wrap' }, field('🏆 승리 음악', winSel, '게임 결과 발표·시상식 1위 때 나와요'), winPv, field('승리 음악 길이(초)', fan, '끝날 때 자연스럽게 작아져요'),
      h('button', { class: `btn ${st.duck ? 'yellow' : 'ghost'}`, onclick: () => save({ settings: { duck: !st.duck } }).then(() => setTimeout(drawTab, 250)) }, st.duck ? '🎤 말씀 끝 · 음악 다시 크게' : '🎤 말할 때 음악 줄이기')),
    wt.missing ? h('p', { class: 'err small' }, '고른 승리 음악이 이 컴퓨터에 없어서 기본 빵빠레가 나와요') : null,
    h('p', { class: 'muted small' }, '대형 화면 창에서 M 키를 눌러도 음악을 바로 줄였다 키울 수 있어요.')));

  // 🎶 곡 목록: 검색 · 분류 · 미리듣기/멈춤 · 길이 · 곡별 음량 · 이름 바꾸기 · 순서 · 삭제
  const cats = Object.fromEntries(Object.entries(BGM.MOODS).filter(([k]) => k !== 'none').map(([k, v]) => [k, v.label]));
  const q = h('input', { class: 'inp msearch', placeholder: '🔍 곡 이름 검색', value: mQuery });
  const cf = select({ all: '전체 분류', ...cats }, mCat);
  const list = h('div', { class: 'mlist' });
  const used = (id) => Object.entries(S.settings.bgm || {}).filter(([, v]) => v === id).map(([g]) => games.find((x) => x.id === g.split('@')[0])?.name).filter(Boolean);
  const meta = BGM.metaAll();
  const volCtl = (id, cur, onSet) => { const v = h('small', { class: 'muted' }, `${cur}%`); const r = h('input', { type: 'range', min: 0, max: 100, step: 5, value: cur, class: 'rng sm', title: '이 곡 음량' }); r.oninput = () => { v.textContent = `${r.value}%`; if (prevId === id) prevAudio.volume = ((S?.settings?.bgmVol ?? 70) / 100) * (r.value / 100); }; r.onchange = () => onSet(+r.value); return h('span', { class: 'tvol' }, '🔉', r, v); };
  const rows = [];
  for (const t of BGM.TRACKS) {
    const m = BGM.MOODS[t.mood]; const d = h('small', { class: 'muted dur' }, '–:––'); durOf(t, d);
    rows.push({ name: t.name, mood: t.mood, el: h('div', { class: 'mrow', style: { '--mc': m.color } }, h('span', { class: 'chip' }, '기본'), h('b', { class: 'mname' }, `🎵 ${t.name}`), h('span', { class: 'mood' }, m.label), d,
      volCtl(t.id, meta[t.id]?.vol ?? 100, (v) => { BGM.setMeta(t.id, { vol: v }); musicChanged(); }),
      h('button', { class: 'btn small ghost pvbtn', onclick: (e) => preview(t.id, e.currentTarget) }, '▶ 미리듣기'), h('small', { class: 'muted mdesc' }, t.desc)) });
  }
  rows.push({ name: '빵빠레', mood: 'win', el: h('div', { class: 'mrow', style: { '--mc': '#ffd43b' } }, h('span', { class: 'chip' }, '기본'), h('b', { class: 'mname' }, '🎺 빵빠레'), h('span', { class: 'mood' }, '🏆 승리'), h('small', { class: 'muted dur' }, ''),
    volCtl('fanfare', meta.fanfare?.vol ?? 100, (v) => { BGM.setMeta('fanfare', { vol: v }); musicChanged(); }),
    h('button', { class: 'btn small ghost pvbtn', onclick: (e) => preview('fanfare', e.currentTarget) }, '▶ 미리듣기'), h('small', { class: 'muted mdesc' }, '승리 발표 전용 · 첫 타격에 맞춰 트로피가 떨어져요')) });
  myMusic.forEach((t, i) => {
    const m = BGM.MOODS[t.mood] || BGM.MOODS.etc;
    const nm = h('input', { class: 'inp sm mname', value: t.name, maxlength: 30, title: '곡 이름 (바꾸면 바로 저장)' });
    nm.onchange = async () => { await BGM.updateCustom(t.id, { name: nm.value }); musicChanged(); toast('곡 이름을 바꿨어요'); formDirty = false; };
    const mo = select(cats, t.mood); mo.onchange = async () => { await BGM.updateCustom(t.id, { mood: mo.value }); musicChanged(); formDirty = false; drawTab(); };
    const mv = async (dir) => { const j = i + dir; if (j < 0 || j >= myMusic.length) return; const a = myMusic[i], b = myMusic[j]; const oa = a.order ?? a.added, ob = b.order ?? b.added; await BGM.updateCustom(a.id, { order: ob === oa ? ob + dir : ob }); await BGM.updateCustom(b.id, { order: oa }); musicChanged(); drawTab(); };
    const u = used(t.id);
    rows.push({ name: t.name, mood: t.mood, el: h('div', { class: 'mrow mine', style: { '--mc': m.color } },
      h('span', { class: 'ord' }, h('button', { class: 'btn small ghost', title: '위로', onclick: () => mv(-1) }, '▲'), h('button', { class: 'btn small ghost', title: '아래로', onclick: () => mv(1) }, '▼')),
      nm, mo, h('small', { class: 'muted dur' }, fmtDur(t.dur)),
      volCtl(t.id, t.vol ?? 100, async (v) => { await BGM.updateCustom(t.id, { vol: v }); musicChanged(); }),
      h('button', { class: 'btn small ghost pvbtn', onclick: (e) => preview(t.id, e.currentTarget) }, '▶ 미리듣기'),
      h('button', { class: 'btn small red', onclick: async () => {
        if (!confirm(`'${t.name}' 곡을 이 컴퓨터에서 지울까요?${u.length ? `\n이 곡을 쓰던 게임(${u.join(', ')})은 추천 음악으로 바뀌어요.` : ''}`)) return;
        if (prevId === t.id) { prevAudio.pause(); prevId = null; }
        await BGM.removeCustom(t.id); const m2 = { ...(S.settings.bgm || {}) }; for (const [g, v] of Object.entries(m2)) if (v === t.id) delete m2[g];
        await save({ settings: { bgm: m2, ...(S.settings.winTrack === t.id ? { winTrack: 'fanfare' } : {}) } }); musicChanged(); toast('지웠어요'); drawTab(); } }, '삭제'),
      h('small', { class: 'muted mdesc' }, `${mb(t.size)} · 이 컴퓨터에만 저장${u.length ? ` · 사용 중: ${u.slice(0, 3).join(', ')}${u.length > 3 ? ` 외 ${u.length - 3}` : ''}` : ''}`)) });
  });
  const paintList = () => { list.innerHTML = ''; const qq = q.value.trim().toLowerCase(); const shown = rows.filter((r) => (mCat === 'all' || r.mood === mCat) && (!qq || r.name.toLowerCase().includes(qq))); list.append(...shown.map((r) => r.el)); if (!shown.length) list.append(h('p', { class: 'muted' }, '찾는 곡이 없어요')); };
  q.oninput = () => { mQuery = q.value; paintList(); }; cf.onchange = () => { mCat = cf.value; paintList(); };
  paintList();
  // ＋ 곡 넣기 (여러 곡 한 번에)
  const file = h('input', { type: 'file', accept: 'audio/*,.mp3,.wav,.m4a', multiple: true, class: 'inp' });
  const mood = select(cats, 'battle');
  const info = await BGM.storageInfo();
  const prog = h('div', { class: 'muted small' });
  const addBtn = h('button', { class: 'btn', onclick: async () => {
    const fs = [...(file.files || [])]; if (!fs.length) return toast('넣을 음악 파일을 골라 주세요 (여러 개 가능)');
    addBtn.disabled = true; const ok = [], bad = [];
    for (const [k, f] of fs.entries()) { prog.textContent = `${fs.length}곡 중 ${k + 1}번째 넣는 중… (${f.name})`; try { ok.push((await BGM.addCustom(f, '', mood.value)).name); } catch (e) { bad.push(e.message); } }
    musicChanged(); toast(`${ok.length}곡 넣었어요${bad.length ? ` · ${bad.length}곡 실패` : ''}`, 4000); formDirty = false; await drawTab();
    if (bad.length) $('.tabbody')?.append(h('div', { class: 'err small' }, '넣지 못한 곡: ', ...bad.map((b) => h('div', {}, b))));
  } }, '＋ 곡 넣기');
  body.append(h('h3', {}, '🎶 곡 목록'), h('div', { class: 'row wrap' }, q, cf, h('span', { class: 'muted small' }, `기본 ${BGM.TRACKS.length + 1}곡 · 내가 넣은 곡 ${myMusic.length}곡`)), list,
    h('h3', {}, '＋ 내 음악 넣기 (MP3·WAV·M4A, 여러 곡 한 번에)'), h('div', { class: 'card stack' }, h('div', { class: 'row wrap' }, file, field('분류', mood), addBtn), prog,
      h('div', { class: 'notice2' }, h('b', {}, '꼭 읽어 주세요'), h('ul', {},
        h('li', {}, `넣은 곡은 서버가 아니라 '지금 이 컴퓨터의 이 브라우저'에 저장돼요 (곡당 ${BGM.MAX_MB}MB까지). 새로고침해도 남아 있고, 인터넷이 끊겨도 이 컴퓨터에서는 나와요.`),
        h('li', {}, '다른 컴퓨터·다른 브라우저·휴대폰에는 자동으로 옮겨지지 않아요. 대형 화면도 같은 컴퓨터·같은 브라우저(예: 크롬)로 열어야 이 곡이 나와요. 없으면 추천곡이 대신 나와요.'),
        h('li', {}, "브라우저의 '인터넷 사용 기록·쿠키 및 사이트 데이터 삭제', 시크릿 창, 저장 공간 부족이면 넣은 곡이 사라질 수 있어요. 원본 파일은 꼭 따로 보관하세요."),
        h('li', {}, `지금 이 브라우저 사용량 ${mb(info.usage)}${info.quota ? ` / 사용 가능 약 ${mb(info.quota)}` : ''} · 자동 삭제 방지 ${info.persisted ? '✅ 켜짐' : '⚠️ 브라우저가 허용 안 함 (공간이 부족하면 지워질 수 있어요)'}`)))));
  // 게임별 음악
  const tbl = h('div', { class: 'gmlist' });
  for (const g of games) {
    const sel = bgmSelect(g.id); const tr = BGM.pick(S.settings, g.id, myMusic); const m = BGM.MOODS[tr?.mood || 'none'] || BGM.MOODS.etc;
    const ages = Object.keys(BGM.AGE_LABEL); const has = ages.some((a) => S.settings.bgm?.[`${g.id}@${a}`]);
    const box = h('div', { class: 'agebox', style: { display: has ? '' : 'none' } }, ...ages.map((a) => { const k = `${g.id}@${a}`; const o = bgmOptions(g.id); delete o.auto; const sa = select({ same: '기본과 같게', ...o }, S.settings.bgm?.[k] || 'same'); sa.classList.add('bgmsel'); sa.onchange = () => setBgm(k, sa.value === 'same' ? 'auto' : sa.value); return h('label', { class: `agesel ${S.settings.bgm?.[k] ? 'on' : ''}` }, h('span', {}, BGM.AGE_LABEL[a]), sa); }));
    const tg = h('button', { class: 'btn small ghost', onclick: () => { box.style.display = box.style.display ? '' : 'none'; } }, has ? '👶🧑 연령별 ✓' : '👶🧑 연령별');
    tbl.append(h('div', { class: 'gmrow', style: { '--mc': m.color } }, h('span', { class: 'gn' }, `${String(g.no).padStart(2, '0')} ${g.emoji} ${g.name}`), sel, h('span', { class: 'mood' }, m.label), tg, tr?.missing ? h('small', { class: 'err' }, '고른 곡이 없어 추천곡으로 나와요') : null, BGM.NO_MUSIC_WHY[g.id] && !tr ? h('small', { class: 'muted' }, `추천이 '없음'인 이유: ${BGM.NO_MUSIC_WHY[g.id]}`) : null, box));
  }
  body.append(h('h3', {}, '🎮 게임별 배경음악'), h('p', { class: 'muted small' }, '게임마다 곡을 고르면 바로 저장돼요. 화면 분위기(색·조명 연출)도 곡 분류에 맞춰 바뀌어요.'),
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
  // 진행자가 참가자 직접 등록: 휴대폰 없는 아이·명단 미리 넣기 (이름 비우면 참가 번호). 같은 이름으로 폰에서 들어오면 그 자리를 이어받아요
  const addName = h('input', { class: 'inp sm', placeholder: '이름 (비우면 번호)', maxlength: 12 });
  const addTeam = select(Object.fromEntries(S.teams.map((t) => [t.id, `${t.icon} ${t.name}`])), S.teams[0]?.id);
  const addBtn = h('button', { class: 'btn small', onclick: async () => { try { const r = await A(`/api/events/${eid}/player/add`, { name: addName.value, team: +addTeam.value }); toast(`${r.name} 등록`); addName.value = ''; formDirty = false; refreshFull(); } catch (e) { toast(e.message); } } }, '➕ 참가자 등록');
  addName.addEventListener('keydown', (e) => e.key === 'Enter' && addBtn.click());
  body.append(h('div', { class: 'row addp' }, h('b', {}, '✍️ 직접 등록'), addName, addTeam, addBtn, h('span', { class: 'muted small' }, '휴대폰 없는 참가자·명단 미리 넣기. 같은 이름으로 폰에서 들어오면 이어받아요')));
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
    const K = { manual: '수동', luck: '운 보너스', cheer: '응원', quick: '퀵 점수' };
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
    h('h3', {}, '🔔 골든벨 우리 행사 문제'), h('p', { class: 'muted small' }, '넣은 문제가 먼저 나오고, 모자란 만큼 연령에 맞는 기본 문제로 채워요. 문제 앞에 [유아]·[초등]·[성인]을 붙이면 그 연령에서만 나와요. 띄어쓰기·기호만 다른 같은 문제는 하나로 합쳐요. 한 행사 안에서는 낸 문제를 다 쓸 때까지 다시 내지 않아요. 보기 순서는 참가자마다 달라요.'), bell,
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
  const device = select({ phone: '📱 참가자 휴대폰으로 참가 (QR·코드)', nophone: '📋 휴대폰 없이 진행 (노트북 한 대 + 빔 화면)' }, s.device || 'phone');
  const pv = select({ on: '켜기 (설명 화면에서 자동 재생)', off: '끄기 (글 설명만)' }, s.preview === false ? 'off' : 'on');
  const pvSec = select({ 5: '5초', 6: '6초', 7: '7초', 8: '8초' }, s.previewSec || 6);
  const intro = h('input', { class: 'inp sm', type: 'number', min: 3, max: 60, value: s.introSec });
  const res = h('input', { class: 'inp sm', type: 'number', min: 3, max: 60, value: s.resultSec });
  const voice = h('input', { type: 'checkbox', checked: s.voice }); const sfxc = h('input', { type: 'checkbox', checked: s.sfx });
  const cap = h('input', { class: 'inp sm', type: 'number', min: 0, max: 30, value: s.rouletteCapPct });
  const url = h('input', { class: 'inp', value: s.joinUrl || '', placeholder: location.origin });
  const league = h('input', { class: 'inp', value: s.league || '', maxlength: 30, placeholder: '예: 3학년 리그, 11월 늘봄' });
  body.append(h('div', { class: 'stack' },
    field('행사 이름', name),
    h('div', { class: 'grid2' }, field('연령 모드', mode, '혼합 모드: 참가할 때 영아~성인 중 고르고, 같은 게임도 연령별 난이도로 진행 + 점수는 0~100으로 환산해 공정하게 비교'), field('초등 난이도', lvl), field('점수 방식', scoring), field('상위 N명 (상위 N명 평균일 때)', topN),
      field('시범 미리보기 (손가락 애니메이션)', pv, '게임 설명 때 대형 화면과 폰에 조작 방법을 보여 줘요. 참가자는 게임 중 ❓로 다시 볼 수 있어요. [🚀 게임 시작]을 누르면 바로 시작해요'), field('미리보기 시간', pvSec), field('진행 방식', device, '휴대폰 없이: 대형 화면에 게임·규칙·타이머, 점수는 진행자가 ⚡퀵 점수·🎯판정 버튼으로 넣어요. 📱 게임은 건너뛰어요'), field('팀 수', teamCount, '점수가 생긴 뒤에는 바꿀 수 없어요'), field('팀 정하기', assign), field('몸 동작 모드 (폰 휘두르기·기울이기)', motion, '던지기·기울이기 게임을 폰 동작으로 해요. 폰을 꽉 쥐게 안내해 주세요. 터치로도 언제나 할 수 있어요'), field('참가자 팀 이름 바꾸기', rename, '대기 화면에서 폰으로 우리 팀 이름·아이콘을 바꿔요. 이상한 이름은 👥 탭에서 진행자가 고칠 수 있어요'), field('게임 설명 시간(초)', intro), field('결과 발표 시간(초)', res), field('역전 룰렛 보너스 상한 (1위 총점의 %)', cap)),
    h('label', { class: 'chk' }, voice, ' 🗣 음성 안내 (대형 화면)'), h('label', { class: 'chk' }, sfxc, ' 🔊 효과음'),
    field('반별 리그 이름 (선택)', league, '여러 번 하는 수업을 같은 리그 이름으로 묶으면 팀 이름별 누적 순위를 볼 수 있어요 (📊 점수 탭 → 리그 순위)'),
    field('참가 주소 (QR에 들어갈 주소)', url, '배포 주소(예: https://ikiki-arcade.onrender.com) 또는 노트북 와이파이 주소(예: http://192.168.0.15:8080). 비우면 지금 접속한 주소'),
    h('button', { class: 'btn', onclick: async () => {
      await save({ name: name.value, settings: { mode: mode.value, elemLevel: lvl.value, scoring: scoring.value, topN: +topN.value, teamCount: +teamCount.value, teamAssign: assign.value, teamRename: rename.value, motion: motion.value, device: device.value, preview: pv.value === 'on', previewSec: +pvSec.value, introSec: +intro.value, resultSec: +res.value, voice: voice.checked, sfx: sfxc.checked, rouletteCapPct: +cap.value, joinUrl: url.value.trim(), league: league.value.trim() } });
      toast('설정을 저장했어요');
    } }, '💾 설정 저장'),
    h('h3', {}, '개인정보'), h('p', { class: 'muted small' }, '행사가 끝나면 참가자 이름을 "참가자1, 2…"로 바꿔 개인정보를 지울 수 있어요. 점수 기록은 남아요.'),
    h('button', { class: 'btn ghost', onclick: async () => { if (confirm('참가자 이름을 모두 지울까요? 되돌릴 수 없어요.')) { await A(`/api/events/${eid}/purge`, {}); toast('지웠어요'); refreshFull(); } } }, '🧹 참가자 이름 지우기')));
}

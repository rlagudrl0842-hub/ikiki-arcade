// 참가자 폰 화면: 게임별 조작 UI
import { h, sfx, vibrate } from './client.js';
import { numHuntLayout, colorRound, COLORS6, towerX } from './gen.js';

const RPS = [{ e: '✌️', n: '가위' }, { e: '✊', n: '바위' }, { e: '✋', n: '보' }];
const MEM_KID = ['🐶', '🐱', '🐰', '🐻'];
const MEM_COL = ['#ff4d6d', '#3d8bff', '#ffd43b', '#2fd27a', '#b06bff', '#ff922b'];
const VAULT_PICS = ['🍎', '🐶', '⭐', '🚗', '🎈', '🌈'];

// 손가락을 대는 즉시 반응 (클릭보다 빠름). 여러 손가락 동시 지원
function onPress(el, fn) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(e); }, { passive: false });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  return el;
}
const secLeft = (api, until) => Math.max(0, Math.ceil((until - api.now()) / 1000));
const bigTitle = (t, sub) => h('div', { class: 'gtitle' }, h('div', { class: 'gt' }, t), sub ? h('div', { class: 'gs' }, sub) : null);

// 화면 하나를 그리는 공통 틀: mount 후 update/reply 호출
export const G = {};

// ------------------------------------------------ 연타형 (연타왕/줄다리기)
function tapGame(kind) {
  return {
    mount(root, v, api) {
      this.api = api; this.n = 0; this.mine = 0;
      const btn = onPress(h('button', { class: 'tapbig', style: { '--tc': api.team.color } }, h('span', { class: 'ti' }, kind === 'tug' ? '💪' : api.team.icon), h('span', {}, kind === 'tug' ? '당겨!' : '연타!')), () => {
        this.n++; this.mine++; this.cnt.textContent = this.mine; vibrate(8); btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit');
      });
      this.cnt = h('div', { class: 'bignum' }, '0');
      this.info = h('div', { class: 'ginfo' });
      this.bar = h('div', { class: 'rope' }, h('div', { class: 'knot' }));
      root.append(h('div', { class: 'gwrap tapwrap' }, this.info, kind === 'tug' ? this.bar : null, this.cnt, btn));
      this.t = setInterval(() => { if (this.n) { api.send({ a: 'tap', n: Math.min(this.n, 30) }); this.n = 0; } }, 150);
      this.update(v);
    },
    update(v) {
      this.mine = Math.max(this.mine, v.taps || 0); this.cnt.textContent = this.mine;
      if (kind === 'mash') {
        const prev = this.rank; this.rank = v.rank;
        this.info.innerHTML = `<b>우리 팀 ${v.rank}위</b> <span class="muted">/ ${v.n}팀 · 팀 평균 ${Math.round(v.teamAvg)}회</span>`;
        if (prev && v.rank < prev) { sfx('overtake', this.api.sfxOn); this.info.classList.add('flash'); setTimeout(() => this.info.classList.remove('flash'), 600); }
      } else {
        const pos = v.pos; // -100 ~ 100 (우리 쪽 +)
        this.bar.firstChild.style.left = `${50 + pos / 2}%`;
        this.bar.style.setProperty('--tc', this.api.team.color);
        const vs = v.teams.filter((t) => t !== v.me).map((t) => this.api.teamName(t)).join(', ');
        this.info.innerHTML = v.winner ? (v.winner === v.me ? '<b class="win">🎉 승리!</b>' : '<b>😢 아쉽게 패배</b>') : `<b>vs ${vs}</b> <span class="muted">${pos > 5 ? '우리가 이기는 중!' : pos < -5 ? '힘내요! 더 빨리!' : '팽팽해요!'}</span>`;
      }
    },
    unmount() { clearInterval(this.t); if (this.n) this.api.send({ a: 'tap', n: this.n }); },
  };
}
G.mash = tapGame('mash');
G.tug = tapGame('tug');

// ------------------------------------------------ 100m 달리기
G.race = {
  mount(root, v, api) {
    this.api = api; this.kid = v.kid;
    this.runner = h('div', { class: 'runner' }, '🏃');
    this.track = h('div', { class: 'track' }, h('div', { class: 'finish' }, '🏁'), this.runner);
    this.dist = h('div', { class: 'bignum' }, '0m');
    const step = (f) => { if (this.v?.fin) return; api.send({ a: 'step', f }); vibrate(10); this.local(f); };
    const foot = (f, label) => onPress(h('button', { class: `foot ${f}` }, h('span', { class: 'fi' }, '👣'), label), () => step(f));
    this.btns = this.kid ? h('div', { class: 'feet' }, onPress(h('button', { class: 'foot one' }, h('span', { class: 'fi' }, '🏃'), '달려!'), () => step(this.lastF === 'L' ? 'R' : 'L')))
      : h('div', { class: 'feet' }, foot('L', '왼발'), foot('R', '오른발'));
    root.append(h('div', { class: 'gwrap' }, this.track, this.dist, this.btns));
    this.update(v);
  },
  local(f) { if (!this.kid && this.lastF === f) { this.btns.classList.add('shake'); setTimeout(() => this.btns.classList.remove('shake'), 300); } this.lastF = f; },
  update(v) {
    this.v = v; this.lastF = v.last ?? this.lastF;
    this.runner.style.left = `calc(${v.dist}% - ${v.dist * 0.4}px)`;
    this.dist.textContent = v.fin ? `🏅 ${v.place}등 도착! ${(v.fin / 1000).toFixed(1)}초` : `${Math.floor(v.dist)}m`;
    if (v.fin && !this.done) { this.done = true; sfx('win', this.api.sfxOn); }
  },
  reply(r) { if (r.bad) sfx('bad', this.api.sfxOn); },
};

// ------------------------------------------------ 폭탄 돌리기
G.bomb = {
  mount(root, v, api) {
    this.api = api; this.el = h('div', { class: 'gwrap bomb' }); root.append(this.el);
    this.t = setInterval(() => this.tickPot(), 100); this.update(v);
  },
  tickPot() { if (this.pot && this.v?.holding && this.v.age === 'adult') this.pot.textContent = `+${Math.floor((this.api.now() - this.v.since) / 100)}점 쌓는 중`; },
  update(v) {
    const prev = this.v; this.v = v; const api = this.api;
    this.el.innerHTML = '';
    this.el.append(h('div', { class: 'ginfo' }, `라운드 ${v.round}/${v.rounds} · 내 점수 ${v.pts}`));
    if (v.phase === 'break' || v.exploded) {
      this.el.append(h('div', { class: 'boom' }, '💥'), h('div', { class: 'gt' }, v.myBoom ? '펑! 내가 들고 있었어요' : `펑! ${v.boomName}`), h('div', { class: 'muted' }, v.phase === 'break' ? '다음 라운드 준비…' : '다른 팀 폭탄을 기다려요'));
      if (!prev?.exploded && v.exploded) { sfx('boom', api.sfxOn); vibrate(v.myBoom ? 400 : 80); }
      return;
    }
    if (v.holding) {
      this.pot = h('div', { class: 'pot' });
      const b = onPress(h('button', { class: 'btn red passbtn' }, '휙! 넘기기 👉'), () => { api.send({ a: 'pass' }); b.disabled = true; sfx('pass', api.sfxOn); });
      this.el.append(h('div', { class: 'bombicon hold' }, '💣'), h('div', { class: 'gt' }, '폭탄이 나에게 왔어요!'), this.pot, b);
      if (!prev?.holding) vibrate([60, 40, 60]);
      this.tickPot();
    } else {
      this.pot = null;
      this.el.append(h('div', { class: 'bombicon' }, '💣'), h('div', { class: 'gt' }, `${v.holder || '…'} 에게 있어요`), h('div', { class: 'muted' }, '폭탄이 오면 빨리 넘겨요!'));
    }
  },
  reply(r) { if (r.tooFast) this.api.toast('잠깐! 0.5초는 들고 있어야 해요'); },
  unmount() { clearInterval(this.t); },
};

// ------------------------------------------------ 선택형 공통 (눈치/생존/가위바위보/상자/OX)
function timerLine(api, until, label = '') {
  const el = h('div', { class: 'tline' });
  const tick = () => { const s = secLeft(api, until); el.textContent = `${label}${s}초`; el.classList.toggle('hurry', s <= 3); };
  tick(); const t = setInterval(tick, 250); el._stop = () => clearInterval(t);
  return el;
}
function choiceGame(render) {
  return {
    mount(root, v, api) { this.api = api; this.el = h('div', { class: 'gwrap choice' }); root.append(this.el); this.update(v); },
    update(v) { this.tl?._stop?.(); this.el.innerHTML = ''; this.v = v; render.call(this, v, this.api, this.el); },
    reply(r) { if (r.locked) this.api.toast('이미 골랐어요'); },
    unmount() { this.tl?._stop?.(); },
  };
}
G.nunchi = choiceGame(function (v, api, el) {
  el.append(h('div', { class: 'ginfo' }, `라운드 ${v.round}/${v.rounds} · 성공 ${v.ok}번`));
  if (v.phase === 'pick') {
    this.tl = timerLine(api, v.until); el.append(this.tl, h('div', { class: 'gt' }, v.pick != null ? '골랐어요! 결과를 기다려요' : v.kid ? '그림 하나를 골라요' : '숫자 하나를 고르세요'));
    const grid = h('div', { class: `pickgrid n${Math.min(v.K, 40)}` });
    for (let i = 1; i <= v.K; i++) {
      const b = onPress(h('button', { class: `pk ${v.pick === i ? 'sel' : ''}` }, v.kid ? v.pics[i - 1] : String(i)), () => { if (this.v.pick != null) return; this.v.pick = i; api.send({ a: 'pick', v: i }); b.classList.add('sel'); grid.classList.add('done'); vibrate(20); });
      grid.append(b);
    }
    if (v.pick != null) grid.classList.add('done');
    el.append(grid);
  } else if (v.phase === 'reveal') {
    const ok = v.result === 'ok';
    el.append(h('div', { class: `res ${ok ? 'ok' : 'no'}` }, ok ? '⭕ 성공!' : v.result === 'none' ? '⏰ 못 골랐어요' : `❌ ${v.dupWith}명과 겹쳤어요`), h('div', { class: 'muted' }, v.pick != null ? `내 선택: ${v.kid ? v.pics[v.pick - 1] : v.pick}` : ''));
    sfx(ok ? 'good' : 'bad', api.sfxOn);
  } else el.append(h('div', { class: 'gt' }, '잠시만요…'));
});
G.survivor = choiceGame(function (v, api, el) {
  el.append(h('div', { class: 'ginfo' }, `라운드 ${v.round}/${v.maxRounds} · 생존 ${v.aliveN}명`));
  if (!v.alive && !v.kid) { el.append(h('div', { class: 'res no' }, '👻 탈락'), h('div', { class: 'muted' }, `${v.rounds}라운드 생존! 큰 화면에서 관전하세요`)); return; }
  if (v.phase === 'pick') {
    this.tl = timerLine(api, v.until);
    el.append(this.tl, h('div', { class: 'gt' }, v.pick != null ? '골랐어요!' : v.kid ? '동물 하나를 골라요' : '문 하나를 고르세요'));
    const grid = h('div', { class: 'doors' });
    v.opts.forEach((o, i) => grid.append(onPress(h('button', { class: `door ${v.pick === i ? 'sel' : ''}` }, h('span', {}, o.e), h('small', {}, o.n)), () => { if (this.v.pick != null) return; this.v.pick = i; api.send({ a: 'pick', v: i }); this.update(this.v); vibrate(20); })));
    el.append(grid);
  } else if (v.phase === 'reveal' && v.last) {
    const bad = v.opts[v.last.bad];
    const safe = v.pick != null && v.pick !== v.last.bad;
    el.append(h('div', { class: 'gt' }, `${v.kid ? '꽝' : '탈락 문'}: ${bad.e} ${bad.n}`));
    el.append(h('div', { class: `res ${safe ? 'ok' : 'no'}` }, v.voided ? '😮 전원 탈락 → 무효! 모두 살아요' : safe ? (v.kid ? '⭐ 별 획득!' : '😎 생존!') : v.kid ? '아쉬워요, 다음엔 별!' : '💀 탈락…'));
    sfx(safe || v.voided ? 'good' : 'bad', api.sfxOn);
  } else el.append(h('div', { class: 'gt' }, '잠시만요…'));
});
G.rps = choiceGame(function (v, api, el) {
  el.append(h('div', { class: 'ginfo' }, `라운드 ${v.round}/${v.rounds} · ${v.kid ? `⭐ ${v.pts}` : `${'❤️'.repeat(Math.max(0, v.lives))}${'🤍'.repeat(Math.max(0, v.maxLives - v.lives))} · ${v.pts}점`}`));
  if (!v.kid && v.lives <= 0) { el.append(h('div', { class: 'res no' }, '👻 탈락'), h('div', { class: 'muted' }, '큰 화면에서 응원해요!')); return; }
  if (v.phase === 'pick') {
    this.tl = timerLine(api, v.until);
    el.append(this.tl, h('div', { class: 'gt' }, '번개쌤과 가위바위보!'));
    const row = h('div', { class: 'rps' });
    RPS.forEach((o, i) => row.append(onPress(h('button', { class: `rpsb ${v.pick === i ? 'sel' : ''}` }, h('span', {}, o.e), h('small', {}, o.n)), () => { if (this.v.pick != null) return; this.v.pick = i; api.send({ a: 'pick', v: i }); this.update(this.v); vibrate(20); })));
    el.append(row);
  } else if (v.phase === 'reveal') {
    el.append(h('div', { class: 'rpsvs' }, h('div', {}, h('small', {}, '번개쌤'), h('span', {}, RPS[v.host].e)), h('b', {}, 'VS'), h('div', {}, h('small', {}, '나'), h('span', {}, v.pick != null ? RPS[v.pick].e : '❔'))));
    el.append(h('div', { class: `res ${v.myR > 0 ? 'ok' : v.myR === 0 ? '' : 'no'}` }, v.voided ? '전원 패배 → 무효! 다시!' : v.myR > 0 ? '🎉 이겼다!' : v.myR === 0 ? '🤝 비겼다' : v.pick == null ? '⏰ 시간 초과' : '😵 졌다'));
    sfx(v.myR > 0 ? 'good' : 'bad', api.sfxOn);
  } else el.append(h('div', { class: 'gt' }, '잠시만요…'));
});
G.fatebox = choiceGame(function (v, api, el) {
  el.append(h('div', { class: 'ginfo' }, `라운드 ${v.round}/${v.rounds} · 내 점수 ${v.pts}`));
  el.append(h('div', { class: 'boxlist' }, '상자 속: ', v.list.join(' · ')), h('div', { class: 'seal' }, `🔒 봉인 코드 ${v.seal}`));
  if (v.phase === 'pick') {
    this.tl = timerLine(api, v.until);
    el.append(this.tl);
    const grid = h('div', { class: 'boxes' });
    for (let i = 0; i < v.n; i++) grid.append(onPress(h('button', { class: `box ${v.pick === i ? 'sel' : ''}` }, '🎁', h('small', {}, `${i + 1}번`)), () => { if (this.v.pick != null) return; this.v.pick = i; api.send({ a: 'pick', v: i }); this.update(this.v); vibrate(20); }));
    el.append(grid, h('div', { class: 'muted' }, v.pick != null ? '골랐어요! 두근두근…' : '상자 하나를 고르세요'));
  } else if (v.phase === 'reveal') {
    const grid = h('div', { class: 'boxes open' });
    v.open.forEach((l, i) => grid.append(h('div', { class: `box ${v.pick === i ? 'sel' : ''}` }, h('b', {}, l))));
    el.append(grid, h('div', { class: `res ${v.mine?.v > 0 ? 'ok' : v.mine ? 'no' : ''}` }, v.mine ? `내 상자: ${v.mine.l}` : '못 골랐어요'));
    sfx(v.mine?.v > 0 ? 'good' : 'bad', api.sfxOn);
  } else el.append(h('div', { class: 'gt' }, '잠시만요…'));
});
G.ox = choiceGame(function (v, api, el) {
  el.append(h('div', { class: 'ginfo' }, `문제 ${v.qi + 1}/${v.n} · ${v.pts}점`));
  if (v.text) el.append(h('div', { class: 'oxq' }, v.emoji ? h('div', { class: 'oxe' }, v.emoji) : null, h('div', {}, v.text)));
  if (v.phase === 'q') {
    this.tl = timerLine(api, v.until); el.prepend(this.tl);
    const row = h('div', { class: 'oxrow' });
    [[1, '⭕', 'O'], [0, '❌', 'X']].forEach(([val, e]) => row.append(onPress(h('button', { class: `oxb ${val ? 'o' : 'x'} ${v.my === val ? 'sel' : ''} ${v.my != null && v.my !== val ? 'dim' : ''}` }, e), () => { if (this.v.my != null) return; this.v.my = val; api.send({ a: 'ans', q: v.qi, v: val }); this.update(this.v); vibrate(20); })));
    el.append(row);
  } else if (v.phase === 'reveal') {
    const ok = v.my === v.answer;
    el.append(h('div', { class: `res ${ok ? 'ok' : 'no'}` }, `정답은 ${v.answer ? '⭕' : '❌'} · ${v.my == null ? '못 골랐어요' : ok ? '맞았어요!' : '틀렸어요'}`));
    sfx(ok ? 'good' : 'bad', api.sfxOn);
  }
});

// ------------------------------------------------ 10초의 신
G.tensec = {
  mount(root, v, api) { this.api = api; this.el = h('div', { class: 'gwrap' }); root.append(this.el); this.update(v); },
  update(v) {
    this.v = v; const api = this.api; this.el.innerHTML = '';
    cancelAnimationFrame(this.raf);
    this.el.append(h('div', { class: 'ginfo' }, `목표 ${v.target}초 · 남은 기회 ${v.left}번${v.best != null ? ` · 최고 오차 ${(v.best / 1000).toFixed(2)}초` : ''}`));
    for (const t of v.tries) this.el.append(h('div', { class: 'try' }, `${(t.el / 1000).toFixed(2)}초 (오차 ${(t.err / 1000).toFixed(2)})`));
    if (v.left <= 0) { this.el.append(h('div', { class: 'gt' }, '끝! 결과를 기다려요')); return; }
    const clock = h('div', { class: 'clock' }, '0.00');
    if (!this.running) {
      const b = onPress(h('button', { class: 'btn green huge' }, '▶ 시작'), () => { this.running = true; this.t0 = performance.now(); api.send({ a: 'go' }); this.update(this.v); });
      this.el.append(h('div', { class: 'gt' }, `시작을 누르고 ${v.target}초에 멈춰요!`), clock, b);
    } else {
      const b = onPress(h('button', { class: 'btn red huge' }, '■ 멈춰!'), () => { const el = performance.now() - this.t0; this.running = false; cancelAnimationFrame(this.raf); api.send({ a: 'stop', el }); clock.textContent = (el / 1000).toFixed(2); b.disabled = true; });
      this.el.append(clock, b);
      const loop = () => { const el = performance.now() - this.t0; clock.textContent = v.hide && el > v.hideAfter ? '?.??' : (el / 1000).toFixed(2); clock.classList.toggle('hid', v.hide && el > v.hideAfter); this.raf = requestAnimationFrame(loop); };
      loop();
    }
  },
  reply(r) { if (r.err != null) { this.running = false; this.api.toast(`${(r.el / 1000).toFixed(2)}초! 오차 ${(r.err / 1000).toFixed(2)}초`); sfx(r.err < 300 ? 'good' : 'tap', this.api.sfxOn); } },
  unmount() { cancelAnimationFrame(this.raf); },
};

// ------------------------------------------------ 팀 협동 금고
G.vault = {
  mount(root, v, api) { this.api = api; this.code = []; this.el = h('div', { class: 'gwrap vault' }); root.append(this.el); this.t = setInterval(() => this.lockTick(), 250); this.update(v); },
  lockTick() { if (this.lockEl) { const s = secLeft(this.api, this.v.lockUntil); this.lockEl.textContent = s > 0 ? `🔒 ${s}초 잠김` : ''; if (s <= 0 && this.lockEl.textContent === '' && this.wasLocked) { this.wasLocked = false; this.update(this.v); } } },
  update(v) {
    this.v = v; const api = this.api; this.el.innerHTML = '';
    if (v.solved) { this.el.append(h('div', { class: 'boom' }, '🔓'), h('div', { class: 'res ok' }, `금고 열림! ${(v.solvedAt / 1000).toFixed(1)}초`), h('div', { class: 'muted' }, `${v.solver} 님이 열었어요`)); if (!this.done) { this.done = true; sfx('win', api.sfxOn); } return; }
    const hints = h('div', { class: 'hints' }, h('div', { class: 'hl' }, '🔑 나만의 힌트 (팀원에게 말해 주세요!)'));
    if (!v.hints.length) hints.append(h('div', { class: 'hint' }, '이번엔 힌트가 없어요. 팀원 힌트를 모아요!'));
    for (const x of v.hints) hints.append(h('div', { class: 'hint' }, x.t, x.pic != null ? h('span', { class: 'hpic' }, VAULT_PICS[x.pic]) : ''));
    this.el.append(hints);
    if (!v.canEnter) { this.el.append(h('div', { class: 'gt' }, `입력은 대표 ${v.repName} 님이 해요`), h('div', { class: 'muted' }, v.wrong ? `틀린 횟수 ${v.wrong}` : '')); return; }
    const slots = h('div', { class: 'slots' });
    const draw = () => { slots.innerHTML = ''; for (let i = 0; i < v.len; i++) slots.append(h('div', { class: 'slot' }, this.code[i] != null ? (v.kind === 'pic' ? VAULT_PICS[this.code[i]] : String(this.code[i])) : '')); };
    draw();
    const pad = h('div', { class: `pad ${v.kind}` });
    const keys = v.kind === 'pic' ? VAULT_PICS.map((p, i) => [p, i]) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => [String(n), n]);
    for (const [lab, val] of keys) pad.append(onPress(h('button', { class: 'key' }, lab), () => { if (this.code.length < v.len) { this.code.push(val); draw(); vibrate(10); } }));
    pad.append(onPress(h('button', { class: 'key del' }, '⌫'), () => { this.code.pop(); draw(); }));
    const go = onPress(h('button', { class: 'btn green' }, '🔓 열기'), () => { if (this.code.length !== v.len) return api.toast(`${v.len}칸을 다 채워 주세요`); api.send({ a: 'try', code: this.code }); this.code = []; draw(); });
    this.lockEl = h('div', { class: 'lock' });
    this.wasLocked = api.now() < v.lockUntil;
    this.el.append(h('div', { class: 'gt' }, '👑 대표 입력'), slots, this.lockEl, pad, go, v.last != null ? h('div', { class: 'muted' }, `지난 시도: ${v.last}칸 맞음 · 틀린 횟수 ${v.wrong}`) : null);
    this.lockTick();
  },
  reply(r) { if (r.wrong) { sfx('bad', this.api.sfxOn); vibrate(200); this.api.toast(`틀렸어요! ${r.right}칸 맞음 · 3초 잠김`); } if (r.notRep) this.api.toast('대표가 입력해요'); },
  unmount() { clearInterval(this.t); },
};

// ------------------------------------------------ 두더지
G.mole = {
  mount(root, v, api) {
    this.api = api; this.v = v; this.hit = new Set(); this.score = v.score;
    const cols = v.holes === 6 ? 2 : 3;
    this.holes = [];
    const grid = h('div', { class: 'moles', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } });
    for (let i = 0; i < v.holes; i++) {
      const hEl = onPress(h('button', { class: 'hole' }, h('span', { class: 'mole' }, '🐹')), () => this.tap(i));
      this.holes.push(hEl); grid.append(hEl);
    }
    this.sc = h('div', { class: 'bignum' }, `${v.score}점`);
    root.append(h('div', { class: 'gwrap' }, this.sc, grid));
    const loop = () => { this.draw(); this.raf = requestAnimationFrame(loop); }; loop();
  },
  active(i) {
    const t = this.api.now() - this.v.t0;
    return this.v.sched.findIndex((s, k) => s.hole === i && t >= s.at && t <= s.at + s.dur && !this.hit.has(k));
  },
  draw() { this.holes.forEach((el, i) => el.classList.toggle('up', this.active(i) >= 0)); },
  tap(i) {
    const k = this.active(i);
    if (k >= 0) { this.hit.add(k); this.api.send({ a: 'hit', i: k, hole: i }); this.holes[i].classList.add('bonk'); setTimeout(() => this.holes[i].classList.remove('bonk'), 200); sfx('good', this.api.sfxOn); vibrate(15); }
    else { this.api.send({ a: 'miss' }); if (this.v.age === 'adult') sfx('bad', this.api.sfxOn); }
  },
  update(v) { this.v = v; this.sc.textContent = `${v.score}점`; },
  unmount() { cancelAnimationFrame(this.raf); },
};

// ------------------------------------------------ 반응속도
G.reaction = {
  mount(root, v, api) {
    this.api = api; this.pad = h('button', { class: 'react wait' }); this.info = h('div', { class: 'ginfo' });
    onPress(this.pad, () => this.tap());
    root.append(h('div', { class: 'gwrap' }, this.info, this.pad)); this.update(v);
  },
  update(v) {
    this.v = v;
    this.info.textContent = `라운드 ${v.round}/${v.rounds}${v.avg ? ` · 평균 ${Math.round(v.avg)}ms` : ''}`;
    if (v.phase === 'arm' && this.armedRound !== v.round) {
      this.armedRound = v.round; this.state = 'wait'; this.tapped = false;
      // 신호 시각: 서버가 보낸 시각 + delay 를 이 폰의 시계로 환산
      this.goAt = performance.now() + Math.max(300, v.sentAt + v.delay - this.api.now());
      this.setPad('wait', '빨간불… 기다려!');
      clearTimeout(this.tm); this.tm = setTimeout(() => { if (this.state === 'wait') { this.state = 'go'; this.greenAt = performance.now(); this.setPad('go', '지금! 터치!'); vibrate(30); } }, this.goAt - performance.now());
    } else if (v.phase !== 'arm') {
      clearTimeout(this.tm);
      const c = v.cur;
      this.setPad('done', c?.rt ? `${c.rt}ms!` : c?.foul ? '반칙! (먼저 눌렀어요)' : '다음 라운드 준비…');
    }
  },
  setPad(cls, text) { this.pad.className = `react ${cls}`; this.pad.textContent = text; },
  tap() {
    if (this.tapped || this.v.phase !== 'arm') return;
    if (this.state === 'wait') {
      this.api.send({ a: 'tap', round: this.v.round, early: true });
      if (this.v.age === 'kid' || this.api.age === 'kid') { this.api.toast('아직이에요! 초록색이 되면 눌러요'); return; }
      this.tapped = true; clearTimeout(this.tm); this.setPad('foul', '반칙! 너무 빨라요'); sfx('bad', this.api.sfxOn); return;
    }
    if (this.state === 'go') { this.tapped = true; const rt = performance.now() - this.greenAt; this.api.send({ a: 'tap', round: this.v.round, rt }); this.setPad('done', `${Math.round(rt)}ms!`); sfx('good', this.api.sfxOn); }
  },
  reply(r) { if (r.foul && r.sus) this.setPad('foul', '기록 확인 실패 (반칙 처리)'); },
  unmount() { clearTimeout(this.tm); },
};

// ------------------------------------------------ 숫자 사냥
G.numhunt = {
  mount(root, v, api) { this.api = api; this.el = h('div', { class: 'gwrap' }); root.append(this.el); this.update(v); },
  update(v) {
    if (this.v && v.board === this.board && v.next < this.next) return; // 내 화면이 더 앞서 있으면 유지
    this.v = v; this.board = v.board; this.next = v.next;
    const lay = numHuntLayout(v.seed, v.n);
    this.el.innerHTML = '';
    this.head = h('div', { class: 'ginfo' }, `다음 숫자: `, h('b', { class: 'nextn' }, String(this.next)), ` · ${v.board + 1}번째 판 · 누른 개수 ${v.done}`);
    const grid = h('div', { class: 'numgrid', style: { gridTemplateColumns: `repeat(${lay.side}, 1fr)` } });
    const at = {}; lay.pos.forEach((cell, k) => (at[cell] = k + 1));
    for (let c = 0; c < lay.side * lay.side; c++) {
      const n = at[c];
      const b = h('button', { class: `num ${n == null ? 'empty' : ''} ${n != null && n < this.next ? 'got' : ''}` }, n ?? '');
      if (n != null) onPress(b, () => {
        this.api.send({ a: 'tap', b: this.board, k: c });
        if (n === this.next) { this.next++; b.classList.add('got'); this.head.querySelector('.nextn').textContent = this.next > v.n ? '✓' : this.next; vibrate(8); }
        else { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 300); sfx('bad', this.api.sfxOn); }
      });
      grid.append(b);
    }
    this.el.append(this.head, grid);
  },
  reply(r) { if (r.newBoard != null) sfx('good', this.api.sfxOn); },
};

// ------------------------------------------------ 기억력
G.memory = {
  mount(root, v, api) {
    this.api = api; this.el = h('div', { class: 'gwrap' });
    this.info = h('div', { class: 'ginfo' }); this.msg = h('div', { class: 'gt' });
    this.grid = h('div', { class: `memgrid b${v.btns}` });
    this.btn = [];
    for (let i = 0; i < v.btns; i++) {
      const b = onPress(h('button', { class: 'mem', style: { '--c': MEM_COL[i] } }, v.kid ? MEM_KID[i] : ''), () => this.press(i));
      this.btn.push(b); this.grid.append(b);
    }
    this.el.append(this.info, this.msg, this.grid); root.append(this.el);
    this.update(v);
  },
  update(v) {
    this.v = v;
    this.info.textContent = `${v.lvl}단계 (최대 ${v.max}) · 기회 ${'❤️'.repeat(v.lives)} · 통과 ${v.cleared || 0}단계`;
    if (v.fin) { this.msg.textContent = v.cleared >= v.max ? '🏆 최고 단계 성공!' : `끝! ${v.cleared}단계까지 성공`; this.mode = 'fin'; return; }
    const key = v.lvl + ':' + v.att;
    if (this.key !== key) { this.key = key; this.mode = 'wait'; this.msg.textContent = '잘 보세요…'; setTimeout(() => this.api.send({ a: 'show' }), 700); }
  },
  async reply(r) {
    if (r.seq) {
      this.seq = r.seq; this.mode = 'show'; this.msg.textContent = '👀 순서를 기억하세요!';
      for (const i of r.seq) { await wait(this.v.flash * 0.35); this.flash(i); await wait(this.v.flash * 0.65); }
      this.input = []; this.mode = 'input'; this.msg.textContent = '👆 이제 똑같이 누르세요!';
    }
    if (r.ok) { sfx('good', this.api.sfxOn); this.msg.textContent = r.fin ? '🏆 최고 단계!' : '⭕ 정답! 다음 단계'; }
    if (r.wrong) { sfx('bad', this.api.sfxOn); this.msg.textContent = r.fin ? '끝났어요!' : '❌ 틀렸어요! 다시 한 번'; vibrate(200); }
    if (r.tooFast) this.api.toast('순서를 다 보고 눌러요');
  },
  flash(i) { const b = this.btn[i]; b.classList.add('on'); sfx('tap', this.api.sfxOn); setTimeout(() => b.classList.remove('on'), this.v.flash * 0.55); },
  press(i) {
    if (this.mode !== 'input') return;
    this.flash(i); this.input.push(i);
    if (this.input.length === this.seq.length) { this.mode = 'wait'; this.api.send({ a: 'ans', lvl: this.v.lvl, att: this.v.att, seq: this.input }); }
  },
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------ 색깔 함정
G.colortrap = {
  mount(root, v, api) { this.api = api; this.el = h('div', { class: 'gwrap' }); root.append(this.el); this.update(v); },
  update(v) {
    if (this.built && v.r === this.r) { this.v = { ...this.v, score: v.score }; if (this.sc) this.sc.textContent = `점수 ${v.score}`; return; }
    this.v = v; this.r = v.r; this.found = new Set(v.found); this.built = true;
    const R = colorRound(v.seed, v.r, v.tiles, v.colors, v.stroop);
    const T = COLORS6[R.target];
    this.el.innerHTML = '';
    this.sc = h('div', { class: 'ginfo' }, `점수 ${v.score}`);
    this.el.append(this.sc, h('div', { class: 'ctq' }, h('span', { class: 'sw', style: { background: T.hex } }, T.shape), `${T.name}${v.kid ? '' : '만'} 모두 누르세요!`, v.stroop ? h('div', { class: 'warn' }, '⚠️ 글자에 속지 마세요!') : null));
    const cols = v.tiles === 6 ? 3 : v.tiles === 9 ? 3 : 4;
    const grid = h('div', { class: 'ctgrid', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } });
    R.grid.forEach((c, i) => {
      const C = COLORS6[c];
      const b = h('button', { class: `ct ${this.found.has(i) ? 'got' : ''}`, style: { background: C.hex } }, h('span', { class: 'shape' }, C.shape), R.words[i] >= 0 ? h('b', { class: 'word' }, COLORS6[R.words[i]].name) : null);
      onPress(b, () => {
        if (this.found.has(i)) return;
        this.api.send({ a: 'tap', r: this.r, i });
        if (c === R.target) { this.found.add(i); b.classList.add('got'); vibrate(8); } else { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 300); sfx('bad', this.api.sfxOn); }
      });
      grid.append(b);
    });
    this.el.append(grid);
  },
  reply(r) { if (r.next != null) { sfx('good', this.api.sfxOn); this.built = false; } },
};

// ------------------------------------------------ 탑 쌓기
G.tower = {
  mount(root, v, api) {
    this.api = api; this.cv = h('canvas', { class: 'towercv' }); this.info = h('div', { class: 'ginfo' });
    onPress(this.cv, () => this.drop());
    root.append(h('div', { class: 'gwrap' }, this.info, this.cv, h('div', { class: 'muted' }, '화면을 톡! 눌러 블록을 멈춰요')));
    this.stack = []; this.reset(v);
    const loop = () => { this.draw(); this.raf = requestAnimationFrame(loop); }; loop();
  },
  reset(v) { this.v = v; this.tw = v.tw; this.k = v.k; this.left = v.left; this.w = v.w; this.speed = v.speed; this.spawn = performance.now(); this.busy = false; if (v.k === 0) this.stack = [{ left: v.left, w: v.w }]; this.info.textContent = `높이 ${v.k}층 · 최고 ${v.best}층`; },
  update(v) { if (!this.busy && (v.tw !== this.tw || v.k !== this.k)) this.reset(v); this.info.textContent = `높이 ${v.k}층 · 최고 ${v.best}층`; },
  drop() {
    if (this.busy) return; this.busy = true;
    const t = performance.now() - this.spawn;
    this.dropX = towerX(t, this.speed, this.w);
    this.api.send({ a: 'drop', k: this.k, tw: this.tw, ms: t });
  },
  reply(r) {
    if (r.ok) { this.stack.push({ left: r.left, w: r.w, perfect: r.perfect }); sfx(r.perfect ? 'win' : 'good', this.api.sfxOn); vibrate(r.perfect ? 60 : 15); this.k = r.k; this.left = r.left; this.w = r.w; this.speed = this.speed * 1.06; this.spawn = performance.now(); this.busy = false; this.info.textContent = `높이 ${r.k}층 · 최고 ${r.best}층${r.perfect ? ' ✨PERFECT' : ''}`; }
    if (r.miss) { sfx('boom', this.api.sfxOn); vibrate(200); this.api.toast(`와르르! ${r.height}층 · 새 탑 시작`); this.stack = []; this.busy = false; this.tw = -1; }
    if (r.sus) this.busy = false;
  },
  draw() {
    const cv = this.cv; const W = (cv.width = cv.clientWidth * devicePixelRatio); const H = (cv.height = cv.clientHeight * devicePixelRatio);
    const cx = cv.getContext('2d'); cx.clearRect(0, 0, W, H);
    const bh = Math.min(H / 12, 46 * devicePixelRatio);
    const visible = Math.floor(H / bh) - 3;
    const off = Math.max(0, this.stack.length - visible);
    const col = this.api.team.color;
    this.stack.forEach((b, i) => { if (i < off) return; const y = H - (i - off + 1) * bh; cx.fillStyle = i === 0 ? '#556' : col; cx.globalAlpha = b.perfect ? 1 : 0.85; cx.fillRect(b.left * W, y, b.w * W, bh - 3); });
    cx.globalAlpha = 1;
    if (!this.busy && this.stack.length) { const x = towerX(performance.now() - this.spawn, this.speed, this.w); const y = H - (this.stack.length - off + 1) * bh; cx.fillStyle = '#ffd43b'; cx.fillRect(x * W, y, this.w * W, bh - 3); }
  },
  unmount() { cancelAnimationFrame(this.raf); },
};

// ------------------------------------------------ 팀 빙고
G.bingo = {
  mount(root, v, api) { this.api = api; this.el = h('div', { class: 'gwrap' }); this.modal = h('div', { class: 'modal hidden' }); root.append(this.el, this.modal); this.update(v); },
  update(v) {
    this.v = v; const api = this.api; this.el.innerHTML = '';
    this.el.append(h('div', { class: 'ginfo' }, v.order ? `🎉 ${v.order}번째로 빙고! (${v.lines}줄)` : `완성 줄 ${v.lines} · 칸을 골라 미션을 깨요!`));
    const grid = h('div', { class: 'bingo', style: { gridTemplateColumns: `repeat(${v.S}, 1fr)` } });
    v.board.forEach((s, i) => grid.append(onPress(h('button', { class: `bc s${s}`, style: { '--tc': api.team.color } }, s === 2 ? '✓' : s === 1 ? '🔒' : s === 3 ? '✋' : String(i + 1)), () => { if (s === 0 || s === 3) api.send({ a: 'open', c: i }); else if (s === 1) api.toast('팀원이 도전 중인 칸이에요'); })));
    this.el.append(grid);
    if (!v.board.includes(3)) this.closeModal();
  },
  closeModal() { clearInterval(this.mt); this.modal.classList.add('hidden'); this.modal.innerHTML = ''; this.ms = null; },
  reply(r) {
    const api = this.api;
    if (r.mission) {
      const m = r.mission; this.ms = m; this.modal.innerHTML = ''; this.modal.classList.remove('hidden');
      const box = h('div', { class: 'mbox' }, h('div', { class: 'mq' }, m.q), h('button', { class: 'mx', onclick: () => this.closeModal() }, '✕'));
      if (m.type === 'tap') {
        let n = 0, sent = 0; const cnt = h('div', { class: 'bignum' }, `0 / ${m.n}`);
        const b = onPress(h('button', { class: 'tapbig small', style: { '--tc': api.team.color } }, '연타!'), () => { n++; cnt.textContent = `${Math.min(n, m.n)} / ${m.n}`; vibrate(8); });
        this.mt = setInterval(() => { if (n > sent) { api.send({ a: 'tapm', c: m.c, n: n - sent }); sent = n; } }, 150);
        box.append(cnt, b);
      } else {
        const opts = h('div', { class: 'mopts' });
        m.opts.forEach((o, i) => opts.append(onPress(h('button', { class: 'mopt', style: m.type === 'color' ? { background: o.hex } : {} }, m.type === 'color' ? h('span', { class: 'shape' }, o.sh, m.stroop ? h('b', { class: 'word' }, ['빨강', '파랑', '노랑', '초록', '보라', '주황'][(i + 2) % 6]) : '') : String(o)), () => api.send({ a: 'solve', c: m.c, v: i }))));
        box.append(opts);
      }
      this.modal.append(box);
    }
    if (r.done != null) { this.closeModal(); sfx('good', api.sfxOn); vibrate(40); }
    if (r.wrong) { this.closeModal(); sfx('bad', api.sfxOn); api.toast('틀렸어요! 2초 쉬었다가 다시'); }
    if (r.taken) api.toast('팀원이 도전 중인 칸이에요');
    if (r.expired) { this.closeModal(); api.toast('시간이 지났어요. 다시 골라요'); }
    if (r.cool) api.toast('잠깐 쉬는 중이에요');
  },
  unmount() { clearInterval(this.mt); },
};

// ------------------------------------------------ 역전 룰렛
export function wheelEl(seg, colors) {
  const n = seg.length; const step = 360 / n;
  const grad = seg.map((_, i) => `${colors[i % colors.length]} ${i * step}deg ${(i + 1) * step}deg`).join(',');
  const w = h('div', { class: 'wheel', style: { background: `conic-gradient(${grad})` } });
  seg.forEach((v, i) => {
    const a = ((i * step + step / 2) * Math.PI) / 180;
    w.append(h('span', { class: 'wl', style: { left: `${50 + 33 * Math.sin(a)}%`, top: `${50 - 33 * Math.cos(a)}%`, transform: `translate(-50%, -50%) rotate(${i * step + step / 2}deg)` } }, `+${v}`));
  });
  return w;
}
export function spinTo(w, out, n, ms = 4000) {
  const step = 360 / n;
  w.style.transition = `transform ${ms}ms cubic-bezier(.15,.85,.25,1)`;
  w.style.transform = `rotate(${360 * 6 - (out * step + step / 2)}deg)`;
}
G.roulette = {
  mount(root, v, api) { this.api = api; this.el = h('div', { class: 'gwrap' }); root.append(this.el); this.update(v); },
  update(v) {
    const api = this.api;
    if (this.wheel && this.v?.spunAt && v.spunAt) return;
    this.v = v; this.el.innerHTML = '';
    this.wheel = wheelEl(v.seg, ['#ff4d6d', '#3d8bff', '#ffd43b', '#2fd27a', '#b06bff', '#ff922b', '#22d3ee', '#f472b6']);
    this.el.append(h('div', { class: 'ginfo' }, `우리 팀 최대 보너스 +${v.max}점`), h('div', { class: 'wheelwrap' }, h('div', { class: 'pin' }, '▼'), this.wheel));
    if (v.spunAt) {
      this.res = h('div', { class: 'res ok' }, '두구두구…');
      this.el.append(this.res); sfx('spin', api.sfxOn);
      requestAnimationFrame(() => spinTo(this.wheel, v.out, v.seg.length));
      setTimeout(() => { this.res.textContent = `🎉 +${v.seg[v.out]}점!`; sfx('win', api.sfxOn); }, 4100);
    } else if (v.can) this.el.append(onPress(h('button', { class: 'btn huge' }, '🎡 돌리기!'), () => api.send({ a: 'spin' })));
    else this.el.append(h('div', { class: 'gt' }, '팀 대표가 돌려요! 두근두근'));
  },
};

// ------------------------------------------------ 최후의 왕좌 (결승전)
G.throne = {
  mount(root, v, api) {
    this.api = api; this.head = h('div', { class: 'thead' }); this.body = h('div', { class: 'tbody' });
    root.append(h('div', { class: 'gwrap throne' }, this.head, this.body)); this.update(v);
  },
  update(v) {
    const api = this.api;
    this.head.innerHTML = '';
    this.head.append(h('div', { class: 'tsteps' }, v.labels.map((l, i) => h('span', { class: i < v.ri ? 'done' : i === v.ri ? 'cur' : '' }, `${i + 1}${v.weights[i] > 1 ? '×2' : ''}`))));
    this.head.append(h('div', { class: 'ginfo' }, `👑 결승 ${v.ri + 1}라운드 · ${v.labels[v.ri] || ''} · 우리 팀 ${v.pts[api.team.id] ?? 0}점`));
    const key = v.phase === 'play' && v.sub ? `${v.ri}:${v.sub.g}` : `inter${v.ri}`;
    if (key !== this.key) {
      this.cur?.unmount?.(); this.cur = null; this.body.innerHTML = ''; this.key = key;
      if (v.phase === 'play' && v.sub && G[v.sub.g]) {
        this.cur = Object.create(G[v.sub.g]);
        const sapi = Object.create(api); sapi.send = (m) => api.send({ ...m, ri: v.ri });
        this.cur.mount(this.body, v.sub, sapi);
      } else if (v.last) {
        const got = v.last.got[api.team.id]; const rk = v.last.rank[api.team.id];
        this.body.append(h('div', { class: 'gt' }, `${v.last.label} 라운드 결과`), h('div', { class: `res ${rk === 1 ? 'ok' : ''}` }, `우리 팀 ${rk}위 · +${got}점`), h('div', { class: 'muted' }, '다음 라운드 준비!'));
        if (rk === 1) sfx('win', api.sfxOn);
      }
    } else if (this.cur && v.sub) this.cur.update?.(v.sub);
  },
  reply(r) { this.cur?.reply?.(r); },
  unmount() { this.cur?.unmount?.(); },
};

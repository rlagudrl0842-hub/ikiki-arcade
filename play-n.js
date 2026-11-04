// 새 게임 참가자 폰 화면 (G에 등록)
import { h, sfx, vibrate } from './client.js';
import { G } from './play-games.js';
import { fruitSchedule, fruitPos, fruitLife, fruitR, FRUITS, ropeBeats } from './gen2.js';
import { M, motionChip } from './play-motion.js';

const AW = 1600, AH = 860;
function onPress(el, fn) { el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(e); }, { passive: false }); el.addEventListener('contextmenu', (e) => e.preventDefault()); return el; }
function fitCanvas(cv) { const r = cv.getBoundingClientRect(); const d = Math.min(2, devicePixelRatio || 1); const w = Math.max(1, Math.round(r.width * d)), hh = Math.max(1, Math.round(r.height * d)); if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; } return { W: w, H: hh, d }; }
const left = (api, until) => Math.max(0, Math.ceil((until - api.now()) / 1000));
const banner = (cls, text) => h('div', { class: `nb ${cls}` }, text);
function loop(self, fn) { const f = () => { if (self.dead) return; try { fn(); } catch (e) { console.error(e); } self.raf = requestAnimationFrame(f); }; self.raf = requestAnimationFrame(f); }
function stopLoop(self) { self.dead = true; cancelAnimationFrame(self.raf); }

// ================================================================ 아레나 (조이스틱)
function joystick(api, onVec) {
  const knob = h('div', { class: 'jk' });
  const pad = h('div', { class: 'jpad' }, knob, h('div', { class: 'jhint' }, '여기를 누른 채 움직여요'));
  let id = null, vx = 0, vy = 0, sent = [0, 0], at = 0;
  const flush = (force) => {
    const now = performance.now();
    if (!force && now - at < 70) return;
    if (!force && Math.abs(vx - sent[0]) < 0.08 && Math.abs(vy - sent[1]) < 0.08) return;
    at = now; sent = [vx, vy]; api.send({ a: 'mv', x: Math.round(vx * 100) / 100, y: Math.round(vy * 100) / 100 });
  };
  const upd = (e) => {
    const r = pad.getBoundingClientRect(); const R = r.width / 2 - 20;
    let x = (e.clientX - r.left - r.width / 2) / R, y = (e.clientY - r.top - r.height / 2) / R;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    vx = x; vy = y; knob.style.transform = `translate(${x * R}px, ${y * R}px)`; onVec(vx, vy); flush();
  };
  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); id = e.pointerId; pad.setPointerCapture(id); pad.classList.add('on'); upd(e); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) upd(e); });
  const end = (e) => { if (e.pointerId !== id) return; id = null; vx = vy = 0; knob.style.transform = ''; pad.classList.remove('on'); onVec(0, 0); flush(true); };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  // 컴퓨터 테스트용 방향키
  const keys = new Set();
  const kd = (e) => { if (!e.key.startsWith('Arrow')) return; keys.add(e.key); kv(); }; const ku = (e) => { keys.delete(e.key); kv(); };
  const kv = () => { vx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0); vy = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0); const l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l; onVec(vx, vy); flush(true); };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const iv = setInterval(() => flush(), 120);
  pad.stop = () => { clearInterval(iv); removeEventListener('keydown', kd); removeEventListener('keyup', ku); };
  return pad;
}
function arenaGame(kind) {
  return {
    mount(root, v, api) {
      this.api = api; this.v = v; this.at = performance.now(); this.vec = [0, 0];
      this.cv = h('canvas', { class: 'amap' });
      this.st = h('div', { class: 'ast' });
      this.fx = h('div', { class: 'afx' });
      this.pad = joystick(api, (x, y) => { this.vec = [x, y]; });
      root.append(h('div', { class: `arena k-${kind}` }, motionChip(api, '폰을 기울여 이동'), this.st, h('div', { class: 'amapw' }, this.cv, this.fx), this.pad));
      let lastT = [0, 0];
      this.tiv = setInterval(() => { if (!M.on || this.pad.classList.contains('on')) return; const [x, y] = M.tilt(); const v = [Math.round(x * 100) / 100, Math.round(y * 100) / 100]; this.vec = v; if (Math.abs(v[0] - lastT[0]) < 0.08 && Math.abs(v[1] - lastT[1]) < 0.08) return; lastT = v; api.send({ a: 'mv', x: v[0], y: v[1] }); }, 100);
      this.update(v);
      loop(this, () => this.draw());
    },
    update(v) {
      const prev = this.v; this.v = v; this.at = performance.now();
      if (v.grid) this.grid = v.grid;
      const st = this.st; st.innerHTML = '';
      if (kind === 'dodge') {
        st.append(h('b', {}, v.dead ? '💀 탈락! 친구들을 응원해요' : v.kid ? '⚡ 노란 원을 피해요!' : `❤️`.repeat(v.hp) + '🤍'.repeat(3 - v.hp)), h('span', {}, `남은 사람 ${v.alive}명`));
      } else if (kind === 'zombie') {
        st.append(h('b', {}, v.z ? `🧟 나는 좀비! 사람을 잡아라 (${v.tags}명)` : '🙂 사람 — 좀비를 피해 도망!'), h('span', {}, `사람 ${v.humans} · 좀비 ${v.zs}`));
        document.body.classList.toggle('zmode', !!v.z);
        if (prev && !prev.z && v.z) { vibrate([200, 80, 200]); sfx('bad', this.api.sfxOn); }
      } else if (kind === 'gems') {
        st.append(h('b', {}, `보석 ${v.got}점`), h('span', {}, '가까운 보석부터!'));
      } else if (kind === 'crown') {
        const inz = Math.hypot(v.x - v.z[0], v.y - v.z[1]) <= v.z[2];
        st.append(h('b', {}, inz ? '원 안! 점수 올라가는 중' : '황금 원으로 이동!'), h('span', {}, `${Math.round(v.inT)}초 차지`));
      } else {
        st.append(h('b', {}, `${v.painted}칸 칠함`), h('span', {}, '빈 곳·남의 땅을 찾아가요'));
      }
    },
    reply(r) {
      if (r.hit) { vibrate([120, 60, 120]); sfx('boom', this.api.sfxOn); this.flash('hit', r.dead ? '💀 번개에 맞아 탈락!' : '⚡ 찌릿! 맞았어요'); }
      if (r.bitten) this.flash('bit', `🧟 ${r.by}에게 물렸다!`);
      if (r.tag) { sfx('good', this.api.sfxOn); this.flash('tag', `🧟 ${r.who} 잡았다!`); }
      if (r.big) { sfx('win', this.api.sfxOn); vibrate([40, 30, 40]); this.flash('tag', '대형 보석 +5'); }
    },
    flash(cls, text) { const f = h('div', { class: `aflash ${cls}` }, text); this.fx.append(f); setTimeout(() => f.remove(), 1200); },
    draw() {
      const v = this.v; const { W, H, d } = fitCanvas(this.cv); const c = this.cv.getContext('2d');
      const sx = W / AW, sy = H / AH;
      c.clearRect(0, 0, W, H);
      c.fillStyle = '#121845'; c.fillRect(0, 0, W, H);
      const now = performance.now();
      if (kind === 'paint' && this.grid) {
        const GC = v.GC, GR = v.GR; const cw = W / GC, ch = H / GR;
        for (let i = 0; i < this.grid.length; i++) { const ch0 = this.grid[i]; if (ch0 === '.') continue; c.fillStyle = this.api.teamColor(parseInt(ch0, 36)); c.globalAlpha = 0.85; c.fillRect((i % GC) * cw, Math.floor(i / GC) * ch, cw + 0.5, ch + 0.5); }
        c.globalAlpha = 1;
      }
      // 격자선
      c.strokeStyle = '#ffffff10'; c.lineWidth = 1; for (let x = 0; x < AW; x += 100) { c.beginPath(); c.moveTo(x * sx, 0); c.lineTo(x * sx, H); c.stroke(); } for (let y = 0; y < AH; y += 100) { c.beginPath(); c.moveTo(0, y * sy); c.lineTo(W, y * sy); c.stroke(); }
      if (kind === 'dodge') {
        const age = (now - this.at) / 1000;
        for (const [x, y, r, t] of v.warn || []) {
          const k = Math.max(0, t - age);
          c.fillStyle = `rgba(255,212,59,${0.18 + 0.25 * (1 - Math.min(1, k / 1.5))})`; c.beginPath(); c.arc(x * sx, y * sy, r * sx, 0, 7); c.fill();
          c.strokeStyle = '#ffd43b'; c.lineWidth = 3 * d; c.stroke();
        }
        for (const [x, y, r] of v.boom || []) { c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(x * sx, y * sy, r * sx, 0, 7); c.fill(); }
      }
      if (kind === 'gems') for (const [x, y, gv] of v.gems || []) { c.fillStyle = gv >= 5 ? '#ffd43b' : gv === 2 ? '#7cf3ff' : '#b06bff'; c.save(); c.translate(x * sx, y * sy); c.rotate(Math.PI / 4); const r = (gv >= 5 ? 10 : 6) * d; c.fillRect(-r, -r, r * 2, r * 2); c.restore(); }
      if (kind === 'crown' && v.z) { c.fillStyle = 'rgba(255,212,59,.22)'; c.beginPath(); c.arc(v.z[0] * sx, v.z[1] * sy, v.z[2] * sx, 0, 7); c.fill(); c.strokeStyle = '#ffd43b'; c.lineWidth = 3 * d; c.stroke(); }
      if (kind === 'zombie') {
        const n = v.near || [];
        for (let i = 0; i < n.length; i += 3) { c.fillStyle = n[i + 2] ? '#56d364' : '#ffffffaa'; c.beginPath(); c.arc(n[i] * sx, n[i + 1] * sy, (n[i + 2] ? 9 : 6) * d, 0, 7); c.fill(); }
      }
      // 내 위치 (서버 위치 + 지금 방향으로 살짝 예측)
      const dt = Math.min(0.25, (now - this.at) / 1000);
      const still = v.dead || v.stun;
      const mx = (v.x + (still ? 0 : this.vec[0] * 330 * dt)) * sx, my = (v.y + (still ? 0 : this.vec[1] * 330 * dt)) * sy;
      const pulse = 1 + 0.25 * Math.sin(now / 160);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(mx, my, 15 * d * pulse, 0, 7); c.fill();
      c.fillStyle = v.z ? '#2fbf4a' : this.api.team.color; c.beginPath(); c.arc(mx, my, 11 * d, 0, 7); c.fill();
      c.font = `${18 * d}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(v.dead ? '💀' : v.z ? '🧟' : '', mx, my);
      c.fillStyle = '#fff'; c.font = `bold ${12 * d}px sans-serif`; c.fillText('나', mx, my - 26 * d);
    },
    unmount() { stopLoop(this); clearInterval(this.tiv); this.pad.stop(); document.body.classList.remove('zmode'); },
  };
}
G.dodge = arenaGame('dodge');
G.zombie = arenaGame('zombie');
G.paint = arenaGame('paint');
G.gems = arenaGame('gems');
G.crown = arenaGame('crown');

// ================================================================ 무궁화 꽃이 피었습니다
const SONG = '무궁화꽃이피었습니다';
G.mugung = {
  mount(root, v, api) {
    this.api = api; this.v = v; this.holding = false;
    this.ban = h('div', { class: 'mgban' });
    this.track = h('div', { class: 'mgtrack' }, h('div', { class: 'mgme' }, api.team.icon), h('div', { class: 'mgfin' }, '🏁'));
    this.btn = h('button', { class: 'mgbtn' }, h('span', { class: 'mgi' }, '🏃'), h('span', {}, '꾹 누르면 전진'));
    const on = (e) => { e.preventDefault(); if (this.v.out || this.v.fin) return; this.btn.setPointerCapture?.(e.pointerId); this.set(true); };
    const off = () => this.set(false);
    this.btn.addEventListener('pointerdown', on); this.btn.addEventListener('pointerup', off); this.btn.addEventListener('pointercancel', off); this.btn.addEventListener('lostpointercapture', off);
    this.btn.addEventListener('contextmenu', (e) => e.preventDefault());
    this.info = h('div', { class: 'ginfo' });
    root.append(h('div', { class: 'gwrap mg' }, this.ban, this.track, this.info, this.btn));
    this.update(v);
    loop(this, () => this.draw());
  },
  set(on) { if (on === this.holding) return; this.holding = on; this.btn.classList.toggle('on', on); this.api.send({ a: 'go', on }); if (on) vibrate(10); },
  update(v) {
    const ph0 = this.v?.ph; this.v = v;
    if (v.ph === 'turn' && ph0 !== 'turn') vibrate([60, 40, 60]);
    if (v.out || v.fin) this.set(false);
    this.track.querySelector('.mgme').style.left = `${Math.min(92, v.pos * 0.92)}%`;
    this.info.textContent = v.fin ? `🎉 ${v.fin}등으로 도착!` : v.out ? '😵 움직이다 걸렸어요! 친구들을 응원해요' : `${Math.round(v.pos)}m / 100m`;
    this.btn.disabled = !!(v.out || v.fin);
  },
  reply(r) {
    if (r.caught) { vibrate([300]); sfx('bad', this.api.sfxOn); this.set(false); this.api.toast(r.kid ? '앗! 들켰다~ 뒤로 30m' : '😵 걸렸다! 탈락'); document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 500); }
    if (r.fin) { sfx('win', this.api.sfxOn); vibrate([80, 50, 80]); }
  },
  draw() {
    const v = this.v; const b = this.ban;
    if (v.ph === 'sing') {
      const k = Math.max(0, Math.min(1, 1 - (v.until - this.api.now()) / (v.dur * 1000)));
      const n = Math.max(1, Math.ceil(k * SONG.length));
      const txt = `🙈 ${SONG.slice(0, n)}`; if (b.textContent !== txt) { b.textContent = txt; b.className = 'mgban sing'; }
    } else if (v.ph === 'turn') { if (b.className !== 'mgban turn') { b.textContent = '😮 돌아본다!'; b.className = 'mgban turn'; } }
    else if (b.className !== 'mgban look') { b.textContent = '👀 멈춰!!'; b.className = 'mgban look'; }
  },
  unmount() { stopLoop(this); if (this.holding) this.api.send({ a: 'go', on: false }); },
};

// ================================================================ 단체 줄넘기
G.rope = {
  mount(root, v, api) {
    this.api = api; this.v = v; this.fb = null;
    this.cv = h('canvas', { class: 'ropecv' });
    this.info = h('div', { class: 'ginfo' });
    this.msg = h('div', { class: 'ropemsg' });
    this.btn = onPress(h('button', { class: 'jumpbtn', style: { '--tc': api.team.color } }, '점프!'), () => {
      api.send({ a: 'j', ts: Math.round(api.now()) }); vibrate(12); this.btn.classList.remove('hit'); void this.btn.offsetWidth; this.btn.classList.add('hit'); this.jumpAt = performance.now();
    });
    root.append(h('div', { class: 'gwrap rope2' }, this.info, this.cv, this.msg, this.btn));
    this.update(v);
    loop(this, () => this.draw());
  },
  update(v) {
    const prevK = this.v?.lastK; this.v = v;
    if (v.prm?.t0 && (!this.beats || this.beats[0] !== v.prm.t0)) this.beats = ropeBeats(v.prm, 120000);
    this.info.innerHTML = `<b>🔥 우리 팀 ${v.combo}연속</b> <span class="muted">· 최고 ${v.best} · 내 성공 ${v.hits}</span>`;
    if (v.lastK !== prevK && v.last === 'fail') { this.say('😵 우리 팀이 줄에 걸렸어요! 다시 돌아가요', 'bad'); sfx('bad', this.api.sfxOn); }
  },
  reply(r) { if (r.ok) { this.say('👍 성공!', 'ok'); sfx('tap', this.api.sfxOn); } else this.say(r.spam ? '✋ 너무 많이 눌렀어요' : (r.d < 0 ? '⏩ 조금 빨랐어요' : '⏪ 조금 늦었어요'), 'no'); },
  say(t, cls) { this.msg.textContent = t; this.msg.className = `ropemsg ${cls}`; clearTimeout(this.mt); this.mt = setTimeout(() => { this.msg.textContent = ''; }, 900); },
  draw() {
    if (!this.beats) return;
    const { W, H, d } = fitCanvas(this.cv); const c = this.cv.getContext('2d'); c.clearRect(0, 0, W, H);
    const now = this.api.now(); const b = this.beats;
    let k = b.findIndex((x) => x > now); if (k < 0) k = b.length - 1;
    const prev = k > 0 ? b[k - 1] : b[0] - (this.v.prm.p0); const per = b[k] - prev;
    const ph = Math.max(0, Math.min(1, (now - prev) / per)); // 0: 바닥 → 1: 다음 바닥
    const ang = ph * Math.PI * 2; const cx = W / 2, top = H * 0.12, floor = H * 0.86;
    // 줄 (위아래로 도는 모양)
    const yMid = top + (floor - top) * (0.5 + 0.5 * Math.cos(ang));
    c.strokeStyle = '#ffd43b'; c.lineWidth = 6 * d; c.beginPath(); c.moveTo(W * 0.08, H * 0.5); c.quadraticCurveTo(cx, yMid * 2 - H * 0.5, W * 0.92, H * 0.5); c.stroke();
    // 사람
    const jump = this.jumpAt && performance.now() - this.jumpAt < 350 ? Math.sin(((performance.now() - this.jumpAt) / 350) * Math.PI) * H * 0.18 : 0;
    c.fillStyle = '#fff'; c.font = `${H * 0.32}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(this.api.team.icon, cx, floor - jump);
    c.fillStyle = '#ffffff22'; c.fillRect(W * 0.1, floor, W * 0.8, 3 * d);
    // 타이밍 링: 다음 박자까지 남은 시간
    const rest = (b[k] - now) / per; const ring = this.btn;
    ring.style.setProperty('--ring', `${Math.max(0, Math.min(1, rest))}`);
    ring.classList.toggle('now', Math.abs(now - b[k]) < this.v.win || Math.abs(now - prev) < this.v.win);
  },
  unmount() { stopLoop(this); },
};

// ================================================================ 불꽃놀이
G.fire = {
  mount(root, v, api) {
    this.api = api; this.v = v; this.mine = {}; this.parts = [];
    this.cv = h('canvas', { class: 'firecv' });
    this.res = h('div', { class: 'fireres' });
    this.dots = h('div', { class: 'firedots' });
    const pop = (e) => {
      const now = Math.round(api.now()); const R = this.v.R || [];
      const i = R.findIndex((x, j) => this.mine[j] == null && now >= x.L && now <= x.A + 900);
      if (i < 0) return;
      this.mine[i] = 'wait'; api.send({ a: 'pop', i, ts: now }); vibrate(20);
      this.burst(R[i], now);
    };
    const wrap = h('div', { class: 'firew' }, this.cv, this.res);
    onPress(wrap, pop);
    root.append(h('div', { class: 'gwrap fire2' }, this.dots, wrap, h('div', { class: 'muted' }, '화면 아무 데나 톡! = 펑!')));
    this.update(v);
    loop(this, () => this.draw());
  },
  update(v) { this.v = v; for (const [i, s] of Object.entries(v.sc || {})) this.mine[i] = s; this.drawDots(); },
  drawDots() { const R = this.v.R || []; this.dots.innerHTML = ''; R.forEach((_, i) => { const s = this.mine[i]; this.dots.append(h('span', { class: `fd ${typeof s === 'number' ? (s >= 90 ? 'p' : s >= 60 ? 'g' : 'b') : ''}` }, typeof s === 'number' ? s : i + 1)); }); },
  reply(r) {
    this.mine[r.i] = r.s; this.drawDots();
    this.res.textContent = r.perfect ? '✨ PERFECT! 100' : `${r.s}점 ${r.err < 0 ? '(조금 빨랐어요)' : '(조금 늦었어요)'}`;
    this.res.className = `fireres ${r.perfect ? 'p' : r.s >= 60 ? 'g' : 'b'}`;
    sfx(r.s >= 80 ? 'good' : 'tap', this.api.sfxOn);
    clearTimeout(this.rt); this.rt = setTimeout(() => { this.res.textContent = ''; }, 1400);
  },
  rocketY(x, now) { // 0(바닥)~1(최고점)
    if (now < x.L) return null;
    if (now <= x.A) { const k = (now - x.L) / (x.A - x.L); return 1 - (1 - k) * (1 - k); }
    const k = (now - x.A) / 900; if (k > 1) return null; return 1 - k * k * 0.5;
  },
  burst(x, now) {
    const y = this.rocketY(x, now) ?? 1; const col = `hsl(${x.hue},95%,62%)`;
    for (let i = 0; i < 46; i++) { const a = (i / 46) * Math.PI * 2; const sp = 0.35 + Math.random() * 0.25; this.parts.push({ x: x.x, y: 1 - y * 0.8 - 0.08, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, at: performance.now(), col }); }
    sfx('boom', this.api.sfxOn);
  },
  draw() {
    const { W, H, d } = fitCanvas(this.cv); const c = this.cv.getContext('2d');
    c.fillStyle = 'rgba(8,10,30,0.35)'; c.fillRect(0, 0, W, H);
    const now = this.api.now(); const R = this.v.R || [];
    for (let i = 0; i < R.length; i++) {
      const x = R[i]; if (this.mine[i] != null && this.mine[i] !== 'wait') continue;
      const y = this.rocketY(x, now); if (y == null) continue;
      const px = x.x * W, py = H - (y * 0.8 + 0.08) * H;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, 6 * d, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,190,80,.5)'; c.fillRect(px - 2 * d, py, 4 * d, 30 * d);
    }
    const t = performance.now();
    this.parts = this.parts.filter((p) => t - p.at < 1400);
    for (const p of this.parts) { const k = (t - p.at) / 1000; c.globalAlpha = Math.max(0, 1 - k / 1.4); c.fillStyle = p.col; c.beginPath(); c.arc((p.x + p.vx * k) * W, (p.y + p.vy * k * 0.6 + 0.15 * k * k) * H, 3.5 * d, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  },
  unmount() { stopLoop(this); },
};

// ================================================================ 과일 베기
G.fruit = {
  mount(root, v, api) {
    this.api = api; this.v = v; this.cut = new Set(); this.halves = []; this.trail = []; this.pending = []; this.score = v.score || 0;
    this.cv = h('canvas', { class: 'fruitcv' });
    this.sc = h('div', { class: 'fruitsc' }, '0점');
    const box = h('div', { class: 'fruitw' }, this.cv, this.sc);
    let down = false;
    const pt = (e) => { const r = this.cv.getBoundingClientRect(); const s = r.width; return [(e.clientX - r.left) / s, (e.clientY - r.top) / s, performance.now()]; };
    box.addEventListener('pointerdown', (e) => { e.preventDefault(); down = true; box.setPointerCapture(e.pointerId); this.trail = [pt(e)]; });
    box.addEventListener('pointermove', (e) => { if (!down) return; const p = pt(e); const a = this.trail[this.trail.length - 1]; this.trail.push(p); if (a) this.slice(a, p); });
    const up = () => { down = false; this.flush(); };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    root.append(h('div', { class: 'gwrap fruit2' }, box));
    this.update(v);
    this.iv = setInterval(() => this.flush(), 120);
    loop(this, () => this.draw());
  },
  update(v) { this.v = v; if (!this.sched || this.sched.seed !== v.seed) { this.sched = fruitSchedule(v.seed, v.dur, v.lv); this.sched.seed = v.seed; } },
  now() { return (this.api.now() - this.v.t0) / 1000; },
  slice(a, b) {
    const sec = this.now(); const hh = this.cv.height / this.cv.width;
    for (const f of this.sched) {
      if (this.cut.has(f.id)) continue;
      const [x, y0, dt] = fruitPos(f, sec); if (dt < 0 || dt > fruitLife(f)) continue;
      const y = y0 / 1.5 * hh; const rr = fruitR(f) * 1.25;
      // 선분과 원 거리
      const vx = b[0] - a[0], vy = b[1] - a[1]; const L = vx * vx + vy * vy || 1e-6;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / L));
      const dx = a[0] + vx * t - x, dy = a[1] + vy * t - y;
      if (dx * dx + dy * dy <= rr * rr) {
        this.cut.add(f.id); this.pending.push(f.id);
        this.halves.push({ f, x, y, at: performance.now(), ang: Math.atan2(vy, vx) });
        if (f.type === 'b') { vibrate([150, 50, 150]); sfx('boom', this.api.sfxOn); } else { vibrate(8); sfx('tap', this.api.sfxOn); }
      }
    }
  },
  flush() { if (!this.pending.length) return; this.api.send({ a: 'cut', ids: this.pending.slice(0, 8), ts: Math.round(this.api.now()) }); this.pending = this.pending.slice(8); },
  reply(r) {
    this.score = r.score; this.sc.textContent = `${r.score}점`;
    if (r.combo >= 3) { this.pop(`🔥 ${r.combo}콤보! +${r.combo - 2}`); sfx('good', this.api.sfxOn); }
    if (r.gold) this.pop('🌟 황금 과일 +5!');
    if (r.bomb) this.pop('💣 펑! -5');
  },
  pop(t) { const e = h('div', { class: 'fruitpop' }, t); this.cv.parentNode.append(e); setTimeout(() => e.remove(), 900); },
  draw() {
    const { W, H, d } = fitCanvas(this.cv); const c = this.cv.getContext('2d');
    c.clearRect(0, 0, W, H);
    const sec = this.now(); const hh = H / W;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const f of this.sched) {
      if (this.cut.has(f.id)) continue;
      const [x, y0, dt] = fruitPos(f, sec); if (dt < 0 || dt > fruitLife(f)) continue;
      const y = y0 / 1.5 * hh;
      const s = fruitR(f) * 2.3 * W;
      c.save(); c.translate(x * W, y * W); c.rotate(dt * f.spin);
      if (f.type === 'g') { c.shadowColor = '#ffd43b'; c.shadowBlur = 25 * d; }
      c.font = `${s}px sans-serif`; c.fillText(f.type === 'b' ? '💣' : f.type === 'g' ? '🌟' : FRUITS[f.k], 0, 0); c.restore();
    }
    const t = performance.now();
    this.halves = this.halves.filter((x) => t - x.at < 700);
    for (const o of this.halves) {
      const k = (t - o.at) / 700; const s = fruitR(o.f) * 2.3 * W;
      c.globalAlpha = 1 - k; c.font = `${s}px sans-serif`;
      for (const sd of [-1, 1]) { c.save(); c.translate(o.x * W + sd * k * 40 * d, o.y * W + k * k * 120 * d); c.rotate(sd * k * 2); c.fillText(o.f.type === 'b' ? '💥' : o.f.type === 'g' ? '✨' : FRUITS[o.f.k], 0, 0); c.restore(); }
      c.globalAlpha = 1;
    }
    this.trail = this.trail.filter((p) => t - p[2] < 160);
    if (this.trail.length > 1) { c.strokeStyle = '#fff'; c.lineWidth = 6 * d; c.lineCap = 'round'; c.beginPath(); this.trail.forEach((p, i) => (i ? c.lineTo(p[0] * W, p[1] * W) : c.moveTo(p[0] * W, p[1] * W))); c.stroke(); }
  },
  unmount() { stopLoop(this); clearInterval(this.iv); this.flush(); },
};

// ================================================================ 골든벨 서바이벌
G.bell = {
  mount(root, v, api) { this.api = api; this.root = h('div', { class: 'gwrap bell2' }); root.append(this.root); this.update(v); this.t = setInterval(() => this.tick(), 250); },
  update(v) {
    const key = `${v.qi}:${v.ph}:${v.my}:${v.alive}`; this.v = v; if (key === this.key) return; this.key = key;
    const R = this.root; R.innerHTML = '';
    const head = h('div', { class: 'bellh' }, h('span', {}, `🔔 ${v.qi + 1} / ${v.N}`), v.revive ? h('span', { class: 'chip hot' }, '🔥 패자부활전') : null, h('span', { class: 'belltime' }));
    const status = v.kid ? null : h('div', { class: `bellst ${v.alive ? 'ok' : 'out'}` }, v.alive ? `✅ 생존 중 · ${v.ok}개 정답` : (v.revive ? '😤 지금 맞히면 부활!' : '😵 탈락 — 패자부활전을 기다려요'));
    const can = v.ph === 'q' && v.my == null && (v.alive || v.revive || v.kid);
    const opts = h('div', { class: `bellopts n${v.opts.length}` }, v.opts.map((o, i) => {
      const cls = v.ph === 'reveal' ? (i === v.ans ? 'right' : i === v.my ? 'wrong' : 'dim') : i === v.my ? 'mine' : '';
      return onPress(h('button', { class: `bopt ${cls}`, disabled: !can }, h('b', {}, '①②③④'[i]), o), () => { if (!can) return; this.api.send({ a: 'ans', q: v.qi, c: i }); vibrate(15); this.v.my = i; this.key = ''; this.update(this.v); });
    }));
    let foot = null;
    if (v.ph === 'reveal') foot = h('div', { class: `bellres ${v.my === v.ans ? 'ok' : 'no'}` }, v.my === v.ans ? '🎉 정답!' : v.my == null ? '⏰ 시간 초과' : '❌ 땡!');
    else if (v.my != null) foot = h('div', { class: 'muted' }, '답을 골랐어요! 결과를 기다려요');
    R.append(head, status, h('div', { class: 'bellq' }, v.text), opts, foot);
    this.tick();
  },
  tick() { const el = this.root.querySelector('.belltime'); if (el && this.v) el.textContent = this.v.ph === 'q' ? `⏱ ${left(this.api, this.v.until)}초` : ''; },
  reply() {},
  unmount() { clearInterval(this.t); },
};

// ================================================================ 그려라 맞혀라
const PEN = ['#111111', '#ff4d6d', '#3d8bff', '#2fd27a', '#ffb800', '#b06bff', '#8b5a2b', '#ffffff'];
function paintSeg(c, W, seg, d) {
  const [col, w, ...p] = seg; c.strokeStyle = PEN[col] || '#111'; c.lineWidth = [0, 4, 8, 16][w] * d * (W / 340); c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); for (let i = 0; i < p.length; i += 2) { const x = p[i] / 1000 * W, y = p[i + 1] / 1000 * W; if (i) c.lineTo(x, y); else c.moveTo(x, y); } if (p.length === 2) c.lineTo(p[0] / 1000 * W + 0.1, p[1] / 1000 * W); c.stroke();
}
G.draw = {
  mount(root, v, api) { this.api = api; this.root = h('div', { class: 'gwrap draw2' }); root.append(this.root); this.update(v); this.t = setInterval(() => this.tick(), 250); },
  update(v) {
    const key = `${v.round}:${v.ph}:${v.me}:${v.got}`; const prev = this.v; this.v = v;
    if (key === this.key) { if (v.me === 'guess' && v.sk && (!prev || v.seq !== prev.seq)) this.redraw(v.sk); if (v.me === 'draw') this.sv.textContent = `팀원 ${v.solved}/${v.n} 맞힘`; return; }
    this.key = key; const R = this.root; R.innerHTML = '';
    const head = h('div', { class: 'bellh' }, h('span', {}, `🖍 ${v.round + 1} / ${v.R}판`), h('span', { class: 'belltime' }));
    if (v.wait || v.ph === 'gap') { R.append(head, h('div', { class: 'center' }, h('div', { class: 'cic' }, '🖍'), h('div', { class: 'ct' }, '곧 시작해요!'))); return; }
    if (v.me === 'draw') {
      this.sv = h('div', { class: 'muted' }, `팀원 ${v.solved}/${v.n} 맞힘`);
      const cv = h('canvas', { class: 'drawcv' }); this.cv = cv; this.col = 0; this.w = 2;
      const pal = h('div', { class: 'pal' }, PEN.map((c, i) => onPress(h('button', { class: `pc ${i === 0 ? 'on' : ''}`, style: { background: c } }), (e) => { this.col = i; pal.querySelectorAll('.pc').forEach((x) => x.classList.remove('on')); e.target.classList.add('on'); })),
        ...[1, 2, 3].map((w) => onPress(h('button', { class: `pw ${w === 2 ? 'on' : ''}` }, h('i', { style: { width: `${w * 6}px`, height: `${w * 6}px` } })), (e) => { this.w = w; pal.querySelectorAll('.pw').forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); })),
        onPress(h('button', { class: 'pclr' }, '🗑'), () => { this.api.send({ a: 'clr' }); const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); }));
      R.append(head, h('div', { class: 'dword' }, v.ph === 'reveal' ? '⏸ 정답 공개 중' : h('span', {}, '✏️ 몰래 그려요: ', h('b', {}, v.word))), this.sv, cv, pal, h('div', { class: 'muted small' }, '글자·숫자는 쓰면 안 돼요!'));
      this.bindPen(cv);
    } else {
      const cv = h('canvas', { class: 'drawcv view' }); this.cv = cv;
      const can = v.ph === 'draw' && !v.got;
      R.append(head, h('div', { class: 'dword' }, v.answer ? h('span', {}, '정답: ', h('b', {}, v.answer)) : v.got ? '🎉 정답! 다른 팀을 기다려요' : `🎨 ${v.drawer} 님이 그리는 중`), cv,
        h('div', { class: 'dopts' }, (v.opts || []).map((o, i) => onPress(h('button', { class: `dopt ${v.answer && o === v.answer ? 'right' : ''}`, disabled: !can }, o), () => { if (can) { this.api.send({ a: 'g', w: i }); vibrate(10); } }))));
      requestAnimationFrame(() => this.redraw(v.sk || []));
    }
    this.tick();
  },
  bindPen(cv) {
    let down = false, pts = [], last = null;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [Math.round(Math.max(0, Math.min(1000, (e.clientX - r.left) / r.width * 1000))), Math.round(Math.max(0, Math.min(1000, (e.clientY - r.top) / r.width * 1000)))]; };
    const flush = () => { if (pts.length >= 4) { this.api.send({ a: 'ln', p: pts, c: this.col, w: this.w }); last = pts.slice(-2); pts = last.slice(); } };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); if (this.v.ph !== 'draw') return; down = true; cv.setPointerCapture(e.pointerId); pts = pos(e); last = null; });
    cv.addEventListener('pointermove', (e) => {
      if (!down) return; const p = pos(e); const a = pts.length >= 2 ? pts.slice(-2) : last;
      if (a && Math.hypot(p[0] - a[0], p[1] - a[1]) < 6) return;
      pts.push(...p); const { W, d } = fitCanvas(cv); const c = cv.getContext('2d'); if (a) paintSeg(c, W, [this.col, this.w, ...a, ...p], d);
      if (pts.length >= 40) flush();
    });
    const up = () => { if (!down) return; down = false; if (pts.length === 2) pts.push(pts[0] + 1, pts[1]); flush(); pts = []; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    this.ft = setInterval(() => { if (down) flush(); }, 90);
    requestAnimationFrame(() => fitCanvas(cv));
  },
  redraw(sk) { if (!this.cv) return; this.sk = sk.slice(); const { W, d } = fitCanvas(this.cv); const c = this.cv.getContext('2d'); c.clearRect(0, 0, this.cv.width, this.cv.height); for (const s of this.sk) paintSeg(c, W, s, d); },
  reply(r) {
    if (r.sk && this.cv && this.v.me === 'guess') { const { W, d } = fitCanvas(this.cv); const c = this.cv.getContext('2d'); for (const s of r.sk) { this.sk?.push(s); paintSeg(c, W, s, d); } }
    if (r.clr && this.cv) { this.sk = []; const c = this.cv.getContext('2d'); c.clearRect(0, 0, this.cv.width, this.cv.height); }
    if (r.right === true) { sfx('win', this.api.sfxOn); vibrate([60, 40, 60]); }
    if (r.right === false) { sfx('bad', this.api.sfxOn); this.api.toast(`땡! ${r.lock}초 뒤에 다시`); this.root.querySelectorAll('.dopt').forEach((b) => { b.disabled = true; }); setTimeout(() => { if (!this.v.got && this.v.ph === 'draw') this.root.querySelectorAll('.dopt').forEach((b) => { b.disabled = false; }); }, r.lock * 1000); }
  },
  tick() { const el = this.root.querySelector('.belltime'); if (el && this.v) el.textContent = this.v.ph === 'draw' ? `⏱ ${left(this.api, this.v.until)}초` : ''; },
  unmount() { clearInterval(this.t); clearInterval(this.ft); },
};

// ================================================================ 함성 대폭발
G.shout = {
  mount(root, v, api) {
    this.api = api; this.v = v; this.level = 0; this.taps = 0;
    this.ph = h('div', { class: 'shph' });
    this.meter = h('div', { class: 'shmeter' }, h('div', { class: 'shfill' }), h('div', { class: 'shnum' }, '0'));
    this.team = h('div', { class: 'muted' });
    this.micBtn = h('button', { class: 'btn wide' }, '🎤 마이크 켜기');
    this.micBtn.onclick = () => this.startMic();
    this.tapBtn = onPress(h('button', { class: 'shtap', style: { '--tc': api.team.color } }, '👏 응원 연타 (마이크 대신)'), () => { this.taps++; vibrate(6); });
    root.append(h('div', { class: 'gwrap shout2' }, this.ph, this.meter, this.team, this.micBtn, motionChip(api, '폰을 흔들어 응원'), this.tapBtn, h('div', { class: 'muted small' }, '소리는 녹음되지 않고 크기만 재요')));
    this.unsub = M.sub((ev) => { if (M.on && ev.type === 'shake' && !this.an) this.taps++; });
    this.iv = setInterval(() => this.send(), 200);
    this.update(v);
    loop(this, () => this.draw());
  },
  async startMic() {
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      this.stream = st;
      const ac = new (window.AudioContext || window.webkitAudioContext)(); this.ac = ac;
      const src = ac.createMediaStreamSource(st); const an = ac.createAnalyser(); an.fftSize = 1024; src.connect(an); this.an = an; this.buf = new Float32Array(an.fftSize);
      this.micBtn.textContent = '🎤 마이크 켜짐!'; this.micBtn.disabled = true; this.tapBtn.style.display = 'none';
    } catch { this.api.toast('마이크를 쓸 수 없어요. 응원 연타 버튼을 눌러요!'); this.micBtn.style.display = 'none'; }
  },
  measure() {
    if (!this.an) return 0;
    this.an.getFloatTimeDomainData(this.buf); let s = 0; for (const x of this.buf) s += x * x;
    const db = 20 * Math.log10(Math.sqrt(s / this.buf.length) + 1e-6); // 조용함 ≈ -60, 고함 ≈ -5
    return Math.max(0, Math.min(100, ((db + 58) / 50) * 100));
  },
  send() {
    if (this.an) { this.api.send({ a: 'lv', v: Math.round(this.level) }); }
    else if (this.taps) { this.api.send({ a: 'tap', n: Math.min(12, this.taps) }); this.taps = 0; }
  },
  update(v) {
    const p0 = this.v?.ph; this.v = v;
    if (v.ph !== p0 && v.ph === 'burst') { vibrate([100, 50, 100]); sfx('go', this.api.sfxOn); }
    this.team.textContent = `우리 팀 지금 함성 ${v.team}`;
  },
  draw() {
    const v = this.v; const lv = this.an ? this.measure() : 0; this.level = this.level * 0.6 + lv * 0.4;
    const show = this.an ? this.level : Math.min(60, this.taps * 9);
    this.meter.querySelector('.shfill').style.height = `${show}%`; this.meter.querySelector('.shnum').textContent = Math.round(show);
    const sec = left(this.api, v.until);
    const t = v.ph === 'burst' ? `📣 지금 소리 질러!!! ${sec}${v.w === 2 ? ' · 점수 2배!' : ''}` : v.ph === 'rest' ? `😮‍💨 숨 고르기 ${sec}` : v.ph === 'prep' ? `준비… ${sec}` : '끝!';
    if (this.ph.textContent !== t) { this.ph.textContent = t; this.ph.className = `shph ${v.ph}`; }
  },
  unmount() { stopLoop(this); this.unsub?.(); clearInterval(this.iv); try { this.stream?.getTracks().forEach((t) => t.stop()); this.ac?.close(); } catch { /* */ } },
};

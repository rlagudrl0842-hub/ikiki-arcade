// 새 터치게임 4종 참가자 폰 화면: 풍선 터뜨리기 · 폭탄 패스 · 보스 레이드 · 타워 쌓기
// 배경은 단순하게(버튼·점수가 잘 보이게), 누르는 곳은 크게. 모든 입력은 pointerdown 한 번 = 한 번(손가락이 미끄러져도 취소 없음)
import { h, sfx, vibrate } from './client.js';
import { G } from './play-games.js';
import { balloonCfg, balloonWave, balloonTarget, BALLOON_COLORS, bossCfg, bossCell } from './gen2.js';

const press = (el, fn) => { el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(e); }, { passive: false }); el.addEventListener('contextmenu', (e) => e.preventDefault()); return el; };
const loop = (self, fn) => { const f = () => { if (self.dead) return; try { fn(); } catch (e) { console.error(e); } self.raf = requestAnimationFrame(f); }; self.raf = requestAnimationFrame(f); };
function fit(cv) { const r = cv.getBoundingClientRect(); const d = Math.min(2, devicePixelRatio || 1); const w = Math.max(1, Math.round(r.width * d)), hh = Math.max(1, Math.round(r.height * d)); if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; } return [w, hh, d]; }

// ---------------------------------------------------------------- 풍선 터뜨리기
G.balloon = {
  mount(root, v, api) {
    this.api = api; this.v = v; this.popped = new Map(); this.fx = []; this.sc = v.sc || 0;
    this.cf = balloonCfg(v.lv);
    this.top = h('div', { class: 'blhd' }, h('span', { class: 'blsw' }), h('b', { class: 'blname' }), h('span', { class: 'bltime' }));
    this.cv = h('canvas', { class: 'blcv' });
    this.info = h('div', { class: 'blinfo' }, h('b', { class: 'blsc' }, '0점'), h('span', { class: 'blcombo' }));
    const box = h('div', { class: 'gwrap blw' }, this.top, this.cv, this.info);
    root.append(box);
    press(this.cv, (e) => this.tap(e));
    this.update(v); loop(this, () => this.draw());
  },
  sec() { return this.v.t0 ? (this.api.now() - this.v.t0) / 1000 : -1; },
  live(s) {
    const C = this.cf; const out = []; const w1 = Math.floor((s - 1) / C.gap) + 1; const w0 = Math.max(0, Math.floor((s - 1 - C.life * 1.2 - 0.5) / C.gap));
    for (let w = w0; w <= w1; w++) for (const b of balloonWave(this.v.seed, this.api.pid, w, this.v.lv)) { const a = (s - b.t0) / b.life; if (a >= 0 && a <= 1 && !this.popped.has(b.id)) out.push({ ...b, a }); }
    return out;
  },
  pos(b, s) { return [b.x + Math.sin(s * 1.6 + b.sw) * 0.03, 1.12 - b.a * 1.26]; },
  tap(e) {
    const s = this.sec(); if (s < 0) return;
    const r = this.cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; const ar = r.height / r.width;
    let best = null, bd = 1e9;
    for (const b of this.live(s)) { const [bx, by] = this.pos(b, s); const d = Math.hypot(x - bx, (y - by) * ar); if (d < 0.095 && d < bd) { bd = d; best = b; } }
    if (!best) return;
    this.popped.set(best.id, performance.now()); const [bx, by] = this.pos(best, s);
    this.fx.push({ x: bx, y: by, c: BALLOON_COLORS[best.c][1], at: performance.now(), txt: '' }); this.fx.at = best.id;
    this.api.send({ a: 'pop', id: best.id, ts: Math.round(this.api.now()) }); vibrate(10);
  },
  update(v) { this.v = v; if (v.sc != null) this.sc = v.sc; this.paint(); },
  paint() {
    const s = Math.max(0, this.sec()); const C = this.cf; const tgt = balloonTarget(this.v.seed, Math.floor(s / C.tSec), C.nc); const [nm, col] = BALLOON_COLORS[tgt];
    this.top.querySelector('.blsw').style.background = col; this.top.querySelector('.blname').textContent = `${nm} 풍선만 콕!`;
    this.top.querySelector('.bltime').textContent = `색 바뀜 ${Math.ceil(C.tSec - (s % C.tSec))}초`;
    this.info.querySelector('.blsc').textContent = `${this.sc}점`;
    this.info.querySelector('.blcombo').textContent = this.v.combo ? `🔥 팀 콤보 ${this.v.combo}${this.v.combo >= 25 ? ' (+3)' : this.v.combo >= 10 ? ' (+2)' : ''}` : '팀 콤보: 3초 안에 같이 맞혀요';
    if (tgt !== this.tgt) { if (this.tgt != null) { sfx('tick', this.api.sfxOn); vibrate(30); } this.tgt = tgt; this.top.animate?.([{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], 300); }
  },
  draw() {
    const [W, H, d] = fit(this.cv); const c = this.cv.getContext('2d'); const s = this.sec();
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#20305e'); g.addColorStop(1, '#0d1430'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (s < 0) return;
    if ((this._p = (this._p || 0) + 1) % 15 === 0) this.paint();
    const R = W * 0.085;
    for (const b of this.live(s)) {
      const [x, y] = this.pos(b, s); const X = x * W, Y = y * H; const col = BALLOON_COLORS[b.c][1];
      c.strokeStyle = '#ffffff55'; c.lineWidth = 1.5 * d; c.beginPath(); c.moveTo(X, Y + R * 1.15); c.quadraticCurveTo(X + Math.sin(s * 3 + b.sw) * R * 0.4, Y + R * 1.8, X, Y + R * 2.4); c.stroke();
      c.fillStyle = col; c.beginPath(); c.ellipse(X, Y, R * 0.88, R * 1.08, 0, 0, 7); c.fill();
      c.fillStyle = '#ffffff66'; c.beginPath(); c.ellipse(X - R * 0.3, Y - R * 0.4, R * 0.18, R * 0.3, -0.5, 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.moveTo(X - R * 0.12, Y + R * 1.12); c.lineTo(X + R * 0.12, Y + R * 1.12); c.lineTo(X, Y + R * 0.98); c.fill();
    }
    const now = performance.now(); this.fx = this.fx.filter((f) => now - f.at < 500);
    for (const f of this.fx) { const k = (now - f.at) / 500; c.strokeStyle = f.c; c.globalAlpha = 1 - k; c.lineWidth = 4 * d; for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; c.beginPath(); c.moveTo(f.x * W + Math.cos(a) * R * (0.4 + k), f.y * H + Math.sin(a) * R * (0.4 + k)); c.lineTo(f.x * W + Math.cos(a) * R * (0.8 + k * 1.5), f.y * H + Math.sin(a) * R * (0.8 + k * 1.5)); c.stroke(); } if (f.txt) { c.fillStyle = f.ok ? '#2fd27a' : '#ff4d6d'; c.font = `900 ${26 * d}px sans-serif`; c.textAlign = 'center'; c.fillText(f.txt, f.x * W, f.y * H - k * 40 * d); } c.globalAlpha = 1; }
  },
  reply(r) {
    if (r.sc != null) this.sc = r.sc;
    const f = this.fx.find((x) => !x.txt); if (f) { f.txt = r.ok ? `+${r.g || 1}` : '−1'; f.ok = r.ok; }
    if (r.ok) sfx('good', this.api.sfxOn); else { sfx('bad', this.api.sfxOn); vibrate([40, 30, 40]); }
    if (r.c != null) this.v = { ...this.v, combo: r.c };
    this.paint();
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

// ---------------------------------------------------------------- 폭탄 패스
const BOMB_C = [['빨강', '#ff4d6d'], ['파랑', '#3d8bff'], ['노랑', '#ffd43b']];
G.bombpass = {
  mount(root, v, api) {
    this.api = api;
    this.hd = h('div', { class: 'bphd' }); this.bomb = h('div', { class: 'bpbomb' }, '💣'); this.fuse = h('div', { class: 'bpfuse' }, h('i')); this.say = h('div', { class: 'bpsay' });
    this.btns = h('div', { class: 'bpbtns' }, ...BOMB_C.map(([nm, col], i) => press(h('button', { class: 'bpbtn', style: { '--bc': col } }, nm), () => this.pass(i))));
    this.stat = h('div', { class: 'muted bpstat' });
    root.append(h('div', { class: 'gwrap bpw' }, this.hd, this.bomb, this.fuse, this.say, this.btns, this.stat));
    this.update(v); this.iv = setInterval(() => this.tickFuse(), 100);
  },
  pass(i) { const m = this.v.my; if (!m || this.sent === m.id + ':' + i) return; if (this.lockUntil && performance.now() < this.lockUntil) return; this.sent = m.id + ':' + i; this.api.send({ a: 'pass', b: m.id, c: i }); vibrate(12); },
  update(v) {
    const had = this.v?.my?.id; this.v = v; this.at = performance.now(); const m = v.my;
    if (!m || m.id !== had) this.sent = null;
    this.hd.textContent = m ? '💥 폭탄이 왔어요! 빨리 넘겨요!' : '😎 지금은 폭탄이 없어요';
    this.hd.classList.toggle('hot', !!m);
    this.bomb.style.display = m ? '' : 'none'; this.fuse.style.display = m ? '' : 'none'; this.btns.style.display = m ? '' : 'none';
    this.say.innerHTML = '';
    if (m) { const [nm, col] = BOMB_C[m.c]; this.say.append(h('span', { class: 'bpsw', style: { background: col } }), h('b', {}, `${nm}`), ' 버튼을 눌러 다른 팀에게!'); }
    else this.say.textContent = '폭탄이 오면 진동이 울려요. 화면을 보고 있어요!';
    this.stat.textContent = `우리 팀 폭발 ${v.booms}번 · 내가 넘긴 폭탄 ${v.passes}개${v.myBooms ? ` · 내 손에서 💥${v.myBooms}` : ''}`;
    this.tickFuse();
  },
  tickFuse() { const m = this.v?.my; if (!m) return; const left = Math.max(0, m.left - (performance.now() - this.at) / 1000); this.fuse.firstChild.style.width = `${Math.min(100, (left / Math.max(1, m.tot)) * 100)}%`; this.fuse.classList.toggle('low', left < 3); this.bomb.classList.toggle('shake', left < 3); },
  reply(r) {
    if (r.bomb) { sfx('hurry', this.api.sfxOn); vibrate([80, 40, 80]); }
    if (r.wrong) { sfx('bad', this.api.sfxOn); vibrate(60); this.lockUntil = performance.now() + 1000; this.sent = null; this.say.textContent = '❌ 다른 색! 1초 뒤 다시'; setTimeout(() => this.update(this.v), 1000); }
    if (r.lock) this.sent = null;
    if (r.passed) { sfx('good', this.api.sfxOn); }
    if (r.boom) { sfx('bad', this.api.sfxOn); vibrate([200, 60, 200]); this.api.toast?.('💥 펑! 폭탄이 터졌어요'); }
  },
  unmount() { clearInterval(this.iv); },
};

// ---------------------------------------------------------------- 보스 레이드
G.boss = {
  mount(root, v, api) {
    this.api = api; this.v = v; this.cf = bossCfg(v.cells === 4 ? 1 : 2); this.cf.slot = v.slot; this.cf.cells = v.cells;
    const n = v.cells === 4 ? 2 : 3;
    this.hp = h('div', { class: 'bshp' }, h('i'), h('b'));
    this.cellsEl = h('div', { class: `bsgrid n${n}` }, ...Array.from({ length: v.cells }, (_, i) => press(h('button', { class: 'bscell' }, ''), () => this.hit(i))));
    this.msg = h('div', { class: 'bsmsg' }); this.me = h('div', { class: 'muted' });
    root.append(h('div', { class: 'gwrap bsw' }, h('div', { class: 'bshd' }, '🐉 빛나는 약점 칸을 콕!'), this.hp, this.cellsEl, this.msg, this.me));
    this.update(v); loop(this, () => this.frame());
  },
  k() { return this.v.t0 ? Math.floor((this.api.now() - this.v.t0) / 1000 / this.v.slot) : -1; },
  hit(i) {
    const k = this.k(); if (k < 0 || this.v.done || this.done === k) return; if (this.stunUntil && performance.now() < this.stunUntil) return;
    this.done = k; this.api.send({ a: 'hit', k, c: i, ts: Math.round(this.api.now()) }); vibrate(8);
    const el = this.cellsEl.children[i]; el.classList.add('hitme'); setTimeout(() => el.classList.remove('hitme'), 200);
  },
  frame() {
    const k = this.k(); if (k === this.lastK) return; this.lastK = k;
    const weak = k >= 0 && !this.v.done ? bossCell(this.v.seed, this.api.pid, k, this.v.cells) : -1;
    [...this.cellsEl.children].forEach((el, i) => { el.classList.toggle('weak', i === weak); el.textContent = i === weak ? '🎯' : ''; });
  },
  update(v) {
    this.v = v; const pct = v.max ? (v.hp / v.max) * 100 : 0;
    this.hp.firstChild.style.width = `${pct}%`; this.hp.lastChild.textContent = v.done ? `🏆 우리 팀 보스 처치! (${v.rank}등)` : `우리 팀 보스 체력 ${v.hp} / ${v.max}`;
    this.me.textContent = `내 공격 ${v.dmg}`; if (v.done) this.msg.textContent = '🎉 다른 팀을 응원해요!';
  },
  reply(r) {
    if (r.ok) { this.msg.textContent = r.crit ? '⚡ 치명타! ×2' : '💥 명중!'; sfx(r.crit ? 'good' : 'tap', this.api.sfxOn); }
    else if (r.ok === false) { this.msg.textContent = '🛡 막혔다! 잠깐 기다려요'; this.stunUntil = performance.now() + 600; sfx('bad', this.api.sfxOn); vibrate(50); }
    if (r.stun) this.msg.textContent = '🛡 잠깐 기다려요';
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

// ---------------------------------------------------------------- 타워 쌓기
G.towerup = {
  mount(root, v, api) {
    this.api = api;
    this.hd = h('div', { class: 'twhd' }); this.cv = h('canvas', { class: 'twcv' }); this.btn = h('button', { class: 'twbtn', style: { '--tc': api.team.color } }, '⬇ 지금 떨어뜨리기!');
    this.wait = h('div', { class: 'twwait' }); this.me = h('div', { class: 'muted' });
    press(this.btn, () => this.drop()); press(this.cv, () => this.drop());
    root.append(h('div', { class: 'gwrap tww', style: { '--tc': api.team.color } }, this.hd, this.cv, this.btn, this.wait, this.me));
    this.blocks = []; this.update(v); loop(this, () => this.draw());
  },
  T() { return this.v.T + (this.api.now() - this.v.at) / 1000; },
  xNow() { const v = this.v; const span = 1 - v.w; const q = ((this.T() * v.spd + v.ph) % 2 + 2) % 2; return (q < 1 ? q : 2 - q) * span; },
  drop() { if (!this.v.me || this.sentAt === this.v.h + ':' + this.v.T) return; this.sentAt = this.v.h + ':' + this.v.T; this.lastX = this.xNow(); this.api.send({ a: 'drop', ts: Math.round(this.api.now()) }); vibrate(15); },
  update(v) {
    this.v = v;
    this.hd.textContent = v.me ? `🏗 내 차례! ${Math.ceil(v.left)}초 안에 탭` : `🏗 ${v.holder || '...'} 차례`;
    this.hd.classList.toggle('go', !!v.me); this.btn.disabled = !v.me; this.btn.textContent = v.me ? '⬇ 지금 떨어뜨리기!' : '⏳ 친구 차례 (기다려요)';
    this.wait.textContent = v.me ? '움직이는 블록이 아래 탑과 딱 겹칠 때!' : v.wait === 1 ? '⚡ 다음이 내 차례! 준비!' : `내 차례까지 ${v.wait}명`;
    this.me.textContent = `우리 탑 ${v.h}층 · 내 성공 ${v.good}/${v.drops}`;
  },
  draw() {
    const [W, H, d] = fit(this.cv); const c = this.cv.getContext('2d'); const v = this.v; if (!v) return;
    c.fillStyle = '#121a3a'; c.fillRect(0, 0, W, H);
    const bh = H * 0.1; const baseY = H - bh * 0.6; const show = 5; const col = this.api.team.color;
    c.fillStyle = '#ffffff22'; c.fillRect(0, baseY, W, H - baseY);
    const stack = (v.stack || []).slice(-show); stack.forEach(([bx, bw], i) => { const y = baseY - (i + 1) * bh; c.fillStyle = i === stack.length - 1 ? col : col + 'aa'; c.fillRect(bx * W, y, bw * W, bh - 3 * d); });
    const topY = baseY - (stack.length + 1) * bh - bh * 0.8;
    c.strokeStyle = '#ffffff66'; c.setLineDash([6 * d, 6 * d]); c.strokeRect(v.x * W, topY + bh * 0.8 + bh, v.w * W, bh - 3 * d); c.setLineDash([]);
    if (v.me) { const x = this.xNow(); c.fillStyle = '#ffd43b'; c.fillRect(x * W, topY, v.w * W, bh - 3 * d); c.fillStyle = '#111'; c.font = `900 ${14 * d}px sans-serif`; c.textAlign = 'center'; c.fillText('⬇', (x + v.w / 2) * W, topY + bh * 0.62); }
    c.fillStyle = '#fff'; c.font = `900 ${20 * d}px sans-serif`; c.textAlign = 'left'; c.fillText(`${v.h}층`, 10 * d, 26 * d);
  },
  reply(r) { if (r.turn) { sfx('count', this.api.sfxOn); vibrate([60, 30, 60]); } if (r.perfect) sfx('fanfare', this.api.sfxOn); else if (r.ok) sfx('good', this.api.sfxOn); else if (r.miss) sfx('bad', this.api.sfxOn); },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

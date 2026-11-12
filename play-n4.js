// 새 경쟁 게임 3종 참가자 폰 화면: 줄다리기 · 멀리뛰기 · 볼링
// 누르는 곳은 크게, 화면 위쪽엔 지금 상황(우리 팀·내 기록)만 짧게. 모든 입력은 pointerdown 한 번 = 한 번
import { h, sfx, vibrate } from './client.js';
import { G } from './play-games.js';
import { bowlRoll, PINS, BALL_R, PIN_R } from './bowl.js';

const press = (el, fn) => { el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(e); }, { passive: false }); el.addEventListener('contextmenu', (e) => e.preventDefault()); return el; };
const loop = (self, fn) => { const f = () => { if (self.dead) return; try { fn(); } catch (e) { console.error(e); } self.raf = requestAnimationFrame(f); }; self.raf = requestAnimationFrame(f); };
function fit(cv) { const r = cv.getBoundingClientRect(); const d = Math.min(2, devicePixelRatio || 1); const w = Math.max(1, Math.round(r.width * d)), hh = Math.max(1, Math.round(r.height * d)); if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; } return [w, hh, d]; }
const rr = (c, x, y, w, hh, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, hh, r); else c.rect(x, y, w, hh); };

// ---------------- 줄다리기
G.tug = {
  mount(root, v, api) {
    this.api = api; this.pend = 0; this.flash = 0;
    this.hd = h('div', { class: 'n9hd' }); this.cv = h('canvas', { class: 'n9cv tugcv' });
    this.btn = h('button', { class: 'n9btn tugbtn', style: { '--tc': api.team.color } }, '💪 영차!'); this.info = h('div', { class: 'n9info' });
    press(this.btn, () => { this.pend++; this.flash = performance.now(); vibrate(4); });
    root.append(h('div', { class: 'gwrap n9w', style: { '--tc': api.team.color } }, this.hd, this.cv, this.btn, this.info));
    this.iv = setInterval(() => { if (this.pend) { const n = Math.min(8, this.pend); this.pend -= n; this.api.send({ a: 'pull', n }); } }, 120);
    this.kx = v.k || 0; this.update(v); loop(this, () => this.draw());
  },
  update(v) {
    const was = this.v?.pause; this.v = v;
    if (v.pause && !was) { if (v.pause === 'win') { sfx('win', this.api.sfxOn); vibrate([60, 40, 60]); } else sfx('tick', this.api.sfxOn); }
    this.hd.textContent = v.pause === 'win' ? '🎉 우리 팀이 끌어왔어요! 1승 추가' : v.pause === 'lose' ? '😮 다른 팀이 이겼어요 · 다시 시작!' : `🪢 ${v.round}판 · 우리 팀 ${v.wins}승 · ${v.rank}위/${v.n}팀`;
    this.hd.classList.toggle('go', v.pause === 'win');
    this.info.textContent = `우리 팀 1인당 ${v.rate}번/초 · 내 영차 ${v.mine}번`;
  },
  draw() {
    const v = this.v; const c = this.cv.getContext('2d'); const [W, H] = fit(this.cv); const col = this.api.team.color;
    this.kx += ((v.k || 0) - this.kx) * 0.15; const k = Math.max(-1.05, Math.min(1.05, this.kx));
    // 운동장 + 가운데선 + 양쪽 승리선 (왼쪽 = 우리 팀 쪽)
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b6b3a'); g.addColorStop(1, '#1d4a29'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff08' : '#00000010'; c.fillRect((i * W) / 8, 0, W / 8, H); }
    const cx = W / 2, cy = H * 0.55, span = W * 0.36;
    c.strokeStyle = '#ffffffaa'; c.lineWidth = 3 * (W / 400); c.setLineDash([10, 8]); c.beginPath(); c.moveTo(cx, H * 0.18); c.lineTo(cx, H * 0.92); c.stroke(); c.setLineDash([]);
    for (const [x, cc] of [[cx - span, col], [cx + span, '#ffffff']]) { c.strokeStyle = cc; c.lineWidth = 5 * (W / 400); c.beginPath(); c.moveTo(x, H * 0.22); c.lineTo(x, H * 0.88); c.stroke(); }
    // 밧줄 (조금 흔들림) + 매듭 리본
    const t = performance.now() / 1000; const kx = cx - k * span; const wob = (x) => Math.sin(x * 0.03 + t * 9) * (performance.now() - this.flash < 150 ? 4 : 1.5);
    c.strokeStyle = '#c99a5b'; c.lineWidth = 12 * (W / 400); c.lineCap = 'round'; c.beginPath(); for (let x = 0; x <= W; x += 8) { const y = cy + wob(x); x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    c.strokeStyle = '#8a6434'; c.lineWidth = 2; for (let x = 0; x < W; x += 16) { c.beginPath(); c.moveTo(x, cy - 5 + wob(x)); c.lineTo(x + 8, cy + 5 + wob(x)); c.stroke(); }
    c.fillStyle = '#ff4d6d'; c.beginPath(); c.moveTo(kx, cy - 6); c.lineTo(kx - 16 * (W / 400), cy - 34 * (W / 400)); c.lineTo(kx + 16 * (W / 400), cy - 34 * (W / 400)); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(kx, cy, 9 * (W / 400), 0, 7); c.fill();
    // 양쪽 사람 (우리 팀 색 · 상대)
    const fs = Math.round(H * 0.16); c.font = `${fs}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const lean = (performance.now() - this.flash < 160 ? 0.25 : 0.12);
    for (let i = 0; i < 3; i++) { c.save(); c.translate(W * (0.06 + i * 0.1), cy - fs * 0.25); c.rotate(-lean); c.fillText('🧍', 0, 0); c.restore(); c.save(); c.translate(W * (0.94 - i * 0.1), cy - fs * 0.25); c.rotate(lean); c.scale(-1, 1); c.fillText('🧍', 0, 0); c.restore(); }
    c.font = `900 ${Math.round(Math.min(H * 0.06, W * 0.055))}px sans-serif`; c.fillStyle = col; c.fillText('◀ 우리 팀', W * 0.22, H * 0.1); c.fillStyle = '#ffffffcc'; c.fillText('상대 ▶', W * 0.8, H * 0.1);
    const p = Math.max(0, Math.min(1, (k + 1) / 2)); c.fillStyle = '#00000055'; rr(c, W * 0.1, H * 0.93, W * 0.8, H * 0.045, 6); c.fill(); c.fillStyle = col; rr(c, W * 0.1, H * 0.93, W * 0.8 * p, H * 0.045, 6); c.fill();
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); clearInterval(this.iv); },
};

// ---------------- 멀리뛰기: 달리기(연타) → 발구르기(선 앞에서 콕) → 각도(45° 근처에서 콕)
const LJ_RATE = [3, 4, 5, 6, 6.5, 7]; // 연령별 '빠른 연타' 기준 (초당)
G.ljump = {
  mount(root, v, api) {
    this.api = api; this.st = 'ready'; this.anim = null;
    this.hd = h('div', { class: 'n9hd' }); this.cv = h('canvas', { class: 'n9cv ljcv' });
    this.btn = h('button', { class: 'n9btn', style: { '--tc': api.team.color } }); this.info = h('div', { class: 'n9info' });
    press(this.btn, () => this.tap()); press(this.cv, () => this.tap());
    root.append(h('div', { class: 'gwrap n9w', style: { '--tc': api.team.color } }, this.hd, this.cv, this.btn, this.info));
    this.update(v); loop(this, () => this.draw());
  },
  rate() { return LJ_RATE[Math.max(0, Math.min(5, this.v.lv ?? 2))]; },
  tap() {
    const now = performance.now(); const v = this.v;
    if (this.st === 'ready') { if (v.tries.length >= v.max || this.anim) return; this.st = 'run'; this.t0 = now; this.taps = 1; vibrate(5); }
    else if (this.st === 'run') { this.taps++; vibrate(3); }
    else if (this.st === 'board') { this.bd = 1 - this.bx(now); this.st = 'angle'; this.t0 = now; sfx('tap', this.api.sfxOn); vibrate(12); }
    else if (this.st === 'angle') this.jump(this.ang(now));
    this.paint();
  },
  spd() { return Math.min(1, this.taps / (2.5 * this.rate())); },
  bdur() { return 1.7 - this.spdV * 0.6; },
  bx(now) { return ((now - this.t0) / 1000 / this.bdur()) * 1.25; }, // 0 → 1.25 (1 = 발구르기 선)
  ang(now) { return 45 + 45 * Math.sin(((now - this.t0) / 1000) * Math.PI * 1.4 - Math.PI / 2); },
  jump(ang) {
    const bd = Math.max(-1, Math.min(1, this.bd)); this.st = 'fly';
    this.anim = { at: performance.now(), spd: this.spdV, bd, ang, d: null };
    const mine = this.anim; setTimeout(() => { if (this.anim === mine && mine.d == null) { this.anim = null; this.st = 'ready'; this.paint(); } }, 4000); // 답이 안 오면(늦은 입장·끊김) 다시 시도할 수 있게
    this.api.send({ a: 'jump', i: this.v.tries.length, spd: Math.round(this.spdV * 1000) / 1000, bd: Math.round(bd * 1000) / 1000, ang: Math.round(ang * 10) / 10 }); vibrate(20);
  },
  reply(r) { if (r.d == null) return; if (this.anim) this.anim.d = r.d; this.anim && (this.anim.foul = r.foul); sfx(r.foul ? 'tick' : 'win', this.api.sfxOn); setTimeout(() => { this.anim = null; this.st = 'ready'; this.paint(); }, 2200); },
  update(v) { this.v = v; this.paint(); },
  paint() {
    const v = this.v; const left = v.max - v.tries.length;
    const lab = { ready: left ? `🏃 ${v.tries.length + 1}번째 시작! (콕)` : '✅ 3번 다 뛰었어요', run: '👟 콕콕콕 빨리!', board: '🦶 선 앞에서 점프!', angle: '📐 45° 근처에서 콕!', fly: '🦘 날아가요!' }[this.st];
    this.btn.textContent = lab; this.btn.disabled = this.st === 'fly' || (this.st === 'ready' && !left);
    this.hd.textContent = `🦘 최고 ${v.best != null ? `${v.best.toFixed(2)}m` : '-'} · 남은 기회 ${left}번`;
    this.info.textContent = v.tries.map((d, i) => `${i + 1}차 ${d ? `${d.toFixed(2)}m` : '파울'}`).join(' · ') || '연타 → 선 앞에서 점프 → 각도 콕';
  },
  draw() {
    const c = this.cv.getContext('2d'); const [W, H] = fit(this.cv); const now = performance.now(); const col = this.api.team.color;
    if (this.st === 'run' && (now - this.t0) / 1000 >= 2.5) { this.spdV = this.spd(); this.st = 'board'; this.t0 = now; this.paint(); }
    if (this.st === 'board' && this.bx(now) >= 1.25) { this.bd = -0.25; this.st = 'angle'; this.t0 = now; this.paint(); }
    if (this.st === 'angle' && now - this.t0 > 3000) this.jump(this.ang(now));
    // 하늘·관중석·트랙·모래판
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a6fb0'); g.addColorStop(0.45, '#8fc2ef'); g.addColorStop(0.46, '#4a3a6a'); g.addColorStop(0.58, '#5b4a7e'); g.addColorStop(0.59, '#c45c43'); g.addColorStop(1, '#9e4632'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 10) { c.fillStyle = `hsla(${(x * 13) % 360},60%,65%,.6)`; c.fillRect(x, H * 0.48 + ((x * 7) % 9), 4, 4); }
    const gy = H * 0.78, lineX = W * 0.42, pitX = W * 0.46; c.fillStyle = '#e6c88a'; c.fillRect(pitX, gy - 4, W - pitX, H - gy + 4);
    c.fillStyle = '#fff'; c.fillRect(lineX - 3, gy - 6, 6, H - gy + 6); // 발구르기 선
    for (let m = 1; m <= 9; m++) { const x = pitX + (W - pitX) * (m / 9.5); c.fillStyle = '#00000044'; c.fillRect(x, gy, 2, 10); if (m % 2) continue; c.fillStyle = '#00000099'; c.font = `800 ${Math.round(Math.min(H * 0.04, W * 0.035))}px sans-serif`; c.textAlign = 'center'; c.fillText(`${m}m`, x, gy + H * 0.08); }
    const mX = (d) => pitX + (W - pitX) * (d / 9.5);
    for (const d of this.v.tries) if (d) { c.fillStyle = '#ffffffaa'; c.beginPath(); c.arc(mX(d), gy + 6, 5, 0, 7); c.fill(); }
    // 사람 위치
    let px = W * 0.08, py = gy, fs = H * 0.14;
    if (this.st === 'run') px = W * 0.08 + ((now - this.t0) / 2500) * W * 0.14 * (0.3 + this.spd());
    if (this.st === 'board' || this.st === 'angle') px = W * 0.22 + Math.min(1.25, this.st === 'board' ? this.bx(now) : 1 - this.bd) * (lineX - W * 0.22);
    if (this.anim) { const a = this.anim; const k = Math.min(1, (now - a.at) / 1100); const x0 = W * 0.22 + (1 - a.bd) * (lineX - W * 0.22); const d = a.d ?? 3; const x1 = a.bd < 0 ? x0 + W * 0.05 : mX(d); px = x0 + (x1 - x0) * k; py = gy - Math.sin(k * Math.PI) * H * 0.35 * (a.ang / 60); if (a.d != null && k >= 1) { c.fillStyle = '#00000066'; rr(c, W * 0.3, H * 0.12, W * 0.4, H * 0.16, 12); c.fill(); c.fillStyle = a.foul ? '#ff8a8a' : '#ffd43b'; c.font = `900 ${Math.round(H * 0.1)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(a.foul ? '파울!' : `${a.d.toFixed(2)}m`, W * 0.5, H * 0.2); } }
    c.font = `${Math.round(fs)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.save(); c.translate(px, py); c.scale(-1, 1); c.fillText(this.anim ? '🤸' : '🏃', 0, 0); c.restore();
    // 단계별 게이지
    c.textBaseline = 'middle';
    if (this.st === 'run') { const k = this.spd(); c.fillStyle = '#00000066'; rr(c, W * 0.08, H * 0.08, W * 0.84, H * 0.07, 10); c.fill(); c.fillStyle = k > 0.85 ? '#ffd43b' : col; rr(c, W * 0.08, H * 0.08, W * 0.84 * k, H * 0.07, 10); c.fill(); c.fillStyle = '#fff'; c.font = `900 ${Math.round(H * 0.05)}px sans-serif`; c.textAlign = 'center'; c.fillText(`속도 ${Math.round(k * 100)}% · ${Math.max(0, 2.5 - (now - this.t0) / 1000).toFixed(1)}초`, W / 2, H * 0.115); }
    if (this.st === 'angle') { const a = this.ang(now); const cx = W * 0.5, cy = H * 0.42, r = H * 0.22; c.strokeStyle = '#ffffff55'; c.lineWidth = 10; c.beginPath(); c.arc(cx, cy, r, Math.PI, Math.PI * 1.5); c.stroke(); c.strokeStyle = '#ffd43b'; c.beginPath(); c.arc(cx, cy, r, Math.PI * 1.17, Math.PI * 1.33); c.stroke(); const rad = Math.PI + (a * Math.PI) / 180; c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r); c.stroke(); c.fillStyle = '#fff'; c.font = `900 ${Math.round(H * 0.06)}px sans-serif`; c.textAlign = 'center'; c.fillText(`${Math.round(a)}°`, cx, cy + H * 0.06); }
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

// ---------------- 볼링: 레인 아래쪽에서 위로 쓱 (출발 위치 = 손가락 가로 위치 · 방향 · 세기)
G.bowl = {
  mount(root, v, api) {
    this.api = api; this.roll = null; this.drag = null; this.fall = {};
    this.hd = h('div', { class: 'n9hd' }); this.cv = h('canvas', { class: 'n9cv bowlcv' }); this.info = h('div', { class: 'n9info' });
    root.append(h('div', { class: 'gwrap n9w', style: { '--tc': api.team.color } }, this.hd, this.cv, this.info));
    const pos = (e) => { const r = this.cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, performance.now()]; };
    this.cv.addEventListener('pointerdown', (e) => { e.preventDefault(); if (this.roll) return; const p = pos(e); if (p[1] < 0.55) return; this.drag = { s: p, pts: [p] }; try { this.cv.setPointerCapture(e.pointerId); } catch { /* */ } }, { passive: false });
    this.cv.addEventListener('pointermove', (e) => { if (!this.drag) return; const p = pos(e); this.drag.pts.push(p); if (this.drag.pts.length > 8) this.drag.pts.shift(); this.drag.cur = p; });
    const up = (e) => { if (!this.drag) return; const d = this.drag; this.drag = null; const p = pos(e); const a = d.pts[0]; const dy = a[1] - p[1], dx = p[0] - a[0]; const dt = Math.max(16, p[2] - a[2]); if (dy < 0.08) return; const sp = Math.hypot(dx, dy) / dt; this.go(d.s[0], Math.atan2(dx * 0.45, dy), sp); };
    this.cv.addEventListener('pointerup', up); this.cv.addEventListener('pointercancel', () => { this.drag = null; });
    this.cv.addEventListener('contextmenu', (e) => e.preventDefault());
    this.update(v); loop(this, () => this.draw());
  },
  go(sx, ang, sp) {
    const v = this.v; const x = Math.max(-0.95, Math.min(0.95, (sx - 0.5) * 2.2)); ang = Math.max(-0.3, Math.min(0.3, ang)); const pow = Math.max(0.2, Math.min(1, sp / 0.0028));
    const res = bowlRoll(v.stand, x, ang, pow); this.roll = { at: performance.now(), x, ang, pow, res, stand: v.stand.slice() };
    const mine = this.roll; setTimeout(() => { if (this.roll === mine && !mine.srv) { this.roll = null; this.paint(); } }, 4000);
    this.api.send({ a: 'roll', f: v.f, r: v.r, x: Math.round(x * 1000) / 1000, ang: Math.round(ang * 1000) / 1000, pow: Math.round(pow * 1000) / 1000 }); vibrate(15); sfx('tap', this.api.sfxOn);
  },
  reply(r) { if (!this.roll) return; this.roll.srv = r; setTimeout(() => { if (r.mark === 'X') { sfx('win', this.api.sfxOn); vibrate([60, 40, 120]); } else if (r.mark === '/') sfx('win', this.api.sfxOn); }, 900); setTimeout(() => { this.roll = null; this.paint(); }, 2300); },
  update(v) { this.v = v; if (!this.roll) this.paint(); },
  paint() { const v = this.v; this.hd.textContent = `🎳 ${v.f}프레임 ${v.r ? '2구째' : '1구째'} · 합계 ${v.total}점`; this.info.textContent = `스트라이크 ${v.st} · 스페어 ${v.sp} · 공을 잡고 위로 쓱!`; },
  draw() {
    const c = this.cv.getContext('2d'); const [W, H] = fit(this.cv); const now = performance.now(); const col = this.api.team.color;
    // 레인: 위에서 내려다봄 (y 0 = 아래쪽 파울선, 10 = 위쪽 끝) · 원근감을 살짝 줌
    c.fillStyle = '#1a1d33'; c.fillRect(0, 0, W, H);
    const top = H * 0.04, bot = H * 0.97; const wB = W * 0.84, wT = W * 0.46;
    const Y = (y) => bot - ((bot - top) * y) / 10.4; const half = (y) => (wB + (wT - wB) * (y / 10.4)) / 2; const X = (x, y) => W / 2 + x * half(y);
    // 도랑
    c.fillStyle = '#2c3150'; c.beginPath(); c.moveTo(W / 2 - half(0) - W * 0.06, bot); c.lineTo(W / 2 - half(10.4) - W * 0.04, top); c.lineTo(W / 2 + half(10.4) + W * 0.04, top); c.lineTo(W / 2 + half(0) + W * 0.06, bot); c.fill();
    const lg = c.createLinearGradient(0, top, 0, bot); lg.addColorStop(0, '#c99b62'); lg.addColorStop(1, '#e8bf86'); c.fillStyle = lg; c.beginPath(); c.moveTo(X(-1, 0), bot); c.lineTo(X(-1, 10.4), top); c.lineTo(X(1, 10.4), top); c.lineTo(X(1, 0), bot); c.fill();
    c.strokeStyle = '#b58650'; c.lineWidth = 1; for (let i = -9; i <= 9; i += 2) { c.beginPath(); c.moveTo(X(i / 10, 0), bot); c.lineTo(X(i / 10, 10.4), top); c.stroke(); }
    c.fillStyle = '#7a4a1e'; for (let i = -3; i <= 3; i++) { const y = 3.2; const x = X(i * 0.25, y), yy = Y(y); c.beginPath(); c.moveTo(x, yy - H * 0.018); c.lineTo(x - W * 0.012, yy + H * 0.008); c.lineTo(x + W * 0.012, yy + H * 0.008); c.fill(); }
    c.fillStyle = '#ffffffcc'; c.fillRect(X(-1, 0), Y(0.9) - 1, half(0.9) * 2, 2);
    // 핀
    const roll = this.roll; const k = roll ? Math.min(1, (now - roll.at) / 1100) : 0;
    const standing = roll ? roll.stand : this.v.stand; const downSet = roll ? new Set(roll.res.down) : new Set();
    const ballY = roll ? Math.min(roll.res.path[1][1], 10.2) * k : 0;
    for (const i of standing) {
      const [px, py] = PINS[i]; let x = px, y = py, a = 1, rot = 0;
      if (downSet.has(i) && ballY >= py - 0.25) { const mv = roll.res.moves[i] || [0, 0.6]; const q = Math.min(1, (ballY - (py - 0.25)) / 1.5 + (k >= 1 ? (now - roll.at - 1100) / 600 : 0)); x += mv[0] * q; y += mv[1] * q; a = 1 - q * 0.75; rot = q * 1.6 * Math.sign(mv[0] || 1); }
      const sx = X(x, y), sy = Y(y), r = half(y) * PIN_R * 1.5; c.globalAlpha = Math.max(0.1, a); c.save(); c.translate(sx, sy); c.rotate(rot); c.fillStyle = '#00000044'; c.beginPath(); c.ellipse(2, 3, r, r * 0.8, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.strokeStyle = '#e03131'; c.lineWidth = r * 0.35; c.beginPath(); c.arc(0, 0, r * 0.62, 0, 7); c.stroke(); c.restore(); c.globalAlpha = 1;
    }
    // 공 (굴러가는 중 / 잡기 전)
    let bx = 0, by = 0.3; if (roll) { const [[x0], [x1, y1]] = roll.res.path; by = 0.3 + (y1 - 0.3) * k; bx = x0 + (x1 - x0) * (by / y1); } else if (this.drag?.cur) bx = Math.max(-0.95, Math.min(0.95, (this.drag.s[0] - 0.5) * 2.2));
    if (!(roll && k >= 1)) { const sx = X(bx, by), sy = Y(by), r = half(by) * BALL_R * 1.25; c.fillStyle = col; c.beginPath(); c.arc(sx, sy, r, 0, 7); c.fill(); c.fillStyle = '#ffffff55'; c.beginPath(); c.arc(sx - r * 0.3, sy - r * 0.35, r * 0.35, 0, 7); c.fill(); c.fillStyle = '#111a'; for (const [dx, dy] of [[0.15, 0.1], [0.35, -0.05], [0.3, 0.3]]) { c.beginPath(); c.arc(sx + dx * r, sy + dy * r, r * 0.1, 0, 7); c.fill(); } }
    // 조준선 (끄는 중)
    if (this.drag?.cur) { const a = this.drag.s, p = this.drag.cur; c.strokeStyle = '#ffd43b'; c.setLineDash([8, 8]); c.lineWidth = 3; c.beginPath(); c.moveTo(a[0] * W, a[1] * H); c.lineTo(p[0] * W, p[1] * H); c.stroke(); c.setLineDash([]); }
    if (!roll && !this.drag) { c.fillStyle = '#ffffffcc'; c.font = `800 ${Math.round(H * 0.035)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('⬆ 공 근처에서 위로 쓱 (빠를수록 세게)', W / 2, H * 0.62 + Math.sin(now / 300) * 4); }
    // 결과 글자
    if (roll?.srv && k >= 1) { const r = roll.srv; const txt = r.mark === 'X' ? 'STRIKE!' : r.mark === '/' ? 'SPARE!' : r.n ? `${r.n}개` : roll.res.gutter ? '도랑…' : '0개'; c.fillStyle = '#000000aa'; rr(c, W * 0.18, H * 0.38, W * 0.64, H * 0.13, 14); c.fill(); c.fillStyle = r.mark ? '#ffd43b' : '#fff'; c.font = `900 ${Math.round(H * 0.08)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, W / 2, H * 0.445); }
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

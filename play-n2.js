// 2·3차 게임 참가자 폰 화면 (G에 등록)
import { h, sfx, vibrate } from './client.js';
import { G } from './play-games.js';
import { rng } from './gen.js';
import { spotPuzzle, rhythmChart, BURGER } from './gen2.js';
import { M, motionChip } from './play-motion.js';

const P = { press: (el, fn) => { el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(e); }, { passive: false }); el.addEventListener('contextmenu', (e) => e.preventDefault()); return el; } };
function fit(cv) { const r = cv.getBoundingClientRect(); const d = Math.min(2, devicePixelRatio || 1); const w = Math.max(1, Math.round(r.width * d)), hh = Math.max(1, Math.round(r.height * d)); if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; } return { W: w, H: hh, d }; }
const lf = (api, until) => Math.max(0, Math.ceil((until - api.now()) / 1000));
const rr = (c, x, y, w, hh, r) => { c.beginPath(); c.roundRect(x, y, w, hh, r); };

// ---------------------------------------------------------------- 손맛 게임 공용 틀
// game: { init(S), step(S, dt), draw(S, c, W, H, d), down(S, x, y), up(S, x, y), move(S, x, y) }  x,y는 0~1
function skillUI(g, opts = {}) {
  return {
    mount(root, v, api) {
      const S = this.S = { api, v, score: v.v || 0, sent: v.v || 0, r: rng(v.seed + 17), lv: v.lv, msg: null, msgAt: 0, t: 0, hi: 0 };
      S.add = (n, hi, text) => { S.score = Math.max(0, S.score + n); if (text) { S.msg = text; S.msgAt = performance.now(); } if (hi) S.hi = hi; };
      S.say = (text) => { S.msg = text; S.msgAt = performance.now(); };
      this.cv = h('canvas', { class: 'skcv' });
      this.sc = h('div', { class: 'sksc' }, '0');
      this.rk = h('div', { class: 'skrk' });
      const box = h('div', { class: `skw sk-${opts.cls || ''}` }, this.cv, this.sc, this.rk);
      const pos = (e) => { const r = this.cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
      let down = false;
      box.addEventListener('pointerdown', (e) => { e.preventDefault(); down = true; box.setPointerCapture?.(e.pointerId); g.down?.(S, ...pos(e)); });
      box.addEventListener('pointermove', (e) => { if (down) g.move?.(S, ...pos(e)); });
      const up = (e) => { if (!down) return; down = false; g.up?.(S, ...pos(e)); };
      box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
      const extra = opts.buttons ? opts.buttons(S, g) : null;
      const chip = opts.motion ? motionChip(api, opts.motion) : null;
      root.append(h('div', { class: 'gwrap skg' }, chip, box, extra));
      this.unsub = M.sub((ev) => { if (M.on && g.motion && this.S.v.t0 && api.now() >= this.S.v.t0) g.motion(S, ev); });
      g.init(S);
      let last = performance.now();
      const loop = () => {
        if (this.dead) return; const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (this.S.v.t0 && api.now() >= this.S.v.t0) { S.t += dt; if (M.on && g.tilt) g.tilt(S, M.tilt()); g.step(S, dt); }
        const { W, H, d } = fit(this.cv); const c = this.cv.getContext('2d'); c.clearRect(0, 0, W, H); g.draw(S, c, W, H, d);
        if (S.msg && now - S.msgAt < 900) { c.globalAlpha = 1 - (now - S.msgAt) / 900; c.fillStyle = '#fff'; c.font = `900 ${26 * d}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = '#000'; c.shadowBlur = 8 * d; c.fillText(S.msg, W / 2, H * 0.32 - ((now - S.msgAt) / 900) * 30 * d); c.shadowBlur = 0; c.globalAlpha = 1; }
        this.sc.textContent = `${S.score}${opts.unit || ''}`;
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
      this.iv = setInterval(() => { if (S.score !== S.sent || S.hi) { api.send({ a: 'sc', v: S.score, ...(S.hi ? { x: S.hi } : {}) }); S.sent = S.score; S.hi = 0; } }, 300);
      this.update(v);
    },
    update(v) { this.S.v = v; this.rk.textContent = v.rank ? `우리 팀 ${v.rank}위 / ${v.n}` : ''; },
    reply() {},
    unmount() { this.dead = true; this.unsub?.(); cancelAnimationFrame(this.raf); clearInterval(this.iv); if (this.S.score !== this.S.sent) this.S.api.send({ a: 'sc', v: this.S.score }); },
  };
}
const bg = (c, W, H, a, b) => { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, W, H); };

// ---------------- 달고나 뽑기
const SHAPES = [
  (t) => [Math.cos(t * 2 * Math.PI), Math.sin(t * 2 * Math.PI)],
  (t) => { const k = t * 3; const i = Math.floor(k) % 3; const f = k - Math.floor(k); const a = (i / 3) * 2 * Math.PI - Math.PI / 2, b = ((i + 1) / 3) * 2 * Math.PI - Math.PI / 2; return [Math.cos(a) + (Math.cos(b) - Math.cos(a)) * f, Math.sin(a) + (Math.sin(b) - Math.sin(a)) * f]; },
  (t) => { const k = t * 4; const i = Math.floor(k) % 4; const f = k - Math.floor(k); const C = [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]; const a = C[i], b = C[(i + 1) % 4]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; },
  (t) => { const a = t * 2 * Math.PI - Math.PI / 2; const r = 0.62 + 0.38 * Math.cos(a * 5 + Math.PI / 2 + Math.PI); return [r * Math.cos(a), r * Math.sin(a)]; },
];
G.dalgona = skillUI({
  init(S) { S.k = 0; this.newCookie(S); },
  newCookie(S) { S.shape = Math.min(SHAPES.length - 1, Math.floor(S.k / 2) + (S.lv >= 3 ? 1 : 0)); S.pts = Array.from({ length: 120 }, (_, i) => SHAPES[S.shape](i / 120)); S.cov = new Array(120).fill(false); S.err = []; S.crack = 0; S.done = 0; },
  step(S) { if (S.done && performance.now() - S.done > 900) { S.k++; this.newCookie(S); } },
  toPath(S, x, y) { const R = 0.36; const cx = 0.5, cy = 0.5; const ar = S.W && S.H ? S.W / S.H : 0.75; return [(x - cx) / R, (y - cy) / (R * ar)]; },
  move(S, x, y) {
    if (S.done) return; const [px, py] = this.toPath(S, x, y); let best = 9, bi = 0;
    for (let i = 0; i < S.pts.length; i++) { const d = Math.hypot(S.pts[i][0] - px, S.pts[i][1] - py); if (d < best) { best = d; bi = i; } }
    const tol = [0.2, 0.17, 0.13, 0.11, 0.1, 0.1][S.lv];
    if (best > tol * 2.3) { S.crack++; vibrate(60); if (S.crack >= 3) { S.say('💥 쩍! 금이 갔어요'); sfx('bad', S.api.sfxOn); S.done = performance.now(); } return; }
    S.err.push(best); for (let j = -3; j <= 3; j++) S.cov[(bi + j + 120) % 120] = true;
    if (S.cov.filter(Boolean).length >= 112) { const m = S.err.reduce((a, b) => a + b, 0) / S.err.length; const q = Math.max(0.2, 1 - m / tol); const s = Math.round(10 + 30 * q); S.add(s, q > 0.8 ? 1 : 0, q > 0.8 ? `완벽! +${s}` : `+${s}`); sfx('win', S.api.sfxOn); S.done = performance.now(); }
  },
  down(S, x, y) { this.move(S, x, y); },
  draw(S, c, W, H, d) {
    S.W = W; S.H = H; bg(c, W, H, '#2b1d14', '#120c08');
    const cx = W * 0.5, cy = H * 0.5, R = W * 0.36;
    const g = c.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R * 1.35); g.addColorStop(0, '#f2c46d'); g.addColorStop(1, '#b8792c'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R * 1.32, 0, 7); c.fill();
    c.setLineDash([6 * d, 6 * d]); c.strokeStyle = '#7a4a17'; c.lineWidth = 3 * d; c.beginPath(); S.pts.forEach((p, i) => { const X = cx + p[0] * R, Y = cy + p[1] * R; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#fff6d8'; c.lineWidth = 6 * d; c.lineCap = 'round';
    for (let i = 0; i < 120; i++) if (S.cov[i] && S.cov[(i + 1) % 120]) { const a = S.pts[i], b = S.pts[(i + 1) % 120]; c.beginPath(); c.moveTo(cx + a[0] * R, cy + a[1] * R); c.lineTo(cx + b[0] * R, cy + b[1] * R); c.stroke(); }
    for (let i = 0; i < S.crack; i++) { c.strokeStyle = '#3a1f08'; c.lineWidth = 2 * d; c.beginPath(); c.moveTo(cx + (i - 1) * 30 * d, cy - R); c.lineTo(cx + (i - 1) * 40 * d + 10, cy - R * 0.4); c.stroke(); }
    c.fillStyle = '#ffffffaa'; c.font = `${14 * d}px sans-serif`; c.textAlign = 'center'; c.fillText(`${S.k + 1}번째 달고나 · 금 ${S.crack}/3`, cx, H - 16 * d);
  },
}, { cls: 'tall', unit: '점' });

// ---------------- 투호 / 버저비터 (위로 밀어 던지기)
function throwGame(kind) {
  return skillUI({
    init(S) { S.obj = null; S.cool = 0; S.wind = 0; S.newWind = () => { S.wind = kind === 'tuho' && S.lv >= 2 ? (S.r() - 0.5) * 0.5 : 0; }; S.newWind(); },
    target(S) { const sp = [0.25, 0.35, 0.5, 0.6, 0.65, 0.7][S.lv]; return 0.5 + Math.sin(S.t * sp * 2) * 0.32; },
    motion(S, ev) { if (ev.type !== 'swing' || S.obj || S.cool > 0) return; S.obj = { x: 0.5, y: 0.92, vx: ev.tx * 0.55, vy: 1.15 + ev.power * 1.35, t: 0 }; vibrate(15); sfx('pass', S.api.sfxOn); },
    down(S, x, y) { S.st = [x, y, performance.now()]; },
    up(S, x, y) {
      if (!S.st || S.obj || S.cool > 0) return; const [x0, y0, t0] = S.st; const dt = Math.max(60, performance.now() - t0) / 1000;
      const vy = (y0 - y) / dt; if (vy < 0.6) return; const vx = (x - x0) / dt;
      S.obj = { x: 0.5, y: 0.92, vx: vx * 0.35, vy: Math.min(2.6, vy * 0.9), t: 0 }; vibrate(10); sfx('pass', S.api.sfxOn);
    },
    step(S, dt) {
      S.cool = Math.max(0, S.cool - dt);
      const o = S.obj; if (!o) return; o.t += dt; o.x += (o.vx + S.wind) * dt; o.y -= o.vy * dt;
      const ty = kind === 'tuho' ? 0.2 : 0.18;
      if (o.y <= ty) {
        const tx = this.target(S); const dd = Math.abs(o.x - tx); const rim = kind === 'tuho' ? 0.075 : 0.085;
        if (dd < rim) { const clean = dd < rim * 0.35; const pts = kind === 'tuho' ? (clean ? 15 : 10) : (clean ? 3 : 2); S.add(pts, clean ? 1 : 0, clean ? (kind === 'tuho' ? '정중앙! +15' : '클린슛! +3') : `+${pts}`); sfx('good', S.api.sfxOn); vibrate([30, 30, 30]); S.flash = performance.now(); }
        else { S.say('아깝다!'); }
        S.obj = null; S.cool = 0.35; S.newWind();
      }
    },
    draw(S, c, W, H, d) {
      if (kind === 'tuho') bg(c, W, H, '#20304f', '#0d1426'); else bg(c, W, H, '#3b2416', '#160d07');
      if (kind !== 'tuho') { c.strokeStyle = '#ffffff22'; c.lineWidth = 2 * d; c.beginPath(); c.arc(W / 2, H, W * 0.45, Math.PI, 0); c.stroke(); }
      const tx = this.target(S) * W, ty = (kind === 'tuho' ? 0.2 : 0.18) * H;
      if (kind === 'tuho') {
        const g = c.createLinearGradient(tx - 40 * d, 0, tx + 40 * d, 0); g.addColorStop(0, '#5b3d8a'); g.addColorStop(0.5, '#9a73d6'); g.addColorStop(1, '#4a2f75'); c.fillStyle = g;
        c.beginPath(); c.ellipse(tx, ty + 30 * d, 38 * d, 46 * d, 0, 0, 7); c.fill(); c.fillStyle = '#2a1745'; c.beginPath(); c.ellipse(tx, ty, 22 * d, 8 * d, 0, 0, 7); c.fill();
        if (S.wind) { c.fillStyle = '#ffffffaa'; c.font = `${14 * d}px sans-serif`; c.textAlign = 'center'; c.fillText(`바람 ${S.wind > 0 ? '→' : '←'} ${Math.abs(Math.round(S.wind * 20))}`, W / 2, 24 * d); }
      } else {
        c.fillStyle = '#fff'; rr(c, tx - 50 * d, ty - 60 * d, 100 * d, 60 * d, 4 * d); c.fill(); c.strokeStyle = '#ff6b2b'; c.lineWidth = 4 * d; c.strokeRect(tx - 22 * d, ty - 44 * d, 44 * d, 30 * d);
        c.strokeStyle = '#ff6b2b'; c.lineWidth = 5 * d; c.beginPath(); c.moveTo(tx - 26 * d, ty); c.lineTo(tx + 26 * d, ty); c.stroke();
        c.strokeStyle = '#ffffffaa'; c.lineWidth = 1.5 * d; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(tx + i * 10 * d, ty); c.lineTo(tx + i * 6 * d, ty + 30 * d); c.stroke(); }
      }
      const o = S.obj;
      if (o) { const X = o.x * W, Y = o.y * H; if (kind === 'tuho') { c.strokeStyle = '#e8d6b0'; c.lineWidth = 4 * d; c.beginPath(); c.moveTo(X, Y); c.lineTo(X - o.vx * 20 * d, Y + 40 * d); c.stroke(); c.fillStyle = '#ff4d6d'; c.beginPath(); c.moveTo(X, Y - 8 * d); c.lineTo(X - 5 * d, Y + 4 * d); c.lineTo(X + 5 * d, Y + 4 * d); c.fill(); } else { const s = 1 - (0.92 - o.y) * 0.5; c.fillStyle = '#f28c28'; c.beginPath(); c.arc(X, Y, 20 * d * s, 0, 7); c.fill(); c.strokeStyle = '#4a2208'; c.lineWidth = 2 * d; c.beginPath(); c.arc(X, Y, 20 * d * s, 0, 7); c.moveTo(X - 20 * d * s, Y); c.lineTo(X + 20 * d * s, Y); c.stroke(); } }
      else if (S.cool <= 0) { const X = W / 2, Y = H * 0.9; if (kind === 'tuho') { c.strokeStyle = '#e8d6b0'; c.lineWidth = 4 * d; c.beginPath(); c.moveTo(X, Y - 30 * d); c.lineTo(X, Y + 20 * d); c.stroke(); } else { c.fillStyle = '#f28c28'; c.beginPath(); c.arc(X, Y, 22 * d, 0, 7); c.fill(); } c.fillStyle = '#ffffff88'; c.font = `${14 * d}px sans-serif`; c.textAlign = 'center'; c.fillText('↑ 위로 휙 밀어 던지기', X, Y - 46 * d); }
    },
  }, { cls: 'tall', unit: '점', motion: '폰을 앞으로 휘둘러 던지기 · 기울여 조준' });
}
G.tuho = throwGame('tuho');
G.basket = throwGame('basket');

// ---------------- 점프 러너
G.runner = skillUI({
  init(S) { S.y = 0; S.vy = 0; S.dist = 0; S.obs = []; S.next = 1.2; S.stun = 0; S.buf = 0; S.bh = 0.2; S.r2 = rng(S.v.seed + 99); },
  motion(S, ev) { if (ev.type === 'flick' || ev.type === 'swing') this.down(S); },
  // 공중에서 미리 눌러도 착지하자마자 점프 (0.15초 선입력)
  down(S) { if (S.stun > 0) return; if (S.y <= 0.001) { S.vy = 1.9; S.buf = 0; vibrate(8); sfx('tap', S.api.sfxOn); } else S.buf = 0.15; },
  step(S, dt) {
    const sp = [0.32, 0.36, 0.42, 0.46, 0.5, 0.52][S.lv] + S.t * 0.004;
    if (S.stun > 0) { S.stun -= dt; } else { S.dist += sp * dt * 40; }
    S.vy -= 5.2 * dt; S.y = Math.max(0, S.y + S.vy * dt); if (S.y === 0) { S.vy = 0; if (S.buf > 0 && S.stun <= 0) { S.vy = 1.9; S.buf = 0; sfx('tap', S.api.sfxOn); } } S.buf = Math.max(0, S.buf - dt);
    S.next -= dt; if (S.next <= 0) { const big = S.r2() < 0.25 && S.lv >= 2; S.obs.push({ x: 1.1, w: big ? 0.09 : 0.06, h: big ? 0.22 : S.lv <= 1 ? 0.12 : 0.15, fly: S.lv >= 3 && S.r2() < 0.15 }); S.next = (1.1 + S.r2() * 1.1) * [1.5, 1.3, 1, 0.95, 0.9, 0.88][S.lv]; }
    for (const o of S.obs) { if (S.stun <= 0) o.x -= sp * dt * 2.2; if (!o.hit && o.x < 0.225 && o.x + o.w > 0.175) { if (o.fly ? S.y + S.bh > 0.3 + 0.01 && S.y < 0.3 + o.h : S.y < o.h - 0.01) { o.hit = true; S.stun = 0.9; vibrate(80); sfx('bad', S.api.sfxOn); S.say('쿵!'); } } }
    S.obs = S.obs.filter((o) => o.x > -0.2);
    const m = Math.floor(S.dist); if (m !== S.score) { if (Math.floor(m / 100) > Math.floor(S.score / 100)) S.add(0, 1, `${Math.floor(m / 100) * 100}m 돌파!`); S.score = m; }
  },
  draw(S, c, W, H, d) {
    bg(c, W, H, '#1d2b6b', '#0b1030'); const gy = H * 0.72;
    c.fillStyle = '#ffffff08'; for (let i = 0; i < 6; i++) { const x = ((i * 0.3 - S.dist * 0.004) % 1.8 + 1.8) % 1.8 - 0.3; c.beginPath(); c.arc(x * W, H * 0.3, 60 * d, 0, 7); c.fill(); }
    c.fillStyle = '#2fd27a'; c.fillRect(0, gy, W, 4 * d); c.fillStyle = '#ffffff12'; for (let i = 0; i < 20; i++) c.fillRect(((i * 0.08 - S.dist * 0.01) % 1.6 + 1.6) % 1.6 * W - 0.3 * W, gy + 14 * d, 18 * d, 3 * d);
    for (const o of S.obs) { c.fillStyle = o.hit ? '#ff4d6d55' : '#ff4d6d'; const top = o.fly ? gy - (0.3 + o.h) * H * 0.55 : gy - o.h * H * 0.55; rr(c, o.x * W, top, o.w * W, o.h * H * 0.55, 6 * d); c.fill(); }
    S.bh = (59 * d) / (H * 0.55); // 러너 키(머리까지)를 장애물과 같은 단위로
    const px = 0.2 * W, py = gy - S.y * H * 0.55; const run = S.stun > 0 ? 0 : (S.t * 3) % 1;
    c.globalAlpha = S.stun > 0 && Math.floor(S.t * 10) % 2 ? 0.4 : 1;
    // 러너 실루엣
    c.lineCap = 'round'; c.strokeStyle = S.api.team.color; c.lineWidth = 8 * d; c.beginPath(); c.moveTo(px, py - 40 * d); c.lineTo(px, py - 20 * d); c.stroke();
    c.strokeStyle = '#e8ecff'; c.lineWidth = 6 * d; const sw = Math.sin(run * 6.28) * 12 * d; c.beginPath(); c.moveTo(px, py - 20 * d); c.lineTo(px - sw, py); c.moveTo(px, py - 20 * d); c.lineTo(px + sw, py); c.stroke();
    c.beginPath(); c.moveTo(px, py - 36 * d); c.lineTo(px + sw, py - 24 * d); c.moveTo(px, py - 36 * d); c.lineTo(px - sw, py - 24 * d); c.stroke();
    c.fillStyle = '#ffe2c6'; c.beginPath(); c.arc(px, py - 50 * d, 9 * d, 0, 7); c.fill(); c.globalAlpha = 1;
    c.fillStyle = '#ffffff99'; c.font = `${14 * d}px sans-serif`; c.textAlign = 'center'; c.fillText('화면을 톡 → 점프', W / 2, H - 14 * d);
  },
}, { cls: 'tall', unit: 'm', motion: '폰을 위로 확 들어 올리면 점프' });

// ---------------- 파닥파닥
G.flappy = skillUI({
  init(S) { S.y = 0.45; S.vy = 0; S.pipes = []; S.next = 0.8; S.stun = 0; S.r2 = rng(S.v.seed + 5); },
  motion(S, ev) { if (ev.type === 'flick' || ev.type === 'swing') this.down(S); },
  down(S) { if (S.stun <= 0) { S.vy = -0.62; vibrate(6); sfx('tap', S.api.sfxOn); } },
  step(S, dt) {
    const gap = [0.42, 0.36, 0.3, 0.27, 0.25, 0.24][S.lv]; const sp = [0.22, 0.25, 0.3, 0.32, 0.34, 0.35][S.lv];
    if (S.stun > 0) { S.stun -= dt; if (S.stun <= 0) { S.y = 0.45; S.vy = 0; } return; }
    S.vy += 1.45 * dt; S.y += S.vy * dt;
    S.next -= dt; if (S.next <= 0) { S.pipes.push({ x: 1.1, c: 0.25 + S.r2() * 0.5, gap, pass: false }); S.next = 1.6; }
    for (const p of S.pipes) { p.x -= sp * dt; if (!p.pass && p.x < 0.22) { p.pass = true; S.add(1); sfx('good', S.api.sfxOn); if (S.score % 10 === 0) S.add(0, 1, `${S.score}개 통과!`); } if (p.x < 0.22 + 0.04 && p.x + 0.12 > 0.22 - 0.04 && (S.y < p.c - p.gap / 2 + 0.02 || S.y > p.c + p.gap / 2 - 0.02)) { S.stun = 1; vibrate(80); sfx('bad', S.api.sfxOn); S.say('앗!'); p.x = -1; } }
    if (S.y > 1 || S.y < 0) { S.stun = 1; S.say('앗!'); }
    S.pipes = S.pipes.filter((p) => p.x > -0.3);
  },
  draw(S, c, W, H, d) {
    bg(c, W, H, '#3d7be0', '#1b2d6b');
    for (const p of S.pipes) { const pw = 0.12 * W; c.fillStyle = '#2fd27a'; c.fillRect(p.x * W, 0, pw, (p.c - p.gap / 2) * H); c.fillRect(p.x * W, (p.c + p.gap / 2) * H, pw, H); c.fillStyle = '#1a9e55'; c.fillRect(p.x * W - 4 * d, (p.c - p.gap / 2) * H - 14 * d, pw + 8 * d, 14 * d); c.fillRect(p.x * W - 4 * d, (p.c + p.gap / 2) * H, pw + 8 * d, 14 * d); }
    const X = 0.22 * W, Y = S.y * H; c.save(); c.translate(X, Y); c.rotate(Math.max(-0.5, Math.min(1, S.vy * 1.5)));
    c.fillStyle = S.stun > 0 ? '#ffffff66' : '#ffd43b'; c.beginPath(); c.ellipse(0, 0, 20 * d, 16 * d, 0, 0, 7); c.fill();
    c.fillStyle = '#ff9f1c'; c.beginPath(); c.moveTo(16 * d, -2 * d); c.lineTo(28 * d, 3 * d); c.lineTo(16 * d, 7 * d); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(8 * d, -6 * d, 6 * d, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(10 * d, -6 * d, 3 * d, 0, 7); c.fill();
    c.fillStyle = '#ffb703'; c.beginPath(); c.ellipse(-6 * d, 2 * d + Math.sin(S.t * 30) * 4 * d, 10 * d, 6 * d, -0.4, 0, 7); c.fill(); c.restore();
  },
}, { cls: 'tall', unit: '개', motion: '폰을 위로 확 들면 날갯짓' });

// ---------------- 하늘 계단
G.stairs = skillUI({
  init(S) { S.r2 = rng(S.v.seed + 3); S.seq = [1]; for (let i = 0; i < 4000; i++) S.seq.push(S.r2() < [0.25, 0.3, 0.38, 0.42, 0.45, 0.45][S.lv] ? -S.seq[i] : S.seq[i]); S.i = 0; S.face = 1; S.fall = 0; S.anim = 0; },
  act(S, turn) {
    if (S.fall > 0) return; const nf = turn ? -S.face : S.face; S.face = nf;
    if (S.seq[S.i + 1] === nf) { S.i++; S.add(1); S.anim = 1; vibrate(5); sfx('tap', S.api.sfxOn); if (S.score % 50 === 0) S.add(0, 1, `${S.score}칸!`); }
    else { S.fall = 0.9; vibrate(120); sfx('bad', S.api.sfxOn); S.say('발을 헛디뎠다!'); }
  },
  step(S, dt) { if (S.fall > 0) { S.fall -= dt; if (S.fall <= 0) { S.face = S.seq[S.i + 1]; } } S.anim = Math.max(0, S.anim - dt * 8); },
  draw(S, c, W, H, d) {
    bg(c, W, H, '#6a8cff', '#1d2050'); const sw = 56 * d, sh = 30 * d; const cx = W / 2, cy = H * 0.68;
    let x = 0; const xs = [0]; for (let k = 1; k < 14; k++) { x += S.seq[S.i + k] || 1; xs.push(x); }
    for (let k = 13; k >= 0; k--) { const X = cx + xs[k] * sw - sw / 2, Y = cy - k * sh + S.anim * sh; c.fillStyle = k === 0 ? '#ffd43b' : `hsl(${220 + k * 6},70%,${70 - k * 2}%)`; rr(c, X, Y, sw, 12 * d, 4 * d); c.fill(); }
    const py = cy + S.anim * sh - (S.fall > 0 ? -(0.9 - S.fall) * 200 * d : 0);
    c.save(); c.translate(cx, py); c.scale(S.face, 1); c.lineCap = 'round';
    c.strokeStyle = S.api.team.color; c.lineWidth = 8 * d; c.beginPath(); c.moveTo(0, -36 * d); c.lineTo(0, -16 * d); c.stroke();
    c.strokeStyle = '#e8ecff'; c.lineWidth = 6 * d; c.beginPath(); c.moveTo(0, -16 * d); c.lineTo(8 * d, 0); c.moveTo(0, -16 * d); c.lineTo(-6 * d, 0); c.moveTo(0, -32 * d); c.lineTo(12 * d, -22 * d); c.stroke();
    c.fillStyle = '#ffe2c6'; c.beginPath(); c.arc(0, -46 * d, 9 * d, 0, 7); c.fill(); c.restore();
  },
}, { cls: 'mid', unit: '칸', buttons: (S, g) => h('div', { class: 'skbtns' }, P.press(h('button', { class: 'skb turn' }, '↩ 방향 바꾸기'), () => g.act(S, true)), P.press(h('button', { class: 'skb up' }, '↑ 오르기'), () => g.act(S, false))) });

// ---------------- 다리 놓기
G.bridge = skillUI({
  init(S) { S.r2 = rng(S.v.seed + 8); S.plat = [{ x: 0.05, w: 0.22 }]; this.more(S); S.len = 0; S.grow = false; S.fallA = 0; S.phase = 'ready'; S.walk = 0; S.off = 0; },
  more(S) { const last = S.plat[S.plat.length - 1]; const gap = 0.12 + S.r2() * [0.2, 0.25, 0.32, 0.36, 0.38, 0.4][S.lv]; const w = [0.2, 0.17, 0.13, 0.11, 0.1, 0.09][S.lv] * (0.7 + S.r2() * 0.6); S.plat.push({ x: last.x + last.w + gap, w }); },
  down(S) { if (S.phase === 'ready') { S.grow = true; S.len = 0; } },
  up(S) { if (S.grow) { S.grow = false; S.phase = 'drop'; S.fallA = 0; } },
  step(S, dt) {
    const sp = [0.55, 0.6, 0.7, 0.75, 0.8, 0.8][S.lv];
    if (S.grow) S.len = Math.min(1.2, S.len + sp * dt);
    if (S.phase === 'drop') { S.fallA = Math.min(Math.PI / 2, S.fallA + dt * 5); if (S.fallA >= Math.PI / 2) { const a = S.plat[0], b = S.plat[1]; const end = a.x + a.w + S.len; if (end >= b.x && end <= b.x + b.w) { const mid = Math.abs(end - (b.x + b.w / 2)) < b.w * 0.15; S.add(mid ? 2 : 1, mid ? 1 : 0, mid ? '정중앙! +2' : '+1'); sfx('good', S.api.sfxOn); S.phase = 'walk'; S.walk = 0; } else { S.phase = 'fall'; S.walk = 0; sfx('bad', S.api.sfxOn); vibrate(100); S.say('풍덩!'); } } }
    if (S.phase === 'walk') { S.walk += dt; if (S.walk > 0.6) { const shift = S.plat[1].x - S.plat[0].x; S.plat.shift(); S.plat.forEach((p) => { p.x -= shift; }); this.more(S); S.len = 0; S.phase = 'ready'; } }
    if (S.phase === 'fall') { S.walk += dt; if (S.walk > 0.9) { S.len = 0; S.phase = 'ready'; } }
  },
  draw(S, c, W, H, d) {
    bg(c, W, H, '#ff9a5a', '#5a2a6b'); const base = H * 0.66;
    for (const p of S.plat) { c.fillStyle = '#1b1530'; c.fillRect(p.x * W, base, p.w * W, H - base); c.fillStyle = '#ff4d6d'; c.fillRect((p.x + p.w / 2 - p.w * 0.075) * W, base, p.w * 0.15 * W, 4 * d); }
    const a = S.plat[0]; const sx = (a.x + a.w) * W; const L = S.len * W; const ang = S.phase === 'ready' ? -Math.PI / 2 : -Math.PI / 2 + S.fallA;
    c.strokeStyle = '#ffd43b'; c.lineWidth = 5 * d; c.beginPath(); c.moveTo(sx, base); c.lineTo(sx + Math.cos(ang) * L, base + Math.sin(ang) * L); c.stroke();
    const walkX = S.phase === 'walk' ? Math.min(1, S.walk / 0.6) : 0; const fallY = S.phase === 'fall' ? S.walk * 400 * d : 0;
    const px = sx - 14 * d + walkX * ((S.plat[1].x - a.x - a.w) * W + 28 * d), py = base + fallY;
    c.fillStyle = '#111'; rr(c, px - 10 * d, py - 30 * d, 20 * d, 30 * d, 6 * d); c.fill(); c.fillStyle = S.api.team.color; c.fillRect(px - 10 * d, py - 26 * d, 20 * d, 5 * d);
    c.fillStyle = '#ffffffcc'; c.font = `${14 * d}px sans-serif`; c.textAlign = 'center'; c.fillText(S.phase === 'ready' ? '꾹 누르는 동안 막대가 길어져요' : '', W / 2, H - 14 * d);
  },
}, { cls: 'tall', unit: '칸' });

// ---------------- 낚시왕
const FISH = [['🐟', 5, '붕어'], ['🐠', 10, '열대어'], ['🐡', 15, '복어'], ['🦈', 25, '상어'], ['🐋', 40, '황금 고래']];
G.fishing = skillUI({
  init(S) { S.st = 'wait'; S.tw = 1 + S.r() * 2.5; S.ten = 0.5; S.prog = 0; S.hold = false; },
  down(S) { S.touch = true; if (S.st === 'bite') { S.st = 'reel'; const roll = S.r(); S.fish = roll < 0.45 ? 0 : roll < 0.72 ? 1 : roll < 0.88 ? 2 : roll < 0.97 ? 3 : 4; S.ten = 0.5; S.prog = 0; vibrate(30); sfx('go', S.api.sfxOn); } else if (S.st === 'wait') { S.say('아직이에요…'); S.tw += 0.6; } S.hold = true; },
  up(S) { S.hold = false; S.touch = false; },
  motion(S, ev) { if ((ev.type === 'flick' || ev.type === 'swing') && S.st === 'bite') this.down(S); },
  tilt(S, [, ty]) { if (S.st === 'reel' && !S.touch) S.hold = ty > 0.35; },
  step(S, dt) {
    if (S.st === 'wait') { S.tw -= dt; if (S.tw <= 0) { S.st = 'bite'; S.tb = [1.2, 1, 0.85, 0.75, 0.7, 0.65][S.lv]; vibrate([60, 40, 60]); sfx('hurry', S.api.sfxOn); } }
    else if (S.st === 'bite') { S.tb -= dt; if (S.tb <= 0) { S.st = 'wait'; S.tw = 1 + S.r() * 2; S.say('놓쳤다…'); } }
    else if (S.st === 'reel') {
      const pull = 0.35 + S.fish * 0.12 + Math.sin(S.t * (3 + S.fish)) * 0.25;
      S.ten += (S.hold ? 0.9 : -0.8) * dt + (pull - 0.35) * dt * 0.8;
      const zone = [0.32, 0.28, 0.24, 0.2, 0.18, 0.17][S.lv];
      if (Math.abs(S.ten - 0.5) < zone) S.prog += dt * (0.55 - S.fish * 0.06); else S.prog -= dt * 0.15;
      if (S.ten > 1 || S.ten < 0) { S.st = 'wait'; S.tw = 1.5; S.say(S.ten > 1 ? '줄이 끊어졌다!' : '도망갔다…'); sfx('bad', S.api.sfxOn); }
      if (S.prog >= 1) { const f = FISH[S.fish]; S.add(f[1], S.fish >= 3 ? S.fish : 0, `${f[0]} ${f[2]} +${f[1]}`); sfx(S.fish >= 3 ? 'fanfare' : 'good', S.api.sfxOn); vibrate([50, 30, 50]); S.st = 'wait'; S.tw = 1 + S.r() * 2.5; }
      S.prog = Math.max(0, S.prog);
    }
  },
  draw(S, c, W, H, d) {
    bg(c, W, H, '#7ec8ff', '#0b2a5c'); const wy = H * 0.32;
    c.fillStyle = '#0d3b7a'; c.fillRect(0, wy, W, H - wy); c.strokeStyle = '#ffffff33'; c.lineWidth = 2 * d; c.beginPath(); for (let x = 0; x <= W; x += 10 * d) c.lineTo(x, wy + Math.sin(x / (30 * d) + S.t * 2) * 3 * d); c.stroke();
    const bx = W * 0.5, by = wy + (S.st === 'bite' ? 18 * d + Math.sin(S.t * 30) * 4 * d : Math.sin(S.t * 2) * 3 * d);
    c.strokeStyle = '#ffffffaa'; c.lineWidth = 1.5 * d; c.beginPath(); c.moveTo(W * 0.9, 0); c.lineTo(bx, by); c.stroke();
    c.fillStyle = '#ff4d6d'; c.beginPath(); c.arc(bx, by, 9 * d, Math.PI, 0); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(bx, by, 9 * d, 0, Math.PI); c.fill();
    c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = `900 ${20 * d}px sans-serif`;
    if (S.st === 'bite') c.fillText('지금! 챔질!', W / 2, wy - 30 * d); else if (S.st === 'wait') { c.font = `${15 * d}px sans-serif`; c.fillText('찌를 지켜보세요…', W / 2, wy - 30 * d); }
    if (S.st === 'reel') {
      const bw = W * 0.7, x0 = W * 0.15, yb = H * 0.62, zone = [0.32, 0.28, 0.24, 0.2, 0.18, 0.17][S.lv];
      c.fillStyle = '#00000055'; rr(c, x0, yb, bw, 26 * d, 13 * d); c.fill(); c.fillStyle = '#2fd27a88'; c.fillRect(x0 + (0.5 - zone) * bw, yb, zone * 2 * bw, 26 * d);
      c.fillStyle = '#fff'; c.fillRect(x0 + Math.max(0, Math.min(1, S.ten)) * bw - 3 * d, yb - 6 * d, 6 * d, 38 * d);
      c.fillStyle = '#ffd43b'; rr(c, x0, yb + 40 * d, bw * Math.min(1, S.prog), 10 * d, 5 * d); c.fill();
      c.font = `${15 * d}px sans-serif`; c.fillText('꾹 누르면 감기 · 떼면 풀기 — 흰 막대를 초록 안에!', W / 2, yb + 76 * d);
      c.font = `${40 * d}px sans-serif`; c.fillText(FISH[S.fish][0], W / 2 + Math.sin(S.t * 8) * 30 * d, H * 0.5);
    }
  },
}, { cls: 'tall', unit: '점', motion: '확 들어 올려 챔질 · 폰 윗부분을 몸 쪽으로 당기면 감기' });

// ---------------- 달걀 받기
G.eggs = skillUI({
  init(S) { S.bx = 0.5; S.items = []; S.next = 0.5; S.r2 = rng(S.v.seed + 21); },
  down(S, x) { S.bx = x; }, move(S, x) { S.bx = Math.max(0.1, Math.min(0.9, x)); },
  tilt(S, [tx]) { S.bx = Math.max(0.1, Math.min(0.9, S.bx + tx * 0.03)); },
  step(S, dt) {
    S.next -= dt; if (S.next <= 0) { const k = S.r2(); S.items.push({ x: 0.1 + S.r2() * 0.8, y: -0.05, t: k < 0.12 && S.lv >= 1 ? 'rock' : k < 0.18 ? 'gold' : 'egg', v: [0.28, 0.32, 0.4, 0.45, 0.5, 0.52][S.lv] * (0.8 + S.r2() * 0.4) }); S.next = [0.9, 0.75, 0.55, 0.5, 0.45, 0.42][S.lv] * (0.6 + S.r2() * 0.8); }
    for (const it of S.items) { it.y += it.v * dt; if (!it.done && it.y > 0.84 && it.y < 0.92 && Math.abs(it.x - S.bx) < 0.11) { it.done = true; if (it.t === 'rock') { S.add(-2, 0, '돌멩이 -2'); vibrate(100); sfx('bad', S.api.sfxOn); } else { S.add(it.t === 'gold' ? 3 : 1, it.t === 'gold' ? 1 : 0, it.t === 'gold' ? '황금 달걀 +3' : ''); vibrate(6); sfx('tap', S.api.sfxOn); } } }
    S.items = S.items.filter((i) => !i.done && i.y < 1.1);
  },
  draw(S, c, W, H, d) {
    bg(c, W, H, '#ffe2a8', '#e88a3a');
    for (const it of S.items) { const X = it.x * W, Y = it.y * H; if (it.t === 'rock') { c.fillStyle = '#6b6b78'; c.beginPath(); c.ellipse(X, Y, 16 * d, 13 * d, 0.3, 0, 7); c.fill(); } else { c.fillStyle = it.t === 'gold' ? '#ffd43b' : '#fffaf0'; c.shadowColor = it.t === 'gold' ? '#fff3a0' : 'transparent'; c.shadowBlur = 16 * d; c.beginPath(); c.ellipse(X, Y, 12 * d, 16 * d, 0, 0, 7); c.fill(); c.shadowBlur = 0; c.strokeStyle = '#00000022'; c.stroke(); } }
    const X = S.bx * W, Y = 0.88 * H; c.fillStyle = '#8b5a2b'; c.beginPath(); c.moveTo(X - 46 * d, Y - 10 * d); c.lineTo(X + 46 * d, Y - 10 * d); c.lineTo(X + 34 * d, Y + 24 * d); c.lineTo(X - 34 * d, Y + 24 * d); c.fill();
    c.strokeStyle = '#5a3612'; c.lineWidth = 2 * d; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(X + i * 12 * d, Y - 10 * d); c.lineTo(X + i * 9 * d, Y + 24 * d); c.stroke(); }
  },
}, { cls: 'tall', unit: '개', motion: '폰을 좌우로 기울여 바구니 이동' });

// ---------------- 컬링 (스톤 3개, 결과는 서버에 기록)
G.curling = {
  mount(root, v, api) {
    this.api = api; this.v = v; this.s = { st: null, stone: null, sweep: 0, n: v.th.length, rub: 0 };
    this.cv = h('canvas', { class: 'skcv' }); this.info = h('div', { class: 'sksc' }, '');
    const box = h('div', { class: 'skw sk-tall' }, this.cv, this.info); root.append(h('div', { class: 'gwrap skg' }, motionChip(api, '앞으로 밀듯 휘둘러 던지기 · 흔들면 스위핑'), box));
    this.unsub = M.sub((ev) => { if (!M.on) return; const S = this.s; if (ev.type === 'swing' && !S.stone && S.n < 3) { S.stone = { x: 0.5, y: 0.9, vx: ev.tx * 0.12, vy: 0.45 + ev.power * 0.75, moving: true }; sfx('pass', api.sfxOn); vibrate(20); } else if (ev.type === 'shake' && S.stone?.moving) S.rub += 0.04; });
    const pos = (e) => { const r = this.cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    let down = false, last = null;
    box.addEventListener('pointerdown', (e) => { e.preventDefault(); down = true; box.setPointerCapture?.(e.pointerId); const p = pos(e); if (!this.s.stone && this.s.n < 3) this.s.st = [...p, performance.now()]; last = p; });
    box.addEventListener('pointermove', (e) => { if (!down) return; const p = pos(e); if (this.s.stone?.moving && last) { this.s.rub += Math.hypot(p[0] - last[0], p[1] - last[1]); } last = p; });
    box.addEventListener('pointerup', (e) => { down = false; const p = pos(e); const st = this.s.st; this.s.st = null; if (!st || this.s.stone) return; const dt = Math.max(80, performance.now() - st[2]) / 1000; const vy = (st[1] - p[1]) / dt; if (vy < 0.4) return; this.s.stone = { x: 0.5, y: 0.9, vx: ((p[0] - st[0]) / dt) * 0.12, vy: Math.min(1.25, vy * 0.42), moving: true }; sfx('pass', api.sfxOn); });
    let lt = performance.now();
    const loop = () => {
      if (this.dead) return; const now = performance.now(); const dt = Math.min(0.05, (now - lt) / 1000); lt = now; const S = this.s; const o = S.stone;
      if (o?.moving) { const fr = 0.42 - Math.min(0.25, S.rub * 0.9); S.rub *= 0.85; o.x += o.vx * dt; o.y -= o.vy * dt; const sp = Math.hypot(o.vx, o.vy); const nsp = Math.max(0, sp - fr * dt); if (sp > 0) { o.vx *= nsp / sp; o.vy *= nsp / sp; } if (nsp <= 0.003 || o.y < -0.1) { o.moving = false; const hx = (o.x - 0.5) / 0.22, hy = (o.y - 0.22) / 0.22 * (this.cv.height / this.cv.width) ; api.send({ a: 'throw', x: Math.max(-1.5, Math.min(1.5, hx)), y: Math.max(-1.5, Math.min(1.5, hy)) }); vibrate(30); } }
      const { W, H, d } = fit(this.cv); const c = this.cv.getContext('2d'); bg(c, W, H, '#e9f3ff', '#c7dcf2');
      const cx = W * 0.5, cy = H * 0.22, R = W * 0.22;
      [[1, '#3d8bff'], [0.66, '#ffffff'], [0.33, '#ff4d6d'], [0.08, '#ffffff']].forEach(([k, col]) => { c.fillStyle = col; c.beginPath(); c.arc(cx, cy, R * k, 0, 7); c.fill(); });
      c.strokeStyle = '#9fb6d6'; c.lineWidth = 2 * d; c.beginPath(); c.moveTo(W * 0.5, 0); c.lineTo(W * 0.5, H); c.stroke();
      const draw = (x, y, col) => { c.fillStyle = '#6b7280'; c.beginPath(); c.arc(x, y, 18 * d, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(x, y, 12 * d, 0, 7); c.fill(); c.fillStyle = '#222'; c.fillRect(x - 3 * d, y - 14 * d, 6 * d, 10 * d); };
      if (o) draw(o.x * W, o.y * H, api.team.color); else if (S.n < 3) draw(W / 2, H * 0.9, api.team.color);
      c.fillStyle = '#1b2250'; c.font = `${14 * d}px sans-serif`; c.textAlign = 'center'; c.fillText(o?.moving ? '빠르게 문지르면 더 멀리!' : S.n < 3 ? '스톤을 위로 밀어 던지세요' : '', W / 2, H - 14 * d);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop); this.update(v);
  },
  update(v) { this.v = v; this.s.n = Math.max(this.s.n, v.th.length); this.info.textContent = `스톤 ${v.th.length}/3 ${v.th.length ? '· ' + v.th.join(' · ') + '점' : ''}`; },
  reply(r) { this.s.n = r.n; this.info.textContent = `스톤 ${r.n}/3 · 방금 ${r.s}점`; sfx(r.s >= 70 ? 'win' : 'good', this.api.sfxOn); setTimeout(() => { if (r.n < 3) this.s.stone = null; }, 900); },
  unmount() { this.dead = true; this.unsub?.(); cancelAnimationFrame(this.raf); },
};

// ---------------- 승부차기
G.penalty = {
  mount(root, v, api) {
    this.api = api; this.anim = null;
    this.cv = h('canvas', { class: 'skcv' }); this.info = h('div', { class: 'sksc' }, `${v.goals}골`);
    const box = h('div', { class: 'skw sk-tall' }, this.cv, this.info); root.append(h('div', { class: 'gwrap skg' }, motionChip(api, '기울인 쪽으로 휘둘러 슛 · 세게 = 위쪽'), box, h('div', { class: 'muted' }, '골대의 칸을 터치해서 슛!')));
    this.unsub = M.sub((ev) => { if (!M.on || ev.type !== 'swing' || (this.anim && performance.now() - this.anim.at < 1500)) return; const col = ev.tx < -0.3 ? 0 : ev.tx > 0.3 ? 2 : 1; const z = (ev.power > 0.6 ? 0 : 3) + col; api.send({ a: 'kick', z }); this.anim = { z, at: performance.now(), res: null }; vibrate(20); sfx('pass', api.sfxOn); });
    P.press(box, (e) => { if (this.anim && performance.now() - this.anim.at < 1500) return; const r = this.cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; if (y > 0.55 || x < 0.1 || x > 0.9) return; const col = Math.min(2, Math.floor((x - 0.1) / 0.8 * 3)); const row = y < 0.32 ? 0 : 1; const z = row * 3 + col; api.send({ a: 'kick', z }); this.anim = { z, at: performance.now(), res: null }; vibrate(15); sfx('pass', api.sfxOn); });
    const loop = () => {
      if (this.dead) return; const { W, H, d } = fit(this.cv); const c = this.cv.getContext('2d'); bg(c, W, H, '#1f6b3a', '#0d3b1f');
      const gx = W * 0.1, gy = H * 0.12, gw = W * 0.8, gh = H * 0.42;
      c.strokeStyle = '#ffffff22'; c.lineWidth = 1; for (let i = 0; i <= 12; i++) { c.beginPath(); c.moveTo(gx + (gw * i) / 12, gy); c.lineTo(gx + (gw * i) / 12, gy + gh); c.stroke(); } for (let j = 0; j <= 6; j++) { c.beginPath(); c.moveTo(gx, gy + (gh * j) / 6); c.lineTo(gx + gw, gy + (gh * j) / 6); c.stroke(); }
      c.strokeStyle = '#fff'; c.lineWidth = 6 * d; c.strokeRect(gx, gy, gw, gh);
      const a = this.anim; const k = a ? Math.min(1, (performance.now() - a.at) / 500) : 0;
      const zx = (z) => gx + gw * ((z % 3) + 0.5) / 3, zy = (z) => gy + gh * (Math.floor(z / 3) + 0.5) / 2;
      let kx = W / 2, ky = gy + gh * 0.75;
      if (a?.res) { kx = zx(a.res.keeper); ky = zy(a.res.keeper); }
      const kk = a?.res ? k : 0; const KX = W / 2 + (kx - W / 2) * kk, KY = gy + gh * 0.75 + (ky - gy - gh * 0.75) * kk;
      c.fillStyle = '#ffd43b'; rr(c, KX - 22 * d, KY - 34 * d, 44 * d, 56 * d, 12 * d); c.fill(); c.fillStyle = '#ffe2c6'; c.beginPath(); c.arc(KX, KY - 44 * d, 12 * d, 0, 7); c.fill();
      const bx = a ? W / 2 + (zx(a.z) - W / 2) * k : W / 2, by = a ? H * 0.85 + (zy(a.z) - H * 0.85) * k : H * 0.85; const bs = a ? 1 - 0.45 * k : 1;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(bx, by, 16 * d * bs, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(bx, by, 6 * d * bs, 0, 7); c.fill();
      if (a?.res && k >= 1) { c.fillStyle = a.res.res === 'goal' ? '#ffd43b' : '#ff8fa3'; c.font = `900 ${36 * d}px sans-serif`; c.textAlign = 'center'; c.fillText(a.res.res === 'goal' ? 'GOAL!' : a.res.res === 'save' ? '막혔다!' : '빗나감', W / 2, H * 0.68); }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  update(v) { this.info.textContent = `${v.goals}골 / ${v.shots}슛`; },
  reply(r) { if (this.anim) { this.anim.res = r; this.anim.at = performance.now() - 300; } this.info.textContent = `${r.goals}골`; if (r.res === 'goal') { sfx('win', this.api.sfxOn); vibrate([40, 30, 40]); } else sfx('bad', this.api.sfxOn); },
  unmount() { this.dead = true; this.unsub?.(); cancelAnimationFrame(this.raf); },
};

// ---------------- 리듬 마스터
G.rhythm = {
  mount(root, v, api) {
    this.api = api; this.v = v; this.hit = new Set(); this.fx = []; this.combo = 0; this.chart = null;
    this.cv = h('canvas', { class: 'skcv' }); this.info = h('div', { class: 'sksc' }, '');
    const lanes = v.lv <= 1 ? 2 : 3; this.lanes = lanes;
    const btns = h('div', { class: `rhb n${lanes}` }, Array.from({ length: lanes }, (_, l) => P.press(h('button', { class: `rhk l${l}` }, ''), () => this.tap(l))));
    root.append(h('div', { class: 'gwrap skg' }, h('div', { class: 'skw sk-mid' }, this.cv, this.info), btns));
    this.update(v);
    const loop = () => {
      if (this.dead) return; const { W, H, d } = fit(this.cv); const c = this.cv.getContext('2d'); bg(c, W, H, '#140f2e', '#05040f');
      const now = api.now(); const lw = W / lanes; const hitY = H * 0.86; const speed = H / 1.6;
      const cols = ['#ff4d6d', '#3d8bff', '#2fd27a'];
      for (let l = 0; l < lanes; l++) { c.fillStyle = l % 2 ? '#ffffff06' : '#ffffff0c'; c.fillRect(l * lw, 0, lw, H); }
      if (this.chart) { const beat = 60000 / this.chart.bpm; const pulse = 1 - (((now - this.v.t0) % beat) + beat) % beat / beat; c.fillStyle = `rgba(255,255,255,${0.08 * pulse})`; c.fillRect(0, 0, W, H); }
      c.fillStyle = '#ffffff55'; c.fillRect(0, hitY - 2 * d, W, 4 * d);
      for (const n of this.chart?.notes || []) { if (this.hit.has(n.i)) continue; const y = hitY - ((n.t - now) / 1000) * speed; if (y < -30 || y > H + 30) continue; c.fillStyle = cols[n.l]; c.shadowColor = cols[n.l]; c.shadowBlur = 14 * d; rr(c, n.l * lw + 10 * d, y - 10 * d, lw - 20 * d, 20 * d, 10 * d); c.fill(); c.shadowBlur = 0; }
      this.fx = this.fx.filter((f) => performance.now() - f.at < 500);
      for (const f of this.fx) { const k = (performance.now() - f.at) / 500; c.globalAlpha = 1 - k; c.fillStyle = f.j === 'perfect' ? '#ffd43b' : f.j === 'good' ? '#8ff0b8' : '#ff8fa3'; c.font = `900 ${22 * d}px sans-serif`; c.textAlign = 'center'; c.fillText(f.j === 'perfect' ? 'PERFECT' : f.j === 'good' ? 'GOOD' : 'MISS', f.l * lw + lw / 2, hitY - 30 * d - k * 30 * d); c.globalAlpha = 1; }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  update(v) { this.v = v; if (v.t0 && (!this.chart || this.chartT0 !== v.t0)) { this.chart = rhythmChart(v.seed, v.t0, v.dur, v.lv); this.chartT0 = v.t0; } },
  tap(l) {
    const now = Math.round(this.api.now()); vibrate(8);
    const win = [220, 180, 140, 125, 115, 110][this.v.lv] + 60;
    let best = null; for (const n of this.chart?.notes || []) { if (n.l !== l || this.hit.has(n.i)) continue; const e = Math.abs(n.t - now); if (e < win && (!best || e < best.e)) best = { n, e }; }
    if (!best) { this.fx.push({ l, j: 'miss', at: performance.now() }); this.combo = 0; this.info.textContent = ''; return; }
    this.hit.add(best.n.i); this.api.send({ a: 'hit', i: best.n.i, l, ts: now });
  },
  reply(r) { const n = this.chart.notes[r.i]; this.fx.push({ l: n ? n.l : 0, j: r.j, at: performance.now() }); if (r.j !== 'miss') { this.combo = r.combo; this.info.textContent = `${r.combo} COMBO`; sfx('tap', this.api.sfxOn); } else { this.combo = 0; this.info.textContent = ''; } },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

// ---------------- 버거 장인
G.burger = {
  mount(root, v, api) {
    this.api = api; this.v = v; this.stack = [];
    this.ord = h('div', { class: 'bgord' }); this.mine = h('div', { class: 'bgmine' }); this.info = h('div', { class: 'ginfo' });
    const pool = BURGER.slice(0, v.lv <= 1 ? 5 : 8);
    const keys = h('div', { class: 'bgkeys' }, pool.map((x) => P.press(h('button', { class: 'bgk' }, x), () => this.add(x))), P.press(h('button', { class: 'bgk clr' }, '↺'), () => { this.stack = []; this.draw(); }));
    root.append(h('div', { class: 'gwrap bg2' }, this.info, h('div', { class: 'bgrow' }, h('div', { class: 'bgcol' }, h('small', {}, '주문'), this.ord), h('div', { class: 'bgcol' }, h('small', {}, '내 버거'), this.mine)), keys));
    this.update(v);
  },
  add(x) { this.stack.push(x); vibrate(6); sfx('tap', this.api.sfxOn); if (this.stack.length >= this.v.order.length) { this.api.send({ a: 'serve', st: this.stack }); } this.draw(); },
  draw() {
    const pile = (arr, el, ref) => { el.innerHTML = ''; [...arr].reverse().forEach((x, j) => { const i = arr.length - 1 - j; el.append(h('div', { class: `bgi ${ref && ref[i] !== x ? 'bad' : ''}` }, x)); }); };
    pile(this.v.order, this.ord); pile(this.stack, this.mine, this.v.order);
    this.info.innerHTML = `<b>완성 ${this.v.k}개</b> <span class="muted">· 아래에서부터 순서대로 쌓아요</span>`;
  },
  update(v) { this.v = v; this.draw(); },
  reply(r) { this.stack = []; if (r.ok) { sfx('win', this.api.sfxOn); vibrate([30, 30, 30]); this.v = { ...this.v, order: r.order, k: r.k }; } else { sfx('bad', this.api.sfxOn); vibrate(120); this.api.toast('주문과 달라요! 다시 쌓아요'); } this.draw(); },
};

// ================================================================ 라운드형 (텔레파시·소수·하이로우)
function choiceUI(kind) {
  return {
    mount(root, v, api) { this.api = api; this.root = h('div', { class: 'gwrap bell2' }); root.append(this.root); this.update(v); this.t = setInterval(() => { const el = this.root.querySelector('.belltime'); if (el && this.v) el.textContent = this.v.ph === 'q' ? `${lf(this.api, this.v.until)}초` : ''; }, 250); },
    update(v) {
      const key = `${v.i}:${v.ph}:${v.my}:${v.alive}`; this.v = v; if (key === this.key) return; this.key = key;
      const R = this.root; R.innerHTML = ''; const can = v.ph === 'q' && v.my == null && v.alive !== false;
      R.append(h('div', { class: 'bellh' }, h('span', {}, `${v.i + 1} / ${v.N}`), h('span', { class: 'belltime' })));
      let opts = [], title = '';
      if (kind === 'tele') { title = v.text; opts = v.opts; }
      if (kind === 'mino') { title = v.alive === false ? '탈락 — 결과를 지켜봐요' : '더 적게 고를 것 같은 쪽은?'; opts = v.opts; }
      if (kind === 'hilo') { title = ''; opts = ['▲ 높다', '▼ 낮다']; R.append(h('div', { class: 'hlcards' }, h('div', { class: 'hlc' }, v.card), h('div', { class: `hlc back ${v.next ? 'open' : ''}` }, v.next || '?')), h('div', { class: 'muted' }, `연속 ${v.st} · ${v.pts}점`)); }
      if (title) R.append(h('div', { class: 'bellq' }, title));
      R.append(h('div', { class: `bellopts ${kind === 'tele' ? '' : 'n2'}` }, opts.map((o, j) => {
        const val = kind === 'hilo' ? (j === 0 ? 1 : 0) : j;
        let cls = v.my === val ? 'mine' : '';
        if (v.ph === 'rev' && kind === 'mino' && v.res) cls = v.res.win === -1 ? cls : j === v.res.win ? 'right' : 'wrong';
        if (v.ph === 'rev' && kind === 'hilo' && v.res) cls = v.res.right === -1 || v.res.right === val ? 'right' : 'dim';
        const cnt = kind === 'tele' && v.dist ? h('em', { class: 'cnt' }, `${v.dist[j]}명`) : kind === 'mino' && v.res ? h('em', { class: 'cnt' }, `${v.res.cnt[j]}명`) : null;
        return P.press(h('button', { class: `bopt ${cls}`, disabled: !can }, h('span', {}, o), cnt), () => { if (!can) return; this.api.send({ a: 'pick', q: v.i, c: val }); vibrate(12); this.v.my = val; this.key = ''; this.update(this.v); });
      })));
      if (v.ph === 'rev' && kind === 'mino' && v.res) R.append(h('div', { class: `bellres ${v.alive ? 'ok' : 'no'}` }, v.res.win === -1 ? '동점! 모두 생존' : v.alive ? '생존!' : '탈락…'));
    },
    reply() {},
    unmount() { clearInterval(this.t); },
  };
}
G.tele = choiceUI('tele');
G.mino = choiceUI('mino');
G.hilo = choiceUI('hilo');

// ---------------- 틀린 그림 찾기
G.spot = {
  mount(root, v, api) { this.api = api; this.root = h('div', { class: 'gwrap spot2' }); root.append(this.root); this.update(v); },
  update(v) {
    const key = `${v.k}`; this.v = v; this.found = new Set(v.found); if (key === this.key) return this.paint(); this.key = key;
    const z = this.z = spotPuzzle(v.seed, v.k, v.lv);
    const grid = (arr, tap) => h('div', { class: 'spg', style: { gridTemplateColumns: `repeat(${z.cols}, 1fr)` } }, arr.map((x, i) => tap ? P.press(h('button', { class: 'spc', 'data-i': i }, x), () => { this.api.send({ a: 'tap', k: v.k, c: i }); vibrate(8); }) : h('div', { class: 'spc' }, x)));
    this.root.innerHTML = '';
    this.root.append(h('div', { class: 'bellh' }, h('span', {}, `${v.k + 1}번째 그림`), h('span', { class: 'spn' })), h('small', { class: 'muted' }, '원본'), grid(z.left, false), h('small', { class: 'muted' }, '여기서 다른 곳을 터치'), this.right = grid(z.right, true));
    this.paint();
  },
  paint() { this.root.querySelector('.spn').textContent = `찾은 개수 ${this.v.total} · 이번 그림 ${this.found.size}/${this.z.diff.length}`; this.right.querySelectorAll('.spc').forEach((b) => b.classList.toggle('ok', this.found.has(+b.dataset.i))); },
  reply(r) {
    if (r.ok != null) { this.found.add(r.ok); this.v.total = r.total; sfx('good', this.api.sfxOn); if (r.next != null) { sfx('win', this.api.sfxOn); this.v = { ...this.v, k: r.next, found: [] }; this.found = new Set(); this.update(this.v); return; } this.paint(); }
    if (r.wrong != null) { sfx('bad', this.api.sfxOn); vibrate(80); const b = this.right.querySelector(`[data-i="${r.wrong}"]`); b?.classList.add('no'); setTimeout(() => b?.classList.remove('no'), 600); }
  },
};

// ---------------- 손 떼면 탈락
G.hold = {
  mount(root, v, api) {
    this.api = api; this.on = false;
    this.msg = h('div', { class: 'hdmsg' }); this.trick = h('div', { class: 'hdtrick' });
    this.btn = h('button', { class: 'hdbtn', style: { '--tc': api.team.color } }, '꾹 누르고 있기');
    const on = (e) => { e.preventDefault(); this.btn.setPointerCapture?.(e.pointerId); this.set(true); }; const off = () => this.set(false);
    this.btn.addEventListener('pointerdown', on); this.btn.addEventListener('pointerup', off); this.btn.addEventListener('pointercancel', off); this.btn.addEventListener('lostpointercapture', off); this.btn.addEventListener('contextmenu', (e) => e.preventDefault());
    root.append(h('div', { class: 'gwrap hd2' }, this.msg, this.trick, this.btn));
    this.update(v);
  },
  set(on) { if (on === this.on) return; this.on = on; this.btn.classList.toggle('on', on); this.api.send({ a: 'hold', on }); if (on) vibrate(15); },
  update(v) {
    this.v = v; this.btn.disabled = !!v.out;
    this.msg.textContent = v.out ? `탈락 · ${Math.round(v.held)}초 버팀` : this.on ? `버티는 중 ${Math.round(v.held)}초 · 남은 사람 ${v.alive}명` : '버튼을 꾹 누르세요!';
    if (v.trick !== this.lastTrick) { this.lastTrick = v.trick; this.trick.textContent = v.trick || ''; this.trick.classList.toggle('on', !!v.trick); if (v.trick) vibrate([40, 40, 40]); }
  },
  reply(r) { if (r.out) { sfx('bad', this.api.sfxOn); vibrate(300); this.api.toast(`손을 뗐어요! ${r.t}초`); } },
  unmount() { if (this.on) this.api.send({ a: 'hold', on: false }); },
};

// ---------------- 스크린 체육 (폰은 안내판, 몸은 화면 보고!)
G.pe = {
  mount(root, v, api) {
    this.api = api; this.cur = h('div', { class: 'pecur' }); this.pts = h('b', {}, '0');
    root.append(h('div', { class: 'gwrap pew', style: { '--tc': api.team.color } },
      h('div', { class: 'pebig' }, '📺'), h('div', { class: 'pehd' }, '폰은 내려놓고 큰 화면을 보며 몸으로!'),
      this.cur, h('div', { class: 'pepts' }, `${api.team.icon} 우리 팀 `, this.pts, '점')));
    this.update(v);
  },
  update(v) { if (this.cur.textContent !== v.cur) { this.cur.textContent = v.cur; this.cur.animate([{ transform: 'scale(.85)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }], 260); vibrate(15); } if (this.pts.textContent !== String(v.pts)) { this.pts.textContent = v.pts; sfx('good', this.api.sfxOn); } },
  unmount() {},
};

// ---------------- 한마음 박자 (팀 협동)
G.sync = {
  mount(root, v, api) {
    this.api = api; this.v = v; this.fb = null;
    this.cv = h('canvas', { class: 'skcv' }); this.info = h('div', { class: 'sksc' });
    const pad = h('div', { class: 'skw sk-tall' }, this.cv, this.info);
    const hit = () => { this.api.send({ a: 'hit', ts: Math.round(this.api.now()) }); this.tapAt = performance.now(); vibrate(8); };
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(); }, { passive: false });
    root.append(h('div', { class: 'gwrap skg' }, motionChip(api, '폰을 북채처럼 휘둘러 쿵!'), pad, h('div', { class: 'muted' }, '원이 북에 딱 닿을 때 팀원 모두 같이 탭!')));
    this.unsub = M.sub((ev) => { if (M.on && ev.type === 'swing') hit(); });
    this.update(v);
    loop(this, () => this.draw());
  },
  update(v) { this.v = v; this.info.textContent = `우리 팀 한마음 ${v.team}% · 콤보 ${v.combo} · 내 성공 ${v.hits}`; },
  reply(r) { this.fb = { k: r.k, at: performance.now() }; if (r.k === 'rest') { sfx('bad', this.api.sfxOn); vibrate([40, 40, 40]); } else sfx(r.k === 'perfect' ? 'win' : 'good', this.api.sfxOn); },
  draw() {
    const { W, H, d } = fit(this.cv); const c = this.cv.getContext('2d'); const now = this.api.now(); const col = this.api.team.color;
    bg(c, W, H, '#1b1440', '#0b0e24');
    const cx = W / 2, cy = H * 0.5, R = Math.min(W, H) * 0.2;
    const nx = (this.v.nx || []).filter((b) => b.at > now - 250);
    const near = nx[0]; const k = near ? Math.max(0, 1 - Math.abs(near.at - now) / 160) : 0;
    // 북
    c.fillStyle = '#6b3a1e'; c.beginPath(); c.ellipse(cx, cy + R * 0.35, R * 1.05, R * 0.45, 0, 0, 7); c.fill();
    c.fillStyle = near?.rest && k > 0 ? '#555' : col; c.beginPath(); c.arc(cx, cy, R * (1 + k * 0.08), 0, 7); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 5 * d; c.stroke();
    c.fillStyle = '#ffffffcc'; c.font = `900 ${R * 0.55}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(near?.rest && near.at - now < 900 ? '✋' : '🥁', cx, cy);
    // 다가오는 원 (박자)
    for (const b of nx) { const dt = (b.at - now) / 1000; if (dt < -0.2 || dt > 1.6) continue; const rr = R * (1 + Math.max(0, dt) * 1.6); c.strokeStyle = b.rest ? '#ffffff55' : `rgba(255,212,59,${Math.max(0.2, 1 - dt / 1.6)})`; c.lineWidth = (b.rest ? 3 : 7) * d; c.setLineDash(b.rest ? [10 * d, 8 * d] : []); c.beginPath(); c.arc(cx, cy, rr, 0, 7); c.stroke(); }
    c.setLineDash([]);
    if (this.fb && performance.now() - this.fb.at < 650) { const t = (performance.now() - this.fb.at) / 650; c.globalAlpha = 1 - t; c.fillStyle = { perfect: '#ffd43b', good: '#2fd27a', rest: '#ff4d6d' }[this.fb.k]; c.font = `900 ${36 * d}px sans-serif`; c.fillText({ perfect: '딱 맞춤!', good: '좋아!', rest: '쉬는 박자!' }[this.fb.k], cx, cy - R * 1.6 - t * 30 * d); c.globalAlpha = 1; }
    if (this.tapAt && performance.now() - this.tapAt < 200) { c.fillStyle = '#ffffff22'; c.fillRect(0, 0, W, H); }
  },
  unmount() { this.dead = true; this.unsub?.(); cancelAnimationFrame(this.raf); },
};

// ---------------- 팀 릴레이 (팀 협동)
G.relay = {
  mount(root, v, api) {
    this.api = api; this.pend = 0; this.local = v.prog;
    this.top = h('div', { class: 'rlhd' }); this.bar = h('div', { class: 'rlbar' }, h('i')); this.btn = h('button', { class: 'rlbtn', style: { '--tc': api.team.color } }, '👟 달려! 탭탭탭');
    this.wait = h('div', { class: 'rlwait' }); this.legs = h('div', { class: 'muted' });
    onTap(this.btn, () => { if (!this.v.me) return; this.pend++; this.local++; vibrate(5); this.paint(); });
    root.append(h('div', { class: 'gwrap rlw', style: { '--tc': api.team.color } }, this.top, this.bar, this.btn, this.wait, this.legs));
    this.iv = setInterval(() => { if (this.pend) { const n = Math.min(8, this.pend); this.pend -= n; this.api.send({ a: 'tap', n }); } }, 120);
    this.update(v);
  },
  update(v) { const was = this.v?.me; this.v = v; if (!v.me) { this.pend = 0; this.local = 0; } else if (!was || v.prog === 0 || v.prog > this.local) this.local = Math.max(v.prog, was ? this.local : 0); this.paint(); },
  paint() {
    const v = this.v; this.btn.style.display = v.me ? '' : 'none'; this.bar.style.display = v.me ? '' : 'none';
    this.bar.firstChild.style.width = `${Math.min(100, (this.local / v.need) * 100)}%`;
    this.top.textContent = v.me ? '🏃 내 차례! 게이지를 채워요!' : `🏃 ${v.holder || '...'} 달리는 중`;
    this.top.classList.toggle('go', !!v.me);
    this.wait.textContent = v.me ? `${Math.max(0, v.need - this.local)}번 더!` : v.wait === 1 ? '⚡ 다음이 내 차례! 준비!' : `내 차례까지 ${v.wait}명 · 친구를 응원해요!`;
    this.wait.classList.toggle('soon', !v.me && v.wait === 1);
    this.legs.textContent = `우리 팀 ${v.legs}구간 달림`;
  },
  reply(r) { if (r.baton) { sfx('count', this.api.sfxOn); vibrate([80, 40, 80]); } },
  unmount() { clearInterval(this.iv); },
};
function onTap(el, fn) { el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(e); }, { passive: false }); el.addEventListener('contextmenu', (e) => e.preventDefault()); return el; }
function loop(self, fn) { const f = () => { if (self.dead) return; try { fn(); } catch (e) { console.error(e); } self.raf = requestAnimationFrame(f); }; self.raf = requestAnimationFrame(f); }

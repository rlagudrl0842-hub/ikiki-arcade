// 새 게임 참가자 폰 화면 (G에 등록)
import { h, sfx, vibrate } from './client.js';
import { G } from './play-games.js';
import { fruitSchedule, fruitPos, fruitLife, fruitR, FRUITS, ropeBeats } from './gen2.js';
import { M, motionChip } from './play-motion.js';
import * as S3 from './scene3d.js';
import { off3d, paint3d } from './x3d.js'; // 화면 배치는 그대로 두고 3D를 2D 캔버스에 옮겨 그림

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
  let id = null, vx = 0, vy = 0, sent = [0, 0], at = 0, tr = 0;
  const flush = (force) => {
    const now = performance.now();
    if (!force && Math.abs(vx - sent[0]) < 0.08 && Math.abs(vy - sent[1]) < 0.08) return;
    // 0.07초에 한 번까지만 보냄 — 막힌 변화는 다음 0.12초 확인까지 기다리지 않고 0.07초가 차는 순간 바로 보냄 (방향 바꿀 때 반응이 늦던 것)
    if (!force && now - at < 70) { if (!tr) tr = setTimeout(() => { tr = 0; flush(); }, 70 - (now - at)); return; }
    clearTimeout(tr); tr = 0;
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
  // 손 뗌(멈춤)은 꼭 서버에 닿아야 함: 한 번 더(0.25초·0.7초 뒤) 보냄 — 메시지가 몰려 하나가 버려져도 혼자 계속 가지 않게
  const stopAgain = () => { for (const ms of [250, 700]) setTimeout(() => { if (id == null && !vx && !vy && !keys.size) flush(true); }, ms); };
  const end = (e) => { if (e.pointerId !== id) return; id = null; vx = vy = 0; knob.style.transform = ''; pad.classList.remove('on'); onVec(0, 0); flush(true); stopAgain(); };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  pad.addEventListener('lostpointercapture', end); // 손가락을 뗀 신호를 놓쳐도(알림창·화면 전환) 계속 움직이지 않게
  // 컴퓨터 테스트용 방향키
  const keys = new Set();
  const kd = (e) => { if (!e.key.startsWith('Arrow')) return; keys.add(e.key); kv(); }; const ku = (e) => { keys.delete(e.key); kv(); };
  const kv = () => { vx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0); vy = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0); const l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l; onVec(vx, vy); flush(true); };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  // 다른 앱으로 가거나 화면이 꺼지면 손을 뗀 것으로 (방향키·손가락이 눌린 채 남아 혼자 계속 가던 문제 방지)
  const off = () => { keys.clear(); if (id != null) { id = null; knob.style.transform = ''; pad.classList.remove('on'); } if (vx || vy) { vx = vy = 0; onVec(0, 0); flush(true); } };
  const vis = () => { if (document.hidden) off(); };
  addEventListener('blur', off); document.addEventListener('visibilitychange', vis);
  const iv = setInterval(() => flush(), 120);
  pad.resync = () => flush(true); // 일시정지·재연결 뒤: 지금 방향을 서버에 다시 알림 (멈춘 동안 보낸 '손 뗌'은 서버가 버림)
  pad.stop = () => { clearInterval(iv); clearTimeout(tr); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', off); document.removeEventListener('visibilitychange', vis); };
  return pad;
}
// ================================================================ 좀비 술래잡기 폰 화면 (전체 화면 · 카메라 추적 · 화면 밖 상대 화살표 · 미니맵)
// 규칙·점수·서버 판정은 그대로, 폰에서 보이는 방식만 다룸
const ZC = { zombie: '#ff3b4f', human: '#3d8bff' }; // 화살표·미니맵 색: 좀비 빨강 · 사람 파랑
const UNIT_M = 40; // 경기장 40칸 = 1m (거리 표시용)
const EMO = new Map();
function emoImg(e, px) { const k = e + px; if (EMO.has(k)) return EMO.get(k); const S = Math.ceil(px * 1.4); const cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); c.font = `${px}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, S / 2, S / 2 + px * 0.06); EMO.set(k, cv); return cv; }
const lerpK = (dt, rate) => 1 - Math.exp(-dt * rate); // 화면 주사율과 상관없이 같은 빠르기로 따라감
const ZOMBIE = {
  mountZombie(root, api) {
    const Z = this.Z = { ents: new Map(), rp: null, cam: null, lastF: performance.now(), burst: [], warnVib: 0, mm: null };
    let mmOn = true; try { mmOn = localStorage.getItem('ikiki:zmm') !== '0'; } catch { /* */ }
    Z.mmOn = mmOn;
    const mmBtn = h('button', { class: `ztool ${mmOn ? 'on' : ''}`, title: '미니맵 보이기/숨기기', onclick: () => { Z.mmOn = !Z.mmOn; mmBtn.classList.toggle('on', Z.mmOn); try { localStorage.setItem('ikiki:zmm', Z.mmOn ? '1' : '0'); } catch { /* */ } } }, '🗺');
    const fsOk = !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false;
    const fsBtn = fsOk ? h('button', { class: 'ztool', title: '전체 화면', onclick: () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => api.toast('이 브라우저는 전체 화면을 지원하지 않아요')); } }, '⛶') : null;
    const menuBtn = h('button', { class: 'ztool', title: '메뉴', onclick: () => document.querySelector('.top .menu')?.click() }, '☰');
    const help = document.querySelector('.top .helpbtn'); const helpBtn = help ? h('button', { class: 'ztool', title: '게임 방법', onclick: () => help.click() }, '❓') : null;
    this.zwarn = h('div', { class: 'zwarn' });
    const chip = motionChip(api, '기울이기');
    root.append(h('div', { class: 'arena k-zombie' }, h('div', { class: 'amapw' }, this.cv, this.fx, this.zwarn), h('div', { class: 'ztop' }, this.st, h('div', { class: 'ztools' }, mmBtn, fsBtn, helpBtn, menuBtn)), this.pad, chip ? h('div', { class: 'zchip' }, chip) : null));
    document.body.classList.add('zgame');
  },
  unmountZombie() { document.body.classList.remove('zgame'); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); },
  // 서버가 보내 준 주변 사람들 위치를 번호로 이어 받아, 순간이동하듯 튀지 않게 부드럽게 따라감
  zTrack(v) {
    const Z = this.Z; if (!Z || v.spectator) return; const now = performance.now();
    const seen = new Set(); const n = v.near || [];
    for (let i = 0; i + 3 < n.length; i += 4) {
      const id = n[i + 3]; seen.add(id); const e = Z.ents.get(id);
      if (!e || Math.hypot(e.x - n[i], e.y - n[i + 1]) > 260) Z.ents.set(id, { x: n[i], y: n[i + 1], tx: n[i], ty: n[i + 1], z: n[i + 2], at: now });
      else { if (!e.z && n[i + 2]) Z.burst.push({ x: n[i], y: n[i + 1], at: now }); e.tx = n[i]; e.ty = n[i + 1]; e.z = n[i + 2]; e.at = now; }
    }
    for (const id of [...Z.ents.keys()]) if (!seen.has(id)) Z.ents.delete(id);
    Z.opp = []; const o = v.opp || []; for (let i = 0; i + 2 < o.length; i += 3) Z.opp.push({ x: o[i], y: o[i + 1], id: o[i + 2] });
    if (v.mm) Z.mm = v.mm;
    Z.bt = v.bt || [];
  },
  drawZombie(c, W, H, d, now) {
    const v = this.v; const Z = this.Z; const dt = Math.min(0.1, (now - Z.lastF) / 1000); Z.lastF = now;
    if (v.spectator || v.x == null) return;
    this.zLayout(W, H, d);
    // 1) 내 위치: 서버 위치 + 지금 방향으로 아주 조금 예측 → 부드럽게 따라감 (튀지 않게)
    const age = Math.min(0.25, (now - this.at) / 1000);
    // 예측은 경기장 벽 안쪽까지만 (전에는 벽 쪽으로 계속 밀면 '나'가 벽 밖·화면 밖으로 그려졌음)
    const tx = Math.max(14, Math.min(AW - 14, v.x + this.vec[0] * 330 * age * (v.stun ? 0 : 1))), ty = Math.max(14, Math.min(AH - 14, v.y + this.vec[1] * 330 * age * (v.stun ? 0 : 1)));
    if (!Z.rp || Math.hypot(Z.rp[0] - tx, Z.rp[1] - ty) > 260) Z.rp = [tx, ty]; else { const k = lerpK(dt, 16); Z.rp[0] += (tx - Z.rp[0]) * k; Z.rp[1] += (ty - Z.rp[1]) * k; }
    const [px, py] = Z.rp;
    // 2) 보이는 범위: 화면 크기에 맞춰 넓이를 정하고(폰·태블릿 모두 비슷한 크기로 보임), 경기장보다 넓어지지 않게 → 경기장 밖은 안 보임
    const cssW = W / d, cssH = H / d; const area = Math.max(300000, Math.min(640000, cssW * cssH * 1.7));
    const k = Math.max(W / AW, H / AH, Math.sqrt((W * H) / area)); const VW = W / k, VH = H / k;
    // 3) 카메라: 나를 화면 가운데보다 조금 위(조이스틱 위쪽)에 두고 부드럽게 따라감
    const padTop = this.padTopFrac ?? 0.75; const wantY = Math.min(0.44, padTop * 0.55);
    let cx = px, cy = py + VH * (0.5 - wantY);
    if (!Z.cam) Z.cam = [cx, cy]; else { const kk = lerpK(dt, 7); Z.cam[0] += (cx - Z.cam[0]) * kk; Z.cam[1] += (cy - Z.cam[1]) * kk; }
    Z.cam[0] = Math.max(VW / 2, Math.min(AW - VW / 2, Z.cam[0])); Z.cam[1] = Math.max(VH / 2, Math.min(AH - VH / 2, Z.cam[1]));
    const X = (x) => (x - Z.cam[0] + VW / 2) * k, Y = (y) => (y - Z.cam[1] + VH / 2) * k;
    Z.view = [k / d, VW, VH]; // 점검용: CSS 픽셀/칸, 보이는 너비·높이(칸)
    // 바닥 · 격자 · 벽
    const floor3 = this.r3 && paint3d(this, c, W, H, { cx: Z.cam[0], cy: Z.cam[1], VW, VH, t: now / 1000 }); // 3D 폐허 바닥 (같은 범위를 위에서)
    if (!floor3) S3.paint(c, W, H, 'zombie', now / 1000);
    if (!v.z) { c.fillStyle = '#12184566'; c.fillRect(0, 0, W, H); } // 사람일 땐 조금 푸르게
    c.strokeStyle = floor3 ? '#ffffff08' : '#ffffff12'; c.lineWidth = 1; c.beginPath();
    for (let x = Math.floor((Z.cam[0] - VW / 2) / 100) * 100; x <= Z.cam[0] + VW / 2; x += 100) { c.moveTo(X(x), 0); c.lineTo(X(x), H); }
    for (let y = Math.floor((Z.cam[1] - VH / 2) / 100) * 100; y <= Z.cam[1] + VH / 2; y += 100) { c.moveTo(0, Y(y)); c.lineTo(W, Y(y)); }
    c.stroke();
    c.strokeStyle = '#ff4d6d'; c.lineWidth = 6 * d; c.strokeRect(X(0), Y(0), AW * k, AH * k);
    // 4) 다른 사람들 (번호별로 부드럽게)
    const kk = lerpK(dt, 12); const R0 = Math.max(10 * d, 16 * k); // 몸 크기는 경기장 기준(반지름 16칸) → 화면 배율과 같이 커지고 작아짐
    const zi = emoImg('🧟', Math.round(R0 * 1.3));
    for (const e of Z.ents.values()) {
      e.x += (e.tx - e.x) * kk; e.y += (e.ty - e.y) * kk;
      const sx = X(e.x), sy = Y(e.y); if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) continue;
      if (e.z) { c.fillStyle = '#56d364'; c.beginPath(); c.arc(sx, sy, R0, 0, 7); c.fill(); c.drawImage(zi, sx - zi.width / 2, sy - zi.height / 2); }
      else { c.fillStyle = '#ffffffdd'; c.beginPath(); c.arc(sx, sy, R0 * 0.75, 0, 7); c.fill(); }
    }
    // 5) 잡기 순간 효과 (퍼지는 고리 + 반짝)
    Z.burst = Z.burst.filter((b) => now - b.at < 700);
    for (const b of Z.burst) { const t = (now - b.at) / 700; c.strokeStyle = `rgba(86,211,100,${1 - t})`; c.lineWidth = (b.mine ? 8 : 5) * d * (1 - t) + 1; c.beginPath(); c.arc(X(b.x), Y(b.y), R0 * (1 + t * (b.mine ? 4 : 2.5)), 0, 7); c.stroke(); }
    for (let i = 0; i + 2 < (Z.bt || []).length; i += 3) { const ag = Z.bt[i + 2] + (now - this.at) / 1000; if (ag > 0.8) continue; const t = ag / 0.8; c.strokeStyle = `rgba(255,59,79,${0.8 * (1 - t)})`; c.lineWidth = 3 * d; c.beginPath(); c.arc(X(Z.bt[i]), Y(Z.bt[i + 1]), R0 * (1 + t * 2.5), 0, 7); c.stroke(); }
    // 6) 나
    const mx = X(px), my = Y(py); const pulse = 1 + 0.2 * Math.sin(now / 160);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(mx, my, (R0 + 4 * d) * pulse, 0, 7); c.fill();
    c.fillStyle = v.z ? '#2fbf4a' : this.api.team.color; c.beginPath(); c.arc(mx, my, R0, 0, 7); c.fill();
    if (v.z) c.drawImage(zi, mx - zi.width / 2, my - zi.height / 2);
    c.fillStyle = '#fff'; c.font = `bold ${12 * d}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('나', mx, my - R0 * 2.1 < 10 * d ? my + R0 * 2.1 : my - R0 * 2.1);
    // 7) 상대: 가장 가까운 상대 거리 → 좀비 접근 경고 / 잡을 수 있는 사람 표시
    const opp = new Map(); for (const o of Z.opp || []) opp.set(o.id, { x: o.x, y: o.y, id: o.id });
    for (const [id, e] of Z.ents) if (!!e.z !== !!v.z) opp.set(id, { x: e.x, y: e.y, id }); // 가까운 상대는 부드럽게 움직이는 위치로
    const list = [...opp.values()].map((o) => ({ ...o, d: Math.hypot(o.x - px, o.y - py) })).sort((a, b) => a.d - b.d);
    const near1 = list[0];
    this.zDanger(near1, v, d, now, W, H, c);
    // 8) 화면 밖 상대: 가장자리 화살표 (가까운 순 · 방향이 비슷하면 하나로 묶어 '×2' · 최대 3개)
    this.zArrows(c, list, X, Y, W, H, d, v);
    // 9) 미니맵 (오른쪽 위)
    if (Z.mmOn) this.zMini(c, W, H, d, v, px, py, VW, VH, Z.cam);
  },
  // 화면 배치 재기 (크기가 바뀔 때만): 위 점수줄 아래·조이스틱 위쪽을 피해 화살표·미니맵을 놓음
  zLayout(W, H, d) {
    const Z = this.Z; if (Z.lay && Z.lay[0] === W && Z.lay[1] === H) return; Z.lay = [W, H];
    const cr = this.cv.getBoundingClientRect(); const pr = this.pad.getBoundingClientRect(); const tr = this.cv.closest('.arena')?.querySelector('.ztop')?.getBoundingClientRect();
    this.topPx = tr ? Math.max(0, tr.bottom - cr.top) * d : 56 * d;
    this.padPx = Math.max(0, cr.bottom - pr.top + 8) * d;
    this.padTopFrac = cr.height ? (pr.top - cr.top) / cr.height : 0.75;
  },
  zDanger(n, v, d, now, W, H, c) {
    const Z = this.Z; const w = this.zwarn;
    if (!n || v.stun) { if (w.textContent) { w.textContent = ''; w.className = 'zwarn'; } return; }
    if (!v.z && n.d < 260) {
      const a = Math.max(0, Math.min(1, 1 - (n.d - 60) / 200));
      const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(1, `rgba(255,0,40,${0.18 + 0.35 * a * (0.75 + 0.25 * Math.sin(now / 90))})`); c.fillStyle = g; c.fillRect(0, 0, W, H);
      const t = `⚠️ 좀비 접근! ${Math.max(1, Math.round(n.d / UNIT_M))}m`; if (w.textContent !== t) { w.textContent = t; w.className = 'zwarn on'; }
      if (n.d < 170 && now - Z.warnVib > 1200) { Z.warnVib = now; vibrate(60); }
    } else if (v.z && n.d < 220) {
      const t = `🎯 사람이 가까워요! ${Math.max(1, Math.round(n.d / UNIT_M))}m`; if (w.textContent !== t) { w.textContent = t; w.className = 'zwarn on hunt'; }
    } else if (w.textContent) { w.textContent = ''; w.className = 'zwarn'; }
  },
  zArrows(c, list, X, Y, W, H, d, v) {
    const m = 30 * d; const topM = this.topPx ?? 56 * d; const botM = this.padPx ?? 0; // 위 점수줄·아래 조이스틱은 피함
    const L = m, T = topM + m * 0.4, Rr = W - m, B = H - Math.max(m, botM);
    const mx = X(this.Z.rp[0]), my = Y(this.Z.rp[1]);
    const groups = [];
    for (const o of list) {
      const sx = X(o.x), sy = Y(o.y);
      if (sx > 4 && sx < W - 4 && sy > 4 && sy < H - 4) continue; // 화면 안에 보이면 화살표 없음
      const ang = Math.atan2(sy - my, sx - mx);
      const g = groups.find((q) => Math.abs(Math.atan2(Math.sin(ang - q.ang), Math.cos(ang - q.ang))) < 0.42);
      if (g) { g.n++; continue; }
      if (groups.length >= 3) continue;
      groups.push({ ang, d: o.d, n: 1 });
    }
    const col = v.z ? ZC.human : ZC.zombie; // 내가 좀비면 사람(파랑), 사람이면 좀비(빨강)
    for (const g of groups) {
      // 나에서 상대 쪽으로 쏜 선이 화면 안쪽 사각형 테두리와 만나는 곳
      const dx = Math.cos(g.ang), dy = Math.sin(g.ang); let t = Infinity;
      if (dx > 0) t = Math.min(t, (Rr - mx) / dx); if (dx < 0) t = Math.min(t, (L - mx) / dx); if (dy > 0) t = Math.min(t, (B - my) / dy); if (dy < 0) t = Math.min(t, (T - my) / dy);
      let ax = Math.max(L, Math.min(Rr, mx + dx * t)), ay = Math.max(T, Math.min(B, my + dy * t));
      const mb = this.Z.mmOn && this.Z.mmBox; if (mb && ax > mb[0] * d - m * 0.6 && ay < (mb[1] + mb[3]) * d + m * 0.6) ay = (mb[1] + mb[3]) * d + m * 0.8; // 미니맵 밑으로
      const s = 15 * d; c.save(); c.translate(ax, ay); c.rotate(g.ang);
      c.fillStyle = col; c.strokeStyle = '#fff'; c.lineWidth = 2 * d; c.beginPath(); c.moveTo(s, 0); c.lineTo(-s * 0.7, -s * 0.75); c.lineTo(-s * 0.35, 0); c.lineTo(-s * 0.7, s * 0.75); c.closePath(); c.fill(); c.stroke(); c.restore();
      const lab = `${Math.max(1, Math.round(g.d / UNIT_M))}m${g.n > 1 ? ` ×${g.n}` : ''}`;
      c.font = `900 ${12 * d}px sans-serif`; const tw = c.measureText(lab).width + 10 * d;
      const lx = Math.max(L - m * 0.6 + tw / 2, Math.min(W - tw / 2 - 2, ax - dx * 26 * d)), ly = Math.max(T, Math.min(H - 10 * d, ay - dy * 26 * d));
      c.fillStyle = '#000a'; c.beginPath(); c.roundRect(lx - tw / 2, ly - 9 * d, tw, 18 * d, 9 * d); c.fill();
      c.fillStyle = col === ZC.zombie ? '#ff8a96' : '#9cc2ff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(lab, lx, ly + 0.5 * d);
    }
    this.Z.arrowsN = groups.length; this.Z.arrowsG = groups.map((g) => [+g.ang.toFixed(2), g.n]); // 점검용
  },
  zMini(c, W, H, d, v, px, py, VW, VH, cam) {
    const Z = this.Z; const mw = Math.min(W * 0.34, 150 * d), mh = mw * AH / AW; const x0 = W - mw - 8 * d, y0 = (this.topPx ?? 56 * d) + 6 * d; const s = mw / AW;
    c.fillStyle = '#0b0e24ee'; c.fillRect(x0, y0, mw, mh); c.strokeStyle = '#ffffff55'; c.lineWidth = 1.5 * d; c.strokeRect(x0, y0, mw, mh);
    const mm = Z.mm;
    if (mm?.pts) { for (let i = 0; i + 2 < mm.pts.length; i += 3) { c.fillStyle = mm.pts[i + 2] ? ZC.zombie : ZC.human; c.fillRect(x0 + mm.pts[i] * 10 * s - 1.5 * d, y0 + mm.pts[i + 1] * 10 * s - 1.5 * d, 3 * d, 3 * d); } }
    else if (mm?.grid) { const cw = mw / mm.gx, ch = mh / mm.gy; for (let i = 0; i < mm.grid.length; i++) { const ch0 = mm.grid[i]; if (ch0 === '.') continue; c.fillStyle = ch0 === 'z' ? ZC.zombie + 'cc' : ch0 === 'h' ? ZC.human + 'cc' : '#c77dffcc'; c.fillRect(x0 + (i % mm.gx) * cw, y0 + Math.floor(i / mm.gx) * ch, cw, ch); } }
    c.strokeStyle = '#ffffffaa'; c.lineWidth = 1 * d; c.strokeRect(x0 + (cam[0] - VW / 2) * s, y0 + (cam[1] - VH / 2) * s, VW * s, VH * s); // 지금 보이는 범위
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x0 + px * s, y0 + py * s, 3.6 * d, 0, 7); c.fill(); c.fillStyle = v.z ? '#2fbf4a' : this.api.team.color; c.beginPath(); c.arc(x0 + px * s, y0 + py * s, 2.4 * d, 0, 7); c.fill();
    Z.mmBox = [x0 / d, y0 / d, mw / d, mh / d]; // 점검용 (CSS 픽셀)
  },
};
function arenaGame(kind) {
  return {
    mount(root, v, api) {
      this.api = api; this.v = v; this.at = performance.now(); this.vec = [0, 0];
      this.cv = h('canvas', { class: 'amap' });
      this.st = h('div', { class: 'ast' });
      this.fx = h('div', { class: 'afx' });
      this.pad = joystick(api, (x, y) => { this.vec = [x, y]; });
      if (kind === 'zombie') { this.mountZombie(root, api); off3d(this, this.cv, () => import('./zomb3d.js').then((m) => m.createZomb3D)); } // 좀비: 바닥 장면만 3D (사람·화살표·미니맵은 그대로)
      else {
        const mw = h('div', { class: 'amapw' }, this.cv, this.fx);
        root.append(h('div', { class: `arena k-${kind}` }, motionChip(api, '폰을 기울여 이동'), this.st, mw, this.pad));
        // 3D 경기장 (WebGL 되고 화질 '가벼움'이 아닐 때만 · 실패·느림이면 원래 2D로 자동 복귀)
        if (S3.quality() !== 'low' && !/[?&]r3d=0/.test(location.search)) {
          const cv3 = h('canvas', { class: 'amap3', 'aria-hidden': 'true' }); mw.prepend(cv3); this.cv.classList.add('on3'); // 자리를 처음부터 잡아 둠 (불러온 뒤 조이스틱이 밀리지 않게)
          this.drop3d = (why) => { try { this.r3?.dispose(); } catch { /* */ } this.r3 = null; cv3.remove(); this.cv.classList.remove('on3'); window.__r3d = `2d:${why}`; S3.mark3dFail(why); };
          import('./arena3d.js').then((m) => { if (this.dead) return cv3.remove(); const r = m.createArena3D(cv3, { kind, color: api.team.color, teamColor: (i) => api.teamColor(i), quality: S3.quality(), onSlow: (why) => this.drop3d(why) }); if (r) { this.r3 = r; this.cv.classList.add('on3'); window.__r3d = '3d'; } else this.drop3d('nogl'); }).catch(() => this.drop3d('load'));
        }
      }
      this.lastT = [0, 0];
      this.tiv = setInterval(() => { if (!M.on || this.pad.classList.contains('on')) return; const [x, y] = M.tilt(); const v = [Math.round(x * 100) / 100, Math.round(y * 100) / 100]; this.vec = v; const lastT = this.lastT; if (Math.abs(v[0] - lastT[0]) < 0.08 && Math.abs(v[1] - lastT[1]) < 0.08) return; this.lastT = v; api.send({ a: 'mv', x: v[0], y: v[1] }); }, 100);
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
        st.append(h('b', {}, v.z ? `🧟 나는 좀비 · ${v.tags}명 잡음` : '🙂 사람 · 도망!'), h('span', {}, `🙂${v.humans} · 🧟${v.zs}`));
        this.zTrack(v, prev);
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
      if (r.tag) { sfx('good', this.api.sfxOn); vibrate([30, 40, 30]); this.flash('tag', `🧟 ${r.who} 잡았다!`); }
      if (kind === 'zombie' && (r.tag || r.bitten) && r.x != null) (this.Z.burst = this.Z.burst || []).push({ x: r.x, y: r.y, at: performance.now(), mine: true });
      if (r.big) { sfx('win', this.api.sfxOn); vibrate([40, 30, 40]); this.flash('tag', '대형 보석 +5'); }
    },
    resync() { if (M.on && !this.pad.classList.contains('on')) this.lastT = [9, 9]; else this.pad.resync(); },
    flash(cls, text) { const f = h('div', { class: `aflash ${cls}` }, text); this.fx.append(f); setTimeout(() => f.remove(), 1200); },
    draw() {
      const v = this.v; const { W, H, d } = fitCanvas(this.cv); const c = this.cv.getContext('2d');
      if (kind === 'zombie') return this.drawZombie(c, W, H, d, performance.now());
      if (this.r3) { // 3D: 경기장은 3D로, 2D 캔버스에는 '나' 글자만
        let p = null; try { p = this.r3.render({ v, vec: this.vec, age: (performance.now() - this.at) / 1000, grid: this.grid, t: performance.now() / 1000 }); } catch (e) { console.error(e); this.drop3d('err'); }
        c.clearRect(0, 0, W, H); if (p) { c.fillStyle = '#fff'; c.shadowColor = '#000'; c.shadowBlur = 6 * d; c.font = `900 ${13 * d}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(v.dead ? '💀 나' : '나', p.sx * W, p.sy * H); c.shadowBlur = 0; }
        return;
      }
      const sx = W / AW, sy = H / AH;
      c.clearRect(0, 0, W, H);
      S3.paint(c, W, H, kind, performance.now() / 1000); // 게임별 3D 경기장 바닥
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
    unmount() { stopLoop(this); this.drop3d?.('end'); clearInterval(this.tiv); this.pad.stop(); document.body.classList.remove('zmode'); if (kind === 'zombie') this.unmountZombie(); },
    ...(kind === 'zombie' ? ZOMBIE : {}),
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
    this.cv3 = h('canvas', { class: 'mg3', style: { display: 'none' } }); // 3D 운동장 (준비되면 트랙 대신)
    root.append(h('div', { class: 'gwrap mg' }, this.ban, this.track, this.cv3, this.info, this.btn));
    off3d(this, this.cv3, () => import('./mug3d.js').then((m) => m.createMug3D), { color: api.team.color });
    // 3D를 시도하면 처음부터 자리를 잡아 둠 (불러온 뒤에 생기면 버튼이 밀려 누르던 손가락이 빗나감)
    if (this.drop3d) { this.cv3.style.display = ''; this.track.style.display = 'none'; this.try3d = true; }
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
    if (this.r3) { if (this.cv3.style.display === 'none') { this.cv3.style.display = ''; this.track.style.display = 'none'; } const { W, H } = fitCanvas(this.cv3); const c = this.cv3.getContext('2d'); if (!paint3d(this, c, W, H, { v, holding: this.holding, t: performance.now() / 1000 })) c.clearRect(0, 0, W, H); }
    else if (this.no3d && this.cv3.style.display !== 'none') { // 3D가 꺼져도 칸 크기는 그대로 두고 그 안에 2D 트랙을 그림 (버튼이 다시 움직이면 누르던 손가락이 빗나감)
      const { W, H, d } = fitCanvas(this.cv3); const c = this.cv3.getContext('2d'); S3.paint(c, W, H, 'mugung', performance.now() / 1000);
      const y = H * 0.62, x0 = W * 0.08, x1 = W * 0.92; c.strokeStyle = '#ffffff55'; c.lineWidth = 3 * d; c.setLineDash([8 * d, 8 * d]); c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); c.setLineDash([]);
      c.font = `${28 * d}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🏁', x1, y - 6 * d); c.fillText(this.api.team.icon, x0 + (x1 - x0) * Math.min(1, v.pos / 100), y - 6 * d);
    }
    if (v.ph === 'sing') {
      const k = Math.max(0, Math.min(1, 1 - (v.until - this.api.now()) / (v.dur * 1000)));
      const n = Math.max(1, Math.ceil(k * SONG.length));
      const txt = `🙈 ${SONG.slice(0, n)}`; if (b.textContent !== txt) { b.textContent = txt; b.className = 'mgban sing'; }
    } else if (v.ph === 'turn') { if (b.className !== 'mgban turn') { b.textContent = '😮 돌아본다!'; b.className = 'mgban turn'; } }
    else if (b.className !== 'mgban look') { b.textContent = '👀 멈춰!!'; b.className = 'mgban look'; }
  },
  unmount() { stopLoop(this); this.drop3d?.('end'); if (this.holding) this.api.send({ a: 'go', on: false }); },
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
    off3d(this, this.cv, () => import('./rope3d.js').then((m) => m.createRope3D), { color: api.team.color }); // 3D 운동장 줄넘기 (안 되면 2D)
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
    if (paint3d(this, c, W, H, { ph, jumpAge: this.jumpAt ? (performance.now() - this.jumpAt) / 1000 : 9, t: performance.now() / 1000 })) { const rest = (b[k] - now) / per; this.btn.style.setProperty('--ring', `${Math.max(0, Math.min(1, rest))}`); this.btn.classList.toggle('now', Math.abs(now - b[k]) < this.v.win || Math.abs(now - prev) < this.v.win); return; }
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
  unmount() { stopLoop(this); this.drop3d?.('end'); },
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
    this.bl = []; off3d(this, this.cv, () => import('./fire3d.js').then((m) => m.createFire3D)); // 3D 밤 강가 불꽃놀이 (톡은 어디든 그대로)
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
    (this.bl = this.bl || []).push({ x: x.x, y: y * 0.8 + 0.08, hue: x.hue, at: performance.now() }); if (this.bl.length > 6) this.bl.shift(); // 3D 화면용 터짐 기록
    for (let i = 0; i < 46; i++) { const a = (i / 46) * Math.PI * 2; const sp = 0.35 + Math.random() * 0.25; this.parts.push({ x: x.x, y: 1 - y * 0.8 - 0.08, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, at: performance.now(), col }); }
    sfx('boom', this.api.sfxOn);
  },
  draw() {
    const { W, H, d } = fitCanvas(this.cv); const c = this.cv.getContext('2d');
    const now = this.api.now(); const R = this.v.R || [];
    if (this.r3) { const rk = []; for (let i = 0; i < R.length; i++) { const x = R[i]; if (this.mine[i] != null && this.mine[i] !== 'wait') continue; const y = this.rocketY(x, now); if (y != null) rk.push({ x: x.x, y }); } if (paint3d(this, c, W, H, { rockets: rk, bursts: this.bl, t: performance.now() / 1000 })) return; }
    c.fillStyle = 'rgba(8,10,30,0.35)'; c.fillRect(0, 0, W, H);
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
  unmount() { stopLoop(this); this.drop3d?.('end'); },
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
    off3d(this, this.cv, () => import('./fruit3d.js').then((m) => m.createFruit3D)); // 3D 과일 (위에서 똑바로 보는 화면이라 자르는 자리 그대로)
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
        this.cut.add(f.id); if (!this.pending.length) this.pendT = Math.round(this.api.now()); this.pending.push(f.id);
        this.halves.push({ f, x, y, at: performance.now(), ang: Math.atan2(vy, vx) });
        if (f.type === 'b') { vibrate([150, 50, 150]); sfx('boom', this.api.sfxOn); } else { vibrate(8); sfx('tap', this.api.sfxOn); }
      }
    }
  },
  flush() { if (!this.pending.length) return; this.api.send({ a: 'cut', ids: this.pending.slice(0, 8), ts: this.pendT ?? Math.round(this.api.now()) }); this.pending = this.pending.slice(8); this.pendT = this.pending.length ? Math.round(this.api.now()) : null; },
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
    const sec = this.now(); const hh = H / W; this.drawSec = sec; // 점검용: 이 그림의 게임 시각
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (this.r3) { // 3D: 과일·자른 조각은 3D, 손가락 궤적만 2D로 위에
      const items = []; for (const f of this.sched) { if (this.cut.has(f.id)) continue; const [x, y0, dt] = fruitPos(f, sec); if (dt < 0 || dt > fruitLife(f)) continue; items.push({ id: f.id, x, y: y0 / 1.5 * hh, rot: dt * f.spin, f, r: fruitR(f) * 1.1 }); }
      const tt = performance.now(); this.halves = this.halves.filter((x) => tt - x.at < 700);
      const hv = this.halves.map((o) => ({ key: o.f.id, f: o.f, x: o.x, y: o.y, k: (tt - o.at) / 700, ang: o.ang, r: fruitR(o.f) * 1.1 }));
      if (paint3d(this, c, W, H, { items, halves: hv })) {
        this.trail = this.trail.filter((p) => tt - p[2] < 160);
        if (this.trail.length > 1) { c.strokeStyle = '#fff'; c.shadowColor = '#9fe8ff'; c.shadowBlur = 12 * d; c.lineWidth = 6 * d; c.lineCap = 'round'; c.beginPath(); this.trail.forEach((p, i) => (i ? c.lineTo(p[0] * W, p[1] * W) : c.moveTo(p[0] * W, p[1] * W))); c.stroke(); c.shadowBlur = 0; }
        return;
      }
    }
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
  unmount() { stopLoop(this); this.drop3d?.('end'); clearInterval(this.iv); this.flush(); },
};

// ================================================================ 골든벨 서바이벌
// 골든벨 경쟁 상황: 이번 문제를 낸 사람 수 · 살아 있는 사람 수 · 내 연속 정답 (정답·남의 답은 공개 시간 전까지 안 보여 줌)
const bellRace = (v) => (v.n ? `✋ 제출 ${v.nA ?? 0}/${v.nAl ?? 0}명 · 🛡 생존 ${v.nAl ?? 0}/${v.n}명${v.streak ? ` · 🔥 내 연속 정답 ${v.streak}` : ''}` : '');
G.bell = {
  mount(root, v, api) { this.api = api; this.root = h('div', { class: 'gwrap bell2' }); root.append(this.root); this.update(v); this.t = setInterval(() => this.tick(), 250); },
  update(v) {
    const st = this.root.querySelector('.bellrace'); if (st) st.textContent = bellRace(v); // 다른 참가자 상황(수만)은 화면을 다시 만들지 않고 글자만 바꿈 (보기를 누르는 중에 깜빡이지 않게)
    const key = `${v.qi}:${v.ph}:${v.submitted}:${v.my}:${v.alive}`; this.v = v; if (key === this.key) return; this.key = key;
    const R = this.root; R.innerHTML = '';
    const head = h('div', { class: 'bellh' }, h('span', {}, `🔔 ${v.qi + 1} / ${v.N}`), v.revive ? h('span', { class: 'chip hot' }, '🔥 패자부활전') : null, h('span', { class: 'belltime' }));
    this.raceEl = h('div', { class: 'bellrace' }, bellRace(v));
    const status = v.kid ? null : h('div', { class: `bellst ${v.alive ? 'ok' : 'out'}` }, v.alive ? `✅ 생존 중 · ${v.ok}개 정답` : '😤 탈락 중 · 이번 문제 맞히면 바로 부활!');
    // 답을 내면 보기를 감추고 '제출 완료'만 (옆 사람이 보고 따라 하기 어렵게) · 보기 순서는 사람마다 다름
    if (v.ph === 'q' && (v.submitted || this.sent === v.qi)) {
      R.append(head, status, this.raceEl, h('div', { class: 'bellq' }, v.text), h('div', { class: 'bellsent' }, h('div', { class: 'cic' }, '📨'), h('b', {}, '제출 완료'), h('small', {}, '모두 내거나 시간이 끝나면 정답을 함께 공개해요')));
      return this.tick();
    }
    const can = v.ph === 'q' && !v.submitted; // 탈락해도 매 문제 누를 수 있음
    const opts = h('div', { class: `bellopts n${(v.opts || []).length}` }, (v.opts || []).map((o, i) => {
      const cls = v.ph === 'reveal' ? (i === v.ans ? 'right' : i === v.my ? 'wrong' : 'dim') : '';
      return onPress(h('button', { class: `bopt ${cls}`, disabled: !can }, h('b', {}, '①②③④'[i]), o), () => { if (!can || this.sent === v.qi) return; this.sent = v.qi; this.api.send({ a: 'ans', q: v.qi, c: i }); vibrate(15); this.key = ''; this.update(this.v); });
    }));
    let foot = null;
    if (v.ph === 'reveal') foot = h('div', { class: `bellres ${v.my === v.ans ? 'ok' : 'no'}` }, v.my === v.ans ? '🎉 정답!' : v.my == null ? '⏰ 시간 초과' : '❌ 땡!');
    R.append(head, status, this.raceEl, h('div', { class: 'bellq' }, v.text), opts, foot);
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
    if (key === this.key) { if (v.me === 'guess' && v.sk) { this.redraw(v.sk); this.seq = v.seq; } else if (v.me === 'guess' && v.seq !== this.seq && performance.now() - (this.syncAt || 0) > 1500) { this.syncAt = performance.now(); this.api.send({ a: 'sync' }); } if (v.me === 'draw') this.sv.textContent = `팀원 ${v.solved}/${v.n} 맞힘`; return; }
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
      const keep = !v.sk && this.seq === v.seq ? (this.sk || []) : null; this.seq = v.sk ? v.seq : keep ? v.seq : -1; const sk0 = v.sk || keep || []; requestAnimationFrame(() => this.redraw(sk0));
      if (v.me === 'guess' && this.seq !== v.seq) { this.syncAt = performance.now(); this.api.send({ a: 'sync' }); }
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
    if (r.seq != null) this.seq = r.seq;
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
    // 작은 폰(360×640)에서도 연타 버튼이 화면 안에 보이도록: 연타 버튼을 먼저, 마이크·몸동작 버튼은 그 아래
    root.append(h('div', { class: 'gwrap shout2' }, this.ph, this.meter, this.team, this.tapBtn, this.micBtn, motionChip(api, '폰을 흔들어 응원'), h('div', { class: 'muted small' }, '소리는 녹음되지 않고 크기만 재요')));
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

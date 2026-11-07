// 2·3차 게임 대형 화면 (V에 등록)
import { h } from './client.js';
import { V } from './screen-games.js';
import { loop, canvas, teamPanel, feed, figure, token } from './screen-n.js';
import * as S3 from './scene3d.js'; // 게임별 3D 배경
const tone = () => document.body.dataset.tone || 'base'; const P3 = (c, W, H, id, dim) => { S3.paint(c, W, H, id, performance.now() / 1000, { tone: tone() }); if (dim) { c.fillStyle = `rgba(7,10,30,${dim})`; c.fillRect(0, 0, W, H); } };

const stop = (self) => { self.dead = true; cancelAnimationFrame(self.raf); };

// ---------------------------------------------------------------- 손맛 게임 공용: 팀 레인 + 달리는 선수 + TOP5 + 하이라이트
const HI = {
  dalgona: { 1: '완벽한 달고나!' }, tuho: { 1: '정중앙 명중!' }, basket: { 1: '클린슛!' }, runner: { 1: '100m 돌파!' }, flappy: { 1: '10개 연속 통과!' },
  stairs: { 1: '50계단 돌파!' }, bridge: { 1: '정중앙 착지!' }, eggs: { 1: '황금 달걀!' }, fishing: { 3: '상어를 낚았다!', 4: '황금 고래!!' },
};
const THEME = {
  dalgona: ['#3b2412', '#140b05', '🍪', '점'], tuho: ['#21345a', '#0b1328', '🏹', '점'], basket: ['#3b2416', '#120a05', '🏀', '점'], runner: ['#1d2b6b', '#0b1030', '🏃', 'm'],
  flappy: ['#2c5fc0', '#122150', '🐤', '개'], stairs: ['#4f63c9', '#151a45', '🪜', '칸'], bridge: ['#7a3a5a', '#24122e', '🌉', '칸'], eggs: ['#8a5a2a', '#2a1a0a', '🥚', '개'],
  fishing: ['#0e4d8f', '#05172f', '🎣', '점'], spot: ['#2a2350', '#0c0a22', '🔍', '개'],
};
// ---------------------------------------------------------------- 팀별 실시간 연출 (폰 안에서 도는 게임을 대형 화면에서 보이게)
// 실제 팀 점수(평균)와 점수가 오른 순간(pulse)으로 팀마다 대표 캐릭터 1명이 움직임 — 폰 데이터는 더 받지 않음
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const ease = (a) => 1 - (1 - a) ** 3;
function liveScene(id, c, w, h, col, v, age, t) {
  // age: 마지막 점수 오른 뒤 지난 시간(ms) · t: 시계(초) · 바닥선 gy
  const gy = h * 0.82, s = Math.min(w, h) * 0.17, hit = age < 900, a = Math.min(1, age / 900);
  const run = (x, y, k = 1) => figure(c, x, y, s * k, col, { ph: (t * 1.6) % 1 });
  if (id === 'runner') { // 달리는 선수 + 다가오는 장애물 · 점수 오르면 점프
    c.fillStyle = '#ffffff22'; for (let i = 0; i < 8; i++) { const x = ((i * w) / 6 - (t * 260) % (w / 6)); c.fillRect(x, gy + 6, w / 14, 4); }
    const ox = w - ((t * 260) % (w * 1.2)); c.fillStyle = '#ff6b6b'; rr(c, ox, gy - s * 0.7, s * 0.35, s * 0.7, 6); c.fill();
    figure(c, w * 0.3, gy, s, col, { ph: (t * 2.2) % 1, air: hit ? Math.sin(a * Math.PI) : 0 });
  } else if (id === 'flappy') { // 파이프 사이를 나는 새 · 점수 오르면 날갯짓
    for (let i = 0; i < 3; i++) { const x = w - ((t * 140 + i * w / 2.6) % (w * 1.15)); const gap = h * (0.3 + 0.18 * Math.sin(i * 2.3 + Math.floor((t * 140 + i * w / 2.6) / (w * 1.15)))); c.fillStyle = '#3fbf5f'; c.fillRect(x, 0, s * 0.6, gap - s * 0.7); c.fillRect(x, gap + s * 0.7, s * 0.6, h); }
    const by = h * 0.45 + Math.sin(t * 3) * s * 0.4 - (hit ? (1 - a) * s * 0.6 : 0); const bx = w * 0.3;
    c.fillStyle = col; c.beginPath(); c.ellipse(bx, by, s * 0.42, s * 0.34, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(bx + s * 0.18, by - s * 0.1, s * 0.1, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(bx + s * 0.21, by - s * 0.1, s * 0.05, 0, 7); c.fill();
    c.fillStyle = '#ffb02e'; c.beginPath(); c.moveTo(bx + s * 0.38, by); c.lineTo(bx + s * 0.62, by + s * 0.06); c.lineTo(bx + s * 0.38, by + s * 0.14); c.fill();
    c.fillStyle = '#ffffffcc'; c.beginPath(); c.ellipse(bx - s * 0.12, by + s * 0.04, s * 0.22, s * (hit ? 0.04 + 0.16 * Math.abs(Math.sin(t * 20)) : 0.1), -0.3, 0, 7); c.fill();
  } else if (id === 'stairs') { // 계단을 오르는 선수 (점수만큼 올라감)
    const n = 7, sw = w / (n + 1), sh = h * 0.09; const step = Math.floor(v) % n;
    for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#ffffff30' : '#ffffff20'; c.fillRect(i * sw + sw * 0.3, gy - i * sh, sw, h); }
    const k = hit ? ease(a) : 1; const i0 = Math.max(0, step - 1); const x = (i0 + (step - i0) * k) * sw + sw * 0.8, y = gy - (i0 + (step - i0) * k) * sh;
    figure(c, x, y, s * 0.9, col, { ph: hit ? (t * 3) % 1 : 0, air: hit ? Math.sin(a * Math.PI) * 0.5 : 0 });
  } else if (id === 'bridge') { // 유리 징검다리를 건너뛰는 선수
    const n = 6, tw = w / n; for (let i = 0; i < n; i++) { c.fillStyle = '#9fe6ff55'; rr(c, i * tw + tw * 0.12, gy - 4, tw * 0.76, 12, 4); c.fill(); c.strokeStyle = '#d8f6ff'; c.lineWidth = 2; c.stroke(); }
    c.fillStyle = '#00000044'; c.fillRect(0, gy + 14, w, h);
    const p = Math.floor(v) % (n - 1); const k = hit ? ease(a) : 1; const x = (Math.max(0, p - 1) + (p - Math.max(0, p - 1)) * k) * tw + tw / 2;
    figure(c, x, gy - 4, s * 0.9, col, { air: hit ? Math.sin(a * Math.PI) : 0, arms: hit ? 0.8 : 0.1 });
  } else if (id === 'fishing') { // 물 위 찌 · 점수 오르면 물고기가 튀어 오름
    c.fillStyle = '#1e6fb8aa'; c.fillRect(0, h * 0.55, w, h); c.strokeStyle = '#bfe6ff66'; c.lineWidth = 2; c.beginPath(); for (let x = 0; x <= w; x += 12) c.lineTo(x, h * 0.55 + Math.sin(x / 30 + t * 2) * 3); c.stroke();
    figure(c, w * 0.18, h * 0.55, s * 0.9, col, { arms: hit ? 1 : 0.4 });
    const fx = w * 0.62, fy = h * 0.55 + Math.sin(t * 3) * 3 + (hit ? 0 : Math.max(0, Math.sin(t * 5)) * 4);
    c.strokeStyle = '#ffffffaa'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(w * 0.18 + s * 0.3, h * 0.55 - s * 1.5); c.quadraticCurveTo(w * 0.45, h * 0.15, fx, fy); c.stroke();
    c.fillStyle = '#ff4d4d'; c.beginPath(); c.arc(fx, fy, 6, Math.PI, 0); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(fx, fy, 6, 0, Math.PI); c.fill();
    if (hit) { const yy = h * 0.55 - Math.sin(a * Math.PI) * h * 0.35; c.save(); c.translate(fx + (a - 0.5) * s, yy); c.rotate(-0.6 + a * 1.2); c.fillStyle = '#ffd43b'; c.beginPath(); c.ellipse(0, 0, s * 0.45, s * 0.2, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(-s * 0.4, 0); c.lineTo(-s * 0.65, -s * 0.18); c.lineTo(-s * 0.65, s * 0.18); c.fill(); c.restore(); }
  } else if (id === 'eggs') { // 바구니로 떨어지는 달걀 받기
    const bx = w * 0.5 + Math.sin(t * 1.7) * w * 0.3; c.fillStyle = '#c98a4b'; rr(c, bx - s * 0.6, gy - s * 0.45, s * 1.2, s * 0.45, 8); c.fill(); c.fillStyle = '#8a5a2a'; c.fillRect(bx - s * 0.6, gy - s * 0.3, s * 1.2, 4);
    for (let i = 0; i < 3; i++) { const p = (t * 0.5 + i / 3) % 1; const ex = w * (0.2 + 0.3 * i) + Math.sin(i * 4) * 20; c.fillStyle = i === 1 ? '#ffd43b' : '#fff6e6'; c.beginPath(); c.ellipse(ex, p * gy, s * 0.16, s * 0.21, 0, 0, 7); c.fill(); }
    if (hit) { c.fillStyle = `rgba(255,212,59,${1 - a})`; c.font = `900 ${s * 0.5}px sans-serif`; c.textAlign = 'center'; c.fillText('+1', bx, gy - s * 0.8 - a * s); }
  } else if (id === 'tuho' || id === 'basket') { // 던진 화살/공이 항아리·골대로 쏙
    const tx = w * 0.72, ty = id === 'tuho' ? gy - s * 0.6 : h * 0.35;
    if (id === 'tuho') { c.fillStyle = '#7a4a2a'; c.beginPath(); c.ellipse(tx, gy - s * 0.3, s * 0.45, s * 0.6, 0, 0, 7); c.fill(); c.fillStyle = '#2a1608'; c.beginPath(); c.ellipse(tx, ty, s * 0.22, s * 0.08, 0, 0, 7); c.fill(); }
    else { c.fillStyle = '#ffffffcc'; c.fillRect(tx + s * 0.3, ty - s * 0.9, 6, h); c.fillStyle = '#ffffffdd'; c.fillRect(tx - s * 0.1, ty - s * 0.9, s * 0.5, s * 0.6); c.strokeStyle = '#ff6b35'; c.lineWidth = 4; c.beginPath(); c.ellipse(tx, ty, s * 0.35, s * 0.08, 0, 0, 7); c.stroke(); }
    figure(c, w * 0.18, gy, s, col, { arms: hit && a < 0.25 ? 1 : 0.2 });
    const p = hit ? a : (t * 0.6) % 1; const sx = w * 0.2, sy = gy - s * 1.5; const x = sx + (tx - sx) * p, y = sy + (ty - sy) * p - Math.sin(p * Math.PI) * h * 0.35;
    if (id === 'tuho') { c.save(); c.translate(x, y); c.rotate(Math.atan2((ty - sy) - Math.cos(p * Math.PI) * h * 0.35 * Math.PI, tx - sx)); c.strokeStyle = '#f2e6c9'; c.lineWidth = 3; c.beginPath(); c.moveTo(-s * 0.4, 0); c.lineTo(s * 0.2, 0); c.stroke(); c.fillStyle = col; c.beginPath(); c.moveTo(s * 0.3, 0); c.lineTo(s * 0.15, -5); c.lineTo(s * 0.15, 5); c.fill(); c.restore(); }
    else { c.fillStyle = '#ff8a3d'; c.beginPath(); c.arc(x, y, s * 0.2, 0, 7); c.fill(); c.strokeStyle = '#7a3410'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - s * 0.2, y); c.lineTo(x + s * 0.2, y); c.stroke(); }
    if (!hit) c.globalAlpha = 1;
  } else if (id === 'dalgona') { // 달고나 모양을 바늘로 따라 긁음 (점수만큼 선이 이어짐)
    const cx = w * 0.5, cy = h * 0.52, R = Math.min(w, h) * 0.32; c.fillStyle = '#d99a3e'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill(); c.fillStyle = '#e8b25a55'; c.beginPath(); c.arc(cx - R * 0.2, cy - R * 0.2, R * 0.6, 0, 7); c.fill();
    const N = 5, pts = Array.from({ length: N * 2 }, (_, i) => { const r = i % 2 ? R * 0.28 : R * 0.62, an = -Math.PI / 2 + (i * Math.PI) / N; return [cx + Math.cos(an) * r, cy + Math.sin(an) * r]; });
    c.strokeStyle = '#7a4a1a'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke(); c.setLineDash([]);
    const prog = ((t * 0.12) % 1); const m = prog * pts.length; c.strokeStyle = '#fff7e0'; c.lineWidth = 5; c.beginPath(); c.moveTo(...pts[0]); let px = pts[0][0], py = pts[0][1];
    for (let i = 1; i <= m; i++) { const q = pts[i % pts.length]; c.lineTo(...q); px = q[0]; py = q[1]; } const f = m % 1, q0 = pts[Math.floor(m) % pts.length], q1 = pts[(Math.floor(m) + 1) % pts.length]; px = q0[0] + (q1[0] - q0[0]) * f; py = q0[1] + (q1[1] - q0[1]) * f; c.lineTo(px, py); c.stroke();
    c.strokeStyle = '#d8dde8'; c.lineWidth = 3; c.beginPath(); c.moveTo(px, py); c.lineTo(px + s * 0.5, py - s * 0.6); c.stroke();
    if (hit) { c.strokeStyle = `rgba(255,212,59,${1 - a})`; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, R * (1 + a * 0.3), 0, 7); c.stroke(); }
  } else if (id === 'spot') { // 두 그림을 번갈아 보며 다른 곳에 동그라미
    const pw = w * 0.4, ph = h * 0.55, y = h * 0.2; for (const x of [w * 0.06, w * 0.54]) { c.fillStyle = '#f4efe2'; rr(c, x, y, pw, ph, 8); c.fill(); c.fillStyle = '#7fc8f8'; c.fillRect(x + 6, y + 6, pw - 12, ph * 0.45); c.fillStyle = '#5fae4a'; c.fillRect(x + 6, y + ph * 0.5, pw - 12, ph * 0.5 - 6); c.fillStyle = '#ffd43b'; c.beginPath(); c.arc(x + pw * 0.75, y + ph * 0.22, ph * 0.1, 0, 7); c.fill(); c.fillStyle = '#c0392b'; c.fillRect(x + pw * 0.25, y + ph * 0.4, pw * 0.2, ph * 0.25); }
    const mx = w * 0.54 + pw * 0.75, my = y + ph * 0.22; c.strokeStyle = col; c.lineWidth = 5; c.beginPath(); c.arc(mx, my, ph * 0.16 * (hit ? 1 + (1 - a) * 0.5 : 1), 0, 7 * (hit ? ease(a) : 1)); c.stroke();
    const lx = w * 0.5 + Math.sin(t * 1.3) * w * 0.35; c.strokeStyle = '#ffffffcc'; c.lineWidth = 4; c.beginPath(); c.arc(lx, h * 0.48, s * 0.3, 0, 7); c.moveTo(lx + s * 0.21, h * 0.48 + s * 0.21); c.lineTo(lx + s * 0.45, h * 0.48 + s * 0.45); c.stroke();
  } else run(w * 0.4, gy);
}
function liveGrid(c, W, H, ctx, id, get, unit, t, scene = liveScene) {
  // 팀 수에 맞춰 칸 나누기 (2팀 1줄 · 4팀 2×2 · 6팀 3×2 · 그 이상 4열)
  const teams = ctx.teams, n = teams.length; const cols = n <= 2 ? n : n <= 4 ? 2 : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols); const gap = 14;
  const cw = (W - gap * (cols + 1)) / cols, ch = (H - gap * (rows + 1)) / rows;
  const vv = new Map(teams.map((tm) => [tm.id, Math.round(get(tm).v)])); const rank = new Map(teams.map((tm) => [tm.id, 1 + teams.filter((o) => vv.get(o.id) > vv.get(tm.id)).length])); // 같은 점수면 같은 순위
  teams.forEach((tm, i) => {
    const x = gap + (i % cols) * (cw + gap), y = gap + Math.floor(i / cols) * (ch + gap); const { v, age } = get(tm);
    c.save(); rr(c, x, y, cw, ch, 18); c.clip();
    const g = c.createLinearGradient(0, y, 0, y + ch); g.addColorStop(0, '#0b1030cc'); g.addColorStop(1, tm.color + '33'); c.fillStyle = g; c.fillRect(x, y, cw, ch);
    c.translate(x, y + ch * 0.18); try { scene === liveScene ? liveScene(id, c, cw, ch * 0.82, tm.color, v, age, t / 1000) : scene(c, cw, ch * 0.82, tm.color, v, age, t / 1000); } catch { /* */ } c.restore();
    c.save(); rr(c, x, y, cw, ch, 18); c.lineWidth = age < 600 ? 6 : 3; c.strokeStyle = age < 600 ? '#ffd43b' : tm.color + 'aa'; c.stroke(); c.restore();
    const fs = Math.max(18, Math.min(40, ch * 0.11)); c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = '#fff'; c.font = `900 ${fs}px sans-serif`;
    c.fillText(`${rank.get(tm.id)}위  ${tm.icon} ${tm.name}`, x + 16, y + fs * 0.9);
    c.textAlign = 'right'; c.font = `900 ${fs * 1.5}px sans-serif`; c.fillStyle = age < 600 ? '#ffd43b' : '#fff'; c.fillText(`${Math.round(v)}${unit}`, x + cw - 16, y + fs * 1.05);
  });
}

function skillScreen(id) {
  const [c1, c2, ic, unit] = THEME[id];
  return {
    mount(root, ctx) {
      this.ctx = ctx; this.vals = {}; this.shown = {}; this.max = 1; this.pulse = {};
      this.cv = canvas(1300, 880); this.feed = feed(); this.top = h('div', { class: 'np' });
      root.append(h('div', { class: 'nar' }, h('div', { class: 'narc', style: { width: '1300px' } }, this.cv), h('div', { class: 'nside' }, this.top, this.feed)));
      loop(this, (t) => this.draw(t));
    },
    update(s) {
      const avg = s.avg || {}; for (const [k, v] of Object.entries(avg)) { if (v > (this.vals[k] || 0)) this.pulse[k] = performance.now(); this.vals[k] = v; }
      this.max = Math.max(this.max, ...Object.values(avg), 1);
      if (s.pops) for (const k of Object.keys(s.pops)) this.pulse[k] = performance.now();
      this.top.innerHTML = ''; this.top.append(h('div', { class: 'npt' }, '개인 TOP 5'), ...(s.top || []).map((x, i) => h('div', { class: 'npr' }, h('b', { style: { minWidth: '30px', textAlign: 'left' } }, i + 1), h('div', { class: 'npn' }, h('div', { style: { color: this.ctx.team(x[1]).color } }, x[0])), h('b', {}, `${x[2]}${unit}`))));
      for (const [name, team, x] of s.feed || []) { const m = HI[id]?.[x]; if (m) { this.feed.push(h('div', { class: 'nfi' }, h('b', { style: { color: this.ctx.team(team).color } }, name), ` ${m}`)); this.ctx.sfx('good'); } }
      return avg;
    },
    draw(t) {
      const c = this.cv.getContext('2d'); const W = 1300, H = 880; P3(c, W, H, id, 0.35); // 게임 장면 위에 팀별 실시간 연출
      const now = performance.now();
      liveGrid(c, W, H, this.ctx, id, (tm) => { const v = this.vals[tm.id] || 0; this.shown[tm.id] = (this.shown[tm.id] ?? 0) + (v - (this.shown[tm.id] ?? 0)) * 0.08; return { v: this.shown[tm.id], age: now - (this.pulse[tm.id] || -1e9) }; }, unit, t);
    },
    unmount() { stop(this); },
  };
}
for (const id of Object.keys(THEME)) V[id] = skillScreen(id);

// ---------------------------------------------------------------- 컬링: 하우스에 모든 스톤
V.curling = {
  mount(root, ctx) { this.ctx = ctx; this.st = []; this.cv = canvas(1100, 880); this.panel = teamPanel(ctx, '팀 평균 점수'); root.append(h('div', { class: 'nar' }, h('div', { class: 'narc', style: { width: '1100px' } }, this.cv), h('div', { class: 'nside' }, this.panel))); loop(this, (t) => this.draw(t)); },
  update(s) { if (s.all) this.st = s.all.map((x) => [...x, 0]); else for (const x of s.add || []) { this.st.push([...x, performance.now()]); this.ctx.sfx(x[3] >= 80 ? 'good' : 'tap'); } this.panel.set(s.avg, 100); return s.avg; },
  // 빙판 경기장: 배경(관중석·펜스·빙판 결·하우스)은 한 번만 그려 두고, 스톤과 '가장 가까운 팀'만 매번 그림
  bg() {
    if (this.bgc) return this.bgc; const W = 1100, H = 880; const b = document.createElement('canvas'); b.width = W; b.height = H; const c = b.getContext('2d');
    c.fillStyle = '#18213f'; c.fillRect(0, 0, W, 90); for (let r = 0; r < 3; r++) for (let i = 0; i < 46; i++) { c.fillStyle = ['#ff4d6d66', '#3d8bff66', '#ffd43b66', '#2fd27a66', '#ffffff44'][(i * 7 + r) % 5]; c.beginPath(); c.arc(12 + i * 24, 18 + r * 24, 9, 0, 7); c.fill(); }
    c.fillStyle = '#e94b5f'; c.fillRect(0, 86, W, 14); c.fillStyle = '#fff'; c.font = '900 12px sans-serif'; for (let i = 0; i < 9; i++) c.fillText('IKIKI CURLING', 20 + i * 125, 97);
    const g = c.createLinearGradient(0, 100, 0, H); g.addColorStop(0, '#f6fbff'); g.addColorStop(1, '#d7e7f7'); c.fillStyle = g; c.fillRect(0, 100, W, H - 100);
    c.strokeStyle = '#ffffff'; c.globalAlpha = 0.5; for (let i = 0; i < 120; i++) { const x = (i * 97) % W, y = 100 + ((i * 53) % (H - 100)); c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 40 + (i % 5) * 12, y + (i % 3) - 1); c.stroke(); } c.globalAlpha = 1;
    const sh = c.createRadialGradient(W * 0.3, 300, 20, W * 0.3, 300, 500); sh.addColorStop(0, '#ffffff88'); sh.addColorStop(1, '#ffffff00'); c.fillStyle = sh; c.fillRect(0, 100, W, H - 100);
    const cx = W / 2, cy = 490, R = 360;
    c.fillStyle = '#00000010'; c.beginPath(); c.arc(cx + 6, cy + 8, R, 0, 7); c.fill();
    [[1, '#2f6fe0'], [0.66, '#f8fbff'], [0.33, '#e5354d'], [0.1, '#f8fbff']].forEach(([k, col]) => { c.fillStyle = col; c.beginPath(); c.arc(cx, cy, R * k, 0, 7); c.fill(); });
    c.strokeStyle = '#8fa6c8'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, 100); c.lineTo(cx, H); c.moveTo(0, cy); c.lineTo(W, cy); c.stroke();
    c.strokeStyle = '#e5354d'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, H - 40); c.lineTo(W, H - 40); c.stroke(); c.fillStyle = '#8fa6c8'; c.font = '700 16px sans-serif'; c.fillText('HOG LINE', 12, H - 48);
    this.bgc = b; return b;
  },
  draw() {
    const c = this.cv.getContext('2d'); const W = 1100, H = 880; c.drawImage(this.bg(), 0, 0);
    const cx = W / 2, cy = 490, R = 360; const now = performance.now();
    let best = null;
    for (const [x, y, team, sc, at] of this.st) {
      const k = at ? Math.min(1, (now - at) / 700) : 1; const X = cx + x * R, Y = cy + y * R + (1 - k) * 420; const col = this.ctx.team(team).color;
      if (k === 1 && (!best || sc > best.sc)) best = { X, Y, team, sc };
      c.fillStyle = '#00000030'; c.beginPath(); c.ellipse(X + 4, Y + 6, 19, 15, 0, 0, 7); c.fill();
      const gr = c.createRadialGradient(X - 5, Y - 6, 2, X, Y, 18); gr.addColorStop(0, '#c9ced6'); gr.addColorStop(1, '#5f6672'); c.fillStyle = gr; c.beginPath(); c.arc(X, Y, 17, 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(X, Y, 11, 0, 7); c.fill(); c.fillStyle = '#222'; c.fillRect(X - 3, Y - 13, 6, 10);
    }
    if (best) { const t = this.ctx.team(best.team); c.strokeStyle = '#ffd43b'; c.lineWidth = 4; c.beginPath(); c.arc(best.X, best.Y, 26 + Math.sin(now / 150) * 3, 0, 7); c.stroke(); c.fillStyle = '#0b0e24dd'; c.beginPath(); c.roundRect(20, 112, 360, 44, 12); c.fill(); c.fillStyle = '#fff'; c.font = '900 22px sans-serif'; c.textAlign = 'left'; c.fillText(`🎯 가장 가까운 스톤: ${t.icon} ${t.name} (${best.sc}점)`, 34, 141); }
  },
  unmount() { stop(this); },
};

// ---------------------------------------------------------------- 승부차기: 골망에 쌓이는 공
V.penalty = {
  mount(root, ctx) { this.ctx = ctx; this.shots = []; this.cv = canvas(1300, 880); this.panel = teamPanel(ctx, '팀 평균 골'); this.big = h('div', { class: 'nbig' }); root.append(h('div', { class: 'nar' }, h('div', { class: 'narc', style: { width: '1300px' } }, this.cv, this.big), h('div', { class: 'nside' }, this.panel))); loop(this, (t) => this.draw(t)); },
  update(s) {
    let g = 0, sv = 0;
    for (const [team, z, keeper, res] of s.ev || []) { this.shots.push({ team, z, keeper, res, at: performance.now(), jx: Math.random() - 0.5, jy: Math.random() - 0.5 }); if (res === 1) g++; else if (res === 2) sv++; }
    if (g || sv) { this.ctx.sfx(g >= sv ? 'good' : 'bad'); this.big.textContent = `GOAL ${g} · 선방 ${sv}`; }
    if (this.shots.length > 500) this.shots.splice(0, this.shots.length - 500);
    this.panel.set(s.avg); return s.avg;
  },
  draw(t) {
    const c = this.cv.getContext('2d'); const W = 1300, H = 880; P3(c, W, H, 'penalty', 0.1);
    const gx = 150, gy = 120, gw = 1000, gh = 460;
    c.strokeStyle = '#ffffff1f'; c.lineWidth = 1; for (let i = 0; i <= 40; i++) { c.beginPath(); c.moveTo(gx + (gw * i) / 40, gy); c.lineTo(gx + (gw * i) / 40, gy + gh); c.stroke(); } for (let j = 0; j <= 18; j++) { c.beginPath(); c.moveTo(gx, gy + (gh * j) / 18); c.lineTo(gx + gw, gy + (gh * j) / 18); c.stroke(); }
    c.strokeStyle = '#fff'; c.lineWidth = 14; c.strokeRect(gx, gy, gw, gh);
    const now = performance.now(); const zx = (z) => gx + gw * ((z % 3) + 0.5) / 3, zy = (z) => gy + gh * (Math.floor(z / 3) + 0.5) / 2;
    for (const s of this.shots) {
      const k = Math.min(1, (now - s.at) / 450); const X = zx(s.z) + s.jx * 260, Y = zy(s.z) + s.jy * 180;
      const bx = W / 2 + (X - W / 2) * k, by = 800 + (Y - 800) * k; const col = this.ctx.team(s.team).color;
      if (s.res === 1) { c.fillStyle = col; c.beginPath(); c.arc(bx, by, 9, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
      else if (now - s.at < 1500) { c.globalAlpha = 1 - (now - s.at) / 1500; c.font = '40px sans-serif'; c.textAlign = 'center'; c.fillText(s.res === 2 ? '🧤' : '💨', bx, by); c.globalAlpha = 1; }
    }
    const kx = W / 2 + Math.sin(t / 300) * 200; figure(c, kx, gy + gh, 110, '#ffd43b', { arms: 0.6 + Math.sin(t / 200) * 0.3 });
  },
  unmount() { stop(this); },
};

// ---------------------------------------------------------------- 리듬 마스터: 대형 화면이 비트를 울림
V.rhythm = {
  mount(root, ctx) { this.ctx = ctx; this.s = null; this.eq = {}; this.lastBeat = -1; this.cv = canvas(1832, 880); root.append(h('div', { class: 'nfull' }, this.cv)); loop(this, (t) => this.draw(t)); },
  update(s) { this.s = s; const now = performance.now(); this.hq ||= {}; for (const [k, n] of Object.entries(s.hits || {})) { this.eq[k] = Math.min(1, (this.eq[k] || 0) + n * 0.06); (this.hq[k] ||= []).push([now, n]); } return s.avg; },
  draw(t) {
    const s = this.s; if (!s) return; const c = this.cv.getContext('2d'); const W = 1832, H = 880;
    const now = this.ctx.now(); const beat = 60000 / s.bpm; const bi = Math.floor((now - s.t0) / beat); const ph = (((now - s.t0) % beat) + beat) % beat / beat;
    if (now >= s.t0 && bi !== this.lastBeat) { this.lastBeat = bi; this.ctx.sfx(bi % 4 === 0 ? 'count' : 'tap'); }
    P3(c, W, H, 'rhythm', 0.2); { const g = c.createRadialGradient(W / 2, H, 50, W / 2, H, W * 0.8); g.addColorStop(0, `rgba(176,107,255,${0.2 + (1 - ph) * 0.25})`); g.addColorStop(1, 'rgba(5,4,15,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); } // 박자에 맞춰 무대 빛
    c.strokeStyle = '#ffffff10'; for (let i = 0; i < 12; i++) { const y = H - ((i / 12 + ph / 12) % 1) * H; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // 무대: 트러스 조명 + 박자 신호(원이 줄어드는 순간 = 탭 타이밍) + 판정 안내
    c.fillStyle = '#2b2440'; c.fillRect(0, 0, W, 26); for (let i = 0; i < 9; i++) { const lx = 100 + i * 205; const on = (bi + i) % 4 === 0; c.fillStyle = on ? '#fff3b0' : '#665c80'; c.beginPath(); c.arc(lx, 26, 12, 0, 7); c.fill(); if (on) { const sg = c.createLinearGradient(lx, 26, lx, H); sg.addColorStop(0, 'rgba(255,243,176,.22)'); sg.addColorStop(1, 'rgba(255,243,176,0)'); c.fillStyle = sg; c.beginPath(); c.moveTo(lx - 8, 26); c.lineTo(lx + 8, 26); c.lineTo(lx + 120, H); c.lineTo(lx - 120, H); c.fill(); } }
    const bx = W / 2, by = 140; c.strokeStyle = '#ffd43b'; c.lineWidth = 6; c.beginPath(); c.arc(bx, by, 40 + (1 - ph) * 70, 0, 7); c.globalAlpha = 0.25 + ph * 0.75; c.stroke(); c.globalAlpha = 1; c.fillStyle = ph > 0.85 || ph < 0.08 ? '#ffd43b' : '#ffffff33'; c.beginPath(); c.arc(bx, by, 40, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.font = '900 26px sans-serif'; c.textAlign = 'center'; c.fillText('원이 가운데에 닿는 박자 = 노트가 판정선에 닿을 때 탭!  PERFECT 3 · GOOD 2 (빠름/늦음) · MISS', bx, 240);
    const teams = this.ctx.teams; const bw = Math.min(260, (W - 200) / teams.length - 30); const total = teams.length * (bw + 30); let x = (W - total) / 2;
    const max = Math.max(1, ...Object.values(s.avg || {}));
    for (const tm of teams) {
      this.eq[tm.id] = (this.eq[tm.id] || 0) * 0.95; const e = this.eq[tm.id]; const v = (s.avg || {})[tm.id] || 0;
      for (let j = 0; j < 5; j++) { const hgt = (0.15 + e * (0.6 + Math.sin(t / 90 + j) * 0.3) + (1 - ph) * 0.08) * 520; c.fillStyle = tm.color; c.globalAlpha = 0.85; c.fillRect(x + j * (bw / 5), 700 - hgt, bw / 5 - 6, hgt); }
      c.globalAlpha = 1; const q = (this.hq?.[tm.id] || []).filter((a) => performance.now() - a[0] < 2000); if (this.hq) this.hq[tm.id] = q; const streak = q.reduce((a, b) => a + b[1], 0);
      if (streak) { c.fillStyle = '#ffd43b'; c.font = '900 30px sans-serif'; c.textAlign = 'center'; c.fillText(`🔥 팀 연속 ${streak}`, x + bw / 2, 300); }
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '800 28px sans-serif'; c.fillText(`${tm.icon} ${tm.name}`, x + bw / 2, 750); c.font = '900 44px sans-serif'; c.fillText(Math.round(v), x + bw / 2, 805);
      c.fillStyle = '#ffffff22'; c.fillRect(x, 820, bw, 10); c.fillStyle = tm.color; c.fillRect(x, 820, (bw * v) / max, 10);
      x += bw + 30;
    }
    c.textAlign = 'left'; c.fillStyle = '#ffd43b'; c.font = '900 34px sans-serif'; c.fillText((s.top || []).map((x2) => `${x2[0]} ${x2[2]}콤보`).join('   '), 40, 60);
  },
  unmount() { stop(this); },
};

// ---------------------------------------------------------------- 버거 장인: 팀별 버거 탑
V.burger = {
  mount(root, ctx) { this.ctx = ctx; this.cnt = {}; this.cv = canvas(1832, 880); root.append(h('div', { class: 'nfull' }, this.cv)); loop(this, () => this.draw()); },
  update(s) { this.s = s; for (const [k, n] of Object.entries(s.done || {})) { this.cnt[k] = (this.cnt[k] || 0) + n; this.ctx.sfx('good'); } return s.avg; },
  draw() {
    const c = this.cv.getContext('2d'); const W = 1832, H = 880; P3(c, W, H, 'burger', 0.35);
    const teams = this.ctx.teams; const cw = W / teams.length;
    teams.forEach((tm, i) => {
      const n = this.cnt[tm.id] || 0; const cx = cw * i + cw / 2; const bw = Math.min(200, cw * 0.7); const lh = Math.min(26, 640 / Math.max(10, n));
      for (let k = 0; k < n; k++) { const y = 780 - k * lh; c.fillStyle = '#d98e3a'; c.beginPath(); c.roundRect(cx - bw / 2, y - lh * 0.9, bw, lh * 0.9, lh * 0.45); c.fill(); c.fillStyle = '#5a2e0e'; c.fillRect(cx - bw / 2 + 6, y - lh * 0.55, bw - 12, lh * 0.25); c.fillStyle = '#7ac74f'; c.fillRect(cx - bw / 2 + 2, y - lh * 0.3, bw - 4, lh * 0.12); }
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '800 28px sans-serif'; c.fillText(`${tm.icon} ${tm.name}`, cx, 830); c.font = '900 40px sans-serif'; c.fillStyle = tm.color; c.fillText(`${n}개`, cx, 780 - n * lh - 20);
    });
  },
  unmount() { stop(this); },
};

// ---------------------------------------------------------------- 라운드형 공용 (텔레파시·소수·하이로우)
function roundScreen(kind) {
  return {
    mount(root, ctx) { this.ctx = ctx; this.root = h('div', { class: 'bells' }); root.append(this.root); this.key = ''; this.t = setInterval(() => { const el = this.root.querySelector('.bellclock'); if (el && this.s) el.textContent = this.s.ph === 'q' ? `${Math.max(0, Math.ceil(this.s.left - (performance.now() - this.at) / 1000))}` : ''; }, 200); },
    update(s) {
      this.s = s; this.at = performance.now(); const key = `${s.i}:${s.ph}`; const ctx = this.ctx;
      if (key === this.key) { const a = this.root.querySelector('.answered'); if (a) a.textContent = `${s.answered}명 응답`; return kind === 'tele' ? s.sync : s.alive || s.avg; }
      this.key = key; const R = this.root; R.innerHTML = '';
      if (s.ph === 'rev') ctx.sfx(kind === 'mino' && s.res?.outN ? 'bad' : 'good');
      R.append(h('div', { class: 'bellhead' }, h('span', { class: 'chip big' }, `${s.i + 1} / ${s.N}`), h('span', { class: 'answered muted' }, `${s.answered}명 응답`), h('span', { class: 'bellclock' })));
      if (kind === 'tele') {
        R.append(h('div', { class: 'bellqs' }, s.text), h('div', { class: 'bellos' }, s.opts.map((o, j) => h('div', { class: 'bo' }, h('span', {}, o), s.dist ? h('div', { class: 'tdist' }, ...ctx.teams.map((t) => { const d = s.dist[t.id] || [0, 0, 0, 0]; const n = d.reduce((a, b) => a + b, 0) || 1; return h('i', { style: { background: t.color, width: `${(d[j] / n) * 100}%` }, title: t.name }); })) : null))));
        R.append(h('div', { class: 'bellalive' }, h('b', {}, '팀 일치율'), ...ctx.teams.map((t) => h('span', { style: { background: t.color } }, `${t.icon} ${s.sync[t.id] || 0}%`))));
      } else if (kind === 'mino') {
        R.append(h('div', { class: 'bellqs' }, '더 적게 고른 쪽만 살아남는다'), h('div', { class: 'bellos n2' }, s.opts.map((o, j) => h('div', { class: `bo ${s.res ? (s.res.win === -1 ? 'right' : s.res.win === j ? 'right' : 'dim') : ''}` }, h('span', {}, o), s.res ? h('em', { class: 'bigcnt' }, `${s.res.cnt[j]}명`) : null))));
        if (s.res?.outN) R.append(h('div', { class: 'bellout' }, `탈락 ${s.res.outN}명 `, ...s.res.out.map(([n, tm]) => h('span', { style: { color: ctx.team(tm).color } }, n))));
        if (s.canLose) R.append(h('div', { class: 'bellalive' }, h('b', {}, `생존 ${s.aliveN}명`), ...ctx.teams.map((t) => h('span', { style: { background: t.color } }, `${t.icon} ${s.alive[t.id] || 0}`))));
      } else {
        R.append(h('div', { class: 'hlbig' }, h('div', { class: 'hlcard' }, s.card), h('div', { class: 'hlq' }, s.next ? (s.res?.right === 1 ? '▲ 높다!' : s.res?.right === 0 ? '▼ 낮다!' : '= 같다!') : '높을까? 낮을까?'), h('div', { class: `hlcard back ${s.next ? 'open' : ''}` }, s.next || '?')),
          h('div', { class: 'hlhist' }, ...s.hist.map((x) => h('span', {}, x))), s.res ? h('div', { class: 'bellrev' }, `정답 ${s.res.ok} / ${s.res.all}명`) : null,
          h('div', { class: 'bellalive' }, h('b', {}, '연속 정답 TOP'), ...(s.top || []).map((x) => h('span', { style: { background: ctx.team(x[1]).color } }, `${x[0]} ${x[2]}`))));
      }
      return kind === 'tele' ? s.sync : s.alive || s.avg;
    },
    unmount() { clearInterval(this.t); },
  };
}
V.tele = roundScreen('tele');
V.mino = roundScreen('mino');
V.hilo = roundScreen('hilo');

// ---------------------------------------------------------------- 손 떼면 탈락
V.hold = {
  mount(root, ctx) {
    this.ctx = ctx; this.seen = new Set(); this.alive = {}; this.outAt = {}; this.ban = h('div', { class: 'hdban' }); this.trick = h('div', { class: 'hdtrickS' }); this.panel = teamPanel(ctx, '팀별 버티는 사람'); this.feed = feed();
    this.cv = canvas(1300, 600); // 팀별 실시간 연출: 버튼을 꾹 누르고 버티는 선수들 (손 뗀 사람은 쓰러짐)
    root.append(h('div', { class: 'nar' }, h('div', { class: 'hdmain' }, this.ban, this.cv, this.trick), h('div', { class: 'nside' }, this.panel, this.feed))); loop(this, (t) => this.draw(t));
  },
  draw(t) {
    const c = this.cv.getContext('2d'); const W = 1300, H = 600; c.clearRect(0, 0, W, H); const now = performance.now();
    liveGrid(c, W, H, this.ctx, 'hold', (tm) => ({ v: this.alive[tm.id] || 0, age: now - (this.outAt[tm.id] || -1e9) }), '명', t, (c2, w, h2, col, v, age, tt) => {
      const n = Math.min(8, Math.round(v)); const gy = h2 * 0.85, s = Math.min(w / 9, h2 * 0.28); const glow = 0.5 + 0.5 * Math.sin(tt * 4);
      c2.fillStyle = `rgba(255,212,59,${0.25 + glow * 0.35})`; c2.beginPath(); c2.ellipse(w / 2, gy + 4, w * 0.42, 10, 0, 0, 7); c2.fill();
      for (let i = 0; i < n; i++) { const x = w * (0.5 + (i - (n - 1) / 2) * (0.84 / Math.max(n, 4))); figure(c2, x, gy, s, col, { arms: 0.15 + 0.05 * Math.sin(tt * 6 + i) }); }
      if (age < 1200) { const a = age / 1200; c2.save(); c2.globalAlpha = 1 - a; c2.translate(w * 0.85, gy); c2.rotate(-a * 1.4); figure(c2, 0, 0, s, '#888', {}); c2.restore(); }
      if (v > 8) { c2.fillStyle = '#fff'; c2.font = `900 ${s * 0.5}px sans-serif`; c2.textAlign = 'right'; c2.fillText(`+${Math.round(v) - 8}`, w - 10, gy - s * 1.6); }
    });
  },
  unmount() { stop(this); },
  update(s) {
    this.ban.innerHTML = `<div class="hdn">${s.aliveN}</div><div>명이 버티는 중 · ${Math.floor(s.T)}초</div>`;
    if (s.trick !== this.lt) { this.lt = s.trick; this.trick.textContent = s.trick || ''; this.trick.classList.toggle('on', !!s.trick); if (s.trick) this.ctx.sfx('hurry'); }
    for (const [n, tm] of s.out || []) { const k = n + tm; if (this.seen.has(k)) continue; this.seen.add(k); this.feed.push(h('div', { class: 'nfi' }, h('b', { style: { color: this.ctx.team(tm).color } }, n), ' 손을 뗐다!')); this.ctx.sfx('bad'); }
    for (const [k, n] of Object.entries(s.alive || {})) { if (this.alive[k] != null && n < this.alive[k]) this.outAt[k] = performance.now(); this.alive[k] = n; }
    this.panel.set(s.alive); return s.alive;
  },
};

// 새 경쟁 게임 3종 대형 화면: 줄다리기 운동장 · 멀리뛰기 모래판 · 볼링장
// 오른쪽 팀 패널(순위·1위와 차이)은 다른 게임과 같은 모양 · 가운데 장면은 게임마다 따로 그림
import { h } from './client.js';
import { V } from './screen-games.js';
import { loop, canvas, teamPanel, feed } from './screen-n.js';
import { PINS } from './bowl.js';

const W = 1300, H = 880;
const scene = (self, ctx, title, fmt) => { self.ctx = ctx; self.cv = canvas(W, H); self.panel = teamPanel(ctx, title, fmt); self.feed = feed(); return h('div', { class: 'nar' }, h('div', { class: 'narc', style: { width: `${W}px` } }, self.cv), h('div', { class: 'nside' }, self.panel, self.feed)); };
const T = (c, s, x, y, px, col = '#fff', al = 'center', wt = 900) => { c.fillStyle = col; c.font = `${wt} ${px}px sans-serif`; c.textAlign = al; c.textBaseline = 'middle'; c.fillText(s, x, y); };
const rr = (c, x, y, w, hh, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, hh, r); else c.rect(x, y, w, hh); };
const tOf = (ctx, id) => ctx.teams.find((t) => t.id === +id) || { color: '#888', icon: '', name: '' };

// ---------------- 줄다리기: 위에서 본 운동장 · 팀이 2개면 좌우, 3개 이상이면 사방으로 줄
V.tug = {
  mount(root, ctx) { root.append(scene(this, ctx, '이긴 판 수', (v) => `${Math.floor(v)}승`)); this.kx = 0; this.ky = 0; loop(this, () => this.draw()); },
  update(s) { const was = this.s?.win; this.s = s; this.panel.set(s.team); if (s.win && s.win !== was) { const t = tOf(this.ctx, s.win); this.ctx.sfx('win'); this.ctx.say(`${t.name} 승리!`, 1.1); this.feed.push(h('div', {}, `${t.icon} ${t.name} ${s.round - 1}판 승리!`)); } return s.team; },
  draw() {
    const s = this.s; if (!s) return; const c = this.cv.getContext('2d'); const t = performance.now() / 1000;
    const g = c.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7); g.addColorStop(0, '#3f8a4c'); g.addColorStop(1, '#1e4d28'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#ffffff07' : '#0000000c'; c.fillRect((i * W) / 12, 0, W / 12, H); }
    const cx = W / 2, cy = H / 2 + 20, R = Math.min(W, H) * 0.33;
    this.kx += (s.x - this.kx) * 0.12; this.ky += (s.y - this.ky) * 0.12; const kx = cx + this.kx * R, ky = cy + this.ky * R;
    c.strokeStyle = '#ffffffaa'; c.lineWidth = 4; c.setLineDash([16, 12]); c.beginPath(); c.arc(cx, cy, R * 0.12, 0, 7); c.stroke(); c.setLineDash([]);
    for (const [id, [dx, dy]] of Object.entries(s.dirs)) {
      const tm = tOf(this.ctx, id); const v = s.t[id]; if (!v) continue; const ex = cx + dx * R, ey = cy + dy * R; const ox = cx + dx * R * 1.22, oy = cy + dy * R * 1.22;
      // 승리선
      c.strokeStyle = tm.color; c.lineWidth = 8; c.beginPath(); c.moveTo(ex - dy * 90, ey + dx * 90); c.lineTo(ex + dy * 90, ey - dx * 90); c.stroke();
      // 밧줄
      const wob = Math.sin(t * 12 + +id) * (v.r > 3 ? 3 : 1);
      c.strokeStyle = '#c99a5b'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(kx, ky); c.lineTo(ox + wob, oy + wob); c.stroke();
      // 팀원 (힘을 쓸수록 더 기울어짐)
      const n = Math.min(6, Math.max(1, v.n)); for (let i = 0; i < n; i++) { const px = cx + dx * R * (0.72 + i * 0.09) + wob, py = cy + dy * R * (0.72 + i * 0.09) + wob; c.fillStyle = tm.color; c.beginPath(); c.arc(px, py, 18, 0, 7); c.fill(); c.fillStyle = '#ffd7b5'; c.beginPath(); c.arc(px + dx * 10, py + dy * 10, 9, 0, 7); c.fill(); }
      T(c, `${tm.icon} ${tm.name}`, cx + dx * R * 1.32, cy + dy * R * 1.32 - (Math.abs(dy) > 0.5 ? 0 : 30), 34);
      T(c, `${v.w}승 · 1인당 ${v.r}번/초`, cx + dx * R * 1.32, cy + dy * R * 1.32 + (Math.abs(dy) > 0.5 ? 36 : 6), 24, '#ffe9a8', 'center', 800);
    }
    // 매듭
    c.fillStyle = '#ff4d6d'; c.beginPath(); c.arc(kx, ky, 26, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(kx, ky, 10, 0, 7); c.fill();
    T(c, `🪢 ${s.round}판`, 30, 46, 40, '#fff', 'left');
    if (s.win) { const tm = tOf(this.ctx, s.win); c.fillStyle = '#000a'; rr(c, W / 2 - 330, 40, 660, 110, 24); c.fill(); T(c, `${tm.icon} ${tm.name} 승리!`, W / 2, 95, 64, tm.color); }
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

// ---------------- 멀리뛰기: 옆에서 본 모래판 · 방금 뛴 기록이 차례로 착지 · 위쪽 1~5위
V.ljump = {
  mount(root, ctx) { root.append(scene(this, ctx, '팀 평균 최고 기록', (v) => `${v.toFixed(2)}m`)); this.jumps = []; loop(this, () => this.draw()); },
  update(s) {
    this.s = s; this.panel.set(s.avg, 8.4);
    for (const [team, name, d] of s.add || []) { this.jumps.push({ team, name, d, at: performance.now() + this.jumps.filter((j) => performance.now() - j.at < 0).length * 350 }); this.feed.push(h('div', {}, `${tOf(this.ctx, team).icon} ${name} ${d ? `${d.toFixed(2)}m` : '파울'}`)); if (d >= 6) this.ctx.sfx('win'); }
    if (this.jumps.length > 60) this.jumps.splice(0, this.jumps.length - 60);
    return s.avg;
  },
  draw() {
    const s = this.s; const c = this.cv.getContext('2d'); const now = performance.now();
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2f5e9e'); g.addColorStop(0.42, '#9cc9f0'); g.addColorStop(0.43, '#4a3a6a'); g.addColorStop(0.55, '#5b4a7e'); g.addColorStop(0.56, '#c45c43'); g.addColorStop(1, '#9e4632'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 9) { c.fillStyle = `hsla(${(x * 17) % 360},60%,65%,.55)`; c.fillRect(x, H * 0.44 + ((x * 7) % 11), 4, 4); }
    const gy = H * 0.74, lineX = 230, pitX = 270; const mX = (d) => pitX + ((W - pitX - 30) * d) / 9.5;
    c.fillStyle = '#e6c88a'; c.fillRect(pitX, gy - 6, W - pitX, H - gy + 6); c.fillStyle = '#fff'; c.fillRect(lineX - 4, gy - 8, 8, H - gy + 8);
    for (let m = 1; m <= 9; m++) { c.fillStyle = '#00000055'; c.fillRect(mX(m), gy, 3, 18); T(c, `${m}m`, mX(m), gy + 50, 26, '#3b2a12', 'center', 800); }
    for (const j of this.jumps) {
      const k = (now - j.at) / 900; if (k < 0) continue; const tm = tOf(this.ctx, j.team); const x1 = j.d ? mX(j.d) : lineX + 40;
      if (k < 1) { const x = lineX + (x1 - lineX) * k, y = gy - Math.sin(k * Math.PI) * 260; c.font = '64px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.save(); c.translate(x, y); c.scale(-1, 1); c.fillText('🤸', 0, 0); c.restore(); }
      else { c.fillStyle = tm.color; c.beginPath(); c.arc(x1, gy + 8, 9, 0, 7); c.fill(); if (k < 3) { T(c, `${j.name} ${j.d ? `${j.d.toFixed(2)}m` : '파울'}`, x1, gy - 40 - (k - 1) * 10, 30, '#fff'); } }
    }
    if (s?.top?.length) { c.fillStyle = '#0009'; rr(c, 30, 26, 560, 60 + s.top.length * 44, 18); c.fill(); T(c, '🏅 지금 최고 기록', 54, 58, 30, '#ffd43b', 'left'); s.top.forEach(([n, d, team], i) => { const tm = tOf(this.ctx, team); T(c, `${i + 1}. ${tm.icon} ${n}`, 54, 104 + i * 44, 28, '#fff', 'left', 800); T(c, `${d.toFixed(2)}m`, 566, 104 + i * 44, 28, '#ffe9a8', 'right'); }); }
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

// ---------------- 볼링: 팀별 레인 · 방금 굴린 결과(넘어진 핀) · 스트라이크는 크게
V.bowl = {
  mount(root, ctx) { root.append(scene(this, ctx, '팀 평균 점수')); this.last = {}; this.big = null; loop(this, () => this.draw()); },
  update(s) {
    this.s = s; this.panel.set(s.avg);
    for (const [team, name, n, mark, dn] of s.add || []) { this.last[team] = { name, n, mark, dn: new Set(dn || []), at: performance.now() }; if (mark === 'X') { this.big = { txt: `${tOf(this.ctx, team).icon} ${name} STRIKE!`, at: performance.now() }; this.ctx.sfx('win'); } if (mark) this.feed.push(h('div', {}, `${tOf(this.ctx, team).icon} ${name} ${mark === 'X' ? '스트라이크!' : '스페어!'}`)); }
    return s.avg;
  },
  draw() {
    const s = this.s; const c = this.cv.getContext('2d'); const now = performance.now(); const ctx = this.ctx;
    c.fillStyle = '#141833'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { c.fillStyle = `hsla(${(i * 47) % 360},80%,60%,.18)`; c.beginPath(); c.arc((i * 151) % W, 40 + ((i * 37) % 80), 30, 0, 7); c.fill(); }
    const n = ctx.teams.length; const lw = Math.min(260, (W - 60) / n - 20); const x0 = (W - (lw + 20) * n + 20) / 2; const top = 150, bot = H - 30;
    ctx.teams.forEach((tm, i) => {
      const x = x0 + i * (lw + 20); const lg = c.createLinearGradient(0, top, 0, bot); lg.addColorStop(0, '#b98a52'); lg.addColorStop(1, '#e8bf86'); c.fillStyle = '#2c3150'; c.fillRect(x - 10, top, lw + 20, bot - top); c.fillStyle = lg; c.fillRect(x, top, lw, bot - top);
      c.fillStyle = tm.color; c.fillRect(x - 10, bot - 10, lw + 20, 10); T(c, `${tm.icon} ${tm.name}`, x + lw / 2, top - 30, 30);
      const L = this.last[tm.id]; const fresh = L && now - L.at < 2500; const down = fresh ? L.n : 0; const k = fresh ? Math.min(1, (now - L.at) / 700) : 0;
      PINS.forEach(([px, py], j) => { const fallen = fresh && L.dn.has(j); const sx = x + lw / 2 + px * lw * 0.55 + (fallen ? (px >= 0 ? 1 : -1) * 30 * k : 0), sy = top + 40 + (10.4 - py) * 50 * 0.5 + (fallen ? -20 * k : 0); c.globalAlpha = fallen ? 1 - k * 0.7 : 1; c.fillStyle = '#fff'; c.beginPath(); c.arc(sx, sy, 11, 0, 7); c.fill(); c.strokeStyle = '#e03131'; c.lineWidth = 3; c.beginPath(); c.arc(sx, sy, 6, 0, 7); c.stroke(); c.globalAlpha = 1; });
      if (fresh) T(c, L.mark === 'X' ? 'STRIKE' : L.mark === '/' ? 'SPARE' : `${L.n}개`, x + lw / 2, top + 260, L.mark ? 40 : 34, L.mark ? '#ffd43b' : '#fff');
      if (fresh) T(c, L.name, x + lw / 2, top + 310, 24, '#ffffffcc', 'center', 800);
      const best = (s?.top || []).filter((r) => r[2] === tm.id)[0]; if (best) T(c, `팀 최고 ${best[0]} ${best[1]}점`, x + lw / 2, bot - 40, 22, '#3b2a12', 'center', 800);
    });
    if (this.big && now - this.big.at < 2200) { c.fillStyle = '#000b'; rr(c, W / 2 - 380, 20, 760, 100, 24); c.fill(); T(c, this.big.txt, W / 2, 70, 56, '#ffd43b'); }
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

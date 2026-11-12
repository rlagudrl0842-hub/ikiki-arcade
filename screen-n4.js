// 새 터치게임 4종 대형 화면: 풍선 축제 부스 · 폭탄 패스 경기장 · 보스 전투장 · 타워 시상 무대
// 장면마다 배경·오브젝트를 따로 그림(같은 배경 복사 없음). 점수·안내를 가리지 않도록 오른쪽 팀 패널과 위쪽 띠에 정보
import { h } from './client.js';
import { V } from './screen-games.js';
import { loop, canvas, drawEmo, teamPanel } from './screen-n.js';
import { BALLOON_COLORS } from './gen2.js';
import * as S3 from './scene3d.js'; // 게임별 3D 배경
const tone = () => document.body.dataset.tone || 'base'; const P3 = (c, W, H, id, dim) => { S3.paint(c, W, H, id, performance.now() / 1000, { tone: tone() }); if (dim) { c.fillStyle = `rgba(7,10,30,${dim})`; c.fillRect(0, 0, W, H); } };

const W = 1300, H = 880;
const scene = (self, ctx, title, fmt, gf) => { self.ctx = ctx; self.cv = canvas(W, H); self.panel = teamPanel(ctx, title, fmt, gf); self.big = h('div', { class: 'nbig' }); return h('div', { class: 'nar' }, h('div', { class: 'narc', style: { width: `${W}px` } }, self.cv, self.big), h('div', { class: 'nside' }, self.panel)); };
const lanes = (ctx) => { const n = ctx.teams.length; const cols = n <= 4 ? n : Math.ceil(n / 2); const rows = n <= 4 ? 1 : 2; return ctx.teams.map((t, i) => ({ t, x: (i % cols) * (W / cols), y: Math.floor(i / cols) * ((H - 120) / rows) + 120, w: W / cols, h: (H - 120) / rows })); };

// ---------------------------------------------------------------- 풍선 터뜨리기: 운동회 축제 부스
V.balloon = {
  mount(root, ctx) { root.append(scene(this, ctx, '팀 평균 점수')); this.parts = []; this.fly = []; loop(this, (t) => this.draw(t)); },
  update(s) {
    this.s = s; this.panel.set(s.avg);
    const L = lanes(this.ctx);
    for (const [t, ok] of s.fx || []) { const ln = L.find((x) => x.t.id === t); if (!ln) continue; const x = ln.x + ln.w * (0.15 + Math.random() * 0.7), y = ln.y + ln.h * (0.25 + Math.random() * 0.5); this.parts.push({ x, y, at: performance.now(), ok, c: ok ? BALLOON_COLORS[s.tgt][1] : '#ffffff' }); }
    if (this.parts.length > 160) this.parts.splice(0, this.parts.length - 160);
    if (s.tgt !== this.tgt) { if (this.tgt != null) { this.ctx.sfx('tick'); this.ctx.say(`${BALLOON_COLORS[s.tgt][0]} 풍선!`, 1.15); } this.tgt = s.tgt; this.tgtAt = performance.now(); }
    return s.avg;
  },
  draw(t) {
    const s = this.s; const c = this.cv.getContext('2d'); const ctx = this.ctx;
    // 하늘 + 축제 천막 + 만국기
    P3(c, W, H, 'balloon');
    for (let i = 0; i < 6; i++) { const x = 40 + i * 215; c.fillStyle = i % 2 ? '#ff4d6d' : '#ffffff'; c.beginPath(); c.moveTo(x, 520); c.lineTo(x + 90, 450); c.lineTo(x + 180, 520); c.fill(); c.fillStyle = i % 2 ? '#ffffff' : '#ff4d6d'; c.fillRect(x + 10, 520, 160, 40); }
    c.strokeStyle = '#444'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 105); c.quadraticCurveTo(W / 2, 150, W, 105); c.stroke();
    for (let i = 0; i < 26; i++) { const x = (i + 0.5) * (W / 26); const y = 105 + Math.sin((x / W) * Math.PI) * 45 * 0.98; c.fillStyle = ['#ff4d6d', '#ffd43b', '#3d8bff', '#2fd27a', '#b06bff'][i % 5]; c.beginPath(); c.moveTo(x - 14, y); c.lineTo(x + 14, y); c.lineTo(x, y + 26); c.fill(); }
    if (!s) return;
    // 목표 색 띠 (가장 크게)
    const [nm, col] = BALLOON_COLORS[s.tgt]; const pulse = 1 + Math.max(0, 1 - (performance.now() - (this.tgtAt || 0)) / 600) * 0.12;
    c.save(); c.translate(W / 2, 52); c.scale(pulse, pulse); c.fillStyle = '#0b0e24dd'; c.beginPath(); c.roundRect(-330, -42, 660, 84, 42); c.fill();
    c.fillStyle = col; c.beginPath(); c.ellipse(-250, 0, 26, 32, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = '900 46px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`${nm} 풍선만 콕!  ${Math.ceil(s.left)}초`, 30, 2); c.restore();
    // 팀 구역: 떠오르는 풍선 + 팀 콤보 게이지
    for (const ln of lanes(ctx)) {
      const cb = s.combo?.[ln.t.id] || 0; const k = Math.min(1, cb / 25);
      c.fillStyle = '#0b0e2455'; c.fillRect(ln.x + 8, ln.y + 8, ln.w - 16, ln.h - 16);
      for (let i = 0; i < 7; i++) { const bx = ln.x + ((i + 0.5) / 7) * ln.w; const by = ln.y + ln.h - (((t / 1000) * (30 + i * 7) + i * 90) % (ln.h - 40)); c.fillStyle = BALLOON_COLORS[(i + ln.t.id) % 5][1] + 'cc'; c.beginPath(); c.ellipse(bx, by, 20, 25, 0, 0, 7); c.fill(); }
      c.fillStyle = ln.t.color; c.fillRect(ln.x + 16, ln.y + ln.h - 58, (ln.w - 32) * k, 40);
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(ln.x + 16, ln.y + ln.h - 58, ln.w - 32, 40);
      c.fillStyle = '#fff'; c.font = '900 26px sans-serif'; c.textAlign = 'left'; c.fillText(`${ln.t.icon} ${ln.t.name}`, ln.x + 20, ln.y + 34);
      c.textAlign = 'center'; c.fillStyle = '#111'; c.font = '900 24px sans-serif'; c.fillText(cb >= 25 ? `🔥 팀 콤보 ${cb} · +3` : cb >= 10 ? `🔥 팀 콤보 ${cb} · +2` : `팀 콤보 ${cb}`, ln.x + ln.w / 2, ln.y + ln.h - 37);
    }
    const now = performance.now(); this.parts = this.parts.filter((p) => now - p.at < 600);
    for (const p of this.parts) { const k = (now - p.at) / 600; c.globalAlpha = 1 - k; c.strokeStyle = p.c; c.lineWidth = 4; for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; c.beginPath(); c.moveTo(p.x + Math.cos(a) * 8, p.y + Math.sin(a) * 8); c.lineTo(p.x + Math.cos(a) * (14 + k * 26), p.y + Math.sin(a) * (14 + k * 26)); c.stroke(); } c.globalAlpha = 1; }
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

// ---------------------------------------------------------------- 폭탄 패스: 경기장(응원석) — 폭탄 위치·심지는 가리지 않음
V.bombpass = {
  mount(root, ctx) { root.append(scene(this, ctx, '폭발 적은 팀이 앞서요', (v) => `💥 ${Math.round(50 - v)}번`, (g) => `폭발 ${Math.round(g)}번 차이`)); this.trails = []; this.booms = []; this.seen = new Set(); loop(this, (t) => this.draw(t)); },
  update(s) {
    this.s = s;
    for (const b of s.bombs) if (b.dead && !this.seen.has(b.id + ':' + (this.s.booms[b.t] || 0))) { this.seen.add(b.id + ':' + (this.s.booms[b.t] || 0)); this.booms.push({ t: b.t, at: performance.now() }); this.ctx.sfx('bad'); }
    for (const [a, b] of s.moves || []) this.trails.push({ a, b, at: performance.now() });
    if (this.trails.length > 60) this.trails.splice(0, this.trails.length - 60);
    // 팀 패널: 폭발 수가 적을수록 앞 (값은 −폭발)
    const v = {}; for (const [k, x] of Object.entries(s.team)) v[k] = 50 + x; this.panel.set(v, 50);
    return s.team;
  },
  draw(t) {
    const s = this.s; const c = this.cv.getContext('2d'); const ctx = this.ctx;
    P3(c, W, H, 'bombpass', 0.2);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 40; i++) { c.fillStyle = ['#ff4d6d55', '#3d8bff55', '#ffd43b55', '#2fd27a55'][(i + r) % 4]; c.beginPath(); c.arc(16 + i * 33, 22 + r * 22 + Math.sin(t / 300 + i) * 2, 8, 0, 7); c.fill(); }
    c.fillStyle = '#ffffff'; c.font = '900 34px sans-serif'; c.textAlign = 'center'; c.fillText('💣 폭탄이 오면 다른 팀으로 휙! 심지가 다 타면 펑!', W / 2, 136);
    if (!s) return;
    const L = lanes(ctx).map((ln) => ({ ...ln, y: ln.y + 40, h: ln.h - 40 }));
    const center = (id) => { const ln = L.find((x) => x.t.id === id); return ln ? [ln.x + ln.w / 2, ln.y + ln.h / 2] : [W / 2, H / 2]; };
    for (const ln of L) {
      const bm = s.booms[ln.t.id] || 0; const hot = this.booms.find((b) => b.t === ln.t.id && performance.now() - b.at < 900);
      c.fillStyle = hot ? '#ff4d6d66' : ln.t.color + '33'; c.fillRect(ln.x + 8, ln.y + 8, ln.w - 16, ln.h - 16); c.strokeStyle = ln.t.color; c.lineWidth = 4; c.strokeRect(ln.x + 8, ln.y + 8, ln.w - 16, ln.h - 16);
      c.fillStyle = '#fff'; c.font = '900 30px sans-serif'; c.textAlign = 'left'; c.fillText(`${ln.t.icon} ${ln.t.name}`, ln.x + 22, ln.y + 46);
      c.textAlign = 'right'; c.font = '900 34px sans-serif'; c.fillStyle = bm ? '#ffd43b' : '#ffffffaa'; c.fillText(`💥 ${bm}`, ln.x + ln.w - 22, ln.y + 48);
    }
    // 폭탄들 (팀 구역 안에 펼쳐 놓음) + 심지 막대
    const per = {}; for (const b of s.bombs) (per[b.t] = per[b.t] || []).push(b);
    for (const [tid, arr] of Object.entries(per)) {
      const ln = L.find((x) => x.t.id === +tid); if (!ln) continue; const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(arr.length * 1.6)))); const cw = (ln.w - 40) / cols; const rh = Math.min(130, (ln.h - 80) / Math.ceil(arr.length / cols));
      arr.forEach((b, i) => {
        const x = ln.x + 20 + cw * (i % cols) + cw / 2; const y = ln.y + 80 + rh * Math.floor(i / cols) + rh / 2; const low = b.left < 3;
        if (b.dead) { c.globalAlpha = 0.9; drawEmo(c, '💥', Math.min(90, rh * 0.8), x, y); c.globalAlpha = 1; return; }
        const sh = low ? Math.sin(t / 30) * 4 : 0; drawEmo(c, '💣', Math.min(70, rh * 0.55), x + sh, y - 10);
        c.fillStyle = '#ffffff33'; c.fillRect(x - cw * 0.38, y + rh * 0.24, cw * 0.76, 10); c.fillStyle = low ? '#ff4d6d' : '#ffd43b'; c.fillRect(x - cw * 0.38, y + rh * 0.24, cw * 0.76 * Math.min(1, b.left / 12), 10);
        c.fillStyle = '#fff'; c.font = '800 18px sans-serif'; c.textAlign = 'center'; c.fillText(`${b.h || ''} ${b.left.toFixed(0)}초`, x, y + rh * 0.24 - 8);
      });
    }
    const now = performance.now(); this.trails = this.trails.filter((x) => now - x.at < 500);
    for (const tr of this.trails) { const [ax, ay] = center(tr.a); const [bx, by] = center(tr.b); const k = (now - tr.at) / 500; c.strokeStyle = `rgba(255,212,59,${1 - k})`; c.lineWidth = 5; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx) / 2, Math.min(ay, by) - 120, bx, by); c.stroke(); drawEmo(c, '💣', 36, ax + (bx - ax) * k, ay + (by - ay) * k - Math.sin(k * Math.PI) * 120); }
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

// ---------------------------------------------------------------- 보스 레이드: 전투 경기장
V.boss = {
  mount(root, ctx) { root.append(scene(this, ctx, '보스 체력 깎은 % ', (v) => `${Math.round(v)}%`)); this.sp = []; this.done = new Set(); loop(this, (t) => this.draw(t)); },
  update(s) {
    this.s = s; this.panel.set(s.team, 100);
    const L = lanes(this.ctx);
    for (const [t, d] of s.fx || []) { const ln = L.find((x) => x.t.id === t); if (ln && this.sp.length < 220) this.sp.push({ x: ln.x + ln.w / 2 + (Math.random() - 0.5) * ln.w * 0.5, y: ln.y + ln.h * 0.45 + (Math.random() - 0.5) * ln.h * 0.35, d, at: performance.now() }); }
    for (const [t, v] of Object.entries(s.T)) if (v.done != null && !this.done.has(t)) { this.done.add(t); const tm = this.ctx.team(+t); this.ctx.sfx('win'); this.big.textContent = `${tm.icon} ${tm.name} 보스 처치! ${v.rank}등`; this.big.classList.add('flash'); clearTimeout(this.bt); this.bt = setTimeout(() => { this.big.textContent = ''; this.big.classList.remove('flash'); }, 2500); }
    return s.team;
  },
  draw(t) {
    const s = this.s; const c = this.cv.getContext('2d'); const ctx = this.ctx;
    P3(c, W, H, 'boss', 0.15);
    c.strokeStyle = '#ffb36633'; c.lineWidth = 2; for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(W / 2, H * 0.95, 80 + i * 60, 20 + i * 14, 0, Math.PI, 0); c.stroke(); }
    c.fillStyle = '#ffd9a8'; c.font = '900 34px sans-serif'; c.textAlign = 'center'; c.fillText('🐉 폰에서 빛나는 약점 칸을 콕! 빨리 누르면 치명타', W / 2, 70);
    if (!s) return;
    for (const ln of lanes(ctx)) {
      const v = s.T[ln.t.id]; if (!v || !v.max) continue; const k = v.hp / v.max; const cx = ln.x + ln.w / 2; const cy = ln.y + ln.h * 0.45; const sz = Math.min(ln.w * 0.62, ln.h * 0.55);
      c.fillStyle = ln.t.color + '22'; c.fillRect(ln.x + 8, ln.y + 8, ln.w - 16, ln.h - 16);
      if (v.done == null) { const wob = Math.sin(t / 300 + ln.t.id) * 6; c.save(); c.globalAlpha = 0.35 + 0.65 * Math.max(0.2, k); drawEmo(c, '🐉', sz, cx, cy + wob); c.restore(); }
      else { drawEmo(c, '🏆', sz * 0.7, cx, cy); c.fillStyle = '#ffd43b'; c.font = '900 34px sans-serif'; c.textAlign = 'center'; c.fillText(`처치! ${v.rank}등 · ${v.done}초`, cx, cy + sz * 0.5); }
      const bw = ln.w - 50; const by = ln.y + ln.h - 66; c.fillStyle = '#ffffff22'; c.fillRect(ln.x + 25, by, bw, 28); c.fillStyle = k > 0.3 ? '#ff4d6d' : '#ffd43b'; c.fillRect(ln.x + 25, by, bw * k, 28); c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(ln.x + 25, by, bw, 28);
      c.fillStyle = '#fff'; c.font = '900 26px sans-serif'; c.textAlign = 'left'; c.fillText(`${ln.t.icon} ${ln.t.name}`, ln.x + 22, ln.y + 40); c.textAlign = 'right'; c.font = '800 22px sans-serif'; c.fillText(`HP ${v.hp}/${v.max}`, ln.x + ln.w - 25, by - 10);
    }
    const now = performance.now(); this.sp = this.sp.filter((p) => now - p.at < 450);
    for (const p of this.sp) { const k = (now - p.at) / 450; c.globalAlpha = 1 - k; c.fillStyle = p.d > 1 ? '#ffd43b' : '#ffffff'; c.font = `900 ${p.d > 1 ? 40 : 28}px sans-serif`; c.textAlign = 'center'; c.fillText(p.d > 1 ? '⚡2' : '💥', p.x, p.y - k * 40); c.globalAlpha = 1; }
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

// ---------------------------------------------------------------- 타워 쌓기: 시상 무대
V.towerup = {
  mount(root, ctx) { root.append(scene(this, ctx, '탑 평균 높이 (층)', (v) => v.toFixed(1))); loop(this, (t) => this.draw(t)); },
  update(s) { this.s = s; this.panel.set(s.team); for (const l of s.lanes) if (l.drop?.perfect && l.drop.at !== this.lastPerf) { this.lastPerf = l.drop.at; this.ctx.sfx('good'); } return s.team; },
  draw(t) {
    const s = this.s; const c = this.cv.getContext('2d'); const ctx = this.ctx;
    P3(c, W, H, 'towerup');
    for (let i = 0; i < 5; i++) { const x = 130 + i * 260; const a = Math.sin(t / 900 + i) * 0.25; c.save(); c.translate(x, 0); c.rotate(a); const sg = c.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, '#ffffff22'); sg.addColorStop(1, '#ffffff00'); c.fillStyle = sg; c.beginPath(); c.moveTo(-20, 0); c.lineTo(20, 0); c.lineTo(160, H); c.lineTo(-160, H); c.fill(); c.restore(); }
    c.fillStyle = '#3b2b6b'; c.fillRect(0, H - 70, W, 70); c.fillStyle = '#ffd43b'; c.fillRect(0, H - 74, W, 6);
    c.fillStyle = '#fff'; c.font = '900 32px sans-serif'; c.textAlign = 'center'; c.fillText('🏗 차례가 오면 블록이 탑과 딱 겹칠 때 탭!', W / 2, 52);
    if (!s) return;
    const byT = {}; for (const l of s.lanes) (byT[l.t] = byT[l.t] || []).push(l);
    const n = ctx.teams.length; const cw = W / Math.max(1, n);
    ctx.teams.forEach((tm, i) => {
      const ls = byT[tm.id] || []; const x0 = i * cw; const ttl = s.team[tm.id] || 0;
      c.fillStyle = tm.color; c.font = '900 26px sans-serif'; c.textAlign = 'center'; c.fillText(`${tm.icon} ${tm.name}`, x0 + cw / 2, H - 30);
      c.fillStyle = '#fff'; c.font = '900 30px sans-serif'; c.fillText(`${ttl.toFixed(1)}층`, x0 + cw / 2, 100);
      const k = Math.min(ls.length, 4); const lw = (cw - 30) / Math.max(1, k);
      ls.slice(0, 4).forEach((l, j) => {
        const lx = x0 + 15 + j * lw; const bh = Math.min(34, (H - 260) / Math.max(10, l.h + 1)); const blocks = Math.min(l.h, Math.floor((H - 260) / bh));
        for (let b = 0; b < blocks; b++) { const y = H - 80 - (b + 1) * bh; const st = l.stack?.[l.stack.length - (blocks - b)]; const bx = st ? st[0] : 0.29; const bw = st ? st[1] : 0.42; c.fillStyle = b === blocks - 1 ? tm.color : tm.color + 'b0'; c.fillRect(lx + bx * lw, y, Math.max(4, bw * lw), bh - 3); }
        if (l.drop) { const y = H - 80 - (blocks + 1) * bh; c.globalAlpha = 0.8; c.fillStyle = l.drop.ok ? (l.drop.perfect ? '#ffd43b' : '#fff') : '#ff4d6d'; c.fillRect(lx + l.drop.x * lw, y, l.drop.w * lw, bh - 3); c.globalAlpha = 1; if (l.drop.perfect) { c.fillStyle = '#ffd43b'; c.font = '900 22px sans-serif'; c.fillText('PERFECT!', lx + lw / 2, y - 8); } }
        c.fillStyle = '#ffffffcc'; c.font = '700 16px sans-serif'; c.fillText(l.who || '', lx + lw / 2, H - 80 - (blocks + 1) * bh - 30);
      });
    });
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

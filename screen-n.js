// 새 게임 대형 화면 (V에 등록) — 1920×1080 기준, 게임 영역 1832×880
import { h } from './client.js';
import { V } from './screen-games.js';
import { ropeBeats, FRUITS } from './gen2.js';

const AW = 1600, AH = 860;
export function loop(self, fn) { const f = (t) => { if (self.dead) return; try { fn(t); } catch (e) { console.error(e); } self.raf = requestAnimationFrame(f); }; self.raf = requestAnimationFrame(f); }
export function canvas(w, hh) { const c = h('canvas', { width: w, height: hh, style: { width: `${w}px`, height: `${hh}px` } }); return c; }
// 빛나는 팀 토큰 (미리 그려 두고 재사용 → 300명도 가볍게)
const SPR = new Map();
export function token(color, R) {
  const k = color + R; if (SPR.has(k)) return SPR.get(k);
  const S = Math.ceil(R * 3.2); const cv = document.createElement('canvas'); cv.width = cv.height = S * 2; const c = cv.getContext('2d');
  const g = c.createRadialGradient(S, S, R * 0.6, S, S, S); g.addColorStop(0, color + 'aa'); g.addColorStop(1, color + '00'); c.fillStyle = g; c.fillRect(0, 0, S * 2, S * 2);
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(S, S, R + 2.2, 0, 7); c.fill();
  const b = c.createRadialGradient(S - R * 0.35, S - R * 0.35, R * 0.1, S, S, R); b.addColorStop(0, '#ffffff'); b.addColorStop(0.25, color); b.addColorStop(1, color);
  c.fillStyle = b; c.beginPath(); c.arc(S, S, R, 0, 7); c.fill();
  SPR.set(k, cv); return cv;
}
const drawToken = (c, color, R, x, y) => { const t = token(color, R); c.drawImage(t, x - t.width / 2, y - t.height / 2); };
// 이모지도 미리 그려 둔 그림으로 (fillText로 수백 개 그리면 대형 화면이 버벅임)
const EMO = new Map();
export function emo(e, px) {
  const k = e + px; if (EMO.has(k)) return EMO.get(k);
  const S = Math.ceil(px * 1.35); const cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
  c.font = `${px}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, S / 2, S / 2 + px * 0.05);
  EMO.set(k, cv); return cv;
}
export const drawEmo = (c, e, px, x, y) => { const im = emo(e, Math.round(px)); c.drawImage(im, x - im.width / 2, y - im.height / 2); };
// 사람 실루엣 (팀 색 운동복). ph: 달리기 동작 0~1, air: 점프 높이 0~1
export function figure(c, x, y, s, color, { ph = 0, air = 0, arms = 0 } = {}) {
  const yy = y - air * s * 0.9; const sw = Math.sin(ph * Math.PI * 2);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = '#e8ecff'; c.lineWidth = s * 0.13;
  c.beginPath(); c.moveTo(x, yy - s * 0.95); c.lineTo(x + sw * s * 0.25, yy - s * 0.35 + air * s * 0.1); c.moveTo(x, yy - s * 0.95); c.lineTo(x - sw * s * 0.25, yy - s * 0.35 + air * s * 0.1); c.stroke();
  c.strokeStyle = color; c.lineWidth = s * 0.16;
  c.beginPath(); c.moveTo(x, yy - s * 1.0); c.lineTo(x, yy - s * 1.5); c.stroke();
  c.lineWidth = s * 0.11; const ar = arms || air;
  c.beginPath(); c.moveTo(x, yy - s * 1.42); c.lineTo(x - s * 0.32, yy - s * (1.15 + ar * 0.55)); c.moveTo(x, yy - s * 1.42); c.lineTo(x + s * 0.32, yy - s * (1.15 + ar * 0.55)); c.stroke();
  c.strokeStyle = '#e8ecff'; c.lineWidth = s * 0.13; c.beginPath(); c.moveTo(x, yy - s * 1.0); c.lineTo(x - s * 0.12 - sw * s * 0.18, yy - s * 0.02); c.moveTo(x, yy - s * 1.0); c.lineTo(x + s * 0.12 + sw * s * 0.18, yy - s * 0.02); c.stroke();
  c.fillStyle = '#ffe2c6'; c.beginPath(); c.arc(x, yy - s * 1.72, s * 0.2, 0, 7); c.fill();
  c.fillStyle = '#1a1a2e'; c.beginPath(); c.arc(x, yy - s * 1.78, s * 0.2, Math.PI, 0); c.fill();
}
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
const lerp = (a, b, k) => a + (b - a) * k;

// 오른쪽 팀 현황 패널 (값 막대 + 1등 왕관)
export function teamPanel(ctx, title, fmt = (v) => Math.round(v)) {
  const el = h('div', { class: 'np' }, h('div', { class: 'npt' }, title));
  const rows = {};
  for (const t of ctx.teams) { const fill = h('div', { class: 'npf', style: { background: t.color } }); const val = h('b', {}, '0'); const row = h('div', { class: 'npr' }, h('span', { class: 'npi' }, t.icon), h('div', { class: 'npn' }, h('div', {}, t.name), h('div', { class: 'npb' }, fill)), val); rows[t.id] = { row, fill, val }; el.append(row); }
  el.set = (vals, max) => {
    const arr = Object.entries(vals || {}); const m = max || Math.max(1, ...arr.map((x) => x[1])); const best = Math.max(...arr.map((x) => x[1]));
    const order = arr.slice().sort((a, b) => b[1] - a[1]).map((x) => +x[0]);
    for (const [id, v] of arr) { const r = rows[id]; if (!r) continue; r.fill.style.width = `${Math.max(2, Math.min(100, (v / m) * 100))}%`; r.val.textContent = fmt(v); r.row.classList.toggle('lead', v > 0 && v === best); r.row.style.order = order.indexOf(+id); }
  };
  return el;
}
export function feed() { const el = h('div', { class: 'nfeed' }); el.push = (node) => { el.prepend(node); while (el.children.length > 7) el.lastChild.remove(); }; return el; }

// ================================================================ 아레나 공용
function arenaScreen(kind) {
  return {
    mount(root, ctx) {
      this.ctx = ctx; this.cur = null; this.prev = null; this.shake = 0; this.bolts = []; this.seenBoom = new Set(); this.seenBite = new Set();
      const W = 1440, H = Math.round(1440 * AH / AW);
      this.cv = canvas(W, H); this.W = W; this.H = H;
      this.big = h('div', { class: 'nbig' });
      this.panel = teamPanel(ctx, { dodge: '팀별 생존자', zombie: '팀별 남은 사람', paint: '1인당 땅 (칸)', gems: '보석 점수 (팀 평균)', crown: '왕관 시간 (팀 평균, 초)' }[kind], kind === 'paint' ? (v) => v.toFixed(1) : undefined);
      this.feed = feed();
      root.append(h('div', { class: 'nar' }, h('div', { class: 'narc' }, this.cv, this.big), h('div', { class: 'nside' }, this.panel, this.feed)));
      loop(this, (t) => this.draw(t));
    },
    update(s) {
      this.prev = this.cur; this.cur = { s, at: performance.now() };
      if (s.nm) this.names = s.nm;
      const ctx = this.ctx;
      if (kind === 'dodge') {
        this.panel.set(s.alive); this.big.textContent = `남은 사람 ${s.aliveN}명`;
        for (const [x, y, r, age] of s.boom || []) { const k = `${x},${y},${r}`; if (!this.seenBoom.has(k) && age < 0.35) { this.seenBoom.add(k); this.bolts.push({ x, y, r, at: performance.now() }); this.shake = 14; ctx.sfx('boom'); } }
        return s.alive;
      }
      if (kind === 'zombie') {
        this.panel.set(s.humans); this.big.textContent = `🙂 ${s.humanN}  vs  🧟 ${s.zN}`;
        for (const b of s.bites || []) { const k = `${b[3]}>${b[4]}`; if (this.seenBite.has(k)) continue; this.seenBite.add(k); const t = ctx.team(b[5]); this.feed.push(h('div', { class: 'nfi' }, `🧟 ${b[4]} → `, h('b', { style: { color: t.color } }, b[3])));  this.bolts.push({ x: b[0], y: b[1], r: 60, at: performance.now(), z: true }); }
        return s.humans;
      }
      if (kind === 'gems') { this.panel.set(s.avg); for (const f of s.fx || []) { const k = `${f[0]},${f[1]}`; if (f[4] < 0.25 && !this.seenBoom.has(k)) { this.seenBoom.add(k); this.bolts.push({ x: f[0], y: f[1], r: 40 + f[2] * 12, at: performance.now(), gem: f[2], team: f[3] }); if (f[2] >= 5) { ctx.sfx('win'); this.big.textContent = `${ctx.team(f[3]).name} 대형 보석!`; } } } return s.avg; }
      if (kind === 'crown') { this.panel.set(s.avg); const n = Object.entries(s.inside || {}).sort((a, b) => b[1] - a[1])[0]; this.big.textContent = n && n[1] ? `지금 왕관: ${ctx.team(+n[0]).name} (${n[1]}명)` : ''; return s.avg; }
      this.panel.set(s.per); this.big.textContent = '';
      return s.per;
    },
    // 이름표: 80명 이하일 때만 (그 이상은 겹쳐서 읽을 수 없음)
    label(c, k, X, Y, n) {
      const nm = this.names?.[k]; if (!nm || n > 80) return;
      c.font = `800 ${n <= 30 ? 17 : 13}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom';
      c.lineWidth = 4; c.strokeStyle = '#0b0e24cc'; c.strokeText(nm, X, Y); c.fillStyle = '#fff'; c.fillText(nm, X, Y);
    },
    pos(i) { // 이전·현재 프레임 사이 부드럽게
      const c = this.cur.s.ps; const p = this.prev?.s.ps; const k = Math.min(1, (performance.now() - this.cur.at) / 200);
      if (!p || p.length !== c.length) return [c[i], c[i + 1]];
      return [lerp(p[i], c[i], k), lerp(p[i + 1], c[i + 1], k)];
    },
    draw(t) {
      if (!this.cur) return;
      const { W, H } = this; const sx = W / AW, sy = H / AH; const c = this.cv.getContext('2d'); const s = this.cur.s; const ctx = this.ctx;
      c.save();
      if (this.shake > 0.5) { c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake); this.shake *= 0.88; }
      // 바닥
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, kind === 'zombie' ? '#10261a' : '#151c4f'); g.addColorStop(1, kind === 'zombie' ? '#0a140d' : '#0c1030');
      c.fillStyle = g; c.fillRect(-20, -20, W + 40, H + 40);
      if (kind === 'paint' && s.grid) {
        // 칠한 땅은 바뀔 때만 따로 그려 두고 매 프레임엔 붙여 넣기만
        if (this.gridKey !== s.grid) {
          this.gridKey = s.grid; const gc = (this.gridCv ||= document.createElement('canvas')); gc.width = W; gc.height = H; const g2 = gc.getContext('2d');
          const cw = W / s.GC, ch = H / s.GR; g2.globalAlpha = 0.78;
          for (let i = 0; i < s.grid.length; i++) { const ch0 = s.grid[i]; if (ch0 === '.') continue; g2.fillStyle = ctx.team(parseInt(ch0, 36)).color; g2.fillRect((i % s.GC) * cw, Math.floor(i / s.GC) * ch, cw + 0.6, ch + 0.6); }
        }
        c.drawImage(this.gridCv, 0, 0);
      }
      c.strokeStyle = '#ffffff0d'; c.lineWidth = 1; c.beginPath(); for (let x = 0; x <= AW; x += 80) { c.moveTo(x * sx, 0); c.lineTo(x * sx, H); } for (let y = 0; y <= AH; y += 80) { c.moveTo(0, y * sy); c.lineTo(W, y * sy); } c.stroke();
      if (kind === 'gems') for (const [x, y, v] of s.gems || []) { const X = x * sx, Y = y * sy; const r = v >= 5 ? 16 : v === 2 ? 10 : 8; const col = v >= 5 ? '#ffd43b' : v === 2 ? '#7cf3ff' : '#c08bff'; c.save(); c.translate(X, Y); c.rotate(Math.PI / 4 + Math.sin(t / 400 + x) * 0.2); c.fillStyle = col + '40'; c.fillRect(-r * 1.8, -r * 1.8, r * 3.6, r * 3.6); c.fillStyle = col + '66'; c.fillRect(-r * 1.35, -r * 1.35, r * 2.7, r * 2.7); /* 빛 번짐(shadowBlur)은 보석마다 매 프레임 계산이라 느림 → 반투명 사각형 2겹으로 대신 */ c.fillStyle = col; c.fillRect(-r, -r, r * 2, r * 2); c.fillStyle = '#ffffff99'; c.fillRect(-r, -r, r, r * 0.6); c.restore(); }
      if (kind === 'crown' && s.z) { const [x, y, r, tx, ty] = s.z; c.strokeStyle = '#ffd43b44'; c.setLineDash([10, 12]); c.lineWidth = 3; c.beginPath(); c.moveTo(x * sx, y * sy); c.lineTo(tx * sx, ty * sy); c.stroke(); c.setLineDash([]); const g = c.createRadialGradient(x * sx, y * sy, 10, x * sx, y * sy, r * sx); g.addColorStop(0, 'rgba(255,212,59,.45)'); g.addColorStop(1, 'rgba(255,212,59,.08)'); c.fillStyle = g; c.beginPath(); c.arc(x * sx, y * sy, r * sx, 0, 7); c.fill(); c.strokeStyle = '#ffd43b'; c.lineWidth = 5; c.stroke(); c.font = '48px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('👑', x * sx, y * sy - r * sx - 24); }
      if (kind === 'dodge') {
        const age = (performance.now() - this.cur.at) / 1000;
        for (const [, x, y, r, left, total] of s.warn || []) {
          const k = Math.max(0, Math.min(1, 1 - (left - age) / total));
          c.fillStyle = `rgba(255,212,59,${0.12 + 0.3 * k})`; c.beginPath(); c.arc(x * sx, y * sy, r * sx, 0, 7); c.fill();
          c.strokeStyle = '#ffd43b'; c.lineWidth = 4; c.setLineDash([14, 10]); c.lineDashOffset = -t / 30; c.stroke(); c.setLineDash([]);
          c.fillStyle = 'rgba(255,212,59,.55)'; c.beginPath(); c.moveTo(x * sx, y * sy); c.arc(x * sx, y * sy, r * sx * k, -Math.PI / 2, -Math.PI / 2 + k * 7); c.fill();
        }
      }
      // 사람들
      const ps = s.ps; const R = ps.length / 4 > 150 ? 8 : 11;
      // 1) 움직임 꼬리: 팀 색별로 모아서 한 번에 그림 (300명이면 선 300번 → 팀 수만큼)
      const pv = this.prev?.s.ps; const tails = new Map();
      if (pv && pv.length === ps.length) {
        for (let i = 0; i < ps.length; i += 4) {
          if ((kind === 'dodge' && ps[i + 3] === 2) || (kind === 'zombie' && ps[i + 3] === 1)) continue;
          const [x, y] = this.pos(i); const X = x * sx, Y = y * sy; const dx = X - pv[i] * sx, dy = Y - pv[i + 1] * sy;
          if (dx * dx + dy * dy > 16) { const col = ctx.team(ps[i + 2]).color; let a = tails.get(col); if (!a) tails.set(col, (a = [])); a.push(X - dx * 0.9, Y - dy * 0.9, X, Y); }
        }
        c.lineWidth = R * 1.2; c.lineCap = 'round';
        for (const [col, a] of tails) { c.strokeStyle = col + '55'; c.beginPath(); for (let k = 0; k < a.length; k += 4) { c.moveTo(a[k], a[k + 1]); c.lineTo(a[k + 2], a[k + 3]); } c.stroke(); }
      }
      // 2) 사람 토큰·이름
      const rings = new Map();
      for (let i = 0; i < ps.length; i += 4) {
        const [x, y] = this.pos(i); const tm = ctx.team(ps[i + 2]); const st = ps[i + 3];
        const X = x * sx, Y = y * sy;
        if (kind === 'dodge' && st === 2) { c.globalAlpha = 0.3; drawEmo(c, '💀', R * 1.6, X, Y); c.globalAlpha = 1; continue; }
        if (kind === 'zombie' && st === 1) { drawToken(c, '#2fbf4a', R * 1.25, X, Y); drawEmo(c, '🧟', R * 2.6, X, Y); let ra = rings.get(tm.color); if (!ra) rings.set(tm.color, (ra = [])); ra.push(X, Y); /* 팀 색 테두리는 아래에서 팀별로 한 번에 */ /* 잡힌 사람이 작아져 사라진 것처럼 보이지 않게 초록 빛 + 크게 */ this.label(c, i / 4, X, Y - R * 1.4 - 4, ps.length / 4); continue; }
        drawToken(c, (kind === 'dodge' && st === 1 && Math.floor(t / 90) % 2) ? '#ffffff' : tm.color, R, X, Y);
        this.label(c, i / 4, X, Y - R - 6, ps.length / 4);
      }
      if (rings.size) { c.lineWidth = 3; for (const [col, a] of rings) { c.strokeStyle = col; c.beginPath(); for (let k = 0; k < a.length; k += 2) { c.moveTo(a[k] + R * 1.6, a[k + 1]); c.arc(a[k], a[k + 1], R * 1.6, 0, 7); } c.stroke(); } }
      // 번개·물림 효과
      const now = performance.now();
      this.bolts = this.bolts.filter((b) => now - b.at < 600);
      for (const b of this.bolts) {
        const k = (now - b.at) / 600; const X = b.x * sx, Y = b.y * sy;
        if (b.gem) { c.strokeStyle = ctx.team(b.team).color; c.globalAlpha = 1 - k; c.lineWidth = 4; c.beginPath(); c.arc(X, Y, 10 + k * b.r, 0, 7); c.stroke(); c.globalAlpha = 1; continue; }
        if (b.z) { c.strokeStyle = `rgba(80,220,100,${1 - k})`; c.lineWidth = 6; c.beginPath(); c.arc(X, Y, 20 + k * 60, 0, 7); c.stroke(); continue; }
        c.fillStyle = `rgba(255,255,255,${0.75 * (1 - k)})`; c.beginPath(); c.arc(X, Y, b.r * sx * (1 + k * 0.3), 0, 7); c.fill();
        if (k < 0.5) { c.strokeStyle = `rgba(255,250,200,${1 - k * 2})`; c.lineWidth = 8; c.beginPath(); let px = X + 30, py = -10; c.moveTo(px, py); while (py < Y) { py += 50; px = X + (Math.random() - 0.5) * 70 * (1 - py / Y); c.lineTo(px, Math.min(py, Y)); } c.stroke(); }
      }
      c.restore();
    },
    unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
  };
}
V.dodge = arenaScreen('dodge');
V.zombie = arenaScreen('zombie');
V.paint = arenaScreen('paint');
V.gems = arenaScreen('gems');
V.crown = arenaScreen('crown');

// ================================================================ 무궁화 꽃이 피었습니다
const SONG = '무궁화꽃이피었습니다';
V.mugung = {
  drawFace(t, ph) {
    const c = this.face.getContext('2d'); const W = 380, H = 300; c.clearRect(0, 0, W, H);
    const look = ph === 'look', turn = ph === 'turn';
    const cx = W / 2, cy = 150;
    if (look) { const g = c.createRadialGradient(cx, cy, 10, cx, cy, 190); g.addColorStop(0, 'rgba(255,40,80,.55)'); g.addColorStop(1, 'rgba(255,40,80,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    // 몸
    c.fillStyle = '#20264f'; c.beginPath(); c.ellipse(cx, 300, 120, 95, 0, Math.PI, 0); c.fill();
    c.fillStyle = look ? '#ff2a4f' : '#2fd27a'; c.beginPath(); c.ellipse(cx, 300, 120, 95, 0, Math.PI, Math.PI + 0.001); c.fill();
    // 머리
    const sq = turn ? Math.abs(Math.sin(t / 60)) * 0.6 + 0.4 : 1;
    c.save(); c.translate(cx, cy - 20); c.scale(sq, 1);
    c.fillStyle = '#ffe2c6'; c.beginPath(); c.arc(0, 0, 80, 0, 7); c.fill();
    if (!look && !turn) { c.fillStyle = '#15172e'; c.beginPath(); c.arc(0, 0, 82, 0, 7); c.fill(); c.fillStyle = '#2a2f5a'; c.beginPath(); c.arc(-20, -25, 30, 0, 7); c.fill(); }
    else {
      c.fillStyle = '#15172e'; c.beginPath(); c.arc(0, -10, 84, Math.PI * 1.05, Math.PI * 1.95); c.fill();
      for (const sx2 of [-30, 30]) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(sx2, 10, 16, look ? 18 : 6, 0, 0, 7); c.fill(); if (look) { c.fillStyle = '#ff2a4f'; c.shadowColor = '#ff2a4f'; c.shadowBlur = 25; c.beginPath(); c.arc(sx2 + Math.sin(t / 300) * 5, 12, 8, 0, 7); c.fill(); c.shadowBlur = 0; } }
    }
    c.restore();
    if (look) { c.strokeStyle = 'rgba(255,60,90,.35)'; c.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = Math.PI * 0.55 + i * 0.12 + Math.sin(t / 400) * 0.25; c.beginPath(); c.moveTo(cx, cy - 10); c.lineTo(cx + Math.cos(a) * -400, cy + Math.sin(a) * 400); c.stroke(); } }
  },
  mount(root, ctx) {
    this.ctx = ctx; this.cur = null; this.prev = null; this.lastPh = null; this.seen = new Set();
    this.cv = canvas(1400, 880);
    this.face = canvas(380, 300);
    this.who = h('div', { class: 'mgwho' }, h('div', { class: 'mgface' }, this.face), h('div', { class: 'mgsong' }, ''));
    this.feed = feed(); this.stat = h('div', { class: 'npt' }, '');
    root.append(h('div', { class: 'nar mgs' }, h('div', { class: 'narc' }, this.cv), h('div', { class: 'nside mgside' }, this.who, this.stat, this.feed)));
    loop(this, (t) => this.draw(t));
  },
  update(s) {
    this.prev = this.cur; this.cur = { s, at: performance.now() };
    if (s.ph !== this.lastPh) {
      this.lastPh = s.ph;
      this.who.className = `mgwho ${s.ph}`;
      this.ctx.bgm?.hold(s.ph !== 'sing'); // 술래가 돌아보면 음악 뚝!
      if (s.ph === 'look') { this.ctx.sfx('bad'); }
      else if (s.ph === 'turn') { this.ctx.sfx('hurry'); }
      else { this.ctx.say('무궁화 꽃이 피었습니다', Math.min(2, 1.0 * (3.2 / Math.max(1.1, s.dur)))); }
    }
    for (const [name, team, kid] of s.caught || []) { const k = `${name}${team}${s.round}`; if (this.seen.has(k)) continue; this.seen.add(k); this.feed.push(h('div', { class: 'nfi' }, kid ? '↩️ ' : '😵 ', h('b', { style: { color: this.ctx.team(team).color } }, name), kid ? ' 뒤로!' : ' 탈락')); }
    this.stat.innerHTML = `🏁 도착 ${s.finN}명 · 😵 탈락 ${s.outN}명${s.top.length ? `<br>🥇 ${s.top.map((x) => x[0]).join(' · ')}` : ''}`;
    return s.avg;
  },
  draw(t) {
    if (!this.cur) return;
    const s = this.cur.s; const c = this.cv.getContext('2d'); const W = 1400, H = 880; const ctx = this.ctx;
    const look = s.ph === 'look';
    c.fillStyle = look ? '#3a0d18' : '#13204a'; c.fillRect(0, 0, W, H);
    // 결승선 (오른쪽, 술래 쪽)
    const x0 = 60, x1 = W - 90;
    c.fillStyle = '#ffffff'; for (let y = 0; y < H; y += 24) { c.fillRect(x1, y, 12, 12); c.fillRect(x1 + 12, y + 12, 12, 12); }
    const teams = ctx.teams; const lh = H / teams.length;
    teams.forEach((tm, i) => { c.fillStyle = i % 2 ? '#ffffff06' : '#ffffff0d'; c.fillRect(0, i * lh, W, lh); c.fillStyle = tm.color; c.fillRect(0, i * lh, 8, lh); c.font = `${Math.min(40, lh * 0.5)}px sans-serif`; c.textBaseline = 'middle'; c.fillText(tm.icon, 16, i * lh + lh / 2); });
    // 플레이어 점 (팀 줄 안에서 위아래로 흩어 놓기)
    const ps = s.ps; const pv = this.prev?.s.ps; const k = Math.min(1, (performance.now() - this.cur.at) / 400);
    const cnt = {};
    for (let i = 0; i < ps.length; i += 3) {
      const ti = teams.findIndex((x) => x.id === ps[i]); if (ti < 0) continue;
      const n = (cnt[ti] = (cnt[ti] || 0) + 1);
      const pos = pv && pv.length === ps.length ? lerp(pv[i + 1], ps[i + 1], k) : ps[i + 1];
      const X = x0 + 60 + (x1 - x0 - 80) * pos / 100; const Y = i / 3 % 2 ? 0 : 0;
      const yy = ti * lh + lh * (0.2 + ((n * 0.618) % 1) * 0.6) + Y;
      const st = ps[i + 2]; const tm = teams[ti];
      if (st === 1) { c.font = '22px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('✖', X, yy); continue; }
      const bob = st === 3 ? Math.sin(t / 70 + i) * 3 : 0;
      drawToken(c, tm.color, 8, X, yy + bob);
      const nmz = s.nm?.[i / 3]; if (nmz) { c.font = `700 ${ps.length / 3 <= 30 ? 15 : 12}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.lineWidth = 3; c.strokeStyle = '#0b0e24cc'; c.strokeText(nmz, X, yy + bob - 11); c.fillStyle = '#fff'; c.fillText(nmz, X, yy + bob - 11); }
      if (st === 2) { c.font = '18px sans-serif'; c.fillText('🏁', X + 10, yy - 10); }
    }
    if (look) { const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H); g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(1, `rgba(255,0,40,${0.35 + 0.1 * Math.sin(t / 120)})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    this.drawFace(t, s.ph);
    // 노래 글자
    const song = this.who.querySelector('.mgsong');
    if (s.ph === 'sing') { const kk = Math.max(0, Math.min(1, 1 - (s.left - (performance.now() - this.cur.at) / 1000) / s.dur)); const n = Math.max(1, Math.ceil(kk * SONG.length)); const txt = SONG.slice(0, n); if (song.textContent !== txt) song.textContent = txt; }
    else if (song.textContent !== (look ? '멈춰!!' : '…')) song.textContent = look ? '멈춰!!' : '…';
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

// ================================================================ 단체 줄넘기
V.rope = {
  mount(root, ctx) {
    this.ctx = ctx; this.s = null; this.beats = null; this.lastBeat = -1; this.jumpAt = {}; this.fail = {};
    const n = ctx.teams.length; const cols = n <= 2 ? n : n <= 4 ? 2 : n <= 9 ? 3 : 4; const rows = Math.ceil(n / cols);
    this.cols = cols; this.rows = rows;
    this.cv = canvas(1832, 880);
    root.append(h('div', { class: 'nfull' }, this.cv));
    loop(this, (t) => this.draw(t));
  },
  update(s) {
    this.s = s;
    if (s.prm.t0 && (!this.beats || this.beats[0] !== s.prm.t0)) this.beats = ropeBeats(s.prm, 200000);
    for (const [id, a] of Object.entries(s.teams)) {
      const [, , , last, lastK] = a;
      const key = `${id}:${lastK}`; if (this.seen === undefined) this.seen = new Set();
      if (lastK >= 0 && !this.seen.has(key)) { this.seen.add(key); if (last === 1) this.jumpAt[id] = performance.now(); if (last === 2) { this.fail[id] = performance.now(); this.ctx.sfx('bad'); } }
    }
    return s.tot;
  },
  draw(t) {
    if (!this.s || !this.beats) return;
    const c = this.cv.getContext('2d'); const W = 1832, H = 880; c.clearRect(0, 0, W, H);
    const now = this.ctx.now(); const b = this.beats;
    let k = b.findIndex((x) => x > now); if (k < 0) k = b.length - 1;
    if (k - 1 !== this.lastBeat && k > 0 && now >= b[0]) { this.lastBeat = k - 1; this.ctx.sfx('tap'); }
    const prev = k > 0 ? b[k - 1] : b[0] - this.s.prm.p0; const ph = Math.max(0, Math.min(1, (now - prev) / (b[k] - prev)));
    const teams = this.ctx.teams; const cw = W / this.cols, ch = H / this.rows;
    teams.forEach((tm, i) => {
      const a = this.s.teams[tm.id] || [0, 0, 0, 0, -1, -1, 0];
      const [combo, tot, best, , , restK, rate] = a;
      const x = (i % this.cols) * cw, y = Math.floor(i / this.cols) * ch;
      const failing = this.fail[tm.id] && performance.now() - this.fail[tm.id] < 1200;
      c.fillStyle = failing ? '#4a1020' : '#ffffff0c'; c.beginPath(); c.roundRect(x + 8, y + 8, cw - 16, ch - 16, 22); c.fill();
      c.strokeStyle = tm.color; c.lineWidth = 4; c.stroke();
      const resting = k - 1 <= restK;
      // 줄
      const floor = y + ch * 0.78, top = y + ch * 0.2;
      const ang = resting ? Math.PI : ph * Math.PI * 2;
      const ymid = top + (floor - top) * (0.5 + 0.5 * Math.cos(ang));
      c.strokeStyle = resting ? '#ffffff44' : '#ffd43b'; c.lineWidth = 6; c.beginPath(); c.moveTo(x + cw * 0.1, y + ch * 0.5); c.quadraticCurveTo(x + cw / 2, ymid * 2 - (y + ch * 0.5), x + cw * 0.9, y + ch * 0.5); c.stroke();
      // 사람들 (팀 아이콘 줄)
      const ja = this.jumpAt[tm.id]; const jk = ja ? (performance.now() - ja) / 380 : 2;
      const jump = jk < 1 ? Math.sin(jk * Math.PI) * ch * 0.16 : 0;
      const sz = Math.min(64, ch * 0.22); c.fillStyle = '#fff'; c.font = `${sz}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom';
      const fs2 = Math.min(72, ch * 0.22);
      for (let j = 0; j < 5; j++) figure(c, x + cw * (0.3 + j * 0.1), floor, fs2, tm.color, { air: jk < 1 ? Math.sin(jk * Math.PI) * (1 - Math.abs(j - 2) * 0.08) : 0, arms: 0.3 });
      c.font = `${Math.min(34, ch * 0.1)}px sans-serif`; c.fillText(tm.icon, x + cw * 0.5, y + ch * 0.17);
      // 숫자
      c.textBaseline = 'top'; c.textAlign = 'left'; c.fillStyle = '#fff'; c.font = `900 ${Math.min(30, ch * 0.1)}px sans-serif`; c.fillText(`${tm.icon} ${tm.name}`, x + 26, y + 22);
      c.textAlign = 'right'; c.fillStyle = combo >= 10 ? '#ffd43b' : '#fff'; c.font = `900 ${Math.min(90, ch * 0.28)}px sans-serif`; c.fillText(`${combo}`, x + cw - 28, y + 14);
      c.font = `700 ${Math.min(22, ch * 0.07)}px sans-serif`; c.fillStyle = '#ffffffaa'; c.fillText(`연속 · 합계 ${tot} · 최고 ${best}`, x + cw - 28, y + 14 + Math.min(92, ch * 0.29));
      if (failing) { c.textAlign = 'center'; c.fillStyle = '#ff4d6d'; c.font = `900 ${Math.min(56, ch * 0.18)}px sans-serif`; c.fillText('걸렸다!', x + cw / 2, y + ch * 0.42); }
      c.textAlign = 'left'; c.fillStyle = '#ffffffaa'; c.font = `700 ${Math.min(20, ch * 0.065)}px sans-serif`; c.textBaseline = 'bottom'; c.fillText(`이번 박자 성공률 ${rate}%`, x + 26, y + ch - 22);
    });
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

// ================================================================ 불꽃놀이
V.fire = {
  mount(root, ctx) {
    this.ctx = ctx; this.s = null; this.parts = []; this.perfect = 0;
    this.cv = canvas(1440, 880);
    this.panel = teamPanel(ctx, '🎆 팀 평균 점수');
    this.big = h('div', { class: 'nbig' });
    root.append(h('div', { class: 'nar' }, h('div', { class: 'narc' }, this.cv, this.big), h('div', { class: 'nside' }, this.panel)));
    loop(this, (t) => this.draw(t));
  },
  update(s) {
    this.s = s; this.panel.set(s.avg, 100);
    const pops = s.pops || []; if (!pops.length) return s.avg;
    const per = Math.max(10, Math.min(60, Math.round(3000 / Math.max(1, pops.length))));
    let perf = 0;
    for (const [team, q, i] of pops) {
      const rd = s.R[i]; if (!rd) continue;
      const col = this.ctx.team(team).color; const big = q >= 90;
      if (q >= 95) perf++;
      const cx = (rd.x + (Math.random() - 0.5) * 0.18) * 1440, cy = 880 * (0.62 - q / 100 * 0.48) + (Math.random() - 0.5) * 60;
      const n = Math.round(per * (0.5 + q / 100)); const sp = 160 + q * 4.2;
      for (let j = 0; j < n; j++) { const a = Math.random() * 7; const v = sp * (0.6 + Math.random() * 0.4); this.parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, at: performance.now() + Math.random() * 120, col: big && j % 3 === 0 ? '#fff6b0' : col, life: 1300 + q * 14, sz: big ? 6 : 4 }); }
    }
    if (pops.length) this.ctx.sfx('boom');
    if (perf) { this.big.textContent = `✨ PERFECT ${perf}명!`; this.big.classList.remove('flash'); void this.big.offsetWidth; this.big.classList.add('flash'); }
    return s.avg;
  },
  draw() {
    if (!this.s) return;
    const c = this.cv.getContext('2d'); const W = 1440, H = 880;
    c.fillStyle = 'rgba(5,7,25,0.28)'; c.fillRect(0, 0, W, H);
    const now = this.ctx.now();
    for (const rd of this.s.R) {
      if (now < rd.L || now > rd.A + 900) continue;
      const y = now <= rd.A ? 1 - (1 - (now - rd.L) / (rd.A - rd.L)) ** 2 : 1 - ((now - rd.A) / 900) ** 2 * 0.5;
      const X = rd.x * W, Y = H - (y * 0.82 + 0.06) * H;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(X, Y, 9, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,170,60,.6)'; c.fillRect(X - 3, Y + 6, 6, 40);
      if (Math.abs(now - rd.A) < 140) { c.strokeStyle = '#ffd43b'; c.lineWidth = 4; c.beginPath(); c.arc(X, Y, 30, 0, 7); c.stroke(); }
    }
    const t = performance.now();
    this.parts = this.parts.filter((p) => t - p.at < p.life);
    for (const p of this.parts) {
      const k = (t - p.at) / 1000; if (k < 0) continue;
      c.globalAlpha = Math.max(0, 1 - (t - p.at) / p.life); c.fillStyle = p.col;
      const dr = Math.exp(-k * 1.6); c.fillRect(p.x + p.vx * k * dr, p.y + p.vy * k * dr + 70 * k * k, p.sz, p.sz);
    }
    c.globalAlpha = 1;
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

// ================================================================ 과일 베기
V.fruit = {
  mount(root, ctx) {
    this.ctx = ctx; this.fly = [];
    this.cv = canvas(1440, 880);
    this.jars = {}; this.max = 20;
    this.feed = feed();
    root.append(h('div', { class: 'nar' }, h('div', { class: 'narc' }, this.cv), h('div', { class: 'nside' }, h('div', { class: 'npt' }, '🔥 콤보'), this.feed)));
    loop(this, (t) => this.draw(t));
  },
  update(s) {
    this.s = s; this.max = Math.max(this.max, ...Object.values(s.avg)) ;
    const teams = this.ctx.teams; const n = teams.length; const w = 1440 / n;
    for (const [tid, k] of Object.entries(s.cuts || {})) { const i = teams.findIndex((x) => x.id === +tid); for (let j = 0; j < Math.min(k, 6) && this.fly.length < 70; j++) this.fly.push({ x: w * i + w / 2 + (Math.random() - 0.5) * w * 0.5, y: -40, vy: 500 + Math.random() * 300, e: FRUITS[Math.floor(Math.random() * FRUITS.length)], at: performance.now(), r: Math.random() * 6 }); }
    for (const [name, team, n2] of s.combos || []) { this.feed.push(h('div', { class: 'nfi' }, `🔥 ${n2}콤보! `, h('b', { style: { color: this.ctx.team(team).color } }, name))); }
    return s.avg;
  },
  draw() {
    if (!this.s) return;
    const c = this.cv.getContext('2d'); const W = 1440, H = 880; c.clearRect(0, 0, W, H);
    const teams = this.ctx.teams; const n = teams.length; const w = W / n;
    const top = 120, bot = H - 70, jh = bot - top;
    teams.forEach((tm, i) => {
      const v = this.s.avg[tm.id] || 0; const k = Math.min(1, v / (this.max * 1.1)); const x = i * w + w * 0.14, jw = w * 0.72;
      c.fillStyle = '#ffffff12'; c.beginPath(); c.roundRect(x, top, jw, jh, 26); c.fill(); c.strokeStyle = '#ffffff55'; c.lineWidth = 4; c.stroke();
      const lh = jh * k; c.save(); c.beginPath(); c.roundRect(x, top, jw, jh, 26); c.clip();
      const gr = c.createLinearGradient(0, bot - lh, 0, bot); gr.addColorStop(0, tm.color); gr.addColorStop(1, '#00000055'); c.fillStyle = gr;
      c.beginPath(); c.moveTo(x, bot); for (let xx = 0; xx <= jw; xx += 10) c.lineTo(x + xx, bot - lh + Math.sin((xx + performance.now() / 4) / 30) * 6); c.lineTo(x + jw, bot); c.fill(); c.restore();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '900 44px sans-serif'; c.textBaseline = 'bottom'; c.fillText(`${Math.round(v)}`, x + jw / 2, top - 12);
      c.font = '700 26px sans-serif'; c.textBaseline = 'top'; c.fillText(`${tm.icon} ${tm.name}`, x + jw / 2, bot + 14);
    });
    const t = performance.now(); this.fly = this.fly.filter((f) => t - f.at < 1600);
    for (const f of this.fly) { const k = (t - f.at) / 1000; const y = f.y + f.vy * k; if (y > bot - 20) continue; const im = emo(f.e, 46); c.save(); c.translate(f.x, y); c.rotate(k * f.r); c.drawImage(im, -im.width / 2, -im.height / 2); c.restore(); }
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

// ================================================================ 골든벨 서바이벌
V.bell = {
  mount(root, ctx) { this.ctx = ctx; this.root = h('div', { class: 'bells' }); root.append(this.root); this.key = ''; this.t = setInterval(() => this.tick(), 200); },
  update(s) {
    this.s = s; this.at = performance.now();
    const key = `${s.qi}:${s.ph}`;
    if (key !== this.key) {
      this.key = key; const R = this.root; R.innerHTML = '';
      if (s.ph === 'q') this.ctx.say(s.text, 1.05); else if (s.ph === 'reveal') this.ctx.sfx(s.outN ? 'bad' : 'good');
      const max = s.counts ? Math.max(1, ...s.counts) : 1;
      R.append(
        h('div', { class: 'bellhead' }, h('span', { class: 'chip big' }, `🔔 ${s.qi + 1} / ${s.N}`), s.revive ? h('span', { class: 'chip hot big' }, '🔥 패자부활전 — 탈락자도 맞히면 부활!') : null, h('span', { class: 'bellclock' })),
        h('div', { class: 'bellqs' }, s.text),
        h('div', { class: `bellos n${s.opts.length}` }, s.opts.map((o, i) => h('div', { class: `bo ${s.ans != null ? (i === s.ans ? 'right' : 'dim') : ''}` }, h('b', {}, '①②③④'[i]), h('span', {}, o), s.counts ? h('div', { class: 'bocnt' }, h('i', { style: { width: `${(s.counts[i] / max) * 100}%` } }), h('em', {}, `${s.counts[i]}명`)) : null))),
        h('div', { class: 'bellfoot' }));
    }
    const f = this.root.querySelector('.bellfoot'); f.innerHTML = '';
    if (s.ph === 'q') f.append(h('div', { class: 'muted' }, `✍️ ${s.answered}명 답함`), this.aliveBar(s));
    else {
      if (s.outN) f.append(h('div', { class: 'bellout' }, `😵 탈락 ${s.outN}명 `, ...s.out.map(([n, tm]) => h('span', { style: { color: this.ctx.team(tm).color } }, n))));
      if (s.revN) f.append(h('div', { class: 'bellrev' }, `🔥 부활 ${s.revN}명 `, ...s.rev.map(([n, tm]) => h('span', { style: { color: this.ctx.team(tm).color } }, n))));
      f.append(this.aliveBar(s));
    }
    return s.alive;
  },
  aliveBar(s) { if (s.kid) return h('div'); return h('div', { class: 'bellalive' }, h('b', {}, `🔔 생존 ${s.aliveN}명`), ...this.ctx.teams.map((t) => h('span', { style: { background: t.color } }, `${t.icon} ${s.alive[t.id] || 0}`))); },
  tick() { const el = this.root.querySelector('.bellclock'); if (el && this.s) el.textContent = this.s.ph === 'q' ? `⏱ ${Math.max(0, Math.ceil(this.s.left - (performance.now() - this.at) / 1000))}` : ''; },
  unmount() { clearInterval(this.t); },
};

// ================================================================ 그려라 맞혀라
const PEN = ['#111111', '#ff4d6d', '#3d8bff', '#2fd27a', '#ffb800', '#b06bff', '#8b5a2b', '#ffffff'];
function seg(c, W, s) { const [col, w, ...p] = s; c.strokeStyle = PEN[col] || '#111'; c.lineWidth = [0, 4, 8, 16][w] * W / 340; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); for (let i = 0; i < p.length; i += 2) { const x = p[i] / 1000 * W, y = p[i + 1] / 1000 * W; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); }
V.draw = {
  mount(root, ctx) { this.ctx = ctx; this.root = h('div', { class: 'draws' }); root.append(this.root); this.round = -2; this.cards = {}; },
  build(s) {
    this.root.innerHTML = ''; this.cards = {};
    const n = this.ctx.teams.length; const cols = n <= 3 ? n : n <= 8 ? 4 : n <= 10 ? 5 : 6; const rows = Math.ceil(n / cols);
    const size = Math.min((1832 - (cols - 1) * 16) / cols - 10, (790 - (rows - 1) * 16) / rows - 70);
    this.root.append(h('div', { class: 'drawhead' }, h('span', { class: 'chip big' }, `🖍 ${s.round + 1} / ${s.R}판`), h('span', { class: 'drawclock' })));
    const grid = h('div', { class: 'drawgrid', style: { gridTemplateColumns: `repeat(${cols}, ${size}px)` } });
    for (const t of this.ctx.teams) {
      const cv = canvas(Math.round(size), Math.round(size)); const info = h('div', { class: 'dinfo' }); const word = h('div', { class: 'dwordS' });
      grid.append(h('div', { class: 'dcard', style: { '--tc': t.color } }, h('div', { class: 'dtop' }, h('b', {}, `${t.icon} ${t.name}`), info), h('div', { class: 'dcv' }, cv, word)));
      this.cards[t.id] = { cv, info, word, sk: [] };
    }
    this.root.append(grid);
  },
  update(s) {
    if (s.round !== this.round) { this.round = s.round; this.build(s); }
    this.root.querySelector('.drawclock').textContent = s.ph === 'draw' ? `⏱ ${Math.ceil(s.left)}초` : s.ph === 'reveal' ? '정답 공개!' : '';
    for (const [tid, a] of Object.entries(s.teams || {})) {
      const cd = this.cards[tid]; if (!cd) continue;
      const c = cd.cv.getContext('2d'); const W = cd.cv.width;
      if (a.clr) { cd.sk = []; c.clearRect(0, 0, W, W); }
      if (a.full && a.full.length !== cd.sk.length + (a.add?.length || 0)) { cd.sk = a.full.slice(); c.clearRect(0, 0, W, W); for (const x of cd.sk) seg(c, W, x); }
      else for (const x of a.add || []) { cd.sk.push(x); seg(c, W, x); }
      cd.info.textContent = `✏️ ${a.d} · ✅ ${a.ok}/${a.n}`;
      if (a.word && cd.word.textContent !== a.word) { cd.word.textContent = a.word; cd.word.classList.add('on'); }
    }
    const o = {}; for (const [k, a] of Object.entries(s.teams || {})) o[k] = a.n ? a.ok / a.n : 0; return o;
  },
};

// ================================================================ 함성 대폭발
V.shout = {
  mount(root, ctx) {
    this.ctx = ctx; this.cols = {};
    this.ban = h('div', { class: 'shban' });
    const meters = h('div', { class: 'shms' });
    for (const t of ctx.teams) { const fill = h('div', { class: 'shf', style: { background: `linear-gradient(0deg, ${t.color}, #ffd43b 75%, #ff4d6d)` } }); const num = h('div', { class: 'shn' }, '0'); const avg = h('div', { class: 'sha' }); meters.append(h('div', { class: 'shm' }, num, h('div', { class: 'sht' }, fill, h('div', { class: 'shfl' }, '🔥')), h('div', { class: 'shl' }, `${t.icon} ${t.name}`), avg)); this.cols[t.id] = { fill, num, avg }; }
    this.peak = h('div', { class: 'shpk' });
    root.append(h('div', { class: 'shs' }, this.ban, meters, this.peak));
    this.vals = {};
  },
  update(s) {
    const txt = s.ph === 'burst' ? `📣 지금 소리 질러!!! ${Math.ceil(s.left)}${s.w === 2 ? ' · 마지막 2배!' : ''}` : s.ph === 'rest' ? `😮‍💨 숨 고르기 ${Math.ceil(s.left)} · 다음 함성 준비!` : s.ph === 'prep' ? `준비하세요… ${Math.ceil(s.left)}` : '끝!';
    if (this.ban.textContent !== txt) { this.ban.textContent = txt; this.ban.className = `shban ${s.ph}`; if (s.ph === 'burst' && this.lastPh !== 'burst') this.ctx.sfx('go'); }
    this.lastPh = s.ph;
    for (const t of this.ctx.teams) {
      const c = this.cols[t.id]; const v = s.now[t.id] || 0; this.vals[t.id] = (this.vals[t.id] || 0) * 0.5 + v * 0.5;
      c.fill.style.height = `${this.vals[t.id]}%`; c.num.textContent = Math.round(this.vals[t.id]); c.fill.parentNode.classList.toggle('hot', this.vals[t.id] > 75);
      c.avg.textContent = `평균 ${s.avg[t.id] || 0}`;
    }
    this.peak.textContent = s.peak ? `🏆 최고 함성: ${s.peak[0]} (${this.ctx.team(s.peak[1]).name}) ${s.peak[2]}` : '';
    return s.avg;
  },
};

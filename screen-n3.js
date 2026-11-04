// 스크린 체육 모드 대형 화면: 큰 동작 시범 캐릭터 + 음악 비트 + 팀 점수판
import { h } from './client.js';
import { V } from './screen-games.js';
import { loop, canvas } from './screen-n.js';

const MOVES = ['손 머리 위로!', '양팔 옆으로 쫙!', '한 발로 서기!', '앉았다 일어나기!', '제자리 뛰기!', '팔 빙글빙글!', '무릎 터치!', '별 모양 점프!', '박수 세 번!', '몸 흔들흔들!'];
const KEYS = ['up', 'wide', 'leg', 'squat', 'jog', 'spin', 'knee', 'star', 'clap', 'wiggle'];
const D = Math.PI / 180;
// 관절 각도로 그리는 시범 캐릭터 (k: 0~1 동작 반복, frozen이면 멈춤)
function pose(c, x, y, s, col, key, k) {
  const sw = Math.sin(k * Math.PI * 2); let la = [200, 190], ra = [160, 170], ll = [185, 180], rl = [175, 180], crouch = 0, jump = 0, tilt = 0;
  switch (key) {
    case 'up': la = [330 + sw * 10, 0]; ra = [30 - sw * 10, 0]; break;
    case 'wide': la = [270, 270 + sw * 15]; ra = [90, 90 - sw * 15]; break;
    case 'leg': ll = [185, 180]; rl = [120 + sw * 10, 210]; la = [250, 260]; ra = [110, 100]; break;
    case 'squat': crouch = 0.5 + sw * 0.5; la = [260, 270]; ra = [100, 90]; ll = [185 - crouch * 40, 180 + crouch * 70]; rl = [175 + crouch * 40, 180 - crouch * 70]; break;
    case 'jog': ll = [180 + sw * 35, 200 + sw * 30]; rl = [180 - sw * 35, 200 - sw * 30]; la = [180 - sw * 50, 120]; ra = [180 + sw * 50, 240]; jump = Math.abs(sw) * 0.15; break;
    case 'spin': la = [k * 360, k * 360]; ra = [k * 360 + 180, k * 360 + 180]; break;
    case 'knee': crouch = 0.25; la = [190 + sw * 20, 170]; ra = [170 - sw * 20, 190]; ll = [170, 190]; rl = [190, 170]; break;
    case 'star': jump = Math.max(0, sw) * 0.35; la = [300 - Math.max(0, sw) * 40, 300]; ra = [60 + Math.max(0, sw) * 40, 60]; ll = [200 + Math.max(0, sw) * 15, 200]; rl = [160 - Math.max(0, sw) * 15, 160]; break;
    case 'clap': la = [260 - Math.abs(sw) * 20, 330 - Math.abs(sw) * 60]; ra = [100 + Math.abs(sw) * 20, 30 + Math.abs(sw) * 60]; break;
    case 'wiggle': tilt = sw * 14; la = [230, 200]; ra = [130, 160]; ll = [185 + sw * 8, 180]; rl = [175 + sw * 8, 180]; break;
    default: break;
  }
  const L = s; const hipY = y - L * 0.9 * (1 - crouch * 0.4) - jump * L;
  const seg = (x0, y0, a1, a2, l1, l2, w, colr) => { const x1 = x0 + Math.sin(a1 * D) * l1, y1 = y0 - Math.cos(a1 * D) * l1; const x2 = x1 + Math.sin(a2 * D) * l2, y2 = y1 - Math.cos(a2 * D) * l2; c.strokeStyle = colr; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.fillStyle = colr === col ? '#ffe2c6' : '#2b2f55'; c.beginPath(); c.arc(x2, y2, w * 0.62, 0, 7); c.fill(); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y + 6, L * 0.5 * (1 - jump), L * 0.08, 0, 0, 7); c.fill();
  c.save(); c.translate(x, hipY); c.rotate(tilt * D); c.translate(-x, -hipY);
  const shY = hipY - L * 0.62;
  seg(x - L * 0.1, hipY, ll[0], ll[1], L * 0.46, L * 0.46, L * 0.15, '#e8ecff');
  seg(x + L * 0.1, hipY, rl[0], rl[1], L * 0.46, L * 0.46, L * 0.15, '#e8ecff');
  c.fillStyle = col; c.beginPath(); c.roundRect(x - L * 0.2, shY - L * 0.04, L * 0.4, L * 0.7, L * 0.14); c.fill();
  const hy = shY - L * 0.3, hr = L * 0.22;
  c.fillStyle = '#ffe2c6'; c.beginPath(); c.arc(x, hy, hr, 0, 7); c.fill();
  c.fillStyle = '#2b2f55'; c.beginPath(); c.arc(x, hy - hr * 0.2, hr * 1.02, Math.PI * 1.05, Math.PI * 1.95); c.fill();
  c.fillStyle = '#1a1a2e'; c.beginPath(); c.arc(x - hr * 0.38, hy + hr * 0.08, hr * 0.11, 0, 7); c.arc(x + hr * 0.38, hy + hr * 0.08, hr * 0.11, 0, 7); c.fill();
  c.strokeStyle = '#1a1a2e'; c.lineWidth = hr * 0.1; c.beginPath(); c.arc(x, hy + hr * 0.3, hr * 0.32, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  c.fillStyle = '#ff9aa8aa'; c.beginPath(); c.arc(x - hr * 0.62, hy + hr * 0.35, hr * 0.14, 0, 7); c.arc(x + hr * 0.62, hy + hr * 0.35, hr * 0.14, 0, 7); c.fill();
  seg(x - L * 0.2, shY + L * 0.04, la[0], la[1], L * 0.32, L * 0.3, L * 0.12, col);
  seg(x + L * 0.2, shY + L * 0.04, ra[0], ra[1], L * 0.32, L * 0.3, L * 0.12, col);
  c.restore();
}

function peScreen(kind) {
  return {
    mount(root, ctx) {
      this.ctx = ctx; this.s = null; this.lastBeat = 0; this.lastSay = '';
      this.cv = canvas(1200, 880); this.board = h('div', { class: 'pesb' });
      root.append(h('div', { class: 'nar' }, h('div', { class: 'narc', style: { width: '1200px' } }, this.cv), this.board));
      this.rows = {};
      for (const t of ctx.teams) { const n = h('b', {}, '0'); const r = h('div', { class: 'pesr', style: { '--tc': t.color } }, h('span', {}, t.icon), h('div', {}, t.name), n); this.rows[t.id] = { r, n }; this.board.append(r); }
      loop(this, (t) => this.draw(t));
    },
    update(s) {
      this.s = s; this.at = performance.now(); const ctx = this.ctx;
      for (const [k, v] of Object.entries(s.pts)) { const r = this.rows[k]; if (r && r.n.textContent !== String(v)) { r.n.textContent = v; r.r.classList.remove('hit'); void r.r.offsetWidth; r.r.classList.add('hit'); ctx.sfx('good'); } }
      const order = Object.entries(s.pts).sort((a, b) => b[1] - a[1]).map((x) => +x[0]); for (const [k, r] of Object.entries(this.rows)) r.r.style.order = order.indexOf(+k);
      let say = '';
      if (kind === 'pe_freeze') say = s.ph === 'freeze' ? '얼음!' : MOVES[s.move];
      if (kind === 'pe_simon' && s.cmd) say = `${s.cmd.say ? '가라사대, ' : ''}${MOVES[s.cmd.move]}`;
      if (kind === 'pe_mission') say = s.text;
      if (kind === 'pe_freeze' && s.ph !== this.lastPh) { this.lastPh = s.ph; ctx.bgm?.hold(s.ph === 'freeze'); }
      const key = `${say}|${s.n ?? s.i}|${s.ph}`; if (say && key !== this.lastSay) { this.lastSay = key; ctx.say(say.replace(/!/g, ''), 1.05); if (say === '얼음!') ctx.sfx('boom'); }
      return s.pts;
    },
    draw(t) {
      const s = this.s; if (!s) return; const c = this.cv.getContext('2d'); const W = 1200, H = 880;
      const freeze = kind === 'pe_freeze' && s.ph === 'freeze';
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, freeze ? '#0d3a6b' : '#2a1458'); g.addColorStop(1, '#0b0e24'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      // 비트 (댄스 중 120BPM)
      const beat = 500; const bk = (t % beat) / beat;
      if (kind === 'pe_freeze' && !freeze) { const bi = Math.floor(t / beat); if (bi !== this.lastBeat) { this.lastBeat = bi; if (!this.ctx.bgm?.active()) this.ctx.sfx(bi % 2 ? 'tap' : 'count'); } c.fillStyle = `rgba(255,80,200,${0.15 * (1 - bk)})`; c.fillRect(0, 0, W, H); for (let i = 0; i < 6; i++) { c.fillStyle = `hsla(${(t / 20 + i * 60) % 360},90%,60%,.18)`; c.beginPath(); c.arc(200 + i * 160, 700 - Math.sin(t / 300 + i) * 60, 60 + (1 - bk) * 30, 0, 7); c.fill(); } }
      c.textAlign = 'center'; c.textBaseline = 'middle';
      let label = '', key = 'up', sub = '';
      if (kind === 'pe_freeze') { label = freeze ? '얼음!' : MOVES[s.move]; key = KEYS[s.move]; sub = freeze ? '그대로 멈춰요! 움직이면 안 돼요' : '음악에 맞춰 따라 해요 · 음악이 멈추면 얼음!'; }
      if (kind === 'pe_simon') { if (s.cmd) { label = `${s.cmd.say ? '가라사대 ' : ''}${MOVES[s.cmd.move]}`; key = KEYS[s.cmd.move]; sub = s.cmd.say ? '따라 해요!' : '가라사대가 없어요… 속지 마세요!'; } else label = '준비!'; }
      if (kind !== 'pe_mission') {
        const k = freeze ? 0.25 : (t / 900) % 1;
        pose(c, W / 2, 830, 230, freeze ? '#7cf3ff' : '#ffd43b', key, k);
        if (freeze) { c.strokeStyle = '#bff3ff'; c.lineWidth = 6; for (let i = 0; i < 8; i++) { const a = i * 0.785 + t / 2000; c.beginPath(); c.moveTo(W / 2 + Math.cos(a) * 320, 560 + Math.sin(a) * 260); c.lineTo(W / 2 + Math.cos(a) * 360, 560 + Math.sin(a) * 300); c.stroke(); } }
        c.fillStyle = freeze ? '#bff3ff' : '#fff'; c.font = `900 ${freeze ? 120 : 80}px sans-serif`; c.fillText(label, W / 2, 110);
        c.fillStyle = '#ffd43b'; c.font = '700 34px sans-serif'; c.fillText(sub, W / 2, 190);
      } else {
        const left = Math.max(0, s.left - (performance.now() - this.at) / 1000);
        c.fillStyle = '#ffffff10'; c.beginPath(); c.roundRect(80, 160, W - 160, 420, 36); c.fill(); c.strokeStyle = '#ffd43b'; c.lineWidth = 6; c.stroke();
        c.fillStyle = '#ffd43b'; c.font = '900 44px sans-serif'; c.fillText(`미션 ${s.i + 1}`, W / 2, 230);
        c.fillStyle = '#fff'; let fs = 74; c.font = `900 ${fs}px sans-serif`; while (c.measureText(s.text).width > W - 240 && fs > 36) { fs -= 4; c.font = `900 ${fs}px sans-serif`; } c.fillText(s.text, W / 2, 380);
        c.font = '700 32px sans-serif'; c.fillStyle = '#c9cff5'; c.fillText('먼저 끝낸 팀은 손을 번쩍! 진행자가 점수를 줘요', W / 2, 500);
        const R = 90, cx = W / 2, cy = 730; c.strokeStyle = '#ffffff22'; c.lineWidth = 18; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
        c.strokeStyle = left < 5 ? '#ff4d6d' : '#2fd27a'; c.beginPath(); c.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + (left / 20) * Math.PI * 2); c.stroke();
        c.fillStyle = '#fff'; c.font = '900 70px sans-serif'; c.fillText(Math.ceil(left), cx, cy + 4);
        for (let i = 0; i < 4; i++) pose(c, [170, 370, 830, 1030][i], 860, 70, ['#ff4d6d', '#3d8bff', '#2fd27a', '#ffb800'][i], KEYS[(i * 3 + Math.floor(t / 1500)) % 10], (t / 900 + i * 0.25) % 1);
      }
    },
    unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
  };
}
V.pe_freeze = peScreen('pe_freeze');
V.pe_simon = peScreen('pe_simon');
V.pe_mission = peScreen('pe_mission');

// ---------------- 한마음 박자 (대형 화면)
V.sync = {
  mount(root, ctx) {
    this.ctx = ctx; this.s = null; this.lastIdx = -1;
    this.cv = canvas(1820, 880); root.append(h('div', { class: 'nar' }, h('div', { class: 'narc', style: { width: '1820px' } }, this.cv)));
    loop(this, () => this.draw());
  },
  update(s) { this.s = s; this.at = performance.now(); if (s.idx !== this.lastIdx) { this.lastIdx = s.idx; this.hitAt = performance.now(); } if (s.full.length) this.ctx.sfx('good'); return s.team; },
  draw() {
    const s = this.s; if (!s) return; const c = this.cv.getContext('2d'); const W = 1820, H = 880; const ctx = this.ctx;
    const T = s.T + (performance.now() - this.at) / 1000;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a1458'); g.addColorStop(1, '#0b0e24'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const nb = s.nx.find((b) => b[0] > T - 0.15); const k = nb ? Math.max(0, 1 - Math.abs(nb[0] - T) / 0.18) : 0;
    if (nb && !nb[1]) { c.fillStyle = `rgba(255,212,59,${k * 0.18})`; c.fillRect(0, 0, W, H); }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    // 가운데 북
    const cx = W / 2, cy = 190, R = 100;
    c.fillStyle = '#6b3a1e'; c.beginPath(); c.ellipse(cx, cy + 50, R * 1.08, R * 0.5, 0, 0, 7); c.fill();
    c.fillStyle = nb?.[1] && nb[0] - T < 1 ? '#555b7a' : '#f4e3c3'; c.beginPath(); c.arc(cx, cy, R * (1 + k * 0.1), 0, 7); c.fill(); c.strokeStyle = '#b5651d'; c.lineWidth = 12; c.stroke();
    c.font = '900 90px sans-serif'; c.fillStyle = '#1a1a2e'; c.fillText(nb?.[1] && nb[0] - T < 1 ? '✋' : '🥁', cx, cy + 4);
    for (const b of s.nx) { const dt = b[0] - T; if (dt < -0.1 || dt > 1.8) continue; c.strokeStyle = b[1] ? '#ffffff55' : `rgba(255,212,59,${Math.max(0.25, 1 - dt / 1.8)})`; c.lineWidth = b[1] ? 4 : 10; c.setLineDash(b[1] ? [16, 12] : []); c.beginPath(); c.arc(cx, cy, R + Math.max(0, dt) * 120, 0, 7); c.stroke(); }
    c.setLineDash([]);
    c.font = '800 34px sans-serif'; c.fillStyle = '#ffd43b'; c.fillText(nb?.[1] ? '✋ 쉬는 박자엔 누르지 마요!' : '원이 북에 닿을 때 팀 모두 같이 쿵!', cx, 420);
    // 팀 기둥
    const n = ctx.teams.length; const cw = Math.min(380, (W - 120) / n); const x0 = (W - cw * n) / 2;
    ctx.teams.forEach((t, i) => {
      const x = x0 + i * cw + cw / 2; const v = s.team[t.id] || 0; const lv = s.live[t.id] || 0; const full = s.full.includes(t.id);
      c.fillStyle = full ? t.color : '#ffffff12'; c.beginPath(); c.roundRect(x - cw / 2 + 14, 470, cw - 28, 390, 26); c.fill();
      if (full) { c.fillStyle = '#fff'; c.font = '900 34px sans-serif'; c.fillText('💥 전원 성공!', x, 835 + Math.sin(T * 12) * 4); }
      c.fillStyle = '#fff'; c.font = '800 32px sans-serif'; c.fillText(`${t.icon} ${t.name}`, x, 515);
      // 방금 박자 동기율 링
      c.strokeStyle = '#ffffff22'; c.lineWidth = 18; c.beginPath(); c.arc(x, 650, 80, 0, 7); c.stroke();
      c.strokeStyle = full ? '#fff' : t.color; c.beginPath(); c.arc(x, 650, 80, -Math.PI / 2, -Math.PI / 2 + (lv / 100) * Math.PI * 2); c.stroke();
      c.fillStyle = '#fff'; c.font = '900 44px sans-serif'; c.fillText(`${lv}%`, x, 652);
      c.font = '700 26px sans-serif'; c.fillStyle = full ? '#fff' : '#c9cff5'; c.fillText(`평균 ${v}% · 콤보 ${s.combo[t.id] || 0}`, x, full ? 785 : 800);
    });
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

// ---------------- 팀 릴레이 (대형 화면)
V.relay = {
  mount(root, ctx) { this.ctx = ctx; this.s = null; this.cv = canvas(1820, 880); root.append(h('div', { class: 'nar' }, h('div', { class: 'narc', style: { width: '1820px' } }, this.cv))); this.shown = {}; loop(this, () => this.draw()); },
  update(s) { this.s = s; for (const [k, v] of Object.entries(s.t)) if (v.pass && !this.shown[k + ':' + v.legs]) { this.shown[k + ':' + v.legs] = 1; this.ctx.sfx('tap'); } return s.team; },
  draw() {
    const s = this.s; if (!s) return; const c = this.cv.getContext('2d'); const W = 1820, H = 880; const ctx = this.ctx; const t0 = performance.now() / 1000;
    c.fillStyle = '#0f1630'; c.fillRect(0, 0, W, H);
    c.textBaseline = 'middle';
    const n = ctx.teams.length; const lh = Math.min(200, (H - 40) / n); const y0 = (H - lh * n) / 2;
    const LAP = 10; const tx0 = 330, tx1 = W - 90;
    const lead = Math.max(...Object.values(s.team));
    ctx.teams.forEach((t, i) => {
      const v = s.t[t.id]; if (!v) return; const y = y0 + i * lh; const cy = y + lh / 2;
      c.fillStyle = i % 2 ? '#b0503a' : '#c45c43'; c.fillRect(tx0 - 20, y + 10, tx1 - tx0 + 60, lh - 20);
      c.strokeStyle = '#ffffff88'; c.lineWidth = 3; c.setLineDash([22, 16]); c.beginPath(); c.moveTo(tx0 - 20, y + 10); c.lineTo(tx1 + 40, y + 10); c.stroke(); c.setLineDash([]);
      for (let k = 0; k <= LAP; k++) { const x = tx0 + ((tx1 - tx0) * k) / LAP; c.fillStyle = '#ffffff33'; c.fillRect(x - 2, y + 14, 4, lh - 28); }
      c.fillStyle = t.color; c.fillRect(0, y + 10, 300, lh - 20);
      c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = `900 ${Math.min(40, lh * 0.25)}px sans-serif`; c.fillText(`${t.icon} ${t.name}`, 18, cy - lh * 0.14);
      c.font = `800 ${Math.min(30, lh * 0.19)}px sans-serif`; c.fillText(`${v.legs}구간${v.legs + v.prog === lead && lead > 0 ? ' 🔥' : ''}`, 18, cy + lh * 0.2);
      const pos = (v.legs % LAP) + v.prog; const x = tx0 + ((tx1 - tx0) * pos) / LAP; const bob = Math.abs(Math.sin(t0 * 10 + i)) * 10;
      if (v.pass) { c.fillStyle = '#ffd43b55'; c.beginPath(); c.arc(x, cy, 70 + Math.sin(t0 * 20) * 6, 0, 7); c.fill(); }
      c.font = `${Math.min(84, lh * 0.5)}px sans-serif`; c.textAlign = 'center'; c.save(); c.translate(x, cy - bob); c.scale(-1, 1); c.fillText('🏃', 0, 0); c.restore();
      c.fillStyle = '#fff'; c.font = `900 ${Math.min(30, lh * 0.18)}px sans-serif`; const nm = v.h || '-'; const tw = c.measureText(nm).width + 24; c.fillStyle = '#000a'; c.beginPath(); c.roundRect(x - tw / 2, cy - lh * 0.5 + 6, tw, lh * 0.2, 10); c.fill(); c.fillStyle = '#fff'; c.fillText(nm, x, cy - lh * 0.4 + 6);
      if (v.nx) { c.fillStyle = '#ffe9a8'; c.font = `700 ${Math.min(24, lh * 0.14)}px sans-serif`; c.textAlign = 'right'; c.fillText(`다음 ➜ ${v.nx}`, tx1 + 30, cy + lh * 0.33); }
      if (v.pass) { c.fillStyle = '#ffd43b'; c.font = `900 ${Math.min(34, lh * 0.2)}px sans-serif`; c.textAlign = 'center'; c.fillText('바통 터치!', x, cy + lh * 0.36); }
    });
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); },
};

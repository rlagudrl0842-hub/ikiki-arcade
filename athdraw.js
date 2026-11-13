// 🏟 육상 트랙 그림 (폰·대형 화면 공용) — 같은 기하(trackgeo.js)·같은 서버 위치로 그려서 두 화면이 일치
// 400m 이상: 위에서 비스듬히 내려다본 2.5D 타원 트랙 · 100m: 홈 직선 옆에서 본 화면(주로 크게)
import { S, R0, LW, rCen, rMeas, runXY, pathXY, ZONES, BREAK, MERGE } from './trackgeo.js';
// 800m 합류 뒤 겹치지 않게 바깥으로 살짝(off m) 비켜 그림
export const posOf = (ev, L, d, off = 0) => (off && ev === '800' && d > BREAK + MERGE ? pathXY(d, rMeas(1), rCen(1) + off) : runXY(ev, L, d));
// 800m: 앞사람과 1.6m 안이면 한 칸 바깥(0.9m)으로 — 서로 가리지 않게 (그림만, 거리 계산과 무관)
export function packOffsets(ev, list) { const out = new Map(); if (ev !== '800') return out; const s = [...list].sort((a, b) => b.d - a.d); const placed = []; for (const r of s) { let off = 0; if (r.d > BREAK + MERGE) { while (off < 3.6 && placed.some((p) => Math.abs(p.d - r.d) < 1.6 && Math.abs(p.off - off) < 0.5)) off += 0.9; } placed.push({ d: r.d, off }); out.set(r.key, off); } return out; }

export const ROW = { lane: 0, label: 1, team: 2, d: 3, v: 4, place: 5, t: 6, fs: 7, leg: 8, od: 9, e: 10, auto: 11, hold: 12, runner: 13, lat: 14, fx: 15 }; // fx: 1 몸싸움 · 2 바깥 추월 · 3 막힘 (800m)
export const FX = ['', ' 💥', ' ↗', ''];

// 서버가 보낸 위치를 서버 시각에 맞춰 조금 앞으로 (최대 0.4초) + 부드럽게
export function makeSmoother() {
  const m = new Map();
  return (key, d, v, T, now, D) => { const est = Math.min(D, d + v * Math.max(0, Math.min(0.4, (now - T) / 1000))); const p = m.get(key); const out = p == null || Math.abs(est - p) > 25 || est < p - 3 ? est : p + (est - p) * 0.35; m.set(key, out); return out; };
}

function stadium(r, n = 48) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; pts.push([S / 2 + r * Math.sin(a), r * Math.cos(a)]); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; pts.push([-S / 2 - r * Math.sin(a), -r * Math.cos(a)]); }
  return pts;
}
// 타원 트랙 화면 배치: 폭 W·높이 H 안에 맞춤 (sy = 기울기 · 1이면 위에서 본 그림)
export function ovalView(W, H, N, { sy = 0.62, pad = 0.04, x0 = 0, chute = false, fit = false } = {}) {
  const Rout = R0 + LW * N + 3; const ww = S + 2 * Rout + (chute ? 16 : 0);
  if (fit) { const scw = ((W - x0) * (1 - 2 * pad)) / ww; sy = Math.max(sy, Math.min(1, (H * (1 - 2 * pad)) / (2 * Rout * scw))); } // 높이가 남으면 덜 기울여 화면을 채움
  const hh = 2 * Rout * sy;
  const sc = Math.min((W - x0) * (1 - 2 * pad) / ww, (H * (1 - 2 * pad)) / hh);
  return { sc, sy, ox: x0 + (W - x0) / 2 + (chute ? -8 * sc : 0), oy: H / 2, N };
}
const P = (vw, x, y) => [vw.ox + x * vw.sc, vw.oy + y * vw.sc * vw.sy];
function poly(c, vw, pts) { c.moveTo(...P(vw, ...pts[0])); for (let i = 1; i < pts.length; i++) c.lineTo(...P(vw, ...pts[i])); c.closePath(); }

// 바탕(경기장)은 한 번 그려 두고 다시 씀
export function ovalBg(W, H, vw, ev, { big = true } = {}) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); const N = vw.N; const Rout = R0 + LW * N;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d2a1a'); g.addColorStop(1, '#123b23'); c.fillStyle = g; c.fillRect(0, 0, W, H); // 경기장 밖
  c.fillStyle = '#2f7d3c'; c.beginPath(); poly(c, vw, stadium(R0)); c.fill(); // 안쪽 잔디
  c.save(); c.beginPath(); poly(c, vw, stadium(R0)); c.clip(); for (let k = -6; k < 6; k++) { c.fillStyle = k % 2 ? '#2a7337' : '#328541'; const [x] = P(vw, k * 12, 0); c.fillRect(x, 0, 12 * vw.sc, H); } c.restore();
  // 트랙 (붉은 탄성 포장)
  c.fillStyle = '#b8462f'; c.beginPath(); poly(c, vw, stadium(Rout)); poly(c, vw, stadium(R0)); c.fill('evenodd');
  if (ev === '100') { c.beginPath(); const a = P(vw, S / 2 - 104, R0), b = P(vw, -S / 2, Rout); c.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); c.fill(); } // 100m 출발 연장 구간
  c.strokeStyle = '#ffffffcc'; c.lineWidth = Math.max(1, vw.sc * 0.08);
  for (let k = 0; k <= N; k++) { c.beginPath(); poly(c, vw, stadium(R0 + LW * k)); c.stroke(); }
  if (ev === '100') for (let k = 0; k <= N; k++) { c.beginPath(); c.moveTo(...P(vw, S / 2 - 104, R0 + LW * k)); c.lineTo(...P(vw, -S / 2, R0 + LW * k)); c.stroke(); }
  c.strokeStyle = '#e9e2d0'; c.lineWidth = Math.max(2, vw.sc * 0.35); c.beginPath(); poly(c, vw, stadium(R0 - 0.15)); c.stroke(); // 연석
  // 결승선 (홈 직선 끝)
  { const a = P(vw, S / 2, R0), b = P(vw, S / 2, Rout); c.strokeStyle = '#fff'; c.lineWidth = Math.max(2, vw.sc * 0.5); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); }
  // 계주: 배턴 교환 구역(노랑) + 구간 표시선
  if (ev === 'relay') for (let L = 1; L <= N; L++) for (const [z0, z1] of ZONES) {
    c.strokeStyle = '#ffd43b88'; c.lineWidth = Math.max(2, LW * vw.sc * vw.sy * 0.8); c.beginPath();
    for (let d = z0; d <= z1; d += 1.5) { const [x, y] = runXY(ev, L, d); const q = P(vw, x, y); d === z0 ? c.moveTo(...q) : c.lineTo(...q); } c.stroke();
    for (const d of [z0, z1]) mark(c, vw, ev, L, d, '#ffd43b', 0.5);
  }
  // 800m: 브레이크라인 (첫 곡선이 끝나는 곳 · 여기부터 안쪽으로 들어올 수 있음)
  if (ev === '800') { const a = P(vw, S / 2, -(R0 + LW)), b = P(vw, S / 2, -Rout); c.strokeStyle = '#4ade80'; c.lineWidth = Math.max(2, vw.sc * 0.45); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); if (big) { c.fillStyle = '#4ade80'; c.font = `800 ${Math.max(11, vw.sc * 2.4)}px sans-serif`; c.textAlign = 'center'; c.fillText('브레이크라인', b[0], b[1] - vw.sc * 1.2); } }
  // 출발선: 주로마다 (엇갈린 출발)
  for (let L = 1; L <= N; L++) { mark(c, vw, ev, L, 0, '#fff', 0.9); if (big) { const [x, y] = runXY(ev, L, 0); const q = P(vw, x, y); c.fillStyle = '#fff'; c.font = `900 ${Math.max(9, vw.sc * 1.7)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(L), q[0] - (ev === '100' ? vw.sc * 1.8 : 0), q[1]); } }
  if (big) { c.fillStyle = '#ffffffaa'; c.font = `800 ${Math.max(11, vw.sc * 2.2)}px sans-serif`; c.textAlign = 'center'; const f = P(vw, S / 2, Rout + 2.5); c.fillText('결승선', f[0], f[1] + vw.sc * 1.6); }
  return cv;
}
// 주로를 가로지르는 짧은 선
function mark(c, vw, ev, L, d, col, w) {
  const [x, y] = runXY(ev, L, d); const [x2, y2] = runXY(ev, L, d + 0.5); let tx = x2 - x, ty = y2 - y; const n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n; // 진행 방향 → 옆 방향(-ty, tx)
  const h = LW / 2; const q1 = P(vw, x - ty * h, y + tx * h), q2 = P(vw, x + ty * h, y - tx * h);
  c.strokeStyle = col; c.lineWidth = Math.max(1.5, vw.sc * 0.36 * w); c.beginPath(); c.moveTo(...q1); c.lineTo(...q2); c.stroke();
}
// 선수 점(위에서 본 모습): 그림자 + 팀 색 몸통 + 주로 번호
export function dotRunner(c, vw, ev, L, d, col, { r = 1.2, me = false, label = '', lead = false, offset = 0, small = false } = {}) {
  // 트랙 위 선수(사람 모양): 달리는 방향을 보고 다리·팔이 움직임 · 팀 색 상의 · 주로 번호표
  const [x, y] = posOf(ev, L, d, offset); const [x2] = posOf(ev, L, d + 0.6, offset); const [X, Y] = P(vw, x, y);
  const R = Math.max(small ? 6 : 8, r * vw.sc); const h = R * 2.5; const dir = x2 >= x ? 1 : -1; const ph = d * 1.7; const sw = Math.sin(ph) * 0.9;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  c.fillStyle = '#0006'; c.beginPath(); c.ellipse(X, Y, h * 0.3, h * 0.08, 0, 0, 7); c.fill();
  if (me) { c.strokeStyle = '#fff'; c.lineWidth = Math.max(2, h * 0.07); c.beginPath(); c.ellipse(X, Y, h * 0.42, h * 0.13, 0, 0, 7); c.stroke(); }
  const hip = [X, Y - h * 0.46], sh = [X + dir * h * 0.09, Y - h * 0.8]; const skin = '#3b2a20';
  c.strokeStyle = skin; c.lineWidth = Math.max(2, h * 0.13);
  for (const sgn of [1, -1]) { const s2 = sw * sgn; const knee = [hip[0] + dir * Math.sin(s2) * h * 0.22, hip[1] + h * 0.22]; c.beginPath(); c.moveTo(...hip); c.lineTo(...knee); c.lineTo(knee[0] + dir * Math.sin(s2 - 0.6) * h * 0.2, Y - h * 0.02); c.stroke(); }
  c.strokeStyle = '#0b0e24'; c.lineWidth = Math.max(4.5, h * 0.36); c.beginPath(); c.moveTo(...hip); c.lineTo(...sh); c.stroke(); // 테두리
  c.strokeStyle = col; c.lineWidth = Math.max(3.5, h * 0.29); c.beginPath(); c.moveTo(...hip); c.lineTo(...sh); c.stroke(); // 팀 색 상의
  c.strokeStyle = skin; c.lineWidth = Math.max(1.8, h * 0.1); for (const sgn of [-1, 1]) { c.beginPath(); c.moveTo(...sh); c.lineTo(sh[0] + dir * Math.sin(sw * sgn) * h * 0.24, sh[1] + h * 0.2); c.stroke(); }
  c.fillStyle = skin; c.beginPath(); c.arc(sh[0] + dir * h * 0.05, sh[1] - h * 0.13, Math.max(2.5, h * 0.13), 0, 7); c.fill();
  if (h >= 16) { const fs = Math.round(h * 0.17); c.fillStyle = '#fff'; c.fillRect(X - fs * 0.55 + dir * h * 0.04, Y - h * 0.72, fs * 1.1, fs * 1.05); c.fillStyle = '#111'; c.font = `900 ${fs}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(L), X + dir * h * 0.04, Y - h * 0.72 + fs * 0.55); } // 번호표
  else { c.fillStyle = '#fff'; c.font = `900 ${Math.max(8, Math.round(h * 0.45))}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.lineWidth = 2.5; c.strokeStyle = '#0b0e24'; c.strokeText(String(L), X, Y - h * 1.02); c.fillText(String(L), X, Y - h * 1.02); }
  if (label) { c.font = `800 ${Math.max(10, Math.round(h * 0.32))}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; const tw = c.measureText(label).width + 10; const th = Math.max(14, h * 0.45); const ly = Y - h * 1.18; c.fillStyle = lead ? '#ffd43be6' : '#0b0e24d0'; c.beginPath(); c.roundRect ? c.roundRect(X - tw / 2, ly - th / 2, tw, th, 5) : c.rect(X - tw / 2, ly - th / 2, tw, th); c.fill(); c.fillStyle = lead ? '#111' : '#fff'; c.fillText(label, X, ly); }
  c.restore();
  return [X, Y];
}

// ---------- 100m 옆에서 본 화면 ----------
export function straightView(W, H, N, { x0 = 0, top = 0 } = {}) { const L = 60, R = 50; const sx = (W - x0 - L - R) / 104; const lh = (H - top) / (N + 0.6); return { sx, lh, x0: x0 + L, top: top + lh * 0.3, N }; }
export function straightBg(W, H, sv, { big = true } = {}) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); const N = sv.N;
  c.fillStyle = '#123b23'; c.fillRect(0, 0, W, H);
  for (let L = 1; L <= N; L++) { const y = sv.top + (L - 1) * sv.lh; c.fillStyle = L % 2 ? '#b8462f' : '#b04129'; c.fillRect(0, y, W, sv.lh); }
  c.strokeStyle = '#ffffffcc'; c.lineWidth = 2; for (let L = 0; L <= N; L++) { const y = sv.top + L * sv.lh; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  for (let m = 0; m <= 100; m += 10) { const x = sv.x0 + m * sv.sx; c.strokeStyle = m === 0 ? '#fff' : '#ffffff33'; c.lineWidth = m === 0 ? 4 : 1; c.beginPath(); c.moveTo(x, sv.top); c.lineTo(x, sv.top + N * sv.lh); c.stroke(); if (big && m && m < 100) { c.fillStyle = '#ffffff99'; c.font = `800 ${Math.max(10, sv.lh * 0.22)}px sans-serif`; c.textAlign = 'center'; c.fillText(`${m}m`, x, sv.top - 4); } }
  const fx = sv.x0 + 100 * sv.sx; const cs = Math.max(4, sv.lh / 6);
  for (let L = 0; L < N; L++) for (let q = 0; q < 6; q++) for (let k = 0; k < 2; k++) { c.fillStyle = (q + k) % 2 ? '#111' : '#fff'; c.fillRect(fx + k * cs, sv.top + L * sv.lh + q * (sv.lh / 6), cs, sv.lh / 6); } // 결승선
  for (let L = 1; L <= N; L++) { c.fillStyle = '#fff'; c.font = `900 ${Math.max(11, sv.lh * 0.42)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(L), sv.x0 / 2, sv.top + (L - 0.5) * sv.lh); }
  if (big) { c.fillStyle = '#ffffffcc'; c.font = `800 ${Math.max(10, sv.lh * 0.24)}px sans-serif`; c.textAlign = 'center'; c.fillText('출발', sv.x0, sv.top + N * sv.lh + sv.lh * 0.25); c.fillText('결승', fx + cs, sv.top + N * sv.lh + sv.lh * 0.25); }
  return cv;
}
// 옆모습 선수: 머리·팀 색 상의·다리(달린 거리로 움직임)
export function sideRunner(c, sv, L, d, col, { me = false, label = '', lead = false, run = true } = {}) {
  const X = sv.x0 + d * sv.sx; const yb = sv.top + L * sv.lh - sv.lh * 0.12; const h = sv.lh * 0.78; const ph = run ? d * 1.6 : 0; const sw = Math.sin(ph) * 0.9;
  c.save(); c.lineCap = 'round';
  c.fillStyle = '#0005'; c.beginPath(); c.ellipse(X, yb, h * 0.28, h * 0.06, 0, 0, 7); c.fill();
  const hip = [X, yb - h * 0.48], sh = [X + h * 0.1, yb - h * 0.82];
  c.strokeStyle = '#3b2a20'; c.lineWidth = h * 0.09;
  for (const s of [sw, -sw]) { const knee = [hip[0] + Math.sin(s) * h * 0.22, hip[1] + h * 0.22]; c.beginPath(); c.moveTo(...hip); c.lineTo(...knee); c.lineTo(knee[0] + Math.sin(s - 0.6) * h * 0.2, yb); c.stroke(); }
  c.strokeStyle = col; c.lineWidth = h * 0.2; c.beginPath(); c.moveTo(...hip); c.lineTo(...sh); c.stroke(); // 상의(팀 색)
  c.strokeStyle = '#3b2a20'; c.lineWidth = h * 0.07; for (const s of [-sw, sw]) { c.beginPath(); c.moveTo(...sh); c.lineTo(sh[0] + Math.sin(s) * h * 0.22, sh[1] + h * 0.2); c.stroke(); }
  c.fillStyle = '#3b2a20'; c.beginPath(); c.arc(sh[0] + h * 0.05, sh[1] - h * 0.12, h * 0.1, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.fillRect(X - h * 0.02, yb - h * 0.72, h * 0.16, h * 0.14); c.fillStyle = '#111'; c.font = `900 ${Math.round(h * 0.13)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(L), X + h * 0.06, yb - h * 0.65); // 번호표
  if (me) { c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(X - h * 0.35, yb - h * 1.08, h * 0.7, h * 1.1); }
  if (label) { c.font = `800 ${Math.max(10, Math.round(h * 0.2))}px sans-serif`; const tw = c.measureText(label).width + 10; const lx = Math.max(tw / 2 + 2, X - h * 0.5 - tw / 2); c.fillStyle = lead ? '#ffd43be6' : '#0b0e24c8'; c.fillRect(lx - tw / 2, yb - h * 0.62, tw, h * 0.28); c.fillStyle = lead ? '#111' : '#fff'; c.fillText(label, lx, yb - h * 0.48); }
  c.restore();
}
export { BREAK, rCen };

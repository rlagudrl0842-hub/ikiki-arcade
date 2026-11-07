// ✨ 공통 효과 (점수·성공·실패·순위 변경·신기록·승리) — 화면 위에 잠깐 떴다 사라지는 층
// transform·opacity 애니메이션만 써서 가볍게 (구형 폰도 GPU로 처리) · 화질 '가벼움'이면 입자 수를 줄임
import { quality } from './scene3d.js';

let layer = null;
function L() { if (layer?.isConnected) return layer; layer = document.createElement('div'); layer.className = 'fxl'; document.body.append(layer); return layer; }
function add(el, ms) { L().append(el); setTimeout(() => el.remove(), ms); return el; }
let lastFlash = 0;
// 화면 가장자리 빛: ok(초록) · bad(빨강) · gold(노랑) — 너무 자주 번쩍이지 않게 0.18초 간격
export function flash(kind = 'ok') { const now = performance.now(); if (now - lastFlash < 180) return; lastFlash = now; const el = document.createElement('div'); el.className = `fxf ${kind}`; add(el, 600); }
// 떠오르는 글자 (+3, 성공!, 콤보) — x·y는 화면 좌표(없으면 가운데)
export function pop(text, { x, y, kind = 'ok', big = false } = {}) {
  const el = document.createElement('div'); el.className = `fxp ${kind} ${big ? 'big' : ''}`; el.textContent = text;
  el.style.left = `${x ?? innerWidth / 2}px`; el.style.top = `${y ?? innerHeight * 0.4}px`; return add(el, 1100);
}
// 퍼지는 빛 고리 + 입자
export function burst({ x, y, color = '#ffd43b', n } = {}) {
  const cx = x ?? innerWidth / 2, cy = y ?? innerHeight * 0.45; const cnt = n ?? (quality() === 'low' ? 6 : 14);
  const ring = document.createElement('div'); ring.className = 'fxr'; ring.style.cssText = `left:${cx}px;top:${cy}px;--c:${color}`; add(ring, 700);
  for (let i = 0; i < cnt; i++) { const p = document.createElement('i'); p.className = 'fxd'; const a = (i / cnt) * Math.PI * 2 + Math.random() * 0.4, d = 60 + Math.random() * 90; p.style.cssText = `left:${cx}px;top:${cy}px;--c:${color};--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px`; add(p, 800); }
}
// 가운데 큰 띠 (순위 상승·신기록·승리)
export function banner(text, kind = 'gold', ms = 2200) { const el = document.createElement('div'); el.className = `fxb ${kind}`; el.textContent = text; return add(el, ms); }

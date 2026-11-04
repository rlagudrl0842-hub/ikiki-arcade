// 새 게임 공용 계산 (서버와 폰이 똑같이 계산 → 서버가 입력 검증)
import { rng } from './gen.js';

// ---------------- 과일 베기: 과일이 날아오는 순서 ----------------
// 좌표: 가로 0~1, 세로 0(위)~1.5(아래). 시간은 게임 시작 후 초
export const FRUIT_G = 1.25;
export const FRUITS = ['🍉', '🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🍍', '🥝', '🍌'];
export function fruitSchedule(seed, durSec, level) {
  const r = rng(seed);
  const bombP = [0.04, 0.12, 0.17][level];
  const out = []; let t = 0.6, id = 0;
  while (t < durSec - 1.2) {
    const prog = t / durSec;
    const k = 1 + Math.floor(r() * (1.5 + prog * 2.5 + level * 0.5));
    for (let i = 0; i < k; i++) {
      const roll = r();
      const type = roll < bombP ? 'b' : roll < bombP + 0.045 ? 'g' : 'f';
      out.push({ id: ++id, t: Math.round((t + i * 0.12) * 1000) / 1000, x0: 0.15 + r() * 0.7, vx: (r() - 0.5) * 0.45, vy: -(1.42 + r() * 0.3), type, k: Math.floor(r() * FRUITS.length), spin: (r() - 0.5) * 6 });
    }
    t += (1.15 - prog * 0.45 - level * 0.08) * (0.75 + r() * 0.5);
  }
  return out;
}
export function fruitPos(f, sec) {
  const dt = sec - f.t;
  return [f.x0 + f.vx * dt, 1.55 + f.vy * dt + 0.5 * FRUIT_G * dt * dt, dt];
}
// 화면 위에 있는 시간 (초)
export const fruitLife = (f) => (2 * -f.vy) / FRUIT_G;
export const fruitR = (f) => (f.type === 'g' ? 0.06 : f.type === 'b' ? 0.07 : 0.078);

// ---------------- 단체 줄넘기: 줄이 바닥에 닿는 시각 ----------------
// p = { t0, p0, decay, pmin } (ms). k번째 박자 시각을 계산
export function ropeBeats(p, durMs) {
  const out = []; let t = p.t0, per = p.p0;
  while (t < p.t0 + durMs) { out.push(Math.round(t)); t += per; per = Math.max(p.pmin, per * p.decay); }
  return out;
}

// ---------------- 불꽃놀이: 발사·최고점 시각 ----------------
export function fireRounds(seed, t0, n, gap) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const L = t0 + i * gap;
    const rise = 1150 + Math.floor(r() * 900);
    out.push({ L: Math.round(L), A: Math.round(L + rise), x: Math.round((0.18 + r() * 0.64) * 1000) / 1000, hue: Math.floor(r() * 360) });
  }
  return out;
}

// ---------------- 틀린 그림 찾기: 퍼즐 생성 (서버·폰 동일) ----------------
export const SPOT_ICONS = ['🍎', '🍋', '🍇', '🍓', '⚽', '🏀', '🎸', '🎹', '🚗', '🚲', '⭐', '🌙', '🌵', '🍄', '🐟', '🦋'];
export function spotPuzzle(seed, k, lv) {
  const r = rng((seed * 31 + k * 7919 + lv * 101) >>> 0);
  const [cols, rows] = [[4, 4], [4, 5], [5, 5], [5, 6], [6, 6], [6, 6]][Math.max(0, Math.min(5, lv))];
  const nd = [2, 2, 3, 3, 4, 5][Math.max(0, Math.min(5, lv))];
  const n = cols * rows; const pool = SPOT_ICONS.slice(0, 6 + Math.min(10, lv * 2));
  const left = Array.from({ length: n }, () => pool[Math.floor(r() * pool.length)]);
  const right = left.slice(); const diff = new Set();
  while (diff.size < nd) { const i = Math.floor(r() * n); if (diff.has(i)) continue; let x; do { x = pool[Math.floor(r() * pool.length)]; } while (x === left[i]); right[i] = x; diff.add(i); }
  return { cols, rows, left, right, diff: [...diff] };
}

// ---------------- 리듬 마스터 악보 · 버거 재료 (서버·폰 공용) ----------------
const by6 = (lv, arr) => arr[Math.max(0, Math.min(5, lv ?? 2))];
export function rhythmChart(seed, t0, durMs, lv) {
  const r = rng(seed); const bpm = by6(lv, [84, 96, 112, 120, 126, 128]); const beat = 60000 / bpm;
  const out = []; let i = 0;
  for (let t = t0 + beat * 2; t < t0 + durMs - 600; t += beat / 2) {
    const strong = Math.round((t - t0) / (beat / 2)) % 2 === 0;
    if (strong ? r() < by6(lv, [0.55, 0.7, 0.85, 0.9, 0.92, 0.95]) : r() < by6(lv, [0, 0, 0.18, 0.3, 0.38, 0.45])) out.push({ i: i++, t: Math.round(t), l: Math.floor(r() * (lv <= 1 ? 2 : 3)) });
  }
  return { bpm, notes: out };
}

export const BURGER = ['🍞', '🥩', '🧀', '🥬', '🍅', '🥓', '🧅', '🥚'];

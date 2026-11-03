// 서버·클라이언트 공용 시드 난수 생성기.
// 같은 seed로 서버와 폰이 똑같은 배치(숫자 위치, 두더지 순서 등)를 만들고,
// 서버는 이 배치로 참가자 입력을 다시 계산해 점수를 검증한다.

export function rng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rint = (r, n) => Math.floor(r() * n);
export function shuffle(r, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rint(r, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function hashSeed(...parts) {
  let h = 2166136261 >>> 0;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

// ---- 게임별 공용 배치 생성기 ----

// 숫자 사냥: n개의 숫자를 격자에 무작위 배치
export function numHuntLayout(seed, n) {
  const side = Math.ceil(Math.sqrt(n));
  const cells = shuffle(rng(seed), Array.from({ length: side * side }, (_, i) => i)).slice(0, n);
  return { side, pos: cells }; // pos[k] = 숫자 (k+1)이 놓인 칸
}

// 두더지: 등장 일정 [{hole, at, dur}] (ms, 게임 시작 기준)
export function moleSchedule(seed, durMs, holes, level) {
  const r = rng(seed);
  const out = [];
  let t = 800;
  const base = [1100, 850, 650][level] ?? 850;
  const stay = [1400, 1000, 750][level] ?? 1000;
  while (t < durMs - 400) {
    out.push({ hole: rint(r, holes), at: Math.round(t), dur: Math.round(stay * (0.85 + r() * 0.3)) });
    const prog = t / durMs; // 시간이 갈수록 빨라짐
    t += base * (1 - prog * 0.35) * (0.7 + r() * 0.6);
  }
  return out;
}

// 기억력: 길이 len 순서 (버튼 k개)
export function memorySeq(seed, len, k) {
  const r = rng(seed);
  const s = [];
  for (let i = 0; i < len; i++) { let v; do { v = rint(r, k); } while (i > 0 && v === s[i - 1] && k > 2); s.push(v); }
  return s;
}

// 색깔 함정 라운드
export const COLORS6 = [
  { k: 'red', name: '빨강', hex: '#ff4d4d', shape: '●' },
  { k: 'blue', name: '파랑', hex: '#3d8bff', shape: '■' },
  { k: 'yellow', name: '노랑', hex: '#ffd43b', shape: '▲' },
  { k: 'green', name: '초록', hex: '#2fd27a', shape: '★' },
  { k: 'purple', name: '보라', hex: '#b06bff', shape: '◆' },
  { k: 'orange', name: '주황', hex: '#ff922b', shape: '♥' },
];
export function colorRound(seed, round, tiles, nColors, stroop) {
  const r = rng(hashSeed(seed, 'c', round));
  const target = rint(r, nColors);
  const grid = [];
  const nTarget = 2 + rint(r, Math.max(1, Math.floor(tiles / 4)));
  const idx = shuffle(r, Array.from({ length: tiles }, (_, i) => i));
  for (let i = 0; i < tiles; i++) grid.push(-1);
  idx.slice(0, nTarget).forEach((i) => (grid[i] = target));
  idx.slice(nTarget).forEach((i) => { let c; do { c = rint(r, nColors); } while (c === target); grid[i] = c; });
  // 함정 라운드: 타일 위에 다른 색 이름 글자를 적음
  const words = grid.map((c) => (stroop ? (() => { let w; do { w = rint(r, nColors); } while (w === c); return w; })() : -1));
  return { target, grid, words, nTarget };
}

// 탑 쌓기: 블록 위치 x(t) (0~1 범위 왕복). 블록 폭 w일 때 왼쪽 끝 위치
export function towerX(t, speed, w) {
  const span = 1 - w;
  const p = (t * speed) / 1000 % 2; // 0~2
  return (p < 1 ? p : 2 - p) * span;
}
export function towerSpeed(level, k) {
  return ([0.35, 0.55, 0.75][level] ?? 0.55) * (1 + k * 0.06);
}

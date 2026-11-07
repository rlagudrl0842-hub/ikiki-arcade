// 🎮 게임별 3D 배경 (캔버스만 사용 · 외부 이미지·라이브러리 없음)
// - 원근 바닥(소실점) · 하늘/벽 · 먼 배경 실루엣(관중석·나무·건물·산) · 조명·그림자·안개 · 느린 움직임(빛 흐름·입자)
// - 정적인 부분은 한 번 그려 두고(캐시) 매 프레임엔 붙여 넣기 + 가벼운 움직임만 → 구형 폰도 부담 적게
// - 화질: 처음 몇 초 프레임을 재서 느리면 자동으로 '가벼움'(움직임·입자 끔) · 동작 줄이기 설정도 따름
// - 연령 분위기: kid(밝고 부드럽게) · base(아케이드) · pro(어둡고 중계풍)

// ---------------- 게임 → 장면 ----------------
// view: persp(앞에서 본 원근 바닥) · side(옆에서 본 지면, ground=지면 높이 비율) · top(위에서 본 경기장 바닥)
const G = {
  // 아레나 (위에서 본 경기장)
  dodge: { t: 'storm', view: 'top' }, zombie: { t: 'zombie', view: 'top' }, paint: { t: 'court', view: 'top' }, gems: { t: 'cave', view: 'top' }, crown: { t: 'royal', view: 'top' },
  // 운동장·트랙
  mugung: { t: 'schoolyard', view: 'persp', h: 0.42 }, rope: { t: 'schoolyard', view: 'persp', h: 0.5 }, runner: { t: 'track', view: 'side', ground: 0.72 }, relay: { t: 'track', view: 'persp', h: 0.38 },
  stairs: { t: 'sky', view: 'side', ground: 0.95 }, bridge: { t: 'canyon', view: 'side', ground: 0.66 }, flappy: { t: 'sky', view: 'side', ground: 0.97 }, balloon: { t: 'sky', view: 'side', ground: 0.62 },
  penalty: { t: 'stadium', view: 'persp', h: 0.12 }, curling: { t: 'ice', view: 'persp', h: 0.08 }, tuho: { t: 'hanok', view: 'persp', h: 0.3 }, basket: { t: 'gym', view: 'persp', h: 0.3 },
  fishing: { t: 'lake', view: 'side', ground: 0.32 }, eggs: { t: 'farm', view: 'side', ground: 0.85 }, dalgona: { t: 'table', view: 'persp', h: 0.06 }, burger: { t: 'kitchen', view: 'persp', h: 0.18 },
  fire: { t: 'night', view: 'side', ground: 1 }, fruit: { t: 'dojo', view: 'persp', h: 0.55 }, rhythm: { t: 'stage', view: 'persp', h: 0.22 }, shout: { t: 'stage', view: 'persp', h: 0.5 },
  bell: { t: 'quiz', view: 'persp', h: 0.62 }, tele: { t: 'quiz', view: 'persp', h: 0.62 }, mino: { t: 'quiz', view: 'persp', h: 0.62 }, hilo: { t: 'casino', view: 'persp', h: 0.62 },
  draw: { t: 'studio', view: 'persp', h: 0.62 }, spot: { t: 'studio', view: 'persp', h: 0.62 }, hold: { t: 'lab', view: 'persp', h: 0.6 }, sync: { t: 'stage', view: 'persp', h: 0.55 },
  bombpass: { t: 'bunker', view: 'persp', h: 0.5 }, boss: { t: 'castle', view: 'persp', h: 0.5 }, towerup: { t: 'city', view: 'side', ground: 0.94 },
  pe_freeze: { t: 'gym', view: 'persp', h: 0.5 }, pe_simon: { t: 'gym', view: 'persp', h: 0.5 }, pe_mission: { t: 'gym', view: 'persp', h: 0.5 },
};
// 폰 없는 체육 60종: 진행 방식(mech)·장면(scene)으로 정함
const PE_MECH = { follow: 'gym', signal: 'gym', memory: 'studio', race: 'track', react: 'arena', bomb: 'bunker', mission: 'gym', judge: 'stage', survive: 'arena', tug: 'stadium', attack: 'castle', choice: 'quiz', bingo: 'quiz', tower: 'city', zone: 'court', tourney: 'stadium', rps: 'stadium' };
// 게임 이름(주제)에 맞춘 장면이 먼저
const PE_ID = { p_animal: 'forest', p_forest: 'forest', p_dino: 'canyon', p_space: 'space', p_ice: 'ice', p_robot: 'lab', p_chest: 'cave', p_balloon: 'sky', p_sea: 'lake', p_light: 'stage', p_bridge: 'canyon', p_flash: 'arena', p_mine: 'cave', p_colorwar: 'court', p_color: 'court', p_bomb: 'bunker', p_spy: 'bunker', p_laser: 'bunker', p_mugung: 'schoolyard', p_fuel: 'space', p_rocket: 'space', p_track: 'track', p_tug: 'stadium', p_pop: 'sky', p_castle: 'castle', p_pirate: 'lake', p_treasure: 'cave', p_tower: 'city', p_dragon: 'castle', p_energy: 'lab', p_flags: 'stadium', p_dance: 'stage', p_tempo: 'stage', p_cheer: 'stage', p_ox: 'quiz', p_cards: 'casino', p_auction: 'casino', p_roulette: 'casino', p_sports: 'stadium', p_final: 'stadium', p_tourney: 'stadium', p_rps: 'stadium', p_zonewar: 'court', p_survivor: 'arena', p_numbers: 'quiz', p_shapes: 'studio', p_balance: 'gym', p_code: 'lab', p_mind: 'studio', p_blind: 'gym', p_timeattack: 'track', p_movemem: 'studio', p_ten: 'gym', p_reverse: 'gym', p_opposite: 'gym', p_memrelay: 'track', p_roles: 'stage', p_risk: 'casino', p_countdown: 'arena', p_bingo: 'quiz' };
export function sceneOf(id, pe) {
  if (G[id]) return G[id];
  if (pe || /^p_/.test(id)) return { t: PE_ID[id] || PE_MECH[pe?.mech] || 'gym', view: 'persp', h: 0.36 };
  return { t: 'arcade', view: 'persp', h: 0.45 };
}

// ---------------- 장면 색·소품 ----------------
// sky: [위, 아래] · floor: [가까운 쪽, 먼 쪽] · line: 바닥 선 · far: 먼 배경 · light: 조명 색 · fog: 안개
const T = {
  arcade: { sky: ['#0a0f2e', '#1d1b5c'], floor: ['#16123a', '#2a2172'], line: '#7b6cff', far: 'cabinets', light: '#9a7bff', fog: '#2a1f7a' },
  storm: { sky: ['#0b1028', '#1f2a5a'], floor: ['#17204a', '#0c1230'], line: '#ffd43b', far: null, light: '#ffe066', fog: '#1d2a66', bolts: true },
  zombie: { sky: ['#050a06', '#0f2414'], floor: ['#0f2014', '#07110a'], line: '#3fb950', far: null, light: '#ff2a3d', fog: '#173b1e' },
  court: { sky: ['#1a1030', '#2a1650'], floor: ['#2a1f54', '#1a1338'], line: '#ffffff', far: null, light: '#c77dff', fog: '#2a1a5a', tiles: true },
  cave: { sky: ['#05060f', '#141032'], floor: ['#181336', '#0b0920'], line: '#7cf3ff', far: null, light: '#7cf3ff', fog: '#1b1642', crystals: true },
  royal: { sky: ['#1a0f05', '#3a2208'], floor: ['#3a2a14', '#22170a'], line: '#ffd43b', far: null, light: '#ffcf5a', fog: '#4a2f0c', tiles: true },
  schoolyard: { sky: ['#62b6ff', '#cfeeff'], floor: ['#d9a46a', '#b9824a'], line: '#ffffff', far: 'school', light: '#fff4c2', fog: '#e8f4ff', sun: true },
  track: { sky: ['#3a7bd5', '#a9dcff'], floor: ['#c8452e', '#a83522'], line: '#ffffff', far: 'stands', light: '#fff4c2', fog: '#cfe8ff', lanes: 8, sun: true },
  stadium: { sky: ['#06102a', '#1a3a7a'], floor: ['#2f9e44', '#237a35'], line: '#ffffff', far: 'stands', light: '#e8f2ff', fog: '#1f3f80', stripes: true, flood: true },
  sky: { sky: ['#4aa8ff', '#d4f0ff'], floor: ['#5fbf5a', '#3f9a3e'], line: null, far: 'clouds', light: '#ffffff', fog: '#e8f6ff', sun: true },
  canyon: { sky: ['#ff9a5a', '#ffd9a8'], floor: ['#8a4a2a', '#5a2a18'], line: null, far: 'mesas', light: '#ffe2b0', fog: '#ffc58a', sun: true },
  ice: { sky: ['#cfe8ff', '#f4fbff'], floor: ['#e9f5ff', '#bcd9f2'], line: '#9fb6d6', far: 'mountains', light: '#ffffff', fog: '#ffffff', shine: true },
  hanok: { sky: ['#ffb36b', '#ffe7c4'], floor: ['#c9a57a', '#a8835a'], line: '#8a6a44', far: 'roofs', light: '#fff1d0', fog: '#ffe2c0', sun: true },
  gym: { sky: ['#2b3a66', '#46598f'], floor: ['#d8a565', '#b98144'], line: '#ffffff', far: 'gymwall', light: '#fff7dd', fog: '#5a6ea8', planks: true },
  lake: { sky: ['#7ec8ff', '#d8f1ff'], floor: ['#1b6fb5', '#0b3a6b'], line: null, far: 'forest', light: '#ffffff', fog: '#bfe6ff', water: true, sun: true },
  farm: { sky: ['#ffd38a', '#fff3cf'], floor: ['#7bc55a', '#4f9a3a'], line: null, far: 'barn', light: '#fff1c4', fog: '#fff0c8', sun: true },
  table: { sky: ['#2b1d14', '#3b2a1c'], floor: ['#6b4423', '#3b2412'], line: null, far: null, light: '#ffcf8a', fog: '#2b1d14', woodgrain: true },
  kitchen: { sky: ['#ffe8c8', '#ffd2a0'], floor: ['#f2e1c8', '#d9c0a0'], line: '#c9a882', far: 'shelves', light: '#fff7e0', fog: '#ffe6c4', tiles: true },
  night: { sky: ['#05061a', '#1b1f5a'], floor: ['#0b0e24', '#05061a'], line: null, far: 'city', light: '#ffd43b', fog: '#14185a', stars: true },
  dojo: { sky: ['#2a1608', '#4a2a12'], floor: ['#c79a5c', '#9a7240'], line: '#6b4a24', far: 'shoji', light: '#ffe0a0', fog: '#3a2210', planks: true },
  stage: { sky: ['#07040f', '#1d0f3a'], floor: ['#1a1030', '#0d0820'], line: '#ff3df2', far: 'speakers', light: '#ff3df2', fog: '#2a1050', beams: true },
  quiz: { sky: ['#071330', '#12286a'], floor: ['#0f1d52', '#081236'], line: '#22e1ff', far: 'screens', light: '#22e1ff', fog: '#10306a', beams: true },
  casino: { sky: ['#1a0612', '#3a0d24'], floor: ['#0f5a3a', '#073826'], line: '#ffd43b', far: 'lights', light: '#ffd43b', fog: '#3a0d24' },
  studio: { sky: ['#1b1f3f', '#2c3270'], floor: ['#252a5c', '#161a3c'], line: '#9aa8ff', far: 'screens', light: '#c9d0ff', fog: '#2c3270' },
  lab: { sky: ['#06141a', '#0d2a36'], floor: ['#0f2a33', '#071820'], line: '#2fe0c0', far: 'panels', light: '#2fe0c0', fog: '#0d3440', tiles: true },
  bunker: { sky: ['#0d0f14', '#1f2430'], floor: ['#232833', '#141820'], line: '#ff4d4d', far: 'panels', light: '#ff4d4d', fog: '#2a2f3c', tiles: true },
  castle: { sky: ['#140914', '#3a1a2a'], floor: ['#3a3440', '#24202a'], line: '#ffb347', far: 'castle', light: '#ff8a3d', fog: '#4a1f2f', tiles: true, embers: true },
  city: { sky: ['#16123a', '#3b2d7a'], floor: ['#2b2550', '#1a1638'], line: null, far: 'city', light: '#ffd43b', fog: '#2b1d52', stars: true },
  forest: { sky: ['#7fd3ff', '#d6f3ff'], floor: ['#5fae4a', '#3f8a33'], line: null, far: 'forest', light: '#fff6c8', fog: '#d8f2e0', sun: true },
  space: { sky: ['#02030c', '#0d1036'], floor: ['#151a3c', '#0a0d24'], line: '#22e1ff', far: 'planet', light: '#9ad8ff', fog: '#141a50', stars: true },
  arena: { sky: ['#070b1c', '#151a3d'], floor: ['#121838', '#0a0e24'], line: '#22e1ff', far: 'stands', light: '#22e1ff', fog: '#1a2060' },
};

// ---------------- 화질 (자동) ----------------
let Q = 'high';
try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) Q = 'low'; if (/[?&]q=low/.test(location.search)) Q = 'low'; if ((navigator.deviceMemory || 4) <= 1) Q = 'low'; /* 메모리 1GB 이하만 처음부터 가볍게, 나머지는 실제 프레임을 재서 정함 */ } catch { /* */ }
let fr = [], last = 0, judged = false;
function measure(now) { if (judged) return; if (last && now - last < 4) return; if (last && now - last < 1000) fr.push(now - last); last = now; /* 한 프레임에 여러 번 불려도 한 번만 잼 */ if (fr.length >= 120) { fr.sort((a, b) => a - b); const med = fr[60], p90 = fr[108]; if (med > 24 || p90 > 30) { Q = 'low'; judged = true; } fr = []; /* 계속 재다가 자주 끊기면 가벼움으로 (다시 올리지는 않음) */ } }
export const quality = () => Q;
export function setQuality(q) { Q = q === 'low' ? 'low' : 'high'; judged = true; }

// ---------------- 그리기 도우미 ----------------
const mix = (a, b, k) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * k)).join(',')})`; };
const tone = (col, tn) => (tn === 'kid' ? mix(col, '#ffffff', 0.18) : tn === 'pro' ? mix(col, '#000000', 0.25) : col);
function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function vgrad(c, x0, y0, x1, y1, a, b) { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function glow(c, x, y, r, col, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col + Math.round(a * 255).toString(16).padStart(2, '0')); g.addColorStop(1, col + '00'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }

// 먼 배경 실루엣 (지평선 hy 위에)
function far(c, W, hy, kind, th, tn, r) {
  const dark = tone(mix(th.sky[1], '#000000', 0.45), tn); const mid = tone(mix(th.sky[1], '#000000', 0.25), tn);
  c.save();
  if (kind === 'stands') { // 관중석 계단 + 관중 점 + 조명탑
    for (let k = 0; k < 3; k++) { const y0 = hy - (3 - k) * hy * 0.07; c.fillStyle = mix(dark, th.sky[1], k * 0.12); c.fillRect(0, y0, W, hy * 0.08); for (let x = 0; x < W; x += 9) { c.fillStyle = `hsla(${(x * 7 + k * 50) % 360},60%,${55 + (x % 3) * 8}%,0.55)`; c.fillRect(x + r() * 4, y0 + 2 + r() * hy * 0.04, 3, 3); } }
    for (const fx of [0.08, 0.92]) { c.fillStyle = dark; c.fillRect(W * fx - 3, hy * 0.25, 6, hy * 0.5); c.fillStyle = '#fffbe6'; c.fillRect(W * fx - 26, hy * 0.2, 52, 12); glow(c, W * fx, hy * 0.22, W * 0.22, '#fff6d0', 0.35); }
  } else if (kind === 'school') { c.fillStyle = mid; c.fillRect(W * 0.18, hy * 0.45, W * 0.64, hy * 0.55); c.fillStyle = dark; for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) c.fillRect(W * 0.2 + i * W * 0.051, hy * 0.52 + j * hy * 0.15, W * 0.03, hy * 0.09); c.fillStyle = mid; c.fillRect(W * 0.46, hy * 0.3, W * 0.08, hy * 0.2); c.fillStyle = '#ffffffcc'; c.beginPath(); c.arc(W * 0.5, hy * 0.38, hy * 0.05, 0, 7); c.fill(); for (let x = 0; x < W; x += W / 14) { c.fillStyle = mix(dark, '#2f8a3a', 0.6); c.beginPath(); c.arc(x, hy, hy * 0.1, Math.PI, 0); c.fill(); } }
  else if (kind === 'clouds') { c.fillStyle = '#ffffffcc'; for (let i = 0; i < 7; i++) { const x = r() * W, y = hy * (0.15 + r() * 0.5), s = W * (0.05 + r() * 0.06); for (const [dx, dy, k] of [[0, 0, 1], [s * 0.8, -s * 0.3, 0.8], [s * 1.6, 0, 0.9]]) { c.beginPath(); c.arc(x + dx, y + dy, s * k, 0, 7); c.fill(); } } }
  else if (kind === 'mesas' || kind === 'mountains') { const cols = kind === 'mesas' ? [mix(th.sky[1], '#7a2a12', 0.5), mix(th.sky[1], '#5a1a0a', 0.7)] : ['#d8e8f8', '#b8cfe6']; for (let k = 0; k < 2; k++) { c.fillStyle = cols[k]; c.beginPath(); c.moveTo(0, hy); let x = 0; while (x < W) { const w = W * (0.08 + r() * 0.14), hh = hy * (kind === 'mesas' ? 0.25 + r() * 0.3 : 0.3 + r() * 0.45) * (k ? 0.7 : 1); if (kind === 'mesas') { c.lineTo(x + w * 0.15, hy - hh); c.lineTo(x + w * 0.85, hy - hh); c.lineTo(x + w, hy); } else { c.lineTo(x + w / 2, hy - hh); c.lineTo(x + w, hy); } x += w; } c.lineTo(W, hy); c.fill(); if (kind === 'mountains' && !k) { c.fillStyle = '#ffffffcc'; } } }
  else if (kind === 'roofs') { for (let i = 0; i < 4; i++) { const x = W * (0.05 + i * 0.25), w = W * 0.2; c.fillStyle = dark; c.beginPath(); c.moveTo(x - w * 0.1, hy * 0.72); c.quadraticCurveTo(x + w / 2, hy * 0.5, x + w * 1.1, hy * 0.72); c.lineTo(x + w, hy * 0.8); c.lineTo(x, hy * 0.8); c.fill(); c.fillStyle = mid; c.fillRect(x + w * 0.08, hy * 0.8, w * 0.84, hy * 0.2); } }
  else if (kind === 'gymwall') { c.fillStyle = mid; c.fillRect(0, hy * 0.1, W, hy * 0.9); c.fillStyle = dark; for (let i = 0; i < 6; i++) c.fillRect(W * (0.05 + i * 0.16), hy * 0.18, W * 0.12, hy * 0.3); c.fillStyle = '#ffffff22'; c.fillRect(0, hy * 0.62, W, hy * 0.04); c.strokeStyle = '#ffffff55'; c.lineWidth = 4; c.strokeRect(W * 0.44, hy * 0.25, W * 0.12, hy * 0.2); c.fillStyle = '#ff6b2c'; c.fillRect(W * 0.485, hy * 0.45, W * 0.03, 4); }
  else if (kind === 'forest') { for (let k = 0; k < 3; k++) { c.fillStyle = mix(k ? '#1f6b3a' : '#2f8a4a', th.sky[1], 0.45 - k * 0.15); for (let x = -40; x < W + 40; x += W / (10 + k * 4)) { const hh = hy * (0.3 + r() * 0.35) * (1 - k * 0.15); c.beginPath(); c.moveTo(x, hy); c.lineTo(x + W / 30, hy - hh); c.lineTo(x + W / 15, hy); c.fill(); } } }
  else if (kind === 'barn') { c.fillStyle = '#b23a2a'; c.fillRect(W * 0.62, hy * 0.45, W * 0.22, hy * 0.55); c.beginPath(); c.moveTo(W * 0.6, hy * 0.47); c.lineTo(W * 0.73, hy * 0.25); c.lineTo(W * 0.86, hy * 0.47); c.fill(); c.fillStyle = '#ffffffaa'; c.fillRect(W * 0.7, hy * 0.62, W * 0.06, hy * 0.38); far(c, W * 0.55, hy, 'forest', th, tn, r); }
  else if (kind === 'city') { for (let k = 0; k < 2; k++) for (let x = 0; x < W; x += W * (0.04 + r() * 0.05)) { const w = W * (0.03 + r() * 0.05), hh = hy * (0.25 + r() * 0.55) * (k ? 0.7 : 1); c.fillStyle = k ? mix(dark, '#000000', 0.3) : dark; c.fillRect(x, hy - hh, w, hh); for (let wy = hy - hh + 8; wy < hy - 6; wy += 12) for (let wx = x + 4; wx < x + w - 4; wx += 9) if (r() > 0.78) { c.fillStyle = '#ffd96a99'; c.fillRect(wx, wy, 4, 5); } } }
  else if (kind === 'shoji') { c.fillStyle = mix(th.sky[1], '#f2e2c4', 0.6); c.fillRect(0, hy * 0.1, W, hy * 0.9); c.strokeStyle = dark; c.lineWidth = 3; for (let x = 0; x < W; x += W / 10) { c.beginPath(); c.moveTo(x, hy * 0.1); c.lineTo(x, hy); c.stroke(); } for (let y = hy * 0.1; y < hy; y += hy / 5) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } }
  else if (kind === 'speakers' || kind === 'screens' || kind === 'panels' || kind === 'shelves' || kind === 'cabinets' || kind === 'lights') {
    const n = kind === 'cabinets' ? 9 : kind === 'screens' ? 5 : 7;
    for (let i = 0; i < n; i++) { const w = W / n * 0.78, x = i * W / n + W / n * 0.11, hh = hy * (kind === 'speakers' ? 0.55 : 0.5), y = hy - hh - (kind === 'screens' ? hy * 0.15 : 0);
      c.fillStyle = dark; c.fillRect(x, y, w, hh);
      const sc = kind === 'screens' || kind === 'cabinets' ? th.light : kind === 'panels' ? th.line : kind === 'lights' ? '#ffd43b' : '#000000';
      if (kind === 'speakers') { c.fillStyle = '#000000aa'; c.beginPath(); c.arc(x + w / 2, y + hh * 0.35, w * 0.3, 0, 7); c.arc(x + w / 2, y + hh * 0.75, w * 0.2, 0, 7); c.fill(); }
      else if (kind === 'shelves') { c.fillStyle = '#ffffff55'; for (let j = 1; j < 4; j++) c.fillRect(x, y + hh * j / 4, w, 3); }
      else if (kind === 'lights') { for (let j = 0; j < 6; j++) { c.fillStyle = j % 2 ? '#ffd43bcc' : '#ff5a8acc'; c.beginPath(); c.arc(x + w * (j + 0.5) / 6, y + 8, 4, 0, 7); c.fill(); } }
      else { c.fillStyle = sc + '33'; c.fillRect(x + w * 0.1, y + hh * 0.1, w * 0.8, hh * (kind === 'cabinets' ? 0.4 : 0.7)); c.fillStyle = sc + '88'; c.fillRect(x + w * 0.1, y + hh * 0.1, w * 0.8, 3); }
    }
  } else if (kind === 'castle') { c.fillStyle = dark; c.fillRect(W * 0.2, hy * 0.35, W * 0.6, hy * 0.65); for (let x = W * 0.2; x < W * 0.8; x += W * 0.04) c.fillRect(x, hy * 0.3, W * 0.02, hy * 0.06); for (const tx of [0.15, 0.78]) { c.fillRect(W * tx, hy * 0.15, W * 0.07, hy * 0.85); c.beginPath(); c.moveTo(W * tx - 6, hy * 0.15); c.lineTo(W * (tx + 0.035), hy * 0.02); c.lineTo(W * (tx + 0.07) + 6, hy * 0.15); c.fill(); } c.fillStyle = '#ffb34755'; for (let i = 0; i < 5; i++) c.fillRect(W * (0.27 + i * 0.11), hy * 0.5, W * 0.025, hy * 0.08); }
  else if (kind === 'planet') { const g = c.createRadialGradient(W * 0.75, hy * 0.35, 10, W * 0.78, hy * 0.4, hy * 0.45); g.addColorStop(0, '#9ad8ff'); g.addColorStop(1, '#203a8a'); c.fillStyle = g; c.beginPath(); c.arc(W * 0.78, hy * 0.42, hy * 0.32, 0, 7); c.fill(); c.strokeStyle = '#cfe8ff66'; c.lineWidth = 5; c.beginPath(); c.ellipse(W * 0.78, hy * 0.42, hy * 0.55, hy * 0.1, -0.3, 0, 7); c.stroke(); }
  c.restore();
}

// 바닥: 원근(소실점) · 위에서 본 바닥 · 옆에서 본 지면
function floorPersp(c, W, H, hy, th, tn, sc) {
  const near = tone(th.floor[0], tn), farc = tone(th.floor[1], tn);
  c.fillStyle = vgrad(c, 0, hy, 0, H, farc, near); c.fillRect(0, hy, W, H - hy);
  const vx = W / 2; const D = H - hy;
  // 깊이 줄무늬 (잔디·나무 판자·물결) — 가까울수록 넓어짐
  if (th.stripes || th.planks || th.woodgrain || th.water) {
    let z = 1; for (let i = 0; i < 40; i++) { const y0 = hy + D * (1 - 1 / (1 + z * 0.12)), y1 = hy + D * (1 - 1 / (1 + (z + 1) * 0.12)); if (i % 2) { c.fillStyle = th.water ? '#ffffff10' : th.planks || th.woodgrain ? '#00000018' : '#ffffff12'; c.fillRect(0, y0, W, Math.max(1, y1 - y0)); } z++; if (y1 > H) break; }
  }
  // 소실점으로 모이는 선 (트랙 레인·코트 선·바닥 격자)
  if (th.line) {
    c.strokeStyle = th.line + (th.lanes ? 'ee' : '30'); c.lineWidth = Math.max(1, W / 700);
    const n = th.lanes || 14; const spread = th.lanes ? 1.3 : 2.2;
    for (let i = 0; i <= n; i++) { const bx = vx + (i / n - 0.5) * W * spread; c.beginPath(); c.moveTo(vx + (bx - vx) * 0.04, hy); c.lineTo(bx, H); c.stroke(); }
    if (!th.lanes) { let z = 1; c.strokeStyle = th.line + '22'; for (let i = 0; i < 24; i++) { const y = hy + D * (1 - 1 / (1 + z * 0.35)); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); z++; } }
    else { // 결승선 (체크무늬) + 출발선
      const fy = hy + D * 0.08; const half = W * 1.3 * 0.5 * (0.04 + 0.96 * 0.08); const s = Math.max(4, half / 12);
      for (let i = 0; i < 24; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#ffffff' : '#111111'; c.fillRect(vx - half + i * s, fy + j * s * 0.5, s, s * 0.5); }
    }
  }
  if (th.shine) { const g = c.createLinearGradient(0, hy, 0, H); g.addColorStop(0, '#ffffff00'); g.addColorStop(0.5, '#ffffff33'); g.addColorStop(1, '#ffffff00'); c.fillStyle = g; c.fillRect(0, hy, W, D); }
  // 지평선 안개 (깊이감)
  const fg = c.createLinearGradient(0, hy - D * 0.05, 0, hy + D * 0.25); fg.addColorStop(0, tone(th.fog, tn) + '00'); fg.addColorStop(0.3, tone(th.fog, tn) + '88'); fg.addColorStop(1, tone(th.fog, tn) + '00'); c.fillStyle = fg; c.fillRect(0, hy - D * 0.05, W, D * 0.3);
}
function floorTop(c, W, H, th, tn, r) {
  c.fillStyle = vgrad(c, 0, 0, W, H, tone(th.floor[0], tn), tone(th.floor[1], tn)); c.fillRect(0, 0, W, H);
  const s = Math.max(24, Math.min(W, H) / 9);
  if (th.tiles) { for (let x = 0; x < W; x += s) for (let y = 0; y < H; y += s) { c.fillStyle = ((x / s + y / s) | 0) % 2 ? '#ffffff08' : '#00000014'; c.fillRect(x, y, s, s); } }
  c.strokeStyle = (th.line || '#ffffff') + '18'; c.lineWidth = 1; c.beginPath(); for (let x = 0; x <= W; x += s) { c.moveTo(x, 0); c.lineTo(x, H); } for (let y = 0; y <= H; y += s) { c.moveTo(0, y); c.lineTo(W, y); } c.stroke();
  if (th.crystals) for (let i = 0; i < 14; i++) { const x = r() * W, y = r() * H, k = s * (0.2 + r() * 0.3); c.fillStyle = th.line + '33'; c.beginPath(); c.moveTo(x, y - k); c.lineTo(x + k * 0.5, y); c.lineTo(x, y + k); c.lineTo(x - k * 0.5, y); c.fill(); }
  // 조명 웅덩이 (입체감) + 가장자리 그림자
  for (let i = 0; i < 5; i++) glow(c, r() * W, r() * H, Math.max(W, H) * (0.15 + r() * 0.15), th.light, 0.08);
  const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, '#00000000'); v.addColorStop(1, '#000000aa'); c.fillStyle = v; c.fillRect(0, 0, W, H);
}
function groundSide(c, W, H, gy, th, tn, r) {
  const near = tone(th.floor[0], tn), farc = tone(th.floor[1], tn);
  if (gy >= H - 2) return;
  if (th.water) { c.fillStyle = vgrad(c, 0, gy, 0, H, farc, mix(near, '#000000', 0.4)); c.fillRect(0, gy, W, H - gy); c.strokeStyle = '#ffffff22'; c.lineWidth = 2; for (let y = gy + 10; y < H; y += (y - gy) * 0.25 + 8) { c.beginPath(); for (let x = 0; x <= W; x += 30) c.lineTo(x, y + Math.sin(x / 40 + y) * 2); c.stroke(); } return; }
  c.fillStyle = vgrad(c, 0, gy, 0, H, near, farc); c.fillRect(0, gy, W, H - gy);
  c.fillStyle = '#ffffff22'; c.fillRect(0, gy, W, Math.max(2, (H - gy) * 0.04));
  for (let i = 0; i < 40; i++) { c.fillStyle = '#00000018'; c.fillRect(r() * W, gy + r() * (H - gy), 2 + r() * 6, 2); }
}

// ---------------- 정적인 층 캐시 ----------------
const cache = new Map();
function staticLayer(W, H, id, sc, tn) {
  const key = `${id}|${sc.t}|${W}x${H}|${tn}`; if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
  const th = T[sc.t] || T.arcade; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const r = rnd(id.length * 977 + sc.t.length * 31);
  const hy = sc.view === 'persp' ? H * (sc.h ?? 0.4) : sc.view === 'side' ? H * (sc.ground ?? 0.8) : 0;
  if (sc.view !== 'top') {
    c.fillStyle = vgrad(c, 0, 0, 0, hy || H, tone(th.sky[0], tn), tone(th.sky[1], tn)); c.fillRect(0, 0, W, hy || H);
    if (th.stars) for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; c.fillRect(r() * W, r() * (hy || H) * 0.9, 1.5, 1.5); }
    if (th.sun) glow(c, W * 0.82, (hy || H) * 0.22, (hy || H) * 0.6, '#fff6c8', tn === 'pro' ? 0.25 : 0.5);
    if (th.flood) for (const fx of [0.12, 0.88]) glow(c, W * fx, (hy || H) * 0.2, W * 0.35, '#e8f2ff', 0.28);
    if (th.far && hy > H * 0.08) far(c, W, hy, th.far, th, tn, r);
    if (sc.view === 'persp') floorPersp(c, W, H, hy, th, tn, sc); else groundSide(c, W, H, hy, th, tn, r);
    // 위쪽 조명 + 가장자리 그림자 (빛과 그림자)
    glow(c, W / 2, -H * 0.1, H * 0.9, th.light, 0.12);
    const v = c.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.8); v.addColorStop(0, '#00000000'); v.addColorStop(1, tn === 'kid' ? '#00000044' : '#00000099'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  } else floorTop(c, W, H, th, tn, r);
  cache.set(key, cv); while (cache.size > 6) cache.delete(cache.keys().next().value); // 메모리: 최근 6장만
  return cv;
}

// ---------------- 움직이는 층 (가벼움 화질이면 생략) ----------------
const parts = new Map();
function motion(c, W, H, id, sc, t) {
  const th = T[sc.t] || T.arcade; const hy = sc.view === 'persp' ? H * (sc.h ?? 0.4) : sc.view === 'side' ? H * (sc.ground ?? 0.8) : H;
  if (th.beams || th.flood) { // 무대·경기장 조명 빛줄기가 천천히 흔들림
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const a = Math.sin(t * 0.5 + i * 2.1) * 0.35; const x = W * (0.2 + i * 0.3); c.save(); c.translate(x, -10); c.rotate(a); const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.light + '30'); g.addColorStop(1, th.light + '00'); c.fillStyle = g; c.beginPath(); c.moveTo(-W * 0.02, 0); c.lineTo(W * 0.02, 0); c.lineTo(W * 0.12, H); c.lineTo(-W * 0.12, H); c.fill(); c.restore(); }
    c.restore();
  }
  if (th.far === 'clouds' || th.sun) { c.save(); c.globalAlpha = 0.25; c.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) { const x = ((t * 12 + i * W / 2.5) % (W + 300)) - 150, y = hy * (0.2 + i * 0.15); c.beginPath(); c.ellipse(x, y, W * 0.07, hy * 0.035, 0, 0, 7); c.fill(); } c.restore(); }
  // 떠다니는 입자 (먼지·불씨·별빛·눈) — 몇 개만
  let P = parts.get(id); if (!P) { const r = rnd(id.length * 13 + 7); P = Array.from({ length: 18 }, () => [r(), r(), 0.3 + r() * 0.7]); parts.set(id, P); }
  const col = th.embers ? '#ffb347' : sc.t === 'zombie' ? '#3fb950' : sc.t === 'ice' ? '#ffffff' : th.stars ? '#cfe0ff' : th.light;
  c.save(); for (const p of P) { const x = ((p[0] * W + t * 8 * p[2]) % W), y = ((p[1] * H - t * (th.embers ? 30 : 10) * p[2]) % H + H) % H; c.globalAlpha = 0.25 + 0.35 * Math.sin(t * 2 + p[0] * 9) ** 2; c.fillStyle = col; c.fillRect(x, y, 2 * p[2] + 1, 2 * p[2] + 1); } c.restore();
  if (sc.t === 'zombie') { const a = 0.08 + 0.06 * Math.sin(t * 3); c.fillStyle = `rgba(255,30,50,${a})`; c.fillRect(0, 0, W, H); } // 비상등 같은 붉은 깜빡임 (긴장감)
  if (th.bolts && Math.sin(t * 1.3) > 0.985) { c.fillStyle = '#ffffff22'; c.fillRect(0, 0, W, H); }
}

// 게임 화면 배경: 매 프레임 호출 (정적 층 붙이기 + 가벼운 움직임)
// opts: { tone: 'kid'|'base'|'pro', pe: 체육 게임 정보 }
export function paint(c, W, H, id, t = performance.now() / 1000, opts = {}) {
  measure(performance.now());
  const sc = sceneOf(id, opts.pe); const tn = opts.tone || 'base';
  c.drawImage(staticLayer(W, H, id, sc, tn), 0, 0);
  if (Q === 'high') motion(c, W, H, id, sc, t);
  return sc;
}
// 화면 뒤에 까는 배경 캔버스 (안내·결과 화면용): 크기에 맞춰 그림. 움직임은 화질 '높음'에서만, 초당 30번까지
export function backdrop(cv, id, opts = {}) {
  let raf = 0, lastT = 0; const draw = (now) => {
    raf = requestAnimationFrame(draw); measure(now); /* 매 프레임 잼 (30fps 제한 전에) */ if (now - lastT < 33) return; lastT = now;
    const r = cv.getBoundingClientRect(); const d = Math.min(1.5, devicePixelRatio || 1) * (Q === 'low' ? 0.6 : 1); const W = Math.max(2, Math.round(r.width * d)), H = Math.max(2, Math.round(r.height * d));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d'); paint(c, W, H, id, now / 1000, opts);
    if (Q === 'low' || opts.still) { cancelAnimationFrame(raf); raf = 0; } // 가벼움·게임 중: 한 번만 그리고 멈춤 (게임 화면이 덮으므로)
  };
  raf = requestAnimationFrame(draw);
  return { stop() { cancelAnimationFrame(raf); raf = 0; } };
}
export const toneOf = (mode) => (['baby', 'kid'].includes(mode) ? 'kid' : ['high', 'adult'].includes(mode) ? 'pro' : 'base');
// 게임 고르기 화면용 작은 장면 그림 (한 번 그려서 그림 주소로)
const thumbs = new Map();
export function thumb(id, pe, w = 240, h = 135) { const k = `${id}|${w}`; if (thumbs.has(k)) return thumbs.get(k); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); c.drawImage(staticLayer(w, h, id, sceneOf(id, pe), 'base'), 0, 0); const u = cv.toDataURL('image/jpeg', 0.8); thumbs.set(k, u); return u; }

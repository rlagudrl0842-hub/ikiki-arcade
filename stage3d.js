// 🎬 버튼·문제 위주 게임 14개의 3D 무대 배경 (골든벨·텔레파시·소수결·하이로우·그림·틀린그림·함성·버티기·리듬·한마음·버거·릴레이·폭탄·보스)
// 버튼·문제·점수 화면은 그대로 두고 '그 뒤'에만 그림 → 누르는 위치·판정에 전혀 영향 없음
// 게임 소리 신호(good·bad·win…)에 맞춰 조명·관중이 짧게 반응 · 카메라는 아주 천천히만 흔들림(어지럽지 않게)
import { base, lam, tex, person } from './g3d.js';

const THEME = { bell: 'quiz', tele: 'quiz', mino: 'quiz', hilo: 'quiz', rhythm: 'concert', sync: 'concert', shout: 'cheer', hold: 'cheer', burger: 'kitchen', draw: 'art', spot: 'art', relay: 'track', bombpass: 'bomb', boss: 'castle' };
export const STAGE_GAMES = Object.keys(THEME);

export function createStage3D(canvas, { game, quality = 'high', onSlow } = {}) {
  const B = base(canvas, { quality: 'mid', onSlow, fov: 55, slowMs: 75 }); // 초당 30번만 그리므로 간격 기준은 넉넉히 (대신 그리는 시간 자체를 play.js에서 잼) if (!B) return null; // 배경이라 그림자·고해상도는 끔 (가볍게)
  const { THREE, scene, cam } = B; const kind = THEME[game] || 'quiz';
  const o3 = new THREE.Object3D(); const col = new THREE.Color();
  const lights = []; // 반응할 때 색이 바뀌는 조명
  let crowd = null, crowdBase = []; // 들썩이는 관중
  const spin = []; // 천천히 도는 물체
  const add = (m, x, y, z) => { m.position.set(x, y, z); scene.add(m); return m; };
  const glowM = (c) => new THREE.MeshBasicMaterial({ color: c });
  // 관중석 (공용) — 줄 수·폭·위치
  function audience(rows, perRow, z0, y0, w) {
    const fanCols = ['#ff4d6d', '#3d8bff', '#ffd43b', '#2fd27a', '#ffffff', '#b197fc', '#ff9f43'];
    crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.18, 0.3, 3, 6), lam({ color: '#fff' }), rows * perRow); let i = 0;
    for (let r = 0; r < rows; r++) { const st = add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 0.9), lam({ color: '#242a4a' })), 0, y0 + r * 0.5 - 0.25, z0 - r * 0.9); st.userData = 1; for (let k = 0; k < perRow; k++) { const x = -w / 2 + 0.4 + k * ((w - 0.8) / (perRow - 1)); o3.position.set(x, y0 + r * 0.5 + 0.35, z0 - r * 0.9); o3.updateMatrix(); crowd.setMatrixAt(i, o3.matrix); crowd.setColorAt(i, col.set(fanCols[(i * 7 + r) % fanCols.length])); crowdBase.push([x, y0 + r * 0.5 + 0.35, z0 - r * 0.9, Math.random() * 6]); i++; } }
    scene.add(crowd);
  }
  function spot(color, x, z) { const l = new THREE.SpotLight(color, 60, 30, 0.45, 0.5, 1.2); l.position.set(x, 9, z); l.target.position.set(x * 0.3, 0, 0); scene.add(l, l.target); lights.push({ l, base: new THREE.Color(color), I: 60 }); return l; }
  function beam(color, x, z) { const m = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })); m.position.set(x, 4.5, z); scene.add(m); spin.push({ m, sway: 0.3, ph: Math.random() * 6, beam: true }); return m; }
  scene.add(new THREE.HemisphereLight('#c8d4ff', '#1a1a2a', 0.7));

  if (kind === 'quiz') { // 퀴즈쇼 스튜디오: 반짝이는 바닥 · 빛 기둥 · 큰 전광판 · 관객석
    scene.background = new THREE.Color('#0a0c24'); scene.fog = new THREE.Fog('#0a0c24', 14, 34);
    add(new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshPhongMaterial({ color: '#1a2050', shininess: 120, specular: '#6a7aff' })), 0, 0, -4).rotation.x = -Math.PI / 2;
    for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.TorusGeometry(3 + i * 2, 0.05, 6, 64), glowM(['#22e1ff', '#b06bff', '#ffd43b'][i])), 0, 0.02, -4).rotation.x = Math.PI / 2;
    const screen = add(new THREE.Mesh(new THREE.BoxGeometry(8, 4.2, 0.3), new THREE.MeshBasicMaterial({ map: tex(256, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1b2a8a'); g.addColorStop(1, '#5a1b8a'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd43b'; c.font = '900 90px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', w / 2, h / 2 + 6); c.strokeStyle = '#22e1ff'; c.lineWidth = 6; c.strokeRect(4, 4, w - 8, h - 8); }) })), 0, 4.5, -12);
    for (const x of [-6, -3.5, 3.5, 6]) { const p = add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 12), new THREE.MeshBasicMaterial({ color: x < 0 ? '#22e1ff' : '#ff4dc4' })), x, 3.5, -9); spin.push({ m: p, pulse: true, ph: x }); }
    audience(3, 18, 5.5, 0.3, 16); for (const [c, x] of [['#22e1ff', -5], ['#ff4dc4', 5], ['#ffd43b', 0]]) { spot(c, x, -2); beam(c, x, -6); }
    screen.userData.isScreen = true;
  } else if (kind === 'concert') { // 콘서트 무대: 스피커가 박자에 맞춰 쿵쿵 · 트러스 조명
    scene.background = new THREE.Color('#08061a'); scene.fog = new THREE.Fog('#08061a', 14, 36);
    add(new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 6), new THREE.MeshPhongMaterial({ color: '#1c1830', shininess: 80 })), 0, 0.3, -8);
    for (const x of [-6, 6]) for (const y of [1.6, 3.4]) { const s = add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.7, 1.2), lam({ color: '#1a1a22' })), x, y, -8); const cone = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshPhongMaterial({ color: '#3a3a4a', shininess: 60 })); cone.position.set(0, 0, 0.61); s.add(cone); spin.push({ m: cone, speaker: true }); }
    const truss = lam({ color: '#8a8fa0' }); add(new THREE.Mesh(new THREE.BoxGeometry(15, 0.3, 0.3), truss), 0, 7, -7); for (const x of [-7.3, 7.3]) add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 0.3), truss), x, 3.5, -7);
    for (let i = 0; i < 6; i++) { const c = ['#ff4d6d', '#22e1ff', '#ffd43b', '#2fd27a', '#b06bff', '#ff9f43'][i]; const x = -6 + i * 2.4; beam(c, x, -7); spot(c, x, -6); }
    const band = person('#ff4d6d', false); band.position.set(0, 0.6, -8); scene.add(band); spin.push({ m: band, dance: true });
    audience(4, 20, 4, 0, 16);
  } else if (kind === 'cheer') { // 경기장 응원석: 소리·버티기에 맞춰 관중이 들썩 · 깃발
    scene.background = tex(4, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1030'); g.addColorStop(1, '#2a3570'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); scene.fog = new THREE.Fog('#141c40', 16, 40);
    add(new THREE.Mesh(new THREE.PlaneGeometry(40, 20), lam({ color: '#2f8a3a' })), 0, 0, -2).rotation.x = -Math.PI / 2;
    crowdBase = []; const fanCols = ['#ff4d6d', '#3d8bff', '#ffd43b', '#2fd27a', '#ffffff']; const rows = 7, per = 26; crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.32, 3, 6), lam({ color: '#fff' }), rows * per); let i = 0;
    for (let r = 0; r < rows; r++) { add(new THREE.Mesh(new THREE.BoxGeometry(24, 0.6, 1), lam({ color: '#262c52' })), 0, 0.3 + r * 0.6, -8 - r); for (let k = 0; k < per; k++) { const x = -11.5 + k * 0.92; o3.position.set(x, 0.95 + r * 0.6, -8 - r); o3.updateMatrix(); crowd.setMatrixAt(i, o3.matrix); crowd.setColorAt(i, col.set(fanCols[(Math.floor(k / 5) + r) % fanCols.length])); crowdBase.push([x, 0.95 + r * 0.6, -8 - r, Math.random() * 6]); i++; } }
    scene.add(crowd);
    for (const x of [-8, 0, 8]) { const f = add(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2, 6, 1), lam({ color: ['#ff4d6d', '#ffd43b', '#3d8bff'][(x + 8) / 8], side: THREE.DoubleSide })), x, 7, -14); spin.push({ m: f, flag: true, base: Float32Array.from(f.geometry.attributes.position.array) }); }
    for (const x of [-12, 12]) { const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 14, 6), lam({ color: '#3a3f52' })), x, 7, -10); const lamp = add(new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 0.3), glowM('#fffbe6')), x, 14, -10); }
    spot('#ffffff', -6, 2); spot('#ffffff', 6, 2);
  } else if (kind === 'kitchen') { // 주방: 철판(지글지글 빛) · 선반 · 냄비
    scene.background = new THREE.Color('#2a1c14'); scene.fog = new THREE.Fog('#2a1c14', 12, 30);
    add(new THREE.Mesh(new THREE.PlaneGeometry(30, 12), lam({ map: tex(64, 64, (c, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = (x + y) % 2 ? '#e8e2d6' : '#cfc6b6'; c.fillRect(x * 8, y * 8, 8, 8); } }, [8, 3]) })), 0, 5, -12);
    add(new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 3), lam({ color: '#8a8f99' })), 0, 0.8, -6);
    const plate = add(new THREE.Mesh(new THREE.BoxGeometry(6, 0.15, 2.2), new THREE.MeshPhongMaterial({ color: '#2a2a30', emissive: '#5a1a00', shininess: 90 })), 0, 1.68, -6); spin.push({ m: plate, sizzle: true });
    for (const x of [-4, 4]) { const pot = add(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.6, 0.9, 16), new THREE.MeshPhongMaterial({ color: '#c0c6d6', shininess: 120 })), x, 2.2, -6.3); }
    for (const y of [4, 5.6]) { add(new THREE.Mesh(new THREE.BoxGeometry(10, 0.15, 0.8), lam({ color: '#7a4a2a' })), 0, y, -11); for (let k = 0; k < 8; k++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.7, 10), lam({ color: ['#e5354d', '#ffd43b', '#2fd27a', '#ff9f43'][k % 4] })), -4.2 + k * 1.2, y + 0.45, -11); }
    const steam = []; for (let k = 0; k < 10; k++) { const s = add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false })), (Math.random() - 0.5) * 5, 2, -6); spin.push({ m: s, steam: true, ph: Math.random() * 3 }); }
    spot('#ffd9a0', 0, -2);
  } else if (kind === 'art') { // 미술실: 이젤 · 벽 액자 · 물감 얼룩
    scene.background = new THREE.Color('#2a2440'); scene.fog = new THREE.Fog('#2a2440', 12, 30);
    add(new THREE.Mesh(new THREE.PlaneGeometry(30, 14), lam({ color: '#efe6d6' })), 0, 6, -12);
    add(new THREE.Mesh(new THREE.PlaneGeometry(30, 20), lam({ map: tex(64, 64, (c, w, h) => { c.fillStyle = '#b08a5a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#a07a4a' : '#b8925f'; c.fillRect(0, i * 8, w, 7); } }, [6, 6]) })), 0, 0, -4).rotation.x = -Math.PI / 2;
    const cols = ['#ff4d6d', '#3d8bff', '#ffd43b', '#2fd27a', '#b06bff'];
    for (let i = 0; i < 5; i++) { const fr = add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 0.12), lam({ color: '#6a4a2a' })), -8 + i * 4, 6 + (i % 2) * 0.8, -11.9); const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.3), new THREE.MeshBasicMaterial({ map: tex(64, 48, (c, w, h) => { c.fillStyle = '#fffaf0'; c.fillRect(0, 0, w, h); for (let k = 0; k < 5; k++) { c.fillStyle = cols[(i + k) % 5]; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 5 + Math.random() * 10, 0, 7); c.fill(); } }) })); pic.position.z = 0.07; fr.add(pic); }
    for (const x of [-5, 5]) { const e = new THREE.Group(); const legM = lam({ color: '#8a5a34' }); for (const a of [-0.25, 0.25]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4, 0.1), legM); l.position.set(a * 3, 2, 0); l.rotation.z = -a * 0.5; e.add(l); } const cv = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 0.08), lam({ color: '#ffffff' })); cv.position.set(0, 2.8, 0.15); e.add(cv); e.position.set(x, 0, -7); e.rotation.y = -x * 0.05; scene.add(e); spin.push({ m: e, easel: true, ph: x }); }
    for (let k = 0; k < 12; k++) { const s = add(new THREE.Mesh(new THREE.CircleGeometry(0.2 + Math.random() * 0.4, 12), lam({ color: cols[k % 5] })), (Math.random() - 0.5) * 16, 0.02, -2 - Math.random() * 8); s.rotation.x = -Math.PI / 2; }
    spot('#fff4e0', 0, -1);
  } else if (kind === 'track') { // 릴레이 트랙: 레인 · 바통 주자들이 멀리서 달림
    scene.background = tex(4, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3a7ad8'); g.addColorStop(1, '#cfe6ff'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); scene.fog = new THREE.Fog('#cfe0f0', 18, 50);
    add(new THREE.Mesh(new THREE.PlaneGeometry(60, 40), lam({ color: '#3f8a3a' })), 0, -0.01, -10).rotation.x = -Math.PI / 2;
    const tr = add(new THREE.Mesh(new THREE.PlaneGeometry(40, 6), lam({ map: tex(256, 64, (c, w, h) => { c.fillStyle = '#b5482f'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4efe6'; for (let i = 0; i <= 4; i++) c.fillRect(0, i * h / 4 - 1, w, 2); }) })), 0, 0, -8); tr.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 4; i++) { const p = person(['#ff4d6d', '#3d8bff', '#ffd43b', '#2fd27a'][i], false); p.position.set(-10 + i * 0.5, 0, -6.5 - i * 1.5); p.rotation.y = Math.PI / 2; scene.add(p); spin.push({ m: p, runner: true, lane: i }); }
    audience(3, 22, -14, 0.3, 30); scene.add(new THREE.DirectionalLight('#fff3d6', 1.6));
  } else if (kind === 'bomb') { // 폭탄 공장: 상자 더미 · 회전 경고등
    scene.background = new THREE.Color('#14161c'); scene.fog = new THREE.Fog('#14161c', 12, 30);
    add(new THREE.Mesh(new THREE.PlaneGeometry(40, 30), lam({ color: '#2b2f36' })), 0, 0, -8).rotation.x = -Math.PI / 2;
    const crateM = lam({ map: tex(64, 64, (c, w, h) => { c.fillStyle = '#9a6a3a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#6a4420'; c.lineWidth = 5; c.strokeRect(3, 3, w - 6, h - 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.stroke(); }) });
    for (let i = 0; i < 14; i++) add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), crateM), (i % 2 ? 1 : -1) * (4 + Math.random() * 5), 0.7 + (i % 3 === 0 ? 1.4 : 0), -6 - Math.random() * 8);
    const stripe = tex(64, 16, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffd43b' : '#111'; c.beginPath(); c.moveTo(i * 8, 0); c.lineTo(i * 8 + 8, 0); c.lineTo(i * 8, h); c.lineTo(i * 8 - 8, h); c.fill(); } }, [6, 1]);
    add(new THREE.Mesh(new THREE.BoxGeometry(24, 0.6, 0.2), lam({ map: stripe })), 0, 3.5, -13);
    for (const x of [-6, 6]) { const bc = add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 12), glowM('#ff2a3a')), x, 4.2, -12); const l = new THREE.SpotLight('#ff2a3a', 80, 25, 0.5, 0.5, 1.2); l.position.set(x, 4.2, -12); scene.add(l, l.target); spin.push({ m: l, beacon: true, x }); }
    const bomb = add(new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 14), new THREE.MeshPhongMaterial({ color: '#22242c', shininess: 120 })), 0, 1.2, -9); const fz = add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), glowM('#ffd84a')), 0.6, 2.5, -9); spin.push({ m: fz, spark: true });
    spot('#ffffff', 0, -3);
  } else { // castle 보스 레이드: 밤 성벽 · 횃불 · 성 위로 솟은 거대한 그림자 괴물(눈이 빛남)
    scene.background = tex(4, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a0614'); g.addColorStop(1, '#3a1a2a'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); scene.fog = new THREE.Fog('#2a1424', 14, 36);
    add(new THREE.Mesh(new THREE.PlaneGeometry(40, 30), lam({ color: '#3a3440' })), 0, 0, -8).rotation.x = -Math.PI / 2;
    const stoneM = lam({ color: '#4a4452' }); add(new THREE.Mesh(new THREE.BoxGeometry(26, 5, 1.5), stoneM), 0, 2.5, -13); for (let i = 0; i < 13; i++) add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1.5), stoneM), -12 + i * 2, 5.5, -13);
    for (const x of [-11, 11]) add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 9, 10), stoneM), x, 4.5, -13);
    const boss = new THREE.Group(); const bm = lam({ color: '#1a1020' }); const body = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 14), bm); body.scale.set(1.3, 1, 0.8); boss.add(body); for (const s of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.4, 8), bm); horn.position.set(s * 2.4, 3.6, 0); horn.rotation.z = -s * 0.5; boss.add(horn); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), glowM('#ff3040')); eye.position.set(s * 1.3, 1, 3); boss.add(eye); }
    boss.position.set(0, 6, -20); scene.add(boss); spin.push({ m: boss, boss: true });
    for (const x of [-7, -2.5, 2.5, 7]) { add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 6), lam({ color: '#5a3a2a' })), x, 5.6, -12); const fl = add(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), glowM('#ffb347')), x, 6.7, -12); const pl = new THREE.PointLight('#ff9a3a', 8, 10, 1.6); pl.position.set(x, 6.8, -11.5); scene.add(pl); spin.push({ m: fl, flame: true, ph: x, light: pl }); }
    spot('#ff6a5a', 0, -4);
  }

  let flashT = 9, flashCol = new THREE.Color('#ffffff'), cheerT = 9;
  // 게임 소리 신호에 반응: good·pass(초록) · win(금색+관중 환호) · bad·boom(빨강)
  function react(n) {
    if (n === 'good' || n === 'pass') { flashCol.set('#2fd27a'); flashT = 0; cheerT = 0; }
    else if (n === 'win' || n === 'fanfare') { flashCol.set('#ffd43b'); flashT = 0; cheerT = -0.6; }
    else if (n === 'bad' || n === 'boom') { flashCol.set('#ff3b4f'); flashT = 0; }
    else if (n === 'tap' || n === 'tick') { cheerT = Math.min(cheerT, 0.4); }
  }
  // st: { t, level: 0~1 (함성 크기 등, 없으면 0) }
  function render(st) {
    const dt = B.frame(); if (dt == null) return false; const t = st.t;
    flashT += dt; cheerT += dt; const fk = Math.max(0, 1 - flashT / 0.5);
    for (const L of lights) { L.l.color.copy(L.base).lerp(flashCol, fk * 0.8); L.l.intensity = L.I * (1 + fk * 0.8); }
    if (crowd) { const jump = Math.max(0, 1 - Math.max(0, cheerT) / 0.8) + (st.level || 0) * 0.6; for (let i = 0; i < crowdBase.length; i++) { const [x, y, z, ph] = crowdBase[i]; o3.position.set(x, y + Math.max(0, Math.sin(t * 6 + ph)) * 0.12 * (0.3 + jump), z); o3.updateMatrix(); crowd.setMatrixAt(i, o3.matrix); } crowd.instanceMatrix.needsUpdate = true; }
    for (const s of spin) {
      if (s.beam) s.m.rotation.z = Math.sin(t * 0.6 + s.ph) * s.sway;
      else if (s.pulse) s.m.material.color.setHSL(((t * 0.05 + s.ph * 0.1) % 1 + 1) % 1, 0.9, 0.6);
      else if (s.speaker) { const k = 1 + Math.max(0, Math.sin(t * 8)) * 0.12; s.m.scale.set(k, k, 1); }
      else if (s.dance) { s.m.position.y = 0.6 + Math.abs(Math.sin(t * 4)) * 0.2; s.m.userData.armL.rotation.z = -1.5 - Math.sin(t * 8) * 0.6; s.m.userData.armR.rotation.z = 1.5 + Math.sin(t * 8) * 0.6; }
      else if (s.flag) { const a = s.m.geometry.attributes.position; for (let i = 0; i < a.count; i++) { const x0 = s.base[i * 3]; a.array[i * 3 + 2] = Math.sin(t * 5 + x0 * 3) * 0.15 * (x0 + 1.1); } a.needsUpdate = true; }
      else if (s.sizzle) s.m.material.emissive.setRGB(0.3 + Math.sin(t * 10) * 0.08 + fk * 0.3, 0.08, 0);
      else if (s.steam) { s.ph += dt; const k = s.ph % 3 / 3; s.m.position.y = 2 + k * 3; s.m.material.opacity = 0.25 * (1 - k); s.m.scale.setScalar(1 + k * 2); }
      else if (s.easel) s.m.rotation.y = Math.sin(t * 0.4 + s.ph) * 0.05;
      else if (s.runner) { const x = ((t * (2.2 + s.lane * 0.2) + s.lane * 3) % 28) - 14; s.m.position.x = x; const ph = t * 12 + s.lane; const U = s.m.userData; U.legL.rotation.x = Math.sin(ph) * 0.9; U.legR.rotation.x = -Math.sin(ph) * 0.9; U.armL.rotation.x = -Math.sin(ph) * 0.8; U.armR.rotation.x = Math.sin(ph) * 0.8; }
      else if (s.beacon) { s.m.target.position.set(s.x + Math.cos(t * 4) * 6, 0, -12 + Math.sin(t * 4) * 6); }
      else if (s.spark) s.m.scale.setScalar(0.8 + Math.random() * 0.6);
      else if (s.boss) { s.m.position.y = 6 + Math.sin(t * 0.8) * 0.3; s.m.rotation.z = Math.sin(t * 0.5) * 0.05; }
      else if (s.flame) { const k = 0.8 + Math.sin(t * 15 + s.ph) * 0.2; s.m.scale.set(k, k, k); s.light.intensity = 6 + k * 4; }
    }
    // 카메라: 아주 천천히 좌우로만 (멀미 안 나게)
    cam.position.set(Math.sin(t * 0.15) * 0.8, 3.2, 9); cam.lookAt(0, 2.6, -8);
    B.draw(); return true;
  }
  return { render, react, dispose: () => B.dispose() };
}

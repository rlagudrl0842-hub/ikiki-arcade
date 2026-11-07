// 🏟️ 경기장 게임 3D 화면 (번개 피하기 · 땅따먹기 페인트 · 보석 대작전 · 왕관 쟁탈전)
// 규칙·이동은 play-n.js arenaGame 그대로 (조이스틱/기울이기 → 서버). 서버가 보낸 내 위치·경기장 상태(v)를 비스듬히 내려다보는 3D로 그림
// 경기장 좌표 1600×860 → 바닥 16m×8.6m
import { base, lam, tex, person } from './g3d.js';

const AW = 1600, AH = 860, KW = 16, KH = 8.6;
const wx = (x) => (x / AW - 0.5) * KW, wz = (y) => (y / AH - 0.5) * KH;

const THEME = {
  dodge: { bg: '#0b1030', floor: '#1d2650', line: '#ffd43b', fog: '#141a40', sky: true },
  paint: { bg: '#1c1636', floor: '#e9e4f2', line: '#b9b0d0', fog: '#2a2050' },
  gems: { bg: '#0c0a24', floor: '#2a2350', line: '#7cf3ff', fog: '#1a1440' },
  crown: { bg: '#1a0f24', floor: '#3a2a3a', line: '#ffd43b', fog: '#2a1830' },
};

export function createArena3D(canvas, { kind = 'dodge', color = '#ff4d6d', teamColor = () => '#888', quality = 'high', onSlow } = {}) {
  const B = base(canvas, { quality, onSlow, fov: 42 }); if (!B) return null;
  const { THREE, scene, cam, hi } = B; const th = THEME[kind] || THEME.dodge;
  scene.background = new THREE.Color(th.bg); scene.fog = new THREE.Fog(th.fog, 22, 45);
  scene.add(new THREE.HemisphereLight('#dfe6ff', '#2a2a3a', 1.0));
  const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(-5, 14, 8); scene.add(key, key.target);
  if (hi) { key.castShadow = true; key.shadow.mapSize.set(512, 512); Object.assign(key.shadow.camera, { left: -10, right: 10, top: 7, bottom: -7, near: 1, far: 40 }); }
  // 바닥 (격자 무늬) + 낮은 펜스 + 바깥 관중석
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(KW, KH), new THREE.MeshPhongMaterial({ shininess: 40, map: tex(256, 138, (c, w, h) => { c.fillStyle = th.floor; c.fillRect(0, 0, w, h); c.strokeStyle = th.line + '33'; c.lineWidth = 1; for (let x = 0; x <= 16; x++) { c.beginPath(); c.moveTo(x * w / 16, 0); c.lineTo(x * w / 16, h); c.stroke(); } for (let y = 0; y <= 9; y++) { c.beginPath(); c.moveTo(0, y * h / 8.6); c.lineTo(w, y * h / 8.6); c.stroke(); } }) }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), lam({ color: '#0e1228' })); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; scene.add(outer);
  const fenceM = lam({ color: th.line }); for (const [w, d, x, z] of [[KW + 0.3, 0.15, 0, -KH / 2], [KW + 0.3, 0.15, 0, KH / 2], [0.15, KH, -KW / 2, 0], [0.15, KH, KW / 2, 0]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), fenceM); f.position.set(x, 0.17, z); scene.add(f); }
  const fanCols = ['#ff4d6d', '#3d8bff', '#ffd43b', '#2fd27a', '#ffffff', '#b197fc']; const o3 = new THREE.Object3D(); const col = new THREE.Color();
  const fans = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.45, 0.3), lam({ color: '#fff' }), 4 * 40); let fi = 0; const standM = lam({ color: '#262c50' });
  for (let r = 0; r < 4; r++) { const st = new THREE.Mesh(new THREE.BoxGeometry(KW + 6, 0.6, 1), standM); st.position.set(0, 0.3 + r * 0.6, -KH / 2 - 1.5 - r); scene.add(st); for (let k = 0; k < 40; k++) { o3.position.set(-KW / 2 - 2 + k * 0.5 + Math.random() * 0.1, 0.8 + r * 0.6, -KH / 2 - 1.5 - r); o3.updateMatrix(); fans.setMatrixAt(fi, o3.matrix); fans.setColorAt(fi++, col.set(fanCols[(Math.random() * fanCols.length) | 0])); } }
  scene.add(fans);

  // 나 (팀 색 선수) + 바닥 표시 고리
  const me = person(color, hi); me.scale.setScalar(1.15); scene.add(me); const U = me.userData;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; scene.add(ring);
  let face = 0;

  // 종류별 물체
  const warnPool = [], boomPool = [], gemPool = []; let tiles = null, tilesN = 0, zone = null, crown = null;
  const warnM = () => new THREE.MeshBasicMaterial({ color: '#ffd43b', transparent: true, opacity: 0.35, depthWrite: false });
  if (kind === 'crown') {
    zone = new THREE.Group(); const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#ffd43b', transparent: true, opacity: 0.25, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.03; const edge = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 6, 48), new THREE.MeshBasicMaterial({ color: '#ffd43b' })); edge.rotation.x = Math.PI / 2; edge.position.y = 0.05; zone.add(disc, edge); scene.add(zone);
    crown = new THREE.Group(); const gold = new THREE.MeshPhongMaterial({ color: '#ffd43b', emissive: '#6a4a00', shininess: 120 }); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 20, 1, true), gold); crown.add(band); for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), gold); const a = (i / 5) * Math.PI * 2; sp.position.set(Math.cos(a) * 0.42, 0.3, Math.sin(a) * 0.42); crown.add(sp); const jw = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), lam({ color: ['#ff4d6d', '#3d8bff', '#2fd27a'][i % 3] })); jw.position.set(Math.cos(a) * 0.46, 0.02, Math.sin(a) * 0.46); crown.add(jw); } scene.add(crown);
  }
  const gemGeo = new THREE.OctahedronGeometry(0.3); const gemM = { 1: new THREE.MeshPhongMaterial({ color: '#b06bff', shininess: 120, emissive: '#2a0a4a' }), 2: new THREE.MeshPhongMaterial({ color: '#7cf3ff', shininess: 120, emissive: '#0a3a4a' }), 5: new THREE.MeshPhongMaterial({ color: '#ffd43b', shininess: 140, emissive: '#5a4000' }) };
  const boltM = new THREE.MeshBasicMaterial({ color: '#fffbe0', transparent: true, opacity: 0.9 });

  // v: 서버 상태 · vec: 지금 조이스틱 방향 · age: 상태 받은 뒤 지난 초 · grid: 페인트 칸
  function render({ v, vec, age, grid, t }) {
    const dt = B.frame(); if (dt == null) return null;
    // 내 위치 (서버 위치 + 지금 방향으로 살짝 예측 — 2D와 같은 계산)
    const still = v.dead || v.stun; const a = Math.min(0.25, age);
    const mx = v.x + (still ? 0 : vec[0] * 330 * a), my = v.y + (still ? 0 : vec[1] * 330 * a);
    const moving = !still && Math.hypot(vec[0], vec[1]) > 0.15;
    if (moving) { const target = Math.atan2(vec[0], vec[1]); let d = target - face; d = Math.atan2(Math.sin(d), Math.cos(d)); face += d * Math.min(1, dt * 12); }
    me.position.set(wx(mx), 0, wz(my)); me.rotation.set(v.dead ? -Math.PI / 2 : 0, face, 0); if (v.dead) me.position.y = 0.2;
    const ph = moving ? t * 12 : 0; U.legL.rotation.x = Math.sin(ph) * 0.8; U.legR.rotation.x = -Math.sin(ph) * 0.8; U.armL.rotation.x = -Math.sin(ph) * 0.7; U.armR.rotation.x = Math.sin(ph) * 0.7;
    if (v.stun) me.rotation.y = t * 10;
    ring.position.set(me.position.x, 0.02, me.position.z); const pulse = 1 + 0.15 * Math.sin(t * 6); ring.scale.set(pulse, pulse, 1);
    // 번개: 노란 경고 원(점점 진해짐) → 내리치면 빛기둥
    if (kind === 'dodge') {
      const W = v.warn || []; while (warnPool.length < W.length) { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), warnM()); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; scene.add(m); warnPool.push(m); }
      warnPool.forEach((m, i) => { const w = W[i]; m.visible = !!w; if (!w) return; const [x, y, r, tt] = w; const k = Math.max(0, tt - age); m.position.set(wx(x), 0.03, wz(y)); const s = (r / AW) * KW; m.scale.set(s, s, 1); m.material.opacity = 0.2 + 0.45 * (1 - Math.min(1, k / 1.5)) + (k < 0.4 ? Math.sin(t * 30) * 0.15 : 0); });
      const Bm = v.boom || []; while (boomPool.length < Bm.length) { const g = new THREE.Group(); const col2 = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 8, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#fff6c0', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); col2.position.y = 4; const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 8, 0.12), boltM); bolt.position.y = 4; bolt.rotation.z = 0.15; g.add(col2, bolt); scene.add(g); boomPool.push(g); }
      boomPool.forEach((g, i) => { const b = Bm[i]; g.visible = !!b; if (!b) return; const s = (b[2] / AW) * KW; g.position.set(wx(b[0]), 0, wz(b[1])); g.children[0].scale.set(s, 1, s); g.children[0].material.opacity = 0.25 + Math.random() * 0.25; });
    }
    // 보석: 빙글빙글 떠 있는 3D 보석
    if (kind === 'gems') {
      const G = v.gems || []; while (gemPool.length < G.length) { const m = new THREE.Mesh(gemGeo, gemM[1]); m.castShadow = hi; scene.add(m); gemPool.push(m); }
      gemPool.forEach((m, i) => { const g = G[i]; m.visible = !!g; if (!g) return; m.material = gemM[g[2] >= 5 ? 5 : g[2] === 2 ? 2 : 1]; const s = g[2] >= 5 ? 1.8 : 1; m.scale.set(s, s * 1.3, s); m.position.set(wx(g[0]), 0.45 + Math.sin(t * 3 + i) * 0.08, wz(g[1])); m.rotation.y = t * 2 + i; });
    }
    // 왕관: 황금 원 + 그 위에 떠서 도는 왕관
    if (kind === 'crown' && v.z) { const r = (v.z[2] / AW) * KW; zone.position.set(wx(v.z[0]), 0, wz(v.z[1])); zone.scale.set(r, 1, r); crown.position.set(wx(v.z[0]), 1.6 + Math.sin(t * 2) * 0.1, wz(v.z[1])); crown.rotation.y = t; }
    // 페인트: 칠해진 칸을 팀 색 바닥 타일로
    if (kind === 'paint' && grid && v.GC) {
      const n = v.GC * v.GR; if (!tiles || tilesN !== n) { if (tiles) scene.remove(tiles); tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(KW / v.GC * 0.96, 0.08, KH / v.GR * 0.96), lam({ color: '#ffffff' }), n); tilesN = n; tiles.receiveShadow = hi; scene.add(tiles); }
      for (let i = 0; i < n; i++) { const ch = grid[i]; const on = ch && ch !== '.'; o3.position.set(-KW / 2 + (i % v.GC + 0.5) * KW / v.GC, on ? 0.04 : -1, -KH / 2 + (Math.floor(i / v.GC) + 0.5) * KH / v.GR); o3.updateMatrix(); tiles.setMatrixAt(i, o3.matrix); if (on) tiles.setColorAt(i, col.set(teamColor(parseInt(ch, 36)))); }
      tiles.instanceMatrix.needsUpdate = true; if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    }
    // 카메라: 경기장 앞쪽 위에서 비스듬히 (나를 살짝 따라감)
    cam.position.set(me.position.x * 0.3, 8.6, 9.2 + me.position.z * 0.25); cam.lookAt(me.position.x * 0.3, 0, 0.6 + me.position.z * 0.25);
    B.draw();
    // 2D 글자('나')를 얹을 화면 위치
    const p = me.position.clone(); p.y += 1.9; p.project(cam); return { sx: (p.x + 1) / 2, sy: (1 - p.y) / 2 };
  }
  return { render, dispose: () => B.dispose() };
}

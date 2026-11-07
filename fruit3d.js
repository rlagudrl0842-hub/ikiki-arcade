// 🍉 과일 자르기 3D 화면 — 나무 도마 위로 튀어 오르는 입체 과일
// 터치 판정은 play-n.js G.fruit 그대로. 위에서 똑바로 보는 카메라(ortho)라서 화면의 과일 자리 = 자르는 자리 (어긋나지 않음)
// 과일은 빛·그림자가 있는 3D 모형, 자르면 두 쪽으로 갈라지며 속살이 보임
import { base, lam, tex } from './g3d.js';

// 과일 종류(FRUITS 순서): 수박 사과 오렌지 레몬 포도 딸기 복숭아 파인애플 키위 바나나
const SKIN = ['#2f8a3a', '#d8273a', '#ff8a1c', '#ffe14a', '#7a3db8', '#e5354d', '#ffad8f', '#e8b02e', '#8a6a3a', '#ffd84a'];
const FLESH = ['#ff4d5e', '#fff3d6', '#ffb54d', '#fff7a8', '#c8a8f0', '#ff8a9a', '#ffe0c0', '#fff08a', '#7acb4a', '#fff7d0'];

export function createFruit3D(canvas, { quality = 'high', onSlow, sizeFrom } = {}) {
  const B = base(canvas, { quality, onSlow, sizeFrom, ortho: true }); if (!B) return null;
  const { THREE, scene, cam, hi } = B;
  scene.add(new THREE.HemisphereLight('#fff6e8', '#4a3020', 1.0));
  const key = new THREE.DirectionalLight('#ffffff', 1.9); key.position.set(-0.6, 1.2, 3); key.target.position.set(0.5, -0.8, 0); scene.add(key, key.target);
  if (hi) { key.castShadow = true; key.shadow.mapSize.set(512, 512); Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 10 }); key.shadow.bias = -0.002; }
  // 나무 도마 (뒤 배경 · 그림자가 떨어짐)
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshPhongMaterial({ shininess: 15, map: tex(256, 512, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#7a4e2c' : '#86563a'; c.fillRect(i * w / 8, 0, w / 8, h); } c.strokeStyle = '#00000022'; for (let i = 0; i < 160; i++) { const x = Math.random() * w; c.beginPath(); c.moveTo(x, Math.random() * h); c.lineTo(x + (Math.random() - 0.5) * 6, Math.random() * h); c.stroke(); } const g = c.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75); g.addColorStop(0, '#00000000'); g.addColorStop(1, '#00000088'); c.fillStyle = g; c.fillRect(0, 0, w, h); }) }));
  board.position.z = -1; board.receiveShadow = hi; scene.add(board);
  // 과일 모양 만들기 (같은 종류는 재사용)
  const sph = new THREE.SphereGeometry(1, 20, 14); const hemi = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); const cap = new THREE.CircleGeometry(1, 20);
  const skinM = SKIN.map((c, i) => new THREE.MeshPhongMaterial({ color: c, shininess: 70, map: i === 0 ? tex(64, 64, (x, w, h) => { x.fillStyle = '#3fa046'; x.fillRect(0, 0, w, h); x.fillStyle = '#1f6a28'; for (let k = 0; k < 8; k++) x.fillRect(k * 8, 0, 4, h); }) : null }));
  const fleshM = FLESH.map((c) => lam({ color: c }));
  const bombM = new THREE.MeshPhongMaterial({ color: '#22242c', shininess: 120 }), goldM = new THREE.MeshPhongMaterial({ color: '#ffd43b', emissive: '#7a5a00', shininess: 150 });
  const leafM = lam({ color: '#3a9a3a' }), fuseM = lam({ color: '#c9a36b' }), sparkM = new THREE.MeshBasicMaterial({ color: '#ffd84a' });
  function mkFruit(f) {
    const g = new THREE.Group(); const k = f.type === 'b' ? -1 : f.type === 'g' ? -2 : f.k;
    const body = new THREE.Mesh(sph, k === -1 ? bombM : k === -2 ? goldM : skinM[k]); body.castShadow = hi; g.add(body);
    if (k === 3 || k === 0) body.scale.set(1.15, 0.9, 0.9); // 레몬·수박은 길쭉
    if (k === 9) body.scale.set(1.35, 0.5, 0.5); // 바나나
    if (k === 7) { body.scale.set(0.85, 1.05, 0.85); for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 4), leafM); l.position.set((i - 1.5) * 0.15, 1.2, 0); l.rotation.z = (i - 1.5) * 0.3; g.add(l); } } // 파인애플 잎
    if (k === 1 || k === 6) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 5), fuseM); st.position.y = 1.05; g.add(st); const lf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), leafM); lf.scale.set(1.4, 0.4, 0.8); lf.position.set(0.2, 1.1, 0); g.add(lf); }
    if (k === 4) { body.visible = false; for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(sph, skinM[4]); b.scale.setScalar(0.38); b.position.set(((i % 3) - 1) * 0.42, 0.5 - Math.floor(i / 3) * 0.42 - (i % 3 === 1 ? 0 : 0.05), 0.2); b.castShadow = hi; g.add(b); } }
    if (k === 5) { body.scale.set(0.85, 1, 0.85); const top = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 6), leafM); top.position.y = 0.95; g.add(top); }
    if (k === -1) { const fz = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 5), fuseM); fz.position.set(0.35, 0.95, 0); fz.rotation.z = -0.5; g.add(fz); const sp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), sparkM); sp.position.set(0.5, 1.2, 0); g.add(sp); g.userData.spark = sp; }
    scene.add(g); return g;
  }
  const live = new Map(); // 과일 id → 모형
  const halves = new Map(); // 자른 기록 → 두 쪽
  function mkHalf(o) {
    const k = o.f.type === 'b' ? -1 : o.f.type === 'g' ? -2 : o.f.k; const g = new THREE.Group();
    for (const sd of [-1, 1]) { const p = new THREE.Group(); const sk = new THREE.Mesh(hemi, k === -1 ? bombM : k === -2 ? goldM : skinM[k]); const fl = new THREE.Mesh(cap, k < 0 ? sparkM : fleshM[k]); fl.rotation.x = Math.PI / 2; p.add(sk, fl); p.rotation.z = sd > 0 ? 0 : Math.PI; p.userData.sd = sd; g.add(p); }
    g.rotation.z = o.ang + Math.PI / 2; scene.add(g); return g;
  }

  // st: { items: [{id, x, y, rot, f, r}], halves: [{key, f, x, y, k, ang, r}], gold: t }
  function render(st) {
    const dt = B.frame(); if (dt == null) return false;
    const hh = -cam.bottom; board.scale.set(1, hh, 1); board.position.set(0.5, -hh / 2, -0.35);
    const seen = new Set();
    for (const it of st.items) { let m = live.get(it.id); if (!m) { m = mkFruit(it.f); live.set(it.id, m); } seen.add(it.id); m.position.set(it.x, -it.y, 0); m.scale.setScalar(it.r); m.rotation.set(it.rot * 0.6, it.rot * 0.4, it.rot); if (m.userData.spark) m.userData.spark.scale.setScalar(0.8 + Math.random() * 0.6); }
    for (const [id, m] of live) if (!seen.has(id)) { scene.remove(m); live.delete(id); }
    const hs = new Set();
    for (const o of st.halves) { let g = halves.get(o.key); if (!g) { g = mkHalf(o); halves.set(o.key, g); } hs.add(o.key); g.position.set(o.x, -o.y - o.k * o.k * 0.25, 0.1); g.scale.setScalar(o.r); g.children.forEach((p) => { const sd = p.userData.sd; p.position.set(sd * o.k * 0.9, 0, 0); p.rotation.y = sd * o.k * 2; }); g.traverse((x) => { if (x.material) { x.material.transparent = true; } }); g.visible = o.k < 1; }
    for (const [key, g] of halves) if (!hs.has(key)) { scene.remove(g); halves.delete(key); }
    B.draw(); return true;
  }
  return { render, dispose: () => B.dispose() };
}

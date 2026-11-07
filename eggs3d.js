// 🥚 달걀 받기 3D 화면 — 시골 농장 마당에서 위에서 떨어지는 달걀을 바구니로 받기
// 규칙은 play-n2.js G.eggs 그대로. 바구니는 손가락 가로 위치(S.bx)와 화면에서 정확히 같은 곳에 오도록 카메라 투영으로 맞춤
import { base, lam, tex, sky } from './g3d.js';

const YB = 0.6; // 바구니 높이(m)
const HR = 9; // 떨어지는 높이 범위(m)

export function createEggs3D(canvas, { quality = 'high', onSlow } = {}) {
  const B = base(canvas, { quality, onSlow, fov: 55 }); if (!B) return null;
  const { THREE, scene, cam, hi } = B;
  scene.background = sky([[0, '#5aa0e8'], [0.65, '#a9d4ff'], [1, '#fff1d0']]); scene.fog = new THREE.Fog('#dfeee0', 25, 80);
  scene.add(new THREE.HemisphereLight('#ffffff', '#7a6a3a', 1.1)); const sun = new THREE.DirectionalLight('#fff3d6', 1.9); sun.position.set(6, 16, 10); scene.add(sun, sun.target);
  if (hi) { sun.castShadow = true; sun.shadow.mapSize.set(512, 512); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 12, bottom: -4, near: 1, far: 50 }); }
  // 마당 · 헛간 · 울타리 · 건초 · 언덕
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), lam({ map: tex(64, 64, (c, w, h) => { c.fillStyle = '#7fb24a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { c.fillStyle = ['#8cc055', '#6fa23e', '#a6c96a'][i % 3]; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [30, 20]) }));
  yard.rotation.x = -Math.PI / 2; yard.position.z = -20; yard.receiveShadow = true; scene.add(yard);
  const barnM = lam({ color: '#b7372c' }), whiteM = lam({ color: '#f4efe6' }), roofM = lam({ color: '#5b3a2a' });
  const barn = new THREE.Group(); const bb = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 6), barnM); bb.position.y = 3; const rf = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 5.2, 3, 4), roofM); rf.rotation.y = Math.PI / 4; rf.scale.set(1.15, 1, 0.85); rf.position.y = 7.4; const door = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.1), whiteM); door.position.set(0, 2, 3.02); barn.add(bb, rf, door); barn.position.set(5, 0, -18); barn.traverse((m) => { if (m.isMesh) { m.castShadow = hi; m.receiveShadow = hi; } }); scene.add(barn);
  const fenceM = lam({ color: '#e8dcc0' }); for (let i = 0; i < 18; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.1, 0.15), fenceM); p.position.set(-14 + i * 1.6, 0.55, -8); scene.add(p); } for (const y of [0.45, 0.9]) { const r = new THREE.Mesh(new THREE.BoxGeometry(28, 0.1, 0.08), fenceM); r.position.set(-0.4, y, -8); scene.add(r); }
  const hayM = lam({ color: '#e0b84a' }); for (const [x, z] of [[-6, -10], [-4.6, -11], [-7, -12]]) { const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.2, 16), hayM); hb.rotation.z = Math.PI / 2; hb.position.set(x, 0.9, z); hb.castShadow = hi; scene.add(hb); }
  const hillM = lam({ color: '#5e9a45' }); for (let i = 0; i < 6; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hillM); h.position.set(-40 + i * 18, -3, -50); h.scale.y = 0.5; scene.add(h); }
  // 위쪽 닭장 들보 (달걀이 여기서 떨어짐) — 닭 몇 마리
  const beam = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 0.4), lam({ color: '#8a5a34' })); beam.position.set(0, YB + HR + 0.6, -0.2); scene.add(beam);
  const henM = lam({ color: '#ffffff' }), combM = lam({ color: '#e5354d' }); const hens = [];
  for (let i = 0; i < 5; i++) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), henM); b.scale.set(1.2, 1, 0.9); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), henM); hd.position.set(0.35, 0.3, 0); const cb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.05), combM); cb.position.set(0.38, 0.52, 0); g.add(b, hd, cb); g.position.set(-5 + i * 2.5, YB + HR + 1.1, -0.2); scene.add(g); hens.push(g); }
  // 달걀·황금 달걀·돌멩이
  const eggGeo = new THREE.SphereGeometry(0.22, 12, 10); const eggM = new THREE.MeshPhongMaterial({ color: '#fffaf0', shininess: 60 }), goldM = new THREE.MeshPhongMaterial({ color: '#ffd43b', emissive: '#806010', shininess: 100 }), rockM = lam({ color: '#6b6b78' });
  const pool = []; const mk = () => { const m = new THREE.Mesh(eggGeo, eggM); m.castShadow = hi; scene.add(m); return m; };
  // 바구니 (짚 무늬)
  const basket = new THREE.Group(); const bk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.65, 0.7, 20, 1, true), lam({ map: tex(64, 32, (c, w, h) => { c.fillStyle = '#a06a34'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7a4a20'; c.lineWidth = 2; for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(0, i * 4); c.lineTo(w, i * 4 + 2); c.stroke(); } }), side: THREE.DoubleSide }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.07, 8, 24), lam({ color: '#7a4a20' })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.35; const bot = new THREE.Mesh(new THREE.CircleGeometry(0.65, 16), lam({ color: '#6a3a18' })); bot.rotation.x = -Math.PI / 2; bot.position.y = -0.34; basket.add(bk, rim, bot); basket.traverse((m) => { if (m.isMesh) m.castShadow = hi; }); scene.add(basket);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; scene.add(shadow);
  let lastScore = null, popT = 9; const v = new THREE.Vector3();

  function render(S) {
    const dt = B.frame(); if (dt == null) return;
    cam.position.set(0, YB + 4.2, 11); cam.lookAt(0, YB + 3.6, 0); cam.updateMatrixWorld();
    // 바구니 줄의 1m가 화면에서 얼마인지 → 손가락 위치(S.bx)와 같은 화면 자리로
    v.set(1, YB, 0).project(cam); const scale = (v.x + 1) / 2 - 0.5; const X = (x) => (x - 0.5) / scale;
    basket.position.set(X(S.bx), YB, 0); shadow.position.x = basket.position.x;
    if (lastScore != null && S.score !== lastScore) popT = 0; lastScore = S.score; popT += dt; const pk = popT < 0.25 ? 1 + Math.sin(popT / 0.25 * Math.PI) * 0.15 : 1; basket.scale.set(pk, 1 / pk, pk);
    while (pool.length < S.items.length) pool.push(mk());
    pool.forEach((m, i) => { const it = S.items[i]; m.visible = !!it; if (!it) return; m.material = it.t === 'gold' ? goldM : it.t === 'rock' ? rockM : eggM; m.scale.set(it.t === 'rock' ? 1.2 : 0.85, it.t === 'rock' ? 0.9 : 1.1, it.t === 'rock' ? 1 : 0.85); m.position.set(X(it.x), YB + 0.3 + (0.88 - it.y) * HR, 0); m.rotation.z = it.y * 6; });
    hens.forEach((h, i) => { h.position.y = YB + HR + 1.1 + Math.abs(Math.sin(S.t * 3 + i)) * 0.15; });
    B.draw();
  }
  return { render, dispose: () => B.dispose() };
}

// 🎈 풍선 터뜨리기 3D 화면 — 반짝이는 입체 풍선이 하늘로 떠오름
// 터치 판정은 play-n3.js G.balloon 그대로. 위에서 똑바로 보는 카메라(ortho)라서 보이는 풍선 자리 = 누르는 자리
import { base, lam, tex } from './g3d.js';

const COLORS = ['#ff4d6d', '#3d8bff', '#ffd43b', '#2fd27a', '#b06bff'];

export function createBall3D(canvas, { quality = 'high', onSlow, sizeFrom } = {}) {
  const B = base(canvas, { quality, onSlow, sizeFrom, ortho: true }); if (!B) return null;
  const { THREE, scene, cam } = B;
  scene.add(new THREE.HemisphereLight('#ffffff', '#88aacc', 1.0));
  const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(-1, 1.5, 3); scene.add(key);
  // 하늘 (위 진한 파랑 → 아래 밝은 하늘) + 뭉게구름 + 멀리 들판
  const skyM = new THREE.MeshBasicMaterial({ map: tex(4, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3a7ad8'); g.addColorStop(0.7, '#9fd0ff'); g.addColorStop(1, '#e8f6ff'); c.fillStyle = g; c.fillRect(0, 0, w, h); }) });
  const skyP = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), skyM); skyP.position.z = -20; scene.add(skyP);
  const hill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lam({ map: tex(128, 32, (c, w, h) => { c.fillStyle = '#6fbf5a'; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 4) c.lineTo(x, h * 0.4 + Math.sin(x / 18) * h * 0.2); c.lineTo(w, h); c.fill(); }), transparent: true })); hill.position.z = -15; scene.add(hill);
  const cloudM = lam({ color: '#ffffff', transparent: true, opacity: 0.9 }); const clouds = [];
  for (let i = 0; i < 5; i++) { const g = new THREE.Group(); for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.05 + Math.random() * 0.03, 12, 8), cloudM); s.position.set(k * 0.06, Math.random() * 0.02, 0); g.add(s); } g.userData = { x: Math.random(), y: 0.1 + Math.random() * 0.8, v: 0.01 + Math.random() * 0.02 }; g.position.z = -10; scene.add(g); clouds.push(g); }
  // 풍선 모형 (색별 반짝이는 재질) — 풍선 + 매듭 + 줄
  const balM = COLORS.map((c) => new THREE.MeshPhongMaterial({ color: c, shininess: 110, specular: '#ffffff' }));
  const balGeo = new THREE.SphereGeometry(1, 24, 18); const knotGeo = new THREE.ConeGeometry(0.14, 0.2, 8);
  const lineM = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 });
  const live = new Map();
  function mk(c) { const g = new THREE.Group(); const b = new THREE.Mesh(balGeo, balM[c]); b.scale.set(0.88, 1.08, 0.88); const k = new THREE.Mesh(knotGeo, balM[c]); k.position.y = -1.12; k.rotation.z = Math.PI; const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 8), 3)); const ln = new THREE.Line(lg, lineM); g.add(b, k, ln); g.userData.line = ln; scene.add(g); return g; }

  // st: { list: [{id, c, x, y(화면 높이 비율), sw}], R: 반지름(폭 비율), t }
  function render(st) {
    const dt = B.frame(); if (dt == null) return false;
    const hh = -cam.bottom; skyP.scale.set(1, hh, 1); skyP.position.set(0.5, -hh / 2, -20); hill.scale.set(1.2, hh * 0.3, 1); hill.position.set(0.5, -hh * 0.88, -15);
    for (const g of clouds) { const u = g.userData; u.x += u.v * dt; if (u.x > 1.2) u.x = -0.3; g.position.set(u.x, -u.y * hh, -10); }
    const seen = new Set();
    for (const b of st.list) {
      let g = live.get(b.id); if (!g) { g = mk(b.c); live.set(b.id, g); } seen.add(b.id);
      g.position.set(b.x, -b.y * hh, 0); g.scale.setScalar(st.R); g.rotation.y = Math.sin(st.t + b.sw) * 0.3;
      const a = g.userData.line.geometry.attributes.position.array; for (let i = 0; i < 8; i++) { const k = i / 7; a[i * 3] = Math.sin(st.t * 3 + b.sw + k * 2) * 0.35 * k; a[i * 3 + 1] = -1.2 - k * 1.3; a[i * 3 + 2] = 0; } g.userData.line.geometry.attributes.position.needsUpdate = true;
    }
    for (const [id, g] of live) if (!seen.has(id)) { scene.remove(g); g.userData.line.geometry.dispose(); live.delete(id); }
    B.draw(); return true;
  }
  return { render, dispose: () => B.dispose() };
}

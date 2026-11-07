// 🐤 파닥파닥 3D 화면 — 하늘 도시 위를 나는 새를 옆에서 따라가는 시점
// 규칙·판정은 play-n2.js G.flappy 그대로: 화면 좌표(새 x 0.22, 높이 y, 기둥 x·c·gap)를 같은 비율로 3D 공간에 옮김
import { base, lam, tex, sky } from './g3d.js';

const KX = 14; // 화면 폭 1.0 = 14m

export function createFlap3D(canvas, { color = '#ffd43b', quality = 'high', onSlow } = {}) {
  const B = base(canvas, { quality, onSlow, fov: 40 }); if (!B) return null;
  const { THREE, scene, cam, hi } = B;
  scene.background = sky([[0, '#3d7fe0'], [0.6, '#8fc6ff'], [1, '#e8f6ff']]); scene.fog = new THREE.Fog('#cfe6ff', 40, 120);
  scene.add(new THREE.HemisphereLight('#ffffff', '#6a8f6a', 1.1)); const sun = new THREE.DirectionalLight('#fff4d6', 1.8); sun.position.set(-8, 20, 14); scene.add(sun);
  if (hi) { sun.castShadow = true; sun.shadow.mapSize.set(512, 512); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 20, bottom: -4, near: 1, far: 60 }); }
  // 멀리 도시 (여러 겹) + 구름 — 천천히 흐름
  const city = new THREE.Group(); scene.add(city); const bm = [lam({ color: '#7d93c8' }), lam({ color: '#6a80b8' }), lam({ color: '#90a6d6' })];
  for (let i = 0; i < 40; i++) { const h = 4 + Math.random() * 14; const b = new THREE.Mesh(new THREE.BoxGeometry(2 + Math.random() * 2.5, h, 2), bm[i % 3]); b.position.set(-30 + i * 2.6, h / 2 - 2, -30 - (i % 3) * 6); city.add(b); }
  const cloudM = lam({ color: '#ffffff', transparent: true, opacity: 0.92 }); const clouds = [];
  for (let i = 0; i < 9; i++) { const g = new THREE.Group(); for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random(), 10, 8), cloudM); s.position.set(k * 1.3, Math.random() * 0.6, 0); g.add(s); } g.position.set(-20 + i * 7, 6 + Math.random() * 8, -14 - Math.random() * 10); scene.add(g); clouds.push(g); }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), lam({ color: '#5fae4a' })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.6, -10); ground.receiveShadow = true; scene.add(ground);

  // 기둥 (초록 관 · 머리 테두리) — 화면 기둥과 1:1
  const pipeM = new THREE.MeshPhongMaterial({ color: '#2fd27a', shininess: 50 }), capM = new THREE.MeshPhongMaterial({ color: '#1a9e55', shininess: 50 });
  const pw = 0.12 * KX; const pool = [];
  const mkPipe = () => { const g = new THREE.Group(); const top = new THREE.Mesh(new THREE.CylinderGeometry(pw / 2, pw / 2, 1, 16), pipeM); const bot = top.clone(); const c1 = new THREE.Mesh(new THREE.CylinderGeometry(pw / 2 + 0.15, pw / 2 + 0.15, 0.5, 16), capM); const c2 = c1.clone(); g.add(top, bot, c1, c2); g.traverse((m) => { if (m.isMesh) m.castShadow = hi; }); scene.add(g); g.userData = { top, bot, c1, c2 }; return g; };

  // 새: 팀 색 몸통 + 날개 + 부리 + 눈
  const bird = new THREE.Group(); bird.scale.setScalar(1.8); scene.add(bird); // 멀리서 봐도 잘 보이게 크게
  const bodyM = new THREE.MeshPhongMaterial({ color, shininess: 40 }); const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), bodyM); body.scale.set(1.15, 0.95, 0.9); bird.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), lam({ color: '#fff4dc' })); belly.position.set(0.1, -0.12, 0.12); bird.add(belly);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), lam({ color: '#ff9f1c' })); beak.rotation.z = -Math.PI / 2; beak.position.set(0.52, -0.02, 0); bird.add(beak);
  for (const z of [0.2, -0.2]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), lam({ color: '#ffffff' })); e.position.set(0.3, 0.14, z); const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), lam({ color: '#111' })); p.position.set(0.37, 0.15, z * 1.15); bird.add(e, p); }
  const wings = [0.32, -0.32].map((z) => { const pv = new THREE.Group(); pv.position.set(-0.05, 0.05, z); const w = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), bodyM); w.scale.set(1, 0.25, 0.7); w.position.z = Math.sign(z) * 0.2; pv.add(w); bird.add(pv); return pv; });
  bird.traverse((m) => { if (m.isMesh) m.castShadow = hi; });
  let flapT = 9, lastVy = 0, scroll = 0;

  function render(S) {
    const dt = B.frame(); if (dt == null) return;
    const asp = canvas.clientHeight / Math.max(1, canvas.clientWidth); const HW = KX * asp; // 화면 높이 1.0 = HW m
    const Y = (y) => (1 - y) * HW;
    // 기둥
    while (pool.length < S.pipes.length) pool.push(mkPipe());
    pool.forEach((g, i) => { const p = S.pipes[i]; g.visible = !!p && p.x > -0.3; if (!g.visible) return; const X = (p.x + 0.06 - 0.22) * KX; const topY = Y(p.c - p.gap / 2), botY = Y(p.c + p.gap / 2); const U = g.userData;
      const th = Math.max(0.1, HW + 4 - topY); U.top.scale.y = th; U.top.position.set(X, topY + th / 2, 0); U.c1.position.set(X, topY + 0.25, 0);
      const bh = Math.max(0.1, botY + 0.6); U.bot.scale.y = bh; U.bot.position.set(X, botY - bh / 2, 0); U.c2.position.set(X, botY - 0.25, 0); });
    // 새: 위치 = 판정 위치, 기울기 = 속도
    if (S.vy < lastVy - 0.3) flapT = 0; lastVy = S.vy; flapT += dt;
    bird.position.set(0, Y(S.y), 0); bird.rotation.z = S.stun > 0 ? S.t * 12 : -Math.max(-0.5, Math.min(1, S.vy * 1.5));
    const wf = flapT < 0.25 ? Math.sin(flapT * 40) : Math.sin(S.t * 6) * 0.3; wings[0].rotation.x = -0.4 - wf * 0.8; wings[1].rotation.x = 0.4 + wf * 0.8;
    bodyM.emissive?.set(S.stun > 0 && Math.floor(S.t * 10) % 2 ? '#661111' : '#000000');
    // 배경 흐름 (멀수록 느리게)
    if (S.stun <= 0) scroll += dt; city.position.x = -((scroll * 1.2) % 2.6); for (const cl of clouds) { cl.position.x -= dt * 0.8; if (cl.position.x < -26) cl.position.x = 36; }
    // 카메라: 새 옆 조금 앞쪽에서 (새는 화면 왼쪽 1/4, 앞의 기둥이 잘 보이게)
    const dist = HW / (2 * Math.tan((40 / 2) * Math.PI / 180)); cam.position.set(KX * 0.28 - 1.5, HW / 2 + 0.6, dist); cam.lookAt(KX * 0.28, HW / 2, 0); // 화면 높이 = 판정 높이 (보이는 기둥 틈 = 실제 틈)
    B.draw();
  }
  return { render, dispose: () => B.dispose() };
}

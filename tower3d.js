// 🏗 탑 쌓기 3D 화면 — 밤 도시 공사장 위로 우리 팀 탑이 올라감
// 규칙·판정은 play-n3.js G.towerup 그대로: 쌓인 블록(stack: [x, 폭])·움직이는 블록(x, w)을 같은 비율로 그림 (폭 1.0 = 6m)
import { base, lam, tex } from './g3d.js';

const KX = 6, BH = 0.7;

export function createTower3D(canvas, { color = '#ff4d6d', quality = 'high', onSlow, sizeFrom } = {}) {
  const B = base(canvas, { quality, onSlow, fov: 45, sizeFrom }); if (!B) return null;
  const { THREE, scene, cam, hi } = B;
  scene.background = tex(4, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a0f2e'); g.addColorStop(0.7, '#2a2a6a'); g.addColorStop(1, '#5a3a7a'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog('#1a1a4a', 25, 70);
  scene.add(new THREE.HemisphereLight('#a8b8ff', '#2a1a3a', 0.9)); const key = new THREE.DirectionalLight('#ffe8c0', 1.6); key.position.set(5, 20, 10); scene.add(key, key.target);
  // 도시 불빛 빌딩 (멀리)
  const winTex = tex(32, 64, (c, w, h) => { c.fillStyle = '#1b2050'; c.fillRect(0, 0, w, h); for (let y = 2; y < h; y += 5) for (let x = 2; x < w; x += 5) if (Math.random() < 0.45) { c.fillStyle = Math.random() < 0.8 ? '#ffd98a' : '#9fd8ff'; c.fillRect(x, y, 3, 3); } });
  for (let i = 0; i < 26; i++) { const h = 6 + Math.random() * 22; const m = new THREE.Mesh(new THREE.BoxGeometry(3 + Math.random() * 3, h, 3), lam({ map: winTex })); m.position.set(-36 + i * 3, h / 2 - 1, -20 - (i % 3) * 7); scene.add(m); }
  for (let i = 0; i < 60; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); s.position.set((Math.random() - 0.5) * 80, 15 + Math.random() * 25, -40); scene.add(s); }
  // 공사장 바닥 + 크레인
  const ground = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 6), lam({ color: '#3a3f52' })); ground.position.y = -0.5; scene.add(ground);
  const craneM = lam({ color: '#ffb02e' }); const mast = new THREE.Mesh(new THREE.BoxGeometry(0.4, 40, 0.4), craneM); mast.position.set(-5.5, 20, -2); scene.add(mast); const jib = new THREE.Mesh(new THREE.BoxGeometry(14, 0.35, 0.35), craneM); jib.position.set(0, 40, -2); scene.add(jib);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.05), lam({ color: '#cccccc' })); scene.add(hook);
  // 블록 (팀 색 · 맨 위는 밝게) + 움직이는 블록(노랑) + 목표 테두리
  const blockGeo = new THREE.BoxGeometry(1, BH * 0.94, 1.6); const teamM = new THREE.MeshPhongMaterial({ color, shininess: 50 }), topM = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.25, shininess: 80 });
  const pool = []; const mover = new THREE.Mesh(blockGeo, new THREE.MeshPhongMaterial({ color: '#ffd43b', emissive: '#5a4000', shininess: 90 })); scene.add(mover);
  const ghost = new THREE.Mesh(blockGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.5 })); scene.add(ghost);
  let camY = 2;

  // st: { v: 서버 상태, xNow: 움직이는 블록 x, t }
  function render(st) {
    const dt = B.frame(); if (dt == null) return false;
    const v = st.v; const stack = v.stack || []; const show = Math.min(stack.length, 14);
    while (pool.length < show) { const m = new THREE.Mesh(blockGeo, teamM); scene.add(m); pool.push(m); }
    const base0 = stack.length - show; // 너무 높으면 아래는 생략하고 위쪽만
    pool.forEach((m, i) => { const b = stack[base0 + i]; m.visible = !!b && i < show; if (!m.visible) return; m.scale.x = Math.max(0.05, b[1] * KX); m.position.set((b[0] + b[1] / 2 - 0.5) * KX, (i + 0.5) * BH, 0); m.material = i === show - 1 ? topM : teamM; });
    const topY = show * BH;
    ghost.visible = !!v.me; ghost.scale.x = v.w * KX; ghost.position.set((v.x + v.w / 2 - 0.5) * KX, topY + BH / 2, 0);
    mover.visible = !!v.me; mover.scale.x = v.w * KX; mover.position.set((st.xNow + v.w / 2 - 0.5) * KX, topY + BH * 1.9, 0);
    hook.position.set(mover.position.x, topY + BH * 1.9 + 0.8, 0); hook.visible = mover.visible;
    camY += (topY + 1.5 - camY) * Math.min(1, dt * 3);
    cam.position.set(2.6, camY + 2.6, 12.5); cam.lookAt(0, camY, 0);
    B.draw(); return true;
  }
  return { render, dispose: () => B.dispose() };
}

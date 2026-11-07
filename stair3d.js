// 🪜 하늘 계단 3D 화면 — 구름 위로 지그재그로 이어진 계단을 오르는 선수 (비스듬히 위에서 보는 시점)
// 규칙은 play-n2.js G.stairs 그대로: 다음 계단 방향(S.seq)·현재 칸(S.i)·바라보는 쪽(S.face)·떨어짐(S.fall)을 그대로 보여 줌
import { base, lam, sky, person } from './g3d.js';

const SW = 1.1, SH = 0.55; // 계단 한 칸 가로·높이

export function createStair3D(canvas, { color = '#ff4d6d', quality = 'high', onSlow } = {}) {
  const B = base(canvas, { quality, onSlow, fov: 50 }); if (!B) return null;
  const { THREE, scene, cam, hi } = B;
  scene.background = sky([[0, '#4f63c9'], [0.6, '#9db4ff'], [1, '#ffe7c2']]); scene.fog = new THREE.Fog('#c9d4ff', 20, 70);
  scene.add(new THREE.HemisphereLight('#ffffff', '#7f8fc0', 1.1)); const sun = new THREE.DirectionalLight('#fff1d6', 1.8); sun.position.set(6, 14, 10); scene.add(sun, sun.target);
  if (hi) { sun.castShadow = true; sun.shadow.mapSize.set(512, 512); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 }); }
  // 구름 바다 (아래) + 떠다니는 구름
  const cloudM = lam({ color: '#ffffff' }); const cloudSea = new THREE.Group(); scene.add(cloudSea);
  for (let i = 0; i < 40; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(1.5 + Math.random() * 2, 10, 8), cloudM); c.position.set((Math.random() - 0.5) * 50, -6 - Math.random() * 2, -Math.random() * 40 + 5); c.scale.y = 0.5; cloudSea.add(c); }
  const puffs = []; for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 })); c.position.set((Math.random() - 0.5) * 30, Math.random() * 10, -10 - Math.random() * 15); c.scale.set(2, 0.7, 1); scene.add(c); puffs.push(c); }
  // 계단 14칸 (아래 칸부터 색이 점점 하늘색)
  const steps = []; const stepGeo = new THREE.BoxGeometry(SW, 0.22, 1.2);
  for (let k = 0; k < 14; k++) { const m = new THREE.Mesh(stepGeo, new THREE.MeshPhongMaterial({ color: k === 0 ? '#ffd43b' : new THREE.Color().setHSL((220 + k * 6) / 360, 0.7, Math.max(0.45, 0.7 - k * 0.02)), shininess: 40 })); m.castShadow = hi; m.receiveShadow = hi; scene.add(m); steps.push(m); }
  const me = person(color, hi); scene.add(me); const U = me.userData;
  let camY = 0, camX = 0;

  function render(S) {
    const dt = B.frame(); if (dt == null) return;
    // 계단 위치: 2D와 같은 계산 (k번째 칸의 가로 = 다음 방향들의 합)
    let x = 0; const xs = [0]; for (let k = 1; k < 14; k++) { x += S.seq[S.i + k] || 1; xs.push(x); }
    const lift = S.anim * SH; // 한 칸 오를 때 계단이 살짝 내려오는 연출 (2D와 같음)
    steps.forEach((m, k) => m.position.set(xs[k] * SW, k * SH - lift, 0));
    // 선수: 0번 칸 위 · 바라보는 쪽으로 몸을 돌림 · 오를 때 다리 들기 · 헛디디면 아래로 떨어짐
    const fallY = S.fall > 0 ? -(0.9 - S.fall) * 9 : 0; const fallRot = S.fall > 0 ? (0.9 - S.fall) * 4 : 0;
    me.position.set(0, 0.11 - lift + fallY, 0); me.rotation.set(0, S.face > 0 ? Math.PI / 2 : -Math.PI / 2, fallRot);
    const climb = S.anim > 0 ? Math.sin(S.anim * Math.PI) : 0; U.legL.rotation.x = -climb * 1.2; U.legR.rotation.x = climb * 0.4; U.armL.rotation.x = climb * 0.8; U.armR.rotation.x = -climb * 0.8;
    if (S.fall > 0) { U.armL.rotation.z = -2.4; U.armR.rotation.z = 2.4; } else { U.armL.rotation.z = 0; U.armR.rotation.z = 0; }
    for (const p of puffs) { p.position.x += dt * 0.5; if (p.position.x > 20) p.position.x = -20; }
    cloudSea.position.y = -(S.score % 20) * 0.02; // 오를수록 구름 바다가 아주 조금씩 멀어짐
    // 카메라: 앞 오른쪽 위에서 선수와 다음 계단들이 보이게 (부드럽게 따라감)
    camX += ((xs[3] * SW) / 2 - camX) * Math.min(1, dt * 4); camY += (1.8 - camY) * Math.min(1, dt * 4);
    cam.position.set(camX + 3.5, camY + 4.2, 8.5); cam.lookAt(camX, camY + 0.8, 0);
    B.draw();
  }
  return { render, dispose: () => B.dispose() };
}

// 🌉 다리 놓기 3D 화면 — 협곡 위 돌기둥 사이에 막대를 세워 넘어뜨려 건너기 (옆에서 조금 비스듬히 보는 시점)
// 규칙은 play-n2.js G.bridge 그대로: 기둥 x·폭(S.plat), 막대 길이(S.len)·넘어지는 각도(S.fallA), 단계(S.phase)를 같은 비율로 그림
import { base, lam, tex, sky, person } from './g3d.js';

const KX = 10; // 화면 폭 1.0 = 10m

export function createBridge3D(canvas, { color = '#ff4d6d', quality = 'high', onSlow } = {}) {
  const B = base(canvas, { quality, onSlow, fov: 45 }); if (!B) return null;
  const { THREE, scene, cam, hi } = B;
  scene.background = sky([[0, '#3a2a5a'], [0.55, '#b0608a'], [0.85, '#ffb070'], [1, '#ffd9a0']]); scene.fog = new THREE.Fog('#c07a86', 18, 70);
  scene.add(new THREE.HemisphereLight('#ffd9c0', '#3a2a4a', 1.0)); const sun = new THREE.DirectionalLight('#ffc28a', 2); sun.position.set(-8, 10, 10); scene.add(sun, sun.target);
  if (hi) { sun.castShadow = true; sun.shadow.mapSize.set(512, 512); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 8, bottom: -12, near: 1, far: 50 }); }
  // 협곡: 먼 바위 절벽 + 아래 강
  const rockM = lam({ map: tex(64, 64, (c, w, h) => { c.fillStyle = '#6a4a5a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 200; i++) { c.fillStyle = ['#7a5a6a', '#5a3a4a', '#8a6a6a'][i % 3]; c.fillRect(Math.random() * w, Math.random() * h, 3, 2); } }, [1, 3]) });
  for (let i = 0; i < 12; i++) { const h = 6 + Math.random() * 10; const m = new THREE.Mesh(new THREE.BoxGeometry(3 + Math.random() * 3, h, 3), rockM); m.position.set(-12 + i * 4, h / 2 - 9, -16 - Math.random() * 8); scene.add(m); }
  const river = new THREE.Mesh(new THREE.PlaneGeometry(120, 40), new THREE.MeshPhongMaterial({ color: '#3a7ab8', shininess: 90, specular: '#ffd0a0' })); river.rotation.x = -Math.PI / 2; river.position.set(0, -9, -6); scene.add(river);
  // 기둥 (돌기둥 · 위 가운데 빨간 표시 = 정중앙 보너스 자리)
  const pillarM = new THREE.MeshPhongMaterial({ color: '#2b2440', shininess: 20 }), topM = lam({ color: '#4a3f66' }), markM = new THREE.MeshBasicMaterial({ color: '#ff4d6d' });
  const pillars = Array.from({ length: 4 }, () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 1.6), pillarM); b.position.y = -5; const t = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1.7), topM); t.position.y = -0.1; const mk = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 1.72), markM); mk.position.y = 0.01; g.add(b, t, mk); g.traverse((m) => { if (m.isMesh) { m.castShadow = hi; m.receiveShadow = hi; } }); scene.add(g); g.userData = { b, t, mk }; return g; });
  // 막대 (밑동 기준으로 회전)
  const stickPv = new THREE.Group(); scene.add(stickPv); const stick = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.3), lam({ color: '#c9a36b' })); stick.position.y = 0.5; stick.castShadow = hi; stickPv.add(stick);
  const me = person(color, hi); me.scale.setScalar(0.8); scene.add(me); const U = me.userData;
  // 물보라 (빠지면)
  const splash = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.6, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide })); splash.rotation.x = -Math.PI / 2; scene.add(splash); let spT = 9, wasFall = false;

  function render(S) {
    const dt = B.frame(); if (dt == null) return;
    const X = (x) => x * KX;
    pillars.forEach((g, i) => { const p = S.plat[i]; g.visible = !!p; if (!p) return; const w = p.w * KX; g.position.set(X(p.x) + w / 2, 0, 0); g.userData.b.scale.x = w; g.userData.t.scale.x = w; g.userData.mk.scale.x = w * 0.15; });
    const a = S.plat[0]; const sx = X(a.x + a.w); const L = Math.max(0.001, S.len * KX);
    stickPv.position.set(sx, 0, 0); stick.scale.y = L; stick.position.y = L / 2; stickPv.rotation.z = S.phase === 'ready' ? 0 : -S.fallA; stickPv.visible = S.len > 0.001 || S.phase !== 'ready';
    if (S.phase === 'fall') stickPv.rotation.z = -Math.PI / 2 - Math.min(1.2, S.walk * 2); // 짧거나 길면 막대도 아래로 기울어 떨어짐
    // 선수: 준비 = 기둥 끝에 섬 · 건너기 = 막대 위를 걸음 · 실패 = 강으로 떨어짐
    const walkK = S.phase === 'walk' ? Math.min(1, S.walk / 0.6) : 0; const toX = S.plat[1] ? X(S.plat[1].x) + 0.4 : sx;
    let px = sx - 0.35 + walkK * (toX - sx + 0.35), py = 0;
    if (S.phase === 'fall') { px = sx + Math.min(L, S.walk * 6); py = -Math.max(0, (S.walk - 0.2) * 14); }
    me.position.set(px, py, 0); me.rotation.y = Math.PI / 2;
    const step = S.phase === 'walk' ? Math.sin(S.walk * 30) : 0; U.legL.rotation.x = step * 0.7; U.legR.rotation.x = -step * 0.7; U.armL.rotation.x = S.grow ? -0.6 : -step * 0.6; U.armR.rotation.x = S.grow ? -0.6 : step * 0.6;
    if (S.phase === 'fall' && !wasFall) spT = -0.5; wasFall = S.phase === 'fall';
    spT += dt; if (spT > 0 && spT < 1) { splash.position.set(sx + 1, -8.98, 0); const k = 1 + spT * 5; splash.scale.set(k, k, k); splash.material.opacity = 1 - spT; } else splash.material.opacity = 0;
    // 카메라: 지금 기둥과 다음 기둥이 함께 보이게, 앞쪽 조금 위에서
    const midX = S.plat[1] ? (X(a.x) + X(S.plat[1].x + S.plat[1].w)) / 2 : sx;
    cam.position.set(midX - 0.8, 3.2, 17); cam.lookAt(midX, -1.2, 0);
    B.draw();
  }
  return { render, dispose: () => B.dispose() };
}

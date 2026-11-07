// 🚦 무궁화 꽃이 피었습니다 3D 화면 — 운동장 끝 나무 앞의 술래를 향해 달리는 나 (뒤에서 따라가는 시점)
// 규칙은 play-n.js G.mugung 그대로: 서버 단계(ph: sing 노래 · turn 돌아봄 · look 멈춰!)와 내 위치(pos 0~100m)를 그대로 보여 줌
import { base, lam, tex, sky, person } from './g3d.js';

const LEN = 26; // 100m → 운동장 26m

export function createMug3D(canvas, { color = '#ff4d6d', quality = 'high', onSlow, sizeFrom } = {}) {
  const B = base(canvas, { quality, onSlow, fov: 50, sizeFrom }); if (!B) return null;
  const { THREE, scene, cam, hi } = B;
  scene.background = sky([[0, '#5a9be6'], [0.7, '#b5dcff'], [1, '#fff3d6']]); scene.fog = new THREE.Fog('#e8f0e0', 25, 70);
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a5a', 1.1)); const sun = new THREE.DirectionalLight('#fff3d6', 2); sun.position.set(-6, 14, 6); scene.add(sun, sun.target);
  if (hi) { sun.castShadow = true; sun.shadow.mapSize.set(512, 512); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -32, near: 1, far: 60 }); }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 80), lam({ map: tex(64, 64, (c, w, h) => { c.fillStyle = '#d9b98a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { c.fillStyle = ['#cfae7e', '#e3c598', '#c49f70'][i % 3]; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [15, 20]) }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -20; ground.receiveShadow = true; scene.add(ground);
  const lineM = new THREE.MeshBasicMaterial({ color: '#ffffff' }); for (const z of [0.6, -LEN]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.15), lineM); l.rotation.x = -Math.PI / 2; l.position.set(0, 0.01, z); scene.add(l); }
  // 결승 깃발 · 나무 · 학교
  const flagM = lam({ color: '#e5354d' }); for (const x of [-4, 4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), lam({ color: '#ffffff' })); p.position.set(x, 1.1, -LEN); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), flagM); f.position.set(x + 0.4, 1.9, -LEN); scene.add(p, f); }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 4, 8), lam({ color: '#6a4a32' })); trunk.position.set(0, 2, -LEN - 3); scene.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 10), lam({ color: '#4f9a45' })); crown.position.set(0, 5.2, -LEN - 3); scene.add(crown);
  const flowers = lam({ color: '#ff8fb8' }); for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 5), flowers); const a = Math.random() * 6.28; f.position.set(Math.cos(a) * 2.2, 5.2 + Math.sin(a) * 1.8, -LEN - 3 + 1.6); scene.add(f); }
  const school = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 4), lam({ map: tex(128, 64, (c, w, h) => { c.fillStyle = '#efe4cf'; c.fillRect(0, 0, w, h); for (let r = 0; r < 3; r++) for (let i = 0; i < 10; i++) { c.fillStyle = '#7fa6c9'; c.fillRect(6 + i * 12.2, 8 + r * 19, 8, 11); } }) })); school.position.set(0, 5, -LEN - 14); scene.add(school);
  // 술래 (나무를 보고 노래 → 뒤돌아봄) — 눈이 빨갛게 빛나면 멈춰야 함
  const it = person('#7a5cd6', hi); it.scale.setScalar(1.25); it.position.set(0, 0, -LEN - 1.4); scene.add(it);
  const eyeM = new THREE.MeshBasicMaterial({ color: '#ff3040' }); const eyes = [-0.08, 0.08].map((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), eyeM); e.position.set(x, 1.6, 0.18); it.add(e); return e; });
  const me = person(color, hi); scene.add(me); const U = me.userData; me.rotation.y = Math.PI;
  let itRot = 0;

  // st: { v: 서버 상태, holding: 누르는 중, t }
  function render(st) {
    const dt = B.frame(); if (dt == null) return false;
    const v = st.v; const t = st.t;
    // 술래 방향: 노래할 땐 나무 쪽(등을 보임), 돌아보거나 감시할 땐 우리 쪽
    const face = v.ph === 'sing' ? Math.PI : 0; itRot += (face - itRot) * Math.min(1, dt * (v.ph === 'sing' ? 3 : 9)); it.rotation.y = itRot;
    const watching = v.ph !== 'sing'; eyes.forEach((e) => { e.visible = watching; }); eyeM.color.set(v.ph === 'look' ? '#ff2030' : '#ffb020');
    // 나: 위치 = 서버 위치 · 누르는 동안 달리기 · 걸리면 쓰러짐 · 도착하면 만세
    me.position.set(0, 0, -(Math.min(100, v.pos) / 100) * LEN);
    const run = st.holding && !v.out && !v.fin; const ph = run ? t * 12 : 0;
    U.legL.rotation.x = Math.sin(ph) * 0.9; U.legR.rotation.x = -Math.sin(ph) * 0.9; U.armL.rotation.x = -Math.sin(ph) * 0.8; U.armR.rotation.x = Math.sin(ph) * 0.8;
    me.rotation.x = v.out ? -Math.PI / 2 : 0; me.position.y = v.out ? 0.25 : 0;
    if (v.fin) { U.armL.rotation.z = -2.6; U.armR.rotation.z = 2.6; me.position.y = Math.abs(Math.sin(t * 6)) * 0.3; } else { U.armL.rotation.z = 0; U.armR.rotation.z = 0; }
    // 카메라: 내 뒤쪽 위에서 따라감 · 술래가 볼 땐 살짝 긴장감 있게 낮게
    const cz = me.position.z + 5.2; const cy = watching ? 2.0 : 2.6;
    cam.position.set(0.8, cy, cz); cam.lookAt(0, 1.4, me.position.z - 8);
    B.draw(); return true;
  }
  return { render, dispose: () => B.dispose() };
}

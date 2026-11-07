// 🪢 단체 줄넘기 3D 화면 — 운동장에서 두 친구가 돌리는 긴 줄을 넘는 장면
// 규칙·판정은 play-n.js G.rope 그대로 (박자는 서버 박자표 ropeBeats). 줄은 박자표의 위상(ph: 0 = 바닥)대로 실제로 3D로 돌아감
import { base, lam, tex, sky, person } from './g3d.js';

const HX = 3.2, AXY = 1.25, RR = 1.2; // 줄 잡은 손 위치(±x), 회전축 높이, 줄이 그리는 원 반지름

export function createRope3D(canvas, { color = '#ff4d6d', quality = 'high', onSlow, sizeFrom } = {}) {
  const B = base(canvas, { quality, onSlow, fov: 40, sizeFrom }); if (!B) return null;
  const { THREE, scene, cam, hi } = B;
  scene.background = sky([[0, '#4f8fe0'], [0.65, '#a8d3ff'], [1, '#fff0d0']]); scene.fog = new THREE.Fog('#e6efe0', 20, 60);
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a5a', 1.1)); const sun = new THREE.DirectionalLight('#fff3d6', 2); sun.position.set(-4, 12, 8); scene.add(sun, sun.target);
  if (hi) { sun.castShadow = true; sun.shadow.mapSize.set(512, 512); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 40 }); }
  // 운동장 흙바닥 · 학교 건물 · 나무
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), lam({ map: tex(64, 64, (c, w, h) => { c.fillStyle = '#d9b98a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { c.fillStyle = ['#cfae7e', '#e3c598', '#c49f70'][i % 3]; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [20, 15]) }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -15; ground.receiveShadow = true; scene.add(ground);
  const school = new THREE.Group(); const wallM = lam({ map: tex(128, 64, (c, w, h) => { c.fillStyle = '#efe4cf'; c.fillRect(0, 0, w, h); for (let r = 0; r < 3; r++) for (let i = 0; i < 10; i++) { c.fillStyle = '#7fa6c9'; c.fillRect(6 + i * 12.2, 8 + r * 19, 8, 11); } }) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 4), wallM); body.position.y = 4.5; const roof = new THREE.Mesh(new THREE.BoxGeometry(27, 0.6, 4.6), lam({ color: '#5b6b8a' })); roof.position.y = 9.3; const clock = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), lam({ color: '#ffffff' })); clock.position.set(0, 7.6, 2.02); school.add(body, roof, clock); school.position.set(0, 0, -22); scene.add(school);
  const leafM = lam({ color: '#4f9a45' }), trunkM = lam({ color: '#6a4a32' }); for (const x of [-12, -8, 8, 12]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 2.4, 6), trunkM); t.position.set(x, 1.2, -14); const l = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), leafM); l.position.set(x, 3.1, -14); scene.add(t, l); }
  // 줄 돌리는 두 친구 (원래 모습의 친구들 · 다른 팀 색) + 가운데 나
  const turners = [-1, 1].map((s) => { const p = person(s < 0 ? '#3d8bff' : '#2fd27a', hi); p.position.set(s * (HX + 0.35), 0, 0); p.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(p); return p; });
  const me = person(color, hi); me.scale.setScalar(1.05); me.rotation.y = Math.PI; scene.add(me); const U = me.userData;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; scene.add(shadow);
  // 줄: 구슬 40개로 이은 곡선 (매 프레임 새 모양을 만들지 않고 위치만 옮김 → 가벼움)
  const N = 40; const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), lam({ color: '#ffd43b' }), N); beads.castShadow = hi; scene.add(beads); const o3 = new THREE.Object3D();
  let jumpT = 9;

  // st: { ph: 0~1 (0 = 줄이 바닥), jumpAge: 마지막 점프 뒤 지난 초, t }
  function render(st) {
    const dt = B.frame(); if (dt == null) return false;
    const ang = st.ph * Math.PI * 2; const dy = -Math.cos(ang), dz = Math.sin(ang);
    for (let i = 0; i < N; i++) { const x = -HX + (2 * HX * i) / (N - 1); const sag = 1 - (x / HX) ** 2; o3.position.set(x, AXY + dy * RR * sag * 1.0 + (dy < 0 ? 0 : 0), dz * RR * sag); o3.updateMatrix(); beads.setMatrixAt(i, o3.matrix); }
    beads.instanceMatrix.needsUpdate = true;
    // 돌리는 친구들 팔이 줄을 따라 원을 그림
    turners.forEach((p, k) => { const A = p.userData; const s = k ? -1 : 1; A.armR.rotation.x = -1.2 + Math.sin(ang) * 0.6 * s; A.armL.rotation.x = -1.2 - Math.sin(ang) * 0.6 * s; });
    // 나: 점프 (누른 순간부터 0.35초 포물선 · 2D와 같은 시간)
    const ja = st.jumpAge; const air = ja < 0.35 ? Math.sin((ja / 0.35) * Math.PI) : 0;
    me.position.y = air * 0.9; U.legL.rotation.x = air ? -0.7 : 0; U.legR.rotation.x = air ? -0.5 : 0; U.armL.rotation.x = air ? -2.2 : -0.2; U.armR.rotation.x = air ? -2.2 : -0.2;
    shadow.scale.setScalar(1 / (1 + air * 1.5));
    cam.position.set(0.6, 2.2, 8.6); cam.lookAt(0, 1.2, 0);
    B.draw(); return true;
  }
  return { render, dispose: () => B.dispose() };
}

// 🎣 낚시 3D 화면 — 산속 호수 선착장에서 낚싯대를 든 1인칭 시점
// 규칙·판정은 play-n2.js G.fishing 그대로 (기다림 → 입질 → 감기 → 잡기). 여기는 S.st·S.ten·S.prog를 읽어 장면만 움직임
// 입질: 찌가 쑥쑥 잠기며 물결 · 감기: 낚싯대가 휘고 물고기 그림자가 몸부림치며 다가옴 · 잡으면 물고기가 물 위로 튀어 오름
import { base, lam, tex, sky } from './g3d.js';

const FISHC = ['#9fb7c9', '#ff8a3d', '#ffd43b', '#6c7a89', '#ffd700']; // 붕어·열대어·복어·상어·황금 고래
const FISHS = [0.35, 0.35, 0.4, 0.75, 1.1];

export function createFish3D(canvas, { quality = 'high', onSlow } = {}) {
  const B = base(canvas, { quality, onSlow, fov: 60 }); if (!B) return null;
  const { THREE, scene, cam, hi } = B;
  scene.background = sky([[0, '#2a3f7a'], [0.5, '#7d93c8'], [0.78, '#f0b98a'], [1, '#ffe0b0']]);
  scene.fog = new THREE.Fog('#c9a98e', 25, 110);
  scene.add(new THREE.HemisphereLight('#d6e4ff', '#2d4a3a', 1.1));
  const sun = new THREE.DirectionalLight('#ffd9a8', 1.8); sun.position.set(-10, 8, -20); scene.add(sun);

  // 호수: 물결 무늬가 천천히 흐르는 수면 + 해 반사
  const waterTex = tex(128, 128, (c, w, h) => { c.fillStyle = '#2f74b0'; c.fillRect(0, 0, w, h); for (let i = 0; i < 220; i++) { c.strokeStyle = Math.random() < 0.5 ? '#6aa8d8' : '#235f93'; c.lineWidth = 1.5; const x = Math.random() * w, y = Math.random() * h; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 6, y - 2, x + 12, y); c.stroke(); } }, [60, 60]);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshPhongMaterial({ map: waterTex, shininess: 90, specular: '#ffe2b8', transparent: true, opacity: 0.94 }));
  water.rotation.x = -Math.PI / 2; water.position.z = -60; scene.add(water);
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(10, 60), new THREE.MeshBasicMaterial({ color: '#ffe7b8', transparent: true, opacity: 0.18, depthWrite: false })); glint.rotation.x = -Math.PI / 2; glint.position.set(-6, 0.02, -60); scene.add(glint);
  // 건너편 산과 소나무 숲 (안개 속 원근감)
  const mtM = lam({ color: '#4a5d80' }), mtM2 = lam({ color: '#5f7096' });
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(14 + (i % 3) * 5, 16 + (i % 4) * 5, 6), i % 2 ? mtM : mtM2); m.position.set(-80 + i * 20, 6, -100 - (i % 3) * 8); scene.add(m); }
  const pineM = lam({ color: '#2f5d3a' }), pineM2 = lam({ color: '#3b6e44' }), trunkM = lam({ color: '#5a4030' });
  const pineGeo = new THREE.ConeGeometry(1.4, 4.5, 7), trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 5);
  const trees = new THREE.InstancedMesh(pineGeo, pineM, 90), trunks = new THREE.InstancedMesh(trunkGeo, trunkM, 90); const o3 = new THREE.Object3D();
  for (let i = 0; i < 90; i++) { const side = i < 30 ? -1 : i < 60 ? 1 : 0; const x = side === 0 ? -60 + (i - 60) * 4 + Math.random() * 2 : side * (16 + Math.random() * 14); const z = side === 0 ? -70 - Math.random() * 6 : -10 - Math.random() * 60; const s = 0.8 + Math.random() * 0.8; o3.position.set(x, 2.25 * s + 0.6, z); o3.scale.set(s, s, s); o3.updateMatrix(); trees.setMatrixAt(i, o3.matrix); o3.position.y = 0.6 * s; o3.updateMatrix(); trunks.setMatrixAt(i, o3.matrix); }
  trees.material = pineM; scene.add(trees, trunks);
  const shoreM = lam({ color: '#6b8a4a' }); for (const s of [-1, 1]) { const sh = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 90), shoreM); sh.position.set(s * 30, 0.1, -56); scene.add(sh); }
  const farShore = new THREE.Mesh(new THREE.BoxGeometry(200, 1, 10), shoreM); farShore.position.set(0, 0.1, -72); scene.add(farShore);
  // 가까운 갈대 · 물 위 연잎 · 멀리 나룻배 (가까운 것과 먼 것이 함께 보여 깊이감)
  const reedM = lam({ color: '#7d9a4a' }), reedGeo = new THREE.ConeGeometry(0.05, 1.8, 4);
  for (let i = 0; i < 26; i++) { const r = new THREE.Mesh(reedGeo, reedM); const sd = i % 2 ? 1 : -1; r.position.set(sd * (2.8 + Math.random() * 2), 0.8, -1 - Math.random() * 5); r.rotation.z = (Math.random() - 0.5) * 0.3; r.scale.y = 0.7 + Math.random() * 0.6; scene.add(r); }
  const padM = lam({ color: '#4f8f3a' }); for (let i = 0; i < 9; i++) { const pd = new THREE.Mesh(new THREE.CircleGeometry(0.35 + Math.random() * 0.25, 12, 0.3, Math.PI * 1.8), padM); pd.rotation.x = -Math.PI / 2; pd.position.set((Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 4), 0.02, -3 - Math.random() * 10); scene.add(pd); }
  const boat = new THREE.Group(); const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 0.9), lam({ color: '#7a4a2a' })); hull.position.y = 0.2; boat.add(hull); const sailP = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 5), lam({ color: '#5a4030' })); sailP.position.y = 1.2; boat.add(sailP); boat.position.set(-12, 0, -45); boat.rotation.y = 0.4; scene.add(boat);
  // 선착장 (발밑 나무 판자)
  const dock = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 5), lam({ map: tex(64, 128, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#8a6038' : '#9c6e42'; c.fillRect(0, i * h / 8, w, h / 8 - 2); } }) })); dock.position.set(0, 0.5, 1.2); scene.add(dock);
  for (const x of [-1.3, 1.3]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2, 6), trunkM); p.position.set(x, 0, -1.2); scene.add(p); }

  // 낚싯대 (오른쪽 아래에서 앞으로) — 끝부분이 휘도록 마디 2개
  const rodM = lam({ color: '#2b2b33' }); const rod = new THREE.Group(); rod.position.set(1.0, 1.7, 2.7); scene.add(rod);
  const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 2.4, 6), rodM); seg1.position.y = 1.2; rod.add(seg1);
  const tipPivot = new THREE.Group(); tipPivot.position.y = 2.4; rod.add(tipPivot); const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.02, 1.6, 6), rodM); seg2.position.y = 0.8; tipPivot.add(seg2);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), lam({ color: '#c0c6d6' })); reel.rotation.z = Math.PI / 2; reel.position.set(0.08, 0.3, 0); rod.add(reel);
  rod.rotation.set(-0.95, 0, 0.12);
  // 낚싯줄 (끝 → 찌)
  const lineGeo = new THREE.BufferGeometry(); const lp = new Float32Array(3 * 12); lineGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.8 })); scene.add(line);
  // 찌 (위 빨강 · 아래 흰색)
  const bob = new THREE.Group(); const bt = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam({ color: '#ff3b4d' })); const bb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lam({ color: '#ffffff' })); const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), lam({ color: '#ffd43b' })); stick.position.y = 0.25; bob.add(bt, bb, stick); scene.add(bob);
  // 물결 고리 (몇 개를 돌려 씀)
  const rings = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 28), new THREE.MeshBasicMaterial({ color: '#dff1ff', transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.userData.t = 9; scene.add(m); return m; });
  let ri = 0; const ripple = (x, z, big) => { const r = rings[ri++ % rings.length]; r.position.x = x; r.position.z = z; r.userData = { t: 0, big }; };
  // 물속 물고기 그림자 + 잡혔을 때 튀어 오르는 물고기
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: '#0a2340', transparent: true, opacity: 0, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; shadow.scale.set(1.6, 0.6, 1); scene.add(shadow);
  const fishM = new THREE.MeshPhongMaterial({ color: '#9fb7c9', shininess: 80 }); const fish = new THREE.Group();
  const fb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), fishM); fb.scale.set(1.6, 0.8, 0.5); const ft = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 4), fishM); ft.rotation.z = Math.PI / 2; ft.position.x = -0.95; fish.add(fb, ft);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), lam({ color: '#111' })); eye.position.set(0.55, 0.12, 0.2); fish.add(eye); fish.visible = false; scene.add(fish);
  let jumpT = 9, jumpKind = 0, lastScore = null, lastSt = null, biteRip = 0;

  const bobBase = new THREE.Vector3(0, 0, -11);
  function render(S) {
    const dt = B.frame(); if (dt == null) return;
    const t = S.t; waterTex.offset.set(t * 0.01, t * 0.02); boat.position.y = Math.sin(t * 1.2) * 0.06; boat.position.x = -12 + Math.sin(t * 0.05) * 3;
    // 찌 위치: 기다림/입질은 멀리 · 감기 중엔 감은 만큼 다가옴
    const reel = S.st === 'reel'; const pz = reel ? bobBase.z + (S.prog || 0) * 6 : bobBase.z; const px = reel ? Math.sin(t * (2 + S.fish)) * (0.4 + S.fish * 0.15) : 0;
    let py = Math.sin(t * 2) * 0.04;
    if (S.st === 'bite') { py = -0.12 - Math.abs(Math.sin(t * 18)) * 0.16; biteRip -= dt; if (biteRip <= 0) { ripple(px, pz, true); biteRip = 0.25; } }
    else if (reel) { py = -0.08 + Math.sin(t * 9) * 0.05; biteRip -= dt; if (biteRip <= 0) { ripple(px, pz, false); biteRip = 0.4; } }
    else if (Math.random() < dt * 0.4) ripple(px, pz, false);
    if (S.st !== lastSt) { if (S.st === 'bite') ripple(px, pz, true); lastSt = S.st; }
    bob.position.set(px, py, pz); bob.rotation.z = reel ? Math.sin(t * 12) * 0.3 : Math.sin(t * 1.5) * 0.08;
    // 낚싯대: 감을 때 팽팽함(S.ten)만큼 휘고, 입질 때 끝이 까딱
    const bend = reel ? 0.25 + Math.max(0, Math.min(1, S.ten)) * 0.7 : S.st === 'bite' ? 0.2 + Math.abs(Math.sin(t * 18)) * 0.15 : 0.08;
    tipPivot.rotation.x = bend; rod.rotation.x = -0.95 + (reel ? 0.25 : 0) + (S.hold ? 0.1 : 0);
    // 줄: 낚싯대 끝 → 찌 (팽팽하면 곧게, 느슨하면 처짐)
    const tip = new THREE.Vector3(0, 1.6, 0); seg2.localToWorld(tip.set(0, 0.8, 0)); const sag = reel ? 0.1 * (1 - Math.min(1, S.ten)) : 0.9;
    for (let i = 0; i < 12; i++) { const k = i / 11; lp[i * 3] = tip.x + (bob.position.x - tip.x) * k; lp[i * 3 + 1] = tip.y + (bob.position.y + 0.3 - tip.y) * k - Math.sin(k * Math.PI) * sag; lp[i * 3 + 2] = tip.z + (bob.position.z - tip.z) * k; } lineGeo.attributes.position.needsUpdate = true;
    // 물고기 그림자 (감는 동안 몸부림)
    shadow.material.opacity = reel ? 0.55 : 0; if (reel) { const s = FISHS[S.fish] * 2; shadow.position.set(px + Math.sin(t * 5) * 0.3, 0.02, pz - 0.6); shadow.scale.set(1.6 * s, 0.6 * s, 1); shadow.rotation.z = Math.sin(t * (4 + S.fish)) * 0.6; }
    // 잡힘(점수 오름) → 물고기가 물 위로 크게 튀어 오름
    if (lastScore != null && S.score > lastScore && !reel) { jumpT = 0; jumpKind = Math.max(0, Math.min(4, S.fish ?? 0)); fishM.color.set(FISHC[jumpKind]); fish.scale.setScalar(FISHS[jumpKind] * 1.4); ripple(0, bobBase.z + 5, true); }
    lastScore = S.score;
    if (jumpT < 1.4) { jumpT += dt; const k = jumpT / 1.4; fish.visible = true; fish.position.set(Math.sin(k * 3) * 0.3, 0.2 + Math.sin(k * Math.PI) * 3.2, bobBase.z + 5 - k * 1.5); fish.rotation.set(0, 0.35, Math.sin(k * 20) * 0.25 + (0.5 - k) * 1.4); /* 옆모습으로 펄떡 */ } else fish.visible = false;
    for (const r of rings) { const u = r.userData; if (u.t > 2) { r.material.opacity = 0; continue; } u.t += dt; const k = 1 + u.t * (u.big ? 6 : 3); r.scale.set(k, k, k); r.material.opacity = Math.max(0, (u.big ? 0.8 : 0.45) * (1 - u.t / 1.6)); }
    // 카메라: 선착장 위 1인칭 (낚싯대 끝과 찌가 함께 보이게) · 잡을 땐 살짝 들어 올림
    cam.position.set(0.2, 3.1 + (jumpT < 1.4 ? 0.2 : 0), 4.4); cam.lookAt(0, -0.2 + (jumpT < 1.4 ? 0.8 : 0), -10);
    B.draw();
  }
  return { render, dispose: () => B.dispose() };
}

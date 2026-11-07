// 🏹 투호 3D 화면 — 한옥 마당에서 항아리에 화살 던지기
// 규칙·판정은 play-n2.js throwGame('tuho') 그대로: 화면 좌표(x 0~1, y 0.92→0.2)를 마당의 좌우·앞뒤로 옮겨 그림
// 항아리 입구 폭 = 판정 폭(rim 0.075) · 들어간 화살은 항아리에 꽂혀 쌓이고, 빗나간 화살은 바닥에 떨어짐
import { base, lam, tex, sky, person } from './g3d.js';

const XS = 6; // 화면 폭 1.0 = 6m
const ZP = -8; // 항아리까지 거리
const Y0 = 0.92, YT = 0.2; // 던지는 곳 → 항아리 (화면 y)
const wx = (x) => (x - 0.5) * XS;
const wz = (y) => ((Y0 - y) / (Y0 - YT)) * ZP;

export function createTuho3D(canvas, { color = '#ff4d6d', quality = 'high', onSlow, target } = {}) {
  const B = base(canvas, { quality, onSlow, fov: 40 }); if (!B) return null; // 좁은 화각: 항아리가 크게 보이게
  const { THREE, scene, cam, hi } = B;
  scene.background = sky([[0, '#5d8fd6'], [0.6, '#a9cdf0'], [1, '#f3e6c8']]);
  scene.fog = new THREE.Fog('#e9dcc0', 18, 60);
  scene.add(new THREE.HemisphereLight('#e8f1ff', '#8a6a44', 1.15));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.1); sun.position.set(5, 12, 6); sun.target.position.set(0, 0, -6); scene.add(sun, sun.target);
  if (hi) { sun.castShadow = true; sun.shadow.mapSize.set(512, 512); Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 8, bottom: -12, near: 1, far: 40 }); sun.shadow.bias = -0.002; }

  // 마당 (흙바닥 결) + 디딤돌
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), lam({ map: tex(128, 128, (c, w, h) => { c.fillStyle = '#d8bf93'; c.fillRect(0, 0, w, h); for (let i = 0; i < 2500; i++) { c.fillStyle = ['#cdb287', '#e3cda3', '#c4a77a'][i % 3]; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [16, 16]) }));
  yard.rotation.x = -Math.PI / 2; yard.position.z = -20; yard.receiveShadow = true; scene.add(yard);
  const stoneM = lam({ color: '#9a958c' }); for (let i = 0; i < 5; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.12, 10), stoneM); st.position.set(-3.6 + (i % 2) * 0.3, 0.06, -1 - i * 1.6); st.scale.z = 0.7; st.receiveShadow = true; scene.add(st); }

  // 뒤쪽 한옥 (기단·기둥·흰 벽·기와 지붕) — 원근감
  const hanok = new THREE.Group(); hanok.position.set(0, 0, -15); scene.add(hanok);
  const base1 = new THREE.Mesh(new THREE.BoxGeometry(16, 0.7, 4), lam({ color: '#b8b0a2' })); base1.position.y = 0.35; hanok.add(base1);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 2.6, 3), lam({ color: '#f1ead8' })); wall.position.y = 2; hanok.add(wall);
  const woodM = lam({ color: '#7a4a2a' }); for (let i = 0; i <= 6; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.7, 0.3), woodM); p.position.set(-7 + i * (14 / 6), 2.05, 1.55); hanok.add(p); }
  for (let i = 0; i < 6; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.7, 0.08), lam({ map: tex(64, 64, (c, w, h) => { c.fillStyle = '#efe6cf'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8a5a34'; c.lineWidth = 3; for (let k = 0; k <= 4; k++) { c.beginPath(); c.moveTo(k * w / 4, 0); c.lineTo(k * w / 4, h); c.stroke(); c.beginPath(); c.moveTo(0, k * h / 4); c.lineTo(w, k * h / 4); c.stroke(); } }) })); d.position.set(-5.85 + i * (14 / 6), 1.95, 1.52); hanok.add(d); }
  const roofM = lam({ color: '#3d4252' }); const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 3.6, 2.2, 4, 1), roofM); roof.rotation.y = Math.PI / 4; roof.scale.set(3.2, 1, 0.9); roof.position.y = 4.3; hanok.add(roof);
  const eave = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.25, 5), roofM); eave.position.y = 3.3; hanok.add(eave);
  hanok.traverse((m) => { if (m.isMesh) { m.castShadow = hi; m.receiveShadow = hi; } });
  // 돌담 + 나무
  const wallM = lam({ map: tex(64, 32, (c, w, h) => { c.fillStyle = '#8f8a80'; c.fillRect(0, 0, w, h); for (let i = 0; i < 18; i++) { c.fillStyle = ['#a39e94', '#7d786f', '#b3ada2'][i % 3]; c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 7, 5, 0, 0, 7); c.fill(); } }, [6, 1]) });
  for (const x of [-9, 9]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 26), wallM); sw.position.set(x, 0.8, -6); scene.add(sw); }
  const leafM = lam({ color: '#4f8f45' }), trunkM = lam({ color: '#6a4a32' });
  for (const [x, z] of [[-7.5, -11], [7.8, -9], [-11, -4], [11, -14]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 2.4, 6), trunkM); t.position.set(x, 1.2, z); const l = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), leafM); l.position.set(x, 3, z); l.scale.y = 0.8; scene.add(t, l); }
  // 바람 깃발 (바람 방향·세기)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), woodM); pole.position.set(4.6, 1.6, -6); scene.add(pole);
  const flagGeo = new THREE.PlaneGeometry(1.2, 0.6, 6, 1); const flag = new THREE.Mesh(flagGeo, lam({ color: '#e5354d', side: THREE.DoubleSide })); flag.position.set(4.6, 2.9, -6); scene.add(flag);
  const fpos = flagGeo.attributes.position; const f0 = Float32Array.from(fpos.array);

  // 항아리 (입구 폭 = 판정 폭) + 양쪽 귀 + 받침
  const rimR = 0.075 * XS; // 0.45m
  const potM = new THREE.MeshPhongMaterial({ color: '#6f7fc0', shininess: 25, specular: '#5a6488' });
  const prof = [[0.01, 0], [0.42, 0.05], [0.62, 0.35], [0.64, 0.6], [0.48, 0.95], [0.3, 1.12], [rimR * 0.62, 1.28], [rimR * 0.66, 1.34]].map(([r, y]) => new THREE.Vector2(r, y));
  const pot = new THREE.Group(); const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), potM); pot.add(body);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(rimR * 0.62, 20), lam({ color: '#1b1430' })); mouth.rotation.x = -Math.PI / 2; mouth.position.y = 1.33; pot.add(mouth);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.42, 12, 1, true), potM); ear.position.set(s * 0.42, 1.12, 0); pot.add(ear); }
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 1.2), woodM); stand.position.y = -0.09; pot.add(stand);
  pot.traverse((m) => { if (m.isMesh) { m.castShadow = hi; m.receiveShadow = hi; } }); pot.position.set(0, 0.18, ZP); scene.add(pot);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(XS * 0.75, 0.06, 0.5), lam({ color: '#a37b52' })); rail.position.set(0, 0.03, ZP); scene.add(rail);
  const potTop = 0.18 + 1.34;

  // 던지는 사람 (뒷모습)
  const me = person(color, hi); me.position.set(-1.0, 0, 2.2); me.scale.setScalar(0.95); scene.add(me); const U = me.userData;
  // 화살 (깃 달린 막대)
  const shaftM = lam({ color: '#efe2c2' }), tipM = lam({ color: color }), featherM = lam({ color: '#ffffff', side: THREE.DoubleSide });
  const mkArrow = () => { const a = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6), shaftM); s.rotation.x = Math.PI / 2; a.add(s); const tp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), tipM); tp.rotation.x = -Math.PI / 2; tp.position.z = -0.72; a.add(tp); for (const r of [0, Math.PI / 2]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.22), featherM); f.rotation.set(Math.PI / 2, r, 0); f.position.z = 0.56; a.add(f); } a.traverse((m) => { if (m.isMesh) m.castShadow = hi; }); return a; };
  const fly = mkArrow(); fly.scale.setScalar(1.5); scene.add(fly); fly.visible = false; // 날아가는 화살은 잘 보이게 조금 크게
  const ready = mkArrow(); ready.position.set(-0.7, 1.35, 2.1); ready.rotation.x = -1.1; scene.add(ready);
  const stuck = []; const fallen = [];
  // 들어갔을 때 반짝이 (짧게)
  const sparkM = new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true }); const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24), sparkM); ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring); let ringT = 9;

  let prev = null, prevPos = null;
  function render(S) {
    const dt = B.frame(); if (dt == null) return;
    const t = S.t;
    // 항아리 위치 = 판정 목표 x
    const tx = wx(target(S)); pot.position.x = tx;
    // 깃발: 바람 세기만큼 펄럭 + 방향
    const wind = S.wind || 0; flag.rotation.y = wind >= 0 ? 0 : Math.PI; const amp = 0.05 + Math.abs(wind) * 0.5;
    for (let i = 0; i < fpos.count; i++) { const x0 = f0[i * 3]; fpos.array[i * 3 + 2] = Math.sin(t * 6 + x0 * 5) * amp * (x0 + 0.6); fpos.array[i * 3 + 0] = x0 + 0.6; } fpos.needsUpdate = true;
    const o = S.obj;
    if (o) {
      const p = Math.min(1, Math.max(0, (Y0 - o.y) / (Y0 - YT))); const X = wx(o.x), Z = wz(o.y); const Y = 1.35 + (potTop + 0.3 - 1.35) * p + Math.sin(p * Math.PI) * 2.2;
      const pos = new THREE.Vector3(X, Y, Z); fly.visible = true; fly.position.copy(pos);
      if (prevPos && pos.distanceTo(prevPos) > 1e-4) fly.lookAt(pos.clone().sub(pos.clone().sub(prevPos))); // 화살 끝(-z)이 날아가는 방향을 보게
      prevPos = pos; prev = { X, Z, Y };
      U.armR.rotation.x = o.t < 0.25 ? -2.6 + o.t * 6 : -1.1; ready.visible = false;
    } else {
      if (prev) { // 방금 끝남: 들어갔으면 항아리에 꽂고, 아니면 바닥에 떨어뜨림
        const hit = S.flash && performance.now() - S.flash < 250;
        const a = mkArrow();
        if (hit) { a.position.set((Math.random() - 0.5) * 0.12, 1.3 + 0.25, (Math.random() - 0.5) * 0.12); a.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.35, 0, (Math.random() - 0.5) * 0.35); pot.add(a); stuck.push(a); if (stuck.length > 8) pot.remove(stuck.shift()); ring.visible = true; ringT = 0; }
        else { a.position.set(prev.X + (Math.random() - 0.5) * 0.3, 0.05, prev.Z - 0.3); a.rotation.set(-0.05, Math.random() * 6, 0); a.userData.t = 0; scene.add(a); fallen.push(a); }
        prev = null; prevPos = null;
      }
      fly.visible = false; ready.visible = S.cool <= 0; U.armR.rotation.x = -1.1 + Math.sin(t * 2) * 0.05;
    }
    for (let i = fallen.length - 1; i >= 0; i--) { const a = fallen[i]; a.userData.t += dt; if (a.userData.t > 2.2) { scene.remove(a); fallen.splice(i, 1); } }
    if (ring.visible) { ringT += dt; ring.position.set(pot.position.x, potTop + 0.05, ZP); const k = 1 + ringT * 3; ring.scale.set(k, k, k); sparkM.opacity = Math.max(0, 1 - ringT / 0.7); if (ringT > 0.7) ring.visible = false; }
    U.armL.rotation.x = -0.3; U.legL.rotation.x = 0.15; U.legR.rotation.x = -0.15;
    // 카메라: 던지는 사람 오른쪽 어깨 뒤
    cam.position.set(0.9, 2.5, 5.6); cam.lookAt(0, 0.9, ZP + 1);
    B.draw();
  }
  return { render, dispose: () => B.dispose() };
}

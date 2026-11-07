// 🍪 달고나 뽑기 3D 화면 — 양철 판 위의 두툼한 달고나 (위에서 똑바로 보는 카메라)
// 손가락으로 긋는 판정은 play-n2.js G.dalgona 그대로. 모양 선·그은 선·금은 2D로 위에 그려서 손가락 위치와 정확히 맞음
import { base, lam, tex } from './g3d.js';

export function createDalg3D(canvas, { quality = 'high', onSlow } = {}) {
  const B = base(canvas, { quality, onSlow, ortho: true }); if (!B) return null;
  const { THREE, scene, cam, hi } = B;
  scene.add(new THREE.HemisphereLight('#fff4e0', '#3a2a1a', 0.9));
  const key = new THREE.DirectionalLight('#fff1d6', 1.8); key.position.set(-0.5, 0.8, 2.5); key.target.position.set(0.5, -0.6, 0); scene.add(key, key.target);
  if (hi) { key.castShadow = true; key.shadow.mapSize.set(512, 512); Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 10 }); key.shadow.bias = -0.002; }
  // 문구점 나무 탁자
  const table = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshPhongMaterial({ shininess: 20, map: tex(256, 512, (c, w, h) => { for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#5a3a22' : '#66432a'; c.fillRect(0, i * h / 6, w, h / 6 - 2); } c.strokeStyle = '#00000020'; for (let i = 0; i < 120; i++) { const y = Math.random() * h; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w / 3, y + 4, w * 2 / 3, y - 4, w, y); c.stroke(); } }) }));
  table.position.z = -0.3; table.receiveShadow = hi; scene.add(table);
  // 양철 판 (반짝이는 금속) + 달고나 (두툼한 원판 · 거품 구멍 무늬 · 가운데 볼록)
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.03, 48), new THREE.MeshPhongMaterial({ color: '#b9c0cc', shininess: 120, specular: '#ffffff' })); tray.rotation.x = Math.PI / 2; tray.receiveShadow = hi; scene.add(tray);
  const honey = tex(256, 256, (c, w, h) => { const g = c.createRadialGradient(w * 0.4, h * 0.4, w * 0.05, w / 2, h / 2, w * 0.55); g.addColorStop(0, '#f6cf7a'); g.addColorStop(0.7, '#d99a3e'); g.addColorStop(1, '#a8681e'); c.fillStyle = g; c.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(120,70,20,${0.12 + Math.random() * 0.2})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 0, 7); c.fill(); } for (let i = 0; i < 80; i++) { c.fillStyle = 'rgba(255,240,200,0.25)'; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0, 7); c.fill(); } });
  const cookie = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.97, 0.08, 64), [new THREE.MeshPhongMaterial({ color: '#b8762c', shininess: 40 }), new THREE.MeshPhongMaterial({ map: honey, shininess: 60, specular: '#ffe0a0' }), new THREE.MeshPhongMaterial({ color: '#8a5a20' })]);
  cookie.rotation.x = Math.PI / 2; cookie.castShadow = hi; scene.add(cookie);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, 0.35), new THREE.MeshPhongMaterial({ map: honey, transparent: true, opacity: 0.35, shininess: 90 })); dome.visible = false; // (가운데 볼록 표현은 빼 둠 — 위에서 보면 얼룩처럼 보여서)
  // 성공하면 모양이 쏙 빠지며 반짝 · 3번 금 가면 쪼개짐
  let lastK = -1, doneT = 9, lastCrack = 0, shake = 0;

  // st: { k: 몇 번째 달고나, crack, done(시각|0) }
  function render(st) {
    const dt = B.frame(); if (dt == null) return false;
    const hh = -cam.bottom; const cx = 0.5, cy = -hh * 0.5, R = 0.36 * 1.32; // 2D와 같은 자리·크기
    table.scale.set(1, hh, 1); table.position.set(0.5, -hh / 2, -0.3);
    if (st.k !== lastK) { lastK = st.k; doneT = 9; }
    if (st.crack > lastCrack) shake = 0.25; lastCrack = st.crack; shake = Math.max(0, shake - dt);
    const sx = shake > 0 ? Math.sin(shake * 80) * 0.006 : 0;
    tray.position.set(cx, cy, -0.05); tray.scale.set(R * 1.05, 1, R * 1.05);
    cookie.position.set(cx + sx, cy, 0); cookie.scale.set(R, 1, R); dome.position.set(cx + sx, cy, 0.02); dome.scale.set(R * 0.98, R * 0.98, 0.12);
    if (st.done) { doneT = Math.min(doneT, 0); doneT += dt; cookie.rotation.z = st.crack >= 3 ? Math.min(0.3, doneT) : 0; } else cookie.rotation.z = 0;
    B.draw(); return true;
  }
  return { render, dispose: () => B.dispose() };
}

// 🎆 불꽃놀이 3D 화면 — 밤 강가에서 올라가는 폭죽이 공 모양으로 퍼짐
// 규칙·판정은 play-n.js G.fire 그대로 (화면 아무 데나 톡 = 펑, 점수는 서버 박자 기준). 폭죽 위치·높이는 같은 계산으로 보여 줌
import { base, lam, tex } from './g3d.js';

export function createFire3D(canvas, { quality = 'high', onSlow, sizeFrom } = {}) {
  const B = base(canvas, { quality, onSlow, sizeFrom, fov: 55 }); if (!B) return null;
  const { THREE, scene, cam } = B;
  scene.background = tex(4, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#02030c'); g.addColorStop(0.7, '#0d1238'); g.addColorStop(1, '#1d1a4a'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  scene.add(new THREE.HemisphereLight('#5a6aa8', '#0a0a1a', 0.6));
  // 별 · 강 건너 도시 불빛 · 강물 (불꽃이 비침)
  const starG = new THREE.BufferGeometry(); const sp = new Float32Array(300 * 3); for (let i = 0; i < 300; i++) sp.set([(Math.random() - 0.5) * 120, 10 + Math.random() * 40, -50 - Math.random() * 10], i * 3); starG.setAttribute('position', new THREE.BufferAttribute(sp, 3)); scene.add(new THREE.Points(starG, new THREE.PointsMaterial({ color: '#ffffff', size: 0.15 })));
  const winTex = tex(32, 64, (c, w, h) => { c.fillStyle = '#0f1430'; c.fillRect(0, 0, w, h); for (let y = 2; y < h; y += 5) for (let x = 2; x < w; x += 5) if (Math.random() < 0.4) { c.fillStyle = Math.random() < 0.8 ? '#ffd98a' : '#9fd8ff'; c.fillRect(x, y, 3, 3); } });
  for (let i = 0; i < 30; i++) { const hgt = 2 + Math.random() * 9; const m = new THREE.Mesh(new THREE.BoxGeometry(1.4 + Math.random() * 1.5, hgt, 1.5), lam({ map: winTex, emissive: '#222244', emissiveMap: winTex })); m.position.set(-24 + i * 1.65, hgt / 2, -22); scene.add(m); }
  // 강물: 빛을 받지 않아도 보이게 '물결 + 도시 불빛이 비친 세로 줄'을 그린 그림 (전에는 조명 없는 물이라 화면 아래가 새까맸음)
  const waterTex = tex(256, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a2050'); g.addColorStop(1, '#070a1c'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = Math.random() * w; c.fillStyle = Math.random() < 0.75 ? 'rgba(255,214,130,0.35)' : 'rgba(150,210,255,0.3)'; for (let y = 0; y < h * (0.4 + Math.random() * 0.5); y += 3) c.fillRect(x + Math.sin(y * 0.3 + i) * 2, y, 1 + Math.random() * 2, 1.5); }
    c.strokeStyle = 'rgba(160,180,255,0.12)'; c.lineWidth = 1; for (let y = 4; y < h; y += 6) { c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin(x * 0.09 + y) * 1.5); c.stroke(); }
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(120, 30), new THREE.MeshBasicMaterial({ map: waterTex })); water.rotation.x = -Math.PI / 2; water.position.set(0, 0, -8); scene.add(water);
  // 불꽃이 터지면 강물에 같은 색 빛이 번짐
  const flashM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(10, 22), flashM); flash.rotation.x = -Math.PI / 2; flash.position.set(0, 0.02, -6); scene.add(flash);
  const glow = new THREE.PointLight('#ffffff', 0, 40, 1.5); glow.position.set(0, 8, -12); scene.add(glow); // 터질 때 강물·건물이 잠깐 밝아짐
  // 폭죽 꼬리 + 터진 불꽃 (더하기 빛)
  const rockets = []; const rocketM = new THREE.MeshBasicMaterial({ color: '#ffffff' }), trailM = new THREE.MeshBasicMaterial({ color: '#ffbe50', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const mkRocket = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), rocketM)); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.07, 1.6, 6), trailM); tr.position.y = -0.85; g.add(tr); scene.add(g); return g; };
  const bursts = []; const NP = 160;
  const mkBurst = (x, y, hue) => { const g = new THREE.BufferGeometry(); const pos = new Float32Array(NP * 3), vel = []; for (let i = 0; i < NP; i++) { const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); vel.push([r * Math.cos(th), u, r * Math.sin(th)]); pos.set([x, y, -12], i * 3); } g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const m = new THREE.PointsMaterial({ color: new THREE.Color(`hsl(${hue},95%,62%)`), size: 0.35, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); const p = new THREE.Points(g, m); scene.add(p); bursts.push({ p, vel, x, y, t: 0 }); glow.color.set(`hsl(${hue},95%,70%)`); glow.intensity = 60; glow.position.set(x, y, -12); };
  const X = (x) => (x - 0.5) * 18, Y = (y) => 1 + y * 13; // 화면 가로 0~1 → 강 위 좌우, 높이 0~1 → 하늘
  let seenBurst = 0;

  // st: { rockets: [{x, y}], bursts: [{x, y, hue, at}], t }
  function render(st) {
    const dt = B.frame(); if (dt == null) return false;
    while (rockets.length < st.rockets.length) rockets.push(mkRocket());
    rockets.forEach((g, i) => { const r = st.rockets[i]; g.visible = !!r; if (r) g.position.set(X(r.x), Y(r.y * 0.8 + 0.08), -12); });
    for (const b of st.bursts) if (b.at > seenBurst) { seenBurst = b.at; mkBurst(X(b.x), Y(b.y), b.hue); flash.position.x = X(b.x); flashM.color.setHSL((b.hue ?? 40) / 360, 0.9, 0.55); flashM.opacity = 0.55; }
    flashM.opacity = Math.max(0, flashM.opacity - dt * 0.9); water.material.map.offset.y = (st.t * 0.01) % 1; // 물결이 천천히 흐름
    for (let i = bursts.length - 1; i >= 0; i--) { const b = bursts[i]; b.t += dt; const a = b.p.geometry.attributes.position.array; const sp = 5.5 * Math.exp(-b.t * 1.6); for (let k = 0; k < NP; k++) { a[k * 3] += b.vel[k][0] * sp * dt; a[k * 3 + 1] += (b.vel[k][1] * sp - b.t * 2.2) * dt; a[k * 3 + 2] += b.vel[k][2] * sp * dt; } b.p.geometry.attributes.position.needsUpdate = true; b.p.material.opacity = Math.max(0, 1 - b.t / 1.6); if (b.t > 1.6) { scene.remove(b.p); b.p.geometry.dispose(); b.p.material.dispose(); bursts.splice(i, 1); } }
    glow.intensity = Math.max(0, glow.intensity - dt * 90);
    cam.position.set(0, 4, 12); cam.lookAt(0, 6.5, -12);
    B.draw(); return true;
  }
  return { render, dispose: () => B.dispose() };
}

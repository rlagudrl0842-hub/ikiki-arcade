// 🏀 버저비터(농구) 3D 화면 — 체육관 코트에서 좌우로 움직이는 골대에 슛
// 규칙·판정은 play-n2.js throwGame('basket') 그대로: 화면 좌표(x 0~1, y 0.92→0.18)를 코트의 좌우·앞뒤로 옮김
// 림 폭 = 판정 폭(rim 0.085) · 들어가면 그물이 출렁이고, 빗나가면 림 옆으로 튕겨 나감
import { base, lam, tex } from './g3d.js';

const XS = 6, ZH = -7.5, Y0 = 0.92, YT = 0.18, RIMY = 3.05;
const wx = (x) => (x - 0.5) * XS;
const wz = (y) => ((Y0 - y) / (Y0 - YT)) * ZH;

export function createBask3D(canvas, { quality = 'high', onSlow, target } = {}) {
  const B = base(canvas, { quality, onSlow, fov: 44 }); if (!B) return null;
  const { THREE, scene, cam, hi } = B;
  scene.background = new THREE.Color('#1b1730'); scene.fog = new THREE.Fog('#241d3a', 20, 50);
  scene.add(new THREE.HemisphereLight('#fff2dc', '#4a3020', 1.0));
  for (const z of [-2, -9]) { const l = new THREE.PointLight('#fff4e0', 30, 25, 1.6); l.position.set(0, 9, z); scene.add(l); }
  const key = new THREE.DirectionalLight('#ffffff', 1.2); key.position.set(3, 12, 6); key.target.position.set(0, 0, -6); scene.add(key, key.target);
  if (hi) { key.castShadow = true; key.shadow.mapSize.set(512, 512); Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -12, near: 1, far: 40 }); }
  // 나무 마루 코트 + 라인 + 관중석 벽
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 40), new THREE.MeshPhongMaterial({ shininess: 70, specular: '#553a20', map: tex(256, 256, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#c98f52' : '#d39a5c'; c.fillRect(i * w / 16, 0, w / 16, h); } for (let i = 0; i < 600; i++) { c.fillStyle = '#00000010'; c.fillRect(Math.random() * w, Math.random() * h, 1, 6); } }, [3, 4]) }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = -8; floor.receiveShadow = true; scene.add(floor);
  const lineM = new THREE.MeshBasicMaterial({ color: '#ffffff' }); const arc = new THREE.Mesh(new THREE.RingGeometry(6.6, 6.72, 48, 1, Math.PI, Math.PI), lineM); arc.rotation.x = -Math.PI / 2; arc.position.set(0, 0.01, ZH); scene.add(arc);
  const key2 = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 5.8), new THREE.MeshBasicMaterial({ color: '#2f5fb0', transparent: true, opacity: 0.55 })); key2.rotation.x = -Math.PI / 2; key2.position.set(0, 0.008, ZH + 2.9); scene.add(key2);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), lam({ map: tex(256, 96, (c, w, h) => { c.fillStyle = '#2a2448'; c.fillRect(0, 0, w, h); const cols = ['#ff4d6d', '#3d8bff', '#ffd43b', '#2fd27a', '#ffffff']; for (let r = 0; r < 6; r++) for (let i = 0; i < 40; i++) { c.fillStyle = cols[(i * 7 + r) % 5]; c.fillRect(i * 6.4 + 1, 30 + r * 10, 4, 6); } c.fillStyle = '#ffd43b'; c.font = '900 16px sans-serif'; c.textAlign = 'center'; c.fillText('IKIKI BUZZER BEATER', w / 2, 20); }) })); wall.position.set(0, 7, -24); wall.scale.set(1.3, 1, 1); scene.add(wall);
  // 골대 (받침 · 판 · 림 · 그물) — 좌우로 움직임
  const hoop = new THREE.Group(); scene.add(hoop); hoop.position.z = ZH;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, RIMY + 0.9, 10), lam({ color: '#3a3f52' })); pole.position.set(0, (RIMY + 0.9) / 2, -1.3); hoop.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.1), lam({ color: '#3a3f52' })); arm.position.set(0, RIMY + 0.7, -0.8); hoop.add(arm);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.06), new THREE.MeshPhongMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, shininess: 90 })); board.position.set(0, RIMY + 0.45, -0.3); hoop.add(board);
  const sq = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshBasicMaterial({ color: '#ff6b2b', wireframe: true })); sq.position.set(0, RIMY + 0.3, -0.26); hoop.add(sq);
  const rimR = 0.4; // 판정 폭(±0.51m)에 가깝게 조금 크게 그린 림
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.03, 8, 28), lam({ color: '#ff6b2b' })); rim.rotation.x = Math.PI / 2; rim.position.set(0, RIMY, 0.05); hoop.add(rim);
  const netGeo = new THREE.CylinderGeometry(rimR, rimR * 0.6, 0.5, 14, 3, true); const net = new THREE.Mesh(netGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.8 })); net.position.set(0, RIMY - 0.25, 0.05); hoop.add(net);
  hoop.traverse((m) => { if (m.isMesh) m.castShadow = hi; });
  // 공
  const ballM = lam({ map: tex(64, 64, (c, w, h) => { c.fillStyle = '#e8762a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a1a08'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke(); c.beginPath(); c.arc(0, h / 2, w * 0.35, -1.2, 1.2); c.stroke(); c.beginPath(); c.arc(w, h / 2, w * 0.35, 1.94, 4.34); c.stroke(); }) });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), ballM); ball.castShadow = hi; scene.add(ball);
  const bounce = []; let prev = null, swishT = 9;

  function render(S) {
    const dt = B.frame(); if (dt == null) return;
    hoop.position.x = wx(target(S));
    const o = S.obj;
    if (o) {
      const p = Math.min(1, Math.max(0, (Y0 - o.y) / (Y0 - YT))); const X = wx(o.x), Z = wz(o.y) + ZH * 0 ; const Y = 1.6 + (RIMY + 0.35 - 1.6) * p + Math.sin(p * Math.PI) * 2.6;
      ball.position.set(X, Y, Z); ball.rotation.x -= dt * 8; ball.visible = true; prev = { X, Z: ZH };
    } else {
      if (prev) { const hit = S.flash && performance.now() - S.flash < 250; if (hit) { swishT = 0; bounce.push({ x: hoop.position.x, y: RIMY, z: ZH + 0.05, vx: 0, vy: -1, vz: 0.6, t: 0 }); } else bounce.push({ x: prev.X, y: RIMY + 0.2, z: ZH + 0.1, vx: (prev.X - hoop.position.x) * 1.5 || 1, vy: 2, vz: 2, t: 0 }); prev = null; }
      ball.visible = S.cool <= 0; ball.position.set(0, 1.0, 1.5); ball.rotation.set(0, 0, 0);
    }
    // 들어간 공·튕긴 공: 잠깐 떨어지며 튐
    for (let i = bounce.length - 1; i >= 0; i--) { const b = bounce[i]; b.t += dt; b.vy -= 9.8 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; if (b.y < 0.24) { b.y = 0.24; b.vy = Math.abs(b.vy) * 0.6; } if (!b.m) { b.m = new THREE.Mesh(ball.geometry, ballM); scene.add(b.m); } b.m.position.set(b.x, b.y, b.z); if (b.t > 1.6) { scene.remove(b.m); bounce.splice(i, 1); } }
    // 그물 출렁 (들어갔을 때)
    swishT += dt; const sw = swishT < 0.6 ? Math.sin(swishT * 25) * (0.6 - swishT) * 0.5 : 0; net.scale.set(1 - sw * 0.3, 1 + sw, 1 - sw * 0.3);
    cam.position.set(0.4, 2.3, 4.2); cam.lookAt(0, 2.2, ZH);
    B.draw();
  }
  return { render, dispose: () => B.dispose() };
}

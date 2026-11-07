// 🧟 좀비 술래잡기 3D 바닥 — 달빛 아래 폐허 광장 (금 간 아스팔트 · 웅덩이 · 무너진 담 · 깜빡이는 비상등)
// 사람·좀비·미니맵·화살표는 play-n.js 좀비 화면 그대로 2D로 위에 그림. 이 파일은 그 아래 '바닥 장면'만 3D로 그림
// 카메라는 2D 화면과 같은 범위를 위에서 똑바로 봄(ortho) → 바닥 위치가 2D 좌표와 정확히 맞음 · 판정에 영향 없는 장식만 둠(경기장 안에 막는 물체 없음)
import { base, lam, tex } from './g3d.js';

const AW = 1600, AH = 860;

export function createZomb3D(canvas, { quality = 'high', onSlow, sizeFrom } = {}) {
  const B = base(canvas, { quality, onSlow, sizeFrom, ortho: true }); if (!B) return null;
  const { THREE, scene, cam, hi } = B;
  cam.position.set(0, 0, 400); cam.far = 1000;
  scene.add(new THREE.HemisphereLight('#9fb0d8', '#22222a', 1.15));
  const moon = new THREE.DirectionalLight('#c8d8ff', 1.7); moon.position.set(-300, 400, 600); moon.target.position.set(AW / 2, -AH / 2, 0); scene.add(moon, moon.target);
  if (hi) { moon.castShadow = true; moon.shadow.mapSize.set(512, 512); Object.assign(moon.shadow.camera, { left: -1100, right: 1100, top: 700, bottom: -700, near: 10, far: 2000 }); moon.shadow.bias = -0.001; }
  const siren = new THREE.PointLight('#ff2a3a', 0, 700, 1.2); siren.position.set(AW / 2, -AH / 2, 160); scene.add(siren);
  // 바닥: 금 간 아스팔트 (타일 반복) + 녹색 웅덩이 · 잔해 (바닥에 붙은 것만 → 움직임을 막지 않음)
  const asphalt = tex(256, 256, (c, w, h) => { c.fillStyle = '#2b2f36'; c.fillRect(0, 0, w, h); for (let i = 0; i < 2500; i++) { c.fillStyle = ['#33373f', '#24272d', '#3a3e46'][i % 3]; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } c.strokeStyle = '#15171b'; c.lineWidth = 2; for (let k = 0; k < 6; k++) { let x = Math.random() * w, y = Math.random() * h; c.beginPath(); c.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; c.lineTo(x, y); } c.stroke(); } c.fillStyle = '#d9c24a55'; for (let i = 0; i < 4; i++) c.fillRect(w * 0.48, i * h / 4 + 10, 8, h / 8); }, [AW / 256, AH / 256]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(AW, AH), new THREE.MeshPhongMaterial({ map: asphalt, shininess: 8 })); floor.position.set(AW / 2, -AH / 2, 0); floor.receiveShadow = hi; scene.add(floor);
  const out = new THREE.Mesh(new THREE.PlaneGeometry(AW * 3, AH * 3), lam({ color: '#14161b' })); out.position.set(AW / 2, -AH / 2, -2); scene.add(out);
  const slimeM = new THREE.MeshPhongMaterial({ color: '#3fbf4a', emissive: '#0f4a14', shininess: 120, transparent: true, opacity: 0.7 });
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.CircleGeometry(8 + rnd() * 14, 16), slimeM); p.scale.y = 0.6 + rnd() * 0.5; p.position.set(60 + rnd() * (AW - 120), -(60 + rnd() * (AH - 120)), 0.5); scene.add(p); }
  const debrisM = lam({ color: '#4a4e58' }); for (let i = 0; i < 40; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(6 + rnd() * 14, 6 + rnd() * 10, 3), debrisM); d.rotation.z = rnd() * 3; d.position.set(rnd() * AW, -rnd() * AH, 1.5); d.castShadow = hi; scene.add(d); }
  // 경기장 가장자리: 무너진 콘크리트 담 + 드럼통 (그림자가 바닥에 떨어져 입체감)
  const wallM = lam({ map: tex(64, 32, (c, w, h) => { c.fillStyle = '#6a6e78'; c.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { c.fillStyle = ['#5a5e68', '#7a7e88'][i % 2]; c.fillRect(Math.random() * w, Math.random() * h, 4, 3); } }) });
  const edge = (x0, y0, x1, y1) => { const len = Math.hypot(x1 - x0, y1 - y0); let at = 0; while (at < len) { const seg = 60 + rnd() * 120, gap = 20 + rnd() * 60; const L = Math.min(seg, len - at); const k = (at + L / 2) / len; const m = new THREE.Mesh(new THREE.BoxGeometry(L, 18, 20 + rnd() * 40), wallM); m.position.set(x0 + (x1 - x0) * k, -(y0 + (y1 - y0) * k), 12); m.rotation.z = -Math.atan2(y1 - y0, x1 - x0); m.castShadow = hi; scene.add(m); at += L + gap; } };
  edge(0, -12, AW, -12); edge(0, AH + 12, AW, AH + 12); edge(-12, 0, -12, AH); edge(AW + 12, 0, AW + 12, AH);
  const barrelM = new THREE.MeshPhongMaterial({ color: '#8a3a2a', shininess: 30 }), fireM = new THREE.MeshBasicMaterial({ color: '#7dff7a', transparent: true, opacity: 0.8 });
  const fires = []; for (const [x, y] of [[-40, -40], [AW + 40, -40], [-40, AH + 40], [AW + 40, AH + 40], [AW / 2, -46], [AW / 2, AH + 46]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 34, 14), barrelM); b.rotation.x = Math.PI / 2; b.position.set(x, -y, 17); b.castShadow = hi; scene.add(b); const f = new THREE.Mesh(new THREE.ConeGeometry(12, 30, 8), fireM); f.rotation.x = Math.PI / 2; f.position.set(x, -y, 44); scene.add(f); fires.push(f); const l = new THREE.PointLight('#5aff5a', 0.8, 260, 1.5); l.position.set(x, -y, 60); scene.add(l); }

  // st: { cx, cy, VW, VH: 2D 화면의 카메라 중심·보이는 너비/높이(경기장 칸), human: 내가 사람인지, t }
  function render(st) {
    const dt = B.frame(); if (dt == null) return false;
    cam.left = st.cx - st.VW / 2; cam.right = st.cx + st.VW / 2; cam.top = -(st.cy - st.VH / 2); cam.bottom = -(st.cy + st.VH / 2); cam.updateProjectionMatrix();
    // 비상등: 경기장 위를 천천히 돌며 붉게 깜빡 (긴장감)
    siren.intensity = 2.2 + Math.sin(st.t * 6) * 1.8; siren.position.set(AW / 2 + Math.cos(st.t * 0.7) * 500, -AH / 2 + Math.sin(st.t * 0.7) * 250, 160);
    fires.forEach((f, i) => { const s = 0.85 + Math.sin(st.t * 12 + i) * 0.15; f.scale.set(s, s, s); });
    B.draw(); return true;
  }
  return { render, dispose: () => B.dispose() };
}

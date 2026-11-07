// 🥌 컬링 3D 화면 — 실내 빙상장: 던진 자리에서 하우스(과녁)를 바라보는 시점
// 규칙·판정은 play-n2.js G.curling 그대로. 2D 좌표(x 0~1, y 0~1, 하우스 중심 0.5·0.22, 반지름 = 폭의 0.22)를
// 같은 비율로 빙판 위에 옮김 → 화면에서 하우스에 들어간 만큼 실제 점수와 일치
// 멈춘 내 스톤은 그 자리에 남고, 문지르면(스위핑) 빗자루가 스톤 앞을 쓸어 줌
import { base, lam, tex, person } from './g3d.js';

const K = 10; // 화면 폭 1.0 = 빙판 10m

export function createCurl3D(canvas, { color = '#ff4d6d', quality = 'high', onSlow } = {}) {
  const B = base(canvas, { quality, onSlow, fov: 46 }); if (!B) return null;
  const { THREE, scene, cam, hi } = B;
  scene.background = new THREE.Color('#141a30'); scene.fog = new THREE.Fog('#1b2340', 22, 60);
  scene.add(new THREE.HemisphereLight('#e8f0ff', '#3a4466', 1.0));
  for (const z of [-2, -10]) { const l = new THREE.PointLight('#ffffff', 25, 30, 1.6); l.position.set(0, 7, z); scene.add(l); }
  const sun = new THREE.DirectionalLight('#ffffff', 1.1); sun.position.set(2, 10, 4); sun.target.position.set(0, 0, -6); scene.add(sun, sun.target);
  if (hi) { sun.castShadow = true; sun.shadow.mapSize.set(512, 512); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -16, near: 1, far: 30 }); sun.shadow.bias = -0.002; }

  // 빙판 (작은 얼음 알갱이 결) — 하우스 원은 바닥 텍스처에 그림
  const ice = new THREE.MeshPhongMaterial({ color: '#ffffff', shininess: 80, specular: '#9fc3ff', map: tex(128, 128, (c, w, h) => { c.fillStyle = '#eef5ff'; c.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { c.fillStyle = ['#dfeaf9', '#f8fbff', '#e6effb'][i % 3]; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [3, 8]) });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(K * 1.1, 40), ice); sheet.rotation.x = -Math.PI / 2; sheet.position.z = -10; sheet.receiveShadow = true; scene.add(sheet);
  const ringGroup = new THREE.Group(); scene.add(ringGroup);
  // 옆 벽(보드) + 광고판 + 관중석
  const boardM = lam({ map: tex(256, 32, (c, w, h) => { c.fillStyle = '#e94b5f'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '900 18px sans-serif'; for (let i = 0; i < 3; i++) c.fillText('IKIKI CURLING', 6 + i * 88, 22); }, [4, 1]) });
  for (const x of [-K * 0.56, K * 0.56]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 40), boardM); b.position.set(x, 0.35, -10); b.rotation.y = x < 0 ? 0 : Math.PI; scene.add(b); }
  const standM = lam({ color: '#2a3152' }); const fanCols = ['#ff4d6d', '#3d8bff', '#ffd43b', '#2fd27a', '#ffffff', '#b197fc'];
  const fans = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.5, 0.35), lam({ color: '#fff' }), 2 * 4 * 26); const o3 = new THREE.Object3D(); const col = new THREE.Color(); let fi = 0;
  for (const s of [-1, 1]) for (let r = 0; r < 4; r++) { const st = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6 + r * 0.8, 40), standM); st.position.set(s * (6.6 + r * 1.6), (0.6 + r * 0.8) / 2, -10); scene.add(st); for (let k = 0; k < 26; k++) { o3.position.set(s * (6.6 + r * 1.6 + (Math.random() - 0.5) * 0.6), 0.6 + r * 0.8 + 0.25, -28 + k * 1.5 + Math.random() * 0.4); o3.updateMatrix(); fans.setMatrixAt(fi, o3.matrix); fans.setColorAt(fi++, col.set(fanCols[(Math.random() * fanCols.length) | 0])); } }
  scene.add(fans);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), lam({ map: tex(256, 64, (c, w, h) => { c.fillStyle = '#1c2446'; c.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.6})`; c.fillRect(Math.random() * w, Math.random() * h * 0.5, 2, 2); } c.fillStyle = '#ffd43b'; c.font = '900 20px sans-serif'; c.textAlign = 'center'; c.fillText('★ IKIKI ARENA ★', w / 2, h * 0.75); }) })); back.position.set(0, 3.5, -30); back.scale.set(0.7, 0.6, 1); scene.add(back);

  // 스톤: 화강암 + 팀 색 손잡이
  const graniteM = new THREE.MeshPhongMaterial({ color: '#b4b9c3', shininess: 40, map: tex(64, 64, (c, w, h) => { c.fillStyle = '#8a8f99'; c.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { c.fillStyle = ['#6f747e', '#a3a8b1', '#5d626b'][i % 3]; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }) });
  const handleM = lam({ color }); const bandM = lam({ color: '#2b2f38' });
  const mkStone = () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.31, 0.24, 24), graniteM); b.position.y = 0.13; const band = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.315, 0.05, 24), bandM); band.position.y = 0.13; const top = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 16), handleM); top.position.y = 0.27; const hd = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.34), handleM); hd.position.set(0, 0.33, 0.06); g.add(b, band, top, hd); g.traverse((m) => { if (m.isMesh) m.castShadow = hi; }); return g; };
  const stone = mkStone(); scene.add(stone); const rest = [];
  // 스위핑 빗자루 + 스위퍼
  const sweeper = person(color, hi); sweeper.scale.setScalar(0.95); scene.add(sweeper); const SU = sweeper.userData;
  const broom = new THREE.Group(); const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 5), lam({ color: '#c9a36b' })); stick.rotation.x = 0.9; stick.position.set(0, 0.55, 0.35); const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.14), lam({ color: '#222831' })); head.position.y = 0.04; broom.add(stick, head); scene.add(broom);
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(30 * 3), 3)), new THREE.PointsMaterial({ color: '#ffffff', size: 0.06, transparent: true, opacity: 0.8 })); scene.add(dust); const dp = dust.geometry.attributes.position.array;

  let lastAsp = 0, lastO = null, sweepAmt = 0;
  // 2D 화면 비율에 맞춰 하우스·위치를 다시 잡음 (판정이 화면 비율을 쓰므로 똑같이)
  function layout(asp) {
    lastAsp = asp; ringGroup.clear();
    const hz = -(0.9 - 0.22) * K * asp, R = 0.22 * K;
    [[1, '#2f6fe0'], [0.66, '#f6fbff'], [0.33, '#e5354d'], [0.1, '#f6fbff']].forEach(([k, c], i) => { const m = new THREE.Mesh(new THREE.CircleGeometry(R * k, 48), new THREE.MeshPhongMaterial({ color: c, shininess: 60, polygonOffset: true, polygonOffsetFactor: -1 - i, polygonOffsetUnits: -1 - i })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.005 + i * 0.002, hz); m.receiveShadow = true; ringGroup.add(m); });
    const lineM = new THREE.MeshBasicMaterial({ color: '#8fa6c8' }); const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 40), lineM); cl.rotation.x = -Math.PI / 2; cl.position.set(0, 0.012, -10); ringGroup.add(cl);
    const tl = new THREE.Mesh(new THREE.PlaneGeometry(K, 0.05), lineM); tl.rotation.x = -Math.PI / 2; tl.position.set(0, 0.012, hz); ringGroup.add(tl);
    const hog = new THREE.Mesh(new THREE.PlaneGeometry(K * 1.1, 0.12), new THREE.MeshBasicMaterial({ color: '#e5354d' })); hog.rotation.x = -Math.PI / 2; hog.position.set(0, 0.012, -(0.9 - 0.62) * K * asp); ringGroup.add(hog);
  }
  const W3 = (x, y, asp) => [(x - 0.5) * K, -(0.9 - y) * K * asp];

  // st: { o: 움직이는 스톤|null, n: 던진 수, rub, mine: 멈춘 내 스톤 [{x,y}], asp: 화면 높이/폭, t }
  function render(st) {
    const dt = B.frame(); if (dt == null) return;
    if (Math.abs(st.asp - lastAsp) > 0.01) layout(st.asp);
    const o = st.o;
    if (o) { const [X, Z] = W3(o.x, o.y, st.asp); stone.position.set(X, 0, Z); if (o.moving) stone.rotation.y += dt * 2.5; stone.visible = true; }
    else if (st.n < 3) { const [X, Z] = W3(0.5, 0.9, st.asp); stone.position.set(X, 0, Z); stone.rotation.y = 0; stone.visible = true; }
    else stone.visible = false;
    // 멈춘 스톤 남기기
    while (rest.length < st.mine.length) { const s = mkStone(); const m = st.mine[rest.length]; const [X, Z] = W3(m.x, m.y, st.asp); s.position.set(X, 0, Z); s.rotation.y = Math.random() * 6; scene.add(s); rest.push(s); }
    // 스위핑: 문지르는 만큼 빗자루가 스톤 앞을 빠르게 쓸고 얼음 가루가 날림
    const moving = o?.moving; sweepAmt = moving ? Math.min(1, sweepAmt * 0.9 + st.rub * 6) : 0;
    broom.visible = sweeper.visible = !!moving;
    if (moving) {
      const sp = sweepAmt > 0.05 ? 18 : 3; const sw = Math.sin(st.t * sp) * 0.35 * (0.3 + sweepAmt);
      broom.position.set(stone.position.x + sw, 0, stone.position.z - 0.7); broom.rotation.y = sw * 0.6;
      sweeper.position.set(stone.position.x + 0.9, 0, stone.position.z - 0.2); sweeper.rotation.y = Math.PI * 0.75; SU.armL.rotation.x = -0.9 + sw; SU.armR.rotation.x = -0.9 - sw; SU.legL.rotation.x = Math.sin(st.t * 8) * 0.5; SU.legR.rotation.x = -Math.sin(st.t * 8) * 0.5;
      for (let i = 0; i < 30; i++) { const a = (st.t * 3 + i * 0.37) % 1; dp[i * 3] = broom.position.x + (Math.sin(i * 7.1) * 0.4) * a; dp[i * 3 + 1] = 0.05 + a * 0.3 * sweepAmt; dp[i * 3 + 2] = broom.position.z - a * 0.3; } dust.geometry.attributes.position.needsUpdate = true; dust.material.opacity = 0.2 + sweepAmt * 0.7; dust.visible = true;
    } else dust.visible = false;
    // 카메라: 던지는 자리 뒤에서 하우스 쪽으로 · 스톤이 멀리 가면 천천히 따라감
    const [, Zs] = W3(0.5, 0.9, st.asp); const hz = -(0.9 - 0.22) * K * st.asp; const follow = o?.moving ? Math.max(0, Math.min(1, (Zs - stone.position.z) / (Zs - hz))) * 0.5 : 0;
    cam.position.set(0, 2.0 + follow * 0.5, Zs + 4.4 - follow * (Zs - hz) * 0.55); cam.lookAt(0, 0, hz + 1.2);
    lastO = o;
    B.draw();
  }
  return { render, dispose: () => B.dispose() };
}

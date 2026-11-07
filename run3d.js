// 🏃 점프 러너 3D 화면 (Three.js · WebGL)
// 게임 규칙·점수·판정은 play-n2.js의 G.runner 그대로 — 여기는 '보여 주기'만 함 (S 상태를 읽어서 그림)
// 2D 화면의 좌표를 3D로 옮김: 장애물 x(0~1.1) → 앞쪽 거리, 높이(h·y) → 위로, 러너는 제자리에서 달리고 세상이 다가옴
// WebGL이 없거나 느리면 null/onSlow로 알려서 원래 2D 화면으로 돌아감
import * as THREE from './three-0.160.0.min.js';

const D = 20; // 장애물 x 1.0 = 앞으로 20m
const KY = 7; // 높이 1.0 = 7m (러너 키 ≈ S.bh × 7 ≈ 1.7m)
const RX = 0.2; // 2D에서 러너가 서 있는 x
const SEG = 24; // 관중석·조명 반복 간격

function tex(w, h, fn, rep) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; fn(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } t.anisotropy = 4; return t;
}
const lam = (o) => new THREE.MeshLambertMaterial(o);

export function createRunner3D(canvas, { color = '#ff4d6d', quality = 'high', onSlow } = {}) {
  let R;
  try {
    R = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high' && (devicePixelRatio || 1) < 2.5, alpha: false, powerPreference: 'low-power' });
  } catch { return null; }
  const gl = R.getContext(); if (!gl) return null;
  // GPU 없이 CPU로 흉내 내는 WebGL(구형 폰에서 GPU가 막힌 경우 등)은 너무 느려서 처음부터 2D 화면 사용 (점검용 ?r3d=1이면 강제로 3D)
  try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; if (/swiftshader|llvmpipe|software/i.test(name) && !/[?&]r3d=(1|force)/.test(location.search)) { R.dispose(); return null; } } catch { /* */ }
  const hi = quality === 'high';
  R.setPixelRatio(Math.min(devicePixelRatio || 1, hi ? 1.75 : 1));
  R.shadowMap.enabled = hi; R.shadowMap.type = THREE.PCFShadowMap;
  R.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  // 하늘: 해 질 녘 경기장 (위는 진한 파랑 → 지평선은 따뜻한 빛)
  scene.background = tex(4, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b2a6b'); g.addColorStop(0.55, '#5b6fc0'); g.addColorStop(0.8, '#f2a86b'); g.addColorStop(1, '#ffd9a0'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog('#c99a86', 30, 95); // 멀수록 흐려져 깊이감

  const cam = new THREE.PerspectiveCamera(58, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight('#cfe0ff', '#4a3a2a', 1.1));
  const sun = new THREE.DirectionalLight('#ffe2b8', 2.2); sun.position.set(-6, 14, 6); sun.target.position.set(0, 0, -6); scene.add(sun, sun.target);
  if (hi) { sun.castShadow = true; sun.shadow.mapSize.set(512, 512); const sc = sun.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 10; sc.bottom = -14; sc.near = 1; sc.far = 40; sun.shadow.bias = -0.002; }

  // 바닥: 잔디 + 3레인 트랙 (텍스처를 밀어서 달리는 느낌)
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), lam({ map: tex(64, 64, (c, w, h) => { c.fillStyle = '#3f8a3a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { c.fillStyle = Math.random() < 0.5 ? '#4f9c46' : '#357a31'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } c.fillStyle = '#ffffff10'; c.fillRect(0, 0, w, h / 2); }, [60, 60]) }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.02, -60); grass.receiveShadow = true; scene.add(grass);
  const trackTex = tex(256, 256, (c, w, h) => {
    c.fillStyle = '#b5482f'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { c.fillStyle = Math.random() < 0.5 ? '#c4553a' : '#a03f29'; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
    c.fillStyle = '#f4efe6'; for (const x of [0, 1 / 3, 2 / 3, 1]) c.fillRect(x * w - 3, 0, 6, h);
  }, [1, 12]);
  const track = new THREE.Mesh(new THREE.PlaneGeometry(6, 240), lam({ map: trackTex }));
  track.rotation.x = -Math.PI / 2; track.position.set(0, 0, -100); track.receiveShadow = true; scene.add(track);
  const curbM = lam({ color: '#e8e2d6' }); for (const x of [-3.15, 3.15]) { const cb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 240), curbM); cb.position.set(x, 0.06, -100); cb.receiveShadow = true; scene.add(cb); }

  // 양쪽 관중석 (계단 + 관중) · 조명탑 — 일정 간격으로 반복해서 지나감
  const world = new THREE.Group(); scene.add(world);
  const standM = lam({ color: '#56607a' }), standM2 = lam({ color: '#6b7592' });
  const fanCols = ['#ff4d6d', '#3d8bff', '#ffd43b', '#2fd27a', '#ffffff', '#ff9f43', '#b197fc'];
  const fanGeo = new THREE.BoxGeometry(0.42, 0.55, 0.36);
  const NSEG = 6; const fans = new THREE.InstancedMesh(fanGeo, lam({ color: '#ffffff' }), NSEG * 2 * 3 * 22); let fi = 0; const o3 = new THREE.Object3D(); const col = new THREE.Color();
  for (let s = 0; s < NSEG; s++) for (const side of [-1, 1]) {
    for (let r = 0; r < 3; r++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6 + r * 0.9, SEG), r % 2 ? standM2 : standM); st.position.set(side * (5.6 + r * 2.2), (0.6 + r * 0.9) / 2, -s * SEG); world.add(st);
      for (let k = 0; k < 22; k++) { o3.position.set(side * (5.3 + r * 2.2 + (Math.random() - 0.5) * 0.9), 0.6 + r * 0.9 + 0.28, -s * SEG - SEG / 2 + (k + Math.random() * 0.6) * (SEG / 22)); o3.updateMatrix(); fans.setMatrixAt(fi, o3.matrix); fans.setColorAt(fi, col.set(fanCols[(Math.random() * fanCols.length) | 0])); fi++; }
    }
    if (s % 2 === 0) { // 조명탑
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 14, 6), lam({ color: '#3a3f52' })); pole.position.set(side * 13, 7, -s * SEG - 6); world.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 0.3), new THREE.MeshBasicMaterial({ color: '#fff6d8' })); lamp.position.set(side * 13, 14.2, -s * SEG - 6); lamp.lookAt(0, 0, -s * SEG); world.add(lamp);
    }
  }
  world.add(fans);
  // 멀리 보이는 언덕 (안개 속으로 사라짐)
  const hillM = lam({ color: '#5d6f8f' }); for (let i = 0; i < 7; i++) { const hl = new THREE.Mesh(new THREE.SphereGeometry(18 + (i % 3) * 6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), hillM); hl.position.set(-60 + i * 20, -2, -120 - (i % 2) * 15); hl.scale.y = 0.45; scene.add(hl); }

  // 100m마다 지나가는 아치 (돌파 지점)
  const arch = new THREE.Group(); const archM = lam({ color: '#ffd43b' });
  for (const x of [-3.3, 3.3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.4, 0.3), archM); p.position.set(x, 2.2, 0); p.castShadow = hi; arch.add(p); }
  const bannerCv = document.createElement('canvas'); bannerCv.width = 512; bannerCv.height = 96; const bannerTex = new THREE.CanvasTexture(bannerCv); bannerTex.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Mesh(new THREE.BoxGeometry(7, 1, 0.25), [archM, archM, archM, archM, new THREE.MeshBasicMaterial({ map: bannerTex }), archM]); banner.position.y = 4.4; arch.add(banner); scene.add(arch);
  let bannerFor = -1; const setBanner = (m) => { if (m === bannerFor) return; bannerFor = m; const c = bannerCv.getContext('2d'); c.fillStyle = '#1b2250'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#ffd43b'; c.font = '900 64px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`${m}m`, 256, 50); bannerTex.needsUpdate = true; };

  // 장애물: 허들(보통) · 상자 더미(큰 것) · 위에 매달린 막대(날아오는 것) — 판정 크기 그대로
  const obsPool = []; const hurdleM = lam({ color: '#ffffff' }), redM = lam({ color: '#e5354d' }), crateM = lam({ map: tex(64, 64, (c, w, h) => { c.fillStyle = '#b0773f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7a4f24'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.stroke(); }) }), beamM = lam({ color: '#ff9f43' });
  const box1 = new THREE.BoxGeometry(1, 1, 1);
  function obsMesh(o) {
    const g = new THREE.Group(); const hgt = o.h * KY, dep = Math.max(0.3, o.w * D);
    if (o.fly) { // 머리 높이에 걸린 막대 (점프하면 부딪힘)
      const y0 = 0.3 * KY; const bar = new THREE.Mesh(box1, beamM); bar.scale.set(5.6, hgt, dep * 0.6); bar.position.y = y0 + hgt / 2; g.add(bar);
      for (const x of [-2.9, 2.9]) { const p = new THREE.Mesh(box1, redM); p.scale.set(0.2, y0 + hgt + 0.4, 0.2); p.position.set(x, (y0 + hgt + 0.4) / 2, 0); g.add(p); }
    } else if (o.w > 0.07) { // 큰 장애물: 상자 더미
      for (const x of [-1.9, 0, 1.9]) { const b = new THREE.Mesh(box1, crateM); b.scale.set(1.6, hgt, dep); b.position.set(x, hgt / 2, 0); g.add(b); }
    } else { // 허들
      const top = new THREE.Mesh(box1, redM); top.scale.set(5.6, 0.22, 0.12); top.position.y = hgt - 0.11; g.add(top);
      const stripe = new THREE.Mesh(box1, hurdleM); stripe.scale.set(5.62, 0.08, 0.13); stripe.position.y = hgt - 0.11; g.add(stripe);
      for (const x of [-2.7, 2.7]) { const p = new THREE.Mesh(box1, hurdleM); p.scale.set(0.12, hgt, 0.12); p.position.set(x, hgt / 2, 0); g.add(p); const f = new THREE.Mesh(box1, hurdleM); f.scale.set(0.12, 0.1, dep + 0.5); f.position.set(x, 0.05, 0.2); g.add(f); }
    }
    g.traverse((m) => { if (m.isMesh) { m.castShadow = hi; m.receiveShadow = hi; } });
    scene.add(g); return g;
  }

  // 러너 (팀 색 유니폼) — 팔다리는 어깨·엉덩이에서 흔들림
  const runner = new THREE.Group(); scene.add(runner);
  const skin = lam({ color: '#ffd7b5' }), shirt = lam({ color }), shorts = lam({ color: '#1f2440' }), shoe = lam({ color: '#f4f4f4' }), hair = lam({ color: '#22202a' });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 4, 8), shirt); torso.position.y = 1.12; runner.add(torso);
  const hip = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.08, 4, 8), shorts); hip.position.y = 0.82; runner.add(hip);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), skin); head.position.y = 1.58; runner.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair); cap.position.y = 1.6; runner.add(cap);
  const limb = (len, r, m) => { const pv = new THREE.Group(); const ms = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 6), m); ms.position.y = -len / 2 - r; pv.add(ms); return pv; };
  const legL = limb(0.5, 0.09, skin), legR = limb(0.5, 0.09, skin); legL.position.set(-0.12, 0.82, 0); legR.position.set(0.12, 0.82, 0); runner.add(legL, legR);
  for (const lg of [legL, legR]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.28), shoe); s.position.set(0, -0.76, -0.05); lg.add(s); }
  const armL = limb(0.4, 0.07, shirt), armR = limb(0.4, 0.07, shirt); armL.position.set(-0.32, 1.36, 0); armR.position.set(0.32, 1.36, 0); runner.add(armL, armR);
  runner.traverse((m) => { if (m.isMesh) m.castShadow = hi; });
  // 가짜 그림자(원) — 그림자 기능이 꺼진 기기에서도 높이가 느껴지게
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.015; scene.add(blob);

  // 돌파 축하 꽃가루 (짧게)
  const NP = 70; const pGeo = new THREE.BufferGeometry(); const pPos = new Float32Array(NP * 3), pVel = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3);
  for (let i = 0; i < NP; i++) { col.set(fanCols[i % fanCols.length]); pCol.set([col.r, col.g, col.b], i * 3); }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const confetti = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true })); confetti.visible = false; scene.add(confetti); let confT = 9;
  const burst = (z) => { for (let i = 0; i < NP; i++) { pPos.set([(Math.random() - 0.5) * 6, 4.2, z], i * 3); pVel.set([(Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 3], i * 3); } confT = 0; confetti.visible = true; };

  let lastMile = 0, lastT = performance.now(), frames = [], slowCalled = false, lost = false, nF = 0;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (lost) return; lost = true; onSlow?.('lost'); }); // 직접 정리할 때는 무시

  function render(S) {
    if (lost) return;
    const now = performance.now(); const dt = Math.min(0.05, (now - lastT) / 1000); const fdt = now - lastT; lastT = now;
    // 느린 기기면 2D 화면으로 (처음 2초는 빼고 90프레임 중간값이 33ms 넘으면)
    // 첫 10프레임은 준비 시간이라 빼고, 30프레임 모이면 판정 → 느리면 바로 2D로 (느린 채로 두면 게임 시간도 늘어지니까 빨리)
    nF++; if (!slowCalled && nF > 5 && !/[?&]r3d=force/.test(location.search)) { frames.push(fdt); if (frames.length >= 20) { frames.sort((a, b) => a - b); if (frames[10] > 33) { slowCalled = true; onSlow?.('slow'); return; } frames = []; } }
    const w = canvas.clientWidth | 0, h = canvas.clientHeight | 0; if (!w || !h) return;
    if (canvas.width !== Math.round(w * R.getPixelRatio()) || canvas.height !== Math.round(h * R.getPixelRatio())) { R.setSize(w, h, false); cam.aspect = w / h; cam.fov = w / h < 0.8 ? 62 : 50; cam.updateProjectionMatrix(); }
    const off = S.dist * 1.1; // 장애물이 다가오는 속도와 같은 속도로 바닥·관중석이 흐름
    trackTex.offset.y = (off / 20) % 1; world.position.z = off % (SEG * 2);
    // 장애물: 2D x → 앞쪽 거리
    while (obsPool.length < S.obs.length) obsPool.push(null);
    S.obs.forEach((o, i) => { if (!o.__m) { o.__m = obsMesh(o); } const m = o.__m; m.position.z = -(o.x + o.w / 2 - RX) * D; if (o.hit) { m.rotation.x = Math.min(1.2, (m.rotation.x || 0) + dt * 4); m.traverse((x) => { if (x.isMesh && !x.material.__ghost) { x.material = x.material.clone(); x.material.transparent = true; x.material.opacity = 0.45; x.material.__ghost = true; } }); } });
    for (const c of scene.children.slice()) if (c.isGroup && c !== world && c !== runner && c !== arch && !S.obs.some((o) => o.__m === c)) { scene.remove(c); c.traverse((x) => { if (x.isMesh && x.material.__ghost) x.material.dispose(); }); }
    // 100m 아치: 다음 돌파 지점까지 남은 거리
    const nextM = (Math.floor(S.dist / 100) + 1) * 100; setBanner(nextM); arch.position.z = -(nextM - S.dist) * 1.1;
    const mile = Math.floor(S.dist / 100); if (mile > lastMile) { lastMile = mile; burst(-1.5); } else if (mile < lastMile) lastMile = mile;
    // 러너 자세
    const stun = S.stun > 0; const ph = stun ? 0 : S.t * 9.5; const air = S.y > 0.002; const sw = Math.sin(ph);
    runner.position.y = S.y * KY; runner.rotation.x = stun ? -0.35 : air ? -0.12 : -0.08;
    legL.rotation.x = air ? -0.9 : sw * 0.8; legR.rotation.x = air ? 0.5 : -sw * 0.8; armL.rotation.x = air ? -2.4 : -sw * 0.9; armR.rotation.x = air ? -2.4 : sw * 0.9;
    torso.position.y = 1.12 + (air || stun ? 0 : Math.abs(Math.cos(ph)) * 0.05);
    runner.visible = !(stun && Math.floor(now / 100) % 2);
    const sk = 1 / (1 + S.y * 2.5); blob.scale.set(sk, sk, 1); blob.material.opacity = 0.35 * sk;
    // 카메라: 러너 뒤 오른쪽 위에서 따라감 (점프하면 살짝 따라 올라감 · 흔들림 없음)
    cam.position.set(1.7, 3.4 + S.y * KY * 0.3, 7.6); cam.lookAt(0, 0.9 + S.y * KY * 0.2, -10);
    if (confetti.visible) { confT += dt; for (let i = 0; i < NP; i++) { pVel[i * 3 + 1] -= 9 * dt; for (let k = 0; k < 3; k++) pPos[i * 3 + k] += pVel[i * 3 + k] * dt; } pGeo.attributes.position.needsUpdate = true; if (confT > 1.6) confetti.visible = false; }
    R.render(scene, cam);
  }
  function dispose() {
    lost = true; try { scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose?.(); }); }); scene.background?.dispose?.(); R.dispose(); R.forceContextLoss?.(); } catch { /* */ }
  }
  return { render, dispose };
}

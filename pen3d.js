// ⚽ 승부차기 3D 화면 — 밤 경기장, 공 뒤에서 골대를 보는 시점
// 규칙·판정은 play-n2.js G.penalty 그대로 (골대 6칸 중 터치한 칸으로 슛, 결과는 서버가 정함)
// 터치 칸이 화면의 같은 자리(가로 10~90%, 세로 12~54%)에 오도록 카메라를 맞춤 → 보이는 골대 칸 = 누르는 칸
import { base, lam, tex, person } from './g3d.js';

const GW = 5; // 골대 폭(m)
const D = 12; // 카메라 ~ 골라인 거리
const CY = 2.6; // 카메라 높이 (조금 위에서 내려다봐서 잔디·그물 깊이가 보이게)

export function createPen3D(canvas, { color = '#ff4d6d', quality = 'high', onSlow } = {}) {
  const B = base(canvas, { quality, onSlow, fov: 50 }); if (!B) return null;
  const { THREE, scene, cam, hi } = B;
  scene.background = tex(4, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#060a1f'); g.addColorStop(0.7, '#17204a'); g.addColorStop(1, '#2a3570'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog('#141c40', 30, 80);
  scene.add(new THREE.HemisphereLight('#c8d6ff', '#1d3a1d', 0.9));
  const flood = new THREE.DirectionalLight('#ffffff', 2.2); flood.position.set(-6, 14, 10); flood.target.position.set(0, 0, 0); scene.add(flood, flood.target);
  if (hi) { flood.castShadow = true; flood.shadow.mapSize.set(512, 512); Object.assign(flood.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 }); flood.shadow.bias = -0.002; }

  // 잔디 (줄무늬 + 페널티 박스 선)
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), lam({ map: tex(256, 256, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#2f8a3a' : '#38a046'; c.fillRect(0, (i * h) / 8, w, h / 8); } for (let i = 0; i < 1500; i++) { c.fillStyle = Math.random() < 0.5 ? '#2a7d34' : '#43ad50'; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }, [1, 1]) }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.z = 10; pitch.receiveShadow = true; scene.add(pitch);
  const lineM = new THREE.MeshBasicMaterial({ color: '#f4f4f4' }); const ln = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineM); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.01, z); scene.add(m); };
  ln(30, 0.12, 0, 0); ln(16, 0.12, 0, 9); ln(0.12, 9, -8, 4.5); ln(0.12, 9, 8, 4.5); ln(8.5, 0.12, 0, 3.5); ln(0.12, 3.5, -4.25, 1.75); ln(0.12, 3.5, 4.25, 1.75);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), lineM); spot.rotation.x = -Math.PI / 2; spot.position.set(0, 0.012, 7.5); scene.add(spot);
  // 관중석 + 조명탑 (골대 뒤)
  // 관중: 상자 대신 '사람이 빽빽이 앉은 그림'을 계단식 관중석에 붙임 (멀리서 보면 진짜 관중처럼 · 물체 수도 적어 가벼움)
  const fanCols = ['#ff4d6d', '#3d8bff', '#ffd43b', '#2fd27a', '#ffffff', '#ff9f43', '#9b5de5'];
  const crowd = (seed) => tex(512, 96, (c, w, h) => {
    let r = seed; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    c.fillStyle = '#1a1f3d'; c.fillRect(0, 0, w, h);
    for (let row = 0; row < 3; row++) for (let x = 0; x < w; x += 9 + rnd() * 3) {
      const y = 20 + row * 28 + rnd() * 4; const k = 0.75 + rnd() * 0.25;
      c.fillStyle = fanCols[(rnd() * fanCols.length) | 0]; c.globalAlpha = k; c.beginPath(); c.ellipse(x, y + 12, 5, 9, 0, 0, 7); c.fill(); // 옷
      c.fillStyle = ['#f1c8a5', '#d9a77f', '#8a5a3c', '#2b2420'][(rnd() * 4) | 0]; c.beginPath(); c.arc(x, y, 3.6, 0, 7); c.fill(); // 얼굴
      if (rnd() < 0.18) { c.fillStyle = fanCols[(rnd() * fanCols.length) | 0]; c.fillRect(x - 1, y - 14, 2, 8); c.fillRect(x - 4, y - 18, 8, 5); } // 응원 깃발
    }
    c.globalAlpha = 1;
  }, [4, 1]);
  const col = new THREE.Color();
  for (let r = 0; r < 4; r++) {
    const z = -9 - r * 2.2, y = 0.6 + r * 1.5;
    const step = new THREE.Mesh(new THREE.BoxGeometry(46, 0.3, 2.2), lam({ color: '#2a3058' })); step.position.set(0, y - 0.15, z); scene.add(step);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(46, 1.5), lam({ map: crowd(7 + r * 13) })); wall.position.set(0, y + 0.75, z - 0.6); scene.add(wall);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(48, 0.4, 10), lam({ color: '#11152e' })); roof.position.set(0, 7.6, -14); scene.add(roof);
  const adM = lam({ map: tex(256, 32, (c, w, h) => { c.fillStyle = '#0f1a3a'; c.fillRect(0, 0, w, h); c.fillStyle = '#22e1ff'; c.font = '900 18px sans-serif'; for (let i = 0; i < 3; i++) c.fillText('IKIKI FC', 10 + i * 90, 23); }, [5, 1]) }); const ad = new THREE.Mesh(new THREE.BoxGeometry(40, 0.8, 0.1), adM); ad.position.set(0, 0.4, -6.5); scene.add(ad);
  for (const x of [-16, 16]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 16, 6), lam({ color: '#3a3f52' })); pole.position.set(x, 8, -14); scene.add(pole); const lamp = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 0.3), new THREE.MeshBasicMaterial({ color: '#fffbe6' })); lamp.position.set(x, 16, -14); scene.add(lamp); }

  // 골대 (높이는 화면 비율에 맞춰 다시 만듦) + 그물
  const goal = new THREE.Group(); scene.add(goal); let GH = 2.4, lastAsp = 0; let net = null;
  const postM = lam({ color: '#ffffff' });
  const netTex = tex(64, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.5; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.stroke(); c.beginPath(); c.moveTo(0, i * h / 4); c.lineTo(w, i * h / 4); c.stroke(); } });
  function buildGoal(asp) {
    lastAsp = asp; goal.clear(); GH = GW * 0.42 * asp / 0.8; // 터치 칸 비율에 맞춘 골대 높이
    const p = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), postM); m.position.set(x, y, z); m.castShadow = hi; goal.add(m); };
    p(0.14, GH, 0.14, -GW / 2, GH / 2, 0); p(0.14, GH, 0.14, GW / 2, GH / 2, 0); p(GW + 0.14, 0.14, 0.14, 0, GH, 0);
    const nt = netTex.clone(); nt.needsUpdate = true; nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.repeat.set(GW * 2, GH * 2);
    const nm = new THREE.MeshBasicMaterial({ map: nt, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    net = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH, 8, 6), nm); net.position.set(0, GH / 2, -1.6); goal.add(net);
    for (const s of [-1, 1]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(1.6, GH), nm); sd.rotation.y = Math.PI / 2; sd.position.set(s * GW / 2, GH / 2, -0.8); goal.add(sd); }
    const tp = new THREE.Mesh(new THREE.PlaneGeometry(GW, 1.6), nm); tp.rotation.x = Math.PI / 2; tp.position.set(0, GH, -0.8); goal.add(tp);
  }
  const zoneX = (z) => -GW / 2 + GW * ((z % 3) + 0.5) / 3, zoneY = (z) => GH * (1 - (Math.floor(z / 3) + 0.5) / 2);

  // 골키퍼 (노란 유니폼) · 공 · 나(킥하는 다리만 살짝 보임)
  const keeper = person('#ffd43b', hi); keeper.scale.setScalar(1.15); scene.add(keeper); const KU = keeper.userData;
  for (const a of [KU.armL, KU.armR]) a.children[0].material = lam({ color: '#ffd43b' });
  const gloveM = lam({ color: '#ffffff' }); for (const a of [KU.armL, KU.armR]) { const gl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), gloveM); gl.position.y = -0.62; a.add(gl); } // 골키퍼 장갑
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), lam({ map: tex(128, 64, (c, w, h) => { c.fillStyle = '#fafafa'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b1b1b'; for (let i = 0; i < 10; i++) { const x = (i % 5) * w / 5 + (i < 5 ? 0 : w / 10), y = i < 5 ? h * 0.3 : h * 0.72; c.beginPath(); for (let k = 0; k < 5; k++) { const an = k / 5 * Math.PI * 2; c.lineTo(x + Math.cos(an) * 7, y + Math.sin(an) * 7); } c.fill(); } }) }));
  ball.castShadow = hi; scene.add(ball); let ballZ = 7.5;
  const me = person(color, hi); me.visible = false; scene.add(me);
  // 골 축하 꽃가루
  const NP = 60; const pg = new THREE.BufferGeometry(); const pp = new Float32Array(NP * 3), pv = new Float32Array(NP * 3), pc = new Float32Array(NP * 3); for (let i = 0; i < NP; i++) { col.set(fanCols[i % fanCols.length]); pc.set([col.r, col.g, col.b], i * 3); }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3)); const conf = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.12, vertexColors: true })); conf.visible = false; scene.add(conf); let confT = 9, lastAt = 0, celebrated = false;

  // 터치 칸이 화면의 같은 자리에 오도록 카메라 투영을 직접 정함 (가로 10~90% · 세로 12~54%)
  function project() {
    const n = 0.1, f = 200; const Rr = (GW * n / D) / 0.8; const l = (-GW / 2) * n / D - 0.1 * Rr; const V = (GH * n / D) / 0.42; const t = (GH - CY) * n / D + 0.12 * V;
    cam.position.set(0, CY, D); cam.rotation.set(0, 0, 0); cam.updateMatrixWorld();
    cam.projectionMatrix.makePerspective(l, l + Rr, t, t - V, n, f); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    // 공 자리: 화면 세로 85% 지점에 오는 거리
    const dist = (0.15 - CY) * n / (t - 0.85 * V); ballZ = Math.max(1, Math.min(D - 1, D - dist)); spot.position.z = ballZ;
  }

  // st: { a: { z, at, res:{res,keeper}|null } | null, t }
  function render(st) {
    const dt = B.frame(); if (dt == null) return;
    const asp = canvas.clientHeight / Math.max(1, canvas.clientWidth); if (Math.abs(asp - lastAsp) > 0.01) buildGoal(asp);
    project();
    const a = st.a; const now = performance.now(); const k = a ? Math.min(1, (now - a.at) / 500) : 0;
    // 공: 슛한 칸으로 날아감 (골이면 그물까지, 막히면 키퍼 앞에서 튕김, 빗나가면 골대 밖으로)
    if (a && now - a.at < 1500) {
      const res = a.res?.res; const tx = zoneX(a.z) + (res === 'miss' ? (a.z % 3 === 0 ? -1.4 : a.z % 3 === 2 ? 1.4 : 0) : 0), ty = zoneY(a.z) + (res === 'miss' && a.z % 3 === 1 ? GH * 0.6 : 0);
      const tz = res === 'goal' ? -1.4 : res === 'save' ? 0.6 : -0.5; const kk = Math.min(1, (now - a.at) / 500);
      let x = tx * kk, y = 0.15 + (ty - 0.15) * kk + Math.sin(kk * Math.PI) * 0.6, z = ballZ + (tz - ballZ) * kk;
      if (res === 'save' && kk >= 1) { const b = Math.min(1, (now - a.at - 500) / 500); x = tx * (1 - b * 0.3); y = Math.max(0.15, ty - b * ty); z = tz + b * 2.5; }
      ball.position.set(x, y, z); ball.rotation.x -= dt * 14;
      if (res === 'goal' && kk >= 1 && net) { net.position.z = -1.6 - Math.sin(Math.min(1, (now - a.at - 500) / 400) * Math.PI) * 0.4; if (!celebrated) { celebrated = true; confT = 0; conf.visible = true; for (let i = 0; i < NP; i++) { pp.set([ (Math.random() - 0.5) * GW, GH, -0.5], i * 3); pv.set([(Math.random() - 0.5) * 6, 2 + Math.random() * 4, 2 + Math.random() * 3], i * 3); } } }
    } else { ball.position.set(0, 0.15, ballZ); ball.rotation.set(0, 0, 0); if (net) net.position.z = -1.6; celebrated = false; }
    if (a && a.at !== lastAt) { lastAt = a.at; }
    // 키퍼: 평소엔 좌우로 살짝 · 결과가 오면 그 칸으로 몸을 날림
    const kz = a?.res ? a.res.keeper : null; const kk2 = a?.res ? k : 0;
    const kx = kz != null ? zoneX(kz) : Math.sin(st.t * 1.6) * 0.5; const ky = kz != null ? Math.max(0, zoneY(kz) - 1.2) : 0;
    keeper.position.set(kx * (kz != null ? kk2 : 1), ky * kk2, 0.3); keeper.rotation.z = kz != null ? -Math.sign(zoneX(kz)) * (Math.abs(zoneX(kz)) > 0.5 ? 1.1 : 0) * kk2 : 0;
    keeper.rotation.y = Math.PI; KU.armL.rotation.z = -2.2 * (kz != null ? 1 : 0.4); KU.armR.rotation.z = 2.2 * (kz != null ? 1 : 0.4); KU.armL.rotation.x = KU.armR.rotation.x = 0;
    if (conf.visible) { confT += dt; for (let i = 0; i < NP; i++) { pv[i * 3 + 1] -= 8 * dt; for (let q = 0; q < 3; q++) pp[i * 3 + q] += pv[i * 3 + q] * dt; } pg.attributes.position.needsUpdate = true; if (confT > 1.8) conf.visible = false; }
    B.draw();
  }
  return { render, dispose: () => B.dispose() };
}

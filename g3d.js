// 🎮 3D 화면 공용 틀 (Three.js) — 게임별 장면(투호·낚시…)이 같이 씀
// 하는 일: WebGL 준비 · GPU 없는 기기 걸러내기 · 느리면 2D로 돌려보내기(onSlow) · 화면 크기 맞추기 · 정리
// 게임 규칙·점수는 play-n2.js 그대로 — 장면은 S 상태를 읽어서 그리기만 함
import * as THREE from './three-0.160.0.min.js';
export { THREE };

export const lam = (o) => new THREE.MeshLambertMaterial(o);
export function tex(w, h, fn, rep) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; fn(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } t.anisotropy = 4; return t;
}
export const sky = (stops) => tex(4, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); stops.forEach(([k, col]) => g.addColorStop(k, col)); c.fillStyle = g; c.fillRect(0, 0, w, h); });
const q = () => location.search;

// base(canvas, opts) → null(3D 못 씀) 또는 { THREE, R, scene, cam, hi, frame(S): dt|null, draw(), dispose(fn) }
export function base(canvas, { quality = 'high', onSlow, fov = 55, sizeFrom = null, ortho = false, slowMs = 33 } = {}) {
  // ortho: 위에서 똑바로 내려다보는 카메라 — 화면 좌표(가로 0~1, 세로 0~높이/폭)와 3D 좌표가 정확히 같아서 터치 위치가 그림과 딱 맞음 (x → x, 화면 y → -y)
  // sizeFrom: 화면에 없는 캔버스에 그린 뒤 2D 캔버스에 옮겨 붙일 때, 크기를 맞출 화면 속 캔버스
  let R;
  try { R = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high' && (devicePixelRatio || 1) < 2.5, powerPreference: 'low-power' }); } catch { return null; }
  const gl = R.getContext(); if (!gl) return null;
  // GPU 없이 CPU로 흉내 내는 WebGL은 너무 느려서 처음부터 2D 화면 (점검용 ?r3d=1·force면 강제로 3D)
  try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; if (/swiftshader|llvmpipe|software/i.test(name) && !/[?&]r3d=(1|force)/.test(q())) { R.dispose(); return null; } } catch { /* */ }
  const hi = quality === 'high';
  R.setPixelRatio(Math.min(devicePixelRatio || 1, hi ? 1.75 : 1)); R.shadowMap.enabled = hi; R.shadowMap.type = THREE.PCFShadowMap; R.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); const cam = ortho ? new THREE.OrthographicCamera(0, 1, 0, -1, 0.1, 100) : new THREE.PerspectiveCamera(fov, 1, 0.1, 300); if (ortho) cam.position.set(0, 0, 50);
  let lastT = performance.now(), frames = [], nF = 0, slowCalled = false, lost = false; const extra = [];
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (lost) return; lost = true; onSlow?.('lost'); }); // 직접 정리할 때는 무시
  return {
    THREE, R, scene, cam, hi,
    // 매 프레임 처음에 부름: 지난 프레임과의 시간(초) 또는 그리지 말아야 하면 null
    frame() {
      if (lost) return null;
      const now = performance.now(); const fdt = now - lastT; lastT = now;
      // 첫 5프레임은 준비 시간이라 빼고 20프레임 중간값이 33ms를 넘으면 2D로 (느린 채로 두면 게임 시간도 늘어지니까 빨리)
      nF++; if (!slowCalled && nF > 5 && !/[?&]r3d=force/.test(q())) { frames.push(fdt); if (frames.length >= 20) { frames.sort((a, b) => a - b); if (frames[10] > slowMs) { slowCalled = true; onSlow?.('slow'); return null; } frames = []; } }
      const el = sizeFrom || canvas; const w = el.clientWidth | 0, h = el.clientHeight | 0; if (!w || !h) return null;
      if (canvas.width !== Math.round(w * R.getPixelRatio()) || canvas.height !== Math.round(h * R.getPixelRatio())) { R.setSize(w, h, false); if (ortho) { cam.left = 0; cam.right = 1; cam.top = 0; cam.bottom = -h / w; } else cam.aspect = w / h; cam.updateProjectionMatrix(); }
      return Math.min(0.05, fdt / 1000);
    },
    draw() { R.render(scene, cam); },
    onDispose(fn) { extra.push(fn); },
    dispose() {
      lost = true; extra.forEach((f) => { try { f(); } catch { /* */ } });
      try { scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose?.(); }); }); scene.background?.dispose?.(); R.dispose(); R.forceContextLoss?.(); } catch { /* */ }
    },
  };
}

// 공용 사람 모형 (팀 색 옷) — 팔다리는 관절에서 돌림
export function person(color, hi) {
  const g = new THREE.Group(); const skin = lam({ color: '#ffd7b5' }), shirt = lam({ color }), pants = lam({ color: '#2a2f4a' }), hair = lam({ color: '#22202a' });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 4, 8), shirt); torso.position.y = 1.12; g.add(torso);
  const hip = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.08, 4, 8), pants); hip.position.y = 0.82; g.add(hip);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), skin); head.position.y = 1.58; g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair); cap.position.y = 1.6; g.add(cap);
  const limb = (len, r, m) => { const pv = new THREE.Group(); const ms = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 6), m); ms.position.y = -len / 2 - r; pv.add(ms); return pv; };
  const legL = limb(0.5, 0.09, pants), legR = limb(0.5, 0.09, pants); legL.position.set(-0.12, 0.82, 0); legR.position.set(0.12, 0.82, 0);
  const armL = limb(0.4, 0.07, shirt), armR = limb(0.4, 0.07, shirt); armL.position.set(-0.32, 1.36, 0); armR.position.set(0.32, 1.36, 0);
  g.add(legL, legR, armL, armR); g.traverse((m) => { if (m.isMesh) m.castShadow = hi; });
  Object.assign(g.userData, { legL, legR, armL, armR, torso, head });
  return g;
}

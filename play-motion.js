// 몸 동작 모드: 폰 휘두르기·들어 올리기·흔들기·기울이기 감지 (녹화·녹음 없음, 센서 값만 사용)
import { h, vibrate } from './client.js';

export const M = {
  on: false, bound: false, tx: 0, ty: 0, b0: null, subs: new Set(),
  peak: 0, inPeak: false, lastSwing: 0, lastShake: 0, gx: 0, gy: 0, gz: 9.8,
  seen: 0,
  async enable() {
    // 아이폰은 허용 창이 필요. 다른 폰은 바로 됨. 어느 쪽이든 실제로 센서 값이 들어오는지 확인
    let denied = false;
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') { const r = await DeviceMotionEvent.requestPermission(); denied = r !== 'granted'; }
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') { try { await DeviceOrientationEvent.requestPermission(); } catch { /* */ } }
    } catch { /* 허용 창이 없는 브라우저 */ }
    if (!M.bound) { addEventListener('devicemotion', onMotion); addEventListener('deviceorientation', onOrient); M.bound = true; }
    const before = M.seen; M.on = true; M.b0 = null;
    await new Promise((r) => setTimeout(r, 700));
    if (M.seen === before) { M.on = false; return false; } // 센서 값이 안 들어옴 (센서 없음·거부)
    void denied; return true;
  },
  sub(fn) { M.subs.add(fn); return () => M.subs.delete(fn); },
  tilt() { return [M.tx, M.ty]; },
};
const emit = (ev) => { for (const f of M.subs) try { f(ev); } catch (e) { console.error(e); } };
const cl = (v) => Math.max(-1, Math.min(1, v));

function onMotion(e) {
  M.seen++;
  if (!M.on) return;
  let a = e.acceleration;
  if (!a || a.x == null) { // 중력 포함 값만 주는 폰: 느린 필터로 중력을 빼서 계산
    const g = e.accelerationIncludingGravity || {}; const k = 0.9;
    M.gx = M.gx * k + (g.x || 0) * (1 - k); M.gy = M.gy * k + (g.y || 0) * (1 - k); M.gz = M.gz * k + (g.z || 0) * (1 - k);
    a = { x: (g.x || 0) - M.gx, y: (g.y || 0) - M.gy, z: (g.z || 0) - M.gz };
  }
  const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0); const now = performance.now();
  // 흔들기: 짧은 봉우리마다 1번
  if (m > 8 && now - M.lastShake > 120) { M.lastShake = now; emit({ type: 'shake', m }); }
  // 휘두르기 / 확 들어 올리기: 크게 튀었다가 가라앉을 때 한 번
  if (m > 9) { M.inPeak = true; if (m > M.peak) { M.peak = m; M.peakA = { ...a }; } }
  else if (M.inPeak && m < 5) {
    M.inPeak = false; const pk = M.peak; M.peak = 0;
    if (now - M.lastSwing > 550) {
      M.lastSwing = now;
      if (pk >= 13) emit({ type: 'swing', power: Math.max(0.15, Math.min(1, (pk - 13) / 22 + 0.25)), tx: M.tx, a: M.peakA });
      else emit({ type: 'flick', power: 0.3 });
    }
  }
}
function onOrient(e) {
  if (!M.on || e.gamma == null) return;
  if (M.b0 == null) M.b0 = e.beta;
  M.tx = cl(e.gamma / 28); M.ty = cl((e.beta - M.b0) / 28);
}

// 게임 화면에 붙는 '몸으로 하기' 버튼. 진행자 설정·나이에 따라 숨김
export function motionChip(api, hint) {
  const set = api.motion || 'auto';
  if (set === 'off' || (set === 'auto' && ['baby', 'kid'].includes(api.age))) return null;
  const b = h('button', { class: `mchip ${M.on ? 'on' : ''}` }, M.on ? `📳 몸 동작 켜짐 · ${hint}` : `📳 몸으로 하기 (${hint})`);
  b.onclick = async () => {
    if (M.on) { M.on = false; b.classList.remove('on'); b.textContent = `📳 몸으로 하기 (${hint})`; return; }
    const ok = await M.enable();
    if (!ok) { api.toast('동작 센서를 쓸 수 없어요. 터치로 해 주세요'); return; }
    vibrate(30); b.classList.add('on'); b.textContent = `📳 몸 동작 켜짐 · ${hint}`; api.toast('폰을 꽉 쥐고 하세요! 터치로도 돼요');
  };
  return b;
}

// 화면에 없는 캔버스에 3D를 그려 기존 2D 캔버스에 옮겨 붙이는 도우미 (줄넘기·탑 쌓기·무궁화)
// 화면 배치(DOM)를 하나도 바꾸지 않아서 버튼·터치 위치가 그대로 · 실패·느림이면 원래 2D 그리기로 자동 복귀
import * as S3 from './scene3d.js';

export function off3d(self, target, loader, extra = {}) {
  if (S3.quality() === 'low' || /[?&]r3d=0/.test(location.search)) return;
  const off = document.createElement('canvas');
  self.drop3d = (why) => { try { self.r3?.dispose(); } catch { /* */ } self.r3 = null; self.no3d = true; window.__r3d = `2d:${why}`; S3.mark3dFail(why); };
  loader().then((make) => {
    if (self.dead) return;
    const r = make(off, { ...extra, quality: S3.quality(), sizeFrom: target, onSlow: (why) => self.drop3d(why) });
    if (r) { self.r3 = r; self.off3 = off; window.__r3d = '3d'; } else self.drop3d('nogl');
  }).catch(() => self.drop3d('load'));
}
// 2D 캔버스(c, W×H)에 3D 한 장면을 붙임. 그렸으면 true (못 그렸으면 false → 원래 2D로 그리면 됨)
export function paint3d(self, c, W, H, state) {
  if (!self.r3) return false;
  try {
    const t0 = performance.now(); if (self.r3.render(state) !== true) return false; c.drawImage(self.off3, 0, 0, W, H);
    // 한 장 그리는 데 걸린 시간: 40장 중간값이 10ms를 넘으면 폰이 버거운 것 → 원래 2D로 (버튼 반응이 늦어지지 않게)
    if (!/[?&]r3d=force/.test(location.search) && (self.cost3 ||= []).length < 40) { self.cost3.push(performance.now() - t0); if (self.cost3.length === 40 && [...self.cost3].sort((a, b) => a - b)[20] > 10) self.drop3d('cost'); }
    return true;
  } catch (e) { console.error(e); self.drop3d('err'); return false; }
}

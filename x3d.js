// 화면에 없는 캔버스에 3D를 그려 기존 2D 캔버스에 옮겨 붙이는 도우미 (줄넘기·탑 쌓기·무궁화)
// 화면 배치(DOM)를 하나도 바꾸지 않아서 버튼·터치 위치가 그대로 · 실패·느림이면 원래 2D 그리기로 자동 복귀
import * as S3 from './scene3d.js';

export function off3d(self, target, loader, extra = {}) {
  if (S3.quality() === 'low' || /[?&]r3d=0/.test(location.search)) return;
  const off = document.createElement('canvas');
  self.drop3d = (why) => { try { self.r3?.dispose(); } catch { /* */ } self.r3 = null; self.no3d = true; window.__r3d = `2d:${why}`; };
  loader().then((make) => {
    if (self.dead) return;
    const r = make(off, { ...extra, quality: S3.quality(), sizeFrom: target, onSlow: (why) => self.drop3d(why) });
    if (r) { self.r3 = r; self.off3 = off; window.__r3d = '3d'; } else self.drop3d('nogl');
  }).catch(() => self.drop3d('load'));
}
// 2D 캔버스(c, W×H)에 3D 한 장면을 붙임. 그렸으면 true (못 그렸으면 false → 원래 2D로 그리면 됨)
export function paint3d(self, c, W, H, state) {
  if (!self.r3) return false;
  try { if (self.r3.render(state) !== true) return false; c.drawImage(self.off3, 0, 0, W, H); return true; } catch (e) { console.error(e); self.drop3d('err'); return false; }
}

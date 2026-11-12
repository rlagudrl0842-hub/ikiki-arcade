// 🎳 볼링 굴리기 계산 (서버·폰이 같은 식을 씀 → 폰 애니메이션과 서버 점수가 항상 같음)
// 레인 좌표: 가로 x -1~1 (밖은 도랑), 세로 y 0(파울선) → 10. 핀 10개는 y 8.5부터 삼각형
export const PINS = (() => { const a = []; for (let r = 0; r < 4; r++) for (let j = 0; j <= r; j++) a.push([(-r / 2 + j) * 0.5, 8.5 + r * 0.45]); return a; })();
export const BALL_R = 0.14, PIN_R = 0.07;
// standing: 서 있는 핀 번호 배열 · x0: 출발 가로 위치 · ang: 각도(라디안, 오른쪽 +) · pow: 힘 0.3~1
// → { down: 이번에 넘어진 핀, gutter, path: [[x,y]…] (애니메이션용), moves: {핀: [dx,dy]} }
export function bowlRoll(standing, x0, ang, pow) {
  const up = new Set(standing); const down = []; const moves = {};
  const dx = Math.sin(ang), dy = Math.cos(ang);
  // 도랑: 핀 앞(y 8.2)까지 가기 전에 레인 밖으로 나가면 0개
  const yG = dx ? Math.min(8.2, ((dx > 0 ? 1 : -1) * 1 - x0) / (dx / dy)) : 8.2;
  const gutter = yG < 8.2;
  const endY = gutter ? yG : 10.2; const path = [[x0, 0], [x0 + (dx / dy) * endY, endY]];
  if (gutter) return { down, gutter, path, moves };
  // 1) 공이 직접 맞힌 핀
  const hit = [];
  for (const i of up) { const [px, py] = PINS[i]; const t = (px - x0) * dx + py * dy; const cx = x0 + dx * t, cy = dy * t; const off = (px - cx) * dy - (py - cy) * dx; /* 공 진행선에서 옆으로 떨어진 거리(오른쪽 +) */ if (Math.abs(off) < BALL_R + PIN_R) hit.push([i, off]); }
  const L0 = 0.35 + pow * 1.5; const q = [];
  for (const [i, off] of hit) { const k = off / (BALL_R + PIN_R); let mx = dx * (1 - Math.abs(k)) + Math.sign(k || 1) * Math.abs(k) * dy * 1.4, my = dy * (1 - Math.abs(k)) - Math.sign(k || 1) * Math.abs(k) * dx * 1.4; const n = Math.hypot(mx, my) || 1; q.push([i, mx / n, my / n, L0]); }
  // 2) 넘어진 핀이 날아가며 다른 핀을 넘어뜨림 (두 단계까지)
  for (let depth = 0; depth < 4 && q.length; depth++) {
    const next = [];
    for (const [i, ux, uy, L] of q) {
      if (!up.has(i)) continue; up.delete(i); down.push(i); moves[i] = [ux * L, uy * L];
      const [px, py] = PINS[i];
      for (const j of up) { const [qx, qy] = PINS[j]; const t = (qx - px) * ux + (qy - py) * uy; if (t <= 0 || t > L) continue; const d = Math.abs((qx - px) * uy - (qy - py) * ux); if (d < PIN_R * 2 + 0.11) { const vx = qx - px, vy = qy - py; const n = Math.hypot(vx, vy) || 1; next.push([j, (vx / n + ux) / 2, (vy / n + uy) / 2, L * 0.72]); } }
    }
    q.length = 0; q.push(...next);
  }
  // 3) 포켓(맨 앞 핀과 그 옆 핀 사이)을 힘 있게 맞히면 핀이 서로 부딪혀 거의 다 쓰러짐 (실제 볼링처럼 '포켓 스트라이크')
  const ids = new Set(hit.map((x) => x[0])); const side = ids.has(0) && ids.has(2) && !ids.has(1) ? 2 : ids.has(0) && ids.has(1) && !ids.has(2) ? 1 : 0;
  if (side && pow >= 0.7) { const keep = pow >= 0.9 ? -1 : side === 2 ? 9 : 6; for (const j of [...up]) { if (j === keep) continue; up.delete(j); down.push(j); const [qx, qy] = PINS[j]; moves[j] = [Math.sign(qx || (side === 2 ? 1 : -1)) * 0.4, 0.8 + (qy - 8.5) * 0.3]; } }
  return { down, gutter, path, moves, pocket: !!side };
}

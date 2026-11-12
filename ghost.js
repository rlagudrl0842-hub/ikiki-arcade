// 👻 같은 게임을 하는 다른 참가자(내 앞뒤 2명씩)를 내 게임 화면 안에 반투명으로 그림 — 서버가 1초마다 보내는 실시간 순위(lb.nb)를 씀
// 위치는 '점수 차이'로 계산(앞서면 앞쪽·위쪽) · 화면 밖이면 가장자리에 화살표와 차이 · 🤖 = 컴퓨터 상대
// 던지기·낚시처럼 위치 비교가 어울리지 않는 게임은 '옆 사람 소식'(민준 +3)이 잠깐 떠오름
const SM = new WeakMap(); // api마다 부드럽게 움직이는 값·소식 기록

function st(api) { let s = SM.get(api); if (!s) { s = { shown: new Map(), prev: new Map(), feed: [], run: null }; SM.set(api, s); } return s; }

// 지금 보여 줄 고스트 목록 [{ name, raw(부드럽게), team, ai, k, col }]
export function ghostList(api) {
  const m = api.ghosts?.(); const s = st(api); if (!m?.nb) return [];
  if (s.run !== m.run) { s.run = m.run; s.shown.clear(); s.prev.clear(); s.feed = []; }
  return m.nb.map(([name, raw, team, ai, k]) => {
    const cur = s.shown.has(k) ? s.shown.get(k) : raw; const v = cur + (raw - cur) * 0.08; s.shown.set(k, v); // 1초마다 오는 값을 매 프레임 조금씩 따라감 → 끊기지 않게
    return { name: (ai ? '🤖' : '') + name, raw: v, team, ai, k, col: api.teamColor?.(team) || '#fff' };
  });
}

// 위치형: at(차이, 순번) → [x, y] · sprite(c, x, y, 색, d) · clip 밖이면 가장자리 표시
export function drawGhosts(c, api, { W, H, d, mine, at, sprite, unit = '', clip = {}, edgeOnly = false }) {
  // edgeOnly: 3D 화면(카메라가 2D 그림과 다름)에서는 캐릭터 대신 오른쪽 가장자리 칩만 (앞 ▶ / 뒤 ◀ · 이름 · 차이)
  const L = ghostList(api); if (!L.length) return;
  const x0 = clip.x0 ?? W * 0.04, x1 = clip.x1 ?? W * 0.96, y0 = clip.y0 ?? H * 0.12, y1 = clip.y1 ?? H * 0.95;
  c.save(); c.textAlign = 'center'; c.textBaseline = 'bottom';
  L.forEach((g, i) => {
    const diff = g.raw - mine; let [x, y] = at(diff, i); if (edgeOnly) { x = diff >= 0 ? W * 2 : -W; y = H * (0.3 + 0.09 * i); }
    const out = x < x0 || x > x1 || y < y0 || y > y1;
    const lbl = `${g.name} ${diff >= 0 ? '+' : '−'}${Math.abs(Math.round(diff))}${unit}`;
    if (out) {
      // 화면 밖: 가장자리 칩 (방향 화살표 · 이름 · 차이)
      const ax = Math.min(x1, Math.max(x0, x)), ay = Math.min(y1, Math.max(y0, y)); const arrow = x > x1 ? '▶' : x < x0 ? '◀' : y < y0 ? '▲' : '▼';
      c.font = `800 ${11 * d}px sans-serif`; const tw = c.measureText(`${arrow} ${lbl}`).width + 10 * d;
      const bx = Math.min(W - tw - 4 * d, Math.max(4 * d, ax - tw / 2)), by = Math.min(H - 20 * d * (L.length - i), Math.max(4 * d, ay - 10 * d) + (arrow === '▼' ? -i : i) * 21 * d); // 가장자리 칩은 겹치지 않게 순서대로 쌓음
      c.globalAlpha = 0.85; c.fillStyle = '#0b0e24cc'; c.beginPath(); c.roundRect ? c.roundRect(bx, by, tw, 18 * d, 9 * d) : c.rect(bx, by, tw, 18 * d); c.fill();
      c.fillStyle = g.col; c.fillRect(bx + 3 * d, by + 4 * d, 3 * d, 10 * d); c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(`${arrow} ${lbl}`, bx + 8 * d, by + 9 * d); c.textAlign = 'center'; c.textBaseline = 'bottom';
      return;
    }
    c.globalAlpha = 0.8; c.shadowColor = '#0b0e24'; c.shadowBlur = 4 * d; sprite(c, x, y, g.col, d); c.shadowBlur = 0; // 밝은 배경에서도 보이게 진하게 + 어두운 테두리
    c.globalAlpha = 0.9; c.font = `800 ${10 * d}px sans-serif`; c.lineWidth = 3 * d; c.strokeStyle = '#0b0e24'; c.strokeText(g.name, x, y - 34 * d); c.fillStyle = '#fff'; c.fillText(g.name, x, y - 34 * d);
  });
  c.restore();
}

// 고스트 모양: 사람(막대 인형) · 새
export function stickSprite(c, x, y, col, d) {
  c.strokeStyle = col; c.fillStyle = col; c.lineCap = 'round'; c.lineWidth = 4 * d;
  c.beginPath(); c.arc(x, y - 26 * d, 5 * d, 0, 7); c.fill();
  c.beginPath(); c.moveTo(x, y - 21 * d); c.lineTo(x, y - 9 * d); c.moveTo(x, y - 9 * d); c.lineTo(x - 5 * d, y); c.moveTo(x, y - 9 * d); c.lineTo(x + 5 * d, y); c.moveTo(x - 6 * d, y - 17 * d); c.lineTo(x + 6 * d, y - 15 * d); c.stroke();
}
export function birdSprite(c, x, y, col, d) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, 13 * d, 10 * d, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 5 * d, y - 3 * d, 3 * d, 0, 7); c.fill(); }

// 소식형: 옆 사람 점수가 오르면 오른쪽 위에 "🏀 민준 +3"이 2.5초 동안 떠오름 (최대 3줄)
export function drawFeed(c, api, { W, H, d, icon = '⭐', unit = '', top = 0.14 }) {
  const m = api.ghosts?.(); const s = st(api); const now = performance.now();
  if (m?.nb) {
    if (s.run !== m.run) { s.run = m.run; s.prev.clear(); s.feed = []; }
    for (const [name, raw, team, ai, k] of m.nb) { const p = s.prev.get(k); if (p != null && raw > p) s.feed.push({ t: now, txt: `${icon} ${ai ? '🤖' : ''}${name} +${Math.round((raw - p) * 10) / 10}${unit}`, col: api.teamColor?.(team) || '#fff' }); s.prev.set(k, raw); }
  }
  s.feed = s.feed.filter((f) => now - f.t < 2500).slice(-3); if (!s.feed.length) return;
  c.save(); c.font = `800 ${12 * d}px sans-serif`; c.textAlign = 'right'; c.textBaseline = 'middle';
  s.feed.forEach((f, i) => { const k = (now - f.t) / 2500; const y = H * top + i * 22 * d - k * 8 * d; const w = c.measureText(f.txt).width + 14 * d;
    c.globalAlpha = Math.min(1, (1 - k) * 2) * 0.9; c.fillStyle = '#0b0e24cc'; c.beginPath(); c.roundRect ? c.roundRect(W - w - 8 * d, y - 9 * d, w, 18 * d, 9 * d) : c.rect(W - w - 8 * d, y - 9 * d, w, 18 * d); c.fill();
    c.fillStyle = f.col; c.fillRect(W - w - 8 * d + 3 * d, y - 5 * d, 3 * d, 10 * d); c.fillStyle = '#fff'; c.fillText(f.txt, W - 12 * d, y); });
  c.restore();
}

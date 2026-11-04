// 결과 공유 카드: 행사 결과를 인스타·단톡용 이미지(1080×1350)로 만들어 저장·공유
const FONT = "'Pretendard','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif";
const loadImg = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function fitText(c, t, max, size, weight = 900) { let s = size; do { c.font = `${weight} ${s}px ${FONT}`; s -= 2; } while (c.measureText(t).width > max && s > 12); }

// S: 공개 상태(state) · opts.myTeam: 참가자 폰이면 우리 팀 강조
export async function makeCard(S, opts = {}) {
  const W = 1080, H = 1350; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const team = (id) => S.teams.find((t) => t.id === id) || { name: '?', icon: '', color: '#888' };
  const rows = S.standings.rows.slice().sort((a, b) => a.rank - b.rank);
  // 배경
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#141a52'); g.addColorStop(0.55, '#0b0e24'); g.addColorStop(1, '#1b0f3a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; c.beginPath(); c.arc(Math.random() * W, Math.random() * H, Math.random() * 3, 0, 7); c.fill(); }
  const w1 = team(rows[0]?.id);
  const glow = c.createRadialGradient(W / 2, 470, 20, W / 2, 470, 520); glow.addColorStop(0, w1.color + '66'); glow.addColorStop(1, 'transparent'); c.fillStyle = glow; c.fillRect(0, 0, W, H);
  // 로고 + 제목
  const logo = await loadImg('/logo.png');
  if (logo) { c.fillStyle = '#fff'; rr(c, 60, 56, 150, 120, 26); c.fill(); const s = Math.min(130 / logo.width, 104 / logo.height); c.drawImage(logo, 135 - (logo.width * s) / 2, 116 - (logo.height * s) / 2, logo.width * s, logo.height * s); }
  c.fillStyle = '#ffd43b'; c.font = `900 34px ${FONT}`; c.fillText('팀 대항 오락실', 236, 104);
  c.fillStyle = '#c9cff5'; c.font = `600 28px ${FONT}`; c.fillText(new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }), 236, 152);
  c.fillStyle = '#fff'; fitText(c, S.event.name, W - 120, 64); c.textAlign = 'center'; c.fillText(S.event.name, W / 2, 268);
  // 우승팀
  c.font = `900 40px ${FONT}`; c.fillStyle = '#ffd43b'; c.fillText('🏆 우승', W / 2, 352);
  c.font = `150px ${FONT}`; c.fillText(w1.icon || '', W / 2, 520);
  c.fillStyle = '#fff'; fitText(c, w1.name, W - 200, 92); c.fillText(w1.name, W / 2, 640);
  c.fillStyle = w1.color; c.font = `900 46px ${FONT}`; c.fillText(`${rows[0]?.total ?? 0}점`, W / 2, 704);
  // 순위표
  let y = 780; const rowH = Math.min(86, (H - 210 - y) / Math.max(1, rows.length));
  rows.forEach((r) => {
    const t = team(r.id); const mine = opts.myTeam === r.id;
    c.fillStyle = mine ? '#ffd43b33' : '#ffffff10'; rr(c, 90, y, W - 180, rowH - 12, 20); c.fill();
    if (mine) { c.strokeStyle = '#ffd43b'; c.lineWidth = 4; c.stroke(); }
    c.fillStyle = t.color; rr(c, 90, y, 12, rowH - 12, 6); c.fill();
    const mid = y + (rowH - 12) / 2 + 12;
    c.textAlign = 'left'; c.fillStyle = r.rank <= 3 ? ['#ffd43b', '#e3e7f2', '#f0a35e'][r.rank - 1] : '#c9cff5'; c.font = `900 ${Math.min(40, rowH * 0.5)}px ${FONT}`; c.fillText(`${r.rank}위`, 130, mid);
    c.fillStyle = '#fff'; c.font = `800 ${Math.min(38, rowH * 0.46)}px ${FONT}`; c.fillText(`${t.icon} ${t.name}`, 250, mid);
    const mvp = S.teamMvp?.[r.id]; if (mvp && rowH > 60) { c.fillStyle = '#c9cff5'; c.font = `600 ${Math.min(24, rowH * 0.3)}px ${FONT}`; c.textAlign = 'right'; c.fillText(`MVP ${mvp.name}`, W - 300, mid); }
    c.textAlign = 'right'; c.fillStyle = '#fff'; c.font = `900 ${Math.min(40, rowH * 0.5)}px ${FONT}`; c.fillText(`${r.total}점`, W - 120, mid);
    y += rowH;
  });
  // 바닥글
  c.textAlign = 'center'; c.fillStyle = '#8f98cc'; c.font = `600 26px ${FONT}`;
  c.fillText(`${S.standings.played}개 게임 · 참가 ${Object.values(S.counts || {}).reduce((s, x) => s + (x.total || 0), 0)}명 · 아이키키 팀 대항 오락실`, W / 2, H - 56);
  return cv;
}

// 저장 또는 공유 (폰에서는 공유 창 → 카톡·인스타로 바로)
export async function saveCard(S, opts = {}) {
  const cv = await makeCard(S, opts);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  const name = `결과카드_${S.event.name.replace(/[\\/:*?"<>|]/g, '')}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  if (opts.share !== false && navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: S.event.name }); return 'shared'; } catch { /* 취소 → 저장으로 */ } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  return 'saved';
}

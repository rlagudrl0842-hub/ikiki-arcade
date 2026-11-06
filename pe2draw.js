// 폰 없는 체육 60종 — 그리기 공통 (연령별 테마, 시범 선수 자세 40종, 장면 소품, 시작 전 튜토리얼)
// 이미지·폰트 파일 없이 캔버스로만 그림 (외부 리소스 사용 없음)
const D = Math.PI / 180;

// 연령별 화면 테마: 영아·유아 = 밝은 동화풍 / 초등 = 아케이드 스포츠 / 중등 = e스포츠 네온 / 고등·성인 = 경기 중계풍
export function theme(lv) {
  if (lv <= 1) return { k: 'kid', bg: ['#7fd3ff', '#c8f0ff'], ground: '#8fdc6a', panel: '#ffffffcc', ink: '#24324a', sub: '#4a5a7a', acc: '#ff8c42', font: '"Jua","Comic Sans MS",sans-serif', round: 26, cute: true, line: '#ffffff' };
  if (lv === 2) return { k: 'arcade', bg: ['#1b2a6b', '#2f6bd8'], ground: '#2f9e44', panel: '#0e1a46e6', ink: '#ffffff', sub: '#c9d6ff', acc: '#ffd43b', font: 'sans-serif', round: 18, cute: false, line: '#ffffff' };
  if (lv === 3) return { k: 'esports', bg: ['#070b1c', '#151a3d'], ground: '#121838', panel: '#0b1030ee', ink: '#e8f1ff', sub: '#8aa0d8', acc: '#22e1ff', acc2: '#ff3df2', font: 'sans-serif', round: 10, cute: false, neon: true, line: '#22e1ff' };
  return { k: 'pro', bg: ['#0b0b10', '#1c1520'], ground: '#17121c', panel: '#120d16ee', ink: '#fff6e8', sub: '#c8b48a', acc: '#ffb300', acc2: '#ff3b3b', font: 'sans-serif', round: 6, cute: false, neon: true, line: '#ffb300' };
}

export function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); }
export function txt(c, s, x, y, size, color, weight = 900, align = 'center', font = 'sans-serif', maxW) {
  c.font = `${weight} ${size}px ${font}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle';
  if (maxW) { let sz = size; while (c.measureText(s).width > maxW && sz > 12) { sz -= 2; c.font = `${weight} ${sz}px ${font}`; } }
  c.fillText(s, x, y);
}
export function glow(c, color, b) { c.shadowColor = color; c.shadowBlur = b; }
export function noGlow(c) { c.shadowBlur = 0; c.shadowColor = 'transparent'; }

// 배경 (연령 테마 + 장면)
export function bg(c, W, H, th, t, scene) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (th.k === 'kid') {
    // 해·구름·언덕
    c.fillStyle = '#fff3a8'; c.beginPath(); c.arc(W * 0.1, H * 0.14, 60 + Math.sin(t * 2) * 3, 0, 7); c.fill();
    c.fillStyle = '#ffffffcc'; for (let i = 0; i < 4; i++) { const x = ((t * 18 + i * W / 3.2) % (W + 300)) - 150, y = 70 + (i % 2) * 60; for (const [dx, dy, r] of [[0, 0, 34], [30, -12, 40], [64, 0, 32]]) { c.beginPath(); c.arc(x + dx, y + dy, r, 0, 7); c.fill(); } }
    c.fillStyle = th.ground; c.beginPath(); c.moveTo(0, H * 0.82); for (let x = 0; x <= W; x += 40) c.lineTo(x, H * 0.8 + Math.sin(x / 120) * 14); c.lineTo(W, H); c.lineTo(0, H); c.fill();
    c.fillStyle = '#7ccb57'; for (let x = 20; x < W; x += 90) { c.beginPath(); c.arc(x, H * 0.84 + Math.sin(x) * 6, 8, 0, 7); c.fill(); }
  } else if (th.k === 'arcade') {
    // 경기장 관중석 + 잔디
    c.fillStyle = '#ffffff10'; for (let i = 0; i < 40; i++) { const x = (i * 97) % W, y = 40 + (i * 53) % 160; c.beginPath(); c.arc(x, y, 6 + (i % 3) * 2, 0, 7); c.fill(); }
    const lg = c.createRadialGradient(W / 2, -100, 50, W / 2, -100, W * 0.7); lg.addColorStop(0, '#ffffff30'); lg.addColorStop(1, '#ffffff00'); c.fillStyle = lg; c.fillRect(0, 0, W, H);
    c.fillStyle = th.ground; c.fillRect(0, H * 0.84, W, H * 0.16); c.fillStyle = '#ffffff22'; for (let x = 0; x < W; x += 120) c.fillRect(x, H * 0.84, 60, H * 0.16);
  } else {
    // 네온 그리드 (e스포츠 / 중계)
    c.strokeStyle = th.k === 'esports' ? '#22e1ff14' : '#ffb30010'; c.lineWidth = 1;
    const off = (t * 30) % 60; for (let x = -60 + off; x < W; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = off; y < H; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    const sp = c.createRadialGradient(W * 0.5, H * 0.45, 40, W * 0.5, H * 0.45, W * 0.6); sp.addColorStop(0, (th.acc2 || th.acc) + '22'); sp.addColorStop(1, '#00000000'); c.fillStyle = sp; c.fillRect(0, 0, W, H);
    c.fillStyle = th.acc + '22'; c.fillRect(0, H - 6, W, 6);
  }
  if (scene === 'space' || scene === 'stars') { c.fillStyle = '#0b1033'; c.globalAlpha = th.k === 'kid' ? 0.55 : 0.85; c.fillRect(0, 0, W, H); c.globalAlpha = 1; c.fillStyle = '#fff'; for (let i = 0; i < 80; i++) { const x = (i * 211) % W, y = (i * 97) % H; c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)); c.fillRect(x, y, 3, 3); } c.globalAlpha = 1; }
  if (scene === 'sea') { const sg = c.createLinearGradient(0, H * 0.3, 0, H); sg.addColorStop(0, '#2bb5e8cc'); sg.addColorStop(1, '#0a4f8acc'); c.fillStyle = sg; c.fillRect(0, H * 0.3, W, H * 0.7); c.strokeStyle = '#ffffff55'; c.lineWidth = 3; for (let y = H * 0.32; y < H; y += 70) { c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, y + Math.sin(x / 60 + t * 2 + y) * 6); c.stroke(); } }
  if (scene === 'forest') { for (let i = 0; i < 9; i++) { const x = ((i * 230 - t * 60) % (W + 300) + W + 300) % (W + 300) - 150; const hgt = 260 + (i % 3) * 60; c.fillStyle = '#6b4226'; c.fillRect(x - 12, H * 0.82 - hgt * 0.45, 24, hgt * 0.45); c.fillStyle = ['#2f9e44', '#37b24d', '#2b8a3e'][i % 3]; c.beginPath(); c.arc(x, H * 0.82 - hgt * 0.5, 80, 0, 7); c.arc(x - 50, H * 0.82 - hgt * 0.35, 60, 0, 7); c.arc(x + 50, H * 0.82 - hgt * 0.35, 60, 0, 7); c.fill(); } }
  if (scene === 'laser') { c.fillStyle = '#05060f'; c.globalAlpha = 0.75; c.fillRect(0, 0, W, H); c.globalAlpha = 1; c.strokeStyle = '#ff1e3c22'; for (let y = 0; y < H; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } }
}

// 시범 선수: 관절 각도로 그리는 캐릭터 (k = 0~1 동작 반복). style: kid(동글) / sport(운동선수) / neon(e스포츠 실루엣) / robot
function P(k) {
  const sw = Math.sin(k * Math.PI * 2), a = Math.abs(sw), up = Math.max(0, sw), dn = Math.max(0, -sw);
  return { sw, a, up, dn };
}
export function poseOf(key, k) {
  const { sw, a, up, dn } = P(k);
  let la = [195, 182], ra = [165, 178], ll = [186, 180], rl = [174, 180], crouch = 0, jump = 0, tilt = 0, dx = 0, head = 0, special = null;
  switch (key) {
    case 'up': la = [338 + sw * 8, 352]; ra = [22 - sw * 8, 8]; break;
    case 'wide': la = [270, 270 + sw * 14]; ra = [90, 90 - sw * 14]; break;
    case 'clap': la = [250 - a * 25, 330 - a * 70]; ra = [110 + a * 25, 30 + a * 70]; break;
    case 'leg': rl = [128 + sw * 6, 222]; la = [250, 262]; ra = [110, 98]; break;
    case 'squat': crouch = 0.25 + up * 0.5; la = [245, 255]; ra = [115, 105]; ll = [190 - crouch * 50, 175 + crouch * 70]; rl = [170 + crouch * 50, 185 - crouch * 70]; break;
    case 'jog': ll = [180 + sw * 35, 200 + sw * 30]; rl = [180 - sw * 35, 200 - sw * 30]; la = [180 - sw * 50, 120]; ra = [180 + sw * 50, 240]; jump = a * 0.12; break;
    case 'march': ll = [180 + up * 55, 175 - up * 20]; rl = [180 - dn * 55, 185 + dn * 20]; la = [195 - sw * 25, 180]; ra = [165 - sw * 25, 180]; break;
    case 'spin': la = [k * 360, k * 360]; ra = [k * 360 + 180, k * 360 + 180]; break;
    case 'knee': crouch = 0.2; la = [190 + sw * 25, 165]; ra = [170 - sw * 25, 195]; ll = [180 + up * 55, 200]; rl = [180 - dn * 55, 160]; break;
    case 'star': jump = up * 0.35; la = [300 - up * 45, 300 - up * 45]; ra = [60 + up * 45, 60 + up * 45]; ll = [192 + up * 22, 192 + up * 22]; rl = [168 - up * 22, 168 - up * 22]; break;
    case 'wiggle': tilt = sw * 14; la = [230, 200]; ra = [130, 160]; ll = [185 + sw * 8, 180]; rl = [175 + sw * 8, 180]; break;
    case 'jump': jump = up * 0.45; crouch = dn * 0.3; la = up > 0.2 ? [330, 345] : [215, 230]; ra = up > 0.2 ? [30, 15] : [145, 130]; break;
    case 'tiptoe': jump = 0.05 + up * 0.03; la = [348, 356]; ra = [12, 4]; break;
    case 'duck': crouch = 0.45 + a * 0.15; head = 0.1; la = [320, 110]; ra = [40, 250]; break;
    case 'side': dx = sw * 0.55; ll = [205 + a * 10, 180]; rl = [155 - a * 10, 180]; la = [240, 230]; ra = [120, 130]; break;
    case 'lean': tilt = 16 * sw; la = sw > 0 ? [205, 190] : [320, 20]; ra = sw > 0 ? [40, 340] : [155, 170]; break;
    case 'twist': tilt = sw * 6; la = [250, 90 + sw * 40]; ra = [110, 270 + sw * 40]; break;
    case 'punch': la = sw > 0 ? [270, 270] : [215, 30]; ra = sw > 0 ? [145, 330] : [90, 90]; crouch = 0.1; ll = [200, 180]; rl = [160, 180]; break;
    case 'row': crouch = 0.15; la = [230 + sw * 30, 200 + sw * 40]; ra = [130 - sw * 30, 160 - sw * 40]; break;
    case 'swim': la = [(k * 360) % 360, (k * 360 + 20) % 360]; ra = [(k * 360 + 180) % 360, (k * 360 + 200) % 360]; break;
    case 'lunge': crouch = 0.25 + a * 0.15; ll = [215, 165]; rl = [150, 205]; la = [222, 40]; ra = [138, 320]; break;
    case 'stomp': crouch = 0.08 * a; ll = [180 + up * 45, 180]; rl = [180 - dn * 45, 180]; la = [205, 160 + sw * 20]; ra = [155, 200 + sw * 20]; break;
    case 'flap': la = [270 + sw * 35, 270 + sw * 50]; ra = [90 - sw * 35, 90 - sw * 50]; jump = up * 0.05; break;
    case 'hop': jump = up * 0.3; crouch = dn * 0.25; la = [330, 150]; ra = [30, 210]; break;
    case 'salute': ra = [62, 300]; la = [188, 180]; break;
    case 'point': ra = [24 + sw * 4, 24 + sw * 4]; la = [200, 180]; break;
    case 'freeze': la = [305, 330]; ra = [108, 70]; ll = [200, 180]; rl = [160, 180]; break;
    case 'push': crouch = 0.12; la = [262, 262]; ra = [98, 98]; ll = [205, 180]; rl = [160, 185]; tilt = sw * 2; break;
    case 'kick': rl = [180 - up * 95, 180 - up * 95]; la = [235, 220]; ra = [140, 150]; break;
    case 'shoot': jump = up * 0.12; la = [325, 30 + up * 20]; ra = [35, 330 - up * 20]; crouch = dn * 0.15; break;
    case 'swing': tilt = sw * 8; la = [235 + sw * 60, 235 + sw * 60]; ra = [205 + sw * 60, 205 + sw * 60]; ll = [200, 180]; rl = [160, 180]; break;
    case 'bow': crouch = 0.1; head = 0.12 + 0.12 * up; la = [190, 180]; ra = [170, 180]; break;
    case 'stretch': jump = 0.04; la = [318, 328]; ra = [42, 32]; tilt = sw * 4; break;
    case 'wave': ra = [40 + sw * 18, sw * 30]; la = [192, 180]; break;
    case 'crab': crouch = 0.22; dx = sw * 0.45; la = [270, 330]; ra = [90, 30]; ll = [215, 180]; rl = [145, 180]; break;
    case 'robot': { const s2 = Math.floor(k * 2) % 2; la = s2 ? [270, 180] : [270, 0]; ra = s2 ? [90, 0] : [90, 180]; break; }
    case 'tree': rl = [118, 232]; la = [346, 18]; ra = [14, 342]; break;
    case 'airplane': la = [276, 276]; ra = [84, 84]; rl = [148, 140]; tilt = 8 + sw * 3; break;
    case 'plank': special = 'plank'; break;
    case 'burpee': special = k < 0.33 ? null : k < 0.66 ? 'plank' : null; if (k < 0.33) { crouch = 0.75; la = [200, 190]; ra = [160, 170]; } else if (k >= 0.66) { jump = Math.sin((k - 0.66) / 0.34 * Math.PI) * 0.4; la = [335, 345]; ra = [25, 15]; } break;
    case 'sit': crouch = 0.8; la = [220, 200]; ra = [140, 160]; break;
    default: break;
  }
  return { la, ra, ll, rl, crouch, jump, tilt, dx, head, special };
}

export function figure(c, x, y, L, col, key, k, style = 'kid', opt = {}) {
  const p = poseOf(key, k);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const skin = opt.skin || '#ffd9b8'; const limb = style === 'neon' ? '#0d1328' : style === 'robot' ? '#9aa7c7' : opt.limb || '#f3f5ff';
  // 그림자
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + p.dx * L, y + 6, L * 0.45 * (1 - p.jump * 0.8), L * 0.07, 0, 0, 7); c.fill();
  if (p.special === 'plank') {
    // 옆모습 플랭크
    const yb = y - L * 0.32; c.strokeStyle = col; c.lineWidth = L * 0.17; c.beginPath(); c.moveTo(x - L * 0.75, y - L * 0.06); c.lineTo(x + L * 0.45, yb); c.stroke();
    c.strokeStyle = limb; c.lineWidth = L * 0.11; c.beginPath(); c.moveTo(x + L * 0.42, yb); c.lineTo(x + L * 0.42, y); c.stroke();
    c.fillStyle = skin; c.beginPath(); c.arc(x + L * 0.7, yb - L * 0.06, L * (style === 'kid' ? 0.2 : 0.15), 0, 7); c.fill();
    if (style === 'neon') { c.strokeStyle = opt.neon || '#22e1ff'; c.lineWidth = 3; c.beginPath(); c.arc(x + L * 0.7, yb - L * 0.06, L * 0.15, 0, 7); c.stroke(); }
    return;
  }
  const hipY = y - L * 0.92 * (1 - p.crouch * 0.42) - p.jump * L; const cx = x + p.dx * L;
  const seg = (x0, y0, a1, a2, l1, l2, w, colr) => {
    const x1 = x0 + Math.sin(a1 * D) * l1, y1 = y0 - Math.cos(a1 * D) * l1; const x2 = x1 + Math.sin(a2 * D) * l2, y2 = y1 - Math.cos(a2 * D) * l2;
    if (style === 'neon') { glow(c, opt.neon || '#22e1ff', 14); c.strokeStyle = opt.neon || '#22e1ff'; c.lineWidth = w + 5; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke(); noGlow(c); }
    c.strokeStyle = colr; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    return [x2, y2];
  };
  c.save(); c.translate(cx, hipY); c.rotate(p.tilt * D); c.translate(-cx, -hipY);
  const shY = hipY - L * 0.62;
  // 다리 (운동선수는 반바지·운동화)
  const fl = seg(cx - L * 0.1, hipY, p.ll[0], p.ll[1], L * 0.46, L * 0.46, L * 0.14, limb); const fr = seg(cx + L * 0.1, hipY, p.rl[0], p.rl[1], L * 0.46, L * 0.46, L * 0.14, limb);
  if (style !== 'kid') { c.fillStyle = style === 'neon' ? (opt.neon || '#22e1ff') : '#1f2433'; for (const f of [fl, fr]) { c.beginPath(); c.ellipse(f[0], f[1], L * 0.09, L * 0.05, 0, 0, 7); c.fill(); } }
  // 몸통
  if (style === 'robot') { c.fillStyle = '#c3cbe0'; rr(c, cx - L * 0.26, shY - L * 0.06, L * 0.52, L * 0.72, 8); c.fill(); c.fillStyle = col; c.fillRect(cx - L * 0.1, shY + L * 0.15, L * 0.2, L * 0.14); c.fillStyle = '#ffd43b'; c.beginPath(); c.arc(cx, shY + L * 0.45, L * 0.05, 0, 7); c.fill(); }
  else { c.fillStyle = style === 'neon' ? '#0d1328' : col; rr(c, cx - L * 0.2, shY - L * 0.04, L * 0.4, L * 0.7, style === 'kid' ? L * 0.16 : L * 0.08); c.fill(); if (style === 'neon') { glow(c, opt.neon || '#22e1ff', 12); c.strokeStyle = col; c.lineWidth = 4; c.stroke(); noGlow(c); }
    if (style === 'sport') { c.fillStyle = '#ffffff'; c.font = `900 ${L * 0.2}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(opt.num || '7', cx, shY + L * 0.28); c.fillStyle = '#1f2433'; c.fillRect(cx - L * 0.2, hipY - L * 0.12, L * 0.4, L * 0.16); } }
  // 머리
  const hr = L * (style === 'kid' ? 0.24 : style === 'robot' ? 0.2 : 0.17); const hy = shY - hr * 1.15 + p.head * L;
  if (style === 'robot') { c.fillStyle = '#c3cbe0'; rr(c, cx - hr, hy - hr, hr * 2, hr * 1.8, 6); c.fill(); c.fillStyle = '#22e1ff'; c.fillRect(cx - hr * 0.6, hy - hr * 0.3, hr * 0.4, hr * 0.3); c.fillRect(cx + hr * 0.2, hy - hr * 0.3, hr * 0.4, hr * 0.3); c.strokeStyle = '#9aa7c7'; c.lineWidth = 4; c.beginPath(); c.moveTo(cx, hy - hr); c.lineTo(cx, hy - hr * 1.5); c.stroke(); c.fillStyle = '#ff4d6d'; c.beginPath(); c.arc(cx, hy - hr * 1.55, 6, 0, 7); c.fill(); }
  else if (style === 'neon') { c.fillStyle = '#0d1328'; c.beginPath(); c.arc(cx, hy, hr, 0, 7); c.fill(); glow(c, opt.neon || '#22e1ff', 16); c.strokeStyle = opt.neon || '#22e1ff'; c.lineWidth = 4; c.stroke(); noGlow(c); c.fillStyle = opt.neon || '#22e1ff'; c.fillRect(cx - hr * 0.6, hy - hr * 0.12, hr * 1.2, hr * 0.22); }
  else {
    c.fillStyle = skin; c.beginPath(); c.arc(cx, hy, hr, 0, 7); c.fill();
    c.fillStyle = '#2b2f55'; c.beginPath(); c.arc(cx, hy - hr * 0.2, hr * 1.02, Math.PI * 1.05, Math.PI * 1.95); c.fill();
    if (style === 'sport') { c.fillStyle = col; c.fillRect(cx - hr, hy - hr * 0.55, hr * 2, hr * 0.28); }
    c.fillStyle = '#1a1a2e'; c.beginPath(); c.arc(cx - hr * 0.36, hy + hr * 0.08, hr * 0.1, 0, 7); c.arc(cx + hr * 0.36, hy + hr * 0.08, hr * 0.1, 0, 7); c.fill();
    c.strokeStyle = '#1a1a2e'; c.lineWidth = hr * 0.09; c.beginPath(); c.arc(cx, hy + hr * 0.28, hr * 0.3, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    if (style === 'kid') { c.fillStyle = '#ff9aa8aa'; c.beginPath(); c.arc(cx - hr * 0.62, hy + hr * 0.35, hr * 0.14, 0, 7); c.arc(cx + hr * 0.62, hy + hr * 0.35, hr * 0.14, 0, 7); c.fill(); }
  }
  const armCol = style === 'neon' ? '#0d1328' : style === 'robot' ? '#9aa7c7' : col;
  const hl = seg(cx - L * 0.2, shY + L * 0.04, p.la[0], p.la[1], L * 0.32, L * 0.3, L * 0.12, armCol); const hrr = seg(cx + L * 0.2, shY + L * 0.04, p.ra[0], p.ra[1], L * 0.32, L * 0.3, L * 0.12, armCol);
  if (style !== 'neon' && style !== 'robot') { c.fillStyle = skin; for (const hd of [hl, hrr]) { c.beginPath(); c.arc(hd[0], hd[1], L * 0.065, 0, 7); c.fill(); } }
  c.restore();
}
export const styleOf = (th) => (th.k === 'kid' ? 'kid' : th.neon ? 'neon' : 'sport');

// ---------------- 소품
export function balloonS(c, x, y, r, col, t, popped) {
  if (popped) { c.strokeStyle = col; c.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i * 1.05; c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3); c.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7); c.stroke(); } return; }
  c.strokeStyle = '#ffffff99'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y + r); c.quadraticCurveTo(x + Math.sin(t * 3) * 10, y + r * 1.8, x, y + r * 2.6); c.stroke();
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, '#ffffffcc'); g.addColorStop(0.25, col); g.addColorStop(1, col); c.fillStyle = g;
  c.beginPath(); c.ellipse(x, y, r * 0.86, r, 0, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.moveTo(x - 6, y + r); c.lineTo(x + 6, y + r); c.lineTo(x, y + r + 9); c.fill();
}
export function star(c, x, y, r, col, rot = 0) { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + i * Math.PI / 5; const rr2 = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } c.closePath(); c.fill(); }
export function rocket(c, x, y, s, col, flame) {
  c.save(); c.translate(x, y);
  if (flame) { const f = 0.7 + Math.random() * 0.5; const g = c.createLinearGradient(0, s * 0.5, 0, s * (0.5 + f)); g.addColorStop(0, '#fff3a8'); g.addColorStop(0.4, '#ff922b'); g.addColorStop(1, '#ff4d6d00'); c.fillStyle = g; c.beginPath(); c.moveTo(-s * 0.16, s * 0.48); c.lineTo(0, s * (0.6 + f)); c.lineTo(s * 0.16, s * 0.48); c.fill(); }
  c.fillStyle = '#eef2ff'; c.beginPath(); c.moveTo(0, -s * 0.6); c.quadraticCurveTo(s * 0.26, -s * 0.2, s * 0.2, s * 0.5); c.lineTo(-s * 0.2, s * 0.5); c.quadraticCurveTo(-s * 0.26, -s * 0.2, 0, -s * 0.6); c.fill();
  c.fillStyle = col; c.beginPath(); c.moveTo(0, -s * 0.6); c.quadraticCurveTo(s * 0.14, -s * 0.42, s * 0.18, -s * 0.28); c.lineTo(-s * 0.18, -s * 0.28); c.quadraticCurveTo(-s * 0.14, -s * 0.42, 0, -s * 0.6); c.fill();
  c.beginPath(); c.moveTo(-s * 0.2, s * 0.2); c.lineTo(-s * 0.38, s * 0.55); c.lineTo(-s * 0.2, s * 0.48); c.fill(); c.beginPath(); c.moveTo(s * 0.2, s * 0.2); c.lineTo(s * 0.38, s * 0.55); c.lineTo(s * 0.2, s * 0.48); c.fill();
  c.fillStyle = '#7fd3ff'; c.beginPath(); c.arc(0, -s * 0.05, s * 0.09, 0, 7); c.fill(); c.strokeStyle = '#2b2f55'; c.lineWidth = 3; c.stroke();
  c.restore();
}
export function chest(c, x, y, s, open, locks, total) {
  c.save(); c.translate(x, y);
  if (open) { c.fillStyle = '#ffd43b55'; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i - 4.5) * 0.18; c.beginPath(); c.moveTo(0, -s * 0.2); c.lineTo(Math.cos(a) * s * 1.2, -s * 0.2 + Math.sin(a) * s * 1.2); c.lineTo(Math.cos(a + 0.08) * s * 1.2, -s * 0.2 + Math.sin(a + 0.08) * s * 1.2); c.fill(); } }
  c.fillStyle = '#8a4b1f'; rr(c, -s * 0.5, -s * 0.2, s, s * 0.55, 10); c.fill(); c.fillStyle = '#ffd43b'; c.fillRect(-s * 0.5, -s * 0.05, s, s * 0.08);
  c.fillStyle = '#a0592a'; if (open) { c.save(); c.translate(0, -s * 0.2); c.rotate(-0.5); rr(c, -s * 0.5, -s * 0.35, s, s * 0.35, 14); c.fill(); c.restore(); } else { rr(c, -s * 0.5, -s * 0.48, s, s * 0.3, 16); c.fill(); }
  for (let i = 0; i < total; i++) { const lx = -s * 0.36 + (i * s * 0.72) / Math.max(1, total - 1); c.fillStyle = i < locks ? '#2fd27a' : '#c9cfe0'; c.beginPath(); c.arc(lx, s * 0.22, s * 0.06, 0, 7); c.fill(); }
  c.restore();
}
export function heart(c, x, y, s, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x, y + s * 0.3); c.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s, x, y - s * 0.35); c.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.4, x, y + s * 0.3); c.fill(); }

// ---------------- 시작 전 튜토리얼 (10~20초, 글 짧게 + 시범 동작 애니메이션)
// 4장: ① 하는 동작 ② 성공 조건 ③ 점수 ④ 안전. 장마다 3.5초
export function tutorial(c, W, H, def, t, lv, space, mvFor) {
  const th = theme(lv); bg(c, W, H, th, t, null);
  const card = Math.floor(t / 3.5) % 4; const kk = (t % 3.5) / 3.5;
  const moves = tutMoves(def, space, mvFor);
  const m = moves[Math.floor(t / 1.75) % moves.length];
  const st = styleOf(th);
  // 왼쪽: 시범 선수 (실제 게임 동작)
  c.fillStyle = th.panel; rr(c, W * 0.04, H * 0.08, W * 0.4, H * 0.84, th.round); c.fill();
  figure(c, W * 0.24, H * 0.87, H * 0.27, th.acc === '#ff8c42' ? '#ff6b6b' : th.acc, m.k, (t / 1.1) % 1, st, { neon: th.line });
  c.fillStyle = th.k === 'kid' ? '#ffffffcc' : '#00000088'; rr(c, W * 0.06, H * 0.1, W * 0.36, H * 0.1, th.round * 0.6); c.fill();
  txt(c, m.n, W * 0.24, H * 0.15, Math.min(40, W * 0.028), th.k === 'kid' ? '#24324a' : '#fff', 900, 'center', th.font, W * 0.34);
  // 오른쪽: 카드
  const L = [['🙆', '이렇게 움직여요'], ['✅', '이러면 성공'], ['🏆', '점수'], ['🦺', '안전']];
  const x0 = W * 0.48, w = W * 0.48;
  for (let i = 0; i < 4; i++) {
    const y = H * 0.08 + i * H * 0.21; const on = i === card; const hh = H * 0.19;
    c.fillStyle = on ? th.acc : th.panel; rr(c, x0, y, w, hh, th.round); c.fill();
    if (on) { c.fillStyle = '#ffffff40'; c.fillRect(x0, y + hh - 8, w * kk, 8); }
    txt(c, L[i][0], x0 + hh * 0.5, y + hh / 2, hh * 0.45, on ? '#1a1a2e' : th.ink, 900, 'center');
    txt(c, L[i][1], x0 + hh * 0.95, y + hh * 0.3, Math.min(24, hh * 0.18), on ? '#1a1a2e' : th.sub, 800, 'left', th.font);
    txt(c, def.tut[i], x0 + hh * 0.95, y + hh * 0.64, Math.min(36, hh * 0.27), on ? '#1a1a2e' : th.ink, 900, 'left', th.font, w - hh * 1.1);
  }
  if (space === 'class') { c.fillStyle = '#2fd27a'; rr(c, W * 0.06, H * 0.88 - 34, 260, 44, 22); c.fill(); txt(c, '🏫 교실 모드: 제자리 동작', W * 0.06 + 130, H * 0.88 - 12, 20, '#0b2a14', 900); }
  return card;
}
export function tutMoves(def, space, mvFor) {
  const p = def.p || {}; const ids = [];
  if (p.steps) ids.push(...p.steps.map((s) => s[1])); if (p.sig) ids.push(...p.sig.map((s) => s[2])); if (p.moves) ids.push(...p.moves); if (p.pool) ids.push(...p.pool);
  if (p.act) ids.push(...p.act.map((a) => a[1])); if (p.key) ids.push(...p.key.map((k) => k[1])); if (p.list && Array.isArray(p.list[0])) ids.push(...p.list.map((l) => l[1]));
  if (p.cells) ids.push(...p.cells.slice(0, 6)); if (p.tasks) ids.push(...p.tasks.map((x) => x.split(':')[0])); if (p.wheel) ids.push(...p.wheel.map((x) => x.split(':')[0]));
  if (!ids.length) ids.push(...{ rps: ['squat', 'lunge', 'star'], judge: ['wide', 'leg', 'up', 'clap'], tourney: ['punch', 'squat', 'leg'], choice: ['squat', 'lunge', 'burpee'], signal: ['up', 'squat'] }[def.mech] || ['up', 'clap']);
  const seen = new Set(); return ids.map((id) => mvFor(id, space)).filter((m) => m?.k && !seen.has(m.n) && seen.add(m.n)).slice(0, 6);
}

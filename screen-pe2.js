// 폰 없는 체육 60종 — 대형 화면 (빔프로젝터). 진행·연출만 하고 점수는 사회자 입력으로만 바뀜
import * as S3 from './scene3d.js';
import { h } from './client.js';
import { V } from './screen-games.js';
import { loop, canvas } from './screen-n.js';
import { PE, MV, mvFor } from './pe2data.js';
import { theme, bg, figure, styleOf, rr, txt, glow, noGlow, balloonS, star, rocket, chest, heart, tutorial } from './pe2draw.js';

const W = 1820, H = 880, MW = 1450; // 왼쪽 경기 화면 · 오른쪽 점수판
const BY = Object.fromEntries(PE.map((g) => [g.id, g]));
const tcol = (ctx, id) => ctx.teams.find((t) => t.id === id)?.color || '#888';
const tnm = (ctx, id) => { const t = ctx.teams.find((x) => x.id === id); return t ? `${t.icon} ${t.name}` : `${id}팀`; };
const cols = (n, x0, x1) => { const w = (x1 - x0) / n; return Array.from({ length: n }, (_, i) => x0 + w * i + w / 2); };
const ease = (k) => 1 - (1 - k) ** 3;

function scoreboard(c, s, ctx, th, fx, now) {
  const x = MW + 10, w = W - x - 16; c.fillStyle = th.panel; rr(c, x, 16, w, H - 32, th.round); c.fill();
  if (th.neon) { glow(c, th.acc, 12); c.strokeStyle = th.acc + '88'; c.lineWidth = 2; rr(c, x, 16, w, H - 32, th.round); c.stroke(); noGlow(c); }
  txt(c, th.k === 'kid' ? '⭐ 우리 팀 점수' : 'SCOREBOARD', x + w / 2, 52, 26, th.acc, 900, 'center', th.font);
  const rows = [...ctx.teams].sort((a, b) => (s.pts[b.id] || 0) - (s.pts[a.id] || 0)); const rh = Math.min(110, (H - 120) / rows.length);
  rows.forEach((t, i) => {
    const y = 84 + i * rh; const v = s.pts[t.id] || 0; const hit = fx.hit[t.id] && now - fx.hit[t.id] < 600;
    c.fillStyle = hit ? t.color + '66' : '#ffffff10'; rr(c, x + 12, y, w - 24, rh - 10, th.round * 0.6); c.fill();
    c.fillStyle = t.color; rr(c, x + 12, y, 12, rh - 10, 6); c.fill();
    txt(c, `${i + 1}`, x + 46, y + (rh - 10) / 2, 26, th.sub, 900);
    txt(c, `${t.icon} ${t.name}`, x + 70, y + (rh - 10) / 2, Math.min(28, rh * 0.3), th.ink, 900, 'left', th.font, w - 170);
    txt(c, String(v), x + w - 30, y + (rh - 10) / 2, Math.min(52, rh * 0.5) * (hit ? 1.15 : 1), t.color === '#ffffff' ? th.ink : t.color, 900, 'right');
    fx.rowY[t.id] = y + (rh - 10) / 2;
  });
}
// 점수 이벤트: 점수판 옆으로 떠오르는 글자
function floaters(c, fx, ctx, th, now) {
  fx.fl = fx.fl.filter((f) => now - f.at < 2200);
  for (const f of fx.fl) { const k = (now - f.at) / 2200; const y = (fx.rowY[f.team] ?? 400) - k * 60; c.globalAlpha = 1 - k * k; const col = f.v < 0 ? '#ff6b6b' : f.v > 0 ? '#ffe066' : '#ffffff';
    c.fillStyle = '#000000aa'; c.font = `900 26px sans-serif`; const s = `${f.v > 0 ? '+' + f.v + ' ' : f.v < 0 ? f.v + ' ' : ''}${f.txt || ''}`; const tw = c.measureText(s).width + 26; rr(c, MW - tw - 6, y - 20, tw, 40, 20); c.fill(); txt(c, s, MW - tw / 2 - 6, y, 24, col, 900); }
  c.globalAlpha = 1;
}
function header(c, title, sub, th) { txt(c, title, MW / 2, 52, 50, th.ink, 900, 'center', th.font, MW - 80); if (sub) txt(c, sub, MW / 2, 100, 26, th.sub, 800, 'center', th.font, MW - 80); }
function bigMove(c, x, y, L, mv, th, t, col) { figure(c, x, y, L, col || (th.k === 'kid' ? '#ff6b6b' : th.acc), mv.k, (t / 1.0) % 1, styleOf(th), { neon: th.line }); }
function ring(c, x, y, R, k, col, th, label) { c.strokeStyle = '#ffffff22'; c.lineWidth = R * 0.18; c.beginPath(); c.arc(x, y, R, 0, 7); c.stroke(); c.strokeStyle = col; c.beginPath(); c.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, k))); c.stroke(); if (label != null) txt(c, String(label), x, y + 2, R * 0.8, th.ink, 900); }
function panel(c, x, y, w, hh, th, col) { c.fillStyle = col || th.panel; rr(c, x, y, w, hh, th.round); c.fill(); if (th.neon && !col) { c.strokeStyle = th.acc + '55'; c.lineWidth = 2; rr(c, x, y, w, hh, th.round); c.stroke(); } }
const doneMark = (c, x, y, th) => { c.fillStyle = '#2fd27a'; c.beginPath(); c.arc(x, y, 18, 0, 7); c.fill(); txt(c, '✓', x, y + 1, 24, '#fff'); };

// ---------------- 진행 방식별 그리기
const R = {};
R.follow = (c, s, ctx, th, t, def) => {
  const v = s.st; const st = v.st; const scene = v.scene;
  if (!st) { header(c, '준비!', def.say, th); return; }
  const k = v.k; const stl = scene === 'robot' ? 'robot' : styleOf(th);
  if (scene === 'animal') {
    const em = st.name.split(' ')[0]; c.fillStyle = '#000'; c.font = '220px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; { const k = 1 + Math.sin(t * 4) * 0.045; c.save(); c.translate(MW * 0.3, 430 + Math.abs(Math.sin(t * 3)) * -30); c.scale(k, k); c.fillText(em, 0, 0); c.restore(); } // 글자 크기를 매 프레임 바꾸면 그림 글자(이모지)를 매번 새로 그려 느려짐 → 같은 크기로 그리고 확대·축소만
    figure(c, MW * 0.68, 800, 300, '#ff6b6b', st.mv.k, (t / 0.9) % 1, stl, { neon: th.line });
    header(c, `${st.name}로 변신!`, st.desc, th);
  } else if (v.obstacle) {
    // 장애물이 오른쪽에서 다가와 가운데 선에 닿을 때 동작
    const lx = MW * 0.38; const ox = MW + 80 - ease(k) * (MW + 80 - lx);
    c.strokeStyle = th.acc; c.lineWidth = 6; c.setLineDash([18, 12]); c.beginPath(); c.moveTo(lx, 160); c.lineTo(lx, 840); c.stroke(); c.setLineDash([]);
    const low = ['jump', 'tiptoe', 'squat'].includes(st.mv.k) && scene !== 'laser' ? 1 : 0; const hy = st.mv.k === 'duck' || st.mv.k === 'squat' ? 520 : st.mv.k === 'jump' || st.mv.k === 'tiptoe' ? 770 : 640;
    if (scene === 'laser') { glow(c, '#ff1e3c', 30); c.strokeStyle = '#ff1e3c'; c.lineWidth = 10; c.beginPath(); c.moveTo(ox, hy - 160); c.lineTo(ox, hy + 160); c.stroke(); c.beginPath(); c.moveTo(ox - 40, hy); c.lineTo(ox + 40, hy); c.stroke(); noGlow(c); c.fillStyle = '#ff1e3c55'; c.fillRect(ox - 30, hy - 4, 60, 8); }
    else { c.fillStyle = '#7a4a24'; if (st.mv.k === 'duck') { rr(c, ox - 140, hy - 30, 280, 40, 18); c.fill(); c.fillStyle = '#2f9e44'; for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(ox + i * 50, hy - 30, 24, 0, 7); c.fill(); } } else if (low) { rr(c, ox - 60, 760, 120, 70, 30); c.fill(); } else { c.fillStyle = '#868e96'; c.beginPath(); c.arc(ox, 760, 90, Math.PI, 0); c.fill(); } }
    const hit = k > 0.82 && k < 1;
    figure(c, lx - 10, 840, 290, '#ff6b6b', hit ? st.mv.k : 'march', hit ? Math.min(0.24, (k - 0.82) * 1.4) : (t / 0.8) % 1, styleOf(th), { neon: th.line });
    header(c, `${st.name} → ${st.mv.n}!`, `${st.desc} · 선에 닿는 순간!`, th);
    if (hit) txt(c, 'NOW!', lx, 200, 90, th.acc, 900);
  } else if (v.balance) {
    const sway = Math.sin(t * 1.6) * (8 + k * 6); c.save(); c.translate(MW / 2, 830); c.rotate(sway * Math.PI / 180);
    c.fillStyle = '#ffffff'; for (let i = -6; i <= 6; i++) { c.beginPath(); c.arc(i * 70, 0, 46, 0, 7); c.fill(); } c.restore();
    figure(c, MW / 2, 800, 300, '#74c0fc', st.mv.k, 0.25, styleOf(th), { neon: th.line });
    header(c, st.name, st.desc, th); const g = Math.min(1, k); panel(c, MW * 0.15, 150, MW * 0.7, 40, th); c.fillStyle = g < 1 ? '#ffd43b' : '#2fd27a'; rr(c, MW * 0.15, 150, MW * 0.7 * g, 40, 20); c.fill(); txt(c, g < 1 ? '균형 버티는 중…' : '성공! 발 내려도 돼요', MW / 2, 171, 24, '#1a1a2e');
  } else {
    // 로봇: 자세 보여 주기 → '삐빅' 버티기
    const holdPh = v.hold && k >= 1;
    figure(c, MW / 2, 820, 320, '#4dabf7', st.mv.k, holdPh ? 0.25 : (t / 1.4) % 1, stl, { neon: th.line });
    header(c, holdPh ? '삐빅! 그대로 멈춰요' : st.name, holdPh ? '움직이면 안 돼요' : st.desc, th);
    if (holdPh) { c.strokeStyle = '#22e1ff'; c.lineWidth = 6; for (let i = 0; i < 3; i++) { c.globalAlpha = 1 - ((t * 1.5 + i / 3) % 1); c.beginPath(); c.arc(MW / 2, 500, 120 + ((t * 1.5 + i / 3) % 1) * 260, 0, 7); c.stroke(); } c.globalAlpha = 1; }
  }
  ring(c, 90, 150, 52, 1 - k, th.acc, th, Math.max(0, Math.ceil(v.sec * (1 - k))));
  const got = new Set(v.got); cols(ctx.teams.length, 180, MW - 40).forEach((x, i) => { const tm = ctx.teams[i]; c.fillStyle = got.has(tm.id) ? tm.color : '#00000044'; rr(c, x - 70, 850 - 6, 140, 26, 13); c.fill(); txt(c, got.has(tm.id) ? '⭐ 성공' : tm.name, x, 857, 18, '#fff', 900, 'center', 'sans-serif', 130); });
};

R.signal = (c, s, ctx, th, t, def, fx) => {
  const v = s.st; const cur = v.cur; const st = v.style;
  if (!cur) { header(c, '준비!', def.say, th); return; }
  if (st === 'ox') {
    const ask = cur.ph === 'ask'; panel(c, 120, 140, MW - 240, 260, th); txt(c, `Q. ${cur.q}`, MW / 2, 270, 56, th.ink, 900, 'center', th.font, MW - 300);
    const oS = ask ? 1 : cur.ans ? 1.15 : 0.6, xS = ask ? 1 : !cur.ans ? 1.15 : 0.6;
    c.globalAlpha = ask || cur.ans ? 1 : 0.35; c.strokeStyle = '#4dabf7'; c.lineWidth = 34; c.beginPath(); c.arc(MW * 0.3, 620, 150 * oS, 0, 7); c.stroke();
    c.globalAlpha = ask || !cur.ans ? 1 : 0.35; c.strokeStyle = '#ff6b6b'; c.lineWidth = 34; c.beginPath(); const xs = 140 * xS; c.moveTo(MW * 0.7 - xs, 620 - xs); c.lineTo(MW * 0.7 + xs, 620 + xs); c.moveTo(MW * 0.7 + xs, 620 - xs); c.lineTo(MW * 0.7 - xs, 620 + xs); c.stroke(); c.globalAlpha = 1;
    if (ask) ring(c, MW / 2, 620, 70, 1 - v.k, th.acc, th, ''); else txt(c, cur.ans ? '정답 O!' : '정답 X!', MW / 2, 830, 60, cur.ans ? '#4dabf7' : '#ff6b6b');
    txt(c, ask ? 'O면 동그라미 자세(또는 O 구역) · X면 X자 자세(또는 X 구역)' : '맞힌 팀원이 많은 팀 점수!', MW / 2, 90, 28, th.sub, 800, 'center', th.font);
    return;
  }
  const col = cur.sig[1];
  if (st === 'colorword') {
    c.fillStyle = '#ffffff12'; rr(c, 200, 160, MW - 400, 300, th.round); c.fill(); glow(c, col, 30); txt(c, cur.word || cur.sig[0], MW / 2, 310, 190, col, 900); noGlow(c);
    header(c, '글자 색깔을 보세요!', null, th);
  } else if (st === 'mugung') {
    const go = cur.n === 0; const bx = MW / 2; c.fillStyle = '#c92a2a'; c.beginPath(); c.arc(bx, 330, 90, 0, 7); c.fill(); c.fillStyle = go ? '#3d1f12' : '#ffd9b8'; c.beginPath(); c.arc(bx, 330, 70, 0, 7); c.fill();
    if (!go) { c.fillStyle = '#1a1a2e'; c.beginPath(); c.arc(bx - 24, 320, 9, 0, 7); c.arc(bx + 24, 320, 9, 0, 7); c.fill(); glow(c, '#ff1e3c', 30); txt(c, '👀', bx, 200, 70, '#fff'); noGlow(c); }
    txt(c, go ? '무궁화 꽃이…' : '피었습니다!', bx, 520, go ? 90 : 120, go ? '#2fd27a' : '#ff4d6d', 900, 'center', th.font);
    txt(c, go ? `→ 앞으로! (속도 ×${cur.speed})` : '멈춰! 움직이면 걸려요', bx, 640, 40, th.ink, 900, 'center', th.font);
    cols(ctx.teams.length, 120, MW - 120).forEach((x, i) => figure(c, x, 840, 150, ctx.teams[i].color, go ? 'march' : 'freeze', go ? (t * cur.speed) % 1 : 0.2, styleOf(th), { neon: th.line }));
    return;
  } else if (st === 'dance') {
    const stop = cur.n === 1; if (!stop) { for (let i = 0; i < 6; i++) { c.fillStyle = ['#ff3df2', '#22e1ff', '#ffd43b', '#2fd27a', '#ff922b', '#b197fc'][i] + '33'; c.beginPath(); c.moveTo(MW / 2, 0); const a = Math.sin(t * 1.5 + i) * 0.6 + (i - 2.5) * 0.25; c.lineTo(MW / 2 + Math.sin(a) * 1200 - 120, H); c.lineTo(MW / 2 + Math.sin(a) * 1200 + 120, H); c.fill(); } }
    if (stop && cur.pose) { figure(c, MW / 2, 820, 330, '#74c0fc', cur.pose.k, 0.25, styleOf(th), { neon: th.line }); header(c, `STOP! ${cur.pose.n}`, '그대로 버텨요!', th); txt(c, 'STOP', MW / 2, 280, 160, '#ff4d6d', 900); }
    else { cols(3, 200, MW - 200).forEach((x, i) => figure(c, x, 820, 260, ['#ff6b6b', '#4dabf7', '#ffd43b'][i], ['wiggle', 'spin', 'twist'][i], (t / 0.5 + i * 0.3) % 1, styleOf(th), { neon: th.line })); header(c, '자유롭게 춤춰요! 💃', '음악이 멈추면 STOP', th); }
    return;
  } else if (st === 'tempo') {
    const bpm = cur.bpm || 100; const beat = (t * bpm / 60) % 1; const R0 = 110 + (1 - beat) * 40; c.fillStyle = col + '44'; c.beginPath(); c.arc(MW * 0.3, 470, R0 + 60, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(MW * 0.3, 470, R0, 0, 7); c.fill(); txt(c, `${bpm}`, MW * 0.3, 470, 90, '#1a1a2e'); txt(c, 'BPM', MW * 0.3, 560, 30, '#1a1a2e');
    figure(c, MW * 0.7, 830, 300, col, cur.mv.k, (t * bpm / 60 / 2) % 1, styleOf(th), { neon: th.line }); header(c, cur.sig[0], `${cur.mv.n} — 박자에 맞춰!`, th);
    const bi = Math.floor(t * bpm / 60); if (fx.beat !== bi) { fx.beat = bi; if (!ctx.bgm?.active()) ctx.sfx('tap'); }
    return;
  } else {
    // 섬·불·풍선·신호등·반대로: 큰 신호 패널 + 시범
    if (st === 'traffic') { c.fillStyle = '#212529'; rr(c, 60, 150, 170, 500, 40); c.fill(); v.legend.slice(0, 3).forEach((l, i) => { const on = l[0] === cur.sig[0]; c.fillStyle = on ? l[1] : '#495057'; if (on) glow(c, l[1], 40); c.beginPath(); c.arc(145, 240 + i * 160, 66, 0, 7); c.fill(); noGlow(c); }); if (cur.sig[0].includes('🚸')) txt(c, '🚸', 145, 610, 70, '#fff'); }
    else if (st === 'balloons') { const k = v.k; balloonS(c, MW * 0.25, 520 - ease(k) * 260, 95, col, t, false); for (let i = 0; i < 5; i++) balloonS(c, 80 + i * 70, 760 - ((t * 40 + i * 90) % 600), 30, v.legend[i % v.legend.length][1], t + i, false); }
    else if (st === 'islands') { cols(v.legend.length, 80, MW * 0.55).forEach((x, i) => { const l = v.legend[i]; const on = l[0] === cur.sig[0]; c.fillStyle = '#ffe8a3'; c.beginPath(); c.ellipse(x, 560, on ? 120 : 90, on ? 60 : 45, 0, 0, 7); c.fill(); c.fillStyle = l[1]; c.beginPath(); c.ellipse(x, 545, on ? 100 : 72, on ? 44 : 32, 0, 0, 7); c.fill(); if (on) { c.fillStyle = '#000'; c.font = '80px sans-serif'; c.textAlign = 'center'; c.fillText('⛵', x, 440 + Math.sin(t * 3) * 8); } }); }
    else if (st === 'elements') { const e = cur.sig[0]; for (let i = 0; i < 40; i++) { const x = (i * 137 + t * (e.includes('바람') ? 400 : 30)) % MW, y = (i * 71 + t * (e.includes('불') ? -120 : 60)) % H; c.globalAlpha = 0.5; txt(c, e.split(' ')[0], x, (y + H) % H, 34, '#fff'); } c.globalAlpha = 1; c.fillStyle = col + '33'; c.fillRect(0, 0, MW, H); }
    else if (st === 'opposite') { const flip = cur.flip; c.fillStyle = flip ? '#7048e8' : '#2f9e44'; rr(c, MW * 0.08, 170, MW * 0.36, 120, 60); c.fill(); txt(c, flip ? '🔄 반대로!' : '✅ 그대로!', MW * 0.26, 232, 54, '#fff'); }
    if (st !== 'elements') { const px = st === 'traffic' ? 270 : MW * 0.06, pw = st === 'traffic' ? MW * 0.36 : MW * 0.4, py = st === 'balloons' ? 560 : 330, ph = st === 'balloons' ? 110 : 160; glow(c, col, 30); c.fillStyle = col; rr(c, px, py, pw, ph, th.round); c.fill(); noGlow(c); txt(c, cur.sig[0], px + pw / 2, py + ph / 2, st === 'balloons' ? 52 : 64, '#1a1a2e', 900, 'center', th.font, pw - 20); }
    else txt(c, cur.sig[0], MW * 0.28, 420, 130, '#fff', 900);
    figure(c, MW * 0.72, 830, 320, col, cur.mv.k, cur.mv.k === 'freeze' ? 0.2 : (t / 0.8) % 1, styleOf(th), { neon: th.line });
    header(c, `${cur.mv.n}!`, st === 'opposite' ? (cur.flip ? '화면 말과 반대로' : '이번엔 그대로') : '신호에 맞게 바로 바꿔요', th);
  }
  // 범례
  if (v.legend && !['mugung', 'dance', 'ox'].includes(st)) { const n = v.legend.length; cols(n, 40, MW - 40).forEach((x, i) => { const l = v.legend[i]; c.fillStyle = l[1] + (l[0] === cur.sig[0] ? 'ff' : '66'); rr(c, x - 150, 700 - 10, 300, 46, 23); c.fill(); txt(c, `${l[0]} = ${st === 'opposite' ? '?' : l[2].n}`, x, 713, 20, '#1a1a2e', 900, 'center', 'sans-serif', 280); }); }
};

R.react = (c, s, ctx, th, t) => {
  const v = s.st; const go = v.ph === 'go' || v.ph === 'done';
  if (th.k !== 'kid') { c.fillStyle = '#05061088'; c.fillRect(0, 0, MW, H); }
  if (v.go && (go || v.go.fake)) {
    const fake = !!v.go.fake; const fl = go ? Math.max(0, 1 - v.el * 2) : 0.4;
    c.fillStyle = fake ? `rgba(160,160,170,${fl * 0.5})` : `rgba(255,240,120,${fl * 0.7})`; c.fillRect(0, 0, MW, H);
    glow(c, fake ? '#999' : '#ffe066', 50); c.strokeStyle = fake ? '#adb5bd' : '#ffe066'; c.lineWidth = 18; c.beginPath(); c.moveTo(MW * 0.3, 60); c.lineTo(MW * 0.24, 330); c.lineTo(MW * 0.32, 330); c.lineTo(MW * 0.22, 640); c.stroke(); noGlow(c);
    txt(c, fake ? '가짜 번개! 움직이지 마요' : v.go.t, MW * 0.62, 260, fake ? 60 : 110, fake ? '#adb5bd' : '#ffe066', 900, 'center', th.font, MW * 0.7);
    if (!fake) { figure(c, MW * 0.62, 830, 300, '#ffd43b', v.go.mv.k, (t / 0.7) % 1, styleOf(th), { neon: th.line }); txt(c, `⏱ ${v.el.toFixed(1)}초`, MW * 0.62, 150, 44, th.ink); }
  } else { txt(c, '⚡ 번개를 기다려요…', MW / 2, 380, 80, th.ink, 900, 'center', th.font); txt(c, '가짜(회색) 번개에 움직이면 부정출발!', MW / 2, 480, 34, th.sub, 800, 'center', th.font); const dots = '.'.repeat(1 + Math.floor(t * 2) % 3); txt(c, dots, MW / 2, 560, 80, th.acc); }
  txt(c, `ROUND ${v.rd}`, 120, 60, 34, th.acc, 900);
  v.order.forEach((tm, i) => { panel(c, MW - 340, 160 + i * 90, 300, 76, th, tcol(ctx, tm)); txt(c, `${i + 1}등 ${tnm(ctx, tm)}`, MW - 190, 198 + i * 90, 28, '#fff', 900, 'center', 'sans-serif', 280); });
};

R.memory = (c, s, ctx, th, t) => {
  const v = s.st; const show = v.ph === 'show'; const n = v.seq.length; const cur = show ? Math.min(n - 1, Math.floor(v.el / v.per)) : -1;
  txt(c, `ROUND ${v.rd} · ${n}개`, 120, 60, 30, th.acc, 900);
  if (v.style === 'mines') {
    const [w, hh] = v.grid; const cs = 120; const x0 = MW / 2 - (w * cs) / 2, y0 = 160;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const idx = v.seq.findIndex((p) => p[0] === x && p[1] === hh - 1 - y); const lit = show && idx >= 0 && idx <= cur; c.fillStyle = lit ? '#2fd27a' : '#ffffff18'; rr(c, x0 + x * cs + 6, y0 + y * cs + 6, cs - 12, cs - 12, 14); c.fill(); if (!show) txt(c, '💣', x0 + x * cs + cs / 2, y0 + y * cs + cs / 2, 40, '#ffffff55'); if (lit) txt(c, String(idx + 1), x0 + x * cs + cs / 2, y0 + y * cs + cs / 2, 50, '#0b2a14'); }
    txt(c, '🏁 출발', MW / 2, y0 + hh * cs + 40, 32, th.ink); txt(c, '🚪 탈출', MW / 2, y0 - 30, 32, th.ink);
    header(c, show ? '안전한 길을 기억하세요!' : '기억한 길로 한 명씩 건너요!', null, th);
  } else if (v.style === 'code') {
    if (show) { txt(c, v.seq.slice(0, cur + 1).join(' '), MW / 2, 300, 150, th.acc, 900); }
    else { txt(c, v.seq.map(() => '•').join(' '), MW / 2, 300, 150, th.sub, 900); }
    const tb = v.table; cols(5, 60, MW - 60).forEach((x, i) => { for (let r2 = 0; r2 < 2; r2++) { const d = i + r2 * 5; panel(c, x - 120, 470 + r2 * 190, 240, 170, th); txt(c, String(d), x - 80, 520 + r2 * 190, 50, th.acc); figure(c, x + 40, 625 + r2 * 190, 90, '#74c0fc', tb[d].k, (t / 1.2) % 1, styleOf(th), { neon: th.line }); txt(c, tb[d].n, x - 10, 600 + r2 * 190, 16, th.sub, 800, 'center', 'sans-serif', 130); } });
    header(c, show ? '암호를 기억하세요!' : '숫자 순서대로 동작 코드 입력!', null, th);
  } else {
    // 동작 카드 줄 (발자국·계주·늘어나는 순서)
    const cw = Math.min(220, (MW - 80) / n); const x0 = MW / 2 - (cw * n) / 2;
    v.seq.forEach((m, i) => { const vis = show ? i <= cur : false; const x = x0 + i * cw + cw / 2;
      if (v.style === 'footprint') { c.save(); c.translate(x, 640 - (i % 2) * 60); c.rotate(-0.2); c.fillStyle = vis ? '#7a4a24' : '#ffffff22'; c.beginPath(); c.ellipse(0, 0, cw * 0.28, cw * 0.38, 0, 0, 7); c.fill(); for (let j = -1; j <= 1; j++) { c.beginPath(); c.arc(j * cw * 0.16, -cw * 0.44, cw * 0.08, 0, 7); c.fill(); } c.restore(); }
      else { panel(c, x - cw / 2 + 8, 290, cw - 16, 520, th, vis ? (i === cur ? th.acc : '#ffffff22') : null); txt(c, `${i + 1}`, x - cw / 2 + 34, 320, 26, vis ? '#1a1a2e' : th.sub, 900); }
      if (vis) { figure(c, x, v.style === 'footprint' ? 470 : 780, v.style === 'footprint' ? Math.min(150, cw * 0.7) : Math.min(230, cw * 0.9), '#ff6b6b', m.k, i === cur ? (t / 0.8) % 1 : 0.25, styleOf(th), { neon: th.line }); txt(c, m.n, x, v.style === 'footprint' ? 760 : 360, Math.min(26, cw * 0.13), v.style === 'footprint' ? th.ink : '#1a1a2e', 900, 'center', 'sans-serif', cw - 30); }
      else txt(c, show ? '?' : String(i + 1), x, v.style === 'footprint' ? 640 - (i % 2) * 60 : 560, 80, th.sub, 900); });
    if (v.style === 'footprint' && show) { c.fillStyle = '#000'; c.font = '110px sans-serif'; c.textAlign = 'center'; c.fillText('🦖', x0 - 60 + ((cur + 1) / n) * cw * n, 210 + Math.sin(t * 6) * 8); }
    header(c, show ? (v.style === 'relay' ? '1번 주자부터 순서를 외워요!' : '순서를 기억하세요!') : (v.style === 'relay' ? '팀원이 한 동작씩 이어서!' : '기억한 순서대로 해 봐요!'), show ? `${cur + 1} / ${n}` : `${Math.ceil(v.left)}초`, th);
  }
  if (!show) { const got = new Set(v.got); cols(ctx.teams.length, 120, MW - 120).forEach((x, i) => { const tm = ctx.teams[i]; c.fillStyle = got.has(tm.id) ? tm.color : '#00000055'; rr(c, x - 80, 836, 160, 32, 16); c.fill(); txt(c, got.has(tm.id) ? '✓ 판정 완료' : tm.name, x, 852, 18, '#fff', 900); }); }
};

R.race = (c, s, ctx, th, t) => {
  const v = s.st; const n = ctx.teams.length;
  if (v.style === 'track') {
    const lh = Math.min(140, 700 / n); const y0 = 140; const x0 = 230, x1 = MW - 90;
    ctx.teams.forEach((tm, i) => { const y = y0 + i * lh; c.fillStyle = i % 2 ? '#b0503a' : '#c45c43'; c.fillRect(x0 - 20, y, x1 - x0 + 70, lh - 8); c.strokeStyle = '#ffffff88'; c.setLineDash([20, 14]); c.lineWidth = 3; c.beginPath(); c.moveTo(x0 - 20, y); c.lineTo(x1 + 50, y); c.stroke(); c.setLineDash([]);
      for (let q = 0; q < Math.floor((lh - 8) / 14); q++) for (let r2 = 0; r2 < 2; r2++) { c.fillStyle = (q + r2) % 2 ? '#111' : '#fff'; c.fillRect(x1 + 20 + r2 * 12, y + q * 14, 12, 14); }
      c.fillStyle = tm.color; c.fillRect(20, y, 190, lh - 8); txt(c, tm.name, 115, y + lh * 0.35, Math.min(28, lh * 0.24), '#fff', 900, 'center', 'sans-serif', 180); txt(c, `${v.prog[tm.id]}/${v.goal}`, 115, y + lh * 0.68, Math.min(24, lh * 0.2), '#fff');
      const p = Math.min(1, v.prog[tm.id] / v.goal); const x = x0 + (x1 - x0) * p; const done = v.done.indexOf(tm.id);
      figure(c, x, y + lh - 14, lh * 0.75, tm.color, done >= 0 ? 'up' : 'jog', (t / 0.5 + i * 0.2) % 1, 'sport', { num: String(i + 1) });
      if (done >= 0) txt(c, ['🥇', '🥈', '🥉'][done] || '🏁', x + lh * 0.5, y + lh * 0.4, lh * 0.45, '#fff'); });
    header(c, '🏃 계주 챔피언십', v.chapters ? `이번 구간: ${v.chapters[0]}` : '', th); return;
  }
  if (v.style === 'rocket') {
    cols(n, 80, MW - 80).forEach((x, i) => { const tm = ctx.teams[i]; const alt = v.alt[tm.id] || 0; const pr = v.prog[tm.id]; const lift = (alt * 60) % 400; const fly = pr === 0 && alt > 0 && ((t * 1000) % 3000) < 1500;
      c.fillStyle = '#ffffff12'; c.fillRect(x - 60, 160, 120, 640); for (let a = 0; a < alt; a++) star(c, x - 50 + (a % 3) * 50, 180 + Math.floor(a / 3) * 40, 14, '#ffd43b');
      rocket(c, x, 720 - lift - (fly ? 60 : 0), 160, tm.color, fly || pr > 0);
      for (let k = 0; k < v.goal; k++) { c.fillStyle = k < pr ? '#2fd27a' : '#ffffff22'; rr(c, x - 60 + k * 31, 820, 26, 18, 6); c.fill(); }
      txt(c, `${tm.name} · 고도 ${alt}`, x, 860, 20, th.ink, 900, 'center', 'sans-serif', 200); });
    header(c, '🚀 로켓 발사 경쟁', `단계 ${v.goal}칸을 채우면 발사!`, th); return;
  }
  if (v.style === 'fuel') {
    cols(n, 80, MW - 80).forEach((x, i) => { const tm = ctx.teams[i]; const p = Math.min(1, v.prog[tm.id] / v.goal); const done = v.done.includes(tm.id);
      const ty = done ? 700 - ((t * 200) % 700) : 700; rocket(c, x, ty - 120, 150, tm.color, done);
      c.strokeStyle = '#ffffff55'; c.lineWidth = 4; rr(c, x - 50, 280, 100, 440, 20); c.stroke(); const g = c.createLinearGradient(0, 720, 0, 280); g.addColorStop(0, '#ff922b'); g.addColorStop(1, '#ffe066'); c.fillStyle = g; rr(c, x - 46, 716 - 436 * p, 92, 436 * p, 18); c.fill();
      txt(c, `${v.prog[tm.id]}/${v.goal}`, x, 500, 40, '#1a1a2e'); txt(c, tm.name, x, 760, 24, th.ink, 900, 'center', 'sans-serif', 200); txt(c, v.chapters[v.prog[tm.id] % v.chapters.length], x, 800, 16, th.sub, 800, 'center', 'sans-serif', (MW - 160) / n - 10); });
    header(c, '⛽ 우주선 연료 충전', '세트를 끝낼 때마다 연료 +1, 가득 차면 발사!', th); return;
  }
  // 별 길·보물상자·구조
  if (v.style === 'rescue') bg(c, MW, H, th, t, 'sea');
  if (v.style === 'stars') bg(c, MW, H, th, t, 'stars');
  const lh = Math.min(170, 700 / n);
  ctx.teams.forEach((tm, i) => { const y = 150 + i * lh; const p = v.prog[tm.id]; const ch = v.chapters[p % v.chapters.length]; const mv = v.moves[p % v.moves.length];
    panel(c, 30, y, MW - 60, lh - 14, th); c.fillStyle = tm.color; rr(c, 30, y, 16, lh - 14, 8); c.fill(); txt(c, tm.name, 120, y + (lh - 14) / 2, 24, th.ink, 900, 'center', 'sans-serif', 170);
    if (v.style === 'chest') { chest(c, MW - 180, y + lh * 0.55, lh * 0.75, v.done.includes(tm.id), p, v.goal); }
    else for (let k = 0; k < v.goal; k++) { const x = 400 + k * ((MW - 660) / (v.goal - 1)); if (v.style === 'stars') star(c, x, y + lh * 0.45, lh * 0.2, k < p ? '#ffd43b' : '#ffffff33', t * (k < p ? 1 : 0)); else { c.fillStyle = '#000'; c.font = `${lh * 0.4}px sans-serif`; c.textAlign = 'center'; c.globalAlpha = k < p ? 1 : 0.3; c.fillText(['🐢', '🐬', '🐙', '🦀', '🐠', '🐳'][k % 6], x, y + lh * 0.45); c.globalAlpha = 1; if (k < p) txt(c, '❤️', x + lh * 0.2, y + lh * 0.2, lh * 0.15, '#fff'); } }
    if (v.style === 'stars') rocket(c, 400 + Math.min(p, v.goal - 1) * ((MW - 660) / (v.goal - 1)) - 60, y + lh * 0.45, lh * 0.6, tm.color, true);
    figure(c, 280, y + lh - 20, lh * 0.55, tm.color, mv.k, (t / 0.9 + i * 0.25) % 1, styleOf(th), { neon: th.line });
    txt(c, v.done.includes(tm.id) ? '🎉 완료!' : ch, v.style === 'chest' ? MW / 2 - 60 : MW / 2, y + lh - 26, Math.min(24, lh * 0.15), th.sub, 800, 'center', th.font, MW - 520); });
  if (v.coopGoal) { const k = Math.min(1, v.total / v.coopGoal); panel(c, MW * 0.2, 96, MW * 0.6, 34, th); c.fillStyle = '#4dabf7'; rr(c, MW * 0.2, 96, MW * 0.6 * k, 34, 17); c.fill(); txt(c, `다 같이 구조 ${v.total}/${v.coopGoal}${k >= 1 ? ' 🎉 모두 성공!' : ''}`, MW / 2, 113, 20, '#fff'); }
  header(c, { stars: '🚀 우주 탐험대', chest: '🧰 보물상자 열기', rescue: '🐬 바다 생물 구조대' }[v.style] || '', null, th);
};

R.tug = (c, s, ctx, th, t, def, fx) => {
  const v = s.st; if (!v.pair) { header(c, '🏆 모든 경기 끝!', null, th); return; }
  const [A, B] = v.pair; const ca = tcol(ctx, A), cb = tcol(ctx, B); const k = v.pos / v.goal; const cx = MW / 2 + k * 380;
  header(c, `경기 ${v.mi + 1}/${v.n}`, v.ph === 'won' ? '경기 끝!' : v.ph === 'ready' ? '준비…' : `미션: ${v.mv.n}! 먼저 끝내면 줄이 당겨져요`, th);
  if (v.left != null) ring(c, 90, 150, 50, v.left / 45, v.left < 6 ? '#ff4d6d' : th.acc, th, Math.ceil(v.left));
  c.fillStyle = '#ffffff22'; c.fillRect(MW / 2 - 3, 300, 6, 380); c.fillStyle = ca + '33'; c.fillRect(MW / 2 - 380 - 40, 300, 80, 380); c.fillStyle = cb + '33'; c.fillRect(MW / 2 + 380 - 40, 300, 80, 380);
  c.strokeStyle = '#c8a46a'; c.lineWidth = 22; c.beginPath(); c.moveTo(80, 520); for (let x = 80; x <= MW - 80; x += 20) c.lineTo(x, 520 + Math.sin(x / 40 + t * 8) * (v.ph === 'pull' ? 3 : 1)); c.stroke();
  c.fillStyle = '#ff4d6d'; c.beginPath(); c.moveTo(cx, 520); c.lineTo(cx - 24, 600); c.lineTo(cx + 24, 600); c.fill();
  for (let i = 0; i < 3; i++) { figure(c, cx - 230 - i * 110, 760, 200, ca, 'row', (t / 0.6 + i * 0.2) % 1, styleOf(th), { neon: th.line }); figure(c, cx + 230 + i * 110, 760, 200, cb, 'row', (t / 0.6 + i * 0.2 + 0.5) % 1, styleOf(th), { neon: th.line }); }
  txt(c, tnm(ctx, A), 260, 230, 44, ca, 900, 'center', th.font, 460); txt(c, tnm(ctx, B), MW - 260, 230, 44, cb, 900, 'center', th.font, 460); txt(c, 'VS', MW / 2, 230, 60, th.acc);
  if (v.ph === 'won') { const w = v.pos < 0 ? A : B; txt(c, `🏆 ${tnm(ctx, w)} 승리!`, MW / 2, 420, 80, tcol(ctx, w), 900); }
  if (v.next) txt(c, `다음 경기: ${tnm(ctx, v.next[0])} vs ${tnm(ctx, v.next[1])}`, MW / 2, 850, 22, th.sub, 800);
};

R.attack = (c, s, ctx, th, t, def, fx) => {
  const v = s.st; const n = ctx.teams.length; const now = performance.now();
  if (v.style === 'dragon' || v.style === 'castle') {
    const k = v.bossMax ? v.boss / v.bossMax : 0; const shake = fx.shake && now - fx.shake < 300 ? (Math.random() - 0.5) * 20 : 0;
    if (v.style === 'dragon') {
      const dead = v.boss <= 0; c.save(); c.translate(MW / 2 + shake, 360 + Math.sin(t * 2) * 12); c.globalAlpha = dead ? 0.35 : 1;
      c.fillStyle = '#5c2a8a'; c.beginPath(); c.moveTo(-260, -20); c.quadraticCurveTo(-420, -220, -120, -120); c.lineTo(-60, -40); c.fill(); c.beginPath(); c.moveTo(260, -20); c.quadraticCurveTo(420, -220, 120, -120); c.lineTo(60, -40); c.fill();
      c.fillStyle = '#7b2fbe'; c.beginPath(); c.ellipse(0, 40, 170, 120, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(0, -110, 110, 90, 0, 0, 7); c.fill();
      c.fillStyle = '#ffe066'; c.beginPath(); c.arc(-40, -120, 18, 0, 7); c.arc(40, -120, 18, 0, 7); c.fill(); c.fillStyle = '#1a1a2e'; c.fillRect(-44, -134, 8, 28); c.fillRect(36, -134, 8, 28);
      c.fillStyle = '#e9ecef'; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 60, -180); c.lineTo(sx * 90, -260); c.lineTo(sx * 100, -170); c.fill(); }
      if (v.br != null) { const g = c.createLinearGradient(0, -60, 0, 500); g.addColorStop(0, '#fff3a8'); g.addColorStop(0.4, '#ff922b'); g.addColorStop(1, '#ff4d6d00'); c.fillStyle = g; c.beginPath(); c.moveTo(-40, -50); c.lineTo(-500, 520); c.lineTo(500, 520); c.lineTo(40, -50); c.fill(); }
      c.restore();
      if (v.br != null) { txt(c, `🔥 브레스! 숙여요! ${Math.ceil(v.br)}`, MW / 2, 600, 60, '#ffe066', 900); }
      if (dead) txt(c, `🐉 드래곤 처치! 막타 ${v.slain != null ? tnm(ctx, v.slain) : ''}`, MW / 2, 600, 56, th.acc, 900, 'center', th.font, MW - 100);
    } else {
      c.save(); c.translate(MW / 2 + shake, 0); const segs = 12; c.fillStyle = '#868e96'; rr(c, -260, 240, 520, 360, 8); c.fill(); for (let i = 0; i < 6; i++) { c.fillRect(-260 + i * 96, 200, 50, 50); }
      for (let i = 0; i < segs; i++) { const broken = i >= Math.round(k * segs); c.fillStyle = broken ? '#343a40' : '#adb5bd'; c.fillRect(-250 + (i % 6) * 84, 260 + Math.floor(i / 6) * 160, 76, 150); if (broken) txt(c, '💥', -212 + (i % 6) * 84, 335 + Math.floor(i / 6) * 160, 34, '#fff'); }
      c.fillStyle = v.owner != null ? tcol(ctx, v.owner) : '#ffffff'; c.fillRect(-4, 90, 8, 120); c.beginPath(); c.moveTo(4, 90); c.lineTo(90, 120); c.lineTo(4, 150); c.fill(); c.restore();
      txt(c, `성 레벨 ${v.lvl}${v.owner != null ? ` · 지난 점령: ${tnm(ctx, v.owner)}` : ''}`, MW / 2, 630, 26, th.ink, 900, 'center', th.font);
    }
    panel(c, MW * 0.15, 110, MW * 0.7, 40, th); c.fillStyle = '#ff4d6d'; rr(c, MW * 0.15, 110, MW * 0.7 * k, 40, 20); c.fill(); txt(c, `HP ${v.boss}/${v.bossMax}`, MW / 2, 131, 24, '#fff');
    header(c, v.style === 'dragon' ? '🐉 드래곤 레이드' : '🏰 성벽 점령전', null, th);
    cols(n, 80, MW - 80).forEach((x, i) => figure(c, x, 840, 130, ctx.teams[i].color, v.br != null ? 'duck' : v.mv.k, (t / 0.6 + i * 0.3) % 1, styleOf(th), { neon: th.line }));
    txt(c, `공격 미션: ${v.mv.n}`, MW / 2, 680, 30, th.acc, 900, 'center', th.font);
    return;
  }
  // 팀별 풍선 / 배
  const xs = cols(n, 80, MW - 80); const cw = (MW - 160) / n;
  xs.forEach((x, i) => { const tm = ctx.teams[i]; const hp = v.hp[tm.id]; const out = hp <= 0;
    if (v.style === 'balloons') { for (let b = 0; b < v.max; b++) { const bx = x + ((b % 3) - 1) * cw * 0.26, by = 300 + Math.floor(b / 3) * 150 + Math.sin(t * 2 + b + i) * 8; balloonS(c, bx, by, Math.min(52, cw * 0.18), tm.color, t + b, b >= hp); } }
    else { const sink = out ? Math.min(200, ((t * 60) % 400)) : 0; c.save(); c.translate(x, 560 + Math.sin(t * 2 + i) * 8 + sink); c.rotate(Math.sin(t * 1.5 + i) * 0.05); c.fillStyle = '#6b3a1e'; c.beginPath(); c.moveTo(-cw * 0.38, 0); c.lineTo(cw * 0.38, 0); c.lineTo(cw * 0.28, 70); c.lineTo(-cw * 0.28, 70); c.fill(); c.fillStyle = '#3d2614'; c.fillRect(-4, -200, 8, 200); c.fillStyle = '#f8f0e3'; c.beginPath(); c.moveTo(4, -190); c.lineTo(cw * 0.3, -110); c.lineTo(4, -40); c.fill(); c.fillStyle = tm.color; c.beginPath(); c.moveTo(4, -200); c.lineTo(60, -185); c.lineTo(4, -170); c.fill(); c.restore();
      if (i === 0) { c.fillStyle = '#1971c2aa'; c.fillRect(0, 620, MW, H - 620); }
      for (let hpx = 0; hpx < v.max; hpx++) heart(c, x - (v.max - 1) * 16 + hpx * 32, 240, 14, hpx < hp ? '#ff4d6d' : '#ffffff33'); }
    txt(c, tm.name, x, 180, 28, tm.color === '#ffffff' ? th.ink : tm.color, 900, 'center', th.font, cw - 20); if (out) txt(c, v.style === 'ships' ? '침몰… 응원단!' : '응원단 📣', x, 790, 26, th.sub, 900);
    else figure(c, x, 850, 120, tm.color, v.mv.k, (t / 0.6 + i * 0.25) % 1, styleOf(th), { neon: th.line }); });
  // 공격 효과
  for (const e of s.ev.filter((e) => e.k === 'hit' && e.to != null)) { const age = s.T - e.t; if (age < 0 || age > 0.8) continue; const ia = ctx.teams.findIndex((x) => x.id === e.team), ib = ctx.teams.findIndex((x) => x.id === e.to); if (ia < 0 || ib < 0) continue; const k = age / 0.8; const x = xs[ia] + (xs[ib] - xs[ia]) * k, y = 450 - Math.sin(k * Math.PI) * 250; c.fillStyle = v.style === 'ships' ? '#212529' : tcol(ctx, e.team); c.beginPath(); c.arc(x, y, 20, 0, 7); c.fill(); }
  header(c, v.style === 'ships' ? '🏴‍☠️ 해적선 전투' : '💥 풍선 터뜨리기 대전', `미션: ${v.mv.n} → 성공하면 ${v.style === 'ships' ? '옆 배 포격' : '1등 팀 풍선 공격'}`, th);
};

R.tower = (c, s, ctx, th, t) => {
  const v = s.st; const n = ctx.teams.length; const xs = cols(n, 80, MW - 80); const cw = Math.min(200, (MW - 160) / n - 30); const mx = Math.max(8, ...Object.values(v.h)); const bh = Math.min(60, 560 / mx);
  xs.forEach((x, i) => { const tm = ctx.teams[i]; const hh = v.h[tm.id]; const wob = v.wob[tm.id]; c.save(); c.translate(x, 800); if (wob) c.rotate(Math.sin(t * 9) * 0.04);
    for (let b = 0; b < hh; b++) { const g = c.createLinearGradient(-cw / 2, 0, cw / 2, 0); g.addColorStop(0, tm.color); g.addColorStop(1, tm.color + 'aa'); c.fillStyle = g; rr(c, -cw / 2 + (b % 2) * 6 - 3, -(b + 1) * bh, cw, bh - 4, 6); c.fill(); c.fillStyle = '#ffffff33'; c.fillRect(-cw / 2 + (b % 2) * 6, -(b + 1) * bh + 4, cw - 8, 6); }
    c.restore(); txt(c, `${hh}층`, x, 790 - hh * bh - 30, 34, th.ink, 900); if (wob) txt(c, '⚠️ 흔들림! 균형 미션', x, 790 - hh * bh - 76, 22, '#ff922b', 900, 'center', 'sans-serif', cw + 40);
    txt(c, tm.name, x, 830, 24, th.ink, 900, 'center', 'sans-serif', cw + 20); txt(c, v.mv[tm.id].n, x, 860, 18, th.sub, 800, 'center', 'sans-serif', cw + 30); });
  c.fillStyle = th.ground; c.fillRect(0, 805, MW, 6);
  header(c, '🗼 미션 타워', '미션 성공 = 한 층! 높을수록 흔들려요', th);
};

R.zone = (c, s, ctx, th, t) => {
  const v = s.st; const z = v.z; const n = z.length;
  const cell = (i) => { if (v.style === 'flags') return [MW / 2 - 300 + (i % 3) * 200 + 100, 170 + Math.floor(i / 3) * 200 + 100, 90]; const cols2 = Math.ceil(n / 2); const r = Math.floor(i / cols2), cc = i % cols2; return [140 + cc * ((MW - 280) / Math.max(1, cols2 - 1)), 300 + r * 280, 110]; };
  z.forEach((zz, i) => { const [x, y, r] = cell(i); const open = i === v.open; const col = zz.own != null ? tcol(ctx, zz.own) : '#ffffff22';
    if (open) { glow(c, th.acc, 40); c.strokeStyle = th.acc; c.lineWidth = 8; c.beginPath(); c.arc(x, y, r + 14 + Math.sin(t * 6) * 4, 0, 7); c.stroke(); noGlow(c); }
    c.fillStyle = col; c.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.fill();
    if (v.style === 'energy') txt(c, '⚡', x, y - 10, 50, zz.own != null ? '#fff' : th.sub); else if (v.style === 'flags') { c.fillStyle = '#ffffffaa'; c.fillRect(x - 3, y - 50, 6, 80); c.fillStyle = zz.own != null ? col : '#adb5bd'; c.beginPath(); c.moveTo(x + 3, y - 50); c.lineTo(x + 55, y - 35); c.lineTo(x + 3, y - 20); c.fill(); }
    else txt(c, `★${zz.v}`, x, y - 12, 40, zz.own != null ? '#fff' : th.acc, 900);
    txt(c, zz.own != null ? tnm(ctx, zz.own) : `구역 ${i + 1}`, x, y + 40, 20, '#fff', 900, 'center', 'sans-serif', r * 1.8);
    if (open) txt(c, `🎯 ${zz.mv.n}`, x, y + r + 40, 26, th.acc, 900, 'center', th.font, 340); });
  for (const l of v.lines || []) { const [x1, y1] = cell(l[0]), [x2, y2] = cell(l[2]); c.strokeStyle = tcol(ctx, z[l[0]].own); c.lineWidth = 12; c.globalAlpha = 0.6; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.globalAlpha = 1; }
  header(c, { energy: '🔋 에너지 쟁탈전', flags: '🚩 깃발 점령전', strategic: '🗺️ 점령 구역 전쟁' }[v.style], `열린 구역 ${v.open + 1}의 미션을 먼저! · 다음 구역까지 ${Math.ceil(v.left)}초${v.inc != null ? ` · 에너지 지급 ${Math.ceil(v.inc)}초` : ''}`, th);
};

R.bingo = (c, s, ctx, th, t) => {
  const v = s.st; const nT = ctx.teams.length; const per = Math.min(4, nT); const bw = Math.min(330, (MW - 60) / per - 20); const cs = bw / v.n;
  const cm = v.cell != null ? v.pool[v.cell] : null;
  if (cm) { panel(c, 40, 120, 420, 300, th, th.acc); txt(c, '이번 미션', 250, 160, 26, '#1a1a2e'); figure(c, 250, 390, 170, '#ff6b6b', cm.k, (t / 0.9) % 1, styleOf(th), { neon: th.line }); txt(c, cm.n, 250, 200, 36, '#1a1a2e', 900, 'center', th.font, 380); ring(c, 420, 160, 28, 1 - v.k, '#1a1a2e', th, ''); }
  const rows = nT <= 3 ? 1 : 2; const per2 = Math.ceil(nT / rows); const bwi = Math.min((MW - 520) / per2 - 20, (H - 150) / rows - 56);
  ctx.teams.forEach((tm, i) => { const col = i % per2, row = Math.floor(i / per2); const x0 = 500 + col * ((MW - 520) / per2), y0 = 120 + row * (bwi + 56); const cs2 = bwi / v.n;
    txt(c, `${tm.name}${v.bingos[tm.id] ? ` · 빙고 ${v.bingos[tm.id]}` : ''}`, x0 + bwi / 2, y0 + 16, 22, tm.color === '#ffffff' ? th.ink : tm.color, 900, 'center', 'sans-serif', bwi);
    const b = v.boards[tm.id]; const mk = new Set(v.mark[tm.id]);
    for (let k = 0; k < v.n * v.n; k++) { const x = x0 + (k % v.n) * cs2, y = y0 + 36 + Math.floor(k / v.n) * cs2; const id = b[k]; const on = mk.has(id); const isCall = id === v.cell;
      c.fillStyle = on ? tm.color : isCall ? th.acc + '55' : th.k === 'kid' ? '#ffffffb0' : '#ffffff14'; rr(c, x + 3, y + 3, cs2 - 6, cs2 - 6, 8); c.fill(); txt(c, on ? '✔' : v.pool[id].n, x + cs2 / 2, y + cs2 / 2, on ? cs2 * 0.5 : Math.min(17, cs2 * 0.17), on ? '#fff' : th.sub, 800, 'center', 'sans-serif', cs2 - 10); } });
  header(c, '🔲 스포츠 빙고', '팀마다 칸 위치가 달라요 · 한 줄 완성하면 빙고!', th);
};

R.choice = (c, s, ctx, th, t) => {
  const v = s.st; const pick = v.ph === 'pick'; const no = v.opts.length;
  const title = { chests: '💰 보물 쟁탈전', minority: '🎭 심리전 서바이벌', blind: '🃏 블라인드 전략 배틀', risk: '🎲 리스크 배틀', auction: '🔨 체력 경매', cards: '🂡 전략 카드 아레나', reverse: '♟️ 역전의 한 수' }[v.rule] || '';
  header(c, `${title} · ROUND ${v.rd}`, pick ? '팀이 몰래 고르고 사회자에게 알려 주세요' : '공개! 미션 결과를 기다려요', th);
  const xs = cols(no, 60, MW - 60); const cw = (MW - 120) / no - 30;
  v.opts.forEach((o, i) => { const x = xs[i]; const y = 150; const hh = 330; const flipped = !pick;
    const who = flipped ? Object.entries(v.picked || {}).filter(([, p]) => p === i).map(([tm]) => +tm) : [];
    panel(c, x - cw / 2, y, cw, hh, th, v.rule === 'minority' && flipped && v.minor?.includes(i) ? '#2fd27a55' : null);
    if (v.rule === 'blind') { if (flipped && v.vals) { txt(c, `${v.vals[i]}점`, x, y + 120, 80, th.acc, 900); if (v.miss) txt(c, v.miss[i].n, x, y + 210, 24, th.ink, 800); } else { c.fillStyle = th.acc + '55'; rr(c, x - cw / 2 + 20, y + 20, cw - 40, hh - 40, th.round); c.fill(); txt(c, '?', x, y + hh / 2, 120, th.ink, 900); } }
    else if (v.rule === 'chests') { chest(c, x, y + 150, Math.min(170, cw * 0.6), false, 0, 0); txt(c, o.n, x, y + 230, 32, th.ink, 900); txt(c, `${o.v}점 · 남은 ${Math.max(0, v.limit[i] - (v.claim?.[i] || 0))}개`, x, y + 270, 22, th.acc, 900); }
    else if (v.rule === 'auction') { txt(c, o.n, x, y + 120, 54, th.ink, 900); }
    else { txt(c, o.n, x, y + 110, Math.min(40, cw * 0.13), th.ink, 900, 'center', th.font, cw - 20); if (o.v) txt(c, o.v > 0 ? `+${o.v}` : '', x, y + 180, 50, th.acc, 900); }
    if (o.task) txt(c, o.task, x, y + hh - 34, 18, th.sub, 800, 'center', 'sans-serif', cw - 20);
    who.forEach((tm, k) => { c.fillStyle = tcol(ctx, tm); rr(c, x - cw / 2 + 10 + (k % 3) * ((cw - 20) / 3), y + hh + 10 + Math.floor(k / 3) * 46, (cw - 20) / 3 - 6, 40, 12); c.fill(); txt(c, tnm(ctx, tm), x - cw / 2 + 10 + (k % 3) * ((cw - 20) / 3) + ((cw - 20) / 3 - 6) / 2, y + hh + 30 + Math.floor(k / 3) * 46, 15, '#fff', 900, 'center', 'sans-serif', (cw - 20) / 3 - 12); }); });
  if (pick) { const pk = new Set(v.picked); cols(ctx.teams.length, 80, MW - 80).forEach((x, i) => { const tm = ctx.teams[i]; c.fillStyle = pk.has(tm.id) ? tm.color : '#ffffff18'; rr(c, x - 90, 560, 180, 60, 30); c.fill(); txt(c, pk.has(tm.id) ? `${tm.name} 선택 완료` : `${tm.name} 고르는 중…`, x, 590, 18, '#fff', 900, 'center', 'sans-serif', 170); }); }
  let info = '';
  if (v.rule === 'blind' && v.hint) info = `💡 ${v.hint}`;
  if (v.rule === 'auction') info = `🔨 이번 상품 ${v.prize}점 · 종목: ${v.amv?.n}${!pick && v.winners ? ` · 낙찰: ${v.winners.map((w) => tnm(ctx, w)).join(', ')}` : ''}`;
  if (v.rule === 'cards' || v.rule === 'reverse') info = `공통 미션: ${v.cmv?.n}${v.rule === 'reverse' ? ' · 역전 카드 남은 수: ' + ctx.teams.map((tm) => `${tm.name} ${v.cards[tm.id]}`).join(' / ') : ''}`;
  if (v.rule === 'minority' && !pick) info = v.minor?.length ? `소수파 생존: ${v.minor.map((i) => v.opts[i].n.split(' ')[0]).join(', ')} · 나머지는 미션!` : '모두 같은 선택 → 전원 미션!';
  if (info) txt(c, info, MW / 2, 690, 30, th.acc, 900, 'center', th.font, MW - 80);
  if (!pick) cols(ctx.teams.length, 80, MW - 80).forEach((x, i) => { const tm = ctx.teams[i]; const r2 = v.res[tm.id]; if (!r2) return; txt(c, r2 === 'ok' ? '✅' : r2 === 'fail' ? '❌' : r2 === 'safe' ? '🛡️' : '–', x, 780, 50, '#fff'); txt(c, tm.name, x, 830, 20, th.ink, 900, 'center', 'sans-serif', 180); });
};

R.bomb = (c, s, ctx, th, t, def, fx) => {
  const v = s.st; const xs = cols(ctx.teams.length, 100, MW - 100); const hi = ctx.teams.findIndex((x) => x.id === v.holder);
  xs.forEach((x, i) => { const tm = ctx.teams[i]; panel(c, x - 100, 560, 200, 200, th, i === hi ? tm.color + '55' : null); figure(c, x, 740, 150, tm.color, i === hi ? v.tmv.k : 'freeze', i === hi ? (t / 0.5) % 1 : 0.3, styleOf(th), { neon: th.line }); txt(c, tm.name, x, 790, 24, th.ink, 900, 'center', 'sans-serif', 190); });
  if (v.ph === 'boom') { const k = Math.min(1, (performance.now() - (fx.boomAt || 0)) / 600); c.fillStyle = `rgba(255,160,40,${0.6 * (1 - k)})`; c.fillRect(0, 0, MW, H); txt(c, '💥 펑!', xs[hi] || MW / 2, 360, 160 * (0.7 + k * 0.5), '#ff922b', 900); }
  else if (hi >= 0) { const x = xs[hi]; const sh = Math.sin(t * (10 + v.heat * 30)) * (2 + v.heat * 8); c.fillStyle = '#212529'; c.beginPath(); c.arc(x + sh, 400, 100, 0, 7); c.fill(); c.fillStyle = '#ffffff22'; c.beginPath(); c.arc(x - 30 + sh, 370, 26, 0, 7); c.fill(); c.strokeStyle = '#c8a46a'; c.lineWidth = 8; c.beginPath(); c.moveTo(x + 60 + sh, 330); c.quadraticCurveTo(x + 110, 270, x + 90, 240); c.stroke(); for (let k = 0; k < 6; k++) { c.fillStyle = ['#ffe066', '#ff922b'][k % 2]; c.beginPath(); c.arc(x + 90 + Math.sin(t * 30 + k) * 14, 240 + Math.cos(t * 25 + k) * 14, 6, 0, 7); c.fill(); } }
  header(c, `💥 폭탄 미션: ${v.task}`, `폭탄 든 팀: ${tnm(ctx, v.holder)} · 끝내면 다음 팀에게! (넘긴 횟수 ${v.passes})`, th);
};

R.survive = (c, s, ctx, th, t) => {
  const v = s.st; const n = v.seq.length; const cw = Math.min(200, (MW - 100) / n); const x0 = MW / 2 - (cw * n) / 2; const cur = v.per ? Math.floor(v.el / v.per) % n : -1;
  v.seq.forEach((m, i) => { const x = x0 + i * cw + cw / 2; panel(c, x - cw / 2 + 6, 170, cw - 12, 300, th, i === cur && v.ph === 'go' ? th.acc + 'aa' : null); figure(c, x, 430, Math.min(170, cw * 0.75), '#ff6b6b', m.k, i === cur || v.cd ? (t / Math.max(0.4, v.per || 0.8)) % 1 : 0.25, styleOf(th), { neon: th.line }); txt(c, m.n, x, 200, Math.min(20, cw * 0.11), th.ink, 900, 'center', 'sans-serif', cw - 20); });
  if (v.cd) ring(c, MW / 2, 600, 70, v.left / v.lim, v.left < 5 ? '#ff4d6d' : th.acc, th, Math.ceil(v.left));
  else txt(c, v.ph === 'go' ? `속도 ${(1.8 / v.per).toFixed(1)}배` : '판정 중…', MW / 2, 560, 34, th.acc, 900);
  cols(ctx.teams.length, 80, MW - 80).forEach((x, i) => { const tm = ctx.teams[i]; const lv = v.lives[tm.id]; const out = lv <= 0; c.globalAlpha = out ? 0.35 : 1; txt(c, tm.name, x, 720, 26, tm.color === '#ffffff' ? th.ink : tm.color, 900, 'center', 'sans-serif', 200); for (let k = 0; k < v.max; k++) heart(c, x - (v.max - 1) * 22 + k * 44, 780, 18, k < lv ? '#ff4d6d' : '#ffffff22'); c.globalAlpha = 1; if (out) txt(c, '탈락 📣', x, 840, 24, th.sub, 900); else if (v.res[tm.id]) txt(c, v.res[tm.id] === 'ok' ? '✅ 통과' : '💔 실패', x, 840, 24, '#fff', 900); });
  header(c, v.cd ? `⏳ 파이널 카운트다운 · ROUND ${v.rd}` : `🔥 마지막 생존자 · ROUND ${v.rd}`, v.cd ? `제한시간 ${v.lim}초 · 통과하면 +${v.rd}` : '패턴을 따라 해요!', th);
};

R.mission = (c, s, ctx, th, t) => {
  const v = s.st; const st = v.style;
  if (st === 'cipher') {
    const k = v.key; cols(k.length, 60, MW - 60).forEach((x, i) => { panel(c, x - 100, 560, 200, 250, th); txt(c, k[i][0], x, 610, 60, th.acc); figure(c, x, 790, 110, '#74c0fc', k[i][1].k, (t / 1.1) % 1, styleOf(th), { neon: th.line }); txt(c, k[i][1].n, x, 660, 18, th.sub, 800, 'center', 'sans-serif', 180); });
    const code = (v.code || []).map((i) => k[i][0]).join('  '); panel(c, 200, 150, MW - 400, 220, th, '#0b1030'); glow(c, '#2fd27a', 20); txt(c, code, MW / 2, 260, 130, '#2fd27a', 900, 'center', 'monospace', MW - 460); noGlow(c);
    header(c, `🕵️ 암호 ${v.rd} 해독`, v.ph === 'go' ? `해독표를 보고 순서대로 동작! ${Math.ceil(v.left)}초` : '판정 중', th); return;
  }
  if (st === 'chain') {
    const n = v.chain.length; const lh = Math.min(120, 640 / ctx.teams.length);
    v.chain.forEach((cn, i) => txt(c, `${i + 1}. ${cn}`, 300 + i * ((MW - 400) / n) + (MW - 400) / n / 2, 150, 18, th.sub, 800, 'center', 'sans-serif', (MW - 400) / n - 10));
    ctx.teams.forEach((tm, i) => { const y = 190 + i * lh; panel(c, 30, y, MW - 60, lh - 12, th); txt(c, tm.name, 150, y + lh / 2 - 6, 24, tm.color === '#ffffff' ? th.ink : tm.color, 900, 'center', 'sans-serif', 220); for (let k = 0; k < n; k++) { const x = 300 + k * ((MW - 400) / n); c.fillStyle = k < v.stage[tm.id] ? tm.color : '#ffffff14'; rr(c, x + 6, y + 10, (MW - 400) / n - 12, lh - 32, 12); c.fill(); if (k < v.stage[tm.id]) txt(c, '✓', x + (MW - 400) / n / 2, y + lh / 2 - 6, 30, '#fff'); } const f = v.fin.indexOf(tm.id); if (f >= 0) txt(c, ['🥇', '🥈', '🥉'][f] || '🏁', MW - 70, y + lh / 2 - 6, 40, '#fff'); });
    header(c, '⏱️ 타임어택 작전', v.ph === 'end' ? '시간 종료!' : `남은 시간 ${Math.ceil(v.left)}초`, th); return;
  }
  if (st === 'roles') { const rs = v.roles || []; cols(rs.length, 60, MW - 60).forEach((x, i) => { panel(c, x - 130, 180, 260, 380, th); txt(c, rs[i][0].split(' ')[0], x, 260, 90, '#fff'); txt(c, rs[i][0].split(' ').slice(1).join(' '), x, 360, 34, th.acc, 900); txt(c, rs[i][1], x, 420, 24, th.ink, 800, 'center', 'sans-serif', 240); });
    ring(c, MW / 2, 700, 70, v.left / v.per, th.acc, th, Math.ceil(v.left)); header(c, `🤝 역할 ${rs.length}개 동시 미션 · ROUND ${v.rd}`, '한 명이라도 빠지면 실패! 역할을 나눠요', th); return; }
  if (st === 'roulette') {
    const wl = v.wheel; const n = wl.length; const spinning = v.ph === 'spin'; const tgt = v.spin ? v.spin.i : 0; const k = spinning ? ease(Math.min(1, v.el / 4)) : 1; const ang = -Math.PI / 2 - (tgt + 0.5) * (Math.PI * 2 / n) - (1 - k) * Math.PI * 10;
    const cx = MW * 0.32, cy = 470, Rr = 300; for (let i = 0; i < n; i++) { c.fillStyle = ['#ff6b6b', '#ffd43b', '#4dabf7', '#2fd27a', '#b197fc', '#ff922b', '#22e1ff', '#f783ac'][i % 8]; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, Rr, ang + i * Math.PI * 2 / n, ang + (i + 1) * Math.PI * 2 / n); c.fill(); c.save(); c.translate(cx, cy); c.rotate(ang + (i + 0.5) * Math.PI * 2 / n); txt(c, wl[i].slice(0, 9), Rr * 0.62, 0, 22, '#1a1a2e', 900); c.restore(); }
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(cx - 24, cy - Rr - 30); c.lineTo(cx + 24, cy - Rr - 30); c.lineTo(cx, cy - Rr + 10); c.fill();
    if (!spinning && v.spin) { panel(c, MW * 0.62, 200, MW * 0.34, 420, th, th.acc); txt(c, wl[tgt], MW * 0.79, 330, 40, '#1a1a2e', 900, 'center', th.font, MW * 0.32); txt(c, `×${v.spin.x}`, MW * 0.79, 460, 120, '#1a1a2e', 900); ring(c, MW * 0.79, 720, 60, v.left / v.per, th.acc, th, Math.ceil(v.left)); }
    header(c, '🎡 미션 룰렛', spinning ? '두구두구…' : '시간 안에 성공하면 점수 × 배수!', th); return;
  }
  if (st === 'ten') { ring(c, MW / 2, 520, 220, v.left / v.per, v.left < 3 ? '#ff4d6d' : th.acc, th, Math.ceil(v.left)); txt(c, v.tx || '', MW / 2, 180, 64, th.ink, 900, 'center', th.font, MW - 100); header(c, `🔟 10초 도전 · ${v.rd}번째`, null, th); return; }
  if (st === 'sports' && v.sp) { txt(c, v.sp[0].split(' ')[0], MW * 0.28, 470, 260, '#fff'); figure(c, MW * 0.68, 830, 330, th.acc, v.sp[1].k, (t / 0.7) % 1, 'sport', { num: '10' }); header(c, `🏅 ${v.sp[0]}!`, `${v.sp[1].n} — ${Math.ceil(v.left)}초`, th); ring(c, 100, 150, 50, v.left / v.per, th.acc, th, Math.ceil(v.left)); }
};

R.rps = (c, s, ctx, th, t) => {
  const v = s.st; const rv = v.ph === 'reveal';
  if (!rv) { const word = v.ph === 'ready' ? (v.el < 1.3 ? '가위…' : v.el < 2.6 ? '바위…' : '보!') : v.ph === 'go' ? '가위바위보!' : '자세 그대로!'; txt(c, word, MW / 2, 220, 120, th.acc, 900, 'center', th.font);
    cols(3, 150, MW - 150).forEach((x, i) => { panel(c, x - 180, 330, 360, 470, th); txt(c, v.rps[i][0], x, 380, 44, th.ink, 900); figure(c, x, 770, 300, '#ff6b6b', v.rps[i][1].k, 0.25, styleOf(th), { neon: th.line }); }); }
  else { const xs = cols(ctx.teams.length, 80, MW - 80); xs.forEach((x, i) => { const tm = ctx.teams[i]; const th2 = v.th[tm.id]; const w = v.win?.[tm.id] || 0; panel(c, x - 120, 200, 240, 560, th, w ? tm.color + '55' : null); txt(c, tm.name, x, 240, 26, th.ink, 900, 'center', 'sans-serif', 220);
      if (th2 == null) txt(c, '–', x, 470, 80, th.sub); else if (th2 < 0) txt(c, '무효', x, 470, 50, '#ff6b6b'); else { txt(c, v.rps[th2][0].split(' ')[0], x, 360, 90, '#fff'); figure(c, x, 700, 200, tm.color, v.rps[th2][1].k, 0.25, styleOf(th), { neon: th.line }); }
      if (w) txt(c, `${w}팀 이김!`, x, 740, 26, '#ffe066', 900); }); txt(c, '결과 공개!', MW / 2, 120, 60, th.acc, 900); }
  txt(c, `ROUND ${v.rd}`, 110, 60, 30, th.acc);
};

R.judge = (c, s, ctx, th, t) => {
  const v = s.st; const st = v.style;
  if (st === 'numbers') { txt(c, String(v.num), MW * 0.28, 450, 380, th.acc, 900); txt(c, '명씩 모여서', MW * 0.28, 690, 44, th.ink, 900, 'center', th.font); panel(c, MW * 0.52, 160, MW * 0.44, 620, th); txt(c, v.task[0], MW * 0.74, 220, 44, th.ink, 900, 'center', th.font, MW * 0.4); for (let k = 0; k < v.num; k++) figure(c, MW * 0.74 + (k - (v.num - 1) / 2) * 110, 720, 180, ['#ff6b6b', '#4dabf7', '#ffd43b', '#2fd27a', '#b197fc', '#ff922b'][k], v.task[1].k, (t / 0.9) % 1, styleOf(th), { neon: th.line }); header(c, '🔢 스피드 숫자 미션', `${Math.ceil(v.left)}초`, th); ring(c, 100, 150, 50, 1 - v.k, th.acc, th, Math.ceil(v.left)); }
  if (st === 'shapes') { panel(c, MW * 0.18, 160, MW * 0.64, 520, th); txt(c, v.shape.split(' ').pop(), MW / 2, 420, 300, th.acc, 900); txt(c, `${v.shape}을(를) 몸으로!`, MW / 2, 740, 50, th.ink, 900, 'center', th.font); header(c, '🔤 몸으로 만드는 숫자', `${Math.ceil(v.left)}초 안에 완성하고 "완성!" 외치기`, th); }
  if (st === 'balance') { const k = v.k; panel(c, MW * 0.1, 140, MW * 0.8, 50, th); c.fillStyle = k < 1 ? '#ffd43b' : '#2fd27a'; rr(c, MW * 0.1, 140, MW * 0.8 * k, 50, 25); c.fill(); txt(c, k < 1 ? `버티기 ${Math.ceil(v.left)}초` : '성공! 발 내려도 돼요', MW / 2, 166, 28, '#1a1a2e');
    cols(5, 120, MW - 120).forEach((x, i) => figure(c, x, 820, 240, ['#ff6b6b', '#4dabf7', '#ffd43b', '#2fd27a', '#b197fc'][i], v.task[1].k, 0.25 + Math.sin(t * 2 + i) * 0.02, styleOf(th), { neon: th.line })); header(c, `⚖️ ${v.task[0]}`, '팀 전원이 끝까지!', th); }
  if (st === 'cheer' && v.turn != null) { const col = tcol(ctx, v.turn); c.fillStyle = col + '33'; c.fillRect(0, 0, MW, H); txt(c, `📣 ${tnm(ctx, v.turn)} 차례!`, MW / 2, 200, 90, col, 900, 'center', th.font); for (let i = 0; i < 3; i++) star(c, MW / 2 - 200 + i * 200, 420, 70, i < v.stars ? '#ffd43b' : '#ffffff22', t * (i < v.stars ? 0.5 : 0)); txt(c, ['단합', '동작', '창의'].map((x, i) => (i < v.stars ? '✔ ' : '') + x).join('   '), MW / 2, 540, 34, th.ink, 900);
    cols(5, 150, MW - 150).forEach((x, i) => figure(c, x, 830, 200, col, ['up', 'clap', 'wave', 'star', 'point'][i], (t / 0.5 + i * 0.2) % 1, styleOf(th), { neon: th.line })); header(c, '팀 응원 배틀', null, th); }
  if (st !== 'cheer') { const got = new Set(v.got); cols(ctx.teams.length, 120, MW - 120).forEach((x, i) => { const tm = ctx.teams[i]; if (got.has(tm.id)) doneMark(c, x, 860, th); }); }
};

R.tourney = (c, s, ctx, th, t) => {
  const v = s.st;
  if (v.final) { header(c, `👑 최후의 챔피언 · ${v.duel[0]}`, `${v.duel[1]} · 라운드 ${v.di + 1}/${v.n}${v.di === v.n - 1 ? ' (점수 ×2)' : ''}`, th);
    cols(v.n, 80, MW - 80).forEach((x, i) => { panel(c, x - 120, 170, 240, 120, th, i === v.di ? th.acc : i < v.di ? '#2fd27a55' : null); txt(c, v.duels[i][0], x, 230, 24, i === v.di ? '#1a1a2e' : th.ink, 900, 'center', 'sans-serif', 220); });
    const rk = Object.entries(v.rank || {}).sort((a, b) => a[1] - b[1]); rk.forEach(([tm, r2], i) => { panel(c, MW / 2 - 300, 360 + i * 110, 600, 90, th, tcol(ctx, +tm) + '88'); txt(c, `${r2}등 ${tnm(ctx, +tm)}`, MW / 2, 405 + i * 110, 40, '#fff', 900); });
    if (!rk.length) figure(c, MW / 2, 800, 300, th.acc, ['jump', 'squat', 'punch', 'leg', 'burpee'][v.di % 5], (t / 0.8) % 1, styleOf(th), { neon: th.line }); return; }
  const rounds = v.br; const nR = Math.round(Math.log2(rounds[0].length)) + 1; const colW = (MW - 120) / nR;
  rounds.forEach((r, ri) => { const n = r.length; r.forEach((tm, i) => { const x = 60 + ri * colW, y = 140 + ((i + 0.5) * (680 / Math.max(1, n))); const cur = v.pair && ri === v.ri && Math.floor(i / 2) === v.mi && v.champ == null; panel(c, x, y - 26, colW - 40, 52, th, tm != null ? tcol(ctx, tm) + (cur ? 'ff' : '66') : '#ffffff10'); txt(c, tm != null ? tnm(ctx, tm) : '부전승', x + (colW - 40) / 2, y, 22, '#fff', 900, 'center', 'sans-serif', colW - 60); }); });
  if (v.champ != null) { txt(c, `🏆 챔피언 ${tnm(ctx, v.champ)}!`, MW / 2, 90, 60, tcol(ctx, v.champ), 900); }
  else if (v.pair) header(c, `${tnm(ctx, v.pair[0])} vs ${tnm(ctx, v.pair[1])}`, `${v.duel[0]} — ${v.duel[1]}`, th);
};

// ---------------- 화면 모듈
function peScreen(id) {
  const def = BY[id];
  return {
    mount(root, ctx) {
      this.ctx = ctx; this.s = null; this.fx = { hit: {}, rowY: {}, fl: [], seen: 0, beat: -1 };
      this.cv = canvas(W, H); root.append(h('div', { class: 'nar' }, h('div', { class: 'narc', style: { width: `${W}px` } }, this.cv)));
      loop(this, (tt) => this.draw(tt));
    },
    update(s) {
      const first = !this.s; this.s = s; this.at = performance.now(); const ctx = this.ctx; const fx = this.fx; window.__peS = s; // 시험용으로 최신 상태 노출
      for (const e of s.ev) { if (e.id <= fx.seen) continue; fx.seen = e.id; if (first) continue;
        if (e.k === 'pt') { fx.fl.push({ team: e.team, v: e.v, txt: e.txt, at: performance.now() }); if (e.v) fx.hit[e.team] = performance.now(); ctx.sfx(e.v > 0 ? 'good' : e.v < 0 ? 'bad' : 'tap'); }
        if (e.k === 'boom') { fx.boomAt = performance.now(); ctx.sfx('boom'); } if (e.k === 'pass') ctx.sfx('pass'); if (e.k === 'hit') { fx.shake = performance.now(); ctx.sfx('boom'); } if (e.k === 'down') ctx.sfx('overtake'); if (e.k === 'cap' || e.k === 'up') ctx.sfx('good'); if (e.k === 'fall' || e.k === 'life') ctx.sfx('bad'); if (e.k === 'win') ctx.sfx('win'); }
      // 음성 안내 (신호·번개·장면이 바뀔 때만)
      const v = s.st; let say = '';
      if (s.mech === 'signal' && v.cur) say = v.style === 'ox' ? (v.cur.ph === 'ask' ? v.cur.q : `정답 ${v.cur.ans ? '오' : '엑스'}`) : v.style === 'mugung' ? (v.cur.n ? '피었습니다' : '무궁화 꽃이') : v.style === 'dance' ? (v.cur.n ? '스톱' : '') : v.style === 'colorword' ? '' : v.cur.mv?.n || '';
      if (s.mech === 'follow' && v.st) say = v.obstacle ? '' : v.st.mv.n;
      if (s.mech === 'react' && v.ph === 'go') say = v.go?.t?.replace('⚡ ', '') || '';
      const key = `${s.mech}|${v.i ?? v.rd ?? ''}|${v.cur?.ph ?? ''}|${v.cur?.n ?? ''}|${v.ph ?? ''}|${say}`;
      if (say && key !== this.lastSay) { this.lastSay = key; ctx.say(say.replace(/[!…]/g, ''), 1.05); }
      // 음악 멈춤 (댄스 스톱·무궁화 정지)
      const hold = s.mech === 'signal' && (v.style === 'dance' || v.style === 'mugung') && v.cur?.n === 1;
      if (hold !== this.held) { this.held = hold; ctx.bgm?.hold(hold); if (hold) ctx.sfx('boom'); }
      return s.pts;
    },
    draw(tt) {
      const s = this.s; if (!s) return; const c = this.cv.getContext('2d'); const t = tt / 1000; const th = theme(s.lv);
      c.save(); S3.paint(c, W, H, def.id, t, { tone: th.k === 'kid' ? 'kid' : th.k === 'pro' || th.k === 'esports' ? 'pro' : 'base', pe: def }); c.fillStyle = th.k === 'kid' ? 'rgba(255,255,255,0.08)' : 'rgba(7,10,30,0.28)'; c.fillRect(0, 0, W, H); // 게임 주제 3D 장면 (글자·선수가 잘 보이게 살짝 덮음)
      c.beginPath(); c.rect(0, 0, MW, H); c.clip();
      try { R[s.mech]?.(c, s, this.ctx, th, t, def, this.fx); } catch (e) { console.error(e); }
      c.restore();
      scoreboard(c, s, this.ctx, th, this.fx, performance.now()); floaters(c, this.fx, this.ctx, th, performance.now());
      if (s.space === 'class') { c.fillStyle = '#2fd27add'; rr(c, 20, H - 50, 230, 36, 18); c.fill(); txt(c, '🏫 교실 모드 · 제자리', 135, H - 32, 18, '#0b2a14'); }
    },
    unmount() { this.dead = true; cancelAnimationFrame(this.raf); if (this.held) this.ctx.bgm?.hold(false); },
  };
}
for (const g of PE) V[g.id] = peScreen(g.id);

// 시작 전 튜토리얼 (설명 화면에서 preview.js가 부름)
export function mountPeTutorial(root, id, { lv = 2, space = 'gym' } = {}) {
  const def = BY[id]; if (!def) return null;
  const cv = document.createElement('canvas'); cv.className = 'demo-cv petut'; cv.style.width = '100%'; cv.style.height = '100%';
  root.append(cv); let dead = false; const t0 = performance.now();
  const frame = () => {
    if (dead || !cv.isConnected && performance.now() - t0 > 500) return;
    const r = cv.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1); const w = Math.max(10, Math.round(r.width * dpr)), hh = Math.max(10, Math.round(r.height * dpr)); if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
    tutorial(cv.getContext('2d'), w, hh, def, (performance.now() - t0) / 1000, lv, space, mvFor); requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return { stop() { dead = true; cv.remove(); }, el: cv };
}

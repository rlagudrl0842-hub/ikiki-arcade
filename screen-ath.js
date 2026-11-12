// 🏟 육상 대회 — 대형 화면(빔): 트랙 · 출발등 · 실시간 순위 · 결과 + 출발 구령·총소리(이 노트북에서만 재생)
// 소리: 구령 = 브라우저 음성(TTS) · 총소리 = Web Audio로 합성(파일 없음) · 서버 시각에 맞춰 예약 재생
// 소리가 막혀도(자동재생 차단·음소거) 출발등·화면 글자로 그대로 진행
import { h, audioUnlock, audioCtx } from './client.js';
import { V } from './screen-games.js';
import { loop } from './screen-n.js';
import { ovalView, ovalBg, dotRunner, straightView, straightBg, sideRunner, makeSmoother, packOffsets, ROW } from './athdraw.js';

const ST = { setup: '대회 준비', ready: '출발 준비', marks: '제자리에', set: '차렷', go: '경주 중', recall: '부정 출발 — 다시 출발', done: '경주 결과', over: '종목 결과' };
const fmt = (t) => (t == null ? '—' : t.toFixed(2));
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };

// ---------- 소리 ----------
const SND = { vol: LS.get('ath:vol', 0.9), mute: LS.get('ath:mute', false), gain: null, nodes: [], timers: [], last: '' };
function out() { const a = audioCtx(); if (!a) return null; if (!SND.gain || SND.gain.context !== a) { SND.gain = a.createGain(); SND.gain.connect(a.destination); } SND.gain.gain.value = SND.mute ? 0 : SND.vol; return a; }
const ready = () => { const a = audioCtx(); return !!a && a.state === 'running'; };
// 출발 총소리: 아주 짧은 잡음 폭발(고역) + 낮은 '탕' 울림 · 0.3초
function gun(atMs, now) {
  const a = out(); if (!a || a.state !== 'running' || SND.mute) return false;
  const when = a.currentTime + Math.max(0, (atMs - now) / 1000);
  const len = Math.floor(a.sampleRate * 0.35); const buf = a.createBuffer(1, len, a.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) { const t = i / a.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 28) * (t < 0.002 ? t / 0.002 : 1); }
  const src = a.createBufferSource(); src.buffer = buf; const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900; const g1 = a.createGain(); g1.gain.value = 1.4;
  src.connect(hp).connect(g1).connect(SND.gain); src.start(when);
  const o = a.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(180, when); o.frequency.exponentialRampToValueAtTime(45, when + 0.25); const g2 = a.createGain(); g2.gain.setValueAtTime(0.0001, when); g2.gain.exponentialRampToValueAtTime(0.9, when + 0.004); g2.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
  o.connect(g2).connect(SND.gain); o.start(when); o.stop(when + 0.35);
  SND.nodes.push(src, o); return true;
}
function speak(t) {
  if (SND.mute || !('speechSynthesis' in window)) return false;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'ko-KR'; const v = speechSynthesis.getVoices().find((x) => /ko[-_]KR/i.test(x.lang)); if (v) u.voice = v; u.rate = 0.95; u.volume = Math.max(0, Math.min(1, SND.vol)); speechSynthesis.speak(u); return true; } catch { return false; }
}
function cancelAll() { for (const n of SND.nodes) try { n.stop(); } catch { /* */ } SND.nodes = []; for (const t of SND.timers) clearTimeout(t); SND.timers = []; try { speechSynthesis.cancel(); } catch { /* */ } }
const at = (ms, fn) => SND.timers.push(setTimeout(fn, Math.max(0, ms)));

V.ath = {
  mount(root, ctx) {
    this.ctx = ctx; this.s = null; this.sm = makeSmoother(); this.key = ''; this.sndK = null; window.__ath = this; // 점검용
    this.W = 1360; this.H = 860;
    this.cv = h('canvas', { width: this.W, height: this.H, class: 'athsc' });
    this.lights = h('div', { class: 'athL' }, h('i'), h('i'), h('i'), h('b'));
    this.side = h('div', { class: 'athside' });
    this.sndBox = h('div', { class: 'athsnd' });
    root.append(h('div', { class: 'athS' }, h('div', { class: 'athcvw' }, this.cv, this.lights), h('div', { class: 'athcol' }, this.side, this.sndBox)));
    this.sndUI(); this.sndT = setInterval(() => this.sndState(), 700);
    loop(this, () => this.draw());
  },
  sndUI() {
    const vol = h('input', { type: 'range', min: 0, max: 100, value: Math.round(SND.vol * 100), oninput: (e) => { SND.vol = e.target.value / 100; LS.set('ath:vol', SND.vol); out(); } });
    const mute = h('button', { class: 'btn ghost', onclick: () => { SND.mute = !SND.mute; LS.set('ath:mute', SND.mute); out(); mute.textContent = SND.mute ? '🔇 음소거 중 (누르면 켬)' : '🔊 소리 켜짐 (누르면 음소거)'; } }, SND.mute ? '🔇 음소거 중 (누르면 켬)' : '🔊 소리 켜짐 (누르면 음소거)');
    const test = h('button', { class: 'btn blue', onclick: () => this.soundTest() }, '🔊 음향 테스트 / 켜기');
    this.sndMsg = h('div', { class: 'athsm' });
    this.sndBox.append(h('b', {}, '출발 소리 (이 노트북)'), test, mute, h('label', {}, '크기 ', vol), this.sndMsg);
  },
  soundTest() { audioUnlock(); out(); cancelAll(); const now = performance.now(); const okT = speak('음향 테스트. 제자리에. 차렷.'); const okG = (() => { const a = audioCtx(); return a && a.state === 'running' && !SND.mute ? gun(now + 2600, now) : false; })(); this.sndTried = { at: Date.now(), okT, okG }; this.flash = { txt: '음향 테스트', col: '#3d8bff', at: performance.now() }; this.sndState(); },
  sndState() {
    if (!this.sndMsg) return; const a = audioCtx();
    const st = SND.mute ? '🔇 음소거 — 화면 신호만으로 진행해요' : !a ? '⚠️ 소리 꺼짐 — [음향 테스트]를 눌러 켜 주세요' : a.state !== 'running' ? '⚠️ 브라우저가 소리를 막았어요 — 이 화면을 한 번 클릭/[음향 테스트]' : '✅ 소리 재생 준비됨 (실제로 들리는지는 스피커로 확인)';
    const t = this.sndTried && Date.now() - this.sndTried.at < 8000 ? ` · 테스트: 구령 ${this.sndTried.okT ? '재생 요청됨' : '불가'} / 총소리 ${this.sndTried.okG ? '재생 요청됨' : '불가'}` : '';
    this.sndMsg.textContent = st + t; this.sndMsg.className = `athsm ${ready() && !SND.mute ? 'ok' : 'warn'}`;
  },
  update(s) {
    const prev = this.s; this.s = s;
    const key = `${s.rid}:${s.att}`;
    if (key !== this.key) { this.key = key; this.sm = makeSmoother(); this.said = {}; }
    if (s.sndK !== this.sndK) { if (this.sndK != null) this.soundTest(); this.sndK = s.sndK; } // 사회자 화면의 [음향 테스트]
    // 출발 절차 소리: 서버 시각에 맞춰 예약
    const now = this.ctx.now();
    if (s.st === 'marks' && !this.said.m) { this.said.m = 1; cancelAll(); this.ctx.bgm?.hold?.(true); if (now - s.tMarks < 1500) speak('제자리에'); this.flash = null; }
    if (s.tSet && !this.said.s && (s.st === 'marks' || s.st === 'set')) { this.said.s = 1; at(s.tSet - now, () => { if (this.s?.st === 'marks' || this.s?.st === 'set') speak('차렷'); }); }
    if (s.tGo && !this.said.g && (s.st === 'marks' || s.st === 'set' || s.st === 'go')) { this.said.g = 1; this.gunOk = s.tGo - now > -150 ? gun(s.tGo, now) : false; }
    if (s.st === 'recall' && prev?.st !== 'recall') { cancelAll(); const a = audioCtx(); if (a?.state === 'running') { const t = performance.now(); gun(t + 50, t); gun(t + 380, t); } at(700, () => speak(s.recall?.host ? '출발을 멈춥니다. 다시 출발합니다.' : '부정 출발. 다시 출발합니다.')); }
    if ((s.st === 'ready' || s.st === 'done' || s.st === 'over' || s.st === 'setup') && prev && prev.st !== s.st) { if (['marks', 'set'].includes(prev.st)) cancelAll(); this.ctx.bgm?.hold?.(false); }
    if (s.st === 'go' && prev?.st !== 'go') at(1500, () => this.ctx.bgm?.hold?.(false));
    if (s.st === 'done' && prev?.st === 'go') this.ctx.sfx('end');
    this.sideUI();
    return null;
  },
  sideUI() {
    const s = this.s; const t = (id) => this.ctx.team(id); const k = JSON.stringify([s.st, s.rank, s.rs.map((x) => [x[ROW.place], x[ROW.t], x[ROW.leg], Math.round(x[ROW.d] / 5)]), s.lineup, s.res?.heat, s.over, s.setup, s.team, s.finalists?.length]);
    if (k === this.sideK) return; this.sideK = k; const el = this.side; el.innerHTML = '';
    el.append(h('div', { class: 'athhd' }, h('b', {}, `${s.evName}`), h('span', {}, s.heat || ''), s.prac ? h('em', {}, '연습 · 점수 없음') : null));
    if (s.st === 'setup' && s.setup) { const u = s.setup; el.append(h('div', { class: 'athcard' }, h('div', {}, `출전 방식: ${u.entryName}`), h('div', {}, `출전 ${u.n}명${s.ev === 'relay' ? ` · 계주 ${u.units}팀` : ''} · 주로 ${s.lanes}개`), h('div', {}, `예선 ${u.heats}조${u.final ? ' + 결승' : ''} · 약 ${Math.ceil(u.estSec / 60)}분`), u.choose ? h('div', { class: 'hl' }, '📱 지금 폰에서 종목 신청 중') : null)); }
    const rows = s.rs || [];
    if (s.st === 'ready' && s.lineup) { el.append(h('div', { class: 'athsub' }, '출발 명단'), ...s.lineup.sort((a, b) => a[0] - b[0]).map(([lane, label, team, mem]) => h('div', { class: 'athr' }, h('span', { class: 'ln' }, lane), h('i', { style: { background: t(team).color } }), h('span', { class: 'nm' }, label, mem ? h('small', {}, ` ${mem.join(' → ')}`) : null)))); }
    else if (['marks', 'set', 'go', 'recall'].includes(s.st)) {
      el.append(h('div', { class: 'athsub' }, s.st === 'go' ? '실시간 순위' : '주로'));
      const order = s.st === 'go' ? s.rank : rows.map((x) => x[ROW.lane]).sort((a, b) => a - b);
      order.forEach((lane, i) => { const x = rows.find((y) => y[ROW.lane] === lane); if (!x) return; const fin = x[ROW.t] != null; el.append(h('div', { class: `athr ${fin ? 'fin' : ''}` }, h('span', { class: 'pl' }, s.st === 'go' ? i + 1 : ''), h('span', { class: 'ln' }, lane), h('i', { style: { background: t(x[ROW.team]).color } }), h('span', { class: 'nm' }, x[ROW.label], s.ev === 'relay' ? h('small', {}, ` ${x[ROW.leg] + 1}번 ${x[ROW.runner]}`) : null, x[ROW.fs] ? h('small', { class: 'fs' }, ` 🚩${x[ROW.fs]}`) : null), h('b', {}, fin ? `${fmt(x[ROW.t])}` : s.st === 'go' ? `${Math.max(0, Math.round(s.D - x[ROW.d]))}m` : ''))); });
    } else if (s.st === 'done' && s.res) { el.append(h('div', { class: 'athsub' }, `${s.res.heat} 결과`), ...s.res.rows.map(([lane, label, team, tm, place, react, fs]) => h('div', { class: 'athr' }, h('span', { class: 'pl' }, place || '—'), h('span', { class: 'ln' }, lane), h('i', { style: { background: t(team).color } }), h('span', { class: 'nm' }, label, react != null ? h('small', {}, ` 반응 ${react.toFixed(2)}`) : null, fs ? h('small', { class: 'fs' }, ` 🚩${fs}`) : null), h('b', {}, tm != null ? fmt(tm) : '기록 없음')))); }
    if (s.finalists && s.st !== 'over' && !s.final) el.append(h('div', { class: 'athsub' }, '🏅 결승 진출'), h('div', { class: 'athfl' }, s.finalists.map((f) => f[0]).join(' · ')));
    if (s.st === 'over' && s.board) el.append(h('div', { class: 'athsub' }, '종목 전체 기록'), ...s.board.map(([n, team, tm, f], i) => h('div', { class: 'athr' }, h('span', { class: 'pl' }, i + 1), h('i', { style: { background: t(team).color } }), h('span', { class: 'nm' }, n, f ? h('small', {}, ' 결승') : null), h('b', {}, fmt(tm)))));
    if (s.team && Object.keys(s.team).length) el.append(h('div', { class: 'athsub' }, '팀 점수 (이 종목 · 1인 평균)'), h('div', { class: 'athtm' }, ...Object.entries(s.team).sort((a, b) => b[1] - a[1]).map(([id, v]) => h('span', { style: { background: t(Number(id)).color } }, `${t(Number(id)).icon || ''}${t(Number(id)).name} ${v}`))));
    el.append(h('div', { class: 'athnote' }, '기록은 게임 계산 기록 (실제 측정 기록 아님) · 공식 규칙과 다른 점은 사회자 화면 참고'));
  },
  draw() {
    const s = this.s; if (!s) return; const c = this.cv.getContext('2d'); const W = this.W, H = this.H; const N = s.lanes || 8; const now = this.ctx.now(); const straight = s.ev === '100';
    const bk = `${s.ev}:${N}`; if (this.bgK !== bk) { this.bgK = bk; if (straight) { this.vw = straightView(W, H, N, { top: 70 }); this.bg = straightBg(W, H, this.vw); } else { this.vw = ovalView(W, H - 60, N, { sy: 0.78, pad: 0.04, chute: false }); this.vw.oy += 50; this.bg = ovalBg(W, H, this.vw, s.ev); } }
    c.drawImage(this.bg, 0, 0);
    const rows = s.rs || []; const lead = s.rank?.[0]; const go = s.st === 'go' || (s.st === 'set' && s.tGo && now >= s.tGo);
    const list = rows.map((x) => ({ x, key: x[ROW.lane], d: this.sm(x[ROW.lane], x[ROW.d], s.st === 'go' ? x[ROW.v] : 0, s.T, now, s.D) }));
    const offs = packOffsets(s.ev, list);
    for (const r of list.sort((a, b) => a.d - b.d)) {
      const x = r.x; const col = this.ctx.team(x[ROW.team]).color; const nm = s.ev === 'relay' ? x[ROW.runner] : x[ROW.label];
      if (straight) sideRunner(this.vw ? c : c, this.vw, x[ROW.lane], r.d, col, { label: nm, lead: go && x[ROW.lane] === lead, run: go && x[ROW.v] > 0.3 });
      else { dotRunner(c, this.vw, s.ev, x[ROW.lane], r.d, col, { r: 1.9, label: nm, lead: go && x[ROW.lane] === lead, offset: offs.get(r.key) || 0 }); if (s.ev === 'relay' && x[ROW.od] && s.st === 'go') dotRunner(c, this.vw, s.ev, x[ROW.lane], x[ROW.od], col, { r: 1.3, label: `다음 ${x[ROW.leg] + 2}번`, offset: 0 }); }
    }
    // 위쪽 줄: 종목 · 조 · 게임 시계
    c.fillStyle = '#0b0e24d9'; c.fillRect(0, 0, W, 56); c.fillStyle = '#fff'; c.font = '900 34px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(`${s.evName}  ${s.heat || ''}`, 20, 29);
    c.textAlign = 'right'; const clock = go && s.tGo ? Math.max(0, (now - s.tGo) / 1000) : 0; const allFin = rows.length && rows.every((x) => x[ROW.t] != null);
    c.font = '900 38px monospace'; c.fillStyle = '#ffd43b'; c.fillText(s.st === 'go' && !allFin ? `${clock.toFixed(1)}` : '', W - 20, 30); c.font = '700 16px sans-serif'; c.fillStyle = '#c9d3ff'; if (s.st === 'go') c.fillText('게임 시계(초)', W - 120, 30);
    // 가운데 큰 안내
    const big = (t1, t2, col) => { c.fillStyle = '#0b0e24d9'; c.beginPath(); c.roundRect ? c.roundRect(W / 2 - 420, H / 2 - 110, 840, 220, 24) : c.rect(W / 2 - 420, H / 2 - 110, 840, 220); c.fill(); c.textAlign = 'center'; c.fillStyle = col || '#fff'; c.font = '900 64px sans-serif'; c.fillText(t1, W / 2, H / 2 - 30); if (t2) { c.font = '700 30px sans-serif'; c.fillStyle = '#e6e9ff'; c.fillText(t2, W / 2, H / 2 + 50); } };
    if (s.st === 'setup') big('🏟 육상 대회 준비', `${s.evName} · 사회자가 조 편성을 확정하면 시작해요`);
    else if (s.st === 'ready') big(`${s.heat} 출발 준비`, s.cmd === 'marks' ? '구령: 제자리에 → 총소리 (800m)' : '구령: 제자리에 → 차렷 → 총소리');
    else if (s.st === 'recall') big('🚩 부정 출발', s.recall?.host ? '사회자가 출발을 멈췄어요 · 다시 출발' : `${s.recall?.lane || ''}주로 ${s.recall?.name || ''} — 경고 (게임 규칙) · 다시 출발`, '#ff6b6b');
    else if (s.st === 'over' && s.over) { big(`🏆 ${s.over.podium[0]?.label || ''}`, s.over.podium.map((p, i) => `${['1위', '2위', '3위'][i]} ${p.label} ${fmt(p.t)}초`).join('   ')); c.font = '700 20px sans-serif'; c.fillStyle = '#c9d3ff'; c.fillText('게임 계산 기록 · 실제 측정 기록 아님', W / 2, H / 2 + 92); }
    if (this.flash && performance.now() - this.flash.at < 2500) { c.fillStyle = this.flash.col; c.font = '900 30px sans-serif'; c.textAlign = 'center'; c.fillText(`🔊 ${this.flash.txt} — 소리가 들리는지 확인하세요`, W / 2, H - 30); }
    // 출발등 (서버 시각 기준 · 소리와 상관없이 항상)
    const st = go ? 'go' : s.st; const L = this.lights; if (L.dataset.s !== st) { L.dataset.s = st; L.className = `athL l-${st}`; L.lastChild.textContent = st === 'marks' ? '제자리에' : st === 'set' ? '차렷' : st === 'go' ? '출발!' : st === 'recall' ? '부정 출발' : ST[st] || ''; }
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); clearInterval(this.sndT); cancelAll(); this.ctx.bgm?.hold?.(false); },
};

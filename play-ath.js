// 🏟 육상 대회 — 참가자 폰: 왼발·오른발 버튼 · 출발 신호 · 같은 조 선수 트랙 · 순위/남은 거리 · 대기 순서 · 결과
// 소리는 폰에서 내지 않음 (사회자 노트북 → 체육관 스피커). 폰은 진동·화면 색으로만 알림
import { h, vibrate } from './client.js';
import { G } from './play-games.js';
import { ovalView, ovalBg, dotRunner, straightView, straightBg, sideRunner, makeSmoother, ROW } from './athdraw.js';

const STLBL = { setup: '대회 준비 중', ready: '출발 준비', marks: '제자리에', set: '차렷', go: '출발!', recall: '부정 출발 · 다시 출발', done: '경주 끝', over: '종목 결과' };
const onPress = (el, fn) => { el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(e); }, { passive: false }); el.addEventListener('contextmenu', (e) => e.preventDefault()); return el; };
const fmt = (t) => (t == null ? '—' : t.toFixed(2));

G.ath = {
  mount(root, v, api) {
    this.api = api; this.v = v; this.pend = 0; this.side = 0; this.pr = []; this.sm = makeSmoother(); this.bgKey = ''; this.last = 0; this.lastSt = '';
    this.top = h('div', { class: 'athtop' }); this.sig = h('div', { class: 'athsig' });
    this.cv = h('canvas', { class: 'athcv' }); this.info = h('div', { class: 'athinfo' });
    this.mid = h('div', { class: 'athmid' });
    const mk = (s, t) => onPress(h('button', { class: `athbtn ${s ? 'r' : 'l'}` }, h('b', {}, t), h('small', {}, s ? 'R' : 'L')), () => this.step(s));
    this.bl = mk(0, '왼발'); this.br = mk(1, '오른발'); this.hint = h('div', { class: 'athhint' });
    this.pad = h('div', { class: 'athpad' }, this.bl, this.br);
    root.append(h('div', { class: 'gwrap athw', style: { '--tc': api.team.color } }, this.top, this.sig, this.cv, this.info, this.mid, this.hint, this.pad));
    this.iv = setInterval(() => { if (this.pend && this.v?.st === 'go') { const n = Math.min(4, this.pend); this.pend -= n; api.send({ a: 'st', n }); } else if (this.v?.st !== 'go') this.pend = 0; }, 100);
    const loop = () => { if (this.dead) return; const t = performance.now(); if (t - this.last > 45) { this.last = t; try { this.draw(); } catch (e) { console.error(e); } } this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    this.update(v);
  },
  // 왼·오 번갈아 눌러야 한 걸음 (같은 쪽 연속은 무시)
  step(s) {
    const v = this.v; const btn = s ? this.br : this.bl; btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit');
    if (s === this.side) { this.hint.textContent = '왼발·오른발을 번갈아 눌러요!'; this.hint.className = 'athhint warn'; return; }
    this.side = s; vibrate(6);
    const t = performance.now(); this.pr.push(t); this.pr = this.pr.filter((x) => t - x < 1000);
    const live = this.racing();
    if (!live) { this.hint.className = 'athhint'; this.hint.textContent = `연습 중 (기록 안 됨) · 1초에 ${this.pr.length}걸음${this.pr.length >= 7 ? ' 👍 최고 속도!' : ''}`; return; }
    const now = this.api.now();
    if (v.st === 'marks' || v.st === 'set') { if (v.tGo && now >= v.tGo) { this.pend++; return; } this.api.send({ a: 'st', n: 1 }); return; } // 신호 전 → 서버가 부정 출발 판정
    if (v.st === 'go') this.pend++;
  },
  racing() { const v = this.v; return !!v?.me && ['marks', 'set', 'go'].includes(v.st) && (v.me.role === 'run' || v.me.role === 'out'); },
  update(v) {
    const prev = this.v; this.v = v;
    if (v.st !== this.lastSt) { if (v.st === 'go' && v.me) vibrate([60]); if (v.st === 'recall') vibrate([120, 60, 120]); this.lastSt = v.st; this.side = 0; }
    if (prev?.rid !== v.rid || prev?.att !== v.att) this.sm = makeSmoother();
    this.paint();
  },
  reply(r) {
    if (r.fs) { this.hint.className = 'athhint bad'; this.hint.textContent = r.fs >= 2 ? '🚩 또 부정 출발! 이번에는 1초 늦게 출발해요 (게임 규칙)' : '🚩 부정 출발! 총소리 전에 눌렀어요 (경고 · 다시 출발)'; vibrate([200, 80, 200]); }
    if (r.early) { this.hint.className = 'athhint warn'; this.hint.textContent = '아직이에요! 출발 신호(초록·탕!)를 기다려요'; }
  },
  paint() {
    const v = this.v; const me = v.me; const api = this.api;
    this.top.innerHTML = ''; this.top.append(h('b', {}, `🏟 ${v.evName}`), h('span', {}, v.heat || ''), v.prac ? h('em', {}, '연습') : null);
    // 출발 신호 (서버 시각 기준)
    const now = api.now(); const st = v.st === 'set' && v.tGo && now >= v.tGo ? 'go' : v.st;
    this.sig.className = `athsig s-${st}`; this.sig.textContent = st === 'recall' ? `🚩 ${v.recall?.host ? '출발 취소 · 다시 출발해요' : `부정 출발: ${v.recall?.lane || ''}주로 ${v.recall?.name || ''}`}` : STLBL[st] || '';
    // 내 상태 · 버튼
    const running = this.racing();
    this.pad.classList.toggle('live', running); this.pad.classList.toggle('prac', !running);
    this.bl.disabled = false; this.br.disabled = false;
    const mk = JSON.stringify([v.st, me?.role, me?.leg, me?.lane, v.setup, v.q, v.res?.heat, v.res?.rows?.length, v.over, v.finalists?.length, v.board?.length, v.evName, v.heat, v.myRank]);
    const same = this.midKey === mk; this.midKey = mk;
    let mid = [];
    if (v.st === 'setup') {
      const s = v.setup || {};
      mid.push(h('div', { class: 'athbox' }, h('b', {}, s.inEv ? `✅ 이번 ${v.evName}에 출전해요` : `이번 종목: ${v.evName}`), h('div', { class: 'muted' }, `출전 ${s.n || 0}명 · ${s.heats || 0}개 조로 나눠 달려요`)));
      if (s.choose?.length) mid.push(h('div', { class: 'athchoose' }, h('div', {}, '🙋 달리고 싶은 종목을 골라요'), ...s.choose.map((k) => h('button', { class: `btn ${s.mine === k ? 'green' : 'ghost'}`, onclick: () => api.send({ a: 'pick', v: k }) }, `${k}m${s.mine === k ? ' ✓' : ''}`))));
    } else if (me) {
      if (v.ev === 'relay') {
        const leg = (me.myLeg ?? 0) + 1;
        if (me.role === 'run') mid.push(h('div', { class: 'athbox go' }, `🏃 ${leg}번 주자 · 지금 내가 달려요!`));
        else if (me.role === 'out') mid.push(h('div', { class: 'athbox soon' }, `⚡ ${leg}번 주자 준비! 앞 주자가 오면 달려 나가요 (노란 구역 안에서 배턴 받기)`));
        else if (me.role === 'wait') mid.push(h('div', { class: 'athbox' }, `${me.sq} · 나는 ${leg}번 주자 · 지금 ${me.leg + 1}번 주자 달리는 중`));
        else mid.push(h('div', { class: 'athbox' }, `${me.sq} 결승선 통과!`));
      } else if (['ready', 'marks', 'set', 'go', 'recall'].includes(v.st)) mid.push(h('div', { class: 'athbox go' }, `내 주로: ${me.lane}번 · ${v.st === 'ready' ? '곧 출발해요! 두 버튼에 손가락을 올려요' : '총소리(초록 신호)가 나면 번갈아!'}`));
    } else if (v.q && !v.q.none && ['ready', 'marks', 'set', 'go', 'recall', 'done'].includes(v.st)) {
      mid.push(h('div', { class: 'athbox' }, v.q.done ? `✅ 내 예선(${v.q.heat}조)은 끝났어요${v.q.fin === 1 ? ' · 🏅 결승 진출!' : ''}` : v.q.ahead ? `⏳ 내 조: 예선 ${v.q.heat}조 · 앞에 ${v.q.ahead}개 조 남음` : `⏳ 내 조: 예선 ${v.q.heat}조`));
    } else if (v.q?.none) mid.push(h('div', { class: 'athbox' }, '이번 종목은 응원해요! 아래 버튼으로 연습할 수 있어요'));
    if (v.st === 'done' && v.res) mid.push(resTable(v.res, api, '경주 결과'));
    if (v.st === 'over') { mid.push(h('div', { class: 'athbox' }, h('b', {}, `🏆 ${v.evName} 결과`), ...((v.over?.podium) || []).map((p, i) => h('div', { class: 'athpod' }, ['🥇', '🥈', '🥉'][i], h('i', { style: { background: api.teamColor(p.team) } }), p.label, h('b', {}, `${fmt(p.t)}초`))), v.myRank ? h('div', { class: 'muted' }, `내 순위: ${v.myRank}위`) : null)); }
    if (v.finalists && !['over'].includes(v.st) && !(v.st === 'done')) mid.push(h('details', { class: 'athfin' }, h('summary', {}, `🏅 결승 진출 ${v.finalists.length}명`), ...v.finalists.map(([n, t, tm]) => h('div', {}, h('i', { style: { background: api.teamColor(t) } }), n, h('small', {}, ` 예선 ${fmt(tm)}초`)))));
    if ((v.st === 'done' || v.st === 'over') && v.board?.length) mid.push(h('details', { class: 'athfin' }, h('summary', {}, '📋 이 종목 전체 기록'), ...v.board.map(([n, t, tm, f], i) => h('div', {}, `${i + 1}. `, h('i', { style: { background: api.teamColor(t) } }), n, h('small', {}, ` ${fmt(tm)}초${f ? ' (결승)' : ''}`)))));
    mid.push(h('div', { class: 'athnote' }, '기록은 게임이 계산한 기록이에요 (실제로 잰 달리기 기록이 아니에요)'));
    if (!same) { this.mid.innerHTML = ''; this.mid.append(...mid); } // 바뀔 때만 다시 그림 (펼친 목록이 닫히지 않게)
    if (!running && !this.hint.classList.contains('bad')) { this.hint.className = 'athhint'; this.hint.textContent = me && v.ev === 'relay' && me.role === 'wait' ? '내 차례 전: 연습만 돼요 (기록 안 됨)' : '연습: 왼발·오른발을 번갈아 빠르게 (기록 안 됨)'; }
    if (running && v.st === 'ready') { this.hint.className = 'athhint'; this.hint.textContent = '사회자가 출발 버튼을 누르면 "제자리에 → 차렷 → 탕!"'; }
    if (running && v.st === 'go' && !this.hint.classList.contains('bad')) { this.hint.className = 'athhint'; this.hint.textContent = '번갈아 빠르게! 1초에 7번이면 최고 속도'; }
  },
  draw() {
    const v = this.v; if (!v) return; const cv = this.cv; const r = cv.getBoundingClientRect(); if (r.width < 10) return;
    const dpr = Math.min(1.5, devicePixelRatio || 1); const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; this.bgKey = ''; }
    const c = cv.getContext('2d'); const N = v.lanes || 8; const api = this.api; const now = api.now(); const D = v.D;
    const straight = v.ev === '100'; const key = `${W}x${H}:${v.ev}:${N}`;
    if (this.bgKey !== key) { this.bgKey = key; if (straight) { this.vw = straightView(W, H, N); this.bg = straightBg(W, H, this.vw, { big: W > 500 }); } else { this.vw = ovalView(W, H, N, { sy: 0.7, pad: 0.03, fit: true }); this.bg = ovalBg(W, H, this.vw, v.ev, { big: false }); } }
    c.drawImage(this.bg, 0, 0);
    const rows = v.rs || []; const myLane = v.me?.lane; const lead = v.rank?.[0];
    const draws = rows.map((x) => ({ x, d: this.sm(x[ROW.lane], x[ROW.d], v.st === 'go' ? x[ROW.v] : 0, v.T, now, D) }));
    for (const { x, d } of draws.sort((a, b) => (a.x[ROW.lane] === myLane) - (b.x[ROW.lane] === myLane))) {
      const col = api.teamColor(x[ROW.team]); const me = x[ROW.lane] === myLane;
      if (straight) sideRunner(c, this.vw, x[ROW.lane], d, col, { me, run: v.st === 'go' && x[ROW.v] > 0.3 });
      else dotRunner(c, this.vw, v.ev, x[ROW.lane], d, col, { r: 1.6, me, small: true, lead: x[ROW.lane] === lead });
      if (v.ev === 'relay' && x[ROW.od] && v.st === 'go') dotRunner(c, this.vw, v.ev, x[ROW.lane], x[ROW.od], col + '99', { r: 1.1, small: true });
    }
    // 순위·남은 거리
    const mine = rows.find((x) => x[ROW.lane] === myLane);
    const order = v.rank || []; const pos = myLane ? order.indexOf(myLane) + 1 : 0;
    if (mine && ['go', 'done'].includes(v.st)) {
      const left = Math.max(0, D - (this.sm(myLane, mine[ROW.d], 0, v.T, v.T, D)));
      const e = mine[ROW.e]; const en = v.ev === '400' || v.ev === '800';
      const txt = mine[ROW.t] != null ? `🏁 ${pos}위 · ${fmt(mine[ROW.t])}초 (게임 기록)` : `${pos}위 / ${rows.length}명 · 결승까지 ${Math.round(left)}m${mine[ROW.hold] ? ' · ⏱ 1초 늦게 출발' : ''}${mine[ROW.auto] ? ' · 자동 달리기' : ''}`;
      if (this.info.dataset.k !== txt + e) { this.info.dataset.k = txt + e; this.info.innerHTML = ''; this.info.append(h('b', {}, txt), en ? h('span', { class: 'athen' }, '체력', h('i', { style: { width: `${Math.round(e * 100)}%`, background: e < 0.35 ? '#ff6b6b' : '#4ade80' } })) : null); }
    } else {
      const lst = order.slice(0, 4).map((l, i) => { const x = rows.find((y) => y[ROW.lane] === l); return x ? `${i + 1}. ${x[ROW.label]}` : ''; }).filter(Boolean).join('  ');
      const txt = v.st === 'go' ? lst : rows.length ? `${rows.length}명 · ${rows.map((x) => `${x[ROW.lane]}${x[ROW.label]}`).slice(0, 8).join(' · ')}` : '';
      if (this.info.dataset.k !== txt) { this.info.dataset.k = txt; this.info.textContent = txt; }
    }
    // 신호 색은 서버 시각으로 바로 바꿈 (총소리 순간)
    if (v.st === 'set' && v.tGo && now >= v.tGo && !this.sig.classList.contains('s-go')) { this.sig.className = 'athsig s-go'; this.sig.textContent = STLBL.go; if (v.me) vibrate(60); }
  },
  unmount() { this.dead = true; cancelAnimationFrame(this.raf); clearInterval(this.iv); },
};
function resTable(res, api, title) {
  return h('div', { class: 'athbox' }, h('b', {}, `${title} · ${res.heat}`), res.skipped ? h('div', { class: 'muted' }, '건너뛴 조') : null,
    ...res.rows.map(([lane, label, team, t, place, react, fs]) => h('div', { class: 'athrow' }, h('span', { class: 'pl' }, place ? `${place}` : '—'), h('i', { style: { background: api.teamColor(team) } }), h('span', { class: 'nm' }, `${lane}주로 ${label}`), h('b', {}, t != null ? `${fmt(t)}초` : '기록 없음'), h('small', {}, `${react != null ? ` 반응 ${react.toFixed(2)}` : ''}${fs ? ` 🚩${fs}` : ''}`))));
}

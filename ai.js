// 컴퓨터 상대(AI) — 혼자 테스트하기·게임 미리보기용
// 실제 참가자 폰 화면(play.html)을 그대로 띄우고, 사람이 하는 것과 같은 입력만 보냄 → 서버가 똑같이 판정
//  · 서버가 판정하는 게임: 화면 정보(view)를 보고 같은 메시지(이동·점프·답 고르기·던지기…)를 보냄
//  · 폰에서 계산하는 손맛 게임(러너·달고나·투호 등): 화면의 게임에 손가락 이벤트(pointerdown/move/up)를 직접 넣음
// 점수를 지어내서 보내지 않음. 난이도 = 반응 속도·정확도·실수 확률
import { fruitSchedule, ropeBeats, rhythmChart, spotPuzzle, balloonWave, balloonTarget, balloonCfg, bossCell } from './gen2.js';

const R = (a, b) => a + Math.random() * (b - a);
const AW = 1600, AH = 860;
export const LEVELS = { easy: { skill: 0.4, label: '🟢 쉬움' }, normal: { skill: 0.7, label: '🟡 보통' }, hard: { skill: 0.95, label: '🔴 어려움' }, random: { skill: null, label: '🟣 랜덤' } };

// 합성 손가락 이벤트가 setPointerCapture에서 막히지 않게 (이 AI 화면에서만)
const spc = Element.prototype.setPointerCapture; Element.prototype.setPointerCapture = function (id) { try { spc.call(this, id); } catch { /* 합성 이벤트 */ } };

export class AI {
  constructor({ level, send, now, pid, inst }) {
    this.level = LEVELS[level] ? level : 'normal'; this.sendRaw = send; this.now = now; this.pid = pid; this.inst = inst;
    this.timers = new Set(); this.loop = null; this.cur = null; this.run = null; this.state = null; this.v = null;
    this.pickSkill();
  }
  pickSkill() { this.skill = this.level === 'random' ? R(0.3, 1) : LEVELS[this.level].skill; }
  later(ms, fn) { const t = setTimeout(() => { this.timers.delete(t); fn(); }, Math.max(0, ms)); this.timers.add(t); }
  every(ms, fn) { if (this.loop) clearInterval(this.loop); this.loop = setInterval(fn, ms); }
  clear() { for (const t of this.timers) clearTimeout(t); this.timers.clear(); if (this.loop) clearInterval(this.loop); this.loop = null; this.fingerUp?.(); }
  in(m) { this.sendRaw(m); }
  onMsg(m) {
    if (m.t === 'state') { const was = this.state?.phase; this.state = m; if (m.phase !== 'playing' && m.phase !== 'countdown') { this.clear(); this.run = null; this.cur = null; this.holdOn = false; } if (was !== m.phase && m.phase === 'countdown') this.pickSkill(); return; }
    if (m.pid && m.pid !== this.pid) return;
    if (m.t === 'me' && m.game) { if (m.run !== this.run) { this.clear(); this.run = m.run; this.cur = null; } this.onView(m.game); return; }
    if (m.t !== 'g') return;
    if (m.run !== this.run) { this.clear(); this.run = m.run; this.cur = null; }
    if (m.v) this.onView(m.v);
    if (m.r) this.onReply(m.r);
  }
  // ---------- 화면(DOM) 손가락 ----------
  box(sel) { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? { el, r } : null; }
  ptr(sel, type, fx, fy) { const b = this.box(sel); if (!b) return false; const x = b.r.left + fx * b.r.width, y = b.r.top + fy * b.r.height; b.el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true })); return true; }
  tapSel(sel, fx = 0.5, fy = 0.5) { if (!this.ptr(sel, 'pointerdown', fx, fy)) return false; this.later(40, () => this.ptr(sel, 'pointerup', fx, fy)); return true; }
  S() { return window.__game?.S; }

  onReply(r) {
    if (r && r.order && this.v?.g === 'burger') { this.v = { ...this.v, order: r.order, k: r.k ?? this.v.k }; this.cur = null; this.onView(this.v); }
    if (r && r.next != null && this.v?.g === 'spot') { this.v = { ...this.v, k: r.next }; this.onView(this.v); }
  }

  onView(v) {
    if (v.g === 'hold' && !v.out && !this.holdOn && (this.state?.phase === 'countdown' || this.state?.phase === 'playing')) {
      // 카운트다운 중에 누르고, 실력에 따라 언젠가 손을 뗌 (어려움일수록 오래 버팀)
      this.holdOn = true; this.later(R(200, 900), () => { this.ptr('.hdbtn', 'pointerdown', 0.5, 0.5); });
      const life = Math.random() < this.skill * 0.7 ? 1e9 : R(4000, 40000) * this.skill; this.later(life, () => this.ptr('.hdbtn', 'pointerup', 0.5, 0.5));
    }
    if (this.state?.phase !== 'playing' || v.spectator) return;
    this.v = v; const g = v.g; const sk = this.skill; const now = () => this.now();
    const once = (key, fn) => { if (this.cur === key) return; this.cur = key; fn(); };
    switch (g) {
      // ---- 이동 게임: 조이스틱 방향을 보냄 (서버가 위치·충돌 계산)
      case 'dodge': case 'zombie': case 'paint': case 'gems': case 'crown':
        once(g, () => {
          let ang = Math.random() * 7; let lagged = null;
          this.every(160, () => {
            const v2 = this.v; if (!v2) return;
            let x = Math.cos(ang), y = Math.sin(ang);
            if (g === 'dodge' && v2.warn?.length) {
              // 경고 원 안이면 원 밖 방향으로 (쉬움일수록 늦게·자주 놓침)
              const w = v2.warn.map((q) => [q, Math.hypot(q[0] - v2.x, q[1] - v2.y)]).sort((a, b) => a[1] - b[1])[0];
              if (w && w[1] < w[0][2] + 60 && Math.random() < sk) { const l = w[1] || 1; x = (v2.x - w[0][0]) / l; y = (v2.y - w[0][1]) / l; }
            }
            if (g === 'zombie' && Math.random() < 0.4 + sk * 0.6) {
              // 상대 위치: 경기장 전체에서 가장 가까운 상대(opp) — 예전엔 내 주변(near)만 봐서 멀리 있는 상대를 못 찾고 헤맸음
              const opp = []; const o = v2.opp || []; for (let i = 0; i + 2 < o.length; i += 3) opp.push([o[i], o[i + 1], Math.hypot(o[i] - v2.x, o[i + 1] - v2.y)]);
              if (!opp.length && v2.near) for (let i = 0; i + 3 < v2.near.length; i += 4) { const z = v2.near[i + 2]; if (v2.z ? z : !z) continue; opp.push([v2.near[i], v2.near[i + 1], Math.hypot(v2.near[i] - v2.x, v2.near[i + 1] - v2.y)]); }
              opp.sort((a, b) => a[2] - b[2]);
              if (v2.z && opp.length) { const t = opp[0]; const l = t[2] || 1; x = (t[0] - v2.x) / l; y = (t[1] - v2.y) / l; } // 좀비: 가장 가까운 사람 쫓기
              else if (!v2.z && opp.length && opp[0][2] < 520) {
                // 사람: 가까운 좀비들에게서 멀어지는 방향 + 벽에서 떨어지는 힘 (구석에 몰려 끼지 않게)
                let fx = 0, fy = 0; for (const [zx, zy, d] of opp) { if (d > 520) continue; const w = 1 / Math.max(40, d) ** 2; fx += (v2.x - zx) / (d || 1) * w; fy += (v2.y - zy) / (d || 1) * w; }
                const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
                const wall = (p, max) => (p < 140 ? (140 - p) / 140 : p > max - 140 ? -(p - (max - 140)) / 140 : 0);
                const wx = wall(v2.x, AW), wy = wall(v2.y, AH); fx += wx * 1.6; fy += wy * 1.6;
                // 벽에 막혀 거의 못 움직이면 벽을 따라 옆으로 빠져나감
                if (Math.hypot(fx, fy) < 0.35) { const zx = opp[0][0] - v2.x, zy = opp[0][1] - v2.y; fx = -zy; fy = zx; if ((v2.x < AW / 2) !== (fx > 0)) { fx = -fx; fy = -fy; } }
                const l = Math.hypot(fx, fy) || 1; x = fx / l; y = fy / l;
              }
            }
            // 벽에 끼임 감지: 1.5초 동안 거의 안 움직였으면 경기장 가운데 쪽으로 방향을 새로 잡음
            if (g === 'zombie') { const st = this.zst ||= { x: v2.x, y: v2.y, at: Date.now() }; if (Math.hypot(v2.x - st.x, v2.y - st.y) > 30) { st.x = v2.x; st.y = v2.y; st.at = Date.now(); } else if (Date.now() - st.at > 1500) { ang = Math.atan2(AH / 2 - v2.y, AW / 2 - v2.x) + R(-0.6, 0.6); x = Math.cos(ang); y = Math.sin(ang); st.at = Date.now(); } }
            if (g === 'gems' && v2.gems?.length && Math.random() < 0.3 + sk * 0.7) { const b = v2.gems.slice().sort((a, b2) => Math.hypot(a[0] - v2.x, a[1] - v2.y) - Math.hypot(b2[0] - v2.x, b2[1] - v2.y))[0]; const l = Math.hypot(b[0] - v2.x, b[1] - v2.y) || 1; x = (b[0] - v2.x) / l; y = (b[1] - v2.y) / l; }
            if (g === 'crown' && v2.z && Math.random() < 0.3 + sk * 0.7) { const l = Math.hypot(v2.z[0] - v2.x, v2.z[1] - v2.y); if (l > 40) { x = (v2.z[0] - v2.x) / l; y = (v2.z[1] - v2.y) / l; } else { x *= 0.3; y *= 0.3; } }
            if (v2.x < 60) x = Math.abs(x); if (v2.x > AW - 60) x = -Math.abs(x); if (v2.y < 60) y = Math.abs(y); if (v2.y > AH - 60) y = -Math.abs(y);
            if (Math.random() < 0.15) ang = Math.atan2(y, x) + R(-1, 1);
            // 반응 지연: 쉬움은 한 박자 늦게 방향을 바꿈
            const cmd = { a: 'mv', x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
            if (sk < 0.6) { const prev = lagged; lagged = cmd; if (prev) this.in(prev); } else this.in(cmd);
          });
        });
        break;
      case 'mugung': {
        const want = v.ph === 'sing' && !v.out && !v.fin;
        if (v.ph !== this.mgPh) { this.mgPh = v.ph; this.mgN = (this.mgN || 0) + 1; }
        once(`mg${this.mgN}`, () => {
          if (want) this.later(R(150, 500) / sk, () => { this.on = true; this.ptr('.mgbtn', 'pointerdown', 0.5, 0.5); });
          else if (this.on) { const late = Math.random() > sk * 0.9; this.later(late ? R(450, 900) : R(60, 220), () => { this.on = false; this.ptr('.mgbtn', 'pointerup', 0.5, 0.5); }); }
        });
        break;
      }
      case 'rope':
        if (v.prm?.t0) once('rope', () => { for (const b of ropeBeats(v.prm, 120000)) { if (Math.random() > 0.92 * sk + 0.05) continue; const d = b + R(-140, 140) / sk - now(); if (d > 0 && d < 90000) this.later(d, () => this.tapSel('.jumpbtn')); } });
        break;
      case 'fire':
        if (v.R?.length) once('fire', () => { v.R.forEach((rd, i) => { if (Math.random() > 0.97) return; const d = rd.A + R(-260, 260) / sk - now(); if (d > 0) this.later(d, () => this.in({ a: 'pop', i, ts: Math.round(now()) })); }); });
        break;
      case 'fruit':
        if (v.t0) once('fruit', () => { for (const f of fruitSchedule(v.seed, v.dur, v.lv)) { if (f.type === 'b' ? Math.random() > (1 - sk) * 0.3 : Math.random() > 0.85 * sk) continue; const d = v.t0 + (f.t + R(0.4, 1.4)) * 1000 - now(); if (d > 0) this.later(d, () => this.in({ a: 'cut', ids: [f.id], ts: Math.round(now()) })); } });
        break;
      case 'rhythm':
        if (v.t0) once('rh', () => { const ch = rhythmChart(v.seed, v.t0, v.dur, v.lv); for (const n of ch.notes) { if (Math.random() > 0.85 * sk + 0.1) continue; const d = n.t + R(-90, 90) / sk - now(); if (d > 0 && d < 90000) this.later(d, () => this.in({ a: 'hit', i: n.i, l: n.l, ts: Math.round(now()) })); } });
        break;
      case 'penalty':
        // 구석(위 칸)은 잘 안 막히지만 빗나갈 수 있음 → 어려움일수록 구석을 노림
        once(g, () => this.every(R(1700, 2600), () => { const corner = Math.random() < sk * 0.6; const z = corner ? [0, 2][Math.floor(Math.random() * 2)] : 3 + Math.floor(Math.random() * 3); this.in({ a: 'kick', z }); }));
        break;
      case 'burger':
        once(`bg${v.k}`, () => this.later(R(1500, 4500) / sk, () => { const ok = Math.random() < 0.55 + sk * 0.4; const st = ok ? v.order : [...v.order].reverse().concat(['🧀']); this.in({ a: 'serve', st }); this.cur = null; }));
        break;
      case 'bell':
        // 서버가 정해 준 '아는 문제'(난이도별 확률)면 정답, 아니면 찍기
        if (v.ph === 'q' && !v.submitted && v.opts) once(`b${v.qi}`, () => this.later(R(1200, 5000) * (1.3 - sk), () => { const c = v.aiKnow != null ? v.aiKnow : Math.floor(Math.random() * v.opts.length); this.in({ a: 'ans', q: v.qi, c }); }));
        break;
      case 'tele':
        if (v.ph === 'q' && v.my == null) once(`t${v.i}`, () => this.later(R(800, 4000), () => this.in({ a: 'pick', q: v.i, c: Math.random() < 0.5 ? 0 : Math.floor(Math.random() * v.opts.length) })));
        break;
      case 'mino':
        if (v.ph === 'q' && v.my == null) once(`m${v.i}`, () => this.later(R(800, 4000), () => this.in({ a: 'pick', q: v.i, c: Math.floor(Math.random() * 2) })));
        break;
      case 'hilo':
        // 지금 카드가 작으면 '높다', 크면 '낮다' (쉬움은 가끔 반대로)
        if (v.ph === 'q' && v.my == null) once(`h${v.i}`, () => this.later(R(600, 3000), () => { const n = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].indexOf(String(v.card)); let c = (n > 0 ? n : 7) <= 7 ? 0 : 1; if (Math.random() > 0.5 + sk * 0.5) c = 1 - c; this.in({ a: 'pick', q: v.i, c }); }));
        break;
      case 'spot':
        once(`sp${v.k}`, () => { const z = spotPuzzle(v.seed, v.k, v.lv); let j = 0; const tap = () => { if (this.v?.k !== v.k) return; if (Math.random() > 0.75 + sk * 0.25) this.in({ a: 'tap', k: v.k, c: Math.floor(Math.random() * z.left.length) }); else if (j < z.diff.length) this.in({ a: 'tap', k: v.k, c: z.diff[j++] }); this.later(R(1500, 3500) / sk, tap); }; this.later(R(1500, 3000), tap); });
        break;
      case 'draw':
        if (v.ph !== 'draw') break;
        if (v.me === 'draw') once(`d${v.round}`, () => { let a = 0; this.every(160, () => { const p = []; for (let i = 0; i < 8; i++) { a += 0.25; p.push(Math.round(500 + Math.cos(a) * (200 + a * 4)), Math.round(500 + Math.sin(a) * (200 + a * 4))); } this.in({ a: 'ln', p: p.map((x) => Math.max(0, Math.min(1000, x))), c: 0, w: 2 }); }); });
        else if (v.me === 'guess' && !v.got) once(`g${v.round}`, () => { const tryOne = () => { if (this.v?.got || this.v?.ph !== 'draw') return; this.in({ a: 'g', w: Math.floor(Math.random() * v.opts.length) }); this.later(R(2700, 4500), tryOne); }; this.later(R(2500, 6000) / sk, tryOne); });
        break;
      case 'shout':
        once('shout', () => this.every(200, () => this.in({ a: 'lv', v: Math.round(R(25, 95) * sk) })));
        break;
      case 'sync':
        this.sy ||= [];
        for (const b of v.nx || []) { if (b.rest && Math.random() > (1 - sk) * 0.4) continue; if (this.sy.some((x) => Math.abs(x - b.at) < 200)) continue; this.sy.push(b.at); if (this.sy.length > 30) this.sy.shift(); const d = b.at - now(); if (d > 0 && Math.random() < 0.45 + sk * 0.5) this.later(d + R(-200, 200) * (1.2 - sk), () => this.in({ a: 'hit', ts: Math.round(now()) })); }
        break;
      case 'relay':
        if (v.me) once(`r${v.legs}_${v.prog === 0 ? 0 : 'x'}`, () => { const go = () => { if (!this.v?.me) return; this.in({ a: 'tap', n: Math.random() < 0.5 ? 2 : 3 }); this.later(R(120, 260) / sk, go); }; this.later(R(200, 700) / sk, go); });
        break;
      case 'balloon':
        once('balloon', () => { const C = balloonCfg(v.lv); const done = new Set(); this.every(Math.round(320 / sk), () => { const vv = this.v; if (!vv?.t0) return; const s = (now() - vv.t0) / 1000; const w1 = Math.floor((s - 1) / C.gap); const tgt = balloonTarget(vv.seed, Math.floor(s / C.tSec), C.nc); for (let w = Math.max(0, w1 - 3); w <= w1; w++) for (const b of balloonWave(vv.seed, this.pid, w, vv.lv)) { if (done.has(b.id) || s < b.t0 + 0.3 || s > b.t0 + b.life - 0.2) continue; const right = b.c === tgt; if ((right && Math.random() < 0.35 + sk * 0.5) || (!right && Math.random() < (1 - sk) * 0.12)) { done.add(b.id); this.in({ a: 'pop', id: b.id, ts: Math.round(now()) }); return; } } }); });
        break;
      case 'bombpass':
        if (v.my && this.cur !== `bp${v.my.id}:${v.passes}`) { this.cur = `bp${v.my.id}:${v.passes}`; const my = v.my; this.later(R(400, 2000) / sk, () => { if (this.v?.my?.id !== my.id) return; const c = Math.random() < (1 - sk) * 0.4 ? (my.c + 1) % 3 : my.c; this.in({ a: 'pass', b: my.id, c }); if (c !== my.c) this.later(1100, () => { if (this.v?.my?.id === my.id) this.in({ a: 'pass', b: my.id, c: my.c }); }); }); }
        break;
      case 'boss':
        once('boss', () => this.every(90, () => { const vv = this.v; if (!vv?.t0 || vv.done) return; const s = (now() - vv.t0) / 1000; const k = Math.floor(s / vv.slot); if (k === this.bk || s - k * vv.slot < R(0.15, 0.6) / sk) return; this.bk = k; if (Math.random() > 0.85 * sk + 0.1) return; const right = bossCell(vv.seed, this.pid, k, vv.cells); const c = Math.random() < (1 - sk) * 0.25 ? (right + 1) % vv.cells : right; this.in({ a: 'hit', k, c, ts: Math.round(now()) }); }));
        break;
      case 'towerup':
        if (v.me && this.cur !== `tw${v.h}:${v.T}` && now() - (this.twLast || 0) > 1500) { this.cur = `tw${v.h}:${v.T}`; this.twLast = now(); const vv = v; const at = now(); let tries = 0; const go = () => { if (!this.v?.me) return; const T = vv.T + (now() - at) / 1000; const span = 1 - vv.w; const q = ((T * vv.spd + vv.ph) % 2 + 2) % 2; const x = (q < 1 ? q : 2 - q) * span; if (Math.abs(x - vv.x) < 0.02 + (1 - sk) * 0.12 || ++tries > 70) { this.tapSel('.twbtn'); return; } this.later(30, go); }; this.later(R(300, 900) / sk, go); }
        break;
      // ---- 손맛 게임: 폰 화면의 실제 게임에 손가락 이벤트를 넣음 (점수는 게임이 계산해서 보냄)
      case 'runner': once(g, () => this.every(30, () => { const S = this.S(); if (!S) return; if (S.y <= 0.001 && S.stun <= 0 && S.obs.some((o) => !o.fly && !o.hit && o.x > 0.25 + (1 - sk) * R(-0.08, 0.1) && o.x < 0.38 + (1 - sk) * 0.1)) { if (Math.random() < 0.6 + sk * 0.4) this.tapSel('.skw', 0.5, 0.6); this.pause(250); } })); break;
      case 'flappy': once(g, () => this.every(45, () => { const S = this.S(); if (!S || this.busy()) return; const p = S.pipes.find((q) => q.x > 0.05); const tgt = (p ? p.c : 0.45) + (1 - sk) * R(-0.12, 0.12); if (S.stun <= 0 && S.y > tgt + 0.02 && S.vy > -0.15) { this.tapSel('.skw'); this.pause(60 + (1 - sk) * 120); } })); break;
      case 'stairs': once(g, () => this.every(Math.round(220 / sk), () => { const S = this.S(); if (!S || S.fall > 0) return; let up = S.seq[S.i + 1] === S.face; if (Math.random() > 0.8 + sk * 0.2) up = !up; this.tapSel(up ? '.skb.up' : '.skb.turn'); })); break;
      case 'bridge': once(g, () => this.every(40, () => { const S = this.S(); if (!S) return; if (S.phase === 'ready' && !S.grow && !this.busy()) { this.aim = (() => { const a = S.plat[0], b = S.plat[1]; return b.x - (a.x + a.w) + b.w * 0.5 + (1 - sk) * R(-0.1, 0.1); })(); this.ptr('.skw', 'pointerdown', 0.5, 0.5); this.pause(100); } else if (S.grow && S.len >= this.aim) this.ptr('.skw', 'pointerup', 0.5, 0.5); })); break;
      case 'fishing': once(g, () => { let down = false; this.fingerUp = () => { if (down) this.ptr('.skw', 'pointerup', 0.5, 0.5); down = false; }; this.every(50, () => { const S = this.S(); if (!S) return; const mid = 0.5 + (1 - sk) * R(-0.15, 0.15); const want = (S.st === 'bite' && Math.random() < 0.3 + sk * 0.7) || (S.st === 'reel' && S.ten < mid); if (want && !down) { this.ptr('.skw', 'pointerdown', 0.5, 0.5); down = true; } else if (!want && down) { this.ptr('.skw', 'pointerup', 0.5, 0.5); down = false; } }); }); break;
      case 'eggs': once(g, () => { this.ptr('.skw', 'pointerdown', 0.5, 0.85); this.fingerUp = () => this.ptr('.skw', 'pointerup', 0.5, 0.85); this.every(50, () => { const S = this.S(); if (!S) return; const it = S.items.filter((i) => i.t !== 'rock' && i.y < 0.86 && i.y > 0.2).sort((a, b) => b.y - a.y)[0]; const rock = S.items.find((i) => i.t === 'rock' && i.y > 0.6 && i.y < 0.9 && Math.abs(i.x - S.bx) < 0.14); let tx = it ? it.x : S.bx; if (rock && Math.random() < sk) tx = rock.x > 0.5 ? rock.x - 0.3 : rock.x + 0.3; tx += (1 - sk) * R(-0.15, 0.15); const nx = S.bx + Math.max(-0.035 - sk * 0.03, Math.min(0.035 + sk * 0.03, tx - S.bx)); this.ptr('.skw', 'pointermove', Math.max(0.1, Math.min(0.9, nx)), 0.85); }); }); break;
      case 'dalgona': once(g, () => { let i = 0, down = false, shape = -1; this.fingerUp = () => { if (down) this.ptr('.skw', 'pointerup', 0.5, 0.5); down = false; }; this.every(Math.round(55 / (0.5 + sk)), () => { const S = this.S(); if (!S || !S.W) return; if (S.done) { if (down) { this.ptr('.skw', 'pointerup', 0.5, 0.5); down = false; } i = 0; return; } if (S.shape !== shape || S.k !== this.dk) { shape = S.shape; this.dk = S.k; i = 0; } const p = S.pts[i % 120]; const ar = S.W / S.H; const noise = (1 - sk) * 0.16; const x = 0.5 + (p[0] + R(-noise, noise)) * 0.36, y = 0.5 + (p[1] + R(-noise, noise)) * 0.36 * ar; this.ptr('.skw', down ? 'pointermove' : 'pointerdown', x, y); down = true; i += 2; }); }); break;
      case 'tuho': case 'basket': once(g, () => this.every(300, () => { const S = this.S(); if (!S || S.obj || S.cool > 0 || this.busy()) return; this.throwAt(S, g); })); break;
      case 'curling': if ((v.th?.length ?? 0) < 3) once(`c${v.th.length}`, () => this.later(R(1200, 3000), () => this.curl())); break;
      case 'pe': break;
    }
  }
  busy() { return now2() < (this.pauseUntil || 0); }
  pause(ms) { this.pauseUntil = now2() + ms; }
  // 투호·버저비터: 움직이는 목표가 도착 순간 있을 곳을 예측해서, 위로 미는 속도·옆 방향을 정해 손가락으로 밂
  throwAt(S, g) {
    const ty = g === 'tuho' ? 0.2 : 0.18; const vy = 1.9 + Math.random() * 0.4; const T = (0.92 - ty) / vy; const dt = 0.12;
    const sp = [0.25, 0.35, 0.5, 0.6, 0.65, 0.7][S.lv]; const tx = 0.5 + Math.sin((S.t + T + dt + 0.03) * sp * 2) * 0.32;
    const err = (1.12 - this.skill) * R(-0.14, 0.14); // 어려움도 가끔 빗나감
    const vxObj = (tx + err - 0.5) / T - (S.wind || 0); const swVx = vxObj / 0.35; const swVy = vy / 0.9;
    const x0 = 0.5, y0 = 0.85; const x1 = x0 + swVx * dt, y1 = y0 - swVy * dt;
    this.ptr('.skw', 'pointerdown', x0, y0); this.pause(600);
    this.later(dt * 1000, () => this.ptr('.skw', 'pointerup', Math.max(0.01, Math.min(0.99, x1)), Math.max(0.01, y1)));
  }
  // 컬링: 하우스 중앙까지 미끄러질 속도를 계산해 위로 밀고, 모자라면 문질러(스위핑) 더 보냄
  curl() {
    const sk = this.skill; const dist = 0.68 * (1 + (1 - sk) * R(-0.25, 0.2)); const speed = Math.min(1.25, Math.sqrt(2 * 0.42 * dist)); const dt = 0.25;
    const swVy = speed / 0.42; const side = (1 - sk) * R(-0.4, 0.4);
    this.ptr('.skw', 'pointerdown', 0.5, 0.9);
    this.later(dt * 1000, () => {
      this.ptr('.skw', 'pointerup', 0.5 + side * dt, 0.9 - swVy * dt);
      if (sk > 0.6) { let n = 0; const rub = () => { if (n++ > 10) return this.ptr('.skw', 'pointerup', 0.5, 0.5); this.ptr('.skw', n === 1 ? 'pointerdown' : 'pointermove', 0.3 + (n % 2) * 0.4, 0.6); this.later(60, rub); }; if (Math.random() < 0.3) this.later(500, rub); }
    });
  }
}
const now2 = () => performance.now();

// 테스트용 가상 참가자(봇). 실제 폰 화면과 같은 WebSocket 메시지를 보냄.
import WebSocket from 'ws';
import { numHuntLayout, colorRound, towerX, towerSpeed } from '../../public/shared/gen.js';

const R = (a, b) => a + Math.random() * (b - a);
const COLOR_NAMES = ['빨강', '파랑', '노랑', '초록', '보라', '주황'];

export async function api(base, path, body, token) {
  const r = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || r.status); e.status = r.status; throw e; }
  return j;
}

export class Bot {
  constructor(base, info, opts = {}) {
    this.base = base; this.info = info; this.opts = opts;
    this.views = {}; this.timers = new Set(); this.stats = { msgs: 0, errs: 0 };
    this.hints = opts.hintBoard; // 금고 게임 테스트용 팀 힌트 공유
    this.skill = opts.skill ?? R(0.6, 1);
  }
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.base.replace('http', 'ws') + '/ws');
      this.ws = ws;
      ws.on('open', () => { ws.send(JSON.stringify({ t: 'hello', role: 'player', eid: this.info.eventId, pid: this.info.pid, secret: this.info.secret })); resolve(); });
      ws.on('error', reject);
      ws.on('message', (d) => { this.stats.msgs++; try { this.onMsg(JSON.parse(d)); } catch (e) { this.stats.errs++; console.error('bot', e); } });
      ws.on('close', () => { this.closed = true; this.clear(); });
    });
  }
  send(m) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); }
  later(ms, fn) { const t = setTimeout(() => { this.timers.delete(t); if (!this.closed) fn(); }, ms); this.timers.add(t); }
  clear() { for (const t of this.timers) clearTimeout(t); this.timers.clear(); if (this.loop) clearInterval(this.loop); this.loop = null; }
  close() { this.clear(); this.ws?.close(); }
  in(m) { this.send({ t: 'in', run: this.run, ...(this.ri != null ? { ri: this.ri } : {}), ...m }); }

  onMsg(m) {
    if (m.t === 'state') {
      this.state = m;
      if (m.phase !== 'playing' && m.phase !== 'countdown') { this.clear(); this.run = null; this.cur = null; }
      return;
    }
    if (m.t !== 'g') return;
    if (m.run !== this.run) { this.clear(); this.run = m.run; this.cur = null; }
    if (m.v) this.onView(m.v);
    if (m.r) this.onReply(m.r);
  }

  onView(v0) {
    let v = v0; this.ri = null;
    if (v0.g === 'throne') { if (!v0.sub) { this.clear(); this.cur = null; return; } this.ri = v0.ri; v = v0.sub; if (this.curRi !== v0.ri) { this.clear(); this.cur = null; this.curRi = v0.ri; } }
    if (this.state?.phase !== 'playing' || v.spectator) return;
    const g = v.g; this.v = v;
    const once = (key, fn) => { if (this.cur === key) return; this.cur = key; fn(); };
    switch (g) {
      case 'mash': case 'tug':
        once(g, () => { this.loop = setInterval(() => this.in({ a: 'tap', n: Math.round(R(2, 5) * this.skill) }), 300); }); break;
      case 'race':
        once(g, () => { let f = 'L'; this.loop = setInterval(() => { if (Math.random() < 0.05) { this.in({ a: 'step', f }); } else { f = f === 'L' ? 'R' : 'L'; this.in({ a: 'step', f }); } }, 110 / this.skill); }); break;
      case 'bomb':
        if (v.holding) once('bomb' + v.since, () => this.later(R(600, 2500), () => this.in({ a: 'pass' }))); break;
      case 'nunchi':
        if (v.phase === 'pick' && v.pick == null) once('n' + v.round, () => this.later(R(200, 3000), () => this.in({ a: 'pick', v: 1 + Math.floor(Math.random() * v.K) }))); break;
      case 'tensec':
        if (!v.running && v.left > 0) once('t' + v.left, () => this.later(R(100, 800), () => { this.in({ a: 'go' }); const el = v.target * 1000 + R(-900, 900) / this.skill; this.later(el, () => this.in({ a: 'stop', el: el + R(-20, 20) })); })); break;
      case 'survivor':
        if (v.phase === 'pick' && v.alive && v.pick == null) once('s' + v.round, () => this.later(R(200, 3000), () => this.in({ a: 'pick', v: Math.floor(Math.random() * v.opts.length) }))); break;
      case 'vault': this.vault(v); once('vault', () => { this.loop = setInterval(() => this.v?.g === 'vault' && this.vault(this.v), 700); }); break;
      case 'mole':
        once('mole', () => {
          for (const [i, s] of v.sched.entries()) if (Math.random() < 0.75 * this.skill) {
            const at = v.t0 + s.at + R(150, Math.min(700, s.dur - 100)) - Date.now();
            if (at > 0) this.later(at, () => this.in({ a: 'hit', i, hole: s.hole }));
          }
          this.loop = setInterval(() => { if (Math.random() < 0.1) this.in({ a: 'miss' }); }, 1000);
        }); break;
      case 'reaction':
        if (v.phase === 'arm' && !v.cur) once('r' + v.round, () => { const rt = R(220, 480) / this.skill; if (Math.random() < 0.05) this.later(v.delay * 0.5, () => this.in({ a: 'tap', round: v.round, early: true })); else this.later(v.delay + rt + 30, () => this.in({ a: 'tap', round: v.round, rt })); }); break;
      case 'rps':
        if (v.phase === 'pick' && v.lives > 0 && v.pick == null) once('p' + v.round, () => this.later(R(200, 2500), () => this.in({ a: 'pick', v: Math.floor(Math.random() * 3) }))); break;
      case 'numhunt':
        once('nh', () => { this.loop = setInterval(() => { const x = this.v; if (x.g !== 'numhunt') return; const lay = numHuntLayout(x.seed, x.n); const k = Math.random() < 0.06 ? 0 : lay.pos[x.next - 1]; this.in({ a: 'tap', b: x.board, k }); }, 700 / this.skill); }); break;
      case 'memory':
        if (!v.fin) once('m' + v.lvl + ':' + v.att, () => this.later(R(200, 600), () => this.in({ a: 'show' }))); break;
      case 'colortrap':
        once('ct', () => { this.loop = setInterval(() => { const x = this.v; if (x.g !== 'colortrap') return; const R0 = colorRound(x.seed, x.r, x.tiles, x.colors, x.stroop); let i = R0.grid.findIndex((c, j) => c === R0.target && !x.found.includes(j)); if (Math.random() < 0.1) i = R0.grid.findIndex((c) => c !== R0.target); if (i >= 0) { this.in({ a: 'tap', r: x.r, i }); x.found.push(i); } }, 650 / this.skill); }); break;
      case 'ox':
        if (v.phase === 'q' && v.my == null) once('o' + v.qi, () => this.later(R(300, 4000), () => this.in({ a: 'ans', q: v.qi, v: Math.random() < 0.5 ? 1 : 0 }))); break;
      case 'tower':
        once('tw' + v.tw + ':' + v.k, () => {
          const x = v; const spawn = Date.now();
          let bt = 500, be = 9;
          for (let t = 300; t < 4000; t += 10) { const e = Math.abs(towerX(t, towerSpeed(x.lv, x.k), x.w) - x.left); if (e < be) { be = e; bt = t; } }
          const ms = bt + R(-60, 60) / this.skill;
          this.later(ms, () => this.in({ a: 'drop', k: x.k, tw: x.tw, ms: Date.now() - spawn }));
        }); break;
      case 'fatebox':
        if (v.phase === 'pick' && v.pick == null) once('f' + v.round, () => this.later(R(300, 3000), () => this.in({ a: 'pick', v: Math.floor(Math.random() * v.n) }))); break;
      case 'bingo':
        if (!this.bingoBusy && Date.now() > (v.cool || 0)) {
          const open = v.board.map((s, i) => (s === 0 ? i : -1)).filter((i) => i >= 0);
          if (open.length) { this.bingoBusy = true; const c = open[Math.floor(Math.random() * open.length)]; this.later(R(200, 900), () => this.in({ a: 'open', c })); this.later(4000, () => (this.bingoBusy = false)); }
        } break;
      case 'roulette':
        if (v.can) once('rl', () => this.later(R(500, 3000), () => this.in({ a: 'spin' }))); break;
    }
  }

  onReply(r) {
    if (r.seq && this.v?.g === 'memory') {
      const ans = Math.random() < 0.82 * this.skill + 0.1 ? r.seq : r.seq.map((x, i) => (i === 0 ? (x + 1) % this.v.btns : x));
      this.later(r.seq.length * this.v.flash + R(300, 900), () => this.in({ a: 'ans', lvl: r.lvl, att: r.att, seq: ans }));
    }
    if (r.mission) {
      const ms = r.mission;
      if (ms.type === 'tap') { let left = ms.n; const go = () => { if (left <= 0) return; const k = Math.min(4, left); left -= k; this.in({ a: 'tapm', c: ms.c, n: k }); this.later(320, go); }; go(); }
      else {
        let v = Math.floor(Math.random() * ms.opts.length);
        if (ms.type === 'color') { const name = COLOR_NAMES.find((n) => ms.q.includes(n)); const i = ms.opts.findIndex((o) => o.name === name); if (i >= 0 && Math.random() < 0.9) v = i; }
        else if (ms.q.includes('찾기')) { const i = ms.opts.findIndex((o) => ms.q.startsWith(String(o))); if (i >= 0) v = i; }
        else if (ms.q.includes('몇 개')) { const n = [...ms.q.split('\n')[0]].filter((c) => c === '🍎' || c === '\u{1F34E}').length || (ms.q.split('🍎').length - 1); const i = ms.opts.indexOf(n); if (i >= 0) v = i; }
        else { const m = ms.q.match(/(\d+) ([+×]) (\d+)(?: − (\d+))?/); if (m) { const val = m[2] === '+' ? +m[1] + +m[3] : +m[1] * +m[3] - +(m[4] || 0); const i = ms.opts.indexOf(val); if (i >= 0) v = i; } }
        this.later(R(500, 1500), () => this.in({ a: 'solve', c: ms.c, v }));
      }
      this.later(2500, () => (this.bingoBusy = false));
    }
    if (r.done != null || r.wrong || r.taken || r.expired) this.bingoBusy = false;
  }

  vault(v) {
    if (v.solved) return;
    // 팀원끼리 힌트 공유 (실제로는 말로 알려 줌)
    const hb = this.hints; if (!hb) return;
    const key = this.info.team;
    hb[key] = hb[key] || [];
    for (const h of v.hints) if (!hb[key].some((x) => x.t === h.t)) hb[key].push(h);
    if (!v.canEnter || Date.now() < (v.lockUntil || 0) || this.vaultBusy) return;
    const code = solveVault(hb[key], v);
    if (!code) return;
    this.vaultBusy = true;
    this.later(R(800, 2000), () => { this.in({ a: 'try', code }); this.later(3500, () => (this.vaultBusy = false)); });
  }
}

function solveVault(hints, v) {
  const POS = ['첫째', '둘째', '셋째', '넷째'];
  const d = Array(v.len).fill(null);
  if (v.kind === 'pic') { for (const h of hints) { const i = POS.findIndex((p) => h.t.startsWith(p)); if (i >= 0) d[i] = h.pic; } return d.every((x) => x != null) ? d : null; }
  for (let pass = 0; pass < 4; pass++) for (const h of hints) {
    let m = h.t.match(/^(\S+) 자리 숫자는 (\d)/) || h.t.match(/^(\S+) 자리는 (\d)$/);
    if (m) { d[POS.indexOf(m[1])] = +m[2]; continue; }
    m = h.t.match(/^(\S+) 자리는 (\S+)보다 (\d) (크다|작다)/);
    if (m) { const i = POS.indexOf(m[1]); const j = POS.indexOf(m[2]); if (d[j] != null) d[i] = d[j] + (m[4] === '크다' ? +m[3] : -m[3]); continue; }
    if (/넷째 자리는 \(첫째 \+ 셋째\)/.test(h.t) && d[0] != null && d[2] != null) d[3] = (d[0] + d[2]) % 10;
  }
  return d.every((x) => x != null) ? d : null;
}

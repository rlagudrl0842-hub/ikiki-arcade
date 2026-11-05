// 공용 클라이언트 도구: 실시간 연결(자동 재연결), 서버 시각 맞추기, 효과음, 음성 안내, DOM 도우미

export const $ = (s, el = document) => el.querySelector(s);

// append / prepend 에 null·false·배열이 섞여 와도 안전하게 처리
for (const proto of [Element.prototype, DocumentFragment.prototype]) {
  for (const k of ['append', 'prepend']) {
    const orig = proto[k];
    proto[k] = function (...kids) { return orig.apply(this, kids.flat(Infinity).filter((x) => x != null && x !== false)); };
  }
}
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------- 실시간 연결 ----------------
export class Live {
  constructor(hello, onMsg, onStatus) {
    this.hello = hello; this.onMsg = onMsg; this.onStatus = onStatus || (() => {});
    this.offset = 0; this.rtt = 999; this.tries = 0; this.queue = [];
    this.open();
    document.addEventListener('visibilitychange', () => { if (!document.hidden && (!this.ws || this.ws.readyState > 1)) this.open(); });
    window.addEventListener('online', () => this.open());
  }
  open() {
    if (this.ws && this.ws.readyState <= 1) return;
    clearTimeout(this.retryT);
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    this.ws = ws;
    this.onStatus('connecting');
    ws.onopen = () => {
      this.tries = 0;
      ws.send(JSON.stringify(typeof this.hello === 'function' ? this.hello() : this.hello));
      this.onStatus('online');
      this.sync();
      clearInterval(this.syncT); this.syncT = setInterval(() => this.sync(), 15000);
    };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'pong') { const now = performance.now(); const rtt = now - m.c; if (rtt < this.rtt + 50 || rtt < 300) { this.rtt = Math.min(rtt, this.rtt * 1.5); this.offset = m.s + rtt / 2 - (performance.timeOrigin + now); } return; }
      this.onMsg(m);
    };
    ws.onclose = (e) => {
      clearInterval(this.syncT);
      this.onStatus('offline', e.code);
      if (e.code === 4004 || this.stopped) return;
      const wait = Math.min(8000, 500 * 2 ** this.tries++) + Math.random() * 500;
      this.retryT = setTimeout(() => this.open(), wait);
    };
    ws.onerror = () => {};
  }
  sync() { for (let i = 0; i < 3; i++) setTimeout(() => this.send({ t: 'ping', c: performance.now() }), i * 300); }
  send(m) { if (this.ws?.readyState === 1) { this.ws.send(JSON.stringify(m)); return true; } return false; }
  now() { return Date.now() + this.offset; } // 서버 시각
  stop() { this.stopped = true; this.ws?.close(); }
}

// ---------------- 효과음 (Web Audio로 직접 합성 — 파일 없음) ----------------
let actx = null;
export function audioUnlock() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx.state !== 'suspended';
  } catch { return false; }
}
export function audioReady() { return !!actx && actx.state === 'running'; }
export function audioCtx() { return actx; }
// 효과음 전용 음량 (배경음악과 따로 조절)
let sfxBus = null; let sfxLevel = 0.8;
function sfxOut() { if (!sfxBus || sfxBus.context !== actx) { sfxBus = actx.createGain(); sfxBus.gain.value = sfxLevel; sfxBus.connect(actx.destination); } return sfxBus; }
export function setSfxVolume(v) { sfxLevel = Math.max(0, Math.min(1, v)); if (sfxBus) sfxBus.gain.setTargetAtTime(sfxLevel, actx.currentTime, 0.05); }
function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slide) {
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime + when;
  const o = actx.createOscillator(); const g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxOut()); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.3, when = 0) {
  if (!actx || actx.state !== 'running') return;
  const buf = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const s = actx.createBufferSource(); s.buffer = buf; const g = actx.createGain(); g.gain.value = vol;
  s.connect(g).connect(sfxOut()); s.start(actx.currentTime + when);
}
export const SFX = {
  tap: () => tone(660, 0.05, 'square', 0.05),
  count: () => tone(520, 0.18, 'square', 0.15),
  go: () => { tone(880, 0.35, 'square', 0.2); tone(1320, 0.35, 'square', 0.1); },
  hurry: () => tone(990, 0.08, 'square', 0.1),
  end: () => { tone(660, 0.25, 'sawtooth', 0.15); tone(440, 0.4, 'sawtooth', 0.15, 0.2); },
  good: () => { tone(880, 0.08, 'triangle', 0.15); tone(1320, 0.12, 'triangle', 0.15, 0.06); },
  bad: () => tone(180, 0.2, 'sawtooth', 0.12),
  boom: () => { noise(0.8, 0.5); tone(90, 0.6, 'sine', 0.4, 0, 40); },
  pass: () => tone(500, 0.12, 'triangle', 0.15, 0, 900),
  overtake: () => { tone(700, 0.1, 'square', 0.12); tone(1050, 0.18, 'square', 0.12, 0.08); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, i * 0.12)); tone(1046, 0.8, 'triangle', 0.18, 0.5); },
  drum: () => { for (let i = 0; i < 16; i++) tone(120 + i * 6, 0.07, 'square', 0.08, i * 0.09); },
  fanfare: () => { const n = [392, 523, 659, 784, 659, 784, 1046]; n.forEach((f, i) => tone(f, 0.25, 'square', 0.12, i * 0.16)); },
  tick: () => { tone(1500, 0.04, 'square', 0.07); tone(750, 0.06, 'sine', 0.06, 0.01); },
  tock: () => { tone(1800, 0.06, 'square', 0.12); tone(900, 0.12, 'sawtooth', 0.08, 0.02); tone(60, 0.18, 'sine', 0.3, 0, 40); },
  lead: () => { noise(0.35, 0.18); tone(300, 0.35, 'sawtooth', 0.1, 0, 1200); tone(1200, 0.12, 'square', 0.12, 0.33); tone(1600, 0.25, 'square', 0.1, 0.42); },
  whoosh: () => { noise(0.5, 0.15); tone(200, 0.5, 'sine', 0.12, 0, 900); },
  spin: () => { for (let i = 0; i < 20; i++) tone(800, 0.03, 'square', 0.06, i * (0.05 + i * 0.008)); },
};
export function sfx(name, on = true) { if (on && SFX[name]) try { SFX[name](); } catch { /* */ } }

// ---------------- 음성 안내 ----------------
let koVoice = null;
function pickVoice() { const v = speechSynthesis.getVoices(); koVoice = v.find((x) => /ko[-_]KR/i.test(x.lang)) || null; }
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
export function say(text, on = true, rate = 1.05) {
  if (!on || !('speechSynthesis' in window) || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; if (koVoice) u.voice = koVoice; u.rate = rate; u.pitch = 1.05;
    speechSynthesis.speak(u);
  } catch { /* */ }
}

// ---------------- 기타 ----------------
export function vibrate(ms) { try { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; navigator.vibrate?.(ms); } catch { /* */ } } // 화면을 한 번도 안 눌렀으면 진동 안 함(브라우저 경고 방지)
export const AGE = { baby: '영아', kid: '유아', elem: '초등', mid: '중등', high: '고등', adult: '성인' };
export const MODE = { baby: '영아 모드', kid: '유아 모드', elem: '초등 모드', mid: '중등 모드', high: '고등 모드', adult: '성인 모드', mixed: '전 연령 혼합' };
export function teamOf(state, id) { return state?.teams?.find((t) => t.id === id) || { id, name: '?', color: '#888', icon: '❔' }; }
export function fmtSec(ms) { return Math.max(0, Math.ceil(ms / 1000)); }
export function confetti(canvas, colors, n = 220) {
  const cx = canvas.getContext('2d');
  canvas.width = canvas.clientWidth * devicePixelRatio; canvas.height = canvas.clientHeight * devicePixelRatio;
  const W = canvas.width, H = canvas.height;
  const parts = Array.from({ length: n }, (_, i) => ({ x: Math.random() * W, y: -Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 6, vy: 3 + Math.random() * 5, r: (6 + Math.random() * 8) * devicePixelRatio, c: colors[i % colors.length], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3 }));
  let raf;
  const loop = () => {
    cx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.a += p.va; if (p.y < H + 20) alive++; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.fillRect(-p.r / 2, -p.r / 3, p.r, p.r * 0.6); cx.restore(); }
    if (alive) raf = requestAnimationFrame(loop); else cx.clearRect(0, 0, W, H);
  };
  loop();
  return () => cancelAnimationFrame(raf);
}
export async function api(path, body, token) {
  const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || '연결 오류'); e.status = r.status; throw e; }
  return j;
}
export function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { return null; } }

// 참가 QR 그림: 서버에서 받아 화면에 직접 넣음 (서버가 잠깐 재시작 중이어도 자동으로 다시 시도)
export function qrImg(url, cls) {
  const img = h('img', { class: cls, alt: '참가 QR' });
  const src = `/api/qr?text=${encodeURIComponent(url)}`;
  let tries = 0;
  const load = async () => {
    tries++;
    try {
      const r = await fetch(src + `&t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      const svg = await r.text();
      if (!svg.includes('<svg')) throw new Error('svg');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    } catch {
      if (tries < 6) setTimeout(load, 1500 * tries);
      else img.src = src;
    }
  };
  load();
  return img;
}

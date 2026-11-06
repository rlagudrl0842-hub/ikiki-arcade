// 배경음악(BGM) 공통 관리: 내장 곡 + 이 컴퓨터에 저장한 곡, 게임별 추천, 재생·일시정지·페이드·빵빠레
// 새 곡을 넣어도 게임 코드는 그대로: 게임은 "곡 id"만 알고, 곡 정보는 여기서만 관리해요.
import { audioCtx } from './client.js';

// 내장 곡 (첨부 MP3를 직접 분석: 템포·에너지·조성·저음 비중 → 분위기)
// cue: 첫 박 위치(초) — 카운트다운 GO!에 첫 박이 맞게 · loopEnd: 끝부분 페이드 전, 8마디 단위로 반복
export const TRACKS = [
  { id: 'g1', name: '급한게임 1', file: '/bgm-g1.mp3', mood: 'rush', cue: 0.325, loopEnd: 67.338, desc: '가장 빠르고 큰 곡 (약 170BPM) · 달리기·순발력' },
  { id: 'g7', name: '급한게임 7', file: '/bgm-g7.mp3', mood: 'battle', cue: 0.116, loopEnd: 185.574, desc: '밝고 몰아치는 단조 (약 150BPM) · 대결·쟁탈전' },
  { id: 'g8', name: '급한게임 8', file: '/bgm-g8.mp3', mood: 'focus', cue: 0.07, loopEnd: 174.15, desc: '일정하고 단단한 비트 (약 150BPM) · 집중·정확도' },
  { id: 'g12', name: '급한게임 12', file: '/bgm-g12.mp3', mood: 'groove', cue: 0.302, loopEnd: 208.608, desc: '저음이 묵직한 장조 그루브 · 신나는 파티·몸 놀이' },
];
export const FANFARE = { file: '/bgm-fanfare.mp3', hit: 0.07 };
export const MOODS = {
  rush: { label: '⚡ 스피드', color: '#ff6b2c' },
  battle: { label: '🔥 배틀', color: '#ff2fa8' },
  focus: { label: '🎯 집중', color: '#2fd5ff' },
  groove: { label: '🎉 신나는', color: '#ffd43b' },
  win: { label: '🏆 승리', color: '#ffe066' },
  etc: { label: '🎵 기타', color: '#b197fc' },
  none: { label: '🔇 음악 없음', color: '#8f98cc' },
};
// 게임별 기본 추천 곡 ('none' = 게임 자체 박자·마이크를 쓰는 게임이라 음악이 방해돼요)
export const REC = {
  dodge: 'g1', runner: 'g1', flappy: 'g1', fruit: 'g1', stairs: 'g1', eggs: 'g1', basket: 'g1', relay: 'g1',
  zombie: 'g7', paint: 'g7', gems: 'g7', crown: 'g7', penalty: 'g7', tuho: 'g7', hilo: 'g7', pe_mission: 'g7',
  dalgona: 'g8', bridge: 'g8', fishing: 'g8', curling: 'g8', fire: 'g8', spot: 'g8', hold: 'g8', bell: 'g8', tele: 'g8', mino: 'g8',
  mugung: 'g12', burger: 'g12', draw: 'g12', pe_freeze: 'g12', pe_simon: 'g12',
  rope: 'none', rhythm: 'none', sync: 'none', shout: 'none',
};
export const AGE_LABEL = { baby: '영아', kid: '유아', elem: '초등', mid: '중등', high: '고등', adult: '성인' };
// 폰 없는 체육 60종 추천곡
import { PE as PE60 } from './pe2data.js';
for (const g of PE60) if (!REC[g.id]) REC[g.id] = g.bgm;
export const NO_MUSIC_WHY = { rope: '줄 박자 소리를 들어야 해요', rhythm: '게임 자체 비트가 나와요', sync: '북 박자를 들어야 해요', shout: '마이크가 음악 소리를 잡아요' };

// 설정에서 이 게임의 곡 고르기 → { id, name, mood, rec, custom } 또는 null(음악 없음)
export function pick(settings, game, customList = []) {
  // 연령별 곡이 있으면 먼저 (예: 'pe_freeze@elem' = 초등일 때 댄스 얼음땡 곡)
  const m = settings?.mode; const want = (m && m !== 'mixed' && settings?.bgm?.[`${game}@${m}`]) || settings?.bgm?.[game] || 'auto';
  const id = want === 'auto' ? REC[game] || 'g7' : want;
  if (id === 'none') return null;
  const t = TRACKS.find((x) => x.id === id) || customList.find((x) => x.id === id);
  // 지운 곡이 남아 있으면 → 그 게임 추천곡으로 안전하게 대신 (음악이 끊기거나 오류 나지 않음)
  if (!t) { const r = REC[game] || 'g7'; return r === 'none' ? null : { ...withMeta(TRACKS.find((x) => x.id === r)), rec: true, missing: id }; }
  return { ...withMeta(t), rec: want === 'auto', custom: id.startsWith('u-') };
}

// 곡별 음량·순서 (내장 곡은 이 브라우저에 따로 기억, 내가 넣은 곡은 곡 정보에 같이 저장)
const MK = 'ikiki:bgmMeta';
export function metaAll() { try { return JSON.parse(localStorage.getItem(MK) || '{}') || {}; } catch { return {}; } }
export function setMeta(id, patch) { const m = metaAll(); m[id] = { ...(m[id] || {}), ...patch }; try { localStorage.setItem(MK, JSON.stringify(m)); } catch { /* 저장 안 되는 창 */ } return m[id]; }
function withMeta(t) { if (!t) return t; if (t.id?.startsWith('u-')) return t; const m = metaAll()[t.id]; return m?.vol != null ? { ...t, vol: m.vol } : t; }
// 승리 음악: 'fanfare'(내장 빵빠레) · 내장 곡 · 내가 넣은 곡. 없는 곡이면 내장 빵빠레로
export function winTrack(settings, customList = []) {
  const id = settings?.winTrack || 'fanfare';
  if (id === 'fanfare') return { id: 'fanfare', name: '🎺 빵빠레 (기본)', hit: FANFARE.hit, vol: metaAll().fanfare?.vol };
  const t = TRACKS.find((x) => x.id === id) || customList.find((x) => x.id === id);
  return t ? { ...withMeta(t), hit: 0 } : { id: 'fanfare', name: '🎺 빵빠레 (기본)', hit: FANFARE.hit, missing: id };
}

// ---------------- 내가 추가한 곡 (이 브라우저의 IndexedDB에 저장) ----------------
const DBN = 'ikiki-music', ST = 'tracks';
export const MAX_MB = 25;
function idb() { return new Promise((res, rej) => { const r = indexedDB.open(DBN, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function tx(mode, fn) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(ST, mode); const out = fn(t.objectStore(ST)); t.oncomplete = () => { db.close(); res(out?.result ?? out); }; t.onerror = () => { db.close(); rej(t.error); }; }); }
export async function listCustom() {
  try { const all = await tx('readonly', (s) => s.getAll()); return (all || []).map(({ blob, ...m }) => ({ ...m, size: blob?.size || m.size })).sort((a, b) => (a.order ?? a.added) - (b.order ?? b.added)); } catch { return []; }
}
export async function addCustom(file, name, mood = 'battle') {
  if (!file) throw new Error('파일을 골라 주세요');
  if (!/^audio\//.test(file.type) && !/\.(mp3|m4a|aac|wav|ogg)$/i.test(file.name)) throw new Error(`'${file.name}': MP3·WAV·M4A 음악 파일만 넣을 수 있어요`);
  if (file.size > MAX_MB * 1048576) throw new Error(`${MAX_MB}MB 이하 파일만 넣을 수 있어요`);
  // 실제로 재생 가능한 파일인지 먼저 풀어 봄
  const tmp = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 44100, 44100);
  let buf; try { buf = await tmp.decodeAudioData(await file.arrayBuffer()); } catch { throw new Error('이 파일은 재생할 수 없어요. MP3로 바꿔서 넣어 주세요'); }
  const id = 'u-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const rec = { id, name: String(name || file.name.replace(/\.[^.]+$/, '')).slice(0, 30), mood: MOODS[mood] ? mood : 'battle', dur: Math.round(buf.duration), size: file.size, added: Date.now(), order: Date.now(), vol: 100, cue: 0, blob: new Blob([file], { type: file.type || 'audio/mpeg' }) };
  try { await tx('readwrite', (s) => s.put(rec)); } catch (e) { throw new Error(/quota/i.test(String(e)) ? '브라우저 저장 공간이 부족해요. 안 쓰는 곡을 지워 주세요' : '저장하지 못했어요: ' + (e?.message || e)); }
  try { await navigator.storage?.persist?.(); } catch { /* */ }
  return { id, name: rec.name, mood: rec.mood, dur: rec.dur, size: rec.size };
}
// 내가 넣은 곡 이름·분류·음량·순서 바꾸기
export async function updateCustom(id, patch) {
  const db = await idb();
  await new Promise((res, rej) => { const t = db.transaction(ST, 'readwrite'); const st = t.objectStore(ST); const g = st.get(id);
    g.onsuccess = () => { const r = g.result; if (!r) return; if (typeof patch.name === 'string' && patch.name.trim()) r.name = patch.name.trim().slice(0, 30); if (MOODS[patch.mood] && patch.mood !== 'none') r.mood = patch.mood; if (Number.isFinite(patch.vol)) r.vol = Math.max(0, Math.min(100, Math.round(patch.vol))); if (Number.isFinite(patch.order)) r.order = patch.order; st.put(r); };
    t.oncomplete = () => { db.close(); res(); }; t.onerror = () => { db.close(); rej(t.error); }; });
}
export async function removeCustom(id) { await tx('readwrite', (s) => s.delete(id)); P.cache.delete(id); }
async function customBlob(id) { const r = await tx('readonly', (s) => s.get(id)); return r?.blob || null; }
export async function storageInfo() {
  const o = { persisted: false, usage: 0, quota: 0 };
  try { o.persisted = !!(await navigator.storage?.persisted?.()); const e = await navigator.storage?.estimate?.(); o.usage = e?.usage || 0; o.quota = e?.quota || 0; } catch { /* */ }
  return o;
}

// ---------------- 재생기 ----------------
// 경로: 곡 → (페이드) → 배경음악 음량 → (말씀 중 줄이기) → 분석기 → 스피커
const P = {
  cache: new Map(), cur: null, paused: null, fan: null, vol: 0.7, ducked: false, voiceUntil: 0, nodes: null, held: false,
};
function ctx() { const a = audioCtx(); return a && a.state !== 'closed' ? a : null; }
function nodes() {
  const a = ctx(); if (!a) return null;
  if (P.nodes?.a === a) return P.nodes;
  const vol = a.createGain(); vol.gain.value = P.vol;
  const duck = a.createGain(); duck.gain.value = P.ducked ? 0.15 : 1;
  const an = a.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.6;
  vol.connect(duck).connect(an).connect(a.destination);
  P.nodes = { a, vol, duck, an, buf: new Uint8Array(an.frequencyBinCount) };
  return P.nodes;
}
async function fetchBuf(url) {
  // 한 번 받은 곡은 브라우저 캐시에 보관 → 와이파이가 약해도 다시 받지 않음
  try { if (window.caches) { const c = await caches.open('ikiki-bgm-v1'); let r = await c.match(url); if (!r) { r = await fetch(url); if (r.ok) await c.put(url, r.clone()); } if (r.ok) return r.arrayBuffer(); } } catch { /* */ }
  const r = await fetch(url); if (!r.ok) throw new Error('곡을 불러오지 못했어요'); return r.arrayBuffer();
}
export function load(id) {
  const a = ctx(); if (!a) return Promise.reject(new Error('소리가 아직 꺼져 있어요'));
  if (P.cache.has(id)) { const hit = P.cache.get(id); P.cache.delete(id); P.cache.set(id, hit); return hit; } // 최근 쓴 곡을 뒤로 (LRU)
  const t = TRACKS.find((x) => x.id === id);
  const p = (async () => {
    const ab = id === 'fanfare' ? await fetchBuf(FANFARE.file) : t ? await fetchBuf(t.file) : await (await customBlob(id) || Promise.reject(new Error('이 컴퓨터에 없는 곡이에요'))).arrayBuffer();
    return await new Promise((res, rej) => a.decodeAudioData(ab, res, rej));
  })();
  P.cache.set(id, p); p.catch(() => P.cache.delete(id));
  // 풀어 둔 곡(디코딩된 소리)은 곡당 20~70MB → 최근 4곡(빵빠레·지금 곡·다음 곡 포함)만 남기고 나머지는 메모리에서 비움 (재생 중인 곡은 재생 노드가 계속 붙잡고 있어 끊기지 않음)
  while (P.cache.size > 4) { const old = P.cache.keys().next().value; if (old === 'fanfare' || old === P.cur?.id) { const v = P.cache.get(old); P.cache.delete(old); P.cache.set(old, v); if ([...P.cache.keys()].every((k) => k === 'fanfare' || k === P.cur?.id)) break; continue; } P.cache.delete(old); }
  return p;
}
// 미리 받기: 예전엔 모든 곡(17MB)을 한꺼번에 받아 풀었음 → 지금·다음 게임 곡과 빵빠레만
export function preloadAll(ids = []) { if (!ctx()) return; for (const id of ['fanfare', ...ids]) if (id && id !== 'none') load(id).catch(() => {}); }

function fadeStop(src, g, sec) {
  const a = ctx(); if (!a || !src) return;
  // 다 멈춘 소리 노드는 연결을 끊어 바로 정리 (곡을 여러 번 바꿔도 노드가 쌓이지 않게)
  const prev = src.onended; src.onended = () => { try { prev?.(); } catch { /* */ } try { src.disconnect(); g.disconnect(); } catch { /* */ } };
  const t = a.currentTime; try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.03, sec)); src.stop(t + Math.max(0.03, sec) + 0.05); } catch { /* */ }
}
function posOf(c, at) { // 반복 구간을 고려한 지금 곡 위치(초)
  const a = ctx(); const el = Math.max(0, (at ?? a.currentTime) - c.startT) * (c.rate || 1);
  let p = c.offset + el; const { loopStart: ls, loopEnd: le } = c.src; if (c.src.loop && le > ls && p > le) p = ls + ((p - ls) % (le - ls)); return p;
}

// 곡 재생 (같은 곡이 이미 나오면 그대로 — 두 곡이 겹쳐 나오지 않음)
// opts: at(오디오 시계 기준 시작 시각), offset(곡 위치), fadeIn(초)
export async function play(meta, opts = {}) {
  if (!meta) { stop(0.6); return; }
  const n = nodes(); if (!n) return;
  if (P.cur && P.cur.id === meta.id && !opts.restart) return;
  const want = Symbol('req'); P.req = want;
  let buf; try { buf = await load(meta.id); } catch (e) { P.err = e.message; return; }
  if (P.req !== want) return; // 그 사이 다른 곡 요청이 들어옴
  stop(0.25, true); P.paused = null; P.held = false;
  const a = n.a; const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
  src.loopStart = meta.cue || 0; src.loopEnd = meta.loopEnd && meta.loopEnd < buf.duration ? meta.loopEnd : buf.duration;
  const g = a.createGain(); src.connect(g).connect(n.vol);
  const when = Math.max(a.currentTime, opts.at ?? a.currentTime);
  let offset = opts.offset ?? meta.cue ?? 0; if (offset > src.loopEnd) offset = src.loopStart + ((offset - src.loopStart) % (src.loopEnd - src.loopStart));
  const fi = opts.fadeIn ?? 0.04;
  const tv = Math.max(0.0001, (meta.vol ?? 100) / 100); // 곡별 음량
  g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(tv, when + Math.max(0.02, fi));
  src.start(when, offset);
  P.cur = { id: meta.id, meta, src, g, startT: when, offset, rate: 1 };
}
export function stop(fade = 1.2, keepReq) { if (!keepReq) P.req = null; const c = P.cur; P.cur = null; P.paused = null; P.held = false; if (c) fadeStop(c.src, c.g, fade); }
// 일시정지 → 이어서 재생
export function pause() { const c = P.cur; if (!c) return; P.paused = { meta: c.meta, pos: posOf(c) }; P.cur = null; P.req = null; fadeStop(c.src, c.g, 0.2); }
export function resume() { const p = P.paused; if (!p) return false; P.paused = null; play(p.meta, { offset: p.pos, fadeIn: 0.35, restart: true }); return true; }
// 얼음! 같은 순간: 테이프 멈추듯 뚝 → 다시 이어서
export function hold(on) {
  const a = ctx(); if (!a) return;
  if (on && P.cur && !P.held) {
    const c = P.cur; const t = a.currentTime; const pos = posOf(c);
    try { c.src.playbackRate.setValueAtTime(1, t); c.src.playbackRate.linearRampToValueAtTime(0.35, t + 0.35); } catch { /* */ }
    fadeStop(c.src, c.g, 0.38); P.cur = null; P.paused = { meta: c.meta, pos: pos + 0.25 }; P.held = true;
  } else if (!on && P.held) { P.held = false; const p = P.paused; P.paused = null; if (p) play(p.meta, { offset: p.pos, fadeIn: 0.08, restart: true }); }
}
export function setVolume(v) { P.vol = Math.max(0, Math.min(1, v)); const n = nodes(); if (n) n.vol.gain.setTargetAtTime(P.vol, n.a.currentTime, 0.08); }
// 선생님 말씀 중: 배경음악 즉시 줄이기
export function duck(on) { P.ducked = !!on; applyDuck(); }
// 음성 안내가 나올 때 잠깐 줄였다가 다시
export function voice(sec) { P.voiceUntil = Math.max(P.voiceUntil, performance.now() + sec * 1000); applyDuck(); clearTimeout(P.vt); P.vt = setTimeout(applyDuck, sec * 1000 + 30); }
function applyDuck() { const n = nodes(); if (!n) return; const v = P.ducked ? 0.15 : performance.now() < P.voiceUntil ? 0.45 : 1; n.duck.gain.setTargetAtTime(v, n.a.currentTime, P.ducked ? 0.06 : 0.12); }

// 승리 빵빠레: 배경음악을 내리고 빵빠레 → sec초 뒤 자연스럽게 사라짐. onHit: 첫 타격 순간(트로피 연출 맞춤)
export async function fanfare(sec = 12, onHit, win) {
  const n = nodes(); if (!n) { onHit?.(); return; }
  stop(0.35); stopFanfare(0.15);
  const wid = win?.id || 'fanfare';
  let buf; try { buf = await load(wid); } catch { try { buf = await load('fanfare'); win = null; } catch { onHit?.(); return; } } // 고른 승리곡이 없으면 기본 빵빠레
  const hit = win ? win.hit ?? 0 : FANFARE.hit; const tv = Math.max(0.0001, (win?.vol ?? 100) / 100);
  const a = n.a; const src = a.createBufferSource(); src.buffer = buf; const g = a.createGain(); src.connect(g).connect(n.vol);
  const t0 = a.currentTime + 0.06; const end = t0 + Math.min(sec, buf.duration); const fo = Math.min(2, sec * 0.25);
  g.gain.setValueAtTime(tv, t0); g.gain.setValueAtTime(tv, end - fo); g.gain.exponentialRampToValueAtTime(0.0001, end); src.start(t0, wid === 'fanfare' ? 0 : win?.cue || 0); src.stop(end + 0.05);
  const me = { src, g, end }; P.fan = me; src.onended = () => { if (P.fan === me) P.fan = null; };
  if (onHit) setTimeout(onHit, (t0 - a.currentTime + hit) * 1000);
}
export function stopFanfare(fade = 0.8) { const f = P.fan; P.fan = null; if (f) fadeStop(f.src, f.g, fade); }

// 화면 연출용: 지금 음악 크기 0~1 (박자에 맞춰 번쩍)
export function level() {
  const n = P.nodes; if (!n || (!P.cur && !P.fan)) return 0;
  n.an.getByteTimeDomainData(n.buf); let s = 0; for (let i = 0; i < n.buf.length; i += 2) { const v = (n.buf[i] - 128) / 128; s += v * v; }
  return Math.min(1, Math.sqrt(s / (n.buf.length / 2)) * 2.6);
}
export function status() {
  const c = P.cur; return { track: c?.id || null, playing: !!c, pos: c ? +posOf(c).toFixed(2) : null, paused: P.paused ? { id: P.paused.meta.id, pos: +P.paused.pos.toFixed(2) } : null, held: P.held, fanfare: !!P.fan, vol: P.vol, ducked: P.ducked, err: P.err || null, startT: c?.startT ?? null, now: ctx()?.currentTime ?? null };
}
if (typeof window !== 'undefined') window.__bgm = { status, level };
export async function customURL(id) { const b = await customBlob(id); return b ? URL.createObjectURL(b) : null; }

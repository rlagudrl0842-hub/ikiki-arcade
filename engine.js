// 행사 진행 엔진: 상태머신, 참가자, 점수·순위, 저장·복구
import crypto from 'node:crypto';
import { GAMES } from './games.js';
import { AGE_LABEL, AGES6, BASE3, LV6 } from './common.js';

export const TEAM_COLORS = ['#ff4d6d', '#3d8bff', '#ffd43b', '#2fd27a', '#b06bff', '#ff922b', '#22d3ee', '#f472b6',
  '#a3e635', '#94a3b8', '#fb7185', '#60a5fa', '#facc15', '#34d399', '#c084fc', '#fdba74'];
export const TEAM_ICONS = ['🐯', '🐬', '🐥', '🐸', '🦄', '🦊', '🐳', '🐷', '🐢', '🐺', '🦁', '🐧', '🐝', '🐲', '🦋', '🐻'];
// 참가자가 고를 수 있는 팀 아이콘
export const RENAME_ICONS = [...TEAM_ICONS, '⚡', '🔥', '⭐', '🚀', '⚽', '🏀', '🌈', '👑', '💎', '🍀', '🌊', '🍓', '🦖', '🤖', '👻', '🎯'];
const DEFAULT_NAMES = ['호랑이', '돌고래', '병아리', '개구리', '유니콘', '여우', '고래', '꿀꿀이', '거북이', '늑대', '사자', '펭귄', '꿀벌', '용', '나비', '곰'];

export const DEFAULT_SETTINGS = {
  mode: 'elem',           // kid | elem | adult | mixed
  elemLevel: 'low',       // 초등 저학년 low / 고학년 high
  teamCount: 4,
  scoring: 'avg',         // avg | sum | rep | top
  topN: 5,
  auto: true,             // 자동 진행
  introSec: 10,
  resultSec: 12,
  voice: true,
  sfx: true,
  teamAssign: 'choose',   // choose | auto
  joinUrl: '',
  rouletteCapPct: 10,     // 운 보너스 상한 (총점 대비 %)
  teamRename: 'rep',      // 참가자 팀 이름 바꾸기: off 끄기 | rep 팀 대표만 | all 팀원 누구나
  motion: 'auto',         // 몸 동작 모드: auto (초등 이상 켜짐, 영아·유아 터치) | on | off
  bgm: {},                // 게임별 배경음악 { 게임id: 'auto' | 'none' | 곡id } (없으면 추천곡)
  bgmVol: 70,             // 배경음악 음량 0~100
  sfxVol: 80,             // 효과음 음량 0~100
  fanfareSec: 12,         // 승리 빵빠레 길이(초)
  duck: false,            // 선생님 말씀 중: 배경음악 잠깐 줄이기
  league: '',             // 반별 리그 이름 (같은 이름 행사끼리 팀 점수 누적)
  playlist: [],           // [{game, dur, weight}]
};

const PHASES = ['lobby', 'intro', 'countdown', 'playing', 'results', 'ceremony', 'ended'];
const COUNTDOWN_MS = 3000;
const id = (n = 8) => crypto.randomBytes(n).toString('base64url');
const code6 = () => Array.from(crypto.randomBytes(6), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

export class Event {
  constructor(hub, row) {
    this.hub = hub; this.db = hub.db;
    this.id = row.id; this.code = row.code; this.name = row.name;
    this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(row.settings) };
    // 없어진 게임은 순서에서 빼기 (예전 행사 호환)
    this.settings.playlist = (this.settings.playlist || []).filter((p) => p && GAMES[p.game]);
    if (!this.settings.playlist.length) this.settings.playlist = defaultPlaylist(this.settings.mode);
    this.teams = [];
    this.players = new Map();       // id -> player
    this.conns = new Map();          // player id -> Set(ws)
    this.state = { phase: 'lobby', seq: 0, idx: 0, runId: null, paused: null, ceremonyStep: 0, notice: '' };
    this.cheer = new Map();          // team -> count (응원)
    this.cheerEvent = null;          // {endAt, bonus}
    this.game = null;                // 진행 중인 게임 인스턴스
    this.timer = null;
    this.lastResult = null;
    this.prevRanks = null;
    this.load(row);
  }

  // ---------- 저장·복구 ----------
  load(row) {
    this.teams = this.db.all('SELECT * FROM teams WHERE event_id=? ORDER BY id', this.id).map((t) => ({ id: t.id, name: t.name, color: t.color, icon: t.icon }));
    for (const p of this.db.all('SELECT * FROM players WHERE event_id=?', this.id)) {
      this.players.set(p.id, { id: p.id, team: p.team_id, name: p.name, age: p.age, secret: p.secret, device: p.device, rep: !!p.rep, excluded: !!p.excluded, joinedAt: p.joined_at, online: false });
    }
    if (row.state) {
      const s = JSON.parse(row.state);
      this.state = { ...this.state, ...s };
      if (this.state.idx > this.settings.playlist.length) this.state.idx = this.settings.playlist.length;
      // 서버 재시작: 진행 중이던 게임은 '중단'으로 표시하고 대기 화면으로
      if (['intro', 'countdown', 'playing'].includes(s.phase)) {
        if (s.runId) this.db.run("UPDATE runs SET status='interrupted', ended_at=? WHERE id=? AND status='running'", Date.now(), s.runId);
        this.state.phase = 'lobby'; this.state.paused = null; this.state.runId = null;
        this.state.notice = '서버가 다시 시작되어 진행 중이던 게임이 중단되었습니다. 같은 게임을 다시 시작할 수 있어요.';
      }
      if (s.phase === 'results') this.state.phase = 'lobby';
    }
    this.lastResult = this.loadLastResult();
  }
  save() {
    if (this.hub.closed) return;
    const st = { phase: this.state.phase, seq: this.state.seq, idx: this.state.idx, runId: this.state.runId, ceremonyStep: this.state.ceremonyStep, notice: this.state.notice };
    this.db.run('UPDATE events SET state=?, settings=?, name=?, updated_at=? WHERE id=?', JSON.stringify(st), JSON.stringify(this.settings), this.name, Date.now(), this.id);
  }
  audit(action, detail) { this.db.run('INSERT INTO audit(event_id,action,detail,at) VALUES(?,?,?,?)', this.id, action, detail ? JSON.stringify(detail) : null, Date.now()); }

  static create(hub, { name, settings }) {
    const s = { ...DEFAULT_SETTINGS, ...sanitizeSettings(settings || {}) };
    if (!s.playlist.length) s.playlist = defaultPlaylist(s.mode);
    const eid = id(9); let code;
    do { code = code6(); } while (hub.db.get('SELECT 1 FROM events WHERE code=?', code));
    const now = Date.now();
    hub.db.tx(() => {
      hub.db.run('INSERT INTO events(id,code,name,settings,created_at,updated_at) VALUES(?,?,?,?,?,?)', eid, code, String(name || '아이키키 오락실').slice(0, 40), JSON.stringify(s), now, now);
      for (let i = 0; i < s.teamCount; i++) hub.db.run('INSERT INTO teams(event_id,id,name,color,icon) VALUES(?,?,?,?,?)', eid, i + 1, DEFAULT_NAMES[i] + '팀', TEAM_COLORS[i], TEAM_ICONS[i]);
    });
    return eid;
  }

  // ---------- 공개 상태 ----------
  get phase() { return this.state.phase; }
  ageOf(p) { return this.settings.mode === 'mixed' ? p.age : this.settings.mode; }
  activePlayers() { return [...this.players.values()].filter((p) => !p.excluded && p.team); }
  teamCounts() {
    const c = Object.fromEntries(this.teams.map((t) => [t.id, { total: 0, online: 0 }]));
    for (const p of this.activePlayers()) if (c[p.team]) { c[p.team].total++; if (p.online) c[p.team].online++; }
    return c;
  }
  currentItem() { return this.settings.playlist[this.state.idx] || null; }

  standings() {
    const rows = this.teams.map((t) => ({ id: t.id, games: 0, bonus: 0, wins: 0, metricSum: 0 }));
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    for (const r of this.db.all("SELECT tr.team_id, tr.points, tr.rank, tr.metric FROM team_results tr JOIN runs r ON r.id=tr.run_id WHERE r.event_id=? AND r.status='done'", this.id)) {
      const b = by[r.team_id]; if (!b) continue; b.games += r.points; b.metricSum += r.metric; if (r.rank === 1) b.wins++;
    }
    for (const a of this.db.all('SELECT team_id, delta FROM adjustments WHERE event_id=?', this.id)) if (by[a.team_id]) by[a.team_id].bonus += a.delta;
    for (const r of rows) { r.games = Math.round(r.games * 10) / 10; r.bonus = Math.round(r.bonus * 10) / 10; r.total = Math.round((r.games + r.bonus) * 10) / 10; }
    rows.sort((a, b) => b.total - a.total || b.wins - a.wins || b.metricSum - a.metricSum);
    rows.forEach((r, i) => { const p = rows[i - 1]; r.rank = p && p.total === r.total && p.wins === r.wins && p.metricSum === r.metricSum ? p.rank : i + 1; });
    return { rows, played: this.db.get("SELECT COUNT(*) c FROM runs WHERE event_id=? AND status='done'", this.id).c };
  }

  // opts.full: 사회자 API 응답에만 개인 결과 전체 포함 (모두에게 보내는 상태에는 빼서 300명일 때 메시지 크기 ↓)
  publicState(opts = {}) {
    const item = this.currentItem();
    const g = this.game;
    return {
      t: 'state', now: Date.now(),
      event: { id: this.id, code: this.code, name: this.name },
      settings: { mode: this.settings.mode, elemLevel: this.settings.elemLevel, auto: this.settings.auto, voice: this.settings.voice, sfx: this.settings.sfx, teamAssign: this.settings.teamAssign, scoring: this.settings.scoring, topN: this.settings.topN, joinUrl: this.settings.joinUrl, teamRename: this.settings.teamRename, motion: this.settings.motion || 'auto', league: this.settings.league || '', bgm: this.settings.bgm || {}, bgmVol: this.settings.bgmVol ?? 70, sfxVol: this.settings.sfxVol ?? 80, fanfareSec: this.settings.fanfareSec ?? 12, duck: !!this.settings.duck, cheer: true, rouletteCapPct: this.settings.rouletteCapPct },
      phase: this.state.phase, seq: this.state.seq, paused: this.state.paused, notice: this.state.notice,
      idx: this.state.idx, total: this.settings.playlist.length,
      playlist: this.settings.playlist.map((p) => ({ game: p.game, weight: p.weight, dur: p.dur })),
      item: item ? { ...item, ...gameInfo(item.game, this) } : null,
      run: g ? { id: g.runId, game: g.def.id, startAt: g.startAt, endAt: g.endAt, phaseAt: this.phaseAt } : null,
      phaseAt: this.phaseAt, phaseEnd: this.phaseEnd,
      teams: this.teams, counts: this.teamCounts(),
      standings: this.standings(), prevRanks: this.prevRanks,
      cheer: Object.fromEntries(this.cheer), cheerEvent: this.cheerEvent,
      lastResult: this.lastResult && !opts.full ? { ...this.lastResult, players: undefined, nPlayers: Object.keys(this.lastResult.players || {}).length } : this.lastResult, ceremonyStep: this.state.ceremonyStep,
      teamMvp: ['ceremony', 'ended'].includes(this.state.phase) ? this.teamMvp() : null,
    };
  }

  // ---------- 브로드캐스트 ----------
  broadcastState() { if (this.hub.closed) return; this.hub.broadcast(this.id, this.publicState()); }
  sendPlayer(pid, msg) { const s = this.conns.get(pid); if (!s) return; const str = JSON.stringify({ ...msg, pid }); for (const ws of s) this.hub.send(ws, str); }

  // ---------- 참가 ----------
  join({ name, team, age, device }) {
    name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 12);
    if (!name) throw new Err('이름을 입력해 주세요');
    if (!AGES6.includes(age)) age = this.settings.mode === 'mixed' ? 'elem' : this.settings.mode;
    if (this.state.phase === 'ended') throw new Err('행사가 끝났어요');
    if (this.activePlayers().length >= 400) throw new Err('참가 인원이 가득 찼어요');
    let teamId = Number(team) || 0;
    if (this.settings.teamAssign === 'auto' || !this.teams.some((t) => t.id === teamId)) teamId = this.smallestTeam();
    // 같은 기기에서 같은 이름으로 다시 들어오면 기존 참가자 복구 (중복 참가 방지)
    for (const p of this.players.values()) {
      if (p.device && device && p.device === device && p.name === name) return p;
    }
    let shown = name; let n = 2;
    const names = new Set([...this.players.values()].filter((p) => p.team === teamId).map((p) => p.name));
    while (names.has(shown)) shown = `${name}${n++}`;
    const p = { id: id(9), team: teamId, name: shown, age, secret: id(16), device: device ? String(device).slice(0, 40) : null, rep: false, excluded: false, joinedAt: Date.now(), online: false };
    if (!this.activePlayers().some((x) => x.team === teamId && x.rep)) p.rep = true;
    this.db.run('INSERT INTO players(id,event_id,team_id,name,age,secret,device,rep,excluded,joined_at) VALUES(?,?,?,?,?,?,?,?,0,?)', p.id, this.id, p.team, p.name, p.age, p.secret, p.device, p.rep ? 1 : 0, p.joinedAt);
    this.players.set(p.id, p);
    if (this.game && this.state.phase === 'playing') this.game.addPlayer?.(this.ctxPlayer(p));
    this.broadcastSoon();
    return p;
  }
  smallestTeam() {
    const c = this.teamCounts();
    return this.teams.slice().sort((a, b) => c[a.id].total - c[b.id].total || a.id - b.id)[0].id;
  }
  ctxPlayer(p) { const a = AGES6.includes(this.ageOf(p)) ? this.ageOf(p) : 'elem'; return { id: p.id, team: p.team, age: BASE3[a], age6: a, lv: LV6[a], name: p.name, rep: p.rep }; }

  playerView(p) {
    const base = { t: 'me', me: { id: p.id, name: p.name, team: p.team, age: p.age, rep: p.rep, excluded: p.excluded } };
    if (this.game && ['countdown', 'playing'].includes(this.state.phase) && !p.excluded) { base.game = this.game.view(p.id, Date.now()); base.run = this.game.runId; }
    if (this.state.phase === 'results' && this.lastResult) base.my = this.lastResult.players?.[p.id] ?? null;
    return base;
  }

  // ---------- 진행 ----------
  bump(phase, durMs) {
    this.state.phase = phase; this.state.seq++;
    this.phaseAt = Date.now(); this.phaseEnd = durMs ? this.phaseAt + durMs : null;
    if (phase !== 'lobby') this.state.notice = '';
    this.save();
  }
  clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  schedule(ms, fn) { this.clearTimer(); this.timer = setTimeout(() => { this.timer = null; if (this.hub.closed) return; try { fn(); } catch (e) { console.error(e); } }, ms); }

  // 관리자 명령 (seq가 다르면 다른 기기에서 이미 조작한 것 → 거부)
  command(op, arg = {}, seq) {
    if (seq != null && seq !== this.state.seq && !['settings', 'paramsOnly', 'hostPt'].includes(op)) throw new Err('다른 화면에서 이미 진행되었어요. 화면이 새로 고쳐졌습니다.', 409);
    switch (op) {
      case 'intro': return this.toIntro(arg.idx);
      case 'start': return this.startCountdown();
      case 'endNow': return this.finishGame('admin');
      case 'pause': return this.pause();
      case 'resume': return this.resume();
      case 'skip': return this.skip();
      case 'replay': return this.replay();
      case 'abort': return this.abortGame();
      case 'next': return this.next();
      case 'ceremony': return this.startCeremony();
      case 'ceremonyNext': return this.ceremonyNext();
      case 'end': return this.endEvent();
      case 'reopen': return this.reopen();
      case 'cheerEvent': return this.startCheerEvent(arg);
      case 'hostPt': { if (!this.game?.hostPt || this.state.phase !== 'playing') throw new Err('지금은 점수를 줄 수 없어요'); this.game.hostPt(Number(arg.team), Number(arg.d)); this.audit('hostPt', { team: Number(arg.team), d: Number(arg.d) }); return; }
      default: throw new Err('알 수 없는 명령');
    }
  }

  next() {
    const ph = this.state.phase;
    if (ph === 'lobby') return this.toIntro();
    if (ph === 'intro') return this.startCountdown();
    if (ph === 'playing') return this.finishGame('admin');
    if (ph === 'results') return this.afterResults(true);
    if (ph === 'ceremony') return this.ceremonyNext();
  }

  toIntro(idx) {
    if (!['lobby', 'results'].includes(this.state.phase)) throw new Err('지금은 게임을 고를 수 없어요');
    if (idx != null) { if (!(idx >= 0 && idx < this.settings.playlist.length)) throw new Err('게임 번호 오류'); this.state.idx = idx; }
    const item = this.currentItem();
    if (!item) throw new Err('남은 게임이 없어요. 시상식을 진행하세요');
    if (!this.activePlayers().length && !GAMES[item.game]?.hostScore) throw new Err('참가자가 아직 없어요');
    this.lastResult = null;
    this.bump('intro', this.settings.auto ? this.settings.introSec * 1000 : 0);
    this.audit('intro', { idx: this.state.idx, game: item.game });
    if (this.settings.auto) this.schedule(this.settings.introSec * 1000, () => this.startCountdown());
    this.broadcastState();
  }

  startCountdown() {
    if (this.state.phase !== 'intro') throw new Err('게임 설명 화면에서 시작할 수 있어요');
    const item = this.currentItem();
    const def = GAMES[item.game];
    const now = Date.now();
    const runId = Number(this.db.run("INSERT INTO runs(event_id,seq,game,label,weight,status,config,started_at) VALUES(?,?,?,?,?,'running',?,?)",
      this.id, this.state.idx + 1, def.id, def.name, item.weight ?? 1, JSON.stringify(item), now).lastInsertRowid);
    this.state.runId = runId;
    const players = this.activePlayers().map((p) => this.ctxPlayer(p));
    const durMs = this.durOf(item, def);
    const startAt = now + COUNTDOWN_MS;
    const ctx = {
      runId, def, players, teams: this.teams.map((t) => t.id), teamInfo: this.teams, settings: { ...this.settings, mode: this.settings.mode === 'mixed' ? 'mixed' : BASE3[this.settings.mode] || 'elem', mode6: this.settings.mode, lv: this.modeLv() }, item,
      seed: crypto.randomInt(1, 2 ** 31), startAt, durMs, now: () => Date.now(),
      sendTo: (pid, m) => this.sendPlayer(pid, { t: 'g', ...m }),
      endEarly: () => setImmediate(() => { if (this.game === inst && this.state.phase === 'playing') this.finishGame('auto'); }),
      dirty: (pid) => this.dirtyPlayers.add(pid),
      dirtyAll: () => { this.dirtyAllFlag = true; },
      events: this,
    };
    const inst = def.create(ctx);
    inst.def = def; inst.runId = runId; inst.startAt = startAt; inst.endAt = def.untimed ? null : startAt + durMs;
    this.game = inst;
    this.dirtyPlayers = new Set(); this.dirtyAllFlag = true;
    this.bump('countdown', COUNTDOWN_MS);
    this.audit('start', { runId, game: def.id });
    this.schedule(COUNTDOWN_MS, () => this.beginPlay());
    this.broadcastState();
    this.flushViews(true);
  }
  dominantAge() { return this.settings.mode === 'mixed' ? 'elem' : BASE3[this.settings.mode] || 'elem'; }
  modeLv() { return this.settings.mode === 'mixed' ? 2 : LV6[this.settings.mode] ?? 2; }

  beginPlay() {
    if (this.state.phase !== 'countdown' || !this.game) return;
    const g = this.game; const now = Date.now();
    g.startAt = now; if (g.endAt) g.endAt = now + (this.ctxDur(g));
    g.start?.(now);
    this.bump('playing');
    if (g.endAt) this.schedule(g.endAt - now, () => this.finishGame('time'));
    else this.schedule(10 * 60 * 1000, () => this.finishGame('safety')); // 라운드형 게임 안전장치
    this.broadcastState();
    this.flushViews(true);
    this.startTicker();
  }
  durOf(item, def) { const age = this.dominantAge(); return Math.round(Math.max(item.dur || def.durFor(age), def.minDur?.[age] || 0) * 1000); }
  ctxDur(g) { return this.durOf(this.currentItem(), g.def); }

  startTicker() {
    this.stopTicker();
    let n = 0;
    this.ticker = setInterval(() => {
      if (!this.game || this.state.phase !== 'playing' || this.state.paused) return;
      const now = Date.now();
      try { this.game.tick?.(now); } catch (e) { console.error('tick', e); }
      this.flushViews(false);
      if (++n % 2 === 0) this.hub.broadcastScreen(this.id, { t: 'live', now, run: this.game.runId, s: this.game.screen(now), cheer: Object.fromEntries(this.cheer) });
    }, 100);
  }
  stopTicker() { if (this.ticker) clearInterval(this.ticker); this.ticker = null; }

  flushViews(all) {
    if (!this.game) return;
    const now = Date.now();
    const targets = all || this.dirtyAllFlag ? [...this.conns.keys()] : [...this.dirtyPlayers];
    this.dirtyPlayers.clear(); this.dirtyAllFlag = false;
    for (const pid of targets) {
      const p = this.players.get(pid);
      if (!p || p.excluded || !this.conns.has(pid)) continue;
      this.sendPlayer(pid, { t: 'g', run: this.game.runId, v: this.game.view(pid, now) });
    }
  }

  input(p, msg) {
    if (!this.game || p.excluded || this.state.paused) return;
    const ph = this.state.phase;
    if (ph !== 'playing' && !(ph === 'countdown' && this.game.def.inputDuringCountdown)) return;
    if (msg.run !== this.game.runId) return; // 지난 게임 입력 무시
    const reply = this.game.input(p.id, msg, Date.now());
    if (reply) this.sendPlayer(p.id, { t: 'g', run: this.game.runId, r: reply });
    this.dirtyPlayers.add(p.id);
  }

  finishGame(reason) {
    if (!this.game || !['playing', 'countdown'].includes(this.state.phase)) throw new Err('진행 중인 게임이 없어요');
    this.clearTimer(); this.stopTicker();
    const g = this.game; const now = Date.now();
    if (this.state.paused) { this.state.paused = null; }
    let res;
    try { res = g.finish(now); } catch (e) { console.error('finish', e); res = { players: {} }; }
    const item = this.currentItem() || { weight: 1 };
    const out = res.noPoints ? { teams: [], mvp: null, aces: {} } : this.scoreRun(g, res, item.weight ?? 1);
    this.prevRanks = Object.fromEntries(this.standings().rows.map((r) => [r.id, r.rank]));
    this.db.tx(() => {
      for (const [pid, s] of Object.entries(res.players || {})) {
        this.db.run('INSERT OR REPLACE INTO player_scores(run_id,player_id,raw,norm,detail) VALUES(?,?,?,?,?)', g.runId, pid, s.raw, s.norm, s.detail ? JSON.stringify(s.detail) : null);
      }
      for (const t of out.teams) this.db.run('INSERT OR REPLACE INTO team_results(run_id,team_id,metric,rank,points,detail) VALUES(?,?,?,?,?,?)', g.runId, t.id, t.metric, t.rank, t.points, JSON.stringify({ n: t.n, label: t.label }));
      this.db.run("UPDATE runs SET status='done', ended_at=? WHERE id=?", now, g.runId);
      for (const b of res.bonus || []) this.db.run('INSERT INTO adjustments(event_id,team_id,delta,kind,reason,at) VALUES(?,?,?,?,?,?)', this.id, b.team, b.delta, 'luck', b.reason, now);
    });
    this.lastResult = { runId: g.runId, game: g.def.id, label: g.def.name, teams: out.teams, players: compactPlayers(res.players), mvp: out.mvp, aces: out.aces, extra: res.extra || null, bonus: res.bonus || null, reason };
    this.game = null;
    this.state.runId = null;
    this.state.idx = Math.min(this.state.idx + 1, this.settings.playlist.length);
    this.bump('results', this.settings.auto ? this.settings.resultSec * 1000 : 0);
    this.audit('finish', { runId: g.runId, reason });
    if (this.settings.auto) this.schedule(this.settings.resultSec * 1000, () => this.afterResults(false));
    this.broadcastState();
    for (const pid of this.conns.keys()) { const p = this.players.get(pid); if (p) this.sendPlayer(pid, this.playerView(p)); }
  }

  // 팀 점수 계산
  scoreRun(g, res, weight) {
    const mode = this.settings.scoring;
    const teamIds = this.teams.map((t) => t.id);
    const byTeam = Object.fromEntries(teamIds.map((t) => [t, []]));
    for (const [pid, s] of Object.entries(res.players || {})) {
      const p = this.players.get(pid); if (!p || p.excluded || !byTeam[p.team]) continue;
      byTeam[p.team].push({ p, norm: s.norm });
    }
    const teams = teamIds.map((tid) => {
      const arr = byTeam[tid].sort((a, b) => b.norm - a.norm);
      let metric = 0; let label = '';
      if (res.teams && res.teams[tid] != null) { metric = res.teams[tid]; label = res.teamLabel?.[tid] ?? ''; }
      else if (arr.length) {
        const sum = arr.reduce((s, x) => s + x.norm, 0);
        if (mode === 'sum') metric = sum;
        else if (mode === 'top') { const k = Math.min(this.settings.topN, arr.length); metric = arr.slice(0, k).reduce((s, x) => s + x.norm, 0) / k; }
        else if (mode === 'rep') { const rep = arr.find((x) => x.p.rep); metric = rep ? rep.norm : sum / arr.length; }
        else metric = sum / arr.length;
      }
      return { id: tid, metric: Math.round(metric * 10) / 10, n: arr.length, label };
    });
    const nT = teams.length;
    const sorted = teams.slice().sort((a, b) => b.metric - a.metric);
    sorted.forEach((t, i) => { const prev = sorted[i - 1]; t.rank = prev && prev.metric === t.metric ? prev.rank : i + 1; });
    // 참여자가 없는 팀은 꼴찌 처리 (0점)
    for (const t of teams) {
      const hasTeamMetric = res.teams && res.teams[t.id] != null;
      t.points = (t.n === 0 && !hasTeamMetric) ? 0 : Math.round(weight * 10 * (nT - t.rank + 1) * 10) / 10;
    }
    let mvp = null; const aces = {};
    for (const [pid, s] of Object.entries(res.players || {})) {
      const p = this.players.get(pid); if (!p || p.excluded) continue;
      if (!mvp || s.norm > mvp.norm || (s.norm === mvp.norm && s.raw > mvp.raw)) mvp = { id: pid, name: p.name, team: p.team, norm: s.norm, raw: s.raw, show: s.show ?? null };
      // 팀별 에이스: 이 게임에서 팀 안 최고 기록
      const a = aces[p.team];
      if (!a || s.norm > a.norm || (s.norm === a.norm && s.raw > a.raw)) aces[p.team] = { id: pid, name: p.name, norm: s.norm, raw: s.raw, show: s.show ?? null };
    }
    if (g?.def?.hostScore) mvp = null; // 진행자 판정 게임은 개인 MVP 없음
    return { teams: sorted, mvp, aces };
  }

  afterResults(manual) {
    if (this.state.phase !== 'results') return;
    this.clearTimer();
    if (this.state.idx >= this.settings.playlist.length) {
      this.bump('lobby'); this.state.notice = '모든 게임이 끝났어요. 시상식을 시작하세요!'; this.save(); this.broadcastState();
      if (this.settings.auto && !manual) this.schedule(4000, () => { if (this.state.phase === 'lobby') this.startCeremony(); });
      return;
    }
    if (this.settings.auto) return this.toIntro();
    this.bump('lobby'); this.broadcastState();
  }

  pause() {
    if (!['playing', 'countdown', 'intro', 'results'].includes(this.state.phase) || this.state.paused) throw new Err('일시정지할 수 없어요');
    const now = Date.now();
    this.state.paused = { at: now, remain: this.timer ? Math.max(0, (this.state.phase === 'playing' && this.game?.endAt ? this.game.endAt : this.phaseEnd || now) - now) : null };
    this.clearTimer();
    this.state.seq++; this.save(); this.audit('pause'); this.broadcastState();
  }
  resume() {
    const p = this.state.paused; if (!p) throw new Err('일시정지 상태가 아니에요');
    const shift = Date.now() - p.at;
    this.state.paused = null;
    if (this.phaseEnd) this.phaseEnd += shift;
    const ph = this.state.phase;
    if (this.game) { if (this.game.endAt) this.game.endAt += shift; this.game.startAt += shift; this.game.shift?.(shift); }
    if (ph === 'playing' && this.game?.endAt) this.schedule(this.game.endAt - Date.now(), () => this.finishGame('time'));
    else if (ph === 'playing') this.schedule(10 * 60 * 1000, () => this.finishGame('safety'));
    else if (ph === 'countdown') this.schedule(p.remain ?? 1000, () => this.beginPlay());
    else if (ph === 'intro' && this.settings.auto) this.schedule(p.remain ?? 3000, () => this.startCountdown());
    else if (ph === 'results' && this.settings.auto) this.schedule(p.remain ?? 3000, () => this.afterResults(false));
    this.state.seq++; this.save(); this.audit('resume'); this.broadcastState(); this.flushViews(true);
  }
  skip() {
    if (['playing', 'countdown'].includes(this.state.phase)) this.abortGame();
    if (!['lobby', 'intro', 'results'].includes(this.state.phase)) throw new Err('건너뛸 수 없어요');
    this.clearTimer();
    this.state.idx = Math.min(this.state.idx + 1, this.settings.playlist.length);
    this.audit('skip', { idx: this.state.idx });
    this.bump('lobby'); this.broadcastState();
  }
  abortGame() {
    // 긴급 정지: 점수 반영 없이 중단
    this.clearTimer(); this.stopTicker();
    if (this.game) { this.db.run("UPDATE runs SET status='aborted', ended_at=? WHERE id=?", Date.now(), this.game.runId); this.audit('abort', { runId: this.game.runId }); }
    this.game = null; this.state.runId = null; this.state.paused = null;
    this.bump('lobby'); this.state.notice = '게임을 중단했어요 (점수 반영 안 됨).'; this.save();
    this.broadcastState();
  }
  replay() {
    // 방금 끝난(또는 중단된) 게임을 다시: 이전 결과는 취소
    if (['playing', 'countdown'].includes(this.state.phase)) { this.abortGame(); return this.toIntro(); }
    if (!['lobby', 'results'].includes(this.state.phase)) throw new Err('지금은 재경기할 수 없어요');
    this.clearTimer();
    const last = this.db.get("SELECT id, seq, status FROM runs WHERE event_id=? ORDER BY id DESC LIMIT 1", this.id);
    if (!last) throw new Err('재경기할 게임이 없어요');
    if (last.status === 'done') {
      this.db.run("UPDATE runs SET status='replaced' WHERE id=?", last.id);
      this.db.run("DELETE FROM adjustments WHERE event_id=? AND kind='luck' AND reason LIKE ?", this.id, `%#${last.id}%`);
    }
    this.state.idx = last.seq - 1; this.lastResult = null;
    this.audit('replay', { runId: last.id });
    this.bump('lobby'); return this.toIntro();
  }
  startCeremony() {
    if (['playing', 'countdown'].includes(this.state.phase)) throw new Err('게임을 먼저 끝내 주세요');
    this.clearTimer();
    this.state.ceremonyStep = 0;
    this.bump('ceremony'); this.audit('ceremony');
    if (this.settings.auto) this.autoCeremony();
    this.broadcastState();
  }
  autoCeremony() { this.schedule(this.state.ceremonyStep === 0 ? 5000 : 6000, () => { if (this.state.phase === 'ceremony' && this.state.ceremonyStep < 5) { this.ceremonyNext(); this.autoCeremony(); } }); }
  ceremonyNext() {
    if (this.state.phase !== 'ceremony') throw new Err('시상식 중이 아니에요');
    if (this.state.ceremonyStep >= 5) return this.endEvent();
    this.state.ceremonyStep++; this.state.seq++; this.save(); this.broadcastState();
  }
  endEvent() {
    this.clearTimer(); this.stopTicker();
    if (this.game) this.abortGame();
    this.bump('ended');
    this.db.run('UPDATE events SET ended_at=? WHERE id=?', Date.now(), this.id);
    this.audit('end'); this.broadcastState();
  }
  reopen() {
    if (!['ended', 'ceremony'].includes(this.state.phase)) throw new Err('행사가 진행 중이에요');
    this.clearTimer();
    this.db.run('UPDATE events SET ended_at=NULL WHERE id=?', this.id);
    this.bump('lobby'); this.audit('reopen'); this.broadcastState();
  }

  // 응원 (기본: 점수 영향 없음. 관리자가 응원 이벤트를 열면 1등 팀에 보너스)
  cheerTap(p, n) {
    const k = Math.max(0, Math.min(5, n | 0));
    if (!k || !p.team) return;
    this.cheer.set(p.team, (this.cheer.get(p.team) || 0) + k);
    if (this.cheerEvent) this.cheerEvent.counts[p.team] = (this.cheerEvent.counts[p.team] || 0) + k;
    this.broadcastSoon();
  }
  startCheerEvent({ sec = 20, bonus = 10 }) {
    if (this.cheerEvent) throw new Err('응원 이벤트가 이미 진행 중이에요');
    sec = Math.max(5, Math.min(60, sec | 0)); bonus = Math.max(1, Math.min(50, bonus | 0));
    this.cheerEvent = { endAt: Date.now() + sec * 1000, bonus, counts: {} };
    this.audit('cheerEvent', { sec, bonus });
    this.broadcastState();
    setTimeout(() => this.endCheerEvent(), sec * 1000);
  }
  endCheerEvent() {
    const ce = this.cheerEvent; if (!ce || this.hub.closed) return;
    // 팀 인원으로 나눈 1인당 응원 수로 공정하게 비교
    const c = this.teamCounts();
    const per = this.teams.map((t) => ({ id: t.id, v: (ce.counts[t.id] || 0) / Math.max(1, c[t.id].total) }));
    per.sort((a, b) => b.v - a.v);
    if (per[0] && per[0].v > 0) {
      const winners = per.filter((x) => x.v === per[0].v);
      for (const w of winners) this.db.run('INSERT INTO adjustments(event_id,team_id,delta,kind,reason,at) VALUES(?,?,?,?,?,?)', this.id, w.id, ce.bonus, 'cheer', '응원 이벤트 1위', Date.now());
      ce.winners = winners.map((w) => w.id);
    }
    ce.done = true; this.cheerEvent = ce;
    this.broadcastState();
    setTimeout(() => { if (this.cheerEvent === ce) { this.cheerEvent = null; this.broadcastState(); } }, 6000);
  }

  // 점수 수동 수정 (이력 저장)
  // 참가자가 폰에서 우리 팀 이름·아이콘 바꾸기 (대기 화면에서만)
  renameTeam(p, name, icon) {
    const mode = this.settings.teamRename || 'rep';
    if (mode === 'off') throw new Err('팀 이름은 진행자만 바꿀 수 있어요');
    if (mode === 'rep' && !p.rep) throw new Err('팀 이름은 👑 팀 대표만 바꿀 수 있어요');
    if (this.phase !== 'lobby') throw new Err('게임 시작 전 대기 화면에서만 바꿀 수 있어요');
    const t = this.teams.find((x) => x.id === p.team); if (!t) throw new Err('팀이 없어요');
    const now = Date.now();
    this._renameAt ||= new Map();
    if (now - (this._renameAt.get(t.id) || 0) < 3000) throw new Err('잠깐! 3초 뒤에 다시 바꿀 수 있어요');
    let nm = String(name ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
    if (!nm) throw new Err('팀 이름을 써 주세요');
    nm = [...nm].slice(0, 10).join('');
    if (this.teams.some((x) => x.id !== t.id && x.name === nm)) throw new Err('다른 팀이 쓰는 이름이에요');
    if (icon != null && !RENAME_ICONS.includes(icon)) throw new Err('아이콘 오류');
    t.name = nm; if (icon) t.icon = icon; this._renameAt.set(t.id, now);
    this.db.run('UPDATE teams SET name=?, icon=? WHERE event_id=? AND id=?', t.name, t.icon, this.id, t.id);
    this.audit('teamRename', { team: t.id, name: t.name, icon: t.icon, by: p.name });
    this.broadcastState();
  }

  adjust(teamId, delta, reason) {
    if (!this.teams.some((t) => t.id === teamId)) throw new Err('팀 오류');
    if (!Number.isFinite(delta) || Math.abs(delta) > 1000) throw new Err('점수는 -1000~1000 사이로 입력하세요');
    this.db.run('INSERT INTO adjustments(event_id,team_id,delta,kind,reason,at) VALUES(?,?,?,?,?,?)', this.id, teamId, Math.round(delta * 10) / 10, 'manual', String(reason || '').slice(0, 60) || '관리자 수정', Date.now());
    this.audit('adjust', { teamId, delta, reason });
    this.broadcastState();
  }

  loadLastResult() { return null; }

  // 행사 전체 팀 MVP: 끝난 게임들의 환산 점수(0~100) 합이 팀 안에서 가장 높은 참가자
  teamMvp() {
    const rows = this.db.all("SELECT ps.player_id pid, SUM(ps.norm) total, COUNT(*) games FROM player_scores ps JOIN runs r ON r.id=ps.run_id WHERE r.event_id=? AND r.status='done' GROUP BY ps.player_id", this.id);
    const out = {};
    for (const x of rows) {
      const p = this.players.get(x.pid); if (!p || p.excluded || !p.team) continue;
      const cur = out[p.team];
      if (!cur || x.total > cur.total) out[p.team] = { name: p.name, total: Math.round(x.total), games: x.games };
    }
    return out;
  }

  broadcastSoon() {
    if (this._bs || this.hub.closed) return;
    this._bs = setTimeout(() => { this._bs = null; this.broadcastState(); }, 250);
  }
}

export class Err extends Error { constructor(m, code = 400) { super(m); this.code = code; } }

function compactPlayers(players = {}) {
  const o = {};
  for (const [k, v] of Object.entries(players)) o[k] = { raw: v.raw, norm: v.norm, show: v.show ?? null };
  return o;
}

export function gameInfo(gid, ev) {
  const d = GAMES[gid]; if (!d) return {};
  const age = ev.dominantAge();
  return { name: d.name, emoji: d.emoji, no: d.no, rule: (ev.settings.mode === 'baby' && d.rule.baby) || d.ruleFor(age, ev.settings), howto: d.howto, dur: undefined, durSec: d.untimed ? null : ev.durOf(ev.currentItem() || {}, d) / 1000, team: !!d.teamGame, host: !!d.hostScore, pre: !!d.inputDuringCountdown };
}

export function defaultPlaylist(mode) {
  const kid = ['gems', 'mugung', 'eggs', 'rope', 'fruit', 'paint', 'tele', 'fishing', 'crown', 'fire', 'hold', 'shout'];
  const all = ['mugung', 'dodge', 'rope', 'runner', 'fruit', 'zombie', 'penalty', 'bell', 'fire', 'paint', 'rhythm', 'mino', 'draw', 'shout'];
  const list = (mode === 'kid' || mode === 'baby' ? kid : all).filter((g) => GAMES[g]);
  return list.map((g) => ({ game: g, weight: g === 'shout' ? 2 : 1 }));
}

export function sanitizeSettings(s) {
  const o = {};
  if ([...AGES6, 'mixed'].includes(s.mode)) o.mode = s.mode;
  if (['low', 'high'].includes(s.elemLevel)) o.elemLevel = s.elemLevel;
  if (Number.isInteger(s.teamCount) && s.teamCount >= 2 && s.teamCount <= 16) o.teamCount = s.teamCount;
  if (['avg', 'sum', 'rep', 'top'].includes(s.scoring)) o.scoring = s.scoring;
  if (Number.isInteger(s.topN) && s.topN >= 1 && s.topN <= 50) o.topN = s.topN;
  for (const k of ['auto', 'voice', 'sfx']) if (typeof s[k] === 'boolean') o[k] = s[k];
  if (Number.isInteger(s.introSec) && s.introSec >= 3 && s.introSec <= 60) o.introSec = s.introSec;
  if (Number.isInteger(s.resultSec) && s.resultSec >= 3 && s.resultSec <= 60) o.resultSec = s.resultSec;
  if (['choose', 'auto'].includes(s.teamAssign)) o.teamAssign = s.teamAssign;
  // 음악: 곡 id는 내장(g7 등) 또는 이 컴퓨터에 저장한 곡(u-로 시작)
  if (s.bgm && typeof s.bgm === 'object' && !Array.isArray(s.bgm)) { o.bgm = {}; for (const [k, v] of Object.entries(s.bgm).slice(0, 300)) { const [g, age] = k.split('@'); if (GAMES[g] && (age === undefined || AGES6.includes(age)) && typeof v === 'string' && /^(auto|none|g(1|7|8|12)|u-[\w-]{4,40})$/.test(v)) o.bgm[k] = v; } }
  for (const k of ['bgmVol', 'sfxVol']) if (Number.isInteger(s[k]) && s[k] >= 0 && s[k] <= 100) o[k] = s[k];
  if (Number.isInteger(s.fanfareSec) && s.fanfareSec >= 3 && s.fanfareSec <= 60) o.fanfareSec = s.fanfareSec;
  if (typeof s.duck === 'boolean') o.duck = s.duck;
  if (typeof s.league === 'string') o.league = s.league.replace(/[<>]/g, '').trim().slice(0, 30);
  if (typeof s.joinUrl === 'string' && s.joinUrl.length < 200 && (s.joinUrl === '' || /^https?:\/\/[^\s"'<>]+$/.test(s.joinUrl))) o.joinUrl = s.joinUrl.replace(/\/+$/, '');
  if (Number.isInteger(s.rouletteCapPct) && s.rouletteCapPct >= 0 && s.rouletteCapPct <= 30) o.rouletteCapPct = s.rouletteCapPct;
  if (['off', 'rep', 'all'].includes(s.teamRename)) o.teamRename = s.teamRename;
  if (['auto', 'on', 'off'].includes(s.motion)) o.motion = s.motion;
  // 진행자 문제: [문제, 정답, 오답1~3] 최대 40개 · 그림 단어 최대 60개
  const txt = (v, n) => String(v ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, n);
  if (Array.isArray(s.bellCustom)) o.bellCustom = s.bellCustom.slice(0, 40).map((q) => (Array.isArray(q) ? q.slice(0, 5).map((x, i) => txt(x, i ? 30 : 80)).filter(Boolean) : [])).filter((q) => q.length >= 3 && new Set(q.slice(1)).size === q.length - 1);
  if (Array.isArray(s.drawCustom)) o.drawCustom = [...new Set(s.drawCustom.slice(0, 60).map((w) => txt(w, 16)).filter(Boolean))];
  if (Array.isArray(s.playlist) && s.playlist.length <= 40) {
    o.playlist = s.playlist.filter((p) => p && GAMES[p.game]).map((p) => ({
      game: p.game,
      weight: [0.5, 1, 1.5, 2, 3].includes(p.weight) ? p.weight : 1,
      ...(Number.isInteger(p.dur) && p.dur >= 5 && p.dur <= 300 ? { dur: p.dur } : {}),
    }));
  }
  return o;
}

export { PHASES, AGE_LABEL };

// 대형 화면: 게임별 전용 시각화 (1920×1080 기준)
import { h } from './shared/client.js';
import { wheelEl, spinTo } from './play-games.js';
import { COLORS6 } from './shared/gen.js';

const RPS = ['✌️', '✊', '✋'];
export const V = {};

// 팀별 막대 (가로/세로 공용). 값이 바뀌면 부드럽게 늘어나고 1등에 왕관
function bars(ctx, { vertical = false, unit = '', fmt = (v) => Math.round(v), max: fixedMax } = {}) {
  const el = h('div', { class: `bars ${vertical ? 'v' : 'h'}` });
  const rows = {};
  for (const t of ctx.teams) {
    const fill = h('div', { class: 'fill', style: { background: t.color } });
    const val = h('div', { class: 'val' }, '0');
    const row = h('div', { class: 'brow' }, h('div', { class: 'lab' }, h('span', { class: 'ic' }, t.icon), h('b', {}, t.name)), h('div', { class: 'track' }, fill, val), h('div', { class: 'crown' }, '👑'));
    rows[t.id] = { row, fill, val }; el.append(row);
  }
  el.set = (vals) => {
    const arr = Object.entries(vals).map(([k, v]) => [+k, v || 0]);
    const max = fixedMax || Math.max(1, ...arr.map((x) => x[1])) * 1.1;
    const best = Math.max(...arr.map((x) => x[1]));
    for (const [id, v] of arr) {
      const r = rows[id]; if (!r) continue;
      const pct = Math.max(0, Math.min(100, (v / max) * 100));
      if (vertical) r.fill.style.height = pct + '%'; else r.fill.style.width = pct + '%';
      r.val.textContent = fmt(v) + unit;
      r.row.classList.toggle('lead', v > 0 && v === best);
    }
  };
  return el;
}
const leaderOf = (vals) => { let b = null, bv = -Infinity, tie = false; for (const [k, v] of Object.entries(vals)) { if (v > bv) { bv = v; b = +k; tie = false; } else if (v === bv) tie = true; } return bv > 0 && !tie ? b : null; };
const top5 = (list, ctx, fmt) => h('div', { class: 'top5' }, h('div', { class: 'th' }, '🏅 개인 TOP 5'), list.map((x, i) => { const t = ctx.team(x.team); return h('div', { class: 'tr', style: { '--tc': t.color } }, h('b', {}, i + 1), h('span', {}, `${t.icon} ${x.name}`), h('em', {}, fmt(x))); }));
const secs = (ctx, until) => Math.max(0, Math.ceil((until - ctx.now()) / 1000));

// 막대형 기본 화면
function barGame(title, pick, opt = {}) {
  return {
    mount(root, ctx) { this.ctx = ctx; this.b = bars(ctx, opt); this.side = h('div', { class: 'side' }); root.append(h('div', { class: 'sg' }, h('div', { class: 'sgt' }, title), h('div', { class: 'sgrow' }, this.b, this.side))); },
    update(s) { const vals = pick(s); this.b.set(vals); if (opt.side) { this.side.innerHTML = ''; this.side.append(opt.side(s, this.ctx)); } return vals; },
  };
}

V.mash = {
  mount(root, ctx) { this.ctx = ctx; this.b = bars(ctx, { vertical: true, unit: '회' }); root.append(h('div', { class: 'sg' }, h('div', { class: 'sgt' }, '👆 팀 평균 연타 수'), this.b)); },
  update(s) { this.b.set(s.avg); return s.avg; },
};
V.race = {
  mount(root, ctx) {
    this.ctx = ctx; this.lanes = {};
    const field = h('div', { class: 'field' }, h('div', { class: 'fline' }, '🏁'));
    ctx.teams.forEach((t, i) => {
      const run = h('div', { class: 'lrun' }, h('span', { class: 'ri' }, t.icon), h('span', { class: 'rf' }, '🏃'));
      const lane = h('div', { class: 'lane', style: { '--tc': t.color } }, h('div', { class: 'ln' }, `${i + 1}`), h('div', { class: 'lname' }, t.name), run, h('div', { class: 'lfin' }));
      this.lanes[t.id] = { run, lane }; field.append(lane);
    });
    this.top = h('div', { class: 'racetop' });
    root.append(h('div', { class: 'sg' }, h('div', { class: 'sgt' }, '🏃 팀 평균 거리 · 100m'), field, this.top));
  },
  update(s) {
    for (const [id, d] of Object.entries(s.avg)) { const l = this.lanes[id]; if (!l) continue; l.run.style.left = `calc(${d}% * 0.86 + 8%)`; l.lane.querySelector('.lfin').textContent = s.fin[id] ? `완주 ${s.fin[id]}명` : `${Math.round(d)}m`; }
    this.top.textContent = s.top.length ? `🥇 ${s.top.map((x) => `${this.ctx.team(x.team).icon}${x.name}`).join('  🥈 ').replace(/🥈 (.*?)  🥈/, '🥈 $1  🥉')}` : '';
    return s.avg;
  },
};
V.tug = {
  mount(root, ctx) { this.ctx = ctx; this.wrap = h('div', { class: 'tugs' }); this.force = bars(ctx, { unit: '%', max: 120 }); root.append(h('div', { class: 'sg' }, h('div', { class: 'sgt' }, '🪢 줄다리기 · 1인당 힘'), this.wrap, h('div', { class: 'sgrow' }, this.force))); this.built = false; },
  update(s) {
    if (!this.built) {
      this.built = true; this.m = [];
      for (const m of s.matches) {
        const ts = m.teams.map((id) => this.ctx.team(id));
        if (m.teams.length === 2) {
          const knot = h('div', { class: 'knotflag' }, '🚩');
          const el = h('div', { class: 'tugm two' }, h('div', { class: 'tside', style: { '--tc': ts[0].color } }, ts[0].icon, h('b', {}, ts[0].name)), h('div', { class: 'ropeline' }, h('div', { class: 'mid' }), knot), h('div', { class: 'tside', style: { '--tc': ts[1].color } }, ts[1].icon, h('b', {}, ts[1].name)));
          this.m.push({ el, knot, two: true }); this.wrap.append(el);
        } else {
          const knot = h('div', { class: 'tri-knot' }, '🚩');
          const corners = ts.map((t, i) => h('div', { class: `tc c${i}`, style: { '--tc': t.color } }, t.icon, h('b', {}, t.name)));
          const el = h('div', { class: 'tugm tri' }, h('div', { class: 'tri-area' }, ...corners, knot));
          this.m.push({ el, knot, two: false }); this.wrap.append(el);
        }
      }
    }
    s.matches.forEach((m, i) => {
      const x = this.m[i]; if (!x) return;
      if (x.two) x.knot.style.left = `${50 + m.x * 50}%`;
      else { x.knot.style.left = `${50 + m.x * 42}%`; x.knot.style.top = `${58 - m.y * 42}%`; }
      x.el.classList.toggle('won', !!m.winner);
      if (m.winner && !x.wonShown) { x.wonShown = true; const t = this.ctx.team(m.winner); x.el.append(h('div', { class: 'winbadge', style: { background: t.color } }, `${t.icon} ${t.name} 승리!`)); }
    });
    this.force.set(s.force);
    const lead = {}; for (const m of s.matches) for (const t of m.teams) lead[t] = s.force[t];
    return null;
  },
};
V.bomb = {
  mount(root, ctx) { this.ctx = ctx; this.grid = h('div', { class: 'bombs' }); this.head = h('div', { class: 'sgt' }); root.append(h('div', { class: 'sg' }, this.head, this.grid)); },
  update(s) {
    this.head.textContent = `💣 폭탄 돌리기 · 라운드 ${s.round}/${s.rounds}${s.phase === 'break' ? ' · 모든 폭탄 펑!' : ''}`;
    this.grid.innerHTML = '';
    for (const t of this.ctx.teams) {
      const b = s.teams[t.id] || {};
      const hot = Math.min(1, (b.hold || 0) / 8000);
      this.grid.append(h('div', { class: `bcard ${b.exploded ? 'ex' : ''}`, style: { '--tc': t.color } },
        h('div', { class: 'bt' }, `${t.icon} ${t.name}`), h('div', { class: 'bb', style: { transform: `scale(${1 + hot * 0.3})` } }, b.exploded ? '💥' : '💣'),
        h('div', { class: 'bh' }, b.exploded ? '펑!' : `${b.holder || '…'}`), h('div', { class: 'bs' }, `패스 ${b.passes ?? 0} · 펑 ${b.booms ?? 0}`)));
    }
    return null;
  },
};
V.nunchi = {
  mount(root, ctx) { this.ctx = ctx; this.el = h('div', { class: 'sg' }); root.append(this.el); },
  update(s) {
    this.el.innerHTML = '';
    this.el.append(h('div', { class: 'sgt' }, `👀 눈치게임 · 라운드 ${s.round}/${s.rounds}`));
    if (s.phase === 'pick') {
      this.el.append(h('div', { class: 'hugeq' }, s.kid ? '그림 하나를 골라요!' : `1 ~ ${s.K} 중 나만의 숫자를 고르세요!`), h('div', { class: 'cnt' }, `${secs(this.ctx, s.until)}초`), h('div', { class: 'prog' }, `선택 완료 ${s.picked} / ${s.total}명`));
    } else if (s.phase === 'reveal' && s.reveal) {
      const hist = h('div', { class: 'hist' });
      for (let i = 1; i <= s.K; i++) { const c = s.reveal.cnt[i] || 0; hist.append(h('div', { class: `hb ${c === 1 ? 'uniq' : c > 1 ? 'dup' : ''}` }, h('div', { class: 'hv', style: { height: `${Math.min(100, c * 18)}%` } }, c ? c : ''), h('div', { class: 'hl' }, s.kid ? s.pics[i - 1] : i))); }
      this.el.append(h('div', { class: 'hugeq' }, '결과 공개! 초록 = 나만 고른 숫자'), hist);
    }
    const b = bars(this.ctx, { unit: '명 성공' }); b.set(s.okTeam); this.el.append(b);
    return s.okTeam;
  },
};
V.tensec = barGame('⏱️ 10초의 신 · 가장 정확한 사람', () => ({}), {
  side: (s, ctx) => h('div', {}, h('div', { class: 'prog' }, `도전 중 ${s.running}명 · 완료 ${s.done}/${s.total}명`), top5(s.top, ctx, (x) => `오차 ${(x.err / 1000).toFixed(2)}초`)),
});
V.tensec.update = function (s) { this.side.innerHTML = ''; this.side.append(h('div', {}, h('div', { class: 'prog big' }, `도전 중 ${s.running}명 · 완료 ${s.done}/${s.total}명`), top5(s.top, this.ctx, (x) => `오차 ${(x.err / 1000).toFixed(2)}초`))); this.b.classList.add('hidden'); return null; };
V.survivor = {
  mount(root, ctx) { this.ctx = ctx; this.el = h('div', { class: 'sg' }); root.append(this.el); },
  update(s) {
    this.el.innerHTML = '';
    this.el.append(h('div', { class: 'sgt' }, `🚪 최후의 생존자 · 라운드 ${s.round}/${s.maxRounds}`));
    if (s.champ) { const t = this.ctx.team(s.champ.team); this.el.append(h('div', { class: 'champ' }, `👑 최후의 생존자: ${t.icon} ${s.champ.name}`)); }
    else this.el.append(h('div', { class: 'alive' }, s.kid ? `⭐ 별 모으기` : `생존 ${s.aliveN} / ${s.total}명`));
    const doors = h('div', { class: 'sdoors' });
    s.opts.forEach((o, i) => doors.append(h('div', { class: `sdoor ${s.last && s.last.bad === i ? 'bad' : ''}` }, h('span', {}, o.e), h('b', {}, o.n), s.last ? h('em', {}, `${s.last.counts[i]}명`) : null)));
    this.el.append(doors);
    if (s.phase === 'pick') this.el.append(h('div', { class: 'cnt' }, `${secs(this.ctx, s.until)}초 · 선택 ${s.picked}명`));
    if (s.voided && s.phase === 'reveal') this.el.append(h('div', { class: 'hugeq' }, '😮 전원 탈락 → 이번 라운드 무효!'));
    const vals = Object.fromEntries(Object.entries(s.team).map(([k, v]) => [k, s.kid ? v.stars : v.total ? (v.alive / v.total) * 100 : 0]));
    const b = bars(this.ctx, { unit: s.kid ? '개' : '%', max: s.kid ? undefined : 100 }); b.set(vals); this.el.append(b);
    return vals;
  },
};
V.vault = {
  mount(root, ctx) { this.ctx = ctx; this.grid = h('div', { class: 'vaults' }); root.append(h('div', { class: 'sg' }, h('div', { class: 'sgt' }, '🔐 팀 협동 금고 · 힌트를 모아 비밀번호를 맞혀라!'), this.grid)); },
  update(s) {
    this.grid.innerHTML = '';
    const vals = {};
    for (const t of this.ctx.teams) {
      const v = s.teams[t.id] || {};
      vals[t.id] = v.solved != null ? 100000 - v.solved : 0;
      this.grid.append(h('div', { class: `vcard ${v.solved != null ? 'open' : ''} ${v.locked ? 'locked' : ''}`, style: { '--tc': t.color } }, h('div', { class: 'vt' }, `${t.icon} ${t.name}`), h('div', { class: 'vi' }, v.solved != null ? '🔓' : '🔒'),
        h('div', { class: 'vs' }, v.solved != null ? `${(v.solved / 1000).toFixed(1)}초 해제!` : v.locked ? '틀렸다! 3초 잠김' : `${'＊'.repeat(v.len || 4)}`), h('div', { class: 'vw' }, `틀린 횟수 ${v.wrong || 0}`)));
    }
    return vals;
  },
};
V.mole = barGame('🐹 두더지 사냥 · 팀 평균 점수', (s) => s.avg, { vertical: true, unit: '점' });
V.reaction = {
  mount(root, ctx) { this.ctx = ctx; this.sig = h('div', { class: 'signal' }); this.info = h('div', { class: 'sgt' }); this.side = h('div', { class: 'side' }); this.b = bars(ctx, { unit: 'ms', fmt: (v) => (v ? Math.round(2000 - v) : '-') }); root.append(h('div', { class: 'sg' }, this.info, h('div', { class: 'sgrow' }, this.sig, this.side))); this.raf = setInterval(() => this.tick(), 50); },
  tick() { const s = this.s; if (!s) return; if (s.phase === 'arm') { const go = this.ctx.now() >= s.sentAt + s.delay; this.sig.className = `signal ${go ? 'go' : 'wait'}`; this.sig.textContent = go ? '지금!' : '기다려…'; } else { this.sig.className = 'signal off'; this.sig.textContent = `라운드 ${s.round} 끝`; } },
  update(s) {
    this.s = s; this.info.textContent = `⚡ 반응속도 챔피언 · 라운드 ${s.round}/${s.rounds}`;
    this.side.innerHTML = ''; this.side.append(top5(s.top, this.ctx, (x) => `${x.rt}ms`), h('div', { class: 'teamavg' }, this.ctx.teams.map((t) => h('div', { style: { color: t.color } }, `${t.icon} ${t.name} 평균 ${s.team[t.id] ?? '-'}ms`))));
    const vals = Object.fromEntries(Object.entries(s.team).map(([k, v]) => [k, v ? 2000 - v : 0]));
    return vals;
  },
  unmount() { clearInterval(this.raf); },
};
V.rps = {
  mount(root, ctx) { this.ctx = ctx; this.el = h('div', { class: 'sg' }); root.append(this.el); },
  update(s) {
    this.el.innerHTML = '';
    this.el.append(h('div', { class: 'sgt' }, `✌️ 번개쌤과 가위바위보 · 라운드 ${s.round}/${s.rounds}`));
    this.el.append(h('div', { class: 'host' }, h('div', { class: 'hn' }, '⚡ 번개쌤'), h('div', { class: `hh ${s.host != null ? 'rev' : 'shake'}` }, s.host != null ? RPS[s.host] : '❔')));
    if (s.phase === 'pick') this.el.append(h('div', { class: 'cnt' }, `${secs(this.ctx, s.until)}초 · 낸 사람 ${s.picked}/${s.aliveN}`));
    if (s.last) this.el.append(h('div', { class: 'hugeq' }, s.last.voided ? '전원 패배 → 무효! 다시!' : `🎉 이김 ${s.last.win} · 🤝 비김 ${s.last.draw} · 😵 짐 ${s.last.lose}`));
    const vals = Object.fromEntries(Object.entries(s.team).map(([k, v]) => [k, v.pts]));
    const b = bars(this.ctx, { unit: '점' }); b.set(vals); this.el.append(b);
    return vals;
  },
};
V.numhunt = barGame('🔢 숫자 사냥 · 팀 평균 완료 판', (s) => s.boards, { unit: '판', fmt: (v) => v.toFixed(1), side: (s, ctx) => top5(s.top, ctx, (x) => `${x.boards}판 + ${x.next - 1}`) });
V.memory = barGame('🧠 기억력 배틀 · 팀 평균 진행도', (s) => s.prog, { unit: '%', max: 100, side: (s, ctx) => top5(s.top, ctx, (x) => `${x.lvl}단계`) });
V.colortrap = {
  mount(root, ctx) { this.ctx = ctx; this.b = bars(ctx, { vertical: true, unit: '점' }); const sw = h('div', { class: 'swatches' }, COLORS6.map((c) => h('span', { style: { background: c.hex } }, c.shape))); root.append(h('div', { class: 'sg' }, h('div', { class: 'sgt' }, '🎨 색깔 함정 · 팀 평균 점수'), sw, this.b)); },
  update(s) { this.b.set(s.avg); return s.avg; },
};
V.ox = {
  mount(root, ctx) { this.ctx = ctx; this.el = h('div', { class: 'sg' }); root.append(this.el); },
  update(s) {
    this.el.innerHTML = '';
    this.el.append(h('div', { class: 'sgt' }, `⭕ 스피드 OX · 문제 ${s.qi + 1}/${s.n}`));
    if (s.text) this.el.append(h('div', { class: 'oxbig' }, s.emoji ? h('span', {}, s.emoji) : null, s.text));
    const tot = Math.max(1, s.cnt[0] + s.cnt[1]);
    this.el.append(h('div', { class: 'oxbars' },
      h('div', { class: `ob o ${s.answer === 1 ? 'right' : s.answer === 0 ? 'wrong' : ''}` }, h('b', {}, '⭕'), h('div', { class: 'of', style: { width: `${(s.cnt[1] / tot) * 100}%` } }), h('em', {}, `${s.cnt[1]}명`)),
      h('div', { class: `ob x ${s.answer === 0 ? 'right' : s.answer === 1 ? 'wrong' : ''}` }, h('b', {}, '❌'), h('div', { class: 'of', style: { width: `${(s.cnt[0] / tot) * 100}%` } }), h('em', {}, `${s.cnt[0]}명`))));
    if (s.phase === 'q') this.el.append(h('div', { class: 'cnt' }, `${secs(this.ctx, s.until)}초`));
    else if (s.answer != null) this.el.append(h('div', { class: 'hugeq' }, `정답은 ${s.answer ? '⭕' : '❌'}!`));
    const b = bars(this.ctx, { unit: '%', max: 100 }); b.set(s.team); this.el.append(b);
    return s.team;
  },
};
V.tower = {
  mount(root, ctx) {
    this.ctx = ctx; this.cols = {};
    const sky = h('div', { class: 'sky' });
    for (const t of ctx.teams) { const stack = h('div', { class: 'stack' }); const lab = h('div', { class: 'slab' }, `${t.icon} ${t.name}`); const v = h('div', { class: 'sv' }); const col = h('div', { class: 'scol', style: { '--tc': t.color } }, v, stack, lab); this.cols[t.id] = { stack, v }; sky.append(col); }
    this.side = h('div', { class: 'side' });
    root.append(h('div', { class: 'sg' }, h('div', { class: 'sgt' }, '🧱 타이밍 탑 쌓기 · 팀 평균 높이'), h('div', { class: 'sgrow' }, sky, this.side)));
  },
  update(s) {
    for (const [id, v] of Object.entries(s.avg)) { const c = this.cols[id]; if (!c) continue; const n = Math.round(v); if (c.stack.childElementCount !== n) { c.stack.innerHTML = ''; for (let i = 0; i < Math.min(n, 24); i++) c.stack.append(h('div', { class: 'blk', style: { width: `${90 - i * 2}%` } })); } c.v.textContent = `${v}층`; }
    this.side.innerHTML = ''; this.side.append(top5(s.top, this.ctx, (x) => `${x.best}층`));
    return s.avg;
  },
};
V.fatebox = {
  mount(root, ctx) { this.ctx = ctx; this.el = h('div', { class: 'sg' }); root.append(this.el); },
  update(s) {
    this.el.innerHTML = '';
    this.el.append(h('div', { class: 'sgt' }, `🎁 운명의 상자 · 라운드 ${s.round}/${s.rounds}`), h('div', { class: 'prog' }, `상자 속: ${s.list.join(' · ')} (각 상자 확률 동일)`));
    const row = h('div', { class: 'sboxes' });
    for (let i = 0; i < s.n; i++) row.append(h('div', { class: `sbox ${s.open ? 'open' : ''} ${s.open && s.open[i].v < 0 ? 'neg' : ''}` }, h('div', { class: 'bi' }, s.open ? s.open[i].l : '🎁'), h('div', { class: 'bn' }, `${i + 1}번 · ${s.cnt[i]}명`)));
    this.el.append(row, h('div', { class: 'seal' }, `🔒 봉인 ${s.seal}${s.salt ? ` · 공개키 ${s.salt}` : ''}`));
    if (s.phase === 'pick') this.el.append(h('div', { class: 'cnt' }, `${secs(this.ctx, s.until)}초`));
    const b = bars(this.ctx, { unit: '점' }); b.set(s.team); this.el.append(b);
    return s.team;
  },
};
V.bingo = {
  mount(root, ctx) { this.ctx = ctx; this.grid = h('div', { class: 'bingos' }); root.append(h('div', { class: 'sg' }, h('div', { class: 'sgt' }, '🎯 팀 빙고 · 한 줄을 먼저!'), this.grid)); },
  update(s) {
    this.grid.innerHTML = '';
    const vals = {};
    for (const t of this.ctx.teams) {
      const b = s.teams[t.id]; if (!b) continue;
      vals[t.id] = b.lines * 100 + b.board.filter((x) => x === 2).length + (b.order ? 1000 - b.order * 100 : 0);
      const g = h('div', { class: 'mb', style: { gridTemplateColumns: `repeat(${s.S}, 1fr)` } }, b.board.map((x) => h('div', { class: `mc s${x}` })));
      this.grid.append(h('div', { class: `bgcard ${b.order ? 'got' : ''}`, style: { '--tc': t.color } }, h('div', { class: 'bgt' }, `${t.icon} ${t.name}`), g, h('div', { class: 'bgs' }, b.order ? `🎉 ${b.order}등 빙고!` : `${b.lines}줄`)));
    }
    return vals;
  },
};
V.roulette = {
  mount(root, ctx) { this.ctx = ctx; this.grid = h('div', { class: 'wheels' }); this.head = h('div', { class: 'sgt' }, '🎡 역전 룰렛'); root.append(h('div', { class: 'sg' }, this.head, this.grid)); this.w = {}; },
  update(s) {
    this.head.textContent = `🎡 역전 룰렛 · 보너스 상한 ${s.cap}점 (순위가 낮을수록 큰 판)`;
    for (const t of this.ctx.teams) {
      const b = s.teams[t.id]; if (!b) continue;
      let w = this.w[t.id];
      if (!w) {
        const wheel = wheelEl(b.seg, ['#ff4d6d', '#3d8bff', '#ffd43b', '#2fd27a', '#b06bff', '#ff922b', '#22d3ee', '#f472b6']);
        const res = h('div', { class: 'wres' }, `최대 +${b.max}`);
        const card = h('div', { class: 'wcard', style: { '--tc': t.color } }, h('div', { class: 'wt' }, `${t.icon} ${t.name}`), h('div', { class: 'wheelwrap' }, h('div', { class: 'pin' }, '▼'), wheel), res);
        w = this.w[t.id] = { wheel, res, card }; this.grid.append(card);
      }
      if (b.spunAt && !w.spun) { w.spun = true; requestAnimationFrame(() => spinTo(w.wheel, b.out, b.seg.length)); w.res.textContent = `${b.by} 님이 돌려요…`; setTimeout(() => { w.res.textContent = `🎉 +${b.seg[b.out]}점!`; w.card.classList.add('done'); }, 4100); }
    }
    return null;
  },
};
V.throne = {
  mount(root, ctx) { this.ctx = ctx; this.root = root; this.head = h('div', { class: 'thr' }); this.body = h('div', { class: 'thb' }); this.pts = bars(ctx, { unit: '점' }); root.append(this.head, this.body); },
  update(s) {
    this.head.innerHTML = '';
    this.head.append(h('div', { class: 'thsteps' }, s.labels.map((l, i) => h('div', { class: i < s.ri ? 'done' : i === s.ri ? 'cur' : '' }, `${i + 1}R ${l}${s.weights[i] > 1 ? ' ×2' : ''}`))));
    const key = s.phase === 'play' && s.sub ? `${s.ri}:${s.sub.g}` : `inter${s.ri}`;
    if (key !== this.key) {
      this.cur?.unmount?.(); this.cur = null; this.body.innerHTML = ''; this.key = key;
      if (s.phase === 'play' && s.sub && V[s.sub.g]) { this.cur = Object.create(V[s.sub.g]); this.cur.mount(this.body, this.ctx); }
      else if (s.last) {
        this.body.append(h('div', { class: 'hugeq' }, `${s.last.label} 라운드 결과`));
        const order = Object.entries(s.last.rank).sort((a, b) => a[1] - b[1]);
        this.body.append(h('div', { class: 'rr' }, order.map(([id, rk]) => { const t = this.ctx.team(+id); return h('div', { class: 'rri', style: { '--tc': t.color } }, h('b', {}, `${rk}위`), `${t.icon} ${t.name}`, h('em', {}, `+${s.last.got[id]}`)); })));
        this.body.append(h('div', { class: 'sgt' }, '👑 결승 누적 점수'), this.pts);
      }
    }
    if (this.cur && s.sub) this.cur.update(s.sub.s);
    this.pts.set(s.pts);
    return s.pts;
  },
  unmount() { this.cur?.unmount?.(); },
};

export { leaderOf };

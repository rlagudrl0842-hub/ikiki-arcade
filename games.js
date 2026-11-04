// 게임 목록 (30종 + 스크린 체육 3종 + 팀 협동 2종)
import { dodge, zombie, paint } from './n1.js';
import { mugung, rope, fire, fruit } from './n2.js';
import { bell, draw, shout } from './n3.js';
import { gems, crown, dalgona, tuho, runner, flappy, stairs, bridge, fishing, basket, eggs, curling, penalty, rhythm, burger } from './n4.js';
import { tele, mino, spot, hilo, hold } from './n5.js';
import { pe_freeze, pe_simon, pe_mission } from './n6.js';
import { sync, relay } from './n7.js';

const list = [dodge, zombie, paint, gems, crown, mugung, dalgona, rope, tuho, runner, flappy, fruit, stairs, bridge, fishing, curling, penalty, basket, fire, rhythm, eggs, burger, bell, tele, mino, draw, spot, hilo, shout, hold, pe_freeze, pe_simon, pe_mission, sync, relay].sort((a, b) => a.no - b.no);

export const GAMES = {};
for (const g of list) {
  GAMES[g.id] = {
    ...g,
    durFor: (age) => g.dur[age] ?? g.dur.elem,
    ruleFor: (age) => g.rule[age] ?? g.rule.all ?? '',
  };
}
export const GAME_LIST = list.map((g) => ({ id: g.id, no: g.no, name: g.name, emoji: g.emoji, rule: g.rule.all ?? g.rule.elem, untimed: !!g.untimed, dur: g.dur, team: !!g.teamGame, bonusOnly: !!g.bonusOnly, host: !!g.hostScore }));

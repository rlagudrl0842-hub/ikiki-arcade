import { mash, race, tug, bomb, nunchi } from './a.js';
import { tensec, survivor, vault, mole, reaction } from './b.js';
import { rps, numhunt, memory, colortrap, ox } from './c.js';
import { tower, fatebox, bingo, roulette, throne } from './d.js';

const list = [mash, race, tug, bomb, nunchi, tensec, survivor, vault, mole, reaction, rps, numhunt, memory, colortrap, ox, tower, fatebox, bingo, roulette, throne];

export const GAMES = {};
for (const g of list) {
  GAMES[g.id] = {
    ...g,
    durFor: (age) => g.dur[age] ?? g.dur.elem,
    ruleFor: (age) => g.rule[age] ?? g.rule.all ?? '',
  };
}
export const GAME_LIST = list.map((g) => ({ id: g.id, no: g.no, name: g.name, emoji: g.emoji, rule: g.rule.all ?? g.rule.elem, untimed: !!g.untimed, dur: g.dur, team: !!g.teamGame, bonusOnly: !!g.bonusOnly }));

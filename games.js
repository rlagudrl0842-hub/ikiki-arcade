// 게임 목록 (30종 + 스크린 체육 3종 + 팀 협동 2종 + 새 터치게임 4종)
import { dodge, zombie, paint } from './n1.js';
import { mugung, rope, fire, fruit } from './n2.js';
import { bell, draw, shout } from './n3.js';
import { gems, crown, dalgona, tuho, runner, flappy, stairs, bridge, fishing, basket, eggs, curling, penalty, rhythm, burger } from './n4.js';
import { tele, mino, spot, hilo, hold } from './n5.js';
import { pe_freeze, pe_simon, pe_mission } from './n6.js';
import { sync, relay } from './n7.js';
import { balloon, bombpass, boss, towerup } from './n8.js';

const list = [dodge, zombie, paint, gems, crown, mugung, dalgona, rope, tuho, runner, flappy, fruit, stairs, bridge, fishing, curling, penalty, basket, fire, rhythm, eggs, burger, bell, tele, mino, draw, spot, hilo, shout, hold, pe_freeze, pe_simon, pe_mission, sync, relay, balloon, bombpass, boss, towerup].sort((a, b) => a.no - b.no);

// 기기 분류: 실제 입력 구조 기준
//  phone = 참가자 휴대폰 필요 / none = 휴대폰 없이 가능 / both = 둘 다 가능(휴대폰 없으면 대형 화면 + 진행자 입력)
//  host  = 진행자가 점수를 입력 (휴대폰 없이 할 때)
export const DEVICE_LABEL = { phone: '📱 참가자 휴대폰 필요', none: '🙌 휴대폰 없이 가능', both: '🔁 둘 다 가능', host: '🎯 진행자 입력' };
const devOf = (g) => (g.pe ? 'none' : g.board ? 'both' : 'phone');
export const GAMES = {};
for (const g of list) {
  GAMES[g.id] = {
    ...g, dev: devOf(g), hostIn: !!(g.hostScore || g.board),
    durFor: (age) => g.dur[age] ?? g.dur.elem,
    ruleFor: (age) => g.rule[age] ?? g.rule.all ?? '',
  };
}
export const GAME_LIST = list.map((g) => ({ id: g.id, no: g.no, name: g.name, emoji: g.emoji, rule: g.rule.all ?? g.rule.elem, untimed: !!g.untimed, dur: g.dur, team: !!g.teamGame, bonusOnly: !!g.bonusOnly, host: !!g.hostScore, dev: devOf(g), hostIn: !!(g.hostScore || g.board) }));

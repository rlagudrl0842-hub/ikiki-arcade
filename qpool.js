// 문제 세트 관리: 고유 ID(사실상 같은 문제는 같은 ID) · 한 판 중복 없음 · 행사 안에서 출제한 문제는 다 쓸 때까지 다시 안 냄
// 재경기는 직전 판 문제를 빼고 새 세트 · 새로고침·재접속은 서버가 가진 세트를 그대로 유지(재시작 아님)
import crypto from 'node:crypto';
import { shuffle } from './gen.js';

// 공백·대소문자·기호·이모지 차이만 있는 문제는 같은 문제로 봄
export function normQ(text) {
  return String(text ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}
export const qid = (text) => crypto.createHash('sha1').update(normQ(text)).digest('base64url').slice(0, 10);

// items: 후보 목록, keyOf: 문제 글(같음 판단용), n: 필요한 개수
// 반환: { list, ids, notice } — notice는 사회자에게 보여 줄 안내(부족·다시 섞음)
export function pickSet(ev, game, r, items, n, keyOf, opts = {}) {
  // 1) 같은 문제 합치기 (먼저 나온 것 = 진행자 문제 우선)
  const seen = new Set(); const uniq = [];
  for (const it of items) { const id = qid(keyOf(it)); if (!normQ(keyOf(it)) || seen.has(id)) continue; seen.add(id); uniq.push({ id, it }); }
  const st = ev ? ev.qState(game) : { used: [], last: [] };
  const avoid = opts.avoid || new Set(); // 문제 바꾸기: 방금 보여 준 세트는 최대한 피함
  const used = new Set([...st.used, ...avoid]); const last = new Set([...st.last, ...avoid]);
  let notice = null; let want = n;
  if (uniq.length < n) { want = uniq.length; notice = `문제가 ${n - uniq.length}개 부족해서 ${uniq.length}문제만 내요 (같은 문제를 반복하지 않아요). 설정에서 문제를 추가할 수 있어요.`; }
  const fresh = uniq.filter((x) => !used.has(x.id));
  let chosen;
  const pri = opts.pri || (() => false); // 진행자가 넣은 문제를 먼저
  const freshOrd = [...shuffle(r, fresh.filter((x) => pri(x.it))), ...shuffle(r, fresh.filter((x) => !pri(x.it)))];
  if (fresh.length >= want) chosen = freshOrd.slice(0, want);
  else {
    // 안 낸 문제를 다 쓰고 나면: 남은 새 문제 + (직전 판 문제는 최대한 빼고) 다시 섞어 채움
    const rest = shuffle(r, uniq.filter((x) => used.has(x.id) && !last.has(x.id)));
    const lastOnes = shuffle(r, uniq.filter((x) => last.has(x.id)));
    chosen = [...freshOrd, ...rest, ...lastOnes].slice(0, want);
    used.clear(); for (const a of avoid) used.delete(a);
    if (!notice) notice = `이 행사에서 준비된 문제를 모두 냈어요. 문제를 다시 섞어서 내요.`;
  }
  // 앞쪽(진행자 문제)이 먼저 나오도록 하지 않고 골고루 섞음
  chosen = shuffle(r, chosen);
  for (const a of avoid) if (!st.used.includes(a)) used.delete(a); // 바꾸기 전 세트는 실제로 안 냈으니 '낸 문제'에서 뺌
  for (const x of chosen) used.add(x.id);
  return { list: chosen.map((x) => x.it), ids: chosen.map((x) => x.id), notice, used: [...used] };
}

// 참가자별 보기 순서: 같은 사람은 같은 문제에서 항상 같은 순서(새로고침해도 그대로)
export function permFor(pid, salt, n) {
  const h = crypto.createHash('sha1').update(`${pid}|${salt}`).digest();
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = h[i % h.length] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a; // a[보이는 자리] = 원래 보기 번호
}

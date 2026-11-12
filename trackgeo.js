// 🏟 육상 트랙 기하 (서버·폰·대형 화면 공용) — World Athletics 표준 400m 트랙 기준
// 직선 84.39m · 곡선 안쪽 반지름 36.5m · 주로 폭 1.22m · 측정선: 1주로는 연석에서 0.30m, 2주로부터는 안쪽 선에서 0.20m
// 좌표: 가운데 (0,0) · 홈 직선은 아래쪽(y+) · 달리는 방향은 시계 반대(안쪽이 왼손) · 결승선 = 홈 직선 오른쪽 끝(x = +S/2)
export const S = 84.39, R0 = 36.5, LW = 1.22;
export const rMeas = (L) => R0 + (L <= 1 ? 0.30 : LW * (L - 1) + 0.20); // 거리 재는 선 (출발 위치 계산용)
export const rCen = (L) => R0 + LW * (L - 0.5); // 그림에서 선수가 서는 주로 한가운데
export const lapLen = (L) => 2 * S + 2 * Math.PI * rMeas(L);
export const BREAK = Math.PI * rMeas(1); // 800m: 출발 후 첫 곡선 끝(백스트레치 시작)까지 주로 유지
export const MERGE = 55; // 브레이크라인 뒤 안쪽으로 옮겨 가는 거리(그림용)

// 종목: D 거리 · cmd 출발 구령(set = 제자리에→차렷→총 / marks = 제자리에→총) · legs 계주 주자 수
export const EVENTS = {
  100: { key: '100', D: 100, name: '100m', cmd: 'set', lanes: 'straight', vmax: 9.0, energy: 0, est: 12 },
  200: { key: '200', D: 200, name: '200m', cmd: 'set', lanes: 'all', vmax: 14, energy: 0, est: 15 },
  400: { key: '400', D: 400, name: '400m', cmd: 'set', lanes: 'all', vmax: 22, energy: 1 / 22, est: 20 },
  800: { key: '800', D: 800, name: '800m', cmd: 'marks', lanes: 'break', vmax: 34, energy: 1 / 15, est: 27 },
  relay: { key: 'relay', D: 400, name: '4×100m 계주', cmd: 'set', lanes: 'all', vmax: 13, energy: 0, est: 45, legs: 4 },
};
export const EV_KEYS = ['100', '200', '400', '800', 'relay'];
// 4×100m 배턴 교환 구역: 각 구간 표시선 앞 20m ~ 뒤 10m (30m, 2018년 개정 이후 하나의 구역)
export const ZONES = [[80, 110], [180, 210], [280, 310]];

// 주로 경로 위 한 점: s = 결승선에서 달리는 방향으로 잰 거리(음수 = 결승선 전) · rm 측정 반지름 · rc 그림 반지름
export function pathXY(s, rm, rc) {
  const lap = 2 * S + 2 * Math.PI * rm; s = ((s % lap) + lap) % lap; const bend = Math.PI * rm;
  if (s < bend) { const a = s / rm; return [S / 2 + rc * Math.sin(a), rc * Math.cos(a), -a]; } // 1곡선 (위로)
  s -= bend; if (s < S) return [S / 2 - s, -rc, -Math.PI]; // 백스트레치 (왼쪽으로)
  s -= S; if (s < bend) { const a = s / rm; return [-S / 2 - rc * Math.sin(a), -rc * Math.cos(a), -Math.PI - a]; } // 2곡선 (아래로)
  s -= bend; return [-S / 2 + s, rc, 0]; // 홈 직선 (오른쪽으로)
}
// 선수 위치: ev 종목 · L 주로 · d 출발 후 달린 거리 → [x, y, 방향]
export function runXY(ev, L, d) {
  if (ev === '100') return [S / 2 - 100 + d, rCen(L), 0]; // 100m: 홈 직선 연장(슈트)에서 출발
  if (ev === '800') {
    const st = Math.PI * (rMeas(L) - rMeas(1)); // 첫 곡선 1번 구간만큼 앞에서 출발(곡선 한 번 엇갈린 출발)
    if (d <= BREAK) return pathXY(st + d, rMeas(L), rCen(L));
    const k = Math.min(1, (d - BREAK) / MERGE); const rc = rCen(L) + (rCen(1) - rCen(L)) * k;
    return pathXY(d, rMeas(1), rc); // 브레이크라인 뒤: 1주로 기준 거리로 달림 (공식 브레이크라인 곡선이 이 차이를 맞춰 줌 → 게임은 같은 거리로 단순화)
  }
  const D = ev === '200' ? 200 : 400; return pathXY(d - D, rMeas(L), rCen(L)); // 200·400·계주: 자기 주로 안에서 D만큼 → 바깥 주로일수록 앞에서 출발(엇갈린 출발)
}
// 출발선이 1주로보다 얼마나 앞에 있는지(m) — 화면 안내용
export function staggerOf(ev, L) {
  if (ev === '100') return 0;
  if (ev === '800') return Math.PI * (rMeas(L) - rMeas(1));
  return (ev === '200' ? 1 : 2) * Math.PI * (rMeas(L) - rMeas(1)); // 200: 곡선 1번만큼 · 400·계주: 곡선 2번만큼
}

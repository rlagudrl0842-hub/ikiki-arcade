// 게임 공통 도구
export const AGE_LABEL = { kid: '유아', elem: '초등', adult: '성인' };
export const LV = { kid: 0, elem: 1, adult: 2 };
// 연령 6단계: 영아·유아·초등·중등·고등·성인. 게임 데이터는 3단계(kid/elem/adult)를 기본으로 쓰고, lv(0~5)로 세밀하게 조절
export const AGES6 = ['baby', 'kid', 'elem', 'mid', 'high', 'adult'];
export const BASE3 = { baby: 'kid', kid: 'kid', elem: 'elem', mid: 'adult', high: 'adult', adult: 'adult' };
export const LV6 = { baby: 0, kid: 1, elem: 2, mid: 3, high: 4, adult: 5 };
export const by6 = (lv, arr) => arr[Math.max(0, Math.min(5, lv ?? 2))];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const round1 = (v) => Math.round(v * 10) / 10;

// 원점수 → 0~100 환산 (연령별 기준값 ref = 100점에 해당하는 원점수)
export const norm = (raw, ref) => round1(clamp((raw / ref) * 100, 0, 100));

// 낮을수록 좋은 기록(오차, 시간) → 0~100. good 이하면 100점, bad 이상이면 0점
export const normLow = (v, good, bad) => round1(clamp(((bad - v) / (bad - good)) * 100, 0, 100));

// 연타형 입력 속도 제한: 1초에 최대 maxRate 회까지만 인정
export class TapLimiter {
  constructor(maxRate) { this.max = maxRate; this.buckets = new Map(); }
  // n번 눌렀다고 보고 → 실제 인정 횟수 반환
  take(id, n, now) {
    let b = this.buckets.get(id);
    if (!b) { b = { tokens: this.max, at: now }; this.buckets.set(id, b); }
    b.tokens = Math.min(this.max * 1.2, b.tokens + ((now - b.at) / 1000) * this.max);
    b.at = now;
    const ok = Math.max(0, Math.min(Math.floor(b.tokens), n | 0));
    b.tokens -= ok;
    return ok;
  }
}

// 정수 범위 검증
export const intIn = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
// 입력 도착 지연 추적: 최근 지연의 90%값 + 여유 → 팀 판정을 그만큼 늦춰서 늦게 온 입력도 반영
export function lagTracker(min = 250, max = 1200) {
  const a = []; let i = 0;
  return { add(ms) { if (!(ms >= -500 && ms < 5000)) return; a[i++ % 64] = Math.max(0, ms); }, grace() { if (!a.length) return min; const s = a.slice().sort((x, y) => x - y); return Math.min(max, Math.max(min, s[Math.floor(s.length * 0.9)] + 150)); } };
}
// 누른 시각(ts)이 서버 시각 기준 이 범위 안이면 받음 (늦게 도착 2.5초까지)
export const tsOk = (ts, now) => typeof ts === 'number' && Number.isFinite(ts) && ts >= now - 2500 && ts <= now + 1000;
export const numIn = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;

export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

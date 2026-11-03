// 게임 공통 도구
export const AGE_LABEL = { kid: '유아', elem: '초등', adult: '성인' };
export const LV = { kid: 0, elem: 1, adult: 2 };

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
export const numIn = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;

export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

/**
 * 검증 랜딩(/lp) 공용 계약·상수 — 클라이언트/서버 겸용(부수효과 없음).
 * 목적: MVP 실효성 조사 — 상담 신청(주 지표)·자료받기(보조)·유입 소스 태깅.
 * 오퍼는 "진단 리포트 정가 30만원 → 파일럿 참여 브랜드에 무료(전체 리포트) 제공"의 가짜문(fake door):
 * 실제 가격을 노출한 상태로 클릭·신청하게 해서 "지불 의향"을 재는 게 이 페이지의 존재 이유다.
 * ※ 스튜디오 크레딧은 무료 오퍼에서 제거(확정 2026-07-23) — 유료 오픈(MVP 종료 후)의 지렛대로 아낀다.
 *    studioCreditCount는 그 유료 단계용으로 보존만 하고, MVP 랜딩에는 노출하지 않는다.
 */

/** 주력 판매 채널 — 상담 폼 칩(복수 선택) */
export const LEAD_CHANNELS = [
  { value: 'qoo10', label: 'Qoo10' },
  { value: 'rakuten', label: '라쿠텐' },
  { value: 'amazon', label: '아마존 재팬' },
  { value: 'cosme', label: '@cosme' },
  { value: 'own', label: '자사몰' },
  { value: 'undecided', label: '아직 미정' },
] as const;

/** 브랜드 현재 단계 — 상담 폼 단일 선택 */
export const LEAD_STAGES = [
  { value: 'prep', label: '입점 준비 중' },
  { value: 'live_stuck', label: '운영 중인데 정체' },
  { value: 'research', label: '진출 검토 단계' },
] as const;

/** 현재 고통점 — 상담 폼 칩(복수 선택). 요구 적합도 검증의 정성 데이터 */
export const PAIN_POINTS = [
  '번역이 일본에서 통할지 모르겠다',
  '리뷰(口コミ)·랭킹이 오르지 않는다',
  '약기법(薬機法) 표현이 걱정된다',
  '콘텐츠 만들 리소스가 없다',
  '대행 견적이 부담된다',
] as const;

/**
 * 파일럿 오퍼 — 지불의향 측정 기준. reportListPrice는 실제 정가(가짜문에 노출).
 * MVP 오퍼 = 무료 전체 리포트(크레딧 없음). studioCreditCount는 유료 오픈용 보존값.
 */
export const PILOT_OFFER = {
  /** 진단 리포트 정가(원) — 화면에 노출하는 실제 가격 */
  reportListPrice: 300000,
  /** [MVP 미노출] 유료 오픈 시 제공할 스튜디오 크레딧 횟수(N) — 무료 오퍼에선 쓰지 않는다 */
  studioCreditCount: 3,
  /** 파일럿 모집 정원(선착순 프레이밍) — 희소성 표기용, 운영값 */
  pilotSeats: 10,
} as const;

/** 리드 종류 — consultation(주 지표) / resource(보조: 자료받기) */
export type LeadKind = 'consultation' | 'resource';
export const LEAD_KINDS: readonly LeadKind[] = ['consultation', 'resource'];

/** 전환 퍼널 이벤트 — 방문→CTA클릭→영상재생→신청 */
export type TrackEventType = 'pageview' | 'cta_click' | 'video_play' | 'lead_submit';
export const TRACK_EVENT_TYPES: readonly TrackEventType[] = [
  'pageview',
  'cta_click',
  'video_play',
  'lead_submit',
];

const CHANNEL_VALUES = LEAD_CHANNELS.map((c) => c.value as string);
const STAGE_VALUES = LEAD_STAGES.map((s) => s.value as string);
const PAIN_VALUES = PAIN_POINTS as readonly string[];

/** 서버 입력 정제용 — 알려진 값만 통과시킨다 */
export function isKnownChannel(v: unknown): v is string {
  return typeof v === 'string' && CHANNEL_VALUES.includes(v);
}
export function isKnownStage(v: unknown): v is string {
  return typeof v === 'string' && STAGE_VALUES.includes(v);
}
export function isKnownPainPoint(v: unknown): v is string {
  return typeof v === 'string' && PAIN_VALUES.includes(v);
}

/** 채널/단계 value → 라벨(대시보드·확인 화면 표시용) */
export function channelLabel(value: string): string {
  return LEAD_CHANNELS.find((c) => c.value === value)?.label ?? value;
}
export function stageLabel(value: string): string {
  return LEAD_STAGES.find((s) => s.value === value)?.label ?? value;
}

/** 30만원 → "30만원" 표기 */
export function formatKrw(won: number): string {
  if (won % 10000 === 0) return `${won / 10000}만원`;
  return `${won.toLocaleString('ko-KR')}원`;
}

/**
 * 유입 소스 태그를 URL·referrer에서 뽑는다(클라이언트에서 호출).
 * 우선순위: utm_source > src > referrer 호스트 > 'direct'. 최대 80자.
 */
export function resolveSource(search: string, referrer: string): string {
  const params = new URLSearchParams(search);
  const explicit = params.get('utm_source') || params.get('src');
  if (explicit) return explicit.slice(0, 80);
  if (referrer) {
    try {
      return new URL(referrer).hostname.slice(0, 80);
    } catch {
      /* referrer가 URL이 아니면 무시 */
    }
  }
  return 'direct';
}

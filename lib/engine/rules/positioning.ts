/**
 * 브랜드 포지셔닝 택소노미 (스펙 §3.1 v4) — 폼 칩 + 콜③ 페이로드의 공용 정의.
 * 창작 금지(증거 원칙): 모든 태그는 실재 자산에서 도출했다 —
 *   렉시콘 = data/processed/sns-lexicon.csv (frequency = 라쿠텐 실측 빈도)
 *   루브릭 = docs/research/jp-detail-message-patterns.md §2·§4 (A~E 그룹)
 *   페르소나 = .claude/agents/persona_01~20 (시뮬레이션 검증된 실제 브랜드 컨셉)
 *
 * ⚠ 폼('use client')에서 import되므로 아무것도 import하지 않는 잎 노드로 유지할 것.
 * ⚠ 목록 개정은 제품 오너 승인 사항 — 임의 추가·삭제 금지(DECISIONS 2026-07-16 입력 재구성 행).
 */

export interface PositioningTag {
  /** 저장·전송용 안정 키 */
  value: string;
  /** 폼 칩·콜③ 페이로드에 쓰는 한국어 라벨 */
  label: string;
}

export const POSITIONING_TAGS: readonly PositioningTag[] = [
  { value: 'sensitive', label: '민감 피부·저자극' }, // 렉시콘 敏感肌 119·低刺激 — cleansing 관례(루브릭 §2-d)
  { value: 'freeFormula', label: '무첨가·프리 처방' }, // 렉시콘 無添加 64 · ○○フリー — 루브릭 B군("무엇을 뺐나"로 안심을 판다)
  { value: 'ingredientLed', label: '성분 집중' }, // 렉시콘 성분 15종(레티놀·나이아신아마이드 등) — 루브릭 D군(성분+농도+메커니즘)
  { value: 'derma', label: '더마·피부과학' }, // 페르소나 P06(더마 립)·P18(더마·두피) — ドクターズコスメ 관례
  { value: 'cleanVegan', label: '클린·비건' }, // 페르소나 P07(클린·비건)·P13(클린·더마)
  { value: 'moisture', label: '보습·장벽' }, // 렉시콘 保湿 209(효과소구 1위)·乾燥 115
  { value: 'calming', label: '진정 케어' }, // 페르소나 P03(병풀 진정 앰플) — CICA 골든 샘플
  { value: 'pore', label: '모공·피지 케어' }, // 렉시콘 毛穴 186(피부고민 2위)·黒ずみ 47
  { value: 'tone', label: '톤·브라이트닝' }, // 렉시콘 美白 52 — ⚠ 미백 소구는 의약외품 효능(약기법 감사에서 확인됨)
  { value: 'firming', label: '탄력·안티에이징' }, // 렉시콘 ハリ 53
  { value: 'efficacy', label: '효능 근거·기능성' }, // 렉시콘 医薬部外品 71 · 効能評価試験済み — 루브릭 A군
  { value: 'mens', label: '남성 특화' }, // 렉시콘 メンズ 55 — 페르소나 P05(남성 올인원)
  { value: 'kTrend', label: 'K뷰티 트렌드' }, // 렉시콘 韓国コスメ 90(트렌드)
  { value: 'value', label: '가성비' }, // 페르소나 다수(P08·P10 품의형)의 가격 감도 축
  { value: 'sensorial', label: '향·질감 감성' }, // 렉시콘 질감 5종(しっとり 50) — 페르소나 P20(향·바디)
  { value: 'minimal', label: '미니멀 처방' }, // 페르소나 P19(미니멀 스킨케어)
] as const;

/** 폼·서버가 공유하는 선택 개수 제한 (스펙 §3.1: 1~5개) */
export const POSITIONING_TAGS_MIN = 1;
export const POSITIONING_TAGS_MAX = 5;

/** 자유 서술 최대 길이 (스펙 §3.1: 0~500자) */
export const POSITIONING_NOTE_MAX = 500;

const LABEL_BY_VALUE = new Map(POSITIONING_TAGS.map((t) => [t.value, t.label]));

/** 알려진 태그 value인지 — 서버 검증용 */
export function isKnownPositioningTag(value: string): boolean {
  return LABEL_BY_VALUE.has(value);
}

/** 태그 value 배열 → 한국어 라벨 배열(미지 값은 걸러냄) — 콜③ 페이로드·표지 표기용 */
export function positioningTagLabels(values: string[]): string[] {
  return values.map((v) => LABEL_BY_VALUE.get(v)).filter((l): l is string => Boolean(l));
}

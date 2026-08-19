/**
 * 출력 언어 판정 — ① 리포트의 언어 계약을 코드로 강제하기 위한 유틸.
 *
 * 왜 필요한가: 리포트의 독자는 **일본어를 못 읽는 한국 브랜드 담당자와 그 결재자**다(스펙 §2·US-3).
 * 그런데 콜①~⑤의 grounding 에는 코퍼스·렉시콘·규정이 일본어로 대량 주입된다. 모델이 그쪽으로
 * 끌려가 서술까지 일본어로 내는 표류가 실측됐고(콜③ 전 필드), `validate` 에 언어 검사가 없어
 * 그대로 발행됐다.
 *
 * ⚠ **"가나가 없으면 한국어"로 판정하면 안 된다.** 정상 계약에도 일본어가 섞인다 —
 *   `persona.name: 'ユイ'` · `skinConcerns: ['乾燥','肌あれ']` · `trustTriggers: ['効能評価試験済み']`
 *   처럼 **일본 고객의 어휘 자체**가 값인 필드가 있고, 한국어 서술 안에 「口コミ」 같은 관례어도 들어간다.
 *   그래서 판정 기준은 존재 여부가 아니라 **한국어 우세 비율**이다.
 */

/**
 * 한글 문자 — 완성형만 보면 안 된다. 자모 단독(ㄱ·ㅏ)도 한글이다.
 * `lib/studio/detail/translate.ts` 가 이 정의를 re-export 한다(정규식이 두 벌로 갈리지 않도록).
 */
const HANGUL_RE = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힣ힰ-퟿]/;

/** 가나(히라가나·가타카나·가타카나 확장·반각 가타카나) */
const KANA_RE = /[぀-ゟ゠-ヿㇰ-ㇿｦ-ﾝ]/;

/** 한자(CJK 통합 한자 + 확장 A). 한국어에도 드물게 쓰이므로 단독으로는 일본어 신호가 아니다 */
const HAN_RE = /[㐀-䶿一-鿿]/;

/** 전역 매칭용(문자 수를 세는 쪽) — 위 상수에 g 플래그를 붙여 재사용하면 lastIndex 가 새므로 따로 둔다 */
const HANGUL_G = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힣ힰ-퟿]/g;
const JP_G = /[぀-ゟ゠-ヿㇰ-ㇿｦ-ﾝ㐀-䶿一-鿿]/g;

/**
 * 인용 스팬 — 한국어 서술 안에서 일본어를 「」로 인용하는 것은 **계약이 권장하는 형태**다.
 * 비율 계산 전에 걷어내지 않으면 인용을 많이 단 정상 문장이 표류로 잡힌다.
 */
const QUOTED_SPAN_RE = /「[^」]*」|『[^』]*』|“[^”]*”|"[^"]*"/g;

/** @param text 검사 대상 */
export function hasHangul(text: string): boolean {
  return HANGUL_RE.test(text);
}

/** 가나 또는 한자가 있는가 — 일본어 문자 존재 여부 */
export function hasKanaOrKanji(text: string): boolean {
  return KANA_RE.test(text) || HAN_RE.test(text);
}

/** 인용 스팬을 걷어낸 본문 — 비율 판정의 실제 대상 */
export function stripQuotedSpans(text: string): string {
  return text.replace(QUOTED_SPAN_RE, ' ');
}

/**
 * 한국어 우세 비율 — 인용을 걷어낸 뒤 `한글 / (한글 + 일본어 문자)`.
 * 문자 종류가 하나도 없으면(숫자·기호·영문만) 1을 돌려준다 — 판정 대상이 아니라는 뜻.
 *
 * @param text 검사 대상
 */
export function koreanRatio(text: string): number {
  const body = stripQuotedSpans(text);
  const ko = (body.match(HANGUL_G) ?? []).length;
  const jp = (body.match(JP_G) ?? []).length;
  if (ko + jp === 0) return 1;
  return ko / (ko + jp);
}

/**
 * 한국어 우세 서술인가.
 *
 * 임계값 0.35의 근거(목 픽스처 `mockCall3` = 계약 정본, 실측 로그 = 표류 사례):
 * - 통과해야 하는 정상값: `'탐색: 口コミ·랭킹에서 검증'`(0.73) · `'成分·フリー処方 라벨 확인'`(0.43)
 * - 검출해야 하는 표류값: `'認知：SNS…でシカアンプルを発見し…'`(0.0) · `'日本の敏感肌ユーザーは…'`(0.0)
 *
 * @param text 검사 대상
 */
export function isKoreanDominant(text: string): boolean {
  if (!text.trim()) return true; // 빈 값은 언어 문제가 아니다(증거 원칙상 정당한 빈 값이 있다)
  return koreanRatio(text) >= KOREAN_DOMINANT_THRESHOLD;
}

export const KOREAN_DOMINANT_THRESHOLD = 0.35;

/**
 * 일본어 필수 필드용 — 한글이 남아 있지 않고 일본어 문자가 있는가.
 * `verifyTranslation`(② 축)이 "한글 잔존 금지"를 쓰는 것과 같은 판정이다.
 *
 * @param text 검사 대상
 */
export function isJapanese(text: string): boolean {
  if (!text.trim()) return true; // 빈 값 허용 — altTextJa 는 '가능' 판정이면 빈 문자열이 계약이다
  return !hasHangul(text) && hasKanaOrKanji(text);
}

// ── 값 보존 검사 ─────────────────────────────────────────────────────────────

/**
 * 숫자 지문 — 표기 형식은 무시하고 **수치 자체**만 뽑는다.
 *
 * 형식 변화는 정상이고 오히려 바람직하다: `2026.04.15` → `2026年4月15日`,
 * `163,991` → `累計163,991個`. 그래서 (1) 전각→반각 (2) 천단위 쉼표 제거 → (3) 숫자 런 추출
 * → (4) 앞자리 0 제거 순으로 정규화한 뒤 이어 붙인다. 값이 실제로 바뀌면 즉시 갈린다.
 *
 * ① 리포트(점수·건수)와 ② 스튜디오(가격·SPF·시험 인원)가 같은 판정을 쓰므로 여기 둔다 —
 * 두 벌로 갈리면 한쪽만 느슨해진다.
 *
 * @param text 원문 또는 변환문
 */
export function digitSignature(text: string): string {
  const normalized = text
    // 전각 숫자 → 반각
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    // 천단위 구분자(반각·전각) 제거 — 넣고 빼는 건 표기 차이지 값 변화가 아니다
    .replace(/[,，]/g, '');
  const tokens = normalized.match(/\d+/g) ?? [];
  return tokens.map((t) => t.replace(/^0+(?=\d)/, '')).join(',');
}

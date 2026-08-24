/**
 * 콜 응답의 **출력 언어 계약** 검사 — 08 §4 계약의 언어 축.
 *
 * 계약 정본은 목 픽스처 `mockCall3`(fixtures.ts)이다. 그 픽스처가 "서술은 한국어, 일본 고객의
 * 어휘·의문 원문만 일본어"라는 의도를 정확히 보여주는데, 실모드는 이 계약을 지키지 않았다
 * (콜③ 전 필드 일본어 → 브랜드 진단은 리포트 통째로 일본어 발행).
 *
 * 정책은 세 가지뿐이다.
 *  - `ko`   한국어 우세 서술. 「」 안 일본어 인용은 허용된다(오히려 권장 형태)
 *  - `ja`   일본어 필수. 한글이 남으면 안 된다
 *  - (미선언) 검사하지 않음 — 고객 원문 인용, 코퍼스 실측 인용, 일본어 어휘 목록
 *
 * ⚠ 미선언이 곧 `free` 다. **일본어 어휘가 값 자체인 필드**(`skinConcerns: ['乾燥','肌あれ']`,
 *   `trustTriggers: ['効能評価試験済み']`)를 `ko` 로 잘못 선언하면 정상 계약이 오탐된다.
 */

import { isJapanese, isKoreanDominant, koreanRatio } from '../lang';

export type FieldPolicy = 'ko' | 'ja';

/**
 * 검사 경로. `[]` 는 배열 전개다.
 * 예: `items[].criterionRef` · `journey.stages[]` · `objections[].why`
 */
export interface PolicyRule {
  path: string;
  policy: FieldPolicy;
}

export interface LanguageViolation {
  /** 실제 위반이 난 자리(배열 인덱스가 박힌 구체 경로) */
  path: string;
  policy: FieldPolicy;
  text: string;
}

export interface LanguageReport {
  violations: LanguageViolation[];
  /** 검사된 `ko` 필드 수 — 통째 표류 판정의 분모 */
  koChecked: number;
  /** 위반한 `ko` 필드 수 */
  koViolated: number;
}

/** 경로 하나를 따라가며 문자열 값을 모은다(`[]` 는 전개). 없는 경로는 조용히 건너뛴다 */
function collect(node: unknown, segments: string[], prefix: string, out: { path: string; value: string }[]): void {
  if (node === null || node === undefined) return;

  if (segments.length === 0) {
    if (typeof node === 'string') out.push({ path: prefix, value: node });
    return;
  }

  const [head, ...rest] = segments;

  if (head === '[]') {
    if (!Array.isArray(node)) return;
    node.forEach((item, i) => collect(item, rest, `${prefix}[${i}]`, out));
    return;
  }

  if (typeof node !== 'object') return;
  const next = (node as Record<string, unknown>)[head];
  collect(next, rest, prefix ? `${prefix}.${head}` : head, out);
}

/** `items[].criterionRef` → `['items', '[]', 'criterionRef']` */
function parsePath(path: string): string[] {
  return path
    .split('.')
    .flatMap((seg) => (seg.endsWith('[]') ? [seg.slice(0, -2), '[]'] : [seg]))
    .filter(Boolean);
}

/**
 * 응답 전체를 정책표에 대고 검사한다.
 * @param data 콜 응답 객체
 * @param rules 콜별 정책표
 */
export function evaluateLanguage(data: unknown, rules: PolicyRule[]): LanguageReport {
  const violations: LanguageViolation[] = [];
  let koChecked = 0;
  let koViolated = 0;

  for (const rule of rules) {
    const found: { path: string; value: string }[] = [];
    collect(data, parsePath(rule.path), '', found);

    for (const { path, value } of found) {
      if (rule.policy === 'ko') {
        // 빈 값은 언어 문제가 아니다 — 증거 원칙상 정당한 빈 값이 있다(가격 미제공 등)
        if (!value.trim()) continue;
        koChecked += 1;
        if (!isKoreanDominant(value)) {
          koViolated += 1;
          violations.push({ path, policy: 'ko', text: value });
        }
      } else if (!isJapanese(value)) {
        violations.push({ path, policy: 'ja', text: value });
      }
    }
  }

  return { violations, koChecked, koViolated };
}

/** 교정 지시 하나에 담을 위반 예시 수 — 너무 많으면 프롬프트가 길어져 본론이 묻힌다 */
const MAX_EXAMPLES = 6;

/**
 * 위반을 모델이 고칠 수 있는 교정 지시로 바꾼다. 위반이 없으면 null.
 * 경로를 그대로 짚어 준다 — "어디를" 이 빠지면 모델이 엉뚱한 필드를 건드린다.
 */
export function languageRepairMessage(report: LanguageReport): string | null {
  if (report.violations.length === 0) return null;

  const ko = report.violations.filter((v) => v.policy === 'ko');
  const ja = report.violations.filter((v) => v.policy === 'ja');
  const lines: string[] = [
    '출력 언어 계약을 어긴 필드가 있다. 아래 필드만 고쳐서 전체를 다시 내라 — 다른 필드는 그대로 둔다.',
  ];

  if (ko.length) {
    lines.push(
      `[한국어로 다시 쓸 것 — ${ko.length}개] 아래 필드는 일본어를 못 읽는 한국 담당자가 읽는 서술이다. ` +
        `내용은 유지하고 한국어 문장으로 옮겨라. 일본 관례어를 짚어야 하면 「」로 인용하고 뜻은 한국어로 밝힌다.`,
    );
    for (const v of ko.slice(0, MAX_EXAMPLES)) {
      lines.push(`  · ${v.path} (한국어 비율 ${koreanRatio(v.text).toFixed(2)}): "${v.text.slice(0, 60)}"`);
    }
    if (ko.length > MAX_EXAMPLES) lines.push(`  · 그 외 ${ko.length - MAX_EXAMPLES}개도 같은 기준으로 고칠 것`);
  }

  if (ja.length) {
    lines.push(`[일본어로 다시 쓸 것 — ${ja.length}개] 아래 필드는 일본어 슬롯이다. 한글을 남기지 마라.`);
    for (const v of ja.slice(0, MAX_EXAMPLES)) {
      lines.push(`  · ${v.path}: "${v.text.slice(0, 60)}"`);
    }
  }

  return lines.join('\n');
}

/**
 * 통째 표류인가 — `ko` 필드의 대부분이 한국어가 아닌 상태.
 *
 * 이건 "일부 필드가 흔들렸다"가 아니라 **콜이 언어를 통째로 잘못 잡았다**는 뜻이라
 * 교정으로 수습하지 않고 잡 실패 경로로 보낸다. 일본어 리포트를 발행하느니 기존 폴백
 * (풀 모드 콜③ → 카테고리 일반형 / 브랜드 모드 → 잡 실패)에 맡기는 게 낫다.
 */
export const WHOLESALE_DRIFT_RATIO = 0.8;

/** @param report evaluateLanguage 결과 */
export function isWholesaleDrift(report: LanguageReport): boolean {
  // 표본이 너무 적으면 비율이 튄다 — 3개 미만은 통째 표류로 단정하지 않는다
  if (report.koChecked < 3) return false;
  return report.koViolated / report.koChecked >= WHOLESALE_DRIFT_RATIO;
}

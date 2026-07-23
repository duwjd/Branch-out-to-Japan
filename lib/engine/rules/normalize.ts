/**
 * 파이프라인 1단계 — 콘텐츠 수집·정규화(규칙).
 * URL 또는 텍스트를 평문으로 만들고 문장 K1..Kn으로 분해한다(ID는 코드가 부여 — 08 §3.2).
 * 검증 게이트: 50자 미만은 폼에서 차단되지만 서버에서도 재검증한다.
 */

import type { BrandProductInput, NormalizedContent, Sentence } from '../types';
import { HARD_GATE_CHARS, SOFT_LINE_CHARS, contentCharCount } from './gates';

const MAX_SENTENCES = 40;

/** URL 폴백 안내를 담아 던지는 오류 — 화면은 이 메시지로 텍스트 붙여넣기 1급 경로를 안내한다(AC-1.3) */
export class SourceContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceContentError';
  }
}

/** 평문을 문장 단위로 분해하고 K1..Kn ID를 부여한다 */
export function splitSentences(plainText: string): Sentence[] {
  const chunks = plainText
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 4);
  return chunks.slice(0, MAX_SENTENCES).map((text, i) => ({ id: `K${i + 1}`, text }));
}

/**
 * 제품 콘텐츠(source)를 정규화 산출물로 변환한다 — 브랜드+제품 진단 전용(스펙 §3.3).
 * 이미지 모드는 콜⓪ 비전 추출 결과(extractedText)를 파이프라인이 넘겨준다(v7). 텍스트 모드는 붙여넣기 원문.
 */
export async function normalizeContent(
  input: BrandProductInput,
  extractedText?: string,
): Promise<NormalizedContent> {
  const raw = input.sourceType === 'image' ? (extractedText ?? '').trim() : (input.sourceText ?? '').trim();

  const plainText = raw.replace(/\r/g, '');
  const charCount = contentCharCount(plainText);

  if (charCount < HARD_GATE_CHARS) {
    // 이미지 모드는 추출 실패 문법(두 출구 안내), 텍스트 모드는 하드 게이트 문법
    throw new SourceContentError(
      input.sourceType === 'image'
        ? '이미지에서 글자를 충분히 읽지 못했습니다. 텍스트 붙여넣기로 다시 시도하거나, 콘텐츠를 비우고 제출하면 브랜드 진단만 받을 수 있습니다.'
        : `최소 ${HARD_GATE_CHARS}자 이상 콘텐츠가 필요합니다(현재 ${charCount}자).`,
    );
  }

  return {
    plainText,
    sentences: splitSentences(plainText),
    charCount,
    precisionLimited: charCount < SOFT_LINE_CHARS,
  };
}

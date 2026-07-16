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

/** HTML에서 본문 텍스트만 남긴다(간이 — 이미지 위주 상세는 텍스트가 빈약할 수 있음, 스펙 §9-Q1) */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** URL에서 텍스트를 가져온다. 실패·빈약 시 SourceContentError(텍스트 붙여넣기 안내). */
async function fetchUrlText(url: string): Promise<string> {
  let html: string;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'user-agent': 'Mozilla/5.0 (report-diagnosis-bot)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    throw new SourceContentError(
      `URL을 가져오지 못했습니다(${String((err as Error)?.message ?? err)}). 상세페이지 텍스트를 직접 붙여넣어 주세요 — 이미지 위주 페이지는 붙여넣기가 가장 정확합니다. 또는 콘텐츠를 비우고 제출하면 제품 정보 없이 브랜드 진단만 받으실 수 있습니다.`,
    );
  }
  const text = stripHtml(html);
  if (text.length < HARD_GATE_CHARS) {
    throw new SourceContentError(
      'URL에서 추출된 텍스트가 너무 적습니다(이미지 위주 상세로 보입니다). 상세페이지 문구를 직접 붙여넣어 주세요. 또는 콘텐츠를 비우고 제출하면 브랜드 진단만 받으실 수 있습니다.',
    );
  }
  return text;
}

/** 평문을 문장 단위로 분해하고 K1..Kn ID를 부여한다 */
export function splitSentences(plainText: string): Sentence[] {
  const chunks = plainText
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 4);
  return chunks.slice(0, MAX_SENTENCES).map((text, i) => ({ id: `K${i + 1}`, text }));
}

/** 제품 콘텐츠(source)를 정규화 산출물로 변환한다 — 브랜드+제품 진단 전용(브랜드 진단은 이 단계가 없다, 스펙 §3.3) */
export async function normalizeContent(input: BrandProductInput): Promise<NormalizedContent> {
  const raw =
    input.sourceType === 'url'
      ? await fetchUrlText(input.sourceUrl ?? '')
      : (input.sourceText ?? '').trim();

  const plainText = raw.replace(/\r/g, '');
  const charCount = contentCharCount(plainText);

  if (charCount < HARD_GATE_CHARS) {
    throw new SourceContentError(`최소 ${HARD_GATE_CHARS}자 이상 콘텐츠가 필요합니다(현재 ${charCount}자).`);
  }

  return {
    plainText,
    sentences: splitSentences(plainText),
    charCount,
    precisionLimited: charCount < SOFT_LINE_CHARS,
  };
}

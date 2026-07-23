/**
 * 콜⓪ — 상세페이지 이미지 비전 추출(스펙 §3 v7). 이미지 모드에서만 돈다.
 * 이미지에 보이는 문구(텍스트)만 위→아래 순서로 추출한다 — 판정·평가·창작 없음, grounding 없음.
 * 추출 실패(불능·읽은 글자 빈약)는 파이프라인이 잡 실패로 다룬다(조용한 강등 X, PROCESS-02).
 */

import { runStructuredCall } from './client';
import type { LogSink } from './calls';
import { readStoredFile } from '../../files/storage';
import { SourceContentError } from '../rules/normalize';
import type { ProductClass } from '../types';

export interface Call0Result {
  /** 추출된 평문(위→아래 순서) */
  plainText: string;
  /** 추출 신뢰도 */
  confidence: 'high' | 'medium' | 'low';
}

const CALL0_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['plainText', 'confidence'],
  properties: {
    plainText: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
} as const;

const CALL0_SYSTEM = `당신은 일본 이커머스 상세페이지 이미지에서 "보이는 문구(텍스트)만" 추출하는 도구입니다.
- 판정·평가·요약·창작을 하지 마세요. 이미지에 실제로 보이는 글자만 위→아래, 왼→오른쪽 순서로 옮겨 적습니다.
- 일본어·한국어·영문·숫자는 원문 그대로 둡니다(번역 금지).
- 여러 장이면 준 순서(상세페이지 위→아래)대로 이어 붙입니다.
- 읽을 수 있는 글자가 거의 없으면 plainText를 빈 문자열로 두고 confidence를 low로 둡니다.`;

/** 목 모드 응답 — 카테고리 일반 상세 문구(≥50자로 게이트 통과, 실모드와 무관한 데모 로직) */
const MOCK_CALL0: Call0Result = {
  plainText:
    '効能評価試験済み。敏感肌にも使える低刺激設計。無香料・無着色・パラベンフリー。セラミド配合でうるおいのバリアを守り、乾燥による小じわを目立たなくします。皮膚科医監修のもとパッチテスト済み（すべての方に刺激が起きないわけではありません）。',
  confidence: 'medium',
};

/** 이미지 fileId 배열을 읽어 비전 추출한다. 유효 이미지가 없으면 SourceContentError(잡 실패) */
export async function runCall0(
  imageFileIds: string[],
  productClass: ProductClass,
  onLog?: LogSink,
): Promise<Call0Result> {
  const images: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; dataBase64: string }[] = [];
  for (const fid of imageFileIds.slice(0, 10)) {
    const file = await readStoredFile(fid);
    if (!file) continue;
    const mt = file.contentType;
    if (mt !== 'image/png' && mt !== 'image/jpeg' && mt !== 'image/webp') continue;
    images.push({ mediaType: mt, dataBase64: file.buf.toString('base64') });
  }
  if (images.length === 0) {
    throw new SourceContentError(
      '이미지를 읽지 못했습니다. 텍스트 붙여넣기로 다시 시도하거나, 콘텐츠를 비우고 제출하면 브랜드 진단만 받을 수 있습니다.',
    );
  }

  return runStructuredCall<Call0Result>({
    callName: 'call0',
    system: CALL0_SYSTEM,
    userPayload: `제품 분류: ${productClass}\n이 상세페이지 이미지들에서 보이는 문구를 순서대로 추출해 주세요.`,
    schema: CALL0_SCHEMA,
    maxTokens: 4000,
    images,
    mockData: MOCK_CALL0,
    onLog,
  });
}

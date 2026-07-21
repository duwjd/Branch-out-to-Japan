/**
 * ② 스튜디오 목 픽스처 — 키 없이 전체 플로우를 확인한다(리포트 llm/fixtures 패턴).
 * 슬롯 값은 스펙 §3 골든 픽스처(HARUON 톤업 선케어) 계열의 결정적 상수다.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { StudioCopyResult } from './copyCall';
import { getStyle, type StyleId } from './promptPack';

/** 스타일 → 목 생성 이미지(프로토타입 실측 샘플) — F는 샘플이 없어 clean으로 폴백 */
const MOCK_IMAGE_BY_STYLE: Record<StyleId, string> = {
  A: 'haruon-clean.png',
  B: 'haruon-texture.png',
  C: 'haruon-official.png',
  D: 'haruon-copy-ingredient.png',
  E: 'haruon-award.png',
  F: 'haruon-clean.png',
  G: 'haruon-promo.png',
  H: 'haruon-premium.png',
};

/** 목 모드 생성 이미지 읽기 — dev 전제로 docs 프로토타입 자산을 그대로 쓴다(09 §4b M6) */
export function mockImageBuffer(styleId: StyleId): Buffer {
  const file = MOCK_IMAGE_BY_STYLE[styleId] ?? 'haruon-clean.png';
  return readFileSync(path.join(process.cwd(), 'docs/specs/02-studio/assets/samples', file));
}

/** 스타일별 목 슬롯 값 — required 텍스트 슬롯을 전부 채운다(배지·가격 슬롯은 코드 소유라 제외) */
function mockSlotValues(styleId: StyleId, brandName: string): { key: string; value: string }[] {
  switch (styleId) {
    case 'A':
      return [{ key: 'compositionNote', value: '' }];
    case 'B':
      return [
        { key: 'textureDescription', value: 'a soft white tone-up cream smear, thick at the top and tapering down' },
        { key: 'shadeColor', value: 'soft ivory white (#F4EFE8)' },
      ];
    case 'C':
      return [
        { key: 'brandName', value: brandName },
        { key: 'backgroundVisual', value: 'a clear summer sky — soft gradient from deep blue to white, wispy clouds near the bottom' },
        { key: 'catchCopyJa', value: '白浮きしない、透明感トーンアップUV' },
        { key: 'featureChipsJa', value: 'SPF50+ / PA++++ / 顔・からだ用' },
        { key: 'accentColor', value: 'sky blue (#3D8FDD)' },
      ];
    case 'D':
      return [
        { key: 'catchCopyJa', value: '白浮きしない、透け感トーンアップUV' },
        { key: 'copyColor', value: 'deep sky blue (#2E6FB7)' },
        { key: 'ingredientVisual', value: 'fresh translucent water spheres and a soft white tone-up cream smear floating around the tube' },
        { key: 'featureChipJa', value: '顔・からだ用' },
        { key: 'footnoteJa', value: '※メーキャップ効果による' },
        { key: 'backgroundColor', value: 'a clear sky-blue gradient fading to white at the bottom' },
      ];
    case 'E':
      return [{ key: 'backgroundTone', value: '' }];
    case 'F':
      return [
        { key: 'modelHandling', value: ' (crop to a chin-to-brow close-up)' },
        { key: 'catchCopyJa', value: '白浮きしない、透け感トーンアップUV' },
        { key: 'backgroundMood', value: 'soft ivory studio with warm daylight' },
      ];
    case 'G':
      return [
        { key: 'setTitleJa', value: 'トーンアップUV 2本セット' },
        { key: 'brandName', value: brandName },
        { key: 'palette', value: 'sky blue and white with dark navy accent text' },
        { key: 'qualifierChipsJa', value: '' },
      ];
    case 'H':
      return [
        { key: 'sceneDescription', value: 'a sunlit windowsill with sheer linen curtains, the tube standing on a warm stone pedestal' },
        { key: 'verticalCopyParagraph', value: "On the right side, render the copy '白浮きしない、透け感トーンアップUV' vertically (tategaki) in elegant mincho serif, dark grey." },
        { key: 'moodKeywords', value: 'quiet luxury, morning freshness, editorial stillness' },
      ];
  }
}

/** 콜⑥ studioCopy 목 응답 — 같은 입력이면 같은 출력(결정적) */
export function mockStudioCopy(styleId: StyleId, brandName: string): StudioCopyResult {
  const style = getStyle(styleId);
  return {
    isPromoInput: true,
    styleReason: `${style.nameKo} — ${style.bestFor.split(',')[0]} 문법에 맞춰 일본 고객이 훑는 신뢰 요소를 우선 배치했습니다.`,
    slotValues: mockSlotValues(styleId, brandName),
    copySlots: [
      {
        slotKey: 'catchCopyJa',
        ja: '白浮きしない、透け感トーンアップUV',
        krIntent: '「쿨톤 치트키」 — 하얗게 들뜨지 않는 톤업이라는 의도',
        rationale: '밈 어휘를 직역하지 않고 일본 고민 어휘 「白浮き」(코퍼스 실측)와 관례어 「トーンアップUV」로 재설계',
        footnote: '※メーキャップ効果による',
      },
    ],
    krElementMap: [
      { element: '형광 그린 테두리', action: '제거', reason: '라쿠텐 테두리 금지 가이드라인' },
      { element: '「쿨톤 치트키」 카피', action: '재설계', reason: '밈 어휘 → 일본 고민 어휘·관례어로 의도 재설계' },
      { element: '한국 기획전 뱃지', action: '제거', reason: '일본 고객에게 의미 없는 마커 — 근거 검수 전 미표기' },
      { element: '하늘·구름 배경', action: '유지·정제', reason: '브랜드 자산 + 일본 선케어 무드와 호환' },
    ],
  };
}

/**
 * 블록 1개를 그리는 데 필요한 문맥을 한자리에서 조립한다.
 *
 * 왜 이 모듈이 있는가: `blockContent`·`buildBlockPrompt`·`renderBlock` 을 부르는 곳이 **넷**이다
 * (잡 러너 · 블록 재생성 · `detail:cli` · `detail:previews`). 네 곳이 각자 문맥을 조립하면
 * 조용히 어긋나고 — 실제로 어긋난 적이 있다 — 프리뷰 카드와 산출물이 다른 페이지가 된다.
 * `productPresence` 를 팩이 소유하게 만든 것과 같은 이유다.
 */

import { getTemplate, planBlocks, type BlockPlan, type BlockPromptContext, type TemplateId } from './blockPack';
import type { DetailInput } from '../../db/store';
import type { Platform } from '../platform';
import { planLayout, VISUAL_HEIGHT, type BandPlan } from './rhythm';
import { INSET_PLACEMENT, type CopyPlacement } from './safeArea';
import type { BlockRenderContext } from './templates';
import { detailThemeOf, type DetailTheme } from './theme';
import { CANVAS_WIDTH, type BlockType } from './output';

export interface DetailRenderPlan {
  templateId: TemplateId;
  theme: DetailTheme;
  blocks: BlockPlan[];
  layout: BandPlan[];
}

/**
 * 시퀀스 + 리듬 + 테마를 한 번에 확정한다.
 * 재생성 경로도 **같은 함수를 같은 순서에** 적용해야 색·톤이 흔들리지 않는다(§2-6).
 */
export function buildRenderPlan(input: DetailInput, platform: Platform, templateId: TemplateId): DetailRenderPlan {
  const plan = planBlocks(input, platform, templateId, input.disabledBlocks as BlockType[]);
  return {
    templateId,
    theme: detailThemeOf(input.theme, input.productCategory),
    blocks: plan.blocks,
    layout: planLayout(plan.blocks),
  };
}

/** AI 배경컷 프롬프트 문맥. */
export function promptContextOf(
  rp: Pick<DetailRenderPlan, 'templateId' | 'theme'>,
  input: DetailInput,
  isFromKoreanDetail: boolean,
  userNote?: string,
): BlockPromptContext {
  return {
    templateId: rp.templateId,
    category: input.productCategory,
    theme: {
      surface: rp.theme.surface,
      accent: rp.theme.accent,
      accentNameEn: rp.theme.accentNameEn,
      moodKeywords: rp.theme.moodKeywords,
    },
    isFromKoreanDetail,
    userNote,
  };
}

/** 배경컷 블록의 고정 높이. 리듬이 정한 프리셋을 따른다. */
export function visualHeightOf(band: BandPlan | undefined): number {
  return band?.heightPreset ? VISUAL_HEIGHT[band.heightPreset] : VISUAL_HEIGHT.band;
}

/**
 * satori 렌더 문맥.
 *
 * ⚠ **배경컷이 없으면 배치를 `inset` 으로 강제 덮어쓴다.** 이 개정의 최대 실패 모드가
 *   "흰 배경에 흰 글자"다 — 배경 생성이 실패해 `hasBackground=false` 가 됐는데 사진용
 *   흰 글자 토큰이 그대로 쓰이면 블록이 통째로 안 보인다.
 *
 * @param band  planLayout 산출 중 이 블록의 항목
 * @param theme 해석된 테마
 * @param brandName 브랜드명(히어로 eyebrow 폴백)
 * @param background 배경컷 유무
 * @param placement safeArea 실측 결과. 배경이 있을 때만 유효하다
 */
export function renderContextOf(args: {
  band: BandPlan | undefined;
  theme: DetailTheme;
  templateId: TemplateId;
  brandName: string;
  hasBackground: boolean;
  placement?: CopyPlacement;
}): BlockRenderContext {
  const { band, hasBackground } = args;
  const isPhoto = band?.surface === 'photo' && hasBackground;
  const placement = isPhoto ? (args.placement ?? INSET_PLACEMENT) : undefined;
  // satori 는 명시 폭이 필요하다 — 사진 밴드는 실측 여백의 폭이, 색면 밴드는 캔버스 폭이 기준이다
  const availableWidth = placement ? Math.round(CANVAS_WIDTH * placement.zone.width) : CANVAS_WIDTH;
  return {
    brandName: args.brandName,
    hasBackground,
    theme: args.theme,
    tone: band?.tone ?? 'paper',
    surface: isPhoto ? 'photo' : 'inset',
    placement,
    availableWidth,
    density: band?.density ?? 'normal',
    chapter: band?.chapter ?? null,
    nextTone: band?.nextTone ?? null,
    seam: band?.seam ?? 'none',
    typeScale: getTemplate(args.templateId).typeScale,
  };
}

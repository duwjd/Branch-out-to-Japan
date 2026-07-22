/**
 * ② 썸네일 비동기 잡 — reportJob 패턴 미러(09 §4b M6).
 * 상태: generating → done | failed. 단계(고객어 매핑은 화면 몫): analyze → assemble → generate → gate.
 * 검수 게이트 v1 = 구조적 보증 기록 — 비전 자동검수 없음, 라이브러리는 done만 조회한다.
 */

import { getStore, type GateResult, type GeneratedAssetRecord, type ThumbnailProof } from '../db/store';
import { readStoredFile, saveFile } from '../files/storage';
import { runStudioCopy } from '../studio/copyCall';
import { generateThumbnail } from '../studio/imageGen';
import { assembleSlots, buildPrompt, getStyle, type Platform, type StyleId } from '../studio/promptPack';
import { logger } from '../logger';

export interface ThumbnailJobInput {
  originalImagePath: string;
  platform: Platform;
  styleId: StyleId;
  proof: ThumbnailProof | null;
}

/** 잡 레코드 생성(generating) — 폼 POST가 호출. 브랜드명은 제출 시점 스냅샷(불소급) */
export async function createThumbnailAsset(input: ThumbnailJobInput): Promise<GeneratedAssetRecord> {
  const store = await getStore();
  const profile = await store.getBrandProfile();
  return store.createAsset({
    kind: 'thumbnail',
    styleCategory: input.styleId,
    styleName: getStyle(input.styleId).nameKo,
    platform: input.platform,
    status: 'generating',
    stage: 'analyze',
    error: null,
    originalImagePath: input.originalImagePath,
    imagePath: null,
    promptUsed: null,
    gateResult: null,
    explanationJson: null,
    proof: input.proof,
    brandNameSnapshot: profile?.brandName ?? 'MY BRAND',
  });
}

/** 검수 게이트 v1 — 파이프라인이 구조적으로 보장하는 3체크를 근거와 함께 기록(RESULT-01 배지 렌더 계약) */
function structuralGateResult(hasProof: boolean): GateResult {
  return {
    passed: true,
    checks: [
      { key: 'labelPreserved', label: '제품 라벨 보존', note: '원본 이미지 편집 모드(input_fidelity high)로 생성 — 제품 변형 금지 제약 포함' },
      { key: 'noTypos', label: '오탈자 없음', note: '오버레이 텍스트는 검수 통과 슬롯 원문만 자단위 렌더하도록 프롬프트 강제' },
      {
        key: 'noUnprovenBadges',
        label: '무단 배지 없음',
        note: hasProof ? '입력된 실적 근거만 배지로 조립(코드 게이트)' : '실적 미입력 — 배지 문단을 프롬프트에서 제거(기본값 = 배지 없음)',
      },
    ],
  };
}

/** 파이프라인 실행 — 응답 후 백그라운드(after)로 실행. 실패는 상태로 기록 */
export async function runThumbnailJob(assetId: string): Promise<void> {
  const store = await getStore();
  const asset = await store.getAsset(assetId);
  if (!asset) {
    logger.error('썸네일 잡 시작 실패 — 자산 없음', { assetId });
    return;
  }

  try {
    const original = await readStoredFile(asset.originalImagePath);
    if (!original) throw new Error('원본 이미지를 찾을 수 없습니다.');
    const mediaType = original.contentType as 'image/png' | 'image/jpeg' | 'image/webp';
    const styleId = asset.styleCategory as StyleId;
    const hasProof = asset.proof !== null;

    // ①~④ 통합 — 콜⑥ studioCopy (분석 + 카피 재설계 + 슬롯 채움)
    await store.updateAsset(assetId, { stage: 'analyze' });
    const copy = await runStudioCopy({
      styleId,
      platform: asset.platform as Platform,
      brandName: asset.brandNameSnapshot,
      hasProof,
      image: { mediaType, dataBase64: original.buf.toString('base64') },
      onLog: (entry) => store.saveLlmLog(null, entry),
    });

    // ⑤ 결정적 조립 — proof 게이트·가격 슬롯 공란은 코드가 강제
    await store.updateAsset(assetId, { stage: 'assemble' });
    const style = getStyle(styleId);
    const slots = assembleSlots(style, copy.slotValues, asset.proof);
    const prompt = buildPrompt(styleId, slots, copy.isPromoInput);
    await store.updateAsset(assetId, {
      promptUsed: prompt,
      explanationJson: {
        styleReason: copy.styleReason,
        copySlots: copy.copySlots,
        krElementMap: copy.krElementMap,
      },
    });

    // ⑥ 생성
    await store.updateAsset(assetId, { stage: 'generate' });
    const generated = await generateThumbnail({ prompt, original: original.buf, mediaType, styleId });

    // 검수 게이트(구조적 보증) + 저장
    await store.updateAsset(assetId, { stage: 'gate' });
    const imagePath = await saveFile(generated.buf, 'png', 'thumb');
    await store.updateAsset(assetId, {
      status: 'done',
      stage: null,
      imagePath,
      gateResult: structuralGateResult(hasProof),
    });
    logger.info('썸네일 잡 완료', { assetId, styleId, mode: generated.mode, model: generated.model });
  } catch (err) {
    const reason = String((err as Error)?.message ?? err);
    logger.error('썸네일 잡 실패', { assetId, reason });
    await store.updateAsset(assetId, { status: 'failed', stage: null, error: reason });
  }
}

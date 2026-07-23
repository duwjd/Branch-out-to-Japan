/**
 * POST /api/studio/thumbnail — 생성 제출(FormData) → 원본 저장 + 잡 킥오프(after).
 * GET /api/studio/thumbnail — 실행 모드 메타 + 최근 자산(dev 배지·홈 스트립용).
 * 클라이언트·서버 검증 동일 규칙 이중 적용(② HOME-08) — 버튼 잠금을 우회해도 여기서 차단.
 */

import { NextResponse, after } from 'next/server';
import { getSession } from '@/lib/server/session';
import { getActiveBrand, getActiveBrandId } from '@/lib/server/activeBrand';
import { createThumbnailAsset, runThumbnailJob } from '@/lib/server/studioJob';
import { saveFile, extForMime } from '@/lib/files/storage';
import { getStore, type PromoInput, type ThumbnailProof } from '@/lib/db/store';
import { currentLlmMode } from '@/lib/engine/llm/client';
import { currentImageMode, imageModel } from '@/lib/studio/imageGen';
import { PLATFORMS, getPromptPack, type Platform, type StyleId } from '@/lib/studio/promptPack';
import { logger } from '@/lib/logger';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB (HOME-02)
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await getSession())) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const form = await request.formData();

  const image = form.get('image');
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: '제품 이미지를 올려 주세요.' }, { status: 400 });
  }
  if (!IMAGE_MIMES.includes(image.type)) {
    return NextResponse.json({ error: 'JPG·PNG·WebP만 업로드할 수 있습니다.' }, { status: 400 });
  }
  if (image.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: '10MB 이하 이미지만 업로드할 수 있습니다.' }, { status: 400 });
  }

  const styleId = String(form.get('styleId') ?? '');
  const knownStyles = getPromptPack().styleCategories.map((c) => c.id as string);
  if (!knownStyles.includes(styleId)) {
    return NextResponse.json({ error: '템플릿을 1개 선택해 주세요.' }, { status: 400 });
  }

  const platformRaw = String(form.get('platform') ?? 'unset');
  const platform: Platform = (PLATFORMS as string[]).includes(platformRaw) ? (platformRaw as Platform) : 'unset';

  // 실적 3필드 — 전부 있어야 proof로 인정(일부 입력 = 배지 미생성, HOME-05)
  const rankTitle = String(form.get('proofRankTitle') ?? '').trim();
  const genre = String(form.get('proofGenre') ?? '').trim();
  const aggregationDate = String(form.get('proofDate') ?? '').trim();
  const proof: ThumbnailProof | null =
    rankTitle && genre && aggregationDate ? { rankTitle, genre, aggregationDate } : null;

  if (styleId === 'E' && !proof) {
    // 수상 실적 스택형은 배지가 본체 — proof 없이는 생성 자체가 성립하지 않는다(팩 legalNote)
    return NextResponse.json({ error: '실적명·부문·집계일이 모두 있어야 이 템플릿을 생성할 수 있습니다.' }, { status: 400 });
  }

  // F 모델+카피형 — 모델컷 1장 + 사용 권한 동의(체크) 둘 다 필수(HOME-02b). 임의 인물 합성 금지
  let modelImagePath: string | null = null;
  let modelConsent = false;
  if (styleId === 'F') {
    const modelImage = form.get('modelImage');
    const consent = String(form.get('modelConsent') ?? '') === 'true';
    const validModel =
      modelImage instanceof File &&
      modelImage.size > 0 &&
      IMAGE_MIMES.includes(modelImage.type) &&
      modelImage.size <= MAX_UPLOAD_BYTES;
    if (!validModel || !consent) {
      return NextResponse.json({ error: '모델컷과 사용 권한 동의가 필요합니다.' }, { status: 400 });
    }
    const modelExt = extForMime((modelImage as File).type);
    if (!modelExt || modelExt === 'pdf') {
      return NextResponse.json({ error: '지원하지 않는 이미지 형식입니다.' }, { status: 400 });
    }
    modelImagePath = await saveFile(Buffer.from(await (modelImage as File).arrayBuffer()), modelExt, 'model');
    modelConsent = true;
  }

  // G 프로모션 강조형 — 세트명·판매가 필수, 나머지 선택(HOME-05b). 통상가 취소선은 실적 확인 체크가 있을 때만
  let promoInput: PromoInput | null = null;
  if (styleId === 'G') {
    const setTitle = String(form.get('promoSetTitle') ?? '').trim();
    const salePrice = String(form.get('promoSalePrice') ?? '').trim();
    if (!setTitle || !salePrice) {
      return NextResponse.json({ error: '세트명과 판매가가 필요합니다.' }, { status: 400 });
    }
    const normalPrice = String(form.get('promoNormalPrice') ?? '').trim();
    // 통상가가 있어도 실적 확인 체크가 없으면 verified=false — assembleSlots가 통상가를 버린다(有利誤認 방지)
    const normalPriceVerified = String(form.get('promoNormalPriceVerified') ?? '') === 'true' && Boolean(normalPrice);
    const qualifierChips = String(form.get('promoQualifiers') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    promoInput = {
      setTitle,
      salePrice,
      normalPrice,
      normalPriceVerified,
      discountRate: String(form.get('promoDiscountRate') ?? '').trim(),
      gift: String(form.get('promoGift') ?? '').trim(),
      qualifierChips,
      footnote: String(form.get('promoFootnote') ?? '').trim(),
    };
  }

  // 생성물은 활성 브랜드에 귀속되고 브랜드명은 제출 시점 스냅샷(불소급)
  const brand = await getActiveBrand();
  if (!brand) return NextResponse.json({ error: '브랜드를 먼저 등록해 주세요.' }, { status: 400 });

  const ext = extForMime(image.type);
  if (!ext || ext === 'pdf') return NextResponse.json({ error: '지원하지 않는 이미지 형식입니다.' }, { status: 400 });
  const originalImagePath = await saveFile(Buffer.from(await image.arrayBuffer()), ext, 'orig');

  const record = await createThumbnailAsset({
    brandProfileId: brand.id,
    brandName: brand.brandName,
    originalImagePath,
    platform,
    styleId: styleId as StyleId,
    proof,
    modelImagePath,
    modelConsent,
    promoInput,
  });
  logger.info('썸네일 생성 접수', { assetId: record.id, styleId, platform });

  after(async () => {
    await runThumbnailJob(record.id);
  });

  return NextResponse.json({ id: record.id }, { status: 201 });
}

export async function GET(): Promise<NextResponse> {
  const store = await getStore();
  const brandId = await getActiveBrandId();
  const assets = brandId ? await store.listAssets(brandId) : [];
  return NextResponse.json({
    storeKind: store.kind(),
    llmMode: currentLlmMode(),
    imageMode: currentImageMode(),
    imageModel: imageModel(),
    // 최근 생성 스트립(HOME-07) — 3~4건 고정, 전체 목록은 ③ 라이브러리 몫
    recent: assets.slice(0, 4).map((a) => ({
      id: a.id,
      status: a.status,
      stage: a.stage,
      styleName: a.styleName,
      platform: a.platform,
      createdAt: a.createdAt,
      imageUrl: a.imagePath ? `/api/files/${a.imagePath}` : null,
      originalUrl: `/api/files/${a.originalImagePath}`,
    })),
  });
}

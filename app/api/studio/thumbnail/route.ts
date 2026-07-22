/**
 * POST /api/studio/thumbnail — 생성 제출(FormData) → 원본 저장 + 잡 킥오프(after).
 * GET /api/studio/thumbnail — 실행 모드 메타 + 최근 자산(dev 배지·홈 스트립용).
 * 클라이언트·서버 검증 동일 규칙 이중 적용(② HOME-08) — 버튼 잠금을 우회해도 여기서 차단.
 */

import { NextResponse, after } from 'next/server';
import { getSession } from '@/lib/server/session';
import { createThumbnailAsset, runThumbnailJob } from '@/lib/server/studioJob';
import { saveFile, extForMime } from '@/lib/files/storage';
import { getStore, type ThumbnailProof } from '@/lib/db/store';
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
  if (styleId === 'F') {
    // 모델+카피형 — 브랜드 보유 모델컷 필수, 업로드 미지원(HOME-04a). 임의 인물 합성 금지
    return NextResponse.json({ error: '모델컷 업로드는 준비 중입니다 — 다른 템플릿을 선택해 주세요.' }, { status: 400 });
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

  const ext = extForMime(image.type);
  if (!ext || ext === 'pdf') return NextResponse.json({ error: '지원하지 않는 이미지 형식입니다.' }, { status: 400 });
  const originalImagePath = await saveFile(Buffer.from(await image.arrayBuffer()), ext, 'orig');

  const record = await createThumbnailAsset({ originalImagePath, platform, styleId: styleId as StyleId, proof });
  logger.info('썸네일 생성 접수', { assetId: record.id, styleId, platform });

  after(async () => {
    await runThumbnailJob(record.id);
  });

  return NextResponse.json({ id: record.id }, { status: 201 });
}

export async function GET(): Promise<NextResponse> {
  const store = await getStore();
  const assets = await store.listAssets();
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

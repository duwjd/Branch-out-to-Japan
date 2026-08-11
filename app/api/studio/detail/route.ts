/**
 * POST /api/studio/detail — 상세페이지 생성 제출(FormData) → 원본 저장 + 잡 킥오프(after).
 * GET  /api/studio/detail — 실행 모드 메타 + 최근 상세 자산(모드 배지·홈 스트립용).
 * 폼 파싱·검증은 lib/server/detailForm 에 있다 — 구성 미리보기 라우트와 규칙을 공유해야 하기 때문.
 */

import { NextResponse, after } from 'next/server';
import { getSession } from '@/lib/server/session';
import { getActiveBrand, getActiveBrandId } from '@/lib/server/activeBrand';
import { createDetailAsset, runDetailJob } from '@/lib/server/detailJob';
import { parseDetailForm, validateImages } from '@/lib/server/detailForm';
import { saveFile, extForMime } from '@/lib/files/storage';
import { getStore } from '@/lib/db/store';
import { currentLlmMode } from '@/lib/engine/llm/client';
import { currentImageMode, imageModel } from '@/lib/studio/imageGen';
import { blockingReason, checkDetailReadiness } from '@/lib/server/detailReadiness';
import { logger } from '@/lib/logger';

// after() 상세 잡(카피 1콜 + 이미지 최대 4콜 + 렌더·결합)이 이 예산 안에서 실행된다(11 §3)
export const maxDuration = 300;

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await getSession())) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // 업로드를 받기 **전에** 막는다 — 잡은 카피·이미지 콜을 먼저 태우고 마지막에 블록을 저장하므로,
  // 준비가 안 된 서버에서는 비용과 2분을 다 쓴 뒤에야 실패한다.
  const readiness = await checkDetailReadiness(true);
  const blocked = blockingReason(readiness);
  if (blocked) {
    logger.error('상세페이지 생성 차단 — 서버 준비 미완', { reason: blocked });
    return NextResponse.json({ error: `이 서버에서는 아직 상세페이지를 만들 수 없습니다. ${blocked}`, readiness }, { status: 503 });
  }

  const form = await request.formData();
  const files = form.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  const imageError = validateImages(files);
  if (imageError) return NextResponse.json({ error: imageError }, { status: 400 });

  const brand = await getActiveBrand();
  if (!brand) return NextResponse.json({ error: '브랜드를 먼저 등록해 주세요.' }, { status: 400 });

  // 모델컷(퍼스널컬러 블록 조건) — 동의 없이는 저장하지 않는다
  let modelImagePath: string | null = null;
  const modelImage = form.get('modelImage');
  const modelConsent = String(form.get('modelConsent') ?? '') === 'true';
  if (modelImage instanceof File && modelImage.size > 0) {
    const modelError = validateImages([modelImage]);
    if (modelError) return NextResponse.json({ error: modelError }, { status: 400 });
    if (!modelConsent) {
      return NextResponse.json({ error: '모델컷을 쓰려면 사용 권한 동의가 필요합니다.' }, { status: 400 });
    }
    const ext = extForMime(modelImage.type);
    if (!ext || ext === 'pdf') return NextResponse.json({ error: '지원하지 않는 이미지 형식입니다.' }, { status: 400 });
    modelImagePath = await saveFile(Buffer.from(await modelImage.arrayBuffer()), ext, 'model');
  }

  // 업로드 순서가 곧 상세페이지 위→아래 순서다
  const sourceImagePaths: string[] = [];
  for (const f of files) {
    const ext = extForMime(f.type);
    if (!ext || ext === 'pdf') return NextResponse.json({ error: '지원하지 않는 이미지 형식입니다.' }, { status: 400 });
    sourceImagePaths.push(await saveFile(Buffer.from(await f.arrayBuffer()), ext, 'orig'));
  }

  const parsed = parseDetailForm(form, sourceImagePaths);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const record = await createDetailAsset({
    brandProfileId: brand.id,
    brandName: brand.brandName,
    sourceImagePaths,
    platform: parsed.platform,
    templateId: parsed.templateId,
    detailInput: { ...parsed.detailInput, modelConsent: parsed.detailInput.modelConsent && Boolean(modelImagePath) },
    disabledBlocks: parsed.disabledBlocks,
    note: parsed.note,
    modelImagePath,
  });
  logger.info('상세페이지 생성 접수', {
    assetId: record.id,
    templateId: parsed.templateId,
    platform: parsed.platform,
    images: files.length,
  });

  after(async () => {
    await runDetailJob(record.id);
  });

  return NextResponse.json({ id: record.id }, { status: 201 });
}

export async function GET(): Promise<NextResponse> {
  const store = await getStore();
  const brandId = await getActiveBrandId();
  const assets = brandId ? await store.listAssets(brandId) : [];
  const detail = assets.filter((a) => a.kind === 'detail');
  return NextResponse.json({
    storeKind: store.kind(),
    llmMode: currentLlmMode(),
    imageMode: currentImageMode(),
    imageModel: imageModel(),
    // 배포 환경 준비 상태 — 폼이 생성 전에 막고, 운영자가 원인을 바로 보게 한다
    readiness: await checkDetailReadiness(),
    // 최근 생성 스트립 — 3~4건 고정, 전체 목록은 ③ 라이브러리 몫
    recent: detail.slice(0, 4).map((a) => ({
      id: a.id,
      status: a.status,
      stage: a.stage,
      styleName: a.styleName,
      platform: a.platform,
      blockTotal: a.blockTotal,
      blockDone: a.blockDone,
      createdAt: a.createdAt,
      imageUrl: a.imagePath ? `/api/files/${a.imagePath}` : null,
      originalUrl: `/api/files/${a.originalImagePath}`,
    })),
  });
}

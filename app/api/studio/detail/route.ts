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
import { saveFile, extForMime, type StoredFileExt } from '@/lib/files/storage';
import { getStore } from '@/lib/db/store';
import { supabaseProjectRef } from '@/lib/db/supabaseClient';
import { currentLlmMode } from '@/lib/engine/llm/client';
import { currentImageMode, imageModel } from '@/lib/studio/imageGen';
import { blockingReason, checkDetailReadiness } from '@/lib/server/detailReadiness';
import {
  applyTranslations,
  collectTranslatable,
  sourceSnapshot,
  verifyClientTranslation,
  type TranslatedField,
} from '@/lib/studio/detail/translate';
import { runInputTranslate } from '@/lib/studio/detail/translateCall';
import { callTimeout } from '@/lib/studio/detail/budget';
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
    return NextResponse.json(
      { error: `이 서버에서는 아직 상세페이지를 만들 수 없습니다. ${blocked}`, readiness },
      { status: 503 },
    );
  }

  const form = await request.formData();
  // 제품컷과 KR 상세 원본을 분리해서 받는다(2026-08-19). 제품컷이 곧 images.edit 의 base라
  // 순서를 사용자 업로드에 맡기면 텍스트가 얹힌 KR 상세 스크린샷이 제품 자리를 차지한다.
  const productImage = form.get('productImage');
  const productFile = productImage instanceof File && productImage.size > 0 ? productImage : null;
  const krFiles = form.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  if (!productFile) {
    return NextResponse.json(
      { error: '제품컷 1장을 올려 주세요. 제품 사진은 이 이미지를 기준으로 다시 그립니다.' },
      { status: 400 },
    );
  }
  // 저장·비전 입력 순서 = [제품컷, KR 원본…]. 첫 장이 제품 대표컷이라는 잡의 계약을 UI가 보장한다.
  const files = [productFile, ...krFiles];
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

  // 형식은 저장 전에 전부 확인한다 — 뒤쪽 파일이 잘못돼 중간에 실패하면 앞의 저장분이 고아가 된다
  const exts: StoredFileExt[] = [];
  for (const f of files) {
    const ext = extForMime(f.type);
    if (!ext || ext === 'pdf') return NextResponse.json({ error: '지원하지 않는 이미지 형식입니다.' }, { status: 400 });
    exts.push(ext);
  }
  // 업로드 순서가 곧 상세페이지 위→아래 순서다(Promise.all 은 순서를 보존한다).
  // 직렬로 올리면 10장에 Storage 왕복 10회가 그대로 201 응답 앞에 쌓인다.
  const sourceImagePaths = await Promise.all(
    files.map(async (f, i) => saveFile(Buffer.from(await f.arrayBuffer()), exts[i], 'orig')),
  );

  const parsed = parseDetailForm(form, sourceImagePaths);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // ── 입력 언어 변환 적용 ──────────────────────────────────────────────────
  // 확인 화면이 보낸 값이 있으면 그걸 쓰되 **서버 기준으로 다시 검증**한다(클라이언트가 보낸
  // 원문은 믿지 않는다). 값이 없는데 한글이 남아 있으면 여기서 다시 변환한다 —
  // 폼을 거치지 않고 API를 직접 치는 경로에서도 블록이 조용히 사라지지 않게 하는 방어다.
  let detailInput = parsed.detailInput;
  let artDirectionEn = '';
  let translated: TranslatedField[] = [];
  if (collectTranslatable(parsed.detailInput, parsed.note).length > 0) {
    const cached = parsed.clientTranslation
      ? verifyClientTranslation(parsed.detailInput, parsed.note, parsed.clientTranslation)
      : null;
    if (cached?.complete) {
      translated = cached.fields;
      artDirectionEn = cached.artDirectionEn;
    } else {
      try {
        const result = await runInputTranslate({
          input: parsed.detailInput,
          note: parsed.note,
          brandKit: brand.brandKit,
          // 제출·미리보기 응답을 콜 하나가 매달려 잡아먹지 않게(스펙 §2-13)
          timeoutMs: callTimeout('translate'),
        });
        translated = result.fields;
        artDirectionEn = result.artDirectionEn;
      } catch (err) {
        // 변환이 죽어도 생성은 막지 않는다 — 한국어가 남은 블록만 빠지고 게이트가 그 사실을 남긴다
        logger.warn('입력 언어 변환 실패 — 원문으로 진행', { reason: String((err as Error)?.message ?? err) });
      }
    }
  }
  if (translated.length > 0) {
    detailInput = applyTranslations(parsed.detailInput, translated);
    detailInput.sourceKo = sourceSnapshot(translated);
    detailInput.brandKit = brand.brandKit;
    const failures = translated.filter((f) => !f.ok);
    if (failures.length > 0) {
      detailInput.translationIssues = failures.map((f) => ({ path: f.path, label: f.label, problem: f.problem ?? '' }));
    }
  }
  if (artDirectionEn) detailInput.artDirectionEn = artDirectionEn;

  const record = await createDetailAsset({
    brandProfileId: brand.id,
    brandName: brand.brandName,
    sourceImagePaths,
    platform: parsed.platform,
    templateId: parsed.templateId,
    detailInput: { ...detailInput, modelConsent: detailInput.modelConsent && Boolean(modelImagePath) },
    disabledBlocks: parsed.disabledBlocks,
    // promptUsed 에는 **한국어 원문**을 남긴다 — 화면이 사용자 입력을 그대로 되비추는 자리다.
    // 이미지 프롬프트에 실리는 영어 변환분은 detailInput.artDirectionEn 이 따로 들고 간다.
    note: parsed.note,
    modelImagePath,
  });
  logger.info('상세페이지 생성 접수', {
    assetId: record.id,
    templateId: parsed.templateId,
    platform: parsed.platform,
    images: files.length,
    translatedFields: translated.filter((f) => f.ok).length,
    translationFailures: translated.filter((f) => !f.ok).length,
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
    // 환경 확진용 — ① 축의 /api/report GET 과 같은 역할·같은 필드명
    vercelEnv: process.env.VERCEL_ENV ?? null,
    supabaseRef: supabaseProjectRef(),
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

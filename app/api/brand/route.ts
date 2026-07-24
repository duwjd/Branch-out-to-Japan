/**
 * GET·POST·PUT /api/brand — 브랜드 프로필(복수 지원) 조회·생성·저장.
 * GET/PUT은 활성 브랜드 기준, POST는 추가 생성(스위처·마이페이지·온보딩 공용 · MAIN-01b′).
 * 편집 정본은 /app/brand 하나(BRAND-00). 킷 수정은 발행 리포트·자산에 불소급(스냅샷 원칙).
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { getActiveBrand, setActiveBrand } from '@/lib/server/activeBrand';
import { getStore, type BrandProductClass, type BrandProfileRecord } from '@/lib/db/store';
import {
  POSITIONING_TAGS_MAX,
  POSITIONING_TAGS_MIN,
  isKnownPositioningTag,
} from '@/lib/engine/rules/positioning';
import type { Category } from '@/lib/engine/types';
import { logger } from '@/lib/logger';

const CATEGORIES: Category[] = ['skincare', 'makeup', 'suncare', 'cleansing'];
const PRODUCT_CLASSES: BrandProductClass[] = ['화장품', '의약외품', '건강식품', '미상'];

export async function GET(): Promise<NextResponse> {
  const store = await getStore();
  return NextResponse.json({ profile: await getActiveBrand(), storeKind: store.kind() });
}

/** 폼 입력을 서버에서 재검증해 프로필로 정규화한다(클라이언트와 동일 규칙 이중 적용) */
function parseProfile(body: Record<string, unknown>): { input: Omit<BrandProfileRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'detailDocPath' | 'detailDocName'> } | { error: string } {
  const brandName = typeof body.brandName === 'string' ? body.brandName.trim().slice(0, 60) : '';
  if (!brandName) return { error: '브랜드명을 입력해 주세요.' };

  const category = body.category as Category;
  if (!CATEGORIES.includes(category)) return { error: '카테고리를 선택해 주세요.' };

  const productClass = PRODUCT_CLASSES.includes(body.productClass as BrandProductClass)
    ? (body.productClass as BrandProductClass)
    : '미상';

  const positioningTags = Array.isArray(body.positioningTags)
    ? body.positioningTags.filter((t): t is string => typeof t === 'string' && isKnownPositioningTag(t)).slice(0, POSITIONING_TAGS_MAX)
    : [];
  if (positioningTags.length < POSITIONING_TAGS_MIN) return { error: '브랜드 포지셔닝을 1개 이상 선택해 주세요.' };

  const rawChannels = (typeof body.channels === 'object' && body.channels !== null ? body.channels : {}) as Record<string, unknown>;
  const jp = Array.isArray(rawChannels.jp)
    ? rawChannels.jp
        .filter((c): c is { channel: string; url: string } => typeof c === 'object' && c !== null)
        .map((c) => ({ channel: String(c.channel ?? '').slice(0, 30), url: String(c.url ?? '').slice(0, 300) }))
        .filter((c) => c.channel)
        .slice(0, 8)
    : [];

  const rawKit = (typeof body.brandKit === 'object' && body.brandKit !== null ? body.brandKit : {}) as Record<string, unknown>;
  const productNamesJa = Array.isArray(rawKit.productNamesJa)
    ? rawKit.productNamesJa
        .map((r) => ({ kr: String((r as Record<string, unknown>)?.kr ?? '').slice(0, 120), ja: String((r as Record<string, unknown>)?.ja ?? '').slice(0, 120) }))
        .filter((r) => r.kr || r.ja)
        .slice(0, 30)
    : [];
  const forbiddenTerms = Array.isArray(rawKit.forbiddenTerms)
    ? rawKit.forbiddenTerms
        .map((r) => ({ term: String((r as Record<string, unknown>)?.term ?? '').slice(0, 60), reason: String((r as Record<string, unknown>)?.reason ?? '').slice(0, 200) }))
        // 사유 없이 등록하지 않는다 — 근거 병기(증거 원칙, BRAND-05b)
        .filter((r) => r.term && r.reason)
        .slice(0, 30)
    : [];

  return {
    input: {
      brandName,
      category,
      productClass,
      positioningTags,
      targetMemo: typeof body.targetMemo === 'string' ? body.targetMemo.slice(0, 500) : '',
      productInfoMemo: typeof body.productInfoMemo === 'string' ? body.productInfoMemo.slice(0, 1000) : '',
      channels: { krUrl: typeof rawChannels.krUrl === 'string' ? rawChannels.krUrl.slice(0, 300) : '', jp },
      brandKit: {
        productNamesJa,
        forbiddenTerms,
        toneGuide: typeof rawKit.toneGuide === 'string' ? rawKit.toneGuide.slice(0, 300) : '',
      },
    },
  };
}

/**
 * POST /api/brand — 브랜드 생성(온보딩 캡처 + 추가 모달 공용 · MAIN-01b′/ONBOARD-02).
 * 필수 3필드(브랜드명·카테고리·제품분류)만 받고 포지셔닝 0개를 허용한다 —
 * 상세(포지셔닝·제품·채널·용어집)는 이후 /app/brand(PUT)가 채운다.
 * 복수 브랜드 지원 — 같은 브랜드명만 409(중복 등록 방지). 생성 즉시 활성 브랜드로 전환한다.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const brandName = typeof body.brandName === 'string' ? body.brandName.trim().slice(0, 60) : '';
  if (!brandName) return NextResponse.json({ error: '브랜드명을 입력해 주세요.' }, { status: 400 });

  const category = body.category as Category;
  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: '카테고리를 선택해 주세요.' }, { status: 400 });

  const productClass = PRODUCT_CLASSES.includes(body.productClass as BrandProductClass)
    ? (body.productClass as BrandProductClass)
    : '미상';

  const store = await getStore();
  const existing = await store.listBrandProfiles(session.user.id);
  // 같은 브랜드명 중복 방지(MAIN-01b′ 검증) — 유저별 스코핑, 대소문자·공백 무시
  const norm = (s: string) => s.trim().toLowerCase();
  if (existing.some((b) => norm(b.brandName) === norm(brandName))) {
    return NextResponse.json({ error: '이미 등록한 브랜드명입니다.' }, { status: 409 });
  }

  const profile = await store.createBrandProfile({
    userId: session.user.id,
    brandName,
    category,
    productClass,
    positioningTags: [],
    targetMemo: '',
    productInfoMemo: '',
    detailDocPath: null,
    detailDocName: null,
    channels: { krUrl: '', jp: [] },
    brandKit: { productNamesJa: [], forbiddenTerms: [], toneGuide: '' },
  });
  await setActiveBrand(profile.id);
  logger.info('브랜드 프로필 생성', { brandProfileId: profile.id, brandName: profile.brandName });
  return NextResponse.json({ profile }, { status: 201 });
}

export async function PUT(request: Request): Promise<NextResponse> {
  if (!(await getSession())) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const parsed = parseProfile(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // 편집 대상은 활성 브랜드(스위처 현재 브랜드, BRAND-00)
  const existing = await getActiveBrand();
  if (!existing) return NextResponse.json({ error: '편집할 브랜드가 없습니다.' }, { status: 400 });

  const store = await getStore();
  const profile: BrandProfileRecord = {
    id: existing.id,
    userId: existing.userId, // 편집은 소유 유저를 보존한다(스냅샷 아님 — 소속 불변)
    ...parsed.input,
    // 문서 업로드는 별도 라우트(/api/brand/doc) — 저장 시 기존 값 유지
    detailDocPath: existing.detailDocPath,
    detailDocName: existing.detailDocName,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await store.saveBrandProfile(profile);
  logger.info('브랜드 프로필 저장', { brandProfileId: profile.id, brandName: profile.brandName });
  return NextResponse.json({ profile });
}

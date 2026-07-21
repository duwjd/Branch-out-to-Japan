/**
 * GET·PUT /api/brand — 브랜드 프로필(싱글턴 'default') 조회·저장.
 * 편집 정본은 /app/brand 하나(BRAND-00). 킷 수정은 발행 리포트·자산에 불소급(스냅샷 원칙).
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
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
  return NextResponse.json({ profile: await store.getBrandProfile(), storeKind: store.kind() });
}

/** 폼 입력을 서버에서 재검증해 프로필로 정규화한다(클라이언트와 동일 규칙 이중 적용) */
function parseProfile(body: Record<string, unknown>): { input: Omit<BrandProfileRecord, 'id' | 'createdAt' | 'updatedAt' | 'detailDocPath' | 'detailDocName'> } | { error: string } {
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

  const store = await getStore();
  const existing = await store.getBrandProfile();
  const now = new Date().toISOString();
  const profile: BrandProfileRecord = {
    id: 'default',
    ...parsed.input,
    // 문서 업로드는 별도 라우트(/api/brand/doc) — 저장 시 기존 값 유지
    detailDocPath: existing?.detailDocPath ?? null,
    detailDocName: existing?.detailDocName ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await store.saveBrandProfile(profile);
  logger.info('브랜드 프로필 저장', { brandName: profile.brandName });
  return NextResponse.json({ profile });
}

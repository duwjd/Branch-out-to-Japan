/**
 * GET·POST·DELETE /api/matching — 기업 매칭(컨시어지형, MATCH-02~06).
 * 상태 갱신은 운영팀 수동 — 이 라우트는 신청·조회·취소만 담당한다.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { getActiveBrandId } from '@/lib/server/activeBrand';
import { getStore } from '@/lib/db/store';
import { MATCH_CHANNELS, PARTNER_TYPES } from '@/lib/matching';
import { logger } from '@/lib/logger';

const CHANNELS = MATCH_CHANNELS.map((c) => c.value as string);

export async function GET(): Promise<NextResponse> {
  const store = await getStore();
  const brandId = await getActiveBrandId();
  if (!brandId) {
    return NextResponse.json({
      active: null,
      summary: { reportCount: 0, thumbnailCount: 0, latestScore: null },
      storeKind: store.kind(),
    });
  }
  const [active, requests, assets, reports] = await Promise.all([
    store.getActiveMatchRequest(brandId),
    store.listRequests(brandId),
    store.listAssets(brandId),
    store.listReports(brandId),
  ]);
  const published = requests.filter((r) => r.status === 'published');
  const latestReport = reports.find((r) => r.publishedAt !== null) ?? null;
  return NextResponse.json({
    active,
    // 자동 첨부 요약(MATCH-02a) — 신청 폼이 재입력 없이 보여주는 값
    summary: {
      reportCount: published.length,
      thumbnailCount: assets.filter((a) => a.status === 'done').length,
      latestScore: latestReport?.overallScore ?? null,
    },
    storeKind: store.kind(),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await getSession())) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const partnerTypes = Array.isArray(body.partnerTypes)
    ? body.partnerTypes.filter((t): t is string => typeof t === 'string' && (PARTNER_TYPES as readonly string[]).includes(t))
    : [];
  if (partnerTypes.length === 0) {
    return NextResponse.json({ error: '파트너 유형을 1개 이상 선택해 주세요.' }, { status: 400 });
  }

  const channels = Array.isArray(body.channels)
    ? body.channels.filter((c): c is string => typeof c === 'string' && CHANNELS.includes(c))
    : [];
  const timing = typeof body.timing === 'string' ? body.timing.slice(0, 40) : '';
  const memo = typeof body.memo === 'string' ? body.memo.slice(0, 500) : '';

  const store = await getStore();
  const brandId = await getActiveBrandId();
  if (!brandId) return NextResponse.json({ error: '브랜드를 먼저 등록해 주세요.' }, { status: 400 });
  if (await store.getActiveMatchRequest(brandId)) {
    return NextResponse.json({ error: '이미 진행 중인 신청이 있습니다.' }, { status: 409 });
  }

  // 신청 시점 자산 요약 물질화(MATCH-02a 스냅샷)
  const [requests, assets, reports] = await Promise.all([
    store.listRequests(brandId),
    store.listAssets(brandId),
    store.listReports(brandId),
  ]);
  const record = await store.createMatchRequest({
    brandProfileId: brandId,
    partnerTypes,
    channels,
    timing,
    memo,
    snapshot: {
      reportCount: requests.filter((r) => r.status === 'published').length,
      thumbnailCount: assets.filter((a) => a.status === 'done').length,
      latestScore: reports.find((r) => r.publishedAt !== null)?.overallScore ?? null,
    },
  });
  logger.info('매칭 신청 접수', { matchId: record.id, partnerTypes });
  return NextResponse.json({ active: record }, { status: 201 });
}

export async function DELETE(): Promise<NextResponse> {
  if (!(await getSession())) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const store = await getStore();
  const brandId = await getActiveBrandId();
  const active = brandId ? await store.getActiveMatchRequest(brandId) : null;
  if (!active) return NextResponse.json({ error: '진행 중인 신청이 없습니다.' }, { status: 404 });
  await store.cancelMatchRequest(active.id);
  logger.info('매칭 신청 취소', { matchId: active.id });
  return NextResponse.json({ ok: true });
}

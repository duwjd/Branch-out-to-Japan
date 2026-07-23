/**
 * POST /api/lead — 검증 랜딩(/lp) 리드 접수(상담 신청·자료받기). 공개 API(세션 불필요).
 * 계약: lib/lead.ts(LeadKind·채널/단계/고통점 화이트리스트).
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { LEAD_KINDS, isKnownChannel, isKnownPainPoint, isKnownStage, type LeadKind } from '@/lib/lead';
import { logger } from '@/lib/logger';

const KNOWN_KINDS = LEAD_KINDS as readonly string[];

export async function POST(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const kind = typeof body.kind === 'string' ? body.kind : '';
  if (!KNOWN_KINDS.includes(kind)) {
    return NextResponse.json({ error: '알 수 없는 리드 종류입니다.' }, { status: 400 });
  }

  const brandName = typeof body.brandName === 'string' ? body.brandName.trim().slice(0, 100) : '';
  if (!brandName) {
    return NextResponse.json({ error: '브랜드명을 입력해 주세요.' }, { status: 400 });
  }

  const contact = typeof body.contact === 'string' ? body.contact.trim().slice(0, 200) : '';
  if (!contact) {
    return NextResponse.json({ error: '연락처(이메일 또는 전화)를 입력해 주세요.' }, { status: 400 });
  }

  const contactName = typeof body.contactName === 'string' ? body.contactName.slice(0, 60) : '';
  const channels = Array.isArray(body.channels) ? body.channels.filter(isKnownChannel) : [];
  const stage = isKnownStage(body.stage) ? body.stage : '';
  const painPoints = Array.isArray(body.painPoints) ? body.painPoints.filter(isKnownPainPoint) : [];
  const memo = typeof body.memo === 'string' ? body.memo.slice(0, 1000) : '';
  const source = typeof body.source === 'string' && body.source ? body.source.slice(0, 80) : 'direct';

  const store = await getStore();
  const lead = await store.createLead({
    kind: kind as LeadKind,
    brandName,
    contactName,
    contact,
    channels,
    stage,
    painPoints,
    memo,
    source,
  });
  // 개인정보(연락처·메모) 원문은 로그에 남기지 않는다.
  logger.info('리드 접수', { kind, source });
  return NextResponse.json({ lead }, { status: 201 });
}

/**
 * POST /api/track — 검증 랜딩(/lp) 전환 퍼널 이벤트(방문·CTA클릭·영상재생·신청) 기록. 공개 API(세션 불필요).
 * 계약: lib/lead.ts(TrackEventType). 대량 이벤트라 성공 로그는 남기지 않는다(실패만 처리).
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db/store';
import { TRACK_EVENT_TYPES, type TrackEventType } from '@/lib/lead';

const KNOWN_TYPES = TRACK_EVENT_TYPES as readonly string[];

export async function POST(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const type = typeof body.type === 'string' ? body.type : '';
  if (!KNOWN_TYPES.includes(type)) {
    return NextResponse.json({ error: '알 수 없는 이벤트 종류입니다.' }, { status: 400 });
  }

  const cta = typeof body.cta === 'string' && body.cta ? body.cta.slice(0, 60) : null;
  const source = typeof body.source === 'string' && body.source ? body.source.slice(0, 80) : 'direct';
  const path = typeof body.path === 'string' ? body.path.slice(0, 200) : '';

  const store = await getStore();
  await store.createTrackEvent({ type: type as TrackEventType, cta, source, path });
  return NextResponse.json({ ok: true }, { status: 201 });
}

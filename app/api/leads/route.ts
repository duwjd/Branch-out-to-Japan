import { NextResponse } from "next/server";
import { submitLead, type LeadInput } from "@/lib/leads";

/**
 * POST /api/leads — 무료 "5분 진단" 신청 접수.
 * 필수값(브랜드명·진출 목표)을 검증한 뒤 submitLead 로 처리한다.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: Partial<LeadInput>;
  try {
    body = (await request.json()) as Partial<LeadInput>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "잘못된 요청 형식입니다." },
      { status: 400 },
    );
  }

  // 필수값 검증 — 원인을 명확히 담아 응답한다.
  if (!body.brandName || !body.goal) {
    return NextResponse.json(
      { ok: false, error: "브랜드명과 일본 진출 목표는 필수입니다." },
      { status: 400 },
    );
  }

  const result = await submitLead({
    brandName: body.brandName,
    productUrl: body.productUrl,
    instagram: body.instagram,
    goal: body.goal,
    concern: body.concern,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

import { logger } from "@/lib/logger";

/** 무료 "일본 진출 콘텐츠 5분 진단" 신청 입력 */
export interface LeadInput {
  /** 브랜드명 / 제품명 */
  brandName: string;
  /** 제품 상세페이지 URL (선택) */
  productUrl?: string;
  /** 인스타그램 계정 (선택) */
  instagram?: string;
  /** 일본 진출 목표 (Qoo10 / 인스타 / 유튜브 / 오프라인 등) */
  goal: string;
  /** 현재 고민 (선택) — 실제 고객 언어 수집용 */
  concern?: string;
}

/** 리드 처리 결과 */
export interface LeadResult {
  ok: boolean;
  error?: string;
}

/**
 * 리드(진단 신청)를 저장한다.
 *
 * 저장 방식은 아직 열린 결정이다(docs/05-open-questions.md).
 * - `LEADS_WEBHOOK_URL` 이 설정되어 있으면 외부 폼서비스/웹훅으로 전달한다.
 * - 없으면 로깅만 하는 스텁으로 동작해 Phase 1 검증을 막지 않는다.
 *
 * 저장소가 정해지면 이 함수 내부 구현만 교체하면 된다(호출부는 그대로).
 *
 * @param input 신청 폼 입력
 * @returns 성공 여부와 실패 시 사용자 메시지
 */
export async function submitLead(input: LeadInput): Promise<LeadResult> {
  const webhookUrl = process.env.LEADS_WEBHOOK_URL;

  try {
    if (webhookUrl) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        // 원인 + 해결: 웹훅 상태 코드를 남겨 추적 가능하게 한다.
        logger.error("리드 웹훅 전송 실패", { status: res.status });
        return {
          ok: false,
          error: `신청 전송에 실패했습니다 (status ${res.status}). 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.`,
        };
      }
    } else {
      // 저장소 미설정 상태의 스텁. 실제 저장 대신 접수 사실만 기록한다.
      logger.info("리드 접수(스텁 — 저장소 미설정)", {
        brandName: input.brandName,
        goal: input.goal,
      });
    }

    return { ok: true };
  } catch (err) {
    // 원인 + 해결: 예외 메시지를 로깅하고, 사용자에겐 재시도 안내를 준다.
    logger.error("리드 처리 중 오류", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      error: "신청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LeadInput } from "@/lib/leads";

const GOAL_OPTIONS = ["Qoo10 Japan", "인스타그램", "유튜브", "오프라인/유통", "아직 미정"];

/** 무료 "5분 진단" 신청 폼 (Phase 1 리드 수집) */
export default function ApplyPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 폼 제출 → /api/leads 로 전송 후 완료 페이지로 이동 */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload: LeadInput = {
      brandName: String(formData.get("brandName") ?? "").trim(),
      productUrl: String(formData.get("productUrl") ?? "").trim() || undefined,
      instagram: String(formData.get("instagram") ?? "").trim() || undefined,
      goal: String(formData.get("goal") ?? "").trim(),
      concern: String(formData.get("concern") ?? "").trim() || undefined,
    };

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: { ok: boolean; error?: string } = await res.json();

      if (!res.ok || !data.ok) {
        // 원인을 사용자에게 그대로 안내하고 재시도 가능 상태로 되돌린다.
        setError(data.error ?? "신청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        setSubmitting(false);
        return;
      }

      router.push("/thanks");
    } catch {
      setError("네트워크 오류가 발생했습니다. 연결을 확인하고 다시 시도해 주세요.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-white text-zinc-900">
      <header className="mx-auto w-full max-w-2xl px-6 py-5">
        <Link href="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          ← 홈으로
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 pb-20">
        <h1 className="text-3xl font-bold tracking-tight">일본 진출 콘텐츠 5분 진단 신청</h1>
        <p className="mt-3 text-zinc-600">
          아래 정보를 남겨 주시면, 일본 고객 관점에서 지금 콘텐츠의 위험도와 개선 방향을 진단해 드립니다.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6" noValidate>
          <Field label="브랜드명 / 제품명" name="brandName" required placeholder="예: OO코스메틱 / 수분크림" />
          <Field
            label="제품 상세페이지 URL"
            name="productUrl"
            type="url"
            placeholder="https://..."
            hint="상세페이지 카피·구조 진단에 사용합니다. (선택)"
          />
          <Field
            label="인스타그램 계정"
            name="instagram"
            placeholder="@brand"
            hint="콘텐츠 톤 진단에 사용합니다. (선택)"
          />

          <div>
            <label htmlFor="goal" className="block text-sm font-medium">
              일본 진출 목표 <span className="text-indigo-600">*</span>
            </label>
            <select
              id="goal"
              name="goal"
              required
              defaultValue=""
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="" disabled>
                선택해 주세요
              </option>
              {GOAL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="concern" className="block text-sm font-medium">
              현재 가장 큰 고민
            </label>
            <textarea
              id="concern"
              name="concern"
              rows={4}
              placeholder="예: 상세페이지를 그대로 번역해도 될지 모르겠어요."
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <p className="mt-1.5 text-sm text-zinc-500">진단 정확도를 높이는 데 사용합니다. (선택)</p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "신청 중…" : "무료 진단 신청하기"}
          </button>
        </form>
      </main>
    </div>
  );
}

/** 라벨 + 인풋 한 쌍을 접근성 있게 렌더링하는 헬퍼 */
function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">
        {label} {required && <span className="text-indigo-600">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
      {hint && <p className="mt-1.5 text-sm text-zinc-500">{hint}</p>}
    </div>
  );
}

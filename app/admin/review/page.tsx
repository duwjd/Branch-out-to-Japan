'use client';

/**
 * 검수자용 내부 화면(미니) — needsReview 큐 → 리포트 확인 → 실명 서명 발행 / 반려.
 * 08 §7의 공백 화면. 서명 없는 발행 불가(스펙 성공지표)를 지키는 유일한 발행 경로.
 * 기능 검증 빌드: 접근 제어 없음(내부 URL) — 인증 도입 시 보호 필요.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface QueueItem {
  id: string;
  createdAt: string;
  category: string;
  brandName: string;
  productName: string;
  overallScore: number;
  auditSummary: { ngCount: number; conditionalCount: number; okCount: number; highestRiskId: string };
  llmMode: 'real' | 'mock';
}

export default function ReviewQueuePage() {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [storeKind, setStoreKind] = useState<string>('');
  const [reviewerName, setReviewerName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/review', { cache: 'no-store' });
    const data = await res.json();
    setItems(data.items);
    setStoreKind(data.storeKind);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 서명 발행 또는 반려 실행 */
  async function act(id: string, action: 'sign' | 'reject') {
    setBusyId(id);
    setMessage(null);
    try {
      const body =
        action === 'sign'
          ? { action, reviewerName }
          : { action, reason: window.prompt('반려 사유를 입력하세요') ?? '' };
      const res = await fetch(`/api/report/${id}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '처리 실패');
      setMessage(action === 'sign' ? `발행 완료 (${id.slice(0, 8)}…)` : `반려 처리 (${id.slice(0, 8)}…)`);
      await load();
    } catch (err) {
      setMessage(String((err as Error).message));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav className="mb-6 text-sm">
        <Link href="/" className="text-[#D93636] underline">← 메인으로</Link>
      </nav>
      <h1 className="text-2xl font-bold">검수 큐 (내부)</h1>
      <p className="mt-2 text-sm text-neutral-600">
        약기법 감사표를 확인하고 실명 서명으로 발행합니다 — 서명 없는 발행은 불가합니다.
        {storeKind === 'file' && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">로컬 저장(dev)</span>}
      </p>

      <div className="mt-6">
        <label htmlFor="reviewerName" className="text-sm font-medium">검수자 실명 (서명에 사용)</label>
        <input
          id="reviewerName"
          value={reviewerName}
          onChange={(e) => setReviewerName(e.target.value)}
          placeholder="예: 홍길동 (일본 화장품 약무·현지화 담당)"
          className="mt-1 w-full max-w-md rounded-lg border border-neutral-300 p-2 text-sm"
        />
      </div>

      {message && (
        <p role="status" className="mt-4 rounded-lg bg-neutral-100 p-3 text-sm">{message}</p>
      )}

      <section className="mt-6 space-y-4" aria-label="검수 대기 목록">
        {items === null && <p role="status">불러오는 중…</p>}
        {items?.length === 0 && (
          <p className="rounded-xl border border-neutral-200 p-6 text-sm text-neutral-600">
            검수 대기 중인 리포트가 없습니다. <Link href="/app/report/new" className="text-[#D93636] underline">새 진단 생성 →</Link>
          </p>
        )}
        {items?.map((item) => (
          <article key={item.id} className="rounded-xl border border-neutral-200 p-5 text-sm">
            <header className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{item.brandName} · {item.productName}</h2>
              <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">{item.category}</span>
              {item.llmMode === 'mock' && (
                <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">목 모드</span>
              )}
              <span className="ml-auto text-xs text-neutral-500">{item.createdAt.slice(0, 16).replace('T', ' ')}</span>
            </header>
            <p className="mt-2 text-neutral-700">
              종합 {item.overallScore}/100 · 감사: 불가 {item.auditSummary.ngCount} / 조건부 {item.auditSummary.conditionalCount} / 가능 {item.auditSummary.okCount}
              {' '}· 최고위험 {item.auditSummary.highestRiskId}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/app/report/${item.id}`}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium hover:bg-neutral-50"
              >
                리포트·감사표 확인
              </Link>
              <button
                type="button"
                disabled={!reviewerName.trim() || busyId === item.id}
                onClick={() => act(item.id, 'sign')}
                className={`rounded-lg px-4 py-1.5 text-base font-bold text-white ${
                  reviewerName.trim() && busyId !== item.id ? 'bg-[#FF6464] hover:bg-[#D93636]' : 'cursor-not-allowed bg-neutral-300'
                }`}
              >
                서명하고 발행
              </button>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => act(item.id, 'reject')}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
              >
                반려
              </button>
            </div>
            {!reviewerName.trim() && (
              <p className="mt-2 text-xs text-neutral-500">검수자 실명을 입력하면 발행할 수 있어요.</p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}

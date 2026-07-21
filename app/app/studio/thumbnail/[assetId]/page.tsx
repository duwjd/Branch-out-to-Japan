'use client';

/**
 * ② 생성 결과 상세(RESULT-00~07) — 제출 직후 생성중 상태로 시작해 완료 시 결과로 전환.
 * /app/report/[id]의 폴링 문법 미러(2.5초 · 터미널 상태에서 정지).
 */

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PLATFORM_LABELS, STUDIO_STAGE_LABELS, type Platform } from '@/lib/studio/platform';
import type { ExplanationJson, GateResult, GeneratedAssetStatus, ThumbnailProof } from '@/lib/db/store';

interface AssetPayload {
  id: string;
  status: GeneratedAssetStatus;
  stage: string | null;
  error: string | null;
  styleCategory: string;
  styleName: string;
  platform: string;
  gateResult: GateResult | null;
  explanationJson: ExplanationJson | null;
  proof: ThumbnailProof | null;
  brandNameSnapshot: string;
  createdAt: string;
  storeKind: 'supabase' | 'file';
  imageUrl: string | null;
  originalUrl: string;
}

export default function StudioResultPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = use(params);
  const [asset, setAsset] = useState<AssetPayload | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/studio/thumbnail/${assetId}`, { cache: 'no-store' });
      if (res.status === 404) {
        setNotFound(true);
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data: AssetPayload = await res.json();
      setAsset(data);
      setFetchError(null);
      if (data.status !== 'generating' && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (err) {
      setFetchError(String((err as Error).message));
    }
  }, [assetId]);

  useEffect(() => {
    void poll();
    timerRef.current = setInterval(() => void poll(), 2500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll]);

  /** 다운로드(RESULT-04) — 파일명 "{브랜드명}-{스타일 평문}-{플랫폼}.png" */
  async function handleDownload() {
    if (!asset?.imageUrl) return;
    const res = await fetch(asset.imageUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${asset.brandNameSnapshot}-${asset.styleName}-${PLATFORM_LABELS[asset.platform as Platform] ?? asset.platform}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-lg font-semibold">썸네일을 찾을 수 없습니다</p>
        <Link href="/app/studio/thumbnail" className="mt-3 inline-block text-sm text-[#D93636] underline">
          스튜디오 홈으로 →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <nav className="mb-6 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/app/studio/thumbnail" className="text-[#D93636] underline">← 스튜디오 홈</Link>
        {asset?.storeKind === 'file' && (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">로컬 저장(dev)</span>
        )}
      </nav>

      {!asset && !fetchError && <p role="status">불러오는 중…</p>}
      {fetchError && (
        <p role="alert" className="rounded-lg border border-[#F0483C] bg-red-50 p-3 text-sm text-[#B3271D]">
          {fetchError}
        </p>
      )}

      {/* 생성중(RESULT-06a) */}
      {asset?.status === 'generating' && (
        <section role="status" aria-live="polite" className="rounded-2xl border border-neutral-200 p-8 text-center">
          <div className="relative mx-auto h-56 w-56 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset.originalUrl} alt="" aria-hidden className="h-full w-full object-cover opacity-40 blur-sm" />
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 animate-pulse bg-[#FF6464]" />
          </div>
          <p className="mt-5 text-lg font-semibold">일본향 썸네일을 생성하고 있습니다…</p>
          <p className="mt-2 text-sm text-neutral-600">
            {asset.stage ? STUDIO_STAGE_LABELS[asset.stage] ?? asset.stage : '대기 중'}
          </p>
          <p className="mt-4 text-xs text-neutral-500">완료되면 이 페이지가 결과로 바뀝니다. 다른 작업을 하셔도 됩니다</p>
        </section>
      )}

      {/* 실패(RESULT-06b) */}
      {asset?.status === 'failed' && (
        <section role="alert" className="rounded-2xl border border-[#F0483C] bg-red-50 p-8">
          <h1 className="text-lg font-bold text-[#B3271D]">생성 중 오류가 발생했습니다</h1>
          <p className="mt-2 text-sm text-neutral-800">{asset.error}</p>
          <Link
            href={`/app/studio/thumbnail?from=${asset.id}&style=${asset.styleCategory}`}
            className="mt-4 inline-block text-sm font-semibold text-[#D93636] underline"
          >
            다시 시도 — 원본·템플릿 프리필로 재진입 →
          </Link>
        </section>
      )}

      {/* 완료(RESULT-01~05) */}
      {asset?.status === 'done' && asset.imageUrl && (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.imageUrl}
              alt={`${asset.styleName}으로 재설계된 ${asset.brandNameSnapshot} 일본향 썸네일`}
              className="aspect-square w-full rounded-2xl border border-neutral-200 object-cover"
            />
            {asset.gateResult && (
              <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm">
                <p className="font-semibold text-emerald-900">검수 게이트 통과 ○</p>
                <ul className="mt-1.5 space-y-1 text-xs text-emerald-900">
                  {asset.gateResult.checks.map((c) => (
                    <li key={c.key}>
                      ✓ {c.label} <span className="text-emerald-700">— {c.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleDownload()}
              className="mt-4 w-full rounded-lg bg-[#FF6464] px-6 py-3 text-sm font-bold text-white hover:bg-[#D93636]"
            >
              이미지 다운로드 (PNG · 1024×1024)
            </button>
            <p className="mt-2 text-xs text-neutral-500">
              AI 생성 이미지는 제안·데모용입니다. 플랫폼 게시용 제품 본체 컷은 브랜드 실촬영을 권장합니다
            </p>
            <Link
              href={`/app/studio/thumbnail?from=${asset.id}`}
              className="mt-3 inline-block text-sm text-[#D93636] underline"
            >
              같은 이미지로 다른 템플릿 생성 →
            </Link>
          </div>

          <aside>
            {/* 메타(RESULT-01 우측) */}
            <div className="rounded-xl border border-neutral-200 p-4 text-sm">
              <p>
                <span className="rounded-full bg-[#FFF1F1] px-2.5 py-1 text-xs font-semibold text-[#D93636]">
                  {asset.styleName}
                </span>
              </p>
              <dl className="mt-3 space-y-1.5 text-xs text-neutral-600">
                <div className="flex justify-between">
                  <dt>타깃 플랫폼</dt>
                  <dd className="font-medium text-neutral-900">{PLATFORM_LABELS[asset.platform as Platform] ?? asset.platform}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>생성일</dt>
                  <dd className="font-medium text-neutral-900">{asset.createdAt.slice(0, 10)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-neutral-500">원본 (Before)</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.originalUrl} alt="원본 이미지" className="mt-1 h-24 w-24 rounded-lg border border-neutral-200 object-cover" />
            </div>

            {/* 재설계 해설(RESULT-02) — 이 화면의 본체 */}
            {asset.explanationJson && (
              <div className="mt-4 rounded-xl border border-neutral-200 p-4 text-sm">
                <h2 className="font-bold">왜 이 문법인가</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">{asset.explanationJson.styleReason}</p>

                <h2 className="mt-4 font-bold">카피는 이렇게 재설계됐다</h2>
                <div className="mt-1.5 space-y-2.5">
                  {asset.explanationJson.copySlots.map((slot) => (
                    <div key={slot.slotKey} className="rounded-lg bg-neutral-50 p-3">
                      <p lang="ja" className="text-sm font-semibold">{slot.ja}</p>
                      <p className="mt-1 text-xs text-neutral-600">KR 의도 — {slot.krIntent}</p>
                      <p className="mt-0.5 text-xs text-neutral-600">근거 — {slot.rationale}</p>
                      {slot.footnote && (
                        <p lang="ja" className="mt-0.5 text-xs text-neutral-500">각주 {slot.footnote}</p>
                      )}
                    </div>
                  ))}
                  {!asset.proof && (
                    <p className="text-xs text-neutral-500">실적을 입력하지 않아 배지 없이 생성됐습니다</p>
                  )}
                </div>

                {/* KR 요소 처리 매핑(RESULT-03) — 데이터 없으면 영역 미출력 */}
                {asset.explanationJson.krElementMap.length > 0 && (
                  <div className="mt-4">
                    <button
                      type="button"
                      aria-expanded={mapOpen}
                      onClick={() => setMapOpen((v) => !v)}
                      className="flex w-full items-center justify-between text-left font-bold"
                    >
                      무엇을 바꿨나 <span aria-hidden className="text-neutral-400">{mapOpen ? '▲' : '▼'}</span>
                    </button>
                    {mapOpen && (
                      <table className="mt-2 w-full text-xs">
                        <thead>
                          <tr className="border-b border-neutral-200 text-left text-neutral-500">
                            <th className="py-1 pr-2 font-medium">원본 요소</th>
                            <th className="py-1 pr-2 font-medium">처리</th>
                            <th className="py-1 font-medium">근거</th>
                          </tr>
                        </thead>
                        <tbody>
                          {asset.explanationJson.krElementMap.map((row, i) => (
                            <tr key={i} className="border-b border-neutral-100 align-top">
                              <td className="py-1.5 pr-2">{row.element}</td>
                              <td className="py-1.5 pr-2 whitespace-nowrap font-medium">{row.action}</td>
                              <td className="py-1.5 text-neutral-600">{row.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

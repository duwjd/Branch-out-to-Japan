import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db/store';
import type { GeneratedAssetRecord } from '@/lib/db/store';
import { PLATFORM_LABELS, type Platform } from '@/lib/studio/platform';
import { ReportCoverPreview } from '@/components/app/AssetPreview';
import { AxisChip, EmptyState, buttonClass, cardClass } from '@/components/ui/primitives';
import { GateBadges } from '@/components/ui/progress';
import { IconBox } from '@/components/ui/icons';

/**
 * ③ 자산 상세(DETAIL-00~07) — 자산 1건 재열람. 조회 전용(재생성·편집 없음).
 * assetId가 GeneratedAsset이면 썸네일 모드, DiagnosisRequest면 리포트 요약 모드.
 * 생성중 자산은 폴링 화면(② 결과 / ① 처리 로딩)으로 보낸다 — 폴링 로직 중복 금지.
 * 디자인 정본: docs/specs/04-operations/2-detail.html
 */

/** 원본 요소 처리(krElementMap) — 판정 언어(색+글자+기호) */
const ACTION_STYLE: Record<string, { symbol: string; cls: string }> = {
  '유지·정제': { symbol: '○', cls: 'text-green-text' },
  재설계: { symbol: '△', cls: 'text-amber-text' },
  제거: { symbol: '✕', cls: 'text-danger-text' },
};

export default async function AssetDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const store = await getStore();

  const asset = await store.getAsset(assetId);
  if (asset) {
    if (asset.status === 'generating') redirect(`/app/studio/thumbnail/${asset.id}`);
    if (asset.status === 'failed') return <NotFoundView />; // 실패물은 상세에 도달하지 않는다(DETAIL-06)
    return <ThumbnailDetail asset={asset} />;
  }

  // 리포트 요약 모드(DETAIL-05)
  const request = await store.getRequest(assetId);
  if (request) {
    if (request.status === 'submitted' || request.status === 'processing') redirect(`/app/report/${request.id}`);
    if (request.status === 'failed') return <NotFoundView />;
    const report = await store.getReport(request.id);
    const scored = report?.overallScore !== null && report?.overallScore !== undefined;
    return (
      <DetailShell>
        <div className="grid grid-cols-[minmax(0,360px)_minmax(0,1fr)] items-start gap-9 max-lg:grid-cols-1">
          <figure className={cardClass('relative aspect-16/10 overflow-hidden p-0')}>
            <ReportCoverPreview score={report?.overallScore ?? null} />
          </figure>

          <div>
            <p className="text-[13px] font-bold tracking-[0.02em] text-coral-strong">자산 상세 · 리포트 요약</p>
            <h1 className="mt-2 text-2xl leading-[1.35] font-extrabold tracking-[-0.02em] text-ink [text-wrap:pretty]">
              {request.tierInput.brandName}
              {request.tierInput.productName ? ` · ${request.tierInput.productName}` : ''}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AxisChip axis="report" />
              <span className="text-[12.5px] text-ink-mute">발행 {report?.publishedAt?.slice(0, 10) ?? '—'}</span>
            </div>

            <div className={cardClass('mt-4 p-4')}>
              <p className="text-[11px] font-bold tracking-[0.01em] text-ink-mute">종합 점수</p>
              <p className="mt-1.5">
                {scored ? (
                  <span className="tnum text-[17px] font-extrabold text-ink">
                    {report?.overallScore}
                    <span className="font-semibold text-ink-faint">/100</span>
                  </span>
                ) : (
                  <span className="text-sm font-bold text-[#9ca0a8]">종합 점수 없음 · brand 모드</span>
                )}
              </p>
            </div>

            <p className="mt-4 text-[13px] leading-[1.7] text-ink-body [text-wrap:pretty]">
              이 화면은 리포트 표지와 종합 점수만 요약합니다. 9블록 진단·근거·재설계 카피는 리포트 전체 화면에서
              확인합니다.
            </p>

            <Link href={`/app/report/${request.id}`} className={buttonClass('primary', 'lg', 'mt-4.5 no-underline')}>
              리포트 전체 보기 →
            </Link>
            <p className="mt-2 text-[11.5px] text-ink-mute">
              ① 진단 리포트로 이동 — 이 화면에서 다른 축으로 이동하는 유일한 버튼입니다.
            </p>
          </div>
        </div>
      </DetailShell>
    );
  }

  return <NotFoundView />;
}

/** 썸네일 모드(DETAIL-02) */
function ThumbnailDetail({ asset }: { asset: GeneratedAssetRecord }) {
  const platformLabel = PLATFORM_LABELS[asset.platform as Platform] ?? asset.platform;
  const downloadName = `${asset.brandNameSnapshot}-${asset.styleName}-${platformLabel}.png`;
  const gateItems = asset.gateResult?.checks.map((c) => ({ label: c.label, pass: asset.gateResult!.passed })) ?? [];

  return (
    <DetailShell>
      <div className="grid grid-cols-[minmax(0,480px)_minmax(0,1fr)] items-start gap-9 max-lg:grid-cols-1">
        <div className="lg:sticky lg:top-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/files/${asset.imagePath}`}
            alt={`${asset.styleName}으로 재설계된 ${asset.brandNameSnapshot} 일본향 썸네일`}
            className="aspect-square w-full rounded-2xl border border-card-border object-cover shadow-card"
          />

          {gateItems.length > 0 && (
            <div className="mt-3.5">
              <GateBadges items={gateItems} />
            </div>
          )}

          {/* 다운로드(DETAIL-03 — ② RESULT-04와 동일 파일·파일명) */}
          <a href={`/api/files/${asset.imagePath}`} download={downloadName} className={buttonClass('primary', 'lg', 'mt-4 w-full no-underline')}>
            이미지 다운로드 (PNG)
          </a>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-mute [text-wrap:pretty]">
            AI 생성 이미지는 제안·데모용입니다. 플랫폼 게시용 제품 본체 컷은 브랜드 실촬영을 권장합니다.
          </p>

          {/* 유일한 축 이동(DETAIL-04) — 이동 예고 캡션을 버튼 옆에 표기 */}
          <div className="mt-4.5 border-t border-hairline pt-4">
            <Link href={`/app/studio/thumbnail?from=${asset.id}`} className={buttonClass('secondary', 'sm', 'no-underline')}>
              같은 이미지로 다른 템플릿 생성
            </Link>
            <p className="mt-2 text-[11.5px] text-ink-mute">
              ② 마케팅 스튜디오로 이동 — 이 화면에서 다른 축으로 이동하는 유일한 버튼입니다.
            </p>
          </div>
        </div>

        <div>
          <p className="text-[13px] font-bold tracking-[0.02em] text-coral-strong">자산 상세</p>
          <h1 className="mt-2 text-2xl leading-[1.35] font-extrabold tracking-[-0.02em] text-ink [text-wrap:pretty]">
            {asset.brandNameSnapshot} — {asset.styleName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AxisChip axis="studio" />
            <span className="text-[12.5px] text-ink-mute">
              {platformLabel} · {asset.createdAt.slice(0, 10)}
            </span>
          </div>

          {asset.explanationJson && (
            <>
              <section className={cardClass('mt-6 p-5 sm:p-6')}>
                <h2 className="text-[15px] font-bold text-ink">왜 이 스타일인가</h2>
                <p className="mt-2.5 text-[13.5px] leading-[1.75] text-ink-body [text-wrap:pretty]">
                  {asset.explanationJson.styleReason}
                </p>
              </section>

              <section className={cardClass('mt-3.5 p-5 sm:p-6')}>
                <h2 className="text-[15px] font-bold text-ink">카피는 이렇게 재설계됐다</h2>
                {asset.explanationJson.copySlots.length > 0 ? (
                  <div className="mt-2.5 space-y-2.5">
                    {asset.explanationJson.copySlots.map((slot) => (
                      <div key={slot.slotKey} className="rounded-lg bg-n-50 p-3.5">
                        {slot.krIntent && (
                          <p className="text-xs font-semibold text-ink-mute line-through decoration-ink-mute/40">
                            {slot.krIntent}
                          </p>
                        )}
                        <p lang="ja" className="mt-1.5 text-sm font-extrabold text-ink">
                          {slot.krIntent && (
                            <span aria-hidden className="mr-1 font-bold text-coral-strong">
                              →
                            </span>
                          )}
                          {slot.ja}
                        </p>
                        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-mute">근거 — {slot.rationale}</p>
                        {slot.footnote && (
                          <p lang="ja" className="mt-1 text-[11px] text-ink-faint">
                            {slot.footnote}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-mute">
                    이 문법은 카피 없이 제품 자체로 소구합니다 — 카피 슬롯이 없습니다.
                  </p>
                )}
              </section>

              {asset.explanationJson.krElementMap.length > 0 && (
                <details className={cardClass('mt-3.5 p-5 sm:p-6')}>
                  <summary className="cursor-pointer text-[15px] font-bold text-ink marker:text-ink-faint">
                    무엇을 바꿨나
                  </summary>
                  <table className="mt-3.5 w-full text-xs">
                    <thead>
                      <tr className="border-b border-n-150 text-left text-ink-mute">
                        <th className="py-1.5 pr-2 font-semibold">원본 요소</th>
                        <th className="py-1.5 pr-2 font-semibold">처리</th>
                        <th className="py-1.5 font-semibold">근거</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asset.explanationJson.krElementMap.map((row, i) => {
                        const style = ACTION_STYLE[row.action];
                        return (
                          <tr key={i} className="border-b border-n-150 align-top last:border-b-0">
                            <td className="py-2 pr-2 text-ink-body">{row.element}</td>
                            <td className={`py-2 pr-2 font-semibold whitespace-nowrap ${style?.cls ?? 'text-ink'}`}>
                              {style?.symbol} {row.action}
                            </td>
                            <td className="py-2 text-ink-mute">{row.reason}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </details>
              )}

              <p className="mt-4.5 text-[11px] leading-relaxed text-ink-faint">
                이 해설은 축약판입니다. 원본 요소 처리 표를 포함한 전체 해설은 생성 직후 ② 결과 화면에서 볼 수 있는
                것과 같은 데이터입니다.
              </p>
            </>
          )}
        </div>
      </div>
    </DetailShell>
  );
}

/** 상세 화면 공통 셸 — 컬럼 폭 + 백링크 */
function DetailShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[1120px] px-6 pt-11 pb-24 max-sm:px-5">
        <BackNav />
        {children}
      </div>
    </main>
  );
}

/** 운영 홈 백링크(DETAIL-00) — 사이드바 하위 메뉴는 "자산 라이브러리" 활성 유지 */
function BackNav() {
  return (
    <p className="mb-4.5">
      <Link href="/app/library" className="text-[12.5px] font-bold text-ink no-underline hover:text-coral-strong">
        ← 운영 홈
      </Link>
    </p>
  );
}

/** 미존재·실패 자산(DETAIL-06) — 백링크는 전체 화면 공통(DETAIL-00) */
function NotFoundView() {
  return (
    <DetailShell>
      <div className="mx-auto max-w-[520px] pt-6">
        <EmptyState
          icon={<IconBox size={40} />}
          title="자산을 찾을 수 없습니다"
          desc="주소의 자산 번호를 확인해 주세요. 브랜드 자산 라이브러리에서 다시 열어볼 수 있습니다."
          action={
            <Link href="/app/library" className={buttonClass('secondary', 'md', 'no-underline')}>
              운영 홈으로
            </Link>
          }
        />
      </div>
    </DetailShell>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db/store';
import { getSession } from '@/lib/server/session';
import { sessionOwnsBrand } from '@/lib/server/ownership';
import type { DiagnosisRequestRecord, GeneratedAssetRecord, ReportRecord } from '@/lib/db/store';
import { PLATFORM_LABELS, type Platform } from '@/lib/studio/platform';
import { ReportCoverPreview } from '@/components/app/AssetPreview';
import { AxisChip, EmptyState, StatusBadge, buttonClass, cardClass } from '@/components/ui/primitives';
import { BAND_BAR, BAND_LABEL, GROUP_LABELS_PREFIXED, GROUP_ORDER, scoreBand } from '@/lib/report/labels';
import { GateBadges } from '@/components/ui/progress';
import { IconBox } from '@/components/ui/icons';
import { normalizeExplanation } from '@/lib/studio/explanation';

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
  // 소유 검증 — 비소유·게스트가 uuid만으로 타 유저 자산을 열람하지 못하게 막는다.
  //  not-found와 동일하게 처리(존재 비노출): 소유 자산이 아니면 다음 모드로 흘러 결국 NotFoundView.
  const session = await getSession();

  const asset = await store.getAsset(assetId);
  if (asset && (await sessionOwnsBrand(asset.brandProfileId, session))) {
    if (asset.status === 'generating') redirect(`/app/studio/thumbnail/${asset.id}`);
    if (asset.status === 'failed') return <NotFoundView />; // 실패물은 상세에 도달하지 않는다(DETAIL-06)
    return <ThumbnailDetail asset={asset} />;
  }

  // 리포트 요약 모드(DETAIL-05)
  const request = await store.getRequest(assetId);
  if (request && (await sessionOwnsBrand(request.brandProfileId, session))) {
    if (request.status === 'submitted' || request.status === 'processing') redirect(`/app/report/${request.id}`);
    if (request.status === 'failed') return <NotFoundView />;
    const report = await store.getReport(request.id);
    if (!report) return <NotFoundView />;
    return <ReportSummaryDetail requestId={request.id} name={reportTitle(request)} report={report} />;
  }

  return <NotFoundView />;
}

/** 썸네일 모드(DETAIL-02) */
function ThumbnailDetail({ asset }: { asset: GeneratedAssetRecord }) {
  // 계약이 바뀌기 전에 저장된 해설도 현재 모양으로 맞춘다(마이그레이션 없음)
  const explanation = normalizeExplanation(asset.explanationJson);
  const platformLabel = PLATFORM_LABELS[asset.platform as Platform] ?? asset.platform;
  const downloadName = `${asset.brandNameSnapshot}-${asset.styleName}-${platformLabel}.png`;
  // 항목별 pass 를 쓴다 — 전체 passed 를 그대로 쓰면 한 항목이 걸렸을 때 통과한 항목까지 ✕ 로 보인다
  const gateItems = asset.gateResult?.checks.map((c) => ({ label: c.label, pass: c.pass !== false })) ?? [];

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

          {/* 축 이동(DETAIL-04) — 어디로 가는지만 버튼 옆에 밝힌다 */}
          <div className="mt-4.5 border-t border-hairline pt-4">
            <Link href={`/app/studio/thumbnail?from=${asset.id}`} className={buttonClass('secondary', 'sm', 'no-underline')}>
              같은 이미지로 다른 템플릿 생성
            </Link>
            <p className="mt-2 text-[11.5px] text-ink-mute">② 마케팅 스튜디오에서 새로 생성합니다.</p>
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

          {explanation && (
            <>
              <section className={cardClass('mt-6 p-5 sm:p-6')}>
                <h2 className="text-[15px] font-bold text-ink">왜 이 스타일인가</h2>
                <p className="mt-2.5 text-[13.5px] leading-[1.75] text-ink-body [text-wrap:pretty]">
                  {explanation.styleReason}
                </p>
              </section>

              <section className={cardClass('mt-3.5 p-5 sm:p-6')}>
                <h2 className="text-[15px] font-bold text-ink">카피는 이렇게 재설계됐다</h2>
                {explanation.copySlots.length > 0 ? (
                  <div className="mt-2.5 space-y-2.5">
                    {explanation.copySlots.map((slot) => (
                      <div key={slot.slotKey} className="rounded-lg bg-n-50 p-3.5">
                        {slot.krSource && (
                          <p className="text-xs font-semibold text-ink-mute line-through decoration-ink-mute/40">
                            {slot.krSource}
                          </p>
                        )}
                        <p lang="ja" className="mt-1.5 text-sm font-extrabold text-ink">
                          {slot.krSource && (
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

              {explanation.krElementMap.length > 0 && (
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
                      {explanation.krElementMap.map((row, i) => {
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

/** 카드 제목 — 제품 진단 / 브랜드 진단 구분 */
function reportTitle(request: DiagnosisRequestRecord): string {
  const t = request.tierInput;
  return t.productName ? `${t.brandName} · ${t.productName}` : t.brandName;
}

/** 요약 통계 타일 — 약기법 판정 3종처럼 수치 하나 + 라벨 한 줄 */
function SummaryTile({ value, label, tone }: { value: React.ReactNode; label: string; tone?: 'danger' | 'amber' | 'green' }) {
  const toneCls =
    tone === 'danger'
      ? 'bg-danger-bg text-danger-text'
      : tone === 'amber'
        ? 'bg-amber-bg text-amber-text'
        : tone === 'green'
          ? 'bg-green-bg text-green-text'
          : 'bg-n-50 text-ink';
  return (
    <div className={`rounded-[12px] p-3.5 ${toneCls}`}>
      <p className="tnum text-2xl leading-none font-extrabold">{value}</p>
      <p className="mt-1.5 text-[11.5px] font-semibold">{label}</p>
    </div>
  );
}

/** 데이터 잠금 카드 — 산출하지 않은 것을 0건으로 위장하지 않는다(증거 원칙, ① LockedCard 문법) */
function LockedCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[12px] border border-dashed border-input-border bg-n-50 p-4">
      <p className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-ink">
        <StatusBadge tone="off">잠김</StatusBadge>
        {title}
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-mute [text-wrap:pretty]">{body}</p>
    </div>
  );
}

/** 요약 섹션 제목 */
function SummaryHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[13px] font-extrabold tracking-[-0.01em] text-ink">{children}</h2>;
}

/**
 * 리포트 요약 모드(DETAIL-05) — 표지 + 9블록 요약.
 *
 * 2026-08-19 개편: 이 화면은 `getReport()` 로 blocksJson 전체를 이미 읽어 놓고 표지·종합점수
 * 3개 필드만 그린 뒤 버렸다. 같은 파일의 썸네일 모드가 3개 섹션을 그리는 밀도에 맞춰,
 * 이미 손에 든 데이터로 "리포트를 열기 전에 알아야 할 것"을 채운다.
 * 전체 열람은 여전히 ① 리포트 화면 몫이다 — 여기서 9블록을 다 펼치지 않는다.
 */
function ReportSummaryDetail({
  requestId,
  name,
  report,
}: {
  requestId: string;
  name: string;
  report: ReportRecord;
}) {
  const b = report.blocksJson;
  const scored = b.block1.scored;
  const audit = b.block3?.summary ?? null;
  const rows = b.block4.comparisonRows;
  const observed = rows.filter((r) => r.customerStatus === '관찰됨').length;
  const rewrite = b.block7?.rewrites?.[0] ?? null;
  const persona = b.block2.persona;

  return (
    <DetailShell>
      <div className="grid grid-cols-[minmax(0,340px)_minmax(0,1fr)] items-start gap-9 max-lg:grid-cols-1">
        <figure className={cardClass('relative aspect-square overflow-hidden p-0 max-lg:max-w-[340px]')}>
          <ReportCoverPreview
            score={report.overallScore}
            groupScores={report.groupScores}
            top3={report.top3}
          />
        </figure>

        <div className="min-w-0">
          <p className="text-[13px] font-bold tracking-[0.02em] text-coral-strong">자산 상세 · 리포트 요약</p>
          <h1 className="mt-2 text-2xl leading-[1.35] font-extrabold tracking-[-0.02em] text-ink [text-wrap:pretty]">{name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AxisChip axis="report" />
            <span className="text-[12.5px] text-ink-mute">
              {b.block0.categoryLabel} · 발행 {report.publishedAt?.slice(0, 10) ?? '—'}
            </span>
          </div>

          {/* 진단 요약(블록1) — 종합 점수에는 시급/보완/양호 밴드 라벨을 붙이지 않는다(§9-Q3) */}
          <section className={cardClass('mt-4.5 p-5')}>
            {b.block1.scored ? (
              <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
                <p className="flex items-baseline gap-1">
                  <span className="tnum text-[38px] leading-none font-extrabold tracking-[-0.03em] text-ink">
                    {b.block1.overallScore}
                  </span>
                  <span className="text-sm font-semibold text-ink-faint">/100</span>
                </p>
                <p className="min-w-[220px] flex-1 text-[13px] leading-relaxed text-ink-body [text-wrap:pretty]">
                  {b.block1.summaryText}
                </p>
              </div>
            ) : (
              <>
                <span className="inline-flex h-[26px] items-center rounded-full bg-n-150 px-[11px] text-[12px] font-bold text-ink-mute">
                  종합점수 없음 · brand 모드
                </span>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-body [text-wrap:pretty]">{b.block1.summaryText}</p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-mute [text-wrap:pretty]">
                  {b.block1.lockedReason} — {b.block1.unlockHint}
                </p>
              </>
            )}
            {b.block1.trustBadges.length > 0 && (
              <ul className="mt-3.5 flex list-none flex-wrap gap-1.5 p-0">
                {b.block1.trustBadges.map((badge) => (
                  <li
                    key={badge}
                    className="inline-flex h-[22px] items-center rounded-full bg-n-100 px-2.5 text-[11px] font-semibold text-ink-body"
                  >
                    {badge}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* A~E 그룹 충족도 + 먼저 고칠 지점 */}
          {scored && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <section className={cardClass('p-5')}>
                <SummaryHeading>영역별 충족도</SummaryHeading>
                <dl className="mt-3 flex flex-col gap-[7px]">
                  {GROUP_ORDER.map((g) => {
                    const pct = report.groupScores[g] ?? 0;
                    const band = scoreBand(pct);
                    return (
                      <div key={g} className="flex items-center gap-2.5 text-[11.5px]">
                        <dt className="w-[92px] flex-none text-ink-body">{GROUP_LABELS_PREFIXED[g]}</dt>
                        <dd className="m-0 flex flex-1 items-center gap-2.5">
                          <span
                            role="img"
                            aria-label={`${GROUP_LABELS_PREFIXED[g]} ${pct}% ${BAND_LABEL[band]}`}
                            className="h-1.5 flex-1 overflow-hidden rounded-full bg-n-150"
                          >
                            <span className={`block h-full rounded-full ${BAND_BAR[band]}`} style={{ width: `${pct}%` }} />
                          </span>
                          <b className="tnum w-8 flex-none text-right text-[11px] font-bold text-ink">{pct}%</b>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>

              {report.top3.length > 0 && (
                <section className={cardClass('p-5')}>
                  <SummaryHeading>먼저 고칠 지점</SummaryHeading>
                  <ol className="mt-3 flex list-none flex-col gap-2 p-0">
                    {report.top3.slice(0, 3).map((t, i) => (
                      <li key={t.itemId}>
                        {/* 전체 리포트의 해당 항목으로 바로 내려간다(ReportView 앵커) */}
                        <Link
                          href={`/app/report/${requestId}#rubric-${t.itemId}`}
                          className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-body no-underline hover:text-coral-strong"
                        >
                          <span
                            aria-hidden
                            className="mt-px inline-flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[5px] bg-coral-tint text-[10px] font-extrabold text-coral-strong"
                          >
                            {i + 1}
                          </span>
                          {t.title}
                        </Link>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          )}

          {/* 薬機法 위험 요약(블록3) · 벤치마크 관찰 현황(블록4) */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <section className={cardClass('p-5')}>
              <SummaryHeading>薬機法 위험</SummaryHeading>
              {audit ? (
                <>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <SummaryTile value={audit.ngCount} label="표현 불가 ✕" tone={audit.ngCount > 0 ? 'danger' : undefined} />
                    <SummaryTile
                      value={audit.conditionalCount}
                      label="조건부 △"
                      tone={audit.conditionalCount > 0 ? 'amber' : undefined}
                    />
                    <SummaryTile value={audit.okCount} label="가능 ○" tone={audit.okCount > 0 ? 'green' : undefined} />
                  </div>
                  <p className="mt-3 text-[12px] leading-relaxed text-ink-mute [text-wrap:pretty]">
                    1차 스크리닝 결과입니다. 문장별 판정 근거와 대체 표현은 리포트 전체에서 봅니다.
                  </p>
                </>
              ) : (
                <div className="mt-3">
                  <LockedCard
                    title="감사할 고객 문장 없음"
                    body="브랜드 진단은 상세페이지 문장을 받지 않아 문장 단위 감사를 하지 않습니다. 제품 콘텐츠를 넣으면 열립니다."
                  />
                </div>
              )}
            </section>

            <section className={cardClass('p-5')}>
              <SummaryHeading>일본 상위 제품 관례 대비</SummaryHeading>
              <p className="tnum mt-3 flex items-baseline gap-1">
                <span className="text-[30px] leading-none font-extrabold tracking-[-0.03em] text-ink">{observed}</span>
                <span className="text-[13px] font-semibold text-ink-faint">/ {rows.length} 장치 관찰됨 ○</span>
              </p>
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-mute [text-wrap:pretty]">
                라쿠텐 상세 {b.block4.sampleCount}건 코퍼스 기준. 관찰되지 않은 장치는 리포트 전체의 비교표에서
                항목별로 확인합니다.
              </p>
            </section>
          </div>

          {/* 페르소나 한 줄(블록2) */}
          <section className={cardClass('mt-4 p-5')}>
            <SummaryHeading>이 리포트가 가정한 일본 고객</SummaryHeading>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-body [text-wrap:pretty]">
              <b className="font-bold text-ink">
                {persona.name} · {persona.ageRange}
              </b>{' '}
              — {persona.buyingMotive}
            </p>
            {persona.skinConcerns.length > 0 && (
              <ul className="mt-2.5 flex list-none flex-wrap gap-1.5 p-0">
                {persona.skinConcerns.slice(0, 4).map((c) => (
                  <li key={c} className="inline-flex h-[22px] items-center rounded-full bg-n-100 px-2.5 text-[11.5px] font-semibold text-ink-body">
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 재설계 카피 1건(블록7) — 없으면 섹션 자체를 그리지 않는다(빈 카드 금지) */}
          {rewrite && (
            <section className={cardClass('mt-4 p-5')}>
              <SummaryHeading>재설계된 문구 (1건 미리보기)</SummaryHeading>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-[10px] border border-card-border bg-n-50 p-3.5">
                  <p className="text-[11px] font-bold text-ink-faint">BEFORE · KR</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-mute line-through">{rewrite.beforeKr}</p>
                </div>
                <div className="rounded-[10px] border border-coral/30 bg-coral-tint p-3.5">
                  <p className="text-[11px] font-bold text-coral-strong">AFTER · JP</p>
                  <p lang="ja" className="mt-1.5 text-[12.5px] leading-relaxed font-bold text-ink">
                    {rewrite.afterJa}
                  </p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-mute">{rewrite.afterKr}</p>
                </div>
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-mute [text-wrap:pretty]">{rewrite.reason}</p>
            </section>
          )}

          <Link href={`/app/report/${requestId}`} className={buttonClass('primary', 'lg', 'mt-5 no-underline')}>
            리포트 전체 보기 →
          </Link>
        </div>
      </div>
    </DetailShell>
  );
}

/** 상세 화면 공통 셸 — 컬럼 폭 + 백링크 */
function DetailShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="animate-fade-up">
      <div className="mx-auto max-w-[1280px] px-8 pt-[72px] pb-24 max-sm:px-5">
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

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db/store';
import { PLATFORM_LABELS, type Platform } from '@/lib/studio/platform';

/**
 * ③ 자산 상세(DETAIL-00~07) — 자산 1건 재열람. 조회 전용(재생성·편집 없음).
 * assetId가 GeneratedAsset이면 썸네일 모드, DiagnosisRequest면 리포트 요약 모드.
 * 생성중 자산은 폴링 화면(② 결과 / ① 처리 로딩)으로 보낸다 — 폴링 로직 중복 금지.
 */
export default async function AssetDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const store = await getStore();

  const asset = await store.getAsset(assetId);
  if (asset) {
    if (asset.status === 'generating') redirect(`/app/studio/thumbnail/${asset.id}`);
    if (asset.status === 'failed') return <NotFoundView />; // 실패물은 상세에 도달하지 않는다(DETAIL-06)

    const platformLabel = PLATFORM_LABELS[asset.platform as Platform] ?? asset.platform;
    const downloadName = `${asset.brandNameSnapshot}-${asset.styleName}-${platformLabel}.png`;
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <BackNav />
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/files/${asset.imagePath}`}
              alt={`${asset.styleName}으로 재설계된 ${asset.brandNameSnapshot} 일본향 썸네일`}
              className="aspect-square w-full rounded-2xl border border-neutral-200 object-cover"
            />
            {asset.gateResult && (
              <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm">
                <p className="font-semibold text-emerald-900">검수 게이트 통과 ○</p>
                <ul className="mt-1.5 space-y-1 text-xs text-emerald-900">
                  {asset.gateResult.checks.map((c) => (
                    <li key={c.key}>✓ {c.label}</li>
                  ))}
                </ul>
              </div>
            )}
            {/* 다운로드(DETAIL-03 — ② RESULT-04와 동일 파일·파일명) */}
            <a
              href={`/api/files/${asset.imagePath}`}
              download={downloadName}
              className="mt-4 block w-full rounded-lg bg-[#FF6464] px-6 py-3 text-center text-sm font-bold text-white hover:bg-[#D93636]"
            >
              이미지 다운로드 (PNG · 1024×1024)
            </a>
            <p className="mt-2 text-xs text-neutral-500">
              AI 생성 이미지는 제안·데모용입니다. 플랫폼 게시용 제품 본체 컷은 브랜드 실촬영을 권장합니다
            </p>
            {/* 유일한 축 이동(DETAIL-04) — 이동 예고 캡션을 버튼 텍스트에 포함 */}
            <Link href={`/app/studio/thumbnail?from=${asset.id}`} className="mt-3 inline-block text-sm text-[#D93636] underline">
              같은 이미지로 다른 템플릿 생성 — ② 스튜디오 홈으로 이동해 새로 생성합니다 →
            </Link>
          </div>

          <aside>
            <div className="rounded-xl border border-neutral-200 p-4 text-sm">
              <span className="rounded-full bg-[#FFF1F1] px-2.5 py-1 text-xs font-semibold text-[#D93636]">{asset.styleName}</span>
              <dl className="mt-3 space-y-1.5 text-xs text-neutral-600">
                <div className="flex justify-between">
                  <dt>타깃 플랫폼</dt>
                  <dd className="font-medium text-neutral-900">{platformLabel}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>생성일</dt>
                  <dd className="font-medium text-neutral-900">{asset.createdAt.slice(0, 10)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-neutral-500">원본 (Before)</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${asset.originalImagePath}`} alt="원본 이미지" className="mt-1 h-24 w-24 rounded-lg border border-neutral-200 object-cover" />
            </div>

            {/* 재설계 해설(DETAIL-02) — 해설 데이터 없으면 영역 미출력 */}
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
                      {slot.footnote && <p lang="ja" className="mt-0.5 text-xs text-neutral-500">각주 {slot.footnote}</p>}
                    </div>
                  ))}
                </div>
                {asset.explanationJson.krElementMap.length > 0 && (
                  <div className="mt-4">
                    <h2 className="font-bold">무엇을 바꿨나</h2>
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
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>
    );
  }

  // 리포트 요약 모드(DETAIL-05)
  const request = await store.getRequest(assetId);
  if (request) {
    if (request.status === 'submitted' || request.status === 'processing') redirect(`/app/report/${request.id}`);
    if (request.status === 'failed') return <NotFoundView />;
    const report = await store.getReport(request.id);
    const scored = report?.overallScore !== null && report?.overallScore !== undefined;
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <BackNav />
        <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 p-8">
          <p className="text-xs font-semibold tracking-wide text-[#D93636]">KGLOW 진단 리포트</p>
          <h1 className="mt-2 text-xl font-bold">
            {request.tierInput.brandName}
            {request.tierInput.productName ? ` · ${request.tierInput.productName}` : ''}
          </h1>
          {scored ? (
            <p className="mt-4 text-4xl font-bold">
              {report?.overallScore}
              <span className="text-lg font-medium text-neutral-400">/100</span>
            </p>
          ) : (
            <p className="mt-4 text-sm font-medium text-neutral-500">종합점수 없음 · brand 모드</p>
          )}
          <p className="mt-2 text-xs text-neutral-500">발행 {report?.publishedAt?.slice(0, 10) ?? '—'}</p>
          <div aria-hidden className="mt-5 space-y-1.5">
            <div className="h-1.5 w-4/5 rounded bg-neutral-200" />
            <div className="h-1.5 w-3/5 rounded bg-neutral-200" />
            <div className="h-1.5 w-2/3 rounded bg-neutral-200" />
          </div>
          <Link
            href={`/app/report/${request.id}`}
            className="mt-6 block rounded-lg bg-[#FF6464] px-6 py-3 text-center text-sm font-bold text-white hover:bg-[#D93636]"
          >
            리포트 전체 보기 — ① 진단 리포트 전체 화면으로 이동합니다
          </Link>
        </div>
      </main>
    );
  }

  return <NotFoundView />;
}

/** 사이드바 하위 메뉴는 "자산 라이브러리" 활성 유지 — 라이브러리의 하위 화면(DETAIL-00) */
function BackNav() {
  return (
    <nav className="mb-6 text-sm">
      <Link href="/app/library" className="text-[#D93636] underline">← 자산 라이브러리</Link>
    </nav>
  );
}

/** 미존재·실패 자산(DETAIL-06) */
function NotFoundView() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-lg font-semibold">자산을 찾을 수 없습니다</p>
      <Link href="/app/library" className="mt-3 inline-block text-sm text-[#D93636] underline">
        운영 홈으로 →
      </Link>
    </main>
  );
}

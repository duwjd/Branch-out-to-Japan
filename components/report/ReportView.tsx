/**
 * 리포트 9블록 뷰 — blocksJson(08 §3.4 렌더 계약)을 그대로 렌더한다.
 * 기능 검증 빌드: 시맨틱 구조·근거 노출(증거 원칙)에 집중, 시각 디자인은 확정 후 교체.
 * 블록 내용 정본: 01-report-spec §4.
 */

import type { BlocksJson } from '@/lib/engine/types';

interface ReportViewProps {
  blocks: BlocksJson;
  /** 리포트 끝(블록 9 뒤)에 놓는 내보내기 CTA — 페이지가 SlideExport 등을 주입한다 */
  slideExportSlot?: React.ReactNode;
}

const GROUP_LABELS: Record<string, string> = {
  A: 'A 신뢰 구축',
  B: 'B 무첨가·안전',
  C: 'C 서사 구조',
  D: 'D 성분 프레이밍',
  E: 'E 카테고리 적합성',
};

const VERDICT_STYLE: Record<string, string> = {
  불가: 'bg-red-100 text-red-900',
  조건부: 'bg-amber-100 text-amber-900',
  가능: 'bg-emerald-100 text-emerald-900',
};

/** 블록 공통 래퍼 — 번호·제목 + 본문 */
function Block({ no, title, children }: { no: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`block-${no}`} className="border-t border-neutral-200 py-8 first:border-t-0">
      <h2 id={`block-${no}`} className="text-lg font-bold">
        <span className="mr-2 text-neutral-400">블록 {no}</span>
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/**
 * 데이터 잠금 블록(브랜드 진단 · 스펙 §3.3) — 산출하지 않은 것을 빈 값·0건으로 위장하지 않는다(증거 원칙).
 * 잠긴 이유와 여는 방법을 명시한다 — 브랜드+제품 진단으로의 상향 동선을 겸한다.
 */
function LockedBlock({ no, title, unlocks }: { no: number; title: string; unlocks: string }) {
  return (
    <Block no={no} title={title}>
      <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm">
        <p className="font-semibold text-neutral-700">
          <span className="mr-2 rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-bold text-neutral-600">잠김</span>
          이 블록은 브랜드 진단에 포함되지 않습니다
        </p>
        <p className="mt-2 text-neutral-600">
          고객 문장이 없어 산출할 수 없습니다. 상세페이지 카피를 넣으면 {unlocks} — 새 진단에서 제품 정보의
          &ldquo;진단 대상 콘텐츠&rdquo;를 채워 주세요.
        </p>
      </div>
    </Block>
  );
}

export function ReportView({ blocks, slideExportSlot }: ReportViewProps) {
  const b = blocks;
  return (
    <article className="space-y-2">
      {b.meta.llmMode === 'mock' && (
        <p className="rounded-lg bg-sky-100 p-3 text-sm font-medium text-sky-900">
          목(mock) 모드 리포트 — 판정은 데모용 고정 로직입니다. 실제 진단은 ANTHROPIC_API_KEY 설정 후.
        </p>
      )}
      {b.meta.precisionLimited && (
        <p className="rounded-lg bg-amber-100 p-3 text-sm font-medium text-amber-900">
          정밀도 제한 — 입력 콘텐츠가 200자 미만이라 일부 블록이 카테고리 일반형으로 산출되었습니다.
        </p>
      )}

      {/* 블록 0 — 품의용 요약 표지 */}
      <Block no={0} title="품의용 요약 표지">
        <dl className="grid gap-x-8 gap-y-2 rounded-xl border border-neutral-200 p-5 text-sm sm:grid-cols-2">
          <div><dt className="inline font-semibold">브랜드: </dt><dd className="inline">{b.block0.brandName}</dd></div>
          <div><dt className="inline font-semibold">제품: </dt><dd className="inline">{b.block0.productName}</dd></div>
          <div><dt className="inline font-semibold">카테고리: </dt><dd className="inline">{b.block0.categoryLabel}</dd></div>
          <div><dt className="inline font-semibold">제품 분류: </dt><dd className="inline">{b.block0.productClassLabel}</dd></div>
          <div><dt className="inline font-semibold">가격: </dt><dd className="inline">{b.block0.priceLabel}</dd></div>
          <div><dt className="inline font-semibold">발행일: </dt><dd className="inline">{b.block0.issuedAt}</dd></div>
          <div className="sm:col-span-2"><dt className="inline font-semibold">진단 범위: </dt><dd className="inline">{b.block0.scope}</dd></div>
          <div className="sm:col-span-2"><dt className="inline font-semibold">한계 요약: </dt><dd className="inline">{b.block0.limitSummary}</dd></div>
        </dl>
      </Block>

      {/* 블록 1 — 진단 요약 헤더 (scored 판별 유니온 — 점수 없는 리포트에 0을 그리지 않는다) */}
      <Block no={1} title="진단 요약 — 일본 상세 관례 충족도">
        {b.block1.scored ? (
          <>
            <div className="flex flex-wrap items-end gap-6">
              <p>
                <span className="text-5xl font-extrabold">{b.block1.overallScore}</span>
                <span className="text-xl text-neutral-500"> / 100</span>
              </p>
              <ul className="flex flex-wrap gap-2 text-xs">
                {b.block1.trustBadges.map((badge) => (
                  <li key={badge} className="rounded-full border border-neutral-300 px-2 py-1 text-neutral-600">{badge}</li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-neutral-500">종합점수는 성과 예측이 아니라 &ldquo;일본 상세 관례 충족도&rdquo;입니다.</p>
            <p className="max-w-2xl whitespace-pre-line text-neutral-800">{b.block1.summaryText}</p>
            <div>
              <h3 className="text-sm font-semibold">최우선 재설계 Top 3</h3>
              <ol className="mt-2 space-y-1 text-sm">
                {b.block1.top3.map((t, i) => (
                  <li key={t.itemId}>
                    <span className="font-semibold text-[#D93636]">{i + 1}. {t.itemId}</span> {t.title} — {t.score}점
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
              <p className="font-semibold text-neutral-800">종합점수 없음 — {b.block1.lockedReason}</p>
              <p className="mt-1 text-neutral-600">{b.block1.unlockHint}</p>
            </div>
            <ul className="flex flex-wrap gap-2 text-xs">
              {b.block1.trustBadges.map((badge) => (
                <li key={badge} className="rounded-full border border-neutral-300 px-2 py-1 text-neutral-600">{badge}</li>
              ))}
            </ul>
            <p className="max-w-2xl whitespace-pre-line text-neutral-800">{b.block1.summaryText}</p>
          </>
        )}
      </Block>

      {/* 블록 2 — 페르소나·구매여정·USP */}
      <Block no={2} title="일본향 타깃 페르소나 · 구매여정 · USP 재정의">
        <div className="rounded-xl border border-neutral-200 p-5">
          <h3 className="font-semibold">{b.block2.persona.name} · {b.block2.persona.ageRange}</h3>
          <dl className="mt-2 space-y-1 text-sm text-neutral-700">
            <div><dt className="inline font-medium">피부 고민: </dt><dd className="inline">{b.block2.persona.skinConcerns.join(', ')}</dd></div>
            <div><dt className="inline font-medium">구매 동기: </dt><dd className="inline">{b.block2.persona.buyingMotive}</dd></div>
            <div><dt className="inline font-medium">구매 전 확인: </dt><dd className="inline">{b.block2.persona.checkBehaviors.join(' · ')}</dd></div>
            <div><dt className="inline font-medium">가격 감도: </dt><dd className="inline">{b.block2.persona.priceSensitivity}</dd></div>
            <div><dt className="inline font-medium">신뢰 트리거: </dt><dd className="inline">{b.block2.persona.trustTriggers.join(' · ')}</dd></div>
          </dl>
        </div>
        <div>
          <h3 className="text-sm font-semibold">구매 여정</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-neutral-700">
            {b.block2.journey.stages.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <p className="mt-1 text-sm text-neutral-700"><strong>최종 확신 지점:</strong> {b.block2.journey.finalConfidencePoint}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold">구매 반대 이유 (첫 의문)</h3>
          <ul className="mt-1 space-y-1 text-sm text-neutral-700">
            {b.block2.objections.map((o) => (
              <li key={o.question}><span lang="ja" className="font-medium">{o.question}</span> — {o.why}</li>
            ))}
          </ul>
        </div>
        <div className="overflow-x-auto">
          <h3 className="text-sm font-semibold">USP 재정의 표</h3>
          <table className="mt-2 w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th scope="col" className="py-2 pr-3">현재(KR) 소구</th>
                <th scope="col" className="py-2 pr-3">일본 고객에게 읽히는 방식</th>
                <th scope="col" className="py-2">재정의된 구매이유(USP)</th>
              </tr>
            </thead>
            <tbody>
              {b.block2.uspTable.map((row, i) => (
                <tr key={i} className="border-b border-neutral-100 align-top">
                  <td className="py-2 pr-3">{row.krAppeal}</td>
                  <td className="py-2 pr-3 text-neutral-600">{row.jpReading}</td>
                  <td className="py-2 font-medium">{row.redefinedUsp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      {/* 블록 3 — 약기법 전수 감사 (null = 브랜드 진단 데이터 잠금) */}
      {b.block3 === null ? (
        <LockedBlock no={3} title="薬機法 표현 전수 감사 (1차 스크리닝)" unlocks="문장별 불가/조건부/가능 판정과 조항 각주·합법 대체 표현이 열립니다" />
      ) : (
      <Block no={3} title="薬機法 표현 전수 감사 (1차 스크리닝)">
        <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">{b.block3.gradeNote}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th scope="col" className="py-2 pr-3">등급</th>
                <th scope="col" className="py-2 pr-3">말할 수 있는 것</th>
                <th scope="col" className="py-2">말할 수 없는 것</th>
              </tr>
            </thead>
            <tbody>
              {b.block3.gradeRows.map((g) => (
                <tr key={g.grade} className="border-b border-neutral-100 align-top">
                  <td className="py-2 pr-3 font-medium" lang="ja">{g.grade}</td>
                  <td className="py-2 pr-3 text-neutral-700">{g.canSay}</td>
                  <td className="py-2 text-neutral-700">{g.cannotSay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm font-medium">
          감사 요약: 총 {b.block3.sentences.length}개 문장 중{' '}
          <span className="text-red-700">불가 {b.block3.summary.ngCount}</span> ·{' '}
          <span className="text-amber-700">조건부 {b.block3.summary.conditionalCount}</span> ·{' '}
          <span className="text-emerald-700">가능 {b.block3.summary.okCount}</span>
          {' '}— 최고위험 문장: <strong>{b.block3.summary.highestRiskId}</strong>
        </p>
        <div className="space-y-3">
          {b.block3.sentences.map((s) => (
            <article key={s.sentenceId} className="rounded-xl border border-neutral-200 p-4 text-sm">
              <header className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold">{s.sentenceId}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-bold ${VERDICT_STYLE[s.verdict]}`}>【{s.verdict}】</span>
                {s.clauseRefs.length > 0 && (
                  <span className="text-xs text-neutral-500">근거 조항 {s.clauseRefs.map((r) => `[${r}]`).join('')}</span>
                )}
              </header>
              <p className="mt-2 text-neutral-800">{s.originalText}</p>
              <p className="mt-1 text-neutral-600">{s.reason}</p>
              {s.altTextJa && (
                <p className="mt-2 rounded bg-emerald-50 p-2">
                  <span className="text-xs font-semibold text-emerald-800">합법 대체표현 </span>
                  <span lang="ja">{s.altTextJa}</span>
                </p>
              )}
            </article>
          ))}
        </div>
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">{b.block3.disclaimer}</p>
      </Block>
      )}

      {/* 블록 4 — 벤치마크 */}
      <Block no={4} title={`카테고리 경쟁 벤치마크 (코퍼스 ${b.block4.sampleCount}건 실측)`}>
        {b.block4.narrative && <p className="text-neutral-800">{b.block4.narrative}</p>}
        {b.block4.corpusQuotes.length > 0 && (
          <ul className="space-y-1 text-sm">
            {b.block4.corpusQuotes.map((q) => (
              <li key={q.device}>
                <span className="font-medium">{q.device}:</span> <span lang="ja" className="text-neutral-700">「{q.quote}」</span>
              </li>
            ))}
          </ul>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th scope="col" className="py-2 pr-3">신뢰 장치</th>
                <th scope="col" className="py-2 pr-3">일본 상위 제품 실제 표현</th>
                <th scope="col" className="py-2 pr-3">내 콘텐츠</th>
                <th scope="col" className="py-2">갭</th>
              </tr>
            </thead>
            <tbody>
              {b.block4.comparisonRows.map((row) => (
                <tr key={row.device} className="border-b border-neutral-100 align-top">
                  <td className="py-2 pr-3 font-medium">{row.device}</td>
                  <td className="py-2 pr-3 text-neutral-700" lang="ja">{row.corpusExample}</td>
                  {/* 3분기: 관찰됨(녹) / 미확인(중립 — 브랜드 진단: 찾아본 적 없음) / 미관찰(적 — 찾아봤는데 없음) */}
                  <td className={`py-2 pr-3 font-medium ${row.customerStatus === '관찰됨' ? 'text-emerald-700' : row.customerStatus === '미확인' ? 'text-neutral-500' : 'text-red-700'}`}>{row.customerStatus}</td>
                  <td className="py-2 text-neutral-600">{row.gapNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {b.block4.searchTermRows.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold">일본 검색·고민 어휘 (빈도 실측)</h3>
            <ul className="mt-1 flex flex-wrap gap-2 text-xs">
              {b.block4.searchTermRows.map((t) => (
                <li key={t.term} className="rounded-full border border-neutral-300 px-2 py-1">
                  <span lang="ja">{t.term}</span> <span className="text-neutral-500">{t.frequency}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Block>

      {/* 블록 5 — A~E 점수 (null = 브랜드 진단 데이터 잠금) */}
      {b.block5 === null ? (
        <LockedBlock no={5} title="일본 문법 진단 점수 (A~E 루브릭)" unlocks="A~E 축별 채점과 통과 기준·내 문장·코퍼스 근거가 열립니다" />
      ) : (
      <Block no={5} title="일본 문법 진단 점수 (A~E 루브릭)">
        <div className="space-y-2">
          {Object.entries(b.block5.groupScores).map(([group, score]) => (
            <div key={group} className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0 font-medium">{GROUP_LABELS[group]}</span>
              <div className="h-3 flex-1 overflow-hidden rounded bg-neutral-100" role="img" aria-label={`${GROUP_LABELS[group]} ${score}%`}>
                <div className="h-full bg-[#FF6464]" style={{ width: `${score}%` }} />
              </div>
              <span className="w-14 text-right tabular-nums">{score}%</span>
              {/* b.block5!는 이 분기(=== null의 반대)에서만 렌더되지만 콜백 스코프라 TS 좁힘이 풀린다 */}
              <span className="w-16 text-right text-xs text-neutral-500">가중 {b.block5!.weights[group as 'A' | 'B' | 'C' | 'D' | 'E']}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {b.block5.items.map((item) => (
            <details key={item.itemId} className="rounded-lg border border-neutral-200 p-3 text-sm">
              <summary className="cursor-pointer">
                <span className="font-mono font-semibold">{item.itemId}</span>{' '}
                <span className="font-medium">{item.title}</span>{' '}
                <span className={`ml-1 rounded px-1.5 py-0.5 text-xs font-bold ${item.score === 2 ? 'bg-emerald-100 text-emerald-900' : item.score === 1 ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'}`}>
                  {item.score}점
                </span>
              </summary>
              <dl className="mt-2 space-y-1 text-neutral-700">
                <div><dt className="inline font-medium">통과 기준: </dt><dd className="inline">{item.criterion}</dd></div>
                <div><dt className="inline font-medium">내 문장: </dt><dd className="inline">{item.evidenceQuote || '(해당 표현 미관찰)'}</dd></div>
                <div><dt className="inline font-medium">코퍼스 근거: </dt><dd className="inline">{item.corpusRef || '—'}</dd></div>
              </dl>
            </details>
          ))}
        </div>
      </Block>
      )}

      {/* 블록 6 — 리뷰 인과 서사 */}
      <Block no={6} title="리뷰(口コミ) 인과 서사 — 카테고리 일반형">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th scope="col" className="py-2 pr-3">정보 공백</th>
                <th scope="col" className="py-2 pr-3">불신 신호</th>
                <th scope="col" className="py-2">이탈 행동</th>
              </tr>
            </thead>
            <tbody>
              {b.block6.narrative.map((row, i) => (
                <tr key={i} className="border-b border-neutral-100 align-top">
                  <td className="py-2 pr-3">{row.infoGap}</td>
                  <td className="py-2 pr-3 text-neutral-700">{row.distrustSignal}</td>
                  <td className="py-2 text-neutral-700">{row.dropOff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500">{b.block6.generalNote}</p>
      </Block>

      {/* 블록 7 — NG/OK 재작성 (null = 브랜드 진단 잠금 / rewrites:[] = 콜④ 실패 폴백 — 의미가 다르다) */}
      {b.block7 === null ? (
        <LockedBlock no={7} title="NG/OK 재작성 (Before/After + 한국어 병기)" unlocks="저점 문장의 Before/After 재작성과 한국어 역해설이 열립니다" />
      ) : (
      <Block no={7} title="NG/OK 재작성 (Before/After + 한국어 병기)">
        {b.block7.rewrites.length === 0 ? (
          <p className="text-sm text-neutral-500">재작성 생성에 실패했습니다 — 재실행 시 채워집니다.</p>
        ) : (
          <div className="space-y-4">
            {b.block7.rewrites.map((rw, i) => (
              <article key={i} className="rounded-xl border border-neutral-200 p-5 text-sm">
                <h3 className="text-xs font-semibold text-neutral-500">재작성 {i + 1} · 근거 {rw.sourceRef}</h3>
                <dl className="mt-3 space-y-2">
                  <div>
                    <dt className="text-xs font-semibold text-red-700">Before (KR 원문)</dt>
                    <dd className="mt-0.5 text-neutral-700 line-through decoration-neutral-400">{rw.beforeKr}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-neutral-500">문제</dt>
                    <dd className="mt-0.5 text-neutral-700">{rw.problem}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-emerald-700">After (JP 재설계)</dt>
                    <dd className="mt-0.5 font-medium" lang="ja">{rw.afterJa}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-neutral-500">한국어 역해설</dt>
                    <dd className="mt-0.5 text-neutral-700">{rw.afterKr}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-neutral-500">이유 · 무엇을 더했나</dt>
                    <dd className="mt-0.5 text-neutral-700">
                      {rw.reason}
                      {rw.whatAdded.length > 0 && (
                        <span className="mt-1 block text-xs text-neutral-500">더한 것: {rw.whatAdded.join(' · ')}</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </Block>
      )}

      {/* 블록 8 — 비포&애프터 샘플 (null = 브랜드 진단 데이터 잠금) */}
      {b.block8 === null ? (
        <LockedBlock no={8} title="비포&애프터 샘플 (한 블록 통째 재구성)" unlocks="한 블록을 통째로 재구성한 일본어 샘플과 한국어 병기가 열립니다" />
      ) : (
      <Block no={8} title="비포&애프터 샘플 (한 블록 통째 재구성)">
        {b.block8.afterJaBlock ? (
          <div className="rounded-xl border border-neutral-200 p-5 text-sm">
            <h3 className="text-xs font-semibold text-neutral-500">
              대상 섹션: {b.block8.targetSection}
              {b.block8.isDemo && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">예시(데모)</span>}
            </h3>
            <p className="mt-3 whitespace-pre-line text-base font-medium" lang="ja">{b.block8.afterJaBlock}</p>
            <p className="mt-3 whitespace-pre-line text-neutral-700">{b.block8.afterKrBlock}</p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">샘플 생성에 실패했습니다 — 재실행 시 채워집니다.</p>
        )}
      </Block>
      )}

      {/* 블록 9 — 맺음 */}
      <Block no={9} title="맺음 · 규정 출처 · 한계 · 다음 단계">
        <div>
          <h3 className="text-sm font-semibold">지금 할 일 (위험 순)</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-neutral-800">
            {b.block9.actions.map((a) => <li key={a}>{a}</li>)}
          </ol>
        </div>
        <div>
          <h3 className="text-sm font-semibold">규정 출처</h3>
          <ul className="mt-1 space-y-1 text-xs text-neutral-600">
            {b.block9.sources.map((s) => (
              <li key={s.id}>
                [{s.id}] {s.title} — {s.source}
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" className="ml-1 text-[#D93636] underline">원문</a>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">한계 고지</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-neutral-600">
            {b.block9.limits.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </div>
        <div className="overflow-x-auto">
          <h3 className="text-sm font-semibold">다음 단계 — 고정가 (견적 왕복 없음)</h3>
          <table className="mt-2 w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th scope="col" className="py-2 pr-3">단계</th>
                <th scope="col" className="py-2 pr-3">가격</th>
                <th scope="col" className="py-2">내용</th>
              </tr>
            </thead>
            <tbody>
              {b.block9.funnel.map((f) => (
                <tr key={f.step} className="border-b border-neutral-100">
                  <td className="py-2 pr-3 font-medium">{f.step}</td>
                  <td className="py-2 pr-3">{f.price}</td>
                  <td className="py-2 text-neutral-600">{f.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      {slideExportSlot && (
        <div className="flex justify-center border-t border-neutral-200 pt-8">{slideExportSlot}</div>
      )}
    </article>
  );
}

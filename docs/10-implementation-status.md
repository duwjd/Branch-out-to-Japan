# 10 · 구현 현황 (기능 검증 빌드)

> **무엇이 실제로 돌아가는가**의 스냅샷 문서. 2026-07-16 기준 — 메인페이지 + ① 진단 리포트 한 사이클(입력→파이프라인→9블록 뷰→발행)이 **두 진단 모드**(`brand` 브랜드 진단 / `brandProduct` 브랜드+제품 진단)로 작동하고, 보고용 슬라이드 내보내기(모드별 7장/4장)까지 작동한다.
> **2026-07-16 변경:** 검수 단계 제거(파이프라인 성공 = 발행) · 보고용 슬라이드 추가 · **입력 브랜드 우선 재구성(v4 — 두 진단 모드·`positioning` 신설·`gates.ts` 단일화)** → [[decisions/DECISIONS]] · [[specs/01-report-spec]] v3·v4.
> **⚠ 2026-07-18 v6 스펙 개정 — 코드 미반영:** 스펙·와이어프레임은 **블록 6 재프레이밍**(리뷰 인과 서사 → 정보 공백→이탈 경로 · 리뷰 데이터 없음)·**블록 7·8 통합**(7-1 문장 재작성 + 7-2 통째 재구성)·**블록 9→8 재번호**(리포트 = 블록 0~8)로 갔으나, **아래 구현 현황은 개정 전 코드(블록 0~9 · `reviewNarrative` 스키마 · 블록 7/8 분리) 기준**이다. 코드(`lib/engine`·`components/report/ReportView.tsx`·콜③/④ 스키마) 반영은 후속 작업. 정본: [[specs/01-report-spec]] v6 · [[08-data-flow]] v6.
> 계획 대비 진척은 [[09-dev-spec]] §4 체크박스, 데이터 계약은 [[08-data-flow]], 제품 정의는 [[specs/01-report-spec]]이 정본. 이 문서는 "지금 어디까지 왔고, 어떻게 돌리고, 무엇이 남았나"만 담는다.
> 디자인: **기능 검증용 미니멀 UI** — `design/` 확정안이 나오면 컴포넌트 구조 유지한 채 스타일만 교체하는 전제.

---

## 1. 한눈에 — 지금 돌아가는 것

| 구분 | 상태 |
|---|---|
| 메인페이지(랜딩) | ✅ 확정 카피 12섹션(`public-onboarding-spec` §1 그대로) · Stats 수치 비노출 규칙 준수 |
| ① 리포트: 진단 입력폼 | ✅ **브랜드 섹션 필수**(브랜드명 · 포지셔닝 = 택소노미 태그 1~5(16종, `rules/positioning.ts`)+자유 서술 · 카테고리) + **제품 섹션 전부 선택**(접이식 — 분류·제품명·성분·가격·상세 콘텐츠) · **50자 하드게이트(버튼 잠금 + 서버 400)** · 200자 미만 "정밀도 제한" 안내 · 서버 이중 검증 6종 400 확인 · `reviewSourceUrl` 폼 제거(데드필드) |
| ① 리포트: 생성 파이프라인 | ✅ 규칙 5단계 + **LLM 4콜**(①②③ 병렬 → 집계 → ④) · `claude-sonnet-5` 구조화 출력 · 프롬프트 캐싱 · 콜별 폴백 · **`brand` 모드는 콜③ 1콜만**(stages `persona → benchmark → assemble` · **콜③ 실패 = 잡 실패**) |
| ① 리포트: 9블록 뷰 | ✅ 블록0~9 전부 렌더(품의 표지·감사표·A~E 점수·NG/OK JP+KR 병기 카드·고정가 퍼널) · **`brand` 모드는 블록 1·3·5·7·8 데이터 잠금**(종합점수 없음 · 대비표 "내 콘텐츠" = 미확인) |
| 발행 | ✅ 파이프라인 성공 = `published` (잡이 직접 세팅). ~~검수 큐·실명 서명~~ 제거(2026-07-16) |
| 보고용 슬라이드 | ✅ 발행 리포트 → 버튼 → 콜⑤(카피) + 코드 렌더 → 단일 HTML 다운로드 (스펙 §10) · **골격 모드별**: `brandProduct` 7장 / `brand` 4장(표지·포지셔닝/USP·벤치마크·다음 단계) |
| 상태 머신 | ✅ `submitted → processing(단계 표시) → published / failed` (08 §3.3) |
| 저장 | ✅ Supabase 구현 + **`.data/` 파일 폴백**(키 없으면 자동, UI에 "로컬 저장(dev)" 배지) |
| 목(mock) 모드 | ✅ `ANTHROPIC_API_KEY` 없거나 `LLM_MODE=mock`이면 고정 픽스처로 전체 플로우 확인 가능(화면에 배지) |

**미구현(다음 작업, §5):** PDF 내보내기 · 무료 약기법 체커 · 인증/온보딩(이번 범위에서 의도적 제외) · **결제 잠금(샘플 경계) 집행** · S2 재진단 뷰 · ②③축.

## 2. 실행 방법

> ⚠ **이 머신 특이사항**: 한글 경로에서 대용량 JS 실행이 보안SW에 차단됨(2026-07-09 규명 — [CONTRIBUTING 트러블슈팅](../CONTRIBUTING.md)). **소스 수정·git = 이 폴더(원본)**, **실행·검증 = 영문 경로 미러**로 분리한다. 정상 머신에서는 원본에서 바로 실행하면 된다.

```powershell
# 1) (수정 후마다) 원본 → 미러 동기화 (증분, 수 초)
robocopy "c:\Users\user\문서\문서\Claude\Projects\이너서클_일본확장 MVP" "C:\dev\jgs-run" /MIR /XD .git .next .tmp-node .data node_modules\.cache

# 2) 미러에서 실행
cd C:\dev\jgs-run
npm run dev          # → http://localhost:3000
npm run typecheck    # 타입 검사
npm run test         # 집계 결정성 테스트 (tsc 컴파일 → node --test)
npm run report:cli   # 화면 없이 파이프라인만 (cica 픽스처)
npm run aggregate    # 코퍼스 갱신 시 사전집계 재생성
```

환경 변수(`.env`, [.env.example](../.env.example) 참조): `ANTHROPIC_API_KEY`(없으면 목 모드) · Supabase 3종(없으면 파일 폴백 — 셋업은 [setup-supabase.md](setup-supabase.md) 3단계).

**클릭 동선(E2E와 동일):** `/` 랜딩 → `무료 진단 시작` → 폼 입력·제출 → 진행 화면(자동 폴링) → **발행 완료 배너 + 리포트 열람** → `보고용 슬라이드 만들기` → HTML 다운로드. (2026-07-16: ~~검수 전 배너 → `/admin/review` 실명 서명~~ 경로 제거)
**브랜드 진단 동선(v4 신규):** 같은 폼에서 **브랜드 섹션만**(브랜드명·포지셔닝·카테고리) 입력·제출(제품 섹션 비움 = 에러 아님) → 동일 진행 화면 → 발행(`mode: brand` — 블록 1·3·5·7·8 데이터 잠금·종합점수 없음) → 슬라이드 **4장** 다운로드.

## 3. 코드 맵 (신규 자산)

```
app/
  page.tsx                        # 랜딩(확정 카피 12섹션)
  app/report/new/page.tsx         # 진단 입력폼 — 브랜드 필수(포지셔닝 태그 칩 포함)/제품 선택 (50자 게이트·dev/목 배지)
  app/report/[id]/page.tsx        # 상태 폴링 로딩 → 9블록 뷰 + 슬라이드 내보내기 버튼
  api/report/route.ts             # POST 제출(서버 재검증)+after() 잡 킥오프 · GET 모드 메타
  api/report/[id]/status/route.ts # 상태 폴링(published면 리포트 동봉)
  api/report/[id]/slides/route.ts # 보고용 슬라이드 HTML 다운로드(동기·콜⑤+렌더) — 스펙 §10
components/report/ReportView.tsx  # 9블록 렌더 (blocksJson 계약 — 08 §3.4)
lib/
  engine/                         # ① 파이프라인 — Next 독립 순수 TS (09 §3 구조 그대로)
    types.ts · rubric.ts          #   계약 타입 · A~E 루브릭/가중치 상수(정본 그대로)
    schemas.ts                    #   콜①~④·체커 출력 JSON 스키마 (08 §4)
    rules/                        #   normalize(K1..Kn 분해)·presignals·aggregate(+test)·benchmark(+test)·assemble·slides(+test)
    │                             #   + gates.ts(+test) — 게이트 단일 정의(50자/200자/URL) · positioning.ts — 포지셔닝 택소노미 16종
    grounding/index.ts            #   사전집계·규정요약·렉시콘 로더 + 콜별 system 프리픽스
    llm/client.ts                 #   claude-sonnet-5 + output_config + 캐싱 + 목 모드 + 재시도
    llm/calls.ts · fixtures.ts    #   콜별 페이로드/검증 · 목 픽스처(결정적 휴리스틱)
    pipeline.ts                   #   병렬 실행·폴백 규칙(콜② 실패=잡 실패)
  db/store.ts                     # 저장 인터페이스 (08 §6 간소화: 감사문장은 blocksJson 내)
  db/supabaseStore.ts · fileStore.ts
  server/reportJob.ts             # 상태 전이 잡 러너
  logger.ts                       # console.log 금지 대체
scripts/
  aggregate/aggregate-benchmark.mjs  # detail-ocr 312건 → 사전집계(빈도≥2 필터)
  run-report.ts                      # 엔진 CLI 러너
data/processed/
  benchmark-aggregates.json       # skincare 90·makeup 92·suncare 73·cleansing 57 (신규 산출)
  regulatory-summary.json         # ⚠ v0 미검토 — 조항 [1]~[7]+등급 프레임 (콜②·블록9 근거)
supabase/schema.sql               # 테이블 3종 + RLS · `reports.overall_score` nullable(v4 — 신규 create + 멱등 마이그레이션 블록) · docs/setup-supabase.md
```

설정: `tsconfig.json`(Next 자동수정 반영) · `tsconfig.node.json`(CLI/테스트용 CJS 컴파일) · `next.config.ts` · `postcss.config.mjs` · package.json scripts(기존 `crawl:*` 보존). `detail-ocr.jsonl` 복구됨.

## 4. 검증 결과 (2026-07-09 · C:\dev\jgs-run)

| 검증 | 결과 |
|---|---|
| `npm run typecheck` | ✅ 0 오류 |
| `npm run test` (node:test) | ✅ 5/5 — 집계 결정성(AC-2.2)·E군 분모 제외(AC-2.3)·가중치 합=1.00·공식 스팟체크 |
| CLI 목 모드 | ✅ 9블록 완성 · 16ms |
| **실 LLM E2E** (cica 카피 11문장) | ✅ 약 2분 · **종합 17/100** — 스펙 정본 샘플([[specs/01-report-sample-cica-ampoule]]) 18/100과 1점 차 · 감사 **불가 8·조건부 3·가능 0**(샘플 "11개 중 8개 위반"과 정합) · 재작성 5건(KR 역해설 포함, AC-3.1·3.2) |
| ~~발행 사이클(검수)~~ | ~~needsReview → 큐 → 실명 서명 → published~~ — **폐기(2026-07-16 검수 제거)** |
| 게이트 | ✅ 50자 미만 서버 400("최소 50자…") · 폼 버튼 잠금 · **단일 정의 = `lib/engine/rules/gates.ts`**(50자/200자/URL — 첫 단위 테스트 6건 포함, v4) · **빈 콘텐츠 = 브랜드 진단으로 제출**(게이트 미발동, 에러 아님) |
| **발행 사이클(2026-07-16 재검증)** | ✅ 목 모드 E2E — 제출 → `published` 도달(**관리자 조작 0회**) · 저장 레코드에 검수 필드 없음 · `publishedAt` 세팅 · 배지 `약기법 1차 스크리닝`(실명 검수 표기 제거) · 삭제 라우트 404 확인 |
| **슬라이드 내보내기(2026-07-16)** | ✅ 목 모드 E2E — 버튼 → 콜⑤ → 렌더 → HTML 다운로드(한글 파일명 정상) · 브라우저에서 열어 7장 내비게이션 확인 · **네트워크 요청 0건**(완전 무의존) · 콘솔 오류 0 · 발행 전 409 · 없는 리포트 404 · 대기/잠금/실패 UI 확인 |
| `npm run test` (2026-07-16 재실행) | ✅ 15/15 — 기존 집계 5 + `slides.test.ts` 10(숫자 출처·이스케이프·무의존·결정성·lang=ja) |
| `npm run typecheck` · `npm run test` (2026-07-16 v4) | ✅ typecheck 0 오류 · **30/30** — gates 6 · benchmark "미확인" 3 · slides 풀/브랜드 12 · aggregate 5 · 이스케이프 등 |
| **브랜드 진단 E2E (2026-07-16 v4 · 목 모드)** | ✅ 브랜드 섹션만 입력·제출 → **에러 0·관리자 조작 0으로 `published`** · `mode: brand` · block1 `scored: false` · 블록 3/5/7/8 null · 대비표 전 행 "미확인" · 퍼널 3단(① 브랜드 진단 (가격 미정) → ② 브랜드+제품 30만 → ③ 스튜디오 월 20만) |
| **브랜드 덱 다운로드 (2026-07-16 v4)** | ✅ **4장** · 외부 참조 0 · 점수 슬롯 0 · "미관찰" 0회 · 포지셔닝 슬라이드 렌더 · `filename*=UTF-8''HARUON-…` |
| **풀 모드 회귀 (2026-07-16 v4)** | ✅ 9블록 + 종합점수 + 감사 9문장 + 재작성 4 + **7장 덱** · 외부 참조 0 |
| **서버 이중 검증·경계 (2026-07-16 v4)** | ✅ 6종 400 확인(브랜드명/포지셔닝/미지 태그/카테고리/50자 하드게이트/URL 형식) · 미지 id 슬라이드 404 · CLI(mock) 완주 |

## 5. 알려진 한계 · 다음 작업

| # | 항목 | 내용 |
|---|---|---|
| 1 | **regulatory-summary v0 검토** | 조항 요약이 미검토(v0) — jp-localizer·약무 검토 후 `status: reviewed`로. 콜② 판정 품질의 근간 |
| 2 | Supabase 전환 | 현재 파일 폴백으로 동작 중 — [setup-supabase.md](setup-supabase.md) 3단계(약 5분) 후 자동 전환 |
| 3 | ~~`/admin/review` 보호~~ | **해소(2026-07-16)** — 화면 자체를 제거. 남은 인증 과제는 #6 |
| 3b | 🔴 **면책의 대가물 부재** | 검수 제거로 "법적 확정 판정 아님" 면책을 떠받치던 실명 서명이 사라짐. 30만 정당화·AI 불신층 전환 근거 약화 → **별도 결정 필요**([[decisions/DECISIONS]] 🔴) |
| 4 | PDF 내보내기 | 미구현 (09 M4 잔여 · 08 §8-D7) |
| 5 | 무료 약기법 체커 | 미구현 (stretch — 콜② 엔진·체커 스키마는 준비됨) |
| 6 | 인증·온보딩·프리필 | 이번 범위에서 의도적 제외 — 브랜드 섹션 직접 입력(온보딩 도입 시 프리필 — 08 §3.1). 도입 시 `users`·`brand_profiles` 스키마 추가 |
| 7 | 비동기 잡 실행 모델 | `after()` + 폴링(단일 프로세스 전제) — 서버리스 배포 시 큐 필요(08 §6.2 대안) |
| 8 | 한글 경로 실행 차단 | 미러 우회 중 — 근본 해결(저장소 영문 경로 이전 or 보안SW 예외)은 **팀 결정 필요** |
| 9 | D1(Supabase)·D6(재현성) 팀 확정 | 기본안으로 구현했으나 `DECISIONS.md` 승격 기록·스펙 §9-Q5 갱신은 미완 (09 M0 잔여) |
| 10 | LLM 판정 편차 관찰 | `LlmCallLog` 저장 구현됨 — 동일 입력 N회 편차 리포트는 QA 단계 과제(08 §8-D6) |
| 11 | **결제 잠금(샘플 경계) 집행 미구현** | v4가 무료 = **샘플**(표지 + 요약 일부(종합점수 가림) + 페르소나 맛보기 — 두 모드 공통)·게이트 자리 = **샘플 → 풀 열람 직전**으로 **정의**했으나 집행은 MVP 미구현 — 현재 발행 리포트는 전체 열람(30만 진단이 실결제 없이 열람되는 상태와 동일하게 유지). 브랜드 진단 가격 **(미정)** — 스펙 §2 v4 · 08 §8-D2 |

## 변경 이력
- 2026-07-09 신규 작성: 기능 검증 빌드(메인페이지+① 리포트 사이클) 구현·검증 완료 시점의 현황 스냅샷. 실 LLM E2E 결과(17/100, 정본 샘플과 1점 차)·코드 맵·실행 방법(한글 경로 미러 우회)·잔여 작업 10건.
- 2026-07-16 **v4 갱신**: **[변경] 입력 브랜드 우선 재구성** — 진단 입력폼(브랜드 필수: 브랜드명·포지셔닝(택소노미 16종)·카테고리 / 제품 전부 선택)·두 진단 모드(`brand`/`brandProduct`)·게이트 단일 정의 `gates.ts`·`reports.overall_score` nullable. **[추가]** 브랜드 진단 E2E(에러 0·관리자 조작 0으로 `published`·블록 1·3·5·7·8 잠금·대비표 "미확인"·4장 덱)·풀 모드 회귀(9블록·7장 덱)·서버 이중 검증 6종 400 — typecheck 0오류·테스트 **30/30**. **[신규 한계]** #11 결제 잠금(샘플 경계) 집행 미구현(경계 정의만 · 브랜드 진단 가격 (미정)).
- 2026-07-16 갱신: **[삭제] 검수 단계** — `/admin/review`·검수 API 2종·`signReport`/`rejectReport`/`listByStatus`·검수 3필드 제거, 상태 머신 4개로 축소, 파이프라인 성공 = 발행. 랜딩 FAQ의 서명 약속 카피 교체. **[추가] 보고용 슬라이드 내보내기**(스펙 §10). **[신규 한계] 3b 면책의 대가물 부재**(🔴).

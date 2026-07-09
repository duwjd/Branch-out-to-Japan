# 09 · 개발 스펙 (어떻게 · 어떤 순서로 짓는가)

> 작성: 2026-07-09 · 상태: **① 리포트 스프린트(7/11~17) 착수용**
> **이 문서는 "어떻게·어떤 순서로"만 담는다.** 무엇을 만드는지 = [[specs/01-report-spec]] · 데이터 계약(입출력·LLM 콜 스키마·엔티티) = [[08-data-flow]] · 일정 = [[04-roadmap]]. **여기에 스키마·공식·화면 명세를 재기술하지 않는다** — 충돌 시 정본(§6)을 따른다.
>
> 전제: [[08-data-flow]] §8의 **D1(저장=Supabase)·D6(재현성 전략) 기본안 채택** — ⚠ **7/11 팀 확정 필요**. 변경되면 이 문서 §1·§3만 고치면 된다.

---

## 1. 스택 · 부트스트랩

| 항목 | 내용 |
|---|---|
| 프레임워크 | Next.js(App Router) · TypeScript · Tailwind · npm — 저장소 루트 = 앱 루트 (CLAUDE.md 확정) |
| 스캐폴딩 | `create-next-app` 후 **기존 자산 병합 유지**: `package.json`의 `crawl:*`·`build:lexicon` 스크립트, `@anthropic-ai/sdk`·`playwright` devDeps, `scripts/`·`data/` 그대로 |
| 저장·인증·파일 | Supabase (Postgres + Auth + Storage) — 엔티티는 [[08-data-flow]] §6 |
| 시크릿 | `.env`(비커밋) + `.env.example`에 키 이름 문서화: `ANTHROPIC_API_KEY` · `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · (② 주간) `OPENAI_API_KEY` |
| 로컬 검증 | `npm run typecheck` 기본. ⚠ 한글 경로 머신은 대용량 JS 실행이 차단됨 — **영문 경로 미러(`C:\dev\jgs-run`)에서 실행** ([CONTRIBUTING 트러블슈팅](../CONTRIBUTING.md)) |
| 테스트 | **node 내장 러너**(`npm run test` = tsc 컴파일 → `node --test`) — vitest/tsx는 esbuild 네이티브가 한글 경로에서 차단되어 제외(2026-07-09 규명). typescript는 5.x 고정(7은 네이티브) |

## 2. 라우트 맵 (공통 골격 — 3축 전체)

각 라우트가 읽고 쓰는 데이터는 [[08-data-flow]] §7 표와 1:1.

| 라우트 | 화면 | 스프린트 | 와이어프레임 |
|---|---|---|---|
| `/` | 랜딩 | ① 주간(M4/stretch) | `public-onboarding` §1 |
| `/checker` | 무료 약기법 체커 | ① stretch | `public-onboarding` §2 |
| `/sample-report` | 샘플 리포트(정적) | ① stretch | `public-onboarding` §3 |
| `/pricing` | 요금(정적) | ① stretch | `public-onboarding` §4 |
| `/login` | 로그인/가입(탭) | ① M3 | `public-onboarding` §5 |
| `/onboarding` | 브랜드 프로필 4단계 | ① M3(최소형) | `public-onboarding` §6 |
| `/app` | 대시보드 | ① M3(최소형) | `app-wireframe` |
| `/app/report/new` | 티어 입력폼 | ① M3 | `report-wireframe` |
| `/app/report/[id]` | 처리 로딩(폴링) + 9블록 뷰 | ① M3 | `report-wireframe` |
| `/admin/review` | 검수 큐(서명·반려) — **와이어프레임 없음, 최소 1화면 신규** | ① M4 | 08 §7 공백 항목 |
| `/app/studio/thumbnail` | 썸네일 변환기 | ② 주간 | `service-wireframe` |
| `/app/library` | 자산 라이브러리 | ③ 주간 | `service-wireframe` |

**서버 경계(①분):** 진단 제출 `POST /api/report` → 잡 실행 · 상태 폴링 `GET /api/report/[id]/status` · 검수 승인/반려 `POST /api/report/[id]/review` · PDF `GET /api/report/[id]/pdf` · 체커 `POST /api/checker`(stretch). Server Component 기본, 폼·폴링만 `"use client"`.

## 3. 모듈 구조

```
app/                    # §2 라우트
lib/
  engine/               # ① 파이프라인 — Next 독립 순수 TS
    │                   #   이유: CLI 검증(M1~M2)·단위테스트·②의 콜② 재사용
    rules/              #   normalize · presignals · aggregate · benchmark · assemble
    │                   #   → 결정적, 단위테스트 대상 (08 §3.2 회색 노드)
    llm/                #   call1~call4 · checker — 08 §4 계약 구현
    │                   #   + anthropic 클라이언트 · LlmCallLog 기록 · 폴백
    grounding/          #   사전집계·규정요약·렉시콘 로더 (08 §2)
    schemas/            #   콜별 출력 JSON 스키마 + TS 타입 (08 §4.1~4.5)
  db/                   # supabase 클라이언트 + 엔티티 접근 (08 §6)
  logger.ts             # console.log 금지 — scripts/crawl/lib/logger.mjs 패턴 이식
scripts/
  aggregate/            # 사전집계 스크립트 (08 §8-D3, 신규)
  run-report.mjs        # 엔진 CLI 러너 — 화면 없이 입력 텍스트 → blocksJson 산출
```

## 4. ① 리포트 스프린트 마일스톤 (7/11~17 · 엔진 우선)

> 접근: **엔진(파이프라인)을 CLI로 먼저 완성·검증 → 화면 연결.** 리스크(LLM 품질·비용)가 엔진에 있으므로 M1~M2에서 확인하고, 화면(M3)은 검증된 엔진에 붙인다. 로드맵 완료 기준 = "진단 리포트 한 사이클 작동".

### M0 · 준비 (7/11)
- [ ] `data/processed/detail-ocr.jsonl` 복구 확인 (`git restore` — 08 §2 플래그)
- [ ] D1(Supabase)·D6(재현성) 팀 확정 → `decisions/DECISIONS.md` 기록, `01-report-spec` §9-Q5 문구 갱신
- [ ] Next 스캐폴딩 + Supabase 프로젝트 + `.env.example`
- [ ] `scripts/aggregate` 작성 → `data/processed/benchmark-aggregates.json` 산출·커밋
- [ ] 규정 출처 요약 자산 작성 (콜②·체커 grounding — jp-localizer 협업)
- **DoD:** `npm run typecheck` 통과 · 사전집계 파일 커밋

### M1 · 엔진 코어 (7/12~13)
- [ ] `rules/normalize`(문장분해 K1..Kn) · `rules/presignals`
- [ ] `llm/call1` 콜① 구현 (스키마·grounding·캐싱 — 08 §4.0~4.1)
- [ ] `rules/aggregate` 집계·가중·Top3 + **결정성 단위테스트**(같은 items → 같은 종합점수, AC-2.2)
- [ ] `scripts/run-report.mjs`로 텍스트 입력 → 점수 출력
- **DoD:** 동일 입력 2회 실행 → 종합점수 동일(테스트) · cica 샘플 카피로 축별 점수 대조 리뷰

### M2 · 엔진 완성 (7/13~15)
- [ ] `llm/call2`(감사)·`llm/call3`(페르소나) — 콜①과 병렬 실행 (08 §4.7)
- [ ] `rules/benchmark`(사전집계 대비) · `llm/call4`(재작성) · `rules/assemble`(9블록 조립)
- [ ] `LlmCallLog` 기록 · 폴백 규칙(콜② 실패 = 잡 실패 — 08 §3.2 표)
- **DoD:** CLI로 blocksJson 완성 산출 · 증거원칙 육안 체크(가짜 수치·인증·리뷰 0건)

### M3 · 화면 (7/14~16 — M2와 병행 가능)
- [ ] Supabase Auth(`/login`) + 온보딩 최소형(`/onboarding` — 프리필용 필드만)
- [ ] `/app/report/new` 티어 폼 (50자 하드게이트·200자 배지·프리필 — 08 §3.1)
- [ ] 제출 → `DiagnosisRequest` 저장 → 잡 실행 → `/app/report/[id]` 상태 폴링 로딩
- [ ] 9블록 뷰 렌더 (핵심 컴포넌트: 품의 표지·감사표·JP+KR 병기 카드 — 스펙 §8)
- **DoD:** 웹에서 입력 → 리포트 열람 한 사이클 (AC-1.1)

### M4 · 발행 체계 (7/16~17)
- [ ] `/admin/review` 검수 큐 — 목록·감사표 검토·실명 서명/반려 (08 §3.3 상태 머신)
- [ ] PDF 내보내기 (블록0 표지 연동 — 08 §8-D7)
- [ ] *(stretch)* 랜딩 `/` · 무료 체커 `/checker`(+비로그인 3회 — 08 §8-D8)
- **DoD:** needsReview → 서명 → published → PDF 다운로드 · **서명 없는 발행 불가**(스펙 성공지표)

### ② 마케팅 스튜디오 (7/18~24) · ③ 운영 (7/25~31)
> 각 스프린트 시작 시 이 형식으로 섹션 추가. ②는 `02-thumbnail-converter-spec` §5 실검증(API 키)부터, ③은 스펙 확정부터.

## 5. 검증 전략

| 수단 | 대상 | 기준 |
|---|---|---|
| 단위테스트(node:test) | `rules/aggregate` 등 `rules/*` | 결정성: 같은 입력 → 같은 출력 (AC-2.2) |
| 골든 픽스처 | cica 샘플 카피 → CLI 실행 | [[specs/report-sample-cica-ampoule]]과 점수·판정 **방향** 대조 (완전 일치 요구 아님 — LLM 편차는 `LlmCallLog`로 관찰, 08 §8-D6) |
| 수동 E2E 체크리스트 | 입력 → 열람 → 서명 → PDF | 로드맵 "한 사이클 작동" · UT(8/1~3) 시나리오와 동일 |
| typecheck / CI | 전체 | PR 병합 전 (CONTRIBUTING) |

## 6. 참조 정본 (구현 시 무엇을 보는가)

| 구현 대상 | 정본 |
|---|---|
| 입력 필드·검증·폴백 / 9블록 내용·AC | [[specs/01-report-spec]] §3·§4·§6 |
| LLM 콜 요청/응답 스키마·파라미터·폴백 | [[08-data-flow]] §4 |
| 엔티티·저장 / 화면↔데이터 | [[08-data-flow]] §6·§7 |
| 채점 항목·통과기준 (콜① grounding) | [[research/jp-detail-message-patterns]] §4 |
| 화면 구성·상태·접근성 규약 | `design/wireframes/report-wireframe.html` · `public-onboarding-spec.md` §0 · `app-spec.md` |
| 코딩 컨벤션 | `CLAUDE.md` (camelCase·JSDoc·로거·Server Component 기본) |

---

## 변경 이력
- 2026-07-09 신규 작성: 공통 골격(스택·라우트·모듈) + ① 리포트 스프린트 마일스톤 M0~M4(엔진 우선). 원칙 = 정본 중복 없이 포인터, 태스크는 체크박스+DoD.

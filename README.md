# YOAKE — K-Beauty Japan Growth Studio

한국 뷰티 브랜드의 **카피와 근거를 진단**하고, 그 결과를 **일본 채널에 맞는 썸네일·상세페이지로 전환**하며,
이후 **현지 마케팅 회사·유통 채널 연결**까지 확장하는 서비스. — `Diagnose. Create. Connect.`

> **핵심 차별점:** 번역이 아니라 **일본 고객 관점의 메시지 재설계**, 그리고 **진단 결과가 그대로 제작의 입력값이 되는 폐루프**.
> **현재 MVP = ① 진단 리포트 + ② 마케팅 스튜디오.** ③ 운영 서비스는 **MVP 이후 확장 가설**(마케팅 회사·유통 채널 **소개·연결** — 직접 집행·입점 보장 아님).
> 전략 전문은 [docs/00-positioning.md](docs/00-positioning.md), 팀 규칙·에이전트 사용법은 [CLAUDE.md](CLAUDE.md).

이 저장소는 **Claude Code로 기획→디자인→개발을 협업**하기 위한 하네스(에이전트·슬래시 명령)를 포함합니다.

---

## 상품 구조 — 3축

| 축 | 핵심 | 상태 (2026-08-21) |
|---|---|---|
| **① 진단 리포트** | 일본향 페르소나·USP 재정의 + 薬機法 전수 감사 + 비포&애프터 (AI 진단·9블록) + 보고용 슬라이드 | ✅ **배포본 실작동** (두 모드 `brand`/`brandProduct`) |
| **② 마케팅 스튜디오** | 썸네일 생성(템플릿 8종) · **상세페이지 일본향 전환**(블록 구성 확인 → 하이브리드 렌더 → 몰 규격 분할) | ✅ **배포본 실작동** |
| **③ 운영 서비스** | 브랜드 관리(브랜드 킷·제품) · 자산 라이브러리 · 시즌 캘린더 · 기업 매칭 | ⚠️ 화면은 작동하나 **MVP 이후 확장 가설** — 현재 제공 기능이 아니다 |

전환 허브 = **① 진단 리포트**(무료 약기법 체커가 입구, 고정가 퍼널이 ②·③로 연결). 공통 엔티티 = **브랜드 프로필**.
**세그먼트 2분리**: S1(입점 전) / **S2(입점 후·매출저조)** — S2는 재진단 리포트(퍼널·리뷰 병목) + 리뷰 축적 운영을 Growth(월 20만)에 편입.
**커머셜**: Free → Report 30만(실물 포함) → Growth 월 20만(리뷰 운영·첫 달 진단비 공제) → Scale.
상세: [docs/07-ia.md](docs/07-ia.md) · [상품 구조](docs/decisions/2026-07-04-상품-구조-구체화.md) · [의사결정](docs/decisions/DECISIONS.md)

---

## 현재 단계 — 개발 스프린트 종료 (2026-08-21)

3축 서비스를 **직접 개발**하기로 확정(2026-07-04)한 뒤, **3축 전부를 배포본에서 실작동시키고 UT까지 마쳤습니다.**

- **배포본**: `https://branch-out-to-japan.vercel.app` (Vercel Hobby + Supabase Free)
- **실작동 범위**: 랜딩 → 회원가입·로그인(이메일 실인증 / 소셜은 목) → ① 진단 리포트 한 사이클 → ② 썸네일·상세페이지 실생성 → ③ 브랜드 관리·자산 라이브러리·시즌 캘린더·기업 매칭
- **UT**: 배포본 대상 **AI 에이전트 UT**(합성 페르소나 20인 · 2세션 · 2026-08-20~21) — 생성 **60/60 성공** · 이슈 71건(P0 14) 수집. 계획했던 실사용자 UT(8/1~3)의 **대체이며 등가가 아닙니다** — 합성 페르소나는 구매 행동을 예측하지 않습니다.
- **최종 검증**: typecheck 0 오류 · 테스트 322/322

무엇이 어디까지 돌아가는지는 [docs/10-implementation-status.md](docs/10-implementation-status.md)가 정본, UT 결과는 [UT 리포트](docs/research/ut-agent/results/UT-리포트.md)·[한 장 요약](docs/research/ut-agent/results/한장요약.md), 실행 방법은 아래 [로컬에서 실행하기](#로컬에서-실행하기-localhost) 참조.

> **남아 있는 가장 큰 숙제:** 핵심 차별점인 **폐루프가 화면에서 반증됐습니다** — "한 서비스로 이어져 보이는가" 4/20. 리포트가 스튜디오 산출물을 보지 않고, 둘이 서로 다른 제품을 말합니다(UT-58·59). 대응 계획은 [docs/09-dev-spec.md](docs/09-dev-spec.md) §4d **M12-B**.

지금까지 쌓인 것:
- **정보구조(IA)**: [docs/07-ia.md](docs/07-ia.md) — 3축 전체 사이트맵·화면 인벤토리·유저플로우
- **스펙**: [진단 리포트 S1](docs/specs/01-report-spec.md)(9블록·티어) · [S2 입점후](docs/specs/01-report-spec-postentry.md)(퍼널·리뷰 병목) · [구독 재구성](docs/specs/03-구독플랜-재구성-제안.md) · [썸네일 변환기](docs/specs/02-thumbnail-converter-spec.md) · [심화 샘플](docs/specs/01-report-sample-cica-ampoule.md)
- **디자인 시스템**: [design/DESIGN.md](design/DESIGN.md) (**일출 코랄 단일 팔레트** · 컴포넌트 · 상태 규약) · 실측 스펙 [design/lp-components-spec.md](design/lp-components-spec.md) · 로고 [design/brand/logo/README.md](design/brand/logo/README.md)
- **와이어프레임(핸드오프)**: 공개+온보딩 6화면 · 앱 메인(대시보드) · S1/S2 리포트 · S2 산출물 프로토 · UX 점검 — 아래 참조
- **데이터**: 일본 쇼핑몰 제품 카탈로그·상세 OCR·SNS 렉시콘·썸네일 스타일 팩 (`data/processed/`)
- **검증**: 합성 페르소나 20인 시뮬레이션 + 리포트 샘플 6인 검증 + S2 재시뮬 (`docs/research/`) · **배포본 AI 에이전트 UT**(`docs/research/ut-agent/` — 실행 도구는 `scripts/ut/`)
- **발표 자료**: 본편 덱 · UT 결과 덱 · 전체 대본 (`docs/presentation/`)

**배포 완료:** **Vercel Hobby + Supabase Free** 무료 스택으로 배포되어 UT 를 실제로 이 배포본에서 돌렸습니다 — 스펙 [docs/11-deploy-spec.md](docs/11-deploy-spec.md) · 운영 가이드 [docs/deploy-runbook.md](docs/deploy-runbook.md) · 결정 [호스팅·배포 ADR](docs/decisions/2026-07-24-호스팅-배포-결정.md).
※ Hobby 플랜은 **비상업 용도 한정**입니다 — 유료 고객이 발생하는 시점이 Pro 전환 트리거입니다(11-deploy-spec §7).

## 지금 바로 볼 수 있는 것 (설치·서버 불필요)

와이어프레임·랜딩 시안은 단일 HTML이라 브라우저에서 바로 열립니다:

```
design/wireframes/public-onboarding-wireframe.html   # 공개+온보딩 6화면 (랜딩·체커·샘플·요금·로그인·브랜드프로필)
design/wireframes/app-wireframe.html                 # 앱 메인(대시보드)
design/wireframes/report-wireframe.html              # 진단 리포트 S1(티어 입력 + 9블록)
design/wireframes/report-wireframe-postentry.html    # S2 입점후 재진단(퍼널 분해·리뷰 병목)
design/wireframes/deliverable-proto-cica.html        # S2 30만 산출물 프로토(상세+썸네일, 근거 주석)
persona-simulation/landing/index.html                # 페르소나 검증용 랜딩 시안 (비배포)
```

디자이너 핸드오프 명세: [public-onboarding-spec.md](design/wireframes/public-onboarding-spec.md) · [app-spec.md](design/wireframes/app-spec.md) · UX·접근성 점검 [ux-review.md](design/wireframes/ux-review.md)

---

## 로컬에서 실행하기 (localhost)

> 요구사항: **Node.js 20+ · npm**. API 키가 하나도 없어도 **목(mock) 모드**로 전체 플로우를 확인할 수 있습니다(화면에 목 배지 표시).

### 1) 설치

```bash
npm install
```

> ⚠ **한글 경로 머신 주의**: 저장소 경로에 한글이 포함된 머신에서는 보안 SW가 대용량 JS 실행을 차단할 수 있습니다. 이 경우 **소스 수정·git은 원본 폴더**에서, **실행·검증은 영문 경로 미러**에서 합니다(자세히: [CONTRIBUTING.md](CONTRIBUTING.md) 트러블슈팅):
>
> ```powershell
> # 수정 후마다 원본 → 미러 증분 동기화 (수 초)
> robocopy "c:\Users\user\문서\문서\Claude\Projects\이너서클_일본확장 MVP" "C:\dev\jgs-run" /MIR /XD .git .next .tmp-node .data node_modules\.cache
> cd C:\dev\jgs-run
> ```

### 2) 환경 변수 (선택)

[.env.example](.env.example)을 복사해 `.env`를 만들고 필요한 키만 채웁니다. **모든 키는 선택**이며, 없으면 해당 기능이 목 모드/파일 폴백으로 동작합니다:

| 키 | 용도 | 없으면 |
|---|---|---|
| `ANTHROPIC_API_KEY` | ① 리포트 LLM 파이프라인(`claude-opus-5`) · ② 스튜디오 카피 콜(`claude-sonnet-5`) | 목 모드(고정 픽스처) |
| `OPENAI_API_KEY` | ② 썸네일 이미지 실생성(images.edit) | 이미지 목 모드(샘플 PNG) |
| Supabase 3종 | DB 저장 ([셋업 가이드](docs/setup-supabase.md)) | `.data/` 로컬 파일 폴백 |
| `LLM_MODE=mock` / `IMAGE_MODE=mock` | 키가 있어도 강제 목 모드 | — |

### 3) 개발 서버 실행

```bash
npm run dev          # → http://localhost:3000
```

**클릭 동선(E2E와 동일):** `/` 랜딩 → `무료 진단 시작` → 진단 입력폼 제출 → 진행 화면(자동 폴링) → 발행 완료 + 리포트 9블록 열람 → `보고용 슬라이드 만들기` → HTML 다운로드.
로그인 필요 화면(`/app/*` — 라이브러리·썸네일 생성·브랜드 관리·매칭)은 `/login`에서 소셜 버튼 클릭(목 로그인 — 실 OAuth 미연동, 데모 유저 세션 발급).

### 4) 검증·CLI 명령

```bash
npm run typecheck     # 타입 검사
npm run test          # 단위 테스트 (집계 결정성·게이트·슬라이드 등)
npm run report:cli    # 화면 없이 ① 리포트 파이프라인만 (cica 픽스처)
npm run thumbnail:cli # 화면 없이 ② 썸네일 파이프라인만 (--style A~H · --platform · --proof)
npm run detail:cli    # 화면 없이 ② 상세페이지 파이프라인만 (--reuse-visuals 로 이미지 비용 0 재검증)
npm run db:push       # Supabase 스키마 마이그레이션 (--check 로 드라이런)
```

**최종 검증(2026-08-21):** `npm run typecheck` 0 오류 · `npm run test` **322/322 통과**.
구현 현황·코드 맵·알려진 한계: [docs/10-implementation-status.md](docs/10-implementation-status.md)

---

## 폴더 구조

```
docs/                기획 (포지셔닝·경쟁분석·PRD·페르소나·로드맵·IA·의사결정)
  ├─ specs/          개발 착수용 스펙 (리포트·썸네일 변환기)
  ├─ decisions/      의사결정 기록 (DECISIONS.md · 상품 구조)
  └─ research/       리서치·페르소나 시뮬레이션·검증
design/              디자인 (DESIGN.md 시스템 · 카피 · 와이어프레임 · 레퍼런스)
  └─ wireframes/     화면 와이어프레임 + 핸드오프 명세 + UX 점검
data/                데이터 (raw / processed — 제품 카탈로그·OCR·렉시콘·썸네일 팩)
scripts/crawl/       데이터 수집 도구 (라쿠텐·아마존·Qoo10·@cosme·OCR·렉시콘)
scripts/ut/          배포본 AI 에이전트 UT 실행 도구 (계정 프로비저닝·캡처·배치·집계)
persona-simulation/  페르소나 검증용 랜딩 시안·카피 팩·결과 기록 (비배포)
.claude/             에이전트팀(agents) · 슬래시 명령(commands) · 팀 설정(settings.json)
```

## 기술 스택

- **빌드 스택**: Next.js (App Router) · TypeScript · Tailwind CSS · npm. 저장소 루트 = 앱 루트. 실행 방법은 [로컬에서 실행하기](#로컬에서-실행하기-localhost).
- **데이터 수집 도구**: `@anthropic-ai/sdk`, `playwright`. 크롤러는 `npm run crawl:*`(→ `scripts/crawl/`, 사용법 [scripts/crawl/README.md](scripts/crawl/README.md)).
- 와이어프레임·랜딩 시안은 의존성 없는 단일 HTML.

---

## Claude Code로 시작하기

새 세션이면 먼저 온보딩:

```
/kickoff
```

역할별 에이전트와 슬래시 명령:

| 명령 | 역할 |
|---|---|
| `/kickoff` | 프로젝트 상태·다음 할 일 요약 |
| `/spec` | 기획·PRD (pm-planner) |
| `/localize` | 일본 고객 관점 카피 재설계 (jp-localizer) — **핵심 차별점** |
| `/design-page` | 화면 설계·와이어프레임 (designer) |
| `/status` | 로드맵 대비 진척 |

그 외 에이전트: `lead-orchestrator`(작업 분해·배분) · `frontend-dev` · `backend-dev` · `qa`.

## 로드맵 — 종료 (2026-08-21)

- ✅ **선행**: 리서치 · 데이터 정제 · IA·플로우 설계 · 스펙 · 와이어프레임
- ✅ **1차 개발**: 리포트(7/11~17) → 스튜디오(7/18~24) → 운영(7/25~31)
- ✅ **추가로 들어온 것**: 실 인증·제품 엔티티(7/23) · 상세페이지 생성(8/10~11) · **YOAKE 리브랜딩 + 일출 코랄 DS 전환**(8/18~19) · 시즌 캘린더·홈 개편(8/19~20)
- ✅ **배포**: Vercel Hobby + Supabase Free — [배포 스펙](docs/11-deploy-spec.md) · [운영 가이드](docs/deploy-runbook.md)
- ✅ **검증**: AI 에이전트 UT(8/20~21) · 발표 덱·대본
- ⏭ **다음(미착수)**: 폐루프 배선 → 랜딩·앱 말 맞추기 → 지불 판단 정보 ([09-dev-spec §4d M12](docs/09-dev-spec.md))

계획 대비 실제·달랐던 점은 [docs/04-roadmap.md](docs/04-roadmap.md) "최종 진척".

## 기여

`main` 보호 · 기능 브랜치(`feat/…`·`docs/…`·`fix/…`) · Conventional Commits · PR 리뷰 1인 이상.
브랜치·PR·커밋 규칙과 개발 머신 트러블슈팅은 [CONTRIBUTING.md](CONTRIBUTING.md) 참고.

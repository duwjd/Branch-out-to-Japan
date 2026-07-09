# Japan Growth Studio — 일본 시장 진출 브랜드 전환 스튜디오

한국 뷰티 브랜드의 상세페이지·SNS·광고 문구를 **일본 고객 관점으로 진단**하고,
일본향 **카피·콘텐츠·운영**을 한곳에서 다루는 **뷰티 중소기업용 내부 운영 툴 웹 서비스**.

> **핵심 차별점:** 번역이 아니라 **일본 고객 관점의 메시지 재설계**.
> **포지션:** 일본 진출 전 콘텐츠 진단 & 일본향 콘텐츠 제작·운영 서비스.
> 전략 전문은 [docs/00-positioning.md](docs/00-positioning.md), 팀 규칙·에이전트 사용법은 [CLAUDE.md](CLAUDE.md).

이 저장소는 **Claude Code로 기획→디자인→개발을 협업**하기 위한 하네스(에이전트·슬래시 명령)를 포함합니다.

---

## 상품 구조 — 3축

| 축 | 핵심 | 성숙도 |
|---|---|---|
| **① 진단 리포트** | 일본향 페르소나·USP 재정의 + 薬機法 전수 감사 + 비포&애프터 (AI 진단·9블록) | 스펙 확정 v2 |
| **② 마케팅 스튜디오** | 상세페이지 일본향 전환 · 썸네일 생성 · 인스타 피드 생성 | 썸네일 파이프라인 확정 |
| **③ 운영** | 일본 기업 매칭 · 브랜드 자산 관리 · (검토) 성과 판별 | 방향 정의 |

전환 허브 = **① 진단 리포트**(무료 약기법 체커가 입구, 고정가 퍼널이 ②·③로 연결). 공통 엔티티 = **브랜드 프로필**.
상세: [docs/07-ia.md](docs/07-ia.md) · [docs/decisions/2026-07-04-상품-구조-구체화.md](docs/decisions/2026-07-04-상품-구조-구체화.md)

---

## 현재 단계 — 빌드(개발 스프린트) 준비

3축 서비스를 **직접 개발**하기로 확정(2026-07-04). 개발 착수 전 **설계 자산 정비가 완료**된 상태이며, **앱 코드는 아직 없습니다**(문서 · 와이어프레임 · 데이터 · Figma 단계).

지금까지 쌓인 것:
- **정보구조(IA)**: [docs/07-ia.md](docs/07-ia.md) — 3축 전체 사이트맵·화면 인벤토리·유저플로우
- **스펙**: [진단 리포트](docs/specs/01-report-spec.md)(9블록·티어 입력) · [썸네일 변환기](docs/specs/02-thumbnail-converter-spec.md) · [심화 샘플](docs/specs/report-sample-cica-ampoule.md)
- **디자인 시스템**: [design/DESIGN.md](design/DESIGN.md) (코랄 팔레트·컴포넌트·상태 규약)
- **와이어프레임(핸드오프)**: 공개+온보딩 6화면 · 앱 메인(대시보드) · UX 점검 — 아래 참조
- **데이터**: 일본 쇼핑몰 제품 카탈로그·상세 OCR·SNS 렉시콘·썸네일 스타일 팩 (`data/processed/`)
- **검증**: 합성 페르소나 20인 시뮬레이션 + 리포트 샘플 6인 검증 (`docs/research/`)

## 지금 바로 볼 수 있는 것 (설치·서버 불필요)

와이어프레임·랜딩 시안은 단일 HTML이라 브라우저에서 바로 열립니다:

```
design/wireframes/public-onboarding-wireframe.html   # 공개+온보딩 6화면 (랜딩·체커·샘플·요금·로그인·브랜드프로필)
design/wireframes/app-wireframe.html                 # 앱 메인(대시보드)
design/wireframes/report-wireframe.html              # 진단 리포트 화면(티어 입력 + 9블록)
persona-simulation/landing/index.html                # 페르소나 검증용 랜딩 시안 (비배포)
```

디자이너 핸드오프 명세: [public-onboarding-spec.md](design/wireframes/public-onboarding-spec.md) · [app-spec.md](design/wireframes/app-spec.md) · UX·접근성 점검 [ux-review.md](design/wireframes/ux-review.md)

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
persona-simulation/  페르소나 검증용 랜딩 시안·카피 팩·결과 기록 (비배포)
.claude/             에이전트팀(agents) · 슬래시 명령(commands) · 팀 설정(settings.json)
```

## 기술 스택

- **빌드 스택(예정)**: Next.js (App Router) · TypeScript · Tailwind CSS · npm. 저장소 루트 = 앱 루트.
- **현재 의존성**: 데이터 수집 도구 — `@anthropic-ai/sdk`, `playwright`. 크롤러는 `npm run crawl:*`(→ `scripts/crawl/`, 사용법 [scripts/crawl/README.md](scripts/crawl/README.md)).
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

## 로드맵 (개발 스프린트)

- **선행 완료**: 리서치 · 데이터 정제 · IA·플로우 설계 · 스펙 · 와이어프레임
- **1차 개발**: 리포트(7/11~17) → 스튜디오(7/18~24) → 운영(7/25~31)
- **검증·완성**: UT(8/1~3) → 개선·완성(8/4~9) → 발표

자세히: [docs/04-roadmap.md](docs/04-roadmap.md)

## 기여

`main` 보호 · 기능 브랜치(`feat/…`·`docs/…`·`fix/…`) · Conventional Commits · PR 리뷰 1인 이상.
브랜치·PR·커밋 규칙과 개발 머신 트러블슈팅은 [CONTRIBUTING.md](CONTRIBUTING.md) 참고.

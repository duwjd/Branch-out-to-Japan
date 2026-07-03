# 일본 시장 진출 브랜드 전환 스튜디오

한국 뷰티 브랜드의 상세페이지·SNS·광고 문구를 **일본 고객 관점으로 진단**하고,
7일 안에 일본향 카피·콘텐츠 기획안·광고 소재 방향을 스타터 키트로 제공하는 컨시어지형 MVP.

> **핵심 차별점:** 번역이 아니라 일본 고객 관점의 메시지 재설계.
> 전략 전문은 [docs/00-positioning.md](docs/00-positioning.md).

이 저장소는 **Claude Code로 기획→디자인→개발을 협업**하기 위한 하네스를 포함합니다.
팀 규칙과 에이전트 사용법은 [CLAUDE.md](CLAUDE.md)에 있습니다.

## 현재 상태 — 기획·페르소나 검증 단계

지금은 코드 개발 전 단계입니다. 합성 페르소나로 타겟·문구·가격 가설을 검증 중이며,
검증용 랜딩 시안은 브라우저에서 바로 열 수 있습니다 (서버·설치 불필요):

```
persona-simulation/landing/index.html    # ?variant=A~E 로 제안 문구 전환, ?clean=1 로 운영 툴바 숨김
```

사용법·검증 절차는 [persona-simulation/README.md](persona-simulation/README.md) 참고.

> 기존 Next.js 앱 코드는 기획 단계 정리를 위해 제거했습니다. git 이력에 보존되어 있어
> 개발 재개 시 복원하거나 새로 시작할 수 있습니다.

## 폴더 구조

```
docs/                기획 (포지셔닝·리서치·PRD·페르소나·로드맵·의사결정)
design/              디자인 (디자인시스템·카피·와이어프레임)
persona-simulation/  페르소나 검증용 랜딩 시안·카피 팩·스크린샷·결과 기록 (비배포)
.claude/             에이전트팀(agents) · 슬래시 명령(commands) · 팀 설정(settings.json)
```

## Claude Code로 시작하기

새 세션이면 먼저 온보딩 명령을 실행하세요:

```
/kickoff
```

역할별 에이전트와 명령:

| 명령 | 역할 |
|---|---|
| `/kickoff` | 프로젝트 상태·다음 할 일 요약 |
| `/spec` | 기획·PRD (pm-planner) |
| `/localize` | 일본 고객 관점 카피 재설계 (jp-localizer) |
| `/design-page` | 화면 설계 (designer) |
| `/status` | 로드맵 대비 진척 |

## 로드맵
- **지금:** 기획·페르소나 검증 (합성 페르소나로 문구·가격 가설 사전 검증)
- **Phase 1:** 랜딩페이지 실배포 + 무료 "5분 진단" 신청 (수요 검증)
- **Phase 2:** 한 사이클을 경험하는 작동 서비스 (범위 미정)

자세히: [docs/04-roadmap.md](docs/04-roadmap.md)

## 기여
브랜치·PR·커밋 규칙은 [CONTRIBUTING.md](CONTRIBUTING.md) 참고.

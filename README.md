# 일본 시장 진출 브랜드 전환 스튜디오

한국 뷰티 브랜드의 상세페이지·SNS·광고 문구를 **일본 고객 관점으로 진단**하고,
7일 안에 일본향 카피·콘텐츠 기획안·광고 소재 방향을 스타터 키트로 제공하는 컨시어지형 MVP.

> **핵심 차별점:** 번역이 아니라 일본 고객 관점의 메시지 재설계.
> 전략 전문은 [docs/00-positioning.md](docs/00-positioning.md).

이 저장소는 **Claude Code로 기획→디자인→개발을 협업**하기 위한 하네스를 포함합니다.
팀 규칙과 에이전트 사용법은 [CLAUDE.md](CLAUDE.md)에 있습니다.

## 퀵스타트

```bash
npm install
npm run dev        # http://localhost:3000
```

기타 명령: `npm run build` · `npm run lint` · `npm run typecheck`(= `tsc --noEmit`)

> ⚠️ 일부 Windows 머신에서 네이티브 노드 애드온 로딩 세그폴트로 `next dev`/`lint`가 크래시할 수 있습니다.
> 원인과 우회법은 [CONTRIBUTING.md](CONTRIBUTING.md#트러블슈팅) 참고.

## 폴더 구조

```
docs/        기획 (포지셔닝·리서치·PRD·페르소나·로드맵·의사결정)
design/      디자인 (디자인시스템·카피·와이어프레임)
app/         Next.js App Router (랜딩·신청 폼)
components/  UI 컴포넌트
lib/         로거·리드 처리 등
.claude/     에이전트팀(agents) · 슬래시 명령(commands) · 팀 설정(settings.json)
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
- **Phase 1 (현재):** 랜딩페이지 + 무료 "5분 진단" 신청 (수요 검증)
- **Phase 2:** 한 사이클을 경험하는 작동 서비스 (범위 미정)

자세히: [docs/04-roadmap.md](docs/04-roadmap.md)

## 기여
브랜치·PR·커밋 규칙은 [CONTRIBUTING.md](CONTRIBUTING.md) 참고.

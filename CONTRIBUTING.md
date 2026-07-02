# 기여 가이드 (CONTRIBUTING)

함께 작업하는 분을 위한 협업 규칙입니다. 프로젝트 규칙 전문은 [CLAUDE.md](CLAUDE.md).

## 시작하기
```bash
git clone https://github.com/duwjd/Branch-out-to-Japan.git
cd Branch-out-to-Japan
npm install
npm run dev
```
Claude Code를 쓴다면 새 세션에서 `/kickoff` 를 먼저 실행하세요.

## 브랜치 전략
- `main` 은 보호 브랜치. 직접 push 하지 않고 PR로 병합합니다.
- 브랜치 이름: 작업자에 따라 각자의 브랜치에 pushß
  - hanna
  - jeongwon

## 커밋
[Conventional Commits](https://www.conventionalcommits.org/) 사용:
```
feat: 랜딩 히어로 섹션 추가
fix: 신청 폼 유효성 검사 수정
docs: 로드맵 Phase 2 범위 정리
```
- 커밋 메시지에 **변경 이유**를 한 줄 남깁니다(전역 규칙).

## PR
1. 브랜치에서 작업 후 PR 생성.
2. [PR 템플릿](.github/pull_request_template.md)의 체크리스트를 채웁니다(변경 요약·이유·테스트·스크린샷).
3. 리뷰 1인 이상 승인 후 병합.
4. 병합 전 `npm run typecheck` 통과 확인(가능하면 `npm run lint`·`npm run build` 도).

## 에이전트 팀 사용법
`.claude/agents/` 에 역할별 에이전트가 있습니다. 슬래시 명령으로 호출:
- `/spec` — 기획/PRD (pm-planner)
- `/localize` — 일본 고객 관점 카피 재설계 (jp-localizer)
- `/design-page` — 화면 설계 (designer)
- `/status` — 진척 요약

> 실제 조율은 메인 세션이 합니다. 큰 작업은 `lead-orchestrator` 로 작업 분해 계획을 받은 뒤 각 명령을 실행하세요.

## Claude Code 설정
- 팀 공용 설정: `.claude/settings.json` (커밋됨) — 자주 쓰는 명령 권한 등.
- 개인 설정: `.claude/settings.local.json` (gitignore, 커밋 안 함).

## 비밀값
- `.env` 는 커밋하지 않습니다(`.gitignore` 처리됨). 필요한 키 이름은 `.env.example` 에 문서화합니다.

## 트러블슈팅

### `next dev` / `npm run lint` 실행 시 Segmentation fault (exit 3221225477 / 139)
일부 Windows 머신에서 **네이티브 노드 애드온(.node) 로딩 시 세그폴트**가 발생합니다.
Next의 SWC 바이너리나 eslint의 `unrs-resolver` 같은 네이티브 모듈을 로드하는 순간 크래시합니다.
주로 **보안/백신 소프트웨어**가 native 모듈 로드를 가로채는 것이 원인입니다.

우회/해결:
- 로컬에서는 타입 검증만: `npm run typecheck` (`tsc` 는 순수 JS라 정상 동작).
- 실제 런타임 확인은 **정상 머신 또는 CI**에서.
- 근본 해결 시도: 백신 실시간 검사에서 프로젝트 폴더/Node 예외 등록, 또는 `npm install` 재시도, Node 버전 변경.
- `npm install` 이 `unrs-resolver` postinstall 에서 크래시하면 `npm install --ignore-scripts` 로 설치(앱 실행에는 영향 없음, eslint 리졸버만 비활성).

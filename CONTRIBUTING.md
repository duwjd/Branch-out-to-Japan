---
title: 기여 가이드 (CONTRIBUTING)
space: 프로젝트 기준
status: 정본
phase: Phase 0
updated: 2026-08-31
owner:
tags: [협업, 브랜치, PR]
---

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

**로컬이 곧 dev 환경입니다.** `.env` 에 Supabase 키를 넣지 마세요 — 키가 없으면 앱이
`.data/` 파일 스토어로 돌아 로컬 데이터가 운영 DB 와 완전히 분리됩니다. **현재 데이터가
격리되는 곳은 로컬뿐입니다** — `stg` 배포본은 운영 Supabase 를 그대로 씁니다
(DB 분리 보류 · [deploy-runbook §9](docs/deploy-runbook.md)). 위험한 데이터 조작은 로컬에서 하세요.

## 브랜치 전략

브랜치에 **축이 둘**입니다. **환경 축**이 "어디까지 검증됐는가"를, **사람 축**이 "누가 지금 만지는가"를 나타냅니다.

| 브랜치 | 축 | 역할 | 배포 |
|---|---|---|---|
| `main` | 환경 | **prd** — 실사용자 | Vercel Production (머지 즉시 자동 배포) |
| `stg` | 환경 | **stg** — QA | Vercel Preview (브랜치 alias URL) · ⚠️ **DB 는 운영과 공유** |
| `dev` | 환경 | **dev** — 통합 | 배포 없음. 각자 로컬에서 확인 |
| `dev-jeongwon` · `dev-hanna` | 사람 | **개인 작업 공간** | 없음 (push 하면 Vercel 이 Preview URL 을 자동 생성) |

**개인 브랜치는 사람마다 하나이고 계속 삽니다.** 기능마다 브랜치를 파지 않습니다 — 본인 작업은 전부 자기 `dev-{이름}` 에서 합니다.

```
dev-jeongwon ──PR(merge)──┐
                          ├──> dev ──PR(merge)──> stg ──PR(merge)──> main
dev-hanna    ──PR(merge)──┘      로컬 통합         stg 배포·QA        운영 배포

최신화: dev ──merge──> dev-{이름}          (자주 받아 옵니다)
역병합: main ──> stg ──> dev ──> dev-{이름}
hotfix/x ────────────────────────────────> main   (긴급 시에만 · 위 역병합 필수)
```

지켜야 할 것 4가지:

1. **모든 병합은 merge commit 입니다. squash 하지 않습니다.** squash 하면 병합된 쪽이 원본과 다른
   SHA 를 갖게 되어 다음 병합마다 유령 충돌이 납니다. 승격 PR(`dev`→`stg`→`main`)은 물론이고
   **`dev-{이름}`→`dev` 도 마찬가지**입니다 — 개인 브랜치는 병합 후에도 계속 살아서 재사용되므로,
   여기서 squash 하면 다음 back-merge 때마다 같은 사고가 반복됩니다.
2. **`dev-{이름}` 을 rebase 하지 않습니다.** push 한 순간부터 공유 브랜치입니다. 최신 코드는
   `dev` 를 **merge 해서** 받아 옵니다(`git merge origin/dev`). 자주 받을수록 나중에 덜 아픕니다.
3. **`main` 에 뭔가 들어가면 즉시 `main` → `stg` → `dev` 로 역병합합니다.** 핫픽스든 정기
   릴리스든 예외 없습니다. 빼먹으면 다음 승격 PR 이 "이미 반영된 변경을 되돌리는" diff 를 들고 옵니다.
   역병합이 `dev` 에 닿으면 각자 자기 `dev-{이름}` 으로도 받아 옵니다.
4. **운영 장애의 1차 대응은 hotfix 가 아니라 Vercel Instant Rollback** 입니다
   ([deploy-runbook §3](docs/deploy-runbook.md)). 롤백은 수 초, hotfix 는 빌드까지 10분 이상 걸립니다.

`main` 과 `stg` 는 보호 브랜치입니다. 직접 push 하지 않고 PR 로 병합합니다.

> **개인 브랜치가 커지면 나눠서 PR 합니다.** 사람 단위 브랜치의 대가는 PR 에 주제가 섞이는 것입니다.
> 한 덩어리가 너무 커졌다 싶으면 중간에 `dev` 로 한 번 올리세요 — 리뷰가 가능한 크기를 유지하는 게
> 브랜치 이름보다 중요합니다. 배경은 [ADR](docs/decisions/2026-08-31-개인-브랜치-복귀.md).

## 커밋
[Conventional Commits](https://www.conventionalcommits.org/) 사용:
```
feat: 랜딩 히어로 섹션 추가
fix: 신청 폼 유효성 검사 수정
docs: 로드맵 Phase 0 구간 정리
```
- 커밋 메시지에 **변경 이유**를 한 줄 남깁니다(전역 규칙).

## PR
1. 자기 `dev-{이름}` 에서 작업 후 **base 를 `dev` 로** PR 생성(승격 PR 만 base 가 `stg`·`main`). **머지 방식은 merge commit.**
2. [PR 템플릿](.github/pull_request_template.md)의 체크리스트를 채웁니다(변경 요약·이유·테스트·스크린샷).
3. 리뷰 1인 이상 승인 후 병합.
4. 병합 전 `npm run typecheck && npm test && npm run build` 3종 통과 확인(합쳐 30초 남짓).
   `npm run lint` 는 없습니다 — 이 저장소에 ESLint 가 없습니다.

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

### `next dev` 실행 시 Segmentation fault (exit 3221225477 / 139)
일부 Windows 머신에서 **네이티브 노드 애드온(.node) 로딩 시 세그폴트**가 발생합니다.
Next의 SWC 바이너리 같은 네이티브 모듈을 로드하는 순간 크래시합니다.
(과거 eslint 의 `unrs-resolver` 도 같은 증상을 냈고, 그래서 이 저장소에는 ESLint 가 없습니다.)
주로 **보안/백신 소프트웨어**가 native 모듈 로드를 가로채는 것이 원인입니다.

우회/해결:
- 로컬에서는 타입 검증만: `npm run typecheck` (`tsc` 는 순수 JS라 정상 동작).
- 실제 런타임 확인은 **정상 머신 또는 CI**에서.
- 근본 해결 시도: 백신 실시간 검사에서 프로젝트 폴더/Node 예외 등록, 또는 `npm install` 재시도, Node 버전 변경.
- `npm install` 이 `unrs-resolver` postinstall 에서 크래시하면 `npm install --ignore-scripts` 로 설치(앱 실행에는 영향 없음, eslint 리졸버만 비활성).

### (2026-07-09 규명) 위 세그폴트의 실제 원인 — **한글 경로에서 대용량 JS 실행 차단**
분리 실험 결과: 같은 파일이 `%TEMP%`·`C:\dev` 등 **영문 경로에서는 정상 실행**되고, 이 저장소의 한글 경로에서만 access violation(0xC0000005)으로 죽습니다. 파일 **읽기**는 통과하고 **실행(대용량 JS·네이티브 바이너리)** 만 차단됩니다. 영향: `tsc`(typescript 7 네이티브 포함), `tsx`/`vitest`(esbuild), `next dev`.

이 저장소의 대응(이미 반영됨):
- **typescript는 5.x 고정**(7은 네이티브 컴파일러라 같은 차단에 걸림), 테스트는 vitest 대신 **node 내장 러너**(`npm run test` = tsc 컴파일 → `node --test`).
- **실행·검증은 영문 경로 미러에서**: 아래 한 줄로 `C:\dev\jgs-run`에 미러 후 그 안에서 `npm run dev`/`typecheck`/`test` 실행. **소스 수정·git은 항상 원본(이 폴더)에서** 하고, 수정 후 미러를 다시 동기화한다(증분이라 수 초).
  ```powershell
  robocopy "<이 저장소 경로>" "C:\dev\jgs-run" /MIR /XD .git .next .tmp-node .data node_modules\.cache /NFL /NDL /NJH /NP
  ```
- 근본 해결: 저장소를 영문 경로로 이전(clone)하거나 보안SW 예외 등록 — 팀 결정 필요.

## 변경 요약
<!-- 무엇을 바꿨는지 한두 줄로 -->

## 변경 이유
<!-- 왜 필요한지 (전역 규칙: 변경 이유를 함께 남긴다) -->

## 관련 문서/이슈
<!-- docs/... , 로드맵 항목, 이슈 번호 -->

## 체크리스트
- [ ] **base 브랜치 확인** — 작업 PR 은 `dev`, 승격 PR 은 `stg`/`main`(승격은 squash 금지·merge commit)
- [ ] `docs/00-positioning.md` 의 금지 포지션으로 흐르지 않음
- [ ] `npm run typecheck && npm test && npm run build` 3종 통과
- [ ] `console.log` 없음 (→ `lib/logger.ts`)
- [ ] 접근성 확인 (label·색 대비·포커스·시맨틱 태그)
- [ ] 비밀값 커밋 없음 (`.env*` 미포함)
- [ ] **스키마 변경이 있다면** — 가산은 `db:push` 선행, 파괴는 코드 배포 후 적용. DB 가 운영 하나뿐이라 되돌릴 수 없다 (runbook §6)

## 스크린샷 (UI 변경 시)
<!-- before / after -->

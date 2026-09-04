---
description: 칸반 보드를 HTML로 생성해 브라우저로 연다
argument-hint: (없음)
allowed-tools: Bash(node scripts/sprint/kanban.mjs), Bash(open:*)
---

## 할 일

1. 칸반을 생성한다:

   ```
   node scripts/sprint/kanban.mjs
   ```

2. 출력된 경로를 `open` 으로 연다. 실패하면 경로만 알려주고 넘어간다.

3. 답변은 **두세 줄**로 끝낸다:
   - 생성 경로
   - 지금 눈에 띄는 것 **하나만** (차단 쌓임 · 특정 마일스톤 편중 · 사용자 작업 대기 중 하나)

## 규칙

- `.sprint/board.html` 은 생성물이다. 직접 편집하지 않는다
- 이슈 상태를 바꾸지 않는다. 이 명령은 렌더링 전용이다
- 칸반 내용을 텍스트로 다시 나열하지 않는다. 사용자는 브라우저에서 본다

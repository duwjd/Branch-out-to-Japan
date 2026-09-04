---
description: GitHub 이슈를 .sprint 캐시로 다시 가져온다 (단방향 읽기)
allowed-tools: Bash(node scripts/sprint/sync.mjs)
---

```
!`node scripts/sprint/sync.mjs`
```

## 할 일

위 결과를 **두 줄 안에** 보고한다.

- 몇 건을 가져왔는지 (열림/닫힘)
- 실패했다면 원인만 전달하고 멈춘다. 캐시가 오래됐을 수 있다는 점을 함께 알린다

보드까지 원하면 `/sprint-board` 를 이어서 쓰라고 알린다. 여기서 보드를 출력하지 않는다.

## 규칙

- 이 명령은 **읽기 전용**이다. GitHub 에 이슈를 만들거나 고치지 않는다
- `.sprint/` 는 통째로 다시 생성되는 캐시다. 그 안의 파일을 편집하지 않는다

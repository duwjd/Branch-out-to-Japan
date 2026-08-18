# 랜딩 이미지 자산 자리

Figma 시안에 들어 있는 이미지를 **여기에 아래 파일명으로 내보내면** 랜딩 각 섹션에 자동으로 붙는다.
파일이 없으면 컴포넌트가 아무것도 렌더하지 않는다 — 빈 회색 상자나 깨진 이미지 아이콘이 남지 않는다
(`components/landing/Illustration.tsx`가 서버 시작 시 이 디렉터리를 한 번 훑는다).

확장자는 `svg` → `png` → `webp` → `jpg` → `jpeg` 순으로 먼저 찾은 것을 쓴다.

## 스팟 일러스트 (`Illustration`) — Figma `LP_Assets_Illustrations` (node `1:1697`)

| 파일명 | Figma 컴포넌트 | 쓰이는 곳 |
|---|---|---|
| `hero-input` | `ILL_Hero_Input` | Hero 목업 왼쪽 |
| `hero-output` | `ILL_Hero_Output` | Hero 목업 오른쪽 |
| `gap-evidence` | `ILL_Gap_Evidence` | 주장·근거 공백 카드 |
| `gap-channel` | `ILL_Gap_Channel` | 채널 크리에이티브 공백 카드 |
| `service-diagnose` | `ILL_Service_Diagnose` | SERVICE 01 좌측 컬럼 끝 |
| `service-studio` | `ILL_Service_MarketingStudio` | SERVICE 02 우측 컬럼 끝 |
| `future-connect` | `ILL_Future_Connect` | COMING NEXT 우측 컬럼 아래 |
| `cta-pilot` | `ILL_CTA_Pilot` | 파일럿 CTA 오른쪽 |

## 예시 화면 캡처 (`LandingShot`) — 실제 제품 화면/생성물

| 파일명 | Figma 노드 | 쓰이는 곳 | 비율 |
|---|---|---|---|
| `studio-thumb-1` | `1:1954` | SERVICE 02 · 썸네일 3안 ① 캐치카피+성분 비주얼형 | 정사각 |
| `studio-thumb-2` | `1:1959` | SERVICE 02 · 썸네일 3안 ② 프로모션 강조형 | 정사각 |
| `studio-thumb-3` | `1:1964` | SERVICE 02 · 썸네일 3안 ③ 모델+카피형 | 정사각 |
| `studio-detail` | `1:1969` | SERVICE 02 · 상세페이지 상단 구간 | 180:116 |
| `example-before` | `1:2029` | 제작 흐름 BEFORE · 한국 썸네일 원본 | 정사각 |
| `example-create` | `1:2084` | 제작 흐름 CREATE · 생성 썸네일 | 정사각 |

## 왜 파일이 비어 있나

이 저장소를 만든 실행 환경에서 Figma 자산 호스트(`figma.com`)가 조직 이그레스 정책에 막혀 있다
(`CONNECT tunnel failed, response 403`). 정책 거부는 우회하지 않는 것이 규칙이라 자산을 내려받지
못했고, 임의로 다시 그리면 실제 시안과 다른 그림이 박히므로 자리만 만들어 두었다.
Figma에서 위 노드를 export 해 이 폴더에 넣으면 코드 수정 없이 붙는다.

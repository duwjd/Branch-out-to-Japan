# 랜딩 이미지 자산

`components/landing/Illustration.tsx`가 서버 시작 시 이 디렉터리를 한 번 훑어, 아래 이름의 파일이
있을 때만 렌더한다(없으면 아무것도 그리지 않는다 — 빈 회색 상자나 깨진 이미지 아이콘이 남지 않는다).
확장자는 `svg` → `png` → `webp` → `jpg` → `jpeg` 순으로 먼저 찾은 것을 쓴다.

Figma 시안 `LP_Nonmember_Desktop_v2`에서 내보낸 자산을 2026-08-19에 채워 넣었다.

## 스팟 일러스트 (`Illustration`) — `LP_Assets_Illustrations` (node `1:1697`)

| 파일 | Figma 컴포넌트 | 쓰이는 곳 | 얹히는 배경 |
|---|---|---|---|
| `hero-input.png` | `ILL_Hero_Input` | Hero 목업 왼쪽 | 크림→피치 그라디언트 |
| `hero-output.png` | `ILL_Hero_Output` | Hero 목업 오른쪽 | 〃 |
| `gap-evidence.png` | `ILL_Gap_Evidence` | 주장·근거 공백 카드 | 흰 카드 |
| `gap-channel.png` | `ILL_Gap_Channel` | 채널 크리에이티브 공백 카드 | 흰 카드 |
| `service-diagnose.png` | `ILL_Service_Diagnose` | SERVICE 01 좌측 컬럼 끝 | 흰 섹션 |
| `service-studio.png` | `ILL_Service_MarketingStudio` | SERVICE 02 우측 컬럼 끝 | `#FAF8F5` |
| `future-connect.png` | `ILL_Future_Connect` | COMING NEXT 우측 컬럼 아래 | `#F2F1ED` |
| `cta-pilot.png` | `ILL_CTA_Pilot` | 파일럿 CTA 오른쪽 | **네이비 `#182333`** |

원본은 흰 배경 JPG라 그대로 쓰면 피치·회백·네이비 섹션 위에 흰 사각형이 남는다. 그래서 PNG로 바꾸며
**바깥 흰 영역만 투명 처리**했다. 전역 화이트 키잉이 아니라 **테두리에서 시작하는 플러드필**이다 —
전역으로 지우면 안쪽 흰 면(셔츠·바지·서류)까지 뚫린다.

`cta-pilot`은 두 가지가 더 붙었다.

- 이 그림만 셔츠·머리·신발이 `#FAFAFC`로, 흰 배경(`#FFFFFF`)과 **5레벨 차이로 맞닿아 있다**(잉크
  윤곽선이 없다). 다른 7종은 잉크 선이 흰 면을 감싸 플러드필이 못 들어가지만 여기는 뚫리므로,
  이 파일만 통과 임계를 높여 처리했다.
- 시안의 네이비 CTA에서 이 일러스트는 **같은 채색에 흰 윤곽선이 더해진 형태**다(반전이 아니다).
  네이비 면이 네이비 배경에 묻히지 않게 **어두운 면의 실루엣 바깥에만** 1.7px 흰 선을 둘렀다.
  흰 셔츠는 이미 보이므로 선이 없고, 코랄 화살표도 시안대로 선이 없다.

## 예시 화면 캡처 (`LandingShot`) — 실제 제품 화면·생성물

| 파일 | Figma 노드 | 쓰이는 곳 | 비율 |
|---|---|---|---|
| `studio-thumb-1.jpg` | `1:1954` | SERVICE 02 · 썸네일 3안 ① 캐치카피+성분 비주얼형 | 정사각 |
| `studio-thumb-2.jpg` | `1:1959` | SERVICE 02 · 썸네일 3안 ② 프로모션 강조형 | 정사각 |
| `studio-thumb-3.jpg` | `1:1964` | SERVICE 02 · 썸네일 3안 ③ 모델+카피형 | 정사각 |
| `studio-detail.jpg` | `1:1969` | SERVICE 02 · 상세페이지 상단 구간 | 180:116 |
| `example-before.jpg` | `1:2029` | 제작 흐름 BEFORE · 한국 썸네일 원본 | 정사각 |
| `example-create.jpg` | `1:2084` | 제작 흐름 CREATE · 생성 썸네일 | 정사각 |

사진이라 알파가 필요 없어 JPG 그대로 둔다. 원본이 152~258px(1x)이므로 고밀도 화면에서는 다소 무르다.
업스케일은 없는 디테일을 만들지 못하므로 하지 않았다 — 더 선명하게 하려면 Figma에서 2x로 다시 내보낸다.

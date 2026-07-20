# 유사 서비스 홈/대시보드 UI 레퍼런스 조사 — ⓪ 메인(앱 홈) 설계 근거

> 조사일 2026-07-20 · 조사 대상: 로그인 후 첫 화면(홈/대시보드) 7종.
> 목적: `docs/specs/00-main/` 앱 홈 UI 기획의 패턴 근거. 추출 항목 5가지 고정 — ① 첫 화면 위계 ② 빈 상태 ③ 다음 액션 유도 ④ 워크스페이스/프로젝트 스위처 ⑤ 마이크로인터랙션.
> 방법: WebSearch + 공식 도움말/패턴 문서·서드파티 리뷰 WebFetch. 확인 불가 항목은 "확인 불가"로 남기고 추정으로 채우지 않음.

## 요약 표

| 서비스 | 첫 화면 위계 (최상단→) | 빈 상태 | 다음 액션 유도 | 스위처 |
|---|---|---|---|---|
| **Shopify 관리자 홈** | 지표 4종(30일) → 열린 오더 태스크 → 추천 카드 | **셋업 가이드**: "0 out of 3 steps" 진행 카운터 + 체크리스트, 스텝별 펼침+액션 버튼 | 태스크 건수 배지, 인사이트 "View report", 스텝별 버튼 — **"다음 단계 제안"이 홈의 핵심 컨셉** | 상단바 스토어명 클릭 → 최근 리스트 + View all (페이지 이탈 없음) |
| **Semrush Home** | 폴더(프로젝트) 리스트, Primary tool 대형 위젯 승격 | 미설정 툴 블록에 "get started" 버튼 — 홈을 떠나지 않고 셋업 | 블록 단위 셋업 버튼, 지표 클릭 → 풀 리포트 | 툴 페이지 좌상단 폴더 선택기 드롭다운 |
| **Notion Home** | 인사말 → 최근 방문 캐러셀 → My Tasks(워크스페이스 횡단 집계) → 추천 | 태스크·방문 0이면 공식 템플릿·학습 위젯이 채움 | My Tasks + "+" 즉시 생성, 추천 카드 | 사이드바 워크스페이스 스위처(홈 밖) |
| **Canva 홈** | 검색·AI 바 → 유형별 원클릭 생성 버튼 줄 → 추천 템플릿 → 최근 디자인 | 데이터 0이어도 추천("For You")으로 채움, 온보딩은 "실제 그래픽 1개 만들기" 유도 | 생성 버튼 줄이 상시 CTA | 우상단 프로필 드롭다운 |
| **Stibee** | 요약형 홈 없음 — 이메일 목록이 기점, 대시보드는 이메일 단위 | **샘플 이메일이 곧 튜토리얼** ("에디터를 체험해 보세요" 자동 생성) | [새로 만들기] + 5단계 스텝 위저드 | 우상단 워크스페이스명 → 전환 |
| **Channel Talk** | 수신함 중심(홈 개념 약함) | 4단계 순차 온보딩("홈 꾸미기 약 5분"부터) | 순차 가이드 + 지원 캐릭터 버튼 | 좌하단 채널 목록 — 채널별 진행중 상담 수·알림 배지 |
| **Jasper** | 사이드바 + "Create content" 대형 버튼 → 최근 콘텐츠 | 온보딩 설문 → Brand Voice 설정 유도 | Create 버튼 → 유형 선택 팝업 | 좌상단 워크스페이스명 → 설정 |

## 마이크로인터랙션 관찰 (⑤)

- **진행의 시각화** — Shopify: 셋업 스텝 완료 시 체크 표시 + 진행 카운터 갱신 + 완료 토스트. Channel Talk: 채널별 알림 배지. Semrush: 지표 옆 전기 대비 % 변화.
- **hover 시 보조 액션 노출** — Semrush: 위젯·폴더명 hover 시 기어 아이콘. Shopify: Home card hover 시 해제 X 아이콘. (평시엔 숨겨 화면을 조용하게 유지)
- **상태 기억** — Semrush: 마지막 화면 상태를 다음 로그인에 복원. Notion: 시작 페이지 선택 제공.
- 공통적으로 장식성 모션은 관찰되지 않음 — 모션은 진행·완료·전환의 의미 전달에만 쓰임.

## KGLOW ⓪ 메인(앱 홈) 적용 결정

1. **홈의 중심 컨셉 = "다음 단계 제안"** (Shopify Home 문법). 3축 성숙도가 서로 달라(①확정·②썸네일만·③준비중) 사용자가 무엇을 할지 모르는 상태가 기본값 — 지표 나열형 대시보드가 아니라 다음 단계 CTA 패널·진행중 작업을 위계 상단에 둔다.
2. **첫 방문 빈 상태 = 셋업 가이드형** (Shopify 패턴): "{완료}/{전체} 단계" 진행 카운터 + 체크리스트(브랜드 프로필 ✓ 온보딩 완료 → 첫 진단 → 첫 썸네일). Stibee의 "샘플이 곧 튜토리얼" 패턴을 병치 — 샘플 리포트 링크로 가치를 먼저 보여줌.
3. **KPI 요약은 조용한 한 줄** — Shopify 4지표 문법을 따르되 별도 카드 4장이 아닌 hairline 구분 스탯 행으로. 값은 시스템 카운트(리포트 {n}건·생성 자산 {n}건 등)만 — 시장 성과 수치·리뷰 등 허위 가능 데이터 금지(증거 원칙).
4. **브랜드 프로필 스위처 = Shopify 스토어 스위처 문법** — 상단바 브랜드명 클릭 → 드롭다운 리스트 + "브랜드 추가", 페이지 이탈 없이 전환. (Semrush 좌상단 위치와 동일 결론)
5. **진행중 작업은 축 횡단 집계** (Notion My Tasks 문법) — ② 생성중 타일·① 처리중 리포트를 홈이 폴링해 한 곳에 표시. 타일 문법은 ② HOME-04를 재사용.
6. **마이크로인터랙션은 의미 전달에 한정** — 진행 카운터·완료 체크·완료 토스트·hover 리프트·hover 시 보조 액션 노출. 장식성 모션 배제(레퍼런스 공통 + `design/DESIGN.md` §15 모션 토큰).

## 출처

- Shopify: help.shopify.com/en/manual/shopify-admin/shopify-home · shopify.dev/docs/api/app-home/patterns/compositions/setup-guide
- Semrush: semrush.com/kb/833-home-page · semrush.com/news/269334-projects-meet-the-new-interface
- Notion: notion.com/help/home-and-my-tasks · thomasjfrank.com/notion-home-everything-you-need-to-know
- Canva: canva.com/help/search-ai-bar · goodux.appcues.com/blog/canvas-user-tailored-onboarding-flow · brendacadman.com/introduction-to-canva-how-to-navigate-your-canva-homepage
- Stibee: help.stibee.com/getting-started/send-first-email · help.stibee.com/user-workspace/settings/create
- Channel Talk: docs.channel.io/help/ko (시작하기·멀티 채널 응대)
- Jasper: pageflows.com/post/desktop-web/workspace-settings/jasper · getguru.com/reference/jasper-ai

/**
 * ② 마케팅 스튜디오 · 상세페이지 만들기 — 생성 퍼널(DETAIL-00~08).
 * 서버 컴포넌트: 팩에서 템플릿 메타를 읽어 폼에 주입한다(라벨은 평문, 내부 ID는 값으로만).
 */

import { Suspense } from 'react';
import { templateUiMetas } from '@/lib/studio/detail/blockPack';
import { checkDetailReadiness } from '@/lib/server/detailReadiness';
import { DetailForm } from './DetailForm';

export const metadata = { title: '상세페이지 만들기 · 마케팅 스튜디오 | KGLOW' };

/**
 * 템플릿 프리뷰 — `npm run detail:previews` 가 **실제 파이프라인으로** 구운 결과물이다.
 * 팩(detail-style-prompts.json)은 데이터만 갖고, 정적 경로는 화면이 소유한다
 * (썸네일 PREVIEW_BY_STYLE 과 같은 관례).
 *
 * 두 벌인 이유: 전체 스트립은 592×5087 급이라 74×168 카드에 쓰면 300만 픽셀을 디코드해
 * 1만 2천 픽셀만 그린다. 카드는 상단 크롭본(148×336, 장당 4~6KB), 확대 모달만 전체본을 쓴다.
 * 둘 다 같은 스크립트가 같은 master 에서 함께 굽는다.
 */
const TEMPLATE_IDS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'] as const;

function previewSrcOf(id: string): string | null {
  return (TEMPLATE_IDS as readonly string[]).includes(id) ? `/detail-templates/preview-${id}.webp` : null;
}

function cardSrcOf(id: string): string | null {
  return (TEMPLATE_IDS as readonly string[]).includes(id) ? `/detail-templates/preview-${id}-card.webp` : null;
}

export default async function DetailStudioPage() {
  const templates = templateUiMetas().map((t) => ({
    ...t,
    previewSrc: previewSrcOf(t.id),
    cardSrc: cardSrcOf(t.id),
  }));
  // 준비가 안 된 서버에서 폼을 다 채운 뒤 503을 만나지 않도록, 진입 시점에 미리 알린다
  const readiness = await checkDetailReadiness();
  return (
    <Suspense>
      <DetailForm templates={templates} readiness={readiness} />
    </Suspense>
  );
}

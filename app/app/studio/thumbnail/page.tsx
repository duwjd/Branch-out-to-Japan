import { Suspense } from 'react';
import { getPromptPack, styleUiMetas, type StyleId } from '@/lib/studio/promptPack';
import { StudioForm } from './StudioForm';

/**
 * ② 스튜디오 홈 = 생성 퍼널(02-studio HOME) — 스타일 메타는 서버에서 팩을 읽어 주입한다
 * (프롬프트 팩은 fs 로드라 클라이언트에서 직접 읽지 않는다).
 */

/** 템플릿 카드의 실측 참고 컷(assets/README) — public/studio-templates로 빌드 시 복사본 */
const PREVIEW_BY_STYLE: Record<StyleId, string> = {
  A: '/studio-templates/01-clean.jpg',
  B: '/studio-templates/02-texture.jpg',
  C: '/studio-templates/03-official.jpg',
  D: '/studio-templates/04-copy-ingredient.jpg',
  E: '/studio-templates/05-award.jpg',
  F: '/studio-templates/06-model.jpg',
  G: '/studio-templates/07-promo.jpg',
  H: '/studio-templates/08-premium.jpg',
};

export default function StudioHomePage() {
  const styles = styleUiMetas().map((s) => ({ ...s, previewSrc: PREVIEW_BY_STYLE[s.id] }));
  const byPlatform = getPromptPack().selectionGuide.byPlatform;
  return (
    // useSearchParams(프리필 진입)를 쓰는 클라이언트 폼 — Suspense 경계 필요
    <Suspense>
      <StudioForm styles={styles} byPlatform={byPlatform} />
    </Suspense>
  );
}

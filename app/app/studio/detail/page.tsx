/**
 * ② 마케팅 스튜디오 · 상세페이지 만들기 — 생성 퍼널(DETAIL-00~08).
 * 서버 컴포넌트: 팩에서 템플릿 메타를 읽어 폼에 주입한다(라벨은 평문, 내부 ID는 값으로만).
 */

import { Suspense } from 'react';
import { templateUiMetas } from '@/lib/studio/detail/blockPack';
import { checkDetailReadiness } from '@/lib/server/detailReadiness';
import { DetailForm } from './DetailForm';

export const metadata = { title: '상세페이지 만들기 · 마케팅 스튜디오 | KGLOW' };

export default async function DetailStudioPage() {
  const templates = templateUiMetas();
  // 준비가 안 된 서버에서 폼을 다 채운 뒤 503을 만나지 않도록, 진입 시점에 미리 알린다
  const readiness = await checkDetailReadiness();
  return (
    <Suspense>
      <DetailForm templates={templates} readiness={readiness} />
    </Suspense>
  );
}

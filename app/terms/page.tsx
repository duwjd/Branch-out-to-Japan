import type { Metadata } from 'next';
import { PolicyShell } from '@/app/landing/PolicyShell';

export const metadata: Metadata = {
  title: '이용약관 — YOAKE',
  description: 'YOAKE 서비스 이용 조건과 이용자·회사의 책임 범위를 안내합니다.',
};

export default function TermsPage() {
  return (
    <PolicyShell
      title="이용약관"
      lead="서비스 이용 조건과 책임 범위를 정리한 문서입니다. YOAKE는 법적 적합성이나 심의 통과를 보증하지 않으며, 최종 광고 판단과 책임은 관련 사업자에게 있습니다."
    />
  );
}

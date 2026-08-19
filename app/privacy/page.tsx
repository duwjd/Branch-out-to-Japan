import type { Metadata } from 'next';
import { PolicyShell } from '@/app/landing/PolicyShell';

export const metadata: Metadata = {
  title: '개인정보처리방침 — YOAKE',
  description: 'YOAKE가 수집하는 정보와 이용 목적, 보관 기간과 파기 절차를 안내합니다.',
};

export default function PrivacyPage() {
  return (
    <PolicyShell
      title="개인정보처리방침"
      lead="YOAKE가 어떤 정보를 수집하고 무엇에 쓰는지, 얼마나 보관하고 어떻게 파기하는지 정리한 문서입니다."
    />
  );
}

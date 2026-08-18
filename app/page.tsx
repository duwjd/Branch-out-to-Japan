import type { Metadata } from 'next';
import { LandingHeader } from './landing/Header';
import { Hero } from './landing/Hero';
import {
  CoreFlow,
  Faq,
  FutureOperations,
  PilotCta,
  ProblemGaps,
  ProductExample,
  ServiceCreate,
  ServiceDiagnose,
  Trust,
  Workflow,
} from './landing/Sections';
import { ApplicationForm } from './landing/ApplicationForm';
import { LandingFooter } from './landing/Footer';
import { APPLICATION } from './landing/content';
import { LpHeading, LpSection } from './landing/primitives';
import { PageView } from '@/components/landing/PageView';
import { ScrollProgress } from '@/components/landing/ScrollProgress';

/**
 * 랜딩(/) — Figma `LP_Nonmember_Desktop_v2`(2026-08-18) 섹션 순서 그대로.
 * Header → Hero → Problem_Gaps → CoreFlow → Service 01/02 → ProductExample →
 * Workflow → Future_Operations → Trust → PilotCTA → FAQ → ApplicationForm → Footer.
 *
 * 로그인은 헤더 한 곳에서만 시작한다 — 서비스(/app) 안에는 로그인 동선이 없다.
 * 요금제 섹션은 Figma에 없어 두지 않는다(가격 문구도 FAQ에서 뺐다).
 */

export const metadata: Metadata = {
  title: 'YOAKE — 카피와 근거를 진단하고, 일본 채널에 맞는 크리에이티브로',
  description:
    '한국어 광고 카피와 제품 자료를 연결하면 표현 상태와 필요한 근거를 진단하고, 그 결과를 목표 채널에 맞는 썸네일과 상세페이지로 전환합니다.',
};

export default function LandingPage() {
  return (
    <>
      <ScrollProgress />
      <PageView />
      <LandingHeader />
      <main>
        <Hero />
        <ProblemGaps />
        <CoreFlow />
        <ServiceDiagnose />
        <ServiceCreate />
        <ProductExample />
        <Workflow />
        <FutureOperations />
        <Trust />
        <PilotCta />
        <Faq />
        <LpSection id="apply" tone="warm">
          <LpHeading lead={APPLICATION.lead}>{APPLICATION.heading}</LpHeading>
          <div className="mt-11">
            <ApplicationForm />
          </div>
        </LpSection>
      </main>
      <LandingFooter />
    </>
  );
}

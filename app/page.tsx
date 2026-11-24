import type { Metadata } from 'next';
import { LandingHeader } from './landing/Header';
import { Hero, HERO_INTRO_ID } from './landing/Hero';
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
import { APPLICATION, HERO_VIDEO } from './landing/content';
import { LpHeading, LpSection } from './landing/primitives';
import { HeroVideoStage } from '@/components/landing/HeroVideoStage';
import { PageView } from '@/components/landing/PageView';
import { ScrollProgress } from '@/components/landing/ScrollProgress';

/**
 * 랜딩(/) — Figma `LP_Nonmember_Desktop_v2`(2026-08-18) 섹션 순서에 **첫 화면 영상**을 앞세웠다(2026-11-24).
 * Header → HeroVideo(제품 소개 영상 · 시안에 없음) → Hero → Problem_Gaps → CoreFlow → Service 01/02 →
 * ProductExample → Workflow → Future_Operations → Trust → PilotCTA → FAQ → ApplicationForm → Footer.
 *
 * 첫 화면은 영상이 헤더 아래에 고정되고, 스크롤하면 기존 Hero(헤드라인·CTA·목업)가 그 위를 덮으며 올라온다.
 * H1 과 주 CTA 가 첫 화면 아래로 내려갔으므로, 첫 화면의 신청 동선은 헤더의 "무료 파일럿 신청"이 맡는다.
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
        <HeroVideoStage
          labels={HERO_VIDEO.labels}
          poster={HERO_VIDEO.poster}
          webm={HERO_VIDEO.webm}
          mp4={HERO_VIDEO.mp4}
          targetId={HERO_INTRO_ID}
        >
          <Hero />
        </HeroVideoStage>
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
        <LpSection id="apply">
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

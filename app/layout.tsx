import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

/** Pretendard Variable — 전역 본문 서체(자체 호스팅, next/font로 FOUT 방지) */
const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2',
  display: 'swap',
  weight: '45 920',
  variable: '--font-pretendard',
});

export const metadata: Metadata = {
  title: 'KGLOW — 일본 고객 관점의 메시지 재설계',
  description:
    '한국 뷰티 브랜드의 상세페이지·SNS 문구를 일본 고객 관점으로 진단하고, 일본향 콘텐츠 제작·운영을 한곳에서.',
};

/** 루트 레이아웃 — 기능 검증 빌드(디자인 교체 전제, 구조만 유지) */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}

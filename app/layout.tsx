import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "일본 진출 콘텐츠 5분 진단 | 브랜드 전환 스튜디오",
  description:
    "번역만으로는 부족한 일본 진출 콘텐츠, 일본 고객 관점으로 진단해 드립니다. 대행사에 맡기기 전, 지금 콘텐츠가 일본에서 통할지 먼저 점검하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

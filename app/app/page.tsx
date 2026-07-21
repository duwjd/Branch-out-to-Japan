import { redirect } from 'next/navigation';

/** /app — ⓪ 대시보드는 이번 범위 제외(09 §4b). 자산 라이브러리로 보낸다. */
export default function AppIndexPage() {
  redirect('/app/library');
}

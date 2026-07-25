/**
 * dev 전용 보조 링크 — 실 메일 발송이 없는 개발 모드에서 인증/재설정 링크를 바로 연다.
 * 프로덕션에서는 인증 API가 devLink를 주지 않으므로(undefined/null) 이 컴포넌트가 렌더되지 않는다.
 * 상태 없음 → 서버/클라이언트 겸용.
 */
export function DevLink({ href, label = '(dev) 인증 링크 바로 열기' }: { href: string; label?: string }) {
  return (
    <a href={href} className="mt-2.5 inline-block text-[12px] font-bold text-coral-strong underline-offset-2 hover:underline">
      {label}
    </a>
  );
}

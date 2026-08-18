/**
 * 다운로드용 파일 URL — 화면(클라이언트)이 쓴다. 서버 전용 storage.ts 와 분리한 이유는
 * 그쪽이 node:fs 를 import 하기 때문이다(클라이언트 번들에 새면 안 된다).
 */

/**
 * 표시용 `/api/files/[id]` URL → 바이트를 직접 받는 URL.
 *
 * 표시 경로는 Supabase Storage 서명 URL로 302 리다이렉트된다(CDN이 직접 서빙).
 * 그런데 다운로드 버튼은 `fetch().blob()` 으로 받아 `a[download]` 로 파일명을 붙이므로,
 * 교차 출처로 넘어가면 CORS 와 파일명 지정이 걸린다. 이 파라미터가 붙으면 라우트가
 * 리다이렉트하지 않고 같은 출처에서 바이트를 준다.
 */
export function bytesUrl(fileUrl: string): string {
  return fileUrl.includes('?') ? `${fileUrl}&download=1` : `${fileUrl}?download=1`;
}

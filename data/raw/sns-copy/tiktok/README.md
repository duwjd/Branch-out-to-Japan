# tiktok/ — 수작업 수집 (자동화 불가)

실측(2026-07): **TikTok Creative Center**(`ads.tiktok.com/business/creativecenter`)의
일본 인기 해시태그 전체 랭킹은 **로그인 게이트** 뒤에 있다. 비로그인 시 내부 API
(`GetHashtagList`)가 미리보기 3개(비뷰티)만 반환 → 자동 수집 불가.

## 수작업 수집 방법
1. TikTok Creative Center 로그인 → Trends > Hashtag.
2. 필터: Region=Japan, Industry=**Beauty & Personal Care**, 기간 7/30일.
3. 상위 해시태그·게시물수·트렌드를 TSV로 저장: `tiktok-YYYY-MM-DD.tsv` (`hashtag<TAB>posts<TAB>trend`).
4. 저장 후 `node scripts/crawl/build-lexicon.mjs` 재실행하면 렉시콘에 반영됨(파일 스캔).

> 대안: @cosme(`cosme.mjs`)가 뷰티 어휘를 키 없이 수집하므로 SNS 어휘 코퍼스의 1차 소스로 사용.

/**
 * grounding 로더 — 참조 데이터 계층(08 §2)을 LLM 콜의 안정 프리픽스로 조립한다.
 * 원본 코퍼스를 통째로 넣지 않고 사전집계·규정 요약·렉시콘 상위 어휘만 주입(스펙 §5.2).
 * 파일은 저장소 루트 기준 상대 경로로 읽는다(저장소 루트 = 앱 루트).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Category, ProductClass } from '../types';
import { applicableItems } from '../rubric';

interface AggregateEntry {
  sampleCount: number;
  topTrustBadges: { text: string; count: number }[];
  topIngredients: { text: string; count: number }[];
  appealExamples: string[];
}

interface BenchmarkAggregates {
  version: string;
  sourceCount: number;
  note: string;
  categories: Record<string, AggregateEntry>;
}

export interface RegulatoryClause {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
}

interface RegulatorySummary {
  version: string;
  status: string;
  reviewNote: string;
  gradeFrame: { note: string; grades: { grade: string; canSay: string; cannotSay: string }[] };
  clauses: RegulatoryClause[];
}

export interface LexiconTerm {
  term: string;
  reading: string;
  category: string;
  frequency: number;
}

const ROOT = process.cwd();

let cachedAggregates: BenchmarkAggregates | null = null;
let cachedRegulatory: RegulatorySummary | null = null;
let cachedLexicon: LexiconTerm[] | null = null;

/** 카테고리별 사전집계 로드(프로세스 캐시) */
export function getAggregates(): BenchmarkAggregates {
  if (!cachedAggregates) {
    cachedAggregates = JSON.parse(
      readFileSync(path.join(ROOT, 'data/processed/benchmark-aggregates.json'), 'utf8'),
    ) as BenchmarkAggregates;
  }
  return cachedAggregates;
}

/** 카테고리 서브셋 조회 — 결손 시 null(블록4 축소 렌더 폴백) */
export function getCategoryAggregate(category: Category): AggregateEntry | null {
  return getAggregates().categories[category] ?? null;
}

/** 규정 출처 요약 로드(콜②·체커 grounding + clauseRefs 검증 키) */
export function getRegulatory(): RegulatorySummary {
  if (!cachedRegulatory) {
    cachedRegulatory = JSON.parse(
      readFileSync(path.join(ROOT, 'data/processed/regulatory-summary.json'), 'utf8'),
    ) as RegulatorySummary;
  }
  return cachedRegulatory;
}

/** 유효한 조항 각주 키 집합(콜② 응답 검증용) */
export function validClauseIds(): Set<string> {
  return new Set(getRegulatory().clauses.map((c) => c.id));
}

/** SNS 렉시콘 상위 어휘(빈도순) — 간이 CSV 파서(이 파일은 따옴표 없는 단순 CSV) */
export function getLexiconTop(limit: number): LexiconTerm[] {
  if (!cachedLexicon) {
    const csv = readFileSync(path.join(ROOT, 'data/processed/sns-lexicon.csv'), 'utf8');
    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    cachedLexicon = lines
      .slice(1)
      .map((line) => {
        const cols = line.split(',');
        return {
          term: cols[0] ?? '',
          reading: cols[1] ?? '',
          category: cols[3] ?? '',
          frequency: Number(cols[5] ?? 0) || 0,
        };
      })
      .filter((t) => t.term)
      .sort((a, b) => b.frequency - a.frequency || a.term.localeCompare(b.term, 'ja'));
  }
  return cachedLexicon.slice(0, limit);
}

const EVIDENCE_GUARDRAIL =
  '[증거 원칙 — 절대 준수] 코퍼스·규정 근거 밖의 수치·인증·리뷰·사례를 창작하지 말 것. 근거를 제시할 수 없으면 해당 필드를 빈 문자열/빈 배열로 둘 것. 성과 예측·보장 문구 금지. 이 진단은 번역이 아니라 일본 고객 관점의 정보 구조 재설계다.';

/**
 * 출력 언어 계약 — ① 리포트 콜(①~⑤·체커) 전용.
 *
 * 왜 필요한가: 리포트 독자는 **일본어를 못 읽는 한국 브랜드 담당자와 그 결재자**다(스펙 §2·US-3).
 * 그런데 이 콜들의 grounding 에는 코퍼스·렉시콘·규정이 일본어로 대량 주입된다. 언어 지시가
 * 한 줄도 없으면 모델이 그 일본어에 끌려가 서술까지 일본어로 낸다 — 콜③에서 실제로 그랬고
 * (`persona`·`journey`·`objections[].why`·`reviewNarrative` 전부 일본어), 브랜드 진단은
 * 콜③이 유일한 LLM 산출이라 **리포트가 통째로 일본어로 발행**됐다.
 *
 * ⚠ ② 스튜디오 콜(studioCopy·detailCopy·copyHumanize·inputTranslate)에는 **붙이지 않는다.**
 *   그쪽 산출물은 일본어 카피 자체라, 이 계약을 붙이면 정반대 지시가 된다.
 */
const LANGUAGE_CONTRACT = [
  '[출력 언어 — 절대 준수]',
  '이 리포트를 읽는 사람은 일본어를 못 읽는 한국 브랜드 담당자와 그 결재자다. 판정·근거·해설·요약은 전부 한국어로 쓴다.',
  '위 grounding 에 일본어 코퍼스·렉시콘·규정이 대량으로 들어 있지만 그것은 **판단 재료이지 출력 언어가 아니다.**',
  '일본어를 쓰는 자리는 정해져 있다 — ① 필드명이 Ja 로 끝나는 슬롯 ② 일본 고객이 실제로 떠올리는 의문 원문 ③ 일본 관례어·성분명·기관명·코퍼스 실측 표현.',
  '그 외 서술에 일본어 문장을 쓰지 마라. 일본어 용어를 서술 안에 인용할 때는 「」로 감싸고 한국어로 뜻을 밝힌다.',
  '한국어 서술 자리에 일본어를 내면 그 필드는 폐기되고 재생성된다 — 처음부터 한국어로 써라.',
].join('\n');

/** 언어 계약이 붙는 콜 — ① 리포트 축만. ② 스튜디오 축은 일본어를 산출하므로 제외한다 */
const REPORT_CALLS = new Set(['call1', 'call2', 'call3', 'call4', 'call5', 'checker', 'reportHumanize']);

/** 사전집계를 프롬프트 주입용 텍스트로 요약 */
function aggregateSection(category: Category): string {
  const agg = getCategoryAggregate(category);
  if (!agg) return `[코퍼스 사전집계] ${category} 표본 없음 — 카테고리 일반 원칙으로만 판단하고 corpusRef는 비울 것.`;
  const badges = agg.topTrustBadges.slice(0, 12).map((b) => `${b.text}(${b.count})`).join(' · ');
  const ingredients = agg.topIngredients.slice(0, 10).map((b) => `${b.text}(${b.count})`).join(' · ');
  const examples = agg.appealExamples.slice(0, 8).map((e) => `- ${e}`).join('\n');
  return [
    `[코퍼스 사전집계 — 라쿠텐 ${category} 상세 ${agg.sampleCount}건 실측. 이 안의 표현만 corpusRef로 인용 가능]`,
    `상위 신뢰 배지: ${badges}`,
    `상위 성분 키워드: ${ingredients}`,
    `관례 소구문 예: \n${examples}`,
  ].join('\n');
}

/** 규정 요약을 프롬프트 주입용 텍스트로 */
function regulatorySection(productClass: ProductClass): string {
  const reg = getRegulatory();
  const grades = reg.gradeFrame.grades
    .map((g) => `- ${g.grade}: 가능=${g.canSay} / 불가=${g.cannotSay}`)
    .join('\n');
  const clauses = reg.clauses.map((c) => `[${c.id}] ${c.title} — ${c.summary}`).join('\n');
  const assumed = productClass === '미상' ? ' (제품분류 미상 → 化粧品으로 상정하고 판정할 것)' : '';
  return [
    `[약기법 판정 프레임 — 상정 등급: ${productClass}${assumed}]`,
    reg.gradeFrame.note,
    grades,
    `[조항 각주 — clauseRefs에는 아래 id만 사용(창작 금지)]`,
    clauses,
  ].join('\n');
}

/** 루브릭 항목 정의를 프롬프트 주입용 텍스트로 */
function rubricSection(category: Category): string {
  const rows = applicableItems(category)
    .map((i) => `- ${i.id} ${i.title}: ${i.criterion} (0=없음 / 1=부분 / 2=관례 충족)`)
    .join('\n');
  return `[채점 루브릭 — 아래 항목만, 항목당 정확히 1개 판정]\n${rows}`;
}

/** 렉시콘 상위 어휘 섹션 */
function lexiconSection(limit: number): string {
  const rows = getLexiconTop(limit)
    .map((t) => `${t.term}(${t.reading || '-'}, 빈도 ${t.frequency})`)
    .join(' · ');
  return `[일본 뷰티 검색·고민 어휘(빈도 실측)] ${rows}`;
}

/** 콜⑤ 슬라이드 골격 — 코드가 소유하는 모드별 고정 목록(스펙 §10.4 v4). LLM은 각 장의 카피만 쓴다 */
const SLIDE_SKELETON_FULL = [
  '- cover(표지): 무엇을 얼마에 진단했는가. 브랜드·제품은 렌더러가 넣으므로 카피는 한 줄 위치잡기만',
  '- conclusion(결론 한 장): 결재자가 이 장만 봐도 판단 가능해야 함. 점수가 낮다면 왜 낮은지, 그래서 무엇이 위험한지',
  '- score(점수·Top3): 어느 축이 왜 비었는지. "번역이 덜 된 게 아니라 신뢰 구조가 없다"는 요지',
  '- risk(약기법 리스크): 광고 정지·수정 리스크를 상장 전에 제거한다는 관점',
  '- benchmark(벤치마크 갭): 감이 아니라 일본 상위 제품 실측 대비 무엇이 빠졌는가',
  '- beforeAfter(비포·애프터): 문장 하나가 어떻게 달라지는지 실감',
  '- nextStep(다음 단계·비용): 그래서 무엇을 하나. 고정가라 견적 왕복이 없다는 점',
].join('\n');

/** 브랜드 진단 덱(4장) — 점수·감사가 없으므로 해당 장이 존재하지 않는다. 없는 결과를 언급·암시하지 말 것 */
const SLIDE_SKELETON_BRAND = [
  '- cover(표지): 무엇을 진단했는가(브랜드 진단 — 제품 콘텐츠 미제출). 브랜드명은 렌더러가 넣는다',
  '- positioning(포지셔닝·USP 재정의): 일본 고객이 이 브랜드의 소구를 어떻게 읽는지, 구매 이유가 어떻게 재정의되는지',
  '- benchmark(벤치마크): 일본 상위 제품이 신뢰를 어떻게 쌓는지(코퍼스 실측). 고객 콘텐츠 대비는 하지 않았음을 전제로',
  '- nextStep(다음 단계·비용): 상세페이지 카피를 넣으면 약기법 감사·문법 점수·재작성이 열린다는 상향 동선',
].join('\n');

/**
 * 일본어 카피의 AI 티 루브릭.
 *
 * 출처: `.claude/skills/humanize-korean/references/ai-tell-taxonomy.md` (10카테고리 70패턴).
 * 그 스킬은 **한국어 전용**이고(조사·이중피동·형식명사 등 한국어 형태론 기반) Claude Code
 * 저작 시점에만 도는 하네스라, 런타임에서 부를 수 없다. 그래서 **일본어로 전이되는
 * 카테고리만 골라 KR→JP 간섭 기준으로 다시 썼다**(원본은 EN→KR 간섭 기준이다).
 *
 * ⚠ 원본 카테고리 G(과도한 hedging)는 **일부러 이식하지 않았다.** 일본 상세페이지는
 *   ※각주·「個人差があります」로 **정당하게** 완곡하며, 그것이 곧 약기법·景表法 대응이다.
 *   여기서 hedging 을 깎으면 기존 법적 가드와 정면충돌한다.
 */
const JP_NATURALNESS_RUBRIC = [
  '[일본어 자연성 — AI 티 제거]',
  '아래는 LLM이 쓴 일본어에서 반복적으로 관찰되는 티다. 해당하면 다시 써라.',
  '- 상투 결론구: 「〜ではないでしょうか」「まさに〜と言えるでしょう」「〜の秘密がここにあります」「〜へ、そして〜へ」 같은 마무리 공식.',
  '- 기계적 병렬: 항목들이 같은 글자수·같은 품사·같은 종결로 줄 맞춰 떨어지는 것. 길이와 형태를 일부러 흐트러뜨려라.',
  '- 리듬 균일: 「〜です。」가 세 문장 연속되거나 体言止め만 이어지는 것. 문장 길이를 실제로 들쭉날쭉하게.',
  '- 문체 혼용: です・ます체와 だ・である체를 한 블록에서 섞지 마라. 상세페이지 본문은 です・ます로 통일한다.',
  '- 번역투(KR→JP): 「〜において」「〜に関して」「〜を通じて」「〜することができます」 남용, 한국어 어순을 그대로 옮긴 수식 순서, 「〜てください」 연발.',
  '- 접속사 남발: 문두 「また」「そして」「さらに」「つまり」. 대부분 빼도 뜻이 통한다.',
  '- 과잉 수식: 「しっかりと」「非常に」「まさに」「たっぷり」의 반복. 한 블록에 정도부사는 하나면 충분하다.',
  '- 형식명사: 「〜ということ」「〜という点」「〜する必要があります」.',
  '- 콜론 부제(「うるおい：肌の土台をつくる」)와 「AかBか」 대구는 블록당 최대 1회.',
  '건드리지 않는 것: 고유명사·제품명·성분명·기관명 / 수치·날짜·단위 / ※각주 마커 / 직접 인용.',
  '이 항목들은 코드가 자단위로 조립하거나 근거로 제출된 값이라, 표현을 다듬는 대상이 아니다.',
].join('\n');

/**
 * 한국어 자연성 루브릭 — 콜⑩ reportHumanize 전용.
 *
 * 출처: `.claude/skills/humanize-korean/references/quick-rules.md`(taxonomy 70패턴 중 quick 49건).
 * 그 스킬은 Agent 툴·`_workspace/` 파일트리·Python 게이트에 의존하는 Claude Code 저작 시점
 * 하네스라 런타임에서 부를 수 없다. `JP_NATURALNESS_RUBRIC` 이 만든 선례대로 **원리만 TS 상수로
 * 이식**한다 — `.claude/` 는 Next.js 배포 번들에 들어가지 않으므로 파일 로드는 쓰지 않는다.
 *
 * ⚠ 일부러 이식하지 않은 것 —
 *   · **G(과도한 hedging)**: 리포트는 "법적 확정 판정이 아닌 1차 스크리닝"이라는 면책·한계 고지를
 *     **의무적으로** 완곡하게 쓴다(AC-5.2). 여기서 hedging 을 깎으면 면책 문구가 단정으로 바뀐다.
 *     JP 루브릭이 G 를 뺀 것과 정확히 같은 이유다.
 *   · **C-2·C-9·C-10(불릿→산문, 숫자 인덱싱, 콜론 부제)**: 리포트의 정본 형식이 구조화 블록·표다.
 *     산문으로 녹이라는 지시는 블록 계약과 정면충돌한다.
 */
const KR_NATURALNESS_RUBRIC = [
  '[한국어 자연성 — AI 티 제거]',
  '아래는 LLM이 쓴 한국어에서 반복 관찰되는 티다. 해당하면 다시 써라. 정의 → 처방 순이다.',
  '',
  '· 번역투 —',
  '  "~에 대해(서)" 남발 → 목적격 조사로 직결("X에 대해 논의" → "X를 논의").',
  '  "~를 통해/통하여" 남발 → "~로", "~해서", "~함으로써"로 분산.',
  '  "~에 있어(서)" → "~에서" 또는 "~을 볼 때". "~와 관련하여" → "~에", "~의".',
  '  "가지고 있다" 류 직역 → 형용사·동사로 환원("경쟁력을 가지고 있다" → "경쟁력이 강하다").',
  '  이중 피동 "~되어진다/~지게 된다" → 능동 또는 단일 피동("판단되어진다" → "판단된다").',
  '  "~에 의해" 피동 → 행위자를 주어로. "~할 수 있다" 남발 → 단언으로("높일 수 있다" → "높인다").',
  '  이중 조사 "~에서의/~으로의/~에의" → 절로 풀어쓰기.',
  '  명사 앞 3어절 이상 관형절 → 문장을 자르거나 뒤로 뺀다.',
  '',
  '· AI 관용구 —',
  '  결산 어휘 "결론적으로/따라서/이를 통해/요약하면" 3회 초과 → 1~2건만 남긴다.',
  '  "시사하는 바가 크다/주목할 만하다/매우 중요하다" → 삭제하거나 구체 결론으로 바꾼다.',
  '  열거 도입 "크게 세 가지로 나눌 수 있다/다음과 같은" → 도입구를 지우고 바로 본론으로.',
  '  hype 어휘(혁신적/획기적/압도적/전례 없는) → 구체 사실로 환원.',
  '  의인화 주어("시장이 요구한다") → 사람·기관 주어로.',
  '  결말 공식 "~할 때입니다/~시점입니다" → 구체 동사 단언으로.',
  '',
  '· 리듬·수식 —',
  '  문장 길이가 모두 비슷하면(30~50자 부근) 단문과 장문을 의도적으로 섞는다.',
  '  종결어미가 "~다."로만 이어지면 흐트러뜨린다.',
  '  정도부사(매우/상당히/굉장히/특히) 반복 → 한 문단에 하나면 충분하다.',
  '  같은 뜻의 수식어 중복("가장 최선의", "미리 예상") → 하나로.',
  '',
  '· 접속·형식명사 —',
  '  문두 접속사 "또한/그리고/하지만/따라서" 남발 → 대부분 빼도 뜻이 통한다.',
  '  "~라는 것이다/~라는 점에서/~할 필요가 있다/~인 것으로 보인다" → 직접 서술로.',
  '  연결어미(-고/-며/-지만/-면서) 직후의 쉼표 → 쉼표를 뺀다.',
  '',
  '[절대 건드리지 않는 것]',
  '고유명사·브랜드명·제품명·성분명·기관명 / 수치·날짜·단위·퍼센트 / 「」 안 일본어 인용 /',
  '규정 조항 각주 [n]과 조항 id / 루브릭 항목 ID(A1~E4) / 문장 ID(K1~) /',
  '약기법 판정어("불가"·"조건부"·"가능") / 점수·건수.',
  '이 값들은 코드가 조립하거나 근거로 제출된 값이라 표현을 다듬는 대상이 아니다. 한 글자도 바꾸지 마라.',
  '',
  '[손댈 게 없으면 그대로 두라]',
  '이미 자연스러운 문장을 굳이 바꾸면 의미가 흐려진다. 변경률이 낮은 것은 실패가 아니다.',
].join('\n');

export type CallName =
  | 'call1'
  | 'call2'
  | 'call3'
  | 'call4'
  | 'call5'
  | 'checker'
  | 'studioCopy'
  | 'detailCopy'
  | 'copyHumanize'
  | 'inputTranslate'
  | 'reportHumanize';

/**
 * 콜별 안정 grounding(system 프리픽스) 조립 — 같은 카테고리·같은 콜이면 같은 문자열(캐시 히트 조건).
 * 가변 데이터(고객 문장 등)는 여기 넣지 말 것 — messages 페이로드로.
 * deckMode는 콜⑤ 전용(모드별 골격 2종 — 각 모드 안에서는 여전히 캐시 안정, 스펙 §10.5).
 */
/**
 * 콜⑦의 **연출 축**. 카피 규칙(JP_NATURALNESS_RUBRIC)과 섞지 않고 따로 세운다 —
 * 다루는 대상이 다르기 때문이다. 이쪽 산출물은 일본어 문장이 아니라 **영문 촬영 브리프**이고,
 * 그 문자열이 그대로 이미지 모델의 프롬프트로 들어간다.
 *
 * 왜 필요한가: 여태 이 콜의 grounding 은 전부 일본어 카피 규칙이었다. 연출에 관한 줄이 하나도 없어
 * 모델이 `sceneDescription` 에 "a bathroom counter with soft light" 같은 무성의한 문구를 냈고,
 * 상세페이지 사진이 통째로 밋밋해지는 원인이 그것이었다.
 */
const DETAIL_ART_DIRECTION = `[배경컷 연출 지시 — 영문 슬롯 전용]
backgroundVisual · sceneDescription · storyVisual · textureDescription · swatchDescription · lookDescription 은 카피가 아니다. **사진가에게 건네는 촬영 브리프**다. 일본어가 아니라 영어로, 형용사가 아니라 장면을 쓴다.

[연출 브리프 공통 규칙]
영문 25~45단어. 반드시 담을 것 —
① 피사체와 그 상태 ② 장소를 말해주는 소품 1~2개 ③ 바닥·표면의 재질
④ 광원 방향(어디서 들어와 어디에 그림자를 만드는가) ⑤ 잡힌 순간(떨어지는·번지는·끊어지는·바람에 날리는)
⑥ 카메라 거리와 심도.

[좋은 컷의 조건]
- 순간이 하나 잡혀 있다. 정지한 진열이 아니라 무슨 일이 **일어나는 중**이다.
- 광원 방향이 하나로 읽히고, 그림자에 형태가 있다.
- 소품 한둘이 "여기가 어디인지"를 말한다.
- 심도가 있다. 전부 또렷하면 카탈로그 사진이 된다.

[하지 말 것]
- 흰 배경에 제품만 떠 있는 컷. 평평하고 고른 카탈로그 조명.
- 얼굴(브랜드가 모델컷을 제공한 블록 제외). 손·팔·어깨·머리카락은 오히려 권장한다.
- 이미지 안의 글자·로고·배지 — 문자는 전부 코드가 벡터로 그린다.
- 업로드된 것과 다른 화장품 용기. 한 상세페이지에는 제품이 하나만 등장한다.

[카테고리 연출 문법]
카테고리별 연출 문법이 주어지면 그것을 **겨냥해 구체화**한다. 문법을 그대로 베끼지 말고, 이 제품·이 브랜드의 장면으로 옮겨 쓴다.

[예외 — 도해]
diagramDescription 은 사진이 아니라 평면 벡터 도해다. 조명·그림자·심도를 쓰지 마라. 두 상태가 무엇이 어떻게 다른지, 어떤 층·요소로 그릴지만 쓴다.`;

export function buildStableGrounding(
  call: CallName,
  category: Category,
  productClass: ProductClass,
  deckMode: 'brand' | 'brandProduct' = 'brandProduct',
): string {
  const parts: string[] = [];
  switch (call) {
    case 'call1':
      parts.push(
        '너는 한국 뷰티 브랜드의 상세페이지가 일본 시장 관례를 충족하는지 채점하는 진단 엔진이다. 항목별 0/1/2 판정만 하라 — 합산·가중은 코드가 한다.',
        rubricSection(category),
        aggregateSection(category),
        lexiconSection(15),
      );
      break;
    case 'call2':
      parts.push(
        '너는 일본 薬機法·景表法 관점에서 화장품 카피를 문장 단위로 감사하는 1차 스크리닝 엔진이다. 법적 확정 판정이 아니라 문장 재설계 관점의 스크리닝이다. 대체표현은 소구력을 유지하되 규정 안에서 재설계하라(번역 금지).',
        regulatorySection(productClass),
      );
      break;
    case 'call3':
      parts.push(
        '너는 일본 뷰티 소비자 관점의 페르소나·구매여정·USP 재설계 전문가다. 한국식 소구를 일본 고객이 어떻게 읽는지 진단하고 구매 이유를 재정의하라. 번역이 아니라 정보 구조 재설계다.',
        `[구매여정 원칙] 인지(인스타/틱톡) → 탐색(口コミ·랭킹·@cosme/LIPS 확인) → 구매(상세 근거 확인). 리뷰 서사는 "이 카테고리에서 자주 관찰되는 우려 유형"으로만 서술(특정 리뷰 인용·창작 절대 금지).`,
        // 이 콜이 언어 표류의 진원지다 — 공통 계약 위에 필드 단위로 한 번 더 못박는다
        [
          '[이 콜의 필드별 언어 — 공통 계약보다 우선]',
          '한국어로 쓴다: persona.ageRange · persona.buyingMotive · persona.priceSensitivity · journey.stages · journey.finalConfidencePoint · objections[].why · uspTable 3필드 전부(krAppeal·jpReading·redefinedUsp) · reviewNarrative 3필드 전부.',
          '일본어로 쓴다: objections[].question — 일본 고객이 머릿속에 떠올리는 의문의 원문이라 일본어여야 한다.',
          '일본어 어휘를 값으로 쓴다: persona.name(일본인 이름) · persona.skinConcerns · persona.checkBehaviors · persona.trustTriggers — 일본 고객이 실제로 쓰는 고민어·확인행동·신뢰 신호이므로 관례어 그대로.',
          '특히 uspTable.jpReading 은 "일본 고객에게 이렇게 읽힌다"를 **한국어로 설명**하는 칸이지 일본어를 적는 칸이 아니다. redefinedUsp 도 마찬가지로 한국어 설명이다.',
        ].join('\n'),
        aggregateSection(category),
        lexiconSection(15),
      );
      break;
    case 'call4':
      parts.push(
        '너는 저점 항목과 약기법 위반 문장을 일본향으로 재설계하는 카피 재설계 전문가다. After(JP)는 반드시 한국어 역문(직역이 아니라 "일본 고객에게 전하는 의미")을 병기하라. 코퍼스·렉시콘 근거 표현만 사용하라.',
        aggregateSection(category),
        lexiconSection(20),
        regulatorySection(productClass),
      );
      break;
    case 'call5':
      // 코퍼스·렉시콘·규정을 주입하지 않는다: 이 콜은 일본어 카피를 판정하지 않고,
      // 근거는 이미 blocksJson에 구워져 페이로드로 온다. 캐시 프리픽스를 낭비하지 말 것(스펙 §10.5).
      parts.push(
        '너는 한국 뷰티 브랜드 담당자가 상사에게 올릴 품의 슬라이드의 카피를 쓴다. 독자는 일본 시장을 모르는 결재자다.',
        '[품의 카피 원칙]\n- 결론부터. 표제는 사실을 말하고 형용사로 부풀리지 않는다.\n- 담당자가 "왜 이 돈을 썼는지"를 결재자에게 설명하는 자리다. 홍보가 아니라 보고다.\n- 존댓말 없이 단정형으로 짧게. 미사여구·완충어 금지.\n- 일본어를 모르는 결재자가 읽는다. 일본어 용어를 쓸 때는 한국어로 뜻을 밝힌다.',
        deckMode === 'brand'
          ? `[슬라이드 4장 골격 — 브랜드 진단. 고정. 장을 늘리거나 줄이지 말 것. 점수·감사 결과는 존재하지 않는다 — 언급 금지]\n${SLIDE_SKELETON_BRAND}`
          : `[슬라이드 7장 골격 — 고정. 장을 늘리거나 줄이지 말 것]\n${SLIDE_SKELETON_FULL}`,
        '[숫자 금지 — 가장 중요]\n점수·건수·표본 수·가격 등 어떤 수치도 쓰지 마라. 모든 수치는 코드가 리포트 원본에서 직접 인용해 넣는다. 페이로드의 수치는 카피의 논조를 잡기 위한 참고일 뿐이며, 카피에 옮겨 적으면 안 된다. 수치를 가리켜야 할 때는 "종합점수"·"불가 판정 문장"처럼 이름으로만 부르고 값은 비워 둔다.',
      );
      break;
    case 'checker':
      parts.push(
        '너는 일본 薬機法 관점의 위반 표현 후보 검출기다. 위반·조건부 후보만 짧게 짚어라(대체표현·심층 해설은 제공하지 않는다 — 상위 서비스의 영역).',
        regulatorySection(productClass),
      );
      break;
    case 'studioCopy':
      // 콜⑥ — ② 썸네일 카피 재설계(08 §4.7). 콜②(문장 감사)를 콜로 재사용하지 않고
      // 같은 약기법 grounding을 재주입해 카피 재설계와 1차 스크리닝을 한 콜에서 수행한다.
      parts.push(
        '너는 한국 썸네일 이미지를 일본향으로 재설계하는 카피·구도 설계 엔진이다. 입력 이미지를 분석해 KR 요소를 3분류(유지·정제/재설계/제거)하고, 지정된 스타일의 텍스트 슬롯을 채워라.',
        '[카피 재설계 원칙 — 번역 금지]\n- 한국 카피의 의도를 추출해 일본 고민 어휘·관례어로 재설계한다. 예: "쿨톤 치트키" → 의도(하얗게 들뜨지 않는 톤업) → 「白浮きしない、透け感トーンアップUV」.\n- 톤업·투명감 등 외관 변화 카피에는 각주 「※メーキャップ効果による」를 기본으로 단다(일본 관례·약기법 대응).\n- 성분 데이터가 입력에 없으면 성분명을 절대 지어내지 않는다 — 제형 비주얼(물방울·크림 스미어 등)로 대체한다.\n- 아래 약기법 판정 프레임에서 "불가"에 해당하는 표현은 카피로 산출하지 않는다 — 규정 안에서 소구력을 유지하는 표현으로 재설계한다.\n- 실적 배지·가격·할인 슬롯은 채우지 않는다 — 근거 게이트와 조립은 코드가 소유한다.',
        regulatorySection(productClass),
        lexiconSection(20),
      );
      break;
    case 'detailCopy':
      // 콜⑦ — ② 상세페이지 블록 카피 재설계. 썸네일(콜⑥)과 달리 **한 콜에서 여러 블록의 슬롯**을 채운다.
      // 문자는 전부 코드가 벡터로 렌더하므로, 여기서는 "무엇을 쓸지"만 결정하고 배치·서체는 관여하지 않는다.
      parts.push(
        '너는 한국 상세페이지를 일본향 상세페이지로 재설계하는 카피 설계 엔진이다. 주어진 블록 시퀀스의 각 블록에 들어갈 일본어 카피를 채워라. 블록 순서는 이미 코드가 결정했으므로 바꾸지 않는다.',
        '[상세페이지 서사 원칙 — 일본 관례]\n- 일본 상세는 "주장"이 아니라 "근거"를 쌓는다. 문제 제기 → 공감 → 원인 → 기전 → 근거 → 행동유도 순으로 합의를 만든다.\n- 효능을 외치기 전에 문제·원인을 먼저 합의시킨다. 한국식 "즉효·최고" 소구는 일본에서 신뢰를 깎는다.\n- 침투·작용 범위는 스스로 한정한다(「角質層まで」). 「肌の奥深く」류 무한정 표현은 쓰지 않는다.\n- 톤업·투명감 등 외관 변화 카피에는 「※メーキャップ効果による」 각주를 전제로 쓴다.',
        '[번역 금지 — 재설계]\n한국 카피를 직역하지 않는다. 의도를 추출해 일본 고민 어휘·관례어로 다시 쓴다. 예: "속건조 잡아주는" → 의도(수분 유지가 안 되는 고민) → 「うるおいが続かない肌へ、角質層までうるおいを届ける」.',
        JP_NATURALNESS_RUBRIC,
        DETAIL_ART_DIRECTION,
        '[코드가 소유하는 값 — 산출 금지]\n가격·할인·증정·랭킹·수상·누적 판매·시험 결과·수치 그래프·리뷰 원문·전성분·区分. 이 값들은 사용자 입력만 코드가 자단위로 조립한다. 네가 값을 만들면 폐기되고 근거 없는 표기가 되므로 아예 산출하지 마라.\n성분 데이터가 입력에 없으면 성분명을 지어내지 않는다 — 그 블록은 코드가 이미 시퀀스에서 뺐다.',
        regulatorySection(productClass),
        lexiconSection(20),
      );
      break;
    case 'copyHumanize':
      // 콜⑨ — 콜⑦이 낸 일본어 카피의 **문체만** 다듬는다. 카피를 다시 설계하지 않는다.
      // 이 콜이 실패해도 잡은 죽지 않는다(원문 유지) — 문체는 법적 게이트가 아니다.
      parts.push(
        '너는 일본 화장품 상세페이지 카피의 일본어 문체를 다듬는 윤문가다. 이미 재설계가 끝난 카피를 받는다 — 네 일은 **내용이 아니라 문체**다.',
        '[가장 중요 — 의미를 바꾸지 않는다]\n- 없던 주장·효능·수치를 넣지 않는다. 있던 정보를 빼지 않는다.\n- 숫자·단위·날짜·퍼센트는 한 자리도 바꾸지 않는다.\n- ※1 같은 각주 마커는 **개수와 번호를 그대로** 둔다. 하나라도 사라지면 조건 한정 표기가 증발해 景表法상 打消し表示 누락이 된다.\n- 제품명·성분명·기관명·시험명은 그대로 둔다.\n- 슬롯 형식(줄바꿈 구분, `제목|본문` 세로줄)을 그대로 유지한다. 항목 수를 늘리거나 줄이지 않는다.',
        JP_NATURALNESS_RUBRIC,
        '[손대지 않아도 되면 그대로 두라]\n이미 자연스러운 문장을 굳이 바꾸면 의미가 흐려진다. 고칠 게 없으면 원문을 그대로 돌려라 — 변경률이 낮은 것은 실패가 아니다.',
        regulatorySection(productClass),
        lexiconSection(20),
      );
      break;
    case 'inputTranslate':
      // 콜⑧ — ② 상세페이지 **입력 필드**의 KR→JA 표기 변환.
      // 콜⑦(재설계)과 성격이 정반대다. 여기 오는 값은 사용자가 근거로 제출한 사실이고,
      // 렌더러가 자단위로 그대로 그린다. 의역·보강·생략은 전부 표시 사실의 변조가 된다.
      parts.push(
        '너는 한국 뷰티 브랜드가 입력한 상품 사실 정보를 일본 상세페이지 표기로 옮기는 표기 변환 엔진이다. 각 필드를 일본 화장품 상세페이지에서 실제로 쓰는 표기로 바꿔라.',
        '[이 콜은 재설계가 아니다 — 가장 중요]\n- 카피를 다시 쓰지 않는다. 소구력을 높이지 않는다. 문장을 합치거나 나누지 않는다.\n- 원문에 없는 정보를 더하지 않는다. 원문에 있는 정보를 빼지 않는다.\n- **숫자·단위·기호는 값을 바꾸지 않는다.** 날짜·기간의 표기 형식(2026.04.15 → 2026年4月15日)은 바꿔도 되지만 값 자체는 그대로다. 가격·수량·농도·SPF·인원은 한 자리도 달라지면 안 된다.\n- 한글·이모지·간체자를 결과에 남기지 마라. 렌더 폰트가 그리지 못해 그 블록이 통째로 사라진다.',
        '[필드 성격별 취급]\n- regulated(区分·全成分): 일본 화장품 표시 관례의 정식 표기만 쓴다. 성분명은 일본 화장품 성분 표시명칭을 따르고, 확신이 없으면 원문을 음차하지 말고 가장 일반적인 표기를 쓴다 — 사람이 확인하는 단계가 뒤에 있다.\n- numeric: 수치를 그대로 두고 단위·조사만 일본어로 옮긴다(누적 163,991개 → 累計163,991個).\n- free: 일본 상세페이지에서 실제 쓰는 관례어로. 직역투(〜てください의 남발, 한국식 존대 어순)를 피한다.\n- artDirection: **일본어가 아니라 영어로** 옮긴다. 이미지 생성 프롬프트에 들어가며 나머지가 전부 영어라 언어를 섞으면 지시가 흐려진다. 문자·로고를 그리라는 지시로 읽힐 표현은 쓰지 않는다.',
        regulatorySection(productClass),
        lexiconSection(20),
      );
      break;
    case 'reportHumanize':
      // 콜⑩ — 발행 직전 리포트의 **한국어 서술 문체만** 다듬는다. 진단을 다시 하지 않는다.
      // 콜⑨ copyHumanize(일본어)의 한국어 대응물이다. 같은 안전 계약을 진다 —
      // validate 에 문체 규칙을 넣지 않고, 사후 검사를 통과한 항목만 채택한다.
      // 코퍼스·렉시콘·규정을 주입하지 않는다: 판정하는 콜이 아니라 문체만 보는 콜이고,
      // 일본어를 대량 주입하면 윤문 결과가 일본어로 끌려간다(이 작업이 고치려는 바로 그 문제).
      parts.push(
        '너는 일본 진출 진단 리포트의 한국어 문체를 다듬는 윤문가다. 진단은 이미 끝났다 — 네 일은 **내용이 아니라 문체**다.',
        '[가장 중요 — 의미를 바꾸지 않는다]\n- 없던 주장·판정·수치를 넣지 않는다. 있던 정보를 빼지 않는다.\n- 숫자·단위·날짜·퍼센트·점수는 한 자리도 바꾸지 않는다.\n- 각주 [n]과 조항 id는 개수와 번호를 그대로 둔다. 하나라도 사라지면 규정 근거가 끊어진다.\n- 「」 안의 일본어 인용은 한 글자도 바꾸지 않는다 — 코퍼스 실측값이거나 고객이 실제로 떠올리는 의문 원문이다.\n- 판정어("불가"·"조건부"·"가능")와 항목 ID(A1~E4)·문장 ID(K1~)는 그대로 둔다.\n- 줄 수와 항목 수를 늘리거나 줄이지 않는다.',
        '[읽는 사람]\n일본 시장을 모르는 한국 브랜드 담당자와 그 결재자다. 결론이 먼저 오고, 문장이 짧고, 일본어를 모르는 사람이 읽어도 뜻이 통해야 한다.',
        KR_NATURALNESS_RUBRIC,
      );
      break;
  }
  if (REPORT_CALLS.has(call)) parts.push(LANGUAGE_CONTRACT);
  parts.push(EVIDENCE_GUARDRAIL);
  return parts.join('\n\n');
}

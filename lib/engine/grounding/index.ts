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

export type CallName = 'call1' | 'call2' | 'call3' | 'call4' | 'call5' | 'checker' | 'studioCopy';

/**
 * 콜별 안정 grounding(system 프리픽스) 조립 — 같은 카테고리·같은 콜이면 같은 문자열(캐시 히트 조건).
 * 가변 데이터(고객 문장 등)는 여기 넣지 말 것 — messages 페이로드로.
 * deckMode는 콜⑤ 전용(모드별 골격 2종 — 각 모드 안에서는 여전히 캐시 안정, 스펙 §10.5).
 */
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
  }
  parts.push(EVIDENCE_GUARDRAIL);
  return parts.join('\n\n');
}

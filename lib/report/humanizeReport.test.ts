/**
 * 콜⑩ reportHumanize 단위 테스트 — 사후 검사 7종과 수집·되쓰기 왕복.
 * 러너: node:test. 실행: npm run test.
 *
 * 이 콜의 존재 이유는 "가독성"이지만, 지켜야 할 선은 **의미 보존**이다. 그래서 테스트의 무게는
 * "잘 다듬었는가"가 아니라 **"의미를 바꾼 결과를 확실히 반려하는가"** 에 실려 있다.
 * 반려된 항목은 원문이 남으므로, 오탐(과반려)은 품질 손해이고 미탐(오채택)은 리포트가 거짓말을
 * 하는 사고다 — 검사는 미탐 쪽으로 기울여 설계했다.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkTargets,
  collectKoreanNarrative,
  mergeChunkResults,
  runReportHumanize,
  verifyHumanizedKo,
  type HumanizeResponse,
  type KoSlotRef,
} from './humanizeReport';
import { runReportPipeline } from '../engine/pipeline';
import type { BlocksJson, BrandOnlyInput, BrandProductInput } from '../engine/types';

const BEFORE = '근거 라벨이 없어 일본 고객은 이 주장을 검증할 수 없다고 판단하게 됩니다.';

describe('verifyHumanizedKo — 채택', () => {
  it('문체만 다듬은 결과는 채택한다', () => {
    const after = '근거 라벨이 없으면 일본 고객은 이 주장을 검증할 길이 없다고 본다.';
    assert.deepEqual(verifyHumanizedKo(BEFORE, after), { ok: true });
  });

  it('「」 인용을 그대로 둔 채 주변만 다듬으면 채택한다', () => {
    const before = '「効能評価試験済み」 같은 표기가 없어서 근거가 부족하다고 읽히게 됩니다.';
    const after = '「効能評価試験済み」 같은 표기가 없어 근거가 부족하다고 읽힌다.';
    assert.deepEqual(verifyHumanizedKo(before, after), { ok: true });
  });
});

describe('verifyHumanizedKo — 반려', () => {
  const cases: { name: string; before: string; after: string; reason: RegExp }[] = [
    {
      name: '빈 결과',
      before: BEFORE,
      after: '   ',
      reason: /비어 있습니다/,
    },
    {
      name: '줄 수 변화 — 렌더 트리가 달라진다',
      before: '첫 줄입니다.\n둘째 줄입니다.',
      after: '첫 줄입니다. 둘째 줄입니다.',
      reason: /줄 수/,
    },
    {
      name: '각주 마커 유실 — 규정 근거 링크가 끊어진다',
      before: '이 표현은 효능 단정에 해당합니다[JP-03].',
      after: '이 표현은 효능을 단정한다.',
      reason: /각주·조항 마커/,
    },
    {
      name: '「」 인용 변조 — 코퍼스 실측값이다',
      before: '「効能評価試験済み」 표기가 필요합니다.',
      after: '「効能評価試験」 표기가 필요하다.',
      reason: /「」 인용/,
    },
    {
      name: '숫자 변조 — 리포트가 거짓말을 한다',
      before: '불가 8건, 조건부 3건이 관찰되었습니다.',
      after: '불가 9건, 조건부 3건이 관찰됐다.',
      reason: /숫자/,
    },
    {
      name: '일본어 유입 — 고치려던 문제를 되살린다',
      before: '근거 라벨이 없어 신뢰를 얻기 어렵다고 판단됩니다.',
      after: '根拠ラベルがないため信頼を得にくいと判断される。',
      reason: /한국어 서술이 아닙니다/,
    },
    {
      name: '과윤문(축약) — 문체가 아니라 내용을 바꿨다',
      before: BEFORE,
      after: '근거가 없다.',
      reason: /분량/,
    },
    {
      name: '과윤문(팽창)',
      before: BEFORE,
      after: `${BEFORE} 그리고 이 부분은 원문에 없던 설명을 길게 덧붙인 문장이며 계속 이어집니다.`,
      reason: /분량/,
    },
    {
      name: '판정어 변조 — 판정을 바꾸는 윤문은 있을 수 없다',
      before: '이 문장은 불가 판정입니다. 근거 라벨이 없기 때문입니다.',
      after: '이 문장은 조건부 판정이다. 근거 라벨이 없기 때문이다.',
      reason: /판정어/,
    },
  ];

  for (const c of cases) {
    it(`반려: ${c.name}`, () => {
      const res = verifyHumanizedKo(c.before, c.after);
      assert.equal(res.ok, false);
      if (!res.ok) assert.match(res.reason, c.reason);
    });
  }

  it('각주가 사라지면 "숫자"가 아니라 "각주"를 사유로 준다 — 사용자가 점수를 의심하지 않도록', () => {
    const before = '불가 8건이 관찰되었습니다[JP-03].';
    const after = '불가 8건이 관찰됐다.';
    const res = verifyHumanizedKo(before, after);
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.reason, /각주/);
  });
});

// ── 수집·되쓰기 왕복 ─────────────────────────────────────────────────────────

const BRAND_PRODUCT: BrandProductInput = {
  mode: 'brandProduct',
  brandName: '테스트브랜드',
  positioning: { tags: [], note: '' },
  category: 'skincare',
  productName: '시카 앰플',
  productClass: '화장품',
  sourceType: 'text',
  sourceText:
    '피부 진정에 탁월한 시카 앰플입니다. 즉각적인 효과를 느낄 수 있습니다. 민감한 피부도 안심하고 사용하세요. '.repeat(
      4,
    ),
};

const BRAND_ONLY: BrandOnlyInput = {
  mode: 'brand',
  brandName: '테스트브랜드',
  positioning: { tags: [], note: '' },
  category: 'skincare',
};

/** 목 모드 파이프라인으로 실제 조립된 blocksJson 을 얻는다(API 키 불필요) */
async function mockBlocks(input: BrandProductInput | BrandOnlyInput): Promise<BlocksJson> {
  process.env.LLM_MODE = 'mock';
  const result = await runReportPipeline(input);
  return result.blocksJson;
}

describe('collectKoreanNarrative', () => {
  it('풀 진단 — LLM이 쓴 한국어 서술만 모은다', async () => {
    const blocks = await mockBlocks(BRAND_PRODUCT);
    const paths = collectKoreanNarrative(blocks).map((t) => t.path);

    assert.ok(paths.length > 0, '대상이 하나도 없다');
    // 모아야 하는 것
    assert.ok(
      paths.some((p) => p.startsWith('block2.uspTable')),
      'USP 재정의 미수집',
    );
    assert.ok(
      paths.some((p) => p.startsWith('block6.narrative')),
      '정보 공백 미수집',
    );

    // 모으면 안 되는 것 — 템플릿 문구·원문 인용·일본어 산출물
    for (const forbidden of ['block0', 'block9', 'afterJa', 'originalText', 'evidenceQuote', 'corpusRef']) {
      assert.equal(
        paths.some((p) => p.includes(forbidden)),
        false,
        `${forbidden} 은 윤문 대상이 아니다`,
      );
    }
    // 일본어가 값 자체인 필드
    for (const forbidden of ['persona.name', 'skinConcerns', 'trustTriggers', 'objections[0].question']) {
      assert.equal(
        paths.some((p) => p.includes(forbidden)),
        false,
        `${forbidden} 은 윤문 대상이 아니다`,
      );
    }
  });

  it('브랜드 진단 — 잠긴 블록(3·7·8)을 건너뛰고도 터지지 않는다', async () => {
    const blocks = await mockBlocks(BRAND_ONLY);
    const paths = collectKoreanNarrative(blocks).map((t) => t.path);
    assert.ok(paths.length > 0);
    for (const locked of ['block3', 'block7', 'block8']) {
      assert.equal(
        paths.some((p) => p.startsWith(locked)),
        false,
        `${locked} 은 null 이라 대상이 아니다`,
      );
    }
  });

  it('수집한 모든 경로가 실제로 존재하는 값을 가리킨다', async () => {
    const blocks = await mockBlocks(BRAND_PRODUCT);
    for (const t of collectKoreanNarrative(blocks)) {
      assert.equal(typeof t.text, 'string');
      assert.ok(t.text.trim().length > 0, `${t.path} 가 빈 값`);
    }
  });
});

describe('판정어 검사 — 실측 오탐 회귀 방어', () => {
  // 아래 두 문장은 실제 골든 픽스처 산출물이다. 「가능」을 통째로 세던 시절 둘 다 반려됐는데,
  // 여기서 「가능」은 약기법 판정이 아니라 일상어다. 비차단 게이트에서 오탐은 곧 무시로 이어진다.
  it('"사용 가능 여부" 같은 일상어 「가능」은 반려하지 않는다', () => {
    const before =
      "구매 — 상세페이지로 돌아와 '왜 자극이 없는지'의 근거를 찾는다. 시술 직후 사용 가능 여부에 대한 명확한 안내를 확인한 뒤 결제한다.";
    const after =
      "구매 — 상세페이지로 돌아와 '왜 자극이 없는지'의 근거를 찾는다. 시술 직후 써도 되는지에 대한 안내를 확인한 뒤 결제한다.";
    assert.deepEqual(verifyHumanizedKo(before, after), { ok: true });
  });

  it('"불가능"의 「불가」도 판정어로 오인하지 않는다', () => {
    const before = '근거를 확인할 수 없어 검증이 불가능한 상태로 남습니다.';
    const after = '근거를 확인할 수 없어 검증이 불가능하다.';
    assert.deepEqual(verifyHumanizedKo(before, after), { ok: true });
  });

  it('진짜 판정어 「불가」가 사라지면 여전히 반려한다', () => {
    const before = '이 문장은 불가 판정입니다. 근거 라벨이 없기 때문입니다.';
    const after = '이 문장은 조건부 판정이다. 근거 라벨이 없기 때문이다.';
    const res = verifyHumanizedKo(before, after);
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.reason, /판정어/);
  });
});

describe('chunkTargets — 콜⑩ 청크 분할', () => {
  /** path 만 다른 더미 슬롯 n개 */
  const slots = (n: number): KoSlotRef[] =>
    Array.from({ length: n }, (_, i) => ({ path: `block1.slot[${i}]`, text: `서술 ${i} 입니다.` }));

  it('슬롯이 적으면 나누지 않는다 — 콜 수만 늘고 지연은 안 준다', () => {
    for (const n of [1, 7, 15]) {
      assert.equal(chunkTargets(slots(n)).length, 1, `${n}개를 쪼갰다`);
    }
  });

  it('슬롯이 많아지면 상한(4)까지만 나눈다', () => {
    assert.equal(chunkTargets(slots(16)).length, 2);
    assert.equal(chunkTargets(slots(25)).length, 3);
    assert.equal(chunkTargets(slots(120)).length, 4, '상한을 넘겨 쪼갰다');
  });

  it('실측 크기(풀 진단 57슬롯)에서 청크가 15개 이하로 떨어진다 — 예산이 여기에 달려 있다', () => {
    const chunks = chunkTargets(slots(57));
    assert.equal(chunks.length, 4);
    assert.ok(Math.max(...chunks.map((c) => c.length)) <= 15, '가장 두꺼운 청크가 지연을 정한다');
  });

  it('한 슬롯도 잃거나 겹치지 않고, 수집 순서를 유지한다', () => {
    const targets = slots(25);
    const flat = chunkTargets(targets).flat();
    assert.deepEqual(
      flat.map((t) => t.path),
      targets.map((t) => t.path),
      '분할이 순서를 바꾸거나 항목을 잃었다',
    );
  });

  it('청크 크기가 고르게 나뉜다 — 한 청크가 몰리면 지연 이득이 사라진다', () => {
    const sizes = chunkTargets(slots(25)).map((c) => c.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `불균등 분할: ${sizes.join(',')}`);
  });
});

describe('runReportHumanize — 잡을 죽이지 않는다', () => {
  it('목 모드는 원문을 그대로 두고 사유를 남긴다(발행은 그대로 진행)', async () => {
    const blocks = await mockBlocks(BRAND_PRODUCT);
    const result = await runReportHumanize({ blocksJson: blocks });

    assert.deepEqual(result.verdicts, [], '목 모드에서 픽스처 문장을 흔들었다');
    assert.ok(result.skippedReason, '원문을 그대로 쓴 사유가 없다');
    assert.deepEqual(result.blocksJson, blocks, '목 모드인데 본문이 바뀌었다');
  });

  it('예산이 0이면 네트워크를 타지 않고 원문을 돌려준다 — 예산 소진이 리포트를 죽이지 않는다', async () => {
    const blocks = await mockBlocks(BRAND_PRODUCT);

    // 목 모드는 예산 검사 앞에서 반환하므로 실 모드로 태운다. 다만 예산이 0이라
    // `runStructuredCall` 이 시도 전에 멈추므로 **API 키가 쓰이지 않는다**(네트워크 왕복 없음).
    const prevMode = process.env.LLM_MODE;
    const prevKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.LLM_MODE;
    process.env.ANTHROPIC_API_KEY = 'test-budget-guard-no-network';
    try {
      const result = await runReportHumanize({ blocksJson: blocks, timeoutMs: 0 });

      assert.ok(result.skippedReason, '예산 소진인데 사유가 없다');
      assert.match(result.skippedReason, /예산 소진/);
      assert.deepEqual(result.verdicts, []);
      assert.deepEqual(result.blocksJson, blocks, '본문이 바뀌었다');
    } finally {
      if (prevMode === undefined) delete process.env.LLM_MODE;
      else process.env.LLM_MODE = prevMode;
      if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prevKey;
    }
  });

  it('마감이 지난 채로 파이프라인이 끝나도 산출물을 돌려준다 — 발행이 막히지 않는다', async () => {
    // 예산 초과의 정답은 "잡을 죽인다"가 아니라 "문체를 포기하고 발행한다"다.
    // 이게 무너지면 리포트가 통째로 발행되지 않던 상태로 되돌아간다(P0 2026-08-20).
    process.env.LLM_MODE = 'mock';
    const result = await runReportPipeline(BRAND_PRODUCT, { deadlineAt: Date.now() - 1 });

    assert.ok(result.blocksJson, '산출물이 없다');
    assert.ok(result.humanizeSkipped, '예산 초과인데 사유가 없다');
    assert.match(result.humanizeSkipped, /남은 생성 시간이 부족/);
    assert.deepEqual(result.humanizeVerdicts, []);
  });
});

describe('mergeChunkResults — 청크 하나가 실패해도 나머지는 살린다', () => {
  const ok = (...paths: string[]): PromiseSettledResult<HumanizeResponse> => ({
    status: 'fulfilled',
    value: { items: paths.map((p) => ({ path: p, ko: `${p} 윤문본` })) },
  });
  const fail = (reason: string): PromiseSettledResult<HumanizeResponse> => ({
    status: 'rejected',
    reason: new Error(reason),
  });

  it('성공 청크의 채택분을 실패 청크 때문에 버리지 않는다', () => {
    const { byPath, failures } = mergeChunkResults([ok('a', 'b'), fail('Request timed out.'), ok('e')]);

    assert.deepEqual([...byPath.keys()].sort(), ['a', 'b', 'e']);
    assert.deepEqual(failures, ['Request timed out.']);
  });

  it('전량 실패면 채택분이 없고 사유만 남는다', () => {
    const { byPath, failures } = mergeChunkResults([fail('예산 소진'), fail('예산 소진')]);

    assert.equal(byPath.size, 0);
    assert.equal(failures.length, 2);
  });

  it('전량 성공이면 사유가 없다', () => {
    const { byPath, failures } = mergeChunkResults([ok('a'), ok('b')]);

    assert.equal(byPath.size, 2);
    assert.deepEqual(failures, []);
  });

  it('Error 가 아닌 reason 도 문자열로 남긴다 — 사유가 [object Object] 로 사라지지 않게', () => {
    const { failures } = mergeChunkResults([{ status: 'rejected', reason: '문자열 사유' }]);

    assert.deepEqual(failures, ['문자열 사유']);
  });
});

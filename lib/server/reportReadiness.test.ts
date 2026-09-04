/**
 * ① 리포트 준비 점검 단위 테스트 — 차단 판정의 경계.
 * 러너: node:test. 실행: npm run test.
 *
 * 점검 자체는 env·Supabase에 붙으므로 여기서는 **차단 판정 규칙**만 고정한다.
 * 이 규칙이 흔들리면 둘 중 하나가 난다 — warn 으로 제출을 막아 dev 가 멈추거나,
 * blocked 를 흘려보내 LLM 4~5콜을 태운 뒤 저장 단계에서 죽는다.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { checkReportReadiness, reportBlockingReason, type ReportReadiness } from './reportReadiness';

const check = (
  over: Partial<ReportReadiness['checks'][number]> & Pick<ReportReadiness['checks'][number], 'key'>,
): ReportReadiness['checks'][number] => ({
  label: '테스트',
  ok: true,
  level: 'blocked',
  detail: '',
  fix: null,
  ...over,
});

describe('reportBlockingReason', () => {
  it('전부 정상이면 null', () => {
    const r: ReportReadiness = { ready: true, checks: [check({ key: 'store' }), check({ key: 'llm' })] };
    assert.equal(reportBlockingReason(r), null);
  });

  it('warn 은 막지 않는다 — 목 모드 dev 가 멈추면 안 된다', () => {
    const r: ReportReadiness = {
      ready: true,
      checks: [check({ key: 'llm', ok: false, level: 'warn', detail: '목 모드(dev)' })],
    };
    assert.equal(reportBlockingReason(r), null);
  });

  it('blocked 만 골라 라벨과 함께 합친다', () => {
    const r: ReportReadiness = {
      ready: false,
      checks: [
        check({ key: 'store', ok: false, level: 'blocked', label: '저장 백엔드', detail: '파일 저장 모드' }),
        check({ key: 'schema', ok: false, level: 'warn', label: '리포트 스키마', detail: '무시돼야 함' }),
        check({ key: 'llm', ok: false, level: 'blocked', label: '진단 엔진', detail: '목 모드' }),
      ],
    };
    assert.equal(reportBlockingReason(r), '저장 백엔드: 파일 저장 모드 / 진단 엔진: 목 모드');
  });
});

describe('checkReportReadiness — 로컬 dev', () => {
  it('파일 저장 + 목 모드는 통과한다(경고만)', async () => {
    process.env.LLM_MODE = 'mock';
    const r = await checkReportReadiness(true);
    assert.equal(r.ready, true, JSON.stringify(r.checks, null, 2));
    assert.equal(reportBlockingReason(r), null);
    assert.equal(r.checks.length, 3);
  });

  it('스키마 점검은 컬럼 계약을 문서화한다 — scripts/db-push.mjs 의 EXPECTED 와 같은 계약', async () => {
    const r = await checkReportReadiness(true);
    const schema = r.checks.find((c) => c.key === 'schema');
    assert.ok(schema, 'schema 점검이 빠졌다');
    // 로컬(Supabase env 없음)에서는 "필요 없음"으로 통과해야 한다
    assert.equal(schema.ok, true);
  });
});

describe('checkReportReadiness — 점검이 진단을 막지 않는다', () => {
  it('getStore() 가 던져도 500이 아니라 blocked 항목으로 돌려준다', () => {
    // 프로덕션 + Supabase 미설정 = store.ts 가 명시적으로 throw 하는 조합.
    // `GET /api/report` 는 런북 §3의 확진 관문이라 이 상황에서 500이 되면 안 된다.
    //
    // 왜 자식 프로세스인가: `getStore()` 는 첫 호출 결과를 모듈 스코프에 메모이즈한다.
    // 같은 파일의 앞선 테스트가 이미 파일 스토어를 캐시해 두므로, 여기서 env 만 바꿔서는
    // throw 경로에 **도달할 수 없다** — 통과해도 아무것도 증명하지 못하는 테스트가 된다.
    const script = `
      process.env.NODE_ENV = 'production';
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      const { checkReportReadiness } = require(${JSON.stringify(`${__dirname}/reportReadiness.js`)});
      checkReportReadiness(true)
        .then((r) => { process.stdout.write(JSON.stringify(r.checks.find((c) => c.key === 'store'))); })
        .catch((e) => { process.stdout.write('THREW:' + e.message); });
    `;
    const out = execFileSync(process.execPath, ['-e', script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    assert.ok(!out.startsWith('THREW:'), `점검이 예외로 새어 나갔다: ${out}`);
    const store = JSON.parse(out);
    assert.equal(store.ok, false);
    assert.equal(store.level, 'blocked');
    assert.match(store.detail, /Supabase/, '던진 사유가 그대로 담겨야 한다');
    assert.match(store.fix ?? '', /Vercel/);
  });
});

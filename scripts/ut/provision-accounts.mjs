/**
 * AI 에이전트 UT 계정 20개 프로비저닝 — 멱등.
 *
 * 왜 필요한가: `POST /api/auth/email/login` 은 미인증 계정에 403 `{code:'unverified'}` 를 준다.
 * UT 드라이버는 UI 로 로그인하므로 20개 계정이 **가입 + 이메일 인증까지** 끝나 있어야 한다
 * (계획서 §4-2: "20행 로그인 성공 결과표를 확보하기 전에는 UT를 시작하지 않는다").
 *
 * 왜 메일함이 필요 없는가: 비-운영이거나 `AUTH_MAIL_MODE=devlink` 면 signup·resend 응답에
 * `devLink` 가 그대로 내려온다(lib/server/mailer.ts:27). 그 링크의 `?token=` 을 뽑아 verify 를 친다.
 * devLink 가 null 이면 계정을 만들 수 없으므로 그 사실을 보고하고 멈춘다.
 *
 * 실행:
 *   node scripts/ut/provision-accounts.mjs
 *   node scripts/ut/provision-accounts.mjs --base https://branch-out-to-japan.vercel.app
 *
 * 산출: `.ut/accounts-status.json` — { email, created|existed, verified, loginOk }
 * 보안: 비밀번호·토큰은 어떤 경로로도 출력하지 않는다.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ACCOUNTS_PATH = path.join(ROOT, '.ut/accounts.json');
const STATUS_PATH = path.join(ROOT, '.ut/accounts-status.json');

const DEFAULT_BASE = 'https://branch-out-to-japan.vercel.app';
const REQUEST_TIMEOUT_MS = 60_000;
const RESEND_COOLDOWN_FALLBACK_SEC = 60;

/**
 * 페르소나 브랜드명 — signup 의 `name` 으로 쓴다.
 * 정본은 `.claude/agents/persona_NN.md` 의 "이름/브랜드" 항목이다.
 */
const PERSONA_BRANDS = {
  P01: '글로우리프',
  P02: '무드바이',
  P03: '하루온',
  P04: '셀피지',
  P05: '노트원',
  P06: '코튼밤',
  P07: '베러문',
  P08: '리프레쉬랩',
  P09: '오브제스킨',
  P10: '데일리핏',
  P11: '뮤트원',
  P12: '라라뷰',
  P13: '포레스트미',
  P14: '슬로우데이',
  P15: '루미네',
  P16: '타임리스',
  P17: '데이쉴드',
  P18: '루트리',
  P19: '플레인',
  P20: '센트리',
};

/** CLAUDE.md 가 console.log 를 금지한다 — 진행 출력은 stdout 직접 쓰기. */
const log = (msg) => process.stdout.write(`${msg}\n`);

/**
 * JSON POST 한 번. 네트워크 예외도 상태 객체로 바꿔 돌려준다(호출부가 분기만 하게).
 * @param {string} url
 * @param {Record<string, unknown>} body
 * @returns {Promise<{ status: number, body: Record<string, any> }>}
 */
async function postJson(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    let parsed = {};
    try {
      parsed = await res.json();
    } catch {
      parsed = {};
    }
    return { status: res.status, body: parsed };
  } catch (err) {
    return { status: 0, body: { error: err instanceof Error ? err.message : String(err) } };
  }
}

/**
 * devLink URL 에서 인증 토큰만 뽑는다. 토큰은 절대 로그로 내보내지 않는다.
 * @param {string | null | undefined} devLink
 * @returns {string | null}
 */
function extractToken(devLink) {
  if (typeof devLink !== 'string' || devLink.length === 0) return null;
  try {
    return new URL(devLink).searchParams.get('token');
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 계정 1개를 가입·인증·로그인 확인까지 끌고 간다.
 * @param {string} base
 * @param {{ personaId: string, email: string, password: string }} account
 * @returns {Promise<{ personaId: string, email: string, state: 'created'|'existed', verified: boolean, loginOk: boolean, note: string }>}
 */
async function provisionOne(base, account) {
  const { personaId, email, password } = account;
  const name = PERSONA_BRANDS[personaId] ?? personaId;
  let state = 'existed';
  let verified = false;
  const notes = [];

  const signup = await postJson(`${base}/api/auth/email/signup`, { email, password, name });
  if (signup.status === 200) {
    state = 'created';
    const token = extractToken(signup.body.devLink);
    if (!token) {
      notes.push('signup 200 이지만 devLink 없음 — AUTH_MAIL_MODE 확인 필요');
    } else {
      const verify = await postJson(`${base}/api/auth/email/verify`, { token });
      verified = verify.status === 200;
      if (!verified) notes.push(`verify ${verify.status}: ${verify.body.error ?? ''}`.trim());
    }
  } else if (signup.status === 409) {
    notes.push('이미 가입됨');
  } else {
    notes.push(`signup ${signup.status}: ${signup.body.error ?? ''}`.trim());
  }

  let login = await postJson(`${base}/api/auth/email/login`, { email, password });

  // 미인증이면 링크를 다시 받아 인증하고 한 번만 재시도한다.
  if (login.status === 403 && login.body.code === 'unverified') {
    notes.push('403 unverified — resend 시도');
    const resend = await postJson(`${base}/api/auth/email/resend`, { email });
    if (resend.status === 429) {
      const waitSec = Number(resend.body.retryAfterSec) || RESEND_COOLDOWN_FALLBACK_SEC;
      notes.push(`resend 쿨다운 ${waitSec}초 대기`);
      await sleep(waitSec * 1000 + 500);
    }
    const retryResend = resend.status === 429 ? await postJson(`${base}/api/auth/email/resend`, { email }) : resend;
    const token = extractToken(retryResend.body.devLink);
    if (!token) {
      notes.push('resend 응답에 devLink 없음');
    } else {
      const verify = await postJson(`${base}/api/auth/email/verify`, { token });
      verified = verify.status === 200;
      if (!verified) notes.push(`재verify ${verify.status}`);
      login = await postJson(`${base}/api/auth/email/login`, { email, password });
    }
  }

  const loginOk = login.status === 200;
  if (!loginOk) notes.push(`login ${login.status}${login.body.code ? ` (${login.body.code})` : ''}`);
  if (loginOk) verified = true; // 로그인이 됐다는 건 인증이 끝났다는 뜻이다

  return { personaId, email, state, verified, loginOk, note: notes.join(' · ') };
}

async function main() {
  const baseIndex = process.argv.indexOf('--base');
  const base = (baseIndex > -1 ? process.argv[baseIndex + 1] : DEFAULT_BASE).replace(/\/$/, '');

  if (!existsSync(ACCOUNTS_PATH)) {
    throw new Error(`.ut/accounts.json 이 없습니다 — 페르소나 ↔ 계정 매핑 파일이 필요합니다.`);
  }
  const registry = JSON.parse(readFileSync(ACCOUNTS_PATH, 'utf8'));
  const shared = registry.password;
  const accounts = (registry.accounts ?? []).map((a) => ({
    personaId: a.personaId,
    email: a.email,
    password: a.password ?? shared,
  }));
  if (accounts.length === 0) throw new Error('.ut/accounts.json 에 accounts 가 비어 있습니다.');

  log(`대상: ${base} · 계정 ${accounts.length}개`);
  log('');

  const results = [];
  for (const account of accounts) {
    const result = await provisionOne(base, account);
    results.push(result);
    const mark = result.loginOk ? '✔' : '✘';
    log(`  ${mark} ${result.personaId} ${result.email.padEnd(22)} ${result.state.padEnd(8)} ${result.note}`);
  }

  writeFileSync(
    STATUS_PATH,
    `${JSON.stringify(
      {
        baseUrl: base,
        checkedAt: new Date().toISOString(),
        accounts: results.map(({ personaId, email, state, verified, loginOk, note }) => ({
          personaId,
          email,
          state,
          verified,
          loginOk,
          note: note || null,
        })),
      },
      null,
      2,
    )}\n`,
  );

  const ok = results.filter((r) => r.loginOk).length;
  log('');
  log(`결과: ${ok}/${results.length} 로그인 성공 · 신규 ${results.filter((r) => r.state === 'created').length}건`);
  log(`기록: ${path.relative(ROOT, STATUS_PATH)}`);
  if (ok !== results.length) {
    log('');
    log('⚠ 전원 로그인 성공이 아닙니다 — 계획서 §4-2 게이트에 걸립니다. UT 를 시작하지 마세요.');
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

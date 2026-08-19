/**
 * supabase/schema.sql 을 DB에 그대로 적용한다 — 브라우저(SQL Editor) 없이.
 *
 * 왜 파일 전체를 통째로 흘려보내도 되는가: `schema.sql` 은 **처음부터 멱등하게** 쓰여 있다.
 * 전부 `create table if not exists` · `alter table ... add column if not exists` · `create index
 * if not exists` 라서 몇 번을 다시 실행해도 같은 상태로 수렴한다. 마이그레이션 자동화에서
 * 제일 어려운 부분(순서·중복 적용 방지)이 이미 해결돼 있어서, 남은 건 전송뿐이다.
 *
 * 왜 psql 이 아니라 pg 인가: psql 은 팀원 머신에 없을 수 있는 시스템 바이너리다(이 머신에도 없다).
 * `pg` 는 npm 의존성이라 `npm ci` 만 하면 어디서나 같은 방식으로 돈다.
 *
 * 왜 앱 부팅 시 자동 적용이 아닌가: Vercel 서버리스는 콜드 스타트가 동시에 여러 개 뜬다.
 * 요청 경로에서 DDL 을 돌리면 같은 마이그레이션이 병렬로 실행되고, 런타임에 DDL 권한을 쥐게 된다.
 * 마이그레이션은 배포 절차이지 요청 처리가 아니다.
 *
 * 실행:
 *   npm run db:push            적용
 *   npm run db:push -- --check 적용하지 않고 현재 스키마 상태만 점검
 *
 * 필요한 값: `SUPABASE_DB_URL` (.env)
 *   Supabase 대시보드 → Project Settings → Database → Connection string → **Session pooler** 의
 *   URI 를 복사하고 `[YOUR-PASSWORD]` 를 실제 DB 비밀번호로 바꾼다. service_role 키가 아니다.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(ROOT, 'supabase/schema.sql');

/**
 * 적용 후 확인할 최소 계약 — "이 컬럼이 있으면 코드가 기대하는 스키마다".
 * 새 마이그레이션을 추가하면 여기에 한 줄 추가한다. 그래야 --check 가 드리프트를 잡는다.
 */
const EXPECTED = [
  { table: 'reports', columns: ['blocks_json', 'humanize_issues', 'humanize_skipped'] },
  { table: 'diagnosis_requests', columns: ['tier_input', 'status', 'stage'] },
  { table: 'llm_call_logs', columns: ['call_name', 'response_body'] },
  { table: 'generated_assets', columns: ['detail_input', 'block_total', 'slice_paths'] },
  { table: 'asset_blocks', columns: ['asset_id', 'status'] },
];

function fail(message, hint) {
  console.error(`\n✖ ${message}`);
  if (hint) console.error(`  → ${hint}`);
  process.exit(1);
}

/** 실제 존재하는 컬럼을 information_schema 에서 읽어 EXPECTED 와 대조한다 */
async function verify(client) {
  const { rows } = await client.query(
    `select table_name, column_name
       from information_schema.columns
      where table_schema = 'public'`,
  );
  const have = new Map();
  for (const r of rows) {
    if (!have.has(r.table_name)) have.set(r.table_name, new Set());
    have.get(r.table_name).add(r.column_name);
  }

  const missing = [];
  for (const { table, columns } of EXPECTED) {
    const cols = have.get(table);
    if (!cols) {
      missing.push(`${table} (테이블 없음)`);
      continue;
    }
    for (const c of columns) if (!cols.has(c)) missing.push(`${table}.${c}`);
  }
  return { missing, tableCount: have.size };
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const url = process.env.SUPABASE_DB_URL;

  if (!url) {
    fail(
      'SUPABASE_DB_URL 이 없습니다.',
      'Supabase → Project Settings → Database → Connection string → Session pooler 의 URI 를 .env 에 넣으세요. ' +
        '자세히: docs/setup-supabase.md §5',
    );
  }

  const sql = await readFile(SCHEMA_PATH, 'utf8');
  // pg 는 파라미터 없는 query 에서 다중 문장을 그대로 받는다(simple query protocol).
  // schema.sql 은 do $$ ... $$ 블록을 포함하므로 세미콜론으로 쪼개면 안 된다 — 통째로 보낸다.
  const client = new pg.Client({ connectionString: url });

  try {
    await client.connect();
  } catch (err) {
    fail(
      `DB 접속 실패: ${err.message}`,
      'Session pooler URI 인지, [YOUR-PASSWORD] 를 실제 비밀번호로 바꿨는지 확인하세요. ' +
        '(service_role 키가 아니라 DB 접속 문자열입니다.)',
    );
  }

  try {
    if (!checkOnly) {
      console.log(`· ${path.relative(ROOT, SCHEMA_PATH)} 적용 중… (멱등 — 재실행 안전)`);
      await client.query(sql);
      console.log('· 적용 완료');
    }

    const { missing, tableCount } = await verify(client);
    if (missing.length) {
      fail(
        `스키마가 코드 기대와 다릅니다 — 없는 것: ${missing.join(' / ')}`,
        checkOnly ? 'npm run db:push 로 적용하세요.' : 'schema.sql 이 최신인지 확인하세요.',
      );
    }
    console.log(`✔ 스키마 정상 — public 테이블 ${tableCount}개, 기대 컬럼 전부 존재`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`\n✖ 예상치 못한 오류: ${err?.stack ?? err}`);
  process.exit(1);
});

/**
 * .env 로더 유틸(dotenv 미의존). 프로세스 환경변수 우선, 없으면 저장소 루트 .env 파싱.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './catalog.mjs';

/**
 * .env 에서 KEY=VALUE 를 읽어 값을 반환. process.env 가 우선.
 * @param {string} key
 * @returns {Promise<string|undefined>}
 */
export async function readEnvValue(key) {
  if (process.env[key]) return process.env[key];
  const envPath = path.join(REPO_ROOT, '.env');
  if (!existsSync(envPath)) return undefined;
  const text = await readFile(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, '');
  }
  return undefined;
}

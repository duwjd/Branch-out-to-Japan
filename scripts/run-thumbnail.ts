/**
 * ② 썸네일 엔진 CLI 러너 — 화면 없이 목/실 파이프라인을 검증한다(09 §4b M6).
 * 기본 입력: HARUON 톤업 선크림 프로모 썸네일(프로토타입 실측 자산 haruon-before.jpg).
 *
 * 사용:
 *   npm run thumbnail:cli                       # 키 없으면 목 모드
 *   npm run thumbnail:cli -- --style D          # 스타일 지정(A~H, 기본 C)
 *   npm run thumbnail:cli -- --platform qoo10   # 플랫폼 지정(기본 rakuten-official)
 *   npm run thumbnail:cli -- --proof            # 실적 3필드 채워 배지 경로 확인
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { saveFile } from '../lib/files/storage';
import { createThumbnailAsset, runThumbnailJob } from '../lib/server/studioJob';
import { getStore } from '../lib/db/store';
import { currentImageMode, imageModel } from '../lib/studio/imageGen';
import { currentLlmMode } from '../lib/engine/llm/client';
import { PLATFORMS, type Platform, type StyleId } from '../lib/studio/promptPack';
import { logger } from '../lib/logger';

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? (process.argv[idx + 1] ?? null) : null;
}

async function main(): Promise<void> {
  const styleId = (argValue('--style') ?? 'C') as StyleId;
  const platformRaw = argValue('--platform') ?? 'rakuten-official';
  const platform: Platform = (PLATFORMS as string[]).includes(platformRaw) ? (platformRaw as Platform) : 'unset';
  const withProof = process.argv.includes('--proof');

  logger.info('썸네일 파이프라인 시작', {
    styleId,
    platform,
    llmMode: currentLlmMode(),
    imageMode: currentImageMode(),
    imageModel: imageModel(),
  });

  const source = readFileSync(path.join(process.cwd(), 'docs/specs/02-studio/assets/samples/haruon-before.jpg'));
  const originalImagePath = await saveFile(source, 'jpg', 'orig');

  const record = await createThumbnailAsset({
    originalImagePath,
    platform,
    styleId,
    proof: withProof
      ? { rankTitle: '楽天ランキング1位', genre: '日焼け止め', aggregationDate: '2026/6/14更新 [集計日6/13]' }
      : null,
  });

  const startedAt = Date.now();
  await runThumbnailJob(record.id);

  const store = await getStore();
  const done = await store.getAsset(record.id);
  if (!done) throw new Error('자산 레코드 소실');

  logger.info('파이프라인 완료', {
    assetId: done.id,
    status: done.status,
    error: done.error,
    durationMs: Date.now() - startedAt,
    imagePath: done.imagePath,
    gatePassed: done.gateResult?.passed ?? null,
  });

  process.stdout.write('\n[스타일] ' + done.styleName + ' · 플랫폼 ' + done.platform + '\n');
  process.stdout.write('\n[재설계 이유]\n' + (done.explanationJson?.styleReason ?? '(없음)') + '\n');
  process.stdout.write(
    '\n[카피 해설 1건]\n' + JSON.stringify(done.explanationJson?.copySlots[0] ?? null, null, 2) + '\n',
  );
  process.stdout.write('\n[프롬프트 앞 600자]\n' + (done.promptUsed ?? '').slice(0, 600) + '…\n');
}

main().catch((err) => {
  logger.error('CLI 실패', { reason: String((err as Error)?.stack ?? err) });
  process.exit(1);
});

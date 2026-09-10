/**
 * 콜⑩ specExtract 검증(§2-14).
 *
 * 이 콜의 존재 이유는 입력 피로를 줄이는 것이지만, **설계 목표는 지어내지 않는 것이다** —
 * 원본에 없는 용량·제조사·성분명을 채워 넣는 것이 이 서비스가 가장 하지 말아야 할 일이다.
 * 그래서 여기서 지키는 것은 "무엇을 비워 두는가"다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXTRACT_FIELDS, REVIEW_REQUIRED_FIELDS, runSpecExtract, type ExtractField } from './extractCall';

/** 목 모드로 돈다 — 키가 없으면 client.ts 가 mockData 를 돌려준다 */
const IMAGE = { mediaType: 'image/jpeg' as const, dataBase64: 'x' };

test('원본이 없으면 콜을 걸지 않는다(비용·지연 0)', async () => {
  const r = await runSpecExtract({ images: [], wanted: [...EXTRACT_FIELDS], timeoutMs: 1000 });
  assert.deepEqual(r.fields, {});
  assert.deepEqual(r.missing, []);
});

test('채울 칸이 없으면 콜을 걸지 않는다', async () => {
  const r = await runSpecExtract({ images: [IMAGE], wanted: [], timeoutMs: 1000 });
  assert.deepEqual(r.fields, {});
});

test('못 읽은 칸은 비우고 사유를 남긴다(부분 성공)', async () => {
  // 목 응답은 전성분을 일부러 비운다 — 부분 성공 경로가 목 모드에서도 재현되게 했다
  const r = await runSpecExtract({ images: [IMAGE], wanted: [...EXTRACT_FIELDS], timeoutMs: 60_000 });
  assert.equal(r.fields.specFullIngredients, undefined, '못 읽은 칸이 채워졌다');
  assert.ok(r.missing.some((m) => m.field === 'specFullIngredients'));
  assert.match(r.missing.find((m) => m.field === 'specFullIngredients')?.reason ?? '', /찾지 못했습니다/);
  // 읽은 칸은 그대로 온다
  assert.equal(r.fields.specVolume, '30mL');
});

test('요청하지 않은 칸은 돌려주지 않는다(이미 찬 칸을 덮지 않는다)', async () => {
  const wanted: ExtractField[] = ['specVolume', 'howToSteps'];
  const r = await runSpecExtract({ images: [IMAGE], wanted, timeoutMs: 60_000 });
  for (const key of Object.keys(r.fields)) assert.ok(wanted.includes(key as ExtractField), `요청 밖 칸: ${key}`);
});

test('区分은 추출 대상이 아니다 — 결정적 매핑표의 자리다', () => {
  // 코드가 '医薬部外品' 문자열 비교로 히어로 기능 라벨을 켠다.
  // 비전이 한 글자만 다르게 읽으면 그 라벨이 조용히 사라진다(DETAIL-05 5b-2)
  assert.ok(!(EXTRACT_FIELDS as readonly string[]).includes('specCategory'));
});

test('규정 민감 칸은 추출 대상 안에 있다', () => {
  // 이 둘은 자동으로 찼다는 사실만으로 블록을 세우지 않는다(§2-14 규정 가드).
  // 대상에서 빠지면 가드가 걸 대상 자체가 없어진다
  for (const f of REVIEW_REQUIRED_FIELDS) {
    assert.ok((EXTRACT_FIELDS as readonly string[]).includes(f), `${f}: 추출 대상이 아니다`);
  }
});

/**
 * 폰트 커버리지 단위 테스트 — satori의 런타임 Google Fonts fetch를 사전 차단하는 게 목적.
 * 커버리지 밖 글자가 통과하면 배포본에서 조용히 외부 요청이 나가고, 실패 시 두부(tofu)가 된다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jpFonts, normalizeForFont, uncoveredGlyphs } from './fonts';

test('jpFonts — Regular/Bold 2종을 OTF Buffer로 로드', () => {
  const fonts = jpFonts();
  assert.equal(fonts.length, 2);
  assert.deepEqual(fonts.map((f) => f.weight).sort(), [400, 700]);
  for (const f of fonts) {
    assert.ok(f.data.length > 1_000_000, '서브셋 OTF는 4MB 내외여야 한다');
    // OTF(CFF)는 매직 'OTTO', TTF는 0x00010000 — woff2(wOF2)면 satori가 거부한다
    const magic = f.data.toString('ascii', 0, 4);
    assert.ok(magic === 'OTTO' || f.data.readUInt32BE(0) === 0x00010000, `예상 밖 매직: ${magic}`);
  }
});

test('uncoveredGlyphs — 일본어 상세 카피는 전부 커버', () => {
  const jp =
    'グリシルグリシン6%配合／医薬部外品／効能評価試験済み／角質層まで／' +
    '合成香料フリー・鉱物油フリー／内容量 30mL／区分：化粧品／販売元：株式会社／' +
    '※1 すべての方に刺激が起こらないというわけではありません／' +
    'こんなお悩みありませんか？　W洗顔不要・まつエクOK／SPF50+ PA++++／通常価格 2,610円 → 1,920円';
  assert.deepEqual(uncoveredGlyphs(jp), []);
});

test('uncoveredGlyphs — 한글·이모지는 미커버로 잡아낸다', () => {
  // 한국어가 슬롯에 새어 들어오면(원본이 KR 상세라 실제로 일어난다) 두부가 된다
  assert.ok(uncoveredGlyphs('세라마이드').length > 0);
  assert.ok(uncoveredGlyphs('🎉').length > 0);
});

test('normalizeForFont — 서브셋이 놓치기 쉬운 표기를 안전하게 치환', () => {
  assert.equal(normalizeForFont('㈱YOAKE'), '(株)YOAKE');
  assert.equal(normalizeForFont('①洗顔 ②化粧水'), '1.洗顔 2.化粧水');
  assert.equal(normalizeForFont('うるおい🎉'), 'うるおい');
  // 정규화 결과는 반드시 커버 범위 안이어야 한다
  assert.deepEqual(uncoveredGlyphs(normalizeForFont('㈱ ① Ⅲ ～ 🎉')), []);
});

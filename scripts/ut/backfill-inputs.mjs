/**
 * 폼 캡처 `.txt` 에 **내가 입력한 값**을 덧붙인다.
 *
 * 왜: `innerText` 는 input·textarea·select 의 값을 포함하지 않는다. 그래서 페르소나가 자기 입력을
 * 못 보고 "나는 이런 거 넣은 적 없다"고 반응했다 — P04(판매원)·P09(랭킹 배지)·P12(2색 세트) 셋이
 * 실제로는 자기 fixture 값을 "지어낸 것"이라고 지적했다. 자극물 결함이지 제품 결함이 아니다.
 *
 * shot.mjs 는 앞으로의 캡처에서 이 값을 포함하도록 고쳤고, 이 스크립트는 **이미 찍힌 캡처**를 메운다.
 * 덧붙이는 값은 드라이버가 실제로 타이핑한 fixture 값 그대로다 — 새로 지어내지 않는다.
 *
 * 실행: node scripts/ut/backfill-inputs.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';

const MARK = '── 내가 이 화면에 입력한 값 ──';
const log = (m) => process.stdout.write(`${m}\n`);

const CATEGORY = { skincare: '스킨케어', makeup: '메이크업', suncare: '선케어', cleansing: '클렌징' };
const DETAIL_CATEGORY = {
  skincare: '스킨케어',
  suncare: '선케어',
  makeup: '색조',
  cleansing: '클렌징',
  haircare: '헤어',
  etc: '기타',
};
const PLATFORM = {
  unset: '미정/전체',
  'amazon-jp': '아마존JP',
  'rakuten-official': '라쿠텐 공식샵',
  'rakuten-reseller': '라쿠텐 리셀러',
  qoo10: 'Qoo10',
};
const STYLE = {
  A: '클린 스튜디오 단독컷',
  B: '제품+텍스처 스와치',
  C: '공식샵 신뢰 배지형',
  D: '캐치카피+성분 비주얼형',
  E: '수상 실적 스택형',
  G: '프로모션 강조형',
  H: '프리미엄 무드형',
};
const TEMPLATE = {
  D1: '문제해결 서사형',
  D2: '성분 근거형',
  D3: '스펙·씬 신뢰형',
  D4: '컬러 배리에이션형',
  D5: '저자극·편의형',
  D6: '브랜드 프리미엄형',
};

/** 파일 끝에 블록을 덧붙인다. 이미 있으면 건너뛴다(멱등) */
function append(file, lines) {
  if (!existsSync(file)) return false;
  const cur = readFileSync(file, 'utf8');
  if (cur.includes(MARK)) return false;
  writeFileSync(file, `${cur}\n\n${MARK}\n${lines.join('\n')}\n`);
  return true;
}

const doc = JSON.parse(readFileSync(path.join(ROOT, 'docs/research/ut-agent/fixtures/personas-input.json'), 'utf8'));
let n = 0;

for (const p of doc.personas) {
  const dir = path.join(ROOT, '.ut/runs', p.personaId, 'screens');
  const b = p.brand;
  const t = p.thumbnail;
  const d = p.detail;

  // T2 브랜드 폼
  const brandLines = [
    `  브랜드명: ${b.brandName}`,
    `  카테고리: ${CATEGORY[b.category] ?? b.category}`,
    `  제품분류: ${b.productClass}`,
    `  포지셔닝 태그: ${(b.positioningTags ?? []).join(' · ')}`,
    `  KR 사이트: ${b.channels?.krUrl ?? ''}`,
    ...(b.channels?.jp ?? []).map((c) => `  JP 채널: ${c.channel}${c.url ? ` — ${c.url}` : ''}`),
  ];
  for (const f of ['04-brand-form.txt', '04a-brand-form.txt']) if (append(path.join(dir, f), brandLines)) n += 1;

  // T4 썸네일 폼
  const thumbLines = [
    `  제품컷: ${path.basename(p.productImage)} (업로드함)`,
    `  타깃 플랫폼: ${PLATFORM[t.platform] ?? t.platform}`,
    `  템플릿: ${t.styleId} ${STYLE[t.styleId] ?? ''}`,
    ...(t.proof
      ? [`  실적명: ${t.proof.rankTitle}`, `  부문·장르: ${t.proof.genre}`, `  수상일: ${t.proof.aggregationDate}`]
      : ['  랭킹·수상 실적: (입력하지 않음)']),
    ...(t.promo
      ? [
          `  프로모션 이름: ${t.promo.setTitle}`,
          `  할인 가격(엔): ${t.promo.salePrice}`,
          `  정가(엔): ${t.promo.normalPrice ?? ''}`,
          `  취소선 가격 체크: ${t.promo.normalPriceVerified ? '체크됨' : ''}`,
        ]
      : ['  프로모션: (입력하지 않음)']),
  ];
  if (append(path.join(dir, '12-thumbnail-new.txt'), thumbLines)) n += 1;

  // T5 상세 폼
  const detailLines = [
    `  제품컷: ${path.basename(p.productImage)} (업로드함)`,
    `  상품 종류: ${DETAIL_CATEGORY[d.productCategory] ?? d.productCategory}`,
    `  타깃 플랫폼: ${PLATFORM[d.platform] ?? d.platform}`,
    `  템플릿: ${d.templateId} ${TEMPLATE[d.templateId] ?? ''}`,
    `  내용량: ${d.specVolume}`,
    `  구분: ${d.specCategory}`,
    `  판매원: ${d.specManufacturer}`,
    `  원산국: ${d.specOrigin ?? ''}`,
    `  전성분: ${d.specFullIngredients || '(입력하지 않음)'}`,
    `  성분(성분명|농도|배합목적): ${d.ingredientRows ? d.ingredientRows.replace(/\n/g, ' / ') : '(입력하지 않음)'}`,
    `  무첨가 항목: ${d.freeOf ? d.freeOf.replace(/\n/g, ' · ') : '(입력하지 않음)'}`,
    `  사용법 STEP: ${d.howToSteps ? d.howToSteps.replace(/\n/g, ' / ') : '(입력하지 않음)'}`,
    `  주의사항: ${d.cautions ? d.cautions.replace(/\n/g, ' / ') : '(입력하지 않음)'}`,
  ];
  for (const f of ['17-detail-new.txt', '18-detail-plan.txt']) if (append(path.join(dir, f), detailLines)) n += 1;
}

log(`입력값을 덧붙인 캡처 텍스트: ${n}개`);

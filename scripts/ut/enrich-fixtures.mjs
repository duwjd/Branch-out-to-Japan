/**
 * personas-input.json 의 상세페이지 선택 입력을 §8-2 의 콘텐츠 3군에 맞춰 차등으로 채운다.
 *
 * 왜: 드라이버가 표시 의무 3항만 채우면 상세 폼 34개 필드 중 6개만 차서 근거 미충족 블록이
 * 무더기로 빠진다. 그러면 "빠진 블록 안내"가 브랜드별 차이가 아니라 **드라이버가 만든 균일한
 * 아티팩트**가 되어 관찰 대상이 사라진다. 한국에서 쓰던 상세 카피가 충분한 브랜드(①군)는
 * 성분·사용법·주의사항을 이미 갖고 있는 게 자연스럽고, ③군은 제품 정보 자체가 없는 게 자연스럽다.
 *
 *   ①군(충분 9명)  성분·무첨가·사용법·주의사항 전부
 *   ②군(빈약 7명)  사용법·주의사항만
 *   ③군(없음 4명)  없음 — 제품 섹션을 비운 그대로
 *
 * 실행: node scripts/ut/enrich-fixtures.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';

const FIXTURES = path.join(ROOT, 'docs/research/ut-agent/fixtures/personas-input.json');
const log = (m) => process.stdout.write(`${m}\n`);

const GROUP1 = new Set(['P01', 'P03', 'P06', 'P09', 'P11', 'P12', 'P13', 'P16', 'P18']);
const GROUP2 = new Set(['P04', 'P05', 'P08', 'P10', 'P14', 'P15', 'P17']);

/** 성분 행 — `성분명|농도|배합목적`. 리포트 입력의 핵심 성분에서 만든다 */
const INGREDIENT_PURPOSE = {
  세라마이드NP: ['5%', '피부 장벽 보강'],
  판테놀: ['3%', '진정·보습'],
  마데카소사이드: ['0.2%', '진정'],
  히알루론산: ['2%', '수분 유지'],
  병풀추출물: ['82%', '진정'],
  아시아티코사이드: ['0.1%', '진정'],
  나이아신아마이드: ['5%', '피지·톤 정돈'],
  아연PCA: ['1%', '피지 조절'],
  살리실릭애씨드: ['0.5%', '각질 정리'],
  스쿠알란: ['3%', '유수분 밸런스'],
  시어버터: ['5%', '보습 밀착'],
  호호바씨오일: ['3%', '유연'],
  세라마이드: ['3%', '피부 장벽 보강'],
  글리세린: ['5%', '보습'],
  베타인: ['2%', '수분 유지'],
  녹차추출물: ['1%', '진정'],
  징크옥사이드: ['12%', '자외선 차단'],
  티타늄디옥사이드: ['8%', '자외선 차단'],
  아시아틱애씨드: ['0.1%', '진정'],
};

const HOW_TO = {
  skincare: [
    '세안 후 토너로 피부결을 정돈합니다.',
    '적당량을 덜어 얼굴 전체에 부드럽게 펴 발라 줍니다.',
    '손바닥으로 가볍게 감싸 흡수시킵니다.',
  ],
  suncare: [
    '외출 15분 전, 얼굴 전체에 충분한 양을 발라 줍니다.',
    '목과 귀 뒤까지 놓치지 않고 펴 바릅니다.',
    '2~3시간마다 덧발라 줍니다.',
  ],
  makeup: [
    '입술 결을 정돈한 뒤 사용합니다.',
    '팁을 입술 중앙에 대고 바깥쪽으로 펴 발라 줍니다.',
    '진하게 쓰고 싶으면 한 번 더 덧발라 줍니다.',
  ],
  cleansing: [
    '젖은 손에 적당량을 덜어 거품을 냅니다.',
    '얼굴 전체를 부드럽게 마사지하듯 문질러 줍니다.',
    '미지근한 물로 깨끗이 헹궈 냅니다.',
  ],
  haircare: ['머리를 말린 뒤 가르마를 나눕니다.', '두피에 직접 분사합니다.', '손끝으로 가볍게 문질러 흡수시킵니다.'],
  etc: ['적당량을 덜어 원하는 부위에 발라 줍니다.', '충분히 흡수될 때까지 부드럽게 펴 발라 줍니다.'],
};

const CAUTIONS = [
  '사용 중 붉은 반점·부어오름·가려움 등 이상이 있으면 사용을 중지하고 전문의와 상담해 주세요.',
  '상처가 있는 부위에는 사용하지 마세요.',
  '직사광선을 피해 서늘한 곳에 보관하고 어린이의 손이 닿지 않는 곳에 두세요.',
];

const FREE_OF = ['인공향료', '인공색소', '파라벤', '동물성 원료'];

const doc = JSON.parse(readFileSync(FIXTURES, 'utf8'));
let g1 = 0;
let g2 = 0;

for (const p of doc.personas) {
  const id = p.personaId;
  const cat = p.detail.productCategory;
  if (GROUP1.has(id)) {
    p.detail.ingredientRows = (p.report.ingredients ?? [])
      .map((name) => {
        const [pct, purpose] = INGREDIENT_PURPOSE[name] ?? ['', '보조 성분'];
        return `${name}|${pct}|${purpose}`;
      })
      .join('\n');
    p.detail.freeOf = FREE_OF.join('\n');
    p.detail.howToSteps = (HOW_TO[cat] ?? HOW_TO.etc).join('\n');
    p.detail.cautions = CAUTIONS.join('\n');
    g1 += 1;
  } else if (GROUP2.has(id)) {
    p.detail.howToSteps = (HOW_TO[cat] ?? HOW_TO.etc).join('\n');
    p.detail.cautions = CAUTIONS.slice(0, 2).join('\n');
    g2 += 1;
  }
}
doc.note = `${doc.note} · 상세 선택 입력은 §8-2 콘텐츠 3군에 맞춰 차등(scripts/ut/enrich-fixtures.mjs)`;
writeFileSync(FIXTURES, `${JSON.stringify(doc, null, 2)}\n`);
log(`①군 ${g1}명 성분·무첨가·사용법·주의사항 / ②군 ${g2}명 사용법·주의사항 / ③군 4명 그대로`);

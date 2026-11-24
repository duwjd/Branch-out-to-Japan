"""영상 캡처용 로컬 데모 데이터 스테이징 — 저장소의 .data(gitignore · 로컬 파일 저장소)만 고친다.

실행(저장소 루트에서):  python3 video/landing-hero/capture/stage-demo-data.py .data
전제: 키 없는 로컬 목 모드에서 그 계정으로 진단 리포트 1건과 썸네일 2건(공식샵 신뢰 배지형 포함)을 미리 만들어 둔다.
      이 스크립트는 .data 의 첫 브랜드·첫 진단 요청을 대상으로 삼는다.

왜 필요한가: 목 모드의 리포트 본문은 고정 픽스처라 화면에 그대로 찍으면 내용이 비어 보인다.
값의 출처는 팀의 골든 샘플 docs/specs/01-report-sample-cica-ampoule.md (가상 브랜드 HARUON · CICA 진정 앰플)이다.
영상에는 "화면과 결과물은 예시입니다"가 함께 나간다.

샘플 문서와 다르게 맞춘 두 곳:
- 요약문의 "11문장 중 8문장" → "11문장 모두". 같은 문서의 감사표(불가 6 · 조건부 5 · 가능 0)와 어긋나 화면에서 숫자가 맞지 않는다.
- 목 썸네일 카피 해설의 「透け感」 → 「透明感」. 목 결과 이미지에 찍힌 문구가 「透明感」이다.
- 「공식샵 신뢰 배지형」 썸네일의 목표 몰 → 라쿠텐 공식샵. 템플릿 설명(라쿠텐 공식샵 전형 문법)과 결과 화면의 "○○ 기준"이 같은 몰을 가리키게 한다.
"""
import json, sys
D = sys.argv[1]
def load(n): return json.load(open(f'{D}/{n}'))
def save(n, o): json.dump(o, open(f'{D}/{n}', 'w'), ensure_ascii=False, indent=2)

K = [
 ('K1','병원 안 가도 되는 진정의 답','불가','「병원 대체」는 의료·의약품과의 비교로 효과를 암시합니다. 「鎮静」도 화장품 효능 56항목에 없습니다.','ゆらぎがちな肌※に、うるおいで満たすという答え。 ※季節や乾燥によるコンディションの変化'),
 ('K2','피부 속 깊은 곳까지 파고드는','조건부','침투 표현은 角質層まで로 한정해야 합니다. 각층 한정 + ※각주면 가능합니다.','角層のすみずみ※まで、うるおいで満たすCICAアンプル。 ※角質層まで'),
 ('K3','트러블 싹, 붉은기 싹 — 바르는 순간 즉각 진정','불가','효과 보증·염증 개선 암시·근거 없는 즉효 단정입니다.','乾燥による肌あれ※が気になる肌を、うるおいでキメ整える。 ※角層'),
 ('K4','손상된 피부 장벽을 재생시켜 근본부터 치료합니다','불가','「再生」「治療」는 전형적인 의약품적 효능 표현으로 어느 등급으로도 쓸 수 없습니다.','うるおいのヴェールで包み、乾燥に負けないなめらかな肌へ導く。'),
 ('K5','72시간 지속되는 강력한 진정력','조건부','수치·지속을 단정하려면 効能評価試験 근거가 필요합니다.','うるおい感が、朝までしっとり続く。'),
 ('K6','3개월 만에 10만 병 완판, 리뷰 미쳤다고 난리','조건부','판매 실적은 사실이면 표기할 수 있지만 집계 시점·출처를 밝혀야 합니다.','おかげさまで、累計出荷10万本を突破しました。 ※2026年◯月時点・自社調べ'),
 ('K7','센텔라 성분 99% 고농축','조건부','배합률은 무엇의 비율인지 명확해야 합니다. "高濃度" 단독은 근거가 필요합니다.','ツボクサエキス(CICA)を◯%配合※。 ※◯◯抽出物として'),
 ('K8','민감성·트러블 피부를 위한 병원 처방급','불가','「病院処方級」은 의약품·의료와의 비교 암시입니다. 대상 표시는 가능합니다.','敏感肌※の方の毎日にも。低刺激設計。 ※すべての方に刺激が起きないわけではありません'),
 ('K9','피부과 시술 후에도 안심하고 쓰는 재생 앰플','불가','의료 행위와의 연관 암시이며 「再生」은 의약품적 효능입니다.','パッチテスト済み※。デイリーケアに。 ※すべての方に刺激が起きないわけではありません'),
 ('K10','바르고 자면 아침에 트러블이 사라집니다','불가','「트러블이 사라진다」는 효과 보증입니다. 사용 타이밍 소구는 가능합니다.','夜のスキンケアの仕上げに。翌朝、しっとり満ちたキメ印象へ。'),
 ('K11','지금 구매하고 피부 고민 끝내세요','조건부','"고민을 끝낸다"는 효과 보증 암시입니다. 행동 유도는 담담하게.','まずは1本、今夜のスキンケアから。'),
]
REWRITES = [
 dict(sourceRef='K3', beforeKr='트러블 싹, 붉은기 싹 — 바르는 순간 즉각 진정',
      problem='효과 보증·염증 개선 암시·근거 없는 즉효 단정 (薬機法 불가)',
      afterJa='乾燥による肌あれ※が気になる肌を、うるおいでキメ整える。 ※角層',
      afterKr='건조로 거칠어지기 쉬운 피부를, 수분으로 결을 정돈한다 — ※는 "각질층 범위 안"이라는 자기 한정 각주',
      reason='「消す/즉각」의 효과 보증을 지우고 화장품 효능 범위 안의 「整える」로 바꿨습니다.',
      whatAdded=['※角層 조건 각주', '「整える」 등급 내 프레임'], uspRowIndex=0),
 dict(sourceRef='K4', beforeKr='손상된 피부 장벽을 재생시켜 근본부터 치료합니다',
      problem='「再生」「治療」는 의약품적 효능 표현 (薬機法 불가 · 최고위험)',
      afterJa='うるおいのヴェールで包み、乾燥に負けないなめらかな肌へ導く。',
      afterKr='수분의 베일로 감싸, 건조에 지지 않는 매끄러운 피부로 이끈다',
      reason='의약품적 효능을 지우고 결과를 「導く」로 완화했습니다 — 일본 상세의 관례적 절제.',
      whatAdded=['결과 완화 어휘(導く)', '재생·치료 삭제'], uspRowIndex=0),
 dict(sourceRef='K5', beforeKr='72시간 지속되는 강력한 진정력',
      problem='수치·지속 단정에는 効能評価試験 근거가 필요 (薬機法 조건부)',
      afterJa='うるおい感が、朝までしっとり続く。',
      afterKr='촉촉함이 다음 날 아침까지 이어진다 — 근거 없는 "72시간" 수치를 뺀 안전판',
      reason='시험이 있으면 근거 라벨로, 없으면 수치를 감상 표현으로 낮춥니다.',
      whatAdded=['수치 단정 → 감상 표현'], uspRowIndex=0),
 dict(sourceRef='K10', beforeKr='바르고 자면 아침에 트러블이 사라집니다',
      problem='「트러블이 사라진다」는 효과 보증 (薬機法 불가)',
      afterJa='夜のスキンケアの仕上げに。翌朝、しっとり満ちたキメ印象へ。',
      afterKr='밤 스킨케어의 마무리로. 다음 날 아침, 촉촉하게 채워진 듯한 결 인상으로',
      reason='효과 보증을 「印象」 레벨로 낮추고 사용 씬(밤)은 살렸습니다.',
      whatAdded=['「印象」 감상 레벨 표현'], uspRowIndex=0),
]
GROUPS = {'A': 10, 'B': 0, 'C': 33, 'D': 25, 'E': 13}
TOP3 = [
 {'itemId': 'B1', 'title': '프리 처방 라벨화', 'score': 0},
 {'itemId': 'A1', 'title': '효능 주장에 근거 라벨', 'score': 0},
 {'itemId': 'A2', 'title': '조건 각주(※/＊)로 범위 한정', 'score': 0},
]
SUMMARY = ('이 카피는 한국 시장에선 잘 작동할 감성·즉효·완판 소구입니다. 그러나 11문장 모두가 일본 薬機法상 표현 불가 또는 조건부이고, '
           '일본 고객이 신뢰의 근거로 삼는 정보 구조(効能評価試験·※조건 각주·集計日·無添加 라벨)가 사실상 전무합니다.')

# ── 브랜드
brands = load('brand-profiles.json')
b = brands[0]
b['brandName'] = '하루온'
b['positioningTags'] = ['calming', 'sensitive']
b['channels'] = {'krUrl': b.get('channels', {}).get('krUrl', ''), 'jp': [{'channel': 'Qoo10', 'url': ''}, {'channel': '라쿠텐', 'url': ''}]}
b['productInfoMemo'] = 'CICA 진정 앰플 30mL · 센텔라아시아티카 추출물 · 민감 피부 대상'
save('brand-profiles.json', brands)

# ── 진단 요청·리포트
reqs = load('diagnosis-requests.json'); reps = load('reports.json')
rq = reqs[0]; rp = [r for r in reps if r['requestId'] == rq['id']][0]
t = rq['tierInput']
t.update(brandName='하루온', productName='CICA 진정 앰플', sourceText='\n'.join(k[1] + '.' for k in K),
         keyIngredients=['센텔라아시아티카', '판테놀'], priceJpy=2480, positioning={'tags': ['calming', 'sensitive'], 'note': ''})
rq['precisionLimited'] = False
bj = rp['blocksJson']
bj['meta'].update(llmMode='real', precisionLimited=False, category='skincare')
bj['block0'].update(brandName='하루온', productName='CICA 진정 앰플',
                    scope='4카테고리 진단 엔진 중 스킨케어 · 티어 입력 기반(문장 11건 전수 감사)')
bj['block1'] = dict(scored=True, overallScore=18, groupScores=GROUPS, top3=TOP3, summaryText=SUMMARY,
                    trustBadges=['채점 기준 공개', '라쿠텐 상세 90건 코퍼스 기준', '약기법 1차 스크리닝'])
ref = bj['block3']['sentences'][0].get('clauseRefs', [])
bj['block3']['sentences'] = [dict(sentenceId=k[0], verdict=k[2], reason=k[3], clauseRefs=ref, altTextJa=k[4], originalText=k[1]) for k in K]
bj['block3']['summary'] = dict(ngCount=6, conditionalCount=5, okCount=0, highestRiskId='K4')
bj['block5']['groupScores'] = GROUPS
bj['block7'] = {'rewrites': REWRITES}
rp.update(overallScore=18, groupScores=GROUPS, top3=TOP3)
save('diagnosis-requests.json', reqs); save('reports.json', reps)

# ── 자산: 브랜드명 스냅샷을 맞춘다(문자열 치환)
raw = open(f'{D}/generated-assets.json').read().replace('글로우리프', '하루온').replace('透け感トーンアップUV', '透明感トーンアップUV')
open(f'{D}/generated-assets.json', 'w').write(raw)
# 「공식샵 신뢰 배지형」은 라쿠텐 공식샵 문법이다 — 결과 화면의 "○○ 기준" 문구가 템플릿과 같은 몰을 가리키게 맞춘다
assets = load('generated-assets.json')
for a in assets:
    if a.get('kind') == 'thumbnail' and str(a.get('styleName', '')).startswith('공식샵'):
        a['platform'] = 'rakuten-official'
save('generated-assets.json', assets)
print('staged: brand=하루온, report=CICA 진정 앰플 18/100 (불가 6 · 조건부 5), rewrites', len(REWRITES))

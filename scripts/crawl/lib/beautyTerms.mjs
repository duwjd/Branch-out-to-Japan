/**
 * 일본 뷰티 시드 어휘 사전. build-lexicon.mjs 가 코퍼스에서 이 용어들의 빈도를 센다.
 * category: 피부고민 | 효과소구 | 성분 | 질감 | 트렌드
 * reading: 한자어의 후리가나(가나/카타카나는 생략 가능).
 * ※ 시드일 뿐이며, 빌더가 코퍼스에서 카타카나 신조어(성분·트렌드)를 추가로 발굴한다.
 */
export const BEAUTY_TERMS = [
  // 피부고민
  { term: '毛穴', reading: 'けあな', category: '피부고민' },
  { term: '乾燥', reading: 'かんそう', category: '피부고민' },
  { term: '敏感肌', reading: 'びんかんはだ', category: '피부고민' },
  { term: '混合肌', reading: 'こんごうはだ', category: '피부고민' },
  { term: 'テカリ', reading: '', category: '피부고민' },
  { term: '皮脂', reading: 'ひし', category: '피부고민' },
  { term: 'くすみ', reading: '', category: '피부고민' },
  { term: 'シミ', reading: '', category: '피부고민' },
  { term: 'シワ', reading: '', category: '피부고민' },
  { term: 'たるみ', reading: '', category: '피부고민' },
  { term: 'ニキビ', reading: '', category: '피부고민' },
  { term: '黒ずみ', reading: 'くろずみ', category: '피부고민' },
  { term: '赤み', reading: 'あかみ', category: '피부고민' },
  { term: '色ムラ', reading: 'いろむら', category: '피부고민' },
  // 효과소구
  { term: '保湿', reading: 'ほしつ', category: '효과소구' },
  { term: '高保湿', reading: 'こうほしつ', category: '효과소구' },
  { term: '美白', reading: 'びはく', category: '효과소구' },
  { term: '潤い', reading: 'うるおい', category: '효과소구' },
  { term: 'ハリ', reading: '', category: '효과소구' },
  { term: 'ツヤ', reading: '', category: '효과소구' },
  { term: '引き締め', reading: 'ひきしめ', category: '효과소구' },
  { term: '透明感', reading: 'とうめいかん', category: '효과소구' },
  { term: 'エイジングケア', reading: '', category: '효과소구' },
  { term: '導入', reading: 'どうにゅう', category: '효과소구' },
  { term: '鎮静', reading: 'ちんせい', category: '효과소구' },
  { term: '低刺激', reading: 'ていしげき', category: '효과소구' },
  { term: '無添加', reading: 'むてんか', category: '효과소구' },
  { term: '医薬部外品', reading: 'いやくぶがいひん', category: '효과소구' },
  // 성분
  { term: 'セラミド', reading: '', category: '성분' },
  { term: 'ヒアルロン酸', reading: 'ヒアルロンさん', category: '성분' },
  { term: 'コラーゲン', reading: '', category: '성분' },
  { term: 'ナイアシンアミド', reading: '', category: '성분' },
  { term: 'レチノール', reading: '', category: '성분' },
  { term: 'ビタミンC', reading: '', category: '성분' },
  { term: 'CICA', reading: '', category: '성분' },
  { term: 'ツボクサ', reading: '', category: '성분' },
  { term: '幹細胞', reading: 'かんさいぼう', category: '성분' },
  { term: 'ペプチド', reading: '', category: '성분' },
  { term: 'アミノ酸', reading: 'アミノさん', category: '성분' },
  { term: 'スクワラン', reading: '', category: '성분' },
  { term: 'プラセンタ', reading: '', category: '성분' },
  { term: '酵素', reading: 'こうそ', category: '성분' },
  { term: 'PDRN', reading: '', category: '성분' },
  // 질감
  { term: 'しっとり', reading: '', category: '질감' },
  { term: 'さっぱり', reading: '', category: '질감' },
  { term: 'もちもち', reading: '', category: '질감' },
  { term: 'とろみ', reading: '', category: '질감' },
  { term: 'みずみずしい', reading: '', category: '질감' },
  { term: '濃厚', reading: 'のうこう', category: '질감' },
  // 트렌드
  { term: '話題', reading: 'わだい', category: '트렌드' },
  { term: '人気', reading: 'にんき', category: '트렌드' },
  { term: '韓国コスメ', reading: 'かんこくコスメ', category: '트렌드' },
  { term: 'プチプラ', reading: '', category: '트렌드' },
  { term: 'デパコス', reading: '', category: '트렌드' },
  { term: '名品', reading: 'めいひん', category: '트렌드' },
];

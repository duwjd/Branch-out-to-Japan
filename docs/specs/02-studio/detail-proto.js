/**
 * 상세페이지 프로토타입 공용 엔진 — 3·4·5 화면과 04-operations/3-brand.html 이 함께 쓴다.
 * 비배포 · 기획 검토용. 의존성 0(빌드 없이 파일을 열면 그대로 동작한다).
 *
 * ⚠ 이 파일의 상수·판정식은 **기획서에 적힌 값과 글자 그대로 같아야 한다.**
 *   정본: 02-detail-converter-spec.md §2-6(밴드 리듬) · §2-7(테마 해석)
 *   프로토가 곧 엔진 스펙이므로, 여기서 값을 바꾸면 문서도 같이 바꾼다.
 *
 * 담당 4가지
 *   1) 색 추출  — 업로드 제품컷에서 브랜드 accent·무드를 뽑는다(AI 콜 0)
 *   2) 테마 해석 — accent 1개에서 파생 토큰 5종을 만들고 WCAG 대비를 보장한다
 *   3) 톤 리듬  — 블록 시퀀스 전체를 접어(fold) 블록별 밴드 톤·높이·배치를 정한다
 *   4) 미니어처 — blockSequence 로부터 상세페이지 축소 SVG 를 그린다(정적 이미지 아님)
 */
(function (global) {
  'use strict';

  var KG = {};

  /* ─────────────────────────────────────────────────────────────────────────
   * 1. 색 유틸 — 순수 함수. 브라우저와 서버(lib/studio/detail/theme.ts)가 공유할 로직.
   * ───────────────────────────────────────────────────────────────────────── */

  /** #rgb·#rrggbb 만 허용한다. 그 외(빈값·8자리·css 함수·문자열 주입)는 null. */
  function normalizeHex(raw) {
    if (typeof raw !== 'string') return null;
    var v = raw.trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(v)) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    return null;
  }

  /** @returns {{r:number,g:number,b:number}} 0~255 */
  function hexToRgb(hex) {
    var h = normalizeHex(hex) || '#000000';
    return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) };
  }

  function rgbToHex(r, g, b) {
    var to = function (n) {
      var c = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return c.length === 1 ? '0' + c : c;
    };
    return '#' + to(r) + to(g) + to(b);
  }

  /** @returns {{h:number,s:number,v:number}} h 0~360, s·v 0~1 */
  function rgbToHsv(r, g, b) {
    var rn = r / 255, gn = g / 255, bn = b / 255;
    var max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min;
    var h = 0;
    if (d !== 0) {
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: h, s: max === 0 ? 0 : d / max, v: max };
  }

  function hsvToRgb(h, s, v) {
    var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    var t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
          : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return { r: (t[0] + m) * 255, g: (t[1] + m) * 255, b: (t[2] + m) * 255 };
  }

  function srgbChannel(c) {
    var n = c / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  }

  /** WCAG 2.1 상대휘도. */
  function luminance(hex) {
    var c = hexToRgb(hex);
    return 0.2126 * srgbChannel(c.r) + 0.7152 * srgbChannel(c.g) + 0.0722 * srgbChannel(c.b);
  }

  /** WCAG 2.1 대비비 1~21. */
  function contrastRatio(a, b) {
    var l1 = luminance(a), l2 = luminance(b);
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  /**
   * sRGB 채널 균등 스케일로 어둡게 한다.
   * HSL 명도 조작과 달리 R:G:B 비율이 유지되므로 **HSV 색상(hue)과 채도(S)가 정확히 보존**된다
   * — 브랜드색의 정체성이 남는다.
   */
  function darken(hex, t) {
    var c = hexToRgb(hex), k = 1 - t;
    return rgbToHex(c.r * k, c.g * k, c.b * k);
  }

  /** 흰색과 섞는다(틴트·서피스 파생). */
  function mixWhite(hex, t) {
    var c = hexToRgb(hex);
    return rgbToHex(c.r + (255 - c.r) * t, c.g + (255 - c.g) * t, c.b + (255 - c.b) * t);
  }

  /**
   * 채움용 클램프 — 흰 배경에서 최소 1.6:1.
   * 사용자가 #fffdf0 같은 색을 고르면 그래프 바·불릿 점이 흰 배경에서 아예 사라진다.
   */
  function clampFill(hex, min) {
    var target = min || 1.6, cur = normalizeHex(hex) || '#8a7f76', guard = 0;
    while (contrastRatio(cur, '#ffffff') < target && guard < 60) {
      cur = darken(cur, 0.02);
      guard += 1;
    }
    return cur;
  }

  /**
   * 텍스트용 파생색 — bg 위에서 target(기본 4.5) 이상이 될 때까지 2% 단위로 어둡게.
   * bg 를 흰색이 아니라 **그 색이 실제로 얹히는 배경(accentTint)** 으로 두는 게 핵심이다.
   * accentTint 는 흰색보다 어두우므로 여기서 4.5 를 넘기면 흰 배경 위는 자동으로 더 안전하다.
   */
  function deriveStrong(accent, bg, target) {
    var want = target || 4.5, cur = accent, guard = 0;
    while (contrastRatio(cur, bg) < want && guard < 60) {
      cur = darken(cur, 0.02);
      guard += 1;
    }
    return cur;
  }

  /** accent 채움 위 글자색 — 흰색과 잉크 중 대비가 높은 쪽. */
  function bestOn(bg) {
    return contrastRatio(bg, '#ffffff') >= contrastRatio(bg, '#202124') ? '#ffffff' : '#202124';
  }

  /**
   * accent 톤 **밴드의 배경색**. accent 원색과 다를 수 있다.
   * 중간 밝기 accent 는 흰 글자도 잉크 글자도 4.5:1 을 못 넘긴다(실측: #8a7f76 → 잉크 4.12).
   * 그런 색일 때만 대비가 더 유리한 방향으로 밀어 4.5 를 확보한다 — 채널 비율/흰색 혼합이라 hue 는 보존된다.
   * 바·점 같은 **채움**에는 원색 accent 를 그대로 쓴다(브랜드색이 눈에 남아야 한다).
   */
  function deriveBand(accent, target) {
    var want = target || 4.5;
    var cInk = contrastRatio('#202124', accent), cWhite = contrastRatio('#ffffff', accent);
    if (Math.max(cInk, cWhite) >= want) return accent;
    var cur = accent, guard = 0;
    if (cInk >= cWhite) {
      while (contrastRatio('#202124', cur) < want && guard < 60) { cur = mixWhite(cur, 0.04); guard += 1; }
    } else {
      while (contrastRatio('#ffffff', cur) < want && guard < 60) { cur = darken(cur, 0.04); guard += 1; }
    }
    return cur;
  }

  KG.normalizeHex = normalizeHex;
  KG.contrastRatio = contrastRatio;
  KG.hexToRgb = hexToRgb;
  KG.rgbToHsv = rgbToHsv;
  KG.mixWhite = mixWhite;
  KG.darken = darken;

  /* ─────────────────────────────────────────────────────────────────────────
   * 2. 프리셋 — 오버라이드용. 기본값은 "업로드 이미지에서 추출"이다.
   * ───────────────────────────────────────────────────────────────────────── */

  /** accentNameEn 은 AI 프롬프트에 hex 와 함께 들어간다 — hex 만 주면 이미지 모델이 못 따른다. */
  KG.PALETTES = [
    { id: 'neutral-greige',  labelKo: '뉴트럴 그레이지', accent: '#8a7f76', nameEn: 'warm greige' },
    { id: 'clinical-blue',   labelKo: '클리니컬 블루',   accent: '#3d6fb5', nameEn: 'deep clinical blue' },
    { id: 'fresh-aqua',      labelKo: '프레시 아쿠아',   accent: '#1f9aa6', nameEn: 'fresh aqua teal' },
    { id: 'botanical-green', labelKo: '보태니컬 그린',   accent: '#4f7a52', nameEn: 'botanical green' },
    { id: 'rose-coral',      labelKo: '로즈 코랄',       accent: '#e8556e', nameEn: 'soft rose coral' },
    { id: 'soft-pink',       labelKo: '소프트 핑크',     accent: '#d4788f', nameEn: 'muted rose pink' },
    { id: 'warm-beige',      labelKo: '웜 베이지',       accent: '#b08356', nameEn: 'warm sand beige' },
    { id: 'lavender',        labelKo: '라벤더',          accent: '#7d6bb0', nameEn: 'soft lavender' },
    { id: 'plum',            labelKo: '플럼',            accent: '#8e4f6e', nameEn: 'deep plum' },
    { id: 'luxe-charcoal',   labelKo: '럭스 차콜',       accent: '#3a3f4a', nameEn: 'charcoal slate' }
  ];

  /** 무드 keywords 는 카테고리 keywords 를 **대체하지 않고 뒤에 잇는다**(장면 문법 보존). */
  KG.MOODS = [
    { id: 'minimal-clean',  labelKo: '미니멀 클린',     keywords: 'minimal clean styling, generous negative space, soft even light, matte neutral props' },
    { id: 'clinical',       labelKo: '클리니컬',        keywords: 'clinical precision, cool neutral light, laboratory-clean surfaces, restrained styling' },
    { id: 'natural',        labelKo: '내추럴 보태니컬', keywords: 'natural botanical styling, organic textures, warm daylight, soft leaf shadows' },
    { id: 'luxury',         labelKo: '럭셔리',          keywords: 'quiet luxury, deep controlled shadows, polished stone and glass, restrained editorial palette' },
    { id: 'fresh',          labelKo: '프레시',          keywords: 'fresh hydrating feel, dew and water droplets, crisp bright light, translucent surfaces' },
    { id: 'pastel',         labelKo: '파스텔 소프트',   keywords: 'soft pastel palette, diffused light, gentle gradients, airy weightless mood' },
    { id: 'bold-editorial', labelKo: '볼드 에디토리얼', keywords: 'bold editorial styling, high-contrast light, graphic color blocking, confident composition' },
    { id: 'warm-daily',     labelKo: '웜 데일리',       keywords: 'warm everyday mood, soft morning light, lived-in cozy textures' }
  ];

  /** 추출 실패(coverage 부족) 시 카테고리별 폴백 팔레트. */
  KG.CATEGORY_FALLBACK = {
    skincare: 'neutral-greige', suncare: 'fresh-aqua', makeup: 'rose-coral',
    cleansing: 'botanical-green', haircare: 'lavender', etc: 'neutral-greige'
  };

  /** 팩 moodProfiles 의 카테고리 장면 키워드(정본: data/processed/detail-style-prompts.json). */
  KG.CATEGORY_KEYWORDS = {
    skincare: 'calm, clinical-clean, soft daylight, dewy texture, minimal props',
    suncare: 'bright outdoor light, fresh blue-white, water droplets, summer air, crisp',
    makeup: 'editorial studio light, saturated pigment, glossy swatch, playful color blocking',
    cleansing: 'clean bathroom light, foam and water, gentle pastel, hygienic',
    haircare: 'soft salon light, silky flow, warm neutral, glossy strands',
    etc: 'neutral studio light, clean minimal, soft shadow'
  };

  KG.paletteById = function (id) {
    for (var i = 0; i < KG.PALETTES.length; i++) if (KG.PALETTES[i].id === id) return KG.PALETTES[i];
    return KG.PALETTES[0];
  };
  KG.moodById = function (id) {
    for (var i = 0; i < KG.MOODS.length; i++) if (KG.MOODS[i].id === id) return KG.MOODS[i];
    return KG.MOODS[0];
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * 3. 색 추출 — 업로드한 **첫 장(제품 대표컷)** 에서만 뽑는다.
   *    2번째 장부터는 한국 상세페이지 원본이라 한국어 UI 색(빨강 세일 배너 등)이 섞여
   *    결과를 오염시킨다. 이 제약은 엔진에서도 코드로 못박는다.
   * ───────────────────────────────────────────────────────────────────────── */

  var EXTRACT = {
    size: 96,           // 다운스케일 한 변
    minS: 0.18,         // 이보다 채도가 낮으면 무채색(흰·회 배경)
    minV: 0.12,         // 이보다 어두우면 그림자
    hiV: 0.96, hiS: 0.30, // 밝고 채도 낮으면 하이라이트·화이트 스튜디오 배경
    buckets: 24,        // hue 15° 단위
    minCoverage: 0.03   // 유효 픽셀이 3% 미만이면 신뢰 불가 → 카테고리 폴백
  };
  KG.EXTRACT = EXTRACT;

  /**
   * 이미지에서 브랜드 accent 와 무드를 추정한다.
   * @param {HTMLImageElement|HTMLCanvasElement} source 로드가 끝난 이미지
   * @param {string} [category] 폴백에 쓸 상품 종류
   * @returns {{accent:string, moodId:string, coverage:number, ok:boolean, hue:number}}
   */
  KG.extractAccent = function (source, category) {
    var n = EXTRACT.size;
    var cv = document.createElement('canvas');
    cv.width = n; cv.height = n;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, n, n);

    var data;
    try {
      data = ctx.getImageData(0, 0, n, n).data;
    } catch (e) {
      // file:// 에서 원격 이미지를 그리면 캔버스가 오염된다 — 폴백으로 되돌린다
      return fallback(category, 0);
    }

    var bins = [], i;
    for (i = 0; i < EXTRACT.buckets; i++) bins.push({ w: 0, hs: [], ss: [], vs: [] });

    var total = n * n, kept = 0, sumS = 0, sumV = 0, vList = [];
    for (i = 0; i < data.length; i += 4) {
      var hsv = rgbToHsv(data[i], data[i + 1], data[i + 2]);
      sumS += hsv.s; sumV += hsv.v; vList.push(hsv.v);
      if (hsv.s < EXTRACT.minS) continue;
      if (hsv.v < EXTRACT.minV) continue;
      if (hsv.v > EXTRACT.hiV && hsv.s < EXTRACT.hiS) continue;
      kept += 1;
      // 채도가 높고 중간 밝기인 픽셀이 브랜드색일 확률이 높다
      var w = hsv.s * (1 - Math.abs(hsv.v - 0.55) * 0.8);
      var b = Math.min(EXTRACT.buckets - 1, Math.floor(hsv.h / (360 / EXTRACT.buckets)));
      bins[b].w += w;
      bins[b].hs.push(hsv.h); bins[b].ss.push(hsv.s); bins[b].vs.push(hsv.v);
    }

    var coverage = kept / total;
    var stats = imageStats(sumS / total, sumV / total, vList);
    if (coverage < EXTRACT.minCoverage) return fallback(category, coverage, stats);

    // 최대 버킷 + 좌우 인접 버킷 합산 — hue 경계에 걸쳐 분산된 색을 되모은다
    var best = 0;
    for (i = 1; i < bins.length; i++) if (bins[i].w > bins[best].w) best = i;
    var idx = [(best - 1 + bins.length) % bins.length, best, (best + 1) % bins.length];
    var hs = [], ss = [], vs = [];
    for (i = 0; i < idx.length; i++) {
      hs = hs.concat(bins[idx[i]].hs); ss = ss.concat(bins[idx[i]].ss); vs = vs.concat(bins[idx[i]].vs);
    }
    if (hs.length === 0) return fallback(category, coverage, stats);

    // hue 는 원형이라 최대 버킷 중심을 기준으로 ±180 로 펴서 중앙값을 낸다
    var center = (best + 0.5) * (360 / EXTRACT.buckets);
    var unwrapped = hs.map(function (h) {
      var d = h - center;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      return d;
    });
    var h = (center + median(unwrapped) + 360) % 360;
    var rgb = hsvToRgb(h, median(ss), median(vs));
    var accent = clampFill(rgbToHex(rgb.r, rgb.g, rgb.b), 1.6);

    return { accent: accent, moodId: suggestMood(stats, h), coverage: coverage, ok: true, hue: h };
  };

  function fallback(category, coverage, stats) {
    var p = KG.paletteById(KG.CATEGORY_FALLBACK[category] || 'neutral-greige');
    return {
      accent: p.accent,
      moodId: stats ? suggestMood(stats, rgbToHsv(hexToRgb(p.accent).r, hexToRgb(p.accent).g, hexToRgb(p.accent).b).h) : 'minimal-clean',
      coverage: coverage || 0,
      ok: false,
      hue: 0
    };
  }

  function median(arr) {
    if (arr.length === 0) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    return s[Math.floor(s.length / 2)];
  }

  function imageStats(meanS, meanV, vList) {
    var s = vList.slice().sort(function (a, b) { return a - b; });
    var p10 = s[Math.floor(s.length * 0.1)] || 0;
    var p90 = s[Math.floor(s.length * 0.9)] || 0;
    return { meanS: meanS, meanV: meanV, contrast: p90 - p10 };
  }

  /** 밝기·채도·대비·색상으로 무드를 추정한다. 제안일 뿐 사용자가 바꿀 수 있다. */
  function suggestMood(st, hue) {
    if (st.meanV > 0.82 && st.meanS < 0.25) return 'minimal-clean';
    if (st.meanV < 0.45) return 'luxury';
    if (st.contrast > 0.62 && st.meanS > 0.45) return 'bold-editorial';
    if (hue >= 150 && hue <= 210 && st.meanV > 0.7) return 'fresh';
    if (st.meanS < 0.35 && st.meanV > 0.7) return 'pastel';
    if (hue >= 60 && hue <= 150) return 'natural';
    return 'minimal-clean';
  }
  KG.suggestMood = suggestMood;

  /* ─────────────────────────────────────────────────────────────────────────
   * 3b. 데모용 제품컷 — 캔버스에 직접 그린다.
   *
   * 왜 파일이 아니라 그림인가: file:// 로 프로토를 열면 <img src="…jpg"> 를 캔버스에
   * 그리는 순간 오리진이 오염돼 getImageData 가 SecurityError 로 막힌다. 그러면 추출 데모가
   * 아예 안 돈다. 캔버스에 직접 그린 픽셀과 FileReader 의 data: URL 은 오염되지 않으므로,
   * 이 두 경로만 쓰면 **서버 없이도 추출 알고리즘이 진짜로 실행된다.**
   * (assets/samples/haruon-*.png 은 우리 자산이지만 이 제약 때문에 추출 입력으로는 못 쓴다)
   * ───────────────────────────────────────────────────────────────────────── */

  KG.SAMPLE_SHOTS = [
    { id: 'mint-tube',    labelKo: '민트 튜브',    bg: '#f4f6f5', body: '#3fb4a6', cap: '#2c8a80', shape: 'tube' },
    { id: 'amber-bottle', labelKo: '앰버 드로퍼',  bg: '#f7f1e8', body: '#b8762c', cap: '#5c4326', shape: 'bottle' },
    { id: 'plum-compact', labelKo: '플럼 컴팩트',  bg: '#2a242a', body: '#8e4f6e', cap: '#c98fae', shape: 'compact' }
  ];

  /**
   * 데모 제품컷을 그린다 — 흰(또는 어두운) 배경 + 제품 + 하이라이트·그림자.
   * 배경이 화면의 대부분을 차지하므로 추출 알고리즘의 제외 규칙이 실제로 시험된다.
   * @param {string} id KG.SAMPLE_SHOTS 의 id
   * @returns {HTMLCanvasElement}
   */
  KG.drawSampleShot = function (id) {
    var s = KG.SAMPLE_SHOTS.filter(function (x) { return x.id === id; })[0] || KG.SAMPLE_SHOTS[0];
    var n = 320, cv = document.createElement('canvas');
    cv.width = n; cv.height = n;
    var c = cv.getContext('2d');

    c.fillStyle = s.bg;
    c.fillRect(0, 0, n, n);

    // 바닥 그림자
    c.fillStyle = 'rgba(0,0,0,0.10)';
    c.beginPath();
    c.ellipse(n / 2, n * 0.80, n * 0.20, n * 0.035, 0, 0, Math.PI * 2);
    c.fill();

    var grad = c.createLinearGradient(n * 0.36, 0, n * 0.64, 0);
    grad.addColorStop(0, shade(s.body, -0.18));
    grad.addColorStop(0.42, s.body);
    grad.addColorStop(0.62, shade(s.body, 0.16));
    grad.addColorStop(1, shade(s.body, -0.10));
    c.fillStyle = grad;

    if (s.shape === 'tube') {
      roundRect(c, n * 0.38, n * 0.24, n * 0.24, n * 0.54, 10);
      c.fill();
      c.fillStyle = s.cap;
      roundRect(c, n * 0.40, n * 0.185, n * 0.20, n * 0.06, 4);
      c.fill();
    } else if (s.shape === 'bottle') {
      roundRect(c, n * 0.39, n * 0.32, n * 0.22, n * 0.46, 8);
      c.fill();
      c.fillStyle = s.cap;
      c.fillRect(n * 0.455, n * 0.17, n * 0.09, n * 0.16);
      roundRect(c, n * 0.43, n * 0.145, n * 0.14, n * 0.04, 3);
      c.fill();
    } else {
      c.beginPath();
      c.ellipse(n / 2, n * 0.52, n * 0.20, n * 0.20, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = s.cap;
      c.beginPath();
      c.ellipse(n / 2, n * 0.48, n * 0.13, n * 0.13, 0, 0, Math.PI * 2);
      c.fill();
    }

    // 유리 하이라이트 — 실제 제품컷의 반사광을 흉내내 하이라이트 제외 규칙을 시험한다
    c.fillStyle = 'rgba(255,255,255,0.34)';
    roundRect(c, n * 0.425, n * 0.30, n * 0.028, n * 0.32, 6);
    c.fill();
    return cv;
  };

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function shade(hex, t) {
    return t >= 0 ? mixWhite(hex, t) : darken(hex, -t);
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 4. 테마 해석 — accent 1개 → 파생 토큰 5종. 순서가 중요하다.
   * ───────────────────────────────────────────────────────────────────────── */

  /**
   * @param {{source:string, paletteId:string, customAccent:string, moodId:string, extracted:string}} bt
   * @param {string} [category]
   * @returns {object} 해석된 테마 — 프리셋 id 가 아니라 **실제 값**을 담는다.
   *   프리셋 테이블을 나중에 고쳐도 이미 생성된 자산의 재생성이 흔들리지 않는다(스냅샷 원칙).
   */
  KG.resolveTheme = function (bt, category) {
    var t = bt || {};
    var raw;
    if (t.source === 'custom') raw = normalizeHex(t.customAccent);
    else if (t.source === 'palette') raw = KG.paletteById(t.paletteId).accent;
    else raw = normalizeHex(t.extracted);
    if (!raw) raw = KG.paletteById(KG.CATEGORY_FALLBACK[category || 'skincare'] || 'neutral-greige').accent;

    var accent = clampFill(raw, 1.6);
    var accentTint = mixWhite(accent, 0.94);
    var surface = mixWhite(accent, 0.965);
    var accentStrong = deriveStrong(accent, accentTint, 4.5);
    var accentBand = deriveBand(accent, 4.5);
    var onAccent = bestOn(accentBand);
    var mood = KG.moodById(t.moodId);

    return {
      accent: accent,
      accentStrong: accentStrong,
      accentTint: accentTint,
      accentBand: accentBand,
      surface: surface,
      onAccent: onAccent,
      moodId: mood.id,
      moodLabel: mood.labelKo,
      moodKeywords: (KG.CATEGORY_KEYWORDS[category || 'skincare'] || KG.CATEGORY_KEYWORDS.etc) + ', ' + mood.keywords,
      source: t.source || 'auto',
      paletteId: t.paletteId || '',
      // 대비 감사값 — 화면이 그대로 배지로 쓴다
      bodyContrast: contrastRatio(accentStrong, accentTint),
      fillContrast: contrastRatio(accent, '#ffffff'),
      onAccentContrast: contrastRatio(onAccent, accentBand)
    };
  };

  /** 밴드 톤 4종 표면. 정본: 02-detail-converter-spec.md §2-6 */
  KG.surfaceFor = function (tone, th) {
    if (tone === 'tint') {
      // 밴드 배경은 th.surface(0.965 혼합)가 아니라 0.90 혼합이다.
      // surface 는 **AI 배경컷 프롬프트용 연한 색**이고, 그대로 밴드에 쓰면 흰색과 3.5% 차이라
      // 교대가 눈에 보이지 않는다 — 리듬 장치가 있는데 없는 것처럼 보이던 원인.
      return { bg: mixWhite(th.accent, 0.90), ink: '#202124', body: '#414245', mute: 'rgba(55,56,60,0.66)',
               accent: th.accentStrong, fill: th.accent, rule: mixWhite(th.accent, 0.74), card: '#ffffff' };
    }
    if (tone === 'accent') {
      // 배경은 원색이 아니라 accentBand — 4.5:1 이 나오도록 민 색이다.
      // 흰 글자는 코랄류에서 2.89:1 이라 큰 텍스트 기준(3:1)에도 미달한다 → bestOn 이 정한 글자색만 쓴다.
      return { bg: th.accentBand, ink: th.onAccent, body: th.onAccent, mute: fade(th.onAccent, 0.72),
               accent: th.onAccent, fill: th.onAccent, rule: fade(th.onAccent, 0.24), card: '#ffffff' };
    }
    if (tone === 'ink') {
      return { bg: '#202124', ink: '#ffffff', body: 'rgba(255,255,255,0.78)', mute: 'rgba(255,255,255,0.58)',
               accent: mixWhite(th.accent, 0.35), fill: mixWhite(th.accent, 0.2), rule: 'rgba(255,255,255,0.18)', card: '#2b2b30' };
    }
    return { bg: '#ffffff', ink: '#202124', body: '#414245', mute: 'rgba(55,56,60,0.61)',
             accent: th.accentStrong, fill: th.accent, rule: '#ebebeb', card: '#f7f7f8' };
  };

  function fade(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 5. 블록 카탈로그 — 팩(data/processed/detail-style-prompts.json)의 화면용 축약.
   *    tone/height/placement/chapter 는 이번 개정으로 팩에 추가할 필드의 초안이다.
   * ───────────────────────────────────────────────────────────────────────── */

  // glyph: 미니어처가 그릴 모양 · tone: 선호 톤(auto 면 교대 규칙이 정함)
  // h: 비주얼 높이 프리셋 · need: required|conditional|optional · ch: 챕터 오프너
  var B = [
    ['mall-promo-banner', '몰 프로모 배너',      'text',      'stat',     'accent', null,    'conditional', false],
    ['set-offer-table',   '세트·수량 오퍼표',    'text',      'table',    'auto',   null,    'conditional', false],
    ['hero-product',      '히어로 제품컷·캐치카피', 'hybrid',  'photo',    'paper',  'hero',  'required',    true],
    ['ranking-stack',     '랭킹·수상 스택',      'text',      'stat',     'auto',   null,    'conditional', false],
    ['cumulative-sales',  '누적 판매·리뷰 수',    'text',      'stat',     'ink',    null,    'conditional', false],
    ['problem-hook',      '문제 제기·공감',      'hybrid',    'photo',    'paper',  'band',  'required',    true],
    ['cause-structure',   '원인 구조화',         'text',      'list',     'auto',   null,    'optional',    false],
    ['before-after-diagram', '비교 도해',        'ai-visual', 'diagram',  'paper',  'strip', 'optional',    false],
    ['mechanism-explainer', '기전 도해',         'text',      'list',     'auto',   null,    'required',    true],
    ['ingredient-card',   '성분 카드',           'text',      'table',    'auto',   null,    'required',    true],
    ['quant-data-graph',  '정량 데이터·그래프',   'text',      'graph',    'ink',    null,    'conditional', false],
    ['test-evidence-label', '시험·근거 라벨',    'text',      'chips',    'auto',   null,    'conditional', false],
    ['point-list',        'POINT 나열',          'text',      'list',     'auto',   null,    'required',    true],
    ['spec-panel',        '스펙 수치 패널',       'text',      'stat',     'accent', null,    'required',    true],
    ['usage-scene',       '사용 씬',             'hybrid',    'photo',    'paper',  'band',  'optional',    true],
    ['free-from-badges',  '무첨가·프리 처방',     'text',      'chips',    'auto',   null,    'optional',    false],
    ['color-chip-grid',   '컬러 칩 그리드',       'text',      'swatches', 'paper',  null,    'conditional', true],
    ['color-chart-matrix', '컬러 차트 매트릭스',  'text',      'swatches', 'paper',  null,    'conditional', false],
    ['personal-color-look', '퍼스널컬러 룩',      'hybrid',    'photo',    'paper',  'band',  'conditional', false],
    ['lineup-compare-chart', '라인업 비교 차트',  'text',      'table',    'auto',   null,    'conditional', false],
    ['swatch-demo',       '발색·텍스처 시연',     'ai-visual', 'photo',    'paper',  'strip', 'conditional', false],
    ['how-to-use',        '사용법 STEP',         'text',      'list',     'auto',   null,    'optional',    true],
    ['brand-story',       '브랜드 스토리',        'hybrid',    'photo',    'paper',  'hero',  'optional',    true],
    ['texture-shot',      '텍스처·질감 컷',       'hybrid',    'photo',    'paper',  'strip', 'optional',    false],
    ['customer-review',   '리뷰·구매자 목소리',   'text',      'card',     'tint',   null,    'conditional', true],
    ['product-spec-table', '제품 스펙표',         'text',      'table',    'tint',   null,    'required',    true],
    ['footnote-block',    '각주 모음',           'text',      'note',     'paper',  null,    'required',    false]
  ];

  KG.BLOCKS = {};
  B.forEach(function (r) {
    KG.BLOCKS[r[0]] = {
      id: r[0], nameKo: r[1], renderKind: r[2], glyph: r[3],
      tone: r[4], heightPreset: r[5], necessity: r[6], chapterOpener: r[7]
    };
  });

  /** 비주얼 높이 프리셋(px) — 생성 크기 1024×1536(2:3)과 맞물린다. */
  KG.VISUAL_HEIGHT = { hero: 2000, band: 1500, strip: 1040 };
  /** 총 세로 상한. 이 값의 85%를 넘으면 높이 프리셋을 한 단계씩 강등한다. */
  KG.MAX_TOTAL_HEIGHT = 18000;
  KG.HEIGHT_GUARD_RATIO = 0.85;
  /** 하단 스크림 파라미터 — 정본: 02-detail-converter-spec.md §2-6 */
  KG.SCRIM = { ratio: 0.62, strength: 0.9, color: '18,18,20' };
  /** 톤 리듬 파라미터. */
  KG.TONE_RHYTHM = { maxAccent: 2, maxInk: 2, noAdjacentStrong: true, paperAroundVisual: true };

  KG.TEMPLATES = [
    { id: 'D1', slug: 'problem-solution-story', nameKo: '문제해결 서사형', category: 'skincare', categories: ['skincare', 'cleansing'],
      description: '고민을 먼저 합의시키고 원인·기전으로 해결을 설명한다.',
      platformFit: ['rakuten-official', 'rakuten-reseller', 'qoo10', 'amazon-jp'],
      seq: ['hero-product', 'problem-hook', 'cause-structure', 'before-after-diagram', 'mechanism-explainer',
            'test-evidence-label', 'point-list', 'texture-shot', 'how-to-use', 'product-spec-table', 'footnote-block'] },
    { id: 'D2', slug: 'ingredient-evidence', nameKo: '성분 근거형', category: 'skincare', categories: ['skincare'],
      description: '문제 제기 없이 성분명·농도·시험 근거로 바로 진입한다.',
      platformFit: ['rakuten-official', 'amazon-jp', 'qoo10'],
      seq: ['hero-product', 'ingredient-card', 'mechanism-explainer', 'quant-data-graph', 'test-evidence-label',
            'free-from-badges', 'point-list', 'how-to-use', 'product-spec-table', 'footnote-block'] },
    { id: 'D3', slug: 'spec-scene-trust', nameKo: '스펙·씬 신뢰형', category: 'suncare', categories: ['suncare'],
      description: '정량 스펙을 첫 화면에 세우고 사용 씬으로 신뢰를 쌓는다.',
      platformFit: ['rakuten-official', 'rakuten-reseller', 'qoo10', 'amazon-jp'],
      seq: ['hero-product', 'spec-panel', 'problem-hook', 'point-list', 'usage-scene', 'test-evidence-label',
            'free-from-badges', 'texture-shot', 'product-spec-table', 'footnote-block'] },
    { id: 'D4', slug: 'color-variation', nameKo: '컬러 배리에이션형', category: 'makeup', categories: ['makeup'],
      description: '전 색상 → 컬러 차트 → 퍼스널컬러로 색 선택을 돕는다.',
      platformFit: ['qoo10', 'rakuten-official', 'rakuten-reseller'],
      seq: ['color-chip-grid', 'hero-product', 'color-chart-matrix', 'personal-color-look', 'swatch-demo',
            'point-list', 'ingredient-card', 'product-spec-table', 'footnote-block'] },
    { id: 'D5', slug: 'gentle-convenience', nameKo: '저자극·편의형', category: 'cleansing', categories: ['cleansing'],
      description: '부담 없음·시간 절약을 코어로 무첨가·저자극 근거를 붙인다.',
      platformFit: ['rakuten-official', 'amazon-jp', 'qoo10'],
      seq: ['hero-product', 'problem-hook', 'point-list', 'free-from-badges', 'test-evidence-label',
            'how-to-use', 'texture-shot', 'product-spec-table', 'footnote-block'] },
    { id: 'D6', slug: 'brand-premium', nameKo: '브랜드 프리미엄형', category: 'skincare', categories: ['skincare', 'cleansing'],
      description: '브랜드 서사가 페이지를 지배한다. 배지·수치는 최소.',
      platformFit: ['rakuten-official', 'amazon-jp'],
      seq: ['brand-story', 'hero-product', 'mechanism-explainer', 'ingredient-card', 'texture-shot',
            'how-to-use', 'customer-review', 'product-spec-table', 'footnote-block'] }
  ];

  KG.templateById = function (id) {
    for (var i = 0; i < KG.TEMPLATES.length; i++) if (KG.TEMPLATES[i].id === id) return KG.TEMPLATES[i];
    return KG.TEMPLATES[0];
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * 6. 톤 리듬 — 시퀀스 전체를 받아 블록별 레이아웃을 낸다.
   *    톤 교대는 앞 블록에 의존하므로 블록 단위 순수 함수로는 만들 수 없다(접기 연산).
   *    같은 시퀀스 → 같은 결과. LLM 미개입, 완전 결정적.
   * ───────────────────────────────────────────────────────────────────────── */

  /** 텍스트 블록의 대략 높이(px) — 미니어처 비율과 총높이 가드에 쓴다. */
  var TEXT_HEIGHT = { stat: 620, head: 700, list: 1180, table: 980, chips: 620, graph: 900,
                      swatches: 780, card: 900, note: 520, diagram: 0, photo: 0 };

  /**
   * @param {string[]} ids 블록 id 시퀀스
   * @returns {Array<{id,def,tone,nextTone,placement,height,density,chapter,seam}>}
   */
  KG.planLayout = function (ids) {
    var defs = ids.map(function (id) { return KG.BLOCKS[id]; }).filter(Boolean);
    var isVisual = function (d) { return d && d.renderKind !== 'text'; };

    var out = [], accentUsed = 0, inkUsed = 0, prev = null;
    defs.forEach(function (d, i) {
      // 사진을 죽이는 건 tint(흰색과 3.5% 차이)가 아니라 **강한 색면**이다.
      // 초안의 "비주얼 인접은 paper 강제"는 tint 교대까지 막아 paper 가 11연속으로 이어졌다 —
      // 고치려던 문제를 그대로 재생산했다. 그래서 금지 대상을 accent·ink 로만 좁힌다.
      var nearVisual = isVisual(defs[i - 1]) || isVisual(defs[i + 1]);
      var strongPrev = prev === 'accent' || prev === 'ink';
      var strongOk = !nearVisual && !strongPrev;
      var tone;

      if (isVisual(d)) {
        // 사진이 밴드를 채운다. 이 톤은 배경컷 생성이 실패했을 때의 폴백 배경이다.
        tone = 'paper';
      } else if (d.tone === 'accent' && strongOk && accentUsed < KG.TONE_RHYTHM.maxAccent) {
        tone = 'accent';
      } else if (d.tone === 'ink' && strongOk && inkUsed < KG.TONE_RHYTHM.maxInk) {
        tone = 'ink';
      } else if (d.tone === 'paper') {
        tone = 'paper';
      } else if (d.tone === 'tint') {
        tone = prev === 'tint' ? 'paper' : 'tint';
      } else {
        // auto — paper 2연속 금지
        tone = prev === 'paper' ? 'tint' : 'paper';
      }

      if (tone === 'accent') accentUsed += 1;
      if (tone === 'ink') inkUsed += 1;
      prev = tone;

      out.push({
        id: d.id, def: d, tone: tone,
        placement: isVisual(d) ? (d.glyph === 'diagram' ? 'none' : 'scrim-bottom') : 'inset',
        heightPreset: d.heightPreset,
        height: d.heightPreset ? KG.VISUAL_HEIGHT[d.heightPreset] : (TEXT_HEIGHT[d.glyph] || 800),
        density: 'normal', chapter: null, seam: 'none'
      });
    });

    // 총 높이 가드 — 넘치면 프리셋을 한 단계 강등한다.
    // 안 하면 결합 단계가 뒤쪽 블록을 잘라내고 **각주 블록이 사라진다**.
    var guard = KG.MAX_TOTAL_HEIGHT * KG.HEIGHT_GUARD_RATIO, pass = 0;
    while (totalHeight(out) > guard && pass < 2) {
      out.forEach(function (b) {
        if (b.heightPreset === 'hero') { b.heightPreset = 'band'; b.height = KG.VISUAL_HEIGHT.band; }
        else if (b.heightPreset === 'band') { b.heightPreset = 'strip'; b.height = KG.VISUAL_HEIGHT.strip; }
      });
      pass += 1;
    }

    // 챕터 인덱스 · 이음새 · 밀도
    var chapters = out.filter(function (b) { return b.def.chapterOpener; }).length;
    var n = 0;
    out.forEach(function (b, i) {
      if (b.def.chapterOpener) { n += 1; b.chapter = { index: n, total: chapters }; b.density = 'spacious'; }
      else if (out[i - 1] && !out[i - 1].def.chapterOpener) b.density = 'compact';
      var next = out[i + 1];
      b.nextTone = next ? next.tone : null;
      b.seam = next && next.tone !== b.tone && b.placement === 'inset' ? 'notch' : 'none';
    });
    return out;
  };

  function totalHeight(list) {
    return list.reduce(function (s, b) { return s + b.height; }, 0);
  }
  KG.totalHeight = totalHeight;

  /** 톤 구성 요약 문자열 — "paper 6 · tint 4 · accent 2 · ink 1" */
  KG.toneSummary = function (layout) {
    var c = { paper: 0, tint: 0, accent: 0, ink: 0 };
    layout.forEach(function (b) { c[b.tone] += 1; });
    return ['paper', 'tint', 'accent', 'ink']
      .filter(function (k) { return c[k] > 0; })
      .map(function (k) { return k + ' ' + c[k]; })
      .join(' · ');
  };

  KG.TONE_LABEL = { paper: '기본', tint: '틴트', accent: '강조', ink: '다크' };

  /* ─────────────────────────────────────────────────────────────────────────
   * 7. 미니어처 SVG — blockSequence 로부터 그린다. 정적 이미지가 아니므로
   *    테마 컬러를 바꾸면 즉시 다시 칠해지고, 시퀀스를 바꾸면 즉시 다시 그려진다.
   * ───────────────────────────────────────────────────────────────────────── */

  var MW = 120; // 미니어처 좌표계 폭

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function rect(x, y, w, h, fill, r) {
    return '<rect x="' + x + '" y="' + y + '" width="' + Math.max(0, w) + '" height="' + Math.max(0, h) +
           '" fill="' + esc(fill) + '"' + (r ? ' rx="' + r + '"' : '') + '/>';
  }

  /**
   * @param {string[]} ids 블록 시퀀스
   * @param {object} th resolveTheme() 결과
   * @param {{maxHeight?:number}} [opt]
   * @returns {string} SVG 마크업
   */
  KG.miniature = function (ids, th, opt) {
    var o = opt || {};
    var layout = KG.planLayout(ids);
    var unit = 1 / 46; // 실제 px → 미니어처 단위
    var y = 0, parts = [];

    layout.forEach(function (b) {
      var sf = KG.surfaceFor(b.tone, th);
      var h = Math.max(7, Math.round(b.height * unit));
      if (b.placement === 'scrim-bottom' || b.def.glyph === 'photo') {
        parts.push(photoBand(y, h, th, b));
      } else {
        parts.push(rect(0, y, MW, h, sf.bg));
        parts.push(bandContent(y, h, sf, th, b));
      }
      y += h;
    });

    var total = y;
    var view = o.maxHeight ? Math.min(total, o.maxHeight) : total;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + MW + ' ' + view +
           '" width="' + MW + '" height="' + view + '" preserveAspectRatio="xMidYMin slice" role="img" ' +
           'aria-label="상세페이지 구성 미리보기">' +
           rect(0, 0, MW, total, '#ffffff') + parts.join('') + '</svg>';
  };

  /** 풀블리드 사진 밴드 + 하단 스크림 위 흰 글자 — 이번 개정의 핵심 문법. */
  function photoBand(y, h, th, b) {
    var gid = 'g' + Math.round(y) + '-' + b.id.replace(/[^a-z]/g, '');
    var scrimH = Math.round(h * KG.SCRIM.ratio);
    var s = '<defs>' +
      '<linearGradient id="p' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="' + esc(mixWhite(th.accent, 0.62)) + '"/>' +
        '<stop offset="100%" stop-color="' + esc(mixWhite(th.accent, 0.14)) + '"/>' +
      '</linearGradient>' +
      '<linearGradient id="s' + gid + '" x1="0" y1="1" x2="0" y2="0">' +
        '<stop offset="0%" stop-color="rgba(18,18,20,' + KG.SCRIM.strength + ')"/>' +
        '<stop offset="45%" stop-color="rgba(18,18,20,' + (KG.SCRIM.strength * 0.55).toFixed(2) + ')"/>' +
        '<stop offset="100%" stop-color="rgba(18,18,20,0)"/>' +
      '</linearGradient></defs>';
    s += rect(0, y, MW, h, 'url(#p' + gid + ')');
    // 제품 실루엣 자리(사진이 들어가는 영역임을 알리는 최소 표시)
    s += '<ellipse cx="' + (MW * 0.68) + '" cy="' + (y + h * 0.42) + '" rx="' + (MW * 0.11) +
         '" ry="' + (h * 0.24) + '" fill="rgba(255,255,255,0.5)"/>';
    if (b.placement === 'none') return s;
    s += rect(0, y + h - scrimH, MW, scrimH, 'url(#s' + gid + ')');
    // 스크림 위 흰 카피 — 카드가 아니라 사진에 직접 얹는다
    s += rect(9, y + h - 20, 46, 4, 'rgba(255,255,255,0.95)', 1);
    s += rect(9, y + h - 14, 66, 3, 'rgba(255,255,255,0.78)', 1);
    s += rect(9, y + h - 9, 38, 2.4, 'rgba(255,255,255,0.55)', 1);
    return s;
  }

  /** 텍스트 밴드 — 글리프별로 다른 짜임을 그린다(전부 같은 카드로 보이지 않게). */
  function bandContent(y, h, sf, th, b) {
    var p = 9, s = '', i;
    var top = y + 7;

    // 챕터 레일 + 인덱스 — 반복되는 Eyebrow 대신 페이지의 뼈대를 만든다
    if (b.chapter) {
      s += rect(p, top, 2, h - 14, sf.fill, 1);
      s += rect(p + 5, top + 1, 8, 2.4, sf.accent, 1);
      s += rect(p + 5, top + 6, 40, 4.2, sf.ink, 1);
      top += 14;
    } else {
      s += rect(p, top, 30, 3.4, sf.accent, 1);
      top += 8;
    }

    var g = b.def.glyph;
    if (g === 'stat') {
      // 디스플레이 타이포 — 숫자 블록은 크게. 전부 코드 소유 슬롯이라 AI 콜 0
      s += rect(p, top, 52, 13, sf.ink, 1.5);
      s += rect(p + 56, top + 5, 30, 3, sf.mute, 1);
      s += rect(p, top + 18, 74, 2.6, sf.body, 1);
    } else if (g === 'list') {
      for (i = 0; i < 3; i++) {
        var ly = top + i * 12;
        s += rect(p, ly, 13, 6, sf.fill, 3);
        s += rect(p + 16, ly, 52, 3.4, sf.ink, 1);
        s += rect(p + 16, ly + 5.5, 78, 2.6, sf.body, 1);
      }
    } else if (g === 'table') {
      s += rect(p, top, MW - p * 2, 1.4, sf.ink);
      for (i = 0; i < 4; i++) {
        var ty = top + 5 + i * 8;
        s += rect(p, ty, 26, 2.8, sf.mute, 1);
        s += rect(p + 32, ty, 54, 2.8, sf.ink, 1);
        s += rect(p, ty + 5.5, MW - p * 2, 0.7, sf.rule);
      }
    } else if (g === 'chips') {
      var cx = p;
      [26, 34, 22, 30].forEach(function (w) {
        if (cx + w > MW - p) { cx = p; top += 10; }
        s += '<rect x="' + cx + '" y="' + top + '" width="' + w + '" height="8" rx="4" fill="none" stroke="' +
             esc(sf.fill) + '" stroke-width="1"/>';
        cx += w + 5;
      });
    } else if (g === 'graph') {
      [92, 64, 41].forEach(function (w, k) {
        var gy = top + k * 10;
        s += rect(p, gy, 18, 2.6, sf.mute, 1);
        s += rect(p + 21, gy - 1.5, MW - p * 2 - 21, 6, sf.rule, 3);
        s += rect(p + 21, gy - 1.5, (MW - p * 2 - 21) * w / 100, 6, sf.fill, 3);
      });
    } else if (g === 'swatches') {
      for (i = 0; i < 10; i++) {
        var hue = (i * 34) % 360;
        var c = hsvToRgb(hue, 0.55, 0.86);
        s += '<circle cx="' + (p + 6 + (i % 5) * 21) + '" cy="' + (top + 6 + Math.floor(i / 5) * 19) +
             '" r="6.5" fill="' + esc(rgbToHex(c.r, c.g, c.b)) + '"/>';
      }
    } else if (g === 'card') {
      s += rect(p, top, MW - p * 2, 26, sf.card, 3);
      s += rect(p + 5, top + 5, 34, 3, sf.accent, 1);
      s += rect(p + 5, top + 11, 88, 2.6, sf.body, 1);
      s += rect(p + 5, top + 16, 70, 2.6, sf.body, 1);
    } else if (g === 'note') {
      for (i = 0; i < 3; i++) s += rect(p, top + i * 5, 96 - i * 14, 2, sf.mute, 1);
    } else {
      s += rect(p, top, 82, 5, sf.ink, 1);
      s += rect(p, top + 9, MW - p * 2, 2.8, sf.body, 1);
      s += rect(p, top + 14, 88, 2.8, sf.body, 1);
    }

    // 이음새 노치 — 다음 밴드 색의 삼각형. 블록 안에서 완결된다(결합은 맞대기라 겹칠 수 없다)
    if (b.seam === 'notch' && b.nextTone) {
      var nb = KG.surfaceFor(b.nextTone, th).bg;
      var cxm = MW / 2, by = y + h;
      s += '<polygon points="' + (cxm - 5) + ',' + by + ' ' + (cxm + 5) + ',' + by + ' ' + cxm + ',' + (by - 4) +
           '" fill="' + esc(nb) + '"/>';
    }
    return s;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 8. 화면 간 상태 공유 — 3에서 고른 테마가 4·5에 그대로 이어진다.
   * ───────────────────────────────────────────────────────────────────────── */

  var KEY = 'kglow.detail.proto';

  KG.defaultState = function () {
    return {
      category: 'skincare', platform: 'rakuten-official', templateId: 'D1',
      theme: { source: 'auto', paletteId: 'rose-coral', customAccent: '', moodId: 'minimal-clean', extracted: '' },
      extractedFrom: '', coverage: 0, disabled: []
    };
  };

  KG.load = function () {
    var d = KG.defaultState();
    try {
      var raw = global.localStorage && global.localStorage.getItem(KEY);
      if (!raw) return d;
      var v = JSON.parse(raw);
      return {
        category: v.category || d.category, platform: v.platform || d.platform,
        templateId: v.templateId || d.templateId,
        theme: Object.assign({}, d.theme, v.theme || {}),
        extractedFrom: v.extractedFrom || '', coverage: v.coverage || 0,
        disabled: Array.isArray(v.disabled) ? v.disabled : []
      };
    } catch (e) { return d; }
  };

  KG.save = function (state) {
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 프라이빗 모드 등 — 무시 */ }
  };

  /** 이 프로토가 다루는 시퀀스 — 템플릿 + 조건부 레이어(프로모·실적)를 펼친 결과. */
  KG.sequenceFor = function (state) {
    var t = KG.templateById(state.templateId);
    var head = [];
    // amazon-jp 는 A+ 규정상 가격·프로모션 표기 금지 → 프로모 레이어 통째 제외
    if (state.platform !== 'amazon-jp') head = head.concat(['mall-promo-banner', 'set-offer-table']);
    head = head.concat(['ranking-stack', 'cumulative-sales']);
    var all = head.concat(t.seq);
    return all.filter(function (id) { return state.disabled.indexOf(id) === -1; });
  };

  /* ══ 입력 언어 변환 (콜⑧) — 검사기는 lib/studio/detail/translate.ts 와 동일 ══════
     프로토가 곧 스펙이므로 판정식을 다시 쓰지 않고 **같은 규칙**을 옮긴다.
     계약 정본은 ../02-detail-converter-spec.md §2-9. ─────────────────────────── */

  /** 완성형뿐 아니라 자모 단독도 잡는다 — 자모는 JP 폰트 cmap 에 있어 커버리지 검사를 통과한다. */
  KG.hasHangul = function (text) {
    return /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힣ힰ-퟿]/.test(text || '');
  };

  /**
   * 숫자 지문 — 표기 형식은 무시하고 수치만 본다.
   * 천단위 쉼표 제거 → 숫자 런 추출 → 앞자리 0 제거. 날짜 재구성(2026.04.15 → 2026年4月15日)은
   * 통과하고, 값이 실제로 바뀌면 갈린다.
   */
  KG.digitSignature = function (text) {
    var n = String(text || '')
      .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); })
      .replace(/[,，]/g, '');
    return (n.match(/\d+/g) || []).map(function (t) { return t.replace(/^0+(?=\d)/, ''); }).join(',');
  };

  KG.numbersPreserved = function (kr, ja) {
    return KG.digitSignature(kr) === KG.digitSignature(ja);
  };

  /** 변환 1건 검사 — 실패해도 값은 남기고 사유를 붙인다(사용자가 보고 고친다). */
  KG.verifyTranslation = function (field, jaRaw) {
    var ja = String(jaRaw || '').trim();
    var out = { path: field.path, label: field.label, kr: field.kr, kind: field.kind, via: field.via || 'llm', ja: ja, ok: true };
    if (!ja) { out.ja = field.kr; out.ok = false; out.problem = '변환 결과가 비어 있습니다.'; return out; }
    if (KG.hasHangul(ja)) {
      out.ok = false;
      out.problem = field.kind === 'artDirection' ? '한글이 남아 있습니다.' : '한글이 남아 있습니다 — 직접 일본어로 입력해 주세요.';
      return out;
    }
    if (field.kind !== 'artDirection' && !KG.numbersPreserved(field.kr, ja)) {
      out.ok = false;
      out.problem = '숫자가 원문과 다릅니다(원문 ' + field.kr + '). 값이 바뀌면 표시 위반이 됩니다.';
    }
    return out;
  };

  /**
   * 확인 화면 시연용 데모 변환 결과.
   * 일부러 **실패 2건**을 섞었다 — 전부 성공하는 데모는 이 화면의 존재 이유(사람이 확인하는 자리)를
   * 보여주지 못한다. `regulated` 2건과 실패분은 접히지 않고 항상 펼쳐진다.
   */
  KG.DEMO_TRANSLATION = [
    { path: 'spec.category', label: '구분(区分)', kind: 'regulated', via: 'kubun', kr: '의약외품', ja: '医薬部外品' },
    { path: 'spec.fullIngredients', label: '전성분(全成分)', kind: 'regulated', via: 'llm', kr: '정제수, 부틸렌글라이콜, 글리세린, 나이아신아마이드', ja: '水、BG、グリセリン、ナイアシンアミド' },
    { path: 'sales.count', label: '누적 판매', kind: 'numeric', via: 'llm', kr: '누적 163,991개', ja: '累計163,000個' },
    { path: 'spec.manufacturer', label: '판매원', kind: 'free', via: 'glossary', kr: '주식회사 하루온', ja: '株式会社HARUON' },
    { path: 'ingredients[0].name', label: '성분 1 성분명', kind: 'free', via: 'llm', kr: '나이아신아마이드', ja: 'ナイアシンアミド' },
    { path: 'ingredients[0].purpose', label: '성분 1 배합 목적', kind: 'free', via: 'llm', kr: '피부결 정돈', ja: '整肌成分' },
    { path: 'cautions[0]', label: '주의사항 1', kind: 'free', via: 'llm', kr: '상처 부위에는 사용하지 마세요.', ja: '傷やはれもの、湿疹等、異常のある部位にはお使いにならないでください。' },
    { path: 'cautions[1]', label: '주의사항 2', kind: 'free', via: 'llm', kr: '이상이 생기면 사용을 중지하세요.', ja: '이상이 생기면 사용을 중지하세요.' },
    { path: 'reviews[0].text', label: '리뷰 1 본문', kind: 'free', via: 'llm', kr: '끈적임 없이 좋아요', ja: 'べたつかず、使い心地がよいです' },
    { path: 'reviews[0].age', label: '리뷰 1 연령대', kind: 'numeric', via: 'llm', kr: '30대', ja: '30代' },
    { path: 'note', label: '추가 요청', kind: 'artDirection', via: 'llm', kr: '전체적으로 더 밝고 화사하게', ja: 'Brighter and airier overall, with soft daylight and a clean, luminous finish.' }
  ].map(function (f) { return KG.verifyTranslation(f, f.ja); });

  global.KG = KG;
})(window);

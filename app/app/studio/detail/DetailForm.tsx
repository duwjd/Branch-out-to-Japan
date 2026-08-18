'use client';

/**
 * 상세페이지 생성 퍼널(DETAIL-02~08) + 블록 구성 확인(CONFIRM-01~05).
 *
 * 한 페이지 2단계로 둔 이유: 확인 단계를 별도 라우트로 빼면 업로드한 파일을 다시 받아야 한다.
 * 확인 단계는 부작용 없는 미리보기 라우트(/api/studio/detail/plan)를 호출하므로,
 * 되돌아가도 서버에 쓰레기 파일이 남지 않는다.
 *
 * 클라이언트 검증은 서버(lib/server/detailForm)와 동일 규칙 이중 적용.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PLATFORMS, PLATFORM_LABELS, type Platform } from '@/lib/studio/platform';
// 타입만 가져온다(컴파일 시 소거) — detailReadiness 는 node:fs 를 쓰는 서버 모듈이다
import type { DetailReadiness } from '@/lib/server/detailReadiness';
import {
  SectionCard,
  StatusBadge,
  buttonClass,
  cardClass,
  chipClass,
  fieldLabelClass,
  inputClass,
} from '@/components/ui/primitives';
// 순수 함수 잎 노드(node:fs 미사용) — 확인 패널이 서버와 **같은 검사**를 즉시 돌린다
import { verifyTranslation, type TranslatedField } from '@/lib/studio/detail/translate';
import { IconChevronDown, IconChevronUp, IconUpload } from '@/components/ui/icons';
import { EXPIRED_LOGIN_PATH } from '@/components/auth/authUtils';

interface TemplateCard {
  id: string;
  slug: string;
  nameKo: string;
  description: string;
  bestFor: string;
  platformFit: string[];
  /** 추천 배지 판정에 쓴다 — 플랫폼만 보면 라쿠텐에서 6장 전부에 배지가 붙는다 */
  dominantCategories: string[];
  sequencePreview: string[];
  /** `npm run detail:previews` 산출물(전체 세로 스트립) — 확대 모달용. 없으면 카드가 블록 목록만 보여준다 */
  previewSrc: string | null;
  /** 같은 산출물의 카드용 상단 크롭본(148×336) — 그리드는 이걸 쓴다 */
  cardSrc: string | null;
}

interface PlanBlock {
  blockId: string;
  code: string;
  nameKo: string;
  renderKind: 'text' | 'ai-visual' | 'hybrid';
  layer: 'promo' | 'proof' | 'option' | null;
  signature: boolean;
  required: boolean;
}

interface PlanExcluded {
  blockId: string;
  code: string;
  nameKo: string;
  reason: string;
  fixHint: string | null;
}

interface PlanResult {
  templateId: string;
  aiBlockCount: number;
  estimateSeconds: number;
  imageMode: 'real' | 'mock';
  output: { width: number; sliceHeight: number; note: string };
  blocks: PlanBlock[];
  excluded: PlanExcluded[];
  /** 한글 입력이 없으면 null — 그때는 변환 패널 자체가 뜨지 않는다 */
  translation: { fields: TranslatedField[]; artDirectionEn: string } | null;
  translationError: string | null;
  /** 한글은 있는데 비회원이라 변환을 미룬 상태(유료 콜은 로그인 뒤로) */
  translationNeedsLogin: boolean;
}

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'skincare', label: '스킨케어' },
  { id: 'suncare', label: '선케어' },
  { id: 'makeup', label: '색조' },
  { id: 'cleansing', label: '클렌징' },
  { id: 'haircare', label: '헤어' },
  { id: 'etc', label: '기타' },
];

const OPTION_AXES: { id: string; label: string }[] = [
  { id: 'color', label: '색상' },
  { id: 'size', label: '용량·사이즈' },
  { id: 'set', label: '세트·수량' },
  { id: 'variant', label: '종류' },
];

const FIT_LABELS: Record<string, string> = {
  'amazon-jp': '아마존JP',
  'rakuten-official': '라쿠텐 공식샵',
  'rakuten-reseller': '라쿠텐 리셀러',
  qoo10: 'Qoo10',
};

const MAX_IMAGES = 10;

export function DetailForm({ templates, readiness }: { templates: TemplateCard[]; readiness: DetailReadiness }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [platform, setPlatform] = useState<Platform>('unset');
  const [category, setCategory] = useState<string>('skincare');
  const [optionAxis, setOptionAxis] = useState<string>('color');
  const [openEvidence, setOpenEvidence] = useState(false);
  const [openOption, setOpenOption] = useState(false);
  const [openPromo, setOpenPromo] = useState(false);

  const [plan, setPlan] = useState<PlanResult | null>(null);
  // 변환 결과는 plan 과 따로 둔다 — 사용자가 패널에서 고친 값이 여기 쌓이고, 그대로 제출된다
  const [translation, setTranslation] = useState<TranslatedField[]>([]);
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 템플릿 프리뷰 확대 — 카드는 상단만 보여주므로 전체를 볼 길이 있어야 한다 */
  const [zoom, setZoom] = useState<TemplateCard | null>(null);

  const selected = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);
  const amazonSelected = platform === 'amazon-jp';

  /**
   * 미리보기 blob URL 교체 — 이전 URL을 revoke 한다.
   * 매번 전체를 재생성하면서 revoke 하지 않으면 파일을 추가·삭제할 때마다 원본 크기만큼
   * blob 이 브라우저에 쌓인다(10MB × 10장 기준으로 금방 눈에 띈다).
   */
  const replacePreviews = useCallback((next: File[]) => {
    setPreviews((prev) => {
      for (const url of prev) URL.revokeObjectURL(url);
      return next.map((f) => URL.createObjectURL(f));
    });
  }, []);

  const acceptFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files, ...Array.from(incoming)].slice(0, MAX_IMAGES);
    setFiles(next);
    replacePreviews(next);
    setError(null);
  }, [files, replacePreviews]);

  const removeFile = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    replacePreviews(next);
  };

  /**
   * 폼 → FormData. 미리보기와 제출이 같은 필드를 보낸다(서버가 같은 파서를 쓴다).
   *
   * `withImages: false` 는 구성 미리보기(plan)용 — 파일 바이트 대신 메타(형식·크기)만 보낸다.
   * plan 라우트는 이미지를 저장하지도 읽지도 않고 개수·형식·크기만 쓰는데, 예전에는 블록 배지를
   * 한 번 토글할 때마다 원본 전체(최대 10장 × 10MB)를 다시 올리고 서버가 버렸다.
   */
  const buildFormData = useCallback(
    (opts?: { withTranslation?: boolean; withImages?: boolean }): FormData | null => {
      const el = formRef.current;
      if (!el) return null;
      const fd = new FormData(el);
      fd.delete('images');
      if (opts?.withImages === false) {
        fd.set('imageMeta', JSON.stringify(files.map((f) => ({ type: f.type, size: f.size }))));
      } else {
        for (const f of files) fd.append('images', f);
      }
      fd.set('platform', platform);
      fd.set('productCategory', category);
      fd.set('templateId', templateId);
      fd.set('optionAxis', optionAxis);
      fd.set('disabledBlocks', [...disabled].join(','));
      // 원문(kr)을 함께 보낸다 — 서버가 현재 입력과 대조해, 입력이 바뀌었으면 캐시를 버리고
      // 다시 번역한다. 이게 없으면 숫자 없는 필드에서 엉뚱한 일본어가 조용히 들어간다.
      if (opts?.withTranslation && translation.length > 0) {
        fd.set('translationJson', JSON.stringify(translation.map((t) => ({ path: t.path, kr: t.kr, ja: t.ja }))));
      }
      return fd;
    },
    [files, platform, category, templateId, optionAxis, disabled, translation],
  );

  /** 1단계 → 확인 단계. 서버가 계산한 구성을 그대로 보여준다(화면이 따로 추론하지 않는다). */
  const handlePreview = async () => {
    // 입력이 바뀌었을 수 있으므로 캐시를 보내지 않는다 — 서버가 새로 번역한다
    const fd = buildFormData({ withImages: false });
    if (!fd) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/studio/detail/plan', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '구성을 확인하지 못했습니다.');
        return;
      }
      const next = data as PlanResult;
      setPlan(next);
      setTranslation(next.translation?.fields ?? []);
      setStep('confirm');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = useCallback(async () => {
    const fd = buildFormData({ withTranslation: true });
    if (!fd) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/studio/detail', { method: 'POST', body: fd });
      if (res.status === 401) {
        setBusy(false);
        router.replace(EXPIRED_LOGIN_PATH); // 세션 만료 — 서비스 안에는 로그인 동선이 없다
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '생성을 시작하지 못했습니다.');
        return;
      }
      router.push(`/app/studio/detail/${data.id}`);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }, [buildFormData, router]);

  // 제출 가능 조건 — 서버와 같은 규칙
  let guidance = '이미지와 템플릿을 고르면 구성을 미리 볼 수 있어요.';
  let canPreview = true;
  if (files.length === 0) {
    guidance = '제품 이미지를 1장 이상 올려 주세요. 한국 상세페이지 원본을 함께 올리면 더 정확해집니다.';
    canPreview = false;
  } else if (!templateId) {
    guidance = '템플릿을 1개 선택해 주세요.';
    canPreview = false;
  }

  /** 확인 화면에서 블록 on/off — 필수 블록은 끌 수 없다 */
  const toggleBlock = (b: PlanBlock) => {
    if (b.required) return;
    const next = new Set(disabled);
    if (next.has(b.blockId)) next.delete(b.blockId);
    else next.add(b.blockId);
    setDisabled(next);
  };

  // 확인 단계에서 블록을 껐다 켜면 서버 계산을 다시 받아야 한다.
  // 변환 결과는 함께 보내 재번역을 막는다 — 블록 on/off 는 입력을 바꾸지 않는다.
  const refreshPlan = async () => {
    const fd = buildFormData({ withTranslation: true, withImages: false });
    if (!fd) return;
    const res = await fetch('/api/studio/detail/plan', { method: 'POST', body: fd });
    if (!res.ok) return;
    const next = (await res.json()) as PlanResult;
    setPlan(next);
    if (next.translation) setTranslation(next.translation.fields);
  };

  return (
    <main className="pb-32">
      <div className="mx-auto max-w-[1280px] px-8 pt-[72px] max-sm:px-5">
        <header>
          <Link
            href="/app/studio"
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink-mute no-underline transition-colors hover:text-ink"
          >
            <span aria-hidden>←</span> 마케팅 스튜디오
          </Link>
          <h1 className="mt-3 text-[26px] font-bold leading-tight text-ink">상세페이지 만들기</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-mute [text-wrap:pretty]">
            블록을 하나씩 만들어 세로로 이어 붙입니다. 글자는 전부 폰트로 그리므로 일본어가 깨지지 않습니다.
          </p>
        </header>

        <ReadinessNotice readiness={readiness} />

        {step === 'confirm' && plan ? (
          <ConfirmStep
            plan={plan}
            disabled={disabled}
            translation={translation}
            onEditTranslation={(path, ja) =>
              setTranslation((prev) =>
                // 서버가 제출 때 쓰는 것과 **같은 함수**로 즉시 재검사한다 —
                // 화면의 경고와 서버의 채택 여부가 갈리면 사용자가 고칠 수 없다
                prev.map((t) => (t.path === path ? { ...verifyTranslation(t, ja), via: t.via } : t)),
              )
            }
            onToggle={async (b) => {
              toggleBlock(b);
              // 상태 반영 후 서버 재계산 — setState 배치를 피하려 다음 틱에 호출
              setTimeout(() => void refreshPlan(), 0);
            }}
            onBack={() => setStep('form')}
          />
        ) : null}

        {/* 입력 폼 — 확인 단계에서도 DOM에 남겨 FormData 를 유지한다 */}
        <form ref={formRef} className={step === 'confirm' ? 'hidden' : ''} onSubmit={(e) => e.preventDefault()}>
          {/* DETAIL-02 원본 이미지 */}
          <SectionCard step={1} title="원본 이미지" pill="required" desc="제품컷 1장은 필수입니다. 한국 상세페이지 원본을 위→아래 순서로 함께 올리면 갭 진단에 씁니다. 최대 10장.">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                acceptFiles(e.dataTransfer.files);
              }}
              className="rounded-xl border border-dashed border-input-border p-6 text-center"
            >
              <input
                ref={fileRef}
                type="file"
                name="images"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => acceptFiles(e.target.files)}
              />
              <button type="button" onClick={() => fileRef.current?.click()} className={buttonClass('secondary', 'md')}>
                <IconUpload /> 이미지 선택
              </button>
              <p className="mt-2 text-xs text-ink-mute">JPG · PNG · WebP · 10MB 이하</p>
            </div>
            {previews.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-3">
                {previews.map((src, i) => (
                  <li key={src} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- blob 미리보기 */}
                    <img src={src} alt={`업로드 ${i + 1}`} className="h-24 w-24 rounded-lg border border-card-border object-cover" />
                    <span className="absolute left-1 top-1 rounded bg-ink/70 px-1.5 text-[11px] font-bold text-white">{i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      aria-label={`${i + 1}번 이미지 제거`}
                      className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-ink text-xs text-white"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* DETAIL-03 카테고리·플랫폼 */}
          <SectionCard step={2} title="상품 종류 · 타깃 플랫폼" pill="required" desc="상품 종류가 템플릿과 이미지 분위기를 정합니다.">
            <p className={fieldLabelClass}>상품 종류</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={chipClass(category === c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
            <p className={`${fieldLabelClass} mt-5`}>타깃 플랫폼</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button key={p} type="button" onClick={() => setPlatform(p)} className={chipClass(platform === p)}>
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
            {amazonSelected && (
              <p className="mt-3 rounded-lg bg-amber-bg px-3 py-2 text-[13px] leading-relaxed text-amber-text">
                아마존JP A+ 콘텐츠는 가격·프로모션 표기가 규정상 금지라, 프로모션 블록은 넣지 않습니다.
              </p>
            )}
          </SectionCard>

          {/* DETAIL-04 템플릿 */}
          <SectionCard
            step={3}
            title="템플릿"
            pill="required"
            desc="상세페이지는 순서가 핵심입니다. 미리보기는 이 템플릿을 실제로 돌려 만든 결과입니다."
          >
            <ul className="grid gap-3 sm:grid-cols-2">
              {templates.map((t) => {
                const active = t.id === templateId;
                // 플랫폼만 보면 라쿠텐에서 6장 전부에 배지가 붙어 아무것도 구분하지 못한다
                const fits =
                  platform !== 'unset' && t.platformFit.includes(platform) && t.dominantCategories.includes(category);
                return (
                  // 확대 버튼은 선택 버튼 **바깥**에 둔다 — 버튼 안에 버튼을 넣으면 유효하지 않은
                  // 마크업이고, 스크린리더가 두 조작을 하나로 읽는다
                  <li key={t.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setTemplateId(t.id)}
                      aria-pressed={active}
                      className={`${cardClass} flex w-full gap-3.5 p-4 text-left transition ${active ? 'border-coral ring-2 ring-coral/25' : 'hover:border-input-border'}`}
                    >
                      <TemplatePreview src={t.cardSrc ?? t.previewSrc} nameKo={t.nameKo} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-bold text-ink">{t.nameKo}</span>
                          {fits && <StatusBadge tone="ok">추천</StatusBadge>}
                        </span>
                        <span className="mt-1.5 block text-xs leading-relaxed text-ink-mute [text-wrap:pretty]">
                          {t.description}
                        </span>
                        <span className="mt-2 block text-[11px] text-ink-faint">블록 {t.sequencePreview.length}개</span>
                        <span className="mt-2 block space-y-1">
                          {t.sequencePreview.slice(0, 3).map((b, i) => (
                            <span key={`${t.id}-${i}`} className="flex items-center gap-1.5 text-[11px] text-ink-mute">
                              <span className="h-1 w-1 shrink-0 rounded-full bg-coral" aria-hidden />
                              {b}
                            </span>
                          ))}
                          {t.sequencePreview.length > 3 && (
                            <span className="block text-[11px] text-ink-faint">외 {t.sequencePreview.length - 3}개</span>
                          )}
                        </span>
                      </span>
                    </button>
                    {t.previewSrc && (
                      <button
                        type="button"
                        onClick={() => setZoom(t)}
                        className="absolute bottom-5 left-5 rounded-full bg-ink/75 px-2 py-[3px] text-[10px] font-bold text-white backdrop-blur transition hover:bg-ink"
                      >
                        전체 보기
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint [text-wrap:pretty]">
              미리보기는 데모 입력으로 실제 생성한 결과이고, 제품컷은 실존 제품이 아닌 가상 브랜드용 이미지입니다. 실제
              산출물은 입력하신 내용과 이미지로 만들어집니다.
            </p>
          </SectionCard>

          {/* DETAIL-05 제품 스펙 */}
          <SectionCard
            step={4}
            title="제품 스펙"
            pill="required"
            desc="표시 의무 항목입니다. 내용을 고쳐 쓰지 않고, 한국어로 입력하시면 일본 표기로만 바꿔 넣습니다 — 바꾼 결과는 다음 단계에서 확인·수정하실 수 있습니다."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={fieldLabelClass}>내용량</span>
                <input name="specVolume" className={inputClass} placeholder="30mL" />
              </label>
              <label className="block">
                <span className={fieldLabelClass}>구분</span>
                <input name="specCategory" className={inputClass} placeholder="化粧品 / 医薬部外品" />
              </label>
              <label className="block">
                <span className={fieldLabelClass}>판매원</span>
                <input name="specManufacturer" className={inputClass} placeholder="株式会社◯◯" />
              </label>
              <label className="block">
                <span className={fieldLabelClass}>원산국</span>
                <input name="specOrigin" className={inputClass} placeholder="韓国" />
              </label>
            </div>
            <label className="mt-3 block">
              <span className={fieldLabelClass}>전성분</span>
              <textarea name="specFullIngredients" rows={3} className={inputClass} placeholder="水、BG、グリセリン…" />
            </label>
          </SectionCard>

          {/* DETAIL-05b 성분·무첨가·사용법 */}
          <SectionCard step={5} title="성분 · 무첨가 · 사용법" desc="성분을 입력하지 않으면 성분·기전 블록은 넣지 않습니다. 성분명을 지어내지 않습니다.">
            <label className="block">
              <span className={fieldLabelClass}>성분 (한 줄에 하나 · 성분명|농도|배합목적)</span>
              <textarea name="ingredientRows" rows={3} className={inputClass} placeholder={'ナイアシンアミド|2%|整肌成分\nヒアルロン酸Na||保湿成分'} />
            </label>
            <label className="mt-3 block">
              <span className={fieldLabelClass}>무첨가 항목 (한 줄에 하나)</span>
              <textarea name="freeOf" rows={2} className={inputClass} placeholder={'合成香料\n鉱物油'} />
            </label>
            <label className="mt-3 block">
              <span className={fieldLabelClass}>스펙 수치 (라벨|값)</span>
              <textarea name="specRows" rows={2} className={inputClass} placeholder={'SPF|50+\nPA|++++'} />
            </label>
            <label className="mt-3 block">
              <span className={fieldLabelClass}>사용법 STEP (한 줄에 하나)</span>
              <textarea name="howToSteps" rows={3} className={inputClass} placeholder={'洗顔後、化粧水で肌をととのえます。'} />
            </label>
            <label className="mt-3 block">
              <span className={fieldLabelClass}>주의사항 (한 줄에 하나)</span>
              <textarea name="cautions" rows={2} className={inputClass} />
            </label>
          </SectionCard>

          {/* DETAIL-06 근거(접이식) */}
          <Accordion open={openEvidence} onToggle={() => setOpenEvidence((v) => !v)} title="실적 · 시험 근거" hint="그룹별로 전부 채워야 해당 블록이 들어갑니다">
            <div className="grid gap-3 sm:grid-cols-3">
              <input name="proofRankTitle" className={inputClass} placeholder="실적명 (楽天ランキング1位)" />
              <input name="proofGenre" className={inputClass} placeholder="부문 (美容液部門)" />
              <input name="proofDate" className={inputClass} placeholder="집계일 (2026年7月14日更新)" />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input name="salesCount" className={inputClass} placeholder="누적 판매 (累計163,991個)" />
              <input name="salesPeriod" className={inputClass} placeholder="집계 기간" />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input name="testName" className={inputClass} placeholder="시험명 (効能評価試験済み)" />
              <input name="testCondition" className={inputClass} placeholder="시험 조건" />
              <input name="testInstitution" className={inputClass} placeholder="시험기관" />
              <input name="testDate" className={inputClass} placeholder="시험 시점" />
              <input name="testSampleSize" className={inputClass} placeholder="대상 인원 (21名)" />
            </div>
            <label className="mt-3 block">
              <span className={fieldLabelClass}>고객 리뷰 원문 (본문|평점|연령대) — 실제 리뷰만 넣습니다</span>
              <textarea name="reviewRows" rows={2} className={inputClass} />
            </label>
          </Accordion>

          {/* DETAIL-06b 프로모(접이식) */}
          {!amazonSelected && (
            <Accordion open={openPromo} onToggle={() => setOpenPromo((v) => !v)} title="프로모션" hint="세트명·판매가가 있어야 가격 블록이 들어갑니다">
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="promoSetTitle" className={inputClass} placeholder="세트명 (2個セット)" />
                <input name="promoSalePrice" className={inputClass} placeholder="판매가 (1,920)" />
                <input name="promoNormalPrice" className={inputClass} placeholder="통상가 (2,610)" />
                <input name="promoDiscountRate" className={inputClass} placeholder="할인율 (26)" />
                <input name="promoGift" className={inputClass} placeholder="증정품" />
                <input name="promoQualifiers" className={inputClass} placeholder="한정 조건 (쉼표 구분)" />
              </div>
              <label className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-ink-body">
                <input type="checkbox" name="promoNormalPriceVerified" value="true" className="mt-0.5" />
                <span>통상가로 실제 판매한 실적이 있습니다. (체크하지 않으면 통상가 취소선을 넣지 않습니다 — 有利誤認 방지)</span>
              </label>
              <input name="promoFootnote" className={`${inputClass} mt-3`} placeholder="가격 조건 각주" />
            </Accordion>
          )}

          {/* DETAIL-06c 옵션(접이식) */}
          <Accordion open={openOption} onToggle={() => setOpenOption((v) => !v)} title="옵션" hint="2개 이상이면 옵션 블록이 들어갑니다">
            <p className={fieldLabelClass}>옵션 축</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {OPTION_AXES.map((a) => (
                <button key={a.id} type="button" onClick={() => setOptionAxis(a.id)} className={chipClass(optionAxis === a.id)}>
                  {a.label}
                </button>
              ))}
            </div>
            <label className="mt-3 block">
              <span className={fieldLabelClass}>옵션 목록 (이름|색상값|품번)</span>
              <textarea name="optionRows" rows={3} className={inputClass} placeholder={'01 ローズベージュ|#c86b5a|SHADE 1'} />
            </label>
            <label className="mt-3 block">
              <span className={fieldLabelClass}>모델컷 (퍼스널컬러 블록용)</span>
              <input type="file" name="modelImage" accept="image/jpeg,image/png,image/webp" className="mt-1 block text-sm" />
            </label>
            <label className="mt-2 flex items-start gap-2 text-[13px] leading-relaxed text-ink-body">
              <input type="checkbox" name="modelConsent" value="true" className="mt-0.5" />
              <span>업로드한 모델컷을 사용할 권한이 있습니다. (미체크 시 해당 블록만 빠지고 생성은 계속됩니다)</span>
            </label>
          </Accordion>

          {/* DETAIL-07 추가 요청 */}
          <SectionCard step={6} title="추가 요청" desc="이미지 분위기에 대한 요청만 반영합니다. 근거가 필요한 값(가격·실적·성분)은 위 항목으로만 들어갑니다.">
            <textarea name="note" rows={2} className={inputClass} placeholder="예: 전체적으로 더 밝고 화사하게" />
            <p className="mt-2 text-xs leading-relaxed text-ink-faint [text-wrap:pretty]">
              한국어로 쓰셔도 됩니다 — 이미지 생성 모델에는 영어로 바꿔 전달합니다.
            </p>
          </SectionCard>

          <p className="mt-4 rounded-lg bg-coral-tint px-4 py-3 text-[13px] leading-relaxed text-ink-body [text-wrap:pretty]">
            번역이 아니라 <b>일본 고객 관점의 메시지 재설계</b>입니다. 근거를 입력하지 않은 배지·가격·수치는 만들지 않습니다.
            <br />
            입력은 <b>한국어로 하셔도 됩니다.</b> 사실 정보(성분·스펙·주의사항 등)는 일본 표기로 바꿔 넣고, 바꾼 결과를 다음
            단계에서 보여 드립니다. 수치·가격은 원문 그대로 유지합니다.
          </p>
        </form>
      </div>

      {/* 하단 sticky 액션 바 */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas/95 px-6 py-4 backdrop-blur left-0 lg:left-sidebar">
        <div className="mx-auto max-w-[1280px]">
          {step === 'form' ? (
            <>
              <button
                type="button"
                disabled={!canPreview || busy || !readiness.ready}
                onClick={() => void handlePreview()}
                className={buttonClass('primary', 'lg', 'w-full')}
              >
                {busy ? '구성 확인 중…' : '블록 구성 확인'}
              </button>
              <p className="mt-2.5 text-center text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">
                {readiness.ready ? guidance : '서버 설정이 끝나야 생성할 수 있습니다. 위 안내를 확인해 주세요.'}
              </p>
            </>
          ) : (
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('form')} className={buttonClass('secondary', 'lg')}>
                입력 수정
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSubmit()}
                className={buttonClass('primary', 'lg', 'flex-1')}
              >
                {busy ? '생성 시작 중…' : `상세페이지 생성 (블록 ${plan?.blocks.length ?? 0}개)`}
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-1.5 text-center text-xs text-danger-text">
              {error}
            </p>
          )}
        </div>
      </div>
      <TemplateZoom template={zoom} onClose={() => setZoom(null)} />
    </main>
  );
}

/**
 * 템플릿 카드의 프리뷰 스트립.
 * 상세페이지는 세로로 아주 긴 이미지라(폭 대비 10배 이상) 카드에서는 상단만 보여주고 아래를
 * 페이드로 끊는다 — "여기서 계속 이어진다"는 감각을 주면서 카드 높이를 통제한다.
 * 명시 치수를 넣어 로드 전에도 자리를 차지하게 한다(CLS 0).
 */
function TemplatePreview({ src, nameKo }: { src: string | null; nameKo: string }) {
  const [failed, setFailed] = useState(false);
  // 프리뷰가 아직 안 구워졌거나 로드에 실패하면 블록 목록만으로 폴백한다
  if (!src || failed) return null;
  return (
    <span className="relative block h-[168px] w-[74px] shrink-0 overflow-hidden rounded-md border border-hairline bg-n-50">
      {/* 치수를 명시하지 않는 이유: 상세페이지는 템플릿마다 총 높이가 달라 정직한 값을 쓸 수 없다.
          대신 감싼 span 이 74×168 로 고정돼 있어 로드 전후 레이아웃이 움직이지 않는다(CLS 0). */}
      <img
        src={src}
        alt={`${nameKo} 생성 결과 미리보기`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-auto w-full align-top"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-canvas to-transparent"
      />
    </span>
  );
}

/** 프리뷰 전체 보기 — 카드가 상단만 보여주므로 전체 흐름을 확인할 자리가 필요하다. */
function TemplateZoom({ template, onClose }: { template: TemplateCard | null; onClose: () => void }) {
  useEffect(() => {
    if (!template) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [template, onClose]);

  if (!template?.previewSrc) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${template.nameKo} 미리보기`}
      className="fixed inset-0 z-50 flex flex-col bg-ink/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-4">
        <p className="text-sm font-bold text-white">{template.nameKo} · 생성 결과 미리보기</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-white/25"
        >
          닫기
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
        <img
          src={template.previewSrc}
          alt={`${template.nameKo} 생성 결과 전체`}
          className="mx-auto block w-full max-w-[296px] rounded-lg"
        />
      </div>
    </div>
  );
}

/**
 * 서버 준비 상태 안내 — 정상일 때는 아무것도 그리지 않는다.
 * 배포 환경에서 막히는 원인(마이그레이션·폰트·키·Storage)을 생성 전에 보여주고,
 * 각 항목마다 **무엇을 어디서 고치는지**까지 같이 준다.
 */
function ReadinessNotice({ readiness }: { readiness: DetailReadiness }) {
  const issues = readiness.checks.filter((c) => !c.ok);
  if (issues.length === 0) return null;

  const blocking = !readiness.ready;
  return (
    <section
      role={blocking ? 'alert' : undefined}
      className={`${cardClass} mt-6 border-l-2 ${blocking ? 'border-l-danger' : 'border-l-amber-text'} p-5`}
    >
      <div className="flex items-center gap-2">
        <StatusBadge tone={blocking ? 'danger' : 'warn'}>{blocking ? '생성 불가' : '확인 필요'}</StatusBadge>
        <h2 className="text-sm font-bold text-ink">
          {blocking ? '이 서버는 아직 상세페이지를 만들 수 없습니다' : '결과가 실사용과 다를 수 있습니다'}
        </h2>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {issues.map((c) => (
          <li key={c.key} className="text-[13px] leading-relaxed">
            <b className="font-semibold text-ink">{c.label}</b>
            <span className="text-ink-mute"> — {c.detail}</span>
            {c.fix ? <p className="mt-1 text-ink-faint [text-wrap:pretty]">고치는 법: {c.fix}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * CONFIRM-06 일본어 변환 확인 — 한국어로 입력한 항목을 생성 **전에** 눈으로 확인한다.
 *
 * 왜 확인 단계가 필요한가: 이 값들은 카피가 아니라 **근거**(가격·성분·시험·표시 의무)이고,
 * 렌더러가 자단위로 그대로 그린다. 자동 변환만 믿고 넘기면 사용자는 결과물을 보고서야 안다.
 * 특히 区分·全成分은 표시 의무 항목이라 기본 펼침으로 둔다.
 *
 * 한글 입력이 없으면 이 패널은 아예 뜨지 않는다(콜도 없다).
 */
function TranslationPanel({
  fields,
  error,
  needsLogin,
  onEdit,
}: {
  fields: TranslatedField[];
  error: string | null;
  needsLogin: boolean;
  onEdit: (path: string, ja: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (needsLogin) {
    return (
      <section className={`${cardClass} mt-5 border-l-2 border-l-amber-text p-5`}>
        <div className="flex items-center gap-2">
          <StatusBadge tone="warn">로그인 후 확인</StatusBadge>
          <h3 className="text-sm font-bold text-ink">한국어로 입력하신 항목이 있습니다</h3>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">
          일본 표기로 바꿔서 넣습니다. 바꾼 결과를 미리 확인·수정하시려면 로그인해 주세요. 로그인하지 않고 생성하면 변환은
          그대로 적용되지만 검토 단계를 건너뛰게 됩니다.
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section role="alert" className={`${cardClass} mt-5 border-l-2 border-l-danger p-5`}>
        <div className="flex items-center gap-2">
          <StatusBadge tone="danger">변환 실패</StatusBadge>
          <h3 className="text-sm font-bold text-ink">한국어 입력을 일본어로 바꾸지 못했습니다</h3>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">
          이대로 생성하면 한국어가 남은 항목의 블록이 만들어지지 않습니다. 잠시 후 다시 시도하시거나, 해당 항목을 일본어로 직접
          입력해 주세요.
        </p>
      </section>
    );
  }
  if (fields.length === 0) return null;

  const failed = fields.filter((f) => !f.ok);
  const regulated = fields.filter((f) => f.kind === 'regulated');
  // 표시 의무 항목과 실패 항목은 접혀 있으면 안 된다 — 접힌 채 넘어가면 확인 단계가 무의미하다
  const alwaysOpen = [...failed, ...regulated.filter((f) => f.ok)];
  const rest = fields.filter((f) => !alwaysOpen.includes(f));

  return (
    <section className={`${cardClass} mt-5 p-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-ink">일본어 변환 확인</h3>
        {failed.length > 0 ? (
          <StatusBadge tone="danger">확인 필요 {failed.length}</StatusBadge>
        ) : (
          <StatusBadge tone="ok">{fields.length}개 변환됨</StatusBadge>
        )}
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">
        한국어로 입력하신 항목을 일본 표기로 바꿨습니다. 수치·가격은 원문과 같은지 자동으로 대조했고, 아래에서 직접 고치실 수
        있습니다.
      </p>

      {alwaysOpen.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {alwaysOpen.map((f) => (
            <TranslationRow key={f.path} field={f} onEdit={onEdit} />
          ))}
        </ul>
      )}

      {rest.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-coral-strong underline-offset-2 hover:underline"
          >
            나머지 {rest.length}개 {open ? '접기' : '펼쳐서 확인하기'}
            {open ? <IconChevronUp className="h-4 w-4" /> : <IconChevronDown className="h-4 w-4" />}
          </button>
          {open && (
            <ul className="mt-3 flex flex-col gap-3">
              {rest.map((f) => (
                <TranslationRow key={f.path} field={f} onEdit={onEdit} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** 변환 1건 — 원문(읽기 전용) 위에 변환값(편집 가능). 상태는 색·글자·배지 3중으로 표기한다. */
function TranslationRow({ field, onEdit }: { field: TranslatedField; onEdit: (path: string, ja: string) => void }) {
  const inputId = `tr-${field.path.replace(/[^\w-]/g, '-')}`;
  return (
    <li className={`rounded-lg border px-4 py-3 ${field.ok ? 'border-card-border bg-n-50' : 'border-danger bg-danger-bg'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-ink-body">{field.label}</span>
        {field.kind === 'regulated' && <StatusBadge tone="warn">표시 의무 — 반드시 확인</StatusBadge>}
        {field.kind === 'artDirection' && <StatusBadge tone="off">이미지 지시 · 영어</StatusBadge>}
        {field.via === 'glossary' && <StatusBadge tone="ok">브랜드 등록 표기</StatusBadge>}
        {!field.ok && <StatusBadge tone="danger">확인 필요</StatusBadge>}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
        <span className="font-medium">원문</span> {field.kr}
      </p>
      <label htmlFor={inputId} className="sr-only">
        {field.label} 일본어 변환값
      </label>
      <input
        id={inputId}
        type="text"
        value={field.ja}
        onChange={(e) => onEdit(field.path, e.target.value)}
        className={`${inputClass} mt-1.5`}
        aria-invalid={!field.ok}
        aria-describedby={field.problem ? `${inputId}-problem` : undefined}
      />
      {field.problem && (
        <p id={`${inputId}-problem`} className="mt-1.5 text-xs leading-relaxed text-danger-text [text-wrap:pretty]">
          {field.problem}
        </p>
      )}
    </li>
  );
}

/** 접이식 섹션 — 선택 입력 그룹을 접어 첫 화면의 인지 부하를 줄인다 */
function Accordion({
  open,
  onToggle,
  title,
  hint,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${cardClass} mt-4 overflow-hidden`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between px-5 py-4 text-left">
        <span>
          <span className="text-sm font-bold text-ink">{title}</span>
          <span className="ml-2 text-xs text-ink-mute">{hint}</span>
        </span>
        {open ? <IconChevronUp /> : <IconChevronDown />}
      </button>
      {open && <div className="border-t border-hairline px-5 py-4">{children}</div>}
    </section>
  );
}

/** 확인 단계(CONFIRM-01~05) — 들어가는 블록과 **빠진 블록의 사유**를 접지 않고 보여준다 */
function ConfirmStep({
  plan,
  disabled,
  translation,
  onEditTranslation,
  onToggle,
  onBack,
}: {
  plan: PlanResult;
  disabled: Set<string>;
  translation: TranslatedField[];
  onEditTranslation: (path: string, ja: string) => void;
  onToggle: (b: PlanBlock) => void;
  onBack: () => void;
}) {
  const minutes = Math.max(1, Math.round(plan.estimateSeconds / 60));
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">블록 구성 확인</h2>
        <button type="button" onClick={onBack} className="text-[13px] font-medium text-coral-strong underline-offset-2 hover:underline">
          입력으로 돌아가기
        </button>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">
        약 {minutes}분 걸립니다 · 블록 {plan.blocks.length}개 (이미지 생성 {plan.aiBlockCount}개) · 출력 폭 {plan.output.width}px
      </p>
      <p className="mt-2 rounded-lg bg-n-50 px-3 py-2 text-xs leading-relaxed text-ink-mute">{plan.output.note}</p>

      <TranslationPanel
        fields={translation}
        error={plan.translationError}
        needsLogin={plan.translationNeedsLogin}
        onEdit={onEditTranslation}
      />

      <ol className="mt-5 space-y-2">
        {plan.blocks.map((b, i) => {
          const off = disabled.has(b.blockId);
          return (
            <li key={b.blockId} className={`${cardClass} flex items-center gap-3 px-4 py-3 ${off ? 'opacity-45' : ''}`}>
              <span className="w-6 shrink-0 text-center text-xs font-bold text-ink-faint">{i + 1}</span>
              <span className="flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{b.nameKo}</span>
                  {b.signature && <StatusBadge tone="ok">이 템플릿의 핵심</StatusBadge>}
                  {b.renderKind !== 'text' && <StatusBadge tone="warn">이미지 생성</StatusBadge>}
                </span>
              </span>
              {b.required ? (
                <span className="text-[11px] text-ink-faint">필수</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggle(b)}
                  className="text-[12px] font-medium text-coral-strong underline-offset-2 hover:underline"
                >
                  {off ? '넣기' : '빼기'}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {plan.excluded.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-bold text-ink">빠진 블록 {plan.excluded.length}개</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">
            근거가 없으면 그 블록을 넣지 않는 것이 기본 동작입니다. 입력을 채우면 다시 들어갑니다.
          </p>
          <ul className="mt-3 space-y-2">
            {plan.excluded.map((e) => (
              <li key={e.blockId} className="rounded-lg border border-card-border bg-n-50 px-4 py-3">
                <p className="text-[13px] font-semibold text-ink-body">{e.nameKo}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">{e.reason}</p>
                {e.fixHint && <p className="mt-1 text-xs text-coral-strong">필요한 입력: {e.fixHint}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

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

import { useCallback, useMemo, useRef, useState } from 'react';
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
import { IconChevronDown, IconChevronUp, IconUpload } from '@/components/ui/icons';
import { LoginGateModal } from '@/components/auth/LoginGateModal';
import { useLoginGate } from '@/components/auth/useLoginGate';

interface TemplateCard {
  id: string;
  slug: string;
  nameKo: string;
  description: string;
  bestFor: string;
  platformFit: string[];
  sequencePreview: string[];
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
  const { gateOpen, openGate, closeGate, onAuthedGate } = useLoginGate();
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
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);
  const amazonSelected = platform === 'amazon-jp';

  const acceptFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files, ...Array.from(incoming)].slice(0, MAX_IMAGES);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    setError(null);
  }, [files]);

  const removeFile = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  /** 폼 → FormData. 미리보기와 제출이 같은 필드를 보낸다(서버가 같은 파서를 쓴다). */
  const buildFormData = useCallback((): FormData | null => {
    const el = formRef.current;
    if (!el) return null;
    const fd = new FormData(el);
    fd.delete('images');
    for (const f of files) fd.append('images', f);
    fd.set('platform', platform);
    fd.set('productCategory', category);
    fd.set('templateId', templateId);
    fd.set('optionAxis', optionAxis);
    fd.set('disabledBlocks', [...disabled].join(','));
    return fd;
  }, [files, platform, category, templateId, optionAxis, disabled]);

  /** 1단계 → 확인 단계. 서버가 계산한 구성을 그대로 보여준다(화면이 따로 추론하지 않는다). */
  const handlePreview = async () => {
    const fd = buildFormData();
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
      setPlan(data as PlanResult);
      setStep('confirm');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = useCallback(async () => {
    const fd = buildFormData();
    if (!fd) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/studio/detail', { method: 'POST', body: fd });
      if (res.status === 401) {
        setBusy(false);
        openGate(handleSubmit);
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
  }, [buildFormData, openGate, router]);

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

  // 확인 단계에서 블록을 껐다 켜면 서버 계산을 다시 받아야 한다
  const refreshPlan = async () => {
    const fd = buildFormData();
    if (!fd) return;
    const res = await fetch('/api/studio/detail/plan', { method: 'POST', body: fd });
    if (res.ok) setPlan((await res.json()) as PlanResult);
  };

  return (
    <main className="pb-32">
      <div className="mx-auto max-w-[768px] px-6 pt-8">
        <header>
          <p className="text-[13px] font-semibold text-coral">마케팅 스튜디오</p>
          <h1 className="mt-1.5 text-[26px] font-bold leading-tight text-ink">상세페이지 만들기</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-mute [text-wrap:pretty]">
            블록을 하나씩 만들어 세로로 이어 붙입니다. 글자는 전부 폰트로 그리므로 일본어가 깨지지 않습니다.
          </p>
        </header>

        {/* 모듈 탭(DETAIL-01) */}
        <div role="tablist" aria-label="스튜디오 모듈" className="mt-7 flex gap-0.5 border-b border-hairline">
          <Link
            href="/app/studio/thumbnail"
            role="tab"
            aria-selected="false"
            className="px-3.5 py-2.5 text-sm font-medium text-ink-mute hover:text-ink"
          >
            썸네일
          </Link>
          <button
            type="button"
            role="tab"
            aria-selected="true"
            className="-mb-px border-b-2 border-coral px-3.5 py-2.5 text-sm font-bold text-coral-strong"
          >
            상세페이지
          </button>
          <span
            role="tab"
            aria-selected="false"
            aria-disabled="true"
            className="flex cursor-default items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-ink-faint"
          >
            인스타 피드 <StatusBadge tone="off">준비 중</StatusBadge>
          </span>
        </div>

        <ReadinessNotice readiness={readiness} />

        {step === 'confirm' && plan ? (
          <ConfirmStep
            plan={plan}
            disabled={disabled}
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
          <SectionCard step={3} title="템플릿" pill="required" desc="상세페이지는 순서가 핵심입니다. 카드의 블록 흐름을 보고 고르세요.">
            <ul className="grid gap-3 sm:grid-cols-2">
              {templates.map((t) => {
                const active = t.id === templateId;
                const fits = platform !== 'unset' && t.platformFit.includes(platform);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setTemplateId(t.id)}
                      aria-pressed={active}
                      className={`${cardClass} w-full p-4 text-left transition ${active ? 'border-coral ring-2 ring-coral/25' : 'hover:border-input-border'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink">{t.nameKo}</span>
                        {fits && <StatusBadge tone="ok">추천</StatusBadge>}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-ink-mute [text-wrap:pretty]">{t.description}</p>
                      <ol className="mt-3 space-y-1">
                        {t.sequencePreview.slice(0, 6).map((b, i) => (
                          <li key={`${t.id}-${i}`} className="flex items-center gap-1.5 text-[11px] text-ink-mute">
                            <span className="h-1 w-1 rounded-full bg-coral" aria-hidden />
                            {b}
                          </li>
                        ))}
                        {t.sequencePreview.length > 6 && (
                          <li className="text-[11px] text-ink-faint">외 {t.sequencePreview.length - 6}개</li>
                        )}
                      </ol>
                    </button>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          {/* DETAIL-05 제품 스펙 */}
          <SectionCard
            step={4}
            title="제품 스펙"
            pill="required"
            desc="표시 의무 항목입니다. 입력하신 원문을 그대로 넣습니다 — 저희가 고쳐 쓰지 않습니다."
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
          </SectionCard>

          <p className="mt-4 rounded-lg bg-coral-tint px-4 py-3 text-[13px] leading-relaxed text-ink-body [text-wrap:pretty]">
            번역이 아니라 <b>일본 고객 관점의 메시지 재설계</b>입니다. 근거를 입력하지 않은 배지·가격·수치는 만들지 않습니다.
          </p>
        </form>
      </div>

      {/* 하단 sticky 액션 바 */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas/95 px-6 py-4 backdrop-blur left-0 lg:left-sidebar">
        <div className="mx-auto max-w-[768px]">
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
      <LoginGateModal open={gateOpen} onClose={closeGate} onAuthed={onAuthedGate} />
    </main>
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
  onToggle,
  onBack,
}: {
  plan: PlanResult;
  disabled: Set<string>;
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

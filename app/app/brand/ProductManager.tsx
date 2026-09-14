'use client';

/**
 * 제품 자산 관리(BRAND-03/03b/03c) — 브랜드 하위 제품 단위 CRUD.
 * 제품 그리드(대표컷·KR/JA·카테고리·이미지 수) + 추가/편집 모달(다중 이미지·대표 지정·삭제) + 삭제 확인.
 * 대표컷은 ② 스튜디오 브랜드 자산 피커(HOME-02)에서 소스로 쓰인다.
 */

import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import {
  CandidatePanel,
  OriginNote,
  REVIEW_REQUIRED,
  SPEC_FIELDS,
  SpecPanel,
  type Candidate,
  type FieldOrigin,
} from '@/components/product/registerHelpers';
import {
  buttonClass,
  chipClass,
  fieldLabelClass,
  inputClass,
  selectClass,
  textareaClass,
} from '@/components/ui/primitives';
import type { ProductRecord } from '@/lib/db/store';

const CATEGORY_OPTIONS = ['스킨케어', '메이크업', '선케어', '클렌징', '기타'];

/** 편집 중 이미지 — 기존(fileId+url) 또는 새로 올린 것(file+objectURL) */
interface EditImage {
  key: string;
  fileId?: string;
  file?: File;
  url: string;
}

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `img-${keySeq}`;
}

export function ProductManager() {
  const [products, setProducts] = useState<ProductRecord[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [nameKr, setNameKr] = useState('');
  const [nameJa, setNameJa] = useState('');
  const [category, setCategory] = useState('');
  const [memo, setMemo] = useState('');
  const [images, setImages] = useState<EditImage[]>([]);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<ProductRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── 제품 등록 도우미(BRAND-03b 3b-5·3b-6) ────────────────────────────
  /** 칸마다 값이 어디서 왔는지. 사용자가 손대면 지워진다(3b-7) */
  const [origins, setOrigins] = useState<Record<string, FieldOrigin>>({});
  /** 웹 검색 후보 */
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [identifyBusy, setIdentifyBusy] = useState(false);
  const [identifyNote, setIdentifyNote] = useState<string | null>(null);
  /** KR 상세 원본에서 읽은 스펙 7칸 */
  const [spec, setSpec] = useState<Record<string, string>>({});
  const [specReviewed, setSpecReviewed] = useState<string[]>([]);
  const [specBusy, setSpecBusy] = useState(false);
  const [specNote, setSpecNote] = useState<string | null>(null);
  const [specMissing, setSpecMissing] = useState<{ field: string; reason: string }[]>([]);
  const sourceRef = useRef<HTMLInputElement>(null);
  /** 같은 제품컷으로 두 번 검색하지 X */
  const identifiedRef = useRef<string>('');

  async function load() {
    const res = await fetch('/api/products', { cache: 'no-store' });
    if (res.ok) setProducts((await res.json()).products);
    else setProducts([]);
  }
  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setNameKr('');
    setNameJa('');
    setCategory('');
    setMemo('');
    setImages([]);
    setPrimaryKey(null);
    setError(null);
    resetHelpers();
    setOpen(true);
  }

  function openEdit(p: ProductRecord) {
    setEditing(p);
    setNameKr(p.nameKr);
    setNameJa(p.nameJa);
    setCategory(p.category);
    setMemo(p.memo);
    const imgs = p.images.map((im) => ({ key: nextKey(), fileId: im.fileId, url: `/api/files/${im.fileId}` }));
    setImages(imgs);
    setPrimaryKey(imgs[p.images.findIndex((im) => im.isPrimary)]?.key ?? imgs[0]?.key ?? null);
    setError(null);
    resetHelpers();
    // 이미 읽어 둔 스펙이 있으면 그대로 보여준다. 출처는 붙이지 X — 저장된 값이지 방금 읽은 값이 아니다
    setSpec(p.spec?.fields ?? {});
    setSpecReviewed(p.spec?.reviewed ?? []);
    setOpen(true);
  }

  /** 도우미 상태를 비운다 — 모달을 다시 열 때 지난 제품의 후보가 남아 있으면 안 된다 */
  function resetHelpers() {
    setOrigins({});
    setCandidates(null);
    setIdentifyBusy(false);
    setIdentifyNote(null);
    setSpec({});
    setSpecReviewed([]);
    setSpecBusy(false);
    setSpecNote(null);
    setSpecMissing([]);
    identifiedRef.current = '';
  }

  /** 사용자가 칸을 고치면 그 칸은 더 이상 "가져온 값"이 아니다(3b-7) */
  function touched(name: string) {
    setOrigins((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  /**
   * 제품 식별 검색(3b-5) — 제품컷 첫 장으로 후보를 찾는다.
   *
   * **폼을 잠그지 X.** 제품 등록은 지금 즉시 끝나는 동작이라, 여기에 대기가 붙으면
   * 개선이 아니라 개악이다. 검색이 도는 동안에도 입력과 「저장」이 열려 있다.
   */
  async function identify(file: File) {
    const key = `${file.name}:${file.size}`;
    if (identifiedRef.current === key) return;
    identifiedRef.current = key;
    setIdentifyBusy(true);
    setIdentifyNote(null);
    try {
      const fd = new FormData();
      fd.set('image', file);
      if (nameKr.trim()) fd.set('nameHint', nameKr.trim());
      const res = await fetch('/api/products/identify', { method: 'POST', body: fd });
      const data = res.ok ? ((await res.json()) as { candidates?: Candidate[] }) : { candidates: [] };
      const list = data.candidates ?? [];
      setCandidates(list);
      // 후보 0건은 정상 경로다 — 실패로 표시하지 X
      if (list.length === 0) setIdentifyNote('웹에서 이 제품을 찾지 못했습니다. 직접 입력해 주세요.');
    } catch {
      identifiedRef.current = '';
      setCandidates([]);
      setIdentifyNote('웹에서 이 제품을 찾지 못했습니다. 직접 입력해 주세요.');
    } finally {
      setIdentifyBusy(false);
    }
  }

  /** 후보를 고르면 세 칸이 차고 출처가 붙는다. 잠그지 X — 전부 편집 가능 */
  function applyCandidate(c: Candidate) {
    const next: Record<string, FieldOrigin> = { ...origins };
    if (c.nameKr) {
      setNameKr(c.nameKr);
      next.nameKr = 'web';
    }
    if (c.nameJa) {
      setNameJa(c.nameJa);
      next.nameJa = 'web';
    }
    if (c.category) {
      setCategory(c.category);
      next.category = 'web';
    }
    setOrigins(next);
  }

  /**
   * KR 상세 원본 판독(3b-6) — 콜⑩ specExtract 로 스펙 7칸을 읽는다.
   * 읽은 값은 제품에 저장되고, 상세 폼이 그 제품을 고를 때 프리필로 가져간다.
   */
  async function readSource(list: FileList) {
    const files = Array.from(list).filter((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type));
    if (files.length === 0) return;
    setSpecBusy(true);
    setSpecNote(null);
    setSpecMissing([]);
    try {
      const fd = new FormData();
      for (const f of files) fd.append('images', f);
      // 이미 읽어 둔 칸은 다시 읽지 X
      fd.set(
        'wanted',
        SPEC_FIELDS.map((f) => f.name)
          .filter((n) => !spec[n])
          .join(','),
      );
      const res = await fetch('/api/studio/detail/extract', { method: 'POST', body: fd });
      if (!res.ok) {
        setSpecNote('원본에서 입력을 읽지 못했습니다. 직접 입력하실 수 있습니다.');
        return;
      }
      const data = (await res.json()) as {
        fields?: Record<string, string>;
        missing?: { field: string; reason: string }[];
        error?: string;
      };
      const read = data.fields ?? {};
      setSpec((prev) => ({ ...prev, ...read }));
      setOrigins((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.keys(read).map((n) => [n, 'source' as FieldOrigin])),
      }));
      setSpecMissing(data.missing ?? []);
      setSpecNote(data.error ?? null);
    } catch {
      setSpecNote('원본에서 입력을 읽지 못했습니다. 직접 입력하실 수 있습니다.');
    } finally {
      setSpecBusy(false);
    }
  }

  function addFiles(list: FileList) {
    const additions: EditImage[] = [];
    for (const f of Array.from(list)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        setError('JPG·PNG·WebP만 올릴 수 있습니다.');
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        setError('10MB 이하 이미지만 올릴 수 있습니다.');
        continue;
      }
      additions.push({ key: nextKey(), file: f, url: URL.createObjectURL(f) });
    }
    if (additions.length === 0) return;
    setImages((prev) => {
      const next = [...prev, ...additions];
      if (!primaryKey) setPrimaryKey(next[0].key);
      return next;
    });
    // 대표컷이 될 첫 장으로 제품 후보를 찾는다(3b-5). 폼은 잠그지 X
    const first = additions[0].file;
    if (first) void identify(first);
  }

  function removeImage(key: string) {
    setImages((prev) => {
      const target = prev.find((i) => i.key === key);
      if (target?.file) URL.revokeObjectURL(target.url);
      const next = prev.filter((i) => i.key !== key);
      if (primaryKey === key) setPrimaryKey(next[0]?.key ?? null); // 대표 삭제 시 첫 장 승계
      return next;
    });
  }

  const canSave = nameKr.trim().length > 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('nameKr', nameKr);
      form.set('nameJa', nameJa);
      form.set('category', category);
      form.set('memo', memo);
      // 스펙은 있을 때만 보낸다 — 편집에서 안 보내면 저장된 값이 그대로 남는다
      if (Object.keys(spec).length > 0) {
        form.set('spec', JSON.stringify({ fields: spec, reviewed: specReviewed }));
      }
      const newImages = images.filter((i) => i.file);
      newImages.forEach((i) => form.append('images', i.file!));
      const primaryPos = images.findIndex((i) => i.key === primaryKey);

      let res: Response;
      if (editing) {
        const order = images.map((i) =>
          i.fileId ? { src: 'keep', fileId: i.fileId } : { src: 'new', idx: newImages.indexOf(i) },
        );
        form.set('imageOrder', JSON.stringify(order));
        form.set('primaryPos', String(primaryPos < 0 ? 0 : primaryPos));
        res = await fetch(`/api/products/${editing.id}`, { method: 'PUT', body: form });
      } else {
        // 생성은 전부 새 이미지 — 리스트 인덱스 = 파일 인덱스
        form.set('primaryIndex', String(primaryPos < 0 ? 0 : primaryPos));
        res = await fetch('/api/products', { method: 'POST', body: form });
      }
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setOpen(false);
      await load();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!delTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${delTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDelTarget(null);
        await load();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-ink-mute">
          제품 단위로 등록하면 스튜디오에서 제품컷을 브랜드 자산으로 바로 골라 쓸 수 있습니다.
        </p>
        <button type="button" onClick={openCreate} className={buttonClass('secondary', 'sm')}>
          ＋ 제품 추가
        </button>
      </div>

      {products === null ? (
        <p className="text-[12.5px] text-ink-mute">불러오는 중…</p>
      ) : products.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-input-border bg-n-50 p-6 text-center">
          <p className="text-[13px] font-semibold text-ink">아직 등록한 제품이 없습니다</p>
          <p className="mt-1 text-[12px] text-ink-mute">
            제품을 등록하면 스튜디오 브랜드 자산 피커에서 제품컷을 고를 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const primary = p.images.find((im) => im.isPrimary) ?? p.images[0];
            return (
              <div key={p.id} className="relative flex gap-3 rounded-[12px] border border-card-border bg-canvas p-3">
                <button
                  type="button"
                  onClick={() => openEdit(p)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="h-[52px] w-[52px] flex-none overflow-hidden rounded-[9px] border border-hairline bg-n-100">
                    {primary ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/files/${primary.fileId}`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[9px] text-ink-faint">
                        대표컷 없음
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-ink">{p.nameKr}</span>
                    {p.nameJa && (
                      <span lang="ja" className="block truncate text-[11px] text-ink-mute">
                        {p.nameJa}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[10.5px] text-ink-faint">
                      {p.category ? `${p.category} · ` : ''}이미지 {p.images.length}장
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`${p.nameKr} 삭제`}
                  onClick={() => setDelTarget(p)}
                  className="absolute top-2 right-2 text-ink-faint transition-colors hover:text-danger-text"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 추가·편집 모달(BRAND-03b) */}
      <Modal open={open} onClose={() => !saving && setOpen(false)} labelledBy="productModalTitle" size="wide">
        <h2 id="productModalTitle" className="text-lg font-extrabold text-ink">
          {editing ? '제품 편집' : '제품 추가'}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute [text-wrap:pretty]">
          제품컷을 올리면 이 제품이 무엇인지 웹에서 찾아 이름을 채워 드립니다. 기다리지 않고 직접 입력하셔도 됩니다.
        </p>

        <div className="mt-5 space-y-6">
          {/* ① 제품컷(BRAND-03b 3b-2) — 검색을 여는 자리라 맨 앞에 둔다. 올린 곳과 결과가
              나오는 곳이 멀면 사용자는 무엇 때문에 후보가 떴는지 알 수 없다 */}
          <div>
            <p className={fieldLabelClass}>제품컷</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-mute [text-wrap:pretty]">
              배경이 깔끔한 제품 단독컷을 올려 주세요. 첫 장으로 이 제품을 웹에서 찾습니다.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="mt-2 flex flex-wrap gap-2.5">
              {images.map((im) => (
                <div key={im.key} className="relative">
                  <span
                    className={`block h-[72px] w-[72px] overflow-hidden rounded-[9px] border-2 ${
                      im.key === primaryKey ? 'border-coral' : 'border-hairline'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.url} alt="" className="h-full w-full object-cover" />
                  </span>
                  {im.key === primaryKey ? (
                    <span className="absolute top-0.5 left-0.5 rounded-[5px] bg-coral px-1 text-[8.5px] font-bold text-white">
                      대표
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPrimaryKey(im.key)}
                      className="absolute top-0.5 left-0.5 rounded-[5px] bg-[rgba(16,18,20,.62)] px-1 text-[8.5px] font-bold text-white"
                    >
                      대표로
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="이미지 삭제"
                    onClick={() => removeImage(im.key)}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-[72px] w-[72px] flex-col items-center justify-center gap-1 rounded-[9px] border-[1.5px] border-dashed border-input-border text-[11px] font-semibold text-ink-mute hover:border-coral hover:text-coral-strong"
              >
                ＋<span className="text-[9px]">추가</span>
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-faint">첫 장이 자동 대표입니다. JPG·PNG·WebP / 10MB 이하.</p>
          </div>

          <CandidatePanel busy={identifyBusy} candidates={candidates} note={identifyNote} onPick={applyCandidate} />

          {/* ② 제품 정보 — 후보를 고르면 위 셋이 차고, 안 골라도 직접 쓸 수 있다 */}
          <div className="space-y-4 border-t border-hairline pt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={fieldLabelClass}>
                제품명 KR <span className="text-coral-strong">*</span>
                <input
                  value={nameKr}
                  onChange={(e) => {
                    setNameKr(e.target.value);
                    touched('nameKr');
                  }}
                  maxLength={40}
                  className={`mt-1.5 ${inputClass} ${origins.nameKr ? 'bg-coral-tint' : ''}`}
                />
                <OriginNote origin={origins.nameKr} />
              </label>
              <label className={fieldLabelClass}>
                제품명 JA <span className="font-normal text-ink-mute">(선택)</span>
                <input
                  lang="ja"
                  value={nameJa}
                  onChange={(e) => {
                    setNameJa(e.target.value);
                    touched('nameJa');
                  }}
                  maxLength={60}
                  className={`mt-1.5 ${inputClass} ${origins.nameJa ? 'bg-coral-tint' : ''}`}
                />
                <OriginNote origin={origins.nameJa} />
              </label>
            </div>
            <label className={fieldLabelClass}>
              카테고리 <span className="font-normal text-ink-mute">(선택)</span>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  touched('category');
                }}
                className={`mt-1.5 w-full ${selectClass} ${origins.category ? 'bg-coral-tint' : ''}`}
              >
                <option value="">미지정</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <OriginNote origin={origins.category} />
            </label>
            <label className={fieldLabelClass}>
              메모 <span className="font-normal text-ink-mute">(선택)</span>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                maxLength={500}
                rows={2}
                className={`mt-1.5 ${textareaClass}`}
              />
            </label>
          </div>

          {/* ③ KR 상세 원본 판독(3b-6) — 제품컷과 **다른 칸**이다. 제품컷은 배경이 깔끔한
              단독컷이고 여기 올리는 것은 글자가 박힌 상세 스크린샷이다 */}
          <div className="border-t border-hairline pt-5">
            <SpecPanel
              busy={specBusy}
              spec={spec}
              origins={origins}
              reviewed={specReviewed}
              missing={specMissing}
              note={specNote}
              inputRef={sourceRef}
              onPick={readSource}
              onEdit={(name, value) => {
                setSpec((prev) => ({ ...prev, [name]: value }));
                touched(name);
              }}
              onReview={(name) => setSpecReviewed((prev) => [...new Set([...prev, name])])}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-[8px] border border-danger bg-danger-bg p-2.5 text-[12.5px] text-danger-text"
            >
              {error}
            </p>
          )}
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={saving}
            className={buttonClass('secondary', 'md', 'flex-1')}
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            className={buttonClass('primary', 'md', 'flex-1')}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </Modal>

      {/* 삭제 확인(BRAND-03c) */}
      <Modal open={delTarget !== null} onClose={() => !deleting && setDelTarget(null)} labelledBy="productDelTitle">
        <h2 id="productDelTitle" className="text-lg font-extrabold text-danger-text">
          제품을 삭제할까요?
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-body">
          <b className="text-ink">{delTarget?.nameKr}</b>와(과) 제품컷 {delTarget?.images.length ?? 0}장이 삭제됩니다.
          이미 생성된 썸네일·발행 리포트는 남습니다.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setDelTarget(null)}
            disabled={deleting}
            className={buttonClass('secondary', 'md', 'flex-1')}
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void doDelete()}
            disabled={deleting}
            className={buttonClass('danger', 'md', 'flex-1')}
          >
            {deleting ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

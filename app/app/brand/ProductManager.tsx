'use client';

/**
 * 제품 자산 관리(BRAND-03/03b/03c) — 브랜드 하위 제품 단위 CRUD.
 * 제품 그리드(대표컷·KR/JA·카테고리·이미지 수) + 추가/편집 모달(다중 이미지·대표 지정·삭제) + 삭제 확인.
 * 대표컷은 ② 스튜디오 브랜드 자산 피커(HOME-02)에서 소스로 쓰인다.
 */

import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { buttonClass, chipClass, fieldLabelClass, inputClass, selectClass, textareaClass } from '@/components/ui/primitives';
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
    setOpen(true);
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
          <p className="mt-1 text-[12px] text-ink-mute">제품을 등록하면 스튜디오 브랜드 자산 피커에서 제품컷을 고를 수 있습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const primary = p.images.find((im) => im.isPrimary) ?? p.images[0];
            return (
              <div key={p.id} className="relative flex gap-3 rounded-[12px] border border-card-border bg-canvas p-3">
                <button type="button" onClick={() => openEdit(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="h-[52px] w-[52px] flex-none overflow-hidden rounded-[9px] border border-hairline bg-n-100">
                    {primary ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/files/${primary.fileId}`} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[9px] text-ink-faint">대표컷 없음</span>
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
      <Modal open={open} onClose={() => !saving && setOpen(false)} labelledBy="productModalTitle">
        <h2 id="productModalTitle" className="text-lg font-extrabold text-ink">
          {editing ? '제품 편집' : '제품 추가'}
        </h2>
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={fieldLabelClass}>
              제품명 KR <span className="text-coral-strong">*</span>
              <input value={nameKr} onChange={(e) => setNameKr(e.target.value)} maxLength={40} className={`mt-1.5 ${inputClass}`} />
            </label>
            <label className={fieldLabelClass}>
              제품명 JA <span className="font-normal text-ink-mute">(선택)</span>
              <input lang="ja" value={nameJa} onChange={(e) => setNameJa(e.target.value)} maxLength={60} className={`mt-1.5 ${inputClass}`} />
            </label>
          </div>
          <label className={fieldLabelClass}>
            카테고리 <span className="font-normal text-ink-mute">(선택)</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`mt-1.5 w-full ${selectClass}`}>
              <option value="">미지정</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabelClass}>
            메모 <span className="font-normal text-ink-mute">(선택)</span>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} rows={2} className={`mt-1.5 ${textareaClass}`} />
          </label>

          {/* 제품컷 — 다중 이미지, 대표 지정/삭제(BRAND-03b) */}
          <div>
            <p className={fieldLabelClass}>제품컷</p>
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
                    <span className="absolute top-0.5 left-0.5 rounded-[5px] bg-coral px-1 text-[8.5px] font-bold text-white">대표</span>
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

          {error && (
            <p role="alert" className="rounded-[8px] border border-danger bg-danger-bg p-2.5 text-[12.5px] text-danger-text">
              {error}
            </p>
          )}
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => setOpen(false)} disabled={saving} className={buttonClass('secondary', 'md', 'flex-1')}>
            취소
          </button>
          <button type="button" onClick={() => void save()} disabled={!canSave} className={buttonClass('primary', 'md', 'flex-1')}>
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
          <b className="text-ink">{delTarget?.nameKr}</b>와(과) 제품컷 {delTarget?.images.length ?? 0}장이 삭제됩니다. 이미 생성된 썸네일·발행 리포트는 남습니다.
        </p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => setDelTarget(null)} disabled={deleting} className={buttonClass('secondary', 'md', 'flex-1')}>
            취소
          </button>
          <button type="button" onClick={() => void doDelete()} disabled={deleting} className={buttonClass('danger', 'md', 'flex-1')}>
            {deleting ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

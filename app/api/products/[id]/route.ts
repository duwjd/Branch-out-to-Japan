/**
 * PUT·DELETE /api/products/[id] — 제품 자산 편집·삭제(BRAND-03b/03c).
 * PUT은 유지할 이미지(keepImages) + 새 이미지 파일 + 대표(primaryFileId)를 함께 받아 갱신한다.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { getStore, type ProductImage } from '@/lib/db/store';
import { saveProductImages } from '@/lib/server/productImages';
import { logger } from '@/lib/logger';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  if (!(await getSession())) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { id } = await params;
  const store = await getStore();
  const existing = await store.getProduct(id);
  if (!existing) return NextResponse.json({ error: '제품을 찾을 수 없습니다.' }, { status: 404 });

  const form = await request.formData();
  const nameKr = String(form.get('nameKr') ?? '').trim().slice(0, 40);
  if (!nameKr) return NextResponse.json({ error: '제품명(KR)을 입력해 주세요.' }, { status: 400 });

  // 같은 브랜드 내 제품명 중복(자기 자신 제외)
  const siblings = await store.listProducts(existing.brandProfileId);
  const norm = (s: string) => s.trim().toLowerCase();
  if (siblings.some((p) => p.id !== id && norm(p.nameKr) === norm(nameKr))) {
    return NextResponse.json({ error: '이미 등록한 제품명입니다.' }, { status: 409 });
  }

  // 새로 올린 이미지 저장(idx = 업로드 순서)
  const files = form.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  const saved = await saveProductImages(files);
  if ('error' in saved) return NextResponse.json({ error: saved.error }, { status: 400 });

  // imageOrder: 최종 이미지 배열의 순서·구성. 항목 { src:'keep', fileId } | { src:'new', idx }
  // 미제공(구 클라이언트) 시 기존 유지 + 새 이미지 append.
  type OrderEntry = { src: 'keep'; fileId: string } | { src: 'new'; idx: number };
  let order: OrderEntry[];
  try {
    const raw = form.get('imageOrder');
    order = typeof raw === 'string' ? (JSON.parse(raw) as OrderEntry[]) : [];
  } catch {
    order = [];
  }
  if (order.length === 0) {
    order = [
      ...existing.images.map((im) => ({ src: 'keep' as const, fileId: im.fileId })),
      ...saved.fileIds.map((_, idx) => ({ src: 'new' as const, idx })),
    ];
  }

  const images: ProductImage[] = order
    .map((e): ProductImage | null =>
      e.src === 'keep'
        ? existing.images.some((im) => im.fileId === e.fileId)
          ? { fileId: e.fileId, isPrimary: false }
          : null
        : saved.fileIds[e.idx]
          ? { fileId: saved.fileIds[e.idx], isPrimary: false }
          : null,
    )
    .filter((im): im is ProductImage => im !== null);

  // 대표 = primaryPos(최종 배열 인덱스), 기본 첫 장(대표 삭제 시 첫 장 승계)
  if (images.length > 0) {
    const primaryPos = Number(form.get('primaryPos') ?? 0);
    images[Number.isInteger(primaryPos) && primaryPos >= 0 && primaryPos < images.length ? primaryPos : 0].isPrimary = true;
  }

  await store.updateProduct(id, {
    nameKr,
    nameJa: String(form.get('nameJa') ?? '').trim().slice(0, 60),
    category: String(form.get('category') ?? '').trim().slice(0, 40),
    memo: String(form.get('memo') ?? '').slice(0, 500),
    images,
  });
  logger.info('제품 자산 편집', { productId: id, nameKr });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  if (!(await getSession())) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { id } = await params;
  const store = await getStore();
  const existing = await store.getProduct(id);
  if (!existing) return NextResponse.json({ error: '제품을 찾을 수 없습니다.' }, { status: 404 });

  await store.deleteProduct(id);
  logger.info('제품 자산 삭제', { productId: id });
  return NextResponse.json({ ok: true });
}

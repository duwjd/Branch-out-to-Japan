/**
 * GET·POST /api/products — 활성 브랜드의 제품 자산(BRAND-03) 조회·생성.
 * 이미지는 FormData(File 복수)로 받아 로컬 저장 후 fileId로 보관(첫 장 자동 대표).
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/server/session';
import { getActiveBrand, getActiveBrandId } from '@/lib/server/activeBrand';
import { getStore } from '@/lib/db/store';
import { saveProductImages } from '@/lib/server/productImages';
import { logger } from '@/lib/logger';

export async function GET(): Promise<NextResponse> {
  const store = await getStore();
  const brandId = await getActiveBrandId();
  const products = brandId ? await store.listProducts(brandId) : [];
  return NextResponse.json({ products });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await getSession())) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const brand = await getActiveBrand();
  if (!brand) return NextResponse.json({ error: '브랜드를 먼저 등록해 주세요.' }, { status: 400 });

  const form = await request.formData();
  const nameKr = String(form.get('nameKr') ?? '').trim().slice(0, 40);
  if (!nameKr) return NextResponse.json({ error: '제품명(KR)을 입력해 주세요.' }, { status: 400 });

  const store = await getStore();
  const existing = await store.listProducts(brand.id);
  const norm = (s: string) => s.trim().toLowerCase();
  if (existing.some((p) => norm(p.nameKr) === norm(nameKr))) {
    return NextResponse.json({ error: '이미 등록한 제품명입니다.' }, { status: 409 });
  }

  const files = form.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  const saved = await saveProductImages(files);
  if ('error' in saved) return NextResponse.json({ error: saved.error }, { status: 400 });

  // 대표 = primaryIndex(기본 첫 장). 생성은 전부 새 이미지라 업로드 순서 그대로
  const primaryIndex = Number(form.get('primaryIndex') ?? 0);
  const images = saved.fileIds.map((fileId, i) => ({ fileId, isPrimary: i === (Number.isInteger(primaryIndex) ? primaryIndex : 0) }));
  if (images.length > 0 && !images.some((im) => im.isPrimary)) images[0].isPrimary = true;

  const product = await store.createProduct({
    brandProfileId: brand.id,
    nameKr,
    nameJa: String(form.get('nameJa') ?? '').trim().slice(0, 60),
    category: String(form.get('category') ?? '').trim().slice(0, 40),
    memo: String(form.get('memo') ?? '').slice(0, 500),
    images,
  });
  logger.info('제품 자산 생성', { productId: product.id, brandProfileId: brand.id, nameKr });
  return NextResponse.json({ product }, { status: 201 });
}

/**
 * 파일 기반 저장 (dev 폴백) — Supabase 키가 없을 때 .data/*.json 으로 전체 플로우를 확인한다.
 * 단일 프로세스 dev 전용(동시성 보호는 프로세스 내 직렬화 큐 수준). 커밋 금지(.gitignore).
 */

import { mkdirSync, existsSync } from 'node:fs';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  BrandProfileRecord,
  DiagnosisRequestRecord,
  GeneratedAssetRecord,
  MatchRequestRecord,
  ProductRecord,
  ReportRecord,
  Store,
} from './store';
import { LEGACY_BRAND_ID } from './store';
import type { TierInput } from '../engine/types';
import type { LlmCallLogEntry } from '../engine/llm/client';

const DATA_DIR = path.join(process.cwd(), '.data');
const REQUESTS = path.join(DATA_DIR, 'diagnosis-requests.json');
const REPORTS = path.join(DATA_DIR, 'reports.json');
const LLM_LOGS = path.join(DATA_DIR, 'llm-call-logs.jsonl');
/** 구 싱글턴 파일(단일 객체) — 최초 읽기 때 배열 파일로 마이그레이션 */
const BRAND_PROFILE_LEGACY = path.join(DATA_DIR, 'brand-profile.json');
/** 신규 복수 브랜드 파일(배열) */
const BRAND_PROFILES = path.join(DATA_DIR, 'brand-profiles.json');
const ASSETS = path.join(DATA_DIR, 'generated-assets.json');
const MATCH_REQUESTS = path.join(DATA_DIR, 'match-requests.json');
const PRODUCTS = path.join(DATA_DIR, 'products.json');

/** 구 데이터(brandProfileId 없음)를 레거시 브랜드에 귀속시키는 스코핑 키 */
function brandOf(record: { brandProfileId?: string }): string {
  return record.brandProfileId ?? LEGACY_BRAND_ID;
}

/** 파일 IO를 순차화하는 초간단 큐(경합 방지) */
let chain: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * 브랜드 배열 읽기 — 신규 파일이 없으면 구 싱글턴을 배열로 마이그레이션한다.
 * 마이그레이션 브랜드는 id를 그대로 두므로(=LEGACY_BRAND_ID) 구 요청·자산의
 * brandProfileId 없음이 이 브랜드로 자연 귀속된다. serialized() 블록 안에서만 호출.
 */
async function readBrands(): Promise<BrandProfileRecord[]> {
  const arr = await readJson<BrandProfileRecord[] | null>(BRAND_PROFILES, null);
  if (arr) return arr;
  const legacy = await readJson<BrandProfileRecord | null>(BRAND_PROFILE_LEGACY, null);
  const migrated = legacy ? [{ ...legacy, id: legacy.id || LEGACY_BRAND_ID }] : [];
  if (migrated.length) await writeJson(BRAND_PROFILES, migrated);
  return migrated;
}

/** .data/ 파일 스토어 구현 */
export function createFileStore(): Store {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  return {
    kind: () => 'file',

    createRequest(input: TierInput, brandProfileId: string) {
      return serialized(async () => {
        const now = new Date().toISOString();
        const record: DiagnosisRequestRecord = {
          id: randomUUID(),
          brandProfileId,
          tierInput: input,
          precisionLimited: false,
          status: 'submitted',
          stage: null,
          error: null,
          createdAt: now,
          updatedAt: now,
        };
        const all = await readJson<DiagnosisRequestRecord[]>(REQUESTS, []);
        all.push(record);
        await writeJson(REQUESTS, all);
        return record;
      });
    },

    getRequest(id) {
      return serialized(async () => {
        const all = await readJson<DiagnosisRequestRecord[]>(REQUESTS, []);
        return all.find((r) => r.id === id) ?? null;
      });
    },

    updateRequest(id, patch) {
      return serialized(async () => {
        const all = await readJson<DiagnosisRequestRecord[]>(REQUESTS, []);
        const idx = all.findIndex((r) => r.id === id);
        if (idx < 0) return;
        all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
        await writeJson(REQUESTS, all);
      });
    },

    saveReport(report: ReportRecord) {
      return serialized(async () => {
        const all = await readJson<ReportRecord[]>(REPORTS, []);
        const idx = all.findIndex((r) => r.requestId === report.requestId);
        if (idx >= 0) all[idx] = report;
        else all.push(report);
        await writeJson(REPORTS, all);
      });
    },

    getReport(requestId) {
      return serialized(async () => {
        const all = await readJson<ReportRecord[]>(REPORTS, []);
        return all.find((r) => r.requestId === requestId) ?? null;
      });
    },

    async saveLlmLog(requestId, entry: LlmCallLogEntry) {
      await serialized(async () => {
        const row = { id: randomUUID(), requestId, ...entry, createdAt: new Date().toISOString() };
        await appendFile(LLM_LOGS, JSON.stringify(row) + '\n', 'utf8');
      });
    },

    // ── 스프린트 2 ───────────────────────────────────────────────────────────

    listRequests(brandProfileId: string) {
      return serialized(async () => {
        const all = await readJson<DiagnosisRequestRecord[]>(REQUESTS, []);
        return all
          .filter((r) => brandOf(r) === brandProfileId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },

    listReports(brandProfileId: string) {
      return serialized(async () => {
        const all = await readJson<ReportRecord[]>(REPORTS, []);
        return all
          .filter((r) => brandOf(r) === brandProfileId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },

    listBrandProfiles() {
      return serialized(async () => {
        const all = await readBrands();
        return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },

    getBrandProfile(id: string) {
      return serialized(async () => (await readBrands()).find((b) => b.id === id) ?? null);
    },

    createBrandProfile(input) {
      return serialized(async () => {
        const now = new Date().toISOString();
        const record: BrandProfileRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
        const all = await readBrands();
        all.push(record);
        await writeJson(BRAND_PROFILES, all);
        return record;
      });
    },

    saveBrandProfile(profile: BrandProfileRecord) {
      return serialized(async () => {
        const all = await readBrands();
        const idx = all.findIndex((b) => b.id === profile.id);
        if (idx >= 0) all[idx] = profile;
        else all.push(profile);
        await writeJson(BRAND_PROFILES, all);
      });
    },

    deleteBrandProfile(id: string) {
      return serialized(async () => {
        // 종속 레코드 cascade — 물리 파일(.data/files)은 dev에서 고아로 남겨둠(무해)
        const brands = (await readBrands()).filter((b) => b.id !== id);
        await writeJson(BRAND_PROFILES, brands);
        const requests = (await readJson<DiagnosisRequestRecord[]>(REQUESTS, [])).filter((r) => brandOf(r) !== id);
        await writeJson(REQUESTS, requests);
        const keepReqIds = new Set(requests.map((r) => r.id));
        const reports = (await readJson<ReportRecord[]>(REPORTS, [])).filter(
          (r) => brandOf(r) !== id && keepReqIds.has(r.requestId),
        );
        await writeJson(REPORTS, reports);
        const assets = (await readJson<GeneratedAssetRecord[]>(ASSETS, [])).filter((a) => brandOf(a) !== id);
        await writeJson(ASSETS, assets);
        const matches = (await readJson<MatchRequestRecord[]>(MATCH_REQUESTS, [])).filter((m) => brandOf(m) !== id);
        await writeJson(MATCH_REQUESTS, matches);
        const products = (await readJson<ProductRecord[]>(PRODUCTS, [])).filter((pr) => brandOf(pr) !== id);
        await writeJson(PRODUCTS, products);
      });
    },

    createAsset(input) {
      return serialized(async () => {
        const now = new Date().toISOString();
        const record: GeneratedAssetRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
        const all = await readJson<GeneratedAssetRecord[]>(ASSETS, []);
        all.push(record);
        await writeJson(ASSETS, all);
        return record;
      });
    },

    getAsset(id) {
      return serialized(async () => {
        const all = await readJson<GeneratedAssetRecord[]>(ASSETS, []);
        return all.find((a) => a.id === id) ?? null;
      });
    },

    updateAsset(id, patch) {
      return serialized(async () => {
        const all = await readJson<GeneratedAssetRecord[]>(ASSETS, []);
        const idx = all.findIndex((a) => a.id === id);
        if (idx < 0) return;
        all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
        await writeJson(ASSETS, all);
      });
    },

    listAssets(brandProfileId: string) {
      return serialized(async () => {
        const all = await readJson<GeneratedAssetRecord[]>(ASSETS, []);
        return all
          .filter((a) => brandOf(a) === brandProfileId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },

    createMatchRequest(input) {
      return serialized(async () => {
        const now = new Date().toISOString();
        const record: MatchRequestRecord = {
          ...input,
          id: randomUUID(),
          status: 'submitted',
          createdAt: now,
          updatedAt: now,
        };
        const all = await readJson<MatchRequestRecord[]>(MATCH_REQUESTS, []);
        all.push(record);
        await writeJson(MATCH_REQUESTS, all);
        return record;
      });
    },

    getActiveMatchRequest(brandProfileId: string) {
      return serialized(async () => {
        const all = await readJson<MatchRequestRecord[]>(MATCH_REQUESTS, []);
        return (
          all
            .filter((m) => brandOf(m) === brandProfileId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .find((m) => m.status !== 'cancelled') ?? null
        );
      });
    },

    cancelMatchRequest(id) {
      return serialized(async () => {
        const all = await readJson<MatchRequestRecord[]>(MATCH_REQUESTS, []);
        const idx = all.findIndex((m) => m.id === id);
        if (idx < 0) return;
        all[idx] = { ...all[idx], status: 'cancelled', updatedAt: new Date().toISOString() };
        await writeJson(MATCH_REQUESTS, all);
      });
    },

    // ── 제품 자산(BRAND-03) ──────────────────────────────────────────────────
    listProducts(brandProfileId: string) {
      return serialized(async () => {
        const all = await readJson<ProductRecord[]>(PRODUCTS, []);
        return all
          .filter((pr) => brandOf(pr) === brandProfileId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },

    getProduct(id: string) {
      return serialized(async () => (await readJson<ProductRecord[]>(PRODUCTS, [])).find((pr) => pr.id === id) ?? null);
    },

    createProduct(input) {
      return serialized(async () => {
        const now = new Date().toISOString();
        const record: ProductRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
        const all = await readJson<ProductRecord[]>(PRODUCTS, []);
        all.push(record);
        await writeJson(PRODUCTS, all);
        return record;
      });
    },

    updateProduct(id, patch) {
      return serialized(async () => {
        const all = await readJson<ProductRecord[]>(PRODUCTS, []);
        const idx = all.findIndex((pr) => pr.id === id);
        if (idx < 0) return;
        all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
        await writeJson(PRODUCTS, all);
      });
    },

    deleteProduct(id) {
      return serialized(async () => {
        const all = await readJson<ProductRecord[]>(PRODUCTS, []);
        await writeJson(PRODUCTS, all.filter((pr) => pr.id !== id));
      });
    },
  };
}

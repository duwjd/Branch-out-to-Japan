/**
 * 파일 기반 저장 (dev 폴백) — Supabase 키가 없을 때 .data/*.json 으로 전체 플로우를 확인한다.
 * 단일 프로세스 dev 전용(동시성 보호는 프로세스 내 직렬화 큐 수준). 커밋 금지(.gitignore).
 */

import { mkdirSync, existsSync } from 'node:fs';
import { readFile, writeFile, appendFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  AssetBlockRecord,
  AuthTokenRecord,
  BrandProfileRecord,
  DiagnosisRequestRecord,
  GeneratedAssetRecord,
  GeneratedAssetSummary,
  LeadRecord,
  MatchRequestRecord,
  ProductRecord,
  ReportRecord,
  ReportSummary,
  Store,
  TrackEventRecord,
  UserRecord,
} from './store';
import { LEGACY_BRAND_ID, LEGACY_USER_ID } from './store';
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
const ASSET_BLOCKS = path.join(DATA_DIR, 'asset-blocks.json');
const MATCH_REQUESTS = path.join(DATA_DIR, 'match-requests.json');
const LEADS = path.join(DATA_DIR, 'leads.json');
const TRACK_EVENTS = path.join(DATA_DIR, 'track-events.json');
const PRODUCTS = path.join(DATA_DIR, 'products.json');
const USERS = path.join(DATA_DIR, 'users.json');
const AUTH_TOKENS = path.join(DATA_DIR, 'auth-tokens.json');

/**
 * 전체 레코드 → 목록용 요약. 파일 스토어는 컬럼 선택이 없으므로 읽은 뒤 잘라낸다.
 * (Supabase 구현은 애초에 무거운 컬럼을 SELECT 하지 않는다 — supabaseStore.ts)
 * 화면이 요약 필드만 쓰도록 강제하는 게 목적이라 파일 스토어도 같은 타입을 반환한다.
 */
function toAssetSummary(a: GeneratedAssetRecord): GeneratedAssetSummary {
  const { detailInput, explanationJson, gateResult, proof, promoInput, promptUsed, slicePaths, ...summary } = a;
  void detailInput, explanationJson, gateResult, proof, promoInput, promptUsed, slicePaths;
  return summary;
}

function toReportSummary(r: ReportRecord): ReportSummary {
  const { blocksJson, ...summary } = r;
  void blocksJson;
  return summary;
}

/** 구 데이터(brandProfileId 없음)를 레거시 브랜드에 귀속시키는 스코핑 키 */
function brandOf(record: { brandProfileId?: string }): string {
  return record.brandProfileId ?? LEGACY_BRAND_ID;
}

/** 구 데이터(userId 없음)를 레거시 유저(demo-user)에 귀속시키는 스코핑 키 */
function ownerOf(record: { userId?: string }): string {
  return record.userId ?? LEGACY_USER_ID;
}

/**
 * 쓰기(read-modify-write)를 순차화하는 초간단 큐 — lost update 방지.
 *
 * ⚠ **읽기는 이 큐에 넣지 않는다**(→ concurrent). 읽기까지 넣으면 큐가 프로세스 전역
 * 단일 병목이 되어, 상세페이지 생성 1건(detailJob 의 store 호출 29회 + 블록마다
 * incrementBlockDone)이 도는 동안 /app 의 모든 페이지 렌더가 그 뒤에 줄을 선다.
 * 레이아웃의 Promise.all 도 여기서 무력화됐었다.
 */
let chain: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

/**
 * 순수 조회 — 큐를 통과하지 않고 즉시 실행한다. writeJson 이 원자적 교체(rename)라
 * 부분 기록된 파일을 읽을 일이 없으므로, 읽기는 항상 직전에 커밋된 온전한 스냅샷을 본다.
 */
function concurrent<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

/**
 * 원자적 쓰기 — 임시 파일에 쓴 뒤 rename 으로 교체한다.
 * writeFile 직접 호출은 truncate 후 기록이라, 큐 밖에서 도는 읽기가 반쪽짜리 JSON을 만나
 * JSON.parse 가 터질 수 있다. rename 은 같은 파일시스템에서 원자적이라 그 창이 없다.
 */
async function writeJson(file: string, data: unknown): Promise<void> {
  const tmp = `${file}.tmp-${randomUUID()}`;
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await rename(tmp, file);
}

/**
 * 브랜드 배열 읽기 — 신규 파일이 없으면 구 싱글턴을 배열로 마이그레이션한다.
 * 마이그레이션 브랜드는 id를 그대로 두므로(=LEGACY_BRAND_ID) 구 요청·자산의
 * brandProfileId 없음이 이 브랜드로 자연 귀속된다.
 * 마이그레이션 기록은 큐 밖(concurrent)에서도 일어날 수 있으나, 같은 내용을 원자적 rename 으로
 * 교체하는 1회성 동작이라 동시에 겹쳐도 결과가 같다.
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
      return concurrent(async () => {
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
      return concurrent(async () => {
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
      return concurrent(async () => {
        const all = await readJson<DiagnosisRequestRecord[]>(REQUESTS, []);
        return all
          .filter((r) => brandOf(r) === brandProfileId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },

    listReports(brandProfileId: string) {
      return concurrent(async () => {
        const all = await readJson<ReportRecord[]>(REPORTS, []);
        return all
          .filter((r) => brandOf(r) === brandProfileId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(toReportSummary);
      });
    },

    /** 파일 스토어에는 카운트 쿼리가 없으므로 읽어서 센다 — 큐 밖이라 다른 요청을 막지 않는다 */
    getBrandCounts(brandProfileId: string) {
      return concurrent(async () => {
        const [reports, assets] = await Promise.all([
          readJson<ReportRecord[]>(REPORTS, []),
          readJson<GeneratedAssetRecord[]>(ASSETS, []),
        ]);
        return {
          publishedReports: reports.filter((r) => brandOf(r) === brandProfileId && r.publishedAt !== null).length,
          doneAssets: assets.filter((a) => brandOf(a) === brandProfileId && a.status === 'done').length,
        };
      });
    },

    listBrandProfiles(userId: string) {
      return concurrent(async () => {
        // 구 브랜드(userId 없음)는 ownerOf가 demo-user로 귀속 — .data/brand-profiles.json은 재기록하지 않는다
        const all = await readBrands();
        return all
          .filter((b) => ownerOf(b) === userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },

    getBrandProfile(id: string) {
      return concurrent(async () => (await readBrands()).find((b) => b.id === id) ?? null);
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
      return concurrent(async () => {
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

    getAssetStatus(id: string) {
      return concurrent(async () => {
        const all = await readJson<GeneratedAssetRecord[]>(ASSETS, []);
        const a = all.find((x) => x.id === id);
        if (!a) return null;
        return {
          id: a.id,
          brandProfileId: brandOf(a),
          kind: a.kind,
          status: a.status,
          stage: a.stage,
          error: a.error,
          blockTotal: a.blockTotal ?? 0,
          blockDone: a.blockDone ?? 0,
          updatedAt: a.updatedAt,
        };
      });
    },

    listAssets(brandProfileId: string) {
      return concurrent(async () => {
        const all = await readJson<GeneratedAssetRecord[]>(ASSETS, []);
        return all
          .filter((a) => brandOf(a) === brandProfileId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(toAssetSummary);
      });
    },

    // ── ② 상세페이지 블록 ────────────────────────────────────────────────
    // serialized() 큐가 read-modify-write 를 직렬화하므로 dev 단일 프로세스에서는
    // 동시 완료로 인한 lost update 가 발생하지 않는다(운영은 Supabase 행 단위).
    createBlocks(assetId, blocks) {
      return serialized(async () => {
        const now = new Date().toISOString();
        const created: AssetBlockRecord[] = blocks.map((b) => ({
          ...b,
          id: randomUUID(),
          assetId,
          createdAt: now,
          updatedAt: now,
        }));
        const all = await readJson<AssetBlockRecord[]>(ASSET_BLOCKS, []);
        all.push(...created);
        await writeJson(ASSET_BLOCKS, all);
        return created.sort((a, b) => a.seq - b.seq);
      });
    },

    listBlocks(assetId) {
      return concurrent(async () => {
        const all = await readJson<AssetBlockRecord[]>(ASSET_BLOCKS, []);
        return all.filter((b) => b.assetId === assetId).sort((a, b) => a.seq - b.seq);
      });
    },

    listBlockStatuses(assetId) {
      return concurrent(async () => {
        const all = await readJson<AssetBlockRecord[]>(ASSET_BLOCKS, []);
        return all
          .filter((b) => b.assetId === assetId)
          .sort((a, b) => a.seq - b.seq)
          .map((b) => ({ id: b.id, status: b.status, version: b.version }));
      });
    },

    getBlock(blockId) {
      return concurrent(async () => {
        const all = await readJson<AssetBlockRecord[]>(ASSET_BLOCKS, []);
        return all.find((b) => b.id === blockId) ?? null;
      });
    },

    updateBlock(blockId, patch) {
      return serialized(async () => {
        const all = await readJson<AssetBlockRecord[]>(ASSET_BLOCKS, []);
        const idx = all.findIndex((b) => b.id === blockId);
        if (idx < 0) return;
        all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
        await writeJson(ASSET_BLOCKS, all);
      });
    },

    incrementBlockDone(assetId) {
      return serialized(async () => {
        const all = await readJson<GeneratedAssetRecord[]>(ASSETS, []);
        const idx = all.findIndex((a) => a.id === assetId);
        if (idx < 0) return;
        all[idx] = { ...all[idx], blockDone: (all[idx].blockDone ?? 0) + 1, updatedAt: new Date().toISOString() };
        await writeJson(ASSETS, all);
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
      return concurrent(async () => {
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

    // ── 검증 랜딩(/lp) 리드·트래킹 ─────────────────────────────────────────

    createLead(input) {
      return serialized(async () => {
        const record: LeadRecord = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
        const all = await readJson<LeadRecord[]>(LEADS, []);
        all.push(record);
        await writeJson(LEADS, all);
        return record;
      });
    },

    listLeads() {
      return concurrent(async () => {
        const all = await readJson<LeadRecord[]>(LEADS, []);
        return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },

    createTrackEvent(input) {
      return serialized(async () => {
        const record: TrackEventRecord = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
        const all = await readJson<TrackEventRecord[]>(TRACK_EVENTS, []);
        all.push(record);
        await writeJson(TRACK_EVENTS, all);
        return record;
      });
    },

    listTrackEvents() {
      return concurrent(async () => {
        const all = await readJson<TrackEventRecord[]>(TRACK_EVENTS, []);
        return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },

    // ── 제품 자산(BRAND-03) ──────────────────────────────────────────────────
    listProducts(brandProfileId: string) {
      return concurrent(async () => {
        const all = await readJson<ProductRecord[]>(PRODUCTS, []);
        return all
          .filter((pr) => brandOf(pr) === brandProfileId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },

    getProduct(id: string) {
      return concurrent(async () => (await readJson<ProductRecord[]>(PRODUCTS, [])).find((pr) => pr.id === id) ?? null);
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

    // ── 유저·인증 토큰(실 인증 — 08 §6 USER) ──────────────────────────────────
    getUserById(id: string) {
      return concurrent(async () => (await readJson<UserRecord[]>(USERS, [])).find((u) => u.id === id) ?? null);
    },

    getUserByEmail(email: string) {
      return concurrent(async () => {
        const norm = email.toLowerCase();
        return (await readJson<UserRecord[]>(USERS, [])).find((u) => u.email === norm) ?? null;
      });
    },

    createUser(input) {
      return serialized(async () => {
        const now = new Date().toISOString();
        const record: UserRecord = {
          id: input.id ?? randomUUID(),
          email: input.email.toLowerCase(),
          passwordHash: input.passwordHash,
          name: input.name,
          emailVerified: input.emailVerified,
          createdAt: now,
          updatedAt: now,
        };
        const all = await readJson<UserRecord[]>(USERS, []);
        all.push(record);
        await writeJson(USERS, all);
        return record;
      });
    },

    updateUser(id, patch) {
      return serialized(async () => {
        const all = await readJson<UserRecord[]>(USERS, []);
        const idx = all.findIndex((u) => u.id === id);
        if (idx < 0) return;
        all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
        await writeJson(USERS, all);
      });
    },

    createAuthToken(input) {
      return serialized(async () => {
        const record: AuthTokenRecord = { ...input, usedAt: null, createdAt: new Date().toISOString() };
        const all = await readJson<AuthTokenRecord[]>(AUTH_TOKENS, []);
        all.push(record);
        await writeJson(AUTH_TOKENS, all);
      });
    },

    consumeAuthToken(tokenHash: string, kind: 'verify' | 'reset') {
      // 원자성은 serialized 큐가 보장한다(단일 프로세스 dev) — 미사용·미만료만 소비
      return serialized(async () => {
        const all = await readJson<AuthTokenRecord[]>(AUTH_TOKENS, []);
        const idx = all.findIndex((t) => t.tokenHash === tokenHash && t.kind === kind);
        if (idx < 0) return null;
        const token = all[idx];
        const now = new Date().toISOString();
        if (token.usedAt !== null || token.expiresAt < now) return null;
        all[idx] = { ...token, usedAt: now };
        await writeJson(AUTH_TOKENS, all);
        return all[idx];
      });
    },

    getLatestAuthToken(userId: string, kind: 'verify' | 'reset') {
      return concurrent(async () => {
        const all = await readJson<AuthTokenRecord[]>(AUTH_TOKENS, []);
        return (
          all
            .filter((t) => t.userId === userId && t.kind === kind)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
        );
      });
    },
  };
}

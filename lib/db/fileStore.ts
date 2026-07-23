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
  LeadRecord,
  MatchRequestRecord,
  ReportRecord,
  Store,
  TrackEventRecord,
} from './store';
import type { TierInput } from '../engine/types';
import type { LlmCallLogEntry } from '../engine/llm/client';

const DATA_DIR = path.join(process.cwd(), '.data');
const REQUESTS = path.join(DATA_DIR, 'diagnosis-requests.json');
const REPORTS = path.join(DATA_DIR, 'reports.json');
const LLM_LOGS = path.join(DATA_DIR, 'llm-call-logs.jsonl');
const BRAND_PROFILE = path.join(DATA_DIR, 'brand-profile.json');
const ASSETS = path.join(DATA_DIR, 'generated-assets.json');
const MATCH_REQUESTS = path.join(DATA_DIR, 'match-requests.json');
const LEADS = path.join(DATA_DIR, 'leads.json');
const TRACK_EVENTS = path.join(DATA_DIR, 'track-events.json');

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

/** .data/ 파일 스토어 구현 */
export function createFileStore(): Store {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  return {
    kind: () => 'file',

    createRequest(input: TierInput) {
      return serialized(async () => {
        const now = new Date().toISOString();
        const record: DiagnosisRequestRecord = {
          id: randomUUID(),
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

    listRequests() {
      return serialized(async () => {
        const all = await readJson<DiagnosisRequestRecord[]>(REQUESTS, []);
        return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },

    listReports() {
      return serialized(async () => {
        const all = await readJson<ReportRecord[]>(REPORTS, []);
        return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },

    getBrandProfile() {
      return serialized(() => readJson<BrandProfileRecord | null>(BRAND_PROFILE, null));
    },

    saveBrandProfile(profile: BrandProfileRecord) {
      return serialized(() => writeJson(BRAND_PROFILE, profile));
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

    listAssets() {
      return serialized(async () => {
        const all = await readJson<GeneratedAssetRecord[]>(ASSETS, []);
        return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

    getActiveMatchRequest() {
      return serialized(async () => {
        const all = await readJson<MatchRequestRecord[]>(MATCH_REQUESTS, []);
        return (
          [...all]
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
      return serialized(async () => {
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
      return serialized(async () => {
        const all = await readJson<TrackEventRecord[]>(TRACK_EVENTS, []);
        return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },
  };
}

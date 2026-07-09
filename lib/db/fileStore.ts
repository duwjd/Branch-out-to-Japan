/**
 * 파일 기반 저장 (dev 폴백) — Supabase 키가 없을 때 .data/*.json 으로 전체 플로우를 확인한다.
 * 단일 프로세스 dev 전용(동시성 보호는 프로세스 내 직렬화 큐 수준). 커밋 금지(.gitignore).
 */

import { mkdirSync, existsSync } from 'node:fs';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DiagnosisRequestRecord, ReportRecord, ReviewQueueItem, Store } from './store';
import type { ReportStatus, TierInput } from '../engine/types';
import type { LlmCallLogEntry } from '../engine/llm/client';

const DATA_DIR = path.join(process.cwd(), '.data');
const REQUESTS = path.join(DATA_DIR, 'diagnosis-requests.json');
const REPORTS = path.join(DATA_DIR, 'reports.json');
const LLM_LOGS = path.join(DATA_DIR, 'llm-call-logs.jsonl');

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

    listByStatus(status: ReportStatus) {
      return serialized(async () => {
        const requests = await readJson<DiagnosisRequestRecord[]>(REQUESTS, []);
        const reports = await readJson<ReportRecord[]>(REPORTS, []);
        const byId = new Map(reports.map((r) => [r.requestId, r]));
        const items: ReviewQueueItem[] = [];
        for (const request of requests.filter((r) => r.status === status)) {
          const report = byId.get(request.id);
          if (report) items.push({ request, report });
        }
        return items.sort((a, b) => a.request.createdAt.localeCompare(b.request.createdAt));
      });
    },

    signReport(requestId, reviewerName) {
      return serialized(async () => {
        const now = new Date().toISOString();
        const reports = await readJson<ReportRecord[]>(REPORTS, []);
        const idx = reports.findIndex((r) => r.requestId === requestId);
        if (idx >= 0) {
          reports[idx] = { ...reports[idx], reviewerName, reviewerSignedAt: now, publishedAt: now, rejectedReason: null };
          await writeJson(REPORTS, reports);
        }
        const requests = await readJson<DiagnosisRequestRecord[]>(REQUESTS, []);
        const rIdx = requests.findIndex((r) => r.id === requestId);
        if (rIdx >= 0) {
          requests[rIdx] = { ...requests[rIdx], status: 'published', updatedAt: now };
          await writeJson(REQUESTS, requests);
        }
      });
    },

    rejectReport(requestId, reason) {
      return serialized(async () => {
        const now = new Date().toISOString();
        const reports = await readJson<ReportRecord[]>(REPORTS, []);
        const idx = reports.findIndex((r) => r.requestId === requestId);
        if (idx >= 0) {
          reports[idx] = { ...reports[idx], rejectedReason: reason };
          await writeJson(REPORTS, reports);
        }
        const requests = await readJson<DiagnosisRequestRecord[]>(REQUESTS, []);
        const rIdx = requests.findIndex((r) => r.id === requestId);
        if (rIdx >= 0) {
          requests[rIdx] = { ...requests[rIdx], status: 'rejected', updatedAt: now };
          await writeJson(REQUESTS, requests);
        }
      });
    },

    async saveLlmLog(requestId, entry: LlmCallLogEntry) {
      await serialized(async () => {
        const row = { id: randomUUID(), requestId, ...entry, createdAt: new Date().toISOString() };
        await appendFile(LLM_LOGS, JSON.stringify(row) + '\n', 'utf8');
      });
    },
  };
}

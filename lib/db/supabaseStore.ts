/**
 * Supabase 저장 구현 — 08 §6 엔티티의 테이블 매핑(스키마: supabase/schema.sql).
 * 서버 전용(service role 키 사용 — 클라이언트 번들에 절대 노출 금지).
 */

import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';
import type {
  AuthTokenRecord,
  BrandProfileRecord,
  DiagnosisRequestRecord,
  GeneratedAssetRecord,
  LeadRecord,
  MatchRequestRecord,
  ProductRecord,
  ReportRecord,
  Store,
  TrackEventRecord,
  UserRecord,
} from './store';
import { LEGACY_BRAND_ID, LEGACY_USER_ID } from './store';
import type { BlocksJson, ReportStatus, TierInput } from '../engine/types';
import type { LlmCallLogEntry } from '../engine/llm/client';

interface RequestRow {
  id: string;
  brand_profile_id: string | null;
  tier_input: TierInput;
  precision_limited: boolean;
  status: ReportStatus;
  stage: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface ReportRow {
  request_id: string;
  brand_profile_id: string | null;
  blocks_json: BlocksJson;
  overall_score: number | null;
  group_scores: ReportRecord['groupScores'];
  top3: ReportRecord['top3'];
  published_at: string | null;
  created_at: string;
}

function toRequestRecord(row: RequestRow): DiagnosisRequestRecord {
  return {
    id: row.id,
    brandProfileId: row.brand_profile_id ?? LEGACY_BRAND_ID,
    tierInput: row.tier_input,
    precisionLimited: row.precision_limited,
    status: row.status,
    stage: row.stage,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toReportRecord(row: ReportRow): ReportRecord {
  return {
    requestId: row.request_id,
    brandProfileId: row.brand_profile_id ?? LEGACY_BRAND_ID,
    blocksJson: row.blocks_json,
    overallScore: row.overall_score,
    groupScores: row.group_scores,
    top3: row.top3,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

// ── 유저·인증 토큰 행 매핑 (스키마: supabase/schema.sql — 08 §6 USER) ──

interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  name: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    emailVerified: row.email_verified,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface AuthTokenRow {
  token_hash: string;
  user_id: string;
  kind: AuthTokenRecord['kind'];
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

function toAuthTokenRecord(row: AuthTokenRow): AuthTokenRecord {
  return {
    tokenHash: row.token_hash,
    userId: row.user_id,
    kind: row.kind,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };
}

// ── 스프린트 2 행 매핑 (스키마: supabase/schema.sql — 08 §6.1 스프린트 2 델타) ──

interface BrandProfileRow {
  id: string;
  user_id: string | null;
  brand_name: string;
  category: BrandProfileRecord['category'];
  product_class: BrandProfileRecord['productClass'];
  positioning_tags: string[];
  target_memo: string;
  product_info_memo: string;
  detail_doc_path: string | null;
  detail_doc_name: string | null;
  channels: BrandProfileRecord['channels'];
  brand_kit: BrandProfileRecord['brandKit'];
  created_at: string;
  updated_at: string;
}

function toBrandProfileRecord(row: BrandProfileRow): BrandProfileRecord {
  return {
    id: row.id,
    userId: row.user_id ?? LEGACY_USER_ID,
    brandName: row.brand_name,
    category: row.category,
    productClass: row.product_class,
    positioningTags: row.positioning_tags,
    targetMemo: row.target_memo,
    productInfoMemo: row.product_info_memo,
    detailDocPath: row.detail_doc_path,
    detailDocName: row.detail_doc_name,
    channels: row.channels,
    brandKit: row.brand_kit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface GeneratedAssetRow {
  id: string;
  brand_profile_id: string | null;
  kind: 'thumbnail';
  style_category: string;
  style_name: string;
  platform: string;
  status: GeneratedAssetRecord['status'];
  stage: string | null;
  error: string | null;
  original_image_path: string;
  image_path: string | null;
  prompt_used: string | null;
  gate_result: GeneratedAssetRecord['gateResult'];
  explanation_json: GeneratedAssetRecord['explanationJson'];
  proof: GeneratedAssetRecord['proof'];
  model_image_path: string | null;
  model_consent: boolean | null;
  promo_input: GeneratedAssetRecord['promoInput'];
  brand_name_snapshot: string;
  created_at: string;
  updated_at: string;
}

function toAssetRecord(row: GeneratedAssetRow): GeneratedAssetRecord {
  return {
    id: row.id,
    brandProfileId: row.brand_profile_id ?? LEGACY_BRAND_ID,
    kind: row.kind,
    styleCategory: row.style_category,
    styleName: row.style_name,
    platform: row.platform,
    status: row.status,
    stage: row.stage,
    error: row.error,
    originalImagePath: row.original_image_path,
    imagePath: row.image_path,
    promptUsed: row.prompt_used,
    gateResult: row.gate_result,
    explanationJson: row.explanation_json,
    proof: row.proof,
    modelImagePath: row.model_image_path ?? null,
    modelConsent: row.model_consent ?? false,
    promoInput: row.promo_input ?? null,
    brandNameSnapshot: row.brand_name_snapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface MatchRequestRow {
  id: string;
  brand_profile_id: string | null;
  partner_types: string[];
  channels: string[];
  timing: string;
  memo: string;
  status: MatchRequestRecord['status'];
  snapshot: MatchRequestRecord['snapshot'];
  created_at: string;
  updated_at: string;
}

function toMatchRecord(row: MatchRequestRow): MatchRequestRecord {
  return {
    id: row.id,
    brandProfileId: row.brand_profile_id ?? LEGACY_BRAND_ID,
    partnerTypes: row.partner_types,
    channels: row.channels,
    timing: row.timing,
    memo: row.memo,
    status: row.status,
    snapshot: row.snapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── 검증 랜딩(/lp) 리드·트래킹 행 매핑 (스키마: supabase/schema.sql) ──────────

interface LeadRow {
  id: string;
  kind: LeadRecord['kind'];
  brand_name: string;
  contact_name: string;
  contact: string;
  channels: string[];
  stage: string;
  pain_points: string[];
  memo: string;
  source: string;
  created_at: string;
}

function toLeadRecord(row: LeadRow): LeadRecord {
  return {
    id: row.id,
    kind: row.kind,
    brandName: row.brand_name,
    contactName: row.contact_name,
    contact: row.contact,
    channels: row.channels,
    stage: row.stage,
    painPoints: row.pain_points,
    memo: row.memo,
    source: row.source,
    createdAt: row.created_at,
  };
}

interface TrackEventRow {
  id: string;
  type: TrackEventRecord['type'];
  cta: string | null;
  source: string;
  path: string;
  created_at: string;
}

function toTrackEventRecord(row: TrackEventRow): TrackEventRecord {
  return {
    id: row.id,
    type: row.type,
    cta: row.cta,
    source: row.source,
    path: row.path,
    createdAt: row.created_at,
  };
}

interface ProductRow {
  id: string;
  brand_profile_id: string | null;
  name_kr: string;
  name_ja: string;
  category: string;
  memo: string;
  images: ProductRecord['images'];
  created_at: string;
  updated_at: string;
}

function toProductRecord(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    brandProfileId: row.brand_profile_id ?? LEGACY_BRAND_ID,
    nameKr: row.name_kr,
    nameJa: row.name_ja,
    category: row.category,
    memo: row.memo,
    images: row.images ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Supabase 스토어 생성 — 호출 전 env 존재는 getStore()가 보장 */
export function createSupabaseStore(): Store {
  const client: SupabaseClient = getSupabaseClient();

  /** supabase 오류를 명시적으로 던진다(원인 파악용) */
  function must<T>(result: { data: T | null; error: { message: string } | null }, op: string): T {
    if (result.error) throw new Error(`supabase ${op} 실패: ${result.error.message}`);
    return result.data as T;
  }

  return {
    kind: () => 'supabase',

    async createRequest(input: TierInput, brandProfileId: string) {
      const result = await client
        .from('diagnosis_requests')
        .insert({ tier_input: input, status: 'submitted', brand_profile_id: brandProfileId })
        .select()
        .single<RequestRow>();
      return toRequestRecord(must(result, 'createRequest'));
    },

    async getRequest(id) {
      const result = await client.from('diagnosis_requests').select().eq('id', id).maybeSingle<RequestRow>();
      if (result.error) throw new Error(`supabase getRequest 실패: ${result.error.message}`);
      return result.data ? toRequestRecord(result.data) : null;
    },

    async updateRequest(id, patch) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.stage !== undefined) row.stage = patch.stage;
      if (patch.error !== undefined) row.error = patch.error;
      if (patch.precisionLimited !== undefined) row.precision_limited = patch.precisionLimited;
      const result = await client.from('diagnosis_requests').update(row).eq('id', id);
      if (result.error) throw new Error(`supabase updateRequest 실패: ${result.error.message}`);
    },

    async saveReport(report: ReportRecord) {
      const result = await client.from('reports').upsert(
        {
          request_id: report.requestId,
          brand_profile_id: report.brandProfileId,
          blocks_json: report.blocksJson,
          overall_score: report.overallScore,
          group_scores: report.groupScores,
          top3: report.top3,
          published_at: report.publishedAt,
        },
        { onConflict: 'request_id' },
      );
      if (result.error) throw new Error(`supabase saveReport 실패: ${result.error.message}`);
    },

    async getReport(requestId) {
      const result = await client.from('reports').select().eq('request_id', requestId).maybeSingle<ReportRow>();
      if (result.error) throw new Error(`supabase getReport 실패: ${result.error.message}`);
      return result.data ? toReportRecord(result.data) : null;
    },

    async saveLlmLog(requestId, entry: LlmCallLogEntry) {
      const result = await client.from('llm_call_logs').insert({
        request_id: requestId,
        call_name: entry.callName,
        model: entry.model,
        mode: entry.mode,
        request_summary: entry.requestSummary,
        response_body: entry.responseBody,
        usage: entry.usage,
        status: entry.status,
        duration_ms: entry.durationMs,
      });
      if (result.error) throw new Error(`supabase saveLlmLog 실패: ${result.error.message}`);
    },

    // ── 스프린트 2 ───────────────────────────────────────────────────────────

    async listRequests(brandProfileId: string) {
      const result = await client
        .from('diagnosis_requests')
        .select()
        .eq('brand_profile_id', brandProfileId)
        .order('created_at', { ascending: false })
        .returns<RequestRow[]>();
      return must(result, 'listRequests').map(toRequestRecord);
    },

    async listReports(brandProfileId: string) {
      const result = await client
        .from('reports')
        .select()
        .eq('brand_profile_id', brandProfileId)
        .order('created_at', { ascending: false })
        .returns<ReportRow[]>();
      return must(result, 'listReports').map(toReportRecord);
    },

    async listBrandProfiles(userId: string) {
      const result = await client
        .from('brand_profiles')
        .select()
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .returns<BrandProfileRow[]>();
      return must(result, 'listBrandProfiles').map(toBrandProfileRecord);
    },

    async getBrandProfile(id: string) {
      const result = await client.from('brand_profiles').select().eq('id', id).maybeSingle<BrandProfileRow>();
      if (result.error) throw new Error(`supabase getBrandProfile 실패: ${result.error.message}`);
      return result.data ? toBrandProfileRecord(result.data) : null;
    },

    async createBrandProfile(input) {
      const now = new Date().toISOString();
      const record: BrandProfileRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      await this.saveBrandProfile(record);
      return record;
    },

    async deleteBrandProfile(id: string) {
      // 종속 요청·리포트·자산·매칭은 brand_profile_id FK(on delete cascade)로 DB가 정리
      const result = await client.from('brand_profiles').delete().eq('id', id);
      if (result.error) throw new Error(`supabase deleteBrandProfile 실패: ${result.error.message}`);
    },

    async saveBrandProfile(profile: BrandProfileRecord) {
      const result = await client.from('brand_profiles').upsert(
        {
          id: profile.id,
          user_id: profile.userId,
          brand_name: profile.brandName,
          category: profile.category,
          product_class: profile.productClass,
          positioning_tags: profile.positioningTags,
          target_memo: profile.targetMemo,
          product_info_memo: profile.productInfoMemo,
          detail_doc_path: profile.detailDocPath,
          detail_doc_name: profile.detailDocName,
          channels: profile.channels,
          brand_kit: profile.brandKit,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
      if (result.error) throw new Error(`supabase saveBrandProfile 실패: ${result.error.message}`);
    },

    async createAsset(input) {
      const result = await client
        .from('generated_assets')
        .insert({
          brand_profile_id: input.brandProfileId,
          kind: input.kind,
          style_category: input.styleCategory,
          style_name: input.styleName,
          platform: input.platform,
          status: input.status,
          stage: input.stage,
          error: input.error,
          original_image_path: input.originalImagePath,
          image_path: input.imagePath,
          prompt_used: input.promptUsed,
          gate_result: input.gateResult,
          explanation_json: input.explanationJson,
          proof: input.proof,
          model_image_path: input.modelImagePath,
          model_consent: input.modelConsent,
          promo_input: input.promoInput,
          brand_name_snapshot: input.brandNameSnapshot,
        })
        .select()
        .single<GeneratedAssetRow>();
      return toAssetRecord(must(result, 'createAsset'));
    },

    async getAsset(id) {
      const result = await client.from('generated_assets').select().eq('id', id).maybeSingle<GeneratedAssetRow>();
      if (result.error) throw new Error(`supabase getAsset 실패: ${result.error.message}`);
      return result.data ? toAssetRecord(result.data) : null;
    },

    async updateAsset(id, patch) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.stage !== undefined) row.stage = patch.stage;
      if (patch.error !== undefined) row.error = patch.error;
      if (patch.imagePath !== undefined) row.image_path = patch.imagePath;
      if (patch.promptUsed !== undefined) row.prompt_used = patch.promptUsed;
      if (patch.gateResult !== undefined) row.gate_result = patch.gateResult;
      if (patch.explanationJson !== undefined) row.explanation_json = patch.explanationJson;
      const result = await client.from('generated_assets').update(row).eq('id', id);
      if (result.error) throw new Error(`supabase updateAsset 실패: ${result.error.message}`);
    },

    async listAssets(brandProfileId: string) {
      const result = await client
        .from('generated_assets')
        .select()
        .eq('brand_profile_id', brandProfileId)
        .order('created_at', { ascending: false })
        .returns<GeneratedAssetRow[]>();
      return must(result, 'listAssets').map(toAssetRecord);
    },

    async createMatchRequest(input) {
      const result = await client
        .from('match_requests')
        .insert({
          brand_profile_id: input.brandProfileId,
          partner_types: input.partnerTypes,
          channels: input.channels,
          timing: input.timing,
          memo: input.memo,
          status: 'submitted',
          snapshot: input.snapshot,
        })
        .select()
        .single<MatchRequestRow>();
      return toMatchRecord(must(result, 'createMatchRequest'));
    },

    async getActiveMatchRequest(brandProfileId: string) {
      const result = await client
        .from('match_requests')
        .select()
        .eq('brand_profile_id', brandProfileId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1)
        .returns<MatchRequestRow[]>();
      const rows = must(result, 'getActiveMatchRequest');
      return rows.length ? toMatchRecord(rows[0]) : null;
    },

    async cancelMatchRequest(id) {
      const result = await client
        .from('match_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (result.error) throw new Error(`supabase cancelMatchRequest 실패: ${result.error.message}`);
    },

    // ── 검증 랜딩(/lp) 리드·트래킹 ─────────────────────────────────────────

    async createLead(input) {
      const result = await client
        .from('leads')
        .insert({
          kind: input.kind,
          brand_name: input.brandName,
          contact_name: input.contactName,
          contact: input.contact,
          channels: input.channels,
          stage: input.stage,
          pain_points: input.painPoints,
          memo: input.memo,
          source: input.source,
        })
        .select()
        .single<LeadRow>();
      return toLeadRecord(must(result, 'createLead'));
    },

    async listLeads() {
      const result = await client.from('leads').select().order('created_at', { ascending: false }).returns<LeadRow[]>();
      return must(result, 'listLeads').map(toLeadRecord);
    },

    async createTrackEvent(input) {
      const result = await client
        .from('track_events')
        .insert({
          type: input.type,
          cta: input.cta,
          source: input.source,
          path: input.path,
        })
        .select()
        .single<TrackEventRow>();
      return toTrackEventRecord(must(result, 'createTrackEvent'));
    },

    async listTrackEvents() {
      const result = await client
        .from('track_events')
        .select()
        .order('created_at', { ascending: false })
        .returns<TrackEventRow[]>();
      return must(result, 'listTrackEvents').map(toTrackEventRecord);
    },

    // ── 제품 자산(BRAND-03) ──────────────────────────────────────────────────
    async listProducts(brandProfileId: string) {
      const result = await client
        .from('products')
        .select()
        .eq('brand_profile_id', brandProfileId)
        .order('created_at', { ascending: false })
        .returns<ProductRow[]>();
      return must(result, 'listProducts').map(toProductRecord);
    },

    async getProduct(id: string) {
      const result = await client.from('products').select().eq('id', id).maybeSingle<ProductRow>();
      if (result.error) throw new Error(`supabase getProduct 실패: ${result.error.message}`);
      return result.data ? toProductRecord(result.data) : null;
    },

    async createProduct(input) {
      const result = await client
        .from('products')
        .insert({
          brand_profile_id: input.brandProfileId,
          name_kr: input.nameKr,
          name_ja: input.nameJa,
          category: input.category,
          memo: input.memo,
          images: input.images,
        })
        .select()
        .single<ProductRow>();
      return toProductRecord(must(result, 'createProduct'));
    },

    async updateProduct(id, patch) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.nameKr !== undefined) row.name_kr = patch.nameKr;
      if (patch.nameJa !== undefined) row.name_ja = patch.nameJa;
      if (patch.category !== undefined) row.category = patch.category;
      if (patch.memo !== undefined) row.memo = patch.memo;
      if (patch.images !== undefined) row.images = patch.images;
      const result = await client.from('products').update(row).eq('id', id);
      if (result.error) throw new Error(`supabase updateProduct 실패: ${result.error.message}`);
    },

    async deleteProduct(id) {
      const result = await client.from('products').delete().eq('id', id);
      if (result.error) throw new Error(`supabase deleteProduct 실패: ${result.error.message}`);
    },

    // ── 유저·인증 토큰(실 인증 — 08 §6 USER) ──────────────────────────────────
    async getUserById(id: string) {
      const result = await client.from('users').select().eq('id', id).maybeSingle<UserRow>();
      if (result.error) throw new Error(`supabase getUserById 실패: ${result.error.message}`);
      return result.data ? toUserRecord(result.data) : null;
    },

    async getUserByEmail(email: string) {
      const result = await client.from('users').select().eq('email', email.toLowerCase()).maybeSingle<UserRow>();
      if (result.error) throw new Error(`supabase getUserByEmail 실패: ${result.error.message}`);
      return result.data ? toUserRecord(result.data) : null;
    },

    async createUser(input) {
      const result = await client
        .from('users')
        .insert({
          id: input.id ?? randomUUID(),
          email: input.email.toLowerCase(),
          password_hash: input.passwordHash,
          name: input.name,
          email_verified: input.emailVerified,
        })
        .select()
        .single<UserRow>();
      return toUserRecord(must(result, 'createUser'));
    },

    async updateUser(id, patch) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.passwordHash !== undefined) row.password_hash = patch.passwordHash;
      if (patch.emailVerified !== undefined) row.email_verified = patch.emailVerified;
      if (patch.name !== undefined) row.name = patch.name;
      const result = await client.from('users').update(row).eq('id', id);
      if (result.error) throw new Error(`supabase updateUser 실패: ${result.error.message}`);
    },

    async createAuthToken(input) {
      const result = await client.from('auth_tokens').insert({
        token_hash: input.tokenHash,
        user_id: input.userId,
        kind: input.kind,
        expires_at: input.expiresAt,
      });
      if (result.error) throw new Error(`supabase createAuthToken 실패: ${result.error.message}`);
    },

    async consumeAuthToken(tokenHash: string, kind: 'verify' | 'reset') {
      // 원자적 update-returning — 미사용(used_at is null)·미만료(expires_at > now)만 소비 마킹 후 반환
      const now = new Date().toISOString();
      const result = await client
        .from('auth_tokens')
        .update({ used_at: now })
        .eq('token_hash', tokenHash)
        .eq('kind', kind)
        .is('used_at', null)
        .gt('expires_at', now)
        .select()
        .maybeSingle<AuthTokenRow>();
      if (result.error) throw new Error(`supabase consumeAuthToken 실패: ${result.error.message}`);
      return result.data ? toAuthTokenRecord(result.data) : null;
    },

    async getLatestAuthToken(userId: string, kind: 'verify' | 'reset') {
      const result = await client
        .from('auth_tokens')
        .select()
        .eq('user_id', userId)
        .eq('kind', kind)
        .order('created_at', { ascending: false })
        .limit(1)
        .returns<AuthTokenRow[]>();
      const rows = must(result, 'getLatestAuthToken');
      return rows.length ? toAuthTokenRecord(rows[0]) : null;
    },
  };
}

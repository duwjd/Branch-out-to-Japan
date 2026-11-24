import { getStore } from '@/lib/db/store';
import { getActiveBrand } from '@/lib/server/activeBrand';
import type { DiagnosisRequestRecord, GeneratedAssetSummary, ReportSummary } from '@/lib/db/store';
import { PLATFORM_LABELS, type Platform } from '@/lib/studio/platform';
import { SEASON_EVENTS, seasonFocus, seasonWindow, upcomingEvents, type SeasonFocus } from '@/lib/season';
import {
  PIPELINE_ORDER,
  pipelineDoneCount,
  pipelineStates,
  resolveHomeStep,
  type HomeStep,
  type HomeStepInput,
  type PipelineStepId,
} from '@/lib/home/nextStep';
import { auditCounts, pickReportMaterial } from '@/lib/home/reportMaterial';
import { JobPanel, type DashboardJob } from '@/components/app/JobPanel';
import { BrandOnboarding } from '@/components/app/BrandOnboarding';
import { HomeNextStep, type NextStepAxis, type NextStepCta, type PipelineCell } from '@/components/app/HomeNextStep';
import { HomeSeasonCard } from '@/components/app/HomeSeasonCard';
import { HomeReportCard, HomeReportEmptyCard } from '@/components/app/HomeReportCard';
import {
  categoryLabelKr,
  HomeAttention,
  HomeBrandCard,
  HomeStudioSamples,
  HomeWork,
  type AttentionItem,
  type WorkItem,
} from '@/components/app/HomeWidgets';

/**
 * 홈(앱 홈, MAIN-00~13) — 3축의 현관. 12열 격자 위의 카드 대시보드다.
 *
 * 2026-11-24 전면 재설계. 유사 서비스 홈을 영역별로 조사한 결과에서 출발했다
 * (근거·출처·상태표: docs/decisions/2026-11-24-홈-다음단계-히어로.md):
 *   · 진단형 툴은 점수 옆에 "먼저 고칠 것"과 다음 행동을 한 띠에 둔다(숫자만 세우지 않는다)
 *   · 크리에이티브 툴은 첫 화면이 "무엇을 만들까" 하나이고, 새 계정은 빈 격자 대신 예시로 채운다
 *   · 커머스 어드민은 셋업 가이드를 임시 블록으로 두고, 마감은 크기가 아니라 순위·색으로 올린다
 *   · 디자인 가이드는 화면당 채워진 버튼 1개 · 제목 크기 3단계 · 0건 타일 금지 · 중요한 것은 위·왼쪽
 *
 * 화면은 질문 다섯 개에 차례로 답한다. 왼쪽 8열이 주 동선, 오른쪽 4열이 그 줄의 맥락이다.
 *   머리      어디까지 왔나            — "4단계 중 3단계까지 왔어요"
 *   확인할 것  내가 봐야 할 일이 있나    — 생성 실패 · 기업 매칭 제안 도착(있을 때만)
 *   1줄       지금 무엇을 하나 | 언제까지 — 다음 단계 카드(8) | 시즌 카드(4)
 *   2줄       진단이 뭐라고 했나 | 무엇을 보고 도나 — 진단 카드(8) | 브랜드 프로필(4)
 *   3줄       무엇을 만들었나           — 최근 작업물(12) · 없으면 스튜디오 예시
 *
 * 지키는 것:
 *   ① 채워진 버튼은 화면에 하나(다음 단계 카드). 나머지는 테두리 버튼·텍스트 링크·카드 링크
 *   ② 0건을 숫자로 세우지 않는다 — 빈 카드는 "무엇이 채워질지"를 같은 구획의 빈 틀·예시로 보여 준다
 *   ③ 화면은 실제 동작만 말한다 — 스튜디오는 리포트 결과를 자동으로 받아 쓰지 않고(폐루프 배선은
 *      04-roadmap §0-4 미해결) 진단 없이도 열린다. 그래서 "그대로 재료가 된다"·"진단 후 열립니다"라고
 *      쓰지 않고 "리포트를 기준으로 삼는다"고 쓴다
 *   ④ 홈은 조회 전용이다 — 아무것도 저장하지 않는다(08 §7)
 *
 * 브랜드 미등록이면 온보딩 첫 브랜드 캡처가 홈을 대신한다(MAIN-13).
 * 진행 중 잡은 우하단 플로팅 패널이 폴링으로 추적한다(MAIN-05a).
 */

/** 실패를 홈에서 알리는 기간 — 지난 실패가 영구히 남아 잔소리가 되지 않도록 최근 7일만 본다 */
const FAIL_NOTICE_DAYS = 7;

/** 시즌 타임라인이 보여 주는 기간(일) — 약 6개월 */
const SEASON_WINDOW_DAYS = 180;

/** 시즌 카드 아래 "그다음 시즌" 행 수 */
const SEASON_NEXT_LIMIT = 2;

/** ISO → "2026.07.16" */
function fmtDate(iso: string | null): string {
  return (iso ?? '').slice(0, 10).replaceAll('-', '.');
}

/** ISO → "07.16" — 좁은 자리용(스테퍼 칸) */
function fmtShortDate(iso: string): string {
  return iso.slice(5, 10).replace('-', '.');
}

/** 리포트 표시명 — 제품 진단 / 브랜드 진단 구분(디자인 RECENTS 명명) */
function reportName(req: DiagnosisRequestRecord): string {
  const t = req.tierInput;
  return t.productName ? `${t.productName} 진단 리포트` : `${t.brandName} 브랜드 진단 리포트`;
}

/** 자산 표시명 — "공식샵 신뢰 배지형 · 라쿠텐 공식샵" */
function assetName(a: GeneratedAssetSummary): string {
  return `${a.styleName} · ${PLATFORM_LABELS[a.platform as Platform] ?? a.platform}`;
}

/** 제목의 강조어 — 한 제목에 한 곳만. 굵은 큰 글자라 coral-strong(4.7:1)으로 둔다 */
function Em({ children }: { children: React.ReactNode }) {
  return <em className="text-coral-strong not-italic">{children}</em>;
}

/** 축 → 만들기 화면 버튼(시즌 캘린더 SEASON-04 와 같은 행선지) */
const AXIS_CTA: Record<NextStepAxis, NextStepCta> = {
  report: { href: '/app/report/new', label: '진단 시작 →' },
  thumbnail: { href: '/app/studio/thumbnail', label: '썸네일 만들기 →' },
  detail: { href: '/app/studio/detail', label: '상세페이지 만들기 →' },
};

/** 준비 흐름에서 각 단계가 몇 번째인가 — "다음 단계 · 3/4" 표기용 */
const STEP_NUMBER: Record<PipelineStepId, number> = { brand: 1, report: 2, thumbnail: 3, detail: 4 };

interface NextStepContent {
  kicker: string;
  title: React.ReactNode;
  desc: string;
  primary: NextStepCta;
  secondary: NextStepCta | null;
  /** 예시 그림을 고르는 축 — 버튼이 가는 곳과 같다 */
  axis: NextStepAxis;
}

/**
 * 다음 단계 판정(lib/home/nextStep) → 다음 단계 카드의 문구·버튼·그림.
 * 문구는 그 단계가 실제로 하는 일만 말한다 — 없는 성과·소요 시간을 약속하지 않고(증거 원칙),
 * 리포트 결과가 스튜디오로 자동 전달된다고도 하지 않는다(아직 배선되지 않았다).
 * @param runningReportName 진행 중 진단의 표시명(diagnose·running 에서만 쓴다)
 * @param latestReportId 최신 발행 리포트 id(제작 단계의 "리포트 다시 보기" 행선지)
 */
function nextStepContent(
  step: HomeStep,
  ctx: {
    hasProductInfo: boolean;
    runningReportName: string | null;
    latestReportId: string | null;
    focus: SeasonFocus;
  },
): NextStepContent {
  const total = PIPELINE_ORDER.length;

  if (step.key === 'diagnose') {
    const n = `${STEP_NUMBER.report}/${total}`;
    if (step.mode === 'running') {
      return {
        kicker: `진행 중 · ${n}`,
        title: (
          <>
            <Em>진단이 진행 중</Em>이에요
          </>
        ),
        desc: `${ctx.runningReportName ?? '진단 리포트'} — 리포트가 발행되면 아래 진단 카드가 채워지고, 다음 단계는 썸네일입니다.`,
        primary: { href: `/app/report/${step.targetId}`, label: '진행 상황 보기 →' },
        secondary: null,
        axis: 'report',
      };
    }
    if (step.mode === 'failed') {
      return {
        kicker: `확인 필요 · ${n}`,
        title: '마지막 진단이 끝까지 돌지 못했어요',
        desc: '원인을 확인하고 같은 입력으로 다시 시작할 수 있어요.',
        primary: { href: `/app/report/${step.targetId}`, label: '실패 원인 보기 →' },
        secondary: { href: '/app/report/new', label: '새로 진단하기' },
        axis: 'report',
      };
    }
    return {
      kicker: `다음 단계 · ${n}`,
      title: (
        <>
          일본 고객의 눈으로 <Em>문구부터 진단</Em>해 보세요
        </>
      ),
      desc: '상세페이지·SNS 문구를 올리면 표현 상태와 필요한 근거를 짚고, 일본 고객에게 통하는 문구로 재설계합니다. 이 리포트가 이후 썸네일·상세페이지를 만들 때의 기준이 됩니다.',
      primary: AXIS_CTA.report,
      // 제품 등록은 건너뛸 수 있는 준비 단계다 — 아직 안 했을 때만 보조 버튼으로 둔다
      secondary: ctx.hasProductInfo ? null : { href: '/app/brand', label: '제품 먼저 등록' },
      axis: 'report',
    };
  }

  if (step.key === 'thumbnail') {
    const n = `${STEP_NUMBER.thumbnail}/${total}`;
    if (step.mode === 'running') {
      return {
        kicker: `진행 중 · ${n}`,
        title: (
          <>
            <Em>첫 썸네일</Em>을 만드는 중이에요
          </>
        ),
        desc: '완성되면 최근 작업물에 쌓입니다. 그다음 단계는 상세페이지입니다.',
        primary: { href: `/app/studio/thumbnail/${step.targetId}`, label: '진행 상황 보기 →' },
        secondary: null,
        axis: 'thumbnail',
      };
    }
    return {
      kicker: `다음 단계 · ${n}`,
      title: (
        <>
          이제 <Em>썸네일</Em>을 일본 고객의 문법으로 만들 차례예요
        </>
      ),
      desc: '제품 이미지를 올리고 일본 고객이 신뢰하는 썸네일 문법 8종 중 하나를 고르면 됩니다. 리포트의 재설계 문구와 먼저 고칠 지점을 기준으로 삼으세요.',
      primary: AXIS_CTA.thumbnail,
      secondary: ctx.latestReportId ? { href: `/app/report/${ctx.latestReportId}`, label: '리포트 다시 보기' } : null,
      axis: 'thumbnail',
    };
  }

  if (step.key === 'detail') {
    const n = `${STEP_NUMBER.detail}/${total}`;
    if (step.mode === 'running') {
      return {
        kicker: `진행 중 · ${n}`,
        title: (
          <>
            <Em>상세페이지</Em>를 만드는 중이에요
          </>
        ),
        desc: '완성되면 최근 작업물에 쌓이고, 준비 흐름 네 단계가 모두 채워집니다.',
        primary: { href: `/app/studio/detail/${step.targetId}`, label: '진행 상황 보기 →' },
        secondary: null,
        axis: 'detail',
      };
    }
    return {
      kicker: `다음 단계 · ${n}`,
      title: (
        <>
          이제 <Em>상세페이지</Em>를 일본향으로 바꿔 보세요
        </>
      ),
      desc: '한국형 쇼핑몰 상세페이지를 일본 채널에 맞는 구성과 표현의 상세페이지로 바꿉니다. 리포트의 재설계 문구를 곁에 두고 만들어 보세요.',
      primary: AXIS_CTA.detail,
      secondary: { href: '/app/studio/thumbnail', label: '썸네일 더 만들기' },
      axis: 'detail',
    };
  }

  const { event, steps } = ctx.focus.recommendation;
  if (step.key === 'season') {
    // 브랜드가 아직 밟지 않은 준비 항목이 앞에 온다(seasonRecommendations) — 그 첫 항목이 버튼이 된다
    const first = steps.find((s) => s.axis) ?? null;
    const axis: NextStepAxis = first?.axis ?? 'thumbnail';
    return {
      kicker: `시즌 준비 · ${event.dDay === 0 ? '오늘 시작' : `D-${event.dDay}`}`,
      title:
        event.dDay === 0 ? (
          <>
            오늘 <Em>{event.name}</Em> 시작이에요
          </>
        ) : (
          <>
            <Em>{event.dDay}일 뒤</Em> {event.name}, 준비를 시작할 시점이에요
          </>
        ),
      // 준비 항목과 그 근거(why)는 시즌 데이터가 갖고 있다 — 일본 구매 관례에서 온 문장이다
      desc: first ? `먼저 할 일 — ${first.what}. ${first.why}.` : `${event.prep}입니다.`,
      primary: AXIS_CTA[axis],
      secondary: { href: '/app/season', label: '준비 항목 모두 보기' },
      axis,
    };
  }

  return {
    kicker: '다음 제품 준비',
    title: (
      <>
        다음 제품도 <Em>같은 흐름</Em>으로 준비해 보세요
      </>
    ),
    desc: '새 제품의 문구를 진단하고, 그 리포트를 기준으로 썸네일·상세페이지를 만듭니다.',
    primary: { href: '/app/report/new', label: '새 진단 시작 →' },
    secondary: { href: '/app/studio', label: '스튜디오로 가기' },
    axis: 'report',
  };
}

/**
 * 준비 흐름 스테퍼 4칸 — 완료면 "건수 · 최근 날짜", 다음 단계면 "지금 할 차례", 이후면 "아직 없음".
 * 이후 단계도 링크로 둔다. 구판 체크리스트는 "진단 후 열립니다"라고 적고 막았지만 스튜디오는
 * 사이드바에서 언제든 들어갈 수 있다 — 화면이 없는 잠금을 말하지 않는다. 권하는 순서는 표식이 전한다.
 */
function stepperCells(args: {
  input: HomeStepInput;
  latestReportDate: string | null;
  latestThumbDate: string | null;
  latestDetailDate: string | null;
}): PipelineCell[] {
  const { input } = args;
  const states = pipelineStates(input);

  /** 만드는 단계 1칸 — 진단·썸네일·상세가 같은 규칙을 쓴다 */
  const makeCell = (cell: {
    id: 'report' | 'thumbnail' | 'detail';
    label: string;
    count: number;
    latest: string | null;
    runningText: string;
    listHref: string;
    createHref: string;
    /** 만드는 중인 대상의 진행 화면 — 없으면 null */
    runningHref: string | null;
  }): PipelineCell => {
    const state = states[cell.id];
    const running = cell.runningHref !== null;
    if (state === 'done') {
      return {
        id: cell.id,
        state,
        label: cell.label,
        status: `${cell.count}건 · ${cell.latest ?? ''}`.trim(),
        href: cell.listHref,
        running,
      };
    }
    return {
      id: cell.id,
      state,
      label: cell.label,
      status: running ? cell.runningText : state === 'current' ? '지금 할 차례' : '아직 없음',
      href: cell.runningHref ?? cell.createHref,
      running,
    };
  };

  return [
    {
      id: 'brand',
      state: states.brand,
      label: '브랜드 프로필',
      status: '등록 완료',
      href: '/app/brand',
      running: false,
    },
    makeCell({
      id: 'report',
      label: '진단 리포트',
      count: input.publishedReports,
      latest: args.latestReportDate,
      runningText: '진단 중',
      listHref: '/app/library?tab=report',
      createHref: '/app/report/new',
      runningHref: input.runningReportId ? `/app/report/${input.runningReportId}` : null,
    }),
    makeCell({
      id: 'thumbnail',
      label: '썸네일',
      count: input.doneThumbnails,
      latest: args.latestThumbDate,
      runningText: '만드는 중',
      listHref: '/app/library?tab=thumbnail',
      createHref: '/app/studio/thumbnail',
      runningHref: input.runningThumbnailId ? `/app/studio/thumbnail/${input.runningThumbnailId}` : null,
    }),
    makeCell({
      id: 'detail',
      label: '상세페이지',
      count: input.doneDetails,
      latest: args.latestDetailDate,
      runningText: '만드는 중',
      listHref: '/app/library?tab=detail',
      createHref: '/app/studio/detail',
      runningHref: input.runningDetailId ? `/app/studio/detail/${input.runningDetailId}` : null,
    }),
  ];
}

/** 페이지 제목 — 준비 흐름을 어디까지 왔는지 한 문장으로(상태가 숫자보다 먼저) */
function progressHeadline(doneSteps: number): React.ReactNode {
  const total = PIPELINE_ORDER.length;
  if (doneSteps >= total) {
    return (
      <>
        일본 진출 준비 <Em>{total}단계</Em>를 모두 마쳤어요
      </>
    );
  }
  if (doneSteps <= 1) {
    return (
      <>
        일본 진출 준비, <Em>첫 단계</Em>를 마쳤어요
      </>
    );
  }
  return (
    <>
      일본 진출 준비, {total}단계 중 <Em>{doneSteps}단계</Em>까지 왔어요
    </>
  );
}

export default async function DashboardPage() {
  const store = await getStore();
  const brandProfile = await getActiveBrand();

  // ── MAIN-13 / ONBOARD · 브랜드 미등록이면 첫 브랜드 캡처가 홈을 대신한다 ──
  if (!brandProfile) return <BrandOnboarding />;

  const [requests, reports, assets, match, products] = await Promise.all([
    store.listRequests(brandProfile.id),
    store.listReports(brandProfile.id),
    store.listAssets(brandProfile.id),
    store.getActiveMatchRequest(brandProfile.id),
    store.listProducts(brandProfile.id),
  ]);

  // 목록은 전부 최신순이라 [0]이 최근 1건이다
  const reportByRequest = new Map<string, ReportSummary>(reports.map((r) => [r.requestId, r]));
  const publishedRequests = requests.filter((r) => r.status === 'published' && reportByRequest.has(r.id));
  const latestPublished = publishedRequests[0] ?? null;
  const latestReport = latestPublished ? (reportByRequest.get(latestPublished.id) ?? null) : null;
  /* 최신 리포트 **1건만** 본문까지 읽는다 — 진단 카드가 표현 감사 분포와 "문구가 어떻게 바뀌었나"를
     보여 주려면 9블록이 필요하다. 목록 전체에 대해 읽지 않는다(리포트당 ~30KB). */
  const latestBlocks = latestPublished ? ((await store.getReport(latestPublished.id))?.blocksJson ?? null) : null;
  const runningRequests = requests.filter((r) => r.status === 'submitted' || r.status === 'processing');

  const doneAssets = assets.filter((a) => a.status === 'done');
  const doneThumbs = doneAssets.filter((a) => a.kind !== 'detail');
  const doneDetails = doneAssets.filter((a) => a.kind === 'detail');
  const runningThumbs = assets.filter((a) => a.kind !== 'detail' && a.status === 'generating');
  const runningDetails = assets.filter((a) => a.kind === 'detail' && a.status === 'generating');

  // 진행 중 잡 → 플로팅 패널(MAIN-05a)
  const jobs: DashboardJob[] = [
    ...runningRequests.map((r) => ({ kind: 'report' as const, id: r.id, name: reportName(r) })),
    ...assets.filter((a) => a.status === 'generating').map((a) => ({ kind: a.kind, id: a.id, name: assetName(a) })),
  ];

  // ── 다음 단계 판정(MAIN-03) — 자산 유무 + 시즌 착수 구간. 규칙 기반, 저장 없음 ──
  const now = new Date();
  const focus = seasonFocus(now, {
    hasReport: publishedRequests.length > 0,
    hasThumbnail: doneThumbs.length > 0,
    hasDetail: doneDetails.length > 0,
  });
  const stepInput: HomeStepInput = {
    publishedReports: publishedRequests.length,
    runningReportId: runningRequests[0]?.id ?? null,
    failedReportId: requests.find((r) => r.status === 'failed')?.id ?? null,
    doneThumbnails: doneThumbs.length,
    runningThumbnailId: runningThumbs[0]?.id ?? null,
    doneDetails: doneDetails.length,
    runningDetailId: runningDetails[0]?.id ?? null,
    seasonInLeadWindow: focus.inLeadWindow,
  };
  const step = resolveHomeStep(stepInput);
  const doneSteps = pipelineDoneCount(stepInput);

  const hasProductInfo = Boolean(brandProfile.productInfoMemo.trim() || brandProfile.detailDocName);
  const next = nextStepContent(step, {
    hasProductInfo,
    runningReportName: runningRequests[0] ? reportName(runningRequests[0]) : null,
    latestReportId: latestPublished?.id ?? null,
    focus,
  });
  const reportDate = latestReport ? fmtDate(latestReport.publishedAt ?? latestPublished!.createdAt) : null;
  // 스테퍼 칸은 좁다(8열을 넷으로 나눈 폭) — 날짜를 월.일로 줄여 잘리지 않게 한다. 전체 날짜는 카드들이 적는다
  const steps = stepperCells({
    input: stepInput,
    latestReportDate: latestReport ? fmtShortDate(latestReport.publishedAt ?? latestPublished!.createdAt) : null,
    latestThumbDate: doneThumbs[0] ? fmtShortDate(doneThumbs[0].createdAt) : null,
    latestDetailDate: doneDetails[0] ? fmtShortDate(doneDetails[0].createdAt) : null,
  });

  // ── 시즌 카드(MAIN-12) — 앞세운 시즌 1건 + 6개월 타임라인 + 그다음 시즌 ──
  const focusEvent = focus.recommendation.event;
  const leadById = new Map(SEASON_EVENTS.map((e) => [e.id, e.leadDays]));
  const nextEvents = upcomingEvents(now, SEASON_NEXT_LIMIT + 1)
    .filter((e) => e.id !== focusEvent.id)
    .slice(0, SEASON_NEXT_LIMIT);
  const urgentIds = new Set(
    nextEvents.filter((e) => !e.inProgress && e.dDay <= (leadById.get(e.id) ?? 30)).map((e) => e.id),
  );

  /* ── 확인할 것 — 사용자의 행동을 기다리는 일을 머리 바로 아래 한 블록에 모은다 ──
     실패: 라이브러리는 실패물을 자산으로 치지 않고(LIB-05) 플로팅 패널은 이번 방문에 시작한 잡만 본다.
     그래서 새로고침 뒤에는 실패를 알려 주는 자리가 홈밖에 없다. 다음 단계 카드가 이미 실패를 말하고
     있으면(첫 진단 실패) 같은 말을 한 번 더 하지 않는다. */
  const failCutoff = new Date(Date.now() - FAIL_NOTICE_DAYS * 86_400_000).toISOString();
  const failedRequests = requests.filter((r) => r.status === 'failed' && r.updatedAt >= failCutoff);
  const failedAssets = assets.filter((a) => a.status === 'failed' && a.updatedAt >= failCutoff);
  const failCount = failedRequests.length + failedAssets.length;
  // 원인 화면은 실패물별로 다르다 — 가장 최근 1건으로 보낸다(리포트/썸네일/상세 각자의 실패 화면)
  const newestFail =
    [
      ...failedRequests.map((r) => ({ at: r.updatedAt, href: `/app/report/${r.id}` })),
      ...failedAssets.map((a) => ({
        at: a.updatedAt,
        href: a.kind === 'detail' ? `/app/studio/detail/${a.id}` : `/app/studio/thumbnail/${a.id}`,
      })),
    ].sort((x, y) => (x.at < y.at ? 1 : -1))[0] ?? null;

  const attention: AttentionItem[] = [];
  if (failCount > 0 && newestFail && step.mode !== 'failed') {
    const parts = [
      failedRequests.length > 0 ? `진단 ${failedRequests.length}건` : '',
      failedAssets.length > 0 ? `자산 ${failedAssets.length}건` : '',
    ].filter(Boolean);
    attention.push({
      key: 'fail',
      tone: 'danger',
      title: `생성 실패 ✕ ${failCount}건`,
      detail: `최근 ${FAIL_NOTICE_DAYS}일 · ${parts.join(' · ')}`,
      href: newestFail.href,
      cta: '원인 보기 →',
    });
  }
  // 기업 매칭 제안 도착은 사이드바 운영 메뉴를 펼쳐야만 배지로 보였다 — 홈에서 먼저 알린다
  if (match?.status === 'proposed') {
    attention.push({
      key: 'match',
      tone: 'ok',
      title: '기업 매칭 제안 도착 ○',
      detail: '운영팀이 이메일로 상세를 안내합니다.',
      href: '/app/matching',
      cta: '신청 내용 보기 →',
    });
  }

  // ── 최근 작업물(MAIN-05b) — 발행 리포트 + 완성 자산 최신순 ──
  const work: (WorkItem & { sort: string })[] = [
    ...publishedRequests.map((req) => {
      const rep = reportByRequest.get(req.id)!;
      return {
        key: `r-${req.id}`,
        kind: 'report' as const,
        href: `/app/report/${req.id}`,
        name: reportName(req),
        date: fmtDate(rep.publishedAt ?? req.createdAt),
        sort: rep.publishedAt ?? req.createdAt,
        score: rep.overallScore,
        groupScores: rep.groupScores,
        top3: rep.top3,
        img: null,
      };
    }),
    ...doneAssets.map((a) => ({
      key: `a-${a.id}`,
      kind: a.kind,
      href: a.kind === 'detail' ? `/app/studio/detail/${a.id}` : `/app/library/${a.id}`,
      name: assetName(a),
      date: fmtDate(a.createdAt),
      sort: a.createdAt,
      score: null,
      groupScores: {},
      top3: [],
      img: a.imagePath ? `/api/files/${a.imagePath}` : null,
    })),
  ].sort((a, b) => (a.sort < b.sort ? 1 : -1));

  const today = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

  return (
    <main className="animate-fade-up">
      {/* break-keep — 한국어 문장이 어절 중간에서 끊기지 않게 한다(랜딩과 같은 규칙) */}
      <div className="mx-auto max-w-[1280px] px-8 pt-[72px] pb-24 break-keep max-sm:px-5">
        {/* ── 머리 — 어디까지 왔나 ──────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold tracking-[0.02em] text-coral-strong">
              {brandProfile.brandName} · {categoryLabelKr(brandProfile.category)}
            </p>
            <h1 className="mt-2.5 text-[30px] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink max-sm:text-[24px]">
              {progressHeadline(doneSteps)}
            </h1>
          </div>
          <p className="tnum pb-1.5 text-[13px] text-ink-mute">{today} 기준</p>
        </header>

        {/* ── 확인할 것 — 있을 때만. 여러 건이어도 블록은 하나 ────────────── */}
        {attention.length > 0 && (
          <div className="mt-7">
            <HomeAttention items={attention} />
          </div>
        )}

        {/* ── 1·2줄 — 12열 격자. 왼쪽 8열이 주 동선, 오른쪽 4열이 그 줄의 맥락 ── */}
        <div className={`grid gap-6 xl:grid-cols-12 ${attention.length > 0 ? 'mt-6' : 'mt-8'}`}>
          <div className="xl:col-span-8">
            <HomeNextStep
              kicker={next.kicker}
              title={next.title}
              desc={next.desc}
              primary={next.primary}
              secondary={next.secondary}
              axis={next.axis}
              steps={steps}
            />
          </div>
          <div className="xl:col-span-4">
            <HomeSeasonCard
              focus={focusEvent}
              inLeadWindow={focus.inLeadWindow}
              leadDays={focus.leadDays}
              win={seasonWindow(now, SEASON_WINDOW_DAYS)}
              next={nextEvents}
              urgentIds={urgentIds}
            />
          </div>

          <div className="xl:col-span-8">
            {latestPublished && latestReport ? (
              <HomeReportCard
                report={latestReport}
                requestId={latestPublished.id}
                name={reportName(latestPublished)}
                date={reportDate ?? ''}
                audit={latestBlocks ? auditCounts(latestBlocks) : null}
                material={latestBlocks ? pickReportMaterial(latestBlocks) : null}
              />
            ) : (
              <HomeReportEmptyCard running={runningRequests.length > 0} />
            )}
          </div>
          <div className="xl:col-span-4">
            <HomeBrandCard brand={brandProfile} products={products} />
          </div>
        </div>

        {/* ── 3줄 — 무엇을 만들었나. 완성 자산이 아직 없으면 스튜디오 예시가 그 자리를 채운다 ── */}
        <div className="mt-10">
          {doneAssets.length > 0 ? (
            <HomeWork
              items={work}
              counts={{ report: publishedRequests.length, thumbnail: doneThumbs.length, detail: doneDetails.length }}
            />
          ) : (
            <HomeStudioSamples />
          )}
        </div>
      </div>

      {jobs.length > 0 && <JobPanel jobs={jobs} />}
    </main>
  );
}

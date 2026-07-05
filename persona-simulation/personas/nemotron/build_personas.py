"""
build_personas.py — nvidia/Nemotron-Personas-Korea → 대일 수출 뷰티 브랜드 검증용 페르소나

무엇을 하나
  1) Nemotron-Personas-Korea(1M행, 한국어, CC BY 4.0)를 **스트리밍**으로 훑어
     화장품·뷰티·마케팅·이커머스·창업 관련 페르소나만 필터링한다.
     → 실제 한국 인구 분포에 기반한 '사람 앵커'(나이·지역·직업·직업서사)를 확보.
  2) 각 후보에 persona-criteria.md의 13축을 아키타입 분포·상관 규칙(§2·§3)대로 부착한다.
     → 데이터셋이 못 주는 '일본 진출 단계·일본어 소구·약기법 우려·가격 수용'을 보강.
  3) JSON + Markdown 으로 출력하고, 각 페르소나의 시뮬레이션 프롬프트까지 생성한다.
     seed 고정으로 재현 가능.

왜 필터+보강인가
  이 데이터셋은 '일반 한국 개인' 페르소나다. '일본 수출 뷰티 브랜드 담당자' 라벨이 없으므로,
  뷰티/마케팅/커머스 직군을 골라 현실적 인구·직업 앵커로 삼고 우리 검증 축을 덧입힌다.
  (persona-criteria.md §0·§5 참조)

사용법
  pip install -r requirements.txt
  python build_personas.py --count 20 --max-scan 150000 --seed 42

주의
  - 전체 다운로드(수 GB) 대신 streaming=True 로 필요한 만큼만 훑는다.
  - 데이터셋 출처 표기 의무(CC BY 4.0): 출력물에 nvidia/Nemotron-Personas-Korea 를 명시한다.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

try:
    from datasets import load_dataset
except ImportError:
    sys.exit(
        "[의존성 오류] 'datasets' 미설치.\n"
        "  원인: Hugging Face datasets 라이브러리가 없음.\n"
        "  해결: pip install -r requirements.txt  (또는 pip install datasets)"
    )

DATASET = "nvidia/Nemotron-Personas-Korea"

# ─────────────────────────────────────────────────────────────────────────────
# 1) 필터 — 우리 서비스 '구매자 직능'만. occupation 필드 기준, 정밀도 우선.
#    구매자 = 일본향 메시지·콘텐츠·카피를 소유한 마케터/콘텐츠 직군.
#    · 약기법·통관은 서비스 범위 밖 → 해외영업/무역 앵커 제외.
#    · 화장품 판매원은 매대 판매자라 우리 구매자가 아님(풍부하나 부적합) → 제외.
#    실측(120k): 마케터 클러스터 1.57%, 그중 뷰티맥락 ~0.007%.
#    → 뷰티맥락 있으면 core, 없으면 일반 마케터를 role 로(직능을 앵커, 뷰티·일본은 보강).
# ─────────────────────────────────────────────────────────────────────────────
BUYER_OCC = [
    "마케팅", "마케터", "광고", "홍보", "브랜드 매니저", "브랜드매니저",
    "콘텐츠", "카피", "에디터", "미디어 콘텐츠", "그래픽 디자이너", "웹 디자이너", "SNS",
]
EXCLUDE_OCC = ["무직", "구직", "미취업", "학생", "은퇴", "전직", "실업",
               "텔레마케터", "도우미"]  # 콜센터·행사도우미는 구매자 아님
BEAUTY = ["화장품", "뷰티", "코스메틱", "미용", "메이크업", "스킨케어", "색조", "네일", "K뷰티"]

SCAN_FIELDS = (
    "occupation", "professional_persona", "skills_and_expertise",
    "career_goals_and_ambitions", "persona",
)


def scan_text(row: dict) -> str:
    """카테고리 추론·프롬프트용으로 서사 텍스트를 합친다."""
    return " ".join(str(row.get(f, "")) for f in SCAN_FIELDS)


def match_tier(row: dict) -> str | None:
    """구매자 직능(마케터/콘텐츠)만 채택. 뷰티맥락 있으면 core, 없으면 role."""
    occ = str(row.get("occupation", ""))
    if any(x in occ for x in EXCLUDE_OCC):
        return None
    if not any(k in occ for k in BUYER_OCC):
        return None
    blob = " ".join(str(row.get(f, "")) for f in
                    ("professional_persona", "career_goals_and_ambitions", "skills_and_expertise"))
    return "core" if any(k in blob for k in BEAUTY) else "role"


# ─────────────────────────────────────────────────────────────────────────────
# 2) 13축 보강 설정 — persona-criteria.md 요약 포팅
#    각 아키타입에 앵커값 + (값, 가중치) 풀을 정의. 뒤이어 §3 상관 규칙으로 보정.
# ─────────────────────────────────────────────────────────────────────────────
# 20개 기준 배분: A8 · B6 · C4 · D2
# 앵커 직능이 마케터/콘텐츠(구매자)라, 아키타입도 우리가 파는 '메시지·콘텐츠' 페인에 정렬.
# (약기법·통관은 범위 밖 → '약기법 각성형' 제거, 'C.콘텐츠리소스 부재'로 교체)
ARCHETYPE_MIX = [
    ("A.입점직전 메시지막힘", 8),
    ("B.정체돌파 재설계", 6),
    ("C.콘텐츠리소스 부재", 4),
    ("D.신중한 첫도전자", 2),
]

POOLS: dict[str, dict[str, list]] = {
    "A.입점직전 메시지막힘": {
        "카테고리": [("스킨케어", 6), ("색조", 2), ("컨셉형", 1), ("기능성(의약외품)", 1)],
        "규모": [("3~15인", 6), ("1~2인", 2), ("16~50인", 1)],
        "진출단계": [("입점준비", 1)],
        "주력채널": [("Qoo10", 4), ("복수채널", 2), ("Qoo10+@cosme", 1), ("자사몰+Qoo10", 1)],
        "담당자역할": [("대표 겸 마케터", 4), ("마케팅 담당 1인", 4)],
        "예산권한": [("단독 결정", 4), ("품의 후 결정", 2)],
        "일본어": [("번역은 되나 소구 모름", 1)],
        "핵심 실패경험": [
            ("번역만 해서 반응 없었음", 3),
            ("상세페이지·SNS 만들 리소스 없음", 3),
            ("운영대행 알아봤으나 비싸고 방향 불명확", 1),
        ],
        "외주경험": [("번역 프리랜서만", 3), ("전부 인하우스", 2), ("운영대행 경험", 1)],
        "AI 수용도": [("반신반의", 5), ("적극 수용", 3), ("거부감", 1)],
        "가격수용": [("진단 30~50만", 5), ("100만·콘텐츠까지", 3), ("월 리테이너", 1)],
        "리스크 우려": [("외주 품질·신뢰", 3), ("내부 확신 부족", 3), ("광고비 낭비", 2)],
        "구매 트리거": [("입점 마감 임박", 4), ("경쟁사 성공 목격", 3), ("매출 정체 자각", 1)],
    },
    "B.정체돌파 재설계": {
        "카테고리": [("스킨케어", 5), ("색조", 2), ("컨셉형", 1), ("기능성(의약외품)", 1)],
        "규모": [("3~15인", 4), ("16~50인", 2)],
        "진출단계": [("운영중·정체", 5), ("입점초기", 2)],
        "주력채널": [("Qoo10+@cosme", 4), ("복수채널", 3), ("Qoo10", 1)],
        "담당자역할": [("마케팅 담당 1인", 4), ("대표 겸 마케터", 3)],
        "예산권한": [("단독 결정", 3), ("품의 후 결정", 2)],
        "일본어": [("번역은 되나 소구 모름", 5), ("거의 못함", 1)],
        "핵심 실패경험": [
            ("리뷰(口コミ) 안 쌓여 매출 정체", 4),
            ("번역만 해서 반응 없었음", 2),
            ("운영대행 알아봤으나 비싸고 방향 불명확", 1),
        ],
        "외주경험": [("운영대행 경험", 4), ("에이전시 경험", 2)],
        "AI 수용도": [("반신반의", 4), ("적극 수용", 2), ("거부감", 1)],
        "가격수용": [("100만·콘텐츠까지", 4), ("월 리테이너", 3), ("진단 30~50만", 1)],
        "리스크 우려": [("광고비 낭비", 3), ("외주 품질·신뢰", 3), ("내부 확신 부족", 1)],
        "구매 트리거": [("매출 정체 자각", 5), ("경쟁사 성공 목격", 2)],
    },
    "C.콘텐츠리소스 부재": {
        "카테고리": [("스킨케어", 4), ("색조", 2), ("컨셉형", 2), ("기능성(의약외품)", 1)],
        "규모": [("3~15인", 3), ("16~50인", 2)],
        "진출단계": [("입점초기", 2), ("운영중·정체", 2), ("입점준비", 1)],
        "주력채널": [("복수채널", 4), ("Qoo10+@cosme", 2), ("Qoo10", 1)],
        "담당자역할": [("마케팅 담당 1인", 4), ("대표 겸 마케터", 2)],
        "예산권한": [("단독 결정", 2), ("품의 후 결정", 2)],
        "일본어": [("번역은 되나 소구 모름", 4), ("거의 못함", 1)],
        "핵심 실패경험": [
            ("채널 늘렸으나 콘텐츠 못 따라감", 3),
            ("상세페이지·SNS 만들 리소스 없음", 3),
        ],
        "외주경험": [("운영대행 경험", 2), ("전부 인하우스", 2), ("에이전시 경험", 1)],
        "AI 수용도": [("적극 수용", 3), ("반신반의", 3), ("거부감", 1)],
        "가격수용": [("월 리테이너", 3), ("100만·콘텐츠까지", 3), ("진단 30~50만", 1)],
        "리스크 우려": [("콘텐츠 리소스 부족", 4), ("외주 품질·신뢰", 2), ("내부 확신 부족", 1)],
        "구매 트리거": [("매출 정체 자각", 3), ("경쟁사 성공 목격", 2)],
    },
    "D.신중한 첫도전자": {
        "카테고리": [("스킨케어", 2), ("컨셉형", 1)],
        "규모": [("1~2인", 2), ("3~15인", 1)],
        "진출단계": [("조사·검토중", 1)],  # 앵커 고정
        "주력채널": [("미정", 1)],
        "담당자역할": [("대표 겸 마케터", 2), ("마케팅 담당 1인", 1)],
        "예산권한": [("단독 결정", 1)],
        "일본어": [("거의 못함", 2), ("번역은 되나 소구 모름", 1)],
        "핵심 실패경험": [("경험 없음(첫 도전)", 1)],
        "외주경험": [("전부 인하우스", 2), ("번역 프리랜서만", 1)],
        "AI 수용도": [("거부감", 2), ("반신반의", 1)],  # 저항 대비군
        "가격수용": [("무료/저가만", 1)],
        "리스크 우려": [("내부 확신 부족", 2), ("광고비 낭비", 1)],
        "구매 트리거": [("약함(대비군)", 1)],
    },
}


def wchoice(rng: random.Random, pairs: list[tuple]):
    vals, wts = zip(*pairs)
    return rng.choices(vals, weights=wts, k=1)[0]


def infer_category(text: str, fallback: str) -> str:
    """데이터셋 직업서사에서 카테고리 힌트를 얻는다(있으면 우선)."""
    if any(k in text for k in ["색조", "립", "틴트", "쿠션", "파운데", "아이섀도", "마스카라"]):
        return "색조"
    if any(k in text for k in ["미백", "주름", "자외선", "선크림", "탈모", "두피", "의약외품", "기능성"]):
        return "기능성(의약외품)"
    if any(k in text for k in ["비건", "클린", "향수", "바디", "더마"]):
        return "컨셉형"
    if any(k in text for k in ["스킨케어", "토너", "크림", "세럼", "앰플", "보습", "에센스"]):
        return "스킨케어"
    return fallback


# 가상 브랜드명 생성기(재현성: index seed). 실제 브랜드 아님.
_BRAND_A = ["글로우", "무드", "하루", "셀피", "노트", "코튼", "베러", "리프레쉬", "오브제", "데일리",
            "뮤트", "라라", "포레스트", "슬로우", "루미", "타임", "데이", "루트", "플레인", "센트"]
_BRAND_B = ["리프", "바이", "온", "지", "원", "밤", "문", "랩", "스킨", "핏", "뷰", "데이", "미", "리스", "네"]


def make_brand(rng: random.Random) -> str:
    return rng.choice(_BRAND_A) + rng.choice(_BRAND_B)


def augment(row: dict, archetype: str, rng: random.Random) -> dict:
    """한 후보에 13축을 부착하고 §3 상관 규칙으로 보정."""
    pool = POOLS[archetype]
    text = scan_text(row)

    axes = {axis: wchoice(rng, pairs) for axis, pairs in pool.items()}

    # 카테고리: 데이터셋 서사 힌트 우선(없으면 아키타입 기본값)
    axes["카테고리"] = infer_category(text, axes["카테고리"])

    # 규칙: 규모↔예산권한 상관
    if axes["규모"] == "1~2인":
        axes["예산권한"] = "단독 결정"
    elif axes["규모"] == "16~50인" and rng.random() < 0.7:
        axes["예산권한"] = "품의 후 결정"

    return axes


# ─────────────────────────────────────────────────────────────────────────────
# 3) 시뮬레이션 프롬프트 — 실제 데이터셋 서사 + 우리 축을 결합
# ─────────────────────────────────────────────────────────────────────────────
SEX_KR = {"male": "남성", "female": "여성"}


def build_prompt(src: dict, brand: str, axes: dict) -> str:
    prof = str(src.get("professional_persona", "")).strip()
    if len(prof) > 400:
        prof = prof[:400] + "…"
    return (
        "당신은 아래 인물입니다. 이 사람으로서 1인칭으로, 솔직하게 답하세요.\n\n"
        "[실제 인구 앵커 · 출처 nvidia/Nemotron-Personas-Korea]\n"
        f"- 성별/나이: {SEX_KR.get(str(src.get('sex')), src.get('sex'))} / {src.get('age')}세\n"
        f"- 지역: {src.get('province')} {src.get('district')}\n"
        f"- 직업: {src.get('occupation')}\n"
        f"- 직업 서사: {prof}\n\n"
        "[검증용 설정 · 대일 수출 뷰티 브랜드]\n"
        f"- 운영 브랜드(가상): {brand} ({axes['카테고리']})\n"
        f"- 회사 규모: {axes['규모']} · 일본 진출 단계: {axes['진출단계']} · 주력 채널: {axes['주력채널']}\n"
        f"- 역할/예산: {axes['담당자역할']} / {axes['예산권한']}\n"
        f"- 일본어: {axes['일본어']} · 기존 실패: {axes['핵심 실패경험']} · 외주: {axes['외주경험']}\n"
        f"- AI 수용도: {axes['AI 수용도']} · 가격 수용: {axes['가격수용']}\n"
        f"- 리스크 우려: {axes['리스크 우려']} · 구매 트리거: {axes['구매 트리거']}\n\n"
        "위 인물로서 제시되는 랜딩페이지 문구(A~E)와 질문 세트(실행안 §8)에 반응하세요."
    )


# ─────────────────────────────────────────────────────────────────────────────
# 파이프라인
# ─────────────────────────────────────────────────────────────────────────────
def collect_candidates(count: int, max_scan: int, streaming: bool, min_age: int, max_age: int):
    """스트리밍으로 훑어 core 우선, 부족하면 role 로 채운다."""
    print(f"[1/3] '{DATASET}' 스트리밍 스캔 시작 (max_scan={max_scan:,}, 나이 {min_age}~{max_age}) …")
    ds = load_dataset(DATASET, split="train", streaming=streaming)

    core, role = [], []
    scanned = 0
    for row in ds:
        scanned += 1
        try:
            age = int(row.get("age", 0))
        except (TypeError, ValueError):
            age = 0
        if min_age <= age <= max_age:  # 브랜드 운영자 현실 연령대만
            tier = match_tier(row)
            if tier == "core":
                core.append(row)
            elif tier == "role":
                role.append(row)
        if scanned % 20000 == 0:
            print(f"    …{scanned:,}행 스캔 / core {len(core)} · role {len(role)}")
        if len(core) >= count or scanned >= max_scan:
            break

    print(f"[1/3] 스캔 종료: {scanned:,}행 / core {len(core)} · role {len(role)}")
    picked = core[:count]
    if len(picked) < count:
        need = count - len(picked)
        print(f"    core 부족 → role 에서 {need}개 보충")
        picked += role[:need]
    return picked


def assign_archetypes(n: int) -> list[str]:
    """criteria §2 배분(A8·B6·C4·D2)을 요청 수 n 에 비례 배분."""
    base = 20
    out = []
    for name, cnt in ARCHETYPE_MIX:
        out += [name] * max(1, round(cnt * n / base))
    # 길이 보정
    while len(out) < n:
        out.append(ARCHETYPE_MIX[0][0])
    return out[:n]


SRC_FIELDS = ("uuid", "sex", "age", "marital_status", "education_level",
              "bachelors_field", "occupation", "district", "province", "professional_persona")


def main():
    ap = argparse.ArgumentParser(description="Nemotron-Personas-Korea → 대일 수출 뷰티 페르소나")
    ap.add_argument("--count", type=int, default=20, help="생성 개수 (기본 20)")
    ap.add_argument("--max-scan", type=int, default=300000, help="최대 스캔 행 수 (기본 30만)")
    ap.add_argument("--seed", type=int, default=42, help="난수 시드 (재현성)")
    ap.add_argument("--min-age", type=int, default=24, help="최소 나이 (기본 24)")
    ap.add_argument("--max-age", type=int, default=62, help="최대 나이 (기본 62)")
    ap.add_argument("--out-dir", default=str(Path(__file__).parent / "output"))
    ap.add_argument("--no-streaming", action="store_true", help="전체 다운로드 모드(비권장)")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    picked = collect_candidates(args.count, args.max_scan, not args.no_streaming, args.min_age, args.max_age)
    if not picked:
        sys.exit(
            "[결과 없음] 매칭된 페르소나가 없음.\n"
            "  원인: max_scan 이 너무 작거나 키워드가 좁음.\n"
            "  해결: --max-scan 400000 으로 늘리거나 CORE_BEAUTY/ROLE_BIZ 키워드를 넓히세요."
        )

    print(f"[2/3] 13축 보강 + 프롬프트 생성 ({len(picked)}개) …")
    archetypes = assign_archetypes(len(picked))
    personas = []
    for i, (row, arch) in enumerate(zip(picked, archetypes), start=1):
        axes = augment(row, arch, rng)
        brand = make_brand(rng)
        src = {k: row.get(k) for k in SRC_FIELDS}
        personas.append({
            "id": f"NPK{i:02d}",
            "archetype": arch,
            "brand": brand,
            "source": src,  # 출처 표기(CC BY 4.0)
            "axes": axes,
            "simulation_prompt": build_prompt(src, brand, axes),
        })

    # JSON
    json_path = out_dir / "personas_nemotron.json"
    json_path.write_text(json.dumps({
        "dataset": DATASET,
        "license": "CC BY 4.0 (출처 표기 필수)",
        "seed": args.seed,
        "count": len(personas),
        "criteria_ref": "../persona-criteria.md",
        "personas": personas,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # Markdown
    md = ["# Nemotron 기반 페르소나 (실제 인구 앵커 + 13축 보강)\n",
          f"- 출처: **{DATASET}** (CC BY 4.0, 출처 표기 필수) · seed={args.seed} · {len(personas)}개",
          "- 앵커 직능 = 마케터/콘텐츠(데이터셋 실제 값) / 진출단계·일본어·콘텐츠·가격 = persona-criteria.md 축으로 보강\n",
          "| ID | 아키타입 | 나이/성별 | 지역 | 직업(원본) | 브랜드(가상)·카테고리 | 진출단계 | 가격수용 |",
          "|---|---|---|---|---|---|---|---|"]
    for p in personas:
        s, a = p["source"], p["axes"]
        md.append(
            f"| {p['id']} | {p['archetype']} | {s.get('age')}/{SEX_KR.get(str(s.get('sex')), s.get('sex'))} "
            f"| {s.get('province')} {s.get('district')} | {s.get('occupation')} "
            f"| {p['brand']}·{a['카테고리']} | {a['진출단계']} | {a['가격수용']} |"
        )
    md.append("\n---\n\n## 시뮬레이션 프롬프트\n")
    for p in personas:
        md.append(f"### {p['id']} · {p['brand']} ({p['archetype']})\n")
        md.append("```\n" + p["simulation_prompt"] + "\n```\n")
    (out_dir / "personas_nemotron.md").write_text("\n".join(md), encoding="utf-8")

    print(f"[3/3] 완료 → {json_path}")
    print(f"           → {out_dir / 'personas_nemotron.md'}")
    print("\n다음: 각 simulation_prompt 를 랜딩 5변형 + §8 질문과 함께 모델에 넣어 반응을 results/ 에 기록.")


if __name__ == "__main__":
    main()

"""우리 서비스 구매자로 적합한 '직능' 직군이 데이터셋에 얼마나 있는지 표본 검증."""
from collections import Counter
from datasets import load_dataset

BEAUTY = ["화장품", "뷰티", "코스메틱", "미용", "메이크업", "스킨케어", "색조", "네일"]
CLUSTERS = {
    "①해외영업/무역/수출": ["해외영업", "무역", "수출입", "수출", "해외 영업", "통상", "해외 마케팅"],
    "②마케터/광고/홍보/브랜드": ["마케팅", "마케터", "광고", "홍보", "브랜드 매니저", "브랜드매니저"],
    "③MD/상품기획(뷰티PM)": ["상품기획", "머천다이", "MD", "바이어", "구매 담당", "상품개발", "상품 개발"],
    "④이커머스/온라인 운영": ["전자상거래", "이커머스", "온라인 판매", "쇼핑몰", "온라인 마켓", "온라인 쇼핑몰"],
    "⑤콘텐츠/디자인/카피": ["콘텐츠", "카피라이터", "에디터", "영상 편집", "그래픽 디자이너", "웹 디자이너"],
    "(참고)뷰티 판매/서비스": ["화장품 판매", "미용사", "메이크업 아티스트", "네일", "피부관리", "미용 관련"],
}

N = 120000
ds = load_dataset("nvidia/Nemotron-Personas-Korea", split="train", streaming=True)

total = {k: 0 for k in CLUSTERS}          # 직능 전체(산업 무관)
beauty = {k: 0 for k in CLUSTERS}         # 그중 뷰티 맥락(서사에 뷰티)
occ_examples = {k: Counter() for k in CLUSTERS}

scanned = 0
for row in ds:
    scanned += 1
    occ = str(row.get("occupation", ""))
    blob = " ".join(str(row.get(f, "")) for f in
                    ("professional_persona", "career_goals_and_ambitions", "skills_and_expertise"))
    is_beauty = any(k in blob for k in BEAUTY)
    for name, kws in CLUSTERS.items():
        if any(k in occ for k in kws):
            total[name] += 1
            occ_examples[name][occ] += 1
            if is_beauty:
                beauty[name] += 1
    if scanned >= N:
        break

print(f"스캔 {scanned:,}행\n")
print(f"{'직능 클러스터':28s} | 전체(직능) | 뷰티맥락 | 전체% | 1M환산(전체/뷰티)")
print("-" * 92)
for name in CLUSTERS:
    t, b = total[name], beauty[name]
    print(f"{name:28s} | {t:8d} | {b:7d} | {t/scanned*100:5.3f}% | ~{round(t/scanned*1_000_000):,} / ~{round(b/scanned*1_000_000):,}")
print("\n각 클러스터 실제 occupation 값 Top5:")
for name in CLUSTERS:
    tops = ", ".join(f"{v}×{c}" for v, c in occ_examples[name].most_common(5))
    print(f"  {name}: {tops}")

"""데이터셋에 '브랜드 운영자/창업자' 신호가 실제로 얼마나 있는지 표본 검증."""
from collections import Counter
from datasets import load_dataset

FOUNDER_OCC = ["대표", "창업", "자영업", "사업가", "사장", "CEO", "경영자", "운영자", "프리랜서", "1인 기업"]
BEAUTY = ["화장품", "뷰티", "미용", "메이크업", "코스메틱", "네일", "에스테틱", "스킨케어", "색조"]
BIZRUN = ["창업", "브랜드 운영", "쇼핑몰 운영", "온라인 판매", "직접 운영", "자영업", "사업체", "론칭", "대표"]

N = 80000
ds = load_dataset("nvidia/Nemotron-Personas-Korea", split="train", streaming=True)

occ_founder = 0            # occupation에 창업/자영업 신호
occ_beauty = 0            # occupation이 뷰티 직군
prof_brand_beauty = 0    # 직업서사에 '사업운영 + 뷰티' 동시
occ_samples = Counter()  # 뷰티 직군 occupation 실제 값 분포

scanned = 0
for row in ds:
    scanned += 1
    occ = str(row.get("occupation", ""))
    prof = " ".join(str(row.get(f, "")) for f in
                    ("professional_persona", "skills_and_expertise", "career_goals_and_ambitions"))
    if any(k in occ for k in FOUNDER_OCC):
        occ_founder += 1
    if any(k in occ for k in BEAUTY):
        occ_beauty += 1
        occ_samples[occ] += 1
    if any(b in prof for b in BIZRUN) and any(k in prof for k in BEAUTY):
        prof_brand_beauty += 1
    if scanned >= N:
        break

print(f"스캔: {scanned:,}행")
print(f"1) occupation에 창업/자영업/대표 신호: {occ_founder}건 ({occ_founder/scanned*100:.3f}%)")
print(f"2) occupation이 뷰티 직군: {occ_beauty}건 ({occ_beauty/scanned*100:.3f}%)")
print(f"3) 직업서사에 '사업운영+뷰티' 동시: {prof_brand_beauty}건 ({prof_brand_beauty/scanned*100:.3f}%)")
print("\n뷰티 직군 occupation 실제 값 분포:")
for name, cnt in occ_samples.most_common():
    print(f"   {cnt:4d}  {name}")

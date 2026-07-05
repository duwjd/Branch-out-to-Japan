"""뷰티 '마케터/운영자/대표' 실체가 있는지 — occupation과 professional_persona 원문을 직접 확인."""
from datasets import load_dataset

BEAUTY = ["화장품", "뷰티", "코스메틱", "미용", "메이크업", "스킨케어", "색조", "네일", "K뷰티", "케이뷰티"]
MKT_OCC = ["마케팅", "마케터", "홍보", "광고", "브랜드", "MD", "머천다이", "상품기획", "전자상거래", "이커머스", "쇼핑몰"]
OPERATE = ["창업", "운영", "대표", "론칭", "런칭", "자영업", "사업체", "직접 만든", "브랜드를 만들", "쇼핑몰"]

N = 120000
ds = load_dataset("nvidia/Nemotron-Personas-Korea", split="train", streaming=True)

catA = []  # occupation이 마케팅/브랜드 직군 + 서사에 뷰티
catB = []  # 서사에 '운영/창업 + 뷰티' (실제 사업 운영 서사)
scanned = 0
for row in ds:
    scanned += 1
    occ = str(row.get("occupation", ""))
    prof = str(row.get("professional_persona", ""))
    blob = prof + " " + str(row.get("career_goals_and_ambitions", "")) + " " + str(row.get("skills_and_expertise", ""))
    is_beauty = any(k in blob for k in BEAUTY)
    if any(m in occ for m in MKT_OCC) and is_beauty:
        catA.append((row.get("age"), occ, prof))
    if any(o in blob for o in OPERATE) and is_beauty:
        catB.append((row.get("age"), occ, prof))
    if scanned >= N:
        break

def show(title, items, k=8):
    print(f"\n===== {title}: {len(items)}건 / {scanned:,} ({len(items)/scanned*100:.3f}%) =====")
    for age, occ, prof in items[:k]:
        print(f"\n[{age}세 · 직업={occ}]")
        print("  " + (prof[:260] + "…" if len(prof) > 260 else prof))

print(f"스캔 {scanned:,}행")
show("A) 직업=마케팅/브랜드/커머스 + 뷰티 서사", catA)
show("B) 서사=뷰티 사업 운영/창업", catB)

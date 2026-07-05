# Nemotron 기반 페르소나 생성 (실제 인구 앵커 + 13축 보강)

`nvidia/Nemotron-Personas-Korea`(1M행, 한국어, CC BY 4.0)에서 **뷰티·마케팅·커머스 직군**을 골라
실제 한국 인구·직업 앵커를 확보하고, 여기에 [persona-criteria.md](../persona-criteria.md)의
**13축**(일본 진출 단계·일본어 소구·약기법 우려·가격 수용 등)을 아키타입 분포·상관 규칙대로 덧입힌다.

## 왜 필터 + 보강인가 (중요)

이 데이터셋은 **일반 한국 개인** 페르소나다. "일본 수출 뷰티 브랜드 담당자"라는 라벨이 없다.
그래서 두 단계로 쓴다.

1. **필터** — `occupation`/`professional_persona` 등을 키워드 매칭해 뷰티/마케팅/커머스 직군만 추출
   → 나이·성별·지역·직업 서사가 **실제 인구 분포에 기반**(손으로 지어낸 [persona-instances.md](../persona-instances.md)의 약점 보완).
2. **보강** — 데이터셋에 없는 검증 축(진출단계·일본어·약기법·가격 등)을 criteria 기준표로 부착.

> 손수 만든 `persona-instances.md`(20종)와 상호 보완 관계다. 그쪽은 서사·브랜드가 정교하고,
> 이쪽은 인구 앵커가 실제 분포에 기반한다. 둘을 비교 검증에 함께 쓰면 좋다.

## 사전 준비 — 현재 이 PC엔 진짜 Python이 없다

확인 결과 `python`이 **Windows 스토어 스텁**(`WindowsApps\python.exe`)이라 실행이 안 된다("Python"만 찍고 종료).
아래 중 하나로 진짜 Python(3.9+)을 먼저 설치한다.

```powershell
# 방법 A) winget (권장)
winget install -e --id Python.Python.3.12

# 방법 B) python.org 설치 관리자에서 3.12 설치 (설치 시 "Add python.exe to PATH" 체크)
```

설치 후 새 터미널에서 `py --version` 이 실제 버전을 찍는지 확인.
(스토어 스텁이 계속 가로채면: 설정 → 앱 → 고급 앱 설정 → 앱 실행 별칭 → python.exe 별칭 끄기)

## 실행

```powershell
cd persona-simulation\personas\nemotron
py -m venv .venv; .\.venv\Scripts\Activate.ps1      # 가상환경(선택, 권장)
py -m pip install -r requirements.txt
py build_personas.py --count 20 --max-scan 150000 --seed 42
```

- 공개 데이터셋(CC BY 4.0)이라 보통 토큰 불필요. 만약 접근이 막히면 `huggingface-cli login` 후 재시도.
- **streaming=True**(기본)라 수 GB 전체 다운로드 대신 필요한 만큼만 훑는다. `--max-scan`으로 상한 조절.
  매칭이 적으면 `--max-scan 400000`으로 늘린다.

> **캐시를 C: 밖으로 (이 PC 필수)**: 현재 C:\ 여유공간이 0GB다. uv 캐시와 HF 데이터셋 캐시를
> D:\ 로 돌려야 설치·실행이 된다. (실제로 이 옵션 없이는 pyarrow 추출이 디스크 공간 부족으로 실패했다)
> ```powershell
> $env:UV_CACHE_DIR = "D:\dev-cache\uv"   # uv 패키지 캐시
> $env:HF_HOME       = "D:\dev-cache\hf"   # huggingface 데이터셋 캐시
> ```
> 위 두 줄을 pip install / 실행 전에 매 세션 설정한다. (uv 자체와 Python은 이미 설치됨:
> uv=`C:\Users\user\.local\bin\uv.exe`, Python 3.12=uv 관리 standalone)

## 출력 (`output/`, git 미추적)

| 파일 | 내용 |
|---|---|
| `personas_nemotron.json` | 페르소나 배열: `source`(데이터셋 원본 필드) + `axes`(13축) + `simulation_prompt` |
| `personas_nemotron.md` | 요약표 + 페르소나별 **시뮬레이션 프롬프트** |

각 `simulation_prompt`는 "실제 인구 앵커 + 검증 설정"을 합친 1인칭 롤플레이 지시문이라,
랜딩 5변형(`../../landing/`) + 질문 세트(실행안 §8)와 함께 모델에 넣으면 바로 반응 측정이 된다.

## 파라미터

| 플래그 | 기본 | 의미 |
|---|---|---|
| `--count` | 20 | 생성 개수 (아키타입 A8·B6·C4·D2 비례 배분) |
| `--max-scan` | 150000 | 최대 스캔 행 수 (매칭 부족 시 상향) |
| `--seed` | 42 | 난수 시드 — 같은 시드 = 같은 결과(재현성) |
| `--no-streaming` | off | 전체 다운로드 모드(비권장, 수 GB) |

## 커스터마이즈 포인트 (스크립트 상단)

- `CORE_BEAUTY` / `ROLE_BIZ` — 필터 키워드. 뷰티에 더 좁히려면 `ROLE_BIZ`를 줄인다.
- `POOLS` — 아키타입별 13축 값·가중치. criteria 기준표 §1·§2와 동일 라벨을 쓴다.
- `augment()` — §3 상관 규칙(규모↔예산, 카테고리↔약기법, 일본어↔실패경험 모순 배제).

## 출처 표기 (CC BY 4.0 의무)

이 산출물은 **nvidia/Nemotron-Personas-Korea** (CC BY 4.0)를 가공한 것이다.
결과를 외부 공유·게시할 때 출처를 명시한다. (JSON/MD 출력에 자동 포함)

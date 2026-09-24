# 작업 지시: 카탈로그 정리 — 30종을 정직하게 나눈다

Pollen 버그(Lite/Wireless가 한 model_id로 뭉쳐 있던 것)는 표시 버그가 아니라
**카탈로그 설계 문제였다.** 같은 문제가 다른 모델에도 있는지 보면서 정리한다.

목표: "30 robots in database"를 "N robots tracked daily"로 바꾼다.
숫자를 키우는 게 아니라 **말이 사실이 되게** 한다.

## 1. 모델 식별부터 고친다

하나의 `model_id`가 실제로는 가격·사양이 다른 두 제품을 덮고 있는 경우를 찾는다.
- 확인된 사례: Pollen Reachy Mini — Lite와 Wireless는 가격도 사양도 다르다.
  별도 모델로 분리한다.
- 나머지 29종도 같은 눈으로 본다. `config/price-sources.json`에서 한 model_id에
  여러 URL이 붙어 있거나, variant가 실질적으로 다른 제품인 경우가 있는지.

**주의**: model_id를 바꾸면 기존 `data/prices/*.jsonl`의 과거 행과 연결이 끊긴다.
과거 데이터를 고쳐 쓰지 말고, 변경 이력을 `data/model-id-changes.json`에 남겨
과거 행을 읽을 때 매핑할 수 있게 한다. (과거를 조작하지 않는다는 원칙)

## 2. 30종을 세 갈래로 나눈다

각 모델에 `tracking_status`를 넣는다:

- `tracked` — 미국에서 실제로 살 수 있고, 가격을 매일 수집하고 있다
- `listed` — 실재하는 제품이지만 가격을 수집하지 못한다
  (`listed_reason`에 이유를 쓴다: "공개 가격 없음" / "문의 판매만" / "미국 판매처 없음" 등)
- `announced` — 발표만 됐고 아직 살 수 없다 (출시 예정일이 있으면 적는다)

**지우지 않는다.** 30종 전부 DB에 남기고 상태만 붙인다.
"이 로봇은 못 삽니다"도 정보다.

판정 기준은 추측이 아니라 확인이다. 판정 근거(확인한 URL과 날짜)를 각 모델에 남긴다.

## 3. 사이트 문구를 사실에 맞춘다

홈과 표의 숫자를 바꾼다:
- "N robots tracked daily · M listed, not tracked · K announced"
- 표에 `tracking_status` 필터를 넣고, 기본은 `tracked`만 보이게 한다
- `listed`/`announced` 행은 가격 칸에 `not tracked`와 이유를 쓴다. 빈 칸 금지

**"30 robots"라는 표현을 쓰지 않는다.** 30종을 추적한 적이 없다.

## 4. 추적 대상을 억지로 늘리지 않는다

지금 11개 소스다. 조사해서 쉽게 붙는 게 있으면 붙이되,
**숫자를 채우려고 무리하지 않는다.** 12~15개면 충분하다.
`listed`가 많은 것은 부끄러운 게 아니라 정직한 것이다.

## 5. 보고할 것

- tracked / listed / announced 각 몇 개인지와 목록
- 분리한 모델이 있으면 무엇을 왜 나눴는지
- Pollen 말고 같은 식별 문제가 있던 모델이 또 있었는지

# 작업 지시: 관측 개시와 실제 변화를 분리

## 1. 지금 events.jsonl 20건은 전부 "관측 개시"다 (긴급)

내용을 보면:
- KEYi 15건: `unknown → in_stock/out_of_stock` — 엔드포인트를 바꿔서 처음 본 것.
  Loona Sky는 어제도 품절이었다. KEYi가 바꾼 게 아니다.
- DeepRobotics 3건: `in_stock → contact_sales` — 우리가 규칙을 추가한 것.
- 1X 2건: `unknown → pre_order` — 우리가 상태값을 추가한 것.

**세상에서 일어난 변화는 0건이다.** 그런데 전부 `availability_changed`로 저장돼
진짜 품절과 구분되지 않는다. 3년 뒤 타임라인이 거짓을 말하게 된다.

### 고칠 방법

이벤트 종류를 둘로 나눈다:

- `observation_started` — 이전 값이 `unknown`이거나, 우리 파서·규칙·엔드포인트가
  바뀌어서 처음 관측된 경우. **세상의 변화가 아니다.**
- `availability_changed` 등 기존 종류 — 양쪽 스냅샷 모두 같은 방식으로 관측된
  상태에서 값이 달라진 경우만.

그리고 모든 이벤트에 아래를 추가한다:
```
"observation_change": true | false
"reason": "endpoint changed: products/petbot.json → products.json?limit=250"
```
`observation_change: true`인 이벤트는 사이트의 타임라인에서 기본으로 숨긴다
(또는 "관측 시작"으로 다르게 표시한다). 데이터에서 지우지는 않는다 —
언제부터 무엇을 보기 시작했는지도 기록이다.

**기존 20건을 이 기준으로 다시 분류해 덮어쓴다.** 20건 전부 `observation_started`가 된다.

### 앞으로의 규칙

파서·엔드포인트·상태값 규칙을 바꾼 날에 생기는 이벤트는 자동으로
`observation_change: true`가 되게 한다. 수집기 버전이나 설정 해시를 스냅샷에
같이 저장해 두고, 그 값이 달라진 날의 차이는 실제 변화로 취급하지 않는다.

## 2. 할인 15 vs 14 — 원본으로 확인한다

`context/observability.md`는 "15개 variant 전부 할인 중"이라 적었고,
오늘 실행 결과는 14개다(Space Edition은 $699 = $699).

두 가지 가능성이 있다:
(a) 그 사이 Space Edition 프로모션이 끝났다 → 진짜 `discount_ended` 사건이다
(b) 조사 때 Premium 하나만 보고 "전부"로 일반화했다 → 조사 문서가 틀렸다

**`data/prices/raw/2026-09-24/` 의 KEYi 원본을 열어 Space Edition의
`compare_at_price`를 직접 확인하고 판정하라.** 추측하지 말 것.

- (a)였다면 `events.jsonl`에 `discount_ended`를 수동으로 넣지 말고,
  "원본상 확인된 사건"으로 `context/observability.md`에 기록만 한다
  (자동 생성 규칙 밖에서 손으로 넣은 이벤트는 만들지 않는다).
- (b)였다면 `context/observability.md`의 해당 문장을 고치고,
  "예시 하나로 전체를 단정하지 않는다"는 원칙을 문서에 남긴다.

## 3. 기록해 둘 것

오늘 관측된 실제 상태 중 의미 있는 것:
**Loona 15개 구성 중 9개가 품절이고, 품절된 것이 전부 한정판이다**
(Sky, Xmas Reindeer, Scholar, Summer Vibe, Aviator Supreme,
Football Fanatic Blue/Red, Loona Go).

이건 사건이 아니라 상태이므로 events에 넣지 않는다.
`context/observability.md`에 "2026-09-24 최초 관측 시점의 상태"로 적어 둔다.

## 4. 이어서 — task-fcc-4.md

손대지 않고 남겨둔 `context/task-fcc-4.md`는 유효한 지시다. 이것까지 하고 멈춘다.
내용은 FCC 부록 B의 세 열을 모두 읽는 것이다. 지금 Robotic Devices 열만 읽는데,
사이트는 "확인했고 목록에 없음"이라고 말하고 있어 근거가 한 열만큼 부족하다.

## 5. 보고할 것

- 20건 재분류 결과
- 2번 판정 결과 (a인지 b인지, 원본의 실제 값과 함께)
- task-fcc-4 완료 후 세 열 합산 승인 건수

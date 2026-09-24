# 작업 지시: 수집 필드 확장 + events 자동 생성

`context/observability.md` 조사 결과를 반영한다. 순서대로.

## 1. 버리고 있던 필드를 줍는다

`parseShopifyProduct`(src/lib/parse.ts)가 지금 `price`, `available`, `variant`만 읽는다.
같은 응답에 있는데 버리는 것들을 추가한다:

- `compare_at_price` → 할인 감지 (KEYi는 지금 15개 전부 할인 중)
- `options` + variant별 `sku`, `id` → 구성 추가·삭제 추적
- `published_at` → 상품 등록 시점
- variant별 `updated_at` (있는 소스만)

## 2. KEYi 엔드포인트 교체

`us.keyirobot.com/products/petbot.json` → `us.keyirobot.com/products.json?handle=petbot`
조사에서 이 엔드포인트에 `available`이 있는 것을 확인했다.
교체 후 실제 응답으로 확인하고, 안 되면 원래대로 두고 로그에 남긴다.
(성공 시 재고 관측 9개 → 10개)

## 3. Pollen 리드타임 파싱

Pollen 2종은 `description`에 "Lead time: up to 90 days after purchase" 문구가 있다.
정규식으로 뽑아 `lead_time_text`(원문)와 `lead_time_days`(숫자)로 저장한다.
문구가 바뀌면 `lead_time_text`가 달라지므로 이벤트가 잡힌다.
**다른 소스에는 리드타임이 없다. 억지로 찾지 말 것.**

## 4. 저장 형태 — 근거를 함께 남긴다

파싱한 값만 두지 말고 무엇을 보고 그렇게 판단했는지 남긴다:

```json
{
  "date": "2026-09-24",
  "observed_at": "2026-09-24T00:17:03Z",
  "model_id": "unitree-g1",
  "seller": "unitree-official",
  "variant": "G1",
  "variant_sku": "...",
  "price_usd": 16000,
  "compare_at_price_usd": null,
  "on_sale": false,
  "availability_status": "in_stock",
  "availability_evidence": "variants[0].available=true",
  "lead_time_text": null,
  "lead_time_days": null,
  "purchase_mode": "direct",
  "market": "US",
  "source_url": "...",
  "flags": []
}
```

`availability_status`는 문자열로 정규화한다:
`in_stock` / `out_of_stock` / `pre_order` / `contact_sales` / `unknown`
**bool을 그대로 쓰지 말 것.** 나중에 필터와 차트에서 쓴다.

`purchase_mode` 신규 필드:
- `direct` — 표시된 가격으로 바로 살 수 있다
- `contact_sales` — 가격은 표시되나 실제 구매는 문의 필요
  (DeepRobotics의 Venture/Pro/LiDAR 구성이 여기 해당 — 조사에서 확인됨)
- `preorder` — 1X NEO 같은 사전예약
이 구분이 나중에 "지금 살 수 있는 로봇" 필터의 근거가 된다.

## 5. events.jsonl — snapshot diff로 자동 생성

**사람이 입력하지 않는다.** 어제 snapshot과 오늘 snapshot을 비교해 자동 생성한다.
`data/events.jsonl`에 누적하며, 변화가 있을 때만 줄이 추가된다.
(Git 이력이 깔끔하게 유지되고, 3년 뒤 이 파일이 Ohmlot의 핵심 자산이 된다.)

생성할 이벤트 종류 — 조사에서 관측 가능하다고 확인된 것만:

| 이벤트 | 조건 | 가능 소스 |
|---|---|---|
| `price_changed` | `price_usd` 변경 | 11 |
| `availability_changed` | `availability_status` 변경 | 9~10 |
| `discount_started` | `compare_at_price` > `price`로 전환 | 11 |
| `discount_ended` | 할인 상태에서 해제 | 11 |
| `variant_added` | 어제 없던 variant id 등장 | 10 |
| `variant_removed` | 어제 있던 variant id 사라짐 | 10 |
| `lead_time_changed` | `lead_time_text` 변경 | 2 (Pollen) |
| `product_unpublished` | 상품 응답 자체가 404/사라짐 | 11 |

이벤트 한 줄에는 최소한 다음을 넣는다:
`date`, `type`, `model_id`, `seller`, `variant`, `from`, `to`, `source_url`

**주의**: 9/22·9/23 snapshot에는 새 필드가 없다. 새 필드 기반 이벤트는 오늘부터 시작된다.
과거를 소급해서 채우지 말 것. `price_changed`와 `availability_changed`만 9/22부터 가능하다.

## 6. 1X는 원본 보관으로 충분

1X NEO는 재고 개념이 없는 사전예약 상품이다.
"US Deliveries start 2026" 문구가 언제 바뀌는지가 유일한 신호인데,
0번에서 이미 원본 HTML을 매일 저장하고 있으므로 지금은 추가 작업 없다.
나중에 문구 변화 감지를 붙인다.

## 7. 사이트에는 아직 아무것도 노출하지 않는다

events가 쌓이는지 먼저 확인한다. 화면 작업은 다음 지시로.

## 8. 끝나면 보고할 것

- 재고 관측 가능 소스 최종 개수 (KEYi 교체 성공 여부)
- 오늘 수집분에서 생성된 이벤트 목록 (없으면 없다고)
- 할인 상태인 모델 목록 (KEYi 15개가 잡히는지)

# 관측 가능성 조사 (context/task-observability.md §1-2)

조사일: 2026-09-24. 결제·장바구니 단계는 진입하지 않았다(§3). 근거는 전부 그날 커밋된
`data/prices/raw/2026-09-24/<source-id>.<json|html>` 원본과, 리전 차이 확인을 위해 그 자리에서
직접 호출한 응답이다(가공 없이 그대로 읽음). 소스 11개는 `config/price-sources.json` 순서.

## 정정: "이미 확인된 것"에 예외가 있다

지시문의 "Shopify `.js`는 variant별 `available`을 준다"는 **9/11 소스에는 맞고, KEYi(Loona)에는 틀리다.**
KEYi는 `.js`가 마케팅 페이지로 301 리다이렉트돼(이전 세션에서 이미 확인) 지금은 `/products/petbot.json`
(구버전 Shopify 상품 API 형태, `{ product: {...} }`)을 쓰는데, 이 응답의 variant 객체에는 `available`
필드 자체가 없다(`"available" in variant` → `false`로 직접 확인). 즉 지금 저장 중인 `available: null`은
파서 버그가 아니라 **KEYi 소스 자체가 재고 상태를 이 엔드포인트로는 안 준다**는 뜻이다.

대안은 있다: 같은 스토어의 컬렉션 엔드포인트 `us.keyirobot.com/products.json?handle=petbot`은 같은
가격·옵션 정보에 더해 `available`을 포함한다(직접 호출해 키 목록으로 확인). 구현은 다음 지시에서.

## 표

범례 — **있음**: 상품 페이지 응답에 있음(근거 표기) · **결제단계**: 장바구니/결제에서만 보임(수집 안 함) · **없음**: 어디에도 없음

| # | 소스 (seller / 상품) | 재고 상태 | 재고 수량 | 리드타임 | 할인 | variant 목록 | 상품 등록일 | 지역 차이 |
|---|---|---|---|---|---|---|---|---|
| 1 | unitree-official / go2 | **있음** — `variants[].available` (bool) | 없음 | 없음 | 없음 — `compare_at_price` 필드는 있으나 전 variant `null` | **있음** — `options`(1축: Version) + variant 5개, sku 포함 | **있음** — `published_at` `2023-07-13T17:30:12+08:00` | 없음 — `?country=US`/`KR`/무파라미터 응답 동일(직접 호출로 확인) |
| 2 | unitree-official / g1 | **있음** — variant 2개 다 `available:true` | 없음 | 없음 | 없음 — `compare_at_price` `null` | **있음** — variant 2개(G1, G1 Pro) | **있음** — `2024-06-05T16:15:51+08:00` | 없음 — go2와 동일 스토어, 동일 메커니즘 |
| 3 | unitree-official / r1 | **있음** | 없음 | 없음 | 없음 — `compare_at_price` `null`(6개 전부) | **있음** — variant 6개(Air/기본/EDU × White/Red) | **있음** — `2025-12-05T14:01:04+08:00` | 없음 — 동일 스토어 |
| 4 | unitree-official / h2 | **있음** — 현재 `available:false`(품절)까지 정확히 반영 | 없음 | 없음 | 없음 | **있음** — variant 1개뿐이라 목록 자체는 단순 | **있음** — `2026-01-30T20:48:49+08:00` | 없음 — 동일 스토어 |
| 5 | pollen-official / reachy-mini-wireless | **있음** | 없음 | **있음** — `description`에 "Lead time: up to 90 days after purchase (many orders ship sooner)." | 없음 — `compare_at_price` `null` | 있음(다만 variant 1개 "Default Title") | **있음** — `2026-04-20T12:38:40+02:00` | **있음** — 무파라미터/타 국가는 EUR로 응답, `?country=US`에서만 USD(기존 `withUsMarket()`이 이 문제 때문에 존재) |
| 6 | pollen-official / reachy-mini-lite | **있음** | 없음 | **있음** — 동일 문구 확인 | 없음 | 있음(variant 1개) | **있음** — `2026-04-20T12:34:54+02:00` | **있음** — 5번과 동일 |
| 7 | petoi-official / bittle-x | **있음** — variant별 `available`(예: alloy 조립형은 `false`) | 없음 | 없음 — description에 리드타임 문구 없음 | **필드는 있으나 현재 미적용** — `compare_at_price`가 숫자로 존재하지만 6개 variant 전부 `price`와 동일(할인 없음 상태) | **있음** — variant 6개(조립/사전조립 × lite/alloy 서보) | **있음** — `2023-06-05T00:11:30-07:00` | 없음 — 직접 호출로 확인 |
| 8 | petoi-official / nybble-q | **있음** | 없음 | 없음 | 필드는 있으나 현재 미적용(동일 패턴) | **있음** — variant 3개 | **있음** — `2025-11-26T21:32:08-08:00` | 없음 — bittle과 동일 스토어 |
| 9 | keyi-official / petbot (Loona) | **없음** — `/products/petbot.json`엔 `available` 필드 자체가 없음(위 "정정" 참고) | 없음 | 없음 — `body_html` 295자, 리드타임 언급 없음 | **있음, 현재 적용 중** — 15개 variant 전부 `compare_at_price` > `price` (예: Premium $499 vs $529, 약 6% 할인) | **있음** — variant 15개, 가장 풍부 | **있음** — `2026-01-21T00:01:02-05:00` | 없음 — `?country=` 무영향(직접 호출로 확인) |
| 10 | deeprobotics-us / lite-3 | **있음** — variant별 `available`(6개 전부 현재 `true`) | 없음 | 없음 — description은 있으나 리드타임 문구 없음. 단, Venture/Pro/LiDAR 상위 구성은 "please contact our sales team... for detailed configurations and available discounts"라고 명시(가격은 나와 있지만 실제 판매조건은 문의 필요) | 없음 — `compare_at_price` `null` | **있음** — variant 6개(Basic/Basic AI/Venture/Pro/LiDAR/Controller) | **있음** — `2025-08-28T05:09:18-07:00` | 없음 — 직접 호출로 확인 |
| 11 | 1x-official / order (1X NEO) | 없음 — "품절"/"입고" 같은 재고 문구 없음(애초에 사전예약형 상품) | 없음 | **부분 있음** — 페이지 고정 문구 "US Deliveries start 2026"와 FAQ "US deliveries begin in 2026 starting with Early Access customers…". 연 단위일 뿐 주 단위 리드타임은 아님 | 없음 — 할인/정가 병기 문구 없음 | 없음 — 정규식으로 고정 2개 항목(Ownership $20,000, Subscription $499/mo)만 뽑는 구조라 페이지 자체의 옵션 구조를 추적하지 않음 | 없음 — 일반 HTML 주문 페이지라 게시일 메타데이터 없음 | **조사 안 됨** — 쿼리 파라미터로 리전을 바꾸는 방법을 못 찾았고, IP 기반 분기 여부는 VPN 없이 확인 불가. "없음"이라 단정하지 않음 |

## 결론

**재고를 안정적으로 관측 가능한 소스: 9개 / 11개.** unitree 4종 + pollen 2종 + petoi 2종 + deeprobotics
1종은 variant별 `available` bool을 매일 받는다(품절 전환까지 정확히 반영되는 것을 H2 사례로 확인).
KEYi(Loona)와 1X(NEO)는 안 된다 — KEYi는 다른 엔드포인트로 바꾸면 될 가능성이 있고(위 정정 참고),
1X는 애초에 "재고" 개념이 없는 사전예약 상품이라 다른 신호(배송 시작 연도 문구)로 대체해야 한다.

**리드타임을 상품 페이지에서 얻을 수 있는 소스: 2개(Pollen 계열) + 1X의 약한 신호 1개.** 나머지 8개는
상품 페이지 어디에도 리드타임 문구가 없다 — 없다고 조사됐다. 페이지에 없는 걸 다른 방법으로 알아내려는
시도(장바구니 진입 등)는 하지 않았다(§3).

**재고·리드타임이 안 되는 소스의 대안 신호**:
- **KEYi**: `compare_at_price`가 지금 15개 variant 전부에서 실제로 할인 중(정가보다 낮은 판매가). 이 값과
  variant별 `updated_at` 타임스탬프는 매일 안 남기면 복원 불가능하다.
- **1X**: "US Deliveries start 2026"라는 고정 문구 자체가 비복원 데이터다 — 이 문구가 언제 구체적인
  날짜나 "배송 중" 같은 표현으로 바뀌는지는 그 순간의 원본을 갖고 있어야만 알 수 있다(0번에서 이미
  원본 HTML을 매일 archiving 시작함).
- **Petoi 2종**: `compare_at_price` 필드는 있지만 지금은 할인 미적용 — 앞으로 값이 갈라지는 날을 잡을
  수 있는 대상으로 남겨둔다.

## 부록: variant 목록 · 할인 필드에 대한 지시문의 지적

"`compare_at_price`와 variant 목록은 같은 응답에 있는데 지금 버리고 있다"는 지적은 **11개 전부**에서
맞다(1X는 variant 개념이 없어 예외). `parseShopifyProduct`(src/lib/parse.ts)는 지금 `price`, `available`,
`variant`(title)만 읽고 `compare_at_price`와 `options`는 버린다. 이번 조사에서는 수집기를 고치지 않았다
(§3 지시대로 조사만).

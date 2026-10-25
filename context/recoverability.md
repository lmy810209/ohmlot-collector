# 복원 가능성 조사 (task-measure.md §A)

조사일: 2026-09-25. `tracked` 15종 중 대표 5종 — Unitree 2종(G1, Go2) + 나머지 제조사 3종(1X, KEYi, DEEP
Robotics)을 섞어서 골랐다. 각 제품의 공식 판매 페이지를 Wayback Machine CDX API로 지난 12개월
(2025-09-25~2026-09-25) 스냅샷 목록을 받아, 고르게 흩어진 6~8개를 표본으로 직접 열어 8개 필드가
읽히는지 확인했다. 방법론은 5개 제품에 병렬로 동일하게 적용했다(각자 CDX 조회 → 표본 선정 → 스냅샷
fetch → 필드별 판정, 총 fetch는 제품당 10~12회 이내로 제한).

**셋으로만 구분한다**: `recovered`(복원됨) / `captured_no_value`(캡처는 있으나 값 없음) /
`no_capture`(캡처 자체 없음). "캡처 없음"을 "그때 없었다"로 해석하지 않았다.

## 제품별 요약

| 제품 | 대상 URL | 표본 스냅샷 수 | recovered | captured_no_value | no_capture | 비고 |
|---|---|---|---|---|---|---|
| Unitree G1 | shop.unitree.com/products/unitree-g1 | 8 (2025-10-16~2026-09-14, 월 간격) | 48/64 | 16/64 | 0/64 | 서버 렌더링 Shopify 페이지 — JSON-LD/ProductJson이 원본 HTML에 그대로 박혀 있어 JS 실행 없이도 읽힘 |
| Unitree Go2 (Air) | shop.unitree.com/products/unitree-go2 | 7 (2025-10-10~2026-09-12) | 42/56 | 14/56 | 0/56 | 위와 동일 이유로 고복원. 스냅샷 1개(2025-11-28)는 Wayback 서빙 500 에러라 인접 캡처(2025-11-17)로 대체 |
| 1X NEO | www.1x.tech/order | 8 (2025-10-28~2026-09-15) | 64/64 | 0/64 | 0/64 | Next.js+Sanity CMS, `__NEXT_DATA__`에 전체 상품 데이터가 서버 렌더링됨. **11개월간 8필드 전부 변화 없음** |
| KEYi Loona | us.keyirobot.com/products/petbot | **3만 존재** (2026-05-09~06-13, 5주 몰림) | 18/24 | 6/24 | 0/24\* | **공식 URL 자체가 Wayback에 캡처된 적이 없다** — bare `keyirobot.com`으로 대체 확인. 연중 10.5개월은 캡처 자체가 0건 |
| DEEP Robotics Lite3 | shop.deeprobotics.us/products/lite-3 | **0** | 0/0 | 0/0 | **8/8 (전 필드)** | 이 URL은 Wayback에 **한 번도** 크롤링된 적이 없다(같은 스토어의 다른 제품 2종은 크롤링됐는데 이것만 빠짐) |

\* KEYi는 존재하는 3개 스냅샷 안에서는 no_capture가 0건이지만, 요청한 6~8개 중 3개만 실존해 표본 자체가
연중 5주 구간에만 몰려 있다 — "필드가 안 읽힘"과는 다른, "표본이 될 캡처 자체가 희소함"이라는 별개의
결핍이다. 아래 종합 표에서 이 점을 분리해서 다룬다.

## 필드별 복원율 — 실제로 캡처가 존재했던 4개 제품 기준 (G1·Go2·1X·KEYi, 26개 스냅샷 × 8필드 = 208칸)

DEEP Robotics는 표본이 0개라 이 표의 분모에 넣지 않았다 — 섞으면 "필드가 원래 안 읽힌다"는 뜻과
"그 제품 자체가 아카이브에 없다"는 서로 다른 문제가 하나의 숫자로 뭉개진다. DEEP Robotics는 별도
행(위 표)으로만 다룬다.

| 필드 | recovered | captured_no_value | 복원율 |
|---|---|---|---|
| 가격 | 26/26 | 0 | **100%** |
| 구매 경로 (buy now/preorder/quote) | 26/26 | 0 | **100%** |
| variant 목록 | 26/26 | 0 | **100%** |
| 할인 여부 | 26/26 | 0 | **100%** |
| 재고 상태 | 23/26 | 3 (KEYi — 상품 전체 InStock 배지는 보이나 variant별 재고는 안 보임) | **88.5%** |
| 지역·배송 조건 | 23/26 | 3 (KEYi — "Free shipping" 배지만 보이고 상세 배송비·관세 문구는 안 보임) | **88.5%** |
| 구성품 | 11/26 | 15 (G1·Go2 전 스냅샷 — 애초에 그 페이지에 "구성품" 섹션 자체가 없어 보임, JS 문제 아님) | **42.3%** |
| 보증 조건 | 11/26 | 15 (G1·Go2 전 스냅샷 — 동일 이유) | **42.3%** |
| **합계** | **172/208** | **36/208** | **82.7%** |

no_capture(캡처 자체 없음)는 이 4개 제품의 208칸 중 0건 — 캡처가 존재하는 페이지 안에서는 어떤 필드도
완전히 빈 페이지로 실패하지 않았다. 다만 이건 "캡처가 있을 때"의 이야기이고, KEYi·DEEP Robotics 사례가
보여주듯 **캡처 자체가 없는 구간·제품**이 별도로 크다.

## 지시문 서두의 가설과 실제 측정값 비교

지시문은 "가격은 82%, 재고는 11%"라는 **예시**로 실험의 형식을 보여줬다(가설이 아니라 "이런 식으로
말할 수 있어야 한다"는 서술 형식의 예시). 실측값은 다르게 나왔다:
- **가격은 100%** (26/26) — 예시의 82%보다도 높았다. 5개 제품 전부 서버 렌더링 페이지라 가격이 원본
  HTML에 텍스트로 박혀 있었던 게 이유다.
- **재고는 88.5%** (23/26) — 예시의 11%와 정반대로, 상당히 높게 나왔다. 이 조사 대상 5개 사이트가
  전부 JS 미실행 상태에서도 재고 정보가 정적 HTML/JSON-LD로 남는 구조였기 때문으로 보인다. **"재고는
  거의 복원 안 된다"는 가정은 이 표본에서는 틀렸다.**
- 대신 **낮게 나온 건 구성품·보증(42.3%)**과, 무엇보다 **표본 자체의 존재 여부**(KEYi 5주만 존재,
  DEEP Robotics 0건) — 필드 판독 실패가 아니라 **아카이브 커버리지 자체의 공백**이 진짜 병목이었다.

정직하게 정정한다: 가설을 그대로 확인한 게 아니라, 가설이 지목한 것과 **다른 약점**(구성품·보증, 그리고
페이지 자체의 아카이브 부재)을 찾아냈다. 이게 "믿지 말고 재본다"의 실제 결과다.

## 수집 시작(2026-09-22) 이전에 실제로 있었던 변화 — historical_reconstruction

Wayback에서 발견한, Ohmlot 수집기가 존재하기 전의 실제 변화 3건. `primary_observation`과 같은
테이블·화면에 섞지 않기 위해 `data/historical-findings.jsonl`에 별도로 저장했다(`events.jsonl`에는
넣지 않음). 각 항목에 발견 시점의 정확한 스냅샷 timestamp와 URL을 남겼다.

1. **Unitree G1 — 가격·구매방식 전환**: 2025-10-16(`20251016041415`)에는 $16,000, 재고 없음(OutOfStock),
   "Contact us for the real price"(견적 전용, 장바구니 버튼 없음)였는데, 2025-12-24(`20251224091936`)에는
   $13,500, "Add to Cart"(자체 결제, 백오더)로 바뀌어 있었다. 기업 견적 모델에서 이커머스 모델로 전환한
   사건으로 보인다.
2. **Unitree Go2 — 배송·관세 문구 변경**: 2025-11-17(`20251117073430`)에는 "Tax included for most
   countries (including US)"였는데, 2026-01-24(`20260124104427`)부터 "Customer is responsible for all
   applicable customs duties, taxes, and import clearance"로 바뀌어 있었다. 가격·재고 자체는 연중 무변화.
3. **KEYi Loona — 좁은 구간 안에서도 실제 가격 변동**: Premium $429.00(5/9) → $409.00(5/21) →
   $442.00/정가 $529.00(6/13); Duo Delight 번들 $980.00 → $828.00 → $874.00/정가 $1078.00. 5주 사이에도
   가격이 세 번 바뀌었다 — KEYi가 다른 제조사보다 훨씬 자주 가격을 조정한다는 방증. 또한 "Xmas Reindeer"
   한정판이 5~6월에도 계속 판매 중이었다(연휴 시즌 종료 후 자동으로 빠질 거라는 가정이 틀렸다).

## 이 실험이 답한 것 (§A 목적 대비)

- **실제로 복원 불가능한 게 무엇인가**: 구성품·보증 조건(42.3%)은 필드 자체가 JS 렌더링 문제가 아니라
  애초에 그 페이지에 없어서 못 읽었다 — 애초에 Ohmlot 수집기도 이 두 필드는 지금 수집하지 않는다(맞는
  선택이었다는 방증). 진짜 병목은 필드 판독력이 아니라 **아카이브 커버리지의 공백** — 5개 중 1개
  제품(DEEP Robotics)은 공식 판매 페이지가 Wayback에 단 한 번도 없었고, KEYi는 연중 5주만 존재했다.
- **자원을 어디로 몰아야 하는가**: "재고 관측에 자원을 몰아야 한다"는 가설은 이 표본에서 근거가
  약해졌다(재고가 이미 88.5%로 잘 복원됨). 대신 **"과거를 신뢰할 수 있는 아카이브가 거의 없다"**는 점이
  드러났다 — 즉 Ohmlot이 지금부터 계속 자체 수집을 쌓는 것 자체가 유일한 신뢰 가능한 경로이고,
  Wayback으로 보완할 수 있는 몫은 제한적이다(특히 KEYi·DEEP Robotics류의 소규모 제조사 사이트).
- **공개 시 첫 콘텐츠 후보**: 위 3건의 historical_reconstruction 발견 — 특히 Unitree G1의 견적→셀프
  체크아웃 전환은 "가격이 반토막 났다"는 한 줄 스토리가 되는, 실제로 흥미로운 소재다.

## 방법론 메모

- 5개 제품 조사를 병렬 에이전트로 분담했고, 각자 CDX API(`web.archive.org/cdx/search/cdx`)로 스냅샷
  목록을 먼저 받은 뒤 6~8개(KEYi는 3개만 존재)를 골라 `https://web.archive.org/web/<timestamp>/<url>`
  형태로 직접 열었다. WebFetch가 web.archive.org를 거부해 전부 `curl`(일반 브라우저 User-Agent)로
  받았다 — Ohmlot 수집기가 향후 Wayback을 보완 소스로 쓴다면 같은 방식이 필요하다는 뜻.
- 요청한 timestamp와 실제로 받은 timestamp가 다른 경우(Wayback이 최근접 캡처로 대체) 전부 확인했고,
  Go2의 1건(2025-11-28→2025-11-17 대체, 500 에러 회피)을 제외하면 전부 정확히 요청한 시각 그대로
  서빙됐다.
- KEYi의 경우 **지시문에 준 URL(`us.keyirobot.com/products/petbot`)이 애초에 한 번도 캡처된 적이
  없다**는 걸 확인한 뒤, bare `keyirobot.com`/`www.keyirobot.com` 호스트로 같은 내용을 찾아 대체
  확인했다 — 이것도 "캡처 자체 없음"의 한 형태로 별도 기록했다(정확히는 이 특정 서브도메인·URL 조합에
  대해서만 no_capture, 같은 제품의 다른 호스트 표기는 recovered).

## 2026-10-25 추가 조사 — KEYi Loona 10월 가격 인하(Oct 20, $499→$429) 캡처 조회 시도 (task-prelaunch-2.md §C)

**목적**: Show HN 초안(`context/launch-showhn.md`)의 "다른 어떤 기록도 이 가격 인하를 안 잡았다"는
문장을 내보내도 되는지 판정. 결론부터: **판정 불가 — Wayback CDX API 자체에 접근하지 못했다.**

조회 시도 (2026-10-25 약 09:18~09:23 UTC, 우회 도구·프록시 없이 공식 CDX API만 직접 curl):

```bash
curl -s 'https://web.archive.org/cdx/search/cdx?url=us.keyirobot.com/products/petbot&matchType=prefix&from=20261001&to=20261031&output=json&fl=timestamp,original,statuscode'
curl -s 'https://web.archive.org/cdx/search/cdx?url=us.keyirobot.com/products.json&matchType=prefix&from=20261001&to=20261031&output=json&fl=timestamp,original,statuscode'
curl -s 'https://web.archive.org/cdx/search/cdx?url=us.keyirobot.com&matchType=domain&from=20261001&to=20261031&output=json&fl=timestamp,original,statuscode&limit=200'
```

결과: 세 요청 모두 TLS 핸드셰이크는 성공했지만(서버 인증서 정상, `*.archive.org`) 응답 바디가 오지
않았다 — 20초 제한에서는 `curl: (28) Operation timed out`, 90초로 늘려 재시도한 한 번은 HTML로 **"Internet
Archive services are temporarily offline"**(IA 공식 장애 안내 페이지)를 받았다. 같은 시각 `https://archive.org/`
메인 페이지는 HTTP 200으로 정상 응답 — 그래서 이건 2026-09-25 조사 때 겪었던 "프록시가 web.archive.org를
막는다"는 것과는 다른 문제로 보인다. **Wayback 검색(CDX) 백엔드 자체가 그 시점에 불안정하거나 다운**
상태였던 것으로 판단한다.

**처리**: "확인 못 하면 문장을 통째로 지운다"는 task-prelaunch-2.md §C의 원칙대로, 해당 문장을
`context/launch-showhn.md`에서 삭제했다. IA가 복구되면 같은 3개 쿼리를 다시 돌려서, 10/19~10/21 구간에
캡처가 있는지(있으면 문장 영구 삭제 + 그 캡처의 실제 가격 확인) / 전혀 없는지(있으면 문장 복원 가능)를
마저 판정해야 한다.

캡처 **없음**을 "그때 그 가격이 아니었다"로 해석하지 않는 이 문서의 원칙은 여기서도 그대로 적용된다 —
다만 이번엔 "없음을 확인"조차 못 했다는 게 차이다.

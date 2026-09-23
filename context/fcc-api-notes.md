# FCC 공식 API 조사 노트 (1단계) — 2026-09-24

조사 범위: KDB 953436 `getFCCIDList`, grantee code 검색, 승인일 확보, Covered List 조건부 승인 목록.
원칙대로 우회 도구·프록시는 쓰지 않았다. 아래 "실제 호출"은 이 컴퓨터(서울, SK브로드밴드), GitHub Actions
ubuntu-latest 러너(미국), Claude WebFetch 세 곳에서 한 것이다.

## 1. 엔드포인트와 예시 요청

- 문서: KDB 953436 D01 "OET Laboratory Services API". KDB 목록 페이지(2026-03-30 갱신)에는 **v04**가 첨부돼
  있으나 첨부 파일은 어디서도 열리지 않았다(§4). 아래 내용은 인터넷 아카이브에 남아 있는 **v02(2018-08-13)** 원문
  기준이고, KDB 페이지 설명과 2차 출처(Apify 등)로 v04에서도 `getFCCIDList`의 요청·응답이 같은지 교차 확인했다.
  - KDB 페이지: https://apps.fcc.gov/oetcf/kdb/forms/FTSSearchResultPage.cfm?id=50070&switch=P
  - v02 원문(아카이브): http://web.archive.org/web/20210328193417/https://apps.fcc.gov/kdb/GetAttachment.html?id=OP4ebQg0gZGacAhnaY0D8g%3D%3D&desc=953436%20D01%20OET%20Laboratory%20Services%20API%20v02&tracking_number=50070
- 메서드 4개: `getFCCIDList`, `getWhitespaceAuthorizations`, `getCBSDAuthorizations`, `getAFCAuthorizations`(v03 추가).
  WADL: `https://apps.fcc.gov/OETLabServices/application.wadl`
- **인증키·등록 없음.** 문서에 호출 제한(rate limit)·쿼터 언급 없음. 에러 코드만 정의: `204` 결과 없음(메시지
  "The search was successful, but no results were found…"), `400` URL/파라미터 오류, `500` 서버 오류.
- 요청 (GET, 파라미터 하나):

  ```
  GET https://apps.fcc.gov/OETLabServices/getFCCIDList?fccId=2A5PE
  Accept: application/json        (application/xml 도 가능)
  ```

  `fccId`는 **전체 또는 부분 FCC ID**. "최소 검색 조건은 3자 또는 5자 grantee code"라고 명시돼 있으므로
  `fccId=2A5PE`처럼 grantee code만 넣으면 그 회사의 승인된 FCC ID 전부가 나온다(문서 예시: `fccId=OPS10`, 설명
  예시 `"OPS"`). 즉 **grantee code → 회사 FCC ID 목록: 가능**.

- 문서의 응답 예시 (JSON, 원문 그대로):

  ```json
  [
    {
      "address": "7435 Oakland Mills Road",
      "state": "MD",
      "country": "United States",
      "fccid": "OPS10",
      "applicationPurpose": "Original Equipment",
      "grantDate": "08/01/2017",
      "grantee": "FCC Laboratory Test Grantee Company",
      "city": "Columbia",
      "zipCode": "21044"
    }
  ]
  ```

## 2. 실제로 호출해 본 결과 (원문)

세 곳 모두 **Akamai 엣지에서 403 "Access Denied"**. 응답 본문(러너, `fccId=2A5PE`, User-Agent `OhmlotBot/0.1`):

```
HTTP 403  content-type: text/html
<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD><BODY><H1>Access Denied</H1>
You don't have permission to access "http://apps.fcc.gov/OETLabServices/getFCCIDList?" on this server.
Reference #18.e5263e17.1790178919.b3c60547
https://errors.edgesuite.net/18.e5263e17.1790178919.b3c60547
</BODY></HTML>
```

| 출발지 | 대상 | 결과 |
|---|---|---|
| 서울 가정용 IP (211.243.230.97, SK브로드밴드) | `apps.fcc.gov/OETLabServices/getFCCIDList`, EAS 검색 HTML, KDB 첨부, `www.fcc.gov/` | 전부 403 (server: AkamaiGHost). **브라우저 UA로도 403** → UA 문제가 아니라 IP/지역 차단 |
| GitHub Actions ubuntu-latest (미국, Azure) — run 35885072929 | 같은 URL 8종 (봇 UA, `curl/8.5.0` UA, 파라미터 없음, `fccid=` 소문자 등) | **전부 403 Access Denied** (Reference #18.e5263e17… / #18.ee263e17…) |
| Claude WebFetch | `getFCCIDList`, KDB 첨부(v02·v04), `www.fcc.gov/supplychain/coveredlist`, FAQ | 403. 단 KDB **목록 페이지**(FTSSearchResultPage)는 200 |
| `api.fcc.gov` EDOCS (`/edocs/public/api/v1/document/?docket=18-89&api_key=DEMO_KEY`) | 서울 | **504 Gateway Time-out** (키 유무 무관, 3회) — 원인 미확인 |
| `docs.fcc.gov/public/attachments/…` (공지 PDF·TXT) | 서울, WebFetch | **200**. PDF와 같은 이름의 `.txt`도 제공 (`DA-26-957A1.txt` 19 KB) |

따라서 "응답 샘플"은 문서의 예시 응답뿐이고, **우리 환경에서 API 자체의 실제 응답은 받지 못했다.**

## 3. 얻을 수 있는 필드 / 없는 필드

`getFCCIDList`가 주는 것 (문서 §3, §5.1):

| 필드 | 내용 |
|---|---|
| `fccid` | grantee code(3/5자) + product code(1–14자, `-` 허용) |
| `grantDate` | **승인일**, `MM/DD/YYYY` 문자열 → 우리 `YYYY-MM-DD`로 변환 필요 |
| `applicationPurpose` | Original Equipment / Class II Permissive Change / Change in Identification / Class III Permissive Change |
| `grantee`, `address`, `city`, `state`, `zipCode`, `country` | grantee 회사명·주소 (state는 미국 소재일 때만) |

주의: 같은 FCC ID가 permissive change마다 여러 행으로 나올 수 있으므로 **가장 이른 `grantDate`를 원 승인일로** 잡아야 한다
(기존 `parseGranteePage`와 같은 규칙).

`getFCCIDList`가 **주지 않는** 것:
- 제품 설명(Form 731 description), equipment class, grant notes, 출력·주파수 — 이것들은 `getCBSDAuthorizations` 계열에만 있다.
- 심사 중(pending) 신청, 거부, 상태 코드(GI/IP/IM) — "승인된 것만" 반환.
- **Covered List 여부, 조건부 승인 여부** — EAS API에는 그런 필드가 없다. §5의 공지 부록과 대조해서 만들어야 한다.
- 모델명 ↔ FCC ID 매핑 — grantee code로 뽑은 목록은 회사 기준이라, 어느 FCC ID가 어느 모델인지는 별도 확인 필요.

## 4. 막힌 부분과 이유

1. **apps.fcc.gov 전체가 Akamai에서 차단**: 서울 가정용 IP와 GitHub(Azure 미국) IP 양쪽에서 403. 브라우저 UA로도
   403이므로 UA 필터가 아니라 IP 대역(비미국 + 데이터센터) 차단으로 보인다. 원칙대로 우회하지 않았다. 어떤 IP가
   허용되는지는 확인하지 못했다(미국 가정용 회선에서는 안 해봄).
2. **KDB v04 첨부 문서 미확보**: 같은 차단. v02(2018) 아카이브본으로 대체. v03(2023-10-23)은 `getAFCAuthorizations`
   추가, v04(2026-03-30)는 변경 내용 미확인.
3. **www.fcc.gov(Covered List 페이지·FAQ·Annex A)**: 서울·WebFetch 모두 403. 인터넷 아카이브 보관본으로 읽었다
   (Covered List 2026-09-19, Annex A 2026-09-20, FAQ 2026-08-31).
4. **EDOCS API 504**: 공지 검색 자동화(docket 18-89 최신 공지 찾기)에 쓰려 했으나 게이트웨이 타임아웃. 재시도 필요.
5. fccid.io / fcc.report는 여전히 Cloudflare 챌린지(기존 확인).

## 5. Covered List · 조건부 승인 목록 (공개돼 있음)

- **원본**: PSHSB 공지가 나올 때마다 **부록 A(Covered List 전체) + 부록 B(Conditional Approvals 표)**가 붙는다. 최신은
  **DA 26-957 (2026-09-09)**: https://docs.fcc.gov/public/attachments/DA-26-957A1.pdf (같은 URL `.txt`도 있음).
  같은 표가 https://www.fcc.gov/supplychain/coveredlist 에도 게시된다(아카이브: web.archive.org/web/20260919071351/…).
- **형식**: PDF/TXT 표(공지) 또는 HTML 표(웹페이지). 열: `UAS | Dates | Routers | Dates | Robotic Devices | Dates`.
  기계 판독용 JSON/CSV는 없다. 웹페이지 HTML을 아카이브에서 읽으면 로봇 행이 "Husqvarna AB 305v IQ, … September 9, 2026 –
  ANSCER Robotics AR250, AR650, and AR1250 robotic platforms September 18, 2026 –" 형태의 셀 텍스트로 나온다.
  `.txt`에서 로봇 행 원문:

  ```
  Robotic Devices Conditional ApprovalsDates of Conditional Approval
  … Husqvarna AB 305v IQ, 310v IQ, 420v IQ, and 440v IQ robotic platformsSeptember 9, 2026 – …
  ```

- **로봇 분야 조건부 승인 (2026-09-19 보관본 기준 2건)**:
  1. Husqvarna AB 305v IQ / 310v IQ / 420v IQ / 440v IQ robotic platforms (로봇 잔디깎이) — 2026-09-09부터, 종료일 없음 (DA 26-957)
  2. ANSCER Robotics AR250 / AR650 / AR1250 robotic platforms (자율이동로봇) — 2026-09-18부터, 종료일 없음 (**공지 DA 26-957에는
     없고 웹페이지에만 있음** → 페이지가 공지보다 먼저 갱신된다)

  우리 30종 중 해당 없음. 8월 중순까지는 0건이었다(botinfo.ai, 2026-08-13 재확인). FAQ 원문: "Devices granted Conditional
  Approvals are listed at the FCC's website here" (링크 = coveredlist 페이지).
- **갱신 순서**: DoW 결정 → coveredlist 웹페이지 표 갱신(즉시) → PSHSB 공지 부록 A/B(주기적, 예: DA 26-351 4/14, DA 26-957 9/9).
  자동 추적은 (1) 웹페이지가 막혀 있으므로 인터넷 아카이브 최신 스냅샷을 읽거나, (2) docs.fcc.gov의 최신 공지 `.txt`를
  읽는 두 경로가 있고, (2)는 최신 공지 번호를 알아야 한다.
- **Covered List 문구** (2026-07-28 추가): "Foreign-produced advanced robotic devices, except advanced robotic devices
  which have been granted a Conditional Approval by DoW." → 조건부 승인은 Covered List 항목의 예외로 반영되고, 표에
  회사·모델·기간이 적힌다.
- **절차** (Annex A, 2026-07-27; Morgan Lewis 정리): 국방부(DoW)가 결정, 신청은 machine-readable PDF를
  conditional-approvals@fcc.gov 로, 마감 2028-01-01. 기업 구조·공급망·미국 제조 계획 제출. 승인은 재량이며 신청이
  제한을 유예하지 않는다.
- **기존 승인 모델**: 2026-07-28 이전에 equipment authorization을 받은 모델은 계속 수입·판매·사용 가능(DA 26-786,
  팩트시트 DOC-423682). 승인 신청이 계류 중이던 모델은 "이전 승인"으로 보지 않는다(Annex A 취지, Morgan Lewis).
  OET 유예(DA 26-789, 2026-07-28): 기존 승인 로봇의 소프트웨어·펌웨어 permissive change는 최소 2029-01-01까지 허용.
- **정의** (National Security Determination, Morgan Lewis 요약): 지상 이동·장애물 회피·항법 가능, 환경 센서,
  ≥200 kbps 연결, 자율/원격 소프트웨어, **본체+독 합산 4.4 lb 초과**. 제외: 차량, 드론, 수중, FDA 의료, 고정 산업용 로봇.

## 6. 2단계 판단에 필요한 사실 요약

- API 사양은 확실하고 키·제한이 없지만, **우리가 쓸 수 있는 어떤 출발지에서도 apps.fcc.gov가 열리지 않는다.**
  선택지: (a) 미국 가정용 회선 등 허용 IP를 찾아 거기서 실행(미검증), (b) FCC Lab Help(www.fcc.gov/labhelp)에 API
  접근 차단 문의, (c) EAS 수집은 보류하고 시드 `fcc_ids`를 수동 검증으로 유지.
- **Covered List·조건부 승인은 docs.fcc.gov `.txt`로 자동 추적 가능**(어디서나 200). 최신 공지 번호를 찾는 EDOCS API가
  504라, 당장은 공지 번호를 수동 갱신하거나 EDOCS 재시도 로직이 필요하다.
- `us_status.covered_list`는 승인일(`grantDate`) < 2026-07-28 이면 `before`, 이후면 `after`, 승인 없음/미확인이면 `unknown`
  으로 만들 수 있다. `conditional_approval`은 부록 B 대조 결과(현재 우리 모델 전부 `null`).

## 출처

- KDB 953436 페이지: https://apps.fcc.gov/oetcf/kdb/forms/FTSSearchResultPage.cfm?id=50070&switch=P
- DA 26-957 (2026-09-09, Covered List + Conditional Approvals): https://docs.fcc.gov/public/attachments/DA-26-957A1.pdf
- DA 26-786 (2026-07-28, 로봇·인버터 Covered List 추가): https://docs.fcc.gov/public/attachments/DA-26-786A1.pdf
- DA 26-789 (2026-07-28, OET permissive change 유예): https://docs.fcc.gov/public/attachments/DA-26-789A1.pdf
- 팩트시트 DOC-423682: https://docs.fcc.gov/public/attachments/DOC-423682A1.txt
- Annex A (robots-ca.pdf, 아카이브): http://web.archive.org/web/20260920015512/https://www.fcc.gov/sites/default/files/robots-ca.pdf
- FCC FAQ (아카이브): http://web.archive.org/web/20260831130659/https://www.fcc.gov/covered-list-faqs-robots-inverters
- Morgan Lewis 정리: https://www.morganlewis.com/pubs/2026/08/fcc-adds-foreign-produced-advanced-robotic-devices-and-power-inverters-to-covered-list-opens-conditional-approval-process
- Husqvarna 첫 승인 보도: https://www.prnewswire.com/news-releases/husqvarna-group-first-to-receive-fcc-conditional-approval-for-foreign-manufactured-advanced-robotic-lawn-mowers-in-the-us-302876464.html
- 프로브 워크플로 실행: https://github.com/lmy810209/ohmlot-collector/actions/runs/35885072929 (아티팩트 `probe-fcc-api`, 3일 보관)

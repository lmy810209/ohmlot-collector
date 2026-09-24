# FCC 공식 API 조사 노트 (1단계) — 2026-09-24

조사 범위: KDB 953436 `getFCCIDList`, grantee code 검색, 승인일 확보, Covered List 조건부 승인 목록.
원칙대로 우회 도구·프록시는 쓰지 않았다. 아래 "실제 호출"은 이 컴퓨터(서울, SK브로드밴드), GitHub Actions
ubuntu-latest 러너(미국), Claude WebFetch 세 곳에서 한 것이다.

§1~§6은 첫 조사(커밋 d30d059), **§7은 같은 날 2차 조사에서 추가·정정한 내용**이다. §5·§6에서 §7로 바뀐 부분은 "→ §7"로 표시했다.

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
(기존 `parseGranteePage`와 같은 규칙 — 2단계의 `parseFccIdList`가 이 규칙을 그대로 구현).

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
  **DA 26-996 (2026-09-18)** (→ §7; 첫 조사 시점의 최신은 DA 26-957, 2026-09-09):
  https://docs.fcc.gov/public/attachments/DA-26-996A1.pdf, https://docs.fcc.gov/public/attachments/DA-26-957A1.pdf (같은 URL `.txt`도 있음).
  같은 표가 https://www.fcc.gov/supplychain/coveredlist 에도 게시된다(아카이브: web.archive.org/web/20260919071351/…).
- **형식**: PDF/TXT 표(공지) 또는 HTML 표(웹페이지). 열: `UAS | Dates | Routers | Dates | Robotic Devices | Dates`.
  기계 판독용 JSON/CSV는 없다. 웹페이지 HTML을 아카이브에서 읽으면 로봇 행이 "Husqvarna AB 305v IQ, … September 9, 2026 –
  ANSCER Robotics AR250, AR650, and AR1250 robotic platforms September 18, 2026 –" 형태의 셀 텍스트로 나온다.
  `.txt`에서 로봇 행 원문:

  ```
  Robotic Devices Conditional ApprovalsDates of Conditional Approval
  … Husqvarna AB 305v IQ, 310v IQ, 420v IQ, and 440v IQ robotic platformsSeptember 9, 2026 – …
  ```

- **로봇 분야 조건부 승인 (2026-09-18 기준 2건, 공지 원문으로 확인)**:
  1. Husqvarna AB 305v IQ / 310v IQ / 420v IQ / 440v IQ robotic platforms (로봇 잔디깎이) — 2026-09-09부터, 종료일 없음 (DA 26-957)
  2. ANSCER Robotics AR250 / AR650 / AR1250 robotic platforms (자율이동로봇) — 2026-09-18부터, 종료일 없음
     (첫 조사 때는 웹페이지에만 있었고 → §7: 같은 날 공지 **DA 26-996**으로 발표됨)

  우리 30종 중 해당 없음. 8월 중순까지는 0건이었다(botinfo.ai, 2026-08-13 재확인). FAQ 원문: "Devices granted Conditional
  Approvals are listed at the FCC's website here" (링크 = coveredlist 페이지).
- **갱신 순서**: DoW 결정 → coveredlist 웹페이지 표 갱신(즉시) → PSHSB 공지 부록 A/B(주기적, 예: DA 26-351 4/14, DA 26-957 9/9, DA 26-996 9/18).
  자동 추적은 (1) 웹페이지가 막혀 있으므로 인터넷 아카이브 최신 스냅샷을 읽거나, (2) docs.fcc.gov의 최신 공지 `.txt`를
  읽는 두 경로가 있고, (2)는 최신 공지 번호를 알아야 한다.
- **Covered List 문구** (2026-07-28 추가): "Foreign-produced advanced robotic devices, except advanced robotic devices
  which have been granted a Conditional Approval by DoW." → 조건부 승인은 Covered List 항목의 예외로 반영되고, 표에
  회사·모델·기간이 적힌다.
- **절차** (Annex A, 2026-07-27; Morgan Lewis 정리, → §7에 원문): 국방부(DoW)가 결정, 신청은 machine-readable PDF를
  conditional-approvals@fcc.gov 로, 마감 2028-01-01. 기업 구조·공급망·미국 제조 계획 제출. 승인은 재량이며 신청이
  제한을 유예하지 않는다.
- **기존 승인 모델**: 2026-07-28 이전에 equipment authorization을 받은 모델은 계속 수입·판매·사용 가능(DA 26-786,
  팩트시트 DOC-423682). 승인 신청이 계류 중이던 모델은 "이전 승인"으로 보지 않는다(Annex A 취지, Morgan Lewis).
  OET 유예(DA 26-789, 2026-07-28): 기존 승인 로봇의 소프트웨어·펌웨어 permissive change는 최소 2029-01-01까지 허용.
- **정의** (National Security Determination, Morgan Lewis 요약 → §7에 원문): 지상 이동·장애물 회피·항법 가능, 환경 센서,
  ≥200 kbps 연결, 자율/원격 소프트웨어, **본체+독 합산 4.4 lb 초과**. 제외: 차량, 드론, 수중, FDA 의료, 고정 산업용 로봇.

## 6. 2단계 판단에 필요한 사실 요약

- API 사양은 확실하고 키·제한이 없지만, **우리가 쓸 수 있는 어떤 출발지에서도 apps.fcc.gov가 열리지 않는다.**
  선택지: (a) 미국 가정용 회선 등 허용 IP를 찾아 거기서 실행(미검증), (b) FCC Lab Help(www.fcc.gov/labhelp)에 API
  접근 차단 문의, (c) EAS 수집은 보류하고 시드 `fcc_ids`를 수동 검증으로 유지.
  → §7: 2단계는 공식 API 호출로 교체해 두고(차단이면 로그만 남기고 파일을 쓰지 않음), 러너에서의 성공 여부는 Actions 실행으로 판단.
- **Covered List·조건부 승인은 docs.fcc.gov `.txt`로 자동 추적 가능**(어디서나 200). 최신 공지 번호를 찾는 EDOCS API가
  504라, 당장은 공지 번호를 수동 갱신하거나 EDOCS 재시도 로직이 필요하다.
- `us_status.covered_list`는 승인일(`grantDate`) < 2026-07-28 이면 `before`, 이후면 `after`, 승인 없음/미확인이면 `unknown`
  으로 만들 수 있다. `conditional_approval`은 부록 B 대조 결과(→ §7: 목록을 공지 원문으로 검증했으므로 우리 모델은 `false`로 기록).

## 7. 2차 조사 (2026-09-24, 같은 날 후반) — 추가 확인·정정

이 컴퓨터(서울)에서 curl·WebFetch·헤드리스 Chrome(별도 프로필, 지시대로 "브라우저로 직접")으로 다시 열었다. 차단은 §2와 같았다.

### 7.1 KDB 953436 페이지 (헤드리스 Chrome으로도 200)
- 제목 "953436 EAS Web API Services", Publication Date 2026-03-30, 첨부 "953436 OET Laboratory Services API v04"
  (`/kdb/GetAttachment.html?id=a2TAM%2Fce88o0NtvDeTzB%2Bg%3D%3D&…&tracking_number=50070`). 첨부는 여전히 403.
- 페이지 원문: "The getFCCIDList API allows an FCCID or partial FCCID to be entered and returns all approved FCCIDs that match the search criteria."
- 서울에서 `getFCCIDList?fccId=2A5PE` / `2A5PE-YUSHU008` / `2BKMI` 재호출: 0.07초 만에 403 (엣지 차단, §2와 동일).

### 7.2 "advanced robotic device" 정의 원문 — 확인 (DA 26-786 Appendix C를 tesseract OCR로 읽음; FAQ 아카이브 원문과 일치)
> **Advanced Robotic Devices**: For the purpose of this determination, the term "advanced robotic devices" means:
> (A) A mechanical mobile device, including autonomous mobile robots, humanoid robots, and quadrupeds, that —
> i. Is capable of locomotion, obstacle avoidance, navigation, or movement on the ground;
> ii. Operates at a distance from a human operator or supervisor based on commands or in response to sensor data or any combination thereof; and
> iii. The combined weight of the device and, if applicable, ground station or docking station is over **4.4 lbs**; and
> iv. Contains a component falling within each of the below subparagraphs: i. a sensor capable of perceiving its environment; ii. a component that is capable of providing network connectivity (wired or wireless, including Bluetooth/WiFi, cellular, or satellite) with connection speeds of at least **200 kbps** in either direction; and iii. software running either locally or remotely, including firmware and AI or machine-learning model weights, that controls the robot's autonomous navigation or movement perception, data collection, or remote command-and-control; and
> (B) Does not include: i. a "connected vehicle" (15 CFR § 791.301) of any gross weight; ii. a vehicle operated only on a rail line; iii. an "uncrewed aircraft"/"uncrewed aircraft system" (47 CFR § 88.5); iv. an unmanned underwater vehicle; v. FDA-regulated devices (21 U.S.C. § 360c) including surgical instruments and ambulatory/mobility assistive devices; vi. a fixed, stationary, non-mobile robot (articulating, parallel/delta, Cartesian/gantry, SCARA) intended for industrial or medical use.
>
> **Foreign-Produced**: any article that would not qualify as a "domestic end product" as defined in 48 CFR § 25.101(a).

- 카탈로그 적용: 휴머노이드·사족보행·AMR은 (A)에 그대로 해당. 4.4 lb(≈2 kg) 이하 데스크톱 로봇이나 고정형 암은 정의 밖일 수 있다 —
  사이트는 정의 판단을 하지 않고 grant 날짜만으로 before/after를 표시한다.

### 7.3 DA 26-996 (2026-09-18) — ANSCER 조건부 승인, 공지 원문으로 확인
- https://docs.fcc.gov/public/attachments/DA-26-996A1.pdf (9쪽). "DoW has reviewed submissions and granted Conditional Approvals for the following devices:
  • ANSCER Robotics' AR250, AR650, and AR1250 robotic platforms"
- 조건 원문: "subject to ANSCER's continuous compliance with the onshoring plan outlined in its conditional approval application and pursuant to updated vetting of its products."
- 각주 7: "failure to comply with the onshoring plan or the discovery of a false statement or misrepresentation … could result in termination of the conditional approval and return to the FCC's Covered List. … for the Robotic Devices Conditional Approvals that do not reflect termination dates, such Conditional Approvals will remain effective indefinitely, so long as the entity … abides by the onshoring plan …"
- Appendix B(2026-09-18 갱신) 로봇 열: Husqvarna AB 305v IQ, 310v IQ, 420v IQ, and 440v IQ robotic platforms — September 9, 2026 –; ANSCER Robotics AR250, AR650, and AR1250 robotic platforms — September 18, 2026 –. **이 둘뿐.**
- 코드 반영: `src/lib/parse.ts`의 `CONDITIONAL_APPROVALS`에 이 목록을 그대로 두고, 제조사·모델명이 일치하는 모델만 `conditional_approval: true`.
  우리 30종은 모두 불일치 → **`false`** (목록을 검증했으므로 `null`이 아니라 `false`). 노트 필드에 "Not on the FCC's Robotic Devices
  Conditional Approvals list as of 2026-09-18 (DA 26-996, Appendix B)."를 적었다. 새 공지가 나오면 이 상수와 `verified` 날짜를 갱신한다.

### 7.4 Annex A 원문 — 확인 (web.archive.org 2026-09-20 보관본을 curl로 수신, 2쪽)
- 제목: "Annex A: Guidance on Submissions for Conditional Approval for Foreign-Produced Advanced Robotic Devices Subject to the FCC's Covered List", July 27, 2026.
- "To be considered for Conditional Approval from DoW, advanced robotic device producers must submit the information requested in this document in a machine-readable PDF. … Submission does not guarantee approval. … All decisions are final and can only be adjusted at the discretion of DoW."
- "Submissions must include a certification by an authorized corporate officer … Applicants must submit Conditional Approval applications by **January 1, 2028**."
- 요구 정보: 1. Corporate Structure (법적 명칭·관할, 지배구조, 5% 이상 실소유주, 이사·임원의 국적·거주국, 외국 정부 소유·통제·자금·지원);
  2. Manufacturing and Supply Chain Disclosure (BOM, 부품·설계 원산지, IP·SW 업데이트 책임 주체, 미국 미생산 사유, 제조·최종조립·시험 위치, 온보드 SW/FW 원산지, 국가별 공급망 집중도(가치·물량 %), 단일 실패점·단독 공급자·대체 계획);
  3. U.S. Manufacturing and Onshoring Plan (기한 있는 미국 제조 계획, 담당 창구 + **분기별** 진행 보고, 현재 미국 조립 비중·인원·시설, 1–5년 투자 계획: 추가 고용 인원·공장 면적(sq ft)·투자액, 기존 승인의 진행 현황).
- 접수처: Conditional-approvals@fcc.gov. 문의: Chris Smeenk (chris.smeenk@fcc.gov).

### 7.5 FAQ 원문 — 확인 (web.archive.org 2026-08-31 보관본을 curl로 수신)
- "New models of devices on the Covered List are prohibited from receiving FCC authorization and are therefore prohibited from being imported or sold in the United States. Being added to the Covered List today **does not** prohibit the import, sale, or use of any existing device models the FCC previously authorized."
- "The Covered List does not restrict the continued use by consumers of previously-purchased devices." / 연방정부 대상 수입·판매는 해당 없음.
- 조건부 승인은 **클래스(회사 단위) 신청 가능**: "the National Security Determinations permit applications for Conditional Approval to cover classes of foreign-produced advanced robotic devices and power inverters."
- "foreign-produced" 판단은 생산 기업의 국적과 무관("country neutral"); 기준은 미국 내 제조 + 국내 부품 비용 **65% 초과(2024–2028 인도분), 2029년부터 75%**. Buy American의 COTS 예외는 적용되지 않음.
- 개발·시험 목적의 소량 수입은 47 CFR § 2.1204(a)(3)에 따라 가능(원문 일부만 확보).
- 정의 문단은 §7.2 OCR과 글자 단위로 일치(오탈자 제외).

### 7.6 교체한 수집기의 첫 러너 실행 — 실패 (2026-09-24, run 35890991314)
- `npm run collect:fcc`(공식 API 호출로 교체한 `src/fcc.ts`)를 Actions → fcc-collect → Run workflow로 실행: 8개 grantee 코드 **전부 `HTTP 403`**
  (`2A5PE, 2AAIC, 2ACUO, 2BKMI, 2BTPT, 2AWR5, 2ATBY, 2BFQD`), "nothing written", exit 1. §2의 프로브 결과와 같다.
- 따라서 주간 스케줄(`0 1 * * 1`)은 켜지 않고 `workflow_dispatch`만 남겼다(fcc.yml 주석에 켜는 법 적어 둠). 러너에서 한 번 성공하면 켠다.
- 로그에 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`가 빈 값으로 찍혔다 — 저장소 시크릿이 등록돼 있지 않은 상태(파일 전용 모드로 동작, 오류 아님).

### 7.7 정정·보완 요약
- §5 항목 2: ANSCER는 웹페이지뿐 아니라 **DA 26-996 공지**로도 발표됨(1차 출처 확보).
- §6: `conditional_approval`은 `null`이 아니라 검증 결과인 `false`로 기록(§7.3).
- 2단계 구현 메모: 응답 원문은 `data/fcc/raw/<날짜>-<코드>.json`(오늘 지시서 기준 경로)에 바이트 그대로 보관, 스키마는 §1의 v02 예시를
  기준으로 파싱하되 배열이 객체로 감싸져 오거나 필드명 대소문자가 달라도 받도록 했다(`parseFccIdList`). 아무 코드도 200을 주지 않으면
  `data/`에 아무것도 쓰지 않고 exit 1.

## 출처

- KDB 953436 페이지: https://apps.fcc.gov/oetcf/kdb/forms/FTSSearchResultPage.cfm?id=50070&switch=P
- DA 26-996 (2026-09-18, ANSCER 조건부 승인 + 부록 A/B): https://docs.fcc.gov/public/attachments/DA-26-996A1.pdf
- DA 26-957 (2026-09-09, Husqvarna 조건부 승인 + 부록 A/B): https://docs.fcc.gov/public/attachments/DA-26-957A1.pdf
- DA 26-786 (2026-07-28, 로봇·인버터 Covered List 추가, Appendix C 정의): https://docs.fcc.gov/public/attachments/DA-26-786A1.pdf
- DA 26-789 (2026-07-28, OET permissive change 유예): https://docs.fcc.gov/public/attachments/DA-26-789A1.pdf
- 팩트시트 DOC-423682: https://docs.fcc.gov/public/attachments/DOC-423682A1.txt
- Annex A (robots-ca.pdf, 아카이브): http://web.archive.org/web/20260920015512/https://www.fcc.gov/sites/default/files/robots-ca.pdf
- FCC FAQ (아카이브): http://web.archive.org/web/20260831130659/https://www.fcc.gov/covered-list-faqs-robots-inverters
- Morgan Lewis 정리: https://www.morganlewis.com/pubs/2026/08/fcc-adds-foreign-produced-advanced-robotic-devices-and-power-inverters-to-covered-list-opens-conditional-approval-process
- Sidley Austin 정리: https://www.sidley.com/en/insights/newsupdates/2026/08/fcc-adds-all-foreign-produced-advanced-robotic-devices-to-the-covered-list
- Husqvarna 첫 승인 보도: https://www.prnewswire.com/news-releases/husqvarna-group-first-to-receive-fcc-conditional-approval-for-foreign-manufactured-advanced-robotic-lawn-mowers-in-the-us-302876464.html
- ANSCER 승인 보도: https://www.robotics247.com/article/anscer-robotics-secures-fcc-conditional-approval-for-three-amrs
- 프로브 워크플로 실행: https://github.com/lmy810209/ohmlot-collector/actions/runs/35885072929 (아티팩트 `probe-fcc-api`, 3일 보관)

## 7. (2단계 §4) Covered List 로봇 항목 — DA-26-786 / DA-26-789 원문 기준

웹페이지(fcc.gov/supplychain/coveredlist)는 우리 환경에서 403이고 아카이브본만 읽히므로, 아래는 docs.fcc.gov의
`DA-26-786A1.txt`·`DA-26-789A1.txt` 원문에서 그대로 옮긴 것이다.

- **항목 문구** (DA-26-786 본문 및 부록 A, 2026-07-28 추가):
  > “Foreign-produced advanced robotic devices, except advanced robotic devices which have been granted a Conditional
  > Approval by DoW.”
  같은 공지에 인버터 항목: “Foreign-produced power inverters, except power inverters which have been granted a
  Conditional Approval by DoW or DHS”.
- **정의의 소재**: 공지는 “We accept the National Security Determinations’ definitions of ‘foreign-produced,’ ‘power
  inverters,’ and ‘advanced robotic devices,’ as provided in the Appendices below.” 라고만 하고, 정의 자체는 **부록 C
  (Advanced Robotic Devices National Security Determination)**에 있다. 부록 C는 `.txt`판에 본문 텍스트가 없고(PDF도
  스캔 이미지로 보임) 그래서 4.4 lb 기준 등 정의 원문은 확보하지 못했다. 정의 요약은 2차 출처(Morgan Lewis)뿐이므로
  사이트에는 정의 세부를 쓰지 않는다.
- **효과** (DA-26-786 “Equipment Authorization Impacts”): §2.903(a)에 따라 Covered List 등재 장비는 equipment
  authorization을 받을 수 없고, §2.911에 따라 모든 신청은 “covered equipment”가 아님을 인증해야 한다. 공지는 기존
  승인 모델의 판매·사용을 금지하지 않는다(팩트시트 동일).
- **조건부 승인 반영 방식** (DA-26-786): “If we receive a further specific determination from DoW or DHS … we will
  further update the Covered List.” → 이후 DA-26-957(9/9), DA-26-996(9/18)이 부록 B에 로봇 승인을 추가.
- **DA-26-789 (OET)**: 2026-07-28 이전에 승인된 “Covered Advanced Robotic Devices”에 대해 §§2.932(b)/2.1043(b)의
  Class I·II permissive change 금지를 소프트웨어·펌웨어 업데이트에 한해 최소 2029-01-01까지 유예. 즉 기존 승인 로봇은
  보안 패치·호환성 업데이트를 계속 받을 수 있다.
- **추가 공지 번호** (docs.fcc.gov 순차 확인, 2026-09-24): DA-26-983·984(9/15, 조건부 승인 관련, 로봇 없음),
  **DA-26-996(9/18, ANSCER Robotics AR250/AR650/AR1250 추가)**. `config/fcc-notices.json`에 996을 추가했다.

## 8. task-fcc-3.md 대응: docs.fcc.gov `.txt`를 버리고 PDF 좌표 기반 파서로 교체 (2026-09-24)

§1(2단계, 커밋 8612fd3)에서 만든 `.txt` 기반 파서는 실사용 데이터로 검증하니 항목 경계가 깨져 있었다
(task-fcc-3.md가 정확히 지적: Askey/Ascento, Verizon/Air VEV 경계 침범, "47건"은 신뢰 불가).
원인은 docs.fcc.gov의 `.txt`가 3열(UAS/Router/Robotic) 표를 컬럼 구분 없이 한 줄 흐름으로 압축하면서,
회사명이 "'s"로 끝나지 않는 셀·같은 회사가 두 번 나오는 셀 경계를 정규식으로는 복원할 수 없게 만든다는 것.

**교체한 방식**: 같은 PDF를 `pdfjs-dist`(Mozilla PDF.js, 순수 JS, 시스템 바이너리 불필요)로 직접 열어
각 텍스트 조각의 실제 좌표(x, y)를 읽는다. 부록 B 헤더 행에서 "Robotic Devices" 열의 x 시작점과
그 옆 "Dates of … Approval" 열의 x 시작점을 매번 헤더 텍스트에서 찾아내므로(하드코딩된 픽셀 값 없음),
**Robotic Devices 열에 속한 텍스트만** 좌표로 골라내고 UAS·Router 열은 애초에 읽지 않는다. 이것으로
task §3의 "분류는 섹션 제목에서, 항목 문자열에서 추측하면 안 된다"가 구조적으로 보장된다 — 애초에
Robotic Devices 열 밖의 텍스트는 로봇 레코드가 될 기회조차 없다.

같은 열 안에서 항목 경계는 "날짜가 그 항목의 **첫 줄**과 같은 행(y좌표)에 인쇄된다"는 실제 표 레이아웃을
이용해 해결했다(Husqvarna AB 305v / September 9, 2026 이 같은 y, ANSCER Robotics / September 18, 2026 도
같은 y — pdfplumber로 원본 PDF 좌표를 직접 찍어 확인). 즉 항목 i의 전체 텍스트는 "그 항목 날짜의 y부터
다음 항목 날짜의 y 직전까지, Robotic 열에 있는 모든 줄"이다. 파이썬 pdfplumber로 먼저 이 모델을 검증한
뒤 (Python 의존성 없이) `pdfjs-dist`로 동일 로직을 `src/lib/pdf.ts`에 구현했다.

**검증 결과** (실제 DA-26-957/DA-26-996 PDF, `npm test`):
- DA-26-957: Husqvarna 1건, 완전한 텍스트("Husqvarna AB 305v IQ, 310v IQ, 420v IQ, and 440v IQ robotic
  platforms"), Askey/Verizon 등 다른 열 텍스트 전혀 섞이지 않음.
- DA-26-996: Husqvarna + ANSCER 2건, 마찬가지로 완전하고 깨끗함. `also_in`으로 두 공지의 Husqvarna가
  1건으로 정확히 합쳐짐.
- DA-26-786(로봇 표 없이 다른 내용의 Appendix B)과 DA-26-789(Appendix B 자체 없음)는 정확히
  `no_appendix`로 구분됨 — "APPENDIX B" 뒤에 "Conditional Approvals" 부제가 오는지까지 확인해서 판정.

**§4 정합성 검사**: `suspiciousReasons()`(src/fcc.ts)가 회사명이 숫자/쉼표로 시작하거나 "routers"/
"Series"/"Gateway" 같은 제품 단어를 포함하거나, 항목에 "'s"가 두 번 나오는 등 병합 흔적을 검사한다.
하나라도 걸리면 그 레코드는 저장하지 않고 경고로 남기며, `src/run.ts`가 경고 발생 시 `fcc-collect`를
실패시킨다(가격 수집은 영향 없음). `npm run fcc:review`로 저장된 레코드 전체를 사람이 읽는 형식으로
출력해 확인할 수 있다.

**§5 모델 대조**: `src/fcc.ts`가 매 실행마다 각 조건부 승인 레코드의 회사명을 `data/models.json`의
`manufacturer`와 대조해 `matched_manufacturer`를 채운다. 웹은 `web/lib/data.ts`의
`conditionalApprovalCheck(model)`로 "공지를 읽어서 확인했고 목록에 없음"(state: `not_on_list`, 날짜 포함)과
"아직 한 번도 확인 안 됨"(state: `not_checked`)을 구분해 상세 페이지의 "Conditional approval" 행에
그대로 반영한다.

원문 PDF는 이제 `.txt` 대신 그대로 `data/fcc/raw/<DA>A1.pdf`에 저장한다(재검증용). `test/fixtures/`의
`.txt` 픽스처는 PDF 픽스처로 교체했다.

## task-fcc-4.md: 세 열을 전부 읽는다

**FCC 부록 B는 3열 표이고 `.txt` 변환은 열 구분을 잃어버린다 → PDF 좌표로 읽어야 한다.** 위 섹션에서
Robotic Devices 한 열에 한정해 증명한 것을 UAS·Routers 두 열까지 그대로 확장했다(`src/lib/pdf.ts`의
`extractApprovals`, `findColumnBounds`). 열 경계는 헤더 단어의 x좌표 자체가 아니라 **이웃한 헤더들의
중간점**으로 잡는다 — "Robotic Devices"/"UAS Conditional"처럼 긴 헤더는 자기 열의 실제 왼쪽 끝과
가깝지만, "Routers"는 짧아서 헤더 글자가 실제 데이터 왼쪽 끝(x≈215)보다 한참 오른쪽(x≈240)에 찍힌다 —
실제 DA-26-957/996 PDF로 확인. 헤더 x를 그대로 오프셋 삼았다면 Routers 열 데이터가 옆 열로 새는 문제를
겪었을 것이다(개발 중 실제로 겪고 고쳤다).

**FCC의 표 분류는 기기의 실제 성격과 다를 수 있다** (실례: Ascento, Inc.의 Ascento Guard — 지상 보안
로봇인데 UAS 표에 실림, DA-26-996 확인). **따라서 "로봇 승인 건수"를 FCC 표 기준으로 세면 안 된다.**
그래서 `ConditionalApproval.fcc_column`은 "FCC가 어느 표에 넣었는가"만 기록하고, 그게 실제로 로봇인지는
판정하지 않는다. 판정은 오직 `data/models.json`의 제조사명 대조(`matchManufacturer`)로만 한다 — 이것도
표 열과 무관하게 세 열 전체에 대해 돈다(`web/lib/data.ts`의 `conditionalApprovalCheck`도 세 열 전체를
본다; 반면 `/fcc` 페이지의 "발견된 로봇 제조사" 목록(`roboticApprovals()`)은 표시 목적상 Robotic Devices
열만 보여준다 — 이건 판정이 아니라 그 열의 내용을 그대로 보여주는 것뿐).

**세 열을 다 읽으며 실제로 잡은 버그 4개** (전부 Robotic Devices 열만 읽을 때는 데이터가 우연히 그
경로를 안 타서 드러나지 않았던 것들):
1. 헤더 검색이 `"Approval"`로 시작하는 텍스트를 찾는데, 날짜 열 헤더("Approval", 단수)와 항목 열
   자체의 부제("Approvals", 복수)를 구분하지 못해 옆 열의 부제를 날짜 헤더로 오인.
2. 날짜 범위가 두 줄로 인쇄될 때("April 14, 2026 –" 다음 줄에 "October 1, 2027") 각 줄을 독립적으로
   정규식 매칭해 마커 2개로 잘못 인식 — Robotic 열 픽스처엔 이런 2줄짜리 범위가 없어서 안 걸렸다.
3. 부록 B 마지막 페이지의 각주("*Consistent with the National Security Determination…") 컷오프
   방향이 반대였다 — 각주 **첫 줄만** 제외하고 이어지는 줄은 안 걸러내서 다음 항목에 그대로 흘러들어갔다
   (Parallel Flight Technologies 항목에 각주 문장이 붙어 320자짜리로 나온 사례로 발견).
4. 각주 텍스트가 폴백 종료 페이지(진짜 각주 위치를 못 찾았을 때의 방어적 추정 페이지)에 없을 때
   기본값이 "전부 자름"이었다 — DA-26-996은 각주가 부록 B 범위 밖(2페이지)에 있어서 폴백 페이지
   전체(Ascento 포함)가 조용히 사라졌었다.
개별 열 파싱 로직 자체(§1-§3 위 섹션)는 이미 맞았다 — 이 네 개는 다열·다페이지로 커버리지가 넓어지며
비로소 실행된 경로에서 나온, 이번에 새로 발견하고 고친 버그다.

**페이지별 열 경계 재탐지(§3)**: 부록 B가 여러 페이지로 이어질 때 헤더 행은 첫 페이지에만 인쇄된다
(DA-26-996으로 확인 — 6~9페이지 중 6페이지만 헤더가 있고 7~9페이지는 없음). 후속 페이지는 직전 페이지의
경계를 물려받고, 그 사실을 `pageNotes`로 남긴다(`src/run.ts`가 `[fcc]` 로그에 출력).

**결과** (2026-09-24, DA-26-957 + DA-26-996 실제 실행): UAS 18건 + Routers 30건 + Robotic Devices 2건 =
**50건**. `data/models.json`의 추적 대상 30종 제조사는 세 열 어디에도 없음(대조 0건 일치) —
"확인했고 목록에 없음"이 이제 세 열 전체를 근거로 한다.

**남은 자잘한 흠**: DA-26-957의 Askey Computer Routers 항목이 같은 날짜(2026-08-14)로 2건(하나는
말줄임, 하나는 완전한 텍스트)으로 갈라져 저장된다 — 페이지 경계 근처 텍스트 병합의 잔여 아티팩트로
보이며, 다른 회사 텍스트가 섞이는 건 아니라서(§4 정합성 검사도 통과) 추적 대상 로봇 판정에는 영향이
없다. 근본 원인은 조사하지 않았다 — 이번 작업 범위 밖.

# 작업 지시 2단계: 조건부 승인 추적 + us_status 표시

## 1단계 결과에 대한 결정

### 결정 A — EAS(apps.fcc.gov) 자동 수집은 **보류한다**
- 공식 대체 경로 없음을 확인했다. data.gov / opendata.fcc.gov의 FCC 인증 데이터셋은
  시험기관·인증기관 명단뿐이고, 유일한 grantee 데이터셋은 2021-03 이후 갱신 중단.
- apps.fcc.gov는 Akamai IP 차단. **허용 IP를 찾아 우회하지 않는다.** 데이터센터 IP 차단을
  피하려고 가정용 회선으로 우회하는 것은 우리가 안 하기로 한 우회에 해당한다.
- FCC Lab Help 문의도 지금은 하지 않는다 (나중에 필요해지면).
- 대신: `fcc_ids`는 **수동 검증 시드 데이터로 유지**한다. 필드는 지금 만들고 값은 손으로 채운다.
  근거: 모델 30종에 신규 FCC ID는 연 몇 건 수준. 느리게 변하는 데이터를 막힌 경로로
  자동화하는 데 시간을 쓸 단계가 아니다.
- `src/fcc.ts`의 fccid.io 스크래핑은 **제거**한다 (작동하지도 않고 비공식 출처).

### 결정 B — 조건부 승인 추적은 **docs.fcc.gov .txt 파서 + 수동 공지 번호 목록**
- docs.fcc.gov는 어디서나 열리므로 이것이 유일하게 신뢰할 수 있는 자동화 대상이다.
- EDOCS 자동 탐색은 만들지 않는다. 2개월간 조건부 승인이 2건뿐 — 자동 탐색은 시기상조.
- 새 공지 번호는 월 1회 수동 확인해 config에 추가한다.

---

## 실제 작업

### 1. `config/fcc-notices.json` 신규
알려진 PSHSB 공지 번호를 목록으로 관리한다.
```json
[
  { "da": "DA-26-786", "released": "2026-07-28", "note": "Covered List 추가 (로봇·인버터)" },
  { "da": "DA-26-789", "released": "2026-07-28", "note": "조건부 승인 절차 개시" },
  { "da": "DA-26-957", "released": "2026-09-09", "note": "조건부 승인 부록 A·B" }
]
```

### 2. `src/fcc.ts` 재작성
- fccid.io 코드 전부 제거
- 각 공지의 `https://docs.fcc.gov/public/attachments/<DA>A1.txt`를 받아
  `data/fcc/raw/<DA>A1.txt`에 원문 그대로 저장
- 부록(Annex) 표를 파싱해 조건부 승인 레코드 추출:
  회사명, 장비 종류, 모델명, 승인 발효일, 출처 DA 번호
- 결과를 `data/fcc/conditional-approvals.json`에 누적
- 파싱 실패 시 값을 지어내지 말고 해당 공지를 `parse_failed`로 기록하고 넘어간다
- 읽을 수 있는 게 하나도 없으면 파일을 쓰지 말고 exit 1

### 3. 출처 규칙 (중요)
조건부 승인은 **FCC 문서(DA 공지 부록)만을 출처로 삼는다.**
Husqvarna의 PR Newswire 보도자료나 roboticstomorrow 같은 업계 매체는
참고용 링크로만 쓰고, 데이터의 근거로 저장하지 않는다.
우리 사이트의 가치가 "믿을 수 있는 기록"인 이상 2차 출처를 근거로 쓰면 안 된다.

### 4. Covered List 본문 교차 확인
`fcc.gov/supplychain/coveredlist` 웹페이지를 외부에서 읽어보니 로봇 항목이
보이지 않았다. 웹페이지 대신 **DA-26-786A1 / DA-26-789A1 원문**을 기준으로
로봇 카테고리의 정확한 문구와 적용 범위를 확인하고 노트에 남길 것.

### 5. `data/models.json`에 us_status 추가
```json
"us_status": {
  "fcc_id": null,
  "grant_date": null,
  "covered_list": "unknown",
  "conditional_approval": null,
  "conditional_approval_note": null,
  "last_verified": null,
  "source_url": null
}
```
- 이미 확보한 13개 FCC ID는 `last_verified: "2026-09-23"`, 출처 URL과 함께 채운다
- 확인 안 된 17개는 전부 null / "unknown". **추정 금지.**
- `covered_list`: grant_date가 2026-07-28 이전이면 "before", 이후면 "after", 모르면 "unknown"

### 6. `.github/workflows/fcc.yml`
- 매주 월요일 + 수동 실행 (`0 1 * * 1`, workflow_dispatch)
- 가격 수집(daily.yml)은 지금대로 매일 유지

### 7. `/robots/[id]`에 US Regulatory Status 블록
4가지 상태, 각각 FCC 원문 링크 필수:
1. **2026-07-28 이전 승인** — 기존 인증 유효, 미국 내 판매·재판매 가능
2. **조건부 승인** — 조건 내용과 발효일 표시
3. **승인 없음 / 이후 신청** — 미국 신규 판매 불가 가능성
4. **확인 안 됨** — "unknown", 추측하지 말고 그대로 표시

### 8. `/fcc` 페이지에 설명 글 추가
아래 내용을 사람이 읽는 문장으로 쓴다 (사실만, 과장 금지):
- 2026-07-28부터 외국산 첨단 로봇은 미국 신규 기기 인증을 받을 수 없다
- 그 이전에 인증받은 모델은 계속 판매·재판매 가능하다
- 현재까지 조건부 승인은 Husqvarna 잔디깎이와 ANSCER AMR 뿐이며,
  우리가 추적하는 개인용 로봇 30종 중 해당 사례는 없다
- 이 구분이 중고 가치에 어떤 의미인지는 **단정하지 말고**, 사실만 제시한다

### 9. 모델별 "Track this robot" 버튼
이메일 입력 → 지금은 console.log만. Supabase 연결은 TODO 주석.

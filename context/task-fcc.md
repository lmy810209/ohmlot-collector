# 작업 지시: FCC 공식 API 전환 + 미국 판매 가능 여부 표시

## 배경
지금 `src/fcc.ts`는 fccid.io(비공식 미러)를 읽는데 Cloudflare가 막아서 8개 grantee 중 대부분 실패한다.
FCC 공식 API로 바꾸고, 그 결과를 사이트에 "이 로봇을 미국에서 살 수 있는가"로 보여준다.

## 원칙 (반드시 지킬 것)
- 공식 소스로 안 되는 항목은 **억지로 우회하지 않는다.** 로그에 남기고 넘어간다.
- **Cloudflare 우회 도구나 프록시 서비스(Bright Data 등)는 쓰지 않는다.**
- 값을 지어내지 말 것. 모르면 `null`과 `"unknown"`을 쓴다.
- eBay는 링크만 건다. 가격을 저장하거나 시세 계산에 쓰지 않는다 (API 약관 위반).

---

## 1단계 — FCC 공식 API 조사 (먼저 이것만 하고 보고)

조사 대상:
- FCC KDB 953436 `getFCCIDList` — 공식 Equipment Authorization 조회 API
- 요청 형식, 인증키 필요 여부, 응답 필드, 호출 제한
- grantee code(예: Unitree = 2A5PE)로 해당 회사의 FCC ID 목록을 뽑을 수 있는지
- FCC ID별 grant date(승인일)를 얻을 수 있는지
- Covered List 관련: 2026-07-28 이후 조건부 승인(conditional approval)을 받은 로봇 목록이 공개되어 있는지, 있다면 어느 페이지/어느 형식인지

결과를 `context/fcc-api-notes.md`에 정리한다. 형식:
- 엔드포인트 URL과 예시 요청 1개
- 실제로 호출해본 응답 샘플(원문 일부)
- 얻을 수 있는 필드 / 얻을 수 없는 필드
- 막힌 부분이 있으면 무엇이 왜 막혔는지

**여기까지 끝나면 멈추고 결과를 보고할 것.** 2단계부터는 조사 결과에 따라 달라진다.

---

## 2단계 — src/fcc.ts 교체 (1단계 승인 후)
- fccid.io 스크래핑 코드 제거
- 공식 API 호출로 교체
- 원본 응답은 `data/fcc/raw/<날짜>/<granteeCode>.json`에 그대로 저장 (나중에 검증용)
- 파싱 결과는 기존대로 `data/fcc/grants.json`에 누적
- 읽을 수 있는 게 하나도 없으면 파일을 쓰지 말고 exit 1

## 3단계 — 실행 주기 변경
- `.github/workflows/fcc.yml`: 매주 월요일 + 수동 실행 (`0 1 * * 1` 및 workflow_dispatch)
- 가격 수집(daily.yml)은 지금대로 매일 유지

## 4단계 — models.json에 us_status 필드 추가
각 모델에 아래 구조를 넣는다. 모르는 값은 null / "unknown".
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
- `covered_list`: "before" (2026-07-28 이전 승인) / "after" / "unknown"

## 5단계 — 화면 표시
`/robots/[id]` 페이지에 "US Regulatory Status" 블록 추가. 4가지 상태:
1. 2026-07-28 이전 승인 — 기존 인증 유효
2. 이후 조건부 승인 — 조건 내용 함께 표시
3. 승인 없음 — 미국 신규 판매 불가 가능성
4. 확인 안 됨 — `unknown`, 추측 금지

각 상태 아래에 FCC 원문 링크를 반드시 붙인다.
홈의 FCC 카드와 `/fcc` 필터도 이 필드를 쓰도록 수정.

## 6단계 — 모델별 "Track this robot" 버튼
이메일 입력 → 지금은 console.log만. Supabase 연결은 TODO 주석으로 남긴다.

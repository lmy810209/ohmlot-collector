# ohmlot-collector


**Ohmlot** (ohmlot.com) — the original marketplace for personal robots. 이 저장소는 그 데이터 기반을 매일 쌓습니다.
개인 로봇(휴머노이드·로봇개·데스크톱 로봇)의 **제조사 판매가**와 **FCC 인증 기록**을 매일 자동으로 모으는 수집기입니다.
결과는 이 저장소의 `data/`에 매일 커밋되므로, Git 이력 자체가 "2026년부터 모았다"는 날짜 증거가 됩니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `data/models.json` / `.csv` | 시드 모델 30종 (CC BY 출처는 `data/SOURCES.md`) |
| `config/price-sources.json` | 가격 수집 대상 (Shopify `.js`/`.json` 상품 엔드포인트, 1X는 HTML 정규식) |
| `config/fcc-grantees.json` | FCC grantee 코드 (Unitree = 2A5PE 등) |
| `src/prices.ts` | 가격 수집 → `data/prices/YYYY-MM-DD.jsonl` |
| `src/fcc.ts` | FCC 인증 수집 → `data/fcc/grants.json` (누적), 새 인증은 `data/fcc/new-grants.log` |
| `supabase/schema.sql` | Supabase 테이블 (models, price_snapshots, fcc_grants, latest_prices 뷰) |
| `.github/workflows/daily.yml` | 매일 00:17 UTC(09:17 KST) 실행 후 `data/` 커밋 |

## 시작하기 (15분)

1. GitHub에 **비공개** 저장소를 만들고 이 폴더를 올립니다. (현재: `lmy810209/ohmlot-collector`. `ohmlot` 조직을 만든 뒤 Settings → Danger Zone → Transfer 로 옮기면 Actions·이력이 그대로 따라갑니다.)
   ```bash
   git init && git add . && git commit -m "init" && git branch -M main
   git remote add origin https://github.com/<you>/ohmlot-collector.git && git push -u origin main
   ```
2. 로컬에서 한 번 실행해 실제 사이트가 응답하는지 확인합니다.
   ```bash
   npm install
   npm test
   npm run collect      # data/prices, data/fcc 에 결과 생성. 실패는 data/logs 에 기록
   ```
3. (선택) Supabase 연결
   - SQL Editor에서 `supabase/schema.sql` 실행
   - `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx src/seed-models.ts`
   - GitHub 저장소 Settings → Secrets → Actions 에 같은 두 값을 등록
   - Supabase 없이도 파일(`data/`)로만 동작합니다.
4. GitHub → Actions → `daily-collect` → **Run workflow** 로 첫 실행. 이후 매일 자동.

## 첫 실행 때 확인할 것

- `data/logs/<날짜>.log` 에 실패한 URL이 있으면 `config/price-sources.json`의 주소를 고칩니다 (상품 handle이 바뀌었을 수 있음).
- Shopify `.js` 주소가 `got HTML instead of JSON`으로 실패하면 스토어가 `.js`를 마케팅 사이트로 301시키는 경우입니다 (KEYi가 그랬음). 같은 handle의 `.json` 주소로 바꾸면 되고, 파서는 두 형식을 모두 처리합니다.
- Shopify 스토어는 요청 지역에 따라 통화와 재고가 달라질 수 있습니다 (Pollen은 미국 밖에서 EUR 가격을 내려줌). 수집기는 `?country=US`로 미국 시장을 고정하므로 로컬에서 돌려도 GitHub 러너와 같은 USD 값이 나옵니다. 로컬과 러너 값이 다르면 이 부분을 먼저 의심하세요.
- `HTTP 403 (cloudflare challenge)`는 봇 차단입니다. 재시도해도 소용없고 우회하지 않습니다. RobotShop은 모든 요청에 챌린지를 걸어 소스에서 뺐습니다.
- FCC는 비공식 미러 `fccid.io`를 읽습니다. **2026-09-22 기준 자동 수집이 막혀 있습니다.** `fccid.io`·`fcc.report`는 Cloudflare 봇 챌린지(`HTTP 403 (cloudflare challenge)`), 공식 EAS(`apps.fcc.gov`)는 Akamai `Access Denied`를 돌려주며, 한국 가정용 IP와 GitHub Actions 미국 러너 양쪽에서 같았습니다. 봇 차단은 우회하지 않으므로 `data/logs`에 매일 `[fcc] ... 403`이 남고, 가격 수집과 `data/` 커밋은 그대로 진행됩니다. 접근 가능한 소스가 생기거나 페이지 구조가 달라 `0 grants parsed`가 나오면 `parseGranteePage`를 실제 HTML에 맞춰 조정하세요. 새 FCC ID는 공개 전에 FCC 공식 EAS(apps.fcc.gov)에서 교차 확인하세요.
- `flags: ["placeholder_price"]`는 Unitree가 "문의" 상품에 넣는 $90,000/$100,000 임시 가격입니다. 시세 계산에서 빼세요.

## 지키는 규칙

- 소스당 하루 1회, 요청 간격 1.5~3초, 식별 가능한 User-Agent.
- eBay 데이터는 수집하지 않습니다 (API 약관상 시세 계산·타 데이터와 혼합 금지).
- 월말마다 `data/`를 Zenodo에 올려 DOI를 받으면 발행일이 찍힌 공개 기록이 됩니다.

## 알려진 공백

- FCC 인증 자동 수집: 위 사유로 현재 0건 (`data/fcc/grants.json` 비어 있음)
- FCC ID 미확인 19개 모델 (Booster, EngineAI, Fourier, Reachy, Petoi 등), 1X·Booster·Petoi·Pollen의 grantee 코드
- R1(2A5PE-YUSHU010), H2(YUSHU012), AgiBot X2(2BTPT-LX2501)는 2차 출처 기준 — 원본 확인 필요
- `unitree-h1` 가격(90,000)과 `unitree-h2` 최고가(100,000)는 임시 가격일 가능성
- RobotShop(리셀러) 가격은 Cloudflare 차단으로 수집하지 않음. 리셀러가는 현재 Deep Robotics US만 포함
- KEYi(Loona)는 `.json` 엔드포인트에 재고 필드가 없어 `available`이 항상 `null`

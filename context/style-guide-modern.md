# Ohmlot 스타일 가이드 — Modern (확정 2026-09-23)

밝은 회백색 바탕 + 청록 단일 악센트. 2026년 가격·마켓 데이터 사이트의 기본형.
시안: Ohmlot Modern 아티팩트. 이 문서가 web/ 전체의 기준이다.

## 1. 색 토큰

`web/app/globals.css`에 그대로 넣는다. 컴포넌트에서는 항상 토큰만 쓰고 하드코딩 금지.

```css
:root {
  color-scheme: light;
  --bg: #f5f6f7;          /* 페이지 바탕 (순백 금지) */
  --card: #ffffff;
  --sunk: #eef0f2;        /* 세그먼트/호버 바닥 */
  --line: #e2e5e9;
  --line-soft: #edeff2;
  --ink: #0b0d10;
  --ink-2: #545c66;
  --ink-3: #8a929c;
  --accent: #0a7c96;      /* 청록, 단 하나의 브랜드색 */
  --accent-soft: #e2f4f8;
  --accent-ink: #065062;
  --up: #0e7a55;  --up-soft: #e3f5ec;   /* 가격 상승 */
  --down: #b02a37;                       /* 가격 하락·경고 */
  --amber: #a2650a; --amber-soft: #fbf0dd; /* 예약·주의 */
  --shadow: 0 1px 2px rgba(11,13,16,.05), 0 8px 24px -12px rgba(11,13,16,.14);
  --r: 14px;      /* 카드 */
  --r-sm: 8px;    /* 입력·버튼 */
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg:#0c0e11; --card:#14171b; --sunk:#191d22; --line:#262b31; --line-soft:#1e2227;
    --ink:#eef1f4; --ink-2:#a3acb6; --ink-3:#79828d;
    --accent:#40cfe6; --accent-soft:#10303a; --accent-ink:#9fe6f3;
    --up:#3ddc97; --up-soft:#0f2d23; --down:#ff6b7a; --amber:#e3ae5a; --amber-soft:#2e2313;
    --shadow: 0 1px 2px rgba(0,0,0,.4), 0 10px 30px -14px rgba(0,0,0,.7);
  }
}
:root[data-theme="dark"] { /* 위 다크 값 동일하게 반복 — 토글이 이기도록 */ }
```

## 2. 서체

- 본문·제목: **Schibsted Grotesk** (400/500/600/800)
- 숫자·라벨·코드: **IBM Plex Mono** (400/500/600)
- **Inter, Geist, Space Grotesk, Poppins 금지.** 2026년 기준 "AI가 만든 사이트" 신호로 읽힌다.
- `body { font-variant-numeric: tabular-nums }` 필수. 가격이 세로로 정렬돼야 한다.
- 제목 `letter-spacing: -.035em`, `text-wrap: balance`. 본문 `text-wrap: pretty`.
- 크기: h1 `clamp(36px,5.4vw,58px)/800`, h2 20~24px/700, 본문 15px, 표 안 14px, 마이크로 라벨 10.5px 대문자 `letter-spacing:.1em`.

## 3. 컴포넌트 규칙

| 요소 | 규칙 |
|---|---|
| 카드 | `--card` 배경, 1px `--line` 테두리, `--r`, `--shadow`. 그라데이션은 강조 카드 하나만 (`accent-soft` → `card`) |
| 버튼 | 주요 버튼만 `--accent` 채움. 나머지는 테두리형 |
| 내비 | 알약형 탭. 활성 탭만 흰 배경 + 그림자 |
| 배지 | 상태는 알약(Shipping=up, Pre-order=amber), 추적 중은 `accent-soft` + 모노 |
| 표 | 얼룩말 무늬 금지. 행 구분은 `--line-soft` 1px, 호버 시 `--sunk` |
| 가격 | 모노 500, 오른쪽 정렬. 변형 가격은 아래 작은 회색 줄 |
| 변동 | ▲/▼ + 금액 또는 %, 색은 up/down 토큰만 |
| 포커스 | `outline: 2px solid var(--accent); outline-offset: 2px` |

## 4. 홈 화면 순서 (확정)

1. 헤더: 로고 + live 점 + 알약 내비
2. 히어로: 제목 + 검색창 + 빠른 검색 칩 / 오른쪽에 "Today's run" 카드
3. 카드 3개: 오늘 변동 · 추적 대수 · 기준선 수집 일차
4. 표: 전체 로봇 (필터 + 정렬)
5. FCC 섹션: 설명 카드 + 숫자 3개
6. 알림 신청 CTA
7. 푸터: 출처·방법론·비제휴 고지

## 5. 하지 말 것 (트렌드 조사 결과)

- 보라·인디고 그라데이션 (가장 흔한 AI 티)
- 아이콘 3개짜리 균일한 3열 카드
- 모든 요소에 같은 radius·padding
- 이모지를 아이콘 대신 쓰기
- 가짜 후기, 가짜 로고 월, 스톡 사진
- 데이터가 2일치인데 그럴듯한 차트를 그리기
- 의미 없는 hover, 스크롤 하이재킹, 전체 페이드인

## 6. 데이터가 적을 때의 표시 규칙

- 이력 2일: 차트 대신 "어제 → 오늘" 델타 숫자만
- 최저가 배지는 **14일 이후** 활성화. 그전에는 "Day N of baseline" 표시
- 추적하지 않는 모델은 `not tracked`로 명시. 빈칸 금지
- 모든 화면에 마지막 수집 시각 노출

## 7. 접근성

- 본문 대비 4.5:1 이상. 악센트는 텍스트보다 테두리·배지 용도로
- `prefers-reduced-motion` 존중. 모션은 상태 변화 전달용 150~200ms만
- 표 정렬 헤더에 `aria-sort`, 터치 목표 40px 이상

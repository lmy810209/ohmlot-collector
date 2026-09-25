import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeBlockSignal, TIER_A_MODEL_IDS } from "../src/intraday.ts";
import { compareFrequency, type IntradaySnapshot } from "../src/intraday-compare.ts";
import type { PriceRow } from "../src/lib/parse.ts";

test("TIER_A_MODEL_IDS: exactly 3 (task-measure.md §B: never expand past 3)", () => {
  assert.equal(TIER_A_MODEL_IDS.size, 3);
  assert.deepEqual([...TIER_A_MODEL_IDS].sort(), ["deep-robotics-lite3", "keyi-loona", "unitree-h2"]);
});

test("looksLikeBlockSignal: HTTP 429 and cloudflare mitigation both trip it", () => {
  assert.equal(looksLikeBlockSignal("HTTP 429 https://example.com/x"), true);
  assert.equal(looksLikeBlockSignal("HTTP 403 (cloudflare challenge) https://example.com/x"), true);
  assert.equal(looksLikeBlockSignal("HTTP 403 (cloudflare managed_challenge) https://example.com/x"), true);
});

test("looksLikeBlockSignal: an ordinary parse/network error does not trip it", () => {
  assert.equal(looksLikeBlockSignal("no prices parsed"), false);
  assert.equal(looksLikeBlockSignal("HTTP 404 https://example.com/x"), false);
  assert.equal(looksLikeBlockSignal("got HTML instead of JSON (redirect or bot challenge)"), false);
});

// A minimal, fully-populated row — mirrors test/events.test.ts's factory so generateEvents' expectations
// (config_hash present, etc.) are satisfied without pulling in real collector output.
function row(overrides: Partial<PriceRow>): PriceRow {
  return {
    date: "2026-09-25",
    observed_at: "2026-09-25T00:17:00.000Z",
    model_id: "keyi-loona",
    seller: "keyi-official",
    variant: "Premium",
    variant_sku: null,
    variant_id: 1,
    price_usd: 429,
    compare_at_price_usd: 529,
    on_sale: true,
    available: true,
    availability_status: "in_stock",
    availability_evidence: "variants[0].available=true",
    lead_time_text: null,
    lead_time_days: null,
    purchase_mode: "direct",
    market: "US",
    url: "https://us.keyirobot.com/products/petbot",
    flags: [],
    config_hash: "hash-a",
    ...overrides,
  };
}

test("compareFrequency: fewer than 2 snapshots reports nothing (never fabricates a rate)", () => {
  const r0 = compareFrequency([]);
  assert.equal(r0.missedPct, null);
  assert.match(r0.note ?? "", /Fewer than 2/);

  const r1 = compareFrequency([{ date: "2026-09-25", hhmm: "0017", rows: [row({})] }]);
  assert.equal(r1.missedPct, null);
});

test("compareFrequency: an intraday-only change (missed by a once-a-day-only observer) is counted as missed", () => {
  // Day 1: two snapshots, price changes mid-day and changes BACK before the next day's 00:17 snapshot —
  // a once-a-day observer comparing only the 00:17 snapshots would see no change at all.
  const all: IntradaySnapshot[] = [
    { date: "2026-09-25", hhmm: "0017", rows: [row({ price_usd: 429 })] },
    { date: "2026-09-25", hhmm: "0647", rows: [row({ price_usd: 409 })] }, // real change, only visible intraday
    { date: "2026-09-25", hhmm: "1247", rows: [row({ price_usd: 429 })] }, // changes back
    { date: "2026-09-26", hhmm: "0017", rows: [row({ price_usd: 429 })] }, // same as the prior day's 00:17 snapshot
  ];
  const r = compareFrequency(all);
  assert.equal(r.allEvents, 2); // 429->409, then 409->429
  assert.equal(r.dailyOnlyEvents, 0); // 00:17 on both days is 429 -> 429, no visible change
  assert.equal(r.missedCount, 2);
  assert.equal(r.missedPct, 100);
});

test("compareFrequency: a change that persists to the next day's 00:17 snapshot is caught by daily-only too — not counted as missed", () => {
  const all: IntradaySnapshot[] = [
    { date: "2026-09-25", hhmm: "0017", rows: [row({ price_usd: 429 })] },
    { date: "2026-09-25", hhmm: "0647", rows: [row({ price_usd: 409 })] },
    { date: "2026-09-26", hhmm: "0017", rows: [row({ price_usd: 409 })] }, // change persisted
  ];
  const r = compareFrequency(all);
  assert.equal(r.allEvents, 1);
  assert.equal(r.dailyOnlyEvents, 1); // 00:17 429 -> 00:17 409, still visible daily-only
  assert.equal(r.missedCount, 0);
  assert.equal(r.missedPct, 0);
});

test("compareFrequency: 'daily-only' picks the snapshot nearest 00:17 UTC per day, not just the first one", () => {
  const all: IntradaySnapshot[] = [
    { date: "2026-09-25", hhmm: "0647", rows: [row({ price_usd: 100 })] }, // further from 00:17
    { date: "2026-09-25", hhmm: "0017", rows: [row({ price_usd: 200 })] }, // nearest 00:17 — this one should be picked
    { date: "2026-09-26", hhmm: "0017", rows: [row({ price_usd: 200 })] },
  ];
  const r = compareFrequency(all);
  // If the nearest-to-00:17 snapshot (200) were picked correctly both days, daily-only sees no change.
  assert.equal(r.dailyOnlyEvents, 0);
});

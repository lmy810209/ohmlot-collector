import { test } from "node:test";
import assert from "node:assert/strict";
import { generateEvents } from "../src/events.ts";
import type { PriceRow } from "../src/lib/parse.ts";

// A minimal, fully-populated row — every test tweaks only the fields it cares about, so a forgotten field
// can never accidentally make two rows "equal" and hide a real diff.
function row(overrides: Partial<PriceRow>): PriceRow {
  return {
    date: "2026-09-24",
    observed_at: "2026-09-24T00:17:00.000Z",
    model_id: "unitree-g1",
    seller: "unitree-official",
    variant: "G1",
    variant_sku: "SKU-1",
    variant_id: 1,
    price_usd: 13500,
    compare_at_price_usd: null,
    on_sale: false,
    available: true,
    availability_status: "in_stock",
    availability_evidence: "variants[0].available=true",
    lead_time_text: null,
    lead_time_days: null,
    purchase_mode: "direct",
    market: "US",
    url: "https://shop.unitree.com/products/unitree-g1",
    flags: [],
    ...overrides,
  };
}

test("no prior snapshot -> no events (nothing to compare against)", () => {
  assert.deepEqual(generateEvents([], [row({})], "2026-09-24", []), []);
});

test("unchanged row -> no events", () => {
  const r = row({});
  assert.deepEqual(generateEvents([r], [r], "2026-09-24", []), []);
});

test("price_changed", () => {
  const prev = [row({ price_usd: 13500 })];
  const curr = [row({ price_usd: 14000 })];
  const events = generateEvents(prev, curr, "2026-09-24", []);
  assert.deepEqual(events, [{ date: "2026-09-24", type: "price_changed", model_id: "unitree-g1", seller: "unitree-official", variant: "G1", from: 13500, to: 14000, source_url: curr[0].url }]);
});

test("availability_changed works even when yesterday's row predates the new schema (task-events.md §5: from 9/22)", () => {
  // Simulates an actual 9/23 row: no availability_status field at all, only the old `available` bool.
  const prev = [{ ...row({}), available: true, availability_status: undefined } as unknown as PriceRow];
  const curr = [row({ available: false, availability_status: "out_of_stock" })];
  const events = generateEvents(prev, curr, "2026-09-24", []);
  assert.deepEqual(events, [{ date: "2026-09-24", type: "availability_changed", model_id: "unitree-g1", seller: "unitree-official", variant: "G1", from: "in_stock", to: "out_of_stock", source_url: curr[0].url }]);
});

test("no availability_changed noise when only the schema changed but the real state didn't", () => {
  const prev = [{ ...row({}), availability_status: undefined } as unknown as PriceRow]; // old shape, still in_stock
  const curr = [row({})]; // new shape, still in_stock
  assert.deepEqual(generateEvents(prev, curr, "2026-09-24", []), []);
});

test("discount_started then discount_ended", () => {
  const notOnSale = row({ compare_at_price_usd: null, on_sale: false });
  const onSale = row({ compare_at_price_usd: 529, on_sale: true });
  assert.deepEqual(generateEvents([notOnSale], [onSale], "2026-09-24", []), [
    { date: "2026-09-24", type: "discount_started", model_id: "unitree-g1", seller: "unitree-official", variant: "G1", from: null, to: 529, source_url: onSale.url },
  ]);
  assert.deepEqual(generateEvents([onSale], [notOnSale], "2026-09-24", []), [
    { date: "2026-09-24", type: "discount_ended", model_id: "unitree-g1", seller: "unitree-official", variant: "G1", from: 529, to: null, source_url: onSale.url },
  ]);
});

test("no discount event when either side predates on_sale (avoids a false 'discount' on the schema-change day itself)", () => {
  const prev = [{ ...row({}), on_sale: undefined } as unknown as PriceRow];
  const curr = [row({ compare_at_price_usd: 529, on_sale: true })];
  assert.deepEqual(generateEvents(prev, curr, "2026-09-24", []), []);
});

test("lead_time_changed", () => {
  const prev = [row({ lead_time_text: "up to 90 days after purchase (many orders ship sooner)." })];
  const curr = [row({ lead_time_text: "up to 60 days after purchase (many orders ship sooner)." })];
  const events = generateEvents(prev, curr, "2026-09-24", []);
  assert.deepEqual(events, [
    { date: "2026-09-24", type: "lead_time_changed", model_id: "unitree-g1", seller: "unitree-official", variant: "G1", from: prev[0].lead_time_text, to: curr[0].lead_time_text, source_url: curr[0].url },
  ]);
});

test("variant_added and variant_removed, keyed by variant_id within one product (seller+url)", () => {
  const prev = [row({ variant: "G1", variant_id: 1 }), row({ variant: "G1 Pro", variant_id: 2 })];
  const curr = [row({ variant: "G1", variant_id: 1 }), row({ variant: "G1 EDU", variant_id: 3 })]; // 2 removed, 3 added
  const events = generateEvents(prev, curr, "2026-09-24", []).sort((a, b) => a.type.localeCompare(b.type));
  assert.deepEqual(events, [
    { date: "2026-09-24", type: "variant_added", model_id: "unitree-g1", seller: "unitree-official", variant: "G1 EDU", from: null, to: 3, source_url: curr[1].url },
    { date: "2026-09-24", type: "variant_removed", model_id: "unitree-g1", seller: "unitree-official", variant: "G1 Pro", from: 2, to: null, source_url: prev[1].url },
  ]);
});

test("no variant_added/removed when either day's rows for that product lack a variant_id (schema-boundary guard)", () => {
  const prev = [{ ...row({ variant_id: 1 }), variant_id: null } as unknown as PriceRow];
  const curr = [row({ variant_id: 1 }), row({ variant: "G1 Pro", variant_id: 2 })];
  assert.deepEqual(generateEvents(prev, curr, "2026-09-24", []), []);
});

test("product_unpublished fires on a real HTTP 404 for that URL, not on a generic fetch error", () => {
  const prev = [row({})];
  const withGoodError = generateEvents(prev, [], "2026-09-24", [`${prev[0].url}: HTTP 404 (cloudflare) ${prev[0].url}`]);
  assert.deepEqual(withGoodError, [{ date: "2026-09-24", type: "product_unpublished", model_id: "unitree-g1", seller: "unitree-official", variant: "(entire product)", from: prev[0].url, to: null, source_url: prev[0].url }]);

  const withUnrelatedError = generateEvents(prev, [], "2026-09-24", [`${prev[0].url}: HTTP 403 (cloudflare challenge) ${prev[0].url}`]);
  assert.deepEqual(withUnrelatedError, [], "a 403/timeout/challenge is a fetch problem, not evidence the product was unpublished");

  const withNoError = generateEvents(prev, [], "2026-09-24", []);
  assert.deepEqual(withNoError, [], "disappearing with no error logged at all must not be asserted as unpublished");
});

test("a product still present today (even with 0 rows for one variant) does not fire product_unpublished", () => {
  const prev = [row({ variant: "G1" }), row({ variant: "G1 Pro" })];
  const curr = [row({ variant: "G1" })]; // G1 Pro variant vanished, but the product URL itself is still live
  assert.deepEqual(generateEvents(prev, curr, "2026-09-24", [`${prev[0].url}: HTTP 404 ${prev[0].url}`]), []);
});

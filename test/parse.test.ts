import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeGrants,
  normalizeDate,
  parseGranteePage,
  parseRegexHtml,
  parseShopifyProduct,
  withUsMarket,
  type PriceSource,
} from "../src/lib/parse.ts";

const go2: PriceSource = {
  seller: "unitree-official",
  type: "shopify_js",
  url: "https://shop.unitree.com/products/unitree-go2.js",
  variant_map: { air: "unitree-go2-air", pro: "unitree-go2-pro", edu: "unitree-go2-edu" },
  default_model: "unitree-go2-air",
};

test("shopify: cents -> USD, variant mapping, availability", () => {
  const rows = parseShopifyProduct(
    {
      title: "Unitree Go2",
      handle: "unitree-go2",
      variants: [
        { title: "Go2 Air", public_title: "Go2 Air", price: 160000, available: true },
        { title: "Go2 Pro", public_title: "Go2 Pro", price: 280000, available: false },
        { title: "Go2 EDU", public_title: "Go2 EDU", price: 1560000, available: true },
      ],
    },
    go2,
    "2026-09-22",
  );
  assert.deepEqual(rows.map((r) => [r.model_id, r.price_usd, r.available]), [
    ["unitree-go2-air", 1600, true],
    ["unitree-go2-pro", 2800, false],
    ["unitree-go2-edu", 15600, true],
  ]);
  assert.equal(rows[0].url, "https://shop.unitree.com/products/unitree-go2");
});

test("shopify: 'pro' does not match inside 'product'", () => {
  const rows = parseShopifyProduct(
    { title: "Go2", handle: "x", variants: [{ title: "Go2 Air (product bundle)", price: 160000 }] },
    go2,
    "2026-09-22",
  );
  assert.equal(rows[0].model_id, "unitree-go2-air");
});

test("shopify: placeholder prices are flagged", () => {
  const rows = parseShopifyProduct(
    { title: "Unitree H1 - Contact us", handle: "h1", variants: [{ title: "Default", price: 9000000 }] },
    { ...go2, default_model: "unitree-h1", variant_map: undefined },
    "2026-09-22",
  );
  assert.deepEqual(rows[0].flags, ["placeholder_price"]);
});

test("regex html: 1X NEO ownership + subscription", () => {
  const html = `<div>$20,000 Ownership</div><div>$499/mo Subscription</div><div>$200 Deposit</div>`;
  const rows = parseRegexHtml(
    html,
    {
      seller: "1x-official",
      type: "regex_html",
      url: "https://www.1x.tech/order",
      default_model: "1x-neo",
      patterns: [
        { variant: "Ownership", regex: "\\$([0-9,]+)\\s*Ownership" },
        { variant: "Subscription (per month)", regex: "\\$([0-9,]+)\\s*/\\s*mo" },
      ],
    },
    "2026-09-22",
  );
  assert.deepEqual(rows.map((r) => [r.variant, r.price_usd]), [
    ["Ownership", 20000],
    ["Subscription (per month)", 499],
  ]);
});

test("dates normalize from FCC / fccid formats", () => {
  assert.equal(normalizeDate("03/03/2025"), "2025-03-03");
  assert.equal(normalizeDate("2025-03-03"), "2025-03-03");
  assert.equal(normalizeDate("Mar 3, 2025"), "2025-03-03");
  assert.equal(normalizeDate("garbage"), null);
});

test("grantee page: rows parsed, covered-list flag, earliest date kept", () => {
  const html = `<table>
    <tr><th>FCC ID</th><th>Name</th><th>Date</th></tr>
    <tr><td><a href="/2A5PE-YUSHU008">2A5PE-YUSHU008</a></td><td>Humanoid Robot</td><td>2025-03-03</td></tr>
    <tr><td><a href="/2A5PE-YUSHU008">2A5PE-YUSHU008</a></td><td>Class II change</td><td>2026-08-10</td></tr>
    <tr><td><a href="/2A5PE-YUSHU013">2A5PE-YUSHU013</a></td><td>Quadruped</td><td>2026-08-02</td></tr>
    <tr><td>unrelated row</td></tr>
  </table>`;
  const g = parseGranteePage(html, "2A5PE");
  const byId = Object.fromEntries(g.map((x) => [x.fcc_id, x]));
  assert.equal(g.length, 2);
  assert.equal(byId["2A5PE-YUSHU008"].grant_date, "2025-03-03");
  assert.equal(byId["2A5PE-YUSHU008"].after_covered_list, false);
  assert.equal(byId["2A5PE-YUSHU013"].after_covered_list, true);
});

test("mergeGrants stamps first_seen only for new IDs", () => {
  const existing = {
    "2A5PE-YUSHU008": {
      fcc_id: "2A5PE-YUSHU008", grantee_code: "2A5PE", grant_date: "2025-03-03",
      description: null, after_covered_list: false, first_seen: "2026-09-01",
    },
  };
  const { registry, added } = mergeGrants(
    existing,
    [
      { fcc_id: "2A5PE-YUSHU008", grantee_code: "2A5PE", grant_date: "2025-03-03", description: null, after_covered_list: false },
      { fcc_id: "2A5PE-YUSHU013", grantee_code: "2A5PE", grant_date: "2026-08-02", description: null, after_covered_list: true },
    ],
    "2026-09-22",
  );
  assert.deepEqual(added, ["2A5PE-YUSHU013"]);
  assert.equal(registry["2A5PE-YUSHU008"].first_seen, "2026-09-01");
  assert.equal(registry["2A5PE-YUSHU013"].first_seen, "2026-09-22");
});

test("shopify: .json endpoint shape ({ product }, dollar strings) is accepted", () => {
  const rows = parseShopifyProduct(
    {
      product: {
        title: "Loona Petbot",
        handle: "petbot",
        variants: [
          { title: "Premium", price: "499.00", available: true },
          { title: "Duo Delight", price: "999.00" },
        ],
      },
    },
    { seller: "keyi-official", type: "shopify_js", url: "https://us.keyirobot.com/products/petbot.json", default_model: "keyi-loona" },
    "2026-09-22",
  );
  assert.deepEqual(rows.map((r) => [r.model_id, r.variant, r.price_usd, r.available]), [
    ["keyi-loona", "Premium", 499, true],
    ["keyi-loona", "Duo Delight", 999, null],
  ]);
  assert.equal(rows[0].url, "https://us.keyirobot.com/products/petbot");
});

test("shopify: HTML body is rejected with a clear error", () => {
  assert.throws(
    () => parseShopifyProduct("<!DOCTYPE html>" as unknown, { seller: "x", type: "shopify_js", url: "https://x/y.js", default_model: "m" }, "2026-09-22"),
    /not a Shopify product/,
  );
});

test("regex html: price and label split across sibling tags (live 1X markup)", () => {
  const html = `<h3><span>$499/mo</span><span class="text-[10px]">Subscription</span></h3>
    <h3><span>$20,000</span><span class="text-[10px]">Ownership</span></h3><h3>$200 Deposit Due Today</h3>`;
  const rows = parseRegexHtml(
    html,
    {
      seller: "1x-official",
      type: "regex_html",
      url: "https://www.1x.tech/order",
      default_model: "1x-neo",
      patterns: [
        { variant: "Ownership", regex: "\\$([0-9,]+)\\s*Ownership" },
        { variant: "Subscription (per month)", regex: "\\$([0-9,]+)\\s*/\\s*mo" },
      ],
    },
    "2026-09-22",
  );
  assert.deepEqual(rows.map((r) => [r.variant, r.price_usd]), [
    ["Ownership", 20000],
    ["Subscription (per month)", 499],
  ]);
});

test("shopify: requests pin the US market (Pollen serves EUR elsewhere)", () => {
  assert.equal(withUsMarket("https://store.pollen-robotics.com/products/reachy-mini-lite-version.js"),
    "https://store.pollen-robotics.com/products/reachy-mini-lite-version.js?country=US");
  assert.equal(withUsMarket("https://x/p.js?foo=1"), "https://x/p.js?foo=1&country=US");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyEquipment,
  normalizeDate,
  parseConditionalApprovals,
  parseRegexHtml,
  parseShopifyProduct,
  withUsMarket,
  type PriceSource,
} from "../src/lib/parse.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

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

test("dates normalize from FCC / notice formats", () => {
  assert.equal(normalizeDate("03/03/2025"), "2025-03-03");
  assert.equal(normalizeDate("2025-03-03"), "2025-03-03");
  assert.equal(normalizeDate("Mar 3, 2025"), "2025-03-03");
  assert.equal(normalizeDate("September 9, 2026"), "2026-09-09");
  assert.equal(normalizeDate("garbage"), null);
});

test("DA-26-957 (flattened .txt): Appendix B parses, Husqvarna robotic row is exact", () => {
  const { status, approvals } = parseConditionalApprovals(fixture("DA-26-957A1.txt"));
  assert.equal(status, "ok");
  assert.ok(approvals.length >= 25, `expected many rows, got ${approvals.length}`);
  const robotic = approvals.filter((a) => a.equipment_type === "robotic_device");
  assert.deepEqual(
    robotic.map((a) => [a.entry, a.company, a.models, a.effective_from, a.effective_to]),
    [["Husqvarna AB 305v IQ, 310v IQ, 420v IQ, and 440v IQ robotic platforms", "Husqvarna AB", "305v IQ, 310v IQ, 420v IQ, and 440v IQ", "2026-09-09", null]],
  );
  const netgear = approvals.find((a) => a.entry.startsWith("Netgear, Inc."));
  assert.ok(netgear && netgear.equipment_type === "router" && netgear.company === "Netgear, Inc.");
  assert.equal(netgear.effective_from, "2026-04-14");
  assert.equal(netgear.effective_to, "2027-10-01");
  const sifly = approvals[0];
  assert.equal(sifly.entry, "SiFly Aviation, Inc. Q12 Uncrewed Aircraft System");
  assert.equal(sifly.equipment_type, "uas");
  assert.equal(sifly.effective_from, "2026-03-17");
});

test("DA-26-996 (line-per-cell .txt): both robotic approvals, ANSCER dated 2026-09-18", () => {
  const { status, approvals } = parseConditionalApprovals(fixture("DA-26-996A1.txt"));
  assert.equal(status, "ok");
  const robotic = approvals.filter((a) => a.equipment_type === "robotic_device");
  assert.deepEqual(
    robotic.map((a) => [a.company, a.models, a.effective_from]),
    [
      ["Husqvarna AB", "305v IQ, 310v IQ, 420v IQ, and 440v IQ", "2026-09-09"],
      ["ANSCER Robotics", "AR250, AR650, and AR1250", "2026-09-18"],
    ],
  );
});

test("DA-26-786 (Covered List addition, no Appendix B table) → no_appendix, nothing invented", () => {
  const r = parseConditionalApprovals(fixture("DA-26-786A1.txt"));
  assert.equal(r.status, "no_appendix");
  assert.equal(r.approvals.length, 0);
});

test("appendix present but unreadable → parse_failed", () => {
  const r = parseConditionalApprovals("APPENDIX B\nConditional Approvals\nUpdated someday\n\nsome text without any table");
  assert.equal(r.status, "parse_failed");
  assert.equal(r.approvals.length, 0);
});

test("equipment classification: UAS wins over 'Robotics' in a company name", () => {
  assert.equal(classifyEquipment("Real-Time Robotics, Inc.’s HERA Tactical Uncrewed Aircraft Systems Platform"), "uas");
  assert.equal(classifyEquipment("ANSCER Robotics AR250, AR650, and AR1250 robotic platforms"), "robotic_device");
  assert.equal(classifyEquipment("Sercomm Corporation’s Air4992 Wi-Fi 7 Router"), "router");
});

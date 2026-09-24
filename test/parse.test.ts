import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractLeadTime, normalizeDate, parseRegexHtml, parseShopifyProduct, withUsMarket, type PriceSource } from "../src/lib/parse.ts";
import { extractRoboticApprovals } from "../src/lib/pdf.ts";

// Node's Buffer is a Uint8Array subclass, but pdfjs checks the exact constructor, so re-wrap it.
const fixture = async (name: string) => new Uint8Array(await readFile(new URL(`./fixtures/${name}`, import.meta.url)));

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
    "2026-09-24T00:17:03.000Z",
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
    "2026-09-24T00:17:03.000Z",
  );
  assert.equal(rows[0].model_id, "unitree-go2-air");
});

test("shopify: placeholder prices are flagged", () => {
  const rows = parseShopifyProduct(
    { title: "Unitree H1 - Contact us", handle: "h1", variants: [{ title: "Default", price: 9000000 }] },
    { ...go2, default_model: "unitree-h1", variant_map: undefined },
    "2026-09-22",
    "2026-09-24T00:17:03.000Z",
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
    "2026-09-24T00:17:03.000Z",
  );
  assert.deepEqual(rows.map((r) => [r.model_id, r.variant, r.price_usd, r.available]), [
    ["keyi-loona", "Premium", 499, true],
    ["keyi-loona", "Duo Delight", 999, null],
  ]);
  assert.equal(rows[0].url, "https://us.keyirobot.com/products/petbot");
});

test("shopify: HTML body is rejected with a clear error", () => {
  assert.throws(
    () => parseShopifyProduct("<!DOCTYPE html>" as unknown, { seller: "x", type: "shopify_js", url: "https://x/y.js", default_model: "m" }, "2026-09-22", "2026-09-24T00:17:03.000Z"),
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
    "2026-09-24T00:17:03.000Z",
  );
  assert.deepEqual(rows.map((r) => [r.variant, r.price_usd]), [
    ["Ownership", 20000],
    ["Subscription (per month)", 499],
  ]);
  assert.deepEqual(rows.map((r) => [r.purchase_mode, r.availability_status, r.variant_id]), [
    ["preorder", "pre_order", null],
    ["preorder", "pre_order", null],
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

// ---------- task-events.md §1-4: fields the raw response already had but the parser used to discard ----------

test("shopify: compare_at_price -> on_sale, sku/id/published_at/updated_at are captured", () => {
  const rows = parseShopifyProduct(
    {
      title: "Loona Petbot",
      handle: "petbot",
      published_at: "2026-01-21T00:01:02-05:00",
      variants: [
        { id: 111, title: "Premium", price: "499.00", compare_at_price: "529.00", sku: "LOONAZHTZ26", available: true, updated_at: "2026-09-23T22:07:50-04:00" },
        { id: 222, title: "Space Edition", price: "699.00", compare_at_price: "699.00", sku: null, available: true }, // compare == price: not on sale
        { id: 333, title: "No Compare", price: "39.00", available: true }, // compare_at_price absent entirely
      ],
    },
    { seller: "keyi-official", type: "shopify_js", url: "https://us.keyirobot.com/products.json?limit=250", product_handle: "petbot", default_model: "keyi-loona" },
    "2026-09-24",
    "2026-09-24T00:17:03.000Z",
  );
  assert.deepEqual(
    rows.map((r) => [r.variant, r.compare_at_price_usd, r.on_sale, r.variant_sku, r.variant_id]),
    [
      ["Premium", 529, true, "LOONAZHTZ26", 111],
      ["Space Edition", 699, false, null, 222],
      ["No Compare", null, false, null, 333],
    ],
  );
  assert.equal(rows[0].observed_at, "2026-09-24T00:17:03.000Z");
});

test("shopify: collection endpoint ({ products: [...] }) is unwrapped by product_handle, not products[0]", () => {
  const rows = parseShopifyProduct(
    {
      products: [
        { title: "Space Explorer", handle: "space-explorer", variants: [{ title: "Default", price: "129.00", available: true }] },
        { title: "Loona Petbot", handle: "petbot", variants: [{ title: "Premium", price: "499.00", available: true }] },
      ],
    },
    { seller: "keyi-official", type: "shopify_js", url: "https://us.keyirobot.com/products.json?limit=250", product_handle: "petbot", default_model: "keyi-loona" },
    "2026-09-24",
    "2026-09-24T00:17:03.000Z",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].variant, "Premium");
  assert.equal(rows[0].url, "https://us.keyirobot.com/products/petbot");
});

test("shopify: collection endpoint without a matching handle throws (never silently picks products[0])", () => {
  assert.throws(
    () =>
      parseShopifyProduct(
        { products: [{ title: "Space Explorer", handle: "space-explorer", variants: [{ title: "Default", price: "1.00" }] }] },
        { seller: "keyi-official", type: "shopify_js", url: "https://x/products.json", product_handle: "petbot", default_model: "keyi-loona" },
        "2026-09-24",
        "2026-09-24T00:17:03.000Z",
      ),
    /product_handle "petbot" not found/,
  );
});

test("shopify: no `available` field on a variant -> availability_status unknown, with a named reason (KEYi's old endpoint)", () => {
  const rows = parseShopifyProduct(
    { product: { title: "Loona Petbot", handle: "petbot", variants: [{ title: "Premium", price: "499.00" }] } },
    { seller: "keyi-official", type: "shopify_js", url: "https://us.keyirobot.com/products/petbot.json", default_model: "keyi-loona" },
    "2026-09-24",
    "2026-09-24T00:17:03.000Z",
  );
  assert.equal(rows[0].availability_status, "unknown");
  assert.match(rows[0].availability_evidence, /no `available` field/);
});

test("shopify: available true/false -> in_stock/out_of_stock with the exact evidence string", () => {
  const rows = parseShopifyProduct(
    { title: "H2", handle: "unitree-h2", variants: [{ title: "H2", price: "29900.00", available: false }] },
    { seller: "unitree-official", type: "shopify_js", url: "https://shop.unitree.com/products/unitree-h2.js", default_model: "unitree-h2" },
    "2026-09-24",
    "2026-09-24T00:17:03.000Z",
  );
  assert.equal(rows[0].availability_status, "out_of_stock");
  assert.equal(rows[0].availability_evidence, "variants[0].available=false");
});

test("shopify: contact_sales_variants overrides purchase_mode and availability_status for an exact title match", () => {
  const source: PriceSource = {
    seller: "deeprobotics-us",
    type: "shopify_js",
    url: "https://shop.deeprobotics.us/products/lite-3.js",
    default_model: "deep-robotics-lite3",
    contact_sales_variants: ["Venture", "Pro", "LiDAR"],
  };
  const rows = parseShopifyProduct(
    {
      title: "Lite3",
      handle: "lite-3",
      variants: [
        { title: "Basic", price: "2890.00", available: true },
        { title: "Basic AI", price: "4968.00", available: true }, // contains "Basic" but is not in the list — must stay direct
        { title: "Venture", price: "6480.00", available: true },
        { title: "Pro", price: "12510.00", available: true },
      ],
    },
    source,
    "2026-09-24",
    "2026-09-24T00:17:03.000Z",
  );
  assert.deepEqual(
    rows.map((r) => [r.variant, r.purchase_mode, r.availability_status]),
    [
      ["Basic", "direct", "in_stock"],
      ["Basic AI", "direct", "in_stock"],
      ["Venture", "contact_sales", "contact_sales"],
      ["Pro", "contact_sales", "contact_sales"],
    ],
  );
});

test("extractLeadTime: Pollen's exact sentence, and null for everyone else — never guessed", () => {
  const pollen = extractLeadTime(
    "<p>Shipping &amp; Import Duties</p><p>Lead time: up to 90 days after purchase (many orders ship sooner). Import duties are calculated at checkout.</p>",
  );
  assert.equal(pollen.text, "up to 90 days after purchase (many orders ship sooner).");
  assert.equal(pollen.days, 90);

  assert.deepEqual(extractLeadTime("<p>A regular product description with no shipping info.</p>"), { text: null, days: null });
  assert.deepEqual(extractLeadTime(null), { text: null, days: null });
  assert.deepEqual(extractLeadTime(undefined), { text: null, days: null });
});

test("shopify: lead_time_text/days flow from description into every variant row", () => {
  const rows = parseShopifyProduct(
    {
      title: "Reachy Mini Wireless",
      handle: "reachy-mini-wireless-version",
      description: "<p>Lead time: up to 90 days after purchase (many orders ship sooner).</p>",
      variants: [{ title: "Default Title", price: "499.00", available: true }],
    },
    { seller: "pollen-official", type: "shopify_js", url: "https://store.pollen-robotics.com/products/reachy-mini-wireless-version.js", default_model: "pollen-reachy-mini" },
    "2026-09-24",
    "2026-09-24T00:17:03.000Z",
  );
  assert.equal(rows[0].lead_time_text, "up to 90 days after purchase (many orders ship sooner).");
  assert.equal(rows[0].lead_time_days, 90);
  assert.equal(rows[0].market, "US");
});

// ---------- FCC Conditional Approvals: the real bug from task-fcc-3.md ----------
// The old docs.fcc.gov .txt-based parser merged adjacent table cells (e.g. Askey's own second entry bled
// into Ascento's, and a phantom "Verizon" record was invented from text that was really part of Arcadyan's
// product list — see context/fcc-api-notes.md §8-9). These tests run against the *real* notice PDFs, read via
// src/lib/pdf.ts's column-coordinate extraction, and assert the exact, complete, correctly-split text — not
// just "it didn't crash".

test("DA-26-957.pdf: Appendix B has one robotic entry, Husqvarna, complete and unmerged", async () => {
  const { status, approvals } = await extractRoboticApprovals(await fixture("DA-26-957A1.pdf"));
  assert.equal(status, "ok");
  assert.deepEqual(
    approvals.map((a) => [a.entry, a.company, a.models, a.effective_from, a.effective_to]),
    [["Husqvarna AB 305v IQ, 310v IQ, 420v IQ, and 440v IQ robotic platforms", "Husqvarna AB", "305v IQ, 310v IQ, 420v IQ, and 440v IQ", "2026-09-09", null]],
  );
});

test("DA-26-996.pdf: two robotic entries, Husqvarna and ANSCER, each complete and not bleeding into the other", async () => {
  const { status, approvals } = await extractRoboticApprovals(await fixture("DA-26-996A1.pdf"));
  assert.equal(status, "ok");
  assert.deepEqual(
    approvals.map((a) => [a.company, a.models, a.effective_from]),
    [
      ["Husqvarna AB", "305v IQ, 310v IQ, 420v IQ, and 440v IQ", "2026-09-09"],
      ["ANSCER Robotics", "AR250, AR650, and AR1250", "2026-09-18"],
    ],
  );
  // The specific corruption task-fcc-3.md §1 found: Askey/Ascento and Verizon/Air VEV text must never appear
  // anywhere in what we extract, because we only read the Robotic Devices column in the first place.
  for (const a of approvals) {
    assert.doesNotMatch(a.entry, /Askey|Ascento|Verizon|Arcadyan|Air VEV/);
  }
});

test("DA-26-786.pdf: has an Appendix B, but it's a National Security Determination, not the approvals table → no_appendix", async () => {
  const r = await extractRoboticApprovals(await fixture("DA-26-786A1.pdf"));
  assert.equal(r.status, "no_appendix");
  assert.equal(r.approvals.length, 0);
});

test("DA-26-789.pdf: no Appendix B at all → no_appendix, nothing invented", async () => {
  const r = await extractRoboticApprovals(await fixture("DA-26-789A1.pdf"));
  assert.equal(r.status, "no_appendix");
  assert.equal(r.approvals.length, 0);
});

test("not a PDF → throws rather than silently returning nothing", async () => {
  await assert.rejects(() => extractRoboticApprovals(new TextEncoder().encode("not a pdf")));
});

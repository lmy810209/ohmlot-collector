// Pure parsers — no network. Tested in test/parse.test.ts.

export const COVERED_LIST_DATE = "2026-07-28"; // FCC DA 26-786: new grants for foreign-produced robots barred from this date

// Unitree (and others) put placeholder prices on "contact us" items.
export const PLACEHOLDER_PRICES_USD = new Set([90000, 100000]);

const stripTags = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export interface PriceSource {
  seller: string;
  type: "shopify_js" | "regex_html";
  url: string;
  default_model: string;
  variant_map?: Record<string, string>;
  patterns?: { variant: string; regex: string }[];
  /** Only for a Shopify /products.json *collection* endpoint (no single-product .js/.json exists): which
   * product in the array to read (see KEYi in config/price-sources.json — its .js 301s to a marketing page
   * and its single-product .json has no `available`, but the *collection* endpoint has both). */
  product_handle?: string;
  /** Exact variant titles for which a listed price can't actually be bought without contacting sales
   * (confirmed against the source's own description text — see context/observability.md and
   * context/task-events.md §4). Drives purchase_mode; never guessed from prose at parse time. */
  contact_sales_variants?: string[];
}

/** context/task-events.md §4. Never a bare bool — the reason has to travel with the value. */
export type AvailabilityStatus = "in_stock" | "out_of_stock" | "pre_order" | "contact_sales" | "unknown";
/** "direct" = buyable at the shown price today; "contact_sales" = priced but not directly purchasable;
 * "preorder" = no stock concept, paying reserves a future unit (1X NEO). */
export type PurchaseMode = "direct" | "contact_sales" | "preorder";

export interface PriceRow {
  date: string; // YYYY-MM-DD (UTC)
  observed_at: string; // ISO instant this specific source was fetched
  model_id: string;
  seller: string;
  variant: string;
  variant_sku: string | null;
  /** Shopify's own numeric variant id, when the endpoint exposes one — the stable key variant_added/removed
   * diffing needs (a title can be reused; this can't). Null for regex_html sources, which have no such concept. */
  variant_id: number | string | null;
  price_usd: number;
  compare_at_price_usd: number | null;
  on_sale: boolean;
  /** Kept for backward compatibility with the site, which reads this directly — same true/false/null meaning
   * it always had. availability_status below is the field new code should read (task-events.md §4). */
  available: boolean | null;
  availability_status: AvailabilityStatus;
  /** What was actually looked at to produce availability_status, e.g. "variants[2].available=false" or
   * "no `available` field in this endpoint's response" — so a status is never just asserted. */
  availability_evidence: string;
  lead_time_text: string | null;
  lead_time_days: number | null;
  purchase_mode: PurchaseMode;
  market: "US" | "unknown";
  url: string;
  flags: string[];
}

interface ShopifyVariant {
  id?: number | string;
  title?: string;
  public_title?: string | null;
  price: number | string; // cents in the .js endpoint, a decimal string in .json
  available?: boolean;
  sku?: string | null;
  compare_at_price?: number | string | null;
  updated_at?: string;
}
interface ShopifyProduct {
  title: string;
  handle: string;
  published_at?: string | null;
  description?: string | null;
  body_html?: string | null;
  variants: ShopifyVariant[];
}

/** "Lead time: up to 90 days after purchase (many orders ship sooner)." → text + the leading day count.
 * Deliberately narrow (task-events.md §3): most sources' description text won't match, and that's correct —
 * it means null, not "not found yet". */
export function extractLeadTime(descriptionHtml: string | null | undefined): { text: string | null; days: number | null } {
  const plain = stripTags(descriptionHtml ?? "");
  const m = plain.match(/Lead time:\s*([^.]+\.)/i);
  if (!m) return { text: null, days: null };
  const text = m[1].trim();
  const days = text.match(/(\d+)\s*days?/i);
  return { text, days: days ? Number(days[1]) : null };
}

function toCents(price: number | string): number {
  return typeof price === "string" ? Math.round(parseFloat(price) * 100) : price;
}

function availabilityOf(v: ShopifyVariant, index: number): { status: AvailabilityStatus; evidence: string } {
  if (typeof v.available === "boolean") {
    return { status: v.available ? "in_stock" : "out_of_stock", evidence: `variants[${index}].available=${v.available}` };
  }
  return { status: "unknown", evidence: "no `available` field in this endpoint's response" };
}

export function mapVariantToModel(source: PriceSource, variantTitle: string): string {
  if (source.variant_map) {
    const t = variantTitle.toLowerCase();
    for (const [needle, model] of Object.entries(source.variant_map)) {
      if (new RegExp(`\\b${needle.toLowerCase()}\\b`).test(t)) return model;
    }
  }
  return source.default_model;
}

/**
 * Accepts every Shopify product response shape seen across the 11 sources (context/observability.md):
 *  - /products/<handle>.js         → { title, variants: [{ price: <cents> }] }
 *  - /products/<handle>.json       → { product: { title, variants: [{ price: "<dollars>" }] } }
 *  - /products.json (collection)   → { products: [ {...}, {...} ] } — no per-handle filter exists server-side
 *    (a `?handle=` query param is silently ignored), so `source.product_handle` picks the right entry here.
 * Some stores 301 the .js URL to a marketing site while .json keeps working (KEYi's old single-product
 * endpoint did, but that shape has no `available` at all — see context/observability.md §"정정" — which is
 * why KEYi now uses the collection endpoint instead).
 */
export function parseShopifyProduct(json: unknown, source: PriceSource, date: string, observedAt: string): PriceRow[] {
  const raw = json as (ShopifyProduct & { product?: ShopifyProduct; products?: ShopifyProduct[] }) | null;
  let p: ShopifyProduct | undefined;
  if (raw && Array.isArray(raw.variants)) p = raw;
  else if (raw?.product) p = raw.product;
  else if (Array.isArray(raw?.products)) {
    p = source.product_handle ? raw.products.find((x) => x.handle === source.product_handle) : raw.products[0];
    if (!p) throw new Error(`product_handle "${source.product_handle}" not found among ${raw!.products!.length} products: ${source.url}`);
  }
  if (!p || !Array.isArray(p.variants)) throw new Error(`not a Shopify product: ${source.url}`);
  const contactUs = /contact\s*us/i.test(p.title);
  const leadTime = extractLeadTime(p.description ?? p.body_html);
  const contactSalesVariants = new Set(source.contact_sales_variants ?? []);
  // Derived from the matched product's own handle (not string-munged from source.url) so the collection
  // endpoint (KEYi) — which has no per-handle path of its own — still points at the real product page.
  const cleanUrl = `${new URL(source.url).origin}/products/${p.handle}`;
  return p.variants.map((v, i) => {
    const price = toCents(v.price) / 100;
    const compareAtRaw = v.compare_at_price;
    const compareAtCents = compareAtRaw != null ? toCents(compareAtRaw) : 0;
    const compare_at_price_usd = compareAtCents > 0 ? compareAtCents / 100 : null; // Shopify uses 0 as well as null for "unset"
    const on_sale = compare_at_price_usd != null && compare_at_price_usd > price;
    const variant = v.public_title ?? v.title ?? "Default";
    const flags: string[] = [];
    if (PLACEHOLDER_PRICES_USD.has(price) || contactUs) flags.push("placeholder_price");
    const { status: availStatus, evidence } = availabilityOf(v, i);
    const purchase_mode: PurchaseMode = contactSalesVariants.has(variant) ? "contact_sales" : "direct";
    return {
      date,
      observed_at: observedAt,
      model_id: mapVariantToModel(source, variant),
      seller: source.seller,
      variant,
      variant_sku: v.sku ?? null,
      variant_id: v.id ?? null,
      price_usd: price,
      compare_at_price_usd,
      on_sale,
      available: typeof v.available === "boolean" ? v.available : null,
      availability_status: purchase_mode === "contact_sales" ? "contact_sales" : availStatus,
      availability_evidence: purchase_mode === "contact_sales" ? `variant "${variant}" listed in contact_sales_variants` : evidence,
      lead_time_text: leadTime.text,
      lead_time_days: leadTime.days,
      purchase_mode,
      market: "US",
      url: cleanUrl,
      flags,
    };
  });
}

/**
 * Shopify Markets localizes the .js product endpoint to the caller's region: Pollen serves EUR prices
 * and region-specific availability outside the US. Pin the US market so a run from anywhere records
 * what a US buyer sees (the runner is in the US; local runs from Korea were getting EUR as "usd").
 */
export function withUsMarket(url: string): string {
  return url + (url.includes("?") ? "&" : "?") + "country=US";
}

/**
 * task-events.md §6: 1X NEO has no stock/discount/lead-time concept to extract (it's a fixed-price
 * pre-order page, not a Shopify product) — the raw HTML archived by prices.ts is the only signal for now,
 * so this only fills in the new PriceRow fields with what's already known to be true about the page rather
 * than scraping anything new.
 */
export function parseRegexHtml(html: string, source: PriceSource, date: string, observedAt: string): PriceRow[] {
  const rows: PriceRow[] = [];
  const text = stripTags(html); // price and label are often in sibling tags: <span>$20,000</span><span>Ownership</span>
  for (const pat of source.patterns ?? []) {
    const m = text.match(new RegExp(pat.regex, "i"));
    if (!m) continue;
    rows.push({
      date,
      observed_at: observedAt,
      model_id: source.default_model,
      seller: source.seller,
      variant: pat.variant,
      variant_sku: null,
      variant_id: null,
      price_usd: Number(m[1].replace(/,/g, "")),
      compare_at_price_usd: null,
      on_sale: false,
      available: null,
      availability_status: "pre_order",
      availability_evidence: "regex_html source: page is a pre-order/reservation form, not a stocked product",
      lead_time_text: null,
      lead_time_days: null,
      purchase_mode: "preorder",
      market: "US",
      url: source.url,
      flags: [],
    });
  }
  return rows;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function normalizeDate(s: string): string | null {
  s = s.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // MM/DD/YYYY
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = s.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/); // "Mar 3, 2025" / "September 9, 2026"
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${MONTHS[m[1].toLowerCase()]}-${m[2].padStart(2, "0")}`;
  return null;
}

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
}

export interface PriceRow {
  date: string; // YYYY-MM-DD (UTC)
  model_id: string;
  seller: string;
  variant: string;
  price_usd: number;
  available: boolean | null;
  url: string;
  flags: string[];
}

interface ShopifyVariant {
  title?: string;
  public_title?: string | null;
  price: number | string; // cents in .js endpoint
  available?: boolean;
  sku?: string | null;
}
interface ShopifyProduct {
  title: string;
  handle: string;
  variants: ShopifyVariant[];
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
 * Accepts both Shopify product endpoints:
 *  - /products/<handle>.js   → { title, variants: [{ price: <cents> }] }
 *  - /products/<handle>.json → { product: { title, variants: [{ price: "<dollars>" }] } }
 * Some stores 301 the .js URL to a marketing site while .json keeps working (KEYi), so both are supported.
 */
export function parseShopifyProduct(json: unknown, source: PriceSource, date: string): PriceRow[] {
  const raw = json as (ShopifyProduct & { product?: ShopifyProduct }) | null;
  const p = raw && Array.isArray(raw.variants) ? raw : raw?.product;
  if (!p || !Array.isArray(p.variants)) throw new Error(`not a Shopify product: ${source.url}`);
  const contactUs = /contact\s*us/i.test(p.title);
  return p.variants.map((v) => {
    const cents = typeof v.price === "string" ? Math.round(parseFloat(v.price) * 100) : v.price;
    const price = cents / 100;
    const variant = v.public_title ?? v.title ?? "Default";
    const flags: string[] = [];
    if (PLACEHOLDER_PRICES_USD.has(price) || contactUs) flags.push("placeholder_price");
    return {
      date,
      model_id: mapVariantToModel(source, variant),
      seller: source.seller,
      variant,
      price_usd: price,
      available: typeof v.available === "boolean" ? v.available : null,
      url: source.url.replace(/\.js(on)?$/, ""),
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

export function parseRegexHtml(html: string, source: PriceSource, date: string): PriceRow[] {
  const rows: PriceRow[] = [];
  const text = stripTags(html); // price and label are often in sibling tags: <span>$20,000</span><span>Ownership</span>
  for (const pat of source.patterns ?? []) {
    const m = text.match(new RegExp(pat.regex, "i"));
    if (!m) continue;
    rows.push({
      date,
      model_id: source.default_model,
      seller: source.seller,
      variant: pat.variant,
      price_usd: Number(m[1].replace(/,/g, "")),
      available: null,
      url: source.url,
      flags: [],
    });
  }
  return rows;
}

export interface FccGrant {
  fcc_id: string;
  grantee_code: string;
  grant_date: string | null; // YYYY-MM-DD
  description: string | null;
  after_covered_list: boolean | null;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function normalizeDate(s: string): string | null {
  s = s.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // MM/DD/YYYY (FCC EAS)
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = s.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/); // "Mar 3, 2025"
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${MONTHS[m[1].toLowerCase()]}-${m[2].padStart(2, "0")}`;
  return null;
}

/**
 * Best-effort parser for a grantee listing page (fccid.io/<CODE>).
 * Scans table rows; any row containing an FCC ID that starts with the grantee code
 * becomes a grant. Date = first date-looking cell in that row.
 * Verify against the live page on first run — the site layout is not guaranteed.
 */
export function parseGranteePage(html: string, granteeCode: string): FccGrant[] {
  const code = granteeCode.toUpperCase();
  const idRe = new RegExp(`\\b(${code}-?[A-Z0-9][A-Z0-9-]*)\\b`);
  const dateRe = /(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|[A-Z][a-z]{2}\.? \d{1,2},? \d{4})/;
  const out = new Map<string, FccGrant>();
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const text = stripTags(row);
    const idm = text.match(idRe);
    if (!idm) continue;
    const fcc_id = idm[1];
    const dm = text.match(dateRe);
    const grant_date = dm ? normalizeDate(dm[1]) : null;
    const description = text.replace(fcc_id, "").replace(dm?.[1] ?? "", "").trim() || null;
    const prev = out.get(fcc_id);
    // keep the earliest date seen for an ID (original grant)
    if (!prev || (grant_date && (!prev.grant_date || grant_date < prev.grant_date))) {
      out.set(fcc_id, {
        fcc_id,
        grantee_code: code,
        grant_date,
        description,
        after_covered_list: grant_date ? grant_date >= COVERED_LIST_DATE : null,
      });
    }
  }
  return [...out.values()];
}

/** Merge newly seen grants into the persistent registry, stamping first_seen. */
export function mergeGrants(
  registry: Record<string, FccGrant & { first_seen: string }>,
  found: FccGrant[],
  today: string,
): { registry: Record<string, FccGrant & { first_seen: string }>; added: string[] } {
  const added: string[] = [];
  const next = { ...registry };
  for (const g of found) {
    if (!next[g.fcc_id]) {
      next[g.fcc_id] = { ...g, first_seen: today };
      added.push(g.fcc_id);
    } else if (!next[g.fcc_id].grant_date && g.grant_date) {
      next[g.fcc_id] = { ...next[g.fcc_id], grant_date: g.grant_date, after_covered_list: g.after_covered_list };
    }
  }
  return { registry: next, added };
}

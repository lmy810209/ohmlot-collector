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

/** The array of grant rows inside a getFCCIDList response: either the body itself or the first array-valued property. */
function findRows(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    for (const v of Object.values(raw as Record<string, unknown>)) if (Array.isArray(v)) return v;
  }
  return null;
}

/** Case- and separator-insensitive field lookup: "grantDate", "grant_date" and "GRANTDATE" all match "grantdate". */
function field(row: Record<string, unknown>, ...names: string[]): unknown {
  const wanted = new Set(names.map((n) => n.toLowerCase().replace(/_/g, "")));
  for (const [k, v] of Object.entries(row)) if (wanted.has(k.toLowerCase().replace(/_/g, ""))) return v;
  return undefined;
}

/**
 * Parser for the FCC OET Laboratory Services API, getFCCIDList (KDB 953436).
 * The official schema PDF could not be fetched (context/fcc-api-notes.md §1), so this accepts the shapes
 * seen in the wild — a bare JSON array of rows, or an object wrapping that array — and matches field
 * names loosely. Rows are filtered to the grantee code; the earliest grant date per FCC ID is kept
 * (the original grant — later rows are Class II changes and the like). The untouched body is archived
 * by the collector so rows can be re-parsed once the schema is confirmed.
 */
export function parseFccIdList(raw: unknown, granteeCode: string): FccGrant[] {
  const code = granteeCode.toUpperCase();
  const rows = findRows(raw);
  if (!rows) throw new Error("unexpected response shape (no array of grant rows)");
  const out = new Map<string, FccGrant>();
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const fcc_id = String(field(row, "fccid", "fcc_id") ?? "").trim().toUpperCase();
    if (!fcc_id || !fcc_id.startsWith(code)) continue;
    const rawDate = field(row, "grantdate", "grant_date", "date");
    const grant_date = rawDate == null ? null : normalizeDate(String(rawDate));
    const prev = out.get(fcc_id);
    if (!prev || (grant_date && (!prev.grant_date || grant_date < prev.grant_date))) {
      out.set(fcc_id, {
        fcc_id,
        grantee_code: code,
        grant_date,
        description: null, // the API's applicationPurpose ("Original Equipment", …) is not a device description
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

/* ---------- US regulatory status per model (data/models.json → us_status) ---------- */

export interface UsStatus {
  fcc_id: string | null;
  grant_date: string | null; // YYYY-MM-DD
  covered_list: "before" | "after" | "unknown";
  conditional_approval: boolean | null;
  conditional_approval_note: string;
  last_verified: string; // YYYY-MM-DD, the day this block was last checked against FCC records
  source_url: string | null; // FCC's own record for the FCC ID
}

/** The fields of a data/models.json row that us_status is derived from. */
export interface ModelSeed {
  id: string;
  name: string;
  manufacturer: string;
  fcc_grantee_code: string | null;
  fcc_ids: string[];
  fcc_grant_date: string | null;
  us_status?: UsStatus | null;
}

/**
 * DoW Conditional Approvals for advanced robotic devices, as published by the FCC (verbatim from the
 * public notices; see context/fcc-api-notes.md §3). Only these devices are exempt from the Covered List.
 */
export const CONDITIONAL_APPROVALS = {
  verified: "2026-09-18",
  notice_url: "https://docs.fcc.gov/public/attachments/DA-26-996A1.pdf",
  devices: [
    { producer: "Husqvarna", models: ["305v IQ", "310v IQ", "420v IQ", "440v IQ"], since: "2026-09-09", notice_id: "DA 26-957", notice: "https://docs.fcc.gov/public/attachments/DA-26-957A1.pdf" },
    { producer: "ANSCER", models: ["AR250", "AR650", "AR1250"], since: "2026-09-18", notice_id: "DA 26-996", notice: "https://docs.fcc.gov/public/attachments/DA-26-996A1.pdf" },
  ],
} as const;

/** FCC's own equipment-authorization record for an FCC ID (grantee code + product code). */
export function fccSourceUrl(fccId: string | null): string | null {
  if (!fccId) return null;
  const id = fccId.toUpperCase();
  const [grantee, product] = id.includes("-") ? [id.slice(0, id.indexOf("-")), id.slice(id.indexOf("-") + 1)] : [id.slice(0, 5), id.slice(5)];
  if (!grantee || !product) return null;
  return `https://apps.fcc.gov/oetcf/eas/reports/GenericSearchResult.cfm?RequestTimeout=500&grantee_code=${grantee}&product_code=${encodeURIComponent(product)}`;
}

function conditionalApprovalFor(model: Pick<ModelSeed, "name" | "manufacturer">) {
  const maker = model.manufacturer.toLowerCase();
  const name = model.name.toLowerCase();
  return CONDITIONAL_APPROVALS.devices.find(
    (d) => maker.includes(d.producer.toLowerCase()) && d.models.some((m) => name.includes(m.toLowerCase())),
  );
}

/**
 * us_status for one model. The grant date comes from the collector's registry when it has the ID,
 * else from the seed row. covered_list is decided against COVERED_LIST_DATE; conditional_approval is
 * true only for devices on the FCC's published list (and false otherwise — the list was checked, not guessed).
 */
export function buildUsStatus(model: ModelSeed, registry: Record<string, FccGrant>, verifiedOn: string): UsStatus {
  const fcc_id = model.fcc_ids[0] ?? null;
  const fromRegistry = model.fcc_ids.map((id) => registry[id]?.grant_date).find(Boolean) ?? null;
  const grant_date = fromRegistry ?? model.fcc_grant_date ?? null;
  const ca = conditionalApprovalFor(model);
  return {
    fcc_id,
    grant_date,
    covered_list: grant_date ? (grant_date < COVERED_LIST_DATE ? "before" : "after") : "unknown",
    conditional_approval: ca ? true : false,
    conditional_approval_note: ca
      ? `DoW Conditional Approval since ${ca.since} (FCC ${ca.notice_id}).`
      : `Not on the FCC's Robotic Devices Conditional Approvals list as of ${CONDITIONAL_APPROVALS.verified} (DA 26-996, Appendix B).`,
    last_verified: verifiedOn,
    source_url: fccSourceUrl(fcc_id),
  };
}

/**
 * Recomputes us_status on every seed model. last_verified moves to `today` only for models whose grantee
 * code was actually fetched this run (`verifiedCodes`), or for all models when seeding by hand ("all").
 * Models that were not verified keep their previous block untouched so the date never lies.
 */
export function syncUsStatus<M extends ModelSeed>(
  models: M[],
  registry: Record<string, FccGrant>,
  today: string,
  verifiedCodes: Set<string> | "all",
): { models: M[]; changed: number } {
  let changed = 0;
  const out = models.map((m) => {
    const verified = verifiedCodes === "all" || (m.fcc_grantee_code != null && verifiedCodes.has(m.fcc_grantee_code));
    if (!verified && m.us_status) return m;
    const next = buildUsStatus(m, registry, verified ? today : m.us_status?.last_verified ?? today);
    const prev = m.us_status;
    const same =
      prev &&
      prev.fcc_id === next.fcc_id && prev.grant_date === next.grant_date && prev.covered_list === next.covered_list &&
      prev.conditional_approval === next.conditional_approval && prev.conditional_approval_note === next.conditional_approval_note &&
      prev.last_verified === next.last_verified && prev.source_url === next.source_url;
    if (same) return m;
    changed++;
    return { ...m, us_status: next };
  });
  return { models: out, changed };
}

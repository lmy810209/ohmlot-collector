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

/* ---------- FCC Covered List: Conditional Approvals from PSHSB public notices ----------
   Source: docs.fcc.gov/public/attachments/<DA>A1.txt (the .txt rendering of the public notice). Appendix B is a
   three-column table (UAS | Routers | Robotic Devices, each with its own "Dates of Conditional Approval"
   sub-column) that the .txt flattens to running text in row-major or column-major order depending on the
   notice. We don't rely on column position: every "Month D, YYYY [– Month D, YYYY]" range in the appendix is
   found in order, and the text between one range and the next is treated as the cell that owns the *next*
   range (an empty gap means the previous cell prints a second range for a second product). Nothing beyond
   that is inferred — company/model splitting is a best-effort heuristic and the verbatim cell is always kept
   in `entry`, so a display can always fall back to it. */

export type EquipmentType = "robotic_device" | "router" | "uas" | "unknown";
export type NoticeParseStatus = "ok" | "no_appendix" | "parse_failed";

export interface ConditionalApproval {
  equipment_type: EquipmentType;
  /** The table cell, verbatim (whitespace collapsed). Authoritative — always shown alongside any derived field. */
  entry: string;
  /** Heuristic split of `entry`; null when the split is not obvious. */
  company: string | null;
  models: string | null;
  effective_from: string | null; // YYYY-MM-DD
  effective_to: string | null; // null = no termination date printed (approval is open-ended)
  /** Extra "Start – End" ranges printed under the same cell (multi-product / multi-period cells). */
  extra_dates: { from: string | null; to: string | null }[];
}

/** Slice the Conditional Approvals appendix out of a notice's .txt; null when the notice has none. */
export function extractConditionalApprovalsAppendix(text: string): string | null {
  const m = text.match(/APPENDIX\s+B\s*\r?\n\s*Conditional Approvals/i);
  if (!m || m.index == null) return null;
  const rest = text.slice(m.index);
  const end = rest.search(/\n\s*\*\s*Consistent with|\n\s*APPENDIX\s+C\b/i);
  return end > 0 ? rest.slice(0, end) : rest;
}

const MONTH = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";
const DATE = `${MONTH}\\s+\\d{1,2},\\s+\\d{4}`;
// The end date (and its leading dash) is fully optional: some notices print a bare start date with no
// dash at all for an open-ended approval (DA-26-996), others print "Month D, YYYY –" with the dash but no
// end date (DA-26-957). Making the whole "dash + end date" group optional, rather than just the end date,
// handles both without merging the next cell's text into this one.
const RANGE = new RegExp(`(${DATE})(?:\\s*[–—-]\\s*(${DATE}))?`, "g");
const HEADER = "Dates of Conditional Approval";

export function classifyEquipment(entry: string): EquipmentType {
  if (/uncrewed|unmanned|aircraft|aerial|\bUAS\b/i.test(entry)) return "uas";
  if (/robot/i.test(entry)) return "robotic_device";
  if (/router|gateway|modem|mesh|wi-?fi|access point|repeater|mifi/i.test(entry)) return "router";
  return "unknown";
}

function splitEntry(entry: string): { company: string | null; models: string | null } {
  const poss = entry.match(/^(.+?)[’']s\s+(.+)$/);
  let company: string | null = null;
  let models: string | null = null;
  if (poss) {
    company = poss[1].trim();
    models = poss[2].trim();
  } else {
    const tokens = entry.split(" ");
    const i = tokens.findIndex((t) => /\d/.test(t));
    if (i > 0) {
      company = tokens.slice(0, i).join(" ");
      models = tokens.slice(i).join(" ");
    } else {
      company = entry;
    }
  }
  if (models) {
    models = models.replace(/\s*(robotic platforms?|robotic devices?|routers?|Uncrewed Aircraft Systems?( \(UAS\))?|Unmanned Aerial Systems?)\s*$/i, "").trim() || null;
  }
  return { company, models };
}

/** Parses one notice's Appendix B into Conditional Approval rows. Never guesses: unreadable → parse_failed. */
export function parseConditionalApprovals(text: string): { status: NoticeParseStatus; approvals: ConditionalApproval[] } {
  const appendix = extractConditionalApprovalsAppendix(text);
  if (!appendix) return { status: "no_appendix", approvals: [] };
  let t = appendix
    .split(/\r?\n/)
    .filter((l) => !/^\s*\d{1,3}\s*$/.test(l) && !/^\s*Federal Communications Commission/i.test(l) && !/^\s*DA \d\d-\d+\s*$/.test(l))
    .join(" ")
    .replace(/\s+/g, " ");
  const hdr = t.lastIndexOf(HEADER);
  if (hdr < 0) return { status: "parse_failed", approvals: [] };
  t = t.slice(hdr + HEADER.length).replace(/^[#*]?\s*/, "");
  const out: ConditionalApproval[] = [];
  let last = 0;
  let prev: ConditionalApproval | null = null;
  for (const m of t.matchAll(RANGE)) {
    const cell = t.slice(last, m.index).replace(/^[\s–—-]+/, "").trim(); // a stray leading dash from a skipped open-ended date
    last = (m.index ?? 0) + m[0].length;
    const from = normalizeDate(m[1]);
    const to = m[2] ? normalizeDate(m[2]) : null;
    if (!cell) {
      if (prev) prev.extra_dates.push({ from, to });
      continue;
    }
    const entry = cell.replace(/\s+/g, " ").trim();
    const rec: ConditionalApproval = { equipment_type: classifyEquipment(entry), entry, ...splitEntry(entry), effective_from: from, effective_to: to, extra_dates: [] };
    out.push(rec);
    prev = rec;
  }
  return out.length ? { status: "ok", approvals: out } : { status: "parse_failed", approvals: [] };
}

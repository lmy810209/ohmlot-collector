// Build-time data access. Reads ../data (the collector's output) with node:fs; there is no database yet.
// Every page that uses this is statically generated, so nothing here runs at request time.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { addDaysUTC, BASELINE_DAYS, CHART_MIN_SNAPSHOTS, COVERED_LIST_DATE, hoursSince, STALE_HOURS } from "./format";
export { BASELINE_DAYS, CHART_MIN_SNAPSHOTS, COVERED_LIST_DATE, STALE_HOURS };

export const DATA_DIR = process.env.OHMLOT_DATA_DIR ?? path.resolve(process.cwd(), "..", "data");
// config/price-sources.json sits next to data/ at the repo root — read only for its length (task-changes-
// page.md §2's "of 11 sources" denominator), same env-override pattern as DATA_DIR so a test fixture can
// point both at once.
export const CONFIG_DIR = process.env.OHMLOT_CONFIG_DIR ?? path.resolve(process.cwd(), "..", "config");

export type Category = "humanoid" | "quadruped" | "desktop" | "arm";

/**
 * task-catalog.md §2: every catalog model is exactly one of these — never removed, always shown, the price
 * column always says why instead of going blank. Decided by checking a real page, not guessed; each model's
 * `tracking_status_evidence` names the URL and date behind the call.
 * - "tracked": buyable in the US right now, and the daily collector actually has a price source for it.
 * - "listed": a real product, but no price the collector can read automatically (`listed_reason` says why —
 *   quote/inquiry only, no public price, no US seller, etc.).
 * - "announced": not yet buyable at all (`expected_launch` if a date has been given).
 */
export type TrackingStatus = "tracked" | "listed" | "announced";

export interface Model {
  id: string;
  name: string;
  manufacturer: string;
  hq_country: string | null;
  category: Category;
  status: "shipping" | "preorder" | string;
  price_usd_min: number | null;
  price_usd_max: number | null;
  price_model: "purchase" | "quote" | "subscription" | string;
  subscription_usd_month: number | null;
  launch_year: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  official_url: string | null;
  buy_url: string | null;
  fcc_grantee_code: string | null;
  fcc_ids: string[];
  fcc_grant_date: string | null;
  resale_policy_note: string | null;
  sources: string[];
  data_source_license: string | null;
  /** Written by the collector (src/lib/parse.ts buildUsStatus); older seed rows may not have it yet. */
  us_status?: UsStatus | null;
  tracking_status: TrackingStatus;
  /** Only meaningful (non-null) when tracking_status is "listed". */
  listed_reason: string | null;
  /** Only meaningful (non-null) when tracking_status is "announced"; free text, e.g. "Q4 2026". */
  expected_launch: string | null;
  /** "<url> — checked YYYY-MM-DD: <what was found>". The verification behind tracking_status. */
  tracking_status_evidence: string;
  price_provenance: PriceProvenance;
  /** ISO date (or a bare year/month when that's all that's known) for the price_provenance_source citation.
   * Null when there's nothing to date (e.g. "observed" — the date is just whatever the latest snapshot is). */
  price_provenance_date: string | null;
  /** Short citation for where price_usd_min/max came from — a launch press release, which vendor page was
   * checked, etc. Null only for "observed", where the collector itself is the source. */
  price_provenance_source: string | null;
}

/**
 * task-prelaunch.md §A: most of the 32 seed prices came from a launch article or a third-party aggregator,
 * never independently checked. This is a fact about the *stored* price_usd_min/max, not about whether the
 * robot is buyable (that's tracking_status) — a model can be "listed" (real, purchasable) and still have a
 * "press" price if nobody has verified the number since launch.
 * - "observed": the collector's own daily snapshot (always the 15 tracking_status:"tracked" models).
 * - "vendor_page": a human checked an actual sales page and recorded the date (price_provenance_date).
 * - "press": from a launch article/press release — never independently confirmed. Never shown as a bare
 *   number (lib/format.ts's purchaseRange) — only inside the full "Launch price (...): $X — not verified,
 *   not current" sentence, and excluded from price filters/sorting.
 * - "unknown": no identifiable source at all. Same display/filter treatment as "press".
 */
export type PriceProvenance = "observed" | "vendor_page" | "press" | "unknown";

/** "Can I buy this in the US?" — one block per model, mirrored from data/models.json. */
export interface UsStatus {
  fcc_id: string | null;
  grant_date: string | null; // YYYY-MM-DD
  covered_list: "before" | "after" | "unknown";
  conditional_approval: boolean | null;
  conditional_approval_note: string | null;
  last_verified: string | null; // YYYY-MM-DD
  source_url: string | null;
}

/** The four states the site shows. "conditional" only exists after the Covered List date. */
export type UsStatusKind = "before" | "conditional" | "after" | "unknown";

export function usStatusKind(s: Pick<UsStatus, "covered_list" | "conditional_approval"> | null | undefined): UsStatusKind {
  if (!s || s.covered_list === "unknown") return "unknown";
  if (s.covered_list === "before") return "before";
  return s.conditional_approval === true ? "conditional" : "after";
}

export interface PriceRow {
  date: string; // YYYY-MM-DD (UTC)
  /** ISO instant this row was actually fetched (task-events.md §1) — absent on rows from before that schema
   * (2026-09-22/23), so this is optional here even though every row from 2026-09-24 on has it. */
  observed_at?: string;
  model_id: string;
  seller: string;
  variant: string;
  price_usd: number;
  available: boolean | null;
  url: string;
  flags: string[];
}

/* ---------- FCC Covered List: Conditional Approvals (from data/fcc/conditional-approvals.json) ----------
   Written weekly by src/fcc.ts, which parses PSHSB public notices from docs.fcc.gov — see
   context/fcc-api-notes.md. Shape mirrors ApprovalRecord/ApprovalStore in src/fcc.ts exactly, since this is
   the same JSON read as plain data (no shared TS module between the collector and the site). */
export interface ConditionalApproval {
  id: string;
  /** Which of Appendix B's three columns FCC itself printed this entry under (task-fcc-4.md §1) — a fact
   * about the filing, not a judgment about the device: FCC placement doesn't reliably track device type
   * (Ascento, Inc.'s Ascento Guard is a ground robot, filed under "uas"). */
  fcc_column: "uas" | "routers" | "robotic_devices";
  entry: string;
  company: string | null;
  models: string | null;
  effective_from: string | null;
  effective_to: string | null;
  extra_dates: { from: string | null; to: string | null }[];
  source_da: string;
  source_url: string;
  also_in: string[];
  first_seen: string;
  /** Manufacturer name from this catalog the record's company text matched, when it does. */
  matched_manufacturer: string | null;
}
export interface NoticeStatus {
  da: string;
  released: string;
  url: string;
  fetched: string | null;
  status: string;
  records: number;
  error: string | null;
}
export interface ApprovalStore {
  updated: string;
  notices: NoticeStatus[];
  approvals: ConditionalApproval[];
}

/* ---------- Collector events (from data/events.jsonl) ----------
   Written daily by src/events.ts's generateEvents — a pure snapshot diff, never hand-entered (task-events.md
   §5). Shape mirrors CollectorEvent in src/events.ts exactly, the same plain-JSON-mirroring pattern as
   ApprovalRecord above. */
export type EventType =
  | "price_changed"
  | "availability_changed"
  | "discount_started"
  | "discount_ended"
  | "variant_added"
  | "variant_removed"
  | "lead_time_changed"
  | "product_unpublished"
  | "observation_started";

export interface CollectorEvent {
  date: string;
  type: EventType;
  model_id: string;
  seller: string;
  variant: string;
  from: unknown;
  to: unknown;
  source_url: string;
  /** task-events-2.md §1: true when this row is not evidence anything changed in the world — only that
   * collection started observing it, or started observing it differently. Hidden by default on /changes,
   * never dropped from the data. */
  observation_change: boolean;
  reason: string | null;
}

interface Store {
  models: Model[];
  prices: PriceRow[];
  approvals: ApprovalStore | null;
  events: CollectorEvent[];
}

export interface ModelIdChange {
  date: string;
  old_id: string;
  new_ids: string[];
  reason: string;
  remap: { by: "url"; rules: { url_contains: string; new_id: string }[] };
  note: string;
}

/** task-catalog.md §1: "과거를 조작하지 않는다" — a model_id split is never applied by rewriting
 * data/prices/*.jsonl. Instead data/model-id-changes.json records the split, and every historical row with
 * the old, now-retired model_id is remapped to its correct new id right here at read time, by matching the
 * row's own url against each rule's url_contains. A row whose model_id was never split, or whose url matches
 * no rule (should not happen for a real change, but never silently mis-tags a row if it does), passes
 * through unchanged. config/price-sources.json's default_model is updated on the same date as the change, so
 * every row collected from that date on already carries the new id directly and never needs remapping.
 */
function remapModelId(r: PriceRow, changes: ModelIdChange[]): PriceRow {
  const change = changes.find((c) => c.old_id === r.model_id);
  if (!change) return r;
  const rule = change.remap.rules.find((rule) => r.url.includes(rule.url_contains));
  return rule ? { ...r, model_id: rule.new_id } : r;
}

let store: Store | null = null;

function load(): Store {
  if (store) return store;
  const models = JSON.parse(readFileSync(path.join(DATA_DIR, "models.json"), "utf8")) as Model[];

  const modelIdChangesPath = path.join(DATA_DIR, "model-id-changes.json");
  const modelIdChanges: ModelIdChange[] = existsSync(modelIdChangesPath) ? (JSON.parse(readFileSync(modelIdChangesPath, "utf8")) as ModelIdChange[]) : [];

  const pricesDir = path.join(DATA_DIR, "prices");
  const prices: PriceRow[] = existsSync(pricesDir)
    ? readdirSync(pricesDir)
        .filter((f) => f.endsWith(".jsonl"))
        .sort()
        .flatMap((f) =>
          readFileSync(path.join(pricesDir, f), "utf8")
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line) as PriceRow)
            // Shopify's placeholder name for a single-variant product.
            .map((r) => (r.variant === "Default Title" ? { ...r, variant: "Standard" } : r))
            .map((r) => remapModelId(r, modelIdChanges)),
        )
        // "Contact us" items carry $90,000 / $100,000 placeholders; they never reach the UI.
        .filter((r) => !r.flags?.includes("placeholder_price"))
    : [];

  const approvalsPath = path.join(DATA_DIR, "fcc", "conditional-approvals.json");
  const approvals = existsSync(approvalsPath) ? (JSON.parse(readFileSync(approvalsPath, "utf8")) as ApprovalStore) : null;

  const eventsPath = path.join(DATA_DIR, "events.jsonl");
  const events: CollectorEvent[] = existsSync(eventsPath)
    ? readFileSync(eventsPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as CollectorEvent)
    : [];

  store = { models, prices, approvals, events };
  return store;
}

export function getModels(): Model[] {
  return load().models;
}

export function getModel(id: string): Model | undefined {
  return load().models.find((m) => m.id === id);
}

export function getApprovalStore(): ApprovalStore | null {
  return load().approvals;
}

/** Robotic-device Conditional Approvals read from FCC public notices — the only Conditional Approvals data
 * this site stores comes from this file, never from press coverage (context/task-fcc-2.md §3). The store also
 * holds the UAS and Routers columns (task-fcc-4.md §1-2, for the cross-check in conditionalApprovalCheck
 * below); this accessor is specifically the Robotic Devices column, for display as robotic-device entries. */
export function roboticApprovals(): ConditionalApproval[] {
  return (load().approvals?.approvals ?? []).filter((a) => a.fcc_column === "robotic_devices");
}

export type ConditionalApprovalCheck =
  | { state: "not_checked" }
  | { state: "not_on_list"; asOf: string }
  | { state: "approved"; asOf: string; approval: ConditionalApproval };

/**
 * task-fcc-3.md §5: "확인 안 됨" (the weekly notice collector has never run) is a different fact from "checked
 * and this manufacturer isn't on the list" (it has run, and found no match) — conflating them was the whole
 * complaint. Matches by manufacturer name against the same substring rule src/fcc.ts uses when it stamps
 * matched_manufacturer, so a model matches here exactly when its own manufacturer produced that stamp.
 *
 * Deliberately checks `store.approvals` unfiltered — all three Appendix B columns, not just
 * fcc_column === "robotic_devices" (task-fcc-4.md §1-2). FCC's own column placement doesn't reliably track
 * device type, so a manufacturer match under UAS or Routers is still real evidence of a Conditional Approval
 * on file for them; restricting this check to the Robotic Devices column would miss exactly the case this
 * task exists to catch.
 */
export function conditionalApprovalCheck(model: Model): ConditionalApprovalCheck {
  const store = getApprovalStore();
  if (!store) return { state: "not_checked" };
  const approval = store.approvals.find((a) => a.matched_manufacturer === model.manufacturer);
  return approval ? { state: "approved", asOf: store.updated, approval } : { state: "not_on_list", asOf: store.updated };
}

export function getPriceRows(modelId?: string): PriceRow[] {
  const rows = load().prices;
  return modelId ? rows.filter((r) => r.model_id === modelId) : rows;
}

export function trackedModelIds(): Set<string> {
  return new Set(load().prices.map((r) => r.model_id));
}

/** Most recent collection date across all price rows, or null before the first run. */
export function lastUpdated(): string | null {
  const dates = load().prices.map((r) => r.date);
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
}

const SELLERS: Record<string, string> = {
  "unitree-official": "Unitree (official store)",
  "pollen-official": "Pollen Robotics (official store)",
  "petoi-official": "Petoi (official store)",
  "keyi-official": "KEYi Tech (official store)",
  "deeprobotics-us": "Deep Robotics US",
  "1x-official": "1X (official)",
};

export function sellerName(seller: string): string {
  if (SELLERS[seller]) return SELLERS[seller];
  return seller
    .replace(/-official$/, " (official)")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export type VariantKind = "purchase" | "subscription" | "accessory";

/** Store variants that are not the robot itself. They stay in the price list but never set the range or the chart. */
export function variantKind(variant: string): VariantKind {
  if (/subscription|per month|\/mo\b/i.test(variant)) return "subscription";
  // An accessory is *named* as one ("Lite3 Controller"); a robot sold "with controller" is still the robot.
  if (/^(?!.*\bwith(out)?\b).*\b(controller|remote|charging dock|dock|battery|keychain|collar|tote bag|tote|ball)\s*$/i.test(variant)) return "accessory";
  return "purchase";
}

export interface SellerPrice {
  seller: string;
  sellerName: string;
  variant: string;
  kind: VariantKind;
  price_usd: number;
  available: boolean | null;
  url: string;
  date: string;
}

/** Latest observation for each seller + variant, cheapest first. Keyed by seller+url+variant, not just
 * seller+variant: Pollen sells two distinct products (Reachy Mini Lite and Wireless) under the same model,
 * same seller, and the same Shopify placeholder variant name ("Default Title" → "Standard") — url is what
 * actually tells them apart. Without it, one product's rows silently overwrite the other's in this map. */
export function latestPrices(modelId: string): SellerPrice[] {
  const byKey = new Map<string, PriceRow>();
  for (const r of getPriceRows(modelId)) {
    const key = `${r.seller}|${r.url}|${r.variant}`;
    const prev = byKey.get(key);
    if (!prev || r.date > prev.date) byKey.set(key, r);
  }
  return [...byKey.values()]
    .map((r) => ({
      seller: r.seller,
      sellerName: sellerName(r.seller),
      variant: r.variant,
      kind: variantKind(r.variant),
      price_usd: r.price_usd,
      available: r.available,
      url: r.url,
      date: r.date,
    }))
    .sort((a, b) => a.price_usd - b.price_usd);
}

export interface PriceSeries {
  key: string;
  label: string;
  points: { date: string; price: number }[];
}

/** Last path segment of a product URL, prettified — only used to tell two products apart in a chart legend
 * when they'd otherwise share an identical seller+variant label (see priceHistory below). */
function productSlug(url: string): string {
  const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
  return last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One series per seller + variant, ordered by first-seen price so colors stay stable as data grows. Keyed by
 * seller+url+variant, not just seller+variant: Pollen sells two distinct products (Reachy Mini Lite and
 * Wireless) under the same model, same seller, and the same Shopify placeholder variant name ("Default
 * Title" → "Standard") — without url in the key, one product's points would silently merge into the
 * other's series instead of getting its own. When that ambiguity exists, the series label also gets a
 * product-name suffix so the legend doesn't show two identical labels for genuinely different products. */
export function priceHistory(modelId: string): { dates: string[]; series: PriceSeries[] } {
  const rows = getPriceRows(modelId).filter((r) => variantKind(r.variant) === "purchase");
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const sellers = new Set(rows.map((r) => r.seller));
  const urlsBySellerVariant = new Map<string, Set<string>>();
  for (const r of rows) {
    const svKey = `${r.seller}|${r.variant}`;
    if (!urlsBySellerVariant.has(svKey)) urlsBySellerVariant.set(svKey, new Set());
    urlsBySellerVariant.get(svKey)!.add(r.url);
  }
  const map = new Map<string, PriceSeries>();
  for (const r of rows) {
    const key = `${r.seller}|${r.url}|${r.variant}`;
    let s = map.get(key);
    if (!s) {
      const ambiguous = (urlsBySellerVariant.get(`${r.seller}|${r.variant}`)?.size ?? 1) > 1;
      const base = sellers.size > 1 ? `${sellerName(r.seller)} · ${r.variant}` : r.variant;
      s = { key, label: ambiguous ? `${base} (${productSlug(r.url)})` : base, points: [] };
      map.set(key, s);
    }
    s.points.push({ date: r.date, price: r.price_usd });
  }
  const series = [...map.values()];
  for (const s of series) s.points.sort((a, b) => a.date.localeCompare(b.date));
  series.sort((a, b) => a.points[0].price - b.points[0].price);
  return { dates, series };
}

export interface FccFact {
  fcc_id: string;
  grant_date: string | null;
  after_covered_list: boolean | null;
  description: string | null;
  /** Always "model": FCC IDs are hand-verified seed data now, not collected automatically (context/task-fcc-2.md). */
  source: "model";
  /** This ID's own position, with the model's conditional-approval flag applied. */
  status: UsStatusKind;
}

function coveredList(date: string | null): UsStatus["covered_list"] {
  return date ? (date < COVERED_LIST_DATE ? "before" : "after") : "unknown";
}

/** FCC facts for a model, from the hand-verified seed (`fcc_ids` + `us_status`). Never inferred or scraped. */
export function fccFacts(model: Model): FccFact[] {
  const conditional = model.us_status?.conditional_approval ?? null;
  return model.fcc_ids.map((id) => {
    const date = (id === model.us_status?.fcc_id ? model.us_status.grant_date : null) ?? model.fcc_grant_date ?? null;
    return {
      fcc_id: id,
      grant_date: date,
      after_covered_list: date ? date >= COVERED_LIST_DATE : null,
      description: null,
      source: "model",
      status: usStatusKind({ covered_list: coveredList(date), conditional_approval: conditional }),
    };
  });
}

/**
 * The model's us_status block, or — for seed rows the collector has not stamped yet — the same block derived
 * from the registry / seed grant date with conditional approval and last_verified left unknown.
 */
export function modelUsStatus(model: Model): UsStatus {
  const base: UsStatus = model.us_status ?? {
    fcc_id: model.fcc_ids[0] ?? null,
    grant_date: fccFacts(model).find((f) => f.grant_date)?.grant_date ?? null,
    covered_list: coveredList(fccFacts(model).find((f) => f.grant_date)?.grant_date ?? null),
    conditional_approval: null,
    conditional_approval_note: null,
    last_verified: null,
    source_url: null,
  };
  // task-fcc-3.md §5: a hand-set true/false in the seed always wins (a human overrode it); otherwise fill it
  // live from the weekly-collected Conditional Approvals list, so "checked, not on the list" and "never
  // checked" read differently instead of both landing on the same "Not checked" text.
  if (base.conditional_approval == null) {
    const check = conditionalApprovalCheck(model);
    if (check.state === "approved") {
      return { ...base, conditional_approval: true, conditional_approval_note: `DoW Conditional Approval since ${check.approval.effective_from ?? "an unspecified date"} (FCC ${check.approval.source_da}), as of ${check.asOf}.` };
    }
    if (check.state === "not_on_list") {
      return { ...base, conditional_approval: false, conditional_approval_note: `Not on the FCC's Conditional Approvals list (checked all three Appendix B columns — UAS, Routers, and Robotic Devices) as of ${check.asOf}.` };
    }
  }
  return base;
}

export interface FccSearchItem {
  fcc_id: string;
  grantee_code: string | null;
  model_id: string | null;
  model_name: string | null;
  manufacturer: string | null;
  grant_date: string | null;
  after_covered_list: boolean | null;
  description: string | null;
  status: UsStatusKind;
}

/** Everything the /fcc search can match: every FCC ID on file for a catalog model. */
export function fccSearchItems(): FccSearchItem[] {
  const items: FccSearchItem[] = [];
  for (const m of getModels()) {
    for (const f of fccFacts(m)) {
      items.push({
        fcc_id: f.fcc_id,
        grantee_code: m.fcc_grantee_code,
        model_id: m.id,
        model_name: m.name,
        manufacturer: m.manufacturer,
        grant_date: f.grant_date,
        after_covered_list: f.after_covered_list,
        description: f.description,
        status: f.status,
      });
    }
  }
  return items.sort((a, b) => (b.grant_date ?? "").localeCompare(a.grant_date ?? "") || a.fcc_id.localeCompare(b.fcc_id));
}

/* ---------- Home page: stats, table rows, drawer payloads ---------- */

export interface PriceChange {
  model_id: string;
  seller: string;
  variant: string;
  from: number;
  to: number;
  date: string;
  prev_date: string;
}

/**
 * Seller+variant rows whose price in the latest snapshot differs from the previous snapshot. Keyed with url
 * included, not just model_id+seller+variant: Pollen sells two distinct products (Reachy Mini Lite and
 * Wireless) under the same model, same seller, and the same Shopify placeholder variant name ("Default
 * Title" → "Standard"). Without url in the key, the two rows collide in `prev` (one overwrites the other),
 * and the latest-snapshot loop below then compares *both* products against whichever one won that
 * collision — fabricating a price "change" from one product's old price to the other's unrelated current
 * price even when neither actually changed. Confirmed live: this produced a false "▲ $100 (+25%)" home-page
 * badge for Reachy Mini with genuinely flat prices on both dates.
 */
export function priceChanges(): { changes: PriceChange[]; latest: string | null; previous: string | null; first: string | null; snapshots: number } {
  const rows = load().prices;
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const latest = dates.at(-1) ?? null;
  const previous = dates.at(-2) ?? null;
  const first = dates[0] ?? null;
  if (!latest || !previous) return { changes: [], latest, previous, first, snapshots: dates.length };
  const key = (r: PriceRow) => `${r.model_id}|${r.seller}|${r.url}|${r.variant}`;
  const prev = new Map(rows.filter((r) => r.date === previous).map((r) => [key(r), r]));
  const changes: PriceChange[] = [];
  for (const r of rows) {
    if (r.date !== latest) continue;
    const p = prev.get(key(r));
    if (p && p.price_usd !== r.price_usd) {
      changes.push({ model_id: r.model_id, seller: r.seller, variant: r.variant, from: p.price_usd, to: r.price_usd, date: latest, prev_date: previous });
    }
  }
  return { changes, latest, previous, first, snapshots: dates.length };
}

/** Cheapest tracked price per snapshot date for a model (the sparkline series). */
export function sparkline(modelId: string): { dates: string[]; values: number[] } {
  const byDate = new Map<string, number>();
  for (const r of getPriceRows(modelId)) {
    if (variantKind(r.variant) !== "purchase") continue;
    const cur = byDate.get(r.date);
    if (cur == null || r.price_usd < cur) byDate.set(r.date, r.price_usd);
  }
  const dates = [...byDate.keys()].sort();
  return { dates, values: dates.map((d) => byDate.get(d) as number) };
}

export type FccStatus = UsStatusKind;

/**
 * 작업2: the home table's own stock read, aggregated across a tracked model's latest purchase variants —
 * deliberately coarser than the per-variant `In stock`/`Sold out` badges the detail page shows, and never
 * guessed. A model that's never been read by the collector (`tracking_status !== "tracked"`) has no stock
 * signal to aggregate at all, so it's its own state rather than being folded into "unknown".
 * - "in_stock": at least one purchase variant is available === true.
 * - "out_of_stock": every purchase variant is available === false (and there's at least one).
 * - "stock_unknown": no row said true, and at least one said null/missing — never inferred from price
 *   presence or anything else.
 * - "not_tracked": tracking_status is "listed" or "announced" — the collector has no row for this model at
 *   all, so there's nothing to aggregate.
 */
export type Availability = "in_stock" | "out_of_stock" | "stock_unknown" | "not_tracked";

export function aggregateAvailability(purchaseRows: Pick<SellerPrice, "available">[]): Exclude<Availability, "not_tracked"> {
  if (purchaseRows.some((p) => p.available === true)) return "in_stock";
  if (purchaseRows.length > 0 && purchaseRows.every((p) => p.available === false)) return "out_of_stock";
  return "stock_unknown";
}

export interface RobotRow {
  id: string;
  name: string;
  manufacturer: string;
  hq_country: string | null;
  category: Category;
  status: string;
  launch_year: number | null;
  price_model: string;
  price_usd_min: number | null;
  price_usd_max: number | null;
  subscription_usd_month: number | null;
  /** True exactly when tracking_status is "tracked" — the deliberate, verified classification
   * (task-catalog.md §2), not a "does it happen to have rows today" guess. */
  tracked: boolean;
  tracking_status: TrackingStatus;
  listed_reason: string | null;
  expected_launch: string | null;
  price_provenance: PriceProvenance;
  price_provenance_date: string | null;
  price_provenance_source: string | null;
  /** Cheapest / dearest variant in the latest snapshot, when tracked. */
  latest_min: number | null;
  latest_max: number | null;
  latest_date: string | null;
  /** What the table sorts on: the tracked minimum when available, else the published minimum — but never a
   * "press"/"unknown" price (task-prelaunch.md §A.3: an unverified number must never drive a sort, same as
   * it must never drive a filter). Those rows sort to the very end, same treatment as no price at all. */
  sort_price: number;
  spark: number[];
  spark_dates: string[];
  /** % change of the cheapest tracked price, latest vs previous snapshot. */
  change_pct: number | null;
  /** Yesterday → today move of the cheapest purchase variant; null when untracked or on the first day. */
  delta: Delta | null;
  /** Purchase variants in the latest snapshot. */
  variants: number;
  fcc_status: FccStatus;
  fcc_ids: string[];
  fcc_grant_date: string | null;
  availability: Availability;
}

export function robotRows(): RobotRow[] {
  return getModels().map((m) => {
    const sp = sparkline(m.id);
    const latest = sp.values.at(-1) ?? null;
    const prev = sp.values.length >= 2 ? sp.values.at(-2)! : null;
    const latestRows = latestPrices(m.id).filter((p) => p.kind === "purchase");
    const latestMax = latestRows.length ? latestRows[latestRows.length - 1].price_usd : null;
    const latestDate = latestRows.reduce<string | null>((acc, p) => (acc && acc > p.date ? acc : p.date), null);
    const priceUnverified = m.price_provenance === "press" || m.price_provenance === "unknown";
    const publishedMin = m.price_model === "quote" || m.price_usd_min == null || priceUnverified ? Number.POSITIVE_INFINITY : m.price_usd_min;
    const us = modelUsStatus(m);
    const fcc_status: FccStatus = usStatusKind(us);
    return {
      id: m.id,
      name: m.name,
      manufacturer: m.manufacturer,
      hq_country: m.hq_country,
      category: m.category,
      status: m.status,
      launch_year: m.launch_year,
      price_model: m.price_model,
      price_usd_min: m.price_usd_min,
      price_usd_max: m.price_usd_max,
      subscription_usd_month: m.subscription_usd_month,
      tracked: m.tracking_status === "tracked",
      tracking_status: m.tracking_status,
      listed_reason: m.listed_reason,
      expected_launch: m.expected_launch,
      price_provenance: m.price_provenance,
      price_provenance_date: m.price_provenance_date,
      price_provenance_source: m.price_provenance_source,
      latest_min: latest,
      latest_max: latestMax,
      latest_date: latestDate,
      sort_price: latest ?? publishedMin,
      spark: sp.values,
      spark_dates: sp.dates,
      change_pct: latest != null && prev != null && prev !== 0 ? ((latest - prev) / prev) * 100 : null,
      delta: deltaFor(m.id),
      variants: latestRows.length,
      fcc_status,
      fcc_ids: m.fcc_ids,
      fcc_grant_date: us.grant_date,
      availability: m.tracking_status !== "tracked" ? "not_tracked" : aggregateAvailability(latestRows),
    };
  });
}

/** Headline range from the latest snapshot's purchase variants, or null when not tracked. */
export function trackedRange(latest: SellerPrice[]): { min: number; max: number } | null {
  const p = latest.filter((x) => x.kind === "purchase");
  return p.length ? { min: p[0].price_usd, max: p[p.length - 1].price_usd } : null;
}

export interface RobotDetail {
  model: Model;
  latest: SellerPrice[];
  /** Latest rows with their previous-snapshot price, for the "yesterday → today" view. */
  deltas: VariantDelta[];
  history: { dates: string[]; series: PriceSeries[] };
  fcc: FccFact[];
}

/** Everything the detail drawer needs, keyed by model id (serialized into the home page). */
export function robotDetails(): Record<string, RobotDetail> {
  const out: Record<string, RobotDetail> = {};
  for (const m of getModels()) {
    out[m.id] = { model: m, latest: latestPrices(m.id), deltas: variantDeltas(m.id), history: priceHistory(m.id), fcc: fccFacts(m) };
  }
  return out;
}

/* ---------- Low-data rules (guide §6) ---------- */


export interface Delta {
  from: number;
  to: number;
  amount: number;
  pct: number;
  from_date: string;
  to_date: string;
}

/** Cheapest purchase variant, latest vs previous snapshot. */
export function deltaFor(modelId: string): Delta | null {
  const sp = sparkline(modelId);
  if (sp.values.length < 2) return null;
  const from = sp.values[sp.values.length - 2];
  const to = sp.values[sp.values.length - 1];
  return { from, to, amount: to - from, pct: from ? ((to - from) / from) * 100 : 0, from_date: sp.dates[sp.dates.length - 2], to_date: sp.dates[sp.dates.length - 1] };
}

export interface VariantDelta extends SellerPrice {
  from: number | null;
  from_date: string | null;
}

/** Every latest row paired with the same seller+url+variant from the previous snapshot. Keyed with url, not
 * just seller+variant, for the same reason as latestPrices above (Pollen's Lite/Wireless collision). */
export function variantDeltas(modelId: string): VariantDelta[] {
  const rows = getPriceRows(modelId);
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const prevDate = dates.length >= 2 ? dates[dates.length - 2] : null;
  const prev = new Map(rows.filter((r) => r.date === prevDate).map((r) => [`${r.seller}|${r.url}|${r.variant}`, r]));
  return latestPrices(modelId).map((p) => {
    const q = prevDate ? prev.get(`${p.seller}|${p.url}|${p.variant}`) : undefined;
    return { ...p, from: q?.price_usd ?? null, from_date: q ? prevDate : null };
  });
}

export interface RunSummary {
  latest: string | null;
  previous: string | null;
  first: string | null;
  snapshots: number;
  /** Price rows and distinct stores in the latest snapshot. */
  rows: number;
  sellers: number;
  /** Counts by tracking_status (task-catalog.md §2-3) — the site's own honest "N tracked · M listed ·
   * K announced" language, never a bare model-count. `models` is their sum, for anything that still needs
   * "how many robots does this catalog know about at all". */
  tracked: number;
  listed: number;
  announced: number;
  models: number;
  changes: PriceChange[];
  baselineDay: number;
  baselineDays: number;
  /** Earliest `observed_at` among the latest snapshot's rows — when collection actually started, not the
   * cron's scheduled (and never-honored) time. Null when no row on file has a valid observed_at (task-
   * runtime-label.md §1). */
  collectedAt: string | null;
}

/** What "Today's run" and the three summary cards show. */
export function runSummary(): RunSummary {
  const all = load().prices;
  const pc = priceChanges();
  const latestRows = pc.latest ? all.filter((r) => r.date === pc.latest) : [];
  const models = getModels();
  const countBy = (s: TrackingStatus) => models.filter((m) => m.tracking_status === s).length;
  const observedAts = latestRows.map((r) => r.observed_at).filter((v): v is string => !!v && !Number.isNaN(new Date(v).getTime()));
  return {
    latest: pc.latest,
    previous: pc.previous,
    first: pc.first,
    snapshots: pc.snapshots,
    rows: latestRows.length,
    sellers: new Set(latestRows.map((r) => r.seller)).size,
    tracked: countBy("tracked"),
    listed: countBy("listed"),
    announced: countBy("announced"),
    models: models.length,
    changes: pc.changes,
    baselineDay: Math.min(pc.snapshots, BASELINE_DAYS),
    baselineDays: BASELINE_DAYS,
    collectedAt: observedAts.length ? observedAts.reduce((a, b) => (a < b ? a : b)) : null,
  };
}

/* ---------- /changes page (data/events.jsonl) ---------- */

export interface ChangeEventView extends CollectorEvent {
  model_name: string;
  seller_name: string;
}

function resolveEvent(e: CollectorEvent): ChangeEventView {
  return { ...e, model_name: getModel(e.model_id)?.name ?? e.model_id, seller_name: sellerName(e.seller) };
}

/** Every collector event, newest first. Same-day events keep the order generateEvents produced them in
 * (stable sort) — there is no finer-grained timestamp to order by within one day. */
export function getEvents(): ChangeEventView[] {
  return load()
    .events.map(resolveEvent)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Real-world changes only — what task-changes-page.md §1 calls the list itself. */
export function realEvents(): ChangeEventView[] {
  return getEvents().filter((e) => !e.observation_change);
}

/** "Observation started" rows — hidden by default behind the /changes toggle, never deleted. */
export function observationEvents(): ChangeEventView[] {
  return getEvents().filter((e) => e.observation_change);
}

export interface CollectionStatus {
  /** Max observed_at across every price row on file, or null before the schema/first run. */
  lastObservedAt: string | null;
  /** Hours since lastObservedAt, or null when there's no observed_at to measure from. */
  staleHours: number | null;
  /** true once staleHours exceeds STALE_HOURS — the daily-run health check going red. */
  isStale: boolean;
  todayDate: string | null;
  /** Price points collected on todayDate. */
  todayRows: number;
  /** Distinct seller+url pairs represented in todayDate's rows, out of totalSources configured. */
  todaySourcesOk: number;
  totalSources: number;
  baselineDay: number;
  baselineDays: number;
  /** Real (non-observation) events dated in the trailing 7 days ending on todayDate. */
  weekRealEvents: number;
}

/**
 * The health-check card at the top of /changes (task-changes-page.md §2). `now` defaults to the actual
 * build-time clock but takes a fixed value in tests, so the 36-hour staleness flag is verifiable without
 * waiting 36 hours or editing real data — see test/collectionStatus.test.ts.
 */
export function collectionStatus(now: Date = new Date()): CollectionStatus {
  const all = load().prices;
  const observedAts = all.map((r) => r.observed_at).filter((v): v is string => !!v);
  const lastObservedAt = observedAts.length ? observedAts.reduce((a, b) => (a > b ? a : b)) : null;
  const staleHours = lastObservedAt ? hoursSince(lastObservedAt, now) : null;

  const todayDate = lastUpdated();
  const todayRows = todayDate ? all.filter((r) => r.date === todayDate) : [];
  const todaySourcesOk = new Set(todayRows.map((r) => `${r.seller}\u0000${r.url}`)).size;
  const sourcesConfigPath = path.join(CONFIG_DIR, "price-sources.json");
  const totalSources = existsSync(sourcesConfigPath) ? (JSON.parse(readFileSync(sourcesConfigPath, "utf8")) as unknown[]).length : todaySourcesOk;

  const pc = priceChanges();
  const weekStart = todayDate ? addDaysUTC(todayDate, -6) : null;
  const weekRealEvents = weekStart && todayDate ? realEvents().filter((e) => e.date >= weekStart && e.date <= todayDate).length : 0;

  return {
    lastObservedAt,
    staleHours,
    isStale: staleHours != null && staleHours > STALE_HOURS,
    todayDate,
    todayRows: todayRows.length,
    todaySourcesOk,
    totalSources,
    baselineDay: Math.min(pc.snapshots, BASELINE_DAYS),
    baselineDays: BASELINE_DAYS,
    weekRealEvents,
  };
}

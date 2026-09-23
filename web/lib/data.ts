// Build-time data access. Reads ../data (the collector's output) with node:fs; there is no database yet.
// Every page that uses this is statically generated, so nothing here runs at request time.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { COVERED_LIST_DATE } from "./format";
export { COVERED_LIST_DATE };

export const DATA_DIR = process.env.OHMLOT_DATA_DIR ?? path.resolve(process.cwd(), "..", "data");

export type Category = "humanoid" | "quadruped" | "desktop" | "arm";

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

export interface FccGrant {
  fcc_id: string;
  grantee_code: string;
  grant_date: string | null;
  description: string | null;
  after_covered_list: boolean | null;
  first_seen?: string;
}

interface Store {
  models: Model[];
  prices: PriceRow[];
  grants: Record<string, FccGrant>;
}

let store: Store | null = null;

function load(): Store {
  if (store) return store;
  const models = JSON.parse(readFileSync(path.join(DATA_DIR, "models.json"), "utf8")) as Model[];

  const pricesDir = path.join(DATA_DIR, "prices");
  const prices: PriceRow[] = existsSync(pricesDir)
    ? readdirSync(pricesDir)
        .filter((f) => f.endsWith(".jsonl"))
        .sort()
        .flatMap((f) =>
          readFileSync(path.join(pricesDir, f), "utf8")
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line) as PriceRow),
        )
        // "Contact us" items carry $90,000 / $100,000 placeholders; they never reach the UI.
        .filter((r) => !r.flags?.includes("placeholder_price"))
    : [];

  const grantsPath = path.join(DATA_DIR, "fcc", "grants.json");
  const grants = existsSync(grantsPath)
    ? (JSON.parse(readFileSync(grantsPath, "utf8")) as Record<string, FccGrant>)
    : {};

  store = { models, prices, grants };
  return store;
}

export function getModels(): Model[] {
  return load().models;
}

export function getModel(id: string): Model | undefined {
  return load().models.find((m) => m.id === id);
}

export function getGrants(): Record<string, FccGrant> {
  return load().grants;
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

/** Latest observation for each seller + variant, cheapest first. */
export function latestPrices(modelId: string): SellerPrice[] {
  const byKey = new Map<string, PriceRow>();
  for (const r of getPriceRows(modelId)) {
    const key = `${r.seller}|${r.variant}`;
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

/** One series per seller + variant, ordered by first-seen price so colors stay stable as data grows. */
export function priceHistory(modelId: string): { dates: string[]; series: PriceSeries[] } {
  const rows = getPriceRows(modelId).filter((r) => variantKind(r.variant) === "purchase");
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const sellers = new Set(rows.map((r) => r.seller));
  const map = new Map<string, PriceSeries>();
  for (const r of rows) {
    const key = `${r.seller}|${r.variant}`;
    let s = map.get(key);
    if (!s) {
      s = { key, label: sellers.size > 1 ? `${sellerName(r.seller)} · ${r.variant}` : r.variant, points: [] };
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
  /** "registry" when the daily FCC collector has seen the ID; "model" when only the seed data has it. */
  source: "registry" | "model";
}

/** FCC facts for a model: the collector's registry wins, the seed grant date is the fallback. */
export function fccFacts(model: Model): FccFact[] {
  const grants = getGrants();
  return model.fcc_ids.map((id) => {
    const g = grants[id];
    const date = g?.grant_date ?? model.fcc_grant_date ?? null;
    return {
      fcc_id: id,
      grant_date: date,
      after_covered_list: date ? date >= COVERED_LIST_DATE : null,
      description: g?.description ?? null,
      source: g ? "registry" : "model",
    };
  });
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
}

/** Everything the /fcc search can match: every model FCC ID plus registry grants not tied to a model. */
export function fccSearchItems(): FccSearchItem[] {
  const items: FccSearchItem[] = [];
  const seen = new Set<string>();
  for (const m of getModels()) {
    for (const f of fccFacts(m)) {
      seen.add(f.fcc_id);
      items.push({
        fcc_id: f.fcc_id,
        grantee_code: m.fcc_grantee_code,
        model_id: m.id,
        model_name: m.name,
        manufacturer: m.manufacturer,
        grant_date: f.grant_date,
        after_covered_list: f.after_covered_list,
        description: f.description,
      });
    }
  }
  for (const g of Object.values(getGrants())) {
    if (seen.has(g.fcc_id)) continue;
    items.push({
      fcc_id: g.fcc_id,
      grantee_code: g.grantee_code,
      model_id: null,
      model_name: null,
      manufacturer: null,
      grant_date: g.grant_date,
      after_covered_list: g.after_covered_list,
      description: g.description,
    });
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

/** Seller+variant rows whose price in the latest snapshot differs from the previous snapshot. */
export function priceChanges(): { changes: PriceChange[]; latest: string | null; previous: string | null; first: string | null; snapshots: number } {
  const rows = load().prices;
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const latest = dates.at(-1) ?? null;
  const previous = dates.at(-2) ?? null;
  const first = dates[0] ?? null;
  if (!latest || !previous) return { changes: [], latest, previous, first, snapshots: dates.length };
  const key = (r: PriceRow) => `${r.model_id}|${r.seller}|${r.variant}`;
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

export type FccStatus = "before" | "after" | "unknown" | "none";

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
  tracked: boolean;
  /** Cheapest / dearest variant in the latest snapshot, when tracked. */
  latest_min: number | null;
  latest_max: number | null;
  latest_date: string | null;
  /** What the table sorts on: the tracked minimum when available, else the published minimum. */
  sort_price: number;
  spark: number[];
  spark_dates: string[];
  /** % change of the cheapest tracked price, latest vs previous snapshot. */
  change_pct: number | null;
  fcc_status: FccStatus;
  fcc_ids: string[];
  fcc_grant_date: string | null;
}

export function robotRows(): RobotRow[] {
  const tracked = trackedModelIds();
  return getModels().map((m) => {
    const sp = sparkline(m.id);
    const latest = sp.values.at(-1) ?? null;
    const prev = sp.values.length >= 2 ? sp.values.at(-2)! : null;
    const latestRows = latestPrices(m.id).filter((p) => p.kind === "purchase");
    const latestMax = latestRows.length ? latestRows[latestRows.length - 1].price_usd : null;
    const latestDate = latestRows.reduce<string | null>((acc, p) => (acc && acc > p.date ? acc : p.date), null);
    const publishedMin = m.price_model === "quote" || m.price_usd_min == null ? Number.POSITIVE_INFINITY : m.price_usd_min;
    const facts = fccFacts(m);
    const fcc_status: FccStatus =
      facts.length === 0 ? "none" : facts.some((f) => f.after_covered_list === true) ? "after" : facts.every((f) => f.after_covered_list === false) ? "before" : "unknown";
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
      tracked: tracked.has(m.id),
      latest_min: latest,
      latest_max: latestMax,
      latest_date: latestDate,
      sort_price: latest ?? publishedMin,
      spark: sp.values,
      spark_dates: sp.dates,
      change_pct: latest != null && prev != null && prev !== 0 ? ((latest - prev) / prev) * 100 : null,
      fcc_status,
      fcc_ids: m.fcc_ids,
      fcc_grant_date: facts[0]?.grant_date ?? null,
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
  history: { dates: string[]; series: PriceSeries[] };
  fcc: FccFact[];
}

/** Everything the detail drawer needs, keyed by model id (serialized into the home page). */
export function robotDetails(): Record<string, RobotDetail> {
  const out: Record<string, RobotDetail> = {};
  for (const m of getModels()) {
    out[m.id] = { model: m, latest: latestPrices(m.id), history: priceHistory(m.id), fcc: fccFacts(m) };
  }
  return out;
}

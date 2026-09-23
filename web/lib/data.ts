// Build-time data access. Reads ../data (the collector's output) with node:fs; there is no database yet.
// Every page that uses this is statically generated, so nothing here runs at request time.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/** FCC DA 26-786: foreign-produced advanced robotic devices were added to the Covered List on this date. */
export const COVERED_LIST_DATE = "2026-07-28";

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

export interface SellerPrice {
  seller: string;
  sellerName: string;
  variant: string;
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
  const rows = getPriceRows(modelId);
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const map = new Map<string, PriceSeries>();
  for (const r of rows) {
    const key = `${r.seller}|${r.variant}`;
    let s = map.get(key);
    if (!s) {
      s = { key, label: `${sellerName(r.seller)} · ${r.variant}`, points: [] };
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

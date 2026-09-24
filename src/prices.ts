import sources from "../config/price-sources.json" with { type: "json" };
import { parseRegexHtml, parseShopifyProduct, withUsMarket, type PriceRow, type PriceSource } from "./lib/parse.ts";
import { generateEvents, type CollectorEvent } from "./events.ts";
import { appendLog, fetchText, listSnapshotDates, readJsonl, sleep, writeJsonl, writeText } from "./lib/io.ts";
import { upsert } from "./lib/supabase.ts";

/**
 * Stable, filesystem-safe id for a source: "<seller>__<product handle or last URL path segment>". Used as
 * the raw-archive filename (data/prices/raw/<date>/<sourceId>.<ext>) — stable across days so one source's
 * history can be found, and unique across config/price-sources.json today (checked in test/prices.test.ts).
 * Prefers product_handle when the URL itself doesn't name the product (a collection endpoint like KEYi's).
 */
export function sourceId(s: Pick<PriceSource, "seller" | "url" | "product_handle">): string {
  const path = new URL(s.url).pathname;
  const last = s.product_handle || path.split("/").filter(Boolean).pop() || "source";
  const slug = last
    .replace(/\.(js|json|html?)$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${s.seller}__${slug || "source"}`;
}

const PRICES_DIR = "data/prices";
const EVENTS_PATH = "data/events.jsonl";

export async function collectPrices(date: string) {
  const rows: PriceRow[] = [];
  const errors: string[] = [];
  for (const s of sources as PriceSource[]) {
    const observedAt = new Date().toISOString();
    try {
      const body = await fetchText(s.type === "shopify_js" ? withUsMarket(s.url) : s.url);
      // context/task-observability.md §0: archive the untouched response before any parsing, so a parser bug
      // discovered later can be corrected against what the source actually said that day — today's raw body
      // is the last chance to keep it; parse.ts changes can never recover it after the fact.
      try {
        const ext = s.type === "shopify_js" ? "json" : "html";
        await writeText(`${PRICES_DIR}/raw/${date}/${sourceId(s)}.${ext}`, body);
      } catch (e) {
        errors.push(`${s.url}: raw archive failed (kept going): ${(e as Error).message}`);
      }
      let got: PriceRow[];
      if (s.type === "shopify_js") {
        if (/^\s*</.test(body)) throw new Error("got HTML instead of JSON (redirect or bot challenge) — try the .json endpoint");
        got = parseShopifyProduct(JSON.parse(body), s, date, observedAt);
      } else {
        got = parseRegexHtml(body, s, date, observedAt);
      }
      if (got.length === 0) throw new Error("no prices parsed");
      rows.push(...got);
    } catch (e) {
      errors.push(`${s.url}: ${(e as Error).message}`);
    }
    await sleep(1500); // be polite: one request per source per day, spaced out
  }

  await writeJsonl(`${PRICES_DIR}/${date}.jsonl`, rows);
  for (const err of errors) await appendLog(`data/logs/${date}.log`, `[prices] ${err}`);
  await upsert(
    "price_snapshots",
    rows.map(({ flags, ...r }) => ({ ...r, flags })),
    "date,seller,url,variant",
  );

  // context/task-events.md §5: diff against the most recent *existing* prior snapshot (not strictly
  // "yesterday" — a gap day must not stop the next run from comparing against the last real data), and
  // reconcile rather than blind-append so re-running collect:prices for the same date is idempotent.
  const newEvents = await appendEvents(date, rows, errors);

  return { count: rows.length, errors, events: newEvents };
}

async function appendEvents(date: string, todayRows: PriceRow[], todayErrors: string[]): Promise<CollectorEvent[]> {
  const dates = (await listSnapshotDates(PRICES_DIR)).filter((d) => d < date);
  const prevDate = dates.at(-1);
  const prevRows = prevDate ? await readJsonl<PriceRow>(`${PRICES_DIR}/${prevDate}.jsonl`) : [];
  const newEvents = generateEvents(prevRows, todayRows, date, todayErrors);

  const existing = await readJsonl<CollectorEvent>(EVENTS_PATH);
  const merged = [...existing.filter((e) => e.date !== date), ...newEvents];
  if (merged.length !== existing.length || newEvents.length > 0) await writeJsonl(EVENTS_PATH, merged);
  return newEvents;
}

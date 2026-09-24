import sources from "../config/price-sources.json" with { type: "json" };
import { parseRegexHtml, parseShopifyProduct, withUsMarket, type PriceRow, type PriceSource } from "./lib/parse.ts";
import { appendLog, fetchText, sleep, writeJsonl, writeText } from "./lib/io.ts";
import { upsert } from "./lib/supabase.ts";

/**
 * Stable, filesystem-safe id for a source: "<seller>__<last URL path segment, no extension>". Used as the
 * raw-archive filename (data/prices/raw/<date>/<sourceId>.<ext>) — stable across days so one source's history
 * can be found, and unique across config/price-sources.json today (checked in test/parse.test.ts).
 */
export function sourceId(s: Pick<PriceSource, "seller" | "url">): string {
  const path = new URL(s.url).pathname;
  const last = path.split("/").filter(Boolean).pop() ?? "source";
  const slug = last
    .replace(/\.(js|json|html?)$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${s.seller}__${slug || "source"}`;
}

export async function collectPrices(date: string) {
  const rows: PriceRow[] = [];
  const errors: string[] = [];
  for (const s of sources as PriceSource[]) {
    try {
      const body = await fetchText(s.type === "shopify_js" ? withUsMarket(s.url) : s.url);
      // context/task-observability.md §0: archive the untouched response before any parsing, so a parser bug
      // discovered later can be corrected against what the source actually said that day — today's raw body
      // is the last chance to keep it; parse.ts changes can never recover it after the fact.
      try {
        const ext = s.type === "shopify_js" ? "json" : "html";
        await writeText(`data/prices/raw/${date}/${sourceId(s)}.${ext}`, body);
      } catch (e) {
        errors.push(`${s.url}: raw archive failed (kept going): ${(e as Error).message}`);
      }
      let got: PriceRow[];
      if (s.type === "shopify_js") {
        if (/^\s*</.test(body)) throw new Error("got HTML instead of JSON (redirect or bot challenge) — try the .json endpoint");
        got = parseShopifyProduct(JSON.parse(body), s, date);
      } else {
        got = parseRegexHtml(body, s, date);
      }
      if (got.length === 0) throw new Error("no prices parsed");
      rows.push(...got);
    } catch (e) {
      errors.push(`${s.url}: ${(e as Error).message}`);
    }
    await sleep(1500); // be polite: one request per source per day, spaced out
  }

  await writeJsonl(`data/prices/${date}.jsonl`, rows);
  for (const err of errors) await appendLog(`data/logs/${date}.log`, `[prices] ${err}`);
  await upsert(
    "price_snapshots",
    rows.map(({ flags, ...r }) => ({ ...r, flags })),
    "date,seller,url,variant",
  );
  return { count: rows.length, errors };
}

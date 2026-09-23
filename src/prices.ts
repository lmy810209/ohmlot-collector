import sources from "../config/price-sources.json" with { type: "json" };
import { parseRegexHtml, parseShopifyProduct, withUsMarket, type PriceRow, type PriceSource } from "./lib/parse.ts";
import { appendLog, fetchText, sleep, writeJsonl } from "./lib/io.ts";
import { upsert } from "./lib/supabase.ts";

export async function collectPrices(date: string) {
  const rows: PriceRow[] = [];
  const errors: string[] = [];
  for (const s of sources as PriceSource[]) {
    try {
      const body = await fetchText(s.type === "shopify_js" ? withUsMarket(s.url) : s.url);
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

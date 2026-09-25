// task-measure.md §B: does collecting once a day actually miss real events? Measure it, don't guess. Every
// 6 hours (4x/day via .github/workflows/intraday.yml), re-fetch just the 3 Tier A sources and write a
// separate snapshot under data/prices/intraday/ — the daily canonical snapshot (src/prices.ts, still once a
// day, still the only thing Supabase/the site ever see) is completely untouched by this module.
import sources from "../config/price-sources.json" with { type: "json" };
import { parseRegexHtml, parseShopifyProduct, withUsMarket, type PriceRow, type PriceSource } from "./lib/parse.ts";
import { appendLog, fetchText, readJson, sleep, writeJson, writeJsonl, writeText } from "./lib/io.ts";
import { sourceId } from "./prices.ts";

const INTRADAY_DIR = "data/prices/intraday";
const DISABLED_FLAG_PATH = "data/intraday-disabled.json";

/**
 * task-measure.md §B: "3종만. 전체로 늘리지 않는다." Picked from real, already-observed volatility, not a
 * guess — never expand this set without re-reading that line:
 *  - keyi-loona: 15 variants; Wayback found its Premium variant at 3 different prices within one 5-week
 *    window (context/recoverability.md) — confirmed the most price-volatile source we have.
 *  - deep-robotics-lite3: 6 variants, 3 of them contact-sales-only — the most complex availability logic of
 *    any tracked source, and the one most likely to have a purchase_mode/availability edge case a once-a-day
 *    snapshot could straddle awkwardly.
 *  - unitree-h2: a single variant, but context/observability.md directly confirmed a real in_stock ->
 *    out_of_stock flip on this exact source during the original investigation.
 */
export const TIER_A_MODEL_IDS = new Set(["keyi-loona", "deep-robotics-lite3", "unitree-h2"]);

export interface DisabledFlag {
  disabled_at: string;
  reason: string;
}

/** True when an error message names an HTTP 429 or a Cloudflare-mitigation response — the two signals
 * task-measure.md §B names explicitly ("429나 차단 신호"). Exported for testing in isolation from any
 * network call. */
export function looksLikeBlockSignal(errorMessage: string): boolean {
  return /HTTP 429|cloudflare/i.test(errorMessage);
}

export interface IntradayResult {
  skipped: boolean;
  /** Present only when skipped — the standing circuit-breaker record. */
  disabledReason?: DisabledFlag;
  count: number;
  errors: string[];
  /** True exactly when THIS run is the one that tripped the breaker (as opposed to one that found it
   * already tripped from an earlier run and skipped outright). */
  tripped: boolean;
}

/**
 * task-measure.md §B: "응답에 429나 차단 신호가 한 번이라도 보이면 즉시 하루 1회로 되돌리고 기록한다."
 * The record IS data/intraday-disabled.json — its mere presence makes every future call here a no-op (0
 * network requests) until a human deletes it after investigating. The daily canonical collector
 * (src/prices.ts) is separate code entirely and is never affected by this flag either way.
 */
export async function collectIntraday(now: Date = new Date()): Promise<IntradayResult> {
  const disabled = await readJson<DisabledFlag | null>(DISABLED_FLAG_PATH, null);
  if (disabled) return { skipped: true, disabledReason: disabled, count: 0, errors: [], tripped: false };

  const tierASources = (sources as PriceSource[]).filter((s) => TIER_A_MODEL_IDS.has(s.default_model));
  const date = now.toISOString().slice(0, 10);
  const hhmm = now.toISOString().slice(11, 16).replace(":", "");
  const rows: PriceRow[] = [];
  const errors: string[] = [];
  let tripped = false;

  for (const s of tierASources) {
    const observedAt = new Date().toISOString();
    try {
      const body = await fetchText(s.type === "shopify_js" ? withUsMarket(s.url) : s.url);
      try {
        const ext = s.type === "shopify_js" ? "json" : "html";
        await writeText(`${INTRADAY_DIR}/raw/${date}/${hhmm}/${sourceId(s)}.${ext}`, body);
      } catch (e) {
        errors.push(`${s.url}: raw archive failed (kept going): ${(e as Error).message}`);
      }
      let got: PriceRow[];
      if (s.type === "shopify_js") {
        if (/^\s*</.test(body)) throw new Error("got HTML instead of JSON (redirect or bot challenge)");
        got = parseShopifyProduct(JSON.parse(body), s, date, observedAt);
      } else {
        got = parseRegexHtml(body, s, date, observedAt);
      }
      if (got.length === 0) throw new Error("no prices parsed");
      rows.push(...got);
    } catch (e) {
      const msg = (e as Error).message;
      errors.push(`${s.url}: ${msg}`);
      if (looksLikeBlockSignal(msg)) tripped = true;
    }
    if (tripped) break; // stop hitting sources the moment a block/rate-limit signal appears — don't finish the round
    await sleep(1500);
  }

  await writeJsonl(`${INTRADAY_DIR}/${date}/${hhmm}.jsonl`, rows);
  for (const err of errors) await appendLog(`data/logs/intraday-${date}.log`, `[intraday] ${err}`);

  if (tripped) {
    const flag: DisabledFlag = { disabled_at: now.toISOString(), reason: `Rate-limit/block signal seen during intraday collection: ${errors.join(" | ")}` };
    await writeJson(DISABLED_FLAG_PATH, flag);
    await appendLog(`data/logs/intraday-${date}.log`, `[intraday] CIRCUIT BREAKER TRIPPED — reverting to daily-only until a human clears ${DISABLED_FLAG_PATH}. ${flag.reason}`);
  }

  return { skipped: false, count: rows.length, errors, tripped };
}

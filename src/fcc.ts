import grantees from "../config/fcc-grantees.json" with { type: "json" };
import { mergeGrants, parseGranteePage, type FccGrant } from "./lib/parse.ts";
import { appendLog, fetchText, readJson, sleep, writeJson } from "./lib/io.ts";
import { upsert } from "./lib/supabase.ts";

const REGISTRY = "data/fcc/grants.json";
// Unofficial mirror of FCC EAS data. Cross-check new IDs on apps.fcc.gov before publishing.
const granteeUrl = (code: string) => `https://fccid.io/${code}`;

/**
 * Manual-only collector (fcc.yml). Errors are returned for the console / Actions log and are NOT
 * written to data/logs, which is reserved for the daily price run. When nothing could be parsed,
 * nothing is written to data/ either, so a blocked run leaves no trace in the repo.
 */
export async function collectFcc(date: string) {
  const registry = await readJson<Record<string, FccGrant & { first_seen: string }>>(REGISTRY, {});
  const found: FccGrant[] = [];
  const errors: string[] = [];
  for (const g of grantees) {
    try {
      const html = await fetchText(granteeUrl(g.code));
      const grants = parseGranteePage(html, g.code);
      if (grants.length === 0) throw new Error("0 grants parsed — page layout may have changed");
      found.push(...grants);
    } catch (e) {
      errors.push(`${g.code}: ${(e as Error).message}`);
    }
    await sleep(3000);
  }

  if (found.length === 0) return { total: Object.keys(registry).length, added: [] as string[], errors, wrote: false };

  const { registry: next, added } = mergeGrants(registry, found, date);
  await writeJson(REGISTRY, next);
  await writeJson(`data/fcc/snapshots/${date}.json`, found);
  for (const id of added) await appendLog(`data/fcc/new-grants.log`, `${date} NEW ${id} ${next[id].grant_date ?? "?"}${next[id].after_covered_list ? " AFTER-COVERED-LIST" : ""}`);
  await upsert("fcc_grants", Object.values(next), "fcc_id");
  return { total: Object.keys(next).length, added, errors, wrote: true };
}

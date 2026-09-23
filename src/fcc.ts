import grantees from "../config/fcc-grantees.json" with { type: "json" };
import { mergeGrants, parseFccIdList, syncUsStatus, type FccGrant, type ModelSeed } from "./lib/parse.ts";
import { appendLog, fetchText, readJson, sleep, writeJson, writeText } from "./lib/io.ts";
import { upsert } from "./lib/supabase.ts";

const REGISTRY = "data/fcc/grants.json";
const MODELS = "data/models.json";
// Official FCC OET Laboratory Services API (KDB 953436, getFCCIDList). Endpoint and response notes:
// context/fcc-api-notes.md §1. One request per grantee code, identified User-Agent, no bypassing.
const apiUrl = (code: string) => `https://apps.fcc.gov/OETLabServices/getFCCIDList?fccId=${encodeURIComponent(code)}`;

/**
 * Weekly collector (fcc.yml, Mondays) that can also be run by hand. Errors are returned for the console /
 * Actions log and are NOT written to data/logs, which is reserved for the daily price run. A blocked run
 * (HTTP 403, HTML instead of JSON) is logged and skipped — never retried with a different identity, never
 * proxied. When no grantee code answered, nothing is written to data/ either, so a blocked run leaves no
 * trace in the repo.
 */
export async function collectFcc(date: string) {
  const registry = await readJson<Record<string, FccGrant & { first_seen: string }>>(REGISTRY, {});
  const found: FccGrant[] = [];
  const errors: string[] = [];
  const okCodes = new Set<string>();
  for (const g of grantees) {
    try {
      const body = await fetchText(apiUrl(g.code));
      if (/^\s*</.test(body)) throw new Error("got HTML instead of JSON (edge block or redirect) — logged and skipped");
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        throw new Error("response is not JSON");
      }
      // Archive the untouched body so rows can be re-parsed once the response schema is confirmed.
      await writeText(`data/fcc/raw/${date}-${g.code}.json`, body.endsWith("\n") ? body : body + "\n");
      const grants = parseFccIdList(json, g.code);
      found.push(...grants);
      okCodes.add(g.code);
      if (grants.length === 0) errors.push(`${g.code}: 0 grants in response (raw body kept in data/fcc/raw)`);
    } catch (e) {
      errors.push(`${g.code}: ${(e as Error).message}`);
    }
    await sleep(3000);
  }

  if (okCodes.size === 0) return { total: Object.keys(registry).length, added: [] as string[], errors, wrote: false, modelsUpdated: 0 };

  const { registry: next, added } = mergeGrants(registry, found, date);
  await writeJson(REGISTRY, next);
  await writeJson(`data/fcc/snapshots/${date}.json`, found);
  for (const id of added) await appendLog(`data/fcc/new-grants.log`, `${date} NEW ${id} ${next[id].grant_date ?? "?"}${next[id].after_covered_list ? " AFTER-COVERED-LIST" : ""}`);

  // Keep data/models.json us_status in step with the registry: grant dates from FCC, last_verified only
  // for the grantee codes that actually answered today.
  const seed = await readJson<ModelSeed[]>(MODELS, []);
  const { models, changed } = syncUsStatus(seed, next, date, okCodes);
  if (changed > 0) await writeJson(MODELS, models);

  await upsert("fcc_grants", Object.values(next), "fcc_id");
  return { total: Object.keys(next).length, added, errors, wrote: true, modelsUpdated: changed };
}

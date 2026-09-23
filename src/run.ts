import { collectPrices } from "./prices.ts";
import { collectFcc } from "./fcc.ts";
import { todayUTC } from "./lib/io.ts";

// `prices` runs daily (daily.yml). `fcc` is manual only (fcc.yml). `all` is for local runs.
const which = process.argv[2] ?? "all";
const date = process.env.COLLECT_DATE ?? todayUTC();

let failed = false;
if (which === "all" || which === "prices") {
  const r = await collectPrices(date);
  console.log(`[prices] ${r.count} rows, ${r.errors.length} errors`);
  r.errors.forEach((e) => console.warn("  ", e));
  // Fail only if every price source failed, so partial outages still get archived.
  if (r.count === 0) failed = true;
}
if (which === "all" || which === "fcc") {
  const r = await collectFcc(date);
  console.log(`[fcc] ${r.total} grants in registry, ${r.added.length} new, ${r.errors.length} errors${r.wrote ? "" : " — nothing written"}`);
  r.added.forEach((id) => console.log("   NEW", id));
  r.errors.forEach((e) => console.warn("  ", e));
  // A manual FCC run should show red when no source could be read; `all` (local) stays green for prices.
  if (which === "fcc" && !r.wrote) failed = true;
}
process.exit(failed ? 1 : 0);

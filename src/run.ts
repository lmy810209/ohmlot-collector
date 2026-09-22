import { collectPrices } from "./prices.ts";
import { collectFcc } from "./fcc.ts";
import { todayUTC } from "./lib/io.ts";

const which = process.argv[2] ?? "all";
const date = process.env.COLLECT_DATE ?? todayUTC();

let failed = false;
if (which === "all" || which === "prices") {
  const r = await collectPrices(date);
  console.log(`[prices] ${r.count} rows, ${r.errors.length} errors`);
  r.errors.forEach((e) => console.warn("  ", e));
  if (r.count === 0) failed = true;
}
if (which === "all" || which === "fcc") {
  const r = await collectFcc(date);
  console.log(`[fcc] ${r.total} grants in registry, ${r.added.length} new, ${r.errors.length} errors`);
  r.added.forEach((id) => console.log("   NEW", id));
  r.errors.forEach((e) => console.warn("  ", e));
}
// Fail the job only if every price source failed, so partial outages still get archived.
process.exit(failed ? 1 : 0);

import { collectPrices } from "./prices.ts";
import { collectFcc } from "./fcc.ts";
import { todayUTC } from "./lib/io.ts";

// `prices` runs daily (daily.yml). `fcc` runs weekly + manually (fcc.yml). `all` is for local runs.
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
  console.log(
    `[fcc] ${r.notices.length} notices, ${r.approvals.length} robotic-device Conditional Approvals on file${r.wrote ? "" : " — nothing readable, nothing written"}`,
  );
  r.notices.forEach((n) => console.log(`   ${n.da} ${n.status}${n.records ? ` (${n.records} rows)` : ""}${n.error ? ` ${n.error}` : ""}`));
  r.approvals.forEach((a) => console.log(`   ROBOT ${a.entry} — from ${a.effective_from ?? "?"} (${a.source_da}${a.also_in.length ? `, also ${a.also_in.join(", ")}` : ""})${a.matched_manufacturer ? ` — matches ${a.matched_manufacturer}` : ""}`));
  r.errors.forEach((e) => console.warn("  ", e));
  // task-fcc-3.md §4: a consistency-check warning means a record looked like a parsing artifact and was
  // dropped rather than published (see suspiciousReasons in src/fcc.ts). That must not pass silently — a
  // weekly/manual FCC run fails so it gets looked at, even though prices and the rest of the site are fine.
  r.warnings.forEach((w) => console.warn("  [consistency]", w));
  // A manual/weekly FCC run should show red when no notice could be read, or a record was rejected. `all`
  // (local) stays green for prices so a local `npm run collect` isn't blocked by FCC-side issues.
  if (which === "fcc" && (!r.wrote || r.warnings.length > 0)) failed = true;
}
process.exit(failed ? 1 : 0);

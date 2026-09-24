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
  const robotic = r.approvals.filter((a) => a.equipment_type === "robotic_device");
  console.log(
    `[fcc] ${r.notices.length} notices, ${r.approvals.length} conditional approvals on file (${robotic.length} robotic)${r.wrote ? "" : " — nothing readable, nothing written"}`,
  );
  r.notices.forEach((n) => console.log(`   ${n.da} ${n.status}${n.records ? ` (${n.records} rows)` : ""}${n.error ? ` ${n.error}` : ""}`));
  robotic.forEach((a) => console.log(`   ROBOT ${a.entry} — from ${a.effective_from ?? "?"} (${a.source_da})`));
  r.errors.forEach((e) => console.warn("  ", e));
  // A manual/weekly FCC run should show red when no notice could be read; `all` (local) stays green for prices.
  if (which === "fcc" && !r.wrote) failed = true;
}
process.exit(failed ? 1 : 0);

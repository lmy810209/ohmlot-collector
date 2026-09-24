// task-fcc-3.md §4: "data/fcc/conditional-approvals.json의 모든 레코드를 출력해 눈으로 확인하는 스크립트".
// Run with `npm run fcc:review`. Prints every stored record in full, plus the notices that produced them
// and any per-model manufacturer match, so a human can check the data the automated consistency filter
// (suspiciousReasons in src/fcc.ts) doesn't catch.
import { readJson } from "./lib/io.ts";
import type { ApprovalStore } from "./fcc.ts";

const store = await readJson<ApprovalStore>("data/fcc/conditional-approvals.json", { updated: "", notices: [], approvals: [] });

console.log(`data/fcc/conditional-approvals.json — updated ${store.updated || "(never)"}\n`);

console.log("Notices:");
for (const n of store.notices) {
  console.log(`  ${n.da} (${n.released}) — ${n.status}${n.records ? `, ${n.records} rows` : ""}${n.error ? ` — ${n.error}` : ""}`);
}

console.log(`\n${store.approvals.length} Conditional Approval record(s) across all three Appendix B columns:\n`);
for (const a of store.approvals) {
  console.log(`— [${a.fcc_column}] ${a.entry}`);
  console.log(`  company:   ${a.company ?? "(not split)"}`);
  console.log(`  models:    ${a.models ?? "(not split)"}`);
  console.log(`  effective: ${a.effective_from ?? "?"}${a.effective_to ? ` – ${a.effective_to}` : " – (open-ended)"}`);
  if (a.extra_dates.length) console.log(`  extra dates: ${a.extra_dates.map((d) => `${d.from ?? "?"}–${d.to ?? "?"}`).join(", ")}`);
  console.log(`  source:    ${a.source_da}${a.also_in.length ? ` (also in ${a.also_in.join(", ")})` : ""} — ${a.source_url}`);
  console.log(`  first seen: ${a.first_seen}`);
  console.log(`  matches a tracked manufacturer: ${a.matched_manufacturer ?? "no"}`);
  console.log();
}

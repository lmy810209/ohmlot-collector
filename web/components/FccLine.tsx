import type { FccFact } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { UsStatusBadge } from "./UsStatusBadge";

/** One FCC ID with its grant date and US status, worded the same everywhere it appears. */
export function FccLine({ fact }: { fact: FccFact }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
      <div className="min-w-0">
        <span className="font-mono font-medium">{fact.fcc_id}</span>
        <span className="text-ink-2"> · {fact.grant_date ? `granted ${fmtDate(fact.grant_date)}` : "grant date unknown"}</span>
        {fact.description ? <span className="text-ink-2"> · {fact.description}</span> : null}
      </div>
      <UsStatusBadge kind={fact.status} short />
    </li>
  );
}

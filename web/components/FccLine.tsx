import { Badge } from "./Badge";
import type { FccFact } from "@/lib/data";
import { COVERED_LIST_LABEL, fmtDate } from "@/lib/format";

/** One FCC ID with its grant date and Covered List position, worded the same everywhere it appears. */
export function FccLine({ fact }: { fact: FccFact }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
      <div className="min-w-0">
        <span className="font-mono font-medium">{fact.fcc_id}</span>
        <span className="text-ink-2"> · {fact.grant_date ? `granted ${fmtDate(fact.grant_date)}` : "grant date unknown"}</span>
        {fact.description ? <span className="text-ink-2"> · {fact.description}</span> : null}
      </div>
      {fact.after_covered_list === true ? (
        <Badge tone="amber">After Covered List ({COVERED_LIST_LABEL})</Badge>
      ) : fact.after_covered_list === false ? (
        <Badge tone="up">Before Covered List ({COVERED_LIST_LABEL})</Badge>
      ) : (
        <Badge>Date unknown</Badge>
      )}
    </li>
  );
}

import Link from "next/link";
import type { ConditionalApproval } from "@/lib/data";
import { COVERED_LIST_LABEL, COVERED_LIST_RULE } from "@/lib/format";

// task-fcc-3.md §0: the underlying parser has not been proven to split every notice entry correctly
// (see context/fcc-api-notes.md §8), so this must not claim the list below is exhaustive. No "only" / "all".
function approvalsSentence(approvals: ConditionalApproval[], catalogSize: number): string {
  if (approvals.length === 0) {
    return "We have not yet confirmed a Department of War Conditional Approval for any robotic device in the FCC's public notices.";
  }
  const companies = [...new Set(approvals.map((a) => a.company ?? a.entry))];
  return `Robotic-device manufacturers found in FCC Conditional Approval notices: ${companies.join(", ")}. None of these match the ${catalogSize} robots this site tracks.`;
}

/** Guide §4.5: an explanation card plus three figures, split the way the US status block classifies robots. */
export function FccSection({
  before,
  conditional,
  after,
  unknown,
  approvals,
  catalogSize,
}: {
  before: number;
  conditional: number;
  after: number;
  unknown: number;
  approvals: ConditionalApproval[];
  catalogSize: number;
}) {
  const figures = [
    { value: before, label: `granted before ${COVERED_LIST_LABEL}` },
    { value: conditional, label: "conditionally approved by DoW after that date" },
    { value: after, label: "granted after that date without approval — check first" },
  ];
  return (
    <section aria-labelledby="fcc-heading" className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="card p-6">
        <div className="micro mb-2">US regulatory status</div>
        <h2 id="fcc-heading" className="text-[22px] font-bold sm:text-2xl">
          Can it still be bought in the US? The FCC grant date decides.
        </h2>
        <p className="mt-2 text-[14px] text-ink-2">{COVERED_LIST_RULE}</p>
        <p className="mt-2 text-[13px] text-ink-3">
          {unknown} {unknown === 1 ? "robot has" : "robots have"} no FCC record or grant date on file. Status is checked against FCC public notices and
          equipment authorization records.
        </p>
        <p className="mt-2 text-[13px] text-ink-3">{approvalsSentence(approvals, catalogSize)}</p>
        <Link href="/fcc" className="mt-4 inline-flex h-10 items-center rounded-ctl border border-line bg-card px-4 text-sm font-medium hover:bg-sunk">
          Search FCC IDs
        </Link>
      </div>
      <dl className="card grid grid-cols-1 divide-y divide-line-soft p-2 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {figures.map((f) => (
          // dt before dd in the DOM (valid <dl>), number above the caption on screen.
          <div key={f.label} className="flex flex-col-reverse px-4 py-4 sm:py-5">
            <dt className="mt-1 text-[12px] leading-snug text-ink-2">{f.label}</dt>
            <dd className="num text-3xl font-semibold text-ink sm:text-4xl">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

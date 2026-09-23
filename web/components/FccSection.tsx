import Link from "next/link";
import { COVERED_LIST_LABEL, COVERED_LIST_RULE } from "@/lib/format";

/** Guide §4.5: an explanation card plus three figures, split the way the US status block classifies robots. */
export function FccSection({ before, conditional, after, unknown }: { before: number; conditional: number; after: number; unknown: number }) {
  const figures = [
    { value: before, label: `authorized before the Covered List (${COVERED_LIST_LABEL})` },
    { value: conditional, label: "conditionally approved after it" },
    { value: after, label: "after it without a Conditional Approval — check before buying" },
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
          {unknown} {unknown === 1 ? "robot has" : "robots have"} no FCC record on file. Status is checked against FCC public notices and equipment authorization records.
        </p>
        <Link href="/fcc" className="mt-4 inline-flex h-10 items-center rounded-ctl border border-line bg-card px-4 text-sm font-medium hover:bg-sunk">
          Search FCC IDs
        </Link>
      </div>
      <dl className="card grid grid-cols-3 divide-x divide-line-soft p-2">
        {figures.map((f) => (
          <div key={f.label} className="px-4 py-5 text-center sm:text-left">
            <dd className="num text-3xl font-semibold text-ink sm:text-4xl">{f.value}</dd>
            <dt className="mt-1 text-[12px] leading-snug text-ink-2">{f.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

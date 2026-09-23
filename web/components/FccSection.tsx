import Link from "next/link";
import { COVERED_LIST_LABEL } from "@/lib/format";

/** Guide §4.5: an explanation card plus three figures. */
export function FccSection({ ids, robotsWithId, afterCoveredList }: { ids: number; robotsWithId: number; afterCoveredList: number }) {
  const figures = [
    { value: ids, label: "FCC IDs on file" },
    { value: robotsWithId, label: "robots with an authorization" },
    { value: afterCoveredList, label: `granted after ${COVERED_LIST_LABEL}` },
  ];
  return (
    <section aria-labelledby="fcc-heading" className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="card p-6">
        <div className="micro mb-2">FCC</div>
        <h2 id="fcc-heading" className="text-[22px] font-bold sm:text-2xl">
          Every robot sold in the US carries an FCC ID. We keep the list.
        </h2>
        <p className="mt-2 text-[14px] text-ink-2">
          On {COVERED_LIST_LABEL} the FCC added foreign-produced advanced robotic devices to its Covered List: no new authorizations after that
          date. Robots authorized before it can generally still be marketed and used, so the grant date now matters for resale.
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

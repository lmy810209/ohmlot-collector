import { RobotTable } from "@/components/RobotTable";
import { priceChanges, robotDetails, robotRows } from "@/lib/data";
import { fmtDate } from "@/lib/format";

export default function Home() {
  const rows = robotRows();
  const details = robotDetails();
  const { changes, latest, previous, first, snapshots } = priceChanges();
  const tracked = rows.filter((r) => r.tracked).length;
  const fccIds = rows.reduce((n, r) => n + r.fcc_ids.length, 0);

  const stats = [
    {
      label: "Robots tracked daily",
      value: tracked,
      note: first ? `of ${rows.length} in the catalog · since ${fmtDate(first)}` : `of ${rows.length} in the catalog`,
    },
    {
      label: "Price changes today",
      value: changes.length,
      note: latest && previous ? `${fmtDate(latest)} vs ${fmtDate(previous)}` : latest ? `first snapshot ${fmtDate(latest)}` : "no snapshots yet",
    },
    { label: "FCC IDs on file", value: fccIds, note: `${rows.filter((r) => r.fcc_status !== "none").length} robots with an authorization` },
  ];

  return (
    <>
      <section className="pt-10 sm:pt-16">
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-balance sm:text-5xl">
          The original marketplace for personal robots.
        </h1>
        <p className="mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
          List prices from manufacturer stores, collected every day, and FCC authorization records for humanoids, robot
          dogs, and desktop robots.
        </p>
      </section>

      <section aria-label="Today at a glance" className="mt-8 grid grid-cols-1 divide-y divide-border border-y border-border sm:mt-10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {stats.map((s) => (
          <div key={s.label} className="py-4 sm:px-6 sm:first:pl-0 sm:last:pr-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-3xl font-semibold leading-none">{s.value}</div>
            <div className="mt-1.5 text-xs text-muted-foreground">{s.note}</div>
          </div>
        ))}
      </section>

      <section className="mt-8 sm:mt-10">
        <h2 className="sr-only">All robots</h2>
        <RobotTable rows={rows} details={details} />
        {snapshots > 0 && snapshots < 7 && (
          <p className="sr-only">Price history is {snapshots} day{snapshots === 1 ? "" : "s"} long so far.</p>
        )}
      </section>
    </>
  );
}

import { AlertSignup } from "@/components/AlertSignup";
import { FccSection } from "@/components/FccSection";
import { RobotExplorer } from "@/components/RobotExplorer";
import { Delta } from "@/components/Delta";
import { robotDetails, robotRows, roboticApprovals, runSummary } from "@/lib/data";
import { fmtDate, fmtDay } from "@/lib/format";

export default function Home() {
  const rows = robotRows();
  const details = robotDetails();
  const run = runSummary();
  const nameById = new Map(rows.map((r) => [r.id, r.name]));
  const fccBefore = rows.filter((r) => r.fcc_status === "before").length;
  const fccConditional = rows.filter((r) => r.fcc_status === "conditional").length;
  const fccAfter = rows.filter((r) => r.fcc_status === "after").length;
  const fccUnknown = rows.filter((r) => r.fcc_status === "unknown").length;
  const approvals = roboticApprovals();
  const changes = run.changes.slice(0, 3);

  const aside = (
    <aside className="card card-accent p-5 sm:p-6" aria-labelledby="run-heading">
      <div className="flex items-center justify-between">
        <div id="run-heading" className="micro">
          Today&rsquo;s run
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-up">
          <span className="size-2 rounded-full bg-up" aria-hidden="true" />
          ok
        </span>
      </div>
      <div className="num mt-2 text-[26px] font-semibold text-ink">{run.latest ? fmtDate(run.latest) : "No snapshot yet"}</div>
      <dl className="mt-4 space-y-2.5 text-[13.5px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-2">Prices collected</dt>
          <dd className="num text-ink">
            {run.rows} · {run.sellers} stores
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-2">Changed vs {run.previous ? fmtDay(run.previous) : "—"}</dt>
          <dd className="num text-ink">{run.changes.length}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-2">Robots tracked</dt>
          <dd className="num text-ink">
            {run.tracked} of {run.models}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-2">Next run</dt>
          <dd className="num text-ink">00:17 UTC</dd>
        </div>
      </dl>
    </aside>
  );

  const cards = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <section className="card p-5" aria-labelledby="changes-heading">
        <div id="changes-heading" className="micro">
          Today&rsquo;s changes
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="num text-3xl font-semibold">{run.changes.length}</span>
          <span className="text-[13px] text-ink-2">{run.previous ? `since ${fmtDay(run.previous)}` : "first snapshot"}</span>
        </div>
        {changes.length > 0 ? (
          <ul className="mt-3 divide-y divide-line-soft text-[13px]">
            {changes.map((c) => (
              <li key={`${c.model_id}|${c.seller}|${c.variant}`} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{nameById.get(c.model_id) ?? c.model_id}</span>
                  <span className="text-ink-3"> · {c.variant}</span>
                </span>
                <Delta amount={c.to - c.from} pct={c.from ? ((c.to - c.from) / c.from) * 100 : 0} className="shrink-0 text-[13px]" />
              </li>
            ))}
            {run.changes.length > 3 && <li className="py-1.5 text-ink-3">+{run.changes.length - 3} more in the table</li>}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-ink-2">No tracked price moved overnight.</p>
        )}
      </section>

      <section className="card p-5" aria-labelledby="tracked-heading">
        <div id="tracked-heading" className="micro">
          Tracked daily
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="num text-3xl font-semibold">{run.tracked}</span>
          <span className="text-[13px] text-ink-2">of {run.models} robots</span>
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-sunk" role="img" aria-label={`${run.tracked} tracked, ${run.models - run.tracked} published only`}>
          <span className="bg-accent" style={{ width: `${(run.tracked / run.models) * 100}%` }} />
        </div>
        <p className="mt-3 text-[13px] text-ink-2">
          {run.models - run.tracked} robots show the manufacturer&rsquo;s published list price only. They are marked{" "}
          <span className="font-mono text-[11px] text-ink-3">not tracked</span>, never left blank.
        </p>
      </section>

      <section className="card p-5" aria-labelledby="baseline-heading">
        <div id="baseline-heading" className="micro">
          Baseline
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="num text-3xl font-semibold">Day {run.baselineDay}</span>
          <span className="text-[13px] text-ink-2">of {run.baselineDays}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuemin={0} aria-valuemax={run.baselineDays} aria-valuenow={run.baselineDay} aria-label="Baseline progress">
          <span className="block h-full rounded-full bg-accent" style={{ width: `${(run.baselineDay / run.baselineDays) * 100}%` }} />
        </div>
        <p className="mt-3 text-[13px] text-ink-2">
          Lowest-price badges and charts unlock after {run.baselineDays} daily snapshots. Until then every row shows yesterday → today.
          {run.first ? ` First snapshot ${fmtDate(run.first)}.` : ""}
        </p>
      </section>
    </div>
  );

  return (
    <>
      <RobotExplorer rows={rows} details={details} aside={aside} cards={cards} />

      {/* 5. FCC */}
      <div className="mt-14 sm:mt-20">
        <FccSection before={fccBefore} conditional={fccConditional} after={fccAfter} unknown={fccUnknown} approvals={approvals} catalogSize={rows.length} />
      </div>

      {/* 6. Alerts */}
      <div className="mt-10 sm:mt-14">
        <AlertSignup />
      </div>
    </>
  );
}

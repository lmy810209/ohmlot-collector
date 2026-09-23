import Link from "next/link";
import { Badge } from "@/components/Badge";
import { getModels, lastUpdated, trackedModelIds, type Category } from "@/lib/data";
import { CATEGORY_LABEL, CATEGORY_ORDER, fmtDate, priceRange, STATUS_LABEL } from "@/lib/format";

export default function Home() {
  const models = getModels();
  const tracked = trackedModelIds();
  const updated = lastUpdated();
  const fccCount = models.reduce((n, m) => n + m.fcc_ids.length, 0);

  const byCategory = new Map<Category, typeof models>();
  for (const cat of CATEGORY_ORDER) byCategory.set(cat, []);
  for (const m of models) byCategory.get(m.category)?.push(m);
  const sortKey = (m: (typeof models)[number]) => (m.price_model === "quote" ? Infinity : m.price_usd_min ?? Infinity);
  for (const list of byCategory.values()) list.sort((a, b) => sortKey(a) - sortKey(b) || a.name.localeCompare(b.name));

  return (
    <>
      <section className="py-12 sm:py-16">
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          The original marketplace for personal robots.
        </h1>
        <p className="mt-4 max-w-xl text-base text-zinc-600 dark:text-zinc-400 sm:text-lg">
          List prices from manufacturer stores, collected every day, and FCC authorization records for{" "}
          {models.length} humanoids, robot dogs, and desktop robots.
        </p>
        <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <div>
            <dt className="sr-only">Robots</dt>
            <dd>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{models.length}</span> robots
            </dd>
          </div>
          <div>
            <dt className="sr-only">Price-tracked</dt>
            <dd>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{tracked.size}</span> tracked daily
            </dd>
          </div>
          <div>
            <dt className="sr-only">FCC IDs</dt>
            <dd>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{fccCount}</span> FCC IDs on file
            </dd>
          </div>
          {updated && (
            <div>
              <dt className="sr-only">Last update</dt>
              <dd>Updated {fmtDate(updated)}</dd>
            </div>
          )}
        </dl>
      </section>

      {CATEGORY_ORDER.map((cat) => {
        const list = byCategory.get(cat) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={cat} aria-labelledby={`cat-${cat}`} className="mb-10">
            <h2 id={`cat-${cat}`} className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {CATEGORY_LABEL[cat]} · {list.length}
            </h2>
            <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {list.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/robots/${m.id}`}
                    className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60 sm:px-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium leading-snug">{m.name}</div>
                      <div className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                        {m.manufacturer}
                        {m.hq_country ? ` · ${m.hq_country}` : ""}
                        {m.launch_year ? ` · ${m.launch_year}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                      <div className="text-sm font-medium tabular-nums sm:text-base">{priceRange(m)}</div>
                      <div className="flex items-center gap-1.5">
                        {tracked.has(m.id) && <Badge tone="info">Tracked</Badge>}
                        <Badge tone={m.status === "shipping" ? "good" : "warn"}>{STATUS_LABEL[m.status] ?? m.status}</Badge>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

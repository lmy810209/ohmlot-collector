import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/Badge";
import { PriceChart } from "@/components/PriceChart";
import { COVERED_LIST_DATE, fccFacts, getModel, getModels, latestPrices, priceHistory } from "@/lib/data";
import { CATEGORY_LABEL, fmtDate, priceRange, STATUS_LABEL, usd } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return getModels().map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: PageProps<"/robots/[id]">): Promise<Metadata> {
  const { id } = await params;
  const m = getModel(id);
  if (!m) return {};
  return {
    title: `${m.name} price and FCC status`,
    description: `${m.name} by ${m.manufacturer}: ${priceRange(m)}. Daily list prices, FCC ID, and resale notes.`,
  };
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="border-t border-zinc-200 py-8 dark:border-zinc-800">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

const ext = "underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900 dark:decoration-zinc-600 dark:hover:decoration-white";

export default async function RobotPage({ params }: PageProps<"/robots/[id]">) {
  const { id } = await params;
  const m = getModel(id);
  if (!m) notFound();

  const latest = latestPrices(m.id);
  const history = priceHistory(m.id);
  const fcc = fccFacts(m);
  const lastSeen = latest.reduce<string | null>((acc, p) => (acc && acc > p.date ? acc : p.date), null);

  return (
    <article className="py-8 sm:py-12">
      <nav className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/" className="hover:underline">
          Robots
        </Link>{" "}
        / {CATEGORY_LABEL[m.category]}
      </nav>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{m.name}</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {m.manufacturer}
          {m.hq_country ? ` · ${m.hq_country}` : ""}
          {m.launch_year ? ` · ${m.launch_year}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-2xl font-semibold tabular-nums">{priceRange(m)}</span>
          <Badge tone={m.status === "shipping" ? "good" : "warn"}>{STATUS_LABEL[m.status] ?? m.status}</Badge>
          {m.price_model === "quote" && <Badge>Price on request</Badge>}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          {m.buy_url && (
            <a href={m.buy_url} target="_blank" rel="noopener noreferrer" className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
              Buy from manufacturer
            </a>
          )}
          {m.official_url && (
            <a href={m.official_url} target="_blank" rel="noopener noreferrer" className="rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
              Official site
            </a>
          )}
        </div>
      </header>

      <Section
        title="Latest prices"
        aside={lastSeen ? <span className="text-xs text-zinc-500 dark:text-zinc-400">Collected {fmtDate(lastSeen)} (UTC)</span> : undefined}
      >
        {latest.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Not tracked daily yet. The range above is the manufacturer&rsquo;s published list price.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {latest.map((p) => (
              <li key={`${p.seller}|${p.variant}`} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.variant}</div>
                  <div className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className={ext}>
                      {p.sellerName}
                    </a>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold tabular-nums">{usd(p.price_usd)}</span>
                  {p.available === true ? (
                    <Badge tone="good">In stock</Badge>
                  ) : p.available === false ? (
                    <Badge tone="warn">Sold out</Badge>
                  ) : (
                    <Badge>Stock unknown</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {history.series.length > 0 && (
        <Section title="Price history" aside={<span className="text-xs text-zinc-500 dark:text-zinc-400">{history.dates.length} daily snapshot{history.dates.length === 1 ? "" : "s"}</span>}>
          <PriceChart dates={history.dates} series={history.series} />
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              Table view
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Date</th>
                    {history.series.map((s) => (
                      <th key={s.key} className="py-1 pr-3 text-right font-medium">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {history.dates.map((d) => (
                    <tr key={d}>
                      <td className="py-1 pr-3 tabular-nums">{d}</td>
                      {history.series.map((s) => {
                        const p = s.points.find((pt) => pt.date === d);
                        return (
                          <td key={s.key} className="py-1 pr-3 text-right tabular-nums">
                            {p ? usd(p.price) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Section>
      )}

      <Section title="Specs">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Spec label="Category">{CATEGORY_LABEL[m.category]}</Spec>
          <Spec label="Weight">{m.weight_kg != null ? `${m.weight_kg} kg` : "—"}</Spec>
          <Spec label="Height">{m.height_cm != null ? `${m.height_cm} cm` : "—"}</Spec>
          <Spec label="Launched">{m.launch_year ?? "—"}</Spec>
          <Spec label="Pricing">
            {m.price_model === "quote" ? "Quote" : m.price_model === "subscription" ? "Subscription" : "Purchase"}
            {m.subscription_usd_month != null ? ` · ${usd(m.subscription_usd_month)}/mo` : ""}
          </Spec>
          <Spec label="Status">{STATUS_LABEL[m.status] ?? m.status}</Spec>
          <Spec label="HQ">{m.hq_country ?? "—"}</Spec>
          <Spec label="FCC grantee">{m.fcc_grantee_code ? <span className="font-mono">{m.fcc_grantee_code}</span> : "—"}</Spec>
        </dl>
      </Section>

      <Section title="FCC authorization">
        {fcc.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No FCC ID on file for this model. For US use the unit should carry an FCC ID label; check{" "}
            <a href="https://apps.fcc.gov/oetcf/eas/reports/GenericSearch.cfm" target="_blank" rel="noopener noreferrer" className={ext}>
              the FCC equipment authorization search
            </a>
            .
          </p>
        ) : (
          <ul className="space-y-3">
            {fcc.map((f) => (
              <li key={f.fcc_id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href="/fcc" className="font-mono text-sm font-medium hover:underline">
                    {f.fcc_id}
                  </Link>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    {f.grant_date ? `Granted ${fmtDate(f.grant_date)}` : "Grant date not yet confirmed"}
                    {f.description ? ` · ${f.description}` : ""}
                    {f.source === "model" ? " · from seed data" : ""}
                  </div>
                </div>
                {f.after_covered_list === true ? (
                  <Badge tone="warn">Granted after Covered List ({COVERED_LIST_DATE})</Badge>
                ) : f.after_covered_list === false ? (
                  <Badge tone="good">Granted before Covered List ({COVERED_LIST_DATE})</Badge>
                ) : (
                  <Badge>Covered List status unknown</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Since {COVERED_LIST_DATE} the FCC does not issue new authorizations for foreign-produced advanced robotic
          devices. Models authorized before that date can generally still be marketed and used in the US.
        </p>
      </Section>

      <Section title="Resale notes">
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {m.resale_policy_note ?? "No resale notes yet."}
        </p>
      </Section>

      <Section title="Sources">
        <ul className="space-y-1 text-sm">
          {m.sources.map((s) => (
            <li key={s} className="truncate">
              <a href={s} target="_blank" rel="noopener noreferrer" className={ext}>
                {s.replace(/^https?:\/\//, "")}
              </a>
            </li>
          ))}
        </ul>
        {m.data_source_license && <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{m.data_source_license}</p>}
      </Section>
    </article>
  );
}

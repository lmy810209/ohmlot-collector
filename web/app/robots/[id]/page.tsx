import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/Badge";
import { FccLine } from "@/components/FccLine";
import { PriceChart } from "@/components/PriceChart";
import { buttonVariants } from "@/components/ui/button";
import { fccFacts, getModel, getModels, latestPrices, priceHistory } from "@/lib/data";
import { CATEGORY_LABEL, COVERED_LIST_LABEL, fmtDate, priceRange, purchaseRange, rangeText, STATUS_LABEL, subscriptionLabel, usd } from "@/lib/format";

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
    <section className="border-t border-border py-8">
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
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

const ext = "underline decoration-border underline-offset-2 hover:decoration-foreground";

export default async function RobotPage({ params }: PageProps<"/robots/[id]">) {
  const { id } = await params;
  const m = getModel(id);
  if (!m) notFound();

  const latest = latestPrices(m.id);
  const history = priceHistory(m.id);
  const fcc = fccFacts(m);
  const purchase = latest.filter((p) => p.kind === "purchase");
  const tracked = purchase.length > 0;
  const lastSeen = latest.reduce<string | null>((acc, p) => (acc && acc > p.date ? acc : p.date), null);
  const headline = tracked ? rangeText(purchase[0].price_usd, purchase[purchase.length - 1].price_usd) : purchaseRange(m);
  const sub = subscriptionLabel(m);
  const sellers = [...new Set(latest.map((p) => p.sellerName))];

  return (
    <article className="py-8 sm:py-12">
      <nav className="mb-4 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:underline">
          Robots
        </Link>{" "}
        / {CATEGORY_LABEL[m.category]}
      </nav>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{m.name}</h1>
        <p className="mt-1 text-muted-foreground">
          {m.manufacturer}
          {m.hq_country ? ` · ${m.hq_country}` : ""}
          {m.launch_year ? ` · ${m.launch_year}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-2xl font-semibold">{headline}</span>
          <Badge tone={m.status === "shipping" ? "good" : "warn"}>{STATUS_LABEL[m.status] ?? m.status}</Badge>
          {m.price_model === "quote" && <Badge>Price on request</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {tracked && lastSeen ? `Tracked daily · latest snapshot ${fmtDate(lastSeen)} (UTC)` : "Published list price · not tracked daily yet"}
          {sub ? ` · ${sub}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {m.buy_url && (
            <a href={m.buy_url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "lg" })}>
              Buy from manufacturer
            </a>
          )}
          {m.official_url && (
            <a href={m.official_url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Official site
            </a>
          )}
        </div>
      </header>

      <Section title="Latest prices" aside={sellers.length === 1 ? <span className="text-xs text-muted-foreground">{sellers[0]}</span> : undefined}>
        {!tracked ? (
          <p className="text-sm text-muted-foreground">Not tracked daily yet. The range above is the manufacturer&rsquo;s published list price.</p>
        ) : (
          <ul className="divide-y divide-border">
            {latest.map((p) => (
              <li key={`${p.seller}|${p.variant}`} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-snug">{p.variant}</div>
                  <div className="text-sm text-muted-foreground">
                    {p.kind === "subscription" ? "Per month · not in the range above · " : p.kind === "accessory" ? "Accessory · not in the range above · " : ""}
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className={ext}>
                      {sellers.length > 1 ? p.sellerName : "View on store"}
                    </a>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <span className="font-semibold">{usd(p.price_usd)}</span>
                  {p.available === true ? <Badge tone="good">In stock</Badge> : p.available === false ? <Badge tone="warn">Sold out</Badge> : <Badge>Stock unknown</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {history.series.length > 0 && (
        <Section
          title="Price history"
          aside={
            <span className="text-xs text-muted-foreground">
              since {fmtDate(history.dates[0])} · {history.dates.length} daily snapshot{history.dates.length === 1 ? "" : "s"}
            </span>
          }
        >
          <PriceChart dates={history.dates} series={history.series} />
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Table view</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Date</th>
                    {history.series.map((s) => (
                      <th key={s.key} className="py-1 pr-3 text-right font-medium">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.dates.map((d) => (
                    <tr key={d}>
                      <td className="py-1 pr-3">{fmtDate(d)}</td>
                      {history.series.map((s) => {
                        const p = s.points.find((pt) => pt.date === d);
                        return (
                          <td key={s.key} className="py-1 pr-3 text-right">
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
          <Spec label="Published range">{purchaseRange(m)}</Spec>
          <Spec label="Pricing">
            {m.price_model === "quote" ? "Quote" : m.price_model === "subscription" ? "Subscription" : "Purchase"}
            {sub ? ` · ${sub}` : ""}
          </Spec>
          <Spec label="HQ">{m.hq_country ?? "—"}</Spec>
          <Spec label="FCC grantee">{m.fcc_grantee_code ? <span className="font-mono">{m.fcc_grantee_code}</span> : "—"}</Spec>
        </dl>
      </Section>

      <Section title="FCC authorization">
        {fcc.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No FCC ID on file for this model. For US use the unit should carry an FCC ID label; check{" "}
            <a href="https://apps.fcc.gov/oetcf/eas/reports/GenericSearch.cfm" target="_blank" rel="noopener noreferrer" className={ext}>
              the FCC equipment authorization search
            </a>
            .
          </p>
        ) : (
          <ul className="space-y-3">
            {fcc.map((f) => (
              <FccLine key={f.fcc_id} fact={f} />
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Since {COVERED_LIST_LABEL} the FCC does not issue new authorizations for foreign-produced advanced robotic devices. Models authorized before
          that date can generally still be marketed and used in the US.
        </p>
      </Section>

      <Section title="Resale notes">
        <p className="max-w-prose text-sm leading-relaxed text-foreground/85">{m.resale_policy_note ?? "No resale notes yet."}</p>
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
        {m.data_source_license && <p className="mt-3 text-xs text-muted-foreground">{m.data_source_license}</p>}
      </Section>
    </article>
  );
}

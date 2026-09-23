import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Delta } from "@/components/Delta";
import { FccLine } from "@/components/FccLine";
import { PriceChart } from "@/components/PriceChart";
import { AlertSignup } from "@/components/AlertSignup";
import { CHART_MIN_SNAPSHOTS, fccFacts, getModel, getModels, latestPrices, priceHistory, variantDeltas } from "@/lib/data";
import { CATEGORY_LABEL, COVERED_LIST_LABEL, fmtDate, fmtDay, priceRange, purchaseRange, rangeText, STATUS_LABEL, subscriptionLabel, usd } from "@/lib/format";

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

function Card({ title, aside, children, id }: { title: string; aside?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section className="card p-5 sm:p-6" aria-labelledby={id}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-[18px] font-bold">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="micro">{label}</dt>
      <dd className="mt-1 text-[14px]">{children}</dd>
    </div>
  );
}

const ext = "underline decoration-line underline-offset-2 hover:decoration-ink";

export default async function RobotPage({ params }: PageProps<"/robots/[id]">) {
  const { id } = await params;
  const m = getModel(id);
  if (!m) notFound();

  const latest = latestPrices(m.id);
  const deltas = variantDeltas(m.id);
  const history = priceHistory(m.id);
  const fcc = fccFacts(m);
  const purchase = latest.filter((p) => p.kind === "purchase");
  const tracked = purchase.length > 0;
  const lastSeen = latest.reduce<string | null>((acc, p) => (acc && acc > p.date ? acc : p.date), null);
  const headline = tracked ? rangeText(purchase[0].price_usd, purchase[purchase.length - 1].price_usd) : purchaseRange(m);
  const sub = subscriptionLabel(m);
  const sellers = [...new Set(latest.map((p) => p.sellerName))];
  const cheapest = deltas.filter((d) => d.kind === "purchase").sort((a, b) => a.price_usd - b.price_usd)[0];
  const headDelta = cheapest && cheapest.from != null ? { amount: cheapest.price_usd - cheapest.from, pct: cheapest.from ? ((cheapest.price_usd - cheapest.from) / cheapest.from) * 100 : 0 } : null;
  const snapshots = history.dates.length;

  return (
    <article className="py-8 sm:py-12">
      <nav className="mb-4 text-[13px] text-ink-2" aria-label="Breadcrumb">
        <Link href="/" className="hover:underline">
          Robots
        </Link>{" "}
        / {CATEGORY_LABEL[m.category]}
      </nav>
      <header className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div>
          <h1 className="text-[34px] font-extrabold leading-[1.05] sm:text-[44px]">{m.name}</h1>
          <p className="mt-2 text-ink-2">
            {m.manufacturer}
            {m.hq_country ? ` · ${m.hq_country}` : ""}
            {m.launch_year ? ` · ${m.launch_year}` : ""}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="num text-[28px] text-ink">{headline}</span>
            {headDelta && <Delta amount={headDelta.amount} pct={headDelta.pct} className="text-[14px]" />}
            <Badge tone={m.status === "shipping" ? "up" : "amber"}>{STATUS_LABEL[m.status] ?? m.status}</Badge>
            {tracked ? (
              <Badge tone="accent" mono>
                Tracked
              </Badge>
            ) : (
              <Badge mono>Not tracked</Badge>
            )}
            {m.price_model === "quote" && <Badge>Price on request</Badge>}
          </div>
          <p className="mt-1 font-mono text-[11.5px] text-ink-3">
            {tracked && lastSeen ? `latest snapshot ${fmtDate(lastSeen)} UTC` : "published list price · not tracked daily yet"}
            {sub ? ` · ${sub}` : ""}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {m.buy_url && (
              <a href={m.buy_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center rounded-ctl bg-accent px-5 text-sm font-semibold text-accent-fg hover:brightness-95">
                Buy from manufacturer
              </a>
            )}
            {m.official_url && (
              <a href={m.official_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center rounded-ctl border border-line bg-card px-5 text-sm font-medium hover:bg-sunk">
                Official site
              </a>
            )}
          </div>
        </div>

        <Card title={tracked ? "Yesterday → today" : "Latest prices"} id="prices-heading" aside={sellers.length === 1 ? <span className="text-[12px] text-ink-3">{sellers[0]}</span> : undefined}>
          {!tracked ? (
            <p className="text-[13.5px] text-ink-2">Not tracked daily yet. The range shown is the manufacturer&rsquo;s published list price.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {deltas.map((p) => (
                <li key={`${p.seller}|${p.variant}`} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium leading-snug">{p.variant}</div>
                    <div className="text-[12px] text-ink-3">
                      {p.kind === "subscription" ? "per month · not in the range · " : p.kind === "accessory" ? "accessory · not in the range · " : sellers.length > 1 ? `${p.sellerName} · ` : ""}
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className={ext}>
                        store
                      </a>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="num text-[14px]">{usd(p.price_usd)}</span>
                      {p.available === true ? <Badge tone="up">In stock</Badge> : p.available === false ? <Badge tone="amber">Sold out</Badge> : <Badge>Stock unknown</Badge>}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-ink-3">
                      {p.from != null && p.from_date ? (
                        p.from === p.price_usd ? (
                          `same as ${fmtDay(p.from_date)}`
                        ) : (
                          <>
                            {usd(p.from)} → <Delta amount={p.price_usd - p.from} pct={p.from ? ((p.price_usd - p.from) / p.from) * 100 : 0} className="text-[11px]" />
                          </>
                        )
                      ) : (
                        "first day"
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {snapshots >= CHART_MIN_SNAPSHOTS && history.series.length > 0 && (
          <div className="lg:col-span-2">
            <Card title="Price history" id="history-heading" aside={<span className="text-[12px] text-ink-3">since {fmtDate(history.dates[0])} · {snapshots} daily snapshots</span>}>
              <PriceChart dates={history.dates} series={history.series} />
            </Card>
          </div>
        )}

        <Card title="Specs" id="specs-heading">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Spec label="Category">{CATEGORY_LABEL[m.category]}</Spec>
            <Spec label="Weight">{m.weight_kg != null ? `${m.weight_kg} kg` : "—"}</Spec>
            <Spec label="Height">{m.height_cm != null ? `${m.height_cm} cm` : "—"}</Spec>
            <Spec label="Launched">{m.launch_year ?? "—"}</Spec>
            <Spec label="Published range">
              <span className="num">{purchaseRange(m)}</span>
            </Spec>
            <Spec label="Pricing">
              {m.price_model === "quote" ? "Quote" : m.price_model === "subscription" ? "Subscription" : "Purchase"}
              {sub ? ` · ${sub}` : ""}
            </Spec>
            <Spec label="HQ">{m.hq_country ?? "—"}</Spec>
            <Spec label="FCC grantee">{m.fcc_grantee_code ? <span className="font-mono">{m.fcc_grantee_code}</span> : "—"}</Spec>
          </dl>
        </Card>

        <Card title="FCC authorization" id="fcc-heading">
          {fcc.length === 0 ? (
            <p className="text-[13.5px] text-ink-2">
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
          <p className="mt-4 text-[12px] text-ink-3">
            Since {COVERED_LIST_LABEL} the FCC does not issue new authorizations for foreign-produced advanced robotic devices. Models authorized
            before that date can generally still be marketed and used in the US.
          </p>
        </Card>

        <Card title="Resale notes" id="resale-heading">
          <p className="max-w-prose text-[14px] leading-relaxed text-ink-2">{m.resale_policy_note ?? "No resale notes yet."}</p>
        </Card>

        <Card title="Sources" id="sources-heading">
          <ul className="space-y-1.5 text-[13.5px]">
            {m.sources.map((s) => (
              <li key={s} className="min-w-0 truncate">
                <a href={s} target="_blank" rel="noopener noreferrer" className={ext}>
                  {s.replace(/^https?:\/\//, "")}
                </a>
              </li>
            ))}
          </ul>
          {m.data_source_license && <p className="mt-3 text-[12px] text-ink-3">{m.data_source_license}</p>}
        </Card>
      </div>

      <div className="mt-10">
        <AlertSignup />
      </div>
    </article>
  );
}

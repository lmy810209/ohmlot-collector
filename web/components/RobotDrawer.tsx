"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { XIcon } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "./Badge";
import { Delta } from "./Delta";
import { FccLine } from "./FccLine";
import { PriceChart } from "./PriceChart";
import type { RobotDetail } from "@/lib/data";
import { CATEGORY_SINGULAR, CHART_MIN_SNAPSHOTS, fmtDate, fmtDay, launchPriceNote, purchaseRange, rangeText, STATUS_LABEL, subscriptionLabel, UNCHANGED_MIN_DAYS, usd } from "@/lib/format";

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(max-width: 639px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useIsPhone() {
  return useSyncExternalStore(subscribe, () => window.matchMedia("(max-width: 639px)").matches, () => false);
}

export function RobotDrawer({ detail, open, onOpenChange }: { detail: RobotDetail | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const phone = useIsPhone();
  const m = detail?.model;
  const latest = detail?.latest ?? [];
  const deltas = detail?.deltas ?? [];
  const purchase = latest.filter((p) => p.kind === "purchase");
  const tracked = purchase.length > 0;
  const headline = tracked ? rangeText(purchase[0].price_usd, purchase[purchase.length - 1].price_usd) : m ? purchaseRange(m) : "";
  const lastSeen = latest.reduce<string | null>((acc, p) => (acc && acc > p.date ? acc : p.date), null);
  const sellers = [...new Set(latest.map((p) => p.sellerName))];
  const sub = m ? subscriptionLabel(m) : null;
  const cheapest = deltas.filter((d) => d.kind === "purchase").sort((a, b) => a.price_usd - b.price_usd)[0];
  const headDelta = cheapest && cheapest.from != null ? { amount: cheapest.price_usd - cheapest.from, pct: cheapest.from ? ((cheapest.price_usd - cheapest.from) / cheapest.from) * 100 : 0 } : null;
  const snapshots = detail?.history.dates.length ?? 0;
  const launchNote = m ? launchPriceNote(m) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={phone ? "bottom" : "right"} showCloseButton={false} className={`bg-card ${phone ? "max-h-[88vh] rounded-t-[var(--r)]" : "sm:max-w-md"}`}>
        <SheetClose className="absolute top-3 right-3 inline-flex size-10 items-center justify-center rounded-ctl text-ink-2 hover:bg-sunk hover:text-ink" aria-label="Close">
          <XIcon className="size-5" />
        </SheetClose>
        {m && detail && (
          <>
            <SheetHeader className="pr-14 pb-0">
              <p className="micro">{CATEGORY_SINGULAR[m.category]}</p>
              <SheetTitle className="text-[24px] font-bold tracking-[-0.03em] text-ink">{m.name}</SheetTitle>
              <SheetDescription className="text-ink-2">
                {m.manufacturer}
                {m.hq_country ? ` · ${m.hq_country}` : ""}
                {m.launch_year ? ` · ${m.launch_year}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-[22px] text-ink">{headline}</span>
                {headDelta && <Delta amount={headDelta.amount} pct={headDelta.pct} className="text-[13px]" />}
                <Badge tone={m.status === "shipping" ? "up" : "amber"}>{STATUS_LABEL[m.status] ?? m.status}</Badge>
                {m.tracking_status === "tracked" ? (
                  <Badge tone="accent" mono>
                    Tracked
                  </Badge>
                ) : (
                  <Badge tone="muted" mono>
                    {m.tracking_status === "listed" ? "Listed" : "Announced"}
                  </Badge>
                )}
              </div>
              <p className="mt-1 font-mono text-[11px] text-ink-3">
                {tracked && lastSeen ? `latest ${fmtDate(lastSeen)} UTC` : "published list price · not tracked"}
                {sub ? ` · ${sub}` : ""}
                {/* 작업2.6 §3: a long unchanged streak is itself a daily-collected fact, not a blank screen —
                    proof the robot is still being watched even when nothing moved. */}
                {detail && detail.unchangedDays >= UNCHANGED_MIN_DAYS ? ` · Unchanged for ${detail.unchangedDays} days` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/robots/${m.id}`} className="inline-flex h-9 items-center rounded-ctl bg-accent px-3.5 text-[13px] font-semibold text-accent-fg hover:brightness-95">
                  Open full page
                </Link>
                {m.buy_url && (
                  <a href={m.buy_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-ctl border border-line px-3.5 text-[13px] font-medium hover:bg-sunk">
                    Manufacturer store
                  </a>
                )}
              </div>

              <section className="mt-6">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[15px] font-semibold">{tracked ? "Yesterday → today" : "Latest prices"}</h3>
                  {sellers.length === 1 && <span className="text-[12px] text-ink-3">{sellers[0]}</span>}
                </div>
                {!tracked ? (
                  <p className="mt-1 text-[13px] text-ink-2">
                    Not tracked daily — {m.tracking_status === "announced" ? `announced${m.expected_launch ? `, ${m.expected_launch}` : ""}, not yet available` : (m.listed_reason ?? "no public price found")}.{" "}
                    {launchNote ? (
                      launchNote
                    ) : m.price_provenance === "vendor_page" ? (
                      `The range above was checked on a real sales page${m.price_provenance_date ? ` (${m.price_provenance_date})` : ""}, not from the collector.`
                    ) : (
                      "The range above is the manufacturer’s published list price."
                    )}
                  </p>
                ) : (
                  <ul className="mt-1 divide-y divide-line-soft">
                    {deltas.map((p) => (
                      <li key={`${p.seller}|${p.variant}`} className="flex items-start justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-medium leading-snug">{p.variant}</div>
                          {(sellers.length > 1 || p.kind !== "purchase") && (
                            <div className="text-[12px] text-ink-3">
                              {p.kind === "subscription" ? "per month · not in the range" : p.kind === "accessory" ? "accessory · not in the range" : p.sellerName}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="num text-[14px]">{usd(p.price_usd)}</span>
                            {p.available === true ? <Badge tone="up">In stock</Badge> : p.available === false ? <Badge tone="amber">Sold out</Badge> : null}
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
              </section>

              {snapshots >= CHART_MIN_SNAPSHOTS && detail.history.series.length > 0 && (
                <section className="mt-6">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-[15px] font-semibold">Price history</h3>
                    <span className="text-[12px] text-ink-3">
                      since {fmtDate(detail.history.dates[0])} · {snapshots} snapshots
                    </span>
                  </div>
                  <div className="mt-2">
                    <PriceChart dates={detail.history.dates} series={detail.history.series} />
                  </div>
                </section>
              )}

              <section className="mt-6">
                <h3 className="text-[15px] font-semibold">US regulatory status</h3>
                {detail.fcc.length === 0 ? (
                  <p className="mt-1 text-[13px] text-ink-2">No FCC ID on file.</p>
                ) : (
                  <ul className="mt-1 space-y-2">
                    {detail.fcc.map((f) => (
                      <FccLine key={f.fcc_id} fact={f} />
                    ))}
                  </ul>
                )}
              </section>

              {m.resale_policy_note && (
                <section className="mt-6">
                  <h3 className="text-[15px] font-semibold">Resale notes</h3>
                  <p className="mt-1 line-clamp-5 text-[13.5px] leading-relaxed text-ink-2">{m.resale_policy_note}</p>
                  <Link href={`/robots/${m.id}`} className="mt-1 inline-flex h-8 items-center text-[13px] text-accent-ink underline-offset-4 hover:underline">
                    Read all on the full page
                  </Link>
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

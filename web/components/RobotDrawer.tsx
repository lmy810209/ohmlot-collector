"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { XIcon } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "./Badge";
import { PriceChart } from "./PriceChart";
import { FccLine } from "./FccLine";
import type { RobotDetail } from "@/lib/data";
import { CATEGORY_SINGULAR, fmtDate, purchaseRange, rangeText, STATUS_LABEL, subscriptionLabel, usd } from "@/lib/format";

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
  const purchase = latest.filter((p) => p.kind === "purchase");
  const tracked = purchase.length > 0;
  const headline = tracked ? rangeText(purchase[0].price_usd, purchase[purchase.length - 1].price_usd) : m ? purchaseRange(m) : "";
  const lastSeen = latest.reduce<string | null>((acc, p) => (acc && acc > p.date ? acc : p.date), null);
  const sellers = [...new Set(latest.map((p) => p.sellerName))];
  const sub = m ? subscriptionLabel(m) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={phone ? "bottom" : "right"} showCloseButton={false} className={phone ? "max-h-[88vh] rounded-t-xl" : "sm:max-w-md"}>
        <SheetClose render={<Button variant="ghost" className="absolute top-2 right-2 size-10" aria-label="Close" />}>
          <XIcon className="size-5" />
        </SheetClose>
        {m && detail && (
          <>
            <SheetHeader className="pr-14">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{CATEGORY_SINGULAR[m.category]}</p>
              <SheetTitle className="text-2xl font-semibold tracking-tight">{m.name}</SheetTitle>
              <SheetDescription>
                {m.manufacturer}
                {m.hq_country ? ` · ${m.hq_country}` : ""}
                {m.launch_year ? ` · ${m.launch_year}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl font-semibold">{headline}</span>
                <Badge tone={m.status === "shipping" ? "good" : "warn"}>{STATUS_LABEL[m.status] ?? m.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {tracked && lastSeen ? `Tracked daily · latest ${fmtDate(lastSeen)}` : "Published list price · not tracked yet"}
                {sub ? ` · ${sub}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/robots/${m.id}`} className={buttonVariants({ variant: "default", size: "sm" })}>
                  Open full page
                </Link>
                {m.buy_url && (
                  <a href={m.buy_url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Manufacturer store
                  </a>
                )}
              </div>

              <section className="mt-6">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold">Latest prices</h3>
                  {sellers.length === 1 && <span className="text-xs text-muted-foreground">{sellers[0]}</span>}
                </div>
                {!tracked ? (
                  <p className="mt-1 text-sm text-muted-foreground">Not tracked daily yet. The range above is the manufacturer&rsquo;s published list price.</p>
                ) : (
                  <ul className="mt-1 divide-y divide-border">
                    {latest.map((p) => (
                      <li key={`${p.seller}|${p.variant}`} className="flex items-start justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium leading-snug">{p.variant}</div>
                          {(sellers.length > 1 || p.kind !== "purchase") && (
                            <div className="text-xs text-muted-foreground">
                              {p.kind === "subscription" ? "Per month · not in the range above" : p.kind === "accessory" ? "Accessory · not in the range above" : p.sellerName}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2 pt-0.5">
                          <span className="text-sm font-semibold">{usd(p.price_usd)}</span>
                          {p.available === true ? <Badge tone="good">In stock</Badge> : p.available === false ? <Badge tone="warn">Sold out</Badge> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {detail.history.series.length > 0 && (
                <section className="mt-6">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold">Price history</h3>
                    <span className="text-xs text-muted-foreground">
                      since {fmtDate(detail.history.dates[0])} · {detail.history.dates.length} snapshot{detail.history.dates.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-2">
                    <PriceChart dates={detail.history.dates} series={detail.history.series} />
                  </div>
                </section>
              )}

              <section className="mt-6">
                <h3 className="text-sm font-semibold">FCC authorization</h3>
                {detail.fcc.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">No FCC ID on file.</p>
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
                  <h3 className="text-sm font-semibold">Resale notes</h3>
                  <p className="mt-1 line-clamp-5 text-sm leading-relaxed text-foreground/85">{m.resale_policy_note}</p>
                  <Link href={`/robots/${m.id}`} className="mt-1 inline-flex h-8 items-center text-sm text-brand underline-offset-4 hover:underline">
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

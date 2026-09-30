import type { Category, Model } from "./data";

/** FCC DA 26-786: foreign-produced advanced robotic devices were added to the Covered List on this date. */
export const COVERED_LIST_DATE = "2026-07-28";

/** Low-data rules (guide §6): lowest-price badges and charts wait for this many daily snapshots … */
export const BASELINE_DAYS = 14;
/** … and below this many snapshots the UI shows yesterday → today deltas instead of a chart. */
export const CHART_MIN_SNAPSHOTS = 7;
/** task-changes-page.md §2: the collection status card turns red once the last collection is this many
 * hours old — the daily run is scheduled once every 24h, so 36h means at least one full run was missed. */
export const STALE_HOURS = 36;

export type Priced = Pick<Model, "price_model" | "price_usd_min" | "price_usd_max" | "subscription_usd_month" | "price_provenance" | "price_provenance_date" | "price_provenance_source">;

export function usd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

/** "$1,600–$4,500" or "$13,500". */
export function rangeText(min: number, max: number): string {
  return min === max ? usd(min) : `${usd(min)}–${usd(max)}`;
}

/**
 * Published purchase price: "$1,600–$4,500", "$13,500" or "Quote". Subscriptions are labelled separately.
 *
 * task-prelaunch.md §A.2: an unverified ("press" or "unknown" provenance) price never appears here as a bare
 * number — that's exactly the standalone-number exposure the task calls out. It returns "Not verified"
 * instead; the actual figure, with its full citation and caveat, only ever appears through launchPriceNote
 * below, in the one place a page chooses to show it.
 */
export function purchaseRange(m: Priced): string {
  if (m.price_provenance === "press" || m.price_provenance === "unknown") return "Not verified";
  if (m.price_model === "quote" || (m.price_usd_min == null && m.price_usd_max == null)) return "Quote";
  const min = m.price_usd_min ?? (m.price_usd_max as number);
  const max = m.price_usd_max ?? min;
  return rangeText(min, max);
}

/**
 * task-prelaunch.md §A.2's exact required sentence shape for a "press"/"unknown" price, e.g. "Launch price
 * (press release, 2025-03): $5,999 — not verified, not current". Null for "observed"/"vendor_page" (nothing
 * to disclaim) or when there's no price at all to disclaim in the first place. This is the *only* place an
 * unverified number is allowed to appear on the site.
 */
export function launchPriceNote(m: Priced): string | null {
  if (m.price_provenance !== "press" && m.price_provenance !== "unknown") return null;
  if (m.price_usd_min == null && m.price_usd_max == null) return null;
  const min = m.price_usd_min ?? (m.price_usd_max as number);
  const max = m.price_usd_max ?? min;
  const figure = rangeText(min, max);
  const source = m.price_provenance_source ?? (m.price_provenance === "press" ? "press release" : "source unknown");
  const cite = m.price_provenance_date ? `${source}, ${m.price_provenance_date}` : source;
  return `Launch price (${cite}): ${figure} — not verified, not current.`;
}

/** "$499/mo subscription" or null. */
export function subscriptionLabel(m: Priced): string | null {
  return m.subscription_usd_month != null ? `${usd(m.subscription_usd_month)}/mo subscription` : null;
}

/** One-line summary for metadata: "$20,000 · $499/mo subscription". */
export function priceRange(m: Priced): string {
  const sub = subscriptionLabel(m);
  return sub ? `${purchaseRange(m)} · ${sub}` : purchaseRange(m);
}

function utcDate(iso: string): Date {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d));
}

/** "Sep 23, 2026" */
export function fmtDate(iso: string): string {
  return utcDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "May 2024" */
export function fmtMonth(iso: string): string {
  return utcDate(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * "05:26 UTC" from a full ISO instant (a price row's `observed_at`, e.g. "2026-09-28T05:26:11.488Z") — the
 * daily run's own observed collection time, not the cron's scheduled trigger time (task-runtime-label.md:
 * that schedule has never actually held, sometimes slipping 5+ hours, so the site prints what happened, not
 * what was hoped for). Returns null on anything that doesn't parse to a valid instant — callers show "—",
 * never a guessed time.
 */
export function fmtTime(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

export const COVERED_LIST_LABEL = fmtDate(COVERED_LIST_DATE);

/** FCC primary documents behind the US regulatory status block (context/fcc-api-notes.md). */
export const FCC_DOCS = {
  coveredListNotice: "https://docs.fcc.gov/public/attachments/DA-26-786A1.pdf", // DA 26-786, Jul 28 2026
  factSheet: "https://docs.fcc.gov/public/attachments/DOC-423682A1.txt", // Jul 28 2026: previously authorized models may still be sold, imported, used
  conditionalApprovals: "https://docs.fcc.gov/public/attachments/DA-26-996A1.pdf", // DA 26-996, Sep 18 2026, Appendix B lists every approval
  search: "https://apps.fcc.gov/oetcf/eas/reports/GenericSearch.cfm",
};

/** FCC's own equipment-authorization record for an FCC ID (mirrors fccSourceUrl in the collector). */
export function fccRecordUrl(fccId: string | null | undefined): string | null {
  if (!fccId) return null;
  const id = fccId.toUpperCase();
  const [grantee, product] = id.includes("-") ? [id.slice(0, id.indexOf("-")), id.slice(id.indexOf("-") + 1)] : [id.slice(0, 5), id.slice(5)];
  if (!grantee || !product) return null;
  return `https://apps.fcc.gov/oetcf/eas/reports/GenericSearchResult.cfm?RequestTimeout=500&grantee_code=${grantee}&product_code=${encodeURIComponent(product)}`;
}

/** The one-line rule every FCC surface repeats, worded once. */
export const COVERED_LIST_RULE = `Since ${COVERED_LIST_LABEL}, foreign-produced robots can no longer receive a new FCC authorization; devices authorized before that date can still be sold, imported, and used in the US.`;

/** Data notes keep ISO dates (machine-friendly); the page shows them like every other date. */
export function humanizeIsoDates(text: string): string {
  return text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (iso) => fmtDate(iso));
}

export const CATEGORY_LABEL: Record<Category, string> = {
  humanoid: "Humanoids",
  quadruped: "Quadrupeds",
  desktop: "Desktop robots",
  arm: "Arms",
};

export const CATEGORY_SINGULAR: Record<Category, string> = {
  humanoid: "Humanoid",
  quadruped: "Quadruped",
  desktop: "Desktop",
  arm: "Arm",
};

export const CATEGORY_ORDER: Category[] = ["humanoid", "quadruped", "desktop", "arm"];

export const STATUS_LABEL: Record<string, string> = {
  shipping: "Shipping",
  preorder: "Pre-order",
};

export function pct(n: number): string {
  const s = n.toFixed(Math.abs(n) < 10 ? 1 : 0);
  return (n > 0 ? "+" : "") + s + "%";
}

/** "+$50" / "−$50" / "$0". */
export function signedUsd(n: number): string {
  if (n > 0) return `+${usd(n)}`;
  if (n < 0) return `−${usd(-n)}`;
  return usd(0);
}

/** "Sep 23" (no year) for tight labels. */
export function fmtDay(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** A YYYY-MM-DD date, n days later (n may be negative) — still a plain date, no time component. */
export function addDaysUTC(iso: string, n: number): string {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}

/** Hours between a full ISO instant and now (positive = in the past). Takes `now` as a param so the collection-
 * status card's staleness check is testable against a fixed clock, not React-render-time wall time. */
export function hoursSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 3_600_000;
}

/** "Sep 24, 2026, 06:03 UTC" — for a full ISO instant (observed_at), not just a YYYY-MM-DD date. */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return `${day}, ${time} UTC`;
}

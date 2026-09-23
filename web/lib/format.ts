import type { Category, Model } from "./data";

/** FCC DA 26-786: foreign-produced advanced robotic devices were added to the Covered List on this date. */
export const COVERED_LIST_DATE = "2026-07-28";

/** Low-data rules (guide §6): lowest-price badges and charts wait for this many daily snapshots … */
export const BASELINE_DAYS = 14;
/** … and below this many snapshots the UI shows yesterday → today deltas instead of a chart. */
export const CHART_MIN_SNAPSHOTS = 7;

export type Priced = Pick<Model, "price_model" | "price_usd_min" | "price_usd_max" | "subscription_usd_month">;

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

/** Published purchase price: "$1,600–$4,500", "$13,500" or "Quote". Subscriptions are labelled separately. */
export function purchaseRange(m: Priced): string {
  if (m.price_model === "quote" || (m.price_usd_min == null && m.price_usd_max == null)) return "Quote";
  const min = m.price_usd_min ?? (m.price_usd_max as number);
  const max = m.price_usd_max ?? min;
  return rangeText(min, max);
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

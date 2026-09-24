// Pure display logic for collector events — no fs, safe to import from a client component. Separate from
// lib/data.ts (which reads data/events.jsonl from disk) so the /changes list's client-side toggle can import
// just the formatting helpers, not the whole build-time data layer.
import type { Tone } from "@/components/Badge";
import type { EventType } from "./data";
import { usd } from "./format";

export const EVENT_LABEL: Record<EventType, string> = {
  price_changed: "Price changed",
  availability_changed: "Availability changed",
  discount_started: "Discount started",
  discount_ended: "Discount ended",
  variant_added: "New variant",
  variant_removed: "Variant removed",
  lead_time_changed: "Lead time changed",
  product_unpublished: "Product page gone",
  observation_started: "Observation started",
};

const STATUS_LABEL: Record<string, string> = {
  in_stock: "in stock",
  out_of_stock: "out of stock",
  pre_order: "pre-order",
  contact_sales: "contact sales",
  unknown: "unknown",
};

function statusText(v: unknown): string {
  if (v == null) return "—";
  return typeof v === "string" ? (STATUS_LABEL[v] ?? v) : String(v);
}

interface EventLike {
  type: EventType;
  from: unknown;
  to: unknown;
}

/**
 * Tone for one real (non-observation-started) event. up/down mirror the Delta component's own convention
 * (guide §3: "변동... 색은 up/down 토큰만") — a price *increase* is up/green and a *decrease* is down/red,
 * matching both style-guide-modern.md's own token comments ("--up: 가격 상승", "--down: 가격 하락·경고")
 * and the existing Delta.tsx component (`up = amount > 0`). This reads as the arithmetic direction of the
 * number, not "good or bad for the buyer" — kept that way for consistency with the home page's existing
 * price-change card, which uses the same Delta component right next to this list's own "Recent changes"
 * block. discount_started/ended follow the same direction (a discount appearing is a price decrease).
 * Observation-started rows always render in plain gray regardless of type — handled by the caller, not here.
 */
export function eventTone(e: EventLike): Tone {
  switch (e.type) {
    case "price_changed":
      return Number(e.to) > Number(e.from) ? "up" : "down";
    case "discount_started":
      return "down";
    case "discount_ended":
      return "up";
    case "availability_changed":
      if (e.to === "in_stock") return "up";
      if (e.to === "out_of_stock" || e.to === "pre_order" || e.to === "contact_sales") return "amber";
      return "neutral";
    case "product_unpublished":
      return "down";
    case "variant_added":
    case "variant_removed":
    case "lead_time_changed":
    case "observation_started":
      return "neutral";
  }
}

/** "$13,500 → $14,000" / "in stock → out of stock" / "new" / "page gone (404)" — value text per event type. */
export function eventValueText(e: EventLike): string {
  switch (e.type) {
    case "price_changed":
    case "discount_started":
    case "discount_ended":
      return `${e.from != null ? usd(Number(e.from)) : "—"} → ${e.to != null ? usd(Number(e.to)) : "—"}`;
    case "availability_changed":
      return `${statusText(e.from)} → ${statusText(e.to)}`;
    case "variant_added":
      return "new";
    case "variant_removed":
      return "removed";
    case "lead_time_changed":
      return `${statusText(e.from)} → ${statusText(e.to)}`;
    case "product_unpublished":
      return "page gone (404)";
    case "observation_started":
      return `${statusText(e.from)} → ${statusText(e.to)}`;
  }
}

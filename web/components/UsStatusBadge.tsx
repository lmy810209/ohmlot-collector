import { Badge, type Tone } from "./Badge";
import type { UsStatusKind } from "@/lib/data";

/**
 * The four US regulatory states, worded and colored the same everywhere they appear. "unknown" reads
 * differently depending on whether an FCC ID exists at all: an ID without a confirmed grant date is
 * "date unknown", no ID is "no record".
 */
export function usStatusLabel(kind: UsStatusKind, { short = false, hasFccId = true } = {}): string {
  switch (kind) {
    case "before":
      return short ? "Before Covered List" : "Authorized before the Covered List";
    case "conditional":
      return short ? "Conditional approval" : "Conditionally approved";
    case "after":
      return short ? "After Covered List" : "After the Covered List — check before buying";
    case "unknown":
      if (hasFccId) return short ? "Date unknown" : "Grant date unknown";
      return short ? "No FCC record" : "No FCC record on file";
  }
}

/** before = plain fact (outlined), conditional = caution (amber), after = warning (down), unknown = grey fill. */
export const US_STATUS_TONE: Record<UsStatusKind, Tone> = {
  before: "outline",
  conditional: "amber",
  after: "down",
  unknown: "muted",
};

export function UsStatusBadge({ kind, short = false, hasFccId = true }: { kind: UsStatusKind; short?: boolean; hasFccId?: boolean }) {
  return <Badge tone={US_STATUS_TONE[kind]}>{usStatusLabel(kind, { short, hasFccId })}</Badge>;
}

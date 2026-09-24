/**
 * task-prelaunch.md §B.3: one line, always next to a signup form, naming what's sent, how often, when it
 * starts, and how to stop. Never a subscriber count (§B.2 — 0 subscribers can't become "join 500 others").
 */
export function SubscribeDisclosure() {
  return (
    <p className="mt-2 text-[12px] text-ink-3">
      Price and stock-change alerts only, sent when something actually changes — not on a schedule. We
      haven&rsquo;t sent one yet; there isn&rsquo;t enough daily data. Unsubscribe anytime with the link in every email.
    </p>
  );
}

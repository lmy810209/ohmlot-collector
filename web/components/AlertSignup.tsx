"use client";

import { usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";

/**
 * Email alert CTA (guide §4.6). v0 only logs to the browser console; the TODO below is the Supabase hook-up
 * (table: alert_signups {email, model_id, created_at}).
 */
export function AlertSignup() {
  const pathname = usePathname();
  const modelId = pathname?.startsWith("/robots/") ? pathname.split("/")[2] ?? null : null;
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    // TODO(supabase): insert into alert_signups instead of logging.
    console.log("[ohmlot] alert signup", { email: trimmed, model_id: modelId, at: new Date().toISOString() });
    setDone(true);
  }

  return (
    <section aria-labelledby="alerts-heading" className="card grid grid-cols-1 gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)] md:items-center">
      <div>
        <div className="micro mb-2">Alerts</div>
        <h2 id="alerts-heading" className="text-[22px] font-bold sm:text-2xl">
          {modelId ? "Know when this robot's price moves." : "Know when a tracked price moves."}
        </h2>
        <p className="mt-2 max-w-md text-[14px] text-ink-2">
          One email per change, nothing else. New FCC grants for a robot you watch count as a change.
        </p>
      </div>
      {done ? (
        <p role="status" className="rounded-ctl border border-line bg-sunk px-4 py-3 text-sm">
          You&rsquo;re on the list. We&rsquo;ll be in touch.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="alert-email" className="sr-only">
            Email address
          </label>
          <input
            id="alert-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 flex-1 rounded-ctl border border-line bg-card px-3 text-[15px] text-ink placeholder:text-ink-3"
          />
          <button type="submit" className="h-11 rounded-ctl bg-accent px-5 text-sm font-semibold text-accent-fg hover:brightness-95">
            Notify me
          </button>
        </form>
      )}
    </section>
  );
}

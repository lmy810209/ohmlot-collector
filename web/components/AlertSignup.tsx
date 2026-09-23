"use client";

import { usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";

/**
 * Email alert signup. v0 only logs to the browser console; the TODO below is the Supabase hook-up
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
    <section aria-labelledby="alerts-heading" className="max-w-xl">
      <h2 id="alerts-heading" className="text-base font-semibold">
        Get price and FCC alerts
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {modelId
          ? "We'll email you when this robot's price changes or a new FCC grant appears."
          : "We'll email you when a tracked price changes or a new FCC grant appears."}
      </p>
      {done ? (
        <p role="status" className="mt-4 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          You&rsquo;re on the list. We&rsquo;ll be in touch.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
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
            className="h-11 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-white/10"
          />
          <button
            type="submit"
            className="h-11 rounded-md bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Notify me
          </button>
        </form>
      )}
    </section>
  );
}

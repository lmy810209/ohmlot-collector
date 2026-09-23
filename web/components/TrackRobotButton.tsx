"use client";

import { BellIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

/**
 * "Track this robot" — email capture on the model page. v0 logs to the browser console only; the TODO
 * below is the Supabase hook-up (table: alert_signups {email, model_id, created_at}), the same one
 * AlertSignup uses.
 */
export function TrackRobotButton({ modelId, modelName }: { modelId: string; modelName: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const inputId = useId();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    // TODO(supabase): insert { email, model_id } into alert_signups instead of logging.
    console.log("[ohmlot] track robot", { email: trimmed, model_id: modelId, at: new Date().toISOString() });
    setDone(true);
  }

  if (done) {
    return (
      <p role="status" className="inline-flex h-11 items-center rounded-ctl border border-line bg-sunk px-4 text-sm text-ink-2">
        Tracking {modelName}. We&rsquo;ll email you when its price or US status changes.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-ctl border border-line bg-card px-5 text-sm font-medium hover:bg-sunk"
      >
        <BellIcon className="size-4" aria-hidden="true" />
        Track this robot
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <label htmlFor={inputId} className="sr-only">
        Email address for {modelName} alerts
      </label>
      <input
        id={inputId}
        type="email"
        required
        autoFocus
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11 w-56 rounded-ctl border border-line bg-card px-3 text-[15px] text-ink placeholder:text-ink-3"
      />
      <button type="submit" className="h-11 rounded-ctl bg-accent px-4 text-sm font-semibold text-accent-fg hover:brightness-95">
        Track
      </button>
      <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-ctl px-3 text-sm text-ink-2 hover:bg-sunk">
        Cancel
      </button>
    </form>
  );
}

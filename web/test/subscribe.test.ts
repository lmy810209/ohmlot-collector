import { test } from "node:test";
import assert from "node:assert/strict";
import { isHoneypotTripped, looksLikeEmail, subscribe } from "../lib/subscribe.ts";

// task-prelaunch.md §B.2: what's actually testable without a live Supabase project (see the task-prelaunch
// report for what isn't — rate limiting and the unsubscribe-by-token path live entirely in
// supabase/migrations/0001_subscribers.sql, which needs a real Postgres to exercise).

test("isHoneypotTripped: empty (what a real visitor leaves it) is not tripped", () => {
  assert.equal(isHoneypotTripped(""), false);
  assert.equal(isHoneypotTripped("   "), false); // whitespace-only counts as empty
});

test("isHoneypotTripped: anything a bot actually wrote is tripped", () => {
  assert.equal(isHoneypotTripped("Acme Inc"), true);
  assert.equal(isHoneypotTripped("x"), true);
});

test("looksLikeEmail: accepts ordinary addresses, rejects obviously-not-an-email input", () => {
  assert.equal(looksLikeEmail("person@example.com"), true);
  assert.equal(looksLikeEmail("  person@example.com  "), true); // trims first
  assert.equal(looksLikeEmail("not-an-email"), false);
  assert.equal(looksLikeEmail("missing-domain@"), false);
  assert.equal(looksLikeEmail("@missing-local.com"), false);
  assert.equal(looksLikeEmail(""), false);
});

test("subscribe(): a tripped honeypot returns a fake success without ever calling Supabase (no NEXT_PUBLIC_SUPABASE_URL set in this test run, so any real network attempt would surface as not_configured instead)", async () => {
  const result = await subscribe({ email: "person@example.com", modelId: null, sourcePage: "/", honeypot: "bot filled this" });
  assert.deepEqual(result, { ok: true, status: "subscribed" });
});

test("subscribe(): an invalid email is rejected before any network call, honeypot or not", async () => {
  const result = await subscribe({ email: "not-an-email", modelId: null, sourcePage: "/", honeypot: "" });
  assert.deepEqual(result, { ok: false, reason: "invalid_email" });
});

test("subscribe(): a valid, non-honeypot submission with no Supabase env configured reports not_configured, not a silent failure", async () => {
  const result = await subscribe({ email: "person@example.com", modelId: "unitree-g1", sourcePage: "/robots/unitree-g1", honeypot: "" });
  assert.deepEqual(result, { ok: false, reason: "not_configured" });
});

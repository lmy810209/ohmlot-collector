"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/**
 * Browser Supabase client using the public anon key — safe to expose in client bundles. RLS on `subscribers`
 * denies anon everything, and the only grants this key has at all are EXECUTE on the two functions in
 * supabase/migrations/0001_subscribers.sql (subscribe, unsubscribe) — there is no way to read, insert,
 * update, or delete a row through this key except through those two narrowly-scoped functions.
 * Returns null when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY aren't set (see .env.example).
 */
export function browserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

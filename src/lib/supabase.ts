import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** Returns null when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — files-only mode. */
export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

export async function upsert(table: string, rows: object[], onConflict: string) {
  const sb = supabase();
  if (!sb || rows.length === 0) return;
  const { error } = await sb.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`supabase upsert ${table}: ${error.message}`);
}

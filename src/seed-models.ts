// One-off: load data/models.json into the Supabase `models` table.
import models from "../data/models.json" with { type: "json" };
import { upsert, supabase } from "./lib/supabase.ts";

if (!supabase()) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
await upsert("models", models as object[], "id");
console.log(`seeded ${models.length} models`);

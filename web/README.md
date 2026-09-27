# ohmlot.com — web (v0)

Next.js (App Router) + TypeScript + Tailwind. Everything is statically generated at build time from the
collector's output in `../data` (`models.json`, `prices/*.jsonl`, `fcc/grants.json`). No database yet.

## Pages

| Route | What |
| --- | --- |
| `/` | Tagline + all robots grouped by category: name, manufacturer, list-price range, status, "Tracked" when daily prices exist |
| `/robots/[id]` | Specs, latest price per seller/variant, price-history chart (+ table view), FCC IDs with grant date and Covered List (2026-07-28) flag, resale notes, sources |
| `/fcc` | Client-side search over FCC IDs by model name, manufacturer, grantee code, or FCC ID |

Rows whose `flags` include `placeholder_price` are dropped in `lib/data.ts` and never rendered.

The footer email form only logs to the browser console (`[ohmlot] alert signup`). Wiring it to Supabase is the
`TODO(supabase)` in `components/AlertSignup.tsx`.

## Run locally

```bash
cd web
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

`OHMLOT_DATA_DIR` overrides the data folder (default `../data`).

## Deploy to Vercel

The app lives in a subfolder and reads `../data`, so Vercel must build from the repo root with `web` as the
project's **Root Directory** (keep "Include files outside the root directory" on, which is the default).

Option A — Git integration (recommended): Vercel dashboard → Add New Project → import
`ohmlot-collector` → Root Directory `web` → Deploy. Every push to `main` (including the daily `snapshot` commits
from the collector) redeploys with fresh data.

Option B — CLI from the repo root:

```bash
vercel login
vercel link                     # create/select the project
vercel project ls               # then set Root Directory = web in the dashboard (Settings → General)
vercel --prod
```

Add both `www.ohmlot.com` and `ohmlot.com` under Settings → Domains, with **www as the primary** and the apex
redirecting to it (308). `SITE_URL` in `lib/site.ts` must match the primary domain: the sitemap, `robots.txt`
and every page's canonical tag are built from it.

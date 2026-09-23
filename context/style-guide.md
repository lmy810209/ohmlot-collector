# Ohmlot style guide

Ohmlot is a data-first marketplace for personal robots. The UI should read like a well-set price sheet: quiet
neutrals, one accent, figures that line up, nothing decorative.

## Brand

- **Accent: copper.** Ohm → resistance → copper wire. Light `#b8551d` (4.8:1 on white), dark `#e8905a`.
  Spend it on the logo mark, primary buttons, links, focus rings and the "current" point of a sparkline. Never
  on body text, table text or as a background wash larger than a pill.
- **Neutrals: cool graphite.** Light ground `#ffffff`, muted surface `#f3f4f6`, ink `#16181d`, secondary ink
  `#5f6673`, hairline `#e3e5ea`. Dark ground `#0e0f12`, surface `#14161a`, ink `#ececee`, secondary `#9a9faa`,
  hairline `#262930`. Dark is a re-stepped set, not an inversion.
- **Status (reserved):** good `#17784a` / `#4cc27f`, caution `#8f5a00` / `#e2a93c`, critical `#b3261e` /
  `#f07070`, each with a `-soft` tint for pill backgrounds. Status colors always ship with a label; never color alone.
- **Chart series:** the fixed-order eight-slot categorical palette in `web/app/globals.css` (`--series-1..8`),
  validated for CVD in both schemes. Assign in order, never cycle; past eight, fold into the table view.

All of the above live as CSS custom properties in `web/app/globals.css` and are exposed to Tailwind as
`brand`, `brand-soft`, `brand-strong`, `good`, `caution`, `critical`, plus the shadcn roles
(`background`, `foreground`, `muted`, `border`, `primary`, …). Components use the tokens, never raw hex.

## Logo

`components/Logo.tsx` — a rounded Ω on two feet, single 2.4px stroke, `currentColor`. Mark in copper next to
the wordmark "Ohmlot" (semibold, tight tracking). Favicon is `app/icon.svg` (white mark on a copper tile).

## Type

- Geist for everything; Geist Mono for FCC IDs and grantee codes only.
- Scale: 11px pills · 12px captions/eyebrows (uppercase, +0.05em) · 14px body/table · 16px lead · 18px section
  titles · 30–48px page title.
- `font-variant-numeric: tabular-nums` is set on `body`; every price, count and date lines up in columns.
- Headings `text-wrap: balance`; running text ≤ 65ch.

## Layout

- Max content width 1152px (`max-w-6xl`), 16px side gutter on phones, 24px from `sm`.
- Sections separate with hairlines and space, not cards. A card is reserved for the one thing that must read as
  a separate object (the detail drawer, the alert form).
- Tables: 40px header row, 12px cell padding, hover wash `muted/50`, sortable headers show the sort direction.
  Below `md`, drop secondary columns (type, FCC) rather than shrinking text.
- Touch targets ≥ 40px on phones.

## Components (shadcn, base-nova style)

`web/components/ui/*` are generated; don't hand-edit. Project components wrap them: `RobotTable` (TanStack
Table + filters), `RobotDrawer` (Sheet: right on desktop, bottom on phones), `Sparkline`, `PriceChart`,
`Badge` (status pills), `AlertSignup`.

## Copy

- English, sentence case. Controls name the outcome ("Notify me", "Open full page").
- Prices are USD list prices from official stores; say "list price" not "price" when the distinction matters.
- Dates are shown as "Sep 23, 2026" and are UTC.

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "./Badge";
import { Delta } from "./Delta";
import { RobotDrawer } from "./RobotDrawer";
import type { Category, RobotDetail, RobotRow } from "@/lib/data";
import { CATEGORY_SINGULAR, COVERED_LIST_LABEL, fmtMonth, purchaseRange, rangeText, STATUS_LABEL, subscriptionLabel } from "@/lib/format";

const CATEGORY_ITEMS = [
  { value: "all", label: "All types" },
  { value: "humanoid", label: "Humanoids" },
  { value: "quadruped", label: "Robot dogs" },
  { value: "desktop", label: "Desktop" },
  { value: "arm", label: "Arms" },
];
const STATUS_ITEMS = [
  { value: "all", label: "Any status" },
  { value: "shipping", label: "Shipping" },
  { value: "preorder", label: "Pre-order" },
];

type Filters = { category: string; status: string; trackedOnly: boolean; maxPrice: number | null; fccOnly: boolean };
const NONE: Filters = { category: "all", status: "all", trackedOnly: false, maxPrice: null, fccOnly: false };

const CHIPS: { label: string; on: (f: Filters) => boolean; toggle: (f: Filters) => Filters }[] = [
  { label: "Humanoids", on: (f) => f.category === "humanoid", toggle: (f) => ({ ...f, category: f.category === "humanoid" ? "all" : "humanoid" }) },
  { label: "Robot dogs", on: (f) => f.category === "quadruped", toggle: (f) => ({ ...f, category: f.category === "quadruped" ? "all" : "quadruped" }) },
  { label: "Desktop", on: (f) => f.category === "desktop", toggle: (f) => ({ ...f, category: f.category === "desktop" ? "all" : "desktop" }) },
  { label: "Under $1,000", on: (f) => f.maxPrice === 1000, toggle: (f) => ({ ...f, maxPrice: f.maxPrice === 1000 ? null : 1000 }) },
  { label: "Tracked daily", on: (f) => f.trackedOnly, toggle: (f) => ({ ...f, trackedOnly: !f.trackedOnly }) },
  { label: "FCC ID on file", on: (f) => f.fccOnly, toggle: (f) => ({ ...f, fccOnly: !f.fccOnly }) },
];

type Meta = { className?: string; align?: "right"; width: string };

function StatusPill({ status }: { status: string }) {
  return <Badge tone={status === "shipping" ? "up" : "amber"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function RobotExplorer({
  rows,
  details,
  aside,
  cards,
}: {
  rows: RobotRow[];
  details: Record<string, RobotDetail>;
  /** "Today's run" card, rendered on the server. */
  aside: ReactNode;
  /** The three summary cards, rendered on the server. */
  cards: ReactNode;
}) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>(NONE);
  const [sorting, setSorting] = useState<SortingState>([{ id: "price", desc: false }]);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle && !`${r.name} ${r.manufacturer} ${r.hq_country ?? ""}`.toLowerCase().includes(needle)) return false;
      if (filters.category !== "all" && r.category !== filters.category) return false;
      if (filters.status !== "all" && r.status !== filters.status) return false;
      if (filters.trackedOnly && !r.tracked) return false;
      if (filters.fccOnly && r.fcc_status === "none") return false;
      if (filters.maxPrice != null && !(r.sort_price <= filters.maxPrice)) return false;
      return true;
    });
  }, [rows, q, filters]);

  const columns = useMemo<ColumnDef<RobotRow, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Robot",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenId(r.id);
              }}
              className="block w-full min-w-0 rounded-sm text-left"
            >
              <span className="block text-[14px] font-medium leading-snug">{r.name}</span>
              <span className="mt-0.5 line-clamp-1 block text-[12px] text-ink-2">
                {r.manufacturer}
                {r.hq_country ? ` · ${r.hq_country}` : ""}
              </span>
              <span className="mt-1.5 flex gap-1.5 sm:hidden">
                <StatusPill status={r.status} />
                {r.tracked && (
                  <Badge tone="accent" mono>
                    Tracked
                  </Badge>
                )}
              </span>
            </button>
          );
        },
        meta: { width: "w-[56%] sm:w-[40%] md:w-[32%] lg:w-[26%]" } satisfies Meta,
      },
      {
        id: "category",
        accessorKey: "category",
        header: "Type",
        cell: ({ getValue }) => <span className="text-[13px] text-ink-2">{CATEGORY_SINGULAR[getValue() as Category]}</span>,
        meta: { className: "hidden lg:table-cell", width: "lg:w-[10%]" } satisfies Meta,
      },
      {
        id: "price",
        accessorFn: (r) => r.sort_price,
        header: "List price",
        cell: ({ row }) => {
          const r = row.original;
          const tracked = r.tracked && r.latest_min != null && r.latest_max != null;
          const sub = subscriptionLabel(r);
          return (
            <div className="text-right">
              <div className="num whitespace-nowrap text-[14px] text-ink">{tracked ? rangeText(r.latest_min as number, r.latest_max as number) : purchaseRange(r)}</div>
              <div className="whitespace-nowrap text-[12px] text-ink-3">
                {sub ? sub : tracked ? `${r.variants} variant${r.variants === 1 ? "" : "s"} · tracked` : "published list price"}
              </div>
            </div>
          );
        },
        meta: { align: "right", width: "w-[44%] sm:w-[28%] md:w-[22%] lg:w-[18%]" } satisfies Meta,
      },
      {
        id: "delta",
        accessorFn: (r) => (r.delta ? r.delta.amount : Number.NEGATIVE_INFINITY),
        header: "24h",
        cell: ({ row }) => {
          const r = row.original;
          if (!r.tracked) return <span className="font-mono text-[11px] whitespace-nowrap text-ink-3">not tracked</span>;
          if (!r.delta) return <span className="font-mono text-[11px] whitespace-nowrap text-ink-3">first day</span>;
          return <Delta amount={r.delta.amount} pct={r.delta.pct} className="text-[13px]" />;
        },
        meta: { align: "right", className: "hidden sm:table-cell", width: "sm:w-[16%] md:w-[14%] lg:w-[12%]" } satisfies Meta,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1.5">
            <StatusPill status={row.original.status} />
            {row.original.tracked && (
              <Badge tone="accent" mono>
                Tracked
              </Badge>
            )}
          </span>
        ),
        meta: { className: "hidden sm:table-cell", width: "sm:w-[16%] md:w-[14%] lg:w-[16%]" } satisfies Meta,
      },
      {
        id: "fcc",
        accessorKey: "fcc_status",
        header: "FCC",
        sortingFn: (a, b) => {
          const order = { before: 0, after: 1, unknown: 2, none: 3 } as const;
          const d = order[a.original.fcc_status] - order[b.original.fcc_status];
          return d !== 0 ? d : (b.original.fcc_grant_date ?? "").localeCompare(a.original.fcc_grant_date ?? "");
        },
        cell: ({ row }) => {
          const r = row.original;
          return r.fcc_status === "before" && r.fcc_grant_date ? (
            <Badge tone="up">Granted {fmtMonth(r.fcc_grant_date)}</Badge>
          ) : r.fcc_status === "after" ? (
            <Badge tone="amber">After Covered List</Badge>
          ) : r.fcc_status === "unknown" || r.fcc_status === "before" ? (
            <Badge>Date unknown</Badge>
          ) : (
            <span className="font-mono text-[11px] text-ink-3">no ID on file</span>
          );
        },
        meta: { className: "hidden md:table-cell", width: "md:w-[18%] lg:w-[18%]" } satisfies Meta,
      },
    ],
    [],
  );

  const table = useReactTable({ data: filtered, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  const visible = table.getRowModel().rows;
  const isFiltered = q.trim() !== "" || JSON.stringify(filters) !== JSON.stringify(NONE);
  const clear = () => {
    setQ("");
    setFilters(NONE);
  };

  return (
    <>
      {/* 2. Hero */}
      <section className="grid grid-cols-1 gap-8 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div>
          <h1 className="display max-w-3xl">The original marketplace for personal robots.</h1>
          <p className="mt-4 max-w-xl text-[16px] text-ink-2 sm:text-[17px]">
            Manufacturer list prices collected every day and FCC authorization records for {rows.length} humanoids, robot dogs, and desktop
            robots. No listings, no affiliate links.
          </p>
          <div className="mt-6">
            <label htmlFor="robot-q" className="sr-only">
              Search robots by name or maker
            </label>
            <input
              id="robot-q"
              type="search"
              placeholder="Search a robot or maker — Unitree, Reachy, Bittle…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-12 w-full max-w-xl rounded-ctl border border-line bg-card px-4 text-[15px] text-ink shadow-card placeholder:text-ink-3"
            />
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Quick filters">
              {CHIPS.map((c) => {
                const on = c.on(filters);
                return (
                  <button
                    key={c.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilters(c.toggle(filters))}
                    className={`inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150 ${
                      on ? "border-accent/40 bg-accent-soft text-accent-ink" : "border-line bg-card text-ink-2 hover:bg-sunk hover:text-ink"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {aside}
      </section>

      {/* 3. Three cards */}
      <div className="mt-8 sm:mt-10">{cards}</div>

      {/* 4. Table */}
      <section id="robots" aria-labelledby="robots-heading" className="mt-10 sm:mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="robots-heading" className="text-[22px] font-bold sm:text-2xl">
              All robots
            </h2>
            <p className="mt-1 text-[13px] text-ink-2" role="status">
              {visible.length} of {rows.length}
              {isFiltered && (
                <>
                  {" · "}
                  <button type="button" onClick={clear} className="text-accent-ink underline-offset-4 hover:underline">
                    Clear filters
                  </button>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Select items={CATEGORY_ITEMS} value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v ?? "all" })}>
              <SelectTrigger className="h-10 w-40 rounded-ctl bg-card" aria-label="Filter by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ITEMS.map((it) => (
                  <SelectItem key={it.value} value={it.value}>
                    {it.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select items={STATUS_ITEMS} value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v ?? "all" })}>
              <SelectTrigger className="h-10 w-36 rounded-ctl bg-card" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ITEMS.map((it) => (
                  <SelectItem key={it.value} value={it.value}>
                    {it.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="card mt-4 overflow-hidden">
          <Table className="table-fixed">
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="border-b border-line hover:bg-transparent">
                  {hg.headers.map((h) => {
                    const meta = h.column.columnDef.meta as Meta;
                    const sorted = h.column.getIsSorted();
                    const label = String(h.column.columnDef.header);
                    return (
                      <TableHead key={h.id} aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"} className={`h-11 p-0 ${meta.width} ${meta.className ?? ""}`}>
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={`micro flex h-11 w-full items-center gap-1 px-4 hover:text-ink ${meta.align === "right" ? "flex-row-reverse" : ""}`}
                        >
                          <span>{flexRender(h.column.columnDef.header, h.getContext())}</span>
                          {sorted === "asc" ? <ArrowUp className="size-3" aria-hidden /> : sorted === "desc" ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUpDown className="size-3 opacity-50" aria-hidden />}
                          <span className="sr-only">{sorted === "asc" ? ", sorted ascending" : sorted === "desc" ? ", sorted descending" : `, sort by ${label}`}</span>
                        </button>
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="py-12 text-center whitespace-normal">
                    <p className="text-ink-2">No robots match.</p>
                    <button type="button" onClick={clear} className="mt-3 inline-flex h-9 items-center rounded-ctl border border-line px-3 text-sm hover:bg-sunk">
                      Clear search and filters
                    </button>
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((row) => (
                  <TableRow key={row.id} onClick={() => setOpenId(row.original.id)} className="cursor-pointer border-b border-line-soft transition-colors duration-150 last:border-0 hover:bg-sunk">
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as Meta;
                      return (
                        <TableCell key={cell.id} className={`px-4 py-3 align-top whitespace-normal ${meta.className ?? ""} ${meta.align === "right" ? "text-right" : ""}`}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-[12px] text-ink-3">
          USD list prices from official stores. 24h compares the cheapest variant with the previous daily snapshot. FCC shows the grant date;
          grants after {COVERED_LIST_LABEL} fall under the Covered List for foreign-made robots.
        </p>
      </section>

      <RobotDrawer detail={openId ? details[openId] : null} open={openId != null} onOpenChange={(o) => !o && setOpenId(null)} />
    </>
  );
}

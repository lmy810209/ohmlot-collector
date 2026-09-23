"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "./Badge";
import { Sparkline } from "./Sparkline";
import { RobotDrawer } from "./RobotDrawer";
import type { Category, RobotDetail, RobotRow } from "@/lib/data";
import { CATEGORY_SINGULAR, COVERED_LIST_LABEL, fmtMonth, pct, purchaseRange, rangeText, STATUS_LABEL, subscriptionLabel } from "@/lib/format";

const CATEGORY_ITEMS = [
  { value: "all", label: "All types" },
  { value: "humanoid", label: "Humanoids" },
  { value: "quadruped", label: "Quadrupeds" },
  { value: "desktop", label: "Desktop" },
  { value: "arm", label: "Arms" },
];
const STATUS_ITEMS = [
  { value: "all", label: "Any status" },
  { value: "shipping", label: "Shipping" },
  { value: "preorder", label: "Pre-order" },
];

/** Column widths keep the table on one screen at every breakpoint; hidden columns drop out of the sum. */
type Meta = { className?: string; align?: "right"; width: string };

function StatusPill({ status }: { status: string }) {
  return <Badge tone={status === "shipping" ? "good" : "warn"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function RobotTable({ rows, details }: { rows: RobotRow[]; details: Record<string, RobotDetail> }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "price", desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

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
              <span className="block font-medium leading-snug">{r.name}</span>
              <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                {r.manufacturer}
                {r.hq_country ? ` · ${r.hq_country}` : ""}
              </span>
              <span className="mt-1.5 block sm:hidden">
                <StatusPill status={r.status} />
              </span>
            </button>
          );
        },
        meta: { width: "w-[58%] sm:w-[44%] md:w-[38%] lg:w-[32%]" } satisfies Meta,
      },
      {
        id: "category",
        accessorKey: "category",
        header: "Type",
        cell: ({ getValue }) => <span className="text-muted-foreground">{CATEGORY_SINGULAR[getValue() as Category]}</span>,
        filterFn: "equals",
        meta: { className: "hidden lg:table-cell", width: "lg:w-[12%]" } satisfies Meta,
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
            <div className="lg:grid lg:grid-cols-[72px_minmax(0,1fr)] lg:items-center lg:gap-3">
              <span className="hidden lg:block">{tracked && r.spark.length > 0 ? <Sparkline values={r.spark} /> : null}</span>
              <div className="text-right">
                <div className="font-medium whitespace-nowrap">{tracked ? rangeText(r.latest_min as number, r.latest_max as number) : purchaseRange(r)}</div>
                {sub && <div className="text-xs whitespace-nowrap text-muted-foreground">{sub}</div>}
                <div className="text-xs whitespace-nowrap text-muted-foreground">
                  {tracked ? (r.change_pct != null && r.change_pct !== 0 ? `${pct(r.change_pct)} vs previous day` : "Tracked daily") : "Published list price"}
                </div>
              </div>
            </div>
          );
        },
        meta: { align: "right", width: "w-[42%] sm:w-[36%] md:w-[26%] lg:w-[26%]" } satisfies Meta,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusPill status={getValue() as string} />,
        filterFn: "equals",
        meta: { className: "hidden sm:table-cell", width: "sm:w-[20%] md:w-[14%] lg:w-[12%]" } satisfies Meta,
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
            <Badge tone="good">Granted {fmtMonth(r.fcc_grant_date)}</Badge>
          ) : r.fcc_status === "after" ? (
            <Badge tone="warn">After Covered List</Badge>
          ) : r.fcc_status === "unknown" || r.fcc_status === "before" ? (
            <Badge>Date unknown</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">No ID on file</span>
          );
        },
        meta: { className: "hidden md:table-cell", width: "md:w-[22%] lg:w-[18%]" } satisfies Meta,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _col, value: string) => {
      const q = value.trim().toLowerCase();
      if (!q) return true;
      const r = row.original;
      return `${r.name} ${r.manufacturer} ${r.hq_country ?? ""}`.toLowerCase().includes(q);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const category = (table.getColumn("category")?.getFilterValue() as string | undefined) ?? "all";
  const status = (table.getColumn("status")?.getFilterValue() as string | undefined) ?? "all";
  const visible = table.getRowModel().rows;
  const filtered = visible.length !== rows.length || globalFilter.trim() !== "";

  function clearFilters() {
    setGlobalFilter("");
    table.resetColumnFilters();
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="robot-q" className="sr-only">
          Search robots by name or maker
        </label>
        <Input
          id="robot-q"
          type="search"
          placeholder="Search name or maker"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="h-10 sm:max-w-xs"
        />
        <div className="flex shrink-0 gap-2">
          <Select items={CATEGORY_ITEMS} value={category} onValueChange={(v) => table.getColumn("category")?.setFilterValue(v === "all" ? undefined : v)}>
            <SelectTrigger className="h-10 flex-1 sm:w-40" aria-label="Filter by type">
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
          <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => table.getColumn("status")?.setFilterValue(v === "all" ? undefined : v)}>
            <SelectTrigger className="h-10 flex-1 sm:w-36" aria-label="Filter by status">
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
      <p className="mt-3 flex items-center gap-3 text-xs text-muted-foreground" role="status">
        <span>
          {visible.length} of {rows.length} robots
        </span>
        {filtered && (
          <button type="button" onClick={clearFilters} className="text-brand underline-offset-4 hover:underline">
            Clear filters
          </button>
        )}
      </p>

      <div className="mt-2 border-y border-border">
        <Table className="table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta as Meta;
                  const sorted = h.column.getIsSorted();
                  const label = String(h.column.columnDef.header);
                  return (
                    <TableHead
                      key={h.id}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                      className={`h-10 p-0 ${meta.width} ${meta.className ?? ""}`}
                    >
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className={`flex h-10 w-full items-center gap-1 rounded-sm px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground ${meta.align === "right" ? "flex-row-reverse" : ""}`}
                      >
                        <span>{flexRender(h.column.columnDef.header, h.getContext())}</span>
                        {sorted === "asc" ? <ArrowUp className="size-3" aria-hidden /> : sorted === "desc" ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUpDown className="size-3 opacity-50" aria-hidden />}
                        <span className="sr-only">{sorted === "asc" ? `, sorted ascending` : sorted === "desc" ? `, sorted descending` : `, sort by ${label}`}</span>
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
                  <p className="text-muted-foreground">No robots match.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                    Clear search and filters
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => (
                <TableRow key={row.id} onClick={() => setOpenId(row.original.id)} className="cursor-pointer">
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as Meta;
                    return (
                      <TableCell key={cell.id} className={`px-3 py-3 align-top whitespace-normal ${meta.className ?? ""} ${meta.align === "right" ? "text-right" : ""}`}>
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
      <p className="mt-2 text-xs text-muted-foreground">
        List prices are USD from official stores. FCC shows the equipment-authorization grant date; grants after {COVERED_LIST_LABEL} fall under the
        FCC Covered List for foreign-made robots.
      </p>

      <RobotDrawer detail={openId ? details[openId] : null} open={openId != null} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}

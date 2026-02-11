import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import type { ClaimWithVerification } from "~/lib/types";
import { VERDICT_COLORS, VERDICT_LABELS } from "~/lib/types";

const columnHelper = createColumnHelper<ClaimWithVerification>();

function formatValue(value: number, unit: string): string {
  switch (unit) {
    case "USD_millions":
      return value >= 1000
        ? `$${(value / 1000).toFixed(1)}B`
        : `$${value.toFixed(0)}M`;
    case "USD_billions":
      return `$${value.toFixed(1)}B`;
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "USD_per_share":
      return `$${value.toFixed(2)}/share`;
    case "basis_points":
      return `${value.toFixed(0)}bps`;
    default:
      return String(value);
  }
}

const columns = [
  columnHelper.accessor(
    (row) => row.verification?.status ?? "unverifiable",
    {
      id: "verdict",
      header: "Verdict",
      cell: (info) => {
        const status = info.getValue();
        const color = VERDICT_COLORS[status as keyof typeof VERDICT_COLORS];
        const label = VERDICT_LABELS[status as keyof typeof VERDICT_LABELS];
        return (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
            style={{
              backgroundColor: `${color}15`,
              color,
              border: `1px solid ${color}30`,
            }}
          >
            {label}
          </span>
        );
      },
      filterFn: "equals",
    }
  ),
  columnHelper.accessor("speaker_name", {
    header: "Speaker",
    cell: (info) => (
      <span className="text-zinc-300 text-xs">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("metric_name", {
    header: "Metric",
    cell: (info) => (
      <span className="text-zinc-300 text-xs font-medium">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("claimed_value", {
    header: "Claimed",
    cell: (info) => (
      <span className="text-zinc-300 text-xs tabular-nums">
        {formatValue(info.getValue(), info.row.original.claimed_unit)}
      </span>
    ),
  }),
  columnHelper.accessor((row) => row.verification?.actual_value ?? null, {
    id: "actual",
    header: "Actual",
    cell: (info) => {
      const val = info.getValue();
      if (val === null) return <span className="text-zinc-600 text-xs">--</span>;
      return (
        <span className="text-zinc-300 text-xs tabular-nums">
          {val.toFixed(2)}
        </span>
      );
    },
  }),
  columnHelper.accessor(
    (row) => row.verification?.deviation_percentage ?? null,
    {
      id: "deviation",
      header: "Deviation",
      cell: (info) => {
        const val = info.getValue();
        if (val === null)
          return <span className="text-zinc-600 text-xs">--</span>;
        const absVal = Math.abs(val);
        const color =
          absVal > 10
            ? "#ef4444"
            : absVal > 5
              ? "#f59e0b"
              : "#22c55e";
        return (
          <span className="text-xs font-medium tabular-nums" style={{ color }}>
            {val > 0 ? "+" : ""}
            {val.toFixed(1)}%
          </span>
        );
      },
    }
  ),
  columnHelper.accessor("claim_type", {
    header: "Type",
    cell: (info) => (
      <span className="text-zinc-500 text-[10px] uppercase tracking-wider">
        {info.getValue().replace(/_/g, " ")}
      </span>
    ),
    filterFn: "equals",
  }),
  columnHelper.accessor("exact_quote", {
    header: "Quote",
    enableSorting: false,
    cell: (info) => <ExpandableQuote text={info.getValue()} />,
  }),
];

function ExpandableQuote({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = text.length > 80;

  return (
    <button
      type="button"
      onClick={() => truncated && setExpanded(!expanded)}
      className={`text-left text-xs text-zinc-400 italic ${truncated ? "cursor-pointer hover:text-zinc-300" : ""}`}
    >
      {expanded || !truncated ? `"${text}"` : `"${text.slice(0, 80)}..."`}
    </button>
  );
}

export function ClaimsTable({ claims }: { claims: ClaimWithVerification[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: claims,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const verdictColumn = table.getColumn("verdict");
  const currentFilter = (verdictColumn?.getFilterValue() as string) ?? "";

  return (
    <div className="space-y-3">
      {/* Filter controls */}
      <div className="flex items-center gap-3">
        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
          Filter:
        </label>
        <select
          className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500"
          value={currentFilter}
          onChange={(e) =>
            verdictColumn?.setFilterValue(e.target.value || undefined)
          }
        >
          <option value="">All statuses</option>
          <option value="verified">Verified</option>
          <option value="inaccurate">Inaccurate</option>
          <option value="misleading">Misleading</option>
          <option value="unverifiable">Unverifiable</option>
        </select>
        <span className="text-[10px] text-zinc-600">
          {table.getFilteredRowModel().rows.length} claims
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left">
          <thead className="bg-zinc-900/80">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={`flex items-center gap-1 ${header.column.getCanSort() ? "cursor-pointer select-none hover:text-zinc-300" : ""}`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getIsSorted() === "asc" && (
                          <span className="text-emerald-400">^</span>
                        )}
                        {header.column.getIsSorted() === "desc" && (
                          <span className="text-emerald-400">v</span>
                        )}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-zinc-800/30 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

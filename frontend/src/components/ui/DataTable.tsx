"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ColumnDef<T> = {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  className?: string;
  cellClassName?: string;
};

export function DataTable<T>({
  columns,
  data,
  sortable = false,
  onRowClick,
  className,
  emptyTitle = "No records found",
}: {
  columns: ColumnDef<T>[];
  data: T[];
  sortable?: boolean;
  onRowClick?: (row: T) => void;
  className?: string;
  emptyTitle?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortable || !sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;
    const get = col.sortValue ?? ((r: T) => (typeof col.accessor(r) === "string" ? (col.accessor(r) as string) : 0));
    const copy = [...data];
    copy.sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [data, columns, sortable, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (data.length === 0) {
    return (
      <div className="rounded-card border border-white/10 bg-secondary/40 py-12 text-center text-sm text-text-muted">
        {emptyTitle}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-card border border-white/10", className)}>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-secondary/80 backdrop-blur">
            <tr>
              {columns.map((c) => {
                const canSort = sortable && c.sortable;
                const active = sortKey === c.key;
                return (
                  <th
                    key={c.key}
                    className={cn(
                      "border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted",
                      c.className
                    )}
                  >
                    {canSort ? (
                      <button
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 hover:text-text-primary"
                      >
                        {c.header}
                        {active ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-b border-white/5 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-white/5"
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3 text-text-primary", c.cellClassName)}>
                    {c.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-white/5 md:hidden">
        {sorted.map((row, i) => (
          <div
            key={i}
            onClick={() => onRowClick?.(row)}
            className={cn("space-y-2 p-4", onRowClick && "cursor-pointer active:bg-white/5")}
          >
            {columns.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-4">
                <span className="text-xs uppercase tracking-wide text-text-muted">{c.header}</span>
                <span className="text-right text-sm text-text-primary">{c.accessor(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

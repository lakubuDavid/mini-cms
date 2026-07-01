"use client";

import { LoaderCircle, RefreshCw, Search, X } from "lucide-react";

import { cn } from "@workspace/ui/lib/utils";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type { SortState } from "./types";

export type DataToolbarProps = {
  query: string;
  onQueryChange: (next: string) => void;

  refresh?: {
    onRefresh: () => void;
    isRefreshing: boolean;
  };

  /** Optional sort controls (shown if `sortColumns` has at least one entry). */
  sortColumns?: { id: string; label: string }[];
  sort?: SortState;
  onSortChange?: (next: SortState) => void;

  /** Optional page-size control. */
  pageSize?: number;
  onPageSizeChange?: (next: number) => void;
  pageSizes?: readonly number[];

  /** Placeholder for the filter input. */
  filterPlaceholder?: string;

  className?: string;
};

const DEFAULT_PAGE_SIZES = [10, 25, 50] as const;

/**
 * A lighter-weight toolbar for non-table layouts (e.g. card grids).
 *
 * Renders the filter input, optional refresh button, optional sort
 * controls, and optional page-size `<Select>`. Use this when the layout
 * below isn't a `<table>` (otherwise, prefer `<DataTable>`).
 */
export function DataToolbar({
  query,
  onQueryChange,
  refresh,
  sortColumns,
  sort,
  onSortChange,
  pageSize,
  onPageSizeChange,
  pageSizes = DEFAULT_PAGE_SIZES,
  filterPlaceholder = "Filter…",
  className,
}: DataToolbarProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 pb-3", className)}>
      <div className="relative max-w-xs flex-1 min-w-48">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={filterPlaceholder}
          className="pl-8 pr-8"
          aria-label="Filter"
        />
        {query.length > 0 ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-stone-400 transition hover:text-stone-700"
            aria-label="Clear filter"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {sortColumns && sortColumns.length > 0 && onSortChange ? (
          <>
            <label className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className="hidden sm:inline">Sort by</span>
              <Select
                value={sort?.by ?? ""}
                onValueChange={(value) => {
                  if (!value) {
                    onSortChange(null);
                    return;
                  }
                  onSortChange({ by: value, order: sort?.by === value ? sort.order : "asc" });
                }}
              >
                <SelectTrigger size="sm" className="min-w-32" aria-label="Sort by">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Default</SelectItem>
                  {sortColumns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className="hidden sm:inline">Order</span>
              <Select
                value={sort?.order ?? "asc"}
                onValueChange={(value) => {
                  if (!sort) return;
                  onSortChange({ by: sort.by, order: value as "asc" | "desc" });
                }}
                disabled={!sort}
              >
                <SelectTrigger size="sm" className="w-24" aria-label="Sort order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </>
        ) : null}

        {pageSize !== undefined && onPageSizeChange ? (
          <label className="flex items-center gap-1.5 text-xs text-stone-500">
            <span className="hidden sm:inline">Per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(parseInt(value, 10))}
            >
              <SelectTrigger size="sm" className="w-20" aria-label="Items per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizes.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : null}

        {refresh ? (
          <button
            type="button"
            onClick={refresh.onRefresh}
            disabled={refresh.isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
            aria-label="Refresh"
            title="Refresh"
          >
            {refresh.isRefreshing ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Refresh</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

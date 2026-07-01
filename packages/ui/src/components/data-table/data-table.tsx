"use client"

import * as React from "react"
import { useMemo } from "react"

import { cn } from "@workspace/ui/lib/utils"
import { applyFilter } from "./apply-client-state"
import { applySort } from "./apply-client-state"
import { DataTablePagination } from "./data-table-pagination"
import { DataTableToolbar } from "./data-table-toolbar"
import { SortHeader } from "./sort-header"
import type { DataTableColumn, DataTableProps, SortState } from "./types"

/**
 * Renders a sortable, filterable, paginated table.
 *
 * Pagination is **server-side** (the parent supplies `pagination.page`,
 * `pagination.totalPages`, etc.) but the filter and sort are applied
 * **client-side** to the current page, as agreed in the design plan.
 *
 * The component is router-agnostic; pair it with
 * `useDataTableRouterState()` (or any state source) to keep page size,
 * filter, and sort in the URL.
 */
export function DataTable<Row>({
  data,
  columns,
  rowKey,
  searchFields,
  defaultSort = null,
  sort: controlledSort,
  onSortChange,
  defaultQuery = "",
  onQueryChange,
  pagination,
  refresh,
  emptyState,
  className,
  caption,
}: DataTableProps<Row>) {
  const [internalQuery, setInternalQuery] = React.useState(defaultQuery)
  const [internalSort, setInternalSort] = React.useState<SortState>(defaultSort)

  const isSortControlled = controlledSort !== undefined
  const sort = isSortControlled ? controlledSort : internalSort
  const query = internalQuery

  const setQuery = (next: string) => {
    setInternalQuery(next)
    onQueryChange?.(next)
  }
  const setSort = (next: SortState) => {
    if (!isSortControlled) setInternalSort(next)
    onSortChange?.(next)
  }

  // When the URL-driven defaults change (page, pageSize, sort), reset our
  // local query to empty so the user sees the URL's view first. Sorting
  // is fully driven by props in the typical use case, so we don't reset
  // sort here — the parent passes the active sort via `defaultSort` and
  // mirrors it back through `setSort` if needed.
  React.useEffect(() => {
    setInternalQuery("")
  }, [pagination.page, pagination.pageSize])

  // Filter, then sort, applied to the current server page.
  const filtered = useMemo(
    () => applyFilter(data, query, columns, searchFields as never),
    [data, query, columns, searchFields],
  )
  const visible = useMemo(() => applySort(filtered, sort, columns), [filtered, sort, columns])

  // Show a small hint when the client-side filter hides rows from the
  // current server page.
  const filteredCount = visible.length
  const pageSize = filtered.length
  const isFilteredDown = query.trim().length > 0 && filteredCount < pageSize

  return (
    <div className={cn("flex flex-col", className)}>
      <DataTableToolbar
        query={query}
        onQueryChange={setQuery}
        refresh={refresh}
        columns={columns as unknown as DataTableColumn<unknown>[]}
        sort={sort}
        onSortChange={setSort}
      />

      {isFilteredDown ? (
        <p className="pb-2 text-xs text-stone-500">
          Showing {filteredCount} of {pageSize} rows on this page that match the filter.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-stone-200">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-stone-50">
            <tr>
              {columns.map((col) => {
                const sortable = col.sortable !== false
                const hiddenClass = col.hiddenOn
                  ? col.hiddenOn
                      .map((bp) =>
                        bp === "sm" ? "hidden sm:table-cell" : bp === "md" ? "hidden md:table-cell" : "hidden lg:table-cell",
                      )
                      .join(" ")
                  : ""
                return (
                  <th
                    key={col.id}
                    scope="col"
                    className={cn("px-4 py-3 text-left font-medium text-stone-600", hiddenClass, col.className)}
                  >
                    {sortable ? (
                      <SortHeader
                        label={typeof col.header === "function" ? col.header() : col.header}
                        columnId={col.id}
                        sort={sort}
                        onToggle={(id) => {
                          const current = sort
                          if (!current || current.by !== id) {
                            setSort({ by: id, order: "asc" })
                          } else if (current.order === "asc") {
                            setSort({ by: id, order: "desc" })
                          } else {
                            setSort(null)
                          }
                        }}
                      />
                    ) : typeof col.header === "function" ? (
                      col.header()
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-stone-500"
                >
                  {emptyState ?? "No results."}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-stone-50">
                  {columns.map((col) => {
                    const hiddenClass = col.hiddenOn
                      ? col.hiddenOn
                          .map((bp) =>
                            bp === "sm"
                              ? "hidden sm:table-cell"
                              : bp === "md"
                              ? "hidden md:table-cell"
                              : "hidden lg:table-cell",
                          )
                          .join(" ")
                      : ""
                    return (
                      <td
                        key={col.id}
                        className={cn("px-4 py-3 align-middle", hiddenClass, col.className)}
                      >
                        {col.cell ? col.cell(row) : formatCell(col.accessor(row))}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DataTablePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        pageSize={pagination.pageSize}
        onPageChange={pagination.onPageChange}
        onPageSizeChange={pagination.onPageSizeChange}
      />
    </div>
  )
}

function formatCell(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "✓" : "—"
  return String(value)
}

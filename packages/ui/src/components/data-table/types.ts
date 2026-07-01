import type { ReactNode } from "react"

/**
 * Sort direction. `null` means "no sort active on this column".
 */
export type SortOrder = "asc" | "desc"

/**
 * Sort state passed to / returned from the table.
 * `by` is a column id (one of the sortable column ids declared on the table).
 */
export type SortState = {
  by: string
  order: SortOrder
} | null

/**
 * URL search-param shape managed by `useUrlTableState`.
 * All fields are optional; missing fields fall back to the table's defaults.
 */
export type UrlTableSearch = {
  page?: number
  pageSize?: number
  q?: string
  sort?: string
  order?: SortOrder
}

/**
 * A single column declaration. `accessor` extracts the value used for
 * filtering, sorting, and (by default) rendering. Pass a custom
 * `cell` to render JSX instead.
 */
export type DataTableColumn<Row> = {
  id: string
  header: ReactNode | (() => ReactNode)
  accessor: (row: Row) => string | number | boolean | null | undefined
  /** Allow this column's header to be click-sorted. Defaults to true. */
  sortable?: boolean
  /** Optional explicit cell renderer. Falls back to `String(accessor(row))`. */
  cell?: (row: Row) => ReactNode
  /** Tailwind classes for the `<th>` and `<td>` cells. */
  className?: string
  /** Hide this column at certain breakpoints. Defaults to always visible. */
  hiddenOn?: ("sm" | "md" | "lg")[]
}

/**
 * Props for `<DataTable>`.
 */
export type DataTableProps<Row> = {
  /** Already-paginated rows for the current server page. */
  data: Row[]
  columns: DataTableColumn<Row>[]

  /** Unique key for a row, used as the React `key` and for stable sorting. */
  rowKey: (row: Row) => string

  /**
   * Fields used by the client-side filter input. If omitted, falls back to
   * `columns[i].accessor` for every column. Strings are searched with
   * case-insensitive substring; numbers/booleans are stringified.
   */
  searchFields?: (keyof Row | ((row: Row) => string | number | boolean | null | undefined))[]

  /**
   * Default sort used when the URL doesn't specify one. The header click
   * cycle is `null → asc → desc → null` so users can clear sort too.
   * Ignored if `sort` is provided.
   */
  defaultSort?: SortState

  /**
   * Controlled sort state. When provided, the table uses this value and
   * calls `onSortChange` on header / dropdown changes. When omitted, the
   * table manages its own internal state seeded from `defaultSort`.
   */
  sort?: SortState
  onSortChange?: (next: SortState) => void

  /**
   * Initial filter query. Used as the seed for the toolbar's debounced
   * local state. The DataTable owns the filter value internally; pass
   * `onQueryChange` to write changes back to the URL.
   */
  defaultQuery?: string
  onQueryChange?: (next: string) => void

  /** Pagination state, sourced from the server. */
  pagination: {
    page: number
    totalPages: number
    total: number
    pageSize: number
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: number) => void
  }

  /** Refresh button hook. `onRefresh` should kick off a refetch. */
  refresh?: {
    onRefresh: () => void
    isRefreshing: boolean
  }

  /** Custom empty state shown when `data.length === 0`. */
  emptyState?: ReactNode

  /** Optional className for the outer wrapper. */
  className?: string

  /** Optional caption / label for the table (a11y). */
  caption?: string
}

/**
 * Default page-size options offered in the toolbar's `<Select>`.
 */
export const DEFAULT_PAGE_SIZES = [10, 25, 50] as const

/**
 * Default debounce for the filter input (ms).
 */
export const FILTER_DEBOUNCE_MS = 200

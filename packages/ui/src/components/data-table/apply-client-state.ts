import type { DataTableColumn, SortState } from "./types"

// Matches `<field>:<value>`, `<field>:<value*>`, `<field>:*<value>` patterns.
const FIELD_FILTER_RE = /^([a-zA-Z_][a-zA-Z0-9_.]*):(\*?)(.*?)(\*?)$/

/**
 * Apply a case-insensitive substring filter to a list of rows.
 * Supports the shorthand syntax `<field>:<value>`:
 *   - `name:hello`    — field "name" **includes** "hello"
 *   - `name:hello*`   — field "name" **starts with** "hello"
 *   - `name:*hello`   — field "name" **ends with** "hello"
 *   - `status:active` — field "status" **includes** "active"
 *   - Plain `hello`   — **full-text search** across all `searchFields`
 *
 * `accessors` defaults to `columns[i].accessor` if not supplied.
 */
export function applyFilter<Row>(
  rows: Row[],
  query: string,
  columns: DataTableColumn<Row>[],
  searchFields?: (keyof Row | ((row: Row) => string | number | boolean | null | undefined))[],
): Row[] {
  const trimmed = query.trim()
  if (trimmed.length === 0) return rows

  // Build the accessor list (same as before)
  const accessors: { id?: string; fn: (row: Row) => unknown }[] =
    searchFields && searchFields.length > 0
      ? searchFields.map((f) => {
          if (typeof f === "function") return { fn: f as (row: Row) => unknown }
          return { id: String(f), fn: (row: Row) => row[f] as unknown }
        })
      : columns.map((c) => ({ id: c.id, fn: (row: Row) => c.accessor(row) }))

  // Try to parse a field-specific filter
  const match = trimmed.match(FIELD_FILTER_RE)
  if (match) {
    const [, fieldName, prefixStar, value, suffixStar] = match
    const searchTerm = value.toLowerCase()

    // Find an accessor whose id matches the requested field name.
    // Also scan columns for a matching column id.
    const target = accessors.find((a) => a.id === fieldName) ??
      (columns.find((c) => c.id === fieldName)
        ? { id: fieldName, fn: (row: Row) => columns.find((c) => c.id === fieldName)!.accessor(row) }
        : null)

    if (target) {
      return rows.filter((row) => {
        const raw = target.fn(row)
        if (raw === null || raw === undefined) return false
        const str = String(raw).toLowerCase()

        if (prefixStar && suffixStar) {
          // `:*value*` — treat as includes (the `*` on both sides is redundant)
          return str.includes(searchTerm)
        }
        if (prefixStar === "*") {
          // `:*value` — ends with
          return str.endsWith(searchTerm)
        }
        if (suffixStar === "*") {
          // `:value*` — starts with
          return str.startsWith(searchTerm)
        }
        // `:value` — includes
        return str.includes(searchTerm)
      })
    }
    // If the field name doesn't match any known column, fall through to
    // full-text search with the entire trimmed query string.
  }

  // Full-text search on the raw trimmed query (case-insensitive includes)
  const lowerQuery = trimmed.toLowerCase()
  return rows.filter((row) =>
    accessors.some((a) => {
      const value = a.fn(row)
      if (value === null || value === undefined) return false
      return String(value).toLowerCase().includes(lowerQuery)
    }),
  )
}

/**
 * Apply sort to a list of rows. `null` sort returns the input unchanged.
 * Stable for equal keys (preserves input order via index tiebreak).
 */
export function applySort<Row>(
  rows: Row[],
  sort: SortState,
  columns: DataTableColumn<Row>[],
): Row[] {
  if (!sort) return rows
  const col = columns.find((c) => c.id === sort.by)
  if (!col) return rows

  const dir = sort.order === "asc" ? 1 : -1
  const indexed = rows.map((row, i) => ({ row, i }))
  indexed.sort((a, b) => {
    const av = col.accessor(a.row)
    const bv = col.accessor(b.row)
    const cmp = compareValues(av, bv)
    if (cmp !== 0) return cmp * dir
    return a.i - b.i // stable tiebreak
  })
  return indexed.map((x) => x.row)
}

function compareValues(a: unknown, b: unknown): number {
  // Nullish always sorts to the end regardless of direction.
  if (a === null || a === undefined) {
    if (b === null || b === undefined) return 0
    return 1
  }
  if (b === null || b === undefined) return -1

  if (typeof a === "number" && typeof b === "number") {
    return a - b
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b)
  }

  const aStr = String(a)
  const bStr = String(b)
  // Numeric-aware compare: if both look like numbers, compare numerically.
  const aNum = Number(aStr)
  const bNum = Number(bStr)
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aStr.trim() !== "" && bStr.trim() !== "") {
    return aNum - bNum
  }
  return aStr.localeCompare(bStr, undefined, { sensitivity: "base" })
}

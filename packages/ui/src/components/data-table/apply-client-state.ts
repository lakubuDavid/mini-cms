import type { DataTableColumn, SortState } from "./types"

/**
 * Apply a case-insensitive substring filter to a list of rows.
 * `accessors` defaults to `columns[i].accessor` if not supplied.
 */
export function applyFilter<Row>(
  rows: Row[],
  query: string,
  columns: DataTableColumn<Row>[],
  searchFields?: (keyof Row | ((row: Row) => string | number | boolean | null | undefined))[],
): Row[] {
  const trimmed = query.trim().toLowerCase()
  if (trimmed.length === 0) return rows

  const accessors: ((row: Row) => unknown)[] =
    searchFields && searchFields.length > 0
      ? searchFields.map((f) => {
          if (typeof f === "function") return f as (row: Row) => unknown
          return (row: Row) => row[f] as unknown
        })
      : columns.map((c) => (row: Row) => c.accessor(row))

  return rows.filter((row) =>
    accessors.some((a) => {
      const value = a(row)
      if (value === null || value === undefined) return false
      return String(value).toLowerCase().includes(trimmed)
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

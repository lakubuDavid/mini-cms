"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { FILTER_DEBOUNCE_MS, type SortOrder, type SortState, type UrlTableSearch } from "./types"

const PREFIX_KEYS = ["page", "pageSize", "q", "sort", "order"] as const

function prefixed(prefix: string, key: string): string {
  if (!prefix) return key
  return `${prefix}${key[0].toUpperCase()}${key.slice(1)}`
}

/**
 * Normalize a raw `Record<string, unknown>` (as produced by TanStack Router's
 * `useSearch()` / `validateSearch`) into a typed `UrlTableSearch`.
 *
 * Returns `undefined` for invalid values so the caller can fall back to
 * defaults. When `prefix` is set, reads keys like `${prefix}Page`.
 */
export function parseUrlTableSearch(input: unknown, prefix = ""): UrlTableSearch {
  const raw = (input ?? {}) as Record<string, unknown>
  const out: UrlTableSearch = {}

  const pageRaw = raw[prefixed(prefix, "page")]
  if (typeof pageRaw === "number" && Number.isFinite(pageRaw)) {
    out.page = Math.max(1, Math.floor(pageRaw))
  } else if (typeof pageRaw === "string" && /^\d+$/.test(pageRaw)) {
    out.page = Math.max(1, parseInt(pageRaw, 10))
  }

  const pageSizeRaw = raw[prefixed(prefix, "pageSize")]
  if (typeof pageSizeRaw === "number" && Number.isFinite(pageSizeRaw)) {
    out.pageSize = Math.floor(pageSizeRaw)
  } else if (typeof pageSizeRaw === "string" && /^\d+$/.test(pageSizeRaw)) {
    out.pageSize = parseInt(pageSizeRaw, 10)
  }

  const qRaw = raw[prefixed(prefix, "q")]
  if (typeof qRaw === "string") {
    out.q = qRaw
  }

  const sortRaw = raw[prefixed(prefix, "sort")]
  if (typeof sortRaw === "string" && sortRaw.length > 0) {
    out.sort = sortRaw
  }

  const orderRaw = raw[prefixed(prefix, "order")]
  if (orderRaw === "asc" || orderRaw === "desc") {
    out.order = orderRaw
  }

  return out
}

/**
 * Build the next `search` object for a given change, preserving any extra
 * keys the caller passes (e.g. `projectId`, `type`). When `prefix` is set,
 * writes keys like `${prefix}Page`.
 */
export function buildUrlTableSearch(
  current: Record<string, unknown>,
  patch: Partial<UrlTableSearch>,
  prefix = "",
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current }

  if (patch.page !== undefined) next[prefixed(prefix, "page")] = patch.page
  if (patch.pageSize !== undefined) next[prefixed(prefix, "pageSize")] = patch.pageSize
  if (patch.q !== undefined) {
    if (patch.q.length > 0) next[prefixed(prefix, "q")] = patch.q
    else delete next[prefixed(prefix, "q")]
  }
  if (patch.sort !== undefined) {
    if (patch.sort.length > 0) next[prefixed(prefix, "sort")] = patch.sort
    else delete next[prefixed(prefix, "sort")]
  }
  if (patch.order !== undefined) {
    next[prefixed(prefix, "order")] = patch.order
  }

  return next
}

/**
 * Resolve the effective `page`, `pageSize`, `q`, and `sort` from the URL
 * search params and the table's defaults.
 */
export function resolveTableState(
  parsed: UrlTableSearch,
  defaults: {
    page?: number
    pageSize: number
    defaultSort: SortState
  },
): {
  page: number
  pageSize: number
  q: string
  sort: SortState
} {
  const page = parsed.page ?? defaults.page ?? 1
  const pageSize = parsed.pageSize ?? defaults.pageSize
  const q = parsed.q ?? ""

  let sort: SortState = defaults.defaultSort
  if (parsed.sort && parsed.order) {
    sort = { by: parsed.sort, order: parsed.order }
  } else if (parsed.sort && !parsed.order) {
    sort = { by: parsed.sort, order: "asc" }
  } else if (!parsed.sort && parsed.order && defaults.defaultSort) {
    sort = { by: defaults.defaultSort.by, order: parsed.order }
  }

  return { page, pageSize, q, sort }
}

/**
 * React adapter around `parseUrlTableSearch` / `buildUrlTableSearch`.
 *
 * Returns the current effective table state (with `q` debounced) plus
 * setters that write back to the URL. The hook is router-agnostic; the
 * caller passes `search`, `navigate`, and a `defaults` object.
 */
export function useUrlTableState(args: {
  search: Record<string, unknown>
  navigate: (next: Record<string, unknown>) => void
  defaults: {
    page?: number
    pageSize: number
    defaultSort: SortState
  }
  /**
   * When set, URL keys are prefixed (e.g. "membersPage"). Use this when
   * multiple tables share the same route.
   */
  prefix?: string
}) {
  const { search, navigate, defaults, prefix = "" } = args
  const parsed = parseUrlTableSearch(search, prefix)
  const resolved = resolveTableState(parsed, defaults)

  // The filter input is local-immediate for responsive typing, but the
  // value pushed into the URL and used for filtering is debounced.
  const [qInput, setQInput] = useState(resolved.q)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep `qInput` in sync if the URL changes externally (back/forward nav).
  useEffect(() => {
    setQInput(resolved.q)
  }, [resolved.q, prefix])

  // If the user changes the page size or sort/page in the URL directly, our
  // local state should follow. We re-derive on every render; it's cheap.
  const setQ = useCallback(
    (next: string) => {
      setQInput(next)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const patch: Partial<UrlTableSearch> = { q: next }
        // Reset to page 1 whenever the filter changes.
        patch.page = 1
        navigate(buildUrlTableSearch(search, patch, prefix))
      }, FILTER_DEBOUNCE_MS)
    },
    [navigate, search, prefix],
  )

  // Cleanup pending timer on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const setPage = useCallback(
    (page: number) => {
      navigate(buildUrlTableSearch(search, { page: Math.max(1, page) }, prefix))
    },
    [navigate, search, prefix],
  )

  const setPageSize = useCallback(
    (pageSize: number) => {
      navigate(
        buildUrlTableSearch(
          search,
          {
            pageSize,
            // Reset to page 1 whenever the page size changes.
            page: 1,
          },
          prefix,
        ),
      )
    },
    [navigate, search, prefix],
  )

  const setSort = useCallback(
    (sort: SortState) => {
      if (!sort) {
        navigate(
          buildUrlTableSearch(
            search,
            { sort: "", order: undefined },
            prefix,
          ),
        )
        return
      }
      navigate(
        buildUrlTableSearch(
          search,
          {
            sort: sort.by,
            order: sort.order,
          },
          prefix,
        ),
      )
    },
    [navigate, search, prefix],
  )

  const toggleSort = useCallback(
    (columnId: string) => {
      const current = resolved.sort
      if (!current || current.by !== columnId) {
        setSort({ by: columnId, order: "asc" })
      } else if (current.order === "asc") {
        setSort({ by: columnId, order: "desc" })
      } else {
        // Already desc — clear.
        setSort(null)
      }
    },
    [resolved.sort, setSort],
  )

  return {
    page: resolved.page,
    pageSize: resolved.pageSize,
    q: resolved.q,
    qInput,
    sort: resolved.sort,
    setQ,
    setPage,
    setPageSize,
    setSort,
    toggleSort,
  } as const
}

export type UseUrlTableStateReturn = ReturnType<typeof useUrlTableState>

/**
 * Re-exported for tests and external use.
 */
export type { SortOrder, SortState, UrlTableSearch }
export { PREFIX_KEYS, prefixed }

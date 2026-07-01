"use client";

import { useNavigate, useSearch } from "@tanstack/react-router";

import { useUrlTableState } from "@workspace/ui/components/data-table";
import type { SortState } from "@workspace/ui/components/data-table";

/**
 * TanStack Router adapter around `useUrlTableState`.
 *
 * Reads the current search params via `useSearch()` and writes back via
 * `navigate({ search: ... })`. Use this from inside a route component so
 * the table state lives in the URL.
 *
 * Pass `prefix` to namespace the URL keys (e.g. `"members"` for two
 * tables on the same route).
 */
export function useDataTableRouterState(args: {
  defaults: {
    page: number;
    pageSize: number;
    defaultSort: SortState;
  };
  prefix?: string;
}) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as unknown as Record<string, unknown>;

  const setSearch = (next: Record<string, unknown>) => {
    void navigate({ search: next as never });
  };

  return useUrlTableState({
    search,
    navigate: setSearch,
    defaults: args.defaults,
    prefix: args.prefix,
  });
}

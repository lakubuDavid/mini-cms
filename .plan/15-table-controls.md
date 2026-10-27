# Phase 15: Table controls (page size, refresh, filter, sort)

## Goal

Add a consistent set of controls to every grid/table in the dashboard so
admins don't have to reload the page to see new items and can quickly narrow
down what they're looking for.

Every table/grid in the dashboard should expose:

1. **Page-size dropdown** with options `10 / 25 / 50`, plus an inline info
   icon with a tooltip explaining that larger pages take longer to load.
2. **Refresh button** that re-fetches the current view without reloading the
   page (spinner while the fetch is in flight).
3. **Filter input** at the top of the table that filters rows on the current
   page (case-insensitive substring across configured fields, debounced).
4. **Sort controls** — both clickable column headers and a visible
   `Sort by: [column]` + `Order: [asc | desc]` control.

## Decisions (confirmed)

| Topic            | Choice                                                       |
| ---------------- | ------------------------------------------------------------ |
| Architecture     | Reusable `<DataTable>` component in `packages/ui`            |
| Pagination       | Server-side (existing `limit/offset` on DB queries)          |
| Filter / sort    | Client-side, applied to the current server page              |
| State persistence| URL query params (`?page=…&pageSize=…&q=…&sort=…&order=…`)   |

## Worktree

- Path: `../mini-cms-table-features`
- Branch: `feature/table-controls` (off `main`)
- All work happens in the worktree; main repo stays on `feature/environment`.

## File-by-file changes

### A. New shared primitives in `packages/ui`

| File                                                    | Purpose                                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/ui/src/components/select.tsx`                | Radix `<Select>` primitive (no native select component exists yet). Used for page-size picker. |
| `packages/ui/src/components/data-table/index.tsx`      | Barrel export.                                                                                |
| `packages/ui/src/components/data-table/data-table.tsx` | The main `<DataTable>` component (see API below).                                             |
| `packages/ui/src/components/data-table/data-table-toolbar.tsx` | Filter input + refresh button + sort controls.                                       |
| `packages/ui/src/components/data-table/data-table-pagination.tsx` | Page-size `<Select>` with `(i)` tooltip + prev/next + "Page N of M".                |
| `packages/ui/src/components/data-table/data-table-sort-header.tsx` | Click-to-sort column header (small wrapper around `<th>`).                          |
| `packages/ui/src/components/data-table/use-url-table-state.ts` | Tiny hook that reads/writes the `page/pageSize/q/sort/order` URL params.           |
| `packages/ui/src/components/data-table/types.ts`       | Shared types (`DataTableColumn`, `DataTableProps`, `SortState`, …).                           |
| `packages/ui/src/index.ts`                             | Re-export the new components.                                                                 |

### B. Server / query layer

No new endpoints needed. The existing server functions already accept
`page` + `limit` (see `apps/web/src/db/queries/shared.ts`). The `DataTable`
just passes `pageSize` through as `limit`. Only touch these if a page is
fetching unbounded data today (see migration list below).

### C. Dashboard pages to migrate

| Route                                                  | Status today                                | Migration                                                       |
| ------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------- |
| `apps/web/src/routes/dashboard/team.tsx`               | Server-paginated, no UI controls            | Wrap members table in `<DataTable>`, add sort by name/email/role. |
| `apps/web/src/routes/dashboard/projects.tsx`           | Server-fetched, no pagination UI            | Wrap table, add sort by name/slug/createdAt.                    |
| `apps/web/src/routes/dashboard/workspace.tsx`          | Server-fetched                             | Wrap table.                                                     |
| `apps/web/src/routes/dashboard/api-keys.tsx`           | Server-fetched                             | Wrap table.                                                     |
| `apps/web/src/routes/dashboard/collections/$name/index.tsx` | Has Prev/Next, no page-size/filter   | Replace Prev/Next with `<DataTable>`, add filter + sort.         |
| `apps/web/src/routes/dashboard/assets.tsx`             | Card grid, client-side type filter          | Migrate the asset list to `<DataTable>` (or a `<DataGrid>` variant) so refresh/sort/page-size are consistent. |
| `apps/web/src/routes/dashboard/index.tsx`              | Card grid of collections                   | Add the same toolbar (refresh + filter at minimum). The 4-up card grid is non-tabular, so build a sibling `<DataToolbar>` that mounts the filter + refresh bits but renders the existing card grid. |

### D. Docs

- `apps/docs/content/docs/dashboard.mdx` (or whichever file documents the
  dashboard) — add a "Table controls" section showing the four affordances
  with a screenshot of the new toolbar.

## `<DataTable>` API (proposed)

```tsx
<DataTable<Row>
  data={rows}                              // already-paginated rows
  columns={[
    { id: "name", header: "Name", accessor: (r) => r.name, sortable: true },
    { id: "email", header: "Email", accessor: (r) => r.email, sortable: true },
    { id: "role", header: "Role", accessor: (r) => r.role, sortable: true },
    { id: "actions", header: () => <span className="sr-only">Actions</span>, accessor: (r) => <RowActions row={r} />, sortable: false },
  ]}
  rowKey={(r) => r.id}
  pagination={{ page, totalPages, total, pageSize, onPageChange, onPageSizeChange }}
  searchFields={["name", "email", "slug"]}        // drives the filter input
  defaultSort={{ by: "createdAt", order: "desc" }}
  refresh={{ onRefresh: () => refetch(), isRefreshing }}
  emptyState={<EmptyState />}
/>
```

Behaviors:

- Renders a `<table>` styled to match today's tables (`min-w-full divide-y
  divide-stone-200 text-sm`, `bg-stone-50` header, hover row).
- Toolbar above the table: filter input (left), refresh button (right).
- Pagination bar below the table: `Page N of M` (left), page-size select
  with `(i)` tooltip (right), Prev / Next buttons (rightmost).
- Filter is debounced 200 ms before applying.
- Sort: clicking a sortable header cycles `none → asc → desc → none`; the
  toolbar also has a `Sort by: [col]` `<Select>` + `Order: [asc|desc]` toggle
  and they stay in sync.
- URL state: `useUrlTableState()` syncs the four params (`page`, `pageSize`,
  `q`, `sort`, `order`). Replaces on `push` so back/forward navigates one
  step at a time.

## Tooltip copy

The `(i)` icon next to the page-size `<Select>` says:

> "Choose how many items to show per page. Larger page sizes load more
> data and may take longer to fetch."

## Implementation order

1. **`Select` primitive** in `packages/ui` (Radix wrapper, like the other
   primitives already there).
2. **`useUrlTableState` hook** + types — easy to unit-test in isolation.
3. **Toolbar / pagination / sort-header** subcomponents.
4. **`DataTable` composition** that wires everything together.
5. **Migrate the smallest page first** (`api-keys.tsx`) as a smoke test
   for the API; fix any rough edges.
6. **Migrate the other pages** in this order:
   `team → workspace → projects → collections/$name → assets → index`.
7. **Docs update** in `apps/docs`.
8. **Tests**:
   - Unit: `useUrlTableState` (parse, defaults, round-trip), `DataTable`
     sort/filter logic with a fixture.
   - E2E (Playwright): load `/dashboard/projects`, change page size to
     50, type into the filter, click a sortable header, hit refresh, and
     assert the URL has `?pageSize=50&q=…&sort=…&order=…` and the rows
     reflect the changes.

## Acceptance criteria

- [ ] Every dashboard table/grid has the four affordances.
- [ ] Page-size options are exactly `10`, `25`, `50`.
- [ ] Refresh button re-fetches via React Query and shows a spinning
      icon only while a fetch is in flight.
- [ ] Filter input narrows the **visible** rows (server page is unchanged
      unless page size is exceeded after filtering — in that case a small
      "Showing 3 of 10 on this page" hint appears).
- [ ] Sort state is reflected in the URL and survives a hard reload.
- [ ] Page-size state is reflected in the URL and survives a hard reload.
- [ ] Tooltip copy matches the text in this plan.
- [ ] All existing pages still render and pass `bun run typecheck` and
      `bun run lint`.

## Risks & open questions

- **`assets.tsx` and `index.tsx` use card grids, not tables.** Two options:
  (a) add a `variant="grid"` prop to `<DataTable>`; (b) extract a slim
  `<DataToolbar>` for filter+refresh and keep the custom grid rendering.
  Going with **(b)** to avoid forcing a card layout through a table API.
- **Filter scope.** Filter only applies to the current server page, which
  is what "no need to reload" implies but is worth calling out. If users
  want server-side filter later, it's a follow-up that extends the server
  function signature, not a breaking change.
- **Default sort per page.** Each migrated page will pick its own
  `defaultSort` (e.g. teams → `createdAt desc`, items → `updatedAt desc`).
  Document the chosen default in the migration PR.
- **Backwards compatibility.** Existing URL params (e.g. `?page=…` on
  `collections/$name`) keep working — the new hook just reads them.
- **No `git add -A`.** When we commit, list files explicitly so the
  dirty working directory (screenshots, test-results) doesn't sneak in.

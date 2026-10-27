# Phase 13: Environment Feature — Content Versioning for Projects

## Goal

Allow a Mini CMS **project** (website) to define multiple **environments** (e.g. `production`, `staging`, `development`, `preview`). Each item belongs to **exactly one environment** at a time. Items can be **moved** (promoted) or **copied** (duplicated) between environments. The public API serves whichever environment is marked as `production`, giving you content staging workflows.

---

## Overview

Currently a Project has one flat set of collection items. The public API (`GET /api/collections/items`) returns published items from that single set by specifying `w` (workspace), `p` (project), and `collection_id`/`collection_slug`.

The environment feature adds a new axis:

```
Workspace → Project → Environment → Collection → Items
```

### How it works

- Each **item** has an `environmentId` — it lives in exactly one environment
- One environment per project is marked `isProduction = true` — that's what the public API serves by default
- **Promote to production** → moves the item(s) from whatever env they're in to the production environment (changes `environmentId` to the production env's id)
- **Duplicate to / Copy to** → creates a copy of the item(s) in another environment (the original stays put, a new row appears in the target)
- **Bulk operations** → select multiple items in the dashboard, then promote or duplicate them all at once
- The **collection schema** (fields, types) is **shared** across all environments — only the *data* (items) differs per environment

### Comparison with other CMS platforms

| | Contentful (Environment Aliases) | Sanity (Content Releases) | **Mini CMS (our model)** |
|---|---|---|---|
| **Environments** | Full copies of all content; aliases swap which is "master" | Datasets + releases on top | Named buckets; items belong to one at a time |
| **Promote** | Re-alias `master` to point to a different environment | Publish the release bundle | **Move** item(s) to the production env |
| **Duplicate** | Clone entire env or copy entries via API | Clone a release | **Copy** selected item(s) to another env |
| **Bulk actions** | Full env only | Entire release | Select multiple items → move or copy at once |

---

## Files & Scope of Changes

| Layer | Files to change |
|---|---|
| **DB Schema** | `apps/web/src/db/schema/environments.ts` (new), `apps/web/src/db/schema/collection-items.ts` (add env col), `apps/web/src/db/schema/index.ts` (export) |
| **DB Queries** | `apps/web/src/db/queries/environments.ts` (new), `apps/web/src/db/queries/items.ts` (add env filter, add promote/duplicate helpers), `apps/web/src/db/queries/collections.ts` (no change) |
| **Server Functions** | `apps/web/src/server/functions/*` (environment-scoped helpers) |
| **Public API** | `apps/web/src/routes/api/collections/items.ts` (add `env` param, env filter) |
| **Schema API** | `apps/web/src/routes/api/schema/*.ts` (env-scoped pull/push) |
| **Cache** | `apps/web/src/lib/cache.ts` (include env in cache keys) |
| **Dashboard UI** | Environment management pages, env switcher, item row actions (promote, duplicate), bulk actions toolbar |
| **CLI** | `packages/cli/src/*` (env flag, config, pull/push/generate) |
| **Generated Client** | `packages/cli/src/codegen.ts` (env in client) |
| **Docs** | `apps/docs/content/docs/*.mdx` (API, CLI, env management) |

---

## Phase Plan (ordered)

### Step 1 — Database: `environments` table

**File: `apps/web/src/db/schema/environments.ts`** (new)

```ts
import { relations } from "drizzle-orm";
import { index, sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { projects } from "./projects";

export const environments = sqliteTable(
  "environments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),          // "Production", "Staging", "Development"
    slug: text("slug").notNull(),           // "production", "staging", "development"
    isProduction: integer("is_production", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("environments_project_id_idx").on(table.projectId),
    uniqueIndex("environments_project_slug_uidx").on(table.projectId, table.slug),
  ],
);

export const environmentsRelations = relations(environments, ({ one }) => ({
  project: one(projects, {
    fields: [environments.projectId],
    references: [projects.id],
  }),
}));
```

- `isProduction` marks exactly one environment per project as the "production" one. This is the default when no `env` parameter is passed.
- The unique constraint on `(projectId, slug)` ensures no duplicate env names within a project.

### Step 2 — Database: Add `environmentId` to collection items

**File: `apps/web/src/db/schema/collection-items.ts`** (modify)

Add a new column:

```ts
environmentId: text("environment_id")
  .notNull()
  .references(() => environments.id, { onDelete: "cascade" }),
```

Also add an index:

```ts
index("collection_items_environment_id_idx").on(table.environmentId),
```

**⚠️ Migration consideration:** Existing items have no environment. The migration must:
1. Create a default "production" environment for each project that has items.
2. Set `environment_id = that production env's id` for all existing items.
3. Then make the column `NOT NULL`.

**File: `apps/web/src/db/schema/index.ts`** — add export:
```ts
export * from "./environments";
```

### Step 3 — Database: Seed environments on project creation

**File: `apps/web/src/db/queries/projects.ts`** (modify)

When a project is created, automatically seed at least one environment:

```ts
// In createProject(), after inserting the project:
await db.insert(environments).values({
  id: nanoid(),
  projectId: id,
  name: "Production",
  slug: "production",
  isProduction: true,
  createdAt: now,
  updatedAt: now,
});
```

Optionally seed "Staging" and "Development" as well (configurable via a parameter).

### Step 4 — Database queries: `environments.ts`

**File: `apps/web/src/db/queries/environments.ts`** (new)

```ts
export async function listEnvironments(projectId: string): Promise<...>
export async function getEnvironmentById(id: string, projectId?: string): Promise<...>
export async function getEnvironmentBySlug(slug: string, projectId: string): Promise<...>
export async function getProductionEnvironment(projectId: string): Promise<...>
export async function createEnvironment(input: CreateEnvironmentInput): Promise<...>
export async function updateEnvironment(id: string, data: Partial<...>): Promise<...>
export async function deleteEnvironment(id: string): Promise<...>
```

Key functions:

- **`getProductionEnvironment`** — finds the env where `isProduction = true`. Used as default when no env is specified in API calls.

### Step 5 — DB Queries: Update `items.ts` to filter by environment

**File: `apps/web/src/db/queries/items.ts`** (modify)

All item queries that filter by collection must also filter by `environmentId`:

```ts
// In listItems(), add to conditions:
conditions.push(eq(collectionItems.environmentId, environmentId));
```

The `listItems`, `getItemById`, `createItem`, `updateItem`, `deleteItem`, `countItemsByCollectionIds`, `reorderItems` functions all need to accept and use `environmentId`.

**New functions for environment operations:**

```ts
// PROMOTE: move items from current env to the production env
export async function promoteItemsToProduction(
  itemIds: string[],
  currentEnvironmentId: string,
  productionEnvironmentId: string,
  projectId: string,
): Promise<void>

// DUPLICATE: copy items from one env to another (same collection, new IDs)
export async function duplicateItemsToEnvironment(
  itemIds: string[],
  sourceEnvironmentId: string,
  targetEnvironmentId: string,
): Promise<void>
```

**Promote logic:**
```sql
UPDATE collection_items
SET environment_id = :productionEnvironmentId
WHERE id IN (:itemIds)
  AND environment_id = :currentEnvironmentId
  AND project_id = :projectId
```

**Duplicate logic:**
```sql
INSERT INTO collection_items (id, project_id, collection_id, environment_id, data, sort_order, created_at, updated_at)
SELECT
  nanoid(),
  ci.project_id,
  ci.collection_id,
  :targetEnvironmentId,
  ci.data,
  ci.sort_order,
  now(),
  now()
FROM collection_items ci
WHERE ci.id IN (:itemIds)
  AND ci.environment_id = :sourceEnvironmentId
```

**Design decision:** Pass `environmentId` explicitly (not implicitly from the session) so the public API can set it from the `env` query parameter.

### Step 6 — Public API: Add `env` parameter

**File: `apps/web/src/routes/api/collections/items.ts`** (modify)

1. Add `env` (or `environment`) to the URL search params parsing.
2. Resolve environment:
   - If `env` is provided, look up environment by slug within the project.
   - If `env` is not provided, use `getProductionEnvironment(projectId)`.
3. Pass the resolved `environmentId` through to `listItems()`.
4. Include environment info in the response payload and cache key.

```ts
// Parsing
const environmentSlug = url.searchParams.get("env") ?? "production";

// Resolve
const environment = environmentSlug === "production"
  ? await getProductionEnvironment(projectId)
  : await getEnvironmentBySlug(environmentSlug, projectId);

// Cache key
const cacheKey = buildCacheKey({
  workspaceId,
  projectId,
  environmentId: environment.id,
  collectionId: collection.id,
  page,
  limit,
  query,
  filters,
});
```

### Step 7 — Schema API: Environment-scoped pull/push

**File: `apps/web/src/routes/api/schema/pull.ts`** (modify)
**File: `apps/web/src/routes/api/schema/push.ts`** (modify)

Add optional `environment` query parameter. When provided:
- **Pull:** Only return collections/items for that environment.
- **Push:** Push schemas to the specified environment (creates environment if it doesn't exist).

**File: `apps/web/src/lib/schema-sync.ts`** (modify)
- All sync operations need to accept and pass `environmentId`.

### Step 8 — Cache: Include environment in cache keys

**File: `apps/web/src/lib/cache.ts`** (modify)

- `invalidateCollectionCache` should accept an optional `environmentId` and invalidate all environments' cache for that collection.
- Helper: `invalidateEnvironmentCache(envId, collectionSlug)`

### Step 9 — Server Functions: Environment-scoped actions

**File: `apps/web/src/server/functions/items.ts`** (modify)
**File: `apps/web/src/server/functions/collections.ts`** (modify)

Server functions (createItem, updateItem, deleteItem, etc.) need the active environment context:
- Dashboard UI passes the currently selected environment.
- If no environment is specified, use the production environment for the project.

Add new server functions:
```ts
export const promoteItemsServerFn = serverFn(...) // moves items to production env
export const duplicateItemsServerFn = serverFn(...) // copies items to another env
```

### Step 10 — Dashboard UI: Environment Management

**New routes:**
- `apps/web/src/routes/dashboard/projects/$projectId/environments/index.tsx` — list environments
- `apps/web/src/routes/dashboard/projects/$projectId/environments/$envSlug.tsx` — manage single env
- `apps/web/src/routes/dashboard/projects/$projectId/environments/new.tsx` — create env

**Components to build:**
- `EnvironmentSwitcher` — a dropdown in the project header to switch between environments. Affects all collection/item views.
- `EnvironmentBadge` — shows current env name + color (green=production, yellow=staging, blue=development).
- `PromoteToProductionButton` — per-item action that moves it to the production env
- `DuplicateToButton` — per-item action that copies it to a chosen env (shows a target env picker)
- `BulkActionToolbar` — appears when items are selected; offers "Promote to production" and "Duplicate to..." with a target env selector
- `EnvironmentForm` — create/edit environment name, slug, isProduction flag.

**Modifications to existing views:**
- Collection list page — each item row shows a "Promote" and "Duplicate" action (when not already in production). Add checkboxes for bulk selection.
- Item editor — show which environment the item belongs to, with a "Switch environment" dropdown.
- Collection schema editor — environment-scoped (schema is shared, items are per-env).

### Step 11 — Dashboard UI: Environment Switcher Context

Create a React context or store for the active environment:

**File: `apps/web/src/lib/environment-context.ts`** (new)

```ts
// EnvironmentProvider wraps dashboard routes
// useEnvironment() hook returns { environment, setEnvironment, environments }
```

When the environment changes:
- All collection queries refetch with the new environment.
- The URL optionally reflects the environment: `/dashboard/projects/xyz?env=staging`
- Cache is busted per-environment.

### Step 12 — CLI: Add environment support

**File: `packages/cli/src/constants.ts`** — add env defaults

```ts
export const DEFAULT_ENVIRONMENT = "production";
export const CLI_ENV_KEYS = {
  // ... existing ...
  environment: "MINI_CMS_ENVIRONMENT",
} as const;
```

**File: `packages/cli/src/index.ts`** — add `--env` flag to all relevant commands

- `init` — prompt for default environment
- `pull` — accept `--env`, scope pull to environment
- `push` — accept `--env`, push to environment
- `generate` — embed environment in generated client config
- `collection item list/insert/update/delete` — scope to environment

**File: `packages/cli/src/collections.ts`** — no schema changes needed (schema is cross-environment)

**Config file (`mini.config.json`):**
```json
{
  "baseUrl": "...",
  "workspaceId": "...",
  "projectId": "...",
  "environment": "staging",
  "apiKey": "..."
}
```

### Step 13 — Generated Client: Environment support

**File: `packages/cli/src/codegen.ts`** (modify)

- Generated `mini.client.js` should include the default environment from config.
- `createMiniCmsClient()` accepts an `environment` option.
- `getCollectionItems()` adds `env` query param to requests.
- Generated types remain the same (schema is environment-independent).

**File: `packages/cli/schemas/mini.config.schema.json`** — add `environment` field.

### Step 14 — Promote & Duplicate Content (Deploy Workflow)

**Server functions:**
- `promoteItemsToProduction(items: string[], fromEnvId: string)` — moves items to the project's production env
- `duplicateItemsToEnvironment(items: string[], toEnvId: string, fromEnvId: string)` — copies items to the target env

**Dashboard UI:**
- **Item row:** "Promote to production" button (disabled if already in production env)
- **Item row:** "Duplicate to..." button opens a small popover to pick the target environment
- **Bulk toolbar:** checkboxes on items; "Promote selected" or "Duplicate selected to..." in the toolbar

**CLI commands:**
- `mini-cms items promote <item-id>... [--to production]` — promote one or more items
- `mini-cms items duplicate <item-id>... [--to <env-slug>]` — duplicate items to another env
- `mini-cms environment promote --all` — promote all items from current env to production

### Step 15 — Documentation

**File: `apps/docs/content/docs/environment.mdx`** — new page documenting:
- What environments are
- How to create/manage them in the dashboard
- How `env` parameter works in the API
- CLI environment flags
- Promote vs Duplicate workflows
- Bulk operations

**File: `apps/docs/content/docs/api.mdx`** — add `env` parameter to the public API docs.

**File: `apps/docs/content/docs/cli.mdx`** — add `--env` flag to all commands, add `items promote` and `items duplicate` commands, update examples.

**File: `apps/docs/content/docs/dashboard.mdx`** — add environment management section.

---

## Design Decisions & Rationale

### 1. Why a separate `environments` table instead of just a `_env` field on items?

A separate table allows:
- Validation that only valid environment slugs are used.
- Per-environment metadata (e.g., `isProduction` flag).
- Clean FK constraints that prevent orphan items.
- Future extension (e.g., env-level API keys, env-level settings).

### 2. Why belong-to-one-env instead of full copies per environment?

Unlike Contentful's model where each environment is a full independent copy of all content, Mini CMS keeps items **in exactly one environment at a time**. This is simpler, avoids data duplication, and gives you granular control:

- **Promote = move** (UPDATE `environment_id`). Fast, cheap, doesn't create orphaned copies.
- **Duplicate = copy** (INSERT with new id). Intentional action when you really want the item in two places.
- **Bulk operations** work on individual items, not whole environments.
- No need to clean up stale environment copies when promoting.

### 3. Schema is shared, items are not

The collection schema (fields, types) is the same across all environments within a project. This keeps the model simple and prevents schema drift. Only the *data* (items) differs per environment.

### 4. Default environment is `production`

Backward compatibility: existing API calls with no `env` parameter continue to work and return the production environment's content. New projects get a `production` environment seeded automatically.

### 5. "Promote" vs "Duplicate" — two distinct operations

| | Promote | Duplicate |
|---|---|---|
| **Effect** | Item moves to production env | Item is copied to target env |
| **Original stays?** | No | Yes |
| **Use case** | "This draft is ready to go live" | "I want this item in staging too, as a starting point" |
| **Bulk** | Select all ready items, promote at once | Select items, duplicate to another env in one go |

---

## Future Considerations (Not in Scope for This Phase)

- **Environment-specific API keys** — restrict an API key to a specific environment.
- **Scheduled promotions** — automate content promotion at a specific time.
- **Environment-level domain restrictions** — different allowed domains per env.
- **Preview URLs** — auto-generated preview links for staging content.
- **Auto-duplicate on create** — option to automatically duplicate new items to another env (e.g., create in staging → auto-copy to production).

---

## Migration Strategy

1. Create the `environments` table.
2. For each existing project, create a `production` environment.
3. Add `environment_id` column to `collection_items` as nullable.
4. Backfill: set `environment_id = production env id` for all existing items.
5. Make the column `NOT NULL`.
6. Update all queries to filter by environment.

This is a one-time migration. New projects automatically get environments seeded.

---

## Task Breakdown (Checklist)

### Database
- [x] Create `apps/web/src/db/schema/environments.ts`
- [x] Update `apps/web/src/db/schema/collection-items.ts` — add `environmentId`
- [x] Update `apps/web/src/db/schema/index.ts` — export environments
- [x] Write migration SQL/script for existing data
- [x] Create `apps/web/src/db/queries/environments.ts`
- [x] Update `apps/web/src/db/queries/items.ts` — environment-aware filtering
- [x] Add `promoteItemsToProduction()` to `items.ts`
- [x] Add `duplicateItemsToEnvironment()` to `items.ts`
- [x] Update `apps/web/src/db/queries/projects.ts` — seed production env on create

### API
- [x] Update `apps/web/src/routes/api/collections/items.ts` — add `env` param
- [ ] Update `apps/web/src/routes/api/schema/pull.ts` — env scope
- [ ] Update `apps/web/src/routes/api/schema/push.ts` — env scope
- [ ] Update `apps/web/src/lib/schema-sync.ts` — env awareness
- [x] Update `apps/web/src/lib/cache.ts` — env in cache keys

### Server Functions
- [x] Update `apps/web/src/server/functions/items.ts` — env context (createItem signature)
- [x] Add promoteItems/duplicateItems server functions and createServerFn wrappers
- [ ] Update `apps/web/src/server/functions/collections.ts` — env context

### Dashboard UI
- [ ] Create environment management routes (list, manage, create)
- [x] Build `EnvironmentSwitcher` component
- [x] Build `PromoteToProductionButton` (per-item + bulk) — integrated into collection page
- [x] Build `DuplicateToButton` with target env picker (per-item + bulk) — integrated into collection page
- [x] Build `BulkActionToolbar` — promote/duplicate in bulk toolbar
- [ ] Build `EnvironmentForm` (create/edit)
- [x] Create `apps/web/src/lib/environment-context.tsx`
- [x] Update collection list page — env filter, per-item promote/copy buttons
- [ ] Update item editor — env context

### Server Helpers & Queries
- [x] Create `apps/web/src/lib/environment-helpers.ts` — list, get, create, update, delete server functions
- [x] Add environment query options to `apps/web/src/lib/queries.ts`

### CLI
- [ ] Update `packages/cli/src/constants.ts` — env defaults
- [ ] Update `packages/cli/src/index.ts` — `--env` flag, env config
- [ ] Update `packages/cli/src/collections.ts` — no schema change needed
- [ ] Update `packages/cli/src/file-utils.ts` — if needed
- [ ] Update `packages/cli/src/codegen.ts` — env in generated client
- [ ] Add `mini-cms items promote <item-id>...` command
- [ ] Add `mini-cms items duplicate <item-id>... --to <env>` command
- [ ] Add `mini-cms environment promote --all` command
- [ ] Update config schema JSON files

### Generated Client
- [ ] Embed environment in `mini.client.js`
- [ ] Update `mini.client.d.ts` declarations

### Documentation
- [ ] Create `apps/docs/content/docs/environment.mdx`
- [ ] Update `apps/docs/content/docs/api.mdx`
- [ ] Update `apps/docs/content/docs/cli.mdx`
- [ ] Update `apps/docs/content/docs/dashboard.mdx`

---

## Test Plan

- Unit tests for environment queries (create, list, promote, duplicate).
- API tests: calling with `env=staging` returns staging items, calling with no env returns production.
- Integration: promote items to production, verify they now belong to production env.
- Integration: duplicate items to another env, verify both copies exist independently.
- CLI tests: `--env` flag correctly scopes pull/push, `items promote` works.
- Dashboard: environment switcher changes the data shown in collection/item views.
- Dashboard: per-item promote/duplicate actions work correctly.
- Dashboard: bulk promote/duplicate works.
- Migration: existing projects get a production env and all items are migrated.

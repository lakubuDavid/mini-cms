# Phase 13: Environment Feature — Content Versioning for Projects

## Goal

Allow a Mini CMS **project** (website) to define multiple **environments** (e.g. `production`, `staging`, `development`, `preview`). Each environment holds its own copy of collection items, so edits in one environment don't affect another until explicitly promoted. This enables content staging workflows.

---

## Overview

Currently a Project has one flat set of collection items. The public API (`GET /api/collections/items`) returns published items from that single set by specifying `w` (workspace), `p` (project), and `collection_id`/`collection_slug`.

The environment feature adds a new axis:

```
Workspace → Project → Environment → Collection → Items
```

When fetching data, the caller specifies which environment to read from. If no environment is specified, `production` is used as the default. Items are duplicated across environments (like Git branches), not shared with a status field — this allows completely different content in each environment without cross-contamination.

---

## Files & Scope of Changes

| Layer | Files to change |
|---|---|
| **DB Schema** | `apps/web/src/db/schema/environments.ts` (new), `apps/web/src/db/schema/collection-items.ts` (add env col), `apps/web/src/db/schema/index.ts` (export) |
| **DB Queries** | `apps/web/src/db/queries/environments.ts` (new), `apps/web/src/db/queries/items.ts` (add env filter), `apps/web/src/db/queries/collections.ts` (no change) |
| **Server Functions** | `apps/web/src/server/functions/*` (environment-scoped helpers) |
| **Public API** | `apps/web/src/routes/api/collections/items.ts` (add `env` param, env filter) |
| **Schema API** | `apps/web/src/routes/api/schema/*.ts` (env-scoped pull/push) |
| **Cache** | `apps/web/src/lib/cache.ts` (include env in cache keys) |
| **Dashboard UI** | Environment management pages, env switcher, item editor changes |
| **CLI** | `packages/cli/src/*` (env flag, config, pull/push/generate) |
| **Generated Client** | `packages/cli/src/codegen.ts` (env in client) |
| **Docs** | `apps/docs/content/docs/*.mdx` (API, CLI, env management) |

---

## Phase Plan (ordered)

### Step 1 — Database: `environments` table

**File: `apps/web/src/db/schema/environments.ts`** (new)

```ts
import { relations } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
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
export async function promoteItems(sourceEnvId: string, targetEnvId: string, collectionId?: string): Promise<...>
```

Key functions:

- **`getProductionEnvironment`** — finds the env where `isProduction = true`. Used as default when no env is specified in API calls.
- **`promoteItems`** — copies/merges items from one environment to another. This is the "deploy content" operation.

### Step 5 — DB Queries: Update `items.ts` to filter by environment

**File: `apps/web/src/db/queries/items.ts`** (modify)

All item queries that filter by collection must also filter by `environmentId`:

```ts
// In listItems(), add to conditions:
conditions.push(eq(collectionItems.environmentId, environmentId));
```

The `listItems`, `getItemById`, `createItem`, `updateItem`, `deleteItem`, `countItemsByCollectionIds`, `reorderItems` functions all need to accept and use `environmentId`.

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

### Step 10 — Dashboard UI: Environment Management

**New routes:**
- `apps/web/src/routes/dashboard/projects/$projectId/environments/index.tsx` — list environments
- `apps/web/src/routes/dashboard/projects/$projectId/environments/$envSlug.tsx` — manage single env
- `apps/web/src/routes/dashboard/projects/$projectId/environments/new.tsx` — create env

**Components to build:**
- `EnvironmentSwitcher` — a dropdown in the project header to switch between environments. Affects all collection/item views.
- `EnvironmentBadge` — shows current env name + color (green=production, yellow=staging, blue=development).
- `PromoteDialog` — modal to promote items from current env to another.
- `EnvironmentForm` — create/edit environment name, slug, isProduction flag.

**Modifications to existing views:**
- Collection list page — add environment filter/context
- Item editor — show which environment the item belongs to
- Collection schema editor — environment-scoped (schema is shared, items are per-env)

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

### Step 14 — Promote Content (Deploy Workflow)

**Server function:** `promoteItemsServerFn` — copies all items from source environment to target environment for a given collection.

**Dashboard UI:** A "Promote to Production" button on staging environment pages.

**CLI command:** `mini-cms environment promote --from staging --to production`

This is the key workflow:
1. Edit content in `staging`
2. Preview it (staging env has its own public API endpoint)
3. Promote to `production` when ready

### Step 15 — Documentation

**File: `apps/docs/content/docs/environment.mdx`** — new page documenting:
- What environments are
- How to create/manage them in the dashboard
- How `env` parameter works in the API
- CLI environment flags
- Promotion workflow

**File: `apps/docs/content/docs/api.mdx`** — add `env` parameter to the public API docs.

**File: `apps/docs/content/docs/cli.mdx`** — add `--env` flag to all commands, update examples.

**File: `apps/docs/content/docs/dashboard.mdx`** — add environment management section.

---

## Design Decisions & Rationale

### 1. Why a separate `environments` table instead of just a `_env` field on items?

A separate table allows:
- Validation that only valid environment slugs are used.
- Per-environment metadata (e.g., `isProduction` flag).
- Clean FK constraints that prevent orphan items.
- Future extension (e.g., env-level API keys, env-level settings).

### 2. Why duplicate items instead of sharing with a status field?

- **Isolation:** Edits in `staging` never leak to `production`. No accidental publishes.
- **Simplicity:** Queries are straightforward (`WHERE environment_id = ?`). No complex visibility rules.
- **Branching:** Like Git branches for content. Each env can diverge independently.
- **Promotion is explicit:** Copying items from staging → production is a deliberate action, not a side effect of saving.

### 3. Schema is shared, items are not

The collection schema (fields, types) is the same across all environments within a project. This keeps the model simple and prevents schema drift. Only the *data* (items) differs per environment.

### 4. Default environment is `production`

Backward compatibility: existing API calls with no `env` parameter continue to work and return the production environment's content. New projects get a `production` environment seeded automatically.

---

## Future Considerations (Not in Scope for This Phase)

- **Environment-specific API keys** — restrict an API key to a specific environment.
- **Scheduled promotions** — automate content promotion at a specific time.
- **Environment-level domain restrictions** — different allowed domains per env.
- **Preview URLs** — auto-generated preview links for staging content.
- **Environment cloning** — copy all items from one env to a new env (for creating a staging env from production baseline).

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
- [ ] Create `apps/web/src/db/schema/environments.ts`
- [ ] Update `apps/web/src/db/schema/collection-items.ts` — add `environmentId`
- [ ] Update `apps/web/src/db/schema/index.ts` — export environments
- [ ] Write migration SQL/script for existing data
- [ ] Create `apps/web/src/db/queries/environments.ts`
- [ ] Update `apps/web/src/db/queries/items.ts` — environment-aware filtering
- [ ] Update `apps/web/src/db/queries/projects.ts` — seed production env on create

### API
- [ ] Update `apps/web/src/routes/api/collections/items.ts` — add `env` param
- [ ] Update `apps/web/src/routes/api/schema/pull.ts` — env scope
- [ ] Update `apps/web/src/routes/api/schema/push.ts` — env scope
- [ ] Update `apps/web/src/lib/schema-sync.ts` — env awareness
- [ ] Update `apps/web/src/lib/cache.ts` — env in cache keys

### Server Functions
- [ ] Update `apps/web/src/server/functions/items.ts` — env context
- [ ] Update `apps/web/src/server/functions/collections.ts` — env context

### Dashboard UI
- [ ] Create environment management routes
- [ ] Build `EnvironmentSwitcher` component
- [ ] Build `EnvironmentBadge` component
- [ ] Build `PromoteDialog` component
- [ ] Build `EnvironmentForm` component
- [ ] Create `apps/web/src/lib/environment-context.ts`
- [ ] Update collection list page — env filter
- [ ] Update item editor — env context

### CLI
- [ ] Update `packages/cli/src/constants.ts` — env defaults
- [ ] Update `packages/cli/src/index.ts` — `--env` flag, env config
- [ ] Update `packages/cli/src/collections.ts` — no schema change needed
- [ ] Update `packages/cli/src/file-utils.ts` — if needed
- [ ] Update `packages/cli/src/codegen.ts` — env in generated client
- [ ] Add `mini-cms environment promote` command
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

- Unit tests for environment queries (create, list, promote).
- API tests: calling with `env=staging` returns staging items, calling with no env returns production.
- Integration: promote items from staging to production, verify production items updated.
- CLI tests: `--env` flag correctly scopes pull/push.
- Dashboard: environment switcher changes the data shown in collection/item views.
- Migration: existing projects get a production env and all items are migrated.

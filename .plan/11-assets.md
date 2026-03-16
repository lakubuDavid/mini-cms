# Phase 11 — Asset Management

## Overview

Add S3-compatible asset hosting with presigned URL uploads, dashboard UI, CLI commands, and documentation. Uses `aws4fetch` (3KB, zero deps) for all S3 operations — chosen over `@aws-sdk/client-s3` (87KB) for serverless cold-start optimization.

## Architecture

| Decision         | Choice                                                     |
| ---------------- | ---------------------------------------------------------- |
| S3 library       | `aws4fetch` (3KB, zero deps)                               |
| Upload flow      | Presigned PUT URLs (client uploads directly to S3)         |
| Asset scope      | Project-scoped (like collections)                          |
| Public access    | Direct S3/CDN URLs only (no public API endpoint)          |
| Max file size    | 10MB (server-enforced before presigned URL generation)    |
| Allowed types    | Images (jpg, png, gif, webp, svg, ico), PDF, Video (mp4, webm) |
| Status tracking  | `pending` → `active` (two-step presigned URL flow)         |

## Upload Flow (Presigned URL)

```
1. Client → Server: "I want to upload photo.jpg (image/jpeg, 2.4MB)"
2. Server: validates content type & size, generates nanoid, builds storage key
3. Server: creates presigned PUT URL via aws4fetch (expires 10min)
4. Server: inserts asset record in DB with status="pending"
5. Server → Client: { uploadUrl, assetId, publicUrl }
6. Client → S3: PUT to presigned URL with file body + Content-Type header
7. Client → Server: "Upload complete for assetId"
8. Server: marks asset status="active", returns final asset record
```

Pending assets older than 1 hour can be cleaned up by a periodic job (future enhancement).

## Allowed MIME Types

```typescript
const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  // Documents
  "application/pdf",
  // Video
  "video/mp4",
  "video/webm",
] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
```

## Step 1 — Install Dependency

```bash
cd apps/web && bun add aws4fetch
```

## Step 2 — Environment Variables

Add to `apps/web/src/lib/env.ts` server section:

```typescript
// Asset Storage (S3-compatible)
S3_BUCKET_NAME: z.string().min(1).optional(),
S3_REGION: z.string().min(1).optional(),
S3_ENDPOINT: z.string().url().optional(),
S3_ACCESS_KEY_ID: z.string().min(1).optional(),
S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
S3_PUBLIC_URL: z.string().url().optional(),

// Demo limits
DEMO_MAX_ASSETS_PER_PROJECT: z.coerce.number().int().positive().optional(),
```

All optional — assets feature is disabled if `S3_BUCKET_NAME` is not set. When `S3_BUCKET_NAME` is set, all other S3 vars become required (validated at runtime in the S3 client).

Update `.env.example` with the new variables.

## Step 3 — S3 Client (`apps/web/src/lib/s3.ts`)

```typescript
import { AwsClient } from "aws4fetch";
import { env } from "@/lib/env";

// Lazy-init singleton
let client: AwsClient | null = null;

function getClient(): AwsClient {
  if (client) return client;
  if (!env.S3_BUCKET_NAME) throw new Error("Asset storage not configured");
  client = new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    region: env.S3_REGION!,
  });
  return client;
}

function getBucketUrl(): string {
  const endpoint = env.S3_ENDPOINT!;
  const bucket = env.S3_BUCKET_NAME!;
  // R2/MinIO: endpoint already includes bucket routing
  // AWS S3: use path-style or virtual-hosted
  return endpoint.includes(bucket)
    ? endpoint
    : `${endpoint}/${bucket}`;
}

export async function createPresignedPutUrl(
  key: string,
  contentType: string,
  expiresIn = 600, // 10 minutes
): Promise<string> {
  const aws = getClient();
  const url = new URL(`${getBucketUrl()}/${key}`);
  url.searchParams.set("X-Amz-Expires", String(expiresIn));
  const signed = await aws.sign(new Request(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
  }), { aws: { signQuery: true } });
  return signed.url;
}

export async function deleteObject(key: string): Promise<void> {
  const aws = getClient();
  const url = `${getBucketUrl()}/${key}`;
  await aws.sign(new Request(url, { method: "DELETE" })).then(fetch);
}

export function getPublicUrl(key: string): string {
  return `${env.S3_PUBLIC_URL!}/${key}`;
}
```

Storage key format: `{orgId}/{projectId}/{nanoid}-{sanitizedFilename}`

## Step 4 — Database Schema (`apps/web/src/db/schema/assets.ts`)

```typescript
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { organizations } from "./auth";
import { projects } from "./projects";

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(), // bytes
    storageKey: text("storage_key").notNull(),
    publicUrl: text("public_url").notNull(),
    status: text("status", { enum: ["pending", "active"] })
      .notNull()
      .default("pending"),
    uploadedById: text("uploaded_by_id"),
    // No FK on uploadedById to avoid circular deps with auth schema
    // Enforced at application level
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("assets_organization_id_idx").on(table.organizationId),
    index("assets_project_id_idx").on(table.projectId),
    uniqueIndex("assets_storage_key_uidx").on(table.storageKey),
    index("assets_status_idx").on(table.status),
  ],
);
```

Add to barrel: `apps/web/src/db/schema/index.ts` → `export * from "./assets"`

Run `bun run db:generate` and `bun run db:push` to create the migration.

## Step 5 — Queries (`apps/web/src/db/queries/assets.ts`)

Following the collections query pattern:

```typescript
import { and, count, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { buildPagination, normalizePagination, type PaginationInput } from "./shared";

// --- Types ---
export type CreateAssetInput = {
  organizationId: string;
  projectId: string;
  filename: string;
  originalFilename: string;
  contentType: string;
  size: number;
  storageKey: string;
  publicUrl: string;
  uploadedById?: string;
};

export type ListAssetsInput = PaginationInput & {
  organizationId: string;
  projectId?: string;
  status?: "pending" | "active";
};

// --- Queries ---

export async function listAssets(input: ListAssetsInput) {
  const { page, limit, offset } = normalizePagination(input);
  const where = and(
    eq(assets.organizationId, input.organizationId),
    input.projectId ? eq(assets.projectId, input.projectId) : undefined,
    input.status ? eq(assets.status, input.status) : eq(assets.status, "active"),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(assets).where(where).limit(limit).offset(offset)
      .orderBy(assets.createdAt),
    db.select({ value: count() }).from(assets).where(where),
  ]);

  return { items, pagination: buildPagination(page, limit, total) };
}

export async function getAssetById(id: string) {
  return db.query.assets.findFirst({ where: eq(assets.id, id) });
}

export async function createAsset(input: CreateAssetInput) {
  const id = nanoid();
  const now = new Date().toISOString();
  await db.insert(assets).values({
    id,
    ...input,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  return getAssetById(id);
}

export async function confirmAsset(id: string) {
  await db.update(assets).set({
    status: "active",
    updatedAt: new Date().toISOString(),
  }).where(eq(assets.id, id));
  return getAssetById(id);
}

export async function deleteAsset(id: string) {
  const asset = await getAssetById(id);
  if (asset) {
    await db.delete(assets).where(eq(assets.id, id));
  }
  return asset; // return deleted record for S3 cleanup
}

export async function getAssetCount(projectId: string) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(assets)
    .where(and(eq(assets.projectId, projectId), eq(assets.status, "active")));
  return value;
}
```

## Step 6 — Server Functions & Helpers

### `apps/web/src/server/functions/assets.ts`

Action functions with PostHog tracking (following collections pattern):

- **`requestUploadAction(input)`** — validates content type against `ALLOWED_MIME_TYPES`, validates size ≤ 10MB, checks `ensureAssetLimit(projectId)` for demo limits, generates presigned PUT URL, creates pending asset record, captures `asset_upload_requested` event
- **`confirmUploadAction(input)`** — marks asset as active, captures `asset_uploaded` event
- **`listAssetsAction(input)`** — thin pass-through to query
- **`deleteAssetAction(input)`** — deletes from DB, then deletes from S3, captures `asset_deleted` event
- **`getAssetInfoAction(input)`** — get single asset by ID

### `apps/web/src/lib/assets-helpers.ts`

TanStack Start server function wrappers:

```typescript
export const requestUploadServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { projectId: string; filename: string; contentType: string; size: number }) => data)
  .handler(async ({ data }) => {
    const { requireActiveOrganizationId } = await import("./auth-helpers");
    const orgId = await requireActiveOrganizationId();
    const { requestUploadAction } = await import("../server/functions/assets");
    return requestUploadAction({ ...data, organizationId: orgId });
  });

// confirmUploadServerFn, listAssetsServerFn, deleteAssetServerFn, getAssetInfoServerFn
// ... same pattern
```

### `apps/web/src/lib/queries.ts`

Add to `queryKeys`:

```typescript
assets: (page: number, limit: number, projectId?: string) =>
  ["assets", { page, limit, projectId }] as const,
```

Add factory:

```typescript
export function assetsQueryOptions(page: number, limit: number, projectId?: string) {
  return queryOptions({
    queryKey: queryKeys.assets(page, limit, projectId),
    queryFn: () => listAssetsServerFn({ data: { page, limit, projectId } }),
    staleTime: 10_000,
  });
}
```

### `apps/web/src/lib/demo-limits.ts`

Add `ensureAssetLimit(projectId)` function checking `DEMO_MAX_ASSETS_PER_PROJECT`.

## Step 7 — Dashboard UI

### `apps/web/src/routes/dashboard/assets.tsx`

Route: `/dashboard/assets`

**Components:**
- **Asset grid** — responsive grid of asset cards. Image types show thumbnail preview, others show file-type icon. Each card shows filename, size, content type.
- **Upload dialog** — modal with drag-and-drop zone + file picker button. Shows upload progress. Flow: select file → validate type/size client-side → call `requestUploadServerFn` → PUT to presigned URL → call `confirmUploadServerFn` → invalidate query → close dialog.
- **Asset detail dialog** — click an asset card to see metadata (filename, size, type, uploaded by, created date). Copy public URL button. Delete button with confirmation.
- **Project filter** — dropdown to filter assets by project (default: all projects).
- **Empty state** — "No assets yet. Upload your first file." with upload button.

**Patterns used:**
- TanStack Query with `assetsQueryOptions`
- Custom hand-rolled modals (same pattern as collections)
- Lucide icons: `Upload`, `File`, `Image`, `Film`, `FileText`, `Copy`, `Trash2`, `X`, `Plus`
- Stone color palette with dark mode variants
- `useNavigate` with search params for project filter

### Navigation

Add "Assets" link to dashboard sidebar/nav (next to Collections).

## Step 8 — CLI Commands

Add `asset` subcommand to `packages/cli/src/index.ts`:

```
mini-cms asset list [--project-id] [--json]
mini-cms asset upload <file> [--project-id] [--json]
mini-cms asset delete <asset-id> [--json]
mini-cms asset info <asset-id> [--json]
```

### Schema API Routes

New file: `apps/web/src/routes/api/schema/assets.ts`

Endpoints (API key auth via `verifySchemaApiKey`):

| Method | Path                | Body / Query                              | Action              |
| ------ | ------------------- | ----------------------------------------- | -------------------- |
| GET    | `/api/schema/assets` | `?projectId=&page=&limit=`              | List assets          |
| POST   | `/api/schema/assets` | `{ action: "request-upload", filename, contentType, size, projectId }` | Get presigned URL   |
| POST   | `/api/schema/assets` | `{ action: "confirm-upload", assetId }`  | Confirm upload      |
| POST   | `/api/schema/assets` | `{ action: "delete", assetId }`          | Delete asset         |
| GET    | `/api/schema/assets` | `?assetId=<id>`                          | Get asset info       |

CLI `upload` command flow:
1. Read file from disk, determine content type from extension
2. POST `request-upload` → get `{ uploadUrl, assetId, publicUrl }`
3. PUT file body to `uploadUrl` with `Content-Type` header (uses native `fetch`)
4. POST `confirm-upload` with `assetId`
5. Print result table or JSON

## Step 9 — Documentation Updates

Update in `apps/docs-v2/content/docs/`:

- **`environment.mdx`** — add S3 env vars section
- **`dashboard.mdx`** — add asset management section with screenshots/descriptions
- **`cli.mdx`** — add `asset` command documentation

## File Checklist

| File                                                 | Action  |
| ---------------------------------------------------- | ------- |
| `apps/web/package.json`                              | Add `aws4fetch` |
| `apps/web/src/lib/env.ts`                            | Add S3 + demo limit env vars |
| `apps/web/src/lib/s3.ts`                             | Create — S3 client |
| `apps/web/src/db/schema/assets.ts`                   | Create — assets table |
| `apps/web/src/db/schema/index.ts`                    | Add assets export |
| `apps/web/src/db/queries/assets.ts`                  | Create — CRUD queries |
| `apps/web/src/server/functions/assets.ts`            | Create — action functions |
| `apps/web/src/lib/assets-helpers.ts`                 | Create — server fn wrappers |
| `apps/web/src/lib/queries.ts`                        | Add asset query options |
| `apps/web/src/lib/demo-limits.ts`                    | Add `ensureAssetLimit` |
| `apps/web/src/routes/dashboard/assets.tsx`           | Create — dashboard page |
| `apps/web/src/routes/api/schema/assets.ts`           | Create — CLI API route |
| `packages/cli/src/index.ts`                          | Add `asset` subcommand |
| `apps/docs-v2/content/docs/environment.mdx`         | Update — S3 vars |
| `apps/docs-v2/content/docs/dashboard.mdx`           | Update — asset section |
| `apps/docs-v2/content/docs/cli.mdx`                 | Update — asset commands |
| `.env.example`                                       | Add S3 vars |

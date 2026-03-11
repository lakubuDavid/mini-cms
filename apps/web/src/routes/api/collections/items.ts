import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, projects } from "@/db/schema";
import { getCollectionById, getCollectionBySlug } from "@/db/queries/collections";
import { listItems } from "@/db/queries/items";
import { normalizePagination } from "@/db/queries/shared";
import { apiRateLimit, getCached, setCached } from "@/lib/cache";

type CollectionItemsPayload = {
  workspace: {
    id: string;
    slug: string;
    name: string;
  };
  project: {
    id: string;
    slug: string;
    name: string;
  };
  collection: Awaited<ReturnType<typeof getCollectionById>>;
  items: Awaited<ReturnType<typeof listItems>>["items"];
  pagination: Awaited<ReturnType<typeof listItems>>["pagination"];
};

export async function handleCollectionItems(request: Request) {
  try {
    const url = new URL(request.url);
    const {
      workspaceId,
      projectId,
      collectionId,
      collectionSlug,
      page,
      limit,
      query,
      rawFilters,
    } = parseCollectionItemsSearch(url);

    if (!workspaceId || !projectId || (!collectionId && !collectionSlug)) {
      return json(
        {
          error:
            "w, p, and collection_id (or collection_slug) query parameters are required.",
        },
        400,
      );
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "local";

    const rateLimit = await apiRateLimit.limit(
      `public:${ip}:${workspaceId}:${projectId}:${collectionId ?? collectionSlug}`,
    );

    if (!rateLimit.success) {
      const retryAfter = Math.max(
        0,
        Math.ceil((rateLimit.reset - Date.now()) / 1000),
      );

      return json(
        { error: "Too many requests." },
        429,
        { "retry-after": String(retryAfter) },
      );
    }

    const workspace = await db.query.organizations.findFirst({
      where: eq(organizations.id, workspaceId),
    });

    if (!workspace) {
      return json({ error: "Workspace not found." }, 404);
    }

    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.organizationId, workspaceId),
      ),
    });

    if (!project) {
      return json({ error: "Project not found." }, 404);
    }

    const collection = collectionId
      ? await getCollectionById(collectionId, workspaceId, projectId)
      : await getCollectionBySlug(collectionSlug!, workspaceId, projectId);

    if (!collection) {
      return json({ error: "Collection not found." }, 404);
    }

    const filters = validateFilters(rawFilters, collection.schema);
    const cacheKey = buildCacheKey({
      workspaceId,
      projectId,
      collectionId: collection.id,
      page,
      limit,
      query,
      filters,
    });
    const cached = await getCached<CollectionItemsPayload>(cacheKey);

    if (cached) {
      return json(cached, 200, { "x-cache": "HIT" });
    }

    const items = await listItems(collection.id, {
      page,
      limit,
      publishedOnly: true,
      query,
      filters,
      schema: collection.schema,
    });

    const payload = {
      workspace: {
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
      },
      project: {
        id: project.id,
        slug: project.slug,
        name: project.name,
      },
      collection,
      items: items.items,
      pagination: items.pagination,
    } satisfies CollectionItemsPayload;

    await setCached(cacheKey, payload, 60);

    return json(payload, 200, { "x-cache": "MISS" });
  } catch (error) {
    return handleError(error);
  }
}

export const Route = createFileRoute("/api/collections/items")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        handleCollectionItems(request),
    },
  },
});

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function handleError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }

  return json(
    { error: error instanceof Error ? error.message : "Unexpected error." },
    500,
  );
}

function parseCollectionItemsSearch(url: URL) {
  const workspaceId = url.searchParams.get("w");
  const projectId = url.searchParams.get("p");
  const collectionId = url.searchParams.get("collection_id");
  const collectionSlug = url.searchParams.get("collection_slug");
  const { page, limit } = normalizePagination({
    page: Number(url.searchParams.get("page") ?? "1"),
    limit: Number(url.searchParams.get("limit") ?? "10"),
  });
  const query = url.searchParams.get("q")?.trim() ?? "";
  const rawFilters: Record<string, string> = {};

  for (const [key, value] of url.searchParams.entries()) {
    if (!key.startsWith("filter.")) {
      continue;
    }

    const fieldKey = key.slice("filter.".length).trim();

    if (fieldKey) {
      rawFilters[fieldKey] = value;
    }
  }

  return {
    workspaceId,
    projectId,
    collectionId,
    collectionSlug,
    page,
    limit,
    query,
    rawFilters,
  };
}

function validateFilters(
  filters: Record<string, string>,
  schema: Array<{ key: string }>,
) {
  const allowedKeys = new Set(["_id", "_published", ...schema.map((field) => field.key)]);

  for (const key of Object.keys(filters)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Unknown filter field: ${key}.`);
    }
  }

  return filters;
}

function buildCacheKey(input: {
  workspaceId: string;
  projectId: string;
  collectionId: string;
  page: number;
  limit: number;
  query: string;
  filters: Record<string, string>;
}) {
  const filters = Object.keys(input.filters)
    .sort()
    .map((key) => `${key}=${input.filters[key]}`)
    .join("&");

  return [
    "public",
    input.workspaceId,
    input.projectId,
    input.collectionId,
    String(input.page),
    String(input.limit),
    input.query,
    filters,
  ].join(":");
}

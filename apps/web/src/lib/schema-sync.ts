import {
  createCollection,
  getCollectionById,
  getCollectionBySlug,
  listCollections,
  updateCollection,
} from "@/db/queries/collections";
import { getDefaultProject, getProjectById } from "@/db/queries/projects";
import { auth } from "@/lib/auth";
import { invalidateCollectionCache } from "@/lib/cache";

export type SyncedCollection = {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  schema: Array<{
    key: string;
    label: string;
    type: "text" | "url" | "number" | "boolean" | "date";
  }>;
};

export type SchemaPullPayload = {
  workspaceId: string;
  pulledAt: string;
  collections: SyncedCollection[];
};

export type SchemaPushPayload = {
  workspaceId: string;
  collectionId?: string;
  projectId?: string;
  collections: SyncedCollection[];
};

function readApiKeyFromRequest(request: Request) {
  const headerKey = request.headers.get("x-api-key");

  if (headerKey) {
    return headerKey;
  }

  const authorization = request.headers.get("authorization");

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return null;
}

const schemaSyncDeps = {
  verifyApiKey: auth.api.verifyApiKey,
  getCollectionById,
  getCollectionBySlug,
  listCollections,
  createCollection,
  updateCollection,
  getDefaultProject,
  getProjectById,
  invalidateCollectionCache,
};

type VerifySchemaApiKeyDeps = Pick<typeof schemaSyncDeps, "verifyApiKey">;
type LoadWorkspaceCollectionsDeps = Pick<
  typeof schemaSyncDeps,
  "getCollectionById" | "listCollections"
>;
type ApplyWorkspaceSchemaPushDeps = Pick<
  typeof schemaSyncDeps,
  | "getCollectionById"
  | "getCollectionBySlug"
  | "createCollection"
  | "updateCollection"
  | "getDefaultProject"
  | "getProjectById"
  | "invalidateCollectionCache"
>;

export async function verifySchemaApiKey(
  request: Request,
  _action: "pull" | "push",
  deps: VerifySchemaApiKeyDeps = schemaSyncDeps,
) {
  const key = readApiKeyFromRequest(request);

  if (!key) {
    throw new Response(
      JSON.stringify({ error: "Missing API key." }),
      responseInit(401),
    );
  }

  const result = await deps.verifyApiKey({
    body: {
      key,
    },
  });

  if (!result.valid || !result.key) {
    throw new Response(
      JSON.stringify({ error: result.error?.message ?? "Invalid API key." }),
      responseInit(401),
    );
  }

  const metadata =
    result.key.metadata && typeof result.key.metadata === "object"
      ? (result.key.metadata as Record<string, unknown>)
      : null;
  const projectId =
    typeof metadata?.projectId === "string" ? metadata.projectId : null;

  return {
    workspaceId: result.key.referenceId,
    projectId,
    apiKey: result.key,
  };
}

export async function loadWorkspaceCollectionsForSync(input: {
  workspaceId: string;
  collectionId?: string | null;
  projectId?: string | null;
}, deps: LoadWorkspaceCollectionsDeps = schemaSyncDeps) {
  if (input.collectionId) {
    const collection = await deps.getCollectionById(
      input.collectionId,
      input.workspaceId,
      input.projectId ?? undefined,
    );

    if (!collection) {
      throw new Response(
        JSON.stringify({ error: "Collection not found for workspace." }),
        responseInit(404),
      );
    }

    return [collection];
  }

  const result = await deps.listCollections({
    page: 1,
    limit: 500,
    organizationId: input.workspaceId,
    projectId: input.projectId ?? undefined,
  });

  return result.items;
}

export async function applyWorkspaceSchemaPush(
  input: SchemaPushPayload,
  deps: ApplyWorkspaceSchemaPushDeps = schemaSyncDeps,
) {
  const updatedCollections: SyncedCollection[] = [];

  for (const incoming of input.collections) {
    if (
      input.collectionId &&
      incoming.id &&
      incoming.id !== input.collectionId
    ) {
      continue;
    }

    const existingById = incoming.id
      ? await deps.getCollectionById(
          incoming.id,
          input.workspaceId,
          input.projectId ?? undefined,
        )
      : null;
    const existing =
      existingById ??
      (await deps.getCollectionBySlug(
        incoming.slug,
        input.workspaceId,
        input.projectId ?? undefined,
      ));

    if (!existing) {
      if (input.collectionId) {
        throw new Response(
          JSON.stringify({ error: `Collection '${incoming.slug}' not found.` }),
          responseInit(404),
        );
      }

      const created = await deps.createCollection({
        projectId:
          (input.projectId
            ? (await deps.getProjectById(input.projectId, input.workspaceId))?.id
            : (await deps.getDefaultProject(input.workspaceId))?.id)
          ?? (() => {
            throw new Response(JSON.stringify({ error: "No project found for workspace." }), responseInit(500));
          })(),
        organizationId: input.workspaceId,
        name: incoming.name,
        slug: incoming.slug,
        description: incoming.description,
        schema: incoming.schema,
      });

      if (!created) {
        throw new Response(
          JSON.stringify({
            error: `Unable to create collection '${incoming.slug}'.`,
          }),
          responseInit(500),
        );
      }

      await deps.invalidateCollectionCache(created.slug);

      updatedCollections.push({
        id: created.id,
        name: created.name,
        slug: created.slug,
        description: created.description ?? null,
        schema: created.schema,
      });

      continue;
    }

    const updated = await deps.updateCollection(existing.id, {
      name: incoming.name,
      slug: incoming.slug,
      description: incoming.description,
      schema: incoming.schema,
    });

    if (updated?.slug) {
      await deps.invalidateCollectionCache(updated.slug);
    }

    if (updated) {
      updatedCollections.push({
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        description: updated.description ?? null,
        schema: updated.schema,
      });
    }
  }

  return updatedCollections;
}

export function toSyncCollection(
  collection: Awaited<ReturnType<typeof getCollectionById>>,
) {
  if (!collection) {
    throw new Error("Collection is required");
  }

  return {
    id: collection.id,
    name: collection.name,
    slug: collection.slug,
    description: collection.description ?? null,
    schema: collection.schema,
  } satisfies SyncedCollection;
}

function responseInit(status: number): ResponseInit {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  };
}

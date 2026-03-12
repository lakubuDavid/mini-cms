import {
  createCollection,
  deleteCollection,
  listCollections,
  type CreateCollectionInput,
  updateCollection,
} from "@/db/queries/collections";
import { getDefaultProject } from "@/db/queries/projects";
import { invalidateCollectionCache } from "@/lib/cache";
import { validateCollectionFieldKeys } from "@/lib/collections-system-fields";
import { ensureCollectionLimit } from "@/lib/demo-limits";
import {
  captureServerError,
  captureServerEvent,
  createAnonymousServerIdentity,
} from "@/lib/posthog";

export async function listCollectionsAction(input?: {
  page?: number;
  limit?: number;
  organizationId?: string;
  projectId?: string;
}) {
  return listCollections(input);
}

export async function createCollectionAction(
  input: Omit<CreateCollectionInput, "projectId"> & { projectId?: string },
) {
  const identity = createAnonymousServerIdentity({
    organizationId: input.organizationId,
    projectId: input.projectId,
  });

  try {
    validateCollectionFieldKeys(input.schema);

    const projectId = input.projectId
      ?? (await getDefaultProject(input.organizationId))?.id;

    if (!projectId) {
      throw new Error("No project found for workspace.");
    }

    await ensureCollectionLimit(projectId);

    const collection = await createCollection({
      ...input,
      projectId,
    });

    await captureServerEvent({
      event: "collection_created",
      identity: createAnonymousServerIdentity({
        organizationId: input.organizationId,
        projectId,
      }),
      properties: {
        schema_fields_count: input.schema.length,
        has_description: Boolean(input.description),
      },
    });

    return collection;
  } catch (error) {
    await captureServerError({
      error,
      identity,
      properties: {
        area: "collections",
        operation: "create",
      },
    });
    throw error;
  }
}

export async function updateCollectionAction(
  id: string,
  input: Partial<CreateCollectionInput> & { slug?: string },
) {
  try {
    if (input.schema) {
      validateCollectionFieldKeys(input.schema);
    }

    const collection = await updateCollection(id, input);

    if (collection?.slug) {
      await invalidateCollectionCache(collection.slug);
    }

    if (collection) {
      await captureServerEvent({
        event: "collection_updated",
        identity: createAnonymousServerIdentity({
          organizationId: collection.organizationId,
          projectId: collection.projectId,
        }),
        properties: {
          schema_updated: Boolean(input.schema),
          slug_updated: input.slug !== undefined,
          description_updated: input.description !== undefined,
        },
      });
    }

    return collection;
  } catch (error) {
    await captureServerError({
      error,
      properties: {
        area: "collections",
        operation: "update",
      },
    });
    throw error;
  }
}

export async function deleteCollectionAction(id: string, slug?: string) {
  try {
    await deleteCollection(id);

    if (slug) {
      await invalidateCollectionCache(slug);
    }

    await captureServerEvent({
      event: "collection_deleted",
      identity: createAnonymousServerIdentity({ subject: id }),
      properties: {
        cache_invalidated: Boolean(slug),
      },
    });
  } catch (error) {
    await captureServerError({
      error,
      identity: createAnonymousServerIdentity({ subject: id }),
      properties: {
        area: "collections",
        operation: "delete",
      },
    });
    throw error;
  }
}

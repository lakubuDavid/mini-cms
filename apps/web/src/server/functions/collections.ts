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
  validateCollectionFieldKeys(input.schema);

  const projectId = input.projectId
    ?? (await getDefaultProject(input.organizationId))?.id;

  if (!projectId) {
    throw new Error("No project found for workspace.");
  }

  await ensureCollectionLimit(projectId);

  return createCollection({
    ...input,
    projectId,
  });
}

export async function updateCollectionAction(
  id: string,
  input: Partial<CreateCollectionInput> & { slug?: string },
) {
  if (input.schema) {
    validateCollectionFieldKeys(input.schema);
  }

  const collection = await updateCollection(id, input);

  if (collection?.slug) {
    await invalidateCollectionCache(collection.slug);
  }

  return collection;
}

export async function deleteCollectionAction(id: string, slug?: string) {
  await deleteCollection(id);

  if (slug) {
    await invalidateCollectionCache(slug);
  }
}

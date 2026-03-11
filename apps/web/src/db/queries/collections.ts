import { and, count, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { collectionItems, collections } from "@/db/schema";
import {
  buildPagination,
  normalizePagination,
  type PaginationInput,
  type PaginatedResult,
} from "./shared";

export type CollectionField = {
  key: string;
  label: string;
  type: "text" | "url" | "number" | "boolean" | "date";
};

export type CreateCollectionInput = {
  organizationId: string;
  projectId: string;
  name: string;
  slug: string;
  description?: string | null;
  schema: CollectionField[];
};

export async function listCollections(
  input?: PaginationInput & { organizationId?: string; projectId?: string },
): Promise<PaginatedResult<typeof collections.$inferSelect>> {
  const { limit, offset, page } = normalizePagination(input);
  const where = input?.organizationId
    ? input.projectId
      ? and(
          eq(collections.organizationId, input.organizationId),
          eq(collections.projectId, input.projectId),
        )
      : eq(collections.organizationId, input.organizationId)
    : input?.projectId
      ? eq(collections.projectId, input.projectId)
      : undefined;

  const [items, totalResult] = await Promise.all([
    db
      .select()
      .from(collections)
      .where(where)
      .orderBy(desc(collections.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(collections).where(where),
  ]);

  const total = totalResult[0]?.value ?? 0;

  return {
    items,
    pagination: buildPagination(page, limit, total),
  };
}

export async function getCollectionBySlug(
  slug: string,
  organizationId?: string,
  projectId?: string,
) {
  return db.query.collections.findFirst({
    where: organizationId
      ? projectId
        ? and(
            eq(collections.slug, slug),
            eq(collections.organizationId, organizationId),
            eq(collections.projectId, projectId),
          )
        : and(
            eq(collections.slug, slug),
            eq(collections.organizationId, organizationId),
          )
      : projectId
        ? and(eq(collections.slug, slug), eq(collections.projectId, projectId))
        : eq(collections.slug, slug),
  });
}

export async function getCollectionById(
  id: string,
  organizationId?: string,
  projectId?: string,
) {
  return db.query.collections.findFirst({
    where: organizationId
      ? projectId
        ? and(
            eq(collections.id, id),
            eq(collections.organizationId, organizationId),
            eq(collections.projectId, projectId),
          )
        : and(
            eq(collections.id, id),
            eq(collections.organizationId, organizationId),
          )
      : projectId
        ? and(eq(collections.id, id), eq(collections.projectId, projectId))
        : eq(collections.id, id),
  });
}

export async function createCollection(input: CreateCollectionInput) {
  const id = nanoid();
  const now = new Date().toISOString();

  await db.insert(collections).values({
    id,
    organizationId: input.organizationId,
    projectId: input.projectId,
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    schema: input.schema,
    createdAt: now,
    updatedAt: now,
  });

  return getCollectionById(id, input.organizationId);
}

export async function updateCollection(
  id: string,
  input: Partial<CreateCollectionInput>,
) {
  await db
    .update(collections)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.schema !== undefined ? { schema: input.schema } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(collections.id, id));

  return getCollectionById(id);
}

export async function deleteCollection(id: string) {
  await db.delete(collections).where(eq(collections.id, id));
}

export async function getCollectionItemCount(collectionId: string) {
  const result = await db
    .select({ value: count() })
    .from(collectionItems)
    .where(and(eq(collectionItems.collectionId, collectionId)));

  return result[0]?.value ?? 0;
}

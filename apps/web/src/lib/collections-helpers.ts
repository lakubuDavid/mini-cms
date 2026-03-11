import { createServerFn } from "@tanstack/react-start";
import type { CollectionField } from "@/db/queries/collections";

export const createCollectionServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      projectId?: string;
      name: string;
      slug: string;
      description?: string;
      schema: CollectionField[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const { requireActiveOrganizationId } = await import("./auth-helpers");
    const { createCollectionAction } =
      await import("../server/functions/collections");
    return createCollectionAction({
      organizationId: await requireActiveOrganizationId(),
      projectId: data.projectId,
      name: data.name,
      slug: data.slug,
      description: data.description,
      schema: data.schema,
    });
  });

export const updateCollectionServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id: string;
      name?: string;
      slug?: string;
      description?: string | null;
      schema?: CollectionField[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const { updateCollectionAction } =
      await import("../server/functions/collections");
    return updateCollectionAction(data.id, {
      name: data.name,
      slug: data.slug,
      description: data.description,
      schema: data.schema,
    });
  });

export const listCollectionsServerFn = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { page?: number; limit?: number; projectId?: string } | undefined) =>
      data,
  )
  .handler(async ({ data }) => {
    const { requireActiveOrganizationId } = await import("./auth-helpers");
    const { listCollections } = await import("../db/queries/collections");
    return listCollections({
      ...data,
      organizationId: await requireActiveOrganizationId(),
    });
  });

export const getCollectionSchemaServerFn = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { requireActiveOrganizationId } = await import("./auth-helpers");
    const { getCollectionBySlug } = await import("../db/queries/collections");
    const collection = await getCollectionBySlug(
      data.slug,
      await requireActiveOrganizationId(),
    );

    if (!collection) {
      throw new Error("Collection not found");
    }

    return { collection };
  });

export const getCollectionPageServerFn = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { slug: string; page?: number; limit?: number }) => data,
  )
  .handler(async ({ data }) => {
    const { requireActiveOrganizationId } = await import("./auth-helpers");
    const [{ getCollectionBySlug }, { listItems }] = await Promise.all([
      import("../db/queries/collections"),
      import("../db/queries/items"),
    ]);

    const collection = await getCollectionBySlug(
      data.slug,
      await requireActiveOrganizationId(),
    );

    if (!collection) {
      throw new Error("Collection not found");
    }

    const items = await listItems(collection.id, {
      page: data.page,
      limit: data.limit,
    });

    return { collection, items };
  });

export const createItemServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      collectionId: string;
      slug: string;
      values: Record<string, string | number | boolean | null>;
      order?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createItemAction } = await import("../server/functions/items");
    return createItemAction(
      data.collectionId,
      data.slug,
      data.values,
      data.order,
    );
  });

export const updateItemServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id: string;
      slug: string;
      values: Record<string, string | number | boolean | null>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { updateItemAction } = await import("../server/functions/items");
    return updateItemAction(data.id, data.slug, data.values);
  });

export const deleteItemServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; slug: string }) => data)
  .handler(async ({ data }) => {
    const { deleteItemAction } = await import("../server/functions/items");
    await deleteItemAction(data.id, data.slug);
    return { success: true };
  });

export const deleteCollectionServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; slug?: string }) => data)
  .handler(async ({ data }) => {
    const { deleteCollectionAction } =
      await import("../server/functions/collections");
    return deleteCollectionAction(data.id, data.slug);
  });

export const getCollectionItemCountsServerFn = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { collectionIds: string[] } | undefined) => data,
  )
  .handler(async ({ data }) => {
    if (!data?.collectionIds?.length) return {};
    const { countItemsByCollectionIds } = await import("../db/queries/items");
    const counts = await countItemsByCollectionIds(data.collectionIds);
    return Object.fromEntries(counts);
  });

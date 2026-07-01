import {
  createItem,
  deleteItem,
  listItems,
  reorderItems,
  updateItem,
  type CollectionItemData,
} from "@/db/queries/items";
import { invalidateCollectionCache } from "@/lib/cache";
import { ensureItemLimit } from "@/lib/demo-limits";
import {
  anonymizeServerValue,
  captureServerError,
  captureServerEvent,
  createAnonymousServerIdentity,
} from "@/lib/posthog";

export async function listItemsAction(
  collectionId: string,
  input?: { page?: number; limit?: number },
) {
  return listItems(collectionId, input);
}

export async function createItemAction(
  collectionId: string,
  slug: string,
  data: CollectionItemData,
  order?: number,
) {
  const identity = createAnonymousServerIdentity({ subject: collectionId });

  try {
    await ensureItemLimit(collectionId);
    const item = await createItem(collectionId, data, { order });
    await invalidateCollectionCache(slug);

    await captureServerEvent({
      event: "item_created",
      identity,
      properties: {
        collection_slug_hash: anonymizeServerValue(slug, "collection"),
        field_count: Object.keys(data).length,
        has_explicit_order: order !== undefined,
      },
    });

    return item;
  } catch (error) {
    await captureServerError({
      error,
      identity,
      properties: {
        area: "items",
        operation: "create",
      },
    });
    throw error;
  }
}

export async function updateItemAction(
  id: string,
  slug: string,
  data: CollectionItemData,
) {
  const identity = createAnonymousServerIdentity({ subject: id });

  try {
    const item = await updateItem(id, data);
    await invalidateCollectionCache(slug);

    await captureServerEvent({
      event: "item_updated",
      identity,
      properties: {
        collection_slug_hash: anonymizeServerValue(slug, "collection"),
        field_count: Object.keys(data).length,
      },
    });

    return item;
  } catch (error) {
    await captureServerError({
      error,
      identity,
      properties: {
        area: "items",
        operation: "update",
      },
    });
    throw error;
  }
}

export async function deleteItemAction(id: string, slug: string) {
  const identity = createAnonymousServerIdentity({ subject: id });

  try {
    await deleteItem(id);
    await invalidateCollectionCache(slug);

    await captureServerEvent({
      event: "item_deleted",
      identity,
      properties: {
        collection_slug_hash: anonymizeServerValue(slug, "collection"),
      },
    });
  } catch (error) {
    await captureServerError({
      error,
      identity,
      properties: {
        area: "items",
        operation: "delete",
      },
    });
    throw error;
  }
}

export async function reorderItemsAction(
  collectionId: string,
  slug: string,
  itemIds: string[],
) {
  const identity = createAnonymousServerIdentity({ subject: collectionId });

  try {
    await reorderItems(collectionId, itemIds);
    await invalidateCollectionCache(slug);

    await captureServerEvent({
      event: "items_reordered",
      identity,
      properties: {
        collection_slug_hash: anonymizeServerValue(slug, "collection"),
        item_count: itemIds.length,
      },
    });
  } catch (error) {
    await captureServerError({
      error,
      identity,
      properties: {
        area: "items",
        operation: "reorder",
      },
    });
    throw error;
  }
}

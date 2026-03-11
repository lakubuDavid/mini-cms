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
  await ensureItemLimit(collectionId);
  const item = await createItem(collectionId, data, order);
  await invalidateCollectionCache(slug);
  return item;
}

export async function updateItemAction(
  id: string,
  slug: string,
  data: CollectionItemData,
) {
  const item = await updateItem(id, data);
  await invalidateCollectionCache(slug);
  return item;
}

export async function deleteItemAction(id: string, slug: string) {
  await deleteItem(id);
  await invalidateCollectionCache(slug);
}

export async function reorderItemsAction(
  collectionId: string,
  slug: string,
  itemIds: string[],
) {
  await reorderItems(collectionId, itemIds);
  await invalidateCollectionCache(slug);
}

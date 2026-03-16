import { readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { readJsonFile, relativeSafe } from "./file-utils";
import type { PullResponse, SyncedCollection } from "./types";

export async function loadCollectionsInput(filePath: string, collectionId?: string) {
  const stats = await stat(filePath).catch(() => null);

  if (!stats) {
    throw new Error(
      `Collections source not found: ${relativeSafe(filePath)}. Run pull first or create mini.collections.json.`,
    );
  }

  const collections = stats.isDirectory()
    ? await loadCollectionsFromDirectory(filePath)
    : await loadCollectionsFromFile(filePath);

  const filtered = collectionId
    ? collections.filter((collection) => collection.id === collectionId)
    : collections;

  if (collectionId && !filtered.length) {
    throw new Error(
      `Collection ${collectionId} was not found in ${relativeSafe(filePath)}.`,
    );
  }

  return filtered;
}

async function loadCollectionsFromDirectory(directoryPath: string) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const allCollections: SyncedCollection[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || extname(entry.name) !== ".json") {
      continue;
    }

    const filePath = join(directoryPath, entry.name);
    const fileCollections = await loadCollectionsFromFile(filePath);
    allCollections.push(...fileCollections);
  }

  return deduplicateCollections(allCollections);
}

function deduplicateCollections(collections: SyncedCollection[]) {
  const bySlug = new Map<string, SyncedCollection>();

  for (const collection of collections) {
    const existing = bySlug.get(collection.slug);

    if (!existing || (!existing.id && collection.id)) {
      bySlug.set(collection.slug, collection);
    }
  }

  return Array.from(bySlug.values());
}

async function loadCollectionsFromFile(filePath: string) {
  const json = await readJsonFile<
    PullResponse | { collections: SyncedCollection[] } | SyncedCollection
  >(filePath);

  if (Array.isArray((json as { collections?: unknown }).collections)) {
    return normalizeCollections(
      (json as PullResponse | { collections: SyncedCollection[] }).collections,
    );
  }

  if (isCollectionShape(json)) {
    return normalizeCollections([json]);
  }

  throw new Error(`Invalid collections file: ${relativeSafe(filePath)}.`);
}

export function normalizeCollections(collections: SyncedCollection[]) {
  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    slug: collection.slug,
    description: collection.description ?? null,
    schema: collection.schema.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
    })),
  }));
}

function isCollectionShape(value: unknown): value is SyncedCollection {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    "name" in value &&
    "slug" in value &&
    "schema" in value &&
    Array.isArray(value.schema)
  );
}

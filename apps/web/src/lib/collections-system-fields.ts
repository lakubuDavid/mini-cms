export const RESERVED_FIELD_PREFIX = "_";
export const RESERVED_FIELD_KEYS = ["_id", "_published"] as const;

export const SYSTEM_COLLECTION_FIELDS = [
  {
    key: "_id",
    label: "ID",
    type: "text" as const,
    readonly: true,
  },
  {
    key: "_published",
    label: "Published",
    type: "boolean" as const,
  },
] as const;

export type CollectionFieldValue = string | number | boolean | null;
export type CollectionItemValues = Record<string, CollectionFieldValue> & {
  _id?: string;
  _published?: boolean;
};

export function isReservedFieldKey(key: string) {
  return RESERVED_FIELD_KEYS.includes(key as (typeof RESERVED_FIELD_KEYS)[number])
    || key.startsWith(RESERVED_FIELD_PREFIX);
}

export function validateCollectionFieldKeys(
  fields: Array<{ key: string; label: string; type: string }>,
) {
  const invalidField = fields.find((field) => isReservedFieldKey(field.key));

  if (invalidField) {
    throw new Error(
      `Field key '${invalidField.key}' is reserved. Keys starting with '_' are reserved for Mini CMS system fields.`,
    );
  }
}

export function toStoredItemValues(
  values: CollectionItemValues,
  fallbackPublished = false,
) {
  const next: CollectionItemValues = {};

  for (const [key, value] of Object.entries(values)) {
    if (key === "_id") {
      continue;
    }

    if (key === "_published") {
      next._published = value === true;
      continue;
    }

    next[key] = value;
  }

  if (typeof next._published !== "boolean") {
    next._published = fallbackPublished;
  }

  return next;
}

export function withSystemItemValues<T extends { id: string; data: CollectionItemValues }>(
  item: T,
) {
  return {
    ...item,
    data: {
      ...item.data,
      _id: item.id,
      _published: item.data._published === true,
    },
  };
}

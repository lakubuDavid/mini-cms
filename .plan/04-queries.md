# Phase 4: Queries

## Checklist

- [x] Create `src/db/queries/collections.ts`
  - [x] getCollectionBySlug
  - [x] listCollections (paginated)
  - [x] createCollection
  - [x] updateCollection
  - [x] deleteCollection

- [x] Create `src/db/queries/items.ts`
  - [x] getItemsByCollectionId (paginated)
  - [x] getItemById
  - [x] createItem
  - [x] updateItem
  - [x] deleteItem
  - [x] reorderItems

- [x] Replace custom user/invite queries with Better Auth native tables and APIs

- [x] Pagination helpers added in `src/db/queries/shared.ts`

## Pagination Response Format

```typescript
{
  items: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
    hasMore: boolean
  }
}
```

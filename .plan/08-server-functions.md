# Phase 8: Server Functions

## Checklist

- [x] Create `src/server/functions/collections.ts`
  - [x] createCollection(input) → Collection
  - [x] updateCollection(id, input) → Collection
  - [x] deleteCollection(id) → void
  - [x] listCollections({ page, limit }) → PaginatedResult

- [x] Create `src/server/functions/items.ts`
  - [x] createItem(collectionId, data) → Item
  - [x] updateItem(id, data) → Item
  - [x] deleteItem(id) → void
  - [x] listItems(collectionId, { page, limit }) → PaginatedResult
  - [x] reorderItems(collectionId, itemIds) → void

- [x] Replace custom invite/user functions with Better Auth server helpers in `src/lib/auth-helpers.ts`

- [x] Auth-protected server helpers added for session, org, users, and invitations

## Auth Protection

- [x] All functions require authenticated session
- [x] Check user role for sensitive operations

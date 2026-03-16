# Phase 9: API Routes

## Checklist

- [x] Create public collection list API route
  - [x] List all collections (paginated)
  - [ ] Apply rate limiting

- [x] Create public collection detail API route
  - [x] Get collection by slug
  - [x] Get items (paginated)
  - [x] Apply caching (60s TTL)
  - [x] Apply rate limiting
  - [x] Invalidate cache on collection/item change

## Response Formats

### GET /api/collections

```json
{
  "items": [
    { "id": "abc", "name": "Projects", "slug": "projects", ... }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 2, ... }
}
```

### GET /api/collections/:slug

```json
{
  "collection": { "id": "abc", "name": "Projects", "slug": "projects", "schema": [...] },
  "items": [
    { "id": "xyz", "data": { "title": "Project A", ... }, "order": 0 }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 5, ... }
}
```

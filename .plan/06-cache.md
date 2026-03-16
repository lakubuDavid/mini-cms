# Phase 6: Cache & Rate-limit (Upstash)

## Checklist

- [x] Create `src/lib/cache.ts`
  - [x] Initialize Upstash Redis client
  - [x] Create cache functions (get, set, delete)
  - [x] Configure cache TTL

- [x] Set up rate limiting
  - [x] Create rate limiter instance
  - [x] Apply to public API routes

## Cache Functions

```typescript
// Get cached data
getCached<T>(key: string): Promise<T | null>

// Set cached data
setCached<T>(key: string, data: T, ttl: number): Promise<void>

// Delete cached data
invalidateCache(key: string): Promise<void>

// Invalidate all collection caches
invalidateCollectionCache(slug: string): Promise<void>
```

## Rate Limiting

- Endpoint: `/api/collections/:slug`
- Limit: 100 requests per minute per IP
- Response: 429 with retry info

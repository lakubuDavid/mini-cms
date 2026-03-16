# Phase 2: Environment Configuration

## Checklist

- [x] Create `.env.example` with all required variables
- [x] Create `src/lib/env.ts` with @t3/env validation
- [x] Verify env validation works

## Environment Variables

```bash
# Database (Turso)
TURSO_DB_URL=libsql://...
TURSO_AUTH_TOKEN=...

# Auth (Better-auth)
AUTH_SECRET=...

# Email (Resend)
RESEND_API_KEY=...

# Cache/Rate-limit (Upstash)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

## Files to Create

### src/lib/env.ts

- Use @t3/env for type-safe env validation
- Define all required variables
- Export typed config object

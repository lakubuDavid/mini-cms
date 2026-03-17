# Phase 2: Environment Configuration

## Checklist

- [x] Create `.env.example` with all required variables
- [x] Create `src/lib/env.ts` with @t3/env validation
- [x] Verify env validation works
- [ ] Add optional `DEMO_MAX_USERS_PER_WORKSPACE`

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

# Demo limits (optional)
DEMO_MAX_USERS_PER_WORKSPACE=5
```

## Files to Create

### src/lib/env.ts

- Use @t3/env for type-safe env validation
- Define all required variables
- Export typed config object
- Support optional demo cap for users + pending invites per workspace

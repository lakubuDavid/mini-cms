# Mini-CMS

A minimalist, self-hosted CMS for development agencies to manage projects and team members.

## Tech Stack

| Component        | Technology                   |
| ---------------- | ---------------------------- |
| Framework        | TanStack Start               |
| Database         | Turso (libSQL) + Drizzle ORM |
| Auth             | Better-auth                  |
| Email            | Resend                       |
| Cache/Rate-limit | Upstash (Redis HTTP)         |
| Build            | Rolldown-vite                |
| Env Validation   | @t3/env                      |

## Project Structure

```
apps/web/src/
├── db/
│   ├── schema/          # Drizzle schema definitions
│   │   ├── collections.ts
│   │   ├── collection-items.ts
│   │   ├── users.ts
│   │   └── invites.ts
│   ├── queries/         # Drizzle query builders
│   │   └── collections.ts
│   └── index.ts         # DB client & config
├── lib/
│   ├── auth.ts         # Better-auth config
│   ├── cache.ts        # Upstash client
│   ├── env.ts          # Env validation (t3env)
│   └── email/
│       ├── index.ts    # Resend client
│       └── templates.ts # Email templates
├── server/functions/   # Server functions (RPC)
│   ├── collections.ts
│   ├── items.ts
│   └── invites.ts
└── routes/
    ├── api.collections.$name.ts  # Public API
    ├── dashboard.tsx              # Protected routes
    └── index.tsx                 # Public homepage
```

## Environment Variables

See `.env.example` for required variables:

```bash
# Database (Turso)
TURSO_DB_URL=
TURSO_AUTH_TOKEN=

# Auth (Better-auth)
AUTH_SECRET=

# Email (Resend)
RESEND_API_KEY=

# Cache/Rate-limit (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Commands

```bash
# Install dependencies
bun install

# Run development
bun run dev

# Build for production
bun run build

# Typecheck
bun run typecheck

# Lint
bun run lint

# Format
bun run format
```

## API Endpoints

### Public (Cached, Rate-limited)

| Method | Path                     | Description                   |
| ------ | ------------------------ | ----------------------------- |
| GET    | `/api/collections`       | List collections (paginated)  |
| GET    | `/api/collections/:slug` | Get collection items (cached) |

### Protected (Server Functions)

| Category    | Functions                    |
| ----------- | ---------------------------- |
| Collections | create, update, delete, list |
| Items       | create, update, delete, list |
| Invites     | create, accept               |
| Users       | list, updateRole             |

## Schema Field Types

| Type      | Editor       | Display                           |
| --------- | ------------ | --------------------------------- |
| `text`    | Text input   | Plain text                        |
| `url`     | URL input    | Thumbnail (hover) + Modal (click) |
| `number`  | Number input | Number                            |
| `boolean` | Toggle       | Checkmark/X                       |

## Caching Strategy

- GET `/api/collections/:slug` cached for 60s via Upstash
- Cache invalidates on any collection/item change
- Rate-limited: 100 requests/minute per IP

## Auth Flow

1. Admin creates invite link → sends email via Resend
2. User clicks link → creates account → gets admin access
3. Sessions managed via better-auth

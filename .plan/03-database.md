# Phase 3: Database Setup (Drizzle + Turso)

## Checklist

- [x] Create `src/db/schema/collections.ts`
- [x] Create `src/db/schema/collection-items.ts`
- [x] Create Better Auth-backed auth schema in `src/db/schema/auth.ts`
- [x] Create `src/db/index.ts` (Drizzle client)
- [x] Create `drizzle.config.ts`
- [x] Test DB connection

## Schema Details

### collections

| Column      | Type    | Description          |
| ----------- | ------- | -------------------- |
| id          | text    | Nano ID              |
| name        | text    | Display name         |
| slug        | text    | URL slug (unique)    |
| description | text    | Optional description |
| schema      | json    | Field definitions    |
| created_at  | integer | Timestamp            |
| updated_at  | integer | Timestamp            |

### collection_items

| Column        | Type    | Description       |
| ------------- | ------- | ----------------- |
| id            | text    | Nano ID           |
| collection_id | text    | FK to collections |
| data          | json    | Item data         |
| order         | integer | Sort order        |
| created_at    | integer | Timestamp         |
| updated_at    | integer | Timestamp         |

### users

| Column     | Type    | Description                |
| ---------- | ------- | -------------------------- |
| id         | text    | Nano ID (from better-auth) |
| name       | text    | User name                  |
| email      | text    | User email                 |
| role       | text    | admin/member               |
| created_at | integer | Timestamp                  |

### invites

| Column     | Type    | Description               |
| ---------- | ------- | ------------------------- |
| id         | text    | Nano ID                   |
| token      | text    | Invite token (unique)     |
| email      | text    | Invitee email             |
| role       | text    | Role to grant             |
| expires_at | integer | Expiration timestamp      |
| used_at    | integer | Used timestamp (nullable) |
| created_by | text    | FK to users               |

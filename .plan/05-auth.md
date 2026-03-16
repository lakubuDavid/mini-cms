# Phase 5: Auth (Better-auth)

## Checklist

- [x] Configure better-auth in `src/lib/auth.ts`
- [x] Set up session management
- [x] Configure email/password authentication
- [x] Create auth middleware for protected routes
- [x] Sync users with database

## Files to Create/Modify

### src/lib/auth.ts

- Initialize better-auth with email/password
- Configure session options
- Export auth instance

### Session User Type

```typescript
interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
}
```

# Phase 5: Auth (Better-auth)

## Checklist

- [x] Configure better-auth in `src/lib/auth.ts`
- [x] Set up session management
- [x] Configure email/password authentication
- [x] Create auth middleware for protected routes
- [x] Sync users with database
- [ ] Separate account signup from workspace creation
- [ ] Add post-auth workspace onboarding for users with no workspace
- [ ] Update invite acceptance to support existing users joining directly
- [ ] Enforce strict invite email matching with no override path
- [ ] Add redirect-aware login/signup flows for invite handoff
- [ ] Enable signup confirmation emails

## Files to Create/Modify

### src/lib/auth.ts

- Initialize better-auth with email/password
- Configure session options
- Export auth instance
- Wire `emailVerification.sendOnSignUp`
- Keep invitation acceptance login-based and email-matched

### src/lib/auth-helpers.ts

- Create workspace helper that creates org + default project
- Enforce invite email match on accept
- Enforce workspace member limits on invite create/accept

### src/routes/invite.$token.tsx

- Signed out: generic invite screen with sign in / create account actions
- Signed in with matching email: one-click join workspace
- Signed in with mismatched email: blocking popup/banner with sign-out options
- Do not reveal invite target email unless the current signed-in user matches

### Session User Type

```typescript
interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
}
```

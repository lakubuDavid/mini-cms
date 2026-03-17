# Phase 11: Cleanup & Final Steps

## Checklist

- [x] Clean up scaffold template pages
  - [x] Remove default TanStack Start starter content
  - [x] Update public homepage (`src/routes/index.tsx`)

- [x] Create .env.example file

- [x] Verify build works
  - [x] Run `bun run build`
  - [x] Check for errors

- [x] Verify typecheck works
  - [x] Run `bun run typecheck`

- [ ] Verify lint works
  - [ ] Run `bun run lint`

- [ ] Verify invite flows
  - [ ] Signed-out invite path
  - [ ] Signed-in matching-email invite path
  - [ ] Signed-in mismatched-email blocking path

- [ ] Verify onboarding flows
  - [ ] Signup without workspace
  - [ ] Login without workspace
  - [ ] Workspace creation after account creation

- [ ] Verify demo limits
  - [ ] `DEMO_MAX_USERS_PER_WORKSPACE` blocks new invites at cap
  - [ ] Invite acceptance is blocked at cap

- [x] Test locally
  - [x] Start dev server
  - [x] Test public API
  - [x] Test dashboard access

## Homepage Content

The homepage should be minimalist, showing:

- Agency name/logo
- Brief description
- Links to portfolio/projects
- Maybe a contact link

## Files to Remove/Modify

- `src/routes/index.tsx` - Replace with minimalist homepage
- Remove any unused scaffold files

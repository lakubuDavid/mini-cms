# Phase 14: Invite Flow Fix — Allow Unauthenticated Users to View & Accept Invites

## Problem

When an unauthenticated user clicks an invite link (`/invite/$token`), the route loader calls `auth.api.getInvitation()` which **requires a session** and immediately throws `401 UNAUTHORIZED` with "Not authenticated". The user never sees the invite page — they get a generic error page instead.

## Root Cause

Better Auth's `/organization/get-invitation` endpoint checks for a session first:
```js
const session = await getSessionFromCtx(ctx);
if (!session) throw APIError.fromStatus("UNAUTHORIZED", { message: "Not authenticated" });
```

## Solution

Query the `invitations` table directly from the database. The invite token is a secret UUID — only the invited person has it (via email), so public lookup is safe. Combine with the existing session check and UI that already handles all three states (no session, session with wrong email, session with matching email).

## Files to Change

| File | Change |
|---|---|
| `apps/web/src/lib/auth-helpers.ts` | Rewrite `getInvitationById` to query DB directly |
| `apps/web/src/routes/invite.$token.tsx` | Add error handling in loader + UI for invalid/expired invites |

## Implementation Steps

### Step 1 — Rewrite `getInvitationById`

- Query `invitations` + `organizations` + `users` tables directly via Drizzle
- Keep session check separate (still need it for `hasSession` / `emailMatchesSession`)
- Return plain invitation data (id, org name, role, email, status, expiresAt)
- No auth required — the invite ID is the auth

### Step 2 — Update route loader to handle errors gracefully

- Catch errors in the loader and return `{ error: "..." }` instead of throwing
- Prevent TanStack Router error boundary from swallowing the page

### Step 3 — Show error states in the UI

- Invalid/expired invite → friendly message with "Go home" link
- Already accepted invite → friendly message

### Step 4 — Keep existing acceptance logic

- The `hasSession && emailMatchesSession` branch already works
- The `hasSession && !emailMatchesSession` branch already works
- The `else` (no session) branch already has sign in / create account UI

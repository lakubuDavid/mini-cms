# Phase 7: Email (Resend)

## Checklist

- [x] Configure Resend client in `src/lib/email/index.ts`
- [x] Create email templates in `src/lib/email/templates.ts`
  - [x] Invite email template

- [x] Better Auth organization invite emails wired through Resend
- [ ] Test email sending

## Files to Create

### src/lib/email/index.ts

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(to: string, subject: string, html: string);
```

### src/lib/email/templates.ts

- Invite email template with acceptance link

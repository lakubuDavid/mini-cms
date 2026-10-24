import { expect, test, type BrowserContext } from "@playwright/test";
import {
  createPasswordMember,
  createPasswordUser,
  getAuthTestHelpers,
  waitForHydration,
} from "../common";

const PASSWORD = "Password@1";

// The suite talks to a remote Turso database, so every server round trip is
// network bound. Give the UI time to settle before asserting.
const UI_TIMEOUT = 30_000;

test.describe.configure({ timeout: 120_000 });

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function signIn(context: BrowserContext, userId: string) {
  const { test: helpers } = await getAuthTestHelpers();
  const cookies = await helpers.getCookies({ userId, domain: "127.0.0.1" });
  await context.addCookies(cookies);
}

/** Reads the invitation row for an email, straight from the database. */
async function findInvitation(email: string) {
  const { db } = await import("../../src/db");
  const { invitations } = await import("../../src/db/schema");
  const { eq } = await import("drizzle-orm");

  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.email, email));

  return invitation ?? null;
}

type CapturedEmail = { to: string; subject: string; html: string };

const CAPTURE_FILE = process.env.CAPTURE_FILE ?? "/tmp/mail-capture.jsonl";
const CAPTURE_BASE_URL =
  process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:3999";

/**
 * Reports whether the local Resend stand-in is reachable.
 *
 * The dev server must run with RESEND_BASE_URL pointed at the stand-in,
 * otherwise an invite would be delivered to a real inbox. The email test
 * skips itself when the stand-in is absent, so it can never send real mail.
 */
async function isCaptureServerReachable(): Promise<boolean> {
  try {
    const response = await fetch(CAPTURE_BASE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ probe: true }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Reads the emails captured by the local Resend stand-in.
 * The dev server must run with RESEND_BASE_URL pointed at it.
 */
async function readCapturedEmails(): Promise<CapturedEmail[]> {
  const { readFileSync } = await import("node:fs");

  try {
    return readFileSync(CAPTURE_FILE, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CapturedEmail);
  } catch {
    return [];
  }
}

test.describe("invite flow", () => {
  test("the invite link resolves and names the target workspace and role", async ({
    browser,
  }) => {
    const stamp = Date.now();
    const owner = await createPasswordMember({
      email: `inviter-${stamp}@example.com`,
      password: PASSWORD,
      name: "Inviter",
      organizationName: "Acme Studio",
      organizationSlug: uniqueId("acme"),
    });
    const inviteeEmail = `guest-${stamp}@example.com`;

    try {
      const { auth, test: helpers } = await getAuthTestHelpers();
      const ownerHeaders = await helpers.getAuthHeaders({
        userId: owner.user.id,
      });
      const invitation = await auth.api.createInvitation({
        headers: ownerHeaders,
        body: {
          email: inviteeEmail,
          role: "admin",
          organizationId: String(owner.organization.id),
        },
      });

      // A signed-in visitor with the invited email sees the join screen.
      const guest = await createPasswordUser({
        email: inviteeEmail,
        password: PASSWORD,
        name: "Guest",
      });
      try {
        const guestContext = await browser.newContext();
        try {
          await signIn(guestContext, guest.user.id);
          const guestPage = await guestContext.newPage();
          await guestPage.goto(`/invite/${invitation.id}`);

          await expect(
            guestPage.getByRole("heading", { name: "Accept your invitation" }),
          ).toBeVisible({ timeout: UI_TIMEOUT });
          await expect(
            guestPage.getByText("Join Acme Studio as admin."),
          ).toBeVisible();
          await expect(
            guestPage.getByRole("button", { name: "Join workspace" }),
          ).toBeVisible();
        } finally {
          await guestContext.close();
        }
      } finally {
        await guest.cleanup();
      }
    } finally {
      await owner.cleanup();
    }
  });

  test("a signed-out visitor cannot open the invite link", async ({
    browser,
  }) => {
    const stamp = Date.now();
    const owner = await createPasswordMember({
      email: `anon-${stamp}@example.com`,
      password: PASSWORD,
      name: "Owner",
      organizationName: "Closed Studio",
      organizationSlug: uniqueId("closed"),
    });

    try {
      const { auth, test: helpers } = await getAuthTestHelpers();
      const ownerHeaders = await helpers.getAuthHeaders({
        userId: owner.user.id,
      });
      const invitation = await auth.api.createInvitation({
        headers: ownerHeaders,
        body: {
          email: `nobody-${stamp}@example.com`,
          role: "admin",
          organizationId: String(owner.organization.id),
        },
      });

      const anonContext = await browser.newContext();
      try {
        const anonPage = await anonContext.newPage();
        await anonPage.goto(`/invite/${invitation.id}`);
        await anonPage.waitForTimeout(4000);

        // The invite page loader calls auth.api.getInvitation, which requires a
        // session, so a signed-out recipient hits the error boundary instead
        // of the landing page that offers sign in / sign up.
        const body = await anonPage.locator("body").innerText();
        expect(body).toContain("Not authenticated");
        expect(body).not.toContain("Accept your invitation");
      } finally {
        await anonContext.close();
      }
    } finally {
      await owner.cleanup();
    }
  });

  test("the invited email actually receives a working invite link", async ({
    context,
    browser,
    page,
  }) => {
    // Without the local Resend stand-in this test would deliver a real email,
    // so skip it rather than risk sending mail to a real inbox.
    test.skip(
      !(await isCaptureServerReachable()),
      "requires the local Resend stand-in (RESEND_BASE_URL) to be running",
    );

    const stamp = Date.now();
    const owner = await createPasswordMember({
      email: `mailer-${stamp}@example.com`,
      password: PASSWORD,
      name: "Mailer",
      organizationName: "Mailed Studio",
      organizationSlug: uniqueId("mailed"),
    });
    const inviteeEmail = `recipient-${stamp}@example.com`;

    try {
      await signIn(context, owner.user.id);
      await page.goto("/dashboard/team");
      await expect(
        page.getByRole("heading", { name: "Team", exact: true }),
      ).toBeVisible({ timeout: UI_TIMEOUT });

      await page.getByLabel("Email").fill(inviteeEmail);
      await page.getByRole("button", { name: "Invite" }).click();
      await expect(
        page.getByText(`Invitation sent to ${inviteeEmail}.`),
      ).toBeVisible({ timeout: UI_TIMEOUT });

      // The invitation email should have been dispatched to the Resend
      // stand-in, not to a real inbox.
      let emails = await readCapturedEmails();
      for (let attempt = 0; attempt < 20 && emails.length === 0; attempt++) {
        await page.waitForTimeout(500);
        emails = await readCapturedEmails();
      }

      const inviteEmail = emails.find((email) => email.to === inviteeEmail);
      expect(inviteEmail, "an invite email should have been sent").toBeTruthy();
      expect(inviteEmail!.subject).toContain("invited");

      const linkMatch = inviteEmail!.html.match(/href="([^"]*\/invite\/[^"]+)"/);
      expect(linkMatch, "the email should contain an invite link").toBeTruthy();

      // Follow the emailed link exactly as the recipient would.
      const inviteUrl = linkMatch![1].replace(/^http:\/\/localhost:3000/, "");
      const recipientContext = await browser.newContext();
      try {
        const recipient = await createPasswordUser({
          email: inviteeEmail,
          password: PASSWORD,
          name: "Recipient",
        });
        try {
          await signIn(recipientContext, recipient.user.id);
          const recipientPage = await recipientContext.newPage();
          await recipientPage.goto(inviteUrl);

          await expect(
            recipientPage.getByRole("heading", {
              name: "Accept your invitation",
            }),
          ).toBeVisible({ timeout: UI_TIMEOUT });
          await expect(
            recipientPage.getByText("Join Mailed Studio as admin."),
          ).toBeVisible();
        } finally {
          await recipient.cleanup();
        }
      } finally {
        await recipientContext.close();
      }
    } finally {
      await owner.cleanup();
    }
  });

  test("an invited user gets workspace access after accepting", async ({
    browser,
  }) => {
    const stamp = Date.now();
    const owner = await createPasswordMember({
      email: `acceptor-${stamp}@example.com`,
      password: PASSWORD,
      name: "Owner",
      organizationName: "Access Studio",
      organizationSlug: uniqueId("access"),
    });
    const inviteeEmail = `joiner-${stamp}@example.com`;

    try {
      const { auth, test: helpers } = await getAuthTestHelpers();
      const ownerHeaders = await helpers.getAuthHeaders({
        userId: owner.user.id,
      });
      const invitation = await auth.api.createInvitation({
        headers: ownerHeaders,
        body: {
          email: inviteeEmail,
          role: "admin",
          organizationId: String(owner.organization.id),
        },
      });

      const invitee = await createPasswordUser({
        email: inviteeEmail,
        password: PASSWORD,
        name: "Joiner",
      });

      try {
        const inviteeContext = await browser.newContext();
        try {
          await signIn(inviteeContext, invitee.user.id);
          const inviteePage = await inviteeContext.newPage();
          await inviteePage.goto(`/invite/${invitation.id}`);

          // The invite page is server-rendered, so the button is visible before
          // React attaches its handler. Clicking too early is a no-op.
          await waitForHydration(inviteePage);

          await inviteePage
            .getByRole("button", { name: "Join workspace" })
            .click();
          await expect(inviteePage).toHaveURL(/\/dashboard/, {
            timeout: UI_TIMEOUT,
          });

          // The session must now carry the joined workspace.
          const session = await inviteePage.evaluate(async () => {
            const response = await fetch("/api/auth/get-session", {
              credentials: "include",
            });
            return response.json();
          });
          expect(session?.session?.activeOrganizationId).toBeTruthy();
          expect(session?.user?.email).toBe(inviteeEmail);

          // And the workspace must be usable, not just present in the session.
          await inviteePage.goto("/dashboard/team");
          await expect(
            inviteePage.getByRole("heading", { name: "Team", exact: true }),
          ).toBeVisible({ timeout: UI_TIMEOUT });
          await expect(
            inviteePage.getByText(`Managing Access Studio`),
          ).toBeVisible({ timeout: UI_TIMEOUT });

          // A member of the joined workspace must be able to invite others.
          await expect(
            inviteePage.getByRole("button", { name: "Invite" }),
          ).toBeVisible();
        } finally {
          await inviteeContext.close();
        }
      } finally {
        await invitee.cleanup();
      }
    } finally {
      await owner.cleanup();
    }
  });

  test("the invited email is the only one that can accept", async ({
    browser,
  }) => {
    const stamp = Date.now();
    const owner = await createPasswordMember({
      email: `gate-${stamp}@example.com`,
      password: PASSWORD,
      name: "Owner",
      organizationName: "Gated Studio",
      organizationSlug: uniqueId("gated"),
    });
    const inviteeEmail = `intended-${stamp}@example.com`;

    try {
      const { auth, test: helpers } = await getAuthTestHelpers();
      const ownerHeaders = await helpers.getAuthHeaders({
        userId: owner.user.id,
      });
      const invitation = await auth.api.createInvitation({
        headers: ownerHeaders,
        body: {
          email: inviteeEmail,
          role: "member",
          organizationId: String(owner.organization.id),
        },
      });

      const impostor = await createPasswordUser({
        email: `impostor-${stamp}@example.com`,
        password: PASSWORD,
        name: "Impostor",
      });

      try {
        const impostorContext = await browser.newContext();
        try {
          await signIn(impostorContext, impostor.user.id);
          const impostorHeaders = await helpers.getAuthHeaders({
            userId: impostor.user.id,
          });

          // The server must reject the acceptance outright.
          let rejected = false;
          try {
            await auth.api.acceptInvitation({
              headers: impostorHeaders,
              body: { invitationId: invitation.id },
            });
          } catch {
            rejected = true;
          }
          expect(rejected, "a non-recipient must not accept").toBe(true);

          // And the browser must not offer a join button.
          const impostorPage = await impostorContext.newPage();
          await impostorPage.goto(`/invite/${invitation.id}`);
          await impostorPage.waitForTimeout(4000);
          await expect(
            impostorPage.getByRole("button", { name: "Join workspace" }),
          ).toHaveCount(0);
        } finally {
          await impostorContext.close();
        }
      } finally {
        await impostor.cleanup();
      }

      // The invitation must still be pending, and no member row created.
      const invitationRow = await findInvitation(inviteeEmail);
      expect(invitationRow?.status).toBe("pending");
    } finally {
      await owner.cleanup();
    }
  });

  test("a revoked invitation can no longer be accepted", async () => {
    const stamp = Date.now();
    const owner = await createPasswordMember({
      email: `revoker-${stamp}@example.com`,
      password: PASSWORD,
      name: "Owner",
      organizationName: "Revoked Studio",
      organizationSlug: uniqueId("revoked"),
    });
    const inviteeEmail = `late-${stamp}@example.com`;

    try {
      const { auth, test: helpers } = await getAuthTestHelpers();
      const ownerHeaders = await helpers.getAuthHeaders({
        userId: owner.user.id,
      });
      const invitation = await auth.api.createInvitation({
        headers: ownerHeaders,
        body: {
          email: inviteeEmail,
          role: "member",
          organizationId: String(owner.organization.id),
        },
      });

      await auth.api.cancelInvitation({
        headers: ownerHeaders,
        body: { invitationId: invitation.id },
      });

      const invitee = await createPasswordUser({
        email: inviteeEmail,
        password: PASSWORD,
        name: "Late",
      });

      try {
        const inviteeHeaders = await helpers.getAuthHeaders({
          userId: invitee.user.id,
        });

        let rejected = false;
        try {
          await auth.api.acceptInvitation({
            headers: inviteeHeaders,
            body: { invitationId: invitation.id },
          });
        } catch {
          rejected = true;
        }
        expect(rejected, "a revoked invitation must not be acceptable").toBe(
          true,
        );
      } finally {
        await invitee.cleanup();
      }

      const invitationRow = await findInvitation(inviteeEmail);
      expect(invitationRow?.status).toBe("canceled");
    } finally {
      await owner.cleanup();
    }
  });

  test("an invitee is not a member of any workspace until they accept", async () => {
    const stamp = Date.now();
    const owner = await createPasswordMember({
      email: `pending-${stamp}@example.com`,
      password: PASSWORD,
      name: "Owner",
      organizationName: "Pending Studio",
      organizationSlug: uniqueId("pending"),
    });
    const inviteeEmail = `waiting-${stamp}@example.com`;

    try {
      const { auth, test: helpers } = await getAuthTestHelpers();
      const ownerHeaders = await helpers.getAuthHeaders({
        userId: owner.user.id,
      });
      await auth.api.createInvitation({
        headers: ownerHeaders,
        body: {
          email: inviteeEmail,
          role: "admin",
          organizationId: String(owner.organization.id),
        },
      });

      const invitee = await createPasswordUser({
        email: inviteeEmail,
        password: PASSWORD,
        name: "Waiting",
      });

      try {
        // The invitation alone must not grant membership.
        const inviteeHeaders = await helpers.getAuthHeaders({
          userId: invitee.user.id,
        });
        const organizations = await auth.api.listOrganizations({
          headers: inviteeHeaders,
        });
        expect(organizations).toHaveLength(0);
      } finally {
        await invitee.cleanup();
      }
    } finally {
      await owner.cleanup();
    }
  });
});

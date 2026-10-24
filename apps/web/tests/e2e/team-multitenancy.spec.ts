import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  addMemberToOrg,
  createOrgForUser,
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

/**
 * Signs a browser context in as `userId` by injecting a better-auth session
 * cookie, the same way the auth test helpers mint sessions.
 */
async function signIn(context: BrowserContext, userId: string) {
  const { test: helpers } = await getAuthTestHelpers();
  const cookies = await helpers.getCookies({ userId, domain: "127.0.0.1" });
  await context.addCookies(cookies);
}

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type Workspace = {
  id: string;
  name: string;
  slug: string;
};

type Fixture = {
  owner: Awaited<ReturnType<typeof createPasswordMember>>;
  workspaceA: Workspace;
  workspaceB: Workspace;
  memberA: Awaited<ReturnType<typeof createPasswordUser>>;
  memberB: Awaited<ReturnType<typeof createPasswordUser>>;
  outsider: Awaited<ReturnType<typeof createPasswordUser>>;
  cleanup: () => Promise<void>;
};

/**
 * Two workspaces owned by the same user, each with one distinct member, plus
 * an unrelated user. Used to prove the roster never crosses a workspace
 * boundary.
 */
async function setupTwoWorkspaces(): Promise<Fixture> {
  const owner = await createPasswordMember({
    email: `${uniqueId("owner")}@example.com`,
    password: PASSWORD,
    name: "Owner User",
    organizationName: "Workspace Alpha",
    organizationSlug: uniqueId("alpha"),
  });

  const workspaceA: Workspace = {
    id: String(owner.organization.id),
    name: String(owner.organization.name),
    slug: String(owner.organization.slug),
  };

  const second = await createOrgForUser(owner.user.id, {
    name: "Workspace Beta",
    slug: uniqueId("beta"),
  });

  const workspaceB: Workspace = {
    id: second.id,
    name: second.name,
    slug: second.slug,
  };

  const memberA = await createPasswordUser({
    email: `${uniqueId("alpha-member")}@example.com`,
    password: PASSWORD,
    name: "Alpha Only",
  });
  await addMemberToOrg(workspaceA.id, memberA.user.id, "member");

  const memberB = await createPasswordUser({
    email: `${uniqueId("beta-member")}@example.com`,
    password: PASSWORD,
    name: "Beta Only",
  });
  await addMemberToOrg(workspaceB.id, memberB.user.id, "member");

  const outsider = await createPasswordUser({
    email: `${uniqueId("outsider")}@example.com`,
    password: PASSWORD,
    name: "Outsider",
  });

  return {
    owner,
    workspaceA,
    workspaceB,
    memberA,
    memberB,
    outsider,
    cleanup: async () => {
      await second.cleanup();
      await owner.cleanup();
      await memberA.cleanup();
      await memberB.cleanup();
      await outsider.cleanup();
    },
  };
}

async function openTeamPage(page: Page) {
  await page.goto("/dashboard/team");
  await expect(
    page.getByRole("heading", { name: "Team", exact: true }),
  ).toBeVisible({ timeout: UI_TIMEOUT });
}

async function membersTable(page: Page) {
  return page.getByRole("table", { name: "Team members" });
}

async function switchWorkspace(page: Page, from: Workspace, to: Workspace) {
  // The footer switcher button and the menu entries both expose the workspace
  // slug in their accessible name, which keeps the two apart reliably.
  await page
    .getByRole("button", { name: new RegExp(from.slug) })
    .first()
    .click();
  await page
    .getByRole("button", { name: new RegExp(to.slug) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/dashboard\/workspace/, {
    timeout: UI_TIMEOUT,
  });
}

test.describe("multi-tenant team", () => {
  test("the roster only lists members of the active workspace", async ({
    context,
    page,
  }) => {
    const fixture = await setupTwoWorkspaces();

    try {
      await signIn(context, fixture.owner.user.id);
      await openTeamPage(page);

      await expect(
        page.getByText(`Managing ${fixture.workspaceA.name}`),
      ).toBeVisible({ timeout: UI_TIMEOUT });

      const table = await membersTable(page);
      await expect(table.getByText("Alpha Only")).toBeVisible({
        timeout: UI_TIMEOUT,
      });
      await expect(table.getByText(fixture.memberA.user.email)).toBeVisible({
        timeout: UI_TIMEOUT,
      });

      // Beta's member must never appear while Alpha is the active workspace.
      await expect(table.getByText("Beta Only")).toHaveCount(0);
      await expect(table.getByText(fixture.memberB.user.email)).toHaveCount(0);
    } finally {
      await fixture.cleanup();
    }
  });

  test("switching workspaces replaces the roster instead of keeping the previous one", async ({
    context,
    page,
  }) => {
    const fixture = await setupTwoWorkspaces();

    try {
      await signIn(context, fixture.owner.user.id);
      await openTeamPage(page);

      const table = await membersTable(page);
      await expect(table.getByText("Alpha Only")).toBeVisible({
        timeout: UI_TIMEOUT,
      });

      await switchWorkspace(page, fixture.workspaceA, fixture.workspaceB);
      await openTeamPage(page);

      await expect(
        page.getByText(`Managing ${fixture.workspaceB.name}`),
      ).toBeVisible({ timeout: UI_TIMEOUT });

      const switchedTable = await membersTable(page);
      await expect(switchedTable.getByText("Beta Only")).toBeVisible({
        timeout: UI_TIMEOUT,
      });
      await expect(switchedTable.getByText("Alpha Only")).toHaveCount(0);
      await expect(
        switchedTable.getByText(fixture.memberA.user.email),
      ).toHaveCount(0);
    } finally {
      await fixture.cleanup();
    }
  });

  test("a user who is not a member cannot read another workspace's roster", async ({
    context,
    page,
  }) => {
    const fixture = await setupTwoWorkspaces();

    try {
      await signIn(context, fixture.outsider.user.id);
      await page.goto("/dashboard/team");

      // No active workspace for the outsider, so the app must not render a roster.
      await expect(
        page.getByText("Alpha Only"),
      ).toHaveCount(0);
      await expect(page.getByText("Beta Only")).toHaveCount(0);
      await expect(
        page.getByRole("table", { name: "Team members" }),
      ).toHaveCount(0);
    } finally {
      await fixture.cleanup();
    }
  });

  test("an admin can invite a teammate and the invite shows up as pending", async ({
    context,
    page,
  }) => {
    const fixture = await setupTwoWorkspaces();
    const inviteeEmail = `${uniqueId("invitee")}@example.com`;

    try {
      await signIn(context, fixture.owner.user.id);
      await openTeamPage(page);

      await page.getByLabel("Email").fill(inviteeEmail);
      await page.getByRole("button", { name: "Invite" }).click();

      await expect(
        page.getByText(`Invitation sent to ${inviteeEmail}.`),
      ).toBeVisible();

      const invitesTable = page.getByRole("table", { name: "Pending invites" });
      await expect(invitesTable.getByText(inviteeEmail)).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });

  test("an invited user can accept the invite and join the roster", async ({
    context,
    browser,
    page,
  }) => {
    const fixture = await setupTwoWorkspaces();
    const inviteeEmail = `${uniqueId("invitee")}@example.com`;

    try {
      await signIn(context, fixture.owner.user.id);
      await openTeamPage(page);

      await page.getByLabel("Email").fill(inviteeEmail);
      await page.getByRole("button", { name: "Invite" }).click();
      await expect(
        page.getByText(`Invitation sent to ${inviteeEmail}.`),
      ).toBeVisible();

      // The invitation id doubles as the invite token used by /invite/$token.
      const { db } = await import("../../src/db");
      const { invitations } = await import("../../src/db/schema");
      const { eq } = await import("drizzle-orm");
      const [invitation] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.email, inviteeEmail));
      expect(invitation, "invitation row should exist").toBeTruthy();

      const inviteeContext = await browser.newContext();
      try {
        const invitee = await createPasswordUser({
          email: inviteeEmail,
          password: PASSWORD,
          name: "Invitee",
        });
        try {
          await signIn(inviteeContext, invitee.user.id);
          const inviteePage = await inviteeContext.newPage();
          await inviteePage.goto(`/invite/${invitation.id}`);
          await waitForHydration(inviteePage);
          await inviteePage
            .getByRole("button", { name: "Join workspace" })
            .click();
          await expect(inviteePage).toHaveURL(/\/dashboard/, {
            timeout: UI_TIMEOUT,
          });

          // The owner's roster must list the new member. This has to run
          // before the invitee is deleted, because removing the user cascades
          // the membership row away.
          await page.reload();
          const table = await membersTable(page);
          await expect(table.getByText(inviteeEmail)).toBeVisible({
            timeout: UI_TIMEOUT,
          });
        } finally {
          await invitee.cleanup();
        }
      } finally {
        await inviteeContext.close();
      }
    } finally {
      await fixture.cleanup();
    }
  });

  test("an admin can change a member role and remove the member", async ({
    context,
    page,
  }) => {
    const fixture = await setupTwoWorkspaces();

    try {
      await signIn(context, fixture.owner.user.id);
      await openTeamPage(page);

      const table = await membersTable(page);
      const memberRow = table.locator("tr", {
        hasText: fixture.memberA.user.email,
      });
      await expect(memberRow).toBeVisible({ timeout: UI_TIMEOUT });

      await memberRow.locator("select").selectOption("reviewer");
      await expect(memberRow.locator("select")).toHaveValue("reviewer", {
        timeout: UI_TIMEOUT,
      });

      page.once("dialog", (dialog) => void dialog.accept());
      await memberRow.getByTitle("Remove from workspace").click();

      await expect(table.getByText(fixture.memberA.user.email)).toHaveCount(0, {
        timeout: UI_TIMEOUT,
      });
    } finally {
      await fixture.cleanup();
    }
  });

  test("a project from another workspace is not readable", async ({
    context,
    page,
  }) => {
    const fixture = await setupTwoWorkspaces();
    const { createProject } = await import("../../src/db/queries/projects");

    try {
      const foreignProject = await createProject({
        organizationId: fixture.workspaceB.id,
        name: "Beta Secret Project",
        slug: uniqueId("beta-secret"),
      });
      expect(foreignProject).toBeTruthy();

      await signIn(context, fixture.owner.user.id);
      await page.goto(
        `/dashboard/projects/${foreignProject!.id}/settings`,
      );

      await expect(page.getByText("Project not found.")).toBeVisible({
        timeout: UI_TIMEOUT,
      });
      await expect(page.getByText("Beta Secret Project")).toHaveCount(0);
    } finally {
      await fixture.cleanup();
    }
  });
});

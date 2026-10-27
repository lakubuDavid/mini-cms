import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  addMemberToOrg,
  createPasswordMember,
  createPasswordUser,
  encodeServerFnArgs,
  getAuthTestHelpers,
  serverFnUrl,
  waitForHydration,
} from "../common";

const PASSWORD = "Password@1";
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

async function callServerFn(
  page: Page,
  file: string,
  exportName: string,
  data: Record<string, string>,
) {
  return page.evaluate(
    async ({ url, body }) => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tsr-serverFn": "true",
          accept: "application/json",
        },
        body,
      });
      return { status: response.status, text: await response.text() };
    },
    { url: serverFnUrl(file, exportName), body: encodeServerFnArgs(data) },
  );
}

test.describe("scoped project access", () => {
  test("owners assign project access and members only see those projects", async ({
    browser,
  }) => {
    const stamp = Date.now();
    const owner = await createPasswordMember({
      email: `access-owner-${stamp}@example.com`,
      password: PASSWORD,
      name: "Access Owner",
      organizationName: "Access Studio",
      organizationSlug: uniqueId("access"),
      role: "owner",
    });
    const member = await createPasswordUser({
      email: `access-member-${stamp}@example.com`,
      password: PASSWORD,
      name: "Access Member",
    });
    const organizationId = String(owner.organization.id);

    await addMemberToOrg(organizationId, member.user.id, "member");

    const { createProject } = await import("../../src/db/queries/projects");
    const { createCollection } = await import(
      "../../src/db/queries/collections"
    );

    const projectA = await createProject({
      organizationId,
      name: `Alpha ${stamp}`,
      slug: uniqueId("alpha"),
    });
    const projectB = await createProject({
      organizationId,
      name: `Beta ${stamp}`,
      slug: uniqueId("beta"),
    });
    expect(projectA).toBeTruthy();
    expect(projectB).toBeTruthy();

    const secret = await createCollection({
      organizationId,
      projectId: projectB!.id,
      name: "Secret B",
      slug: uniqueId("secret-b"),
      description: null,
      schema: [{ key: "title", label: "Title", type: "text" }],
    });
    expect(secret).toBeTruthy();

    try {
      const ownerContext = await browser.newContext();
      try {
        await signIn(ownerContext, owner.user.id);
        const ownerPage = await ownerContext.newPage();
        await ownerPage.goto("/dashboard/team");
        await expect(
          ownerPage.getByRole("heading", { name: "Team", exact: true }),
        ).toBeVisible({ timeout: UI_TIMEOUT });

        const membersTable = ownerPage.getByRole("table", {
          name: "Team members",
        });
        const memberRow = membersTable.locator("tr", {
          hasText: member.user.email,
        });
        await expect(memberRow).toBeVisible({ timeout: UI_TIMEOUT });
        await expect(memberRow.getByText("No projects")).toBeVisible({
          timeout: UI_TIMEOUT,
        });

        await memberRow.getByRole("button", { name: "Manage" }).click();
        const dialog = ownerPage.getByRole("dialog", {
          name: /Project access/,
        });
        await expect(dialog).toBeVisible();
        await dialog.getByLabel(projectA!.name).check();
        await dialog.getByRole("button", { name: "Save" }).click();
        await expect(dialog).toBeHidden({ timeout: UI_TIMEOUT });
        await expect(memberRow.getByText("1 project")).toBeVisible({
          timeout: UI_TIMEOUT,
        });
      } finally {
        await ownerContext.close();
      }

      const memberContext = await browser.newContext();
      try {
        await signIn(memberContext, member.user.id);
        const memberPage = await memberContext.newPage();
        await memberPage.goto("/dashboard");
        await waitForHydration(memberPage);

        const projectSelect = memberPage.locator("select").first();
        await expect(projectSelect).toHaveValue(projectA!.id, {
          timeout: UI_TIMEOUT,
        });
        await expect(projectSelect.locator("option")).toHaveCount(1);

        await memberPage.goto("/dashboard/projects");
        const projectsTable = memberPage.getByRole("table", {
          name: "Projects",
        });
        await expect(projectsTable.getByText(projectA!.name)).toBeVisible({
          timeout: UI_TIMEOUT,
        });
        await expect(projectsTable.getByText(projectB!.name)).toHaveCount(0);
        await expect(
          memberPage.getByRole("button", { name: "New project" }),
        ).toHaveCount(0);

        await memberPage.goto(
          `/dashboard/projects/${projectB!.id}/settings`,
        );
        await expect(memberPage).toHaveURL(/\/dashboard\/projects/, {
          timeout: UI_TIMEOUT,
        });
        await expect(memberPage.getByText(projectB!.name)).toHaveCount(0);

        await expect(
          memberPage.getByRole("link", { name: "Team" }),
        ).toHaveCount(0);
        await expect(
          memberPage.getByRole("link", { name: "API Keys" }),
        ).toHaveCount(0);

        await memberPage.goto("/dashboard/team");
        await expect(memberPage).not.toHaveURL(/\/dashboard\/team/, {
          timeout: UI_TIMEOUT,
        });
        await expect(
          memberPage.getByRole("heading", { name: "Team", exact: true }),
        ).toHaveCount(0);

        await memberPage.goto("/dashboard/api-keys");
        await expect(memberPage).not.toHaveURL(/\/dashboard\/api-keys/, {
          timeout: UI_TIMEOUT,
        });

        await memberPage.goto("/dashboard");
        await waitForHydration(memberPage);
        const result = await callServerFn(
          memberPage,
          "/src/lib/collections-helpers.ts",
          "updateCollectionServerFn_createServerFn_handler",
          { id: secret!.id, name: "Pwned" },
        );
        expect(result.status).not.toBe(200);

        const { db } = await import("../../src/db");
        const { collections } = await import("../../src/db/schema");
        const { eq } = await import("drizzle-orm");
        const [row] = await db
          .select()
          .from(collections)
          .where(eq(collections.id, secret!.id));
        expect(row?.name).toBe("Secret B");
      } finally {
        await memberContext.close();
      }
    } finally {
      await member.cleanup();
      await owner.cleanup();
    }
  });
});

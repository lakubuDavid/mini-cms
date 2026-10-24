import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  createOrgForUser,
  createPasswordMember,
  createPasswordUser,
  encodeServerFnArgs,
  getAuthTestHelpers,
  serverFnUrl,
} from "../common";

const PASSWORD = "Password@1";

test.describe.configure({ timeout: 120_000 });

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function signIn(context: BrowserContext, userId: string) {
  const { test: helpers } = await getAuthTestHelpers();
  const cookies = await helpers.getCookies({ userId, domain: "127.0.0.1" });
  await context.addCookies(cookies);
}

/**
 * Calls a server function from a browser page, exactly the way the client
 * does, and returns the raw response.
 */
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

const COLLECTIONS_HELPERS = "/src/lib/collections-helpers.ts";
const ENVIRONMENT_HELPERS = "/src/lib/environment-helpers.ts";

/**
 * Tenant isolation must hold for every server function that mutates
 * collection data.
 *
 * The `test.fail` cases are the ones that currently fail. The mutation
 * helpers in `src/server/functions` and `src/db/queries` resolve rows by
 * primary key alone and never compare the row's `organizationId` with the
 * caller's active workspace, so a caller can write to another tenant's data.
 * Remove the `test.fail` marker once the scoping is implemented.
 */
test.describe("tenant isolation", () => {
  test("a collection in another workspace cannot be updated", async ({
    browser,
  }) => {
    const stamp = Date.now();
    const victim = await createPasswordMember({
      email: `victim-${stamp}@example.com`,
      password: PASSWORD,
      name: "Victim",
      organizationName: "Victim Studio",
      organizationSlug: uniqueId("victim"),
    });
    const attacker = await createPasswordUser({
      email: `attacker-${stamp}@example.com`,
      password: PASSWORD,
      name: "Attacker",
    });
    const attackerWorkspace = await createOrgForUser(attacker.user.id, {
      name: "Attacker Studio",
      slug: uniqueId("attacker"),
    });

    try {
      const { createProject } = await import("../../src/db/queries/projects");
      const { createCollection } = await import(
        "../../src/db/queries/collections"
      );

      const victimProject = await createProject({
        organizationId: String(victim.organization.id),
        name: "Victim Project",
        slug: uniqueId("vp"),
      });
      const victimCollection = await createCollection({
        organizationId: String(victim.organization.id),
        projectId: victimProject!.id,
        name: "Victim Secret",
        slug: "victim-secret",
        description: "Do not touch",
        schema: [{ key: "title", label: "Title", type: "text" }],
      });
      expect(victimCollection).toBeTruthy();

      // The attacker is signed in with their own workspace active.
      const attackerContext = await browser.newContext();
      try {
        await signIn(attackerContext, attacker.user.id);
        const attackerPage = await attackerContext.newPage();
        await attackerPage.goto("/dashboard");
        await attackerPage.waitForTimeout(2000);

        const result = await callServerFn(
          attackerPage,
          COLLECTIONS_HELPERS,
          "updateCollectionServerFn_createServerFn_handler",
          { id: victimCollection!.id, name: "PWNED" },
        );
        expect(result.status).toBe(200);

        const { db } = await import("../../src/db");
        const { collections } = await import("../../src/db/schema");
        const { eq } = await import("drizzle-orm");
        const [row] = await db
          .select()
          .from(collections)
          .where(eq(collections.id, victimCollection!.id));
        expect(row?.name, "the collection must not be renamed").toBe(
          "Victim Secret",
        );
      } finally {
        await attackerContext.close();
      }
    } finally {
      await attackerWorkspace.cleanup();
      await attacker.cleanup();
      await victim.cleanup();
    }
  });

  test("an item in another workspace cannot be updated", async ({
    browser,
  }) => {
    const stamp = Date.now();
    const victim = await createPasswordMember({
      email: `item-victim-${stamp}@example.com`,
      password: PASSWORD,
      name: "Victim",
      organizationName: "Item Studio",
      organizationSlug: uniqueId("item"),
    });
    const attacker = await createPasswordUser({
      email: `item-attacker-${stamp}@example.com`,
      password: PASSWORD,
      name: "Attacker",
    });
    const attackerWorkspace = await createOrgForUser(attacker.user.id, {
      name: "Attacker Items",
      slug: uniqueId("attacker-items"),
    });

    try {
      const { createProject } = await import("../../src/db/queries/projects");
      const { createCollection } = await import(
        "../../src/db/queries/collections"
      );
      const { createItem } = await import("../../src/db/queries/items");

      const victimProject = await createProject({
        organizationId: String(victim.organization.id),
        name: "Victim Project",
        slug: uniqueId("ip"),
      });
      const victimCollection = await createCollection({
        organizationId: String(victim.organization.id),
        projectId: victimProject!.id,
        name: "Victim Items",
        slug: "victim-items",
        schema: [{ key: "title", label: "Title", type: "text" }],
      });
      const victimItem = await createItem(victimCollection!.id, {
        title: "Sensitive",
      });
      expect(victimItem).toBeTruthy();

      const attackerContext = await browser.newContext();
      try {
        await signIn(attackerContext, attacker.user.id);
        const attackerPage = await attackerContext.newPage();
        await attackerPage.goto("/dashboard");
        await attackerPage.waitForTimeout(2000);

        const result = await callServerFn(
          attackerPage,
          COLLECTIONS_HELPERS,
          "updateItemServerFn_createServerFn_handler",
          {
            id: victimItem!.id,
            slug: "victim-items",
            values: JSON.stringify({ title: "PWNED" }),
          },
        );
        expect(result.status).toBe(200);

        const { db } = await import("../../src/db");
        const { collectionItems } = await import("../../src/db/schema");
        const { eq } = await import("drizzle-orm");
        const [row] = await db
          .select()
          .from(collectionItems)
          .where(eq(collectionItems.id, victimItem!.id));
        expect(row?.data?.title, "the item must not be modified").toBe(
          "Sensitive",
        );
      } finally {
        await attackerContext.close();
      }
    } finally {
      await attackerWorkspace.cleanup();
      await attacker.cleanup();
      await victim.cleanup();
    }
  });

  test("a collection in another workspace cannot be deleted", async ({
    browser,
  }) => {
    const stamp = Date.now();
    const victim = await createPasswordMember({
      email: `del-victim-${stamp}@example.com`,
      password: PASSWORD,
      name: "Victim",
      organizationName: "Delete Studio",
      organizationSlug: uniqueId("del"),
    });
    const attacker = await createPasswordUser({
      email: `del-attacker-${stamp}@example.com`,
      password: PASSWORD,
      name: "Attacker",
    });
    const attackerWorkspace = await createOrgForUser(attacker.user.id, {
      name: "Attacker Deletes",
      slug: uniqueId("attacker-del"),
    });

    try {
      const { createProject } = await import("../../src/db/queries/projects");
      const { createCollection } = await import(
        "../../src/db/queries/collections"
      );

      const victimProject = await createProject({
        organizationId: String(victim.organization.id),
        name: "Victim Project",
        slug: uniqueId("dp"),
      });
      const victimCollection = await createCollection({
        organizationId: String(victim.organization.id),
        projectId: victimProject!.id,
        name: "Victim Secret",
        slug: "victim-secret",
        schema: [{ key: "title", label: "Title", type: "text" }],
      });
      expect(victimCollection).toBeTruthy();

      const attackerContext = await browser.newContext();
      try {
        await signIn(attackerContext, attacker.user.id);
        const attackerPage = await attackerContext.newPage();
        await attackerPage.goto("/dashboard");
        await attackerPage.waitForTimeout(2000);

        const result = await callServerFn(
          attackerPage,
          COLLECTIONS_HELPERS,
          "deleteCollectionServerFn_createServerFn_handler",
          { id: victimCollection!.id, slug: "victim-secret" },
        );
        expect(result.status).toBe(200);

        const { db } = await import("../../src/db");
        const { collections } = await import("../../src/db/schema");
        const { eq } = await import("drizzle-orm");
        const [row] = await db
          .select()
          .from(collections)
          .where(eq(collections.id, victimCollection!.id));
        expect(row, "the collection must still exist").toBeTruthy();
      } finally {
        await attackerContext.close();
      }
    } finally {
      await attackerWorkspace.cleanup();
      await attacker.cleanup();
      await victim.cleanup();
    }
  });

  test("an environment in another workspace cannot be mutated", async ({
    browser,
  }) => {
    const stamp = Date.now();
    const victim = await createPasswordMember({
      email: `env-victim-${stamp}@example.com`,
      password: PASSWORD,
      name: "Victim",
      organizationName: "Env Studio",
      organizationSlug: uniqueId("env"),
    });
    const attacker = await createPasswordUser({
      email: `env-attacker-${stamp}@example.com`,
      password: PASSWORD,
      name: "Attacker",
    });
    const attackerWorkspace = await createOrgForUser(attacker.user.id, {
      name: "Attacker Envs",
      slug: uniqueId("attacker-env"),
    });

    try {
      const { createProject } = await import("../../src/db/queries/projects");
      const { listEnvironments } = await import(
        "../../src/db/queries/environments"
      );

      const victimProject = await createProject({
        organizationId: String(victim.organization.id),
        name: "Victim Project",
        slug: uniqueId("ep"),
      });
      const environments = await listEnvironments(victimProject!.id);
      expect(environments.length).toBeGreaterThan(0);
      const originalName = environments[0].name;

      const attackerContext = await browser.newContext();
      try {
        await signIn(attackerContext, attacker.user.id);
        const attackerPage = await attackerContext.newPage();
        await attackerPage.goto("/dashboard");
        await attackerPage.waitForTimeout(2000);

        const result = await callServerFn(
          attackerPage,
          ENVIRONMENT_HELPERS,
          "updateEnvironmentServerFn_createServerFn_handler",
          { id: environments[0].id, name: "PWNED" },
        );
        expect(result.status).toBe(200);

        const { getEnvironmentById } = await import(
          "../../src/db/queries/environments"
        );
        const env = await getEnvironmentById(environments[0].id);
        expect(env?.name, "the environment must not be renamed").toBe(
          originalName,
        );
      } finally {
        await attackerContext.close();
      }
    } finally {
      await attackerWorkspace.cleanup();
      await attacker.cleanup();
      await victim.cleanup();
    }
  });

  test("a collection in another workspace is not listed", async () => {
    const stamp = Date.now();
    const victim = await createPasswordMember({
      email: `list-victim-${stamp}@example.com`,
      password: PASSWORD,
      name: "Victim",
      organizationName: "List Studio",
      organizationSlug: uniqueId("list"),
    });

    try {
      const { createProject } = await import("../../src/db/queries/projects");
      const { createCollection, listCollections } = await import(
        "../../src/db/queries/collections"
      );

      const victimProject = await createProject({
        organizationId: String(victim.organization.id),
        name: "Victim Project",
        slug: uniqueId("lp"),
      });
      await createCollection({
        organizationId: String(victim.organization.id),
        projectId: victimProject!.id,
        name: "Victim Secret",
        slug: "victim-secret",
        schema: [{ key: "title", label: "Title", type: "text" }],
      });

      // Listing is scoped by organisation, so a different workspace never
      // returns the victim's collection.
      const otherWorkspace = await listCollections({
        organizationId: "a-workspace-that-does-not-exist",
      });
      expect(otherWorkspace.items).toHaveLength(0);

      const ownWorkspace = await listCollections({
        organizationId: String(victim.organization.id),
      });
      expect(ownWorkspace.items).toHaveLength(1);
    } finally {
      await victim.cleanup();
    }
  });

  test("a project from another workspace is not readable", async () => {
    const stamp = Date.now();
    const victim = await createPasswordMember({
      email: `proj-victim-${stamp}@example.com`,
      password: PASSWORD,
      name: "Victim",
      organizationName: "Project Studio",
      organizationSlug: uniqueId("proj"),
    });
    const attacker = await createPasswordUser({
      email: `proj-attacker-${stamp}@example.com`,
      password: PASSWORD,
      name: "Attacker",
    });

    try {
      const { createProject, getProjectById } = await import(
        "../../src/db/queries/projects"
      );

      const victimProject = await createProject({
        organizationId: String(victim.organization.id),
        name: "Secret Project",
        slug: uniqueId("secret"),
      });
      expect(victimProject).toBeTruthy();

      // Reading through the query layer is scoped: the organisation id must
      // match, so a project from another workspace is not returned.
      const crossRead = await getProjectById(
        victimProject!.id,
        "a-workspace-that-does-not-exist",
      );
      expect(crossRead).toBeFalsy();

      const sameWorkspaceRead = await getProjectById(
        victimProject!.id,
        String(victim.organization.id),
      );
      expect(sameWorkspaceRead).toBeTruthy();
    } finally {
      await attacker.cleanup();
      await victim.cleanup();
    }
  });
});

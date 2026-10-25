import { afterEach, describe, expect, mock, test } from "bun:test";

type QueryResult = unknown[];

const results: QueryResult[] = [];

function nextResult(): QueryResult {
  return results.shift() ?? [];
}

function queryBuilder() {
  const result = nextResult();
  const builder = {
    from: () => builder,
    where: () => builder,
    limit: () => Promise.resolve(result),
    // oxlint-disable-next-line unicorn/no-thenable
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };

  return builder;
}

mock.module("@/db", () => ({
  db: {
    select: () => queryBuilder(),
  },
}));

mock.module("@/lib/auth-helpers", () => ({
  ensureActiveOrganization: async () => ({
    organizationId: "org_1",
    userId: "user_1",
  }),
}));

describe("resolveProjectAccess", () => {
  afterEach(() => {
    results.length = 0;
  });

  test("owners and admins see every project", async () => {
    results.push([{ id: "member_1", role: "admin" }]);
    const { resolveProjectAccess } = await import(
      "../../src/lib/project-access"
    );

    await expect(resolveProjectAccess("org_1", "user_1")).resolves.toEqual({
      all: true,
      projectIds: [],
    });
  });

  test("combined owner roles still grant full access", async () => {
    results.push([{ id: "member_1", role: "member,owner" }]);
    const { resolveProjectAccess } = await import(
      "../../src/lib/project-access"
    );

    await expect(resolveProjectAccess("org_1", "user_1")).resolves.toEqual({
      all: true,
      projectIds: [],
    });
  });

  test("members only see assigned projects", async () => {
    results.push(
      [{ id: "member_1", role: "member" }],
      [{ projectId: "project_1" }, { projectId: "project_2" }],
    );
    const { resolveProjectAccess } = await import(
      "../../src/lib/project-access"
    );

    await expect(resolveProjectAccess("org_1", "user_1")).resolves.toEqual({
      all: false,
      projectIds: ["project_1", "project_2"],
    });
  });

  test("members with no assignments see no projects", async () => {
    results.push([{ id: "member_1", role: "reviewer" }], []);
    const { resolveProjectAccess } = await import(
      "../../src/lib/project-access"
    );

    await expect(resolveProjectAccess("org_1", "user_1")).resolves.toEqual({
      all: false,
      projectIds: [],
    });
  });

  test("users outside the workspace are rejected", async () => {
    results.push([]);
    const { resolveProjectAccess } = await import(
      "../../src/lib/project-access"
    );

    await expect(resolveProjectAccess("org_1", "user_1")).rejects.toThrow(
      "Not a member of this organization",
    );
  });

  test("members can access assigned projects", async () => {
    results.push(
      [{ id: "member_1", role: "member" }],
      [{ projectId: "project_1" }],
    );
    const { requireProjectAccess } = await import(
      "../../src/lib/project-access"
    );

    await expect(
      requireProjectAccess(undefined, "project_1"),
    ).resolves.toBeUndefined();
  });

  test("members cannot access unassigned projects", async () => {
    results.push(
      [{ id: "member_1", role: "member" }],
      [{ projectId: "project_1" }],
    );
    const { requireProjectAccess } = await import(
      "../../src/lib/project-access"
    );

    await expect(
      requireProjectAccess(undefined, "project_2"),
    ).rejects.toThrow("Forbidden: no access to this project");
  });

  test("members cannot manage projects", async () => {
    results.push(
      [{ id: "member_1", role: "member" }],
      [{ projectId: "project_1" }],
    );
    const { requireProjectManager } = await import(
      "../../src/lib/project-access"
    );

    await expect(requireProjectManager(undefined)).rejects.toThrow(
      "Forbidden: project management requires owner or admin",
    );
  });

  test("owners can manage projects", async () => {
    results.push([{ id: "member_1", role: "owner" }]);
    const { requireProjectManager } = await import(
      "../../src/lib/project-access"
    );

    await expect(requireProjectManager(undefined)).resolves.toBeUndefined();
  });
});

import { afterEach, describe, expect, test } from "bun:test";
import { createTestMember, getAuthTestHelpers } from "../common";

describe("auth helpers with better-auth test utils", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length) {
      const cleanup = cleanups.pop();
      if (cleanup) {
        await cleanup();
      }
    }
  });

  test("test utils create authenticated headers for saved users", async () => {
    const { auth, test } = await getAuthTestHelpers();
    const user = test.createUser({
      email: `headers-${Date.now()}@example.com`,
      name: "Headers User",
      emailVerified: true,
    });
    const savedUser = await test.saveUser(user);
    cleanups.push(() => test.deleteUser(savedUser.id));

    const headers = await test.getAuthHeaders({ userId: savedUser.id });
    const session = await auth.api.getSession({ headers });

    expect(session?.user.id).toBe(savedUser.id);
    expect(session?.user.email).toBe(savedUser.email);
  });

  test("test utils can create cookies for browser sessions", async () => {
    const { test } = await getAuthTestHelpers();
    const user = test.createUser({
      email: `cookies-${Date.now()}@example.com`,
      name: "Cookie User",
      emailVerified: true,
    });
    const savedUser = await test.saveUser(user);
    cleanups.push(() => test.deleteUser(savedUser.id));

    const cookies = await test.getCookies({
      userId: savedUser.id,
      domain: "127.0.0.1",
    });

    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies[0]).toHaveProperty("name");
    expect(cookies[0]).toHaveProperty("value");
  });

  test("organization test helpers create a member workspace fixture", async () => {
    const member = await createTestMember({
      email: `member-${Date.now()}@example.com`,
      organizationSlug: `workspace-${Date.now()}`,
    });
    cleanups.push(member.cleanup);

    expect(member.user.email).toContain("member-");
    expect(String(member.organization.slug)).toContain("workspace-");
  });
});

import type { TestHelpers } from "better-auth/plugins";
import type { Page } from "@playwright/test";

process.env.ENABLE_TEST_UTILS = "true";
process.env.APP_URL ??= "http://127.0.0.1:3000";

export async function getAuthTestHelpers() {
  const { auth } = await import("../src/lib/auth-cli");
  const ctx = await auth.$context;
  return { auth, test: ctx.test as TestHelpers };
}

export async function createTestMember(input?: {
  email?: string;
  name?: string;
  organizationName?: string;
  organizationSlug?: string;
  role?: string;
}) {
  const { test } = await getAuthTestHelpers();
  const user = test.createUser({
    email: input?.email ?? `test-${Date.now()}@example.com`,
    name: input?.name ?? "Test User",
    emailVerified: true,
  });
  const savedUser = await test.saveUser(user);

  const org = test.createOrganization?.({
    name: input?.organizationName ?? "Test Workspace",
    slug: input?.organizationSlug ?? `test-workspace-${Date.now()}`,
  });

  if (!org || !test.saveOrganization || !test.addMember) {
    throw new Error("Better Auth test organization helpers are unavailable.");
  }

  const savedOrg = await test.saveOrganization(org);
  await test.addMember({
    userId: savedUser.id,
    organizationId: String(savedOrg.id),
    role: input?.role ?? "admin",
  });

  return {
    test,
    user: savedUser,
    organization: savedOrg,
    cleanup: async () => {
      await test.deleteOrganization?.(String(savedOrg.id));
      await test.deleteUser(savedUser.id);
    },
  };
}

export async function createPasswordMember(input: {
  email: string;
  password: string;
  name?: string;
  organizationName?: string;
  organizationSlug?: string;
  role?: string;
}) {
  const member = await createTestMember(input);
  const { auth, test } = await getAuthTestHelpers();
  const headers = await test.getAuthHeaders({ userId: member.user.id });

  await auth.api.setPassword({
    headers,
    body: {
      newPassword: input.password,
    },
  });

  return member;
}

/**
 * A user with no organization attached. Use `addMemberToOrg` to place it in a
 * workspace, so a test can assert on cross-workspace isolation without the
 * user owning a workspace of their own.
 */
export async function createPasswordUser(input: {
  email: string;
  password: string;
  name?: string;
}) {
  const { auth, test } = await getAuthTestHelpers();
  const user = test.createUser({
    email: input.email,
    name: input.name ?? "Test User",
    emailVerified: true,
  });
  const savedUser = await test.saveUser(user);
  const headers = await test.getAuthHeaders({ userId: savedUser.id });

  await auth.api.setPassword({
    headers,
    body: {
      newPassword: input.password,
    },
  });

  return {
    test,
    user: savedUser,
    cleanup: async () => {
      await test.deleteUser(savedUser.id);
    },
  };
}

/** Adds a second workspace to an existing user, so workspace switching can be tested. */
export async function createOrgForUser(
  userId: string,
  input: { name: string; slug: string; role?: string },
) {
  const { test } = await getAuthTestHelpers();
  const org = test.createOrganization?.({
    name: input.name,
    slug: input.slug,
  });

  if (!org || !test.saveOrganization || !test.addMember) {
    throw new Error("Better Auth test organization helpers are unavailable.");
  }

  const savedOrg = await test.saveOrganization(org);
  await test.addMember({
    userId,
    organizationId: String(savedOrg.id),
    role: input.role ?? "admin",
  });

  return {
    id: String(savedOrg.id),
    name: String(savedOrg.name),
    slug: String(savedOrg.slug),
    cleanup: async () => {
      await test.deleteOrganization?.(String(savedOrg.id));
    },
  };
}

export async function addMemberToOrg(
  organizationId: string,
  userId: string,
  role = "member",
) {
  const { test } = await getAuthTestHelpers();
  if (!test.addMember) {
    throw new Error("Better Auth test member helpers are unavailable.");
  }

  await test.addMember({
    userId,
    organizationId,
    role,
  });
}

export function makeJsonRequest(
  url: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown },
) {
  const { body: inputBody, ...rest } = init ?? {};
  const body = inputBody !== undefined ? JSON.stringify(inputBody) : undefined;

  return new Request(url, {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...rest.headers,
    },
    ...(body !== undefined ? { body } : {}),
  });
}

/**
 * Calls a TanStack server function over HTTP, the same way the browser does.
 *
 * The server function id is the base64 of `{ file, export }`, where `file`
 * is the source module and `export` is the generated handler name.
 */
export function serverFnUrl(file: string, exportName: string) {
  const payload = JSON.stringify({
    file: `${file}?tss-serverfn-split`,
    export: exportName,
  });
  return `/_serverFn/${Buffer.from(payload).toString("base64url")}`;
}

/**
 * Serialises a server function argument the way the client does, so a call
 * can be replayed from a browser context. Values must be strings.
 */
export function encodeServerFnArgs(data: Record<string, string>) {
  return JSON.stringify({
    t: {
      t: 10,
      i: 0,
      p: {
        k: ["data"],
        v: [
          {
            t: 10,
            i: 1,
            p: {
              k: Object.keys(data),
              v: Object.values(data).map((value) => ({ t: 1, s: value })),
            },
            o: 0,
          },
        ],
        o: 0,
      },
    },
    f: 63,
    m: [],
  });
}

/**
 * Waits until React has hydrated the document.
 *
 * Server-rendered markup is interactive only after hydration, so a click
 * issued too early is silently dropped: the element exists and looks
 * clickable, but no event handler is attached yet.
 */
export async function waitForHydration(page: Page, timeout = 30_000) {
  await page.waitForFunction(
    () =>
      Object.keys(document.documentElement).some((key) =>
        key.startsWith("__reactFiber$"),
      ),
    undefined,
    { timeout },
  );
}

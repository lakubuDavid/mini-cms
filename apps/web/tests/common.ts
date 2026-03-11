import type { TestHelpers } from "better-auth/plugins";

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

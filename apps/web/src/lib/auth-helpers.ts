import { createServerFn } from "@tanstack/react-start";

async function getHeaders() {
  const { getRequestHeaders } = await import("@tanstack/react-start/server");
  return getRequestHeaders();
}

function toPlainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function ensureActiveOrganization() {
  const { auth } = await import("./auth");
  const headers = await getHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session) {
    throw new Error("Unauthorized");
  }

  if (session.session.activeOrganizationId) {
    return {
      auth,
      headers,
      organizationId: session.session.activeOrganizationId,
    };
  }

  const organizations = await auth.api.listOrganizations({ headers });
  const fallbackOrganization = organizations[0];

  if (!fallbackOrganization) {
    return {
      auth,
      headers,
      organizationId: null,
    };
  }

  await auth.api.setActiveOrganization({
    headers,
    body: {
      organizationId: fallbackOrganization.id,
    },
  });

  return {
    auth,
    headers,
    organizationId: fallbackOrganization.id,
  };
}

export const listOrganizations = createServerFn({ method: "GET" }).handler(
  async () => {
    const { auth } = await import("./auth");
    const headers = await getHeaders();
    return auth.api.listOrganizations({ headers });
  },
);

export const getActiveOrganization = createServerFn({ method: "GET" }).handler(
  async () => {
    const { auth, headers, organizationId } = await ensureActiveOrganization();

    if (!organizationId) {
      return null;
    }

    return auth.api.getFullOrganization({
      headers,
      query: {
        organizationId,
      },
    });
  },
);

export const listPendingInvitations = createServerFn({ method: "GET" }).handler(
  async () => {
    const { auth, headers, organizationId } = await ensureActiveOrganization();

    if (!organizationId) {
      return [];
    }

    return auth.api.listInvitations({
      headers,
      query: {
        organizationId,
      },
    });
  },
);

export const listAdminUsers = createServerFn({ method: "GET" }).handler(
  async () => {
    const { auth } = await import("./auth");
    const headers = await getHeaders();
    return auth.api.listUsers({
      headers,
      query: {
        limit: 100,
        offset: 0,
      },
    });
  },
);

export const createOrganizationAction = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; slug: string }) => data)
  .handler(async ({ data }) => {
    const { auth } = await import("./auth");
    const headers = await getHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }

    const { ensureWorkspaceLimit } = await import("./demo-limits");
    await ensureWorkspaceLimit(session.user.id);

    return auth.api.createOrganization({
      headers,
      body: {
        name: data.name,
        slug: data.slug,
      },
    });
  });

export const createInvitationAction = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      email: string;
      role: "admin" | "owner" | "member" | "reviewer";
      organizationId: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { auth } = await import("./auth");
    const headers = await getHeaders();
    return auth.api.createInvitation({
      headers,
      body: {
        email: data.email,
        role: data.role,
        organizationId: data.organizationId,
      },
    });
  });

export const getInvitationById = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { auth } = await import("./auth");
    const headers = await getHeaders();
    return auth.api.getInvitation({
      headers,
      query: {
        id: data.id,
      },
    });
  });

export const acceptInvitationAction = createServerFn({ method: "POST" })
  .inputValidator((data: { invitationId: string }) => data)
  .handler(async ({ data }) => {
    const { auth } = await import("./auth");
    const headers = await getHeaders();
    return auth.api.acceptInvitation({
      headers,
      body: {
        invitationId: data.invitationId,
      },
    });
  });

export const getSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const { auth } = await import("./auth");
    const headers = await getHeaders();

    try {
      return await auth.api.getSession({ headers });
    } catch {
      return null;
    }
  },
);

export const ensureSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const { auth } = await import("./auth");
    const headers = await getHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session) {
      throw new Error("Unauthorized");
    }

    return session;
  },
);

export async function requireActiveOrganizationId() {
  const { organizationId } = await ensureActiveOrganization();

  if (!organizationId) {
    throw new Error("No active organization");
  }

  return organizationId;
}

export const listApiKeysServerFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { auth } = await import("./auth");
    const headers = await getHeaders();
    const organizationId = await requireActiveOrganizationId();

    const result = await auth.api.listApiKeys({
      headers,
      query: {
        organizationId,
      },
    });

    return toPlainJson({
      total: Number(result.total ?? 0),
      limit: Number(result.limit ?? 0),
      offset: Number(result.offset ?? 0),
      apiKeys: result.apiKeys.map((apiKey) => ({
        id: String(apiKey.id),
        name: apiKey.name ? String(apiKey.name) : null,
        start: apiKey.start ? String(apiKey.start) : null,
        prefix: apiKey.prefix ? String(apiKey.prefix) : null,
        expiresAt: apiKey.expiresAt ? String(apiKey.expiresAt) : null,
        metadata:
          apiKey.metadata &&
          typeof apiKey.metadata === "object" &&
          typeof apiKey.metadata.projectId === "string"
            ? { projectId: apiKey.metadata.projectId }
            : null,
      })),
    });
  },
);

export const createApiKeyServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { name: string; projectId?: string | null }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const { auth } = await import("./auth");
      const headers = await getHeaders();
      const organizationId = await requireActiveOrganizationId();

      const result = await auth.api.createApiKey({
        headers,
        body: {
          name: data.name,
          organizationId,
          metadata: data.projectId
            ? { projectId: data.projectId }
            : null,
        },
      });

      const plainResult = result
        ? {
            id: String(result.id),
            name: result.name ? String(result.name) : null,
            key: String(result.key),
            start: result.start ? String(result.start) : null,
            prefix: result.prefix ? String(result.prefix) : null,
            expiresAt: result.expiresAt ? String(result.expiresAt) : null,
            metadata:
              result.metadata &&
              typeof result.metadata === "object" &&
              typeof result.metadata.projectId === "string"
                ? { projectId: result.metadata.projectId }
                : null,
          }
        : null;

      return toPlainJson(plainResult);
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Unable to create API key.",
      );
    }
  });

export const deleteApiKeyServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { keyId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { auth } = await import("./auth");
      const headers = await getHeaders();

      const result = await auth.api.deleteApiKey({
        headers,
        body: {
          keyId: data.keyId,
        },
      });

      return { success: !!result?.success };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Unable to delete API key.",
      );
    }
  });

export const updateOrganizationAction = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { organizationId: string; name?: string; slug?: string }) => data,
  )
  .handler(async ({ data }) => {
    const { auth } = await import("./auth");
    const headers = await getHeaders();

    return auth.api.updateOrganization({
      headers,
      body: {
        organizationId: data.organizationId,
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.slug !== undefined ? { slug: data.slug } : {}),
        },
      },
    });
  });

export const setActiveOrganizationAction = createServerFn({ method: "POST" })
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data }) => {
    const { auth } = await import("./auth");
    const headers = await getHeaders();

    return auth.api.setActiveOrganization({
      headers,
      body: {
        organizationId: data.organizationId,
      },
    });
  });

export const deleteOrganizationAction = createServerFn({ method: "POST" })
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data }) => {
    const { auth } = await import("./auth");
    const headers = await getHeaders();

    return auth.api.deleteOrganization({
      headers,
      body: {
        organizationId: data.organizationId,
      },
    });
  });

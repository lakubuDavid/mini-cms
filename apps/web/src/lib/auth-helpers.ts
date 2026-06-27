import { createServerFn, getGlobalStartContext } from "@tanstack/react-start";
import {
  captureServerError,
  captureServerEvent,
  createAnonymousServerIdentity,
} from "@/lib/posthog";

function getHeaders(ctx?: unknown) {
  const request = (ctx as {
    request?: Request;
    context?: { request?: Request };
  } | undefined)?.request
    ?? (ctx as { context?: { request?: Request } } | undefined)?.context
      ?.request;

  if (request) {
    return request.headers;
  }

  const globalContext = getGlobalStartContext() as
    | { request?: Request }
    | undefined;

  return globalContext?.request?.headers ?? new Headers();
}

function toPlainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function ensureActiveOrganization(ctx?: unknown) {
  const { auth } = await import("./auth");
  const headers = getHeaders(ctx);
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
  async (ctx) => {
    const { auth } = await import("./auth");
    const headers = getHeaders(ctx);
    return auth.api.listOrganizations({ headers });
  },
);

export const getActiveOrganization = createServerFn({ method: "GET" }).handler(
  async (ctx) => {
    const { auth, headers, organizationId } = await ensureActiveOrganization(ctx);

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
  async (ctx) => {
    const { auth, headers, organizationId } = await ensureActiveOrganization(ctx);

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
  async (ctx) => {
    const { auth } = await import("./auth");
    const headers = getHeaders(ctx);
    const { organizationId } = await ensureActiveOrganization(ctx);

    if (!organizationId) {
      return { users: [] };
    }

    return auth.api.listMembers({
      headers,
      query: {
        organizationId,
        limit: 100,
        offset: 0,
      },
    });
  },
);

export const createOrganizationAction = createServerFn({ method: "POST" })
  .validator((data: { name: string; slug: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    let userId: string | undefined;

    try {
      const { auth } = await import("./auth");
      const headers = getHeaders(ctx);
      const session = await auth.api.getSession({ headers });

      if (!session?.user?.id) {
        throw new Error("Unauthorized");
      }

      userId = session.user.id;

      const { ensureWorkspaceLimit } = await import("./demo-limits");
      await ensureWorkspaceLimit(session.user.id);

      const organization = await auth.api.createOrganization({
        headers,
        body: {
          name: data.name,
          slug: data.slug,
        },
      });

      await captureServerEvent({
        event: "organization_created",
        identity: createAnonymousServerIdentity({
          subject: userId,
          organizationId: organization.id,
        }),
        properties: {},
      });

      return organization;
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({ subject: userId }),
        properties: {
          area: "organizations",
          operation: "create",
        },
      });
      throw error;
    }
  });

export const createWorkspaceAction = createServerFn({ method: "POST" })
  .validator((data: { name: string; slug: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    let organizationId: string | undefined;
    let userId: string | undefined;

    try {
      const { auth } = await import("./auth");
      const { createProject } = await import("../db/queries/projects");
      const headers = getHeaders(ctx);
      const session = await auth.api.getSession({ headers });

      if (!session?.user?.id) {
        throw new Error("Unauthorized");
      }

      userId = session.user.id;

      const { ensureWorkspaceLimit } = await import("./demo-limits");
      await ensureWorkspaceLimit(userId);

      const organization = await auth.api.createOrganization({
        headers,
        body: {
          name: data.name,
          slug: data.slug,
        },
      });

      organizationId = organization.id;

      const defaultProject = await createProject({
        organizationId,
        name: "Default",
        slug: "default",
        isDefault: true,
      });

      await captureServerEvent({
        event: "workspace_created",
        identity: createAnonymousServerIdentity({
          subject: userId,
          organizationId,
          projectId: defaultProject?.id,
        }),
        properties: {
          default_project_created: Boolean(defaultProject),
        },
      });

      return {
        organization,
        defaultProject,
      };
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({
          subject: userId,
          organizationId,
        }),
        properties: {
          area: "workspaces",
          operation: "create",
        },
      });
      throw error;
    }
  });

export const createInvitationAction = createServerFn({ method: "POST" })
  .validator(
    (data: {
      email: string;
      role: "admin" | "owner" | "member" | "reviewer";
      organizationId: string;
    }) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    try {
      const { auth } = await import("./auth");
      const { ensureWorkspaceUserLimit } = await import("./demo-limits");
      const headers = getHeaders(ctx);

      await ensureWorkspaceUserLimit(data.organizationId, {
        mode: "create-invite",
      });

      const invitation = await auth.api.createInvitation({
        headers,
        body: {
          email: data.email,
          role: data.role,
          organizationId: data.organizationId,
        },
      });

      await captureServerEvent({
        event: "invitation_created",
        identity: createAnonymousServerIdentity({
          organizationId: data.organizationId,
          subject: data.email.toLowerCase(),
        }),
        properties: {
          role: data.role,
        },
      });

      return invitation;
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({
          organizationId: data.organizationId,
        }),
        properties: {
          area: "invitations",
          operation: "create",
          role: data.role,
        },
      });
      throw error;
    }
  });

export const getInvitationById = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    const { auth } = await import("./auth");
    const headers = getHeaders(ctx);
    const [invitation, session] = await Promise.all([
      auth.api.getInvitation({
        headers,
        query: {
          id: data.id,
        },
      }),
      auth.api.getSession({ headers }).catch(() => null),
    ]);

    const sessionEmail = session?.user?.email?.toLowerCase() ?? null;
    const invitationEmail = invitation?.email?.toLowerCase() ?? null;
    const emailMatchesSession = Boolean(
      sessionEmail && invitationEmail && sessionEmail === invitationEmail,
    );

    return {
      id: invitation?.id ?? data.id,
      organizationId: invitation?.organizationId ?? null,
      organizationName: invitation?.organizationName ?? null,
      role: invitation?.role ?? null,
      hasSession: Boolean(session),
      currentUserEmail: session?.user?.email ?? null,
      emailMatchesSession,
      invitedEmail: emailMatchesSession ? invitation?.email ?? null : null,
    };
  });

export const acceptInvitationAction = createServerFn({ method: "POST" })
  .validator((data: { invitationId: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    try {
      const { auth } = await import("./auth");
      const { ensureWorkspaceUserLimit } = await import("./demo-limits");
      const headers = getHeaders(ctx);
      const session = await auth.api.getSession({ headers });

      if (!session?.user?.email) {
        throw new Error("You must be signed in to accept an invitation.");
      }

      const invitation = await auth.api.getInvitation({
        headers,
        query: {
          id: data.invitationId,
        },
      });

      if (!invitation) {
        throw new Error("Invitation not found.");
      }

      if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new Error("This invite can only be accepted by the invited account.");
      }

      await ensureWorkspaceUserLimit(invitation.organizationId, {
        mode: "accept-invite",
      });

      const result = await auth.api.acceptInvitation({
        headers,
        body: {
          invitationId: data.invitationId,
        },
      });

      await captureServerEvent({
        event: "invitation_accepted",
        identity: createAnonymousServerIdentity({ subject: data.invitationId }),
        properties: {},
      });

      return result;
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({ subject: data.invitationId }),
        properties: {
          area: "invitations",
          operation: "accept",
        },
      });
      throw error;
    }
  });

export const getSession = createServerFn({ method: "GET" }).handler(
  async (ctx) => {
    const { auth } = await import("./auth");
    const headers = getHeaders(ctx);

    try {
      return await auth.api.getSession({ headers });
    } catch {
      return null;
    }
  },
);

export const ensureSession = createServerFn({ method: "GET" }).handler(
  async (ctx) => {
    const { auth } = await import("./auth");
    const headers = getHeaders(ctx);
    const session = await auth.api.getSession({ headers });

    if (!session) {
      throw new Error("Unauthorized");
    }

    return session;
  },
);

export async function requireActiveOrganizationId(ctx?: unknown) {
  const { organizationId } = await ensureActiveOrganization(ctx);

  if (!organizationId) {
    throw new Error("No active organization");
  }

  return organizationId;
}

export async function requireSessionUserId(ctx?: unknown) {
  const { auth } = await import("./auth");
  const headers = getHeaders(ctx);
  const session = await auth.api.getSession({ headers });

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return session.user.id;
}

export const listApiKeysServerFn = createServerFn({ method: "GET" }).handler(
  async (ctx) => {
    const { auth } = await import("./auth");
    const headers = getHeaders(ctx);
    const organizationId = await requireActiveOrganizationId(ctx);

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
        enabled: apiKey.enabled !== false,
        expiresAt: apiKey.expiresAt ? String(apiKey.expiresAt) : null,
        createdAt: apiKey.createdAt ? String(apiKey.createdAt) : null,
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
  .validator(
    (data: { name: string; projectId?: string | null }) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    let organizationId: string | undefined;

    try {
      const { auth } = await import("./auth");
      const headers = getHeaders(ctx);
      organizationId = await requireActiveOrganizationId(ctx);

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

      await captureServerEvent({
        event: "api_key_created",
        identity: createAnonymousServerIdentity({
          organizationId,
          projectId: data.projectId,
          subject: result?.id ? String(result.id) : data.name,
        }),
        properties: {
          scoped_to_project: Boolean(data.projectId),
        },
      });

      return toPlainJson(plainResult);
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({
          organizationId,
          projectId: data.projectId,
        }),
        properties: {
          area: "api_keys",
          operation: "create",
          scoped_to_project: Boolean(data.projectId),
        },
      });
      throw new Error(
        error instanceof Error ? error.message : "Unable to create API key.",
      );
    }
  });

export const deleteApiKeyServerFn = createServerFn({ method: "POST" })
  .validator((data: { keyId: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    try {
      const { auth } = await import("./auth");
      const headers = getHeaders(ctx);

      const result = await auth.api.deleteApiKey({
        headers,
        body: {
          keyId: data.keyId,
        },
      });

      await captureServerEvent({
        event: "api_key_deleted",
        identity: createAnonymousServerIdentity({ subject: data.keyId }),
        properties: {},
      });

      return { success: !!result?.success };
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({ subject: data.keyId }),
        properties: {
          area: "api_keys",
          operation: "delete",
        },
      });
      throw new Error(
        error instanceof Error ? error.message : "Unable to delete API key.",
      );
    }
  });

export const updateApiKeyServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: { keyId: string; enabled?: boolean; name?: string }) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    try {
      const { auth } = await import("./auth");
      const headers = getHeaders(ctx);

      const result = await auth.api.updateApiKey({
        headers,
        body: {
          keyId: data.keyId,
          ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
          ...(data.name !== undefined ? { name: data.name } : {}),
        },
      });

      await captureServerEvent({
        event: "api_key_updated",
        identity: createAnonymousServerIdentity({ subject: data.keyId }),
        properties: {
          enabled_updated: data.enabled !== undefined,
          name_updated: data.name !== undefined,
        },
      });

      return toPlainJson({
        id: String(result.id),
        name: result.name ? String(result.name) : null,
        enabled: result.enabled !== false,
      });
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({ subject: data.keyId }),
        properties: {
          area: "api_keys",
          operation: "update",
        },
      });
      throw new Error(
        error instanceof Error ? error.message : "Unable to update API key.",
      );
    }
  });

export const rotateApiKeyServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: { keyId: string; name: string; projectId?: string | null }) =>
      data,
  )
  .handler(async ({ data, ...ctx }) => {
    let organizationId: string | undefined;

    try {
      const { auth } = await import("./auth");
      const headers = getHeaders(ctx);
      organizationId = await requireActiveOrganizationId(ctx);

      // Delete old key
      await auth.api.deleteApiKey({
        headers,
        body: { keyId: data.keyId },
      });

      // Create new key with same name and scope
      const result = await auth.api.createApiKey({
        headers,
        body: {
          name: data.name,
          organizationId,
          metadata: data.projectId ? { projectId: data.projectId } : null,
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

      await captureServerEvent({
        event: "api_key_rotated",
        identity: createAnonymousServerIdentity({
          organizationId,
          projectId: data.projectId,
          subject: result?.id ? String(result.id) : data.keyId,
        }),
        properties: {
          scoped_to_project: Boolean(data.projectId),
        },
      });

      return toPlainJson(plainResult);
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({
          organizationId,
          projectId: data.projectId,
          subject: data.keyId,
        }),
        properties: {
          area: "api_keys",
          operation: "rotate",
          scoped_to_project: Boolean(data.projectId),
        },
      });
      throw new Error(
        error instanceof Error ? error.message : "Unable to rotate API key.",
      );
    }
  });

export const updateOrganizationAction = createServerFn({ method: "POST" })
  .validator(
    (data: { organizationId: string; name?: string; slug?: string }) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    try {
      const { auth } = await import("./auth");
      const headers = getHeaders(ctx);

      const result = await auth.api.updateOrganization({
        headers,
        body: {
          organizationId: data.organizationId,
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.slug !== undefined ? { slug: data.slug } : {}),
          },
        },
      });

      await captureServerEvent({
        event: "organization_updated",
        identity: createAnonymousServerIdentity({
          organizationId: data.organizationId,
        }),
        properties: {
          name_updated: data.name !== undefined,
          slug_updated: data.slug !== undefined,
        },
      });

      return result;
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({
          organizationId: data.organizationId,
        }),
        properties: {
          area: "organizations",
          operation: "update",
        },
      });
      throw error;
    }
  });

export const setActiveOrganizationAction = createServerFn({ method: "POST" })
  .validator((data: { organizationId: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    try {
      const { auth } = await import("./auth");
      const headers = getHeaders(ctx);

      const result = await auth.api.setActiveOrganization({
        headers,
        body: {
          organizationId: data.organizationId,
        },
      });

      await captureServerEvent({
        event: "organization_switched",
        identity: createAnonymousServerIdentity({
          organizationId: data.organizationId,
        }),
        properties: {},
      });

      return result;
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({
          organizationId: data.organizationId,
        }),
        properties: {
          area: "organizations",
          operation: "set_active",
        },
      });
      throw error;
    }
  });

export const deleteOrganizationAction = createServerFn({ method: "POST" })
  .validator((data: { organizationId: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    try {
      const { auth } = await import("./auth");
      const headers = getHeaders(ctx);

      const result = await auth.api.deleteOrganization({
        headers,
        body: {
          organizationId: data.organizationId,
        },
      });

      await captureServerEvent({
        event: "organization_deleted",
        identity: createAnonymousServerIdentity({
          organizationId: data.organizationId,
        }),
        properties: {},
      });

      return result;
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({
          organizationId: data.organizationId,
        }),
        properties: {
          area: "organizations",
          operation: "delete",
        },
      });
      throw error;
    }
  });

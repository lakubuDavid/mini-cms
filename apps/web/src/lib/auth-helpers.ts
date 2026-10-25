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

export async function ensureActiveOrganization(ctx?: unknown) {
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
      userId: session.user.id,
    };
  }

  const organizations = await auth.api.listOrganizations({ headers });
  const fallbackOrganization = organizations[0];

  if (!fallbackOrganization) {
    return {
      auth,
      headers,
      organizationId: null,
      userId: session.user.id,
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
    userId: session.user.id,
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

export const getDashboardBootstrapServerFn = createServerFn({ method: "GET" }).handler(
  async (ctx) => {
    const { auth, headers, organizationId, userId } = await ensureActiveOrganization(ctx);
    const { resolveProjectAccess } = await import("./project-access");

    const [organizations, fullOrganization, access] = await Promise.all([
      auth.api.listOrganizations({ headers }),
      organizationId
        ? auth.api.getFullOrganization({ headers, query: { organizationId } })
        : Promise.resolve(null),
      organizationId
        ? resolveProjectAccess(organizationId, userId)
        : Promise.resolve(undefined),
    ]);

    const { listProjects } = await import("../db/queries/projects");
    const projects = organizationId
      ? await listProjects(organizationId, access)
      : [];

    return {
      organization: fullOrganization,
      organizations,
      projects,
      organizationId,
    };
  },
);

type PaginatedItems = { [x: string]: {} };
type MemberRecord = PaginatedItems;
type InviteRecord = PaginatedItems;

export const listPendingInvitations = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { page?: number; limit?: number } = {}) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    const { auth, headers, organizationId } = await ensureActiveOrganization(ctx);

    if (!organizationId) {
      return {
        items: [] as InviteRecord[],
        total: 0,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      };
    }

    const { page = 1, limit = 25 } = data ?? {};
    const offset = (page - 1) * limit;

    const result = await auth.api.listInvitations({
      headers,
      query: {
        organizationId,
      },
    });

    const now = new Date();

    // Only return invitations that are:
    // 1. Still pending (not accepted, rejected, or canceled)
    // 2. Not expired (expiresAt is in the future or not set)
    const pending = (Array.isArray(result) ? result : []).filter((inv) => {
      if (inv.status !== "pending") return false;
      if (inv.expiresAt && new Date(inv.expiresAt) <= now) return false;
      return true;
    });

    const total = pending.length;
    const items = pending.slice(offset, offset + limit) as InviteRecord[];
    return toPlainJson({
      items,
      total,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  });

export const listAdminUsers = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { page?: number; limit?: number } = {}) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    const { auth } = await import("./auth");
    const headers = getHeaders(ctx);
    const { organizationId } = await ensureActiveOrganization(ctx);

    if (!organizationId) {
      return {
        items: [] as MemberRecord[],
        total: 0,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      };
    }

    const { page = 1, limit = 25 } = data ?? {};
    const offset = (page - 1) * limit;

    const result = await auth.api.listMembers({
      headers,
      query: {
        organizationId,
        limit,
        offset,
      },
    });

    const members = ((result as { members?: MemberRecord[] }).members ??
      []) as MemberRecord[];
    const total = Number((result as { total?: number }).total ?? members.length);
    return toPlainJson({
      items: members,
      total,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  });

export const getTeamProjectAccessServerFn = createServerFn({
  method: "GET",
}).handler(async (ctx) => {
  const { getActiveProjectContext } = await import("./project-access");
  const { access, organizationId } = await getActiveProjectContext(ctx);

  if (!access.all) {
    throw new Error("Forbidden: team management requires owner or admin");
  }

  const { db } = await import("@/db");
  const { projectMembers } = await import("@/db/schema/project-members");
  const { projects } = await import("@/db/schema/projects");
  const { asc, eq } = await import("drizzle-orm");

  const [projectRows, memberRows] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.organizationId, organizationId))
      .orderBy(asc(projects.name)),
    db
      .select({
        memberId: projectMembers.memberId,
        projectId: projectMembers.projectId,
      })
      .from(projectMembers)
      .where(eq(projectMembers.organizationId, organizationId)),
  ]);

  const byMember = new Map<string, string[]>();

  for (const row of memberRows) {
    const projectIds = byMember.get(row.memberId) ?? [];
    projectIds.push(row.projectId);
    byMember.set(row.memberId, projectIds);
  }

  return toPlainJson({
    projects: projectRows,
    members: Array.from(byMember, ([memberId, projectIds]) => ({
      memberId,
      projectIds,
    })),
  });
});

export const setMemberProjectAccessServerFn = createServerFn({
  method: "POST",
})
  .validator((data: { memberId: string; projectIds: string[] }) => data)
  .handler(async ({ data, ...ctx }) => {
    const { getActiveProjectContext } = await import("./project-access");
    const { access, organizationId } = await getActiveProjectContext(ctx);

    if (!access.all) {
      throw new Error("Forbidden: team management requires owner or admin");
    }

    const { db } = await import("@/db");
    const { members } = await import("@/db/schema/auth");
    const { projectMembers } = await import("@/db/schema/project-members");
    const { projects } = await import("@/db/schema/projects");
    const { and, eq, inArray } = await import("drizzle-orm");
    const { nanoid } = await import("nanoid");

    const [member] = await db
      .select({ id: members.id, role: members.role })
      .from(members)
      .where(
        and(
          eq(members.id, data.memberId),
          eq(members.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!member) {
      throw new Error("Member not found in this workspace.");
    }

    if (
      member.role
        .split(",")
        .some((role) => role === "owner" || role === "admin")
    ) {
      throw new Error("Owner and admin access cannot be restricted.");
    }

    const projectIds = [...new Set(data.projectIds)];

    if (projectIds.length > 0) {
      const projectRows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, organizationId),
            inArray(projects.id, projectIds),
          ),
        );

      if (projectRows.length !== projectIds.length) {
        throw new Error("One or more projects were not found in this workspace.");
      }
    }

    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      await tx
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.organizationId, organizationId),
            eq(projectMembers.memberId, data.memberId),
          ),
        );

      if (projectIds.length > 0) {
        await tx.insert(projectMembers).values(
          projectIds.map((projectId) => ({
            id: nanoid(),
            organizationId,
            projectId,
            memberId: data.memberId,
            createdAt: now,
          })),
        );
      }
    });

    return { memberId: data.memberId, projectIds };
  });

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

export const cancelInvitationAction = createServerFn({ method: "POST" })
  .validator((data: { invitationId: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    try {
      const { auth } = await import("./auth");
      const headers = getHeaders(ctx);

      const result = await auth.api.cancelInvitation({
        headers,
        body: {
          invitationId: data.invitationId,
        },
      });

      return result;
    } catch (error) {
      await captureServerError({
        error,
        properties: {
          area: "invitations",
          operation: "cancel",
          invitationId: data.invitationId,
        },
      });
      throw error;
    }
  });

export const resendInvitationAction = createServerFn({ method: "POST" })
  .validator(
    (data: {
      invitationId: string;
      email: string;
      role: "admin" | "owner" | "member" | "reviewer";
      organizationId: string;
    }) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    try {
      const { auth } = await import("./auth");
      const headers = getHeaders(ctx);

      // Cancel the old invitation
      await auth.api.cancelInvitation({
        headers,
        body: {
          invitationId: data.invitationId,
        },
      });

      // Create a fresh one
      const invitation = await auth.api.createInvitation({
        headers,
        body: {
          email: data.email,
          role: data.role,
          organizationId: data.organizationId,
        },
      });

      await captureServerEvent({
        event: "invitation_resent",
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
        properties: {
          area: "invitations",
          operation: "resend",
          invitationId: data.invitationId,
        },
      });
      throw error;
    }
  });

export const updateMemberRoleAction = createServerFn({ method: "POST" })
  .validator((data: { memberId: string; role: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    try {
      const { auth } = await import("./auth");
      const { getActiveProjectContext } = await import("./project-access");
      const { db } = await import("@/db");
      const { members } = await import("@/db/schema/auth");
      const { projectMembers } = await import("@/db/schema/project-members");
      const { projects } = await import("@/db/schema/projects");
      const { and, eq } = await import("drizzle-orm");
      const { nanoid } = await import("nanoid");
      const headers = getHeaders(ctx);
      const { organizationId, access } = await getActiveProjectContext(ctx);

      if (!access.all) {
        throw new Error("Forbidden: team management requires owner or admin");
      }

      const [existing] = await db
        .select({ role: members.role })
        .from(members)
        .where(
          and(
            eq(members.id, data.memberId),
            eq(members.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new Error("Member not found in this workspace.");
      }

      const result = await auth.api.updateMemberRole({
        headers,
        body: {
          memberId: data.memberId,
          role: data.role,
        },
      });

      const wasFullAccess = existing.role
        .split(",")
        .some((role) => role === "owner" || role === "admin");
      const isFullAccess = data.role
        .split(",")
        .some((role) => role === "owner" || role === "admin");

      // A demoted owner/admin keeps workspace-wide access until an admin
      // restricts them explicitly.
      if (wasFullAccess && !isFullAccess) {
        const projectRows = await db
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.organizationId, organizationId));
        const now = new Date().toISOString();

        await db.transaction(async (tx) => {
          await tx
            .delete(projectMembers)
            .where(
              and(
                eq(projectMembers.organizationId, organizationId),
                eq(projectMembers.memberId, data.memberId),
              ),
            );

          if (projectRows.length > 0) {
            await tx.insert(projectMembers).values(
              projectRows.map((project) => ({
                id: nanoid(),
                organizationId,
                projectId: project.id,
                memberId: data.memberId,
                createdAt: now,
              })),
            );
          }
        });
      }

      return result;
    } catch (error) {
      await captureServerError({
        error,
        properties: {
          area: "members",
          operation: "update-role",
          memberId: data.memberId,
        },
      });
      throw error;
    }
  });

export const removeMemberAction = createServerFn({ method: "POST" })
  .validator((data: { memberId: string; organizationId: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    try {
      const { auth } = await import("./auth");
      const headers = getHeaders(ctx);

      return await auth.api.removeMember({
        headers,
        body: {
          memberIdOrEmail: data.memberId,
          organizationId: data.organizationId,
        },
      });
    } catch (error) {
      await captureServerError({
        error,
        properties: {
          area: "members",
          operation: "remove",
          memberId: data.memberId,
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

    // Query the invitation directly from DB — the invite token is a secret UUID
    // that only the invited person has (via email), so public lookup is safe.
    const { db } = await import("@/db");
    const { invitations, organizations, users } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const invitationRow = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        organizationId: invitations.organizationId,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
        inviterEmail: users.email,
      })
      .from(invitations)
      .where(eq(invitations.id, data.id))
      .leftJoin(organizations, eq(invitations.organizationId, organizations.id))
      .leftJoin(users, eq(invitations.inviterId, users.id))
      .get();

    const session = await auth.api.getSession({ headers }).catch(() => null);

    if (!invitationRow) {
      return {
        id: data.id,
        organizationId: null,
        organizationName: null,
        role: null,
        status: null,
        expiresAt: null,
        hasSession: Boolean(session),
        currentUserEmail: session?.user?.email ?? null,
        emailMatchesSession: false,
        invitedEmail: null,
        error: "Invitation not found.",
      };
    }

    const now = Date.now();
    if (invitationRow.expiresAt && invitationRow.expiresAt.getTime() < now) {
      return {
        id: data.id,
        organizationId: invitationRow.organizationId,
        organizationName: invitationRow.organizationName,
        role: invitationRow.role,
        status: "expired",
        expiresAt: invitationRow.expiresAt,
        hasSession: Boolean(session),
        currentUserEmail: session?.user?.email ?? null,
        emailMatchesSession: false,
        invitedEmail: null,
        error: "This invitation has expired.",
      };
    }

    if (invitationRow.status !== "pending") {
      return {
        id: data.id,
        organizationId: invitationRow.organizationId,
        organizationName: invitationRow.organizationName,
        role: invitationRow.role,
        status: invitationRow.status,
        expiresAt: invitationRow.expiresAt,
        hasSession: Boolean(session),
        currentUserEmail: session?.user?.email ?? null,
        emailMatchesSession: false,
        invitedEmail: null,
        error: `This invitation has already been ${invitationRow.status}.`,
      };
    }

    const sessionEmail = session?.user?.email?.toLowerCase() ?? null;
    const invitationEmail = invitationRow.email?.toLowerCase() ?? null;
    const emailMatchesSession = Boolean(
      sessionEmail && invitationEmail && sessionEmail === invitationEmail,
    );

    return {
      id: invitationRow.id,
      organizationId: invitationRow.organizationId,
      organizationName: invitationRow.organizationName,
      role: invitationRow.role,
      status: invitationRow.status,
      expiresAt: invitationRow.expiresAt,
      hasSession: Boolean(session),
      currentUserEmail: session?.user?.email ?? null,
      emailMatchesSession,
      invitedEmail: emailMatchesSession ? invitationRow.email : null,
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

export const listApiKeysServerFn = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { page?: number; limit?: number } = {}) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    const { auth } = await import("./auth");
    const { getActiveProjectContext } = await import("./project-access");
    const headers = getHeaders(ctx);
    const { organizationId, access } = await getActiveProjectContext(ctx);

    const { page = 1, limit = 25 } = data ?? {};

    const allKeys = [];
    let offset = 0;
    const batchSize = 100;

    while (true) {
      const result = await auth.api.listApiKeys({
        headers,
        query: {
          organizationId,
          limit: batchSize,
          offset,
        },
      });
      const batch = result.apiKeys ?? [];
      allKeys.push(...batch);
      const total = Number(result.total ?? 0);
      offset += batch.length;

      if (batch.length === 0 || batch.length < batchSize || allKeys.length >= total) {
        break;
      }
    }

    const filtered = access.all
      ? allKeys
      : allKeys.filter((apiKey) => {
          const metadata = apiKey.metadata;
          const projectId =
            metadata &&
            typeof metadata === "object" &&
            typeof metadata.projectId === "string"
              ? metadata.projectId
              : null;
          return projectId !== null && access.projectIds.includes(projectId);
        });

    const pageOffset = (page - 1) * limit;
    const pageKeys = filtered.slice(pageOffset, pageOffset + limit);

    return toPlainJson({
      total: filtered.length,
      limit,
      offset: pageOffset,
      page,
      pageSize: limit,
      apiKeys: pageKeys.map((apiKey) => ({
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
      const { getActiveProjectContext } = await import("./project-access");
      const { getProjectById } = await import("../db/queries/projects");
      const headers = getHeaders(ctx);
      const { organizationId: activeOrganizationId, access } =
        await getActiveProjectContext(ctx);
      organizationId = activeOrganizationId;

      if (data.projectId) {
        const project = await getProjectById(data.projectId, organizationId);

        if (!project) {
          throw new Error("Project not found in this workspace.");
        }

        if (!access.all && !access.projectIds.includes(data.projectId)) {
          throw new Error("Forbidden: no access to this project");
        }
      } else if (!access.all) {
        throw new Error("Forbidden: workspace API keys require owner or admin");
      }

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
      const { requireApiKeyAccess } = await import("./project-access");
      const headers = getHeaders(ctx);
      await requireApiKeyAccess(ctx, data.keyId);

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
      const { requireApiKeyAccess } = await import("./project-access");
      const headers = getHeaders(ctx);
      await requireApiKeyAccess(ctx, data.keyId);

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
      const { requireApiKeyAccess } = await import("./project-access");
      const { getProjectById } = await import("../db/queries/projects");
      const headers = getHeaders(ctx);
      const { organizationId: activeOrganizationId, access } =
        await requireApiKeyAccess(ctx, data.keyId);
      organizationId = activeOrganizationId;

      if (data.projectId) {
        const project = await getProjectById(data.projectId, organizationId);

        if (!project) {
          throw new Error("Project not found in this workspace.");
        }

        if (!access.all && !access.projectIds.includes(data.projectId)) {
          throw new Error("Forbidden: no access to this project");
        }
      } else if (!access.all) {
        throw new Error("Forbidden: workspace API keys require owner or admin");
      }

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

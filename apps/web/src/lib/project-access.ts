import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import type { ProjectAccess } from "@/db/queries/shared";
import { members } from "@/db/schema/auth";
import { projectMembers } from "@/db/schema/project-members";
import { ensureActiveOrganization } from "./auth-helpers";

export type { ProjectAccess };

const FULL_ACCESS_ROLES = new Set(["owner", "admin"]);

/**
 * Resolve which projects a workspace member can see.
 *
 * Owners and admins implicitly see every project. Everyone else sees only the
 * projects listed in project_members; no rows means no project access.
 */
export async function resolveProjectAccess(
  organizationId: string,
  userId: string,
): Promise<ProjectAccess> {
  const [membership] = await db
    .select({ id: members.id, role: members.role })
    .from(members)
    .where(
      and(
        eq(members.organizationId, organizationId),
        eq(members.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new Error("Not a member of this organization");
  }

  const roles = membership.role.split(",");
  if (roles.some((role) => FULL_ACCESS_ROLES.has(role))) {
    return { all: true, projectIds: [] };
  }

  const rows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.organizationId, organizationId),
        eq(projectMembers.memberId, membership.id),
      ),
    );

  return { all: false, projectIds: rows.map((row) => row.projectId) };
}

export async function getActiveProjectContext(ctx?: unknown) {
  const { organizationId, userId } = await ensureActiveOrganization(ctx);

  if (!organizationId) {
    throw new Error("No active organization");
  }

  return {
    organizationId,
    access: await resolveProjectAccess(organizationId, userId),
  };
}

export async function getProjectAccess(ctx?: unknown): Promise<ProjectAccess> {
  const { access } = await getActiveProjectContext(ctx);
  return access;
}

export async function requireProjectAccess(
  ctx: unknown,
  projectId: string,
): Promise<void> {
  const access = await getProjectAccess(ctx);

  if (!access.all && !access.projectIds.includes(projectId)) {
    throw new Error("Forbidden: no access to this project");
  }
}

export async function requireProjectManager(ctx?: unknown): Promise<void> {
  const access = await getProjectAccess(ctx);

  if (!access.all) {
    throw new Error("Forbidden: project management requires owner or admin");
  }
}

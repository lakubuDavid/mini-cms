import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import type { ProjectAccess } from "@/db/queries/shared";
import { getAssetById } from "@/db/queries/assets";
import { getEnvironmentById } from "@/db/queries/environments";
import { getItemById } from "@/db/queries/items";
import { apikeys, members } from "@/db/schema/auth";
import { assets } from "@/db/schema/assets";
import { collectionItems } from "@/db/schema/collection-items";
import { collections } from "@/db/schema/collections";
import { projectMembers } from "@/db/schema/project-members";
import { ensureActiveOrganization } from "./auth-helpers";

export type { ProjectAccess };

const FULL_ACCESS_ROLES = new Set(["owner", "admin"]);

export function readApiKeyProjectId(metadata: string | null): string | null {
  if (!metadata) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadata) as { projectId?: unknown };
    return typeof parsed.projectId === "string" ? parsed.projectId : null;
  } catch {
    return null;
  }
}

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
    userId,
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

export async function requireCollectionAccess(
  ctx: unknown,
  collectionId: string,
) {
  const { organizationId, access } = await getActiveProjectContext(ctx);
  const [collection] = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.id, collectionId),
        eq(collections.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!collection) {
    throw new Error("Collection not found");
  }

  if (!access.all && !access.projectIds.includes(collection.projectId)) {
    throw new Error("Forbidden: no access to this project");
  }

  return { collection, organizationId, access };
}

export async function requireEnvironmentAccess(
  ctx: unknown,
  environmentId: string,
) {
  const { organizationId, access } = await getActiveProjectContext(ctx);
  const environment = await getEnvironmentById(environmentId, organizationId);

  if (!environment) {
    throw new Error("Environment not found");
  }

  if (!access.all && !access.projectIds.includes(environment.projectId)) {
    throw new Error("Forbidden: no access to this project");
  }

  return { environment, organizationId, access };
}

export async function requireItemAccess(ctx: unknown, itemId: string) {
  const { organizationId, access } = await getActiveProjectContext(ctx);
  const item = await getItemById(itemId, organizationId);

  if (!item) {
    throw new Error("Item not found");
  }

  const [collection] = await db
    .select({ projectId: collections.projectId })
    .from(collections)
    .where(eq(collections.id, item.collectionId))
    .limit(1);

  if (!collection) {
    throw new Error("Collection not found");
  }

  if (!access.all && !access.projectIds.includes(collection.projectId)) {
    throw new Error("Forbidden: no access to this project");
  }

  return { item, projectId: collection.projectId, organizationId, access };
}

export async function requireItemsInProject(
  ctx: unknown,
  itemIds: string[],
  projectId: string,
) {
  const { organizationId, access } = await getActiveProjectContext(ctx);

  if (!access.all && !access.projectIds.includes(projectId)) {
    throw new Error("Forbidden: no access to this project");
  }

  if (itemIds.length === 0) {
    return { organizationId, access };
  }

  const rows = await db
    .select({ id: collectionItems.id, projectId: collections.projectId })
    .from(collectionItems)
    .innerJoin(collections, eq(collections.id, collectionItems.collectionId))
    .where(
      and(
        eq(collections.organizationId, organizationId),
        eq(collections.projectId, projectId),
        inArray(collectionItems.id, itemIds),
      ),
    );

  if (rows.length !== new Set(itemIds).size) {
    throw new Error("Item not found in this project");
  }

  return { organizationId, access };
}

export async function requireAssetAccess(ctx: unknown, assetId: string) {
  const { organizationId, access } = await getActiveProjectContext(ctx);
  const asset = await getAssetById(assetId, organizationId);

  if (!asset) {
    throw new Error("Asset not found");
  }

  if (!access.all && !access.projectIds.includes(asset.projectId)) {
    throw new Error("Forbidden: no access to this project");
  }

  return { asset, organizationId, access };
}

export async function filterAccessibleCollectionIds(
  ctx: unknown,
  collectionIds: string[],
): Promise<string[]> {
  if (collectionIds.length === 0) {
    return [];
  }

  const { organizationId, access } = await getActiveProjectContext(ctx);
  const rows = await db
    .select({ id: collections.id, projectId: collections.projectId })
    .from(collections)
    .where(
      and(
        eq(collections.organizationId, organizationId),
        inArray(collections.id, collectionIds),
      ),
    );

  return rows
    .filter(
      (row) => access.all || access.projectIds.includes(row.projectId),
    )
    .map((row) => row.id);
}

export async function filterAccessibleAssetIds(
  ctx: unknown,
  assetIds: string[],
): Promise<string[]> {
  if (assetIds.length === 0) {
    return [];
  }

  const { organizationId, access } = await getActiveProjectContext(ctx);
  const rows = await db
    .select({ id: assets.id, projectId: assets.projectId })
    .from(assets)
    .where(
      and(
        eq(assets.organizationId, organizationId),
        inArray(assets.id, assetIds),
      ),
    );

  return rows
    .filter((row) => access.all || access.projectIds.includes(row.projectId))
    .map((row) => row.id);
}

export async function requireApiKeyAccess(ctx: unknown, keyId: string) {
  const { organizationId, access } = await getActiveProjectContext(ctx);
  const [key] = await db
    .select()
    .from(apikeys)
    .where(
      and(eq(apikeys.id, keyId), eq(apikeys.referenceId, organizationId)),
    )
    .limit(1);

  if (!key) {
    throw new Error("API key not found");
  }

  const projectId = readApiKeyProjectId(key.metadata);

  if (!access.all && (!projectId || !access.projectIds.includes(projectId))) {
    throw new Error("Forbidden: no access to this API key");
  }

  return { key, projectId, organizationId, access };
}

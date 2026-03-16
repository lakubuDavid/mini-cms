import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, collectionItems, collections, projects } from "@/db/schema";
import { env } from "./env";

export const demoLimits = {
  maxWorkspacesPerUser: env.DEMO_MAX_WORKSPACES_PER_USER,
  maxProjectsPerWorkspace: env.DEMO_MAX_PROJECTS_PER_WORKSPACE,
  maxCollectionsPerProject: env.DEMO_MAX_COLLECTIONS_PER_PROJECT,
  maxItemsPerCollection: env.DEMO_MAX_ITEMS_PER_COLLECTION,
  maxAssetsPerProject: env.DEMO_MAX_ASSETS_PER_PROJECT,
};

export async function ensureWorkspaceLimit(userId: string) {
  const limit = demoLimits.maxWorkspacesPerUser;

  if (!limit) {
    return;
  }

  const memberships = await db.query.members.findMany({
    where: (members, { eq }) => eq(members.userId, userId),
    columns: { organizationId: true },
  });
  const total = new Set(memberships.map((membership) => membership.organizationId)).size;

  if (total >= limit) {
    throw new Error(`Workspace limit reached. Max ${limit} workspace(s) per user.`);
  }
}

export async function ensureProjectLimit(organizationId: string) {
  const limit = demoLimits.maxProjectsPerWorkspace;

  if (!limit) {
    return;
  }

  const result = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.organizationId, organizationId));

  if ((result[0]?.value ?? 0) >= limit) {
    throw new Error(`Project limit reached. Max ${limit} project(s) per workspace.`);
  }
}

export async function ensureCollectionLimit(projectId: string) {
  const limit = demoLimits.maxCollectionsPerProject;

  if (!limit) {
    return;
  }

  const result = await db
    .select({ value: count() })
    .from(collections)
    .where(eq(collections.projectId, projectId));

  if ((result[0]?.value ?? 0) >= limit) {
    throw new Error(`Collection limit reached. Max ${limit} collection(s) per project.`);
  }
}

export async function ensureItemLimit(collectionId: string) {
  const limit = demoLimits.maxItemsPerCollection;

  if (!limit) {
    return;
  }

  const result = await db
    .select({ value: count() })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId));

  if ((result[0]?.value ?? 0) >= limit) {
    throw new Error(`Item limit reached. Max ${limit} item(s) per collection.`);
  }
}

export async function ensureAssetLimit(projectId: string) {
  const limit = demoLimits.maxAssetsPerProject;

  if (!limit) {
    return;
  }

  const result = await db
    .select({ value: count() })
    .from(assets)
    .where(eq(assets.projectId, projectId));

  if ((result[0]?.value ?? 0) >= limit) {
    throw new Error(`Asset limit reached. Max ${limit} asset(s) per project.`);
  }
}

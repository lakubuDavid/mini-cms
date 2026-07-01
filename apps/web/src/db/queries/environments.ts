import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { environments } from "@/db/schema/environments";

export type CreateEnvironmentInput = {
  projectId: string;
  name: string;
  slug: string;
  isProduction?: boolean;
};

export async function listEnvironments(projectId: string) {
  return db.query.environments.findMany({
    where: eq(environments.projectId, projectId),
    orderBy: [asc(environments.createdAt)],
  });
}

export async function getEnvironmentById(id: string) {
  return db.query.environments.findFirst({
    where: eq(environments.id, id),
  });
}

export async function getEnvironmentBySlug(
  slug: string,
  projectId: string,
) {
  return db.query.environments.findFirst({
    where: and(
      eq(environments.slug, slug),
      eq(environments.projectId, projectId),
    ),
  });
}

export async function getProductionEnvironment(projectId: string) {
  return db.query.environments.findFirst({
    where: and(
      eq(environments.projectId, projectId),
      eq(environments.isProduction, true),
    ),
  });
}

export async function createEnvironment(input: CreateEnvironmentInput) {
  const id = nanoid();
  const now = new Date().toISOString();

  await db.insert(environments).values({
    id,
    projectId: input.projectId,
    name: input.name,
    slug: input.slug,
    isProduction: input.isProduction ?? false,
    createdAt: now,
    updatedAt: now,
  });

  return getEnvironmentById(id);
}

export async function updateEnvironment(
  id: string,
  data: {
    name?: string;
    slug?: string;
    isProduction?: boolean;
  },
) {
  await db
    .update(environments)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.isProduction !== undefined
        ? { isProduction: data.isProduction }
        : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(environments.id, id));

  return getEnvironmentById(id);
}

export async function deleteEnvironment(id: string) {
  await db.delete(environments).where(eq(environments.id, id));
}

/**
 * Ensures at least one environment exists for a project.
 * Creates a default "Production" environment if none exist.
 * Returns the production environment (existing or newly created).
 */
export async function ensureProductionEnvironment(projectId: string) {
  const existing = await getProductionEnvironment(projectId);

  if (existing) {
    return existing;
  }

  // Check if there are any environments at all
  const all = await listEnvironments(projectId);

  if (all.length > 0) {
    // Mark the first one as production
    await updateEnvironment(all[0].id, { isProduction: true });
    return getEnvironmentById(all[0].id);
  }

  // Create a default production environment
  return createEnvironment({
    projectId,
    name: "Production",
    slug: "production",
    isProduction: true,
  });
}

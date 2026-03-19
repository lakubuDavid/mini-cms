import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { projects, type ApiAccessType } from "@/db/schema/projects";

export type CreateProjectInput = {
  organizationId: string;
  name: string;
  slug: string;
  isDefault?: boolean;
};

export async function listProjects(organizationId: string) {
  return db.query.projects.findMany({
    where: eq(projects.organizationId, organizationId),
    orderBy: [asc(projects.createdAt)],
  });
}

export async function getProjectById(id: string, organizationId?: string) {
  return db.query.projects.findFirst({
    where: organizationId
      ? and(eq(projects.id, id), eq(projects.organizationId, organizationId))
      : eq(projects.id, id),
  });
}

export async function getDefaultProject(organizationId: string) {
  const items = await listProjects(organizationId);
  return items.find((project) => project.metadata?.isDefault) ?? items[0] ?? null;
}

export async function updateProject(
  id: string,
  organizationId: string,
  data: { name?: string; slug?: string; apiAccess?: { type: ApiAccessType; allowedDomains?: string[] } },
) {
  await db
    .update(projects)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.apiAccess !== undefined ? { apiAccess: data.apiAccess } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)));

  return getProjectById(id, organizationId);
}

export async function deleteProject(id: string, organizationId: string) {
  const project = await getProjectById(id, organizationId);

  if (!project) return null;
  if (project.metadata?.isDefault) return null;

  await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)));

  return { success: true };
}

export async function createProject(input: CreateProjectInput) {
  const id = nanoid();
  const now = new Date().toISOString();

  await db.insert(projects).values({
    id,
    organizationId: input.organizationId,
    name: input.name,
    slug: input.slug,
    createdAt: now,
    updatedAt: now,
    metadata: input.isDefault ? { isDefault: true } : {},
  });

  return getProjectById(id, input.organizationId);
}

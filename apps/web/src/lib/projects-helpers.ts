import { createServerFn } from "@tanstack/react-start";

export const listProjectsServerFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireActiveOrganizationId } = await import("./auth-helpers");
    const { listProjects } = await import("../db/queries/projects");

    return listProjects(await requireActiveOrganizationId());
  },
);

export const createProjectServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; slug: string }) => data)
  .handler(async ({ data }) => {
    const { requireActiveOrganizationId } = await import("./auth-helpers");
    const { createProject } = await import("../db/queries/projects");
    const { ensureProjectLimit } = await import("./demo-limits");
    const organizationId = await requireActiveOrganizationId();

    await ensureProjectLimit(organizationId);

    return createProject({
      organizationId,
      name: data.name,
      slug: data.slug,
    });
  });

export const updateProjectServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { id: string; name?: string; slug?: string }) => data,
  )
  .handler(async ({ data }) => {
    const { requireActiveOrganizationId } = await import("./auth-helpers");
    const { updateProject } = await import("../db/queries/projects");

    return updateProject(data.id, await requireActiveOrganizationId(), {
      name: data.name,
      slug: data.slug,
    });
  });

export const deleteProjectServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { requireActiveOrganizationId } = await import("./auth-helpers");
    const { deleteProject } = await import("../db/queries/projects");

    return deleteProject(data.id, await requireActiveOrganizationId());
  });

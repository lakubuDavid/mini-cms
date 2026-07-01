import { createServerFn } from "@tanstack/react-start";
import {
  captureServerError,
  captureServerEvent,
  createAnonymousServerIdentity,
} from "@/lib/posthog";

export const getProjectServerFn = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    try {
      const { requireActiveOrganizationId } = await import("./auth-helpers");
      const { getProjectById } = await import("../db/queries/projects");
      const organizationId = await requireActiveOrganizationId(ctx);

      return getProjectById(data.id, organizationId);
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({}),
        properties: {
          area: "projects",
          operation: "get",
        },
      });
      throw error;
    }
  });

export const listProjectsServerFn = createServerFn({ method: "GET" }).handler(
  async (ctx) => {
    const { requireActiveOrganizationId } = await import("./auth-helpers");
    const { listProjects } = await import("../db/queries/projects");

    return listProjects(await requireActiveOrganizationId(ctx));
  },
);

export const createProjectServerFn = createServerFn({ method: "POST" })
  .validator((data: { name: string; slug: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    let organizationId: string | undefined;

    try {
      const { requireActiveOrganizationId } = await import("./auth-helpers");
      const { createProject } = await import("../db/queries/projects");
      const { ensureProjectLimit } = await import("./demo-limits");
      organizationId = await requireActiveOrganizationId(ctx);

      await ensureProjectLimit(organizationId);

      const project = await createProject({
        organizationId,
        name: data.name,
        slug: data.slug,
      });

      if (project) {
        await captureServerEvent({
          event: "project_created",
          identity: createAnonymousServerIdentity({
            organizationId,
            projectId: project.id,
          }),
          properties: {},
        });
      }

      return project;
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({ organizationId }),
        properties: {
          area: "projects",
          operation: "create",
        },
      });
      throw error;
    }
  });

export const updateProjectServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: { id: string; name?: string; slug?: string; apiAccess?: { type: "public" | "restricted" | "none"; allowedDomains?: string[] } }) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    let organizationId: string | undefined;

    try {
      const { requireActiveOrganizationId } = await import("./auth-helpers");
      const { updateProject } = await import("../db/queries/projects");
      organizationId = await requireActiveOrganizationId(ctx);

      const project = await updateProject(data.id, organizationId, {
        name: data.name,
        slug: data.slug,
        apiAccess: data.apiAccess,
      });

      if (project) {
        await captureServerEvent({
          event: "project_updated",
          identity: createAnonymousServerIdentity({
            organizationId,
            projectId: project.id,
          }),
          properties: {
            name_updated: data.name !== undefined,
            slug_updated: data.slug !== undefined,
            apiAccess_updated: data.apiAccess !== undefined,
          },
        });
      }

      return project;
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({
          organizationId,
          projectId: data.id,
        }),
        properties: {
          area: "projects",
          operation: "update",
        },
      });
      throw error;
    }
  });

export const deleteProjectServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    let organizationId: string | undefined;

    try {
      const { requireActiveOrganizationId } = await import("./auth-helpers");
      const { deleteProject } = await import("../db/queries/projects");
      organizationId = await requireActiveOrganizationId(ctx);

      const result = await deleteProject(data.id, organizationId);

      if (result?.success) {
        await captureServerEvent({
          event: "project_deleted",
          identity: createAnonymousServerIdentity({
            organizationId,
            projectId: data.id,
          }),
          properties: {},
        });
      }

      return result;
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({
          organizationId,
          projectId: data.id,
        }),
        properties: {
          area: "projects",
          operation: "delete",
        },
      });
      throw error;
    }
  });

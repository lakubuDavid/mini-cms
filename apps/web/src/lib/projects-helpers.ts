import { createServerFn } from "@tanstack/react-start";
import {
  captureServerError,
  captureServerEvent,
  createAnonymousServerIdentity,
} from "@/lib/posthog";

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
    let organizationId: string | undefined;

    try {
      const { requireActiveOrganizationId } = await import("./auth-helpers");
      const { createProject } = await import("../db/queries/projects");
      const { ensureProjectLimit } = await import("./demo-limits");
      organizationId = await requireActiveOrganizationId();

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
  .inputValidator(
    (data: { id: string; name?: string; slug?: string }) => data,
  )
  .handler(async ({ data }) => {
    let organizationId: string | undefined;

    try {
      const { requireActiveOrganizationId } = await import("./auth-helpers");
      const { updateProject } = await import("../db/queries/projects");
      organizationId = await requireActiveOrganizationId();

      const project = await updateProject(data.id, organizationId, {
        name: data.name,
        slug: data.slug,
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
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    let organizationId: string | undefined;

    try {
      const { requireActiveOrganizationId } = await import("./auth-helpers");
      const { deleteProject } = await import("../db/queries/projects");
      organizationId = await requireActiveOrganizationId();

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

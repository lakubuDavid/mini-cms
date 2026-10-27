import { createServerFn } from "@tanstack/react-start";
import {
  captureServerError,
  captureServerEvent,
  createAnonymousServerIdentity,
} from "@/lib/posthog";

export const listEnvironmentsServerFn = createServerFn({ method: "GET" })
  .validator((data: { projectId: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    try {
      const { getActiveProjectContext } = await import("./project-access");
      const { listEnvironments } = await import("../db/queries/environments");
      const { getProjectById } = await import("../db/queries/projects");
      const { organizationId, access } = await getActiveProjectContext(ctx);
      const project = await getProjectById(
        data.projectId,
        organizationId,
        access,
      );

      if (!project) {
        throw new Error("Project not found in this workspace.");
      }

      return listEnvironments(data.projectId);
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({}),
        properties: { area: "environments", operation: "list" },
      });
      throw error;
    }
  });

export const getEnvironmentServerFn = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    try {
      const { requireEnvironmentAccess } = await import("./project-access");
      const { environment } = await requireEnvironmentAccess(ctx, data.id);
      return environment;
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({}),
        properties: { area: "environments", operation: "get" },
      });
      throw error;
    }
  });

export const getEnvironmentBySlugServerFn = createServerFn({ method: "GET" })
  .validator((data: { slug: string; projectId: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    try {
      const { getActiveProjectContext } = await import("./project-access");
      const { getEnvironmentBySlug } = await import("../db/queries/environments");
      const { getProductionEnvironment } = await import("../db/queries/environments");
      const { getProjectById } = await import("../db/queries/projects");
      const { organizationId, access } = await getActiveProjectContext(ctx);
      const project = await getProjectById(
        data.projectId,
        organizationId,
        access,
      );

      if (!project) {
        throw new Error("Project not found in this workspace.");
      }

      // If no slug or "production", return the production environment
      if (!data.slug || data.slug === "production") {
        return getProductionEnvironment(data.projectId);
      }

      return getEnvironmentBySlug(data.slug, data.projectId);
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({}),
        properties: { area: "environments", operation: "getBySlug" },
      });
      throw error;
    }
  });

export const createEnvironmentServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      projectId: string;
      name: string;
      slug: string;
      isProduction?: boolean;
    }) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    try {
      const { getActiveProjectContext } = await import("./project-access");
      const { createEnvironment } = await import("../db/queries/environments");
      const { getProjectById } = await import("../db/queries/projects");
      const { organizationId, access } = await getActiveProjectContext(ctx);
      const project = await getProjectById(
        data.projectId,
        organizationId,
        access,
      );

      if (!project) {
        throw new Error("Project not found in this workspace.");
      }

      const env = await createEnvironment(data);

      await captureServerEvent({
        event: "environment_created",
        identity: createAnonymousServerIdentity({}),
        properties: {
          project_id: data.projectId,
          env_slug: data.slug,
          is_production: data.isProduction ?? false,
        },
      });

      return env;
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({}),
        properties: { area: "environments", operation: "create" },
      });
      throw error;
    }
  });

export const updateEnvironmentServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      name?: string;
      slug?: string;
      isProduction?: boolean;
    }) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    try {
      const { requireEnvironmentAccess } = await import("./project-access");
      const { updateEnvironment } = await import("../db/queries/environments");
      const { organizationId } = await requireEnvironmentAccess(ctx, data.id);

      const env = await updateEnvironment(
        data.id,
        {
          name: data.name,
          slug: data.slug,
          isProduction: data.isProduction,
        },
        organizationId,
      );

      await captureServerEvent({
        event: "environment_updated",
        identity: createAnonymousServerIdentity({}),
        properties: {
          env_id: data.id,
          updated_fields: Object.keys(data).filter((k) => k !== "id").join(","),
        },
      });

      return env;
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({}),
        properties: { area: "environments", operation: "update" },
      });
      throw error;
    }
  });

export const deleteEnvironmentServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    try {
      const { requireEnvironmentAccess } = await import("./project-access");
      const { deleteEnvironment } = await import("../db/queries/environments");
      const { organizationId, environment } = await requireEnvironmentAccess(
        ctx,
        data.id,
      );

      // Don't allow deleting the production environment
      if (environment.isProduction) {
        throw new Error("Cannot delete the production environment. Change the production flag to another environment first.");
      }

      await deleteEnvironment(data.id, organizationId);

      await captureServerEvent({
        event: "environment_deleted",
        identity: createAnonymousServerIdentity({}),
        properties: {
          env_id: data.id,
          env_slug: environment.slug,
        },
      });

      return { success: true };
    } catch (error) {
      await captureServerError({
        error,
        identity: createAnonymousServerIdentity({}),
        properties: { area: "environments", operation: "delete" },
      });
      throw error;
    }
  });

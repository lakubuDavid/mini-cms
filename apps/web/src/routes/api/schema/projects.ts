import { createFileRoute } from "@tanstack/react-router";
import {
  createProject,
  deleteProject,
  getProjectById,
  listProjects,
} from "@/db/queries/projects";
import { verifySchemaApiKey } from "@/lib/schema-sync";

const schemaProjectsDeps = {
  createProject,
  deleteProject,
  getProjectById,
  listProjects,
  verifySchemaApiKey,
};

type SchemaProjectsDeps = typeof schemaProjectsDeps;

export async function handleSchemaProjects(
  request: Request,
  deps: SchemaProjectsDeps = schemaProjectsDeps,
) {
  try {
    const auth = await deps.verifySchemaApiKey(request, "push");

    if (request.method === "GET") {
      const url = new URL(request.url);
      const workspaceId = url.searchParams.get("workspaceId");

      if (!workspaceId || workspaceId !== auth.workspaceId) {
        return json(
          { error: "Workspace does not match the provided API key." },
          403,
        );
      }

      const projects = await deps.listProjects(workspaceId);

      return json({ workspaceId, projects });
    }

    const body = (await request.json()) as {
      action: "create" | "delete";
      workspaceId: string;
      id?: string;
      name?: string;
      slug?: string;
    };

    if (!body.workspaceId || body.workspaceId !== auth.workspaceId) {
      return json(
        { error: "Workspace does not match the provided API key." },
        403,
      );
    }

    if (auth.projectId) {
      return json(
        { error: "Project-scoped API keys cannot manage projects." },
        403,
      );
    }

    if (body.action === "create") {
      if (!body.name || !body.slug) {
        return json({ error: "name and slug are required." }, 400);
      }

      const project = await deps.createProject({
        organizationId: body.workspaceId,
        name: body.name,
        slug: body.slug,
      });

      return json({ workspaceId: body.workspaceId, project });
    }

    if (!body.id) {
      return json({ error: "id is required." }, 400);
    }

    const project = await deps.getProjectById(body.id, body.workspaceId);

    if (!project) {
      return json({ error: "Project not found." }, 404);
    }

    const result = await deps.deleteProject(body.id, body.workspaceId);

    if (!result?.success) {
      return json(
        { error: "Unable to delete project. Default projects cannot be deleted." },
        400,
      );
    }

    return json({ success: true, id: body.id });
  } catch (error) {
    return handleError(error);
  }
}

export const Route = createFileRoute("/api/schema/projects")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        handleSchemaProjects(request),
      POST: async ({ request }: { request: Request }) =>
        handleSchemaProjects(request),
    },
  },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function handleError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }

  return json(
    { error: error instanceof Error ? error.message : "Unexpected error." },
    500,
  );
}

import { createFileRoute } from "@tanstack/react-router";
import {
  createCollectionAction,
  deleteCollectionAction,
} from "@/server/functions/collections";
import {
  getCollectionById,
  getCollectionBySlug,
  listCollections,
} from "@/db/queries/collections";
import { verifySchemaApiKey } from "@/lib/schema-sync";

const schemaCollectionsDeps = {
  createCollectionAction,
  deleteCollectionAction,
  getCollectionById,
  getCollectionBySlug,
  listCollections,
  verifySchemaApiKey,
};

type SchemaCollectionsDeps = typeof schemaCollectionsDeps;

export async function handleSchemaCollections(
  request: Request,
  deps: SchemaCollectionsDeps = schemaCollectionsDeps,
) {
  try {
    const auth = await deps.verifySchemaApiKey(request, "push");

    if (request.method === "GET") {
      const url = new URL(request.url);
      const workspaceId = url.searchParams.get("workspaceId");
      const projectId = url.searchParams.get("projectId") ?? auth.projectId ?? undefined;

      if (!workspaceId || workspaceId !== auth.workspaceId) {
        return json(
          { error: "Workspace does not match the provided API key." },
          403,
        );
      }

      if (auth.projectId && projectId && projectId !== auth.projectId) {
        return json(
          { error: "API key is restricted to a different project." },
          403,
        );
      }

      const collections = await deps.listCollections({
        organizationId: workspaceId,
        projectId,
        page: 1,
        limit: 500,
      });

      return json({ workspaceId, collections: collections.items });
    }

    const body = (await request.json()) as {
      action: "create" | "delete";
      workspaceId: string;
      projectId?: string;
      id?: string;
      slug?: string;
      name?: string;
      description?: string | null;
      schema?: Array<{ key: string; label: string; type: "text" | "url" | "number" | "boolean" | "date" }>;
    };

    if (!body.workspaceId || body.workspaceId !== auth.workspaceId) {
      return json(
        { error: "Workspace does not match the provided API key." },
        403,
      );
    }

    const effectiveProjectId = auth.projectId ?? body.projectId;

    if (auth.projectId && body.projectId && body.projectId !== auth.projectId) {
      return json(
        { error: "API key is restricted to a different project." },
        403,
      );
    }

    if (body.action === "create") {
      if (!body.name || !body.slug) {
        return json({ error: "name and slug are required." }, 400);
      }

      const collection = await deps.createCollectionAction({
        organizationId: body.workspaceId,
        projectId: effectiveProjectId,
        name: body.name,
        slug: body.slug,
        description: body.description,
        schema: body.schema ?? [],
      });

      return json({ workspaceId: body.workspaceId, collection });
    }

    if (!body.id && !body.slug) {
      return json({ error: "id or slug is required." }, 400);
    }

    const collection = body.id
      ? await deps.getCollectionById(body.id, body.workspaceId, effectiveProjectId)
      : await deps.getCollectionBySlug(body.slug!, body.workspaceId, effectiveProjectId);

    if (!collection) {
      return json({ error: "Collection not found." }, 404);
    }

    await deps.deleteCollectionAction(collection.id, collection.slug);

    return json({ success: true, id: collection.id });
  } catch (error) {
    return handleError(error);
  }
}

export const Route = createFileRoute("/api/schema/collections")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        handleSchemaCollections(request),
      POST: async ({ request }: { request: Request }) =>
        handleSchemaCollections(request),
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

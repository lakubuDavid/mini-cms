import { createFileRoute } from "@tanstack/react-router";
import {
  loadWorkspaceCollectionsForSync,
  toSyncCollection,
  verifySchemaApiKey,
} from "@/lib/schema-sync";

const schemaPullDeps = {
  verifySchemaApiKey,
  loadWorkspaceCollectionsForSync,
  toSyncCollection,
};

type SchemaPullDeps = typeof schemaPullDeps;

export async function handleSchemaPull(
  request: Request,
  deps: SchemaPullDeps = schemaPullDeps,
) {
  try {
    const auth = await deps.verifySchemaApiKey(request, "pull");
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const collectionId = url.searchParams.get("collectionId");
    const projectId = url.searchParams.get("projectId");

    if (!workspaceId || workspaceId !== auth.workspaceId) {
      return json(
        { error: "Workspace does not match the provided API key." },
        403,
      );
    }

    if (!auth.projectId && !projectId) {
      return json({ error: "projectId is required." }, 400);
    }

    if (auth.projectId && projectId && auth.projectId !== projectId) {
      return json(
        { error: "API key is restricted to a different project." },
        403,
      );
    }

    const collections = await deps.loadWorkspaceCollectionsForSync({
      workspaceId,
      collectionId,
      projectId: auth.projectId ?? projectId,
    });

    return json({
      workspaceId,
      pulledAt: new Date().toISOString(),
      collections: collections.map(deps.toSyncCollection),
    });
  } catch (error) {
    return handleError(error);
  }
}

export const Route = createFileRoute("/api/schema/pull")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => handleSchemaPull(request),
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

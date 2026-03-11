import { createFileRoute } from "@tanstack/react-router";
import {
  applyWorkspaceSchemaPush,
  verifySchemaApiKey,
  type SchemaPushPayload,
} from "@/lib/schema-sync";

const schemaPushDeps = {
  verifySchemaApiKey,
  applyWorkspaceSchemaPush,
};

type SchemaPushDeps = typeof schemaPushDeps;

export async function handleSchemaPush(
  request: Request,
  deps: SchemaPushDeps = schemaPushDeps,
) {
  try {
    const auth = await deps.verifySchemaApiKey(request, "push");
    const body = (await request.json()) as SchemaPushPayload;

    if (!body.workspaceId || body.workspaceId !== auth.workspaceId) {
      return json(
        { error: "Workspace does not match the provided API key." },
        403,
      );
    }

    if (!auth.projectId && !body.projectId) {
      return json({ error: "projectId is required." }, 400);
    }

    if (auth.projectId) {
      if (body.projectId && body.projectId !== auth.projectId) {
        return json(
          { error: "API key is restricted to a different project." },
          403,
        );
      }

      body.projectId = auth.projectId;
    }

    const updatedCollections = await deps.applyWorkspaceSchemaPush(body);

    return json({
      workspaceId: body.workspaceId,
      updatedAt: new Date().toISOString(),
      collections: updatedCollections,
    });
  } catch (error) {
    return handleError(error);
  }
}

export const Route = createFileRoute("/api/schema/push")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => handleSchemaPush(request),
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

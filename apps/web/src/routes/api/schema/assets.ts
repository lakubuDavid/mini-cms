import { createFileRoute } from "@tanstack/react-router";
import { getAssetById, listAssets } from "@/db/queries/assets";
import { getProjectById } from "@/db/queries/projects";
import { verifySchemaApiKey } from "@/lib/schema-sync";
import {
  confirmAssetUploadAction,
  deleteAssetAction,
  requestAssetUploadAction,
} from "@/server/functions/assets";

const schemaAssetsDeps = {
  confirmAssetUploadAction,
  deleteAssetAction,
  getAssetById,
  getProjectById,
  listAssets,
  requestAssetUploadAction,
  verifySchemaApiKey,
};

type SchemaAssetsDeps = typeof schemaAssetsDeps;

export async function handleSchemaAssets(
  request: Request,
  deps: SchemaAssetsDeps = schemaAssetsDeps,
) {
  try {
    const auth = await deps.verifySchemaApiKey(request, "push");

    if (request.method === "GET") {
      const url = new URL(request.url);
      const workspaceId = url.searchParams.get("workspaceId");
      const projectId = url.searchParams.get("projectId") ?? undefined;
      const assetId = url.searchParams.get("assetId") ?? undefined;

      if (!workspaceId || workspaceId !== auth.workspaceId) {
        return json(
          { error: "Workspace does not match the provided API key." },
          403,
        );
      }

      if (auth.projectId && projectId && projectId !== auth.projectId) {
        return json({ error: "API key is restricted to a different project." }, 403);
      }

      if (assetId) {
        const asset = await deps.getAssetById(assetId, workspaceId);

        if (!asset || (auth.projectId && asset.projectId !== auth.projectId)) {
          return json({ error: "Asset not found." }, 404);
        }

        return json({ workspaceId, asset });
      }

      const payload = await deps.listAssets({
        organizationId: workspaceId,
        projectId: auth.projectId ?? projectId,
        page: parseNumberParam(url.searchParams.get("page"), 1),
        limit: parseNumberParam(url.searchParams.get("limit"), 100),
      });

      return json({ workspaceId, ...payload });
    }

    const body = (await request.json()) as {
      action: "request-upload" | "confirm-upload" | "delete";
      workspaceId: string;
      projectId?: string;
      assetId?: string;
      filename?: string;
      contentType?: string;
      size?: number;
    };

    if (!body.workspaceId || body.workspaceId !== auth.workspaceId) {
      return json(
        { error: "Workspace does not match the provided API key." },
        403,
      );
    }

    const effectiveProjectId = auth.projectId ?? body.projectId;

    if (auth.projectId && body.projectId && body.projectId !== auth.projectId) {
      return json({ error: "API key is restricted to a different project." }, 403);
    }

    if (body.action === "request-upload") {
      if (!effectiveProjectId || !body.filename || !body.contentType || body.size == null) {
        return json(
          { error: "projectId, filename, contentType, and size are required." },
          400,
        );
      }

      const project = await deps.getProjectById(effectiveProjectId, body.workspaceId);

      if (!project) {
        return json({ error: "Project not found." }, 404);
      }

      const payload = await deps.requestAssetUploadAction({
        organizationId: body.workspaceId,
        projectId: effectiveProjectId,
        filename: body.filename,
        contentType: body.contentType,
        size: body.size,
      });

      return json({ workspaceId: body.workspaceId, ...payload });
    }

    if (!body.assetId) {
      return json({ error: "assetId is required." }, 400);
    }

    const asset = await deps.getAssetById(body.assetId, body.workspaceId);

    if (!asset || (auth.projectId && asset.projectId !== auth.projectId)) {
      return json({ error: "Asset not found." }, 404);
    }

    if (body.action === "confirm-upload") {
      const confirmedAsset = await deps.confirmAssetUploadAction({
        id: body.assetId,
        organizationId: body.workspaceId,
      });

      return json({ workspaceId: body.workspaceId, asset: confirmedAsset });
    }

    const result = await deps.deleteAssetAction({
      id: body.assetId,
      organizationId: body.workspaceId,
    });

    return json({ success: result.success, id: body.assetId });
  } catch (error) {
    return handleError(error);
  }
}

export const Route = createFileRoute("/api/schema/assets" as never)({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => handleSchemaAssets(request),
      POST: async ({ request }: { request: Request }) => handleSchemaAssets(request),
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

function parseNumberParam(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

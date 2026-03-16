import { createFileRoute } from "@tanstack/react-router";
import { getCollectionById, getCollectionBySlug } from "@/db/queries/collections";
import { getItemById } from "@/db/queries/items";
import {
  createItemAction,
  deleteItemAction,
  updateItemAction,
} from "@/server/functions/items";
import { verifySchemaApiKey } from "@/lib/schema-sync";

const schemaItemsDeps = {
  createItemAction,
  deleteItemAction,
  getCollectionById,
  getCollectionBySlug,
  getItemById,
  updateItemAction,
  verifySchemaApiKey,
};

type SchemaItemsDeps = typeof schemaItemsDeps;

export async function handleSchemaItems(
  request: Request,
  deps: SchemaItemsDeps = schemaItemsDeps,
) {
  try {
    const auth = await deps.verifySchemaApiKey(request, "push");
    const body = (await request.json()) as {
      action: "insert" | "update" | "delete";
      workspaceId: string;
      projectId?: string;
      collectionId?: string;
      collection?: string;
      itemId?: string;
      values?: Record<string, string | number | boolean | null>;
      items?: Array<Record<string, string | number | boolean | null>>;
      order?: number;
      merge?: boolean;
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

    const collection = body.collectionId
      ? await deps.getCollectionById(body.collectionId, body.workspaceId, effectiveProjectId)
      : body.collection
        ? await deps.getCollectionBySlug(body.collection, body.workspaceId, effectiveProjectId)
        : null;

    if (body.action === "insert") {
      if (!collection) {
        return json({ error: "Collection not found." }, 404);
      }

       if (body.items?.length) {
        const items = await Promise.all(
          body.items.map((values, index) =>
            deps.createItemAction(
              collection.id,
              collection.slug,
              values,
              body.order !== undefined ? body.order + index : undefined,
            )
          ),
        );

        return json({ collectionId: collection.id, items });
      }

      const item = await deps.createItemAction(
        collection.id,
        collection.slug,
        body.values ?? {},
        body.order,
      );

      return json({ collectionId: collection.id, item });
    }

    if (!body.itemId) {
      return json({ error: "itemId is required." }, 400);
    }

    if (!collection) {
      return json({ error: "Collection not found." }, 404);
    }

    const existingItem = await deps.getItemById(body.itemId);

    if (!existingItem || existingItem.collectionId !== collection.id) {
      return json({ error: "Item not found." }, 404);
    }

    if (body.action === "update") {
      const nextValues = body.merge
        ? {
            ...existingItem.data,
            ...(body.values ?? {}),
          }
        : (body.values ?? {});

      const item = await deps.updateItemAction(
        body.itemId,
        collection.slug,
        nextValues,
      );

      return json({ collectionId: collection.id, item });
    }

    await deps.deleteItemAction(body.itemId, collection.slug);

    return json({ success: true, id: body.itemId });
  } catch (error) {
    return handleError(error);
  }
}

export const Route = createFileRoute("/api/schema/items")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => handleSchemaItems(request),
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

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  applyWorkspaceSchemaPush,
  toSyncCollection,
  verifySchemaApiKey,
} from "../../src/lib/schema-sync";

describe("schema-sync", () => {
  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
  });

  test("verifySchemaApiKey reads bearer tokens and returns workspace scope", async () => {
    const result = await verifySchemaApiKey(
      new Request("https://cms.example.com/api/schema/pull", {
        headers: {
          authorization: "Bearer mcms_test_key",
        },
      }),
      "pull",
      {
        verifyApiKey: mock(() =>
          Promise.resolve({
            valid: true,
            key: {
              id: "key_1",
              referenceId: "ws_123",
              metadata: { projectId: "project_123" },
            },
          }),
        ),
      } as never,
    );

    expect(result.workspaceId).toBe("ws_123");
    expect(result.projectId).toBe("project_123");
  });

  test("verifySchemaApiKey throws unauthorized response when missing key", async () => {
    await expect(
      verifySchemaApiKey(
        new Request("https://cms.example.com/api/schema/pull"),
        "pull",
      ),
    ).rejects.toBeInstanceOf(Response);
  });

  test("toSyncCollection normalizes nullable description", async () => {
    expect(
      toSyncCollection({
        id: "col_1",
        name: "Projects",
        slug: "projects",
        description: null,
        schema: [{ key: "title", label: "Title", type: "text" }],
      } as never),
    ).toEqual({
      id: "col_1",
      name: "Projects",
      slug: "projects",
      description: null,
      schema: [{ key: "title", label: "Title", type: "text" }],
    });
  });

  test("applyWorkspaceSchemaPush creates missing collections", async () => {
    const createCollection = mock((input) =>
      Promise.resolve({
        id: "col_new",
        ...input,
      }),
    );
    const invalidateCollectionCache = mock(() => Promise.resolve());
    const result = await applyWorkspaceSchemaPush({
      workspaceId: "ws_1",
      collections: [
        {
          name: "Projects",
          slug: "projects",
          description: null,
          schema: [{ key: "title", label: "Title", type: "text" }],
        },
      ],
    }, {
      getCollectionById: mock(() => Promise.resolve(undefined)),
      getCollectionBySlug: mock(() => Promise.resolve(undefined)),
      getDefaultProject: mock(() =>
        Promise.resolve({
          id: "project_default_ws_1",
          organizationId: "ws_1",
          name: "Default",
          slug: "default",
          createdAt: "2026-03-09T00:00:00.000Z",
          updatedAt: "2026-03-09T00:00:00.000Z",
          metadata: { isDefault: true },
          apiAccess: { type: "public" as const },
        }),
      ),
      getProjectById: mock(() => Promise.resolve(undefined)),
      createCollection,
      updateCollection: mock(() => Promise.resolve(undefined)),
      invalidateCollectionCache,
    });

    expect(createCollection).toHaveBeenCalledTimes(1);
    expect(invalidateCollectionCache).toHaveBeenCalledWith("projects");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("col_new");
  });
});

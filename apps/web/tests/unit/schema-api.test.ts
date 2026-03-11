import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { makeJsonRequest } from "../common";
import { handleSchemaPull } from "../../src/routes/api/schema/pull";
import { handleSchemaPush } from "../../src/routes/api/schema/push";
import { handleSchemaCollectionItems } from "../../src/routes/api/schema/collection-items";
import { handleSchemaProjects } from "../../src/routes/api/schema/projects";
import { handleSchemaCollections } from "../../src/routes/api/schema/collections";
import { handleSchemaItems } from "../../src/routes/api/schema/items";

describe("schema api routes", () => {
  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
  });

  test("pull route returns collections for matching workspace", async () => {
    const verifySchemaApiKey = mock(() =>
      Promise.resolve({
        workspaceId: "ws_1",
        projectId: null,
        apiKey: {} as never,
      }),
    );
    const loadWorkspaceCollectionsForSync = mock(() =>
      Promise.resolve([
        {
          id: "col_1",
          name: "Projects",
          createdAt: "2026-03-08T00:00:00.000Z",
          updatedAt: "2026-03-08T00:00:00.000Z",
          slug: "projects",
          organizationId: "ws_1",
          projectId: "project_default_ws_1",
          description: null,
          schema: [],
        },
      ]),
    );

    const response = await handleSchemaPull(
      new Request(
        "https://cms.example.com/api/schema/pull?workspaceId=ws_1&projectId=project_default_ws_1",
      ),
      {
        verifySchemaApiKey,
        loadWorkspaceCollectionsForSync,
        toSyncCollection: (value) => ({
          id: value?.id ?? "col_1",
          name: value?.name ?? "Projects",
          slug: value?.slug ?? "projects",
          description: value?.description ?? null,
          schema: value?.schema ?? [],
        }),
      },
    );

    expect(verifySchemaApiKey).toHaveBeenCalledTimes(1);
    expect(loadWorkspaceCollectionsForSync).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { collections: Array<{ slug: string }> };
    expect(body.collections[0]?.slug).toBe("projects");
  });

  test("push route rejects workspace mismatches", async () => {
    const verifySchemaApiKey = mock(() =>
      Promise.resolve({
        workspaceId: "ws_allowed",
        projectId: null,
        apiKey: {} as never,
      }),
    );

    const response = await handleSchemaPush(
      makeJsonRequest("https://cms.example.com/api/schema/push", {
        method: "POST",
        body: {
          workspaceId: "ws_other",
          collections: [],
        },
      }),
      {
        verifySchemaApiKey,
        applyWorkspaceSchemaPush: mock(() => Promise.resolve([])),
      },
    );

    expect(verifySchemaApiKey).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Workspace does not match the provided API key.",
    });
  });

  test("collection-items route requires collectionId", async () => {
    const verifySchemaApiKey = mock(() =>
      Promise.resolve({
        workspaceId: "ws_1",
        projectId: null,
        apiKey: {} as never,
      }),
    );

    const response = await handleSchemaCollectionItems(
      new Request(
        "https://cms.example.com/api/schema/collection-items?workspaceId=ws_1",
      ),
      {
        verifySchemaApiKey,
        getCollectionById: mock(() => Promise.resolve(undefined)),
        listItems: mock(() =>
          Promise.resolve({
            items: [],
            pagination: {
              page: 1,
              limit: 100,
              total: 0,
              totalPages: 0,
              hasMore: false,
            },
          }),
        ),
      },
    );

    expect(verifySchemaApiKey).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "collectionId is required.",
    });
  });

  test("collection-items route uses project scope when provided", async () => {
    const verifySchemaApiKey = mock(() =>
      Promise.resolve({
        workspaceId: "ws_1",
        projectId: null,
        apiKey: {} as never,
      }),
    );
    const getCollectionById = mock(() =>
      Promise.resolve({
        id: "col_1",
        name: "Projects",
        slug: "projects",
        projectId: "proj_1",
      }),
    );
    const listItems = mock(() =>
      Promise.resolve({
        items: [],
        pagination: {
          page: 1,
          limit: 100,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      }),
    );

    const response = await handleSchemaCollectionItems(
      new Request(
        "https://cms.example.com/api/schema/collection-items?workspaceId=ws_1&projectId=proj_1&collectionId=col_1",
      ),
      {
        verifySchemaApiKey,
        getCollectionById,
        listItems,
      },
    );

    expect(response.status).toBe(200);
    expect(getCollectionById).toHaveBeenCalledWith("col_1", "ws_1", "proj_1");
  });

  test("collection-items route rejects mismatched project scope", async () => {
    const verifySchemaApiKey = mock(() =>
      Promise.resolve({
        workspaceId: "ws_1",
        projectId: "proj_allowed",
        apiKey: {} as never,
      }),
    );

    const response = await handleSchemaCollectionItems(
      new Request(
        "https://cms.example.com/api/schema/collection-items?workspaceId=ws_1&projectId=proj_other&collectionId=col_1",
      ),
      {
        verifySchemaApiKey,
        getCollectionById: mock(() => Promise.resolve(undefined)),
        listItems: mock(() =>
          Promise.resolve({
            items: [],
            pagination: {
              page: 1,
              limit: 100,
              total: 0,
              totalPages: 0,
              hasMore: false,
            },
          }),
        ),
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "API key is restricted to a different project.",
    });
  });

  test("projects route lists projects for matching workspace", async () => {
    const verifySchemaApiKey = mock(() =>
      Promise.resolve({
        workspaceId: "ws_1",
        projectId: null,
        apiKey: {} as never,
      }),
    );
    const listProjects = mock(() =>
      Promise.resolve([{ id: "project_1", slug: "default", name: "Default" }]),
    );

    const response = await handleSchemaProjects(
      new Request("https://cms.example.com/api/schema/projects?workspaceId=ws_1"),
      {
        verifySchemaApiKey,
        listProjects,
        createProject: mock(() => Promise.resolve(null)),
        deleteProject: mock(() => Promise.resolve(null)),
        getProjectById: mock(() => Promise.resolve(null)),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      workspaceId: "ws_1",
      projects: [{ id: "project_1", slug: "default", name: "Default" }],
    });
  });

  test("collections route rejects project mismatch", async () => {
    const verifySchemaApiKey = mock(() =>
      Promise.resolve({
        workspaceId: "ws_1",
        projectId: "project_allowed",
        apiKey: {} as never,
      }),
    );

    const response = await handleSchemaCollections(
      makeJsonRequest("https://cms.example.com/api/schema/collections", {
        method: "POST",
        body: {
          action: "create",
          workspaceId: "ws_1",
          projectId: "project_other",
          name: "Posts",
          slug: "posts",
          schema: [],
        },
      }),
      {
        verifySchemaApiKey,
        listCollections: mock(() => Promise.resolve({ items: [] })),
        getCollectionById: mock(() => Promise.resolve(null)),
        getCollectionBySlug: mock(() => Promise.resolve(null)),
        createCollectionAction: mock(() => Promise.resolve(null)),
        deleteCollectionAction: mock(() => Promise.resolve(null)),
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "API key is restricted to a different project.",
    });
  });

  test("items route inserts with matching collection", async () => {
    const verifySchemaApiKey = mock(() =>
      Promise.resolve({
        workspaceId: "ws_1",
        projectId: null,
        apiKey: {} as never,
      }),
    );
    const getCollectionBySlug = mock(() =>
      Promise.resolve({ id: "col_1", slug: "posts", projectId: "project_1" }),
    );
    const createItemAction = mock(() =>
      Promise.resolve({ id: "item_1", data: { title: "Hello" } }),
    );

    const response = await handleSchemaItems(
      makeJsonRequest("https://cms.example.com/api/schema/items", {
        method: "POST",
        body: {
          action: "insert",
          workspaceId: "ws_1",
          collection: "posts",
          values: { title: "Hello" },
        },
      }),
      {
        verifySchemaApiKey,
        getCollectionById: mock(() => Promise.resolve(null)),
        getCollectionBySlug,
        getItemById: mock(() => Promise.resolve(null)),
        createItemAction,
        updateItemAction: mock(() => Promise.resolve(null)),
        deleteItemAction: mock(() => Promise.resolve(null)),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      collectionId: "col_1",
      item: { id: "item_1", data: { title: "Hello" } },
    });
  });

  test("items route supports batch inserts", async () => {
    const verifySchemaApiKey = mock(() =>
      Promise.resolve({
        workspaceId: "ws_1",
        projectId: null,
        apiKey: {} as never,
      }),
    );
    const getCollectionBySlug = mock(() =>
      Promise.resolve({ id: "col_1", slug: "posts", projectId: "project_1" }),
    );
    const createItemAction = mock((_: string, __: string, values: Record<string, unknown>) =>
      Promise.resolve({ id: String(values.title), data: values }),
    );

    const response = await handleSchemaItems(
      makeJsonRequest("https://cms.example.com/api/schema/items", {
        method: "POST",
        body: {
          action: "insert",
          workspaceId: "ws_1",
          collection: "posts",
          items: [{ title: "First" }, { title: "Second" }],
        },
      }),
      {
        verifySchemaApiKey,
        getCollectionById: mock(() => Promise.resolve(null)),
        getCollectionBySlug,
        getItemById: mock(() => Promise.resolve(null)),
        createItemAction,
        updateItemAction: mock(() => Promise.resolve(null)),
        deleteItemAction: mock(() => Promise.resolve(null)),
      },
    );

    expect(response.status).toBe(200);
    expect(createItemAction).toHaveBeenCalledTimes(2);
    await expect(response.json()).resolves.toEqual({
      collectionId: "col_1",
      items: [
        { id: "First", data: { title: "First" } },
        { id: "Second", data: { title: "Second" } },
      ],
    });
  });
});

import { describe, expect, mock, test } from "bun:test";
import { makeJsonRequest } from "../common";
import { handleSchemaAssets } from "../../src/routes/api/schema/assets";

describe("schema asset api route", () => {
  test("lists assets for matching workspace", async () => {
    const verifySchemaApiKey = mock(() =>
      Promise.resolve({
        workspaceId: "ws_1",
        projectId: null,
        apiKey: {} as never,
      }),
    );
    const listAssets = mock(() =>
      Promise.resolve({
        items: [
          {
            id: "asset_1",
            organizationId: "ws_1",
            projectId: "proj_1",
            filename: "logo.png",
            originalFilename: "logo.png",
            contentType: "image/png",
            size: 2048,
            storageKey: "ws_1/proj_1/asset_1-logo.png",
            publicUrl: "https://cdn.example.com/ws_1/proj_1/asset_1-logo.png",
            status: "active",
            uploadedById: null,
            createdAt: "2026-03-16T00:00:00.000Z",
            updatedAt: "2026-03-16T00:00:00.000Z",
          },
        ],
        pagination: {
          page: 1,
          limit: 100,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      }),
    );

    const response = await handleSchemaAssets(
      new Request(
        "https://cms.example.com/api/schema/assets?workspaceId=ws_1&projectId=proj_1",
      ),
      {
        verifySchemaApiKey,
        listAssets,
        getAssetById: mock(() => Promise.resolve(null)),
        getProjectById: mock(() => Promise.resolve(null)),
        requestAssetUploadAction: mock(() => Promise.resolve(null)),
        confirmAssetUploadAction: mock(() => Promise.resolve(null)),
        deleteAssetAction: mock(() => Promise.resolve(null)),
      } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      workspaceId: "ws_1",
      items: [{ id: "asset_1", filename: "logo.png" }],
    });
  });

  test("requests an upload url for a matching project", async () => {
    const verifySchemaApiKey = mock(() =>
      Promise.resolve({
        workspaceId: "ws_1",
        projectId: null,
        apiKey: {} as never,
      }),
    );
    const getProjectById = mock(() =>
      Promise.resolve({
        id: "proj_1",
        organizationId: "ws_1",
        name: "Default",
        slug: "default",
        createdAt: "2026-03-16T00:00:00.000Z",
        updatedAt: "2026-03-16T00:00:00.000Z",
        metadata: {},
      }),
    );
    const requestAssetUploadAction = mock(() =>
      Promise.resolve({
        asset: { id: "asset_1" },
        assetId: "asset_1",
        publicUrl: "https://cdn.example.com/file.png",
        uploadUrl: "https://bucket.example.com/upload",
      }),
    );

    const response = await handleSchemaAssets(
      makeJsonRequest("https://cms.example.com/api/schema/assets", {
        method: "POST",
        body: {
          action: "request-upload",
          workspaceId: "ws_1",
          projectId: "proj_1",
          filename: "file.png",
          contentType: "image/png",
          size: 1024,
        },
      }),
      {
        verifySchemaApiKey,
        listAssets: mock(() => Promise.resolve(null)),
        getAssetById: mock(() => Promise.resolve(null)),
        getProjectById,
        requestAssetUploadAction,
        confirmAssetUploadAction: mock(() => Promise.resolve(null)),
        deleteAssetAction: mock(() => Promise.resolve(null)),
      } as never,
    );

    expect(response.status).toBe(200);
    expect(getProjectById).toHaveBeenCalledWith("proj_1", "ws_1");
    await expect(response.json()).resolves.toMatchObject({
      workspaceId: "ws_1",
      assetId: "asset_1",
    });
  });
});

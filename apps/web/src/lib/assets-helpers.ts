import { createServerFn } from "@tanstack/react-start";

export const listAssetsServerFn = createServerFn({ method: "GET" })
  .inputValidator(
    (data:
      | {
          page?: number;
          limit?: number;
          projectId?: string;
          status?: "pending" | "active";
        }
      | undefined) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    const { requireActiveOrganizationId } = await import("./auth-helpers");
    const { listAssetsAction } = await import("../server/functions/assets");

    return listAssetsAction({
      organizationId: await requireActiveOrganizationId(ctx),
      ...data,
    });
  });

export const requestAssetUploadServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      projectId: string;
      filename: string;
      contentType: string;
      size: number;
    }) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    const { requireActiveOrganizationId, requireSessionUserId } = await import(
      "./auth-helpers"
    );
    const { requestAssetUploadAction } = await import(
      "../server/functions/assets"
    );

    return requestAssetUploadAction({
      organizationId: await requireActiveOrganizationId(ctx),
      uploadedById: await requireSessionUserId(ctx),
      ...data,
    });
  });

export const confirmAssetUploadServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    const { requireActiveOrganizationId } = await import("./auth-helpers");
    const { confirmAssetUploadAction } = await import(
      "../server/functions/assets"
    );

    return confirmAssetUploadAction({
      id: data.id,
      organizationId: await requireActiveOrganizationId(ctx),
    });
  });

export const deleteAssetServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    const { requireActiveOrganizationId } = await import("./auth-helpers");
    const { deleteAssetAction } = await import("../server/functions/assets");

    return deleteAssetAction({
      id: data.id,
      organizationId: await requireActiveOrganizationId(ctx),
    });
  });

export const getAssetInfoServerFn = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    const { requireActiveOrganizationId } = await import("./auth-helpers");
    const { getAssetInfoAction } = await import("../server/functions/assets");

    return getAssetInfoAction({
      id: data.id,
      organizationId: await requireActiveOrganizationId(ctx),
    });
  });

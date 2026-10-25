import { createServerFn } from "@tanstack/react-start";

export const listAssetsServerFn = createServerFn({ method: "GET" })
  .validator(
    (data:
      | {
          page?: number;
          limit?: number;
          projectId?: string;
          status?: "pending" | "active";
          q?: string;
          type?: "images" | "videos" | "documents";
          sortBy?: "filename" | "contentType" | "size" | "createdAt";
          order?: "asc" | "desc";
        }
      | undefined) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    const { getActiveProjectContext } = await import("./project-access");
    const { listAssetsAction } = await import("../server/functions/assets");
    const { organizationId, access } = await getActiveProjectContext(ctx);

    if (
      data?.projectId &&
      !access.all &&
      !access.projectIds.includes(data.projectId)
    ) {
      throw new Error("Forbidden: no access to this project");
    }

    return listAssetsAction({
      organizationId,
      ...data,
      projectIds: access.all ? undefined : access.projectIds,
    });
  });

export const requestAssetUploadServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      projectId: string;
      filename: string;
      contentType: string;
      size: number;
    }) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    const { getActiveProjectContext } = await import("./project-access");
    const { requestAssetUploadAction } = await import(
      "../server/functions/assets"
    );
    const { organizationId, userId, access } =
      await getActiveProjectContext(ctx);

    if (!access.all && !access.projectIds.includes(data.projectId)) {
      throw new Error("Forbidden: no access to this project");
    }

    return requestAssetUploadAction({
      organizationId,
      uploadedById: userId,
      ...data,
    });
  });

export const confirmAssetUploadServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    const { requireAssetAccess } = await import("./project-access");
    const { confirmAssetUploadAction } = await import(
      "../server/functions/assets"
    );
    const { organizationId } = await requireAssetAccess(ctx, data.id);

    return confirmAssetUploadAction({
      id: data.id,
      organizationId,
    });
  });

export const deleteAssetServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    const { requireAssetAccess } = await import("./project-access");
    const { deleteAssetAction } = await import("../server/functions/assets");
    const { organizationId } = await requireAssetAccess(ctx, data.id);

    return deleteAssetAction({
      id: data.id,
      organizationId,
    });
  });

export const deleteAssetsServerFn = createServerFn({ method: "POST" })
  .validator((data: { ids: string[] }) => data)
  .handler(async ({ data, ...ctx }) => {
    const { filterAccessibleAssetIds, getActiveProjectContext } = await import(
      "./project-access"
    );
    const { deleteAssetsAction } = await import("../server/functions/assets");
    const { organizationId } = await getActiveProjectContext(ctx);
    const accessibleIds = await filterAccessibleAssetIds(ctx, data.ids);
    const result = await deleteAssetsAction({
      ids: accessibleIds,
      organizationId,
    });

    return {
      deleted: result.deleted,
      failed: data.ids.length - result.deleted,
    };
  });

export const getAssetInfoServerFn = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data, ...ctx }) => {
    const { requireAssetAccess } = await import("./project-access");
    const { getAssetInfoAction } = await import("../server/functions/assets");
    const { organizationId } = await requireAssetAccess(ctx, data.id);

    return getAssetInfoAction({
      id: data.id,
      organizationId,
    });
  });

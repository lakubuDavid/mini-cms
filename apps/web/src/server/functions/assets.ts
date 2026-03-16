import { nanoid } from "nanoid";
import {
  confirmAsset,
  createAsset,
  deleteAsset,
  getAssetById,
  listAssets,
} from "@/db/queries/assets";
import { getProjectById } from "@/db/queries/projects";
import {
  buildAssetStorageKey,
  createPresignedPutUrl,
  deleteStoredAsset,
  getAssetPublicUrl,
  validateAssetUpload,
} from "@/lib/assets";
import { ensureAssetLimit } from "@/lib/demo-limits";
import {
  captureServerError,
  captureServerEvent,
  createAnonymousServerIdentity,
} from "@/lib/posthog";

type RequestAssetUploadInput = {
  organizationId: string;
  projectId: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedById?: string;
};

export async function requestAssetUploadAction(input: RequestAssetUploadInput) {
  const identity = createAnonymousServerIdentity({
    organizationId: input.organizationId,
    projectId: input.projectId,
    subject: input.uploadedById,
  });

  try {
    validateAssetUpload({ contentType: input.contentType, size: input.size });

    const project = await getProjectById(input.projectId, input.organizationId);

    if (!project) {
      throw new Error("Project not found.");
    }

    await ensureAssetLimit(input.projectId);

    const assetId = nanoid();
    const storageKey = buildAssetStorageKey({
      organizationId: input.organizationId,
      projectId: input.projectId,
      id: assetId,
      filename: input.filename,
    });
    const publicUrl = getAssetPublicUrl(storageKey);
    const uploadUrl = await createPresignedPutUrl(storageKey, input.contentType);
    const asset = await createAsset({
      organizationId: input.organizationId,
      projectId: input.projectId,
      filename: input.filename,
      originalFilename: input.filename,
      contentType: input.contentType,
      size: input.size,
      storageKey,
      publicUrl,
      uploadedById: input.uploadedById,
      status: "pending",
    });

    if (!asset) {
      throw new Error("Unable to create asset record.");
    }

    await captureServerEvent({
      event: "asset_upload_requested",
      identity,
      properties: {
        content_type: input.contentType,
        size_bytes: input.size,
      },
    });

    return {
      asset,
      assetId: asset.id,
      publicUrl,
      uploadUrl,
    };
  } catch (error) {
    await captureServerError({
      error,
      identity,
      properties: {
        area: "assets",
        operation: "request_upload",
      },
    });
    throw error;
  }
}

export async function confirmAssetUploadAction(input: {
  id: string;
  organizationId: string;
}) {
  const identity = createAnonymousServerIdentity({
    organizationId: input.organizationId,
    subject: input.id,
  });

  try {
    const asset = await confirmAsset(input.id, input.organizationId);

    if (!asset) {
      throw new Error("Asset not found.");
    }

    await captureServerEvent({
      event: "asset_uploaded",
      identity,
      properties: {
        content_type: asset.contentType,
        size_bytes: asset.size,
      },
    });

    return asset;
  } catch (error) {
    await captureServerError({
      error,
      identity,
      properties: {
        area: "assets",
        operation: "confirm_upload",
      },
    });
    throw error;
  }
}

export async function listAssetsAction(input: {
  organizationId: string;
  page?: number;
  limit?: number;
  projectId?: string;
  status?: "pending" | "active";
}) {
  return listAssets(input);
}

export async function getAssetInfoAction(input: {
  id: string;
  organizationId: string;
}) {
  return getAssetById(input.id, input.organizationId);
}

export async function deleteAssetAction(input: {
  id: string;
  organizationId: string;
}) {
  const identity = createAnonymousServerIdentity({
    organizationId: input.organizationId,
    subject: input.id,
  });

  try {
    const asset = await deleteAsset(input.id, input.organizationId);

    if (!asset) {
      throw new Error("Asset not found.");
    }

    await deleteStoredAsset(asset.storageKey);

    await captureServerEvent({
      event: "asset_deleted",
      identity,
      properties: {
        content_type: asset.contentType,
        size_bytes: asset.size,
      },
    });

    return { success: true, asset };
  } catch (error) {
    await captureServerError({
      error,
      identity,
      properties: {
        area: "assets",
        operation: "delete",
      },
    });
    throw error;
  }
}

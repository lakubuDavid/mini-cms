import { and, count, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { assets } from "@/db/schema";
import {
  buildPagination,
  normalizePagination,
  type PaginationInput,
} from "./shared";

export type AssetStatus = "pending" | "active";

export type CreateAssetInput = {
  organizationId: string;
  projectId: string;
  filename: string;
  originalFilename: string;
  contentType: string;
  size: number;
  storageKey: string;
  publicUrl: string;
  uploadedById?: string;
  status?: AssetStatus;
};

export type ListAssetsInput = PaginationInput & {
  organizationId: string;
  projectId?: string;
  status?: AssetStatus;
};

export async function listAssets(input: ListAssetsInput) {
  const { page, limit, offset } = normalizePagination(input);
  const where = and(
    eq(assets.organizationId, input.organizationId),
    input.projectId ? eq(assets.projectId, input.projectId) : undefined,
    input.status ? eq(assets.status, input.status) : eq(assets.status, "active"),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(assets)
      .where(where)
      .orderBy(desc(assets.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(assets).where(where),
  ]);

  return {
    items,
    pagination: buildPagination(page, limit, total),
  };
}

export async function getAssetById(id: string, organizationId?: string) {
  return db.query.assets.findFirst({
    where: organizationId
      ? and(eq(assets.id, id), eq(assets.organizationId, organizationId))
      : eq(assets.id, id),
  });
}

export async function createAsset(input: CreateAssetInput) {
  const id = nanoid();
  const now = new Date().toISOString();

  await db.insert(assets).values({
    id,
    organizationId: input.organizationId,
    projectId: input.projectId,
    filename: input.filename,
    originalFilename: input.originalFilename,
    contentType: input.contentType,
    size: input.size,
    storageKey: input.storageKey,
    publicUrl: input.publicUrl,
    uploadedById: input.uploadedById,
    status: input.status ?? "pending",
    createdAt: now,
    updatedAt: now,
  });

  return getAssetById(id, input.organizationId);
}

export async function confirmAsset(id: string, organizationId?: string) {
  await db
    .update(assets)
    .set({
      status: "active",
      updatedAt: new Date().toISOString(),
    })
    .where(
      organizationId
        ? and(eq(assets.id, id), eq(assets.organizationId, organizationId))
        : eq(assets.id, id),
    );

  return getAssetById(id, organizationId);
}

export async function deleteAsset(id: string, organizationId?: string) {
  const asset = await getAssetById(id, organizationId);

  if (!asset) {
    return null;
  }

  await db.delete(assets).where(eq(assets.id, id));
  return asset;
}

export async function getAssetCount(projectId: string) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(assets)
    .where(and(eq(assets.projectId, projectId), eq(assets.status, "active")));

  return value;
}

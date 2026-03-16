import { AwsClient } from "aws4fetch";
import { env } from "@/lib/env";

export const MAX_ASSET_FILE_SIZE = 10 * 1024 * 1024;

export const ALLOWED_ASSET_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "application/pdf",
  "video/mp4",
  "video/webm",
] as const;

type AssetStorageConfig = {
  accessKeyId: string;
  bucketName: string;
  endpoint?: string;
  publicUrl: string;
  region: string;
  secretAccessKey: string;
};

let client: AwsClient | null = null;

export function isAssetStorageConfigured() {
  return Boolean(env.S3_BUCKET_NAME);
}

export function assertAssetStorageConfigured() {
  return getAssetStorageConfig();
}

export function sanitizeAssetFilename(filename: string) {
  const trimmed = filename.trim();
  const safe = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return safe || "file";
}

export function buildAssetStorageKey(input: {
  organizationId: string;
  projectId: string;
  id: string;
  filename: string;
}) {
  return `${input.organizationId}/${input.projectId}/${input.id}-${sanitizeAssetFilename(input.filename)}`;
}

export function validateAssetUpload(input: { contentType: string; size: number }) {
  if (!ALLOWED_ASSET_MIME_TYPES.includes(input.contentType as (typeof ALLOWED_ASSET_MIME_TYPES)[number])) {
    throw new Error(`Unsupported file type: ${input.contentType}`);
  }

  if (input.size <= 0) {
    throw new Error("File size must be greater than 0 bytes.");
  }

  if (input.size > MAX_ASSET_FILE_SIZE) {
    throw new Error("File exceeds 10MB upload limit.");
  }
}

export async function createPresignedPutUrl(
  key: string,
  contentType: string,
  expiresIn = 600,
) {
  const config = getAssetStorageConfig();
  const aws = getAwsClient(config);
  const url = new URL(`${getBucketBaseUrl(config)}/${key}`);
  url.searchParams.set("X-Amz-Expires", String(expiresIn));

  const signed = await aws.sign(
    new Request(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
    }),
    {
      aws: {
        region: config.region,
        service: "s3",
        signQuery: true,
      },
    },
  );

  return signed.url;
}

export async function deleteStoredAsset(key: string) {
  const config = getAssetStorageConfig();
  const aws = getAwsClient(config);

  const signed = await aws.sign(
    new Request(`${getBucketBaseUrl(config)}/${key}`, {
      method: "DELETE",
    }),
    {
      aws: {
        region: config.region,
        service: "s3",
      },
    },
  );

  const response = await fetch(signed);

  if (!response.ok && response.status !== 404) {
    throw new Error(`Unable to delete asset from storage (${response.status}).`);
  }
}

export function getAssetPublicUrl(key: string) {
  const config = getAssetStorageConfig();
  return `${config.publicUrl.replace(/\/+$/, "")}/${key}`;
}

function getAwsClient(config: AssetStorageConfig) {
  if (client) {
    return client;
  }

  client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
    service: "s3",
  });

  return client;
}

function getAssetStorageConfig(): AssetStorageConfig {
  if (!env.S3_BUCKET_NAME) {
    throw new Error("Asset storage is not configured.");
  }

  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_REGION || !env.S3_PUBLIC_URL) {
    throw new Error("S3 asset storage is incomplete. Set S3_BUCKET_NAME, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_PUBLIC_URL.");
  }

  return {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    bucketName: env.S3_BUCKET_NAME,
    endpoint: env.S3_ENDPOINT,
    publicUrl: env.S3_PUBLIC_URL,
    region: env.S3_REGION,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  };
}

function getBucketBaseUrl(config: AssetStorageConfig) {
  if (!config.endpoint) {
    return `https://${config.bucketName}.s3.${config.region}.amazonaws.com`;
  }

  const trimmed = config.endpoint.replace(/\/+$/, "");
  const url = new URL(trimmed);
  const pathParts = url.pathname.split("/").filter(Boolean);

  if (url.hostname.startsWith(`${config.bucketName}.`) || pathParts[0] === config.bucketName) {
    return trimmed;
  }

  return `${trimmed}/${config.bucketName}`;
}

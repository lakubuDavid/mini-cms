import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMiniCmsClient } from "./mini.client";

const sampleDirectory = dirname(fileURLToPath(import.meta.url));

await loadDotEnv(join(sampleDirectory, ".env"));

const config = {
  baseUrl: getRequiredEnv("MINI_CMS_BASE_URL"),
  workspaceId: getRequiredEnv("MINI_CMS_WORKSPACE_ID"),
  projectId: getRequiredEnv("MINI_CMS_PROJECT_ID"),
};

const collectionSlug = process.env.MINI_CMS_COLLECTION_SLUG ?? "partners";
const client = createMiniCmsClient(config);
const response = await client.getCollectionItems(collectionSlug);

console.log({
  config,
  collectionSlug,
  itemCount: response.items.length,
  items: response.items,
});

async function loadDotEnv(filePath: string) {
  const contents = await readFile(filePath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

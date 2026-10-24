import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  generateClientSource,
  generateDeclarationsSource,
  generateTypesSource,
  normalizeBaseUrl,
  safePropertyName,
  toJsPropertyName,
  toPascalCase,
  toTsType,
} from "./codegen-core";
import type {
  GenerateResponse,
  ResolvedConfig,
  SyncedCollection,
} from "./types";

export {
  generateClientSource,
  generateDeclarationsSource,
  generateTypesSource,
  normalizeBaseUrl,
  safePropertyName,
  toJsPropertyName,
  toPascalCase,
  toTsType,
};

export async function writeTypesFile(
  filePath: string,
  collections: SyncedCollection[],
  workspaceId: string,
) {
  const contents = generateTypesSource(collections, workspaceId);

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}

export async function writeClientFiles(
  config: ResolvedConfig,
  collections: SyncedCollection[],
): Promise<GenerateResponse> {
  await writeClientFile(config.clientPath, config, collections);
  await writeClientDeclarationsFile(config.declarationsPath, config, collections);

  return {
    clientPath: config.clientPath,
    declarationsPath: config.declarationsPath,
  };
}

async function writeClientFile(
  filePath: string,
  config: ResolvedConfig,
  collections: SyncedCollection[],
) {
  const contents = generateClientSource(config, collections);

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}

async function writeClientDeclarationsFile(
  filePath: string,
  config: ResolvedConfig,
  collections: SyncedCollection[],
) {
  const contents = generateDeclarationsSource(config, collections);

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}

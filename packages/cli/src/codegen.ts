import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { normalizeBaseUrl } from "./file-utils";
import type {
  FieldType,
  GenerateResponse,
  ResolvedConfig,
  SyncedCollection,
} from "./types";

export async function writeTypesFile(
  filePath: string,
  collections: SyncedCollection[],
  workspaceId: string,
) {
  const lines: string[] = [
    "/* eslint-disable */",
    "",
    `export const workspaceId = ${JSON.stringify(workspaceId)} as const;`,
    "",
  ];

  if (!collections.length) {
    lines.push("export type CollectionSlug = never;");
    lines.push("", "export type CollectionMap = {};", "");
    lines.push(
      "type _DefaultFields = {",
      "  _id: string;",
      "  _published: boolean;",
      "};",
      "",
      "export type CollectionItemData<T> = {",
      "  data: T & _DefaultFields;",
      "  id: string;",
      "  createdAt: Date;",
      "  updatedAt: Date;",
      "  order: number",
      "};",
      "",
      "export type CollectionItem<T extends CollectionSlug> = CollectionItemData<CollectionMap[T]>;",
      "",
    );
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
    return;
  }

  lines.push(
    "export type CollectionSlug =",
    ...collections.map((collection, index) => {
      const suffix = index === collections.length - 1 ? ";" : "";
      return `  | ${JSON.stringify(collection.slug)}${suffix}`;
    }),
    "",
  );

  for (const collection of collections) {
    const typeName = `${toPascalCase(collection.slug)}Item`;

    lines.push(`export type ${typeName} = {`);

    if (!collection.schema.length) {
      lines.push("  [key: string]: never;");
    }

    for (const field of collection.schema) {
      lines.push(`  ${safePropertyName(field.key)}: ${toTsType(field.type)};`);
    }

    lines.push("};", "");
  }

  lines.push("export type CollectionMap = {");

  for (const collection of collections) {
    lines.push(
      `  ${JSON.stringify(collection.slug)}: ${toPascalCase(collection.slug)}Item;`,
    );
  }

  lines.push(
    "};",
    "",
    "type _DefaultFields = {",
    "  _id: string;",
    "  _published: boolean;",
    "};",
    "",
    "export type CollectionItemData<T> = {",
    "  data: T & _DefaultFields;",
    "  id: string;",
    "  createdAt: Date;",
    "  updatedAt: Date;",
    "};",
    "",
    "export type CollectionItem<T extends CollectionSlug> = CollectionItemData<CollectionMap[T]>;",
    "",
  );

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
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
  const collectionUnion = collections.length
    ? collections.map((collection) => JSON.stringify(collection.slug)).join(" | ")
    : "never";
  const collectionMapEntries = collections.length
    ? collections.map((collection) => {
        const typeName = `${toPascalCase(collection.slug)}Item`;
        return ` *   ${JSON.stringify(collection.slug)}: ${typeName};`;
      })
    : [" *   [key: string]: never;"];
  const lines: string[] = [
    "/* eslint-disable */",
    "",
    "/**",
    " * @typedef {object} MiniCmsCollectionDefinition",
    " * @property {string | null} id",
    " * @property {string} name",
    " * @property {string} slug",
    " */",
    "",
    ...collections.flatMap((collection) => {
      const typeName = `${toPascalCase(collection.slug)}Item`;

      if (!collection.schema.length) {
        return [
          "/**",
          ` * @typedef {Record<string, never>} ${typeName}`,
          " */",
          "",
        ];
      }

      return [
        "/**",
        ` * @typedef {object} ${typeName}`,
        ...collection.schema.map((field) =>
          ` * @property {${toTsType(field.type)}} ${field.key}`
        ),
        " */",
        "",
      ];
    }),
    `/** @typedef {${collectionUnion}} MiniCmsCollectionSlug */`,
    "",
    "/**",
    " * @typedef {object} MiniCmsCollectionMap",
    ...collectionMapEntries,
    " */",
    "",
    "/**",
    " * @typedef {object} MiniCmsDefaultFields",
    " * @property {string} _id",
    " * @property {boolean} _published",
    " */",
    "",
    "/**",
    " * @template T",
    " * @typedef {object} MiniCmsColllectionItemData",
    " * @property {T & MiniCmsDefaultFields} data",
    " * @property {string} id",
    " * @property {Date} createdAt",
    " * @property {Date} updatedAt",
    " */",
    "",
    "/** @template {MiniCmsCollectionSlug} TSlug @typedef {MiniCmsColllectionItemData<MiniCmsCollectionMap[TSlug]>} MiniCmsCollectionItem */",
    "",
    "/**",
    " * @typedef {object} MiniCmsClientConfig",
    " * @property {string} [baseUrl]",
    " * @property {string} [workspaceId]",
    " * @property {string} [projectId]",
    " */",
    "",
    "/** @typedef {Record<string, string | number | boolean | null | undefined>} MiniCmsQueryFilters */",
    "",
    "/**",
    " * @template {MiniCmsCollectionSlug} TSlug",
    " * @typedef {object} MiniCmsGetCollectionItemsOptions",
    " * @property {string} [collectionId]",
    " * @property {string} [workspaceId]",
    " * @property {string} [projectId]",
    " * @property {number} [page]",
    " * @property {number} [limit]",
    " * @property {string} [query]",
    " * @property {MiniCmsQueryFilters} [filters]",
    " * @property {HeadersInit} [headers]",
    " */",
    "",
    "/**",
    " * @template {MiniCmsCollectionSlug} TSlug",
    " * @typedef {object} MiniCmsCollectionItemsResponse",
    " * @property {{ id: string, slug: string, name: string }} workspace",
    " * @property {{ id: string, slug: string, name: string }} project",
    " * @property {MiniCmsCollectionDefinition & { slug: TSlug, description?: string | null, schema?: Array<{ key: string, label: string, type: string }> }} collection",
    " * @property {Array<MiniCmsCollectionItem<TSlug> >} items",
    " * @property {{ page: number, limit: number, total: number, totalPages: number, hasMore: boolean }} pagination",
    " */",
    "",
    "/** @type {MiniCmsClientConfig} */",
    "const defaultConfig = {",
    `  baseUrl: ${JSON.stringify(normalizeBaseUrl(config.baseUrl).replace(/\/$/, ""))},`,
    `  workspaceId: ${JSON.stringify(config.workspaceId)},`,
    `  projectId: ${JSON.stringify(config.projectId ?? "")},`,
    "};",
    "",
    "/** @type {MiniCmsCollectionDefinition[]} */",
    "const collections = ",
    `${JSON.stringify(
      collections.map((collection) => ({
        id: collection.id ?? null,
        name: collection.name,
        slug: collection.slug,
      })),
      null,
      2,
    )} ;`,
    "",
    "/** @returns {MiniCmsCollectionDefinition[]} */",
    "export function getMiniCmsCollections() {",
    "  return collections.slice();",
    "}",
    "",
    "/**",
    " * @param {MiniCmsClientConfig} [overrides={}]",
    " */",
    "export function createMiniCmsClient(overrides = {}) {",
    "  const runtimeConfig = { ...defaultConfig, ...overrides };",
    "  const collections = {",
    ...collections.map((collection) => {
      const propertyName = toJsPropertyName(collection.slug);
      return `    ${propertyName}: { query: (options = {}) => getCollectionItems(${JSON.stringify(collection.slug)}, options) },`;
    }),
    "  };",
    "",
    "  return {",
    "    config: runtimeConfig,",
    "    collectionDefinitions: getMiniCmsCollections(),",
    "    collections,",
    "    /**",
    "     * @template {MiniCmsCollectionSlug} TSlug",
    "     * @param {TSlug} collectionSlug",
    "     * @param {MiniCmsGetCollectionItemsOptions<TSlug>} [options={}]",
    "     * @returns {Promise<MiniCmsCollectionItemsResponse<TSlug>>}",
    "     */",
    "    getCollectionItems,",
    "  };",
    "",
    "  async function getCollectionItems(collectionSlug, options = {}) {",
    "      const workspaceId = options?.workspaceId ?? runtimeConfig.workspaceId;",
    "      const projectId = options?.projectId ?? runtimeConfig.projectId;",
    "",
    "      if (!runtimeConfig.baseUrl || !workspaceId || !projectId || !collectionSlug) {",
    '      throw new Error("baseUrl, workspaceId, projectId, and collectionSlug are required.");',
    "      }",
    "",
    "      const url = new URL('/api/collections/items', ensureTrailingSlash(runtimeConfig.baseUrl));",
    "      url.searchParams.set('w', workspaceId);",
    "      url.searchParams.set('p', projectId);",
    "",
    "      if (options?.collectionId) {",
    "        url.searchParams.set('collection_id', options.collectionId);",
    "      } else {",
    "        url.searchParams.set('collection_slug', collectionSlug);",
    "      }",
    "",
    "      if (options?.page != null) url.searchParams.set('page', String(options.page));",
    "      if (options?.limit != null) url.searchParams.set('limit', String(options.limit));",
    "      if (options?.query) url.searchParams.set('q', options.query);",
    "",
    "      if (options?.filters) {",
    "        for (const [key, value] of Object.entries(options.filters)) {",
    "          if (value == null || value === '') continue;",
    "          url.searchParams.set(`filter.${key}`, String(value));",
    "        }",
    "      }",
    "",
    "      const response = await fetch(url.toString(), {",
    "        headers: options?.headers ?? {},",
    "      });",
    "",
    "      if (!response.ok) {",
    "        const message = await readMiniCmsError(response);",
    "        throw new Error(message);",
    "      }",
    "",
    "      const payload = await response.json();",
    "",
    "      return {",
    "        ...payload,",
    "        items: Array.isArray(payload?.items)",
    "          ? payload.items.map((item) => ({",
    "              ...item,",
    "              createdAt: new Date(item.createdAt),",
    "              updatedAt: new Date(item.updatedAt),",
    "            }))",
    "          : [],",
    "      };",
    "    }",
    "}",
    "",
    "/**",
    " * @param {Response} response",
    " * @returns {Promise<string>}",
    " */",
    "async function readMiniCmsError(response) {",
    "  try {",
    "    const body = await response.json();",
    "    return body?.error ?? `Request failed with status ${response.status}.`;",
    "  } catch {",
    "    return `Request failed with status ${response.status}.`;",
    "  }",
    "}",
    "",
    "/**",
    " * @param {string} baseUrl",
    " * @returns {string}",
    " */",
    "function ensureTrailingSlash(baseUrl) {",
    "  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;",
    "}",
    "",
    "export { defaultConfig as miniCmsConfig };",
  ];

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function writeClientDeclarationsFile(
  filePath: string,
  config: ResolvedConfig,
  collections: SyncedCollection[],
) {
  const collectionUnion = collections.length
    ? collections.map((collection) => JSON.stringify(collection.slug)).join(" | ")
    : "never";
  const collectionMapEntries = collections.length
    ? collections.map((collection) => {
        const typeName = `${toPascalCase(collection.slug)}Item`;
        return `  ${JSON.stringify(collection.slug)}: ${typeName};`;
      })
    : ["  [key: string]: never;"];
  const collectionHelperEntries = collections.length
    ? collections.map((collection) => {
        const propertyName = toJsPropertyName(collection.slug);
        const slugLiteral = JSON.stringify(collection.slug);
        return `  ${propertyName}: { query(options?: MiniCmsGetCollectionItemsOptions<${slugLiteral}>): Promise<MiniCmsCollectionItemsResponse<${slugLiteral}>>; };`;
      })
    : [];

  const lines: string[] = [
    "export type CollectionSlug = MiniCmsCollectionSlug;",
    "",
    "export type MiniCmsCollectionDefinition = {",
    "  id: string | null;",
    "  name: string;",
    "  slug: string;",
    "};",
    "",
    `export type MiniCmsCollectionSlug = ${collectionUnion};`,
    "",
    ...collections.flatMap((collection) => {
      const typeName = `${toPascalCase(collection.slug)}Item`;

      if (!collection.schema.length) {
        return [
          `export type ${typeName} = {`,
          "  [key: string]: never;",
          "};",
          "",
        ];
      }

      return [
        `export type ${typeName} = {`,
        ...collection.schema.map((field) =>
          `  ${safePropertyName(field.key)}: ${toTsType(field.type)};`
        ),
        "};",
        "",
      ];
    }),
    "export type MiniCmsCollectionMap = {",
    ...collectionMapEntries,
    "};",
    "",
    "type _DefaultFields = {",
    "  _id: string;",
    "  _published: boolean;",
    "};",
    "",
    "export type MiniCmsColllectionItemData<T> = {",
    "  data: T & _DefaultFields;",
    "  id: string;",
    "  createdAt: Date;",
    "  updatedAt: Date;",
    "};",
    "",
    "export type MiniCmsCollectionItem<T extends MiniCmsCollectionSlug> = MiniCmsColllectionItemData<MiniCmsCollectionMap[T]>;",
    "",
    "export type MiniCmsClientConfig = {",
    "  baseUrl?: string;",
    "  workspaceId?: string;",
    "  projectId?: string;",
    "};",
    "",
    "export type MiniCmsQueryFilters = Record<string, string | number | boolean | null | undefined>;",
    "",
    "export type MiniCmsGetCollectionItemsOptions<TSlug extends MiniCmsCollectionSlug = MiniCmsCollectionSlug> = {",
    "  collectionId?: string;",
    "  workspaceId?: string;",
    "  projectId?: string;",
    "  page?: number;",
    "  limit?: number;",
    "  query?: string;",
    "  filters?: MiniCmsQueryFilters;",
    "  headers?: HeadersInit;",
    "};",
    "",
    "export type MiniCmsCollectionItemsResponse<TSlug extends MiniCmsCollectionSlug = MiniCmsCollectionSlug> = {",
    "  workspace: { id: string; slug: string; name: string; };",
    "  project: { id: string; slug: string; name: string; };",
    "  collection: MiniCmsCollectionDefinition & { slug: TSlug; description?: string | null; schema?: Array<{ key: string; label: string; type: string; }>; };",
    "  items: Array<MiniCmsCollectionItem<TSlug> & { order: number; }>;",
    "  pagination: {",
    "    page: number;",
    "    limit: number;",
    "    total: number;",
    "    totalPages: number;",
    "    hasMore: boolean;",
    "  };",
    "};",
    "",
    "export declare const miniCmsConfig: {",
    `  baseUrl: ${JSON.stringify(normalizeBaseUrl(config.baseUrl).replace(/\/$/, ""))};`,
    `  workspaceId: ${JSON.stringify(config.workspaceId)};`,
    `  projectId: ${JSON.stringify(config.projectId ?? "")};`,
    "};",
    "",
    "export declare function getMiniCmsCollections(): MiniCmsCollectionDefinition[];",
    "",
    "export declare function createMiniCmsClient(overrides?: MiniCmsClientConfig): {",
    "  config: { baseUrl?: string; workspaceId?: string; projectId?: string; };",
    "  collectionDefinitions: MiniCmsCollectionDefinition[];",
    "  collections: {",
    ...collectionHelperEntries,
    "  };",
    "  getCollectionItems<TSlug extends MiniCmsCollectionSlug>(collectionSlug: TSlug, options?: MiniCmsGetCollectionItemsOptions<TSlug>): Promise<MiniCmsCollectionItemsResponse<TSlug>>;",
    "};",
  ];

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

function safePropertyName(value: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)
    ? value
    : JSON.stringify(value);
}

export function toJsPropertyName(value: string) {
  const normalized = value.replace(/-/g, "_");
  return safePropertyName(normalized);
}

export function toPascalCase(value: string) {
  const normalized = value.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const words = normalized ? normalized.split(/\s+/) : ["Collection"];
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

export function toTsType(type: FieldType) {
  switch (type) {
    case "text":
    case "url":
    case "date":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
  }
}

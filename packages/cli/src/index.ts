#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { defineCommand, renderUsage, runCommand } from "citty";

type FieldType = "text" | "url" | "number" | "boolean" | "date";

type CollectionField = {
  key: string;
  label: string;
  type: FieldType;
};

type SyncedCollection = {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  schema: CollectionField[];
};

type PullResponse = {
  workspaceId: string;
  pulledAt: string;
  collections: SyncedCollection[];
};

type PushResponse = {
  workspaceId: string;
  updatedAt: string;
  collections: SyncedCollection[];
};

type ListCollectionItemsResponse = {
  workspaceId: string;
  collection: {
    id: string;
    name: string;
    slug: string;
  };
  items: Array<{
    id: string;
    data: Record<string, string | number | boolean | null>;
    order: number;
    createdAt: string;
    updatedAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

type ListProjectsResponse = {
  workspaceId: string;
  projects: Array<{
    id: string;
    name: string;
    slug: string;
    metadata?: Record<string, unknown>;
  }>;
};

type ListCollectionsResponse = {
  workspaceId: string;
  collections: Array<{
    id: string;
    name: string;
    slug: string;
    projectId: string;
    description: string | null;
    schema: CollectionField[];
  }>;
};

type GenerateResponse = {
  clientPath: string;
  declarationsPath: string;
};

type AddSkillResponse = {
  directoryPath: string;
  skillPath: string;
};

type AskQuestion = (question: string) => Promise<string>;

type ResolveConfigOptions = {
  requireApiKey?: boolean;
  requireProjectId?: boolean;
};

type MiniConfig = {
  baseUrl?: string;
  workspaceId?: string;
  projectId?: string;
  apiKey?: string;
  collectionId?: string;
  collectionsPath?: string;
  typesPath?: string;
  clientPath?: string;
  declarationsPath?: string;
};

type ResolvedConfig = {
  configPath: string;
  baseUrl: string;
  workspaceId: string;
  projectId?: string;
  apiKey: string;
  collectionId?: string;
  collectionsPath: string;
  typesPath: string;
  clientPath: string;
  declarationsPath: string;
};

type CommandOptions = {
  config?: string;
  baseUrl?: string;
  workspaceId?: string;
  projectId?: string;
  apiKey?: string;
  collectionId?: string;
  collections?: string;
  itemsFile?: string;
  types?: string;
  client?: string;
  declarations?: string;
  page?: number;
  limit?: number;
  verbose?: boolean;
};

type CliEnv = {
  baseUrl?: string;
  workspaceId?: string;
  projectId?: string;
  apiKey?: string;
};

let isVerboseLoggingEnabled = false;

const CLI_ENV_KEYS = {
  baseUrl: "MINI_CMS_BASE_URL",
  workspaceId: "MINI_CMS_WORKSPACE_ID",
  projectId: "MINI_CMS_PROJECT_ID",
  apiKey: "MINI_CMS_API_KEY",
} as const;

const DEFAULT_CONFIG_PATH = "mini.config.json";
const DEFAULT_COLLECTIONS_PATH = "mini.collections.json";
const DEFAULT_TYPES_PATH = "mini.types.ts";
const DEFAULT_CLIENT_PATH = "mini.client.js";
const DEFAULT_DECLARATIONS_PATH = "mini.client.d.ts";
const DEFAULT_SKILL_DIRECTORY = ".opencode/skills/mini-cms-cli";
const DEFAULT_SKILL_FILE = "SKILL.md";
const PACKAGED_SKILL_CONTENT = `---
name: mini-cms-cli
description: Use the Mini CMS CLI to initialize config, sync schemas, generate client files, and inspect collections
compatibility: opencode
metadata:
  audience: developers
  category: cli
---

# Mini CMS CLI

## Purpose

Use this skill when you need to work with the \`mini-cms\` command-line tool.

This skill is for people using the CLI to sync schemas, inspect collections, and generate local client files.

## Commands

- \`mini-cms init\`
- \`mini-cms pull\`
- \`mini-cms push\`
- \`mini-cms generate\`
- \`mini-cms list\`
- \`mini-cms list-collection\`
- \`mini-cms add-skill\`

## What each command does

### \`mini-cms init\`

Creates \`mini.config.json\` with an interactive prompt.

Use this first when setting up the CLI in a new project.

### \`mini-cms pull\`

Pulls collection schemas from a workspace and writes local files.

Typical result:

- creates or updates \`mini.config.json\`
- creates or updates \`mini.collections.json\`
- creates or updates \`mini.types.ts\`

### \`mini-cms push\`

Pushes local collection definitions from \`mini.collections.json\` or a directory of JSON files to the workspace.

Use this after editing your local collection schema.

### \`mini-cms generate\`

Generates local developer files from your saved config and collection definitions.

Typical result:

- updates \`mini.types.ts\`
- creates or updates \`mini.client.js\`
- creates or updates \`mini.client.d.ts\`

The generated client is browser-friendly and uses \`fetch\`.

### \`mini-cms list\`

Lists collections available to the current workspace and API key.

### \`mini-cms list-collection <collection-id>\`

Lists items in one collection.

Useful for checking content, pagination, and raw API output.

### \`mini-cms add-skill\`

Copies this skill into the current project at \`.opencode/skills/mini-cms-cli/SKILL.md\`.

Use this when you want a local project skill that follows common coding-agent conventions.

## Core files

### \`mini.config.json\`

Stores saved defaults for the CLI.

Common fields:

- \`baseUrl\`
- \`workspaceId\`
- \`projectId\`
- \`apiKey\`
- \`collectionId\`
- \`collectionsPath\`
- \`typesPath\`
- \`clientPath\`
- \`declarationsPath\`

### \`mini.collections.json\`

Stores collection definitions.

Each collection usually includes:

- \`id\`
- \`name\`
- \`slug\`
- \`description\`
- \`schema\`

Each schema field includes:

- \`key\`
- \`label\`
- \`type\`

Supported field types:

- \`text\`
- \`url\`
- \`number\`
- \`boolean\`
- \`date\`

Keys starting with \`_\` are reserved for system fields and should not be defined as custom schema fields.

### \`mini.types.ts\`

Generated TypeScript helpers for your collection shapes.

This file gives you:

- \`workspaceId\`
- \`CollectionSlug\`
- one generated item type per collection
- \`CollectionMap\`
- \`CollectionItem<T>\`

### \`mini.client.js\`

Generated JavaScript client for the public content API.

Main exports:

- \`miniCmsConfig\`
- \`getMiniCmsCollections()\`
- \`createMiniCmsClient()\`

### \`mini.client.d.ts\`

Generated declarations for \`mini.client.js\`.

Use this in TypeScript projects for editor autocomplete and type checking.

## Common usage flow

### First setup

1. Run \`mini-cms init\`
2. Create an API key in the dashboard
3. Run \`mini-cms pull\`
4. Review \`mini.config.json\` and \`mini.collections.json\`
5. Use \`mini-cms generate\` if you want local client files

### Schema workflow

1. Run \`mini-cms pull\`
2. Edit \`mini.collections.json\`
3. Run \`mini-cms push\`
4. Run \`mini-cms generate\` if your app uses generated types or the client

### Inspect content

1. Use \`mini-cms list\` to find collections
2. Use \`mini-cms list-collection <collection-id>\` to inspect items

## Public API expectations

The generated client works with the public content API and sends query params like:

- \`w\`
- \`p\`
- \`collection_id\`
- \`page\`
- \`limit\`
- \`q\`
- \`filter.<fieldKey>\`

## Good practices

- keep \`mini.config.json\` checked carefully if it contains an API key
- treat \`mini.collections.json\` as the source of truth for local schema work
- run \`mini-cms generate\` after schema changes if your app uses generated files
- use \`projectId\` when you want the generated client to default to one project

## Avoid

- do not define custom schema fields that start with \`_\`
- do not edit \`mini.types.ts\` by hand
- do not edit \`mini.client.d.ts\` by hand
- do not assume \`generate\` pulls remote schema; it uses local config and collection files
`;

const sharedArgs = {
  config: {
    type: "string",
    description: "Config file path",
    default: DEFAULT_CONFIG_PATH,
  },
  baseUrl: {
    type: "string",
    description: "Mini CMS base URL",
  },
  workspaceId: {
    type: "string",
    description: "Workspace ID",
  },
  projectId: {
    type: "string",
    description: "Project ID",
  },
  apiKey: {
    type: "string",
    description: "API key",
  },
  collectionId: {
    type: "string",
    description: "Collection ID",
  },
  collections: {
    type: "string",
    description: "Collections file or directory",
  },
  types: {
    type: "string",
    description: "Generated TypeScript file path",
  },
  client: {
    type: "string",
    description: "Generated JavaScript client path",
  },
  declarations: {
    type: "string",
    description: "Generated declaration file path",
  },
  verbose: {
    type: "boolean",
    description: "Enable verbose CLI logging",
  },
} as const;

const miniCmsCommand = defineCommand({
  meta: {
    name: "mini-cms",
    version: "0.0.0",
    description: "Mini CMS CLI",
  },
  subCommands: {
    init: defineCommand({
      meta: {
        name: "init",
        description: "Create mini.config.json with an interactive prompt",
      },
      args: {
        ...sharedArgs,
      },
      async run({ args }) {
        const options = toCommandOptions(args);
        const configPath = resolve(options.config ?? DEFAULT_CONFIG_PATH);
        const existingConfig = await readJsonFile<MiniConfig>(configPath, true) ?? {};
        const envConfig = readCliEnv();
        const directConfig = compactMiniConfig({
          baseUrl: options.baseUrl ?? existingConfig.baseUrl ?? envConfig.baseUrl,
          workspaceId:
            options.workspaceId ?? existingConfig.workspaceId ?? envConfig.workspaceId,
          projectId:
            options.projectId ?? existingConfig.projectId ?? envConfig.projectId,
          apiKey: options.apiKey ?? existingConfig.apiKey ?? envConfig.apiKey,
          collectionId: options.collectionId ?? existingConfig.collectionId,
          collectionsPath:
            options.collections ??
            existingConfig.collectionsPath ??
            DEFAULT_COLLECTIONS_PATH,
          typesPath:
            options.types ?? existingConfig.typesPath ?? DEFAULT_TYPES_PATH,
          clientPath:
            options.client ?? existingConfig.clientPath ?? DEFAULT_CLIENT_PATH,
          declarationsPath:
            options.declarations ??
            existingConfig.declarationsPath ??
            DEFAULT_DECLARATIONS_PATH,
        });
        const hasRequiredDirectValues = !!directConfig.baseUrl && !!directConfig.workspaceId;
        const hasRequiredProjectId = !!directConfig.projectId;
        const config = hasRequiredDirectValues && hasRequiredProjectId
          ? directConfig
          : await withPrompt((ask) => promptForMiniConfig(directConfig, ask));

        await writeJson(configPath, config);

        console.log(`Wrote ${relativeSafe(configPath)}.`);
        console.log("You can now run mini-cms pull.");
      },
    }),
    pull: defineCommand({
      meta: {
        name: "pull",
        description: "Pull all collection schemas and generate local files",
      },
      args: {
        ...sharedArgs,
      },
      async run({ args }) {
        const config = await resolveConfig(toCommandOptions(args), {
          requireProjectId: true,
        });
        const payload = await pullSchemas(config);

        await writeMiniConfig(config);
        const collectionsOutputPath = await writeCollectionsFile(
          config.collectionsPath,
          payload,
        );
        await writeTypesFile(
          config.typesPath,
          payload.collections,
          payload.workspaceId,
        );

        console.log(`Pulled ${payload.collections.length} collection(s).`);
        console.log(`Wrote ${relativeSafe(config.configPath)}.`);
        console.log(`Wrote ${relativeSafe(collectionsOutputPath)}.`);
        console.log(`Wrote ${relativeSafe(config.typesPath)}.`);
      },
    }),
    push: defineCommand({
      meta: {
        name: "push",
        description: "Push local collection definitions to the workspace",
      },
      args: {
        ...sharedArgs,
      },
      async run({ args }) {
        const config = await resolveConfig(toCommandOptions(args), {
          requireProjectId: true,
        });
        const collections = await loadCollectionsInput(
          config.collectionsPath,
          config.collectionId,
        );
        const payload = await pushSchemas(config, collections);

        console.log(`Pushed ${payload.collections.length} collection(s).`);
      },
    }),
    "list-projects": defineCommand({
      meta: {
        name: "list-projects",
        description: "List projects available to the API key",
      },
      args: {
        config: sharedArgs.config,
        baseUrl: sharedArgs.baseUrl,
        workspaceId: sharedArgs.workspaceId,
        projectId: sharedArgs.projectId,
        apiKey: sharedArgs.apiKey,
      },
      async run({ args }) {
        const config = await resolveConfig(toCommandOptions(args));
        const payload = await listProjects(config);

        if (!payload.projects.length) {
          console.log("No projects found.");
          return;
        }

        for (const project of payload.projects) {
          console.log(`${project.id ?? "-"}  ${project.slug}  ${project.name}`);
        }
      },
    }),
    project: defineCommand({
      meta: {
        name: "project",
        description: "Manage projects",
      },
      subCommands: {
        create: defineCommand({
          meta: {
            name: "create",
            description: "Create a project",
          },
          args: {
            config: sharedArgs.config,
            baseUrl: sharedArgs.baseUrl,
            workspaceId: sharedArgs.workspaceId,
            projectId: sharedArgs.projectId,
            apiKey: sharedArgs.apiKey,
            name: {
              type: "string",
              description: "Project name",
            },
            slug: {
              type: "string",
              description: "Project slug",
            },
          },
          async run({ args }) {
            const config = await resolveConfig(toCommandOptions(args));
            const name = getStringArg(args.name);
            const slug = getStringArg(args.slug);

            if (!name || !slug) {
              throw new Error("--name and --slug are required.");
            }

            const payload = await createProjectWithApi(config, { name, slug });
            console.log(JSON.stringify(payload, null, 2));
          },
        }),
        delete: defineCommand({
          meta: {
            name: "delete",
            description: "Delete a project by slug or id",
          },
          args: {
            config: sharedArgs.config,
            baseUrl: sharedArgs.baseUrl,
            workspaceId: sharedArgs.workspaceId,
            apiKey: sharedArgs.apiKey,
            project: {
              type: "positional",
              description: "Project slug or id",
            },
          },
          async run({ args }) {
            const config = await resolveConfig(toCommandOptions(args));
            const project = getRequiredStringArg(args.project, "project");
            const resolvedProject = await resolveProjectIdentifier(config, project);
            const payload = await deleteProjectWithApi(config, resolvedProject.id);

            console.log(JSON.stringify(payload, null, 2));
          },
        }),
      },
    }),
    "list-collections": defineCommand({
      meta: {
        name: "list-collections",
        description: "List collections available to the API key",
      },
      args: {
        config: sharedArgs.config,
        baseUrl: sharedArgs.baseUrl,
        workspaceId: sharedArgs.workspaceId,
        projectId: sharedArgs.projectId,
        apiKey: sharedArgs.apiKey,
      },
      async run({ args }) {
        const config = await resolveConfig(toCommandOptions(args));
        const payload = await listCollectionsWithApi(config);

        if (!payload.collections.length) {
          console.log("No collections found.");
          return;
        }

        for (const collection of payload.collections) {
          console.log(`${collection.id ?? "-"}  ${collection.slug}  ${collection.name}`);
        }
      },
    }),
    collection: defineCommand({
      meta: {
        name: "collection",
        description: "Manage collections and items",
      },
      subCommands: {
        create: defineCommand({
          meta: {
            name: "create",
            description: "Create a collection",
          },
          args: {
            config: sharedArgs.config,
            baseUrl: sharedArgs.baseUrl,
            workspaceId: sharedArgs.workspaceId,
            projectId: sharedArgs.projectId,
            apiKey: sharedArgs.apiKey,
            name: {
              type: "string",
              description: "Collection name",
            },
            slug: {
              type: "string",
              description: "Collection slug",
            },
            description: {
              type: "string",
              description: "Collection description",
            },
            schema: {
              type: "string",
              description: "Schema JSON file path",
            },
          },
          async run({ args }) {
            const config = await resolveConfig(toCommandOptions(args));
            const name = getStringArg(args.name);
            const slug = getStringArg(args.slug);

            if (!name || !slug) {
              throw new Error("--name and --slug are required.");
            }

            const schemaPath = getStringArg(args.schema);
            const schema = schemaPath
              ? (await readJsonFile<CollectionField[]>(resolve(schemaPath)))
              : [];

            const payload = await createCollectionWithApi(config, {
              name,
              slug,
              description: getStringArg(args.description),
              schema,
            });

            console.log(JSON.stringify(payload, null, 2));
          },
        }),
        delete: defineCommand({
          meta: {
            name: "delete",
            description: "Delete a collection by slug or id",
          },
          args: {
            config: sharedArgs.config,
            baseUrl: sharedArgs.baseUrl,
            workspaceId: sharedArgs.workspaceId,
            projectId: sharedArgs.projectId,
            apiKey: sharedArgs.apiKey,
            collection: {
              type: "positional",
              description: "Collection slug or id",
            },
          },
          async run({ args }) {
            const config = await resolveConfig(toCommandOptions(args));
            const collection = getRequiredStringArg(args.collection, "collection");
            const resolvedCollection = await resolveCollectionIdentifier(config, collection);
            const payload = await deleteCollectionWithApi(config, {
              id: resolvedCollection.id,
              slug: resolvedCollection.slug,
            });

            console.log(JSON.stringify(payload, null, 2));
          },
        }),
        item: defineCommand({
          meta: {
            name: "item",
            description: "Manage collection items",
          },
          subCommands: {
            list: defineCommand({
              meta: {
                name: "list",
                description: "List items in one collection",
              },
              args: {
                config: sharedArgs.config,
                baseUrl: sharedArgs.baseUrl,
                workspaceId: sharedArgs.workspaceId,
                projectId: sharedArgs.projectId,
                apiKey: sharedArgs.apiKey,
                page: {
                  type: "string",
                  description: "Page number",
                  default: "1",
                },
                limit: {
                  type: "string",
                  description: "Items per page",
                  default: "100",
                },
                collection: {
                  type: "positional",
                  description: "Collection slug or id",
                },
              },
              async run({ args }) {
                const config = await resolveConfig(toCommandOptions(args));
                const collection = getRequiredStringArg(args.collection, "collection");
                const resolvedCollection = await resolveCollectionIdentifier(config, collection);
                const payload = await listCollectionItems(config, {
                  collectionId: resolvedCollection.id,
                  projectId: config.projectId,
                  page: getNumberArg(args.page) ?? 1,
                  limit: getNumberArg(args.limit) ?? 100,
                });

                console.log(JSON.stringify(payload, null, 2));
              },
            }),
            insert: defineCommand({
              meta: {
                name: "insert",
                description: "Insert an item into a collection",
              },
              args: {
                config: sharedArgs.config,
                baseUrl: sharedArgs.baseUrl,
                workspaceId: sharedArgs.workspaceId,
                projectId: sharedArgs.projectId,
                apiKey: sharedArgs.apiKey,
                items: {
                  type: "string",
                  description: 'Item values like "field1=value;field2=value"',
                },
                itemsFile: {
                  type: "string",
                  description: "JSON file containing an array of item objects",
                },
                collection: {
                  type: "positional",
                  description: "Collection slug or id",
                },
              },
              async run({ args }) {
                const config = await resolveConfig(toCommandOptions(args));
                const collection = getRequiredStringArg(args.collection, "collection");
                const resolvedCollection = await resolveCollectionIdentifier(config, collection);
                const items = getStringArg(args.items);
                const itemsFile = getStringArg(args.itemsFile);

                if (!items && !itemsFile) {
                  const stdinPayload = await readItemsFromStdin();

                  if (!stdinPayload) {
                    throw new Error("--items, --items-file, or stdin JSON is required.");
                  }

                  const payload = await mutateCollectionItemWithApi(config, {
                    action: "insert",
                    collection: resolvedCollection.slug,
                    collectionId: resolvedCollection.id,
                    values: Array.isArray(stdinPayload) ? undefined : stdinPayload,
                    items: Array.isArray(stdinPayload) ? stdinPayload : undefined,
                  });

                  console.log(JSON.stringify(payload, null, 2));
                  return;
                }

                if (items && itemsFile) {
                  throw new Error("Use either --items or --items-file, not both.");
                }

                const batchItems = itemsFile
                  ? await readJsonFile<Array<Record<string, string | number | boolean | null>>>(
                    resolve(itemsFile),
                  )
                  : undefined;

                const payload = await mutateCollectionItemWithApi(config, {
                  action: "insert",
                  collection: resolvedCollection.slug,
                  collectionId: resolvedCollection.id,
                  values: items ? parseKeyValueInput(items) : undefined,
                  items: batchItems,
                });

                console.log(JSON.stringify(payload, null, 2));
              },
            }),
            update: defineCommand({
              meta: {
                name: "update",
                description: "Update an item in a collection",
              },
              args: {
                config: sharedArgs.config,
                baseUrl: sharedArgs.baseUrl,
                workspaceId: sharedArgs.workspaceId,
                projectId: sharedArgs.projectId,
                apiKey: sharedArgs.apiKey,
                id: {
                  type: "string",
                  description: "Item ID",
                },
                value: {
                  type: "string",
                  description: 'Updated values like "field1=value;field2=value"',
                },
                collection: {
                  type: "positional",
                  description: "Collection slug or id",
                },
              },
              async run({ args }) {
                const config = await resolveConfig(toCommandOptions(args));
                const collection = getRequiredStringArg(args.collection, "collection");
                const resolvedCollection = await resolveCollectionIdentifier(config, collection);
                const id = getStringArg(args.id);
                const value = getStringArg(args.value);

                if (!id || !value) {
                  throw new Error("--id and --value are required.");
                }

                const payload = await mutateCollectionItemWithApi(config, {
                  action: "update",
                  collection: resolvedCollection.slug,
                  collectionId: resolvedCollection.id,
                  itemId: id,
                  values: parseKeyValueInput(value),
                });

                console.log(JSON.stringify(payload, null, 2));
              },
            }),
            delete: defineCommand({
              meta: {
                name: "delete",
                description: "Delete an item from a collection",
              },
              args: {
                config: sharedArgs.config,
                baseUrl: sharedArgs.baseUrl,
                workspaceId: sharedArgs.workspaceId,
                projectId: sharedArgs.projectId,
                apiKey: sharedArgs.apiKey,
                id: {
                  type: "string",
                  description: "Item ID",
                },
                collection: {
                  type: "positional",
                  description: "Collection slug or id",
                },
              },
              async run({ args }) {
                const config = await resolveConfig(toCommandOptions(args));
                const collection = getRequiredStringArg(args.collection, "collection");
                const resolvedCollection = await resolveCollectionIdentifier(config, collection);
                const id = getStringArg(args.id);

                if (!id) {
                  throw new Error("--id is required.");
                }

                const payload = await mutateCollectionItemWithApi(config, {
                  action: "delete",
                  collection: resolvedCollection.slug,
                  collectionId: resolvedCollection.id,
                  itemId: id,
                });

                console.log(JSON.stringify(payload, null, 2));
              },
            }),
          },
        }),
      },
    }),
    generate: defineCommand({
      meta: {
        name: "generate",
        description: "Generate a fetch-based browser client and typings",
      },
      args: {
        config: sharedArgs.config,
        baseUrl: sharedArgs.baseUrl,
        workspaceId: sharedArgs.workspaceId,
        projectId: sharedArgs.projectId,
        collectionId: sharedArgs.collectionId,
        collections: sharedArgs.collections,
        types: sharedArgs.types,
        client: sharedArgs.client,
        declarations: sharedArgs.declarations,
      },
      async run({ args }) {
        const config = await resolveConfig(toCommandOptions(args), {
          requireApiKey: false,
        });
        const collections = await loadCollectionsInput(
          config.collectionsPath,
          config.collectionId,
        );

        await writeMiniConfig(config);
        await writeTypesFile(config.typesPath, collections, config.workspaceId);
        const output = await writeClientFiles(config, collections);

        console.log(`Generated ${relativeSafe(output.clientPath)}.`);
        console.log(`Generated ${relativeSafe(output.declarationsPath)}.`);
      },
    }),
    "add-skill": defineCommand({
      meta: {
        name: "add-skill",
        description: "Install the Mini CMS CLI skill into the current project",
      },
      async run() {
        const output = await installSkill(process.cwd());

        console.log(`Installed skill in ${relativeSafe(output.directoryPath)}.`);
        console.log(`Wrote ${relativeSafe(output.skillPath)}.`);
      },
    }),
  },
});

const commandSpecs = [
  { words: ["init"], usage: "init", requiredArgs: 0 },
  { words: ["pull"], usage: "pull", requiredArgs: 0 },
  { words: ["push"], usage: "push", requiredArgs: 0 },
  { words: ["list-projects"], usage: "list-projects", requiredArgs: 0 },
  { words: ["project", "create"], usage: "project create", requiredArgs: 0 },
  {
    words: ["project", "delete"],
    usage: "project delete <project>",
    requiredArgs: 1,
  },
  {
    words: ["list-collections"],
    usage: "list-collections",
    requiredArgs: 0,
  },
  {
    words: ["collection", "create"],
    usage: "collection create",
    requiredArgs: 0,
  },
  {
    words: ["collection", "delete"],
    usage: "collection delete <collection>",
    requiredArgs: 1,
  },
  {
    words: ["collection", "item", "list"],
    usage: "collection item list <collection>",
    requiredArgs: 1,
  },
  {
    words: ["collection", "item", "insert"],
    usage: "collection item insert <collection>",
    requiredArgs: 1,
  },
  {
    words: ["collection", "item", "update"],
    usage: "collection item update <collection>",
    requiredArgs: 1,
  },
  {
    words: ["collection", "item", "delete"],
    usage: "collection item delete <collection>",
    requiredArgs: 1,
  },
  { words: ["generate"], usage: "generate", requiredArgs: 0 },
  { words: ["add-skill"], usage: "add-skill", requiredArgs: 0 },
] as const;

export async function run(argv = process.argv) {
  try {
    const rawArgs = argv.slice(2);
    isVerboseLoggingEnabled = rawArgs.includes("--verbose");

    if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
      const [command, parent] = resolveUsageCommand(miniCmsCommand, rawArgs);
      console.log(await renderUsage(command, parent));
      return;
    }

    if (rawArgs.length === 1 && rawArgs[0] === "--version") {
      console.log("0.0.0");
      return;
    }

    const incompleteCommandError = getIncompleteCommandError(argv);

    if (incompleteCommandError) {
      throw new Error(incompleteCommandError);
    }

    return await runCommand(miniCmsCommand, { rawArgs });
  } catch (error) {
    throw formatCliError(error, argv);
  }
}

if (import.meta.main) {
  void run().catch((error) => {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  });
}

function formatCliError(error: unknown, argv: string[]) {
  if (error instanceof Error) {
    return new Error(toFriendlyCommandError(error.message, argv));
  }

  return new Error("Unexpected error.");
}

function toFriendlyCommandError(message: string, argv: string[]) {
  const input = argv.slice(2).join(" ").trim();

  if (message.includes("Unused args:")) {
    const suggestion = suggestCommand(input);

    return suggestion
      ? `Unknown command usage: ${input}. Did you mean \`${suggestion}\`?`
      : `Unknown command usage: ${input}. Run \`mini-cms --help\` to see available commands.`;
  }

  if (message.includes("Unknown option")) {
    return `${message}. Run \`mini-cms --help\` to see available commands.`;
  }

  if (message.includes("missing required args")) {
    return `${message}. Run \`mini-cms --help\` to see available commands.`;
  }

  return message;
}

function suggestCommand(input: string) {
  const normalized = input.trim().replace(/\s+/g, " ");
  const suggestions: Array<[string, string]> = [
    ["push list-collections", "list-collections"],
    ["push list-projects", "list-projects"],
    ["collection list", "list-collections"],
    ["project list", "list-projects"],
    ["collection testimonials list", "collection item list testimonials"],
  ];

  return suggestions.find(([wrong]) => wrong === normalized)?.[1] ?? null;
}

function getIncompleteCommandError(argv: string[]) {
  const inputTokens = getLeadingCommandTokens(argv.slice(2));

  if (!inputTokens.length) {
    return null;
  }

  const exactMatch = commandSpecs.find(
    (spec) =>
      inputTokens.length >= spec.words.length &&
      spec.words.every((word, index) => inputTokens[index] === word),
  );

  if (exactMatch) {
    const providedArgs = inputTokens.length - exactMatch.words.length;

    if (providedArgs < exactMatch.requiredArgs) {
      return `Incomplete command: ${inputTokens.join(" ")}. Usage: \`mini-cms ${exactMatch.usage}\`.`;
    }

    return null;
  }

  const matchingSpecs = commandSpecs.filter((spec) =>
    inputTokens.every((token, index) => spec.words[index] === token),
  );

  if (!matchingSpecs.length) {
    return null;
  }

  const suggestions = matchingSpecs
    .map((spec) => `\`${spec.usage}\``)
    .filter((usage, index, list) => list.indexOf(usage) === index)
    .slice(0, 3);

  if (!suggestions.length) {
    return `Incomplete command: ${inputTokens.join(" ")}. Run \`mini-cms --help\` to see available commands.`;
  }

  return `Incomplete command: ${inputTokens.join(" ")}. Try ${joinWithOr(suggestions)}.`;
}

function getLeadingCommandTokens(args: string[]) {
  const tokens: string[] = [];

  for (const arg of args) {
    if (arg.startsWith("-")) {
      break;
    }

    tokens.push(arg);
  }

  return tokens;
}

function joinWithOr(values: string[]) {
  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} or ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, or ${values.at(-1)}`;
}

function resolveUsageCommand(
  command: typeof miniCmsCommand,
  rawArgs: string[],
  parent?: typeof miniCmsCommand,
): [typeof miniCmsCommand, typeof miniCmsCommand | undefined] {
  const subCommands = command.subCommands;

  if (!subCommands) {
    return [command, parent];
  }

  const subCommandArgIndex = rawArgs.findIndex((arg) => !arg.startsWith("-"));

  if (subCommandArgIndex < 0) {
    return [command, parent];
  }

  const subCommandName = rawArgs[subCommandArgIndex];

  if (!subCommandName || !(subCommandName in subCommands)) {
    return [command, parent];
  }

  const nextCommand = subCommands[subCommandName as keyof typeof subCommands];

  return resolveUsageCommand(
    nextCommand as typeof miniCmsCommand,
    rawArgs.slice(subCommandArgIndex + 1),
    command,
  );
}

function getStringArg(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getRequiredStringArg(value: unknown, name: string) {
  const normalized = getStringArg(value);

  if (!normalized) {
    throw new Error(`${name} is required.`);
  }

  return normalized;
}

function getNumberArg(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

function toCommandOptions(args: Record<string, unknown>): CommandOptions {
  return {
    config: getStringArg(args.config),
    baseUrl: getStringArg(args.baseUrl),
    workspaceId: getStringArg(args.workspaceId),
    projectId: getStringArg(args.projectId),
    apiKey: getStringArg(args.apiKey),
    collectionId: getStringArg(args.collectionId),
    collections: getStringArg(args.collections),
    itemsFile: getStringArg(args.itemsFile),
    types: getStringArg(args.types),
    client: getStringArg(args.client),
    declarations: getStringArg(args.declarations),
    page: getNumberArg(args.page),
    limit: getNumberArg(args.limit),
    verbose: args.verbose === true,
  };
}

function logVerbose(message: string, details?: unknown) {
  if (!isVerboseLoggingEnabled) {
    return;
  }

  if (details === undefined) {
    console.error(`[mini-cms] ${message}`);
    return;
  }

  console.error(`[mini-cms] ${message}`, details);
}

async function resolveConfig(
  options: CommandOptions,
  resolveOptions: ResolveConfigOptions = {},
): Promise<ResolvedConfig> {
  const configPath = resolve(options.config ?? DEFAULT_CONFIG_PATH);
  const fileConfig = await readJsonFile<MiniConfig>(configPath, true);
  const envConfig = readCliEnv();

  const baseUrl = options.baseUrl ?? fileConfig?.baseUrl ?? envConfig.baseUrl ?? "";
  const workspaceId =
    options.workspaceId ?? fileConfig?.workspaceId ?? envConfig.workspaceId ?? "";
  const projectId =
    options.projectId ?? fileConfig?.projectId ?? envConfig.projectId;
  const apiKey = options.apiKey ?? fileConfig?.apiKey ?? envConfig.apiKey ?? "";
  const collectionId = options.collectionId ?? fileConfig?.collectionId;
  const collectionsPath = resolve(
    options.collections ??
      fileConfig?.collectionsPath ??
      DEFAULT_COLLECTIONS_PATH,
  );
  const typesPath = resolve(
    options.types ?? fileConfig?.typesPath ?? DEFAULT_TYPES_PATH,
  );
  const clientPath = resolve(
    options.client ?? fileConfig?.clientPath ?? DEFAULT_CLIENT_PATH,
  );
  const declarationsPath = resolve(
    options.declarations ??
      fileConfig?.declarationsPath ??
      DEFAULT_DECLARATIONS_PATH,
  );

  if (!baseUrl || !workspaceId || ((resolveOptions.requireApiKey ?? true) && !apiKey)) {
    throw new Error(
      (resolveOptions.requireApiKey ?? true)
        ? "Missing required values. Provide --base-url, --workspace-id, and --api-key, define them in mini.config.json, or set MINI_CMS_BASE_URL, MINI_CMS_WORKSPACE_ID, and MINI_CMS_API_KEY."
        : "Missing required values. Provide --base-url and --workspace-id, define them in mini.config.json, or set MINI_CMS_BASE_URL and MINI_CMS_WORKSPACE_ID.",
    );
  }

  if (resolveOptions.requireProjectId && !projectId) {
    throw new Error(
      "Missing required projectId. Provide --project-id, define projectId in mini.config.json, or set MINI_CMS_PROJECT_ID.",
    );
  }

  return {
    configPath,
    baseUrl,
    workspaceId,
    projectId,
    apiKey,
    collectionId,
    collectionsPath,
    typesPath,
    clientPath,
    declarationsPath,
  };
}

function readCliEnv(): CliEnv {
  return {
    baseUrl: readEnvValue(CLI_ENV_KEYS.baseUrl),
    workspaceId: readEnvValue(CLI_ENV_KEYS.workspaceId),
    projectId: readEnvValue(CLI_ENV_KEYS.projectId),
    apiKey: readEnvValue(CLI_ENV_KEYS.apiKey),
  };
}

function readEnvValue(key: string) {
  const value = process.env[key];

  if (!value) {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

async function pullSchemas(config: ResolvedConfig) {
  const url = new URL("/api/schema/pull", normalizeBaseUrl(config.baseUrl));
  url.searchParams.set("workspaceId", config.workspaceId);
  url.searchParams.set("projectId", config.projectId ?? "");

  if (config.collectionId) {
    url.searchParams.set("collectionId", config.collectionId);
  }

  const response = await fetch(url, {
    headers: {
      "x-api-key": config.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as PullResponse;
}

async function pushSchemas(
  config: ResolvedConfig,
  collections: SyncedCollection[],
) {
  const response = await fetch(
    new URL("/api/schema/push", normalizeBaseUrl(config.baseUrl)),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        workspaceId: config.workspaceId,
        projectId: config.projectId,
        collectionId: config.collectionId,
        collections,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as PushResponse;
}

async function listCollectionItems(
  config: ResolvedConfig,
  input: {
    collectionId: string;
    projectId?: string;
    page: number;
    limit: number;
  },
) {
  const url = new URL(
    "/api/schema/collection-items",
    normalizeBaseUrl(config.baseUrl),
  );
  url.searchParams.set("workspaceId", config.workspaceId);
  url.searchParams.set("collectionId", input.collectionId);
  if (input.projectId) {
    url.searchParams.set("projectId", input.projectId);
  }
  url.searchParams.set("page", String(input.page));
  url.searchParams.set("limit", String(input.limit));

  logVerbose("GET /api/schema/collection-items", {
    url: url.toString(),
    workspaceId: config.workspaceId,
    projectId: input.projectId,
    collectionId: input.collectionId,
    page: input.page,
    limit: input.limit,
  });

  const response = await fetch(url, {
    headers: {
      "x-api-key": config.apiKey,
    },
  });

  logVerbose("collection-items response", {
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const payload = (await response.json()) as ListCollectionItemsResponse;
  logVerbose("collection-items payload summary", {
    collection: payload.collection,
    itemCount: payload.items.length,
    pagination: payload.pagination,
  });

  return payload;
}

async function listProjects(config: ResolvedConfig) {
  const url = new URL("/api/schema/projects", normalizeBaseUrl(config.baseUrl));
  url.searchParams.set("workspaceId", config.workspaceId);

  const response = await fetch(url, {
    headers: {
      "x-api-key": config.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as ListProjectsResponse;
}

async function createProjectWithApi(
  config: ResolvedConfig,
  input: { name: string; slug: string },
) {
  const response = await fetch(
    new URL("/api/schema/projects", normalizeBaseUrl(config.baseUrl)),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        action: "create",
        workspaceId: config.workspaceId,
        name: input.name,
        slug: input.slug,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

async function deleteProjectWithApi(config: ResolvedConfig, projectId: string) {
  const response = await fetch(
    new URL("/api/schema/projects", normalizeBaseUrl(config.baseUrl)),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        action: "delete",
        workspaceId: config.workspaceId,
        id: projectId,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

async function listCollectionsWithApi(config: ResolvedConfig) {
  const url = new URL("/api/schema/collections", normalizeBaseUrl(config.baseUrl));
  url.searchParams.set("workspaceId", config.workspaceId);

  if (config.projectId) {
    url.searchParams.set("projectId", config.projectId);
  }

  const response = await fetch(url, {
    headers: {
      "x-api-key": config.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as ListCollectionsResponse;
}

async function createCollectionWithApi(
  config: ResolvedConfig,
  input: {
    name: string;
    slug: string;
    description?: string | null;
    schema?: CollectionField[];
  },
) {
  const response = await fetch(
    new URL("/api/schema/collections", normalizeBaseUrl(config.baseUrl)),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        action: "create",
        workspaceId: config.workspaceId,
        projectId: config.projectId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        schema: input.schema ?? [],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

async function deleteCollectionWithApi(
  config: ResolvedConfig,
  input: { id?: string; slug?: string },
) {
  const response = await fetch(
    new URL("/api/schema/collections", normalizeBaseUrl(config.baseUrl)),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        action: "delete",
        workspaceId: config.workspaceId,
        projectId: config.projectId,
        id: input.id,
        slug: input.slug,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

async function mutateCollectionItemWithApi(
  config: ResolvedConfig,
  input: {
    action: "insert" | "update" | "delete";
    collection?: string;
    collectionId?: string;
    itemId?: string;
    values?: Record<string, string | number | boolean | null>;
    items?: Array<Record<string, string | number | boolean | null>>;
  },
) {
  const response = await fetch(
    new URL("/api/schema/items", normalizeBaseUrl(config.baseUrl)),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        action: input.action,
        workspaceId: config.workspaceId,
        projectId: config.projectId,
        collection: input.collection,
        collectionId: input.collectionId,
        itemId: input.itemId,
        values: input.values,
        items: input.items,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

async function writeMiniConfig(config: ResolvedConfig) {
  const value: MiniConfig = {
    baseUrl: config.baseUrl,
    workspaceId: config.workspaceId,
    ...(config.projectId ? { projectId: config.projectId } : {}),
    apiKey: config.apiKey,
    ...(config.collectionId ? { collectionId: config.collectionId } : {}),
    collectionsPath: relativeSafe(config.collectionsPath),
    typesPath: relativeSafe(config.typesPath),
    clientPath: relativeSafe(config.clientPath),
    declarationsPath: relativeSafe(config.declarationsPath),
  };

  await writeJson(config.configPath, value);
}

async function writeCollectionsFile(filePath: string, payload: PullResponse) {
  const outputPath = await resolveCollectionsOutputPath(filePath);

  await writeJson(outputPath, {
    workspaceId: payload.workspaceId,
    pulledAt: payload.pulledAt,
    collections: payload.collections,
  });

  return outputPath;
}

async function resolveCollectionsOutputPath(filePath: string) {
  const stats = await stat(filePath).catch(() => null);

  if (stats?.isDirectory()) {
    return join(filePath, "mini.collections.json");
  }

  return filePath;
}

async function loadCollectionsInput(filePath: string, collectionId?: string) {
  const stats = await stat(filePath).catch(() => null);

  if (!stats) {
    throw new Error(
      `Collections source not found: ${relativeSafe(filePath)}. Run pull first or create mini.collections.json.`,
    );
  }

  const collections = stats.isDirectory()
    ? await loadCollectionsFromDirectory(filePath)
    : await loadCollectionsFromFile(filePath);

  const filtered = collectionId
    ? collections.filter((collection) => collection.id === collectionId)
    : collections;

  if (collectionId && !filtered.length) {
    throw new Error(
      `Collection ${collectionId} was not found in ${relativeSafe(filePath)}.`,
    );
  }

  return filtered;
}

async function loadCollectionsFromDirectory(directoryPath: string) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const allCollections: SyncedCollection[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || extname(entry.name) !== ".json") {
      continue;
    }

    const filePath = join(directoryPath, entry.name);
    const fileCollections = await loadCollectionsFromFile(filePath);
    allCollections.push(...fileCollections);
  }

  return deduplicateCollections(allCollections);
}

function deduplicateCollections(collections: SyncedCollection[]) {
  const bySlug = new Map<string, SyncedCollection>();

  for (const collection of collections) {
    const existing = bySlug.get(collection.slug);

    if (!existing || (!existing.id && collection.id)) {
      bySlug.set(collection.slug, collection);
    }
  }

  return Array.from(bySlug.values());
}

async function loadCollectionsFromFile(filePath: string) {
  const json = await readJsonFile<
    PullResponse | { collections: SyncedCollection[] } | SyncedCollection
  >(filePath);

  if (Array.isArray((json as { collections?: unknown }).collections)) {
    return normalizeCollections(
      (json as PullResponse | { collections: SyncedCollection[] }).collections,
    );
  }

  if (isCollectionShape(json)) {
    return normalizeCollections([json]);
  }

  throw new Error(`Invalid collections file: ${relativeSafe(filePath)}.`);
}

function normalizeCollections(collections: SyncedCollection[]) {
  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    slug: collection.slug,
    description: collection.description ?? null,
    schema: collection.schema.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
    })),
  }));
}

function isCollectionShape(value: unknown): value is SyncedCollection {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    "name" in value &&
    "slug" in value &&
    "schema" in value &&
    Array.isArray(value.schema)
  );
}

async function writeTypesFile(
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
      "export type CollectionItem<T extends CollectionSlug> = CollectionMap[T];",
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
    "export type CollectionItem<T extends CollectionSlug> = CollectionMap[T];",
    "",
  );

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function writeClientFiles(
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
    " * @property {Array<MiniCmsCollectionMap[TSlug]>} items",
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
    "      return response.json();",
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
    "export type MiniCmsCollectionItem<T extends MiniCmsCollectionSlug> = MiniCmsCollectionMap[T];",
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
    "  items: Array<MiniCmsCollectionItem<TSlug>>;",
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

async function installSkill(projectRoot: string): Promise<AddSkillResponse> {
  const directoryPath = resolve(projectRoot, DEFAULT_SKILL_DIRECTORY);
  const skillPath = join(directoryPath, DEFAULT_SKILL_FILE);

  await mkdir(directoryPath, { recursive: true });
  await writeFile(skillPath, `${PACKAGED_SKILL_CONTENT.trim()}\n`, "utf8");

  return {
    directoryPath,
    skillPath,
  };
}

async function promptForMiniConfig(
  existingConfig: MiniConfig,
  ask: AskQuestion,
): Promise<MiniConfig> {
  const baseUrl = await promptValue(ask, "Base URL", existingConfig.baseUrl, {
    required: true,
  });
  const workspaceId = await promptValue(
    ask,
    "Workspace ID",
    existingConfig.workspaceId,
    { required: true },
  );
  const projectId = await promptValue(
    ask,
    "Default project ID",
    existingConfig.projectId,
  );
  const apiKey = await promptValue(ask, "API key", existingConfig.apiKey);
  const collectionId = await promptValue(
    ask,
    "Default collection ID",
    existingConfig.collectionId,
  );
  const collectionsPath = await promptValue(
    ask,
    "Collections file path",
    existingConfig.collectionsPath ?? DEFAULT_COLLECTIONS_PATH,
    { required: true },
  );
  const typesPath = await promptValue(
    ask,
    "Types file path",
    existingConfig.typesPath ?? DEFAULT_TYPES_PATH,
    { required: true },
  );
  const clientPath = await promptValue(
    ask,
    "Client file path",
    existingConfig.clientPath ?? DEFAULT_CLIENT_PATH,
    { required: true },
  );
  const declarationsPath = await promptValue(
    ask,
    "Declarations file path",
    existingConfig.declarationsPath ?? DEFAULT_DECLARATIONS_PATH,
    { required: true },
  );

  return compactMiniConfig({
    baseUrl,
    workspaceId,
    ...(projectId ? { projectId } : {}),
    ...(apiKey ? { apiKey } : {}),
    ...(collectionId ? { collectionId } : {}),
    collectionsPath,
    typesPath,
    clientPath,
    declarationsPath,
  });
}

function compactMiniConfig(config: MiniConfig): MiniConfig {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined && value !== ""),
  ) as MiniConfig;
}

async function withPrompt<T>(run: (ask: AskQuestion) => Promise<T>) {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await run((question) => readline.question(question));
  } finally {
    readline.close();
  }
}

async function readItemsFromStdin() {
  if (process.stdin.isTTY) {
    return null;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();

  if (!raw) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("stdin must contain valid JSON object or array.");
  }

  if (Array.isArray(parsed)) {
    if (!parsed.every(isRecordValueMap)) {
      throw new Error("stdin JSON array must contain only item objects.");
    }

    return parsed as Array<Record<string, string | number | boolean | null>>;
  }

  if (!isRecordValueMap(parsed)) {
    throw new Error("stdin JSON must be an item object or array of item objects.");
  }

  return parsed as Record<string, string | number | boolean | null>;
}

function isRecordValueMap(value: unknown): value is Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (entry) => entry === null || ["string", "number", "boolean"].includes(typeof entry),
  );
}

async function promptValue(
  ask: AskQuestion,
  label: string,
  defaultValue?: string,
  options?: { required?: boolean },
) {
  while (true) {
    const suffix = defaultValue ? ` [${defaultValue}]` : "";
    const answer = (await ask(`${label}${suffix}: `)).trim();
    const value = answer || defaultValue || "";

    if (options?.required && !value) {
      console.log(`${label} is required.`);
      continue;
    }

    return value;
  }
}

function parseKeyValueInput(value: string) {
  const result: Record<string, string | number | boolean | null> = {};

  for (const segment of value.split(";")) {
    const trimmed = segment.trim();

    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      throw new Error(`Invalid key/value pair: ${trimmed}`);
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key) {
      throw new Error(`Invalid key/value pair: ${trimmed}`);
    }

    result[key] = parseScalarValue(rawValue);
  }

  return result;
}

function parseScalarValue(value: string) {
  const normalized = value.trim();

  if (normalized === "null") {
    return null;
  }

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  const numericValue = Number(normalized);

  if (normalized !== "" && !Number.isNaN(numericValue)) {
    return numericValue;
  }

  return normalized;
}

async function resolveCollectionIdentifier(
  config: ResolvedConfig,
  value: string,
) {
  const payload = await listCollectionsWithApi(config);
  const collection = payload.collections.find(
    (item) => item.id === value || item.slug === value,
  );

  if (!collection) {
    throw new Error(`Collection not found: ${value}`);
  }

  return collection;
}

async function resolveProjectIdentifier(config: ResolvedConfig, value: string) {
  const payload = await listProjects(config);
  const project = payload.projects.find(
    (item) => item.id === value || item.slug === value,
  );

  if (!project) {
    throw new Error(`Project not found: ${value}`);
  }

  return project;
}

function safePropertyName(value: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)
    ? value
    : JSON.stringify(value);
}

function toJsPropertyName(value: string) {
  const normalized = value.replace(/-/g, "_");
  return safePropertyName(normalized);
}

function toPascalCase(value: string) {
  const normalized = value.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const words = normalized ? normalized.split(/\s+/) : ["Collection"];
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

function toTsType(type: FieldType) {
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

async function readJsonFile<T>(filePath: string, optional = false) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    if (
      optional &&
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function relativeSafe(filePath: string) {
  return filePath.startsWith(`${process.cwd()}/`)
    ? filePath.slice(process.cwd().length + 1)
    : basename(filePath);
}

export {
  DEFAULT_COLLECTIONS_PATH,
  DEFAULT_CONFIG_PATH,
  DEFAULT_CLIENT_PATH,
  DEFAULT_DECLARATIONS_PATH,
  DEFAULT_SKILL_DIRECTORY,
  DEFAULT_TYPES_PATH,
  compactMiniConfig,
  formatCliError,
  installSkill,
  loadCollectionsInput,
  normalizeBaseUrl,
  normalizeCollections,
  parseKeyValueInput,
  promptForMiniConfig,
  pullSchemas,
  pushSchemas,
  readError,
  resolveConfig,
  toJsPropertyName,
  toPascalCase,
  toTsType,
  writeCollectionsFile,
  writeClientFiles,
  writeMiniConfig,
  writeTypesFile,
};

export type {
  CollectionField,
  CommandOptions,
  MiniConfig,
  PullResponse,
  PushResponse,
  ResolvedConfig,
  SyncedCollection,
};

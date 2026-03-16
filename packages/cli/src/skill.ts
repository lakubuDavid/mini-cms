import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  DEFAULT_SKILL_DIRECTORY,
  DEFAULT_SKILL_FILE,
} from "./constants";
import type { AddSkillResponse } from "./types";

const PACKAGED_SKILL_CONTENT = `---
name: mini-cms-cli
description: Use the Mini CMS CLI to initialize config, sync schemas, inspect collections, and generate client files
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
- \`mini-cms list-projects\`
- \`mini-cms project create\`
- \`mini-cms project delete\`
- \`mini-cms list-collections\`
- \`mini-cms collection create\`
- \`mini-cms collection delete\`
- \`mini-cms collection item list <slug|id>\`
- \`mini-cms collection item insert <slug|id>\`
- \`mini-cms collection item update <slug|id>\`
- \`mini-cms collection item delete <slug|id>\`
- \`mini-cms generate\`
- \`mini-cms add-skill\`

## What each command does

### \`mini-cms init\`

Creates \`mini.config.json\` with an interactive prompt.

Use this first when setting up the CLI in a new project.

### \`mini-cms pull\`

Pulls collection schemas from one project and writes local files.

Typical result:

- creates or updates \`mini.config.json\`
- creates or updates \`mini.collections.json\`
- creates or updates \`mini.types.ts\`

### \`mini-cms push\`

Pushes local collection definitions from \`mini.collections.json\` or a directory of JSON files to the configured project.

Use this after editing your local collection schema.

### \`mini-cms project ...\`

Lists, creates, and deletes projects in the workspace.

### \`mini-cms collection ...\`

Lists, creates, and deletes collections, and manages collection items.

Item mutations use key/value strings like:

- \`title=Hello;published=true\`

\`mini-cms collection item update\` replaces the full item data by default. Use
\`--merge\` to preserve existing fields and only overwrite the keys you pass.

### \`mini-cms generate\`

Generates local developer files from your saved config and collection definitions.

Typical result:

- updates \`mini.types.ts\`
- creates or updates \`mini.client.js\`
- creates or updates \`mini.client.d.ts\`

The generated client is browser-friendly and uses \`fetch\`.

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

1. Use \`mini-cms list-projects\` or \`mini-cms list-collections\`
2. Use \`mini-cms collection item list <slug|id>\` to inspect items

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
- set \`projectId\` in config before using \`pull\` or \`push\`
- use \`projectId\` when you want the generated client to default to one project

## Avoid

- do not define custom schema fields that start with \`_\`
- do not edit \`mini.types.ts\` by hand
- do not edit \`mini.client.d.ts\` by hand
- do not assume \`generate\` pulls remote schema; it uses local config and collection files
`;

export async function installSkill(projectRoot: string): Promise<AddSkillResponse> {
  const directoryPath = resolve(projectRoot, DEFAULT_SKILL_DIRECTORY);
  const skillPath = join(directoryPath, DEFAULT_SKILL_FILE);

  await mkdir(directoryPath, { recursive: true });
  await writeFile(skillPath, `${PACKAGED_SKILL_CONTENT.trim()}\n`, "utf8");

  return {
    directoryPath,
    skillPath,
  };
}

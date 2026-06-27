# Mini CMS CLI

A CLI for [Mini CMS](https://mini-cms.lakubudavid.me) — sync schemas, manage collections, generate typed client files.

## Install

```bash
# via JSR
deno add jsr:@lakubudavid/mini-cms
npx jsr add @lakubudavid/mini-cms

# via npm (JSR compatibility)
npx @lakubudavid/mini-cms
```

## Quick start

```bash
# Initialize config
mini-cms init

# Pull schemas from your project
mini-cms pull

# Generate typed client
mini-cms generate
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Create `mini.config.json` interactively |
| `pull` | Pull collection schemas from the remote project |
| `push` | Push local collection definitions to the remote project |
| `list-projects` | List all projects in the workspace |
| `project create` | Create a new project |
| `project delete` | Delete a project |
| `list-collections` | List all collections in the project |
| `collection create` | Create a new collection |
| `collection delete` | Delete a collection |
| `collection item list` | List items in a collection |
| `collection item insert` | Insert an item into a collection |
| `collection item update` | Update an item in a collection |
| `collection item delete` | Delete an item from a collection |
| `generate` | Generate TypeScript types and a fetch-based client |
| `add-skill` | Install the AI-agent skill file for this CLI |

## Core files

- **`mini.config.json`** — stores your workspace/project config
- **`mini.collections.json`** — local collection definitions
- **`mini.types.ts`** — generated TypeScript types
- **`mini.client.js`** — generated fetch-based client
- **`mini.client.d.ts`** — generated type declarations

## Project

This package is part of the [mini-cms](https://github.com/lakubuDavid/mini-cms) monorepo.

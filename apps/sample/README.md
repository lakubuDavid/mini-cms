# Sample App

This directory shows how to use the generated `mini.client.js` against a Mini CMS project.

## Setup

1. Copy `apps/sample/.env.example` to `apps/sample/.env`
2. Fill in your Mini CMS values
3. Run the sample script

```bash
bun apps/sample/main.ts
```

## Required env vars

```bash
MINI_CMS_BASE_URL=
MINI_CMS_WORKSPACE_ID=
MINI_CMS_PROJECT_ID=
```

## Optional env vars

```bash
MINI_CMS_COLLECTION_SLUG=partners
```

The sample defaults to the `partners` collection when `MINI_CMS_COLLECTION_SLUG` is not set.

# Mini CMS

Mini CMS is a minimalist, self-hosted CMS for development studios.

## Repository Structure

- `apps/web` - the main product app, including the dashboard, auth, database layer, and API routes
- `packages/cli` - the Mini CMS CLI for schema sync and content operations
- `apps/docs` - the canonical product documentation for app features, API usage, environment setup, hosting, and CLI usage
- `apps/docs` - the newer docs app/migration target; keep content aligned with `apps/docs`

## App, CLI, and Docs

- The web app and CLI are closely related: the CLI depends on schema and content behavior exposed by the app, especially the `/api/schema/*` endpoints.
- The docs describe how the app and CLI work for end users, including dashboard features, public API behavior, environment variables, hosting, and command usage.
- When a feature changes in `apps/web` or `packages/cli`, check `apps/docs` to see whether the documentation should also be updated.
- When docs are duplicated in other locations, update `apps/docs` first as the canonical source and then mirror those changes where needed.

## Documentation

- Docs app: `apps/docs`
- Canonical docs content: `apps/docs/content/docs`
- Static doc assets: `apps/docs/public/docs/assets`
- Docs migration target: `apps/docs`

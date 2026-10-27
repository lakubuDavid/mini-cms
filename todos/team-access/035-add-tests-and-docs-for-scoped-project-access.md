---
id: "035"
title: "Add tests and docs for scoped project access"
status: done
created_at: 2026-10-25T09:16:09
last_modified: 2026-10-25T10:20:20
slice: team-access
---

# 035: Add tests and docs for scoped project access

## Description
Add unit coverage for project access resolution and guards. Add e2e coverage for owner/admin project access assignment, restricted member visibility, route guards, and direct server-function rejection. Update tenant-isolation expectations. Document roles and project access in `apps/docs` and mirror the changes in `apps/web/content/docs`.

## Notes
The e2e spec was typechecked and linted but not executed in this session because the suite writes to the configured database. Run it with a throwaway `TURSO_DB_URL`.

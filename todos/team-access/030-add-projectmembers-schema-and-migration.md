---
id: "030"
title: "Add project_members schema and migration"
status: done
created_at: 2026-10-25T09:16:08
last_modified: 2026-10-25T09:23:29
slice: team-access
---

# 030: Add project_members schema and migration

## Description
Create a project_members join table with projectId, memberId, organizationId, createdAt, unique (projectId, memberId), cascades, and indexes. Generate the Drizzle migration.

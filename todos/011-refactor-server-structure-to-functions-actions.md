---
id: "011"
title: "Refactor server structure to functions + actions"
status: pending
created_at: 2026-07-11T05:10:10
last_modified: 2026-07-11T05:10:10
---

# 011: Refactor server structure to functions + actions

## Description
Move createServerFn definitions to server/functions/, pure business logic to server/actions/. Delete lib/*-helpers.ts files.

## Details
Option A: server/functions/ = createServerFn wrappers, server/actions/ = pure business logic. Update all imports across the codebase.

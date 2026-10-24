---
id: "012"
title: "Fix schema page using wrong project"
status: done
created_at: 2026-07-11T05:16:13
last_modified: 2026-07-11T05:18:04
---

# 012: Fix schema page using wrong project

## Description
getCollectionSchemaServerFn missing projectId param. Cache key missing projectId.

## Details
Fix: add projectId to validator, update queryKey, pass projectId in schema.tsx

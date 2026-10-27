---
id: "002"
title: "Fix projects settings route"
status: done
created_at: 2026-07-11T04:22:46
last_modified: 2026-07-11T05:11:25
---

# 002: Fix projects settings route

## Description
projects/$projectId/settings is inaccessible, always redirects to dashboard/projects

## Details
Missing route.tsx layout file in projects/$projectId/ directory. collections/$name/ has one but projects doesn't.

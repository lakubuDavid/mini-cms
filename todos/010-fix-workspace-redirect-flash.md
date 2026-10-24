---
id: "010"
title: "Fix workspace redirect flash"
status: done
created_at: 2026-07-11T04:56:43
last_modified: 2026-07-11T05:11:26
---

# 010: Fix workspace redirect flash

## Description
Dashboard was redirecting to workspace page before server responded

## Details
Added orgQuery.isLoading guard to prevent premature redirect. Workspace ID now saved to localStorage.

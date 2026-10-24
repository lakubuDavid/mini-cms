---
id: "013"
title: "Invalidate queries on project switch"
status: done
created_at: 2026-07-11T05:16:13
last_modified: 2026-07-11T05:18:04
---

# 013: Invalidate queries on project switch

## Description
Switching projects should reload all dependent components

## Details
Add useEffect in dashboard-context.tsx to invalidate queries when currentProject changes

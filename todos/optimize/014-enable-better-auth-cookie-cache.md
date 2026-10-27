---
id: "014"
title: "Enable better-auth cookie cache"
status: done
created_at: 2026-10-24T02:21:05
last_modified: 2026-10-24T02:21:33
slice: optimize
---

# 014: Enable better-auth cookie cache

## Description
Add session.cookieCache to auth config to avoid DB hits on getSession

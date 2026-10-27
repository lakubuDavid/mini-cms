---
id: "029"
title: "Fix owner and admin team management gate"
status: done
created_at: 2026-10-25T09:16:08
last_modified: 2026-10-25T09:19:08
slice: team-access
---

# 029: Fix owner and admin team management gate

## Description
Owner role currently cannot see invite form, pending invites, role controls, or remove actions because team.tsx only checks role === 'admin'. Use the active membership role and allow owner + admin. Add Member to invite role options.

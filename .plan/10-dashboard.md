# Phase 10: Dashboard UI

## Checklist

- [x] Create `src/routes/dashboard.tsx` (layout)
  - [x] Sidebar with navigation
  - [x] Auth check / redirect to login
  - [ ] Move project selector into sidebar top
  - [ ] Add workspace switcher/create controls above profile menu

- [x] Create dashboard index route
  - [x] List all collections
  - [x] Create new collection button/modal
  - [ ] Handle no-workspace state without throwing workspace-required queries

- [x] Create `src/routes/dashboard.collections.$name.tsx`
  - [x] Table view of items
  - [x] Field renderers (text, url, number, boolean)
  - [ ] Add/Edit/Delete item modals
  - [ ] Pagination controls

- [x] Create `src/routes/dashboard.collections.$name.schema.tsx`
  - [x] Schema editor (add/remove/reorder fields)
  - [x] Field type selector

- [x] Create `src/routes/dashboard.team.tsx`
  - [x] List team members
  - [x] Invite user form
  - [ ] Remove user actions
  - [ ] Enforce demo max users per workspace on invites

- [x] Create `src/routes/invite.$token.tsx`
  - [x] Accept invite page
  - [x] Registration form
  - [ ] Split into sign-in / sign-up / direct-accept states

- [ ] Route workspace-less users to workspace setup before project creation
- [ ] Remove duplicated project selectors from page-level views

## Field Renderers

### text

- Display: Plain text
- Edit: Text input

### url

- Display: Image thumbnail (hover), Modal (click)
- Edit: URL input + preview

### number

- Display: Number
- Edit: Number input

### boolean

- Display: Checkmark / X icons
- Edit: Toggle switch

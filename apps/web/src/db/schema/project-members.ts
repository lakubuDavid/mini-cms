import { relations } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { members, organizations } from "./auth";
import { projects } from "./projects";

/**
 * Per-project access for workspace members.
 *
 * Owners and admins have implicit access to every project. Members and
 * reviewers only see projects listed here; an empty set means no project
 * access.
 */
export const projectMembers = sqliteTable(
  "project_members",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("project_members_organization_id_idx").on(table.organizationId),
    index("project_members_member_id_idx").on(table.memberId),
    uniqueIndex("project_members_project_member_uidx").on(
      table.projectId,
      table.memberId,
    ),
  ],
);

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [projectMembers.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  member: one(members, {
    fields: [projectMembers.memberId],
    references: [members.id],
  }),
}));

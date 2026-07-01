import { relations } from "drizzle-orm";
import { index, sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { projects } from "./projects";

export const environments = sqliteTable(
  "environments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    isProduction: integer("is_production", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("environments_project_id_idx").on(table.projectId),
    uniqueIndex("environments_project_slug_uidx").on(table.projectId, table.slug),
  ],
);

export const environmentsRelations = relations(environments, ({ one }) => ({
  project: one(projects, {
    fields: [environments.projectId],
    references: [projects.id],
  }),
}));

export type Environment = typeof environments.$inferSelect;
export type NewEnvironment = typeof environments.$inferInsert;

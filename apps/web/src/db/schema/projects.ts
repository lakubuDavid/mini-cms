import { relations, sql } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { organizations } from "./auth";
import { collections } from "./collections";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    metadata: text("metadata", { mode: "json" })
      .$type<{ isDefault?: boolean }>()
      .notNull()
      .default(sql`'{}'`),
  },
  (table) => [
    index("projects_organization_id_idx").on(table.organizationId),
    uniqueIndex("projects_organization_slug_uidx").on(
      table.organizationId,
      table.slug,
    ),
  ],
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  collections: many(collections),
}));

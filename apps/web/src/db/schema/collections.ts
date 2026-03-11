import { sql } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { organizations } from "./auth";
import { projects } from "./projects";

export const collections = sqliteTable(
  "collections",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    schema: text("schema", { mode: "json" })
      .$type<
        Array<{
          key: string;
          label: string;
          type: "text" | "url" | "number" | "boolean" | "date";
        }>
      >()
      .notNull()
      .default(sql`'[]'`),
    createdAt: integerTimestamp("created_at"),
    updatedAt: integerTimestamp("updated_at"),
  },
  (table) => [
    index("collections_organization_id_idx").on(table.organizationId),
    index("collections_project_id_idx").on(table.projectId),
    index("collections_slug_idx").on(table.slug),
    uniqueIndex("collections_project_slug_uidx").on(
      table.projectId,
      table.slug,
    ),
  ],
);

function integerTimestamp(name: string) {
  return text(name)
    .notNull()
    .$defaultFn(() => new Date().toISOString());
}

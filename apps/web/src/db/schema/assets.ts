import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { organizations, users } from "./auth";
import { projects } from "./projects";

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    storageKey: text("storage_key").notNull(),
    publicUrl: text("public_url").notNull(),
    status: text("status", { enum: ["pending", "active"] })
      .notNull()
      .default("pending"),
    uploadedById: text("uploaded_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("assets_organization_id_idx").on(table.organizationId),
    index("assets_project_id_idx").on(table.projectId),
    index("assets_uploaded_by_id_idx").on(table.uploadedById),
    index("assets_status_idx").on(table.status),
    uniqueIndex("assets_storage_key_uidx").on(table.storageKey),
  ],
);

export const assetsRelations = relations(assets, ({ one }) => ({
  organization: one(organizations, {
    fields: [assets.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [assets.projectId],
    references: [projects.id],
  }),
  uploadedBy: one(users, {
    fields: [assets.uploadedById],
    references: [users.id],
  }),
}));

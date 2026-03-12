import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { projects } from "./projects";

export const requestLogs = sqliteTable(
  "request_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    collectionSlug: text("collection_slug").notNull(),
    originDomain: text("origin_domain").notNull().default("unknown"),
    timestamp: text("timestamp")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("request_logs_project_id_idx").on(table.projectId),
    index("request_logs_timestamp_idx").on(table.timestamp),
    index("request_logs_origin_domain_idx").on(table.originDomain),
    index("request_logs_collection_slug_idx").on(table.collectionSlug),
  ],
);

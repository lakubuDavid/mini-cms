import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { collections } from "./collections";
import { environments } from "./environments";

export const collectionItems = sqliteTable(
  "collection_items",
  {
    id: text("id").primaryKey(),
    environmentId: text("environment_id")
      .references(() => environments.id, { onDelete: "cascade" }),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    data: text("data", { mode: "json" })
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default(sql`'{}'`),
    order: integer("order").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("collection_items_collection_id_idx").on(table.collectionId),
    index("collection_items_environment_id_idx").on(table.environmentId),
    index("collection_items_order_idx").on(table.order),
  ],
);

export const collectionItemsRelations = relations(
  collectionItems,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionItems.collectionId],
      references: [collections.id],
    }),
  }),
);

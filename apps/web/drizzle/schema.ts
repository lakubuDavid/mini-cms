import { sqliteTable, AnySQLiteColumn, foreignKey, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const accounts = sqliteTable("accounts", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: integer("access_token_expires_at"),
	refreshTokenExpiresAt: integer("refresh_token_expires_at"),
	scope: text(),
	password: text(),
	createdAt: integer("created_at").default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const invitations = sqliteTable("invitations", {
	id: text().primaryKey().notNull(),
	organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" } ),
	email: text().notNull(),
	role: text(),
	status: text().default("pending").notNull(),
	expiresAt: integer("expires_at").notNull(),
	createdAt: integer("created_at").default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
	inviterId: text("inviter_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
},
(table) => [
	index("invitations_email_idx").on(table.email),
]);

export const members = sqliteTable("members", {
	id: text().primaryKey().notNull(),
	organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" } ),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	role: text().default("member").notNull(),
	createdAt: integer("created_at").notNull(),
});

export const organizations = sqliteTable("organizations", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	logo: text(),
	createdAt: integer("created_at").notNull(),
	metadata: text(),
},
(table) => [
	uniqueIndex("organizations_slug_uidx").on(table.slug),
	uniqueIndex("organizations_slug_unique").on(table.slug),
]);

export const sessions = sqliteTable("sessions", {
	id: text().primaryKey().notNull(),
	expiresAt: integer("expires_at").notNull(),
	token: text().notNull(),
	createdAt: integer("created_at").default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
	updatedAt: integer("updated_at").notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	impersonatedBy: text("impersonated_by"),
	activeOrganizationId: text("active_organization_id"),
},
(table) => [
	uniqueIndex("sessions_token_unique").on(table.token),
]);

export const users = sqliteTable("users", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: integer("email_verified").default(false).notNull(),
	image: text(),
	createdAt: integer("created_at").default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
	updatedAt: integer("updated_at").default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
	role: text(),
	banned: integer().default(false),
	banReason: text("ban_reason"),
	banExpires: integer("ban_expires"),
},
(table) => [
	uniqueIndex("users_email_unique").on(table.email),
]);

export const verifications = sqliteTable("verifications", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: integer("expires_at").notNull(),
	createdAt: integer("created_at").default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
	updatedAt: integer("updated_at").default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
},
(table) => [
	index("verifications_identifier_idx").on(table.identifier),
]);

export const collectionItems = sqliteTable("collection_items", {
	id: text().primaryKey().notNull(),
	collectionId: text("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" } ),
	data: text().default("{}").notNull(),
	order: integer().default(0).notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
},
(table) => [
	index("collection_items_order_idx").on(table.order),
	index("collection_items_collection_id_idx").on(table.collectionId),
]);

export const apikeys = sqliteTable("apikeys", {
	id: text().primaryKey().notNull(),
	configId: text("config_id").default("default").notNull(),
	name: text(),
	start: text(),
	referenceId: text("reference_id").notNull(),
	prefix: text(),
	key: text().notNull(),
	refillInterval: integer("refill_interval"),
	refillAmount: integer("refill_amount"),
	lastRefillAt: integer("last_refill_at"),
	enabled: integer().default(true),
	rateLimitEnabled: integer("rate_limit_enabled").default(true),
	rateLimitTimeWindow: integer("rate_limit_time_window").default(600000),
	rateLimitMax: integer("rate_limit_max").default(10),
	requestCount: integer("request_count").default(0),
	remaining: integer(),
	lastRequest: integer("last_request"),
	expiresAt: integer("expires_at"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
	permissions: text(),
	metadata: text(),
},
(table) => [
	index("apikeys_key_idx").on(table.key),
	index("apikeys_referenceId_idx").on(table.referenceId),
	index("apikeys_configId_idx").on(table.configId),
]);

export const projects = sqliteTable("projects", {
	id: text().primaryKey().notNull(),
	organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" } ),
	name: text().notNull(),
	slug: text().notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
	metadata: text().default("{}").notNull(),
},
(table) => [
	uniqueIndex("projects_organization_slug_uidx").on(table.organizationId, table.slug),
	index("projects_organization_id_idx").on(table.organizationId),
]);

export const collections = sqliteTable("collections", {
	id: text().primaryKey().notNull(),
	organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" } ),
	projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" } ),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	schema: text().default("[]").notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
},
(table) => [
	uniqueIndex("collections_project_slug_uidx").on(table.projectId, table.slug),
	index("collections_slug_idx").on(table.slug),
	index("collections_project_id_idx").on(table.projectId),
	index("collections_organization_id_idx").on(table.organizationId),
]);

export const requestLogs = sqliteTable("request_logs", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" } ),
	collectionSlug: text("collection_slug").notNull(),
	originDomain: text("origin_domain").default("unknown").notNull(),
	timestamp: text().notNull(),
},
(table) => [
	index("request_logs_collection_slug_idx").on(table.collectionSlug),
	index("request_logs_origin_domain_idx").on(table.originDomain),
	index("request_logs_timestamp_idx").on(table.timestamp),
	index("request_logs_project_id_idx").on(table.projectId),
]);

export const assets = sqliteTable("assets", {
	id: text().primaryKey().notNull(),
	organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" } ),
	projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" } ),
	filename: text().notNull(),
	originalFilename: text("original_filename").notNull(),
	contentType: text("content_type").notNull(),
	size: integer().notNull(),
	storageKey: text("storage_key").notNull(),
	publicUrl: text("public_url").notNull(),
	status: text().default("pending").notNull(),
	uploadedById: text("uploaded_by_id").references(() => users.id, { onDelete: "set null" } ),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});


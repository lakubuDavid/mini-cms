import { relations } from "drizzle-orm/relations";
import { users, accounts, invitations, organizations, members, sessions, collections, collectionItems, environments, projects, requestLogs, assets } from "./schema";

export const accountsRelations = relations(accounts, ({one}) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	accounts: many(accounts),
	invitations: many(invitations),
	members: many(members),
	sessions: many(sessions),
	assets: many(assets),
}));

export const invitationsRelations = relations(invitations, ({one}) => ({
	user: one(users, {
		fields: [invitations.inviterId],
		references: [users.id]
	}),
	organization: one(organizations, {
		fields: [invitations.organizationId],
		references: [organizations.id]
	}),
}));

export const organizationsRelations = relations(organizations, ({many}) => ({
	invitations: many(invitations),
	members: many(members),
	projects: many(projects),
	collections: many(collections),
	assets: many(assets),
}));

export const membersRelations = relations(members, ({one}) => ({
	user: one(users, {
		fields: [members.userId],
		references: [users.id]
	}),
	organization: one(organizations, {
		fields: [members.organizationId],
		references: [organizations.id]
	}),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
}));

export const collectionItemsRelations = relations(collectionItems, ({one}) => ({
	collection: one(collections, {
		fields: [collectionItems.collectionId],
		references: [collections.id]
	}),
	environment: one(environments, {
		fields: [collectionItems.environmentId],
		references: [environments.id]
	}),
}));

export const collectionsRelations = relations(collections, ({one, many}) => ({
	collectionItems: many(collectionItems),
	project: one(projects, {
		fields: [collections.projectId],
		references: [projects.id]
	}),
	organization: one(organizations, {
		fields: [collections.organizationId],
		references: [organizations.id]
	}),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	organization: one(organizations, {
		fields: [projects.organizationId],
		references: [organizations.id]
	}),
	collections: many(collections),
	environments: many(environments),
	requestLogs: many(requestLogs),
	assets: many(assets),
}));

export const environmentsRelations = relations(environments, ({one, many}) => ({
	project: one(projects, {
		fields: [environments.projectId],
		references: [projects.id]
	}),
	collectionItems: many(collectionItems),
}));

export const requestLogsRelations = relations(requestLogs, ({one}) => ({
	project: one(projects, {
		fields: [requestLogs.projectId],
		references: [projects.id]
	}),
}));

export const assetsRelations = relations(assets, ({one}) => ({
	user: one(users, {
		fields: [assets.uploadedById],
		references: [users.id]
	}),
	project: one(projects, {
		fields: [assets.projectId],
		references: [projects.id]
	}),
	organization: one(organizations, {
		fields: [assets.organizationId],
		references: [organizations.id]
	}),
}));
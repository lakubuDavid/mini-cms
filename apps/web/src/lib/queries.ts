import { queryOptions } from "@tanstack/react-query";
import {
  listCollectionsServerFn,
  getCollectionPageServerFn,
  getCollectionSchemaServerFn,
} from "./collections-helpers";
import { listProjectsServerFn } from "./projects-helpers";
import {
  getActiveOrganization,
  listAdminUsers,
  listPendingInvitations,
  listApiKeysServerFn,
  listOrganizations,
} from "./auth-helpers";

// ── Query keys ──────────────────────────────────────────────

export const queryKeys = {
  organization: () => ["organization"] as const,
  organizations: () => ["organizations"] as const,
  projects: () => ["projects"] as const,
  collections: (page: number, limit: number) =>
    ["collections", { page, limit }] as const,
  collectionPage: (slug: string, page: number, limit: number) =>
    ["collection-page", slug, { page, limit }] as const,
  collectionSchema: (slug: string) => ["collection-schema", slug] as const,
  team: () => ["team"] as const,
  invites: () => ["invites"] as const,
  apiKeys: () => ["api-keys"] as const,
};

// ── Query options factories ─────────────────────────────────

export function organizationQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.organization(),
    queryFn: () => getActiveOrganization(),
    staleTime: 30_000,
  });
}

export function organizationsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.organizations(),
    queryFn: () => listOrganizations(),
    staleTime: 30_000,
  });
}

export function projectsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.projects(),
    queryFn: () => listProjectsServerFn(),
    staleTime: 30_000,
  });
}

export function collectionsQueryOptions(page = 1, limit = 24, projectId?: string) {
  return queryOptions({
    queryKey: [...queryKeys.collections(page, limit), { projectId }] as const,
    queryFn: () => listCollectionsServerFn({ data: { page, limit, projectId } }),
    staleTime: 15_000,
  });
}

export function collectionPageQueryOptions(
  slug: string,
  page = 1,
  limit = 10,
) {
  return queryOptions({
    queryKey: queryKeys.collectionPage(slug, page, limit),
    queryFn: () => getCollectionPageServerFn({ data: { slug, page, limit } }),
    staleTime: 10_000,
  });
}

export function collectionSchemaQueryOptions(slug: string) {
  return queryOptions({
    queryKey: queryKeys.collectionSchema(slug),
    queryFn: () => getCollectionSchemaServerFn({ data: { slug } }),
    staleTime: 30_000,
  });
}

export function teamQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.team(),
    queryFn: () => listAdminUsers(),
    staleTime: 30_000,
  });
}

export function invitesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.invites(),
    queryFn: () => listPendingInvitations(),
    staleTime: 15_000,
  });
}

export function apiKeysQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.apiKeys(),
    queryFn: () => listApiKeysServerFn(),
    staleTime: 15_000,
  });
}

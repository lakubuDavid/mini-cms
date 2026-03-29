import { queryOptions } from "@tanstack/react-query";
import {
  listCollectionsServerFn,
  getCollectionPageServerFn,
  getCollectionSchemaServerFn,
  getCollectionItemCountsServerFn,
} from "./collections-helpers";
import { listAssetsServerFn } from "./assets-helpers";
import { listProjectsServerFn, getProjectServerFn } from "./projects-helpers";
import { getAnalyticsOverviewServerFn } from "./analytics-helpers";
import {
  getActiveOrganization,
  listAdminUsers,
  listPendingInvitations,
  listApiKeysServerFn,
  listOrganizations,
} from "./auth-helpers";
import type { DateRange } from "@/db/queries/analytics";

// ── Stale time presets ──────────────────────────────────────
// Stable data that rarely changes within a session.
const STALE_LONG = 5 * 60_000; // 5 minutes
// Data that changes occasionally (collection lists, invites, keys).
const STALE_MEDIUM = 2 * 60_000; // 2 minutes
// Actively-edited data (items, assets, analytics).
const STALE_SHORT = 30_000; // 30 seconds

// ── Query keys ──────────────────────────────────────────────

export const queryKeys = {
  organization: () => ["organization"] as const,
  organizations: () => ["organizations"] as const,
  projects: () => ["projects"] as const,
  project: (id: string) => ["project", id] as const,
  collections: (page: number, limit: number) =>
    ["collections", { page, limit }] as const,
  collectionPage: (slug: string, page: number, limit: number, projectId?: string) =>
    ["collection-page", slug, { page, limit, projectId }] as const,
  collectionSchema: (slug: string) => ["collection-schema", slug] as const,
  collectionItemCounts: (collectionIds: string[]) =>
    ["collection-item-counts", collectionIds] as const,
  team: () => ["team"] as const,
  invites: () => ["invites"] as const,
  apiKeys: () => ["api-keys"] as const,
  analytics: (projectId: string, range: DateRange) =>
    ["analytics", { projectId, range }] as const,
  assets: (page: number, limit: number, projectId?: string, status?: "pending" | "active") =>
    ["assets", { page, limit, projectId, status }] as const,
};

// ── Query options factories ─────────────────────────────────

export function organizationQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.organization(),
    queryFn: () => getActiveOrganization(),
    staleTime: STALE_LONG,
  });
}

export function organizationsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.organizations(),
    queryFn: () => listOrganizations(),
    staleTime: STALE_LONG,
  });
}

export function projectsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.projects(),
    queryFn: () => listProjectsServerFn(),
    staleTime: STALE_LONG,
  });
}

export function projectQueryOptions(projectId: string) {
  return queryOptions({
    queryKey: queryKeys.project(projectId),
    queryFn: () => getProjectServerFn({ data: { id: projectId } }),
    staleTime: STALE_LONG,
    enabled: !!projectId,
  });
}

export function collectionsQueryOptions(page = 1, limit = 24, projectId?: string) {
  return queryOptions({
    queryKey: [...queryKeys.collections(page, limit), { projectId }] as const,
    queryFn: () => listCollectionsServerFn({ data: { page, limit, projectId } }),
    staleTime: STALE_MEDIUM,
  });
}

export function collectionPageQueryOptions(
  slug: string,
  page = 1,
  limit = 10,
  projectId?: string,
) {
  return queryOptions({
    queryKey: queryKeys.collectionPage(slug, page, limit, projectId),
    queryFn: () => getCollectionPageServerFn({ data: { slug, page, limit, projectId } }),
    staleTime: STALE_SHORT,
  });
}

export function collectionSchemaQueryOptions(slug: string) {
  return queryOptions({
    queryKey: queryKeys.collectionSchema(slug),
    queryFn: () => getCollectionSchemaServerFn({ data: { slug } }),
    staleTime: STALE_LONG,
  });
}

export function collectionItemCountsQueryOptions(collectionIds: string[]) {
  return queryOptions({
    queryKey: queryKeys.collectionItemCounts(collectionIds),
    queryFn: () => getCollectionItemCountsServerFn({ data: { collectionIds } }),
    staleTime: STALE_SHORT,
    enabled: collectionIds.length > 0,
  });
}

export function teamQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.team(),
    queryFn: () => listAdminUsers(),
    staleTime: STALE_LONG,
  });
}

export function invitesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.invites(),
    queryFn: () => listPendingInvitations(),
    staleTime: STALE_MEDIUM,
  });
}

export function apiKeysQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.apiKeys(),
    queryFn: () => listApiKeysServerFn(),
    staleTime: STALE_MEDIUM,
  });
}

export function analyticsQueryOptions(projectId: string, range: DateRange) {
  return queryOptions({
    queryKey: queryKeys.analytics(projectId, range),
    queryFn: () =>
      getAnalyticsOverviewServerFn({ data: { projectId, range } }),
    staleTime: STALE_SHORT,
    enabled: !!projectId,
  });
}

export function assetsQueryOptions(
  page = 1,
  limit = 24,
  projectId?: string,
  status?: "pending" | "active",
) {
  return queryOptions({
    queryKey: queryKeys.assets(page, limit, projectId, status),
    queryFn: () => listAssetsServerFn({ data: { page, limit, projectId, status } }),
    staleTime: STALE_SHORT,
  });
}

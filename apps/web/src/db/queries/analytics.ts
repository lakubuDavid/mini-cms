import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  requestLogs,
  collections,
  collectionItems,
  projects,
  members,
} from "@/db/schema";

export type DateRange = "7d" | "30d" | "90d";

function rangeToDate(range: DateRange): string {
  const now = new Date();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

/** Total requests for a project within a date range */
export async function getTotalRequests(
  projectId: string,
  range: DateRange,
): Promise<number> {
  const since = rangeToDate(range);
  const result = await db
    .select({ value: count() })
    .from(requestLogs)
    .where(
      and(
        eq(requestLogs.projectId, projectId),
        gte(requestLogs.timestamp, since),
      ),
    );
  return result[0]?.value ?? 0;
}

/** Requests grouped by day for the given range */
export async function getRequestsByDay(
  projectId: string,
  range: DateRange,
): Promise<Array<{ date: string; count: number }>> {
  const since = rangeToDate(range);
  const rows = await db
    .select({
      date: sql<string>`substr(${requestLogs.timestamp}, 1, 10)`,
      count: count(),
    })
    .from(requestLogs)
    .where(
      and(
        eq(requestLogs.projectId, projectId),
        gte(requestLogs.timestamp, since),
      ),
    )
    .groupBy(sql`substr(${requestLogs.timestamp}, 1, 10)`)
    .orderBy(sql`substr(${requestLogs.timestamp}, 1, 10)`);

  return rows.map((r) => ({ date: r.date, count: r.count }));
}

/** Top origin domains for a project within a date range */
export async function getTopOrigins(
  projectId: string,
  range: DateRange,
  limit = 10,
): Promise<Array<{ domain: string; count: number }>> {
  const since = rangeToDate(range);
  const rows = await db
    .select({
      domain: requestLogs.originDomain,
      count: count(),
    })
    .from(requestLogs)
    .where(
      and(
        eq(requestLogs.projectId, projectId),
        gte(requestLogs.timestamp, since),
      ),
    )
    .groupBy(requestLogs.originDomain)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows.map((r) => ({ domain: r.domain, count: r.count }));
}

/** Requests per collection slug for a project within a date range */
export async function getRequestsByCollection(
  projectId: string,
  range: DateRange,
): Promise<Array<{ collection: string; count: number }>> {
  const since = rangeToDate(range);
  const rows = await db
    .select({
      collection: requestLogs.collectionSlug,
      count: count(),
    })
    .from(requestLogs)
    .where(
      and(
        eq(requestLogs.projectId, projectId),
        gte(requestLogs.timestamp, since),
      ),
    )
    .groupBy(requestLogs.collectionSlug)
    .orderBy(sql`count(*) desc`);

  return rows.map((r) => ({ collection: r.collection, count: r.count }));
}

/** Aggregate stats for the workspace (org) */
export async function getWorkspaceStats(organizationId: string): Promise<{
  totalCollections: number;
  totalItems: number;
  totalUsers: number;
  totalProjects: number;
}> {
  const [collectionsCount, itemsCount, usersCount, projectsCount] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(collections)
        .where(eq(collections.organizationId, organizationId)),
      db
        .select({ value: count() })
        .from(collectionItems)
        .innerJoin(
          collections,
          eq(collectionItems.collectionId, collections.id),
        )
        .where(eq(collections.organizationId, organizationId)),
      db
        .select({ value: count() })
        .from(members)
        .where(eq(members.organizationId, organizationId)),
      db
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.organizationId, organizationId)),
    ]);

  return {
    totalCollections: collectionsCount[0]?.value ?? 0,
    totalItems: itemsCount[0]?.value ?? 0,
    totalUsers: usersCount[0]?.value ?? 0,
    totalProjects: projectsCount[0]?.value ?? 0,
  };
}

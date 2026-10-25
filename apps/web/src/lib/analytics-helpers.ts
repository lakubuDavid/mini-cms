import { createServerFn } from "@tanstack/react-start";
import type { DateRange } from "@/db/queries/analytics";

export const getAnalyticsOverviewServerFn = createServerFn({ method: "GET" })
  .validator(
    (data: { projectId: string; range: DateRange }) => data,
  )
  .handler(async ({ data, ...ctx }) => {
    const { getActiveProjectContext } = await import("./project-access");
    const { organizationId, access } = await getActiveProjectContext(ctx);

    if (!access.all && !access.projectIds.includes(data.projectId)) {
      throw new Error("Forbidden: no access to this project");
    }

    const { redis } = await import("./cache");
    const accessKey = access.all
      ? "all"
      : [...access.projectIds].sort().join(",");
    const cacheKey = `mini-cms:analytics:${organizationId}:${data.projectId}:${data.range}:${accessKey}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed =
        typeof cached === "string" ? JSON.parse(cached) : cached;
      return parsed as {
        totalRequests: number;
        requestsByDay: Array<{ date: string; count: number }>;
        topOrigins: Array<{ domain: string; count: number }>;
        requestsByCollection: Array<{ collection: string; count: number }>;
        stats: {
          totalCollections: number;
          totalItems: number;
          totalUsers: number;
          totalProjects: number;
        };
      };
    }

    const {
      getTotalRequests,
      getRequestsByDay,
      getTopOrigins,
      getRequestsByCollection,
      getWorkspaceStats,
    } = await import("../db/queries/analytics");

    const [totalRequests, requestsByDay, topOrigins, requestsByCollection, stats] =
      await Promise.all([
        getTotalRequests(data.projectId, data.range),
        getRequestsByDay(data.projectId, data.range),
        getTopOrigins(data.projectId, data.range),
        getRequestsByCollection(data.projectId, data.range),
        getWorkspaceStats(organizationId, access),
      ]);

    const result = {
      totalRequests,
      requestsByDay,
      topOrigins,
      requestsByCollection,
      stats,
    };

    await redis.set(cacheKey, JSON.stringify(result), { ex: 30 });

    return result;
  });

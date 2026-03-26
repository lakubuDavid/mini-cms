import { createServerFn } from "@tanstack/react-start";
import type { DateRange } from "@/db/queries/analytics";

export const getAnalyticsOverviewServerFn = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { projectId: string; range: DateRange }) => data,
  )
  .handler(async ({ data }) => {
    const { requireActiveOrganizationId } = await import("./auth-helpers.server");
    const {
      getTotalRequests,
      getRequestsByDay,
      getTopOrigins,
      getRequestsByCollection,
      getWorkspaceStats,
    } = await import("../db/queries/analytics");

    const organizationId = await requireActiveOrganizationId();

    const [totalRequests, requestsByDay, topOrigins, requestsByCollection, stats] =
      await Promise.all([
        getTotalRequests(data.projectId, data.range),
        getRequestsByDay(data.projectId, data.range),
        getTopOrigins(data.projectId, data.range),
        getRequestsByCollection(data.projectId, data.range),
        getWorkspaceStats(organizationId),
      ]);

    return {
      totalRequests,
      requestsByDay,
      topOrigins,
      requestsByCollection,
      stats,
    };
  });

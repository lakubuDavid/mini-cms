import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, XAxis, YAxis, Pie, PieChart, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  analyticsQueryOptions,
  projectsQueryOptions,
} from "@/lib/queries";
import { env } from "@/lib/env";
import {
  Activity,
  Layers,
  FolderTree,
  Users,
  FileText,
  BarChart3,
} from "lucide-react";
import type { DateRange } from "@/db/queries/analytics";

export const Route = createFileRoute("/dashboard/analytics")({
  validateSearch: (search: Record<string, unknown>) => ({
    projectId:
      typeof search.projectId === "string" && search.projectId.length > 0
        ? search.projectId
        : undefined,
    range:
      typeof search.range === "string" &&
      ["7d", "30d", "90d"].includes(search.range)
        ? (search.range as DateRange)
        : ("30d" as DateRange),
  }),
  component: AnalyticsPage,
});

const CHART_COLORS = [
  "var(--chart-1, #2563eb)",
  "var(--chart-2, #16a34a)",
  "var(--chart-3, #ea580c)",
  "var(--chart-4, #8b5cf6)",
  "var(--chart-5, #0891b2)",
  "var(--chart-6, #d946ef)",
  "var(--chart-7, #ca8a04)",
  "var(--chart-8, #dc2626)",
];

function AnalyticsPage() {
  const search = Route.useSearch();
  const projectsQuery = useQuery(projectsQueryOptions());
  const selectedProjectId = search.projectId ?? "";
  const range = search.range ?? "30d";

  const analyticsEnabled = env.PUBLIC_ENABLE_WEB_ANALYTICS === true;

  const analyticsQuery = useQuery(
    analyticsQueryOptions(selectedProjectId, range),
  );

  if (!analyticsEnabled) {
    return (
      <section className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <BarChart3 className="h-10 w-10 text-stone-300 dark:text-stone-600" />
        <h2 className="text-lg font-medium text-stone-700 dark:text-stone-300">
          Analytics is disabled
        </h2>
        <p className="max-w-sm text-sm text-stone-500 dark:text-stone-400">
          Set <code className="rounded bg-stone-100 px-1 py-0.5 text-xs dark:bg-stone-800">PUBLIC_ENABLE_WEB_ANALYTICS=true</code> in your environment to enable analytics.
        </p>
      </section>
    );
  }

  const data = analyticsQuery.data;
  const isLoading = projectsQuery.isLoading || analyticsQuery.isLoading;

  const requestChartConfig: ChartConfig = {
    count: {
      label: "Requests",
      color: "var(--chart-1, #2563eb)",
    },
  };

  const originsChartConfig: ChartConfig = useMemo(() => {
    if (!data?.topOrigins) return {};
    return Object.fromEntries(
      data.topOrigins.map((o, i) => [
        o.domain,
        {
          label: o.domain,
          color: CHART_COLORS[i % CHART_COLORS.length],
        },
      ]),
    );
  }, [data?.topOrigins]);

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          Analytics
        </h2>
        <div className="flex items-center gap-3">
          <select
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
            value={range}
            onChange={(e) => {
              const params = new URLSearchParams(window.location.search);
              params.set("range", e.target.value as DateRange);
              const query = params.toString();
              window.history.replaceState({}, "", `${window.location.pathname}?${query}`);
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {!selectedProjectId ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Select a project from the sidebar to view analytics.
        </p>
      ) : !data ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          No data available.
        </p>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Total Requests"
              value={data.totalRequests}
              icon={<Activity className="h-4 w-4" />}
            />
            <StatCard
              label="Projects"
              value={data.stats.totalProjects}
              icon={<FolderTree className="h-4 w-4" />}
            />
            <StatCard
              label="Collections"
              value={data.stats.totalCollections}
              icon={<Layers className="h-4 w-4" />}
            />
            <StatCard
              label="Items"
              value={data.stats.totalItems}
              icon={<FileText className="h-4 w-4" />}
            />
            <StatCard
              label="Members"
              value={data.stats.totalUsers}
              icon={<Users className="h-4 w-4" />}
            />
          </div>

          {/* Charts row */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Request trend */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Request Trend</CardTitle>
                <CardDescription>
                  API requests per day ({range === "7d" ? "7 days" : range === "30d" ? "30 days" : "90 days"})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.requestsByDay.length === 0 ? (
                  <p className="py-8 text-center text-sm text-stone-400">
                    No requests yet.
                  </p>
                ) : (
                  <ChartContainer
                    config={requestChartConfig}
                    className="aspect-auto h-64 w-full"
                  >
                    <BarChart data={data.requestsByDay}>
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: string) => {
                          const d = new Date(v);
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        }}
                        fontSize={11}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        allowDecimals={false}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(v) => {
                              return new Date(v as string).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              );
                            }}
                          />
                        }
                      />
                      <Bar
                        dataKey="count"
                        fill="var(--color-count)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Top origins */}
            <Card>
              <CardHeader>
                <CardTitle>Top Origins</CardTitle>
                <CardDescription>Requests by domain</CardDescription>
              </CardHeader>
              <CardContent>
                {data.topOrigins.length === 0 ? (
                  <p className="py-8 text-center text-sm text-stone-400">
                    No requests yet.
                  </p>
                ) : (
                  <>
                    <ChartContainer
                      config={originsChartConfig}
                      className="mx-auto aspect-square h-48"
                    >
                      <PieChart>
                        <ChartTooltip
                          content={<ChartTooltipContent nameKey="domain" />}
                        />
                        <Pie
                          data={data.topOrigins}
                          dataKey="count"
                          nameKey="domain"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {data.topOrigins.map((entry, i) => (
                            <Cell
                              key={entry.domain}
                              fill={CHART_COLORS[i % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <ul className="mt-3 space-y-1.5 text-xs">
                      {data.topOrigins.map((o, i) => (
                        <li key={o.domain} className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{
                              backgroundColor:
                                CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                          <span className="min-w-0 flex-1 truncate text-stone-700 dark:text-stone-300">
                            {o.domain}
                          </span>
                          <span className="tabular-nums text-stone-500 dark:text-stone-400">
                            {o.count.toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Collection breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Requests by Collection</CardTitle>
              <CardDescription>
                How requests are distributed across collections
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.requestsByCollection.length === 0 ? (
                <p className="py-4 text-center text-sm text-stone-400">
                  No requests yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 dark:border-stone-700">
                        <th className="py-2 pr-4 font-medium text-stone-500 dark:text-stone-400">
                          Collection
                        </th>
                        <th className="py-2 pr-4 text-right font-medium text-stone-500 dark:text-stone-400">
                          Requests
                        </th>
                        <th className="py-2 font-medium text-stone-500 dark:text-stone-400">
                          Share
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.requestsByCollection.map((c) => {
                        const pct =
                          data.totalRequests > 0
                            ? ((c.count / data.totalRequests) * 100).toFixed(1)
                            : "0";
                        return (
                          <tr
                            key={c.collection}
                            className="border-b border-stone-100 last:border-0 dark:border-stone-800"
                          >
                            <td className="py-2 pr-4 text-stone-700 dark:text-stone-300">
                              {c.collection}
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums text-stone-900 dark:text-stone-100">
                              {c.count.toLocaleString()}
                            </td>
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                                  <div
                                    className="h-full rounded-full bg-stone-900 dark:bg-stone-100"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs tabular-nums text-stone-500 dark:text-stone-400">
                                  {pct}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3 pt-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-stone-500 dark:text-stone-400">{label}</p>
          <p className="text-lg font-semibold tabular-nums text-stone-900 dark:text-stone-100">
            {value.toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </section>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { environmentsQueryOptions } from "@/lib/queries";

function getEnvFromUrl(): string {
  if (typeof window === "undefined") return "production";
  return new URLSearchParams(window.location.search).get("env") ?? "production";
}

export function EnvironmentSwitcher({ projectId }: { projectId: string }) {
  const [currentEnvSlug, setCurrentEnvSlug] = useState(getEnvFromUrl);

  useEffect(() => {
    const handler = () => setCurrentEnvSlug(getEnvFromUrl());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const { data: environments = [], isLoading } = useQuery(
    environmentsQueryOptions(projectId),
  );

  const handleChange = useCallback((envSlug: string) => {
    const params = new URLSearchParams(window.location.search);
    if (envSlug === "production" || !envSlug) {
      params.delete("env");
    } else {
      params.set("env", envSlug);
    }
    const query = params.toString();
    const url = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
    setCurrentEnvSlug(envSlug === "production" || !envSlug ? "production" : envSlug);
  }, []);

  if (isLoading || environments.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <p className="px-2 text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
        Environment
      </p>
      <select
        value={currentEnvSlug}
        onChange={(event) => handleChange(event.target.value)}
        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-sm font-medium text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:focus:border-stone-500 dark:focus:ring-stone-800"
      >
        {environments.map((env) => (
          <option key={env.id} value={env.slug}>
            {env.name}
          </option>
        ))}
      </select>
    </div>
  );
}

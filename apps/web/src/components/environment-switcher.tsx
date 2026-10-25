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
    <div className="mt-3 space-y-2">
      <p className="px-1 text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
        Environment
      </p>
      <select
        value={currentEnvSlug}
        onChange={(event) => handleChange(event.target.value)}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium outline-none transition focus:border-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
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

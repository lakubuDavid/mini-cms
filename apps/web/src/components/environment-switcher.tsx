import { useCallback, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { environmentsQueryOptions } from "@/lib/queries";
import { Check } from "lucide-react";

const ENV_COLORS: Record<string, string> = {
  production: "bg-emerald-500",
  staging: "bg-amber-500",
  development: "bg-blue-500",
  preview: "bg-violet-500",
};

function getEnvColor(slug: string): string {
  return ENV_COLORS[slug] ?? "bg-stone-400";
}

function getEnvSlugFromUrl(): string {
  if (typeof window === "undefined") return "production";
  const params = new URLSearchParams(window.location.search);
  return params.get("env") ?? "production";
}

export function EnvironmentSwitcher({ projectId }: { projectId: string }) {
  const [currentEnvSlug, setCurrentEnvSlug] = useState(getEnvSlugFromUrl);

  // Listen for popstate events (triggered by our own replaceState)
  useEffect(() => {
    const handler = () => setCurrentEnvSlug(getEnvSlugFromUrl());
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
    window.history.replaceState(
      {},
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  if (isLoading || environments.length <= 1) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="px-1 text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
        Environment
      </p>
      <div className="flex flex-wrap gap-1.5">
        {environments.map((env) => {
          const isActive =
            env.slug === currentEnvSlug ||
            (!currentEnvSlug && env.isProduction && env.slug === "production");

          return (
            <button
              key={env.id}
              type="button"
              onClick={() => handleChange(env.slug)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700 dark:hover:text-white"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${getEnvColor(env.slug)}`}
              />
              {env.name}
              {isActive ? (
                <Check className="h-3 w-3" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { environmentsQueryOptions } from "./queries";
import type { Environment } from "@/db/schema/environments";

type EnvironmentContextType = {
  /** All environments for the current project */
  environments: Environment[];
  /** The currently selected environment */
  currentEnvironment: Environment | null;
  /** The production environment (isProduction === true) */
  productionEnvironment: Environment | null;
  /** Switch to a different environment by ID */
  setEnvironmentId: (id: string) => void;
  /** The currently selected environment ID */
  environmentId: string | null;
  /** Whether environments are still loading */
  isLoading: boolean;
};

const EnvironmentContext = createContext<EnvironmentContextType | null>(null);

export function EnvironmentProvider({
  projectId,
  environmentId,
  onEnvironmentChange,
  children,
}: {
  projectId: string | undefined;
  environmentId: string | null;
  onEnvironmentChange: (id: string) => void;
  children: React.ReactNode;
}) {
  const environmentsQuery = useQuery({
    ...environmentsQueryOptions(projectId ?? ""),
    enabled: !!projectId,
  });

  const environments = environmentsQuery.data ?? [];
  const isLoading = environmentsQuery.isLoading;

  const productionEnvironment = useMemo(
    () => environments.find((e) => e.isProduction) ?? environments[0] ?? null,
    [environments],
  );

  const currentEnvironment = useMemo(() => {
    if (!environmentId) return productionEnvironment;
    return environments.find((e) => e.id === environmentId) ?? productionEnvironment;
  }, [environments, environmentId, productionEnvironment]);

  const setEnvironmentId = useCallback(
    (id: string) => {
      onEnvironmentChange(id);
    },
    [onEnvironmentChange],
  );

  const value = useMemo(
    () => ({
      environments,
      currentEnvironment,
      productionEnvironment,
      setEnvironmentId,
      environmentId: currentEnvironment?.id ?? null,
      isLoading,
    }),
    [environments, currentEnvironment, productionEnvironment, setEnvironmentId, isLoading],
  );

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const ctx = useContext(EnvironmentContext);
  if (!ctx) {
    throw new Error("useEnvironment must be used within an EnvironmentProvider");
  }
  return ctx;
}

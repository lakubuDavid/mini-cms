import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { dashboardBootstrapQueryOptions } from "@/lib/queries";

// ── localStorage helpers ────────────────────────────────────

const STORAGE_PREFIX = "mini-cms:";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
  } catch {
    // Ignore local storage failures.
  }
}

// ── Types ───────────────────────────────────────────────────

type Organization = {
  id: string;
  name: string;
  slug: string;
  members?: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }>;
};

type Project = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  metadata?: { isDefault?: boolean };
  apiAccess?: { type: string; allowedDomains?: string[] };
  createdAt: string;
};

type DashboardContextValue = {
  // Workspace
  organization: Organization | null;
  organizations: Organization[];
  workspaceLoading: boolean;

  // Project
  currentProject: Project | null;
  projects: Project[];
  projectLoading: boolean;

  // Actions
  setCurrentProject: (projectId: string) => void;
  switchWorkspace: (organizationId: string) => Promise<void>;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

// ── Hook ────────────────────────────────────────────────────

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return ctx;
}

// ── Provider ────────────────────────────────────────────────

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const bootstrapQuery = useQuery(dashboardBootstrapQueryOptions());
  const bootstrap = bootstrapQuery.data ?? null;

  const organization = (bootstrap?.organization ?? null) as Organization | null;
  const projects = (bootstrap?.projects ?? []) as Project[];
  const organizations = (bootstrap?.organizations ?? []) as Organization[];

  // Read projectId from URL
  const urlParams = new URLSearchParams(location.search as string);
  const urlProjectId = urlParams.get("projectId") ?? "";

  // Resolve current project: URL > localStorage > first project
  const currentProject = useMemo(() => {
    // Prefer URL param if valid
    if (urlProjectId) {
      const fromUrl = projects.find((p) => p.id === urlProjectId);
      if (fromUrl) return fromUrl;
    }

    // Fall back to localStorage
    if (organization) {
      const storedId = readStorage(`last-project:${organization.id}`);
      if (storedId) {
        const fromStorage = projects.find((p) => p.id === storedId);
        if (fromStorage) return fromStorage;
      }
    }

    // Fall back to first project
    return projects[0] ?? null;
  }, [urlProjectId, projects, organization]);

  // Set current project (updates URL + localStorage)
  const setCurrentProject = useCallback(
    (projectId: string) => {
      if (organization) {
        writeStorage(`last-project:${organization.id}`, projectId);
      }

      // Update URL
      const params = new URLSearchParams(location.search as string);
      if (projectId) {
        params.set("projectId", projectId);
      } else {
        params.delete("projectId");
      }
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        query ? `${location.pathname}?${query}` : location.pathname,
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    [organization, location.pathname, location.search],
  );

  // Switch workspace
  const switchWorkspace = useCallback(
    async (organizationId: string) => {
      if (organizationId === organization?.id) return;

      // Dynamic import to avoid circular deps
      const { setActiveOrganizationAction } = await import(
        "@/lib/auth-helpers"
      );
      await setActiveOrganizationAction({ data: { organizationId } });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-bootstrap"] }),
        queryClient.invalidateQueries({ queryKey: ["organization"] }),
        queryClient.invalidateQueries({ queryKey: ["organizations"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);

      void navigate({
        to: "/dashboard/workspace",
        search: {
          page: 1,
          pageSize: 25,
          q: undefined,
          sort: undefined,
          order: undefined,
        },
      });
    },
    [organization, queryClient, navigate],
  );

  // Invalidate all project-dependent queries when project changes
  const prevProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    const newId = currentProject?.id ?? null;
    const oldId = prevProjectIdRef.current;

    // Skip first render (oldId is null)
    if (oldId !== null && oldId !== newId) {
      // Invalidate all queries that depend on projectId
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
      void queryClient.invalidateQueries({ queryKey: ["environments"] });
      void queryClient.invalidateQueries({ queryKey: ["collection-schema"] });
      void queryClient.invalidateQueries({ queryKey: ["collection-page"] });
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    }

    prevProjectIdRef.current = newId;
  }, [currentProject?.id, queryClient]);

  const value: DashboardContextValue = useMemo(
    () => ({
      organization,
      organizations,
      workspaceLoading: bootstrapQuery.isLoading,
      currentProject,
      projects,
      projectLoading: bootstrapQuery.isLoading,
      setCurrentProject,
      switchWorkspace,
    }),
    [
      organization,
      organizations,
      bootstrapQuery.isLoading,
      currentProject,
      projects,
      setCurrentProject,
      switchWorkspace,
    ],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

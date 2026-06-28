import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getActiveOrganization,
  getSession,
  setActiveOrganizationAction,
  listOrganizations,
} from "@/lib/auth-helpers";
import { listProjectsServerFn } from "@/lib/projects-helpers";
import { authClient } from "@/lib/auth-client";
import { env } from "@/lib/env";
import { ThemeToggle } from "@/components/theme-toggle";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar";
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import {
  Layers,
  Users,
  KeyRound,
  Settings,
  LogOut,
  BookOpen,
  ExternalLink,
  User,
  ChevronUp,
  BarChart3,
  Image,
  ChevronDown,
  Building2,
  Check,
  PlusCircle,
} from "lucide-react";

function getProjectStorageKey(organizationId: string) {
  return `mini-cms:last-project:${organizationId}`;
}

function readStoredProjectId(organizationId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(getProjectStorageKey(organizationId));
  } catch {
    return null;
  }
}

function writeStoredProjectId(organizationId: string, projectId: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getProjectStorageKey(organizationId), projectId);
  } catch {
    // Ignore local storage failures.
  }
}

function DashboardPending() {
  return (
    <SidebarProvider
      className="min-h-svh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100"
      style={{ "--sidebar-width": "300px" } as React.CSSProperties}
    >
      <Sidebar className="border-r border-stone-200 bg-white text-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100 h-svh">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-white dark:bg-white dark:text-stone-900">
              <Layers className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Mini CMS</span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border flex flex-col border-stone-200 bg-stone-50 p-2.5 dark:border-stone-800 dark:bg-stone-950/50">
              <p className="px-1 text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
                Project
              </p>
              <div className="mt-2 h-10 w-full animate-pulse rounded-lg bg-stone-200 dark:bg-stone-800" />
              <div className="mt-2 h-5 w-24 animate-pulse rounded bg-stone-200 dark:bg-stone-800" />
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="pt-0">
            <SidebarMenu className="gap-0.5 text-sm">
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <span className="text-stone-700 dark:text-stone-300">
                    <Layers className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                    Collections
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <span className="text-stone-700 dark:text-stone-300">
                    <Image className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                    Assets
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <span className="text-stone-700 dark:text-stone-300">
                    <Users className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                    Team
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <span className="text-stone-700 dark:text-stone-300">
                    <KeyRound className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                    API Keys
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {env.PUBLIC_ENABLE_WEB_ANALYTICS ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <span className="text-stone-700 dark:text-stone-300">
                      <BarChart3 className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                      Analytics
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <span className="text-stone-700 dark:text-stone-300">
                    <BookOpen className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                    Docs
                    <ExternalLink className="ml-auto h-3 w-3 text-stone-400" />
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-stone-200 p-2 pt-3 dark:border-stone-800">
          {/* Workspace button skeleton */}
          <div className="mb-3 h-[52px] w-full animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" />
          {/* Profile skeleton */}
          <div className="flex items-center gap-2.5 border-t border-stone-200 px-2 py-2 dark:border-stone-800">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-stone-200 dark:bg-stone-800" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-20 animate-pulse rounded bg-stone-200 dark:bg-stone-800" />
              <div className="mt-1 h-3 w-32 animate-pulse rounded bg-stone-200 dark:bg-stone-800" />
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="dash-dark min-w-0 flex-1 bg-transparent h-svh">
        <div className="flex h-full min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900 dark:border-stone-700 dark:border-t-stone-100" />
            <p className="text-sm text-stone-500 dark:text-stone-400">Loading…</p>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export const Route = createFileRoute("/dashboard")({
  pendingMs: 0,
  pendingMinMs: 300,
  pendingComponent: DashboardPending,
  beforeLoad: async () => {
    const session = await getSession();

    if (!session) {
      throw redirect({ to: "/" });
    }

    const organization = await getActiveOrganization();
    const organizations = organization ? await listOrganizations() : [];
    const projects = organization ? await listProjectsServerFn() : [];

    return {
      user: session.user,
      hasWorkspace: Boolean(organization),
      organization,
      organizations,
      projects,
    };
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user, hasWorkspace, organization, organizations, projects } = useRouteContext({ from: "/dashboard" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const location = useLocation();
  const isMobile = useIsMobile();

  const currentPath = location.pathname;
  const currentSearch = new URLSearchParams(location.search);
  const currentProjectId = currentSearch.get("projectId") ?? "";

  useEffect(() => {
    if (!hasWorkspace) {
      if (currentPath !== "/dashboard/workspace") {
        void navigate({ to: "/dashboard/workspace" });
      }
      return;
    }

    if (!organization || projects.length === 0) {
      return;
    }

    const hasValidCurrentProject = projects.some(
      (project) => project.id === currentProjectId,
    );

    if (hasValidCurrentProject && currentProjectId) {
      writeStoredProjectId(organization.id, currentProjectId);
      return;
    }

    if (
      currentPath === "/dashboard" ||
      currentPath === "/dashboard/assets" ||
      currentPath === "/dashboard/analytics"
    ) {
      const storedProjectId = readStoredProjectId(organization.id);
      const preferredProjectId = projects.some(
        (project) => project.id === storedProjectId,
      )
        ? storedProjectId
        : projects[0]?.id;

      if (!preferredProjectId) {
        return;
      }

      const params = new URLSearchParams(currentSearch);
      params.set("projectId", preferredProjectId);
      if (currentPath === "/dashboard/analytics" && !params.get("range")) {
        params.set("range", "30d");
      }
      window.history.replaceState({}, "", `${currentPath}?${params.toString()}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [
    currentPath,
    currentProjectId,
    currentSearch,
    hasWorkspace,
    navigate,
    organization,
    projects,
  ]);

  function handleProjectSelect(projectId: string) {
    if (organization && projectId) {
      writeStoredProjectId(organization.id, projectId);
    }

    const params = new URLSearchParams(currentSearch);
    if (projectId) {
      params.set("projectId", projectId);
    } else {
      params.delete("projectId");
    }

    if (currentPath === "/dashboard/analytics" && !params.get("range")) {
      params.set("range", "30d");
    }

    const query = params.toString();
    window.history.replaceState({}, "", query ? `${currentPath}?${query}` : currentPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  async function handleWorkspaceSwitch(organizationId: string) {
    if (organizationId === organization?.id) {
      setWorkspaceMenuOpen(false);
      return;
    }

    await setActiveOrganizationAction({ data: { organizationId } });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["organization"] }),
      queryClient.invalidateQueries({ queryKey: ["organizations"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ]);

    setWorkspaceMenuOpen(false);
    void navigate({ to: "/dashboard/workspace" });
  }

  return (
    <SidebarProvider
      className="min-h-svh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100"
      style={{ "--sidebar-width": "300px" } as React.CSSProperties}
    >
      <Sidebar
        collapsible={isMobile ? "offcanvas" : "none"}
        className="border-r border-stone-200 bg-white text-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100 h-svh"
      >
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-white dark:bg-white dark:text-stone-900">
              <Layers className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Mini CMS</span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border flex flex-col border-stone-200 bg-stone-50 p-2.5 dark:border-stone-800 dark:bg-stone-950/50">
              <p className="px-1 text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
                Project
              </p>
              {hasWorkspace ? (
                <select
                  value={currentProjectId || projects[0]?.id || ""}
                  onChange={(event) => handleProjectSelect(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium outline-none transition focus:border-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                >
                  {projects.length ? (
                    projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No projects yet</option>
                  )}
                </select>
              ) : (
                <p className="mt-2 px-1 text-xs text-stone-500 dark:text-stone-400">
                  Create a workspace first.
                </p>
              )}
              {hasWorkspace ? (
                <Link
                  to="/dashboard/projects"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-200 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Manage projects
                </Link>
              ) : null}
              {hasWorkspace && currentProjectId ? (
                <Link
                  to="/dashboard/projects/$projectId/settings"
                  params={{ projectId: currentProjectId }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-200 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Project settings
                </Link>
              ) : null}
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="pt-0">
            <SidebarMenu className="gap-0.5 text-sm">
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    to="/dashboard"
                    search={{ projectId: undefined }}
                    activeOptions={{ exact: true }}
                    className="text-stone-700 transition hover:bg-stone-100 [&.active]:bg-stone-100 [&.active]:font-medium [&.active]:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:[&.active]:bg-stone-800 dark:[&.active]:text-white"
                  >
                    <Layers className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                    Collections
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Link
                    to={"/dashboard/assets" as any}
                    className="text-stone-700 transition hover:bg-stone-100 [&.active]:bg-stone-100 [&.active]:font-medium [&.active]:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:[&.active]:bg-stone-800 dark:[&.active]:text-white"
                  >
                    <Image className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                    Assets
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    to="/dashboard/team"
                    className="text-stone-700 transition hover:bg-stone-100 [&.active]:bg-stone-100 [&.active]:font-medium [&.active]:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:[&.active]:bg-stone-800 dark:[&.active]:text-white"
                  >
                    <Users className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                    Team
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    to="/dashboard/api-keys"
                    className="text-stone-700 transition hover:bg-stone-100 [&.active]:bg-stone-100 [&.active]:font-medium [&.active]:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:[&.active]:bg-stone-800 dark:[&.active]:text-white"
                  >
                    <KeyRound className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                    API Keys
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {env.PUBLIC_ENABLE_WEB_ANALYTICS ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link
                      to="/dashboard/analytics"
                      search={{ projectId: undefined, range: "30d" }}
                      className="text-stone-700 transition hover:bg-stone-100 [&.active]:bg-stone-100 [&.active]:font-medium [&.active]:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:[&.active]:bg-stone-800 dark:[&.active]:text-white"
                    >
                      <BarChart3 className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                      Analytics
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a
                    href={env.PUBLIC_DOCS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-700 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                  >
                    <BookOpen className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                    Docs
                    <ExternalLink className="ml-auto h-3 w-3 text-stone-400" />
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-stone-200 p-2 pt-3 dark:border-stone-800">
          <div className="relative">
            {workspaceMenuOpen ? (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setWorkspaceMenuOpen(false)}
                />
                <div className="absolute bottom-full left-0 z-50 mb-2 w-full rounded-xl border border-stone-200 bg-white p-2 shadow-lg dark:border-stone-700 dark:bg-stone-900">
                  <div className="mb-2 flex flex-col items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">
                      Workspaces
                    </p>
                    <Link
                      to="/dashboard/workspace"
                      onClick={() => setWorkspaceMenuOpen(false)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Create workspace
                    </Link>
                  </div>

                  <div className="space-y-0.5">
                    {organizations.length ? (
                      organizations.map((org) => {
                        const isActive = org.id === organization?.id;

                        return (
                          <button
                            key={org.id}
                            type="button"
                            onClick={() => void handleWorkspaceSwitch(org.id)}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-stone-700 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                          >
                            <Building2 className="h-4 w-4 shrink-0 text-stone-500 dark:text-stone-400" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-stone-900 dark:text-stone-100">
                                {org.name}
                              </p>
                              <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                                {org.slug}
                              </p>
                            </div>
                            {isActive ? (
                              <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            ) : null}
                          </button>
                        );
                      })
                    ) : (
                      <p className="px-2.5 py-2 text-xs text-stone-500 dark:text-stone-400">
                        No workspaces available.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : null}

            <button
              type="button"
              onClick={() => setWorkspaceMenuOpen((open) => !open)}
              className="mb-3 flex w-full items-center gap-2.5 rounded-lg border border-stone-200 px-2.5 py-2 text-left text-sm transition hover:bg-stone-100 dark:border-stone-800 dark:hover:bg-stone-800"
            >
              <Settings className="h-4 w-4 text-stone-500 dark:text-stone-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-stone-900 dark:text-stone-100">
                  {organization?.name ?? "Create workspace"}
                </p>
                <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                  {organization?.slug ?? "Workspace required before creating a project"}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-stone-400 transition ${workspaceMenuOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          <div className="relative border-t border-stone-200 pt-3 dark:border-stone-800">
            {profileOpen ? (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileOpen(false)}
                />
                <div className="absolute bottom-full left-0 z-50 mb-2 w-full rounded-xl border border-stone-200 bg-white p-3 shadow-lg dark:border-stone-700 dark:bg-stone-900">
                  <div className="mb-3 px-1">
                    <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                      {user.name || "User"}
                    </p>
                    <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                      {user.email}
                    </p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Link
                      to="/dashboard/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-stone-700 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                    >
                      <User className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                      Profile settings
                    </Link>
                    <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-stone-700 dark:text-stone-300">
                      <ThemeToggle className="flex h-5 w-5 items-center justify-center rounded text-stone-500 transition hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100" />
                      <span className="text-stone-500 dark:text-stone-400">Theme</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void authClient.signOut({
                          fetchOptions: {
                            onSuccess: () => {
                              window.location.href = "/";
                            },
                          },
                        });
                      }}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                {user.image ? (
                  <img
                    src={user.image}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                  {user.name || "User"}
                </p>
                <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                  {user.email}
                </p>
              </div>
              <ChevronUp className="h-4 w-4 shrink-0 text-stone-400" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="dash-dark min-w-0 flex-1 bg-transparent h-svh">
        {/* Mobile header with hamburger */}
        <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900 md:hidden">
          <SidebarTrigger className="h-8 w-8 text-stone-600 dark:text-stone-400" />
          <span className="text-sm font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Mini CMS
          </span>
        </div>
        <div className="p-3 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

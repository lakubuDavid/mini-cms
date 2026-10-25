import React, { useEffect, useState } from "react";
import { getSession } from "@/lib/auth-helpers";
import { authClient } from "@/lib/auth-client";
import { env } from "@/lib/env";
import { ThemeToggle } from "@/components/theme-toggle";
import { EnvironmentSwitcher } from "@/components/environment-switcher";
import { DashboardProvider, useDashboard } from "@/lib/dashboard-context";
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

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const session = await getSession();

    if (!session) {
      throw redirect({ to: "/" });
    }

    return {
      user: session.user,
    };
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <DashboardProvider>
      <DashboardLayoutInner />
    </DashboardProvider>
  );
}

function DashboardLayoutInner() {
  const { user } = useRouteContext({ from: "/dashboard" });
  const {
    organization,
    organizations,
    workspaceLoading,
    currentProject,
    projects,
    setCurrentProject,
    switchWorkspace,
  } = useDashboard();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  const currentPath = location.pathname;
  const hasWorkspace = Boolean(organization);
  const currentProjectId = currentProject?.id ?? "";
  const currentMembership = organization?.members?.find(
    (member) => member.user.id === user.id,
  );
  const canManageWorkspace =
    currentMembership?.role
      .split(",")
      .some((role) => role === "owner" || role === "admin") ?? false;

  // Redirect to workspace page if no workspace exists
  useEffect(() => {
    if (workspaceLoading) return;
    if (!hasWorkspace && currentPath !== "/dashboard/workspace") {
      void navigate({
        to: "/dashboard/workspace",
        search: { page: 1, pageSize: 25, q: undefined, sort: undefined, order: undefined } as any,
      });
    }
  }, [workspaceLoading, hasWorkspace, currentPath, navigate]);

  // Ensure projectId is in URL for pages that need it
  useEffect(() => {
    if (workspaceLoading || !currentProject || !organization) return;

    const urlParams = new URLSearchParams(location.search as string);
    const urlProjectId = urlParams.get("projectId");

    // Only add projectId if the page uses it and it's missing
    const pagesNeedingProjectId = [
      "/dashboard",
      "/dashboard/team",
      "/dashboard/assets",
      "/dashboard/api-keys",
      "/dashboard/analytics",
    ];

    if (
      pagesNeedingProjectId.includes(currentPath) &&
      !urlProjectId
    ) {
      urlParams.set("projectId", currentProject.id);
      const query = urlParams.toString();
      window.history.replaceState(
        {},
        "",
        `${currentPath}?${query}`,
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [workspaceLoading, currentProject, organization, currentPath, location.search]);

  // Replace a projectId the member cannot access with the active project.
  useEffect(() => {
    if (workspaceLoading || !organization) return;

    const urlParams = new URLSearchParams(location.search as string);
    const urlProjectId = urlParams.get("projectId");

    if (!urlProjectId) return;
    if (projects.some((project) => project.id === urlProjectId)) return;

    if (currentProject) {
      urlParams.set("projectId", currentProject.id);
    } else {
      urlParams.delete("projectId");
    }

    const query = urlParams.toString();
    window.history.replaceState(
      {},
      "",
      `${currentPath}${query ? `?${query}` : ""}`,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [
    workspaceLoading,
    organization,
    projects,
    currentProject,
    currentPath,
    location.search,
  ]);

  function handleProjectChange(projectId: string) {
    setCurrentProject(projectId);
  }

  async function handleWorkspaceSwitch(organizationId: string) {
    if (organizationId === organization?.id) {
      setWorkspaceMenuOpen(false);
      return;
    }
    await switchWorkspace(organizationId);
    setWorkspaceMenuOpen(false);
  }

  return (
    <SidebarProvider
      className="h-svh overflow-hidden bg-background text-foreground"
      style={{ "--sidebar-width": "260px" } as React.CSSProperties}
    >
      <Sidebar
        collapsible={isMobile ? "offcanvas" : "icon"}
        className="border-r border-sidebar-border h-svh"
      >
        <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
          <div className="flex items-center gap-2.5 px-2 py-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:px-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-white dark:bg-white dark:text-stone-900">
              <Layers className="h-4 w-4" />
            </div>
            <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              Mini CMS
            </span>
            <SidebarTrigger className="ml-auto text-stone-500 group-data-[collapsible=icon]:ml-0" />
          </div>

          <div className="mt-4 space-y-3 group-data-[collapsible=icon]:hidden">
            <div className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-2.5 dark:border-stone-800 dark:bg-stone-800">
              <p className="px-2 text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
                Project
              </p>
              {hasWorkspace ? (
                <select
                  value={currentProjectId || projects[0]?.id || ""}
                  onChange={(event) => handleProjectChange(event.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-sm font-medium text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:focus:border-stone-500 dark:focus:ring-stone-800"
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
                <p className="px-2 text-xs text-stone-500 dark:text-stone-400">
                  Create a workspace first.
                </p>
              )}
              {hasWorkspace ? (
                <Link
                  to="/dashboard/projects"
                  search={{ page: 1, pageSize: 25, q: undefined, sort: undefined, order: undefined }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-200 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white"
                >
                  <Settings className="h-3.5 w-3.5" />
                  {canManageWorkspace ? "Manage projects" : "Projects"}
                </Link>
              ) : null}
              {hasWorkspace && currentProjectId ? (
                <EnvironmentSwitcher projectId={currentProjectId} />
              ) : null}
              {hasWorkspace && currentProjectId ? (
                <Link
                  to="/dashboard/projects/$projectId/settings"
                  params={{ projectId: currentProjectId }}
                  search={{page: undefined, pageSize: undefined, q: undefined, sort: undefined, order: undefined}}
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
                <SidebarMenuButton asChild tooltip="Collections">
                  <Link
                    to="/dashboard"
                    search={{ projectId: undefined }}
                    activeOptions={{ exact: true, includeSearch: false }}
                    activeProps={{ className: "active" }}
                    className="text-stone-500 transition hover:bg-transparent hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:text-stone-400 dark:hover:bg-transparent dark:hover:text-stone-100 dark:focus-visible:ring-stone-500 [&.active]:bg-sidebar-accent [&.active]:font-semibold [&.active]:text-sidebar-accent-foreground [&.active]:hover:bg-sidebar-accent"
                  >
                    <Layers className="h-4 w-4" />
                    <span className="truncate group-data-[collapsible=icon]:hidden">Collections</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Assets">
                  <Link
                    to="/dashboard/assets"
                    activeOptions={{ includeSearch: false }}
                    activeProps={{ className: "active" }}
                    className="text-stone-500 transition hover:bg-transparent hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:text-stone-400 dark:hover:bg-transparent dark:hover:text-stone-100 dark:focus-visible:ring-stone-500 [&.active]:bg-sidebar-accent [&.active]:font-semibold [&.active]:text-sidebar-accent-foreground [&.active]:hover:bg-sidebar-accent"
                  >
                    <Image className="h-4 w-4" />
                    <span className="truncate group-data-[collapsible=icon]:hidden">Assets</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {canManageWorkspace ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Team">
                    <Link
                      to="/dashboard/team"
                      activeOptions={{ includeSearch: false }}
                      activeProps={{ className: "active" }}
                      search={{
                        membersPage: 1,
                        membersPageSize: 25,
                        membersQ: undefined,
                        membersSort: undefined,
                        membersOrder: undefined,
                        invitesPage: 1,
                        invitesPageSize: 25,
                        invitesQ: undefined,
                        invitesSort: undefined,
                        invitesOrder: undefined,
                        projectId: currentProjectId || undefined,
                      }}
                      className="text-stone-500 transition hover:bg-transparent hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:text-stone-400 dark:hover:bg-transparent dark:hover:text-stone-100 dark:focus-visible:ring-stone-500 [&.active]:bg-sidebar-accent [&.active]:font-semibold [&.active]:text-sidebar-accent-foreground [&.active]:hover:bg-sidebar-accent"
                    >
                      <Users className="h-4 w-4" />
                      <span className="truncate group-data-[collapsible=icon]:hidden">Team</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {canManageWorkspace ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="API Keys">
                    <Link
                      to="/dashboard/api-keys"
                      activeOptions={{ includeSearch: false }}
                      activeProps={{ className: "active" }}
                      search={{ page: 1, pageSize: 25, q: undefined, sort: undefined, order: undefined, projectId: currentProjectId || undefined }}
                      className="text-stone-500 transition hover:bg-transparent hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:text-stone-400 dark:hover:bg-transparent dark:hover:text-stone-100 dark:focus-visible:ring-stone-500 [&.active]:bg-sidebar-accent [&.active]:font-semibold [&.active]:text-sidebar-accent-foreground [&.active]:hover:bg-sidebar-accent"
                    >
                      <KeyRound className="h-4 w-4" />
                      <span className="truncate group-data-[collapsible=icon]:hidden">API Keys</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {env.PUBLIC_ENABLE_WEB_ANALYTICS ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Analytics">
                    <Link
                      to="/dashboard/analytics"
                      activeOptions={{ includeSearch: false }}
                      activeProps={{ className: "active" }}
                      search={{ projectId: undefined, range: "30d" }}
                      className="text-stone-500 transition hover:bg-transparent hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:text-stone-400 dark:hover:bg-transparent dark:hover:text-stone-100 dark:focus-visible:ring-stone-500 [&.active]:bg-sidebar-accent [&.active]:font-semibold [&.active]:text-sidebar-accent-foreground [&.active]:hover:bg-sidebar-accent"
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span className="truncate group-data-[collapsible=icon]:hidden">Analytics</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-stone-200 p-2 pt-3 dark:border-stone-800">
          <a
            href={env.PUBLIC_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-2 flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-stone-500 transition hover:bg-transparent hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 dark:text-stone-400 dark:hover:bg-transparent dark:hover:text-stone-100 dark:focus-visible:ring-stone-500"
          >
            <BookOpen className="h-4 w-4" />
            <span className="group-data-[collapsible=icon]:hidden">Docs</span>
            <ExternalLink className="ml-auto h-3 w-3 text-stone-400 group-data-[collapsible=icon]:hidden" />
          </a>
          <div className="relative">
            {workspaceMenuOpen ? (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setWorkspaceMenuOpen(false)}
                />
                <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-stone-200 bg-white p-2 shadow-lg dark:border-stone-700 dark:bg-stone-900">
                  <div className="mb-2 flex flex-col items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">
                      Workspaces
                    </p>
                    <Link
                      to="/dashboard/workspace"
                      search={{ page: 1, pageSize: 25, q: undefined, sort: undefined, order: undefined }}
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
              className="mb-3 flex w-full items-center gap-2.5 rounded-lg border border-stone-200 px-2.5 py-2 text-left text-sm transition hover:bg-stone-100 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:px-0 dark:border-stone-800 dark:hover:bg-stone-800"
            >
              <Settings className="h-4 w-4 text-stone-500 dark:text-stone-400" />
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate font-medium text-stone-900 dark:text-stone-100">
                  {organization?.name ?? "Create workspace"}
                </p>
                <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                  {organization?.slug ?? "Workspace required before creating a project"}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-stone-400 transition group-data-[collapsible=icon]:hidden ${workspaceMenuOpen ? "rotate-180" : ""}`}
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
                <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-stone-200 bg-white p-3 shadow-lg dark:border-stone-700 dark:bg-stone-900">
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
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition hover:bg-stone-100 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 dark:hover:bg-stone-800"
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
              <div className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                  {user.name || "User"}
                </p>
                <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                  {user.email}
                </p>
              </div>
              <ChevronUp className="h-4 w-4 shrink-0 text-stone-400 group-data-[collapsible=icon]:hidden" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="dash-dark flex h-svh min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
        {/* Mobile header with hamburger */}
        <div className="z-20 flex shrink-0 items-center gap-2 border-b border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900 md:hidden">
          <SidebarTrigger className="h-8 w-8 text-stone-600 dark:text-stone-400" />
          <span className="text-sm font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Mini CMS
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

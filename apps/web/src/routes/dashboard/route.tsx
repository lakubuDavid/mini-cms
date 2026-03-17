import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getActiveOrganization,
  getSession,
  setActiveOrganizationAction,
} from "@/lib/auth-helpers";
import { authClient } from "@/lib/auth-client";
import { CreateWorkspaceForm } from "@/components/dashboard/create-workspace-form";
import { env } from "@/lib/env";
import {
  organizationQueryOptions,
  organizationsQueryOptions,
  projectsQueryOptions,
} from "@/lib/queries";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
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
  FolderTree,
  ExternalLink,
  User,
  ChevronUp,
  BarChart3,
  Image,
  ChevronDown,
  Plus,
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

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const session = await getSession();

    if (!session) {
      throw redirect({ to: "/" });
    }

    const organization = await getActiveOrganization();

    return { user: session.user, hasWorkspace: Boolean(organization) };
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user, hasWorkspace } = useRouteContext({ from: "/dashboard" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceCreateOpen, setWorkspaceCreateOpen] = useState(false);
  const orgQuery = useQuery(organizationQueryOptions());
  const orgsQuery = useQuery(organizationsQueryOptions());
  const projectsQuery = useQuery({
    ...projectsQueryOptions(),
    enabled: hasWorkspace,
  });
  const organization = orgQuery.data ?? null;
  const organizations = orgsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];

  const currentPath = typeof window === "undefined"
    ? ""
    : window.location.pathname;
  const currentSearch = typeof window === "undefined"
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search);
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

  async function handleWorkspaceSwitch(organizationId: string) {
    await setActiveOrganizationAction({ data: { organizationId } });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["organization"] }),
      queryClient.invalidateQueries({ queryKey: ["organizations"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["collections"] }),
      queryClient.invalidateQueries({ queryKey: ["assets"] }),
      queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      queryClient.invalidateQueries({ queryKey: ["team"] }),
      queryClient.invalidateQueries({ queryKey: ["invites"] }),
    ]);
    setWorkspaceOpen(false);
    window.location.href = "/dashboard";
  }

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

  return (
    <div className="flex min-h-svh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <aside className="sticky top-0 flex h-svh w-56 shrink-0 flex-col border-r border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center gap-2.5 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-white dark:bg-white dark:text-stone-900">
            <Layers className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Mini CMS</span>
        </div>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5 dark:border-stone-800 dark:bg-stone-950/50">
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
                <Plus className="h-3.5 w-3.5" />
                Manage projects
              </Link>
            ) : null}
          </div>
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-0.5 text-sm">
          <Link
            to="/dashboard/projects"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-stone-700 transition hover:bg-stone-100 [&.active]:bg-stone-100 [&.active]:font-medium [&.active]:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:[&.active]:bg-stone-800 dark:[&.active]:text-white"
          >
            <FolderTree className="h-4 w-4 text-stone-500 dark:text-stone-400" />
            Projects
          </Link>
          <Link
            to="/dashboard"
            search={{ projectId: undefined }}
            activeOptions={{ exact: true }}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-stone-700 transition hover:bg-stone-100 [&.active]:bg-stone-100 [&.active]:font-medium [&.active]:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:[&.active]:bg-stone-800 dark:[&.active]:text-white"
          >
            <Layers className="h-4 w-4 text-stone-500 dark:text-stone-400" />
            Collections
          </Link>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Link
            to={"/dashboard/assets" as any}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-stone-700 transition hover:bg-stone-100 [&.active]:bg-stone-100 [&.active]:font-medium [&.active]:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:[&.active]:bg-stone-800 dark:[&.active]:text-white"
          >
            <Image className="h-4 w-4 text-stone-500 dark:text-stone-400" />
            Assets
          </Link>
          <Link
            to="/dashboard/team"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-stone-700 transition hover:bg-stone-100 [&.active]:bg-stone-100 [&.active]:font-medium [&.active]:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:[&.active]:bg-stone-800 dark:[&.active]:text-white"
          >
            <Users className="h-4 w-4 text-stone-500 dark:text-stone-400" />
            Team
          </Link>
          <Link
            to="/dashboard/api-keys"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-stone-700 transition hover:bg-stone-100 [&.active]:bg-stone-100 [&.active]:font-medium [&.active]:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:[&.active]:bg-stone-800 dark:[&.active]:text-white"
          >
            <KeyRound className="h-4 w-4 text-stone-500 dark:text-stone-400" />
            API Keys
          </Link>
          {env.PUBLIC_ENABLE_WEB_ANALYTICS ? (
            <Link
              to="/dashboard/analytics"
              search={{ projectId: undefined, range: "30d" }}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-stone-700 transition hover:bg-stone-100 [&.active]:bg-stone-100 [&.active]:font-medium [&.active]:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:[&.active]:bg-stone-800 dark:[&.active]:text-white"
            >
              <BarChart3 className="h-4 w-4 text-stone-500 dark:text-stone-400" />
              Analytics
            </Link>
          ) : null}
          <Link
            to="/dashboard/workspace"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-stone-700 transition hover:bg-stone-100 [&.active]:bg-stone-100 [&.active]:font-medium [&.active]:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:[&.active]:bg-stone-800 dark:[&.active]:text-white"
          >
            <Settings className="h-4 w-4 text-stone-500 dark:text-stone-400" />
            Workspace
          </Link>
          <a
            href={env.PUBLIC_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-stone-700 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            <BookOpen className="h-4 w-4 text-stone-500 dark:text-stone-400" />
            Docs
            <ExternalLink className="ml-auto h-3 w-3 text-stone-400" />
          </a>
        </nav>

        <div className="relative border-t border-stone-200 pt-3 dark:border-stone-800">
          {workspaceOpen ? (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setWorkspaceOpen(false)} />
              <div className="absolute bottom-full left-0 z-50 mb-2 w-full rounded-xl border border-stone-200 bg-white p-3 shadow-lg dark:border-stone-700 dark:bg-stone-900">
                <div className="mb-3 px-1">
                  <p className="text-xs uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
                    Workspace
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                    {organization?.name ?? "No workspace selected"}
                  </p>
                </div>
                <div className="space-y-1">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => void handleWorkspaceSwitch(org.id)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition ${org.id === organization?.id ? "bg-stone-100 font-medium text-stone-900 dark:bg-stone-800 dark:text-white" : "text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"}`}
                    >
                      <span className="truncate">{org.name}</span>
                      {org.id === organization?.id ? (
                        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-400">Active</span>
                      ) : null}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceCreateOpen((open) => !open);
                  }}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  <Plus className="h-4 w-4" />
                  Create workspace
                </button>
                {workspaceCreateOpen ? (
                  <div className="mt-3 border-t border-stone-200 pt-3 dark:border-stone-800">
                    <CreateWorkspaceForm
                      compact
                      onCreated={() => {
                        setWorkspaceCreateOpen(false);
                        setWorkspaceOpen(false);
                        window.location.href = "/dashboard";
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => setWorkspaceOpen((open) => !open)}
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
            <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
          </button>
        </div>

        {/* Profile area */}
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
      </aside>
      <main className="dash-dark min-w-0 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}

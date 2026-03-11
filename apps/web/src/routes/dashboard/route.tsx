import { useState } from "react";
import { getSession } from "@/lib/auth-helpers";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
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
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const session = await getSession();

    if (!session) {
      throw redirect({ to: "/" });
    }

    return { user: session.user };
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user } = useRouteContext({ from: "/dashboard" });
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="flex min-h-svh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <aside className="sticky top-0 flex h-svh w-56 shrink-0 flex-col border-r border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center gap-2.5 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-white dark:bg-white dark:text-stone-900">
            <Layers className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Mini CMS</span>
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
            search={{}}
            activeOptions={{ exact: true }}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-stone-700 transition hover:bg-stone-100 [&.active]:bg-stone-100 [&.active]:font-medium [&.active]:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:[&.active]:bg-stone-800 dark:[&.active]:text-white"
          >
            <Layers className="h-4 w-4 text-stone-500 dark:text-stone-400" />
            Collections
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
          <Link
            to="/dashboard/workspace"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-stone-700 transition hover:bg-stone-100 [&.active]:bg-stone-100 [&.active]:font-medium [&.active]:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:[&.active]:bg-stone-800 dark:[&.active]:text-white"
          >
            <Settings className="h-4 w-4 text-stone-500 dark:text-stone-400" />
            Workspace
          </Link>
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-stone-700 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            <BookOpen className="h-4 w-4 text-stone-500 dark:text-stone-400" />
            Docs
            <ExternalLink className="ml-auto h-3 w-3 text-stone-400" />
          </a>
        </nav>

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

import { Link, createFileRoute } from "@tanstack/react-router";
import { Layers, Globe, UserPlus, BookOpen } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession } from "@/lib/auth-helpers";
import { env } from "@/lib/env";

export const Route = createFileRoute("/")({
  loader: async () => {
    if (env.PUBLIC_HIDE_HOME) {
      throw new Response("Not Found", { status: 404 });
    }

    const session = await getSession();
    return { isLoggedIn: !!session };
  },
  component: HomePage,
});

function HomePage() {
  const { isLoggedIn } = Route.useLoaderData();

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top_left,_rgba(24,24,27,0.08),_transparent_32%),linear-gradient(180deg,_#f7f4ee_0%,_#f3efe8_100%)] text-stone-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.04),_transparent_32%),linear-gradient(180deg,_#0a0a0a_0%,_#111_100%)] dark:text-stone-100">
      <section className="mx-auto flex min-h-svh max-w-6xl flex-col justify-between px-5 py-6 md:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-white dark:bg-white dark:text-stone-900">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500 dark:text-stone-400">
                Self-hosted CMS
              </p>
              <h1 className="text-lg font-semibold tracking-tight">Mini CMS</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a
              href={env.DOCS_URL ?? env.PUBLIC_DOCS_URL}
target="_blank"
              className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:border-stone-900 hover:text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:border-stone-400 dark:hover:text-white"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Docs
            </a>
            {isLoggedIn ? (
              <Link
                to="/dashboard"
                search={{ projectId: undefined }}
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:border-stone-900 hover:text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:border-stone-400 dark:hover:text-white"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
                >
                  Create workspace
                </Link>
              </>
            )}
          </div>
        </header>

        <div className="grid gap-12 py-14 lg:grid-cols-[1.3fr,0.7fr] lg:py-20">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.35em] text-stone-500 dark:text-stone-400">
              For development studios
            </p>
            <h2 className="mt-5 text-5xl font-semibold tracking-tight text-stone-950 md:text-6xl dark:text-stone-50">
              A minimal CMS for projects, teams, and a clean public API.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-stone-600 md:text-lg dark:text-stone-400">
              Manage portfolio work, team members, and structured content
              collections from one quiet dashboard. Built with TanStack Start,
              Turso, Drizzle, Better Auth, Upstash, and Resend for a
              self-hosted, serverless-ready stack.
            </p>
          </div>

          <div className="grid gap-4 self-end">
            <FeatureCard
              icon={<Layers className="h-5 w-5" />}
              title="Collections"
              description="Generic tables for projects, team members, testimonials, and future content models."
            />
            <FeatureCard
              icon={<Globe className="h-5 w-5" />}
              title="Public API"
              description="Expose collection data through workspace-scoped endpoints with pagination, caching, and rate limiting."
            />
            <FeatureCard
              icon={<UserPlus className="h-5 w-5" />}
              title="Invite flow"
              description="Send invite links to collaborators and keep dashboard access centralized."
            />
          </div>
        </div>

        <footer className="flex flex-col gap-3 border-t border-stone-200 py-6 text-sm text-stone-500 md:flex-row md:items-center md:justify-between dark:border-stone-800 dark:text-stone-500">
          <p>Minimal surface. Structured content. Self-hosted by default.</p>
          <p>Serverless-ready for Vercel and similar runtimes.</p>
        </footer>
      </section>
    </main>
  );
}

function FeatureCard(props: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-3xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur transition hover:shadow-md dark:border-stone-800 dark:bg-stone-900/80 dark:hover:border-stone-700">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-600 transition group-hover:bg-stone-900 group-hover:text-white dark:bg-stone-800 dark:text-stone-300 dark:group-hover:bg-white dark:group-hover:text-stone-900">
          {props.icon}
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-stone-950 dark:text-stone-50">
          {props.title}
        </h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-400">
        {props.description}
      </p>
    </div>
  );
}

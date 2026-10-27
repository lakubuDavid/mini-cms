import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { getActiveOrganization } from "@/lib/auth-helpers";
import {
  Layers,
  User,
  Mail,
  Lock,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect:
      typeof search.redirect === "string" && search.redirect.startsWith("/")
        ? search.redirect
        : undefined,
  }),
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const signUp = await authClient.signUp.email({
      name,
      email,
      password,
    });

    if (signUp.error) {
      setPending(false);
      setError(signUp.error.message ?? "Unable to create account.");
      return;
    }

    const organization = await getActiveOrganization();

    setPending(false);

    if (search.redirect) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await navigate({ to: search.redirect as any });
      return;
    }

    if (organization) {
      await navigate({ to: "/dashboard", search: { projectId: undefined } });
      return;
    }

    await navigate({
      to: "/dashboard/workspace",
      search: { page: 1, pageSize: 25, q: undefined, sort: undefined, order: undefined },
    });
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-stone-50 px-4 py-10 dark:bg-stone-950">
      <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 text-white dark:bg-white dark:text-stone-900">
            <Layers className="h-7 w-7" />
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">
            Get started
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight dark:text-stone-100">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            Sign up first, then create a workspace when you're ready to start managing projects.
          </p>
        </div>

        <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Full name
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="John Doe"
                className="w-full rounded-2xl border border-stone-300 bg-stone-50 pl-11 pr-4 py-3 text-sm outline-none transition focus:border-stone-900 focus:bg-white dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-500 dark:focus:bg-stone-800"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@agency.com"
                className="w-full rounded-2xl border border-stone-300 bg-stone-50 pl-11 pr-4 py-3 text-sm outline-none transition focus:border-stone-900 focus:bg-white dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-500 dark:focus:bg-stone-800"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-stone-300 bg-stone-50 pl-11 pr-4 py-3 text-sm outline-none transition focus:border-stone-900 focus:bg-white dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-500 dark:focus:bg-stone-800"
                required
              />
            </div>
          </div>
          {error ? (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl dark:bg-red-950 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
          >
            {pending ? (
              "Creating account..."
            ) : (
              <>
                Create account
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

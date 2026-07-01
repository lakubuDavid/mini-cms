import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { acceptInvitationAction, getInvitationById } from "@/lib/auth-helpers";
import { AlertCircle, LogIn, LogOut, UserPlus, Home } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  loader: async ({ params }) => {
    try {
      return await getInvitationById({ data: { id: params.token } });
    } catch {
      return {
        id: params.token,
        error: "Unable to look up this invitation. The link may be invalid.",
        organizationId: null,
        organizationName: null,
        role: null,
        status: null,
        expiresAt: null,
        hasSession: false,
        currentUserEmail: null,
        emailMatchesSession: false,
        invitedEmail: null,
      };
    }
  },
  component: InvitePage,
});

type InviteLoaderData = {
  id: string;
  organizationId: string | null;
  organizationName: string | null;
  role: string | null;
  status: string | null;
  expiresAt: number | null;
  hasSession: boolean;
  currentUserEmail: string | null;
  emailMatchesSession: boolean;
  invitedEmail: string | null;
  error?: string;
};

function InvitePage() {
  const { token } = Route.useParams();
  const invitation = Route.useLoaderData() as InviteLoaderData;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const hasSession = invitation?.hasSession === true;
  const emailMatchesSession = invitation?.emailMatchesSession === true;
  const isInvalid = invitation?.error != null;

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

    const accepted = await acceptInvitationAction({ data: { invitationId: token } });

    setPending(false);

    if (!accepted) {
      setError("Unable to accept invitation.");
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["invites"] });
    await queryClient.invalidateQueries({ queryKey: ["team"] });
    await navigate({ to: "/dashboard", search: { projectId: undefined } });
  }

  async function handleAcceptDirectly() {
    setPending(true);
    setError(null);

    try {
      const accepted = await acceptInvitationAction({
        data: { invitationId: token },
      });

      if (!accepted) {
        setError("Unable to accept invitation.");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["invites"] });
      await queryClient.invalidateQueries({ queryKey: ["team"] });
      await navigate({ to: "/dashboard", search: { projectId: undefined } });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to accept invitation.",
      );
    } finally {
      setPending(false);
    }
  }

  // ── Error state: invite not found, expired, or already used ────────────
  if (isInvalid) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-stone-50 px-4 py-10 dark:bg-stone-950">
        <div className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <p className="text-xs uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">
            Invite
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight dark:text-stone-100">
            Unable to join
          </h1>
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{invitation.error}</p>
            </div>
          </div>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
            >
              <Home className="h-4 w-4" />
              Go home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Normal state ───────────────────────────────────────────────────────
  return (
    <div className="flex min-h-svh items-center justify-center bg-stone-50 px-4 py-10 dark:bg-stone-950">
      <div className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <p className="text-xs uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">
          Invite
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight dark:text-stone-100">
          Accept your invitation
        </h1>
        <p className="mt-3 text-sm text-stone-600 dark:text-stone-400">
          Join {invitation?.organizationName ?? "the invited organization"}
          {invitation?.role ? ` as ${invitation.role}` : ""}.
        </p>

        {hasSession && !emailMatchesSession ? (
          // ── Signed in, but wrong email ────────────────────────────────
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  You're signed in as <strong>{invitation?.currentUserEmail}</strong>, but this invite was sent to a different email. Sign out and use the invited account instead.
                </p>
              </div>
            </div>
            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  void authClient.signOut({
                    fetchOptions: {
                      onSuccess: () => {
                        void navigate({ to: "/login", search: { redirect: `/invite/${token}` } });
                      },
                    },
                  });
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-300 px-4 py-3 text-sm font-medium transition hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
              <button
                type="button"
                onClick={() =>
                  void navigate({ to: "/login", search: { redirect: `/invite/${token}` } })
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
              >
                <LogIn className="h-4 w-4" />
                Use another account
              </button>
            </div>
          </div>
        ) : emailMatchesSession ? (
          // ── Signed in with the correct email ───────────────────────────
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-800/60 dark:text-stone-300">
              Signed in as {invitation?.currentUserEmail}. You can join this workspace now.
            </div>
            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => void handleAcceptDirectly()}
              className="w-full rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
            >
              {pending ? "Joining workspace..." : "Join workspace"}
            </button>
          </div>
        ) : (
          // ── Not signed in ──────────────────────────────────────────────
          <>
            <div className="mt-8 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-800/60 dark:text-stone-300">
              Sign in with your invited account, or create one, to join{" "}
              {invitation?.organizationName ?? "the workspace"}.
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  void navigate({ to: "/login", search: { redirect: `/invite/${token}` } })
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-300 px-4 py-3 text-sm font-medium transition hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </button>
              <button
                type="button"
                onClick={() =>
                  void navigate({ to: "/signup", search: { redirect: `/invite/${token}` } })
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
              >
                <UserPlus className="h-4 w-4" />
                Create account
              </button>
            </div>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <Field
                label="Full name"
                type="text"
                value={name}
                onChange={setName}
              />
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
              />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
              />
              {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
              >
                {pending ? "Creating account..." : "Create account to join"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{props.label}</span>
      <input
        type={props.type}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:focus:border-stone-500"
        required
      />
    </label>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { acceptInvitationAction, getInvitationById } from "@/lib/auth-helpers";

export const Route = createFileRoute("/invite/$token")({
  loader: ({ params }) => getInvitationById({ data: { id: params.token } }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const invitation = Route.useLoaderData();
  const navigate = useNavigate();
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

    const accepted = await acceptInvitationAction({
      data: {
        invitationId: token,
      },
    });

    setPending(false);

    if (!accepted) {
      setError("Unable to accept invitation.");
      return;
    }

    await navigate({ to: "/dashboard", search: { projectId: undefined } });
  }

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
          Join {invitation?.organizationName ?? "the invited organization"} as{" "}
          {invitation?.role ?? "a member"}.
        </p>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <Field
            label="Full name"
            type="text"
            value={name}
            onChange={setName}
          />
          <Field label="Email" type="email" value={email} onChange={setEmail} />
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
            {pending ? "Joining workspace..." : "Accept invite"}
          </button>
        </form>
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

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvitationAction,
  cancelInvitationAction,
  resendInvitationAction,
} from "@/lib/auth-helpers";
import {
  organizationQueryOptions,
  teamQueryOptions,
  invitesQueryOptions,
} from "@/lib/queries";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  UserPlus,
  Mail,
  Shield,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  XCircle,
  LoaderCircle,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/team")({
  component: TeamPage,
});

function TeamPage() {
  const queryClient = useQueryClient();
  const { organization: ssrOrganization } = Route.useRouteContext();
  const orgQuery = useQuery({ ...organizationQueryOptions(), initialData: ssrOrganization });
  const usersQuery = useQuery(teamQueryOptions());
  const invitesQuery = useQuery(invitesQueryOptions());

  const isLoading =
    orgQuery.isLoading || usersQuery.isLoading || invitesQuery.isLoading;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["team"] });
    void queryClient.invalidateQueries({ queryKey: ["invites"] });
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!orgQuery.data) {
      setMessage({ type: "error", text: "Create or activate an organization first." });
      return;
    }

    setSending(true);
    setMessage(null);

    const result = await createInvitationAction({
      data: {
        email,
        role: role as "admin" | "reviewer",
        organizationId: orgQuery.data.id,
      },
    });

    setSending(false);

    if (!result) {
      setMessage({ type: "error", text: "Unable to send invite." });
      return;
    }

    setEmail("");
    setMessage({ type: "success", text: `Invitation sent to ${result.email}.` });
    invalidate();
  }

  if (isLoading) {
    return <TeamPageSkeleton />;
  }

  type TeamMemberRow = {
    id: string;
    role: string | string[] | null;
    user?: { name?: string | null; email?: string | null } | null;
  };

  const organization = orgQuery.data ?? null;
  const members: TeamMemberRow[] = Array.isArray(
    (usersQuery.data as { members?: TeamMemberRow[] } | undefined)?.members,
  )
    ? ((usersQuery.data as { members?: TeamMemberRow[] }).members ?? [])
    : [];
  const invites = invitesQuery.data ?? [];

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Team</h2>
          <p className="mt-1 text-sm text-stone-500">
            {organization
              ? `Managing ${organization.name}`
              : "No active organization selected."}
          </p>
        </div>
      </div>

      {/* Members */}
      <div>
        <h3 className="text-sm font-medium text-stone-900">Members</h3>
        <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-stone-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-stone-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-stone-600">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {member.user?.name ?? "Unknown"}
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {member.user?.email ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-stone-600">
                      <Shield className="h-3 w-3" />
                      {Array.isArray(member.role)
                        ? member.role.join(", ")
                        : (member.role ?? "member")}
                    </span>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-stone-400">
                    No members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite form */}
      <div>
        <h3 className="text-sm font-medium text-stone-900">Invite a teammate</h3>
        <p className="mt-1 text-sm text-stone-500">
          Send an email invitation so a teammate can join your workspace.
        </p>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={handleInvite}>
          <label className="grid min-w-0 flex-1 gap-1.5">
            <span className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
              <Mail className="h-3.5 w-3.5" />
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="person@agency.com"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
              required
            />
          </label>

          <label className="grid w-36 gap-1.5">
            <span className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
              <Shield className="h-3.5 w-3.5" />
              Role
            </span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
            >
              <option value="admin">Admin</option>
              <option value="reviewer">Reviewer</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {sending ? "Sending..." : "Invite"}
          </button>
        </form>

        {message && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            {message.text}
          </div>
        )}
      </div>

      {/* Pending invites */}
      <InvitesTable
        invites={invites}
        organizationId={organization?.id ?? ""}
        onUpdate={invalidate}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Invites table with resend / revoke
// ---------------------------------------------------------------------------

function InvitesTable({ invites, organizationId, onUpdate }: {
  invites: Array<{
    id: string;
    email: string;
    role: string;
    status?: string;
    createdAt?: string;
    expiresAt?: string;
  }>;
  organizationId: string;
  onUpdate: () => void;
}) {
  const [actionState, setActionState] = useState<{
    type: "resend" | "revoke";
    inviteId: string;
    status: "confirming" | "busy" | "done";
    message: string | null;
    error: string | null;
  } | null>(null);

  if (!invites.length) return null;

  async function handleResend(invite: typeof invites[number]) {
    setActionState({
      type: "resend",
      inviteId: invite.id,
      status: "busy",
      message: null,
      error: null,
    });

    try {
      const result = await resendInvitationAction({
        data: {
          invitationId: invite.id,
          email: invite.email,
          role: invite.role as "admin" | "reviewer",
          organizationId,
        },
      });

      setActionState({
        type: "resend",
        inviteId: invite.id,
        status: "done",
        message: result
          ? `Re-invitation sent to ${result.email}.`
          : "Invitation re-sent.",
        error: null,
      });

      onUpdate();
    } catch (err) {
      setActionState({
        type: "resend",
        inviteId: invite.id,
        status: "done",
        message: null,
        error: err instanceof Error ? err.message : "Failed to resend invitation.",
      });
    }

    setTimeout(() => setActionState(null), 5000);
  }

  async function handleRevoke(inviteId: string) {
    setActionState({
      type: "revoke",
      inviteId,
      status: "busy",
      message: null,
      error: null,
    });

    try {
      await cancelInvitationAction({ data: { invitationId: inviteId } });

      setActionState({
        type: "revoke",
        inviteId,
        status: "done",
        message: "Invitation revoked.",
        error: null,
      });

      onUpdate();
    } catch (err) {
      setActionState({
        type: "revoke",
        inviteId,
        status: "done",
        message: null,
        error: err instanceof Error ? err.message : "Failed to revoke invitation.",
      });
    }

    setTimeout(() => setActionState(null), 5000);
  }

  function getAction(inviteId: string) {
    if (!actionState || actionState.inviteId !== inviteId) return null;
    return actionState;
  }

  return (
    <div>
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-stone-900">
        <Clock className="h-3.5 w-3.5 text-stone-400" />
        Pending invites
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs tabular-nums text-stone-500 dark:bg-stone-800">
          {invites.length}
        </span>
      </h3>

      <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-stone-600">Email</th>
              <th className="px-4 py-3 text-left font-medium text-stone-600">Role</th>
              <th className="px-4 py-3 text-left font-medium text-stone-600">Sent</th>
              <th className="px-4 py-3 text-right font-medium text-stone-600">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {invites.map((invite) => {
              const action = getAction(invite.id);
              const isBusy = action?.status === "busy";
              const isDone = action?.status === "done";

              return (
                <tr key={invite.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 text-stone-700">{invite.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-stone-600">
                      {invite.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-400">
                    {invite.createdAt
                      ? new Date(invite.createdAt).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isDone && action?.message ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        {action.message}
                      </span>
                    ) : isDone && action?.error ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        {action.error}
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleResend(invite)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
                        >
                          {isBusy && action?.type === "resend" ? (
                            <LoaderCircle className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Resend
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleRevoke(invite.id)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                        >
                          {isBusy && action?.type === "revoke" ? (
                            <LoaderCircle className="h-3 w-3 animate-spin" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          Revoke
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TeamPageSkeleton() {
  return (
    <section className="space-y-8">
      <div>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>

      <div>
        <Skeleton className="h-4 w-20" />
        <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-stone-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-stone-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-stone-600">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {Array.from({ length: 2 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-md" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-64" />
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>
    </section>
  );
}

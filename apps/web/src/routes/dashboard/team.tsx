import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvitationAction,
  cancelInvitationAction,
  resendInvitationAction,
  updateMemberRoleAction,
  removeMemberAction,
} from "@/lib/auth-helpers";
import {
  organizationQueryOptions,
  teamQueryOptions,
  invitesQueryOptions,
} from "@/lib/queries";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { DataTable, type DataTableColumn } from "@workspace/ui/components/data-table";
import { useDataTableRouterState } from "@/lib/data-table/use-data-table-router-state";
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
  UserMinus,
  ChevronDown,
} from "lucide-react";

function intOrUndefined(v: unknown): number | undefined {
  if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  return undefined;
}
function strOrUndefined(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function orderOrUndefined(v: unknown): "asc" | "desc" | undefined {
  return v === "asc" || v === "desc" ? v : undefined;
}

export const Route = createFileRoute("/dashboard/team")({
  validateSearch: (search: Record<string, unknown>) => ({
    membersPage: intOrUndefined(search.membersPage),
    membersPageSize: intOrUndefined(search.membersPageSize),
    membersQ: strOrUndefined(search.membersQ),
    membersSort: strOrUndefined(search.membersSort),
    membersOrder: orderOrUndefined(search.membersOrder),
    invitesPage: intOrUndefined(search.invitesPage),
    invitesPageSize: intOrUndefined(search.invitesPageSize),
    invitesQ: strOrUndefined(search.invitesQ),
    invitesSort: strOrUndefined(search.invitesSort),
    invitesOrder: orderOrUndefined(search.invitesOrder),
  }),
  component: TeamPage,
});

type TeamMember = {
  id: string;
  role: string;
  createdAt?: string | Date;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  createdAt?: string | Date;
  expiresAt?: string | Date;
};

function TeamPage() {
  const queryClient = useQueryClient();
  const { organization: ssrOrganization, user: currentUser } = Route.useRouteContext();
  const orgQuery = useQuery({ ...organizationQueryOptions(), initialData: ssrOrganization });

  // Two table state slots, namespaced via prefix in the URL.
  const membersTable = useDataTableRouterState({
    defaults: { page: 1, pageSize: 25, defaultSort: null },
    prefix: "members",
  });
  const invitesTable = useDataTableRouterState({
    defaults: { page: 1, pageSize: 25, defaultSort: null },
    prefix: "invites",
  });

  const usersQuery = useQuery({
    ...teamQueryOptions(membersTable.page, membersTable.pageSize),
    enabled: !!orgQuery.data,
  });
  const invitesQuery = useQuery({
    ...invitesQueryOptions(invitesTable.page, invitesTable.pageSize),
    enabled: !!orgQuery.data,
  });

  const isLoading =
    orgQuery.isLoading || usersQuery.isLoading || invitesQuery.isLoading;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [memberAction, setMemberAction] = useState<{
    type: "role" | "remove";
    memberId: string;
    status: "busy" | "done";
    message: string | null;
    error: string | null;
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
      data: { email, role: role as "admin" | "reviewer", organizationId: orgQuery.data.id },
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

  async function handleRoleChange(memberId: string, newRole: string) {
    setMemberAction({ type: "role", memberId, status: "busy", message: null, error: null });
    try {
      await updateMemberRoleAction({ data: { memberId, role: newRole } });
      setMemberAction({ type: "role", memberId, status: "done", message: "Role updated.", error: null });
      invalidate();
    } catch (err) {
      setMemberAction({
        type: "role", memberId, status: "done", message: null,
        error: err instanceof Error ? err.message : "Failed to update role.",
      });
    }
    setTimeout(() => setMemberAction(null), 4000);
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm("Remove this member from the workspace? This action cannot be undone.")) return;
    setMemberAction({ type: "remove", memberId, status: "busy", message: null, error: null });
    try {
      await removeMemberAction({ data: { memberId, organizationId: orgQuery.data!.id } });
      setMemberAction({ type: "remove", memberId, status: "done", message: "Member removed.", error: null });
      invalidate();
    } catch (err) {
      setMemberAction({
        type: "remove", memberId, status: "done", message: null,
        error: err instanceof Error ? err.message : "Failed to remove member.",
      });
    }
    setTimeout(() => setMemberAction(null), 4000);
  }

  if (isLoading) return <TeamPageSkeleton />;

  const organization = orgQuery.data ?? null;
  const members: TeamMember[] = ((usersQuery.data as { items?: TeamMember[] } | undefined)?.items ?? []) as TeamMember[];
  const invites: InviteRow[] = ((invitesQuery.data as { items?: InviteRow[] } | undefined)?.items ?? []) as InviteRow[];
  const membersTotal = Number((usersQuery.data as { total?: number } | undefined)?.total ?? 0);
  const invitesTotal = Number((invitesQuery.data as { total?: number } | undefined)?.total ?? 0);
  const isAdmin = members.some((m) => m.user.id === currentUser.id && m.role === "admin");

  const membersTotalPages = Math.max(1, Math.ceil(membersTotal / membersTable.pageSize));
  const invitesTotalPages = Math.max(1, Math.ceil(invitesTotal / invitesTable.pageSize));
  const currentMembersPage = Math.min(membersTable.page, membersTotalPages);
  const currentInvitesPage = Math.min(invitesTable.page, invitesTotalPages);

  const memberColumns: DataTableColumn<TeamMember>[] = [
    {
      id: "name",
      header: "Name",
      accessor: (m) => m.user?.name ?? "",
      cell: (m) => {
        const isSelf = m.user.id === currentUser.id;
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-medium text-stone-600">
              {m.user.image ? (
                <img src={m.user.image} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                (m.user.name?.charAt(0)?.toUpperCase() ?? "?")
              )}
            </div>
            <span className="font-medium text-stone-900">
              {m.user.name ?? "Unknown"}
              {isSelf && <span className="ml-1.5 text-xs font-normal text-stone-400">(you)</span>}
            </span>
          </div>
        );
      },
      sortable: false,
    },
    {
      id: "email",
      header: "Email",
      accessor: (m) => m.user?.email ?? "",
      cell: (m) => <span className="text-stone-500">{m.user?.email ?? "-"}</span>,
    },
    {
      id: "role",
      header: "Role",
      accessor: (m) => m.role,
      cell: (m) => {
        const isSelf = m.user.id === currentUser.id;
        const isBusy = memberAction?.memberId === m.id && memberAction?.status === "busy";
        if (isAdmin && !isSelf) {
          return (
            <div className="flex items-center gap-2">
              <div className="relative inline-block">
                <select
                  value={m.role}
                  disabled={isBusy}
                  onChange={(e) => handleRoleChange(m.id, e.target.value)}
                  className="appearance-none rounded-md border border-stone-200 bg-white py-1 pl-2 pr-6 text-xs font-medium text-stone-700 outline-none transition hover:border-stone-300 focus:border-stone-900 disabled:opacity-50"
                >
                  <option value="admin">Admin</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="member">Member</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-stone-400" />
              </div>
              {memberAction?.memberId === m.id && memberAction?.status === "done" && (
                <span className={`inline-flex items-center gap-1 text-xs ${
                  memberAction.message ? "text-green-600" : "text-red-600"
                }`}>
                  {memberAction.message ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  {memberAction.message ?? memberAction.error}
                </span>
              )}
            </div>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-stone-600">
            <Shield className="h-3 w-3" />
            {m.role}
          </span>
        );
      },
    },
    ...(isAdmin
      ? [
          {
            id: "actions" as const,
            header: () => <span className="sr-only">Actions</span>,
            accessor: (m: TeamMember) => m.id,
            sortable: false,
            cell: (m: TeamMember) => {
              const isSelf = m.user.id === currentUser.id;
              const isBusy = memberAction?.memberId === m.id && memberAction?.status === "busy";
              if (isSelf || m.role === "owner") return null;
              return (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleRemoveMember(m.id)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    title="Remove from workspace"
                  >
                    {isBusy && memberAction?.type === "remove" ? (
                      <LoaderCircle className="h-3 w-3 animate-spin" />
                    ) : (
                      <UserMinus className="h-3 w-3" />
                    )}
                  </button>
                </div>
              );
            },
          } as DataTableColumn<TeamMember>,
        ]
      : []),
  ];

  const inviteColumns: DataTableColumn<InviteRow>[] = [
    {
      id: "email",
      header: "Email",
      accessor: (i) => i.email,
      cell: (i) => <span className="text-stone-700">{i.email}</span>,
    },
    {
      id: "role",
      header: "Role",
      accessor: (i) => i.role,
      cell: (i) => (
        <span className="inline-block rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-stone-600">
          {i.role}
        </span>
      ),
    },
    {
      id: "sent",
      header: "Sent",
      accessor: (i) => i.createdAt ? new Date(i.createdAt).toISOString() : "",
      cell: (i) => <span className="text-xs text-stone-400">{i.createdAt ? new Date(i.createdAt).toLocaleDateString() : "-"}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      accessor: (i) => i.id,
      sortable: false,
      cell: (i) => <InviteActionsCell invite={i} organizationId={organization?.id ?? ""} onUpdate={invalidate} />,
    },
  ];

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Team</h2>
          <p className="mt-1 text-sm text-stone-500">
            {organization ? `Managing ${organization.name}` : "No active organization selected."}
          </p>
        </div>
      </div>

      {/* Members */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium text-stone-900">
          Members
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs tabular-nums text-stone-500">
            {membersTotal}
          </span>
        </h3>
        <div className="mt-3">
          <DataTable<TeamMember>
            data={members}
            rowKey={(m) => m.id}
            columns={memberColumns}
            searchFields={[(m) => m.user?.name ?? "", (m) => m.user?.email ?? ""]}
            defaultQuery={membersTable.q}
            onQueryChange={membersTable.setQ}
            defaultSort={membersTable.sort}
            sort={membersTable.sort}
            onSortChange={membersTable.setSort}
            pagination={{
              page: currentMembersPage,
              totalPages: membersTotalPages,
              total: membersTotal,
              pageSize: membersTable.pageSize,
              onPageChange: membersTable.setPage,
              onPageSizeChange: membersTable.setPageSize,
            }}
            refresh={{
              onRefresh: () => void usersQuery.refetch(),
              isRefreshing: usersQuery.isFetching,
            }}
            emptyState="No members yet."
            caption="Team members"
          />
        </div>
      </div>

      {/* Invite form */}
      {isAdmin && (
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
              {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {sending ? "Sending..." : "Invite"}
            </button>
          </form>
          {message && (
            <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}>
              {message.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {message.text}
            </div>
          )}
        </div>
      )}

      {/* Pending invites */}
      {isAdmin && invites.length > 0 ? (
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-medium text-stone-900">
            <Clock className="h-3.5 w-3.5 text-stone-400" />
            Pending invites
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs tabular-nums text-stone-500">
              {invitesTotal}
            </span>
          </h3>
          <div className="mt-3">
            <DataTable<InviteRow>
              data={invites}
              rowKey={(i) => i.id}
              columns={inviteColumns}
              searchFields={[(i) => i.email]}
              defaultQuery={invitesTable.q}
              onQueryChange={invitesTable.setQ}
              defaultSort={invitesTable.sort}
              sort={invitesTable.sort}
              onSortChange={invitesTable.setSort}
              pagination={{
                page: currentInvitesPage,
                totalPages: invitesTotalPages,
                total: invitesTotal,
                pageSize: invitesTable.pageSize,
                onPageChange: invitesTable.setPage,
                onPageSizeChange: invitesTable.setPageSize,
              }}
              refresh={{
                onRefresh: () => void invitesQuery.refetch(),
                isRefreshing: invitesQuery.isFetching,
              }}
              emptyState="No pending invites."
              caption="Pending invites"
            />
          </div>
        </div>
      ) : isAdmin ? null : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Invite actions cell (resend / revoke) with local action state
// ---------------------------------------------------------------------------

function InviteActionsCell({ invite, organizationId, onUpdate }: {
  invite: InviteRow;
  organizationId: string;
  onUpdate: () => void;
}) {
  const [actionState, setActionState] = useState<{
    type: "resend" | "revoke";
    inviteId: string;
    status: "busy" | "done";
    message: string | null;
    error: string | null;
  } | null>(null);

  const action = actionState?.inviteId === invite.id ? actionState : null;
  const isBusy = action?.status === "busy";
  const isDone = action?.status === "done";

  async function handleResend() {
    setActionState({ type: "resend", inviteId: invite.id, status: "busy", message: null, error: null });
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
        type: "resend", inviteId: invite.id, status: "done",
        message: result ? `Re-invitation sent to ${result.email}.` : "Invitation re-sent.",
        error: null,
      });
      onUpdate();
    } catch (err) {
      setActionState({
        type: "resend", inviteId: invite.id, status: "done", message: null,
        error: err instanceof Error ? err.message : "Failed to resend invitation.",
      });
    }
    setTimeout(() => setActionState(null), 5000);
  }

  async function handleRevoke() {
    setActionState({ type: "revoke", inviteId: invite.id, status: "busy", message: null, error: null });
    try {
      await cancelInvitationAction({ data: { invitationId: invite.id } });
      setActionState({ type: "revoke", inviteId: invite.id, status: "done", message: "Invitation revoked.", error: null });
      onUpdate();
    } catch (err) {
      setActionState({
        type: "revoke", inviteId: invite.id, status: "done", message: null,
        error: err instanceof Error ? err.message : "Failed to revoke invitation.",
      });
    }
    setTimeout(() => setActionState(null), 5000);
  }

  if (isDone && action?.message) {
    return (
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
          <CheckCircle className="h-3 w-3" />{action.message}
        </span>
      </div>
    );
  }
  if (isDone && action?.error) {
    return (
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
          <AlertCircle className="h-3 w-3" />{action.error}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button type="button" disabled={isBusy} onClick={() => void handleResend()}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50">
        {isBusy && action?.type === "resend" ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        Resend
      </button>
      <button type="button" disabled={isBusy} onClick={() => void handleRevoke()}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50">
        {isBusy && action?.type === "revoke" ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
        Revoke
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TeamPageSkeleton() {
  return (
    <section className="space-y-8">
      <div><Skeleton className="h-8 w-24" /><Skeleton className="mt-2 h-4 w-48" /></div>
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
              {Array.from({ length: 3 }).map((_, i) => (
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
        <Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-64" />
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>
    </section>
  );
}

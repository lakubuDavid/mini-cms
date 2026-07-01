import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createInvitationAction } from "@/lib/auth-helpers";
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
} from "lucide-react";

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
  status: string;
  expiresAt: string | Date;
};

function TeamPage() {
  const queryClient = useQueryClient();
  const orgQuery = useQuery(organizationQueryOptions());

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
  const [pending, setPending] = useState(false);
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
    setPending(true);
    setMessage(null);
    const result = await createInvitationAction({
      data: { email, role: role as "admin" | "reviewer", organizationId: orgQuery.data.id },
    });
    setPending(false);
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

  const organization = orgQuery.data ?? null;
  const members: TeamMember[] = ((usersQuery.data as { items?: TeamMember[] } | undefined)?.items ?? []) as TeamMember[];
  const invites: InviteRow[] = ((invitesQuery.data as { items?: InviteRow[] } | undefined)?.items ?? []) as InviteRow[];
  const membersTotal = Number((usersQuery.data as { total?: number } | undefined)?.total ?? 0);
  const invitesTotal = Number((invitesQuery.data as { total?: number } | undefined)?.total ?? 0);

  const membersTotalPages = Math.max(1, Math.ceil(membersTotal / membersTable.pageSize));
  const invitesTotalPages = Math.max(1, Math.ceil(invitesTotal / invitesTable.pageSize));
  const currentMembersPage = Math.min(membersTable.page, membersTotalPages);
  const currentInvitesPage = Math.min(invitesTable.page, invitesTotalPages);

  const memberColumns: DataTableColumn<TeamMember>[] = [
    {
      id: "name",
      header: "Name",
      accessor: (m) => m.user?.name ?? "",
      cell: (m) => <span className="font-medium text-stone-900">{m.user?.name ?? "Unknown"}</span>,
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
      accessor: (m) => (Array.isArray(m.role) ? m.role.join(", ") : m.role ?? "member"),
      cell: (m) => (
        <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-stone-600">
          <Shield className="h-3 w-3" />
          {Array.isArray(m.role) ? m.role.join(", ") : m.role ?? "member"}
        </span>
      ),
    },
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
  ];

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

      <div>
        <h3 className="text-sm font-medium text-stone-900">Members</h3>
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

      <div>
        <h3 className="text-sm font-medium text-stone-900">
          Invite a teammate
        </h3>
        <p className="mt-1 text-sm text-stone-500">
          Send an email invitation so a teammate can join your workspace.
        </p>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={handleInvite}
        >
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
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {pending ? "Sending..." : "Invite"}
          </button>
        </form>

        {message ? (
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
        ) : null}
      </div>

      {invites.length > 0 || invitesTable.q ? (
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-medium text-stone-900">
            <Clock className="h-3.5 w-3.5 text-stone-400" />
            Pending invites
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
      ) : null}
    </section>
  );
}

function TeamPageSkeleton() {
  return (
    <section className="space-y-8">
      <div>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>

      <div>
        <Skeleton className="h-4 w-20" />
        <div className="mt-3 space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </section>
  );
}

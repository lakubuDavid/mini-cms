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
import {
  UserPlus,
  Mail,
  Shield,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/team")({
  component: TeamPage,
});

function TeamPage() {
  const queryClient = useQueryClient();
  const orgQuery = useQuery(organizationQueryOptions());
  const usersQuery = useQuery(teamQueryOptions());
  const invitesQuery = useQuery(invitesQueryOptions());

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
      setMessage({
        type: "error",
        text: "Create or activate an organization first.",
      });
      return;
    }

    setPending(true);
    setMessage(null);

    const result = await createInvitationAction({
      data: {
        email,
        role: role as "admin" | "reviewer",
        organizationId: orgQuery.data.id,
      },
    });

    setPending(false);

    if (!result) {
      setMessage({ type: "error", text: "Unable to send invite." });
      return;
    }

    setEmail("");
    setMessage({
      type: "success",
      text: `Invitation sent to ${result.email}.`,
    });
    invalidate();
  }

  if (isLoading) {
    return <TeamPageSkeleton />;
  }

  const organization = orgQuery.data ?? null;
  const users = usersQuery.data ?? { users: [] };
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

      <div>
        <h3 className="text-sm font-medium text-stone-900">Members</h3>
        <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-stone-600">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-stone-600">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-medium text-stone-600">
                  Role
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {users.users.map((user: (typeof users.users)[number]) => (
                <tr key={user.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {user.name}
                  </td>
                  <td className="px-4 py-3 text-stone-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-stone-600">
                      <Shield className="h-3 w-3" />
                      {Array.isArray(user.role)
                        ? user.role.join(", ")
                        : (user.role ?? "admin")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {invites.length > 0 ? (
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-medium text-stone-900">
            <Clock className="h-3.5 w-3.5 text-stone-400" />
            Pending invites
          </h3>
          <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-stone-600">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-stone-600">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {invites.map((invite: (typeof invites)[number]) => (
                  <tr key={invite.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 text-stone-700">{invite.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-stone-600">
                        {invite.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-stone-600">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-stone-600">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-medium text-stone-600">
                  Role
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {Array.from({ length: 2 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-36" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </td>
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

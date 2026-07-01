import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  updateOrganizationAction,
  setActiveOrganizationAction,
  deleteOrganizationAction,
} from "@/lib/auth-helpers";
import {
  organizationQueryOptions,
  organizationsQueryOptions,
} from "@/lib/queries";
import { CreateWorkspaceForm } from "@/components/dashboard/create-workspace-form";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { DataTable, type DataTableColumn } from "@workspace/ui/components/data-table";
import { useDataTableRouterState } from "@/lib/data-table/use-data-table-router-state";
import {
  Copy,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/workspace")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: intOrUndefined(search.page),
    pageSize: intOrUndefined(search.pageSize),
    q: strOrUndefined(search.q),
    sort: strOrUndefined(search.sort),
    order: orderOrUndefined(search.order),
  }),
  component: WorkspacePage,
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

function WorkspacePage() {
  const queryClient = useQueryClient();
  const { organization: ssrOrganization, organizations: ssrOrganizations } = Route.useRouteContext();
  const orgQuery = useQuery({ ...organizationQueryOptions(), initialData: ssrOrganization });
  const orgsQuery = useQuery({ ...organizationsQueryOptions(), initialData: ssrOrganizations });

  const isLoading = orgQuery.isLoading || orgsQuery.isLoading;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["organization"] });
    void queryClient.invalidateQueries({ queryKey: ["organizations"] });
  }

  if (isLoading) {
    return <WorkspacePageSkeleton />;
  }

  const organization = orgQuery.data ?? null;
  const organizations = orgsQuery.data ?? [];

  if (!organization) {
    return (
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Workspace</h2>
          <p className="mt-1 text-sm text-stone-500">
            No active workspace. Create one to get started.
          </p>
        </div>
        <CreateWorkspaceForm onCreated={invalidate} />
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Workspace</h2>
        <p className="mt-1 text-sm text-stone-500">
          Manage your workspace settings. Projects live inside each workspace and group related collections.
        </p>
      </div>

      <GeneralSection
        organizationId={organization.id}
        currentName={organization.name}
        currentSlug={organization.slug}
        onUpdated={invalidate}
      />

      <InfoSection
        id={organization.id}
        createdAt={organization.createdAt}
      />

      {organizations.length > 1 ? (
        <SwitcherSection
          organizations={organizations}
          activeId={organization.id}
          onSwitched={invalidate}
        />
      ) : null}

      <DangerSection
        organizationId={organization.id}
        organizationName={organization.name}
        onDeleted={invalidate}
      />
    </section>
  );
}

function WorkspacePageSkeleton() {
  return (
    <section className="space-y-8">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>

      <div>
        <Skeleton className="h-4 w-16" />
        <div className="mt-3 grid max-w-md gap-4">
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      <div>
        <Skeleton className="h-4 w-16" />
        <div className="mt-3 grid max-w-md gap-3">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      </div>
    </section>
  );
}

function GeneralSection(props: {
  organizationId: string;
  currentName: string;
  currentSlug: string;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(props.currentName);
  const [slug, setSlug] = useState(props.currentSlug);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const hasChanges = name !== props.currentName || slug !== props.currentSlug;
  const slugChanged = slug !== props.currentSlug;

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    try {
      await updateOrganizationAction({
        data: {
          organizationId: props.organizationId,
          ...(name !== props.currentName ? { name } : {}),
          ...(slug !== props.currentSlug ? { slug } : {}),
        },
      });

      setMessage({ type: "success", text: "Workspace updated." });
      props.onUpdated();
    } catch {
      setMessage({
        type: "error",
        text: "Failed to update workspace. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-stone-900">General</h3>
      <form className="mt-3 grid max-w-md gap-4" onSubmit={handleSave}>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-stone-700">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
            required
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-stone-700">Slug</span>
          <input
            value={slug}
            onChange={(event) =>
              setSlug(
                event.target.value
                  .toLowerCase()
                  .replace(/\s+/g, "-")
                  .replace(/[^a-z0-9-]/g, ""),
              )
            }
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
            required
          />
          {slugChanged ? (
            <span className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Changing the slug will affect API endpoints and CLI config.
            </span>
          ) : (
            <span className="text-xs text-stone-400">
              URL-friendly identifier for API paths.
            </span>
          )}
        </label>

        {message ? (
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
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

        <div>
          <button
            type="submit"
            disabled={pending || !hasChanges}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function InfoSection(props: { id: string; createdAt: Date }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-stone-900">Details</h3>
      <dl className="mt-3 grid max-w-md gap-3 text-sm">
        <div className="flex items-center justify-between rounded-lg border border-stone-200 px-4 py-3">
          <dt className="text-stone-500">Workspace ID</dt>
          <dd className="flex items-center gap-1.5">
            <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-700">
              {props.id}
            </code>
            <CopyButton value={props.id} />
          </dd>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-stone-200 px-4 py-3">
          <dt className="text-stone-500">Created</dt>
          <dd className="text-stone-700">
            {new Date(props.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function SwitcherSection(props: {
  organizations: Array<{ id: string; name: string; slug: string }>;
  activeId: string;
  onSwitched: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const table = useDataTableRouterState({
    defaults: { page: 1, pageSize: 25, defaultSort: null },
  });

  async function handleSwitch(organizationId: string) {
    setPending(organizationId);

    try {
      await setActiveOrganizationAction({ data: { organizationId } });
      props.onSwitched();
    } finally {
      setPending(null);
    }
  }

  const columns: DataTableColumn<{ id: string; name: string; slug: string }>[] = [
    {
      id: "name",
      header: "Name",
      accessor: (o) => o.name,
      cell: (o) => <span className="font-medium text-stone-900">{o.name}</span>,
    },
    {
      id: "slug",
      header: "Slug",
      accessor: (o) => o.slug,
      cell: (o) => <span className="font-mono text-xs text-stone-500">{o.slug}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      accessor: (o) => o.id,
      sortable: false,
      cell: (o) =>
        o.id === props.activeId ? (
          <span className="text-xs font-medium text-stone-400">Active</span>
        ) : (
          <button
            type="button"
            disabled={pending === o.id}
            onClick={() => void handleSwitch(o.id)}
            className="text-sm font-medium text-stone-700 transition hover:text-stone-900 disabled:opacity-60"
          >
            {pending === o.id ? "Switching..." : "Switch"}
          </button>
        ),
    },
  ];

  return (
    <div>
      <h3 className="text-sm font-medium text-stone-900">Switch workspace</h3>
      <p className="mt-1 text-sm text-stone-500">
        You belong to {props.organizations.length} workspaces.
      </p>
      <div className="mt-3">
        <DataTable
          data={props.organizations}
          rowKey={(o) => o.id}
          columns={columns}
          searchFields={["name", "slug"]}
          defaultQuery={table.q}
          onQueryChange={table.setQ}
          defaultSort={table.sort}
          sort={table.sort}
          onSortChange={table.setSort}
          pagination={{
            page: table.page,
            totalPages: Math.max(1, Math.ceil(props.organizations.length / table.pageSize)),
            total: props.organizations.length,
            pageSize: table.pageSize,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
          }}
          emptyState="No workspaces found."
          caption="Workspaces"
        />
      </div>
    </div>
  );
}

function DangerSection(props: {
  organizationId: string;
  organizationName: string;
  onDeleted: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);

    try {
      await deleteOrganizationAction({
        data: { organizationId: props.organizationId },
      });
      props.onDeleted();
    } catch {
      setPending(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
      <h3 className="text-sm font-medium text-red-900">Danger zone</h3>
      <p className="mt-1 text-sm text-red-700/80">
        Deleting this workspace will permanently remove all collections, items,
        API keys, and team memberships. This action cannot be undone.
      </p>

      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
        >
          Delete workspace
        </button>
      ) : (
        <div className="mt-4 grid max-w-md gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm text-red-700">
              Type{" "}
              <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-xs font-semibold">
                {props.organizationName}
              </code>{" "}
              to confirm.
            </span>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder={props.organizationName}
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={confirmText !== props.organizationName || pending}
              onClick={() => void handleDelete()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Deleting..." : "Permanently delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                setConfirmText("");
              }}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyButton(props: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(props.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-stone-400 transition hover:bg-stone-200 hover:text-stone-600"
      aria-label={`Copy ${props.value}`}
      title="Copy"
    >
      {copied ? (
        <span className="text-[10px] font-medium text-green-600">ok</span>
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

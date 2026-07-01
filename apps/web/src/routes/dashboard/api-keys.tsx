import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createApiKeyServerFn,
  deleteApiKeyServerFn,
  updateApiKeyServerFn,
  rotateApiKeyServerFn,
} from "@/lib/auth-helpers";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { DataTable, type DataTableColumn } from "@workspace/ui/components/data-table";
import { useDataTableRouterState } from "@/lib/data-table/use-data-table-router-state";
import {
  organizationQueryOptions,
  projectsQueryOptions,
  apiKeysQueryOptions,
} from "@/lib/queries";
import {
  AlertCircle,
  CheckCircle,
  Copy,
  KeyRound,
  MoreHorizontal,
  RefreshCw,
  ShieldOff,
  ShieldCheck,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/api-keys")({
  validateSearch: (search: Record<string, unknown>) => {
    const page =
      typeof search.page === "string" && /^\d+$/.test(search.page)
        ? Math.max(1, parseInt(search.page, 10))
        : 1;
    const pageSize =
      typeof search.pageSize === "string" && /^\d+$/.test(search.pageSize)
        ? parseInt(search.pageSize, 10)
        : 25;
    return {
      page,
      pageSize,
      q: typeof search.q === "string" ? search.q : undefined,
      sort: typeof search.sort === "string" ? search.sort : undefined,
      order:
        search.order === "asc" || search.order === "desc"
          ? (search.order as "asc" | "desc")
          : undefined,
      projectId:
        typeof search.projectId === "string" && search.projectId.length > 0
          ? search.projectId
          : undefined,
    };
  },
  component: ApiKeysPage,
});

type ApiKeyRow = {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  enabled: boolean;
  expiresAt: string | null;
  createdAt: string | null;
  metadata: { projectId: string } | null;
};

function ApiKeysPage() {
  const queryClient = useQueryClient();
  const { organization: ssrOrganization, projects: ssrProjects } = Route.useRouteContext();
  const {
    page,
    pageSize,
    q: urlQ,
    sort: urlSort,
    setPage,
    setPageSize,
    setSort,
    setQ: setQueryInUrl,
  } = useDataTableRouterState({
    defaults: { page: 1, pageSize: 25, defaultSort: null },
  });
  const orgQuery = useQuery({ ...organizationQueryOptions(), initialData: ssrOrganization });
  const apiKeysQuery = useQuery({
    ...apiKeysQueryOptions(page, pageSize),
    enabled: !!orgQuery.data,
  });
  const projectsQuery = useQuery({
    ...projectsQueryOptions(),
    initialData: ssrProjects,
    enabled: !!orgQuery.data,
  });

  const isLoading =
    orgQuery.isLoading || apiKeysQuery.isLoading || projectsQuery.isLoading;

  const organization = orgQuery.data ?? null;
  const apiKeys = apiKeysQuery.data ?? {
    apiKeys: [],
    total: 0,
    limit: 0,
    offset: 0,
    page: 1,
    pageSize: 25,
  };
  const projects = projectsQuery.data ?? [];

  const totalPages = Math.max(1, Math.ceil(apiKeys.total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const sortState = urlSort
    ? { by: urlSort.by, order: urlSort.order }
    : null;

  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [pending, setPending] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "rotate" | "toggle";
    keyId: string;
    keyName: string;
    enabled?: boolean;
    projectId?: string | null;
  } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const selectedProject = useMemo(
    () =>
      projects.find(
        (item: (typeof projects)[number]) => item.id === projectId,
      ) ?? null,
    [projectId, projects],
  );

  const baseUrl =
    typeof window === "undefined"
      ? "http://localhost:3000"
      : window.location.origin;

  const cliSnippet = [
    "mini-cms pull \\",
    `  --base-url ${baseUrl} \\`,
    `  --workspace-id ${organization?.id ?? "<workspace-id>"} \\`,
    `  --api-key ${revealedKey ?? "<api-key>"}`,
  ].join("\n");

  const scopedCliSnippet = selectedProject
    ? [
        "mini-cms pull \\",
        `  --base-url ${baseUrl} \\`,
        `  --workspace-id ${organization?.id ?? "<workspace-id>"} \\`,
        `  --project-id ${selectedProject.id} \\`,
        `  --api-key ${revealedKey ?? "<api-key>"}`,
      ].join("\n")
    : null;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
  }

  function refresh() {
    void apiKeysQuery.refetch();
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    try {
      const result = await createApiKeyServerFn({
        data: {
          name,
          projectId: projectId || null,
        },
      });

      if (!result) {
        setMessage({ type: "error", text: "Unable to create API key." });
        return;
      }

      setName("");
      setProjectId("");
      setRevealedKey(result.key);
      setMessage({
        type: "success",
        text: "API key created. Copy it now - it will not be shown again.",
      });
      invalidate();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Unable to create API key.",
      });
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(keyId: string) {
    let result;

    try {
      result = await deleteApiKeyServerFn({ data: { keyId } });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Unable to delete API key.",
      });
      return;
    }

    if (!result?.success) {
      setMessage({ type: "error", text: "Unable to delete API key." });
      return;
    }

    setMessage({ type: "success", text: "API key deleted." });
    invalidate();
  }

  async function handleToggleEnabled(keyId: string, enabled: boolean) {
    try {
      await updateApiKeyServerFn({
        data: { keyId, enabled },
      });
      setMessage({
        type: "success",
        text: enabled ? "API key enabled." : "API key revoked.",
      });
      invalidate();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to update API key.",
      });
    }
  }

  async function handleRotate(
    keyId: string,
    keyName: string,
    keyProjectId?: string | null,
  ) {
    try {
      const result = await rotateApiKeyServerFn({
        data: {
          keyId,
          name: keyName,
          projectId: keyProjectId,
        },
      });

      if (!result) {
        setMessage({ type: "error", text: "Unable to rotate API key." });
        return;
      }

      setRevealedKey(result.key);
      setMessage({
        type: "success",
        text: "API key rotated. Copy the new key now - it will not be shown again.",
      });
      invalidate();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Unable to rotate API key.",
      });
    }
  }

  async function executeConfirmAction() {
    if (!confirmAction) return;

    const { type, keyId, keyName, enabled, projectId: keyProjectId } = confirmAction;
    setConfirmAction(null);

    if (type === "delete") {
      await handleDelete(keyId);
    } else if (type === "toggle") {
      await handleToggleEnabled(keyId, !enabled);
    } else if (type === "rotate") {
      await handleRotate(keyId, keyName, keyProjectId);
    }
  }

  if (isLoading) {
    return <ApiKeysPageSkeleton />;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">API keys</h2>
        <p className="mt-1 text-sm text-stone-500">
          Create workspace or project-scoped keys for schema pull and push.
        </p>
      </div>

      {!organization ? (
        <div className="rounded-lg border border-stone-200 px-4 py-10 text-center text-sm text-stone-500">
          Select or create a workspace before creating API keys.
        </div>
      ) : (
        <>
          <form
            className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={handleCreate}
          >
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-stone-700">
                Key name
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Studio sync"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                required
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-stone-700">
                Project scope
              </span>
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
              >
                <option value="">Entire workspace</option>
                {projects.map((project: (typeof projects)[number]) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" />
              {pending ? "Creating..." : "Create key"}
            </button>
          </form>

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

          {revealedKey ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-stone-700">
                Your new API key
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-xs text-stone-800">
                  {revealedKey}
                </code>
                <CopyButton value={revealedKey} label="Copy key" />
              </div>
            </div>
          ) : null}

          <DataTable<ApiKeyRow>
            data={apiKeys.apiKeys as ApiKeyRow[]}
            rowKey={(k) => k.id}
            searchFields={[
              (k) => k.name ?? "",
              (k) => (k.prefix ?? "") + (k.start ?? ""),
            ]}
            defaultQuery={urlQ ?? ""}
            onQueryChange={(q) => setQueryInUrl(q)}
            defaultSort={sortState}
            sort={sortState}
            onSortChange={setSort}
            columns={
              [
                {
                  id: "name",
                  header: "Name",
                  accessor: (k) => k.name ?? "",
                  cell: (k) => (
                    <span className="font-medium text-stone-900">
                      {k.name ?? "Untitled key"}
                    </span>
                  ),
                },
                {
                  id: "enabled",
                  header: "Status",
                  accessor: (k) => (k.enabled ? "active" : "revoked"),
                  cell: (k) =>
                    k.enabled ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />
                        Revoked
                      </span>
                    ),
                },
                {
                  id: "scope",
                  header: "Scope",
                  accessor: (k) => {
                    const scopedProjectId =
                      k.metadata &&
                      typeof k.metadata === "object" &&
                      "projectId" in k.metadata
                        ? String(k.metadata.projectId)
                        : null;
                    const sp = projects.find(
                      (project: (typeof projects)[number]) =>
                        project.id === scopedProjectId,
                    );
                    return sp ? sp.name : "Workspace";
                  },
                  cell: (k) => {
                    const scopedProjectId =
                      k.metadata &&
                      typeof k.metadata === "object" &&
                      "projectId" in k.metadata
                        ? String(k.metadata.projectId)
                        : null;
                    const sp = projects.find(
                      (project: (typeof projects)[number]) =>
                        project.id === scopedProjectId,
                    );
                    return (
                      <span className="text-stone-600">
                        {sp ? sp.name : "Workspace"}
                      </span>
                    );
                  },
                },
                {
                  id: "preview",
                  header: "Preview",
                  accessor: (k) => (k.prefix ?? "") + (k.start ?? ""),
                  cell: (k) => (
                    <span className="font-mono text-xs text-stone-500">
                      {(k.prefix ?? "") + (k.start ?? "") + "..."}
                    </span>
                  ),
                  className: "hidden sm:table-cell",
                  hiddenOn: ["sm"],
                },
                {
                  id: "createdAt",
                  header: "Created",
                  accessor: (k) => k.createdAt ?? "",
                  cell: (k) => (
                    <span className="text-stone-500">
                      {k.createdAt
                        ? new Date(k.createdAt).toLocaleDateString()
                        : "-"}
                    </span>
                  ),
                  className: "hidden md:table-cell",
                  hiddenOn: ["md"],
                },
                {
                  id: "expiresAt",
                  header: "Expires",
                  accessor: (k) => k.expiresAt ?? "",
                  cell: (k) => (
                    <span className="text-stone-500">
                      {k.expiresAt
                        ? new Date(k.expiresAt).toLocaleDateString()
                        : "Never"}
                    </span>
                  ),
                  className: "hidden lg:table-cell",
                  hiddenOn: ["lg"],
                },
                {
                  id: "actions",
                  header: () => <span className="sr-only">Actions</span>,
                  accessor: (k) => k.id,
                  sortable: false,
                  cell: (k) => {
                    const scopedProjectId =
                      k.metadata &&
                      typeof k.metadata === "object" &&
                      "projectId" in k.metadata
                        ? String(k.metadata.projectId)
                        : null;
                    return (
                      <div className="flex justify-end">
                        <KeyActionsMenu
                          keyId={k.id}
                          keyName={k.name ?? "Untitled key"}
                          enabled={k.enabled}
                          projectId={scopedProjectId}
                          isOpen={openMenuId === k.id}
                          onToggle={() =>
                            setOpenMenuId(
                              openMenuId === k.id ? null : k.id,
                            )
                          }
                          onAction={(type) => {
                            setOpenMenuId(null);
                            setConfirmAction({
                              type,
                              keyId: k.id,
                              keyName: k.name ?? "Untitled key",
                              enabled: k.enabled,
                              projectId: scopedProjectId,
                            });
                          }}
                        />
                      </div>
                    );
                  },
                },
              ] satisfies DataTableColumn<ApiKeyRow>[]
            }
            pagination={{
              page: currentPage,
              totalPages,
              total: apiKeys.total,
              pageSize,
              onPageChange: setPage,
              onPageSizeChange: setPageSize,
            }}
            refresh={{ onRefresh: refresh, isRefreshing: apiKeysQuery.isFetching }}
            emptyState="No API keys yet. Create one above."
            caption="API keys"
          />

          <div className="space-y-2 border-t border-stone-200 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-stone-900">
                  CLI snippet
                </h3>
                <p className="mt-0.5 text-xs text-stone-500">
                  Writes{" "}
                  <code className="rounded bg-stone-100 px-1">
                    mini.config.json
                  </code>
                  ,{" "}
                  <code className="rounded bg-stone-100 px-1">
                    mini.collections.json
                  </code>{" "}
                  and{" "}
                  <code className="rounded bg-stone-100 px-1">
                    mini.types.ts
                  </code>
                  .
                </p>
              </div>
              <CopyButton value={cliSnippet} label="Copy" />
            </div>
            <pre className="overflow-x-auto rounded-lg border border-stone-200 bg-stone-950 p-4 font-mono text-xs leading-relaxed text-stone-100">
              {cliSnippet}
            </pre>
            {scopedCliSnippet ? (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-stone-500">
                  Pull schema with the selected project scope
                </p>
                <pre className="overflow-x-auto rounded-lg border border-stone-200 bg-stone-950 p-4 font-mono text-xs leading-relaxed text-stone-100">
                  {scopedCliSnippet}
                </pre>
              </div>
            ) : null}
          </div>
        </>
      )}

      {confirmAction ? (
        <ConfirmDialog
          action={confirmAction}
          onConfirm={() => void executeConfirmAction()}
          onCancel={() => setConfirmAction(null)}
        />
      ) : null}
    </section>
  );
}

function KeyActionsMenu(props: {
  keyId: string;
  keyName: string;
  enabled: boolean;
  projectId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onAction: (type: "delete" | "rotate" | "toggle") => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );

  useEffect(() => {
    if (props.isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        left: rect.right - 176, // 176px = w-44 = 11rem
      });
    } else {
      setMenuPos(null);
    }
  }, [props.isOpen]);

  return (
    <div className="inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={props.onToggle}
        className="inline-flex items-center rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {props.isOpen && menuPos ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={props.onToggle}
            onKeyDown={(e) => {
              if (e.key === "Escape") props.onToggle();
            }}
          />
          <div
            className="fixed z-50 w-44 rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              type="button"
              onClick={() => props.onAction("toggle")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 transition hover:bg-stone-50"
            >
              {props.enabled ? (
                <>
                  <ShieldOff className="h-3.5 w-3.5 text-stone-400" />
                  Revoke key
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-stone-400" />
                  Re-enable key
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => props.onAction("rotate")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 transition hover:bg-stone-50"
            >
              <RefreshCw className="h-3.5 w-3.5 text-stone-400" />
              Rotate key
            </button>
            <hr className="my-1 border-stone-100" />
            <button
              type="button"
              onClick={() => props.onAction("delete")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete key
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ConfirmDialog(props: {
  action: {
    type: "delete" | "rotate" | "toggle";
    keyId: string;
    keyName: string;
    enabled?: boolean;
  };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { type, keyName, enabled } = props.action;

  const config = {
    delete: {
      title: "Delete API key",
      description: `Are you sure you want to permanently delete "${keyName}"? Any integrations using this key will stop working immediately.`,
      confirmLabel: "Delete key",
      variant: "destructive" as const,
    },
    rotate: {
      title: "Rotate API key",
      description: `This will delete "${keyName}" and create a new key with the same name and scope. Any integrations using the old key will stop working immediately.`,
      confirmLabel: "Rotate key",
      variant: "destructive" as const,
    },
    toggle: {
      title: enabled ? "Revoke API key" : "Re-enable API key",
      description: enabled
        ? `Revoking "${keyName}" will immediately prevent it from authenticating. You can re-enable it later.`
        : `Re-enabling "${keyName}" will allow it to authenticate again.`,
      confirmLabel: enabled ? "Revoke key" : "Re-enable key",
      variant: (enabled ? "destructive" : "default") as
        | "destructive"
        | "default",
    },
  }[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-stone-900">
          {config.title}
        </h3>
        <p className="mt-2 text-sm text-stone-600">{config.description}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={props.onCancel}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
              config.variant === "destructive"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-stone-900 hover:bg-stone-800"
            }`}
          >
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApiKeysPageSkeleton() {
  return (
    <section className="space-y-6">
      <div>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
        <div className="grid gap-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                Name
              </th>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                Scope
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-stone-600 sm:table-cell">
                Preview
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-stone-600 md:table-cell">
                Created
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-stone-600 lg:table-cell">
                Expires
              </th>
              <th className="px-4 py-3 text-right font-medium text-stone-600">
                <span className="sr-only">Actions</span>
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
                  <Skeleton className="h-5 w-16 rounded-full" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-20" />
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <Skeleton className="h-4 w-16" />
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <Skeleton className="h-4 w-16" />
                </td>
                <td className="px-4 py-3 text-right">
                  <Skeleton className="ml-auto h-4 w-6" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CopyButton(props: { value: string; label?: string }) {
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
      className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
    >
      <Copy className="h-3 w-3" />
      {copied ? "Copied" : (props.label ?? "Copy")}
    </button>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createApiKeyServerFn,
  deleteApiKeyServerFn,
} from "@/lib/auth-helpers";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  organizationQueryOptions,
  projectsQueryOptions,
  apiKeysQueryOptions,
} from "@/lib/queries";
import { AlertCircle, CheckCircle, Copy, KeyRound, Trash2 } from "lucide-react";

export const Route = createFileRoute("/dashboard/api-keys")({
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const queryClient = useQueryClient();
  const orgQuery = useQuery(organizationQueryOptions());
  const apiKeysQuery = useQuery({
    ...apiKeysQueryOptions(),
    enabled: !!orgQuery.data,
  });
  const projectsQuery = useQuery({
    ...projectsQueryOptions(),
    enabled: !!orgQuery.data,
  });

  const isLoading =
    orgQuery.isLoading || apiKeysQuery.isLoading || projectsQuery.isLoading;

  const organization = orgQuery.data ?? null;
  const apiKeys = apiKeysQuery.data ?? { apiKeys: [], total: 0, limit: 0, offset: 0 };
  const projects = projectsQuery.data ?? [];

  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [pending, setPending] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
                {projects.map(
                  (project: (typeof projects)[number]) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ),
                )}
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

          <div className="overflow-hidden rounded-lg border border-stone-200">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-stone-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-stone-600">
                    Scope
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium text-stone-600 sm:table-cell">
                    Preview
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium text-stone-600 md:table-cell">
                    Expires
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-stone-600">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {apiKeys.apiKeys.map(
                  (apiKey: (typeof apiKeys.apiKeys)[number]) => {
                    const scopedProjectId =
                      apiKey.metadata &&
                      typeof apiKey.metadata === "object" &&
                      "projectId" in apiKey.metadata
                        ? String(apiKey.metadata.projectId)
                        : null;
                    const scopedProject = projects.find(
                      (project: (typeof projects)[number]) =>
                        project.id === scopedProjectId,
                    );

                    return (
                      <tr key={apiKey.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3 font-medium text-stone-900">
                          {apiKey.name ?? "Untitled key"}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {scopedProject
                            ? scopedProject.name
                            : "Workspace"}
                        </td>
                        <td className="hidden px-4 py-3 font-mono text-xs text-stone-500 sm:table-cell">
                          {(apiKey.prefix ?? "") + (apiKey.start ?? "") + "..."}
                        </td>
                        <td className="hidden px-4 py-3 text-stone-500 md:table-cell">
                          {apiKey.expiresAt
                            ? new Date(apiKey.expiresAt).toLocaleDateString()
                            : "Never"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void handleDelete(apiKey.id)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  },
                )}
                {!apiKeys.apiKeys.length ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-stone-500"
                    >
                      No API keys yet. Create one above.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

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
    </section>
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
                Scope
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-stone-600 sm:table-cell">
                Preview
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-stone-600 md:table-cell">
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
                  <Skeleton className="h-4 w-20" />
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <Skeleton className="h-4 w-16" />
                </td>
                <td className="px-4 py-3 text-right">
                  <Skeleton className="ml-auto h-4 w-14" />
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

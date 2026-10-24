import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { updateProjectServerFn } from "@/lib/projects-helpers";
import { projectQueryOptions, environmentsQueryOptions } from "@/lib/queries";
import {
  createEnvironmentServerFn,
  updateEnvironmentServerFn,
  deleteEnvironmentServerFn,
} from "@/lib/environment-helpers";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Copy,
  CheckCircle,
  AlertCircle,
  Globe,
  Lock,
  ShieldOff,
  Plus,
  X,
  AlertTriangle,
  Pencil,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/projects/$projectId/settings")({
  component: ProjectSettingsPage,
});

function ProjectSettingsPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const projectQuery = useQuery(projectQueryOptions(projectId));

  const isLoading = projectQuery.isLoading;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  if (isLoading) {
    return <ProjectSettingsSkeleton />;
  }

  const project = projectQuery.data ?? null;

  if (!project) {
    return (
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Project Settings</h2>
          <p className="mt-1 text-sm text-stone-500">
            Project not found.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Project Settings</h2>
        <p className="mt-1 text-sm text-stone-500">
          Manage settings for "{project.name}". API access controls who can access collection content via public endpoints.
        </p>
      </div>

      <EnvironmentsSection projectId={project.id} onUpdated={invalidate} />

      <ApiAccessSection
        projectId={project.id}
        currentApiAccess={project.apiAccess ?? { type: "public" }}
        onUpdated={invalidate}
      />

      <InfoSection
        id={project.id}
        name={project.name}
        slug={project.slug}
        createdAt={project.createdAt}
      />
    </section>
  );
}

function ProjectSettingsSkeleton() {
  return (
    <section className="space-y-8">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </section>
  );
}

type ApiAccessType = "public" | "restricted" | "none";

type ApiAccessConfig = {
  type: ApiAccessType;
  allowedDomains?: string[];
};

function ApiAccessSection({
  projectId,
  currentApiAccess,
  onUpdated,
}: {
  projectId: string;
  currentApiAccess: ApiAccessConfig;
  onUpdated: () => void;
}) {
  const [accessType, setAccessType] = useState<ApiAccessType>(currentApiAccess.type);
  const [allowedDomains, setAllowedDomains] = useState<string[]>(
    currentApiAccess.allowedDomains ?? [],
  );
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      await updateProjectServerFn({
        data: {
          id: projectId,
          apiAccess: {
            type: accessType,
            allowedDomains: accessType === "restricted" ? allowedDomains : undefined,
          },
        },
      });

      setMessage({ type: "success", text: "API access settings updated." });
      onUpdated();
    } catch {
      setMessage({ type: "error", text: "Failed to update settings." });
    } finally {
      setSaving(false);
    }
  }

  function addDomain() {
    const domain = newDomain.trim().toLowerCase();
    if (domain && !allowedDomains.includes(domain)) {
      setAllowedDomains([...allowedDomains, domain]);
      setNewDomain("");
    }
  }

  function removeDomain(domain: string) {
    setAllowedDomains(allowedDomains.filter((d) => d !== domain));
  }

  const hasChanges =
    accessType !== currentApiAccess.type ||
    JSON.stringify(allowedDomains) !==
      JSON.stringify(currentApiAccess.allowedDomains ?? []);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
      <h3 className="text-base font-semibold">API Access</h3>
      <p className="mt-1 text-sm text-stone-500">
        Control how the public API endpoints (/api/collections) can be accessed.
      </p>

      <div className="mt-6 space-y-4">
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-4 transition hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/50">
            <input
              type="radio"
              name="api-access"
              value="public"
              checked={accessType === "public"}
              onChange={() => setAccessType("public")}
              className="mt-0.5 h-4 w-4 accent-stone-900"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-stone-500" />
                <span className="font-medium">Public</span>
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Default
                </span>
              </div>
              <p className="mt-1 text-sm text-stone-500">
                Anyone can access collection content. No origin restrictions.
              </p>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-4 transition hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/50">
            <input
              type="radio"
              name="api-access"
              value="restricted"
              checked={accessType === "restricted"}
              onChange={() => setAccessType("restricted")}
              className="mt-0.5 h-4 w-4 accent-stone-900"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <ShieldOff className="h-4 w-4 text-stone-500" />
                <span className="font-medium">Restricted</span>
              </div>
              <p className="mt-1 text-sm text-stone-500">
                Only requests from allowed domains can access collection content.
              </p>

              {accessType === "restricted" && (
                <div className="mt-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addDomain();
                        }
                      }}
                      placeholder="example.com"
                      className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                    />
                    <button
                      type="button"
                      onClick={addDomain}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>

                  {allowedDomains.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {allowedDomains.map((domain) => (
                        <span
                          key={domain}
                          className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-sm dark:bg-stone-800"
                        >
                          {domain}
                          <button
                            type="button"
                            onClick={() => removeDomain(domain)}
                            className="ml-1 rounded-full p-0.5 transition hover:bg-stone-200 dark:hover:bg-stone-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-500">
                      No domains added yet. Add at least one domain to allow access.
                    </p>
                  )}
                </div>
              )}
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-4 transition hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/50">
            <input
              type="radio"
              name="api-access"
              value="none"
              checked={accessType === "none"}
              onChange={() => setAccessType("none")}
              className="mt-0.5 h-4 w-4 accent-stone-900"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-stone-500" />
                <span className="font-medium">Disabled</span>
              </div>
              <p className="mt-1 text-sm text-stone-500">
                API access is disabled. No external requests can access collection content.
              </p>
            </div>
          </label>
        </div>

        {message && (
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {message.text}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <AlertTriangle className="h-4 w-4" />
            Changes apply immediately to all API requests.
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoSection({
  id,
  name,
  slug,
  createdAt,
}: {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}) {
  const [copied, setCopied] = useState(false);

  function copyId() {
    void navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
      <h3 className="text-base font-semibold">Project Information</h3>
      <p className="mt-1 text-sm text-stone-500">
        Basic details about this project.
      </p>

      <dl className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <dt className="text-sm text-stone-500">Name</dt>
          <dd className="font-medium">{name}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-sm text-stone-500">Slug</dt>
          <dd className="font-mono text-sm">{slug}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-sm text-stone-500">ID</dt>
          <div className="flex items-center gap-2">
            <dd className="font-mono text-xs text-stone-400">{id}</dd>
            <button
              type="button"
              onClick={copyId}
              className="rounded p-1 transition hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              {copied ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-stone-400" />
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-sm text-stone-500">Created</dt>
          <dd className="text-sm">
            {new Date(createdAt).toLocaleDateString("en-US", {
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

function EnvironmentsSection({
  projectId,
  onUpdated,
}: {
  projectId: string;
  onUpdated: () => void;
}) {
  const queryClient = useQueryClient();
  const environmentsQuery = useQuery(environmentsQueryOptions(projectId));

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const environments = environmentsQuery.data ?? [];

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["environments", projectId] });
    onUpdated();
  }

  if (environmentsQuery.isLoading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-4 w-64" />
        <div className="mt-4 space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold">Environments</h3>
          <p className="mt-1 text-sm text-stone-500">
            Manage content environments for this project. Each environment holds its own version of collection items.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>

      {message ? (
        <div
          className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {message.text}
          <button type="button" onClick={() => setMessage(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {environments.map((env) => (
          <div
            key={env.id}
            className="flex items-center justify-between rounded-lg border border-stone-200 p-3 transition hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800/50"
          >
            <div className="flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  env.isProduction
                    ? "bg-emerald-500"
                    : env.slug === "staging"
                      ? "bg-amber-500"
                      : "bg-blue-500"
                }`}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{env.name}</span>
                  {env.isProduction ? (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Production
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-stone-500">/{env.slug}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEditingId(env.id)}
                className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-xs font-medium transition hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
              {confirmDeleteId === env.id ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await deleteEnvironmentServerFn({ data: { id: env.id } });
                        setMessage({ type: "success", text: `Environment "${env.name}" deleted.` });
                        setConfirmDeleteId(null);
                        invalidate();
                      } catch {
                        setMessage({ type: "error", text: "Cannot delete this environment." });
                        setConfirmDeleteId(null);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-red-700"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="inline-flex items-center rounded-md border border-stone-200 px-2 py-1 text-xs font-medium transition hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    env.isProduction
                      ? setMessage({ type: "error", text: "Cannot delete the production environment." })
                      : setConfirmDeleteId(env.id)
                  }
                  className={`inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-xs font-medium transition ${
                    env.isProduction
                      ? "cursor-not-allowed text-stone-300"
                      : "text-stone-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  }`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}

        {environments.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-500">
            No environments. A default "Production" environment will be created when you add content.
          </p>
        ) : null}
      </div>

      {showCreate ? (
        <EnvironmentFormDialog
          projectId={projectId}
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={(msg) => {
            setMessage(msg);
            setShowCreate(false);
            invalidate();
          }}
        />
      ) : null}

      {editingId ? (
        <EnvironmentFormDialog
          projectId={projectId}
          mode="edit"
          environment={environments.find((e) => e.id === editingId)}
          onClose={() => setEditingId(null)}
          onSaved={(msg) => {
            setMessage(msg);
            setEditingId(null);
            invalidate();
          }}
        />
      ) : null}
    </div>
  );
}

function EnvironmentFormDialog({
  projectId,
  mode,
  environment,
  onClose,
  onSaved,
}: {
  projectId: string;
  mode: "create" | "edit";
  environment?: { id: string; name: string; slug: string; isProduction: boolean } | null;
  onClose: () => void;
  onSaved: (message: { type: "success" | "error"; text: string }) => void;
}) {
  const [name, setName] = useState(environment?.name ?? "");
  const [slug, setSlug] = useState(environment?.slug ?? "");
  const [isProduction, setIsProduction] = useState(environment?.isProduction ?? false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      if (mode === "edit" && environment) {
        await updateEnvironmentServerFn({
          data: { id: environment.id, name, slug, isProduction },
        });
        onSaved({ type: "success", text: "Environment updated." });
      } else {
        await createEnvironmentServerFn({
          data: { projectId, name, slug, isProduction },
        });
        onSaved({ type: "success", text: "Environment created." });
      }
    } catch {
      setError("Unable to save environment.");
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={mode === "edit" ? "Edit environment" : "New environment"}
    >
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold">
            {mode === "edit" ? "Edit environment" : "New environment"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-stone-700">Name</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (mode === "create" && !slug) {
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                }
              }}
              placeholder="e.g. Staging"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900"
              required
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-stone-700">Slug</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
              placeholder="e.g. staging"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900"
              required
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isProduction}
              onChange={(e) => setIsProduction(e.target.checked)}
              className="h-4 w-4 accent-stone-900"
            />
            <span className="text-sm text-stone-700">Production environment</span>
          </label>

          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-stone-200 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition hover:bg-stone-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Saving..." : mode === "edit" ? "Save changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

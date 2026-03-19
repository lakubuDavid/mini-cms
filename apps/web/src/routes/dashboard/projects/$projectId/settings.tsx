import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { updateProjectServerFn } from "@/lib/projects-helpers";
import { projectQueryOptions } from "@/lib/queries";
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

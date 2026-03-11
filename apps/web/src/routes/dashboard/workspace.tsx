import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  updateOrganizationAction,
  setActiveOrganizationAction,
  deleteOrganizationAction,
  createOrganizationAction,
} from "@/lib/auth-helpers";
import {
  organizationQueryOptions,
  organizationsQueryOptions,
} from "@/lib/queries";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Copy,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/workspace")({
  component: WorkspacePage,
});

function WorkspacePage() {
  const queryClient = useQueryClient();
  const orgQuery = useQuery(organizationQueryOptions());
  const orgsQuery = useQuery(organizationsQueryOptions());

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

  async function handleSwitch(organizationId: string) {
    setPending(organizationId);

    try {
      await setActiveOrganizationAction({ data: { organizationId } });
      props.onSwitched();
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-stone-900">
        Switch workspace
      </h3>
      <p className="mt-1 text-sm text-stone-500">
        You belong to {props.organizations.length} workspaces.
      </p>
      <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                Name
              </th>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                Slug
              </th>
              <th className="px-4 py-3 text-right font-medium text-stone-600">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {props.organizations.map((org) => (
              <tr key={org.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-900">
                  {org.name}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-stone-500">
                  {org.slug}
                </td>
                <td className="px-4 py-3 text-right">
                  {org.id === props.activeId ? (
                    <span className="text-xs font-medium text-stone-400">
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending === org.id}
                      onClick={() => void handleSwitch(org.id)}
                      className="text-sm font-medium text-stone-700 transition hover:text-stone-900 disabled:opacity-60"
                    >
                      {pending === org.id ? "Switching..." : "Switch"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

function CreateWorkspaceForm(props: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await createOrganizationAction({ data: { name, slug } });
      setName("");
      setSlug("");
      props.onCreated();
    } catch {
      setError("Failed to create workspace. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid max-w-md gap-4" onSubmit={handleCreate}>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-stone-700">Name</span>
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slug) {
              setSlug(
                event.target.value
                  .toLowerCase()
                  .replace(/\s+/g, "-")
                  .replace(/[^a-z0-9-]/g, ""),
              );
            }
          }}
          placeholder="e.g. My Agency"
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
          placeholder="e.g. my-agency"
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
          required
        />
      </label>

      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {pending ? "Creating..." : "Create workspace"}
        </button>
      </div>
    </form>
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

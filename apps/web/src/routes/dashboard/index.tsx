import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCollectionServerFn,
  deleteCollectionServerFn,
  getCollectionItemCountsServerFn,
} from "@/lib/collections-helpers";
import { createProjectServerFn } from "@/lib/projects-helpers";
import {
  organizationQueryOptions,
  collectionsQueryOptions,
  projectsQueryOptions,
} from "@/lib/queries";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Plus,
  Folder,
  X,
  Tag,
  FileText,
  Type,
  ArrowRight,
  Copy,
  FolderTree,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
  validateSearch: (search: Record<string, unknown>) => ({
    projectId:
      typeof search.projectId === "string" && search.projectId.length > 0
        ? search.projectId
        : undefined,
  }),
  component: DashboardHome,
});

function DashboardHome() {
  const navigate = useNavigate({ from: "/dashboard/" });
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const orgQuery = useQuery(organizationQueryOptions());
  const projectsQuery = useQuery(projectsQueryOptions());
  const selectedProjectId = search.projectId ?? "";
  const collectionsQuery = useQuery(
    collectionsQueryOptions(1, 24, selectedProjectId || undefined),
  );

  const collectionIds = collectionsQuery.data?.items.map((c) => c.id) ?? [];
  const itemCountsQuery = useQuery({
    queryKey: ["collection-item-counts", collectionIds],
    queryFn: () =>
      getCollectionItemCountsServerFn({
        data: { collectionIds },
      }),
    enabled: collectionIds.length > 0,
  });

  const isLoading =
    orgQuery.isLoading ||
    projectsQuery.isLoading ||
    collectionsQuery.isLoading ||
    itemCountsQuery.isLoading;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["collections"] });
    void queryClient.invalidateQueries({ queryKey: ["collection-item-counts"] });
    void queryClient.invalidateQueries({ queryKey: ["organization"] });
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  const organization = orgQuery.data ?? null;
  const projects = projectsQuery.data ?? [];
  const collections = collectionsQuery.data ?? {
    items: [],
    pagination: { page: 1, limit: 24, total: 0, totalPages: 1, hasMore: false },
  };
  const itemCounts = itemCountsQuery.data ?? {};

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      void navigate({
        search: (current) => ({ ...current, projectId: projects[0].id }),
        replace: true,
      });
    }
  }, [navigate, projects, selectedProjectId]);

  if (isLoading) {
    return <DashboardHomeSkeleton />;
  }

  return (
    <section className="space-y-6">
      {organization ? (
        <div className="space-y-1 text-sm text-stone-600">
          <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
            {organization.name}
          </h2>
          <p className="flex items-center gap-1.5">
            <span className="text-stone-500">Slug:</span>
            <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-700">
              {organization.slug}
            </code>
            <CopyButton value={organization.slug} />
          </p>
          <p className="flex items-center gap-1.5">
            <span className="text-stone-500">ID:</span>
            <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-700">
              {organization.id}
            </code>
            <CopyButton value={organization.id} />
          </p>
        </div>
      ) : (
        <p className="text-sm text-stone-500">
          No workspace yet. Create one from the sign-up flow.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <label className="grid gap-1.5 max-w-sm">
          <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Project</span>
          <select
            value={selectedProjectId}
            onChange={(event) =>
              void navigate({
                search: (current) => ({
                  ...current,
                  projectId: event.target.value || undefined,
                }),
              })
            }
            className="rounded-lg border-2 border-stone-300 bg-white px-3 py-2.5 text-sm font-medium outline-none transition focus:border-stone-900 focus:ring-2 focus:ring-stone-900/20 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:focus:border-stone-400 dark:focus:ring-stone-400/20"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <NewProjectDialog onCreated={invalidate} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Collections</h3>
          <p className="mt-1 text-sm text-stone-500">
            {organization
              ? `${collections.items.length} collection${collections.items.length === 1 ? "" : "s"}`
              : "No organization yet."}
          </p>
        </div>
        <NewCollectionDialog
          projectId={selectedProjectId}
          projectName={projects.find((project) => project.id === selectedProjectId)?.name ?? null}
          onCreated={invalidate}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                Name
              </th>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                Slug
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-stone-600 md:table-cell">
                Items
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-stone-600 md:table-cell">
                Description
              </th>
              <th className="px-4 py-3 text-right font-medium text-stone-600">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {collections.items.map(
              (collection: (typeof collections.items)[number]) => (
                <tr key={collection.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <Link
                      to="/dashboard/collections/$name"
                      params={{ name: collection.slug }}
                      search={{ page: 1, projectId: selectedProjectId || undefined }}
                      className="flex items-center gap-2.5 group"
                    >
                      <Folder className="h-4 w-4 shrink-0 text-stone-400" />
                      <span className="font-medium text-stone-900 group-hover:underline">
                        {collection.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">
                    /{collection.slug}
                  </td>
                  <td className="hidden px-4 py-3 text-stone-500 md:table-cell">
                    {itemCounts[collection.id] ?? 0}
                  </td>
                  <td className="hidden px-4 py-3 text-stone-500 md:table-cell">
                    <span className="line-clamp-1">
                      {collection.description || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CollectionActionsMenu
                      collection={collection}
                      projectId={selectedProjectId}
                      onDeleted={invalidate}
                    />
                  </td>
                </tr>
              ),
            )}
            {!collections.items.length ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-stone-500"
                >
                  No collections yet. Create your first one to get started.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DashboardHomeSkeleton() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                Name
              </th>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                Slug
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-stone-600 md:table-cell">
                Items
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-stone-600 md:table-cell">
                Description
              </th>
              <th className="px-4 py-3 text-right font-medium text-stone-600">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-20" />
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <Skeleton className="h-4 w-12" />
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <Skeleton className="h-4 w-40" />
                </td>
                <td className="px-4 py-3 text-right">
                  <Skeleton className="ml-auto h-4 w-12" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewCollectionDialog(props: {
  projectId: string;
  projectName: string | null;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const collection = await createCollectionServerFn({
      data: {
        projectId: props.projectId,
        name,
        slug,
        description,
        schema: [
          { key: "title", label: "Title", type: "text" },
        ],
      },
    });

    setPending(false);

    if (!collection) {
      setError("Unable to create collection. Please try again.");
      return;
    }

    setName("");
    setSlug("");
    setDescription("");
    setOpen(false);
    props.onCreated();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
      >
        <Plus className="h-4 w-4" />
        New collection
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Create new collection"
        >
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold tracking-tight">
                New collection
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-1 text-sm text-stone-500">
              Start with a simple content type, then expand the schema later.
            </p>

            <form className="mt-5 grid gap-4" onSubmit={handleCreate}>
              <label className="grid gap-1.5">
                <span className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
                  <Type className="h-3.5 w-3.5" />
                  Name
                </span>
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
                  placeholder="e.g. Projects"
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                  required
                />
                <span className="text-xs text-stone-400">
                  A human-readable name for this collection.
                </span>
              </label>

              <label className="grid gap-1.5">
                <span className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
                  <Tag className="h-3.5 w-3.5" />
                  Slug
                </span>
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
                  placeholder="e.g. projects"
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                  required
                />
                <span className="text-xs text-stone-400">
                  URL-friendly identifier used in API paths like{" "}
                  <code className="rounded bg-stone-100 px-1 text-stone-600">
                    /api/collections/items?w=workspace_id&p=project_id&collection_id=id
                  </code>
                </span>
              </label>

              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
                <span className="font-medium text-stone-800">Project:</span>{" "}
                {props.projectName ?? "Select a project first"}
              </div>

              <label className="grid gap-1.5">
                <span className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
                  <FileText className="h-3.5 w-3.5" />
                  Description
                </span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="A brief description for this collection"
                  rows={2}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                />
                <span className="text-xs text-stone-400">
                  Optional. Helps your team understand what this collection
                  stores.
                </span>
              </label>

              {error ? (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 border-t border-stone-200 pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? "Creating..." : "Create collection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function NewProjectDialog(props: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const project = await createProjectServerFn({
      data: { name, slug },
    });

    setPending(false);

    if (!project) {
      setError("Unable to create project. Please try again.");
      return;
    }

    setName("");
    setSlug("");
    setOpen(false);
    props.onCreated();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition hover:bg-stone-50"
      >
        <FolderTree className="h-4 w-4" />
        New project
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Create new project"
        >
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold tracking-tight">New project</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-5 grid gap-4" onSubmit={handleCreate}>
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
                placeholder="e.g. Website"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                required
              />
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
                placeholder="e.g. website"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                required
              />
              {error ? (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? "Creating..." : "Create project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
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

function CollectionActionsMenu(props: {
  collection: { id: string; name: string; slug: string };
  projectId: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleDelete() {
    if (!confirm(`Delete collection "${props.collection.name}"? This will also delete all items in this collection.`)) {
      return;
    }

    setDeleting(true);
    try {
      await deleteCollectionServerFn({ data: { id: props.collection.id } });
      props.onDeleted();
    } catch (error) {
      console.error("Failed to delete collection:", error);
      alert("Failed to delete collection. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
        aria-label="Actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
          <Link
            to="/dashboard/collections/$name"
            params={{ name: props.collection.slug }}
            search={{ page: 1, projectId: props.projectId || undefined }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-stone-700 transition hover:bg-stone-50"
            onClick={() => setOpen(false)}
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Open
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-stone-700 transition hover:bg-stone-50"
            onClick={() => {
              setOpen(false);
              alert("Edit coming soon!");
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            disabled={deleting}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            onClick={() => {
              setOpen(false);
              handleDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
}

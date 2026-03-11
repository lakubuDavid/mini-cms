import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProjectServerFn,
  updateProjectServerFn,
  deleteProjectServerFn,
} from "@/lib/projects-helpers";
import { projectsQueryOptions, collectionsQueryOptions } from "@/lib/queries";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Plus,
  FolderTree,
  Pencil,
  Trash2,
  X,
  Tag,
  Type,
  CheckCircle,
  AlertCircle,
  Layers,
  Star,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const queryClient = useQueryClient();
  const projectsQuery = useQuery(projectsQueryOptions());
  const collectionsQuery = useQuery(collectionsQueryOptions(1, 200));

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
    void queryClient.invalidateQueries({ queryKey: ["collections"] });
  }

  if (projectsQuery.isLoading || collectionsQuery.isLoading) {
    return <ProjectsPageSkeleton />;
  }

  const projects = projectsQuery.data ?? [];
  const collections = collectionsQuery.data?.items ?? [];

  function collectionsCountForProject(projectId: string) {
    return collections.filter(
      (c: (typeof collections)[number]) => c.projectId === projectId,
    ).length;
  }

  async function handleDelete(id: string) {
    const result = await deleteProjectServerFn({ data: { id } });
    setConfirmDeleteId(null);

    if (result?.success) {
      setMessage({ type: "success", text: "Project deleted." });
      invalidate();
    } else {
      setMessage({
        type: "error",
        text: "Unable to delete project. Default projects cannot be deleted.",
      });
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
          <p className="mt-1 text-sm text-stone-500">
            Projects group related collections within a workspace. Each
            workspace starts with a Default project.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
        >
          <Plus className="h-4 w-4" />
          New project
        </button>
      </div>

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
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="ml-auto"
          >
            <X className="h-4 w-4" />
          </button>
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
                Slug
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-stone-600 sm:table-cell">
                Collections
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-stone-600 md:table-cell">
                Created
              </th>
              <th className="px-4 py-3 text-right font-medium text-stone-600">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {projects.map(
              (project: (typeof projects)[number]) => {
                const isDefault = project.metadata?.isDefault === true;
                const count = collectionsCountForProject(project.id);

                return (
                  <tr key={project.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <FolderTree className="h-4 w-4 shrink-0 text-stone-400" />
                        <span className="font-medium text-stone-900">
                          {project.name}
                        </span>
                        {isDefault ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-stone-500">
                            <Star className="h-2.5 w-2.5" />
                            Default
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-500">
                      {project.slug}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className="inline-flex items-center gap-1 text-stone-600">
                        <Layers className="h-3.5 w-3.5 text-stone-400" />
                        {count}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-stone-500 md:table-cell">
                      {new Date(project.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingId(project.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium transition hover:bg-stone-50"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                        {confirmDeleteId === project.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleDelete(project.id)}
                              className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="inline-flex items-center rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium transition hover:bg-stone-50"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              isDefault
                                ? setMessage({
                                    type: "error",
                                    text: "The default project cannot be deleted.",
                                  })
                                : setConfirmDeleteId(project.id)
                            }
                            className={`inline-flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium transition ${
                              isDefault
                                ? "cursor-not-allowed text-stone-300"
                                : "text-stone-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            }`}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              },
            )}
            {!projects.length ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-stone-500"
                >
                  No projects yet. Create one to get started.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-400">
        {projects.length} {projects.length === 1 ? "project" : "projects"}.
        Collections are scoped to a project. The default project cannot be
        deleted.
      </p>

      {showCreate ? (
        <ProjectFormDialog
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
        <ProjectFormDialog
          mode="edit"
          project={projects.find(
            (p: (typeof projects)[number]) => p.id === editingId,
          )}
          onClose={() => setEditingId(null)}
          onSaved={(msg) => {
            setMessage(msg);
            setEditingId(null);
            invalidate();
          }}
        />
      ) : null}
    </section>
  );
}

function ProjectFormDialog(props: {
  mode: "create" | "edit";
  project?: { id: string; name: string; slug: string } | null;
  onClose: () => void;
  onSaved: (message: { type: "success" | "error"; text: string }) => void;
}) {
  const [name, setName] = useState(props.project?.name ?? "");
  const [slug, setSlug] = useState(props.project?.slug ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") props.onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [props.onClose]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    if (props.mode === "edit" && props.project) {
      const result = await updateProjectServerFn({
        data: { id: props.project.id, name, slug },
      });

      setPending(false);

      if (!result) {
        setError("Unable to update project.");
        return;
      }

      props.onSaved({ type: "success", text: "Project updated." });
    } else {
      const result = await createProjectServerFn({
        data: { name, slug },
      });

      setPending(false);

      if (!result) {
        setError("Unable to create project.");
        return;
      }

      props.onSaved({ type: "success", text: "Project created." });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={props.mode === "edit" ? "Edit project" : "New project"}
    >
      <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold tracking-tight">
            {props.mode === "edit" ? "Edit project" : "New project"}
          </h3>
          <button
            type="button"
            onClick={props.onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-1 text-sm text-stone-500">
          {props.mode === "edit"
            ? "Update the project name or slug."
            : "Group related collections under a project."}
        </p>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1.5">
            <span className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
              <Type className="h-3.5 w-3.5" />
              Name
            </span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (props.mode === "create" && !slug) {
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
              placeholder="e.g. website"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
              required
            />
            <span className="text-xs text-stone-400">
              URL-friendly identifier used to scope collections.
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
              onClick={props.onClose}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? "Saving..."
                : props.mode === "edit"
                  ? "Save changes"
                  : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectsPageSkeleton() {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
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
              <th className="hidden px-4 py-3 text-left font-medium text-stone-600 sm:table-cell">
                Collections
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-stone-600 md:table-cell">
                Created
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
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-20" />
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <Skeleton className="h-4 w-8" />
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <Skeleton className="h-4 w-24" />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Skeleton className="h-7 w-14 rounded-md" />
                    <Skeleton className="h-7 w-16 rounded-md" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

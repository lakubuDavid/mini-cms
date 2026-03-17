import { useState } from "react";
import { Plus } from "lucide-react";
import { createWorkspaceAction } from "@/lib/auth-helpers";

export function CreateWorkspaceForm(props: {
  onCreated: () => void;
  compact?: boolean;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await createWorkspaceAction({ data: { name, slug } });
      setName("");
      setSlug("");
      props.onCreated();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to create workspace. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={`grid gap-4 ${props.compact ? "" : "max-w-md"}`.trim()} onSubmit={handleCreate}>
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

import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { updateCollectionServerFn } from "@/lib/collections-helpers";
import { RESERVED_FIELD_PREFIX, isReservedFieldKey } from "@/lib/collections-system-fields";
import { collectionSchemaQueryOptions } from "@/lib/queries";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

type SchemaField = {
  _id: string;
  key: string;
  label: string;
  type: "text" | "url" | "number" | "boolean" | "date";
};

let nextId = 0;
function stableId() {
  return `field-${++nextId}`;
}

export const Route = createFileRoute("/dashboard/collections/$name/schema")({
  validateSearch: (search: Record<string, unknown>) => ({
    projectId:
      typeof search.projectId === "string" && search.projectId.length > 0
        ? search.projectId
        : undefined,
  }),
  component: CollectionSchemaPage,
});

function CollectionSchemaPage() {
  const { name } = Route.useParams();
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const schemaQuery = useQuery(collectionSchemaQueryOptions(name));

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: ["collection-schema", name],
    });
    void queryClient.invalidateQueries({
      queryKey: ["collection-page", name],
    });
  }

  if (schemaQuery.isLoading) {
    return <SchemaPageSkeleton />;
  }

  if (!schemaQuery.data) {
    return (
      <section className="space-y-6">
        <p className="text-sm text-stone-500">Collection not found.</p>
      </section>
    );
  }

  return (
    <SchemaEditor
      collection={schemaQuery.data.collection}
      projectId={search.projectId}
      onSaved={invalidate}
    />
  );
}

function SchemaEditor(props: {
  collection: {
    id: string;
    name: string;
    slug: string;
    schema: Array<{
      key: string;
      label: string;
      type: "text" | "url" | "number" | "boolean" | "date";
    }>;
  };
  projectId?: string;
  onSaved: () => void;
}) {
  const { collection, projectId, onSaved } = props;
  const [fields, setFields] = useState<SchemaField[]>(() => {
    const source = collection.schema.length
      ? collection.schema
      : [{ key: "title", label: "Title", type: "text" as const }];
    return source.map((f: (typeof source)[number]) => ({
      ...f,
      _id: stableId(),
    }));
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function updateField(index: number, patch: Partial<(typeof fields)[number]>) {
    setFields((current) =>
      current.map((field, currentIndex) =>
        currentIndex === index ? { ...field, ...patch } : field,
      ),
    );
  }

  async function handleSave() {
    const reservedField = fields.find((field) => isReservedFieldKey(field.key));

    if (reservedField) {
      setMessage({
        type: "error",
        text: `Field key '${reservedField.key}' is reserved. Keys starting with '${RESERVED_FIELD_PREFIX}' are reserved for system fields.`,
      });
      return;
    }

    setPending(true);
    setMessage(null);

    const updated = await updateCollectionServerFn({
      data: {
        id: collection.id,
        schema: fields.map(({ _id, ...rest }) => rest),
      },
    });

    setPending(false);

    if (updated) {
      setMessage({ type: "success", text: "Schema saved successfully." });
      onSaved();
    } else {
      setMessage({
        type: "error",
        text: "Unable to save schema. Please try again.",
      });
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <Link
          to="/dashboard/collections/$name"
          params={{ name: collection.slug }}
          search={{ page: 1, projectId }}
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {collection.name}
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Edit schema</h2>
          <p className="mt-1 text-sm text-stone-500">
            Define the fields that make up each item in{" "}
            <span className="font-medium text-stone-700">
              {collection.name}
            </span>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setFields((current) => [
                ...current,
                {
                  _id: stableId(),
                  key: `field_${current.length + 1}`,
                  label: `Field ${current.length + 1}`,
                  type: "text",
                },
              ])
            }
            className="inline-flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium transition hover:bg-stone-50"
          >
            <Plus className="h-4 w-4" />
            Add field
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving..." : "Save schema"}
          </button>
        </div>
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
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-stone-200">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                Label
              </th>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                Key
              </th>
              <th className="w-40 px-4 py-3 text-left font-medium text-stone-600">
                Type
              </th>
              <th className="w-20 px-4 py-3 text-right font-medium text-stone-600">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {fields.map((field, index) => (
              <tr key={field._id} className="hover:bg-stone-50">
                <td className="px-4 py-2">
                  <input
                    value={field.label}
                    onChange={(event) =>
                      updateField(index, { label: event.target.value })
                    }
                    placeholder="e.g. Title"
                    className="w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={field.key}
                    onChange={(event) =>
                      updateField(index, {
                        key: event.target.value
                          .toLowerCase()
                          .replace(/\s+/g, "_")
                          .replace(/[^a-z0-9_]/g, ""),
                      })
                    }
                    placeholder="e.g. title"
                    className="w-full rounded-md border border-stone-200 px-2.5 py-1.5 font-mono text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={field.type}
                    onChange={(event) =>
                      updateField(index, {
                        type: event.target.value as
                          | "text"
                          | "url"
                          | "number"
                          | "boolean"
                          | "date",
                      })
                    }
                    className="w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                  >
                    <option value="text">Text</option>
                    <option value="url">URL</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="date">Date</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      setFields((current) =>
                        current.filter(
                          (_, currentIndex) => currentIndex !== index,
                        ),
                      )
                    }
                    className="inline-flex items-center justify-center rounded-md p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                    title="Remove field"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {fields.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-stone-500"
                >
                  No fields defined. Click{" "}
                  <span className="font-medium text-stone-700">Add field</span>{" "}
                  to get started.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-400">
        {fields.length} {fields.length === 1 ? "field" : "fields"} defined. Each
        field becomes a column in the items table and an input in the item
        editor. Keys starting with "_" are reserved for system fields.
      </p>
    </section>
  );
}

function SchemaPageSkeleton() {
  return (
    <section className="space-y-6">
      <div>
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                Label
              </th>
              <th className="px-4 py-3 text-left font-medium text-stone-600">
                Key
              </th>
              <th className="w-40 px-4 py-3 text-left font-medium text-stone-600">
                Type
              </th>
              <th className="w-20 px-4 py-3 text-right font-medium text-stone-600">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-2">
                  <Skeleton className="h-8 rounded-md" />
                </td>
                <td className="px-4 py-2">
                  <Skeleton className="h-8 rounded-md" />
                </td>
                <td className="px-4 py-2">
                  <Skeleton className="h-8 w-full rounded-md" />
                </td>
                <td className="px-4 py-2 text-right">
                  <Skeleton className="ml-auto h-8 w-8 rounded-md" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Skeleton className="h-3 w-48" />
    </section>
  );
}

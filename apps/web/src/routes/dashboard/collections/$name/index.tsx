import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createItemServerFn,
  deleteItemServerFn,
  updateItemServerFn,
} from "@/lib/collections-helpers";
import { collectionPageQueryOptions } from "@/lib/queries";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  ArrowLeft,
  Settings,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { Switch } from "@workspace/ui/components/switch";
import { SYSTEM_COLLECTION_FIELDS as SYSTEM_FIELDS } from "@/lib/collections-system-fields";

type CollectionField = {
  key: string;
  label: string;
  type: "text" | "url" | "number" | "boolean" | "date";
};

type ItemRecord = {
  id: string;
  data: Record<string, string | number | boolean | null>;
};

export const Route = createFileRoute("/dashboard/collections/$name/")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search.page ?? 1),
    projectId:
      typeof search.projectId === "string" && search.projectId.length > 0
        ? search.projectId
        : undefined,
  }),
  component: CollectionPage,
});

function CollectionPage() {
  const { name } = Route.useParams();
  const search = Route.useSearch();
  const queryClient = useQueryClient();

  const pageQuery = useQuery(
    collectionPageQueryOptions(name, search.page, 10),
  );

  const [showModal, setShowModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: ["collection-page", name],
    });
  }

  if (pageQuery.isLoading) {
    return <CollectionPageSkeleton />;
  }

  if (!pageQuery.data) {
    return (
      <section className="space-y-6">
        <div>
          <Link
            to="/dashboard"
            search={{}}
            className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Collections
          </Link>
        </div>
        <p className="text-sm text-stone-500">Collection not found.</p>
      </section>
    );
  }

  const { collection, items } = pageQuery.data;

  return (
    <CollectionPageContent
      collection={collection}
      items={items}
      search={search}
      editingItemId={editingItemId}
      setEditingItemId={setEditingItemId}
      showModal={showModal}
      setShowModal={setShowModal}
      message={message}
      setMessage={setMessage}
      previewImage={previewImage}
      setPreviewImage={setPreviewImage}
      confirmDeleteId={confirmDeleteId}
      setConfirmDeleteId={setConfirmDeleteId}
      onInvalidate={invalidate}
    />
  );
}

function CollectionPageContent(props: {
  collection: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    schema: CollectionField[];
  };
  items: {
    items: ItemRecord[];
    pagination: {
      page: number;
      totalPages: number;
      total: number;
      hasMore: boolean;
    };
  };
  search: { page: number; projectId?: string };
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  message: { type: "success" | "error"; text: string } | null;
  setMessage: (
    msg: { type: "success" | "error"; text: string } | null,
  ) => void;
  previewImage: string | null;
  setPreviewImage: (url: string | null) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  onInvalidate: () => void;
}) {
  const {
    collection,
    items,
    search,
    editingItemId,
    setEditingItemId,
    showModal,
    setShowModal,
    message,
    setMessage,
    previewImage,
    setPreviewImage,
    confirmDeleteId,
    setConfirmDeleteId,
    onInvalidate,
  } = props;
  const tableFields: Array<
    | (typeof SYSTEM_FIELDS)[number]
    | CollectionField
  > = [...SYSTEM_FIELDS, ...collection.schema];

  const editingItem = useMemo(
    () =>
      items.items.find(
        (item: ItemRecord) => item.id === editingItemId,
      ) ?? null,
    [editingItemId, items.items],
  );

  async function handleDeleteItem(id: string) {
    const result = await deleteItemServerFn({
      data: {
        id,
        slug: collection.slug,
      },
    });

    setConfirmDeleteId(null);

    if (result?.success) {
      setMessage({ type: "success", text: "Item deleted." });
      onInvalidate();
    } else {
      setMessage({ type: "error", text: "Unable to delete item." });
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <Link
          to="/dashboard"
          search={{ projectId: search.projectId }}
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Collections
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {collection.name}
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {collection.description ?? "Manage items for this collection."} --{" "}
            {items.pagination.total} items
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard/collections/$name/schema"
            params={{ name: collection.slug }}
            search={{ projectId: search.projectId }}
            className="inline-flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium transition hover:bg-stone-50"
          >
            <Settings className="h-4 w-4" />
            Edit schema
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditingItemId(null);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" />
            Add item
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                {tableFields.map((field) => (
                    <th
                      key={field.key}
                      className="px-4 py-3 text-left font-medium text-stone-600"
                    >
                      {field.label}
                    </th>
                  ))}
                <th className="px-4 py-3 text-right font-medium text-stone-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {items.items.map((item: ItemRecord) => (
                <tr key={item.id} className="hover:bg-stone-50">
                  {tableFields.map((field) => (
                      <td
                        key={field.key}
                        className="px-4 py-3 align-top text-stone-700"
                      >
                        <FieldValue
                          type={field.type}
                          value={item.data[field.key]}
                          onImagePreview={setPreviewImage}
                        />
                      </td>
                    ))}
                  <td className="px-4 py-3 text-right align-top">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItemId(item.id);
                          setShowModal(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium transition hover:bg-stone-50"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      {confirmDeleteId === item.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleDeleteItem(item.id)}
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
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!items.items.length ? (
                <tr>
                  <td
                     colSpan={Math.max(2, tableFields.length + 1)}
                     className="px-4 py-10 text-center text-stone-500"
                   >
                    No items yet. Click{" "}
                    <span className="font-medium text-stone-700">Add item</span>{" "}
                    to create the first one.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-stone-500">
          Page {items.pagination.page} of {items.pagination.totalPages}
        </span>
        <div className="flex gap-2">
          <Link
            to="/dashboard/collections/$name"
            params={{ name: collection.slug }}
            search={{
              page: Math.max(1, search.page - 1),
              projectId: search.projectId,
            }}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${search.page <= 1 ? "pointer-events-none border-stone-200 text-stone-300" : "border-stone-300 hover:bg-stone-50"}`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Previous
          </Link>
          <Link
            to="/dashboard/collections/$name"
            params={{ name: collection.slug }}
            search={{
              page: Math.min(items.pagination.totalPages, search.page + 1),
              projectId: search.projectId,
            }}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${!items.pagination.hasMore ? "pointer-events-none border-stone-200 text-stone-300" : "border-stone-300 hover:bg-stone-50"}`}
          >
            Next
            <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
          </Link>
        </div>
      </div>

      {showModal ? (
        <ItemEditorModal
          collection={collection}
          item={editingItem}
          onClose={() => setShowModal(false)}
          onSaved={(savedMessage) => {
            setMessage(savedMessage);
            setShowModal(false);
            onInvalidate();
          }}
        />
      ) : null}

      {previewImage ? (
        <button
          type="button"
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          aria-label="Close preview"
        >
          <img
            src={previewImage}
            alt="Preview"
            className="max-h-full max-w-full rounded-lg bg-white object-contain"
          />
        </button>
      ) : null}
    </section>
  );
}

function CollectionPageSkeleton() {
  return (
    <section className="space-y-6">
      <div>
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3">
                  <Skeleton className="h-4 w-16" />
                </th>
                <th className="px-4 py-3">
                  <Skeleton className="h-4 w-16" />
                </th>
                <th className="px-4 py-3 text-right">
                  <Skeleton className="ml-auto h-4 w-16" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-32" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-16" />
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
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>
    </section>
  );
}

function FieldValue(props: {
  type: "text" | "url" | "number" | "boolean" | "date";
  value: unknown;
  onImagePreview?: (url: string) => void;
}) {
  if (props.type === "boolean") {
    return props.value ? (
      <span className="inline-flex items-center gap-1 text-green-600">
        <Check className="h-4 w-4" />
        Yes
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-stone-400">
        <X className="h-4 w-4" />
        No
      </span>
    );
  }

  if (props.type === "url" && typeof props.value === "string") {
    const imageUrl = props.value;
    const looksLikeImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(imageUrl);

    if (looksLikeImage) {
      return (
        <button
          type="button"
          onClick={() => props.onImagePreview?.(imageUrl)}
          className="block"
        >
          <img
            src={imageUrl}
            alt="Preview"
            className="h-10 w-10 rounded-md object-cover"
          />
        </button>
      );
    }

    return (
      <a
        href={imageUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-stone-700 underline underline-offset-4 hover:text-stone-900"
      >
        <ExternalLink className="h-3 w-3" />
        {imageUrl}
      </a>
    );
  }

  if (props.type === "date" && typeof props.value === "string") {
    const date = new Date(props.value);

    if (Number.isNaN(date.getTime())) {
      return <span>{props.value}</span>;
    }

    return (
      <span className="inline-flex items-center gap-1.5 text-stone-700">
        <Calendar className="h-4 w-4 text-stone-400" />
        {new Intl.DateTimeFormat(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(date)}
      </span>
    );
  }

  return <span>{String(props.value ?? "-")}</span>;
}

function ItemEditorModal(props: {
  collection: {
    id: string;
    slug: string;
    schema: CollectionField[];
  };
  item: ItemRecord | null;
  onClose: () => void;
  onSaved: (message: { type: "success" | "error"; text: string }) => void;
}) {
  const [values, setValues] = useState<
    Record<string, string | number | boolean | null>
  >(() => {
    const initialValues: Record<string, string | number | boolean | null> = {};

    initialValues._published = props.item?.data._published ?? false;

    for (const field of props.collection.schema) {
      initialValues[field.key] =
        props.item?.data[field.key] ?? defaultValueForField(field.type);
    }

    return initialValues;
  });
  const [pending, setPending] = useState(false);

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

    const result = props.item
      ? await updateItemServerFn({
          data: {
            id: props.item.id,
            slug: props.collection.slug,
            values,
          },
        })
      : await createItemServerFn({
          data: {
            collectionId: props.collection.id,
            slug: props.collection.slug,
            values,
          },
        });

    setPending(false);

    props.onSaved(
      result
        ? {
            type: "success",
            text: props.item ? "Item updated." : "Item created.",
          }
        : { type: "error", text: "Unable to save item." },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={props.item ? "Edit item" : "New item"}
    >
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold tracking-tight">
            {props.item ? "Edit item" : "New item"}
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

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-stone-700">Published</span>
            <FieldInput
              field={{ type: "boolean" }}
              value={values._published ?? false}
              onChange={(value) =>
                setValues((current) => ({ ...current, _published: value }))
              }
            />
            <span className="text-xs text-stone-400">
              Only published items are available on the public API.
            </span>
          </label>

          {props.collection.schema.map((field) => (
            <label key={field.key} className="grid gap-1.5">
              <span className="text-sm font-medium text-stone-700">
                {field.label}
              </span>
              <FieldInput
                field={field}
                value={values[field.key]}
                onChange={(value) =>
                  setValues((current) => ({ ...current, [field.key]: value }))
                }
              />
              <span className="text-xs text-stone-400">
                {field.type === "boolean"
                  ? "Toggle between true and false."
                  : field.type === "url"
                    ? "Enter a full URL including https://"
                    : field.type === "number"
                      ? "Enter a numeric value."
                      : field.type === "date"
                        ? "Pick a calendar date."
                      : "Enter text content."}
              </span>
            </label>
          ))}

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
                : props.item
                  ? "Save changes"
                  : "Create item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FieldInput(props: {
  field: { type: "text" | "url" | "number" | "boolean" | "date" };
  value: string | number | boolean | null;
  onChange: (value: string | number | boolean | null) => void;
}) {
  if (props.field.type === "boolean") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-stone-300 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-stone-700">
            {props.value === true ? "Enabled" : "Disabled"}
          </p>
          <p className="text-xs text-stone-400">Toggle this field on or off.</p>
        </div>
        <Switch
          checked={props.value === true}
          onCheckedChange={(checked) => props.onChange(checked)}
          aria-label="Toggle boolean field"
        />
      </div>
    );
  }

  return (
    <input
      type={
        props.field.type === "number"
          ? "number"
          : props.field.type === "date"
            ? "date"
            : "text"
      }
      value={props.value === null ? "" : String(props.value)}
      onChange={(event) =>
        props.onChange(
          props.field.type === "number"
            ? event.target.value === ""
              ? null
              : Number(event.target.value)
            : event.target.value,
        )
      }
      placeholder={
        props.field.type === "url"
          ? "https://example.com"
          : props.field.type === "number"
            ? "0"
            : props.field.type === "date"
              ? "YYYY-MM-DD"
            : "Enter value..."
      }
      className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
    />
  );
}

function defaultValueForField(
  type: "text" | "url" | "number" | "boolean" | "date",
) {
  if (type === "boolean") {
    return false;
  }

  if (type === "number") {
    return null;
  }

  return "";
}
